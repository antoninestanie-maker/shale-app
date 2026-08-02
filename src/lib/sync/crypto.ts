/**
 * Chiffrement de bout en bout de la synchronisation.
 *
 * Ce fichier est PUR : il ne connaît ni Tauri, ni le réseau, ni la base. Il ne
 * manipule que des octets et des clés WebCrypto — donc il se teste intégralement,
 * ce qui est le minimum pour la pièce dont dépend la lisibilité des données.
 *
 * ─── LE MODÈLE, EN UN COUP D'ŒIL ───────────────────────────────────────────
 *
 *   mot de passe ──Argon2id(sel₁)──▶ KEK₁ ─┐
 *                                          ├──▶ chiffrent la MÊME DEK aléatoire
 *   phrase de récup. ─Argon2id(sel₂)─▶ KEK₂ ┘
 *
 *   DEK ──HKDF──▶ cleLignes  (AES-256-GCM, chiffre chaque ligne)
 *        ──HKDF──▶ cleUid    (HMAC-SHA-256, aveugle les identifiants)
 *
 * DEUX ENVELOPPES, UNE SEULE CLÉ DE DONNÉES. C'est ce qui rend le changement de
 * mot de passe indolore : on re-chiffre une enveloppe de quelques dizaines
 * d'octets, jamais les données. Et c'est ce qui rend la phrase de récupération
 * utile : elle ouvre exactement la même DEK, par un autre chemin.
 *
 * DEUX SOUS-CLÉS PLUTÔT QU'UNE. Séparation des usages : la clé qui chiffre les
 * lignes ne sert jamais à calculer un identifiant, et réciproquement. Réutiliser
 * une même clé pour deux primitives est une faute classique, aux conséquences
 * difficiles à prévoir.
 *
 * ─── CE QUE LE SERVEUR VOIT ────────────────────────────────────────────────
 * Des blobs opaques, plus : un identifiant de table AVEUGLÉ, un identifiant de
 * ligne AVEUGLÉ, un horodatage et un drapeau de suppression. Les deux premiers
 * sont des HMAC : déterministes (deux appareils calculent la même valeur, donc
 * la synchronisation fonctionne) mais irréversibles pour qui n'a pas la clé.
 * Sans cet aveuglement, un uid tel que `tg:silver-bullet` livrerait le nom d'un
 * tag, et le nom des tables révélerait « cet utilisateur a 340 trades ».
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/** Version du format d'enveloppe. Change si la disposition des octets change. */
const VERSION = 1;

/** Bit 0 des drapeaux : la charge utile est compressée en gzip. */
const DRAPEAU_GZIP = 1;

/** AES-GCM impose 12 octets ; jamais deux fois le même sous une même clé. */
const TAILLE_NONCE = 12;

/**
 * Paramètres Argon2id de production, versionnés.
 *
 * 64 Mio / 3 passes ≈ 150 ms sur un Mac récent — imperceptible pour une
 * opération qui n'a lieu qu'au déverrouillage, jamais sur le chemin d'une
 * écriture. Ils sont stockés à côté de l'enveloppe : les durcir un jour ne
 * rendra pas les anciennes enveloppes illisibles.
 */
export const PARAMS_KDF = {
  version: 1,
  memoireKio: 64 * 1024,
  passes: 3,
  parallelisme: 1,
} as const;

export type ParamsKdf = typeof PARAMS_KDF;

// ─── Encodage ────────────────────────────────────────────────────────────────

export function versBase64(octets: Uint8Array): string {
  let s = "";
  for (const o of octets) s += String.fromCharCode(o);
  return btoa(s);
}

export function depuisBase64(texte: string): Uint8Array {
  const brut = atob(texte);
  const octets = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) octets[i] = brut.charCodeAt(i);
  return octets;
}

/** Base64 sûr en URL et en identifiant : ni `+`, ni `/`, ni `=`. */
export function versBase64Url(octets: Uint8Array): string {
  return versBase64(octets).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Octets aléatoires cryptographiques — nonces, sels, clés.
 *
 * ⚠️ `getRandomValues` refuse au-delà de 65 536 octets (limite de la
 * spécification, pas du navigateur). Ce n'est pas une gêne : cette fonction
 * n'existe que pour des valeurs de quelques dizaines d'octets. Le garde-fou est
 * là pour qu'un mésusage échoue avec une phrase claire plutôt qu'avec un
 * `QuotaExceededError` déroutant.
 */
export function octetsAleatoires(n: number): Uint8Array {
  if (n > 65536) {
    throw new Error(
      `octetsAleatoires(${n}) : au-delà de 65 536 octets, getRandomValues refuse. ` +
        "Cette fonction sert aux nonces et aux clés, pas à produire des données en volume.",
    );
  }
  return crypto.getRandomValues(new Uint8Array(n));
}

// ─── Clés ────────────────────────────────────────────────────────────────────

/** Clé de données, tirée au sort une seule fois dans la vie du compte. */
export function genererDek(): Uint8Array {
  return octetsAleatoires(32);
}

/** Sel de dérivation. Public — il n'a pas à être secret, seulement unique. */
export function genererSel(): Uint8Array {
  return octetsAleatoires(16);
}

export interface SousCles {
  /** AES-256-GCM : chiffre et déchiffre le contenu des lignes. */
  cleLignes: CryptoKey;
  /** HMAC-SHA-256 : aveugle les noms de table et les identifiants de ligne. */
  cleUid: CryptoKey;
}

/**
 * Dérive les clés d'usage depuis la DEK.
 *
 * Le `info` de HKDF sépare les domaines : deux usages différents, deux clés qui
 * n'ont aucun lien calculable entre elles. Il porte un numéro de version pour
 * pouvoir faire tourner un usage sans toucher aux autres.
 */
export async function deriverSousCles(dek: Uint8Array): Promise<SousCles> {
  if (dek.length !== 32) throw new Error("DEK invalide : 32 octets attendus");

  const mere = await crypto.subtle.importKey("raw", dek as BufferSource, "HKDF", false, ["deriveKey"]);
  const hkdf = (info: string) => ({
    name: "HKDF",
    hash: "SHA-256",
    salt: enc.encode("shale/sync/v1"),
    info: enc.encode(info),
  });

  const [cleLignes, cleUid] = await Promise.all([
    crypto.subtle.deriveKey(hkdf("lignes/v1"), mere, { name: "AES-GCM", length: 256 }, false, [
      "encrypt",
      "decrypt",
    ]),
    crypto.subtle.deriveKey(hkdf("uid/v1"), mere, { name: "HMAC", hash: "SHA-256", length: 256 }, false, [
      "sign",
    ]),
  ]);
  return { cleLignes, cleUid };
}

// ─── Enveloppes de la DEK ────────────────────────────────────────────────────

/**
 * Quel chemin ouvre l'enveloppe. Entre dans les données authentifiées : une
 * enveloppe « mot de passe » ne peut pas être présentée comme une enveloppe
 * « récupération », ni l'enveloppe d'un compte servie à un autre.
 */
export type CheminDeCle = "password" | "recovery";

function aadEnveloppe(userId: string, chemin: CheminDeCle): Uint8Array {
  return enc.encode(`shale-dek-v${VERSION}|${userId}|${chemin}`);
}

async function importerKek(kek: Uint8Array): Promise<CryptoKey> {
  if (kek.length !== 32) throw new Error("KEK invalide : 32 octets attendus");
  return crypto.subtle.importKey("raw", kek as BufferSource, "AES-GCM", false, ["encrypt", "decrypt"]);
}

/** Chiffre la DEK avec une clé issue d'un secret utilisateur. */
export async function emballerDek(
  dek: Uint8Array,
  kek: Uint8Array,
  userId: string,
  chemin: CheminDeCle,
): Promise<Uint8Array> {
  const nonce = octetsAleatoires(TAILLE_NONCE);
  const scelle = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aadEnveloppe(userId, chemin) as BufferSource },
      await importerKek(kek),
      dek as BufferSource,
    ),
  );
  const sortie = new Uint8Array(1 + TAILLE_NONCE + scelle.length);
  sortie[0] = VERSION;
  sortie.set(nonce, 1);
  sortie.set(scelle, 1 + TAILLE_NONCE);
  return sortie;
}

/**
 * Rouvre la DEK. Lève si le secret est faux — jamais de DEK approximative :
 * GCM authentifie, donc un mauvais mot de passe donne une erreur, pas des
 * octets aléatoires qui déchiffreraient ensuite n'importe quoi en bouillie.
 */
export async function deballerDek(
  enveloppe: Uint8Array,
  kek: Uint8Array,
  userId: string,
  chemin: CheminDeCle,
): Promise<Uint8Array> {
  if (enveloppe.length < 1 + TAILLE_NONCE + 16) throw new Error("enveloppe tronquée");
  if (enveloppe[0] !== VERSION) throw new Error(`version d'enveloppe inconnue : ${enveloppe[0]}`);

  const nonce = enveloppe.subarray(1, 1 + TAILLE_NONCE);
  const scelle = enveloppe.subarray(1 + TAILLE_NONCE);
  const clair = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aadEnveloppe(userId, chemin) as BufferSource },
      await importerKek(kek),
      scelle as BufferSource,
    ),
  );
  if (clair.length !== 32) throw new Error("DEK de longueur inattendue");
  return clair;
}

// ─── Aveuglement des identifiants ────────────────────────────────────────────

/**
 * Transforme une valeur en identifiant opaque, stable et non réversible.
 *
 * Déterministe : deux appareils partageant la DEK obtiennent la même sortie —
 * c'est ce qui permet à la synchronisation de reconnaître une même ligne sans
 * que le serveur puisse en lire le nom.
 *
 * Le `domaine` empêche une collision entre deux usages : un nom de table et un
 * uid de ligne ne peuvent pas produire la même valeur par hasard.
 */
export async function aveugler(cleUid: CryptoKey, domaine: string, valeur: string): Promise<string> {
  const empreinte = await crypto.subtle.sign("HMAC", cleUid, enc.encode(`${domaine} ${valeur}`));
  return versBase64Url(new Uint8Array(empreinte));
}

// ─── Compression ─────────────────────────────────────────────────────────────

/**
 * `CompressionStream` n'existe pas partout (Safari < 16.4). Son absence n'est
 * pas une erreur : on envoie alors la charge utile telle quelle, le drapeau de
 * l'enveloppe dit laquelle des deux formes a été employée. Un appareil ancien
 * et un appareil récent restent donc parfaitement interopérables.
 */
const COMPRESSION_DISPO = typeof globalThis.CompressionStream === "function";

async function viderFlux(flux: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const morceaux: Uint8Array[] = [];
  let total = 0;
  const lecteur = flux.getReader();
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
    total += value.length;
  }
  const sortie = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) {
    sortie.set(m, pos);
    pos += m.length;
  }
  return sortie;
}

async function comprimer(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Blob([donnees as BufferSource]).stream().pipeThrough(new CompressionStream("gzip"));
  return viderFlux(flux as ReadableStream<Uint8Array>);
}

async function decomprimer(donnees: Uint8Array): Promise<Uint8Array> {
  const flux = new Blob([donnees as BufferSource]).stream().pipeThrough(new DecompressionStream("gzip"));
  return viderFlux(flux as ReadableStream<Uint8Array>);
}

// ─── Chiffrement d'une ligne ─────────────────────────────────────────────────

/**
 * Métadonnées que le serveur voit en clair et qui sont AUTHENTIFIÉES avec le
 * blob. Sans cela, un serveur hostile pourrait recoller le contenu d'une ligne
 * sur une autre, ou rejouer une version ancienne en changeant l'horodatage :
 * le déchiffrement réussirait et l'app afficherait des données fausses en
 * toute confiance.
 *
 * `table` et `uid` sont les valeurs AVEUGLÉES — c'est ce que le serveur détient,
 * donc c'est ce que le destinataire peut vérifier.
 */
export interface MetadonneesLigne {
  userId: string;
  table: string;
  uid: string;
  ts: string;
}

function aadLigne(m: MetadonneesLigne): Uint8Array {
  return enc.encode(`shale-row-v${VERSION}|${m.userId}|${m.table}|${m.uid}|${m.ts}`);
}

/**
 * Sérialise, compresse si ça vaut le coup, puis chiffre une ligne.
 *
 * La compression a lieu AVANT le chiffrement — après, le résultat est
 * indistinguable d'un tirage aléatoire, donc incompressible. Elle n'est retenue
 * que si elle fait réellement gagner de la place : sur une note bourrée
 * d'images en base64 (déjà compressées), gzip ajouterait des octets.
 */
export async function chiffrerLigne(
  cleLignes: CryptoKey,
  donnees: unknown,
  meta: MetadonneesLigne,
): Promise<Uint8Array> {
  const brut = enc.encode(JSON.stringify(donnees));

  let charge = brut;
  let drapeaux = 0;
  if (COMPRESSION_DISPO) {
    const comprime = await comprimer(brut);
    if (comprime.length < brut.length) {
      charge = comprime;
      drapeaux |= DRAPEAU_GZIP;
    }
  }

  const nonce = octetsAleatoires(TAILLE_NONCE);
  const scelle = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aadLigne(meta) as BufferSource },
      cleLignes,
      charge as BufferSource,
    ),
  );

  const sortie = new Uint8Array(2 + TAILLE_NONCE + scelle.length);
  sortie[0] = VERSION;
  sortie[1] = drapeaux;
  sortie.set(nonce, 2);
  sortie.set(scelle, 2 + TAILLE_NONCE);
  return sortie;
}

/**
 * Rouvre une ligne. Lève si le blob a été altéré, si les métadonnées ne
 * correspondent pas, ou si la clé est mauvaise. Ne renvoie JAMAIS de données
 * douteuses : mieux vaut une ligne manquante et un message d'erreur qu'une
 * ligne fausse affichée comme authentique.
 */
export async function dechiffrerLigne(
  cleLignes: CryptoKey,
  blob: Uint8Array,
  meta: MetadonneesLigne,
): Promise<unknown> {
  if (blob.length < 2 + TAILLE_NONCE + 16) throw new Error("blob tronqué");
  if (blob[0] !== VERSION) throw new Error(`version de blob inconnue : ${blob[0]}`);

  const drapeaux = blob[1];
  const nonce = blob.subarray(2, 2 + TAILLE_NONCE);
  const scelle = blob.subarray(2 + TAILLE_NONCE);

  const charge = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: nonce as BufferSource, additionalData: aadLigne(meta) as BufferSource },
      cleLignes,
      scelle as BufferSource,
    ),
  );

  const brut = drapeaux & DRAPEAU_GZIP ? await decomprimer(charge) : charge;
  return JSON.parse(dec.decode(brut));
}
