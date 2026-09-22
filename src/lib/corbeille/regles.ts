/**
 * La corbeille « Supprimés récemment » — les règles, sans base ni réseau.
 *
 * Migration 027. Voir son en-tête pour le POURQUOI (une colonne `deleted_at`,
 * pas une table d'instantanés) ; ce fichier dit le QUOI, et il se teste seul.
 */

/**
 * Les familles d'objets qui passent par la corbeille.
 *
 * ⚠️ Ce sont les `LinkKind` de l'app quand ils existent (`note`, `task`,
 * `goal`, `event`, `knowledge`, `object`), pour qu'un même mot désigne la même
 * chose d'un bout à l'autre du dépôt. Quatre s'y ajoutent, qui ne se lient pas.
 */
export type KindCorbeille =
  | "note"
  | "task"
  | "goal"
  | "event"
  | "object"
  | "knowledge"
  | "invoice"
  | "journal"
  | "metric"
  | "habit";

export interface TableCorbeille {
  /** Nom physique de la table. */
  table: string;
  /** La colonne qui fait office de titre dans la vue « Supprimés récemment ». */
  titre: string;
}

/**
 * ⭐ LA SOURCE UNIQUE des tables à corbeille.
 *
 * Toute table listée ici DOIT porter `deleted_at` (migration 027) et DOIT être
 * synchronisée (`sync/scope.ts`) — deux tests y veillent. Une table qui aurait
 * la colonne sans être listée ici garderait ses lignes en corbeille pour
 * toujours : la purge ne la connaîtrait pas.
 *
 * ⚠️ Constante de module : AUCUN `t()` ici (`PASSATION.md` § 14.2). Les noms
 * de module affichés vivent côté interface, traduits à l'affichage.
 */
export const TABLE_DE: Readonly<Record<KindCorbeille, TableCorbeille>> = {
  note: { table: "notes", titre: "title" },
  task: { table: "tasks", titre: "label" },
  goal: { table: "goals", titre: "title" },
  event: { table: "calendar_events", titre: "title" },
  // Les SUJETS du Savoir : la table a gardé son nom de 2026-07 (migration 022).
  object: { table: "knowledge_topics", titre: "name" },
  knowledge: { table: "knowledge_entries", titre: "title" },
  invoice: { table: "invoices", titre: "numero" },
  journal: { table: "journal_entries", titre: "date" },
  metric: { table: "custom_metrics", titre: "name" },
  habit: { table: "habits", titre: "name" },
};

export const KINDS_CORBEILLE = Object.keys(TABLE_DE) as KindCorbeille[];
export const TABLES_CORBEILLE: readonly string[] = KINDS_CORBEILLE.map((k) => TABLE_DE[k].table);

/**
 * Le fragment SQL qui dit « vivant ».
 *
 * ⭐ UNE SEULE ÉCRITURE du filtre pour tout `repo.ts`. S'il fallait un jour
 * changer la règle (une corbeille à plusieurs états, par exemple), c'est ici,
 * et nulle part ailleurs.
 */
export const VIVANT = "deleted_at IS NULL";

/** Même règle, préfixée par l'alias d'une jointure : `vivant("n")` → `n.deleted_at IS NULL`. */
export function vivant(alias: string): string {
  return `${alias}.${VIVANT}`;
}

/** Combien de jours un objet reste restaurable. Fixe — un réglage est hors périmètre. */
export const RETENTION_JOURS = 30;
const JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * L'horodatage d'une mise en corbeille : UTC, ISO, à la milliseconde.
 *
 * ⚠️ PAS l'heure locale (`localNow()`) du reste de l'app. Cet instant est
 * comparé ENTRE APPAREILS — pour le décompte des 30 jours, et pour reconnaître
 * un LOT (tous les objets jetés ensemble portent exactement celui-ci). Deux
 * heures locales de fuseaux différents ne se comparent pas. C'est le format de
 * `sync_outbox.ts`, pour la même raison.
 */
export function horodatageCorbeille(maintenant: Date = new Date()): string {
  return maintenant.toISOString();
}

/**
 * Jours restants avant la purge, arrondis AU-DESSUS, jamais négatifs.
 *
 * Arrondi au-dessus : un objet jeté il y a une heure a « 30 jours », pas 29.
 * La vue « Supprimés récemment » affiche ce chiffre ; il ne doit pas annoncer
 * moins de temps qu'il n'en reste réellement.
 */
export function joursRestants(deletedAt: string, maintenant: Date = new Date()): number {
  const t = Date.parse(deletedAt);
  if (Number.isNaN(t)) return 0;
  const reste = t + RETENTION_JOURS * JOUR_MS - maintenant.getTime();
  return Math.max(0, Math.ceil(reste / JOUR_MS));
}

/**
 * L'instant avant lequel une mise en corbeille est périmée.
 *
 * Rendu au format de la colonne, pour une comparaison SQL directe : en ISO UTC,
 * l'ordre lexicographique EST l'ordre chronologique.
 */
export function seuilDePurge(maintenant: Date = new Date()): string {
  return new Date(maintenant.getTime() - RETENTION_JOURS * JOUR_MS).toISOString();
}

/**
 * Faut-il purger ? Vrai dès que les 30 jours sont ÉCOULÉS.
 *
 * Un horodatage illisible n'est jamais purgé : il vient forcément d'ailleurs
 * (un appareil plus récent, une écriture à la main), et effacer pour de bon ce
 * qu'on ne comprend pas serait la seule erreur irréparable du module.
 */
export function aPurger(deletedAt: string, maintenant: Date = new Date()): boolean {
  const t = Date.parse(deletedAt);
  if (Number.isNaN(t)) return false;
  // ⚠️ Comparaison NUMÉRIQUE ici, pas lexicographique : une valeur d'une autre
  // forme (sans millisecondes, venue d'un autre appareil) resterait lisible par
  // `Date.parse` mais fausserait une comparaison de chaînes.
  return t <= maintenant.getTime() - RETENTION_JOURS * JOUR_MS;
}
