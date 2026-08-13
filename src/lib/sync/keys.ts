import {
  deballerDek,
  deriverSousCles,
  emballerDek,
  genererDek,
  genererSel,
  PARAMS_KDF,
  type ParamsKdf,
  type SousCles,
} from "./crypto";
import { genererCode, normaliserCode, secretDepuisCode } from "./recovery";

/**
 * Cycle de vie de la clé de données : la créer, l'ouvrir, la re-sceller.
 *
 * Tout est ici sauf deux choses, volontairement laissées dehors : la dérivation
 * Argon2id (qui vit en Rust) et le stockage des enveloppes (qui vit chez
 * Supabase). Les deux sont INJECTÉES — c'est ce qui permet de tester ici la
 * mécanique complète, y compris les chemins d'échec, sans Tauri ni réseau.
 *
 * ⚠️ CE QUE CE MODULE REND IMPOSSIBLE, ET QUI EST VOULU. Personne ne peut
 * récupérer les données d'un compte dont le mot de passe ET le code de
 * récupération sont perdus. Ni le support, ni l'administrateur de la base. C'est
 * la définition du bout-en-bout, pas une lacune — mais c'est à dire clairement à
 * l'utilisateur, pas à découvrir le jour où ça arrive.
 */

/** Les enveloppes telles qu'elles vivent chez Supabase (table `sync_keys`). */
export interface Enveloppes {
  key_version: number;
  kdf: string;
  kdf_memory_kib: number;
  kdf_passes: number;
  kdf_parallelism: number;
  /** Chemin « mot de passe ». Toujours présent. */
  salt_password: Uint8Array;
  wrapped_password: Uint8Array;
  /** Chemin « code de récupération ». Absent si l'utilisateur s'en est passé. */
  salt_recovery: Uint8Array | null;
  wrapped_recovery: Uint8Array | null;
}

/** Où lire et écrire les enveloppes. Implémenté par `keystore.ts`. */
export interface DepotEnveloppes {
  lire(): Promise<Enveloppes | null>;
  ecrire(e: Enveloppes): Promise<void>;
}

/**
 * Dérivation d'une clé depuis un secret utilisateur. Injectée pour que ce
 * module reste testable : l'implémentation réelle passe par Argon2id en Rust
 * (`kdf.ts`), qui n'existe pas hors de l'app native.
 */
export type Derivation = (secret: string, sel: Uint8Array, params: ParamsKdf) => Promise<Uint8Array>;

/** La synchronisation n'a jamais été activée sur ce compte. */
export class CleAbsente extends Error {
  constructor() {
    super("Aucune clé de synchronisation n'existe pour ce compte.");
    this.name = "CleAbsente";
  }
}

/** Mot de passe ou code faux. Le message reste volontairement sobre. */
export class SecretInvalide extends Error {
  constructor(quoi: "mot de passe" | "code de récupération") {
    super(`Ce ${quoi} n'ouvre pas les données chiffrées.`);
    this.name = "SecretInvalide";
  }
}

/** Le compte n'a pas de chemin de récupération (choix de l'utilisateur). */
export class RecuperationAbsente extends Error {
  constructor() {
    super("Ce compte n'a pas de code de récupération.");
    this.name = "RecuperationAbsente";
  }
}

/** Enveloppe écrite par une version incompatible de l'app. */
export class VersionInconnue extends Error {
  constructor(version: number) {
    super(`Ces données chiffrées ont été écrites par une version plus récente (format ${version}).`);
    this.name = "VersionInconnue";
  }
}

const VERSION_SUPPORTEE = 1;

function verifier(e: Enveloppes): void {
  if (e.key_version > VERSION_SUPPORTEE) throw new VersionInconnue(e.key_version);
}

function parametresDe(e: Enveloppes): ParamsKdf {
  // ⚠️ Les paramètres viennent de l'ENVELOPPE, jamais des valeurs courantes.
  // C'est ce qui permettra de durcir les réglages un jour sans rendre illisible
  // ce qui a été scellé avant.
  return {
    version: e.key_version,
    memoireKio: e.kdf_memory_kib,
    passes: e.kdf_passes,
    parallelisme: e.kdf_parallelism,
  } as ParamsKdf;
}

export interface Ouverture {
  dek: Uint8Array;
  cles: SousCles;
}

// ─── Première activation ─────────────────────────────────────────────────────

export interface Activation extends Ouverture {
  /** Le code effectivement scellé, ou `null` si l'utilisateur s'en est passé. */
  codeRecuperation: string | null;
}

/**
 * Active la synchronisation : tire une clé de données neuve et la scelle.
 *
 * `codeRecuperation` décide si un second chemin d'ouverture est créé. `null` est
 * un choix défendable — il ne sert que dans un cas : mot de passe oublié ET plus
 * aucun appareil fonctionnel. Tant qu'un appareil reste déverrouillé, il détient
 * la clé et peut la re-sceller tout seul.
 *
 * ⚠️ LE CODE EST FOURNI, PAS TIRÉ ICI — et c'est le seul point de tout le
 * chantier où l'ordre des opérations est une exigence d'INTERFACE et pas de
 * cryptographie. Cette fonction écrit les enveloppes chez Supabase : quand elle
 * rend la main, la synchronisation EXISTE pour le compte. Si le code naissait
 * ici, il ne pourrait être montré qu'APRÈS — donc l'utilisateur confirmerait
 * l'avoir noté alors qu'il n'a plus le choix de refuser. L'appelant le tire
 * d'abord (`genererCode()`, pur), le fait confirmer, et n'active qu'ensuite.
 * Cf. `SyncOnboarding.tsx`.
 */
export async function activer(
  depot: DepotEnveloppes,
  deriver: Derivation,
  userId: string,
  motDePasse: string,
  codeRecuperation: string | null,
): Promise<Activation> {
  const dek = genererDek();

  const selMdp = genererSel();
  const kekMdp = await deriver(motDePasse, selMdp, PARAMS_KDF);
  const scelleMdp = await emballerDek(dek, kekMdp, userId, "password");

  let selRec: Uint8Array | null = null;
  let scelleRec: Uint8Array | null = null;

  if (codeRecuperation !== null) {
    selRec = genererSel();
    const kekRec = await deriver(secretDeCode(codeRecuperation), selRec, PARAMS_KDF);
    scelleRec = await emballerDek(dek, kekRec, userId, "recovery");
  }

  await depot.ecrire({
    key_version: PARAMS_KDF.version,
    kdf: "argon2id",
    kdf_memory_kib: PARAMS_KDF.memoireKio,
    kdf_passes: PARAMS_KDF.passes,
    kdf_parallelism: PARAMS_KDF.parallelisme,
    salt_password: selMdp,
    wrapped_password: scelleMdp,
    salt_recovery: selRec,
    wrapped_recovery: scelleRec,
  });

  return { dek, cles: await deriverSousCles(dek), codeRecuperation };
}

// ─── Ouverture ───────────────────────────────────────────────────────────────

export async function ouvrirAvecMotDePasse(
  depot: DepotEnveloppes,
  deriver: Derivation,
  userId: string,
  motDePasse: string,
): Promise<Ouverture> {
  const e = await depot.lire();
  if (!e) throw new CleAbsente();
  verifier(e);

  const kek = await deriver(motDePasse, e.salt_password, parametresDe(e));
  let dek: Uint8Array;
  try {
    dek = await deballerDek(e.wrapped_password, kek, userId, "password");
  } catch {
    // AES-GCM authentifie : un mot de passe faux ÉCHOUE ici, il ne produit pas
    // une clé approximative qui déchiffrerait ensuite tout en bouillie.
    throw new SecretInvalide("mot de passe");
  }
  return { dek, cles: await deriverSousCles(dek) };
}

export async function ouvrirAvecCode(
  depot: DepotEnveloppes,
  deriver: Derivation,
  userId: string,
  code: string,
): Promise<Ouverture> {
  const e = await depot.lire();
  if (!e) throw new CleAbsente();
  verifier(e);
  if (!e.salt_recovery || !e.wrapped_recovery) throw new RecuperationAbsente();

  // La somme de contrôle écarte une faute de recopie AVANT les ~150 ms de
  // dérivation : autant dire tout de suite « code mal recopié » plutôt que
  // faire patienter pour annoncer un échec indistinct.
  const canonique = normaliserCode(code);
  if (!canonique) throw new SecretInvalide("code de récupération");

  const kek = await deriver(secretDepuisCode(canonique), e.salt_recovery, parametresDe(e));
  let dek: Uint8Array;
  try {
    dek = await deballerDek(e.wrapped_recovery, kek, userId, "recovery");
  } catch {
    throw new SecretInvalide("code de récupération");
  }
  return { dek, cles: await deriverSousCles(dek) };
}

// ─── Re-scellement ───────────────────────────────────────────────────────────

/**
 * Change le mot de passe SANS toucher aux données.
 *
 * C'est tout l'intérêt de la double enveloppe : on re-scelle quelques dizaines
 * d'octets. Re-chiffrer les données exigerait de les rapatrier toutes, de les
 * déchiffrer, de les rechiffrer et de les renvoyer — impensable sur une base de
 * plusieurs centaines de mégaoctets, et catastrophique si le réseau lâche au
 * milieu.
 *
 * ⚠️ Le chemin de récupération n'est PAS touché : l'ancien code continue de
 * fonctionner. C'est voulu — sinon changer son mot de passe invaliderait
 * silencieusement le papier rangé dans un tiroir.
 */
export async function changerMotDePasse(
  depot: DepotEnveloppes,
  deriver: Derivation,
  userId: string,
  dek: Uint8Array,
  nouveauMotDePasse: string,
): Promise<void> {
  const e = await depot.lire();
  if (!e) throw new CleAbsente();

  // Sel NEUF : réutiliser l'ancien laisserait deux enveloppes dérivées du même
  // sel, ce qui facilite une attaque par comparaison.
  const sel = genererSel();
  const kek = await deriver(nouveauMotDePasse, sel, PARAMS_KDF);

  await depot.ecrire({
    ...e,
    key_version: PARAMS_KDF.version,
    kdf: "argon2id",
    kdf_memory_kib: PARAMS_KDF.memoireKio,
    kdf_passes: PARAMS_KDF.passes,
    kdf_parallelism: PARAMS_KDF.parallelisme,
    salt_password: sel,
    wrapped_password: await emballerDek(dek, kek, userId, "password"),
  });
}

/**
 * Pose ou remplace le code de récupération. Exige la clé de données, donc une
 * session déjà ouverte : on ne peut pas se fabriquer un accès sans en avoir un.
 */
export async function poserCodeRecuperation(
  depot: DepotEnveloppes,
  deriver: Derivation,
  userId: string,
  dek: Uint8Array,
): Promise<string> {
  const e = await depot.lire();
  if (!e) throw new CleAbsente();

  const code = genererCode();
  const sel = genererSel();
  const kek = await deriver(secretDeCode(code), sel, PARAMS_KDF);

  await depot.ecrire({
    ...e,
    salt_recovery: sel,
    wrapped_recovery: await emballerDek(dek, kek, userId, "recovery"),
  });
  return code;
}

/** Retire le chemin de récupération. Le code déjà noté cesse de fonctionner. */
export async function retirerCodeRecuperation(depot: DepotEnveloppes): Promise<void> {
  const e = await depot.lire();
  if (!e) throw new CleAbsente();
  await depot.ecrire({ ...e, salt_recovery: null, wrapped_recovery: null });
}

/** Forme canonique du code, telle qu'elle entre dans la dérivation. */
function secretDeCode(code: string): string {
  const canonique = normaliserCode(code);
  if (!canonique) throw new Error("code de récupération mal formé");
  return secretDepuisCode(canonique);
}
