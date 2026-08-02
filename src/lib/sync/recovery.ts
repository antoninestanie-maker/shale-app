/**
 * Code de récupération — le second chemin vers la clé de données.
 *
 * ⚠️ CHOIX À CONNAÎTRE : c'est un CODE, pas une suite de douze mots.
 *
 * Une phrase façon BIP-39 supposerait d'embarquer une liste figée de 2048 mots,
 * et surtout de choisir SA langue. Or l'app est bilingue et la langue se change
 * dans les réglages : une phrase générée en français devrait rester valable
 * après un passage en anglais, ce qui interdit de dériver la liste de la langue
 * d'affichage. On aurait donc une liste anglaise imposée à un utilisateur
 * francophone — l'avantage de mémorisation s'effondre, il reste le poids.
 *
 * Un code en base 32 de Crockford donne la même entropie sans liste ni langue,
 * avec un alphabet dépourvu de caractères confondables (ni I, ni L, ni O, ni U)
 * et une somme de contrôle qui détecte une faute de recopie AVANT de lancer une
 * dérivation de 150 ms puis d'annoncer un échec.
 *
 * De toute façon, un secret de récupération se NOTE, il ne se mémorise pas.
 *
 * ─── Format ────────────────────────────────────────────────────────────────
 *   SHALE-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XX0Y
 *   26 caractères de données (130 bits) + 2 de contrôle, affichés par groupes
 *   de 4. La saisie est tolérante : minuscules, espaces, tirets absents,
 *   I/L pris pour 1 et O pour 0 — les confusions classiques sont rattrapées.
 */

/** Base 32 de Crockford : ni I, ni L, ni O, ni U. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const NB_DONNEES = 26;
const NB_CONTROLE = 2;
export const LONGUEUR_CODE = NB_DONNEES + NB_CONTROLE;

const PREFIXE = "SHALE-";

/**
 * Somme de contrôle. Hachage polynomial sur 10 bits → 2 caractères.
 *
 * ⚠️ Ce n'est PAS une protection cryptographique et ça n'a pas à en être une :
 * son seul rôle est d'attraper une faute de recopie. Un code faux mais de somme
 * correcte ne déverrouille rien — c'est AES-GCM qui tranche pour de bon.
 * Le multiplicateur impair rend la somme sensible à l'ORDRE, donc une
 * interversion de deux caractères est détectée.
 */
function controle(donnees: string): string {
  let acc = 0;
  for (const c of donnees) acc = (acc * 33 + ALPHABET.indexOf(c)) % 1024;
  return ALPHABET[acc >> 5] + ALPHABET[acc & 31];
}

/** Groupes de 4, préfixés — la forme sous laquelle le code est montré et noté. */
export function formaterCode(canonique: string): string {
  return PREFIXE + (canonique.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * Tire un code neuf. 130 bits d'entropie.
 *
 * Le tirage passe par `getRandomValues` : 256 est un multiple de 32, donc
 * prendre les 5 bits de poids faible d'un octet reste uniforme — pas de biais
 * introduit par un modulo mal placé.
 */
export function genererCode(): string {
  const octets = crypto.getRandomValues(new Uint8Array(NB_DONNEES));
  let donnees = "";
  for (const o of octets) donnees += ALPHABET[o & 31];
  return formaterCode(donnees + controle(donnees));
}

/**
 * Ramène une saisie à sa forme canonique, ou `null` si elle est invalide.
 *
 * Tolère : minuscules, espaces, tirets, préfixe absent, et les confusions
 * d'alphabet (I et L pour 1, O pour 0). Rejette tout le reste — un caractère
 * hors alphabet est une faute de frappe, pas une variante.
 */
export function normaliserCode(saisie: string): string | null {
  // L'ORDRE COMPTE, deux fois.
  //  1. Les séparateurs partent AVANT le préfixe : sinon une espace ou un saut
  //     de ligne en tête (copier-coller depuis un gestionnaire de mots de passe,
  //     un courriel, un carnet) empêche de reconnaître `SHALE` et tout est
  //     rejeté. C'était un vrai bogue, attrapé en test.
  //  2. Le préfixe part AVANT la conversion des confondables : `SHALE` contient
  //     un `L`, qui deviendrait sinon un `1` au milieu des données.
  const nettoye = saisie
    .toUpperCase()
    .replace(/[\s\-_.]/g, "")
    .replace(/^SHALE/, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0");

  if (nettoye.length !== LONGUEUR_CODE) return null;
  if ([...nettoye].some((c) => !ALPHABET.includes(c))) return null;

  const donnees = nettoye.slice(0, NB_DONNEES);
  if (nettoye.slice(NB_DONNEES) !== controle(donnees)) return null;
  return nettoye;
}

/**
 * Le secret transmis à Argon2id. Seuls les caractères de DONNÉES comptent : la
 * somme de contrôle est dérivée d'eux, elle n'ajoute aucune entropie et n'a
 * rien à faire dans la dérivation.
 */
export function secretDepuisCode(canonique: string): string {
  return canonique.slice(0, NB_DONNEES);
}

/**
 * Indices des groupes de 4 à faire ressaisir pour prouver que le code a bien
 * été noté. Trois groupes sur sept : assez pour qu'un utilisateur qui n'a rien
 * noté échoue, assez peu pour ne pas transformer l'onboarding en corvée.
 *
 * Le tirage est aléatoire à chaque appel — un même utilisateur qui recommence
 * ne retombe pas sur les mêmes groupes.
 */
export function groupesAVerifier(combien = 3): number[] {
  const total = Math.ceil(LONGUEUR_CODE / 4);
  const indices = [...Array(total).keys()];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, Math.min(combien, total)).sort((a, b) => a - b);
}

/** Groupe n° `index` (base 0) d'un code canonique — pour l'écran de vérification. */
export function groupe(canonique: string, index: number): string {
  return canonique.slice(index * 4, index * 4 + 4);
}
