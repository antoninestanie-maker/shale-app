import type { CustomObject, FieldType, ObjectField, ObjectType } from "./types";

/**
 * Les types d'objets et leurs champs — logique pure.
 *
 * SOURCE UNIQUE de ce qu'est un champ valide, de ce qu'est une valeur valide,
 * et surtout de CE QUI ARRIVE AUX VALEURS QUAND LE TYPE CHANGE. Ce dernier
 * point est celui qui décide de la qualité du module, et c'est aussi le seul
 * qui puisse détruire des données sans que personne ne s'en aperçoive.
 *
 * ⚠️ Ne touche pas à la base : testable sans SQLite ni Tauri.
 */

export const FIELD_TYPES: readonly FieldType[] = ["text", "number", "date", "link", "choice"] as const;

const TYPES = new Set<string>(FIELD_TYPES);

// ─── Lecture et écriture du JSON ─────────────────────────────────────────────

/**
 * Les champs déclarés par un type.
 *
 * ⚠️ TOLÉRANTE PAR CONSTRUCTION. Un JSON illisible ou d'une forme inattendue
 * rend une liste VIDE au lieu de lever : cette colonne peut arriver d'un autre
 * appareil qui tourne une version différente de l'app, et une exception ici
 * ferait planter l'écran plutôt que d'afficher une fiche incomplète. Le même
 * choix que celui d'`appliquerLigne`, qui ignore les colonnes inconnues au lieu
 * de refuser la ligne.
 */
export function champsDuType(fields: string | null | undefined): ObjectField[] {
  if (!fields) return [];
  let brut: unknown;
  try {
    brut = JSON.parse(fields);
  } catch {
    return [];
  }
  if (!Array.isArray(brut)) return [];

  const champs: ObjectField[] = [];
  for (const c of brut) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (typeof o.id !== "string" || !o.id) continue;
    if (typeof o.name !== "string") continue;
    if (typeof o.type !== "string" || !TYPES.has(o.type)) continue;
    const champ: ObjectField = {
      id: o.id,
      name: o.name,
      type: o.type as FieldType,
      required: o.required ? 1 : 0,
    };
    if (champ.type === "choice" && Array.isArray(o.options)) {
      champ.options = o.options.filter((x): x is string => typeof x === "string");
    }
    champs.push(champ);
  }
  return champs;
}

export function serialiserChamps(champs: readonly ObjectField[]): string {
  return JSON.stringify(champs);
}

/** Les valeurs d'un objet, indexées par l'`id` de champ. Tolérante, comme ci-dessus. */
export function valeursDeLObjet(field_values: string | null | undefined): Record<string, unknown> {
  if (!field_values) return {};
  try {
    const brut: unknown = JSON.parse(field_values);
    if (!brut || typeof brut !== "object" || Array.isArray(brut)) return {};
    return brut as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function serialiserValeurs(valeurs: Readonly<Record<string, unknown>>): string {
  return JSON.stringify(valeurs);
}

// ─── Identité des champs ─────────────────────────────────────────────────────

/**
 * Un identifiant de champ qui n'a JAMAIS servi dans ce type.
 *
 * ⚠️ Ne réutilise pas un `id` libéré par un champ supprimé. Le faire
 * ressusciterait, dans le nouveau champ, les valeurs de l'ancien : ajouter
 * « Téléphone » après avoir supprimé « Rôle » afficherait « Développeur » comme
 * numéro de téléphone, sur toutes les fiches, sans rien signaler. Le compteur
 * repart donc du plus grand `fN` jamais vu, pas du nombre de champs.
 */
export function nouvelIdDeChamp(champs: readonly ObjectField[], valeursConnues: readonly string[] = []): string {
  let max = 0;
  for (const id of [...champs.map((c) => c.id), ...valeursConnues]) {
    const m = /^f(\d+)$/.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `f${max + 1}`;
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Ce qui empêche d'enregistrer un TYPE.
 *
 * Rend des messages en FRANÇAIS, conformément à la convention i18n du projet
 * (la clé de traduction EST la phrase française) ; l'interface les passe par
 * `t()` à l'affichage. ⚠️ Aucun `t()` ici : ce module est importé au démarrage
 * et figerait la langue.
 */
export function validerType(nom: string, champs: readonly ObjectField[]): string[] {
  const erreurs: string[] = [];
  if (!nom.trim()) erreurs.push("Un type doit avoir un nom.");

  const ids = new Set<string>();
  const noms = new Set<string>();
  for (const c of champs) {
    if (!c.name.trim()) erreurs.push("Un champ doit avoir un nom.");
    if (ids.has(c.id)) erreurs.push("Deux champs portent le même identifiant.");
    ids.add(c.id);
    // Deux champs homonymes ne sont pas une faute de données — les valeurs sont
    // rangées par `id` — mais l'utilisateur ne saurait plus lequel il remplit.
    if (c.name.trim() && noms.has(c.name.trim())) {
      erreurs.push(`Deux champs s'appellent « ${c.name.trim()} ».`);
    }
    noms.add(c.name.trim());
    if (c.type === "choice" && (!c.options || c.options.length === 0)) {
      erreurs.push(`Le champ « ${c.name} » est un choix, mais n'offre aucune option.`);
    }
  }
  return erreurs;
}

const DATE_ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ce qui empêche d'enregistrer un OBJET.
 *
 * ⚠️ Ne regarde QUE les champs actuellement déclarés par le type. Une valeur
 * orpheline (dont le champ a été retiré) n'est jamais une erreur : elle est
 * conservée en silence et attend le retour éventuel de son champ. Voir
 * `fusionnerValeurs`.
 */
export function validerObjet(
  champs: readonly ObjectField[],
  valeurs: Readonly<Record<string, unknown>>,
): string[] {
  const erreurs: string[] = [];
  for (const c of champs) {
    const v = valeurs[c.id];
    const vide = v === undefined || v === null || v === "";

    if (c.required && vide) {
      erreurs.push(`Le champ « ${c.name} » est obligatoire.`);
      continue;
    }
    if (vide) continue;

    if (c.type === "number" && typeof v !== "number") {
      erreurs.push(`Le champ « ${c.name} » attend un nombre.`);
    }
    if (c.type === "date" && (typeof v !== "string" || !DATE_ISO.test(v))) {
      erreurs.push(`Le champ « ${c.name} » attend une date.`);
    }
    if (c.type === "choice" && (typeof v !== "string" || !(c.options ?? []).includes(v))) {
      erreurs.push(`Le champ « ${c.name} » n'accepte pas cette valeur.`);
    }
  }
  return erreurs;
}

// ─── ⭐ Ce qui arrive aux valeurs quand le type change ────────────────────────

/**
 * Les valeurs dont le champ n'existe plus dans le type.
 *
 * Sert à DIRE ce qui va cesser d'être affiché, avant que l'utilisateur ne
 * valide le retrait d'un champ. Une donnée qui disparaît de l'écran sans que
 * personne ne l'ait annoncé est indiscernable d'une donnée perdue.
 */
export function valeursOrphelines(
  champs: readonly ObjectField[],
  valeurs: Readonly<Record<string, unknown>>,
): string[] {
  const connus = new Set(champs.map((c) => c.id));
  return Object.keys(valeurs).filter((id) => !connus.has(id));
}

/**
 * ⭐ LA PROMESSE DU MODULE : retirer un champ d'un type ne détruit RIEN.
 *
 * Retirer un champ est un geste d'une seconde ; il ne doit pas effacer ce que
 * trois cents fiches contiennent. Les valeurs dont le champ a disparu sont donc
 * CONSERVÉES en base, simplement plus affichées — et si le champ est remis,
 * elles réapparaissent d'elles-mêmes, sous le même `id` (voir
 * `nouvelIdDeChamp`, qui ne recycle jamais un identifiant).
 *
 * `saisies` ne porte que ce que l'écran a montré ; tout le reste de `anciennes`
 * est préservé tel quel. C'est l'inverse d'un remplacement, et c'est
 * délibéré : un `JSON.stringify` du formulaire aurait effacé les orphelines à
 * la première sauvegarde, sans un mot.
 */
export function fusionnerValeurs(
  anciennes: Readonly<Record<string, unknown>>,
  saisies: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  return { ...anciennes, ...saisies };
}

/** Les valeurs effectivement affichables : celles dont le champ existe encore. */
export function valeursAffichables(
  champs: readonly ObjectField[],
  valeurs: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const visibles: Record<string, unknown> = {};
  for (const c of champs) {
    if (c.id in valeurs) visibles[c.id] = valeurs[c.id];
  }
  return visibles;
}

// ─── Confort de lecture ──────────────────────────────────────────────────────

/** Le type d'un objet, ou `undefined` si son type a été supprimé entre-temps. */
export function typeDeLObjet(
  objet: Pick<CustomObject, "type_id">,
  types: readonly ObjectType[],
): ObjectType | undefined {
  return types.find((t) => t.id === objet.type_id);
}
