/**
 * La logique des LOTS — pure, sans base ni tableau en mémoire.
 *
 * ⭐⭐ POURQUOI ELLE EST ICI ET PLUS DANS DU SQL RÉCURSIF.
 *
 * La première version calculait les lots par `WITH RECURSIVE` (`base.ts`). Mais
 * le mode DÉMO n'a pas de SQL : il aurait fallu réécrire la même règle en
 * JavaScript pour lui. Deux implémentations d'une règle, c'est la règle 18 du
 * chantier violée à la racine — et ce n'était pas théorique : les captures
 * d'écran des phases 3 et 4 se font EN MODE DÉMO. Une démo qui aurait divergé
 * de l'app aurait fait « prouver » à l'écran un comportement que l'app n'a pas.
 *
 * Désormais, l'app ET la démo lisent leurs lignes (`id`, `parent_goal_id`,
 * `deleted_at`), puis appellent CES fonctions. Le SQL ne fait plus qu'écrire
 * par identifiants. Coût : charger les objectifs en mémoire — quelques dizaines
 * de lignes, trois colonnes. Gain : une seule règle, testée une seule fois.
 *
 * ⚠️ Toutes les traversées gardent un ensemble des nœuds VUS : une boucle dans
 * `parent_goal_id` (qu'une synchronisation interrompue peut fabriquer) ne doit
 * jamais les faire tourner à l'infini. La version SQL en `UNION ALL` en est
 * morte en test ; voir `PIEGES.md` § 19.
 */

import type { KindCorbeille } from "./regles";

/** Le strict nécessaire d'un objectif pour raisonner sur les lots. */
export interface LigneObjectif {
  id: number;
  parent_goal_id: number | null;
  deleted_at: string | null;
}

/** Les enfants directs de chaque objectif. */
function enfantsParParent(lignes: readonly LigneObjectif[]): Map<number, LigneObjectif[]> {
  const m = new Map<number, LigneObjectif[]>();
  for (const l of lignes) {
    if (l.parent_goal_id == null) continue;
    const liste = m.get(l.parent_goal_id) ?? [];
    liste.push(l);
    m.set(l.parent_goal_id, liste);
  }
  return m;
}

/**
 * Parcours en largeur depuis `racine`, en ne suivant que les enfants qui
 * satisfont `garder`. La racine elle-même doit aussi le satisfaire.
 *
 * L'ordre rendu va du parent vers ses descendants, niveau par niveau.
 */
function parcourir(
  lignes: readonly LigneObjectif[],
  racine: number,
  garder: (l: LigneObjectif) => boolean,
): number[] {
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const depart = parId.get(racine);
  if (!depart || !garder(depart)) return [];
  const enfants = enfantsParParent(lignes);
  const vus = new Set<number>([racine]);
  const ordre: number[] = [racine];
  for (let i = 0; i < ordre.length; i++) {
    for (const e of enfants.get(ordre[i]) ?? []) {
      if (vus.has(e.id) || !garder(e)) continue;
      vus.add(e.id);
      ordre.push(e.id);
    }
  }
  return ordre;
}

/**
 * Un objectif et tous ses descendants VIVANTS — ce que la mise en corbeille
 * emporte. Un sous-objectif déjà jeté pour son compte n'entre pas dans le lot.
 */
export function descendantsVivants(lignes: readonly LigneObjectif[], racine: number): number[] {
  return parcourir(lignes, racine, (l) => l.deleted_at == null);
}

/** Le lot d'un objectif en corbeille : lui et ses descendants de MÊME horodatage. */
export function lotObjectif(lignes: readonly LigneObjectif[], racine: number, stamp: string): number[] {
  return parcourir(lignes, racine, (l) => l.deleted_at === stamp);
}

// ─── La restauration ─────────────────────────────────────────────────────────

/** Une étape de restauration : un lot, désigné par sa racine et son horodatage. */
export interface EtapeRestauration {
  id: number;
  stamp: string;
  /** Combien d'objets ce lot ramène, racine comprise. */
  taille: number;
}

export interface PlanRestauration {
  kind: KindCorbeille;
  /** Dans l'ordre d'exécution : les ancêtres d'abord, l'objet demandé en dernier. */
  etapes: EtapeRestauration[];
  /**
   * VRAI si restaurer cet objet oblige à restaurer aussi un parent en
   * corbeille. L'interface doit le DIRE avant d'agir (cahier des charges,
   * § 5.4) : on ne ressuscite pas un objectif sans prévenir.
   */
  remonte: boolean;
  /** Le total d'objets qui reviendront. */
  total: number;
}

/**
 * Ce que restaurer un OBJECTIF ramènera. `null` s'il n'est pas en corbeille.
 *
 * On remonte la chaîne des ancêtres EN CORBEILLE (un parent vivant arrête la
 * remontée : l'objectif revient sous lui, à sa place). Puis on restaure chaque
 * lot, du plus haut au plus bas, en sautant un lot déjà couvert : un
 * sous-objectif jeté AVEC son parent revient avec lui, pas une seconde fois.
 */
export function planObjectif(lignes: readonly LigneObjectif[], id: number): PlanRestauration | null {
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const cible = parId.get(id);
  if (!cible?.deleted_at) return null;

  const chaine: LigneObjectif[] = [cible];
  const vus = new Set<number>([cible.id]);
  let courant = cible;
  while (courant.parent_goal_id != null) {
    const parent = parId.get(courant.parent_goal_id);
    if (!parent?.deleted_at || vus.has(parent.id)) break;
    chaine.push(parent);
    vus.add(parent.id);
    courant = parent;
  }

  const etapes: EtapeRestauration[] = [];
  const couverts = new Set<number>();
  for (const maillon of [...chaine].reverse()) {
    if (couverts.has(maillon.id)) continue;
    const ids = lotObjectif(lignes, maillon.id, maillon.deleted_at!);
    ids.forEach((x) => couverts.add(x));
    etapes.push({ id: maillon.id, stamp: maillon.deleted_at!, taille: ids.length });
  }
  return { kind: "goal", etapes, remonte: chaine.length > 1, total: etapes.reduce((s, e) => s + e.taille, 0) };
}

/** Le plan d'un objet SANS hiérarchie : lui seul. `null` s'il n'est pas en corbeille. */
export function planSimple(kind: KindCorbeille, id: number, deletedAt: string | null): PlanRestauration | null {
  if (!deletedAt) return null;
  return { kind, etapes: [{ id, stamp: deletedAt, taille: 1 }], remonte: false, total: 1 };
}

// ─── La corbeille, vue d'en haut ─────────────────────────────────────────────

/**
 * Les RACINES de lot parmi les objectifs en corbeille, avec leur taille.
 *
 * Un sous-objectif jeté AVEC son objectif n'apparaît pas à part : il est
 * « dans » son parent. Le montrer deux fois ferait croire qu'on peut le
 * restaurer seul sans conséquence — alors que le restaurer remonte au parent.
 */
export function racinesDeLot(lignes: readonly LigneObjectif[]): { id: number; taille: number }[] {
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const out: { id: number; taille: number }[] = [];
  for (const l of lignes) {
    if (!l.deleted_at) continue;
    const parent = l.parent_goal_id != null ? parId.get(l.parent_goal_id) : undefined;
    if (parent?.deleted_at === l.deleted_at) continue; // il est dans le lot de son parent
    out.push({ id: l.id, taille: lotObjectif(lignes, l.id, l.deleted_at).length });
  }
  return out;
}

// ─── La purge ────────────────────────────────────────────────────────────────

/**
 * Profondeur de chaque objectif PARMI un ensemble (0 = aucun parent dedans).
 *
 * ⚠️ Sert à supprimer les plus profonds d'abord : `deleteGoal` rattache les
 * enfants d'un objectif supprimé à son grand-parent. Supprimer le parent avant
 * ses enfants les ferait donc REMONTER — ils deviendraient des objectifs
 * vivants, surgis de nulle part, au lieu de partir avec lui.
 */
function profondeurs(lignes: readonly LigneObjectif[]): Map<number, number> {
  const parId = new Map(lignes.map((l) => [l.id, l]));
  const out = new Map<number, number>();
  for (const l of lignes) {
    let d = 0;
    const vus = new Set<number>([l.id]);
    let p = l.parent_goal_id;
    while (p != null && parId.has(p) && !vus.has(p)) {
      vus.add(p);
      d++;
      p = parId.get(p)!.parent_goal_id;
    }
    out.set(l.id, d);
  }
  return out;
}

/** Des objectifs à supprimer pour de bon, rangés DU PLUS PROFOND AU PLUS HAUT. */
export function ordreDePurge(lignes: readonly LigneObjectif[]): number[] {
  const d = profondeurs(lignes);
  return [...lignes].sort((a, b) => d.get(b.id)! - d.get(a.id)!).map((l) => l.id);
}
