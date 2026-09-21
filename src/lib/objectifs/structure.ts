import type { Goal } from "../types";

/**
 * La forme d'une feuille de route : trois niveaux, et c'est une règle de SAISIE.
 *
 *   objectif racine (niveau 0)
 *   ├── jalon (niveau 1, `is_milestone = 1`)
 *   │   └── sous-objectif (niveau 2)
 *   └── sous-objectif direct (niveau 1)
 *
 * ⚠️ AUCUN CHECK EN BASE (migration 026, PIEGES § 3.4) : une ligne distante qui
 * violerait une contrainte de profondeur arrêterait la synchronisation. La règle
 * vit donc ici, et elle ne s'applique qu'à ce que l'utilisateur CRÉE. Une
 * arborescence plus profonde — les objectifs d'avant ce chantier, où rien ne
 * bornait l'imbrication — se LIT sans erreur (`progression.ts` descend à
 * n'importe quelle profondeur) ; elle ne peut simplement plus s'approfondir.
 */

export const NIVEAU_MAX = 2;

/** 0 pour une racine. Garde anti-cycle : une boucle rend le niveau atteint. */
export function niveauDe(goal: Goal, goals: readonly Goal[]): number {
  const parDeId = new Map(goals.map((g) => [g.id, g]));
  const vus = new Set<number>([goal.id]);
  let niveau = 0;
  let courant = goal;
  while (courant.parent_goal_id != null) {
    const parent = parDeId.get(courant.parent_goal_id);
    if (!parent || vus.has(parent.id)) break;
    vus.add(parent.id);
    niveau++;
    courant = parent;
  }
  return niveau;
}

/** L'objectif racine d'une étape (lui-même s'il est racine). */
export function racineDe(goal: Goal, goals: readonly Goal[]): Goal {
  const parDeId = new Map(goals.map((g) => [g.id, g]));
  const vus = new Set<number>([goal.id]);
  let courant = goal;
  while (courant.parent_goal_id != null) {
    const parent = parDeId.get(courant.parent_goal_id);
    if (!parent || vus.has(parent.id)) break;
    vus.add(parent.id);
    courant = parent;
  }
  return courant;
}

/**
 * Les étapes DIRECTES d'un objectif, dans l'ordre d'affichage — exemples
 * compris : un exemple doit se voir.
 *
 * ⚠️ UN SEUL TRI POUR TOUT LE DÉPÔT. Il vivait dans `FeuilleDeRoute.tsx` ; la
 * carte mentale (`objectifs/carte.ts`) doit dessiner les branches dans l'ordre
 * EXACT où la feuille de route les empile, sinon les deux formes du même
 * objectif ne se superposent plus dans la tête de qui les regarde.
 */
export function etapesTriees(parentId: number, goals: readonly Goal[]): Goal[] {
  return goals
    .filter((g) => g.parent_goal_id === parentId)
    .sort(
      (a, b) =>
        (a.position ?? 0) - (b.position ?? 0) ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
        a.id - b.id,
    );
}

/**
 * ⚠️ LES IDENTIFIANTS RESTENT `"jalon"`, LE MOT AFFICHÉ EST « PHASE ».
 *
 * Antonin, 2026-09-20 : « le nom de jalon n'est peut-être pas assez parlant,
 * réfléchis-y, sinon laisse-le. » Il ne l'était pas : un jalon, dans la langue
 * courante, est un REPÈRE qu'on franchit — un point sur une ligne. Ici, c'est un
 * CONTENANT : le niveau qui regroupe plusieurs sous-objectifs. Le mot promettait
 * une date, il livrait un dossier.
 *
 * « Phase » dit exactement cela, en un mot court, dans les deux langues, et sans
 * entrer en collision avec « étape » (le mot générique de la feuille de route,
 * qui désigne les deux genres) ni avec « sous-objectif ».
 *
 * Ce qui NE change pas : la colonne `goals.is_milestone` (aucune migration pour
 * un mot), ni ces identifiants de code, qui sont des clés et non du texte. Le
 * mot affiché se lit dans `libelles.ts` (`nomDeGenre`), donc à un seul endroit.
 */
export type GenreEtape = "jalon" | "sous-objectif";

/**
 * Peut-on créer une étape de ce genre sous `parent` ?
 *
 *   • un JALON ne naît que sous une racine ;
 *   • un SOUS-OBJECTIF naît sous une racine ou sous un jalon — jamais sous un
 *     autre sous-objectif, et jamais au-delà du niveau 2.
 */
export function peutAjouterEtape(parent: Goal, genre: GenreEtape, goals: readonly Goal[]): boolean {
  const niveau = niveauDe(parent, goals);
  if (genre === "jalon") return niveau === 0;
  if (niveau === 0) return true;
  return niveau === 1 && !!parent.is_milestone && niveau + 1 <= NIVEAU_MAX;
}

/**
 * Un sous-objectif peut-il devenir jalon, sur place ?
 *
 * Seulement s'il pend directement d'une racine, et si ses propres enfants
 * restent dans la limite une fois promu : ils deviennent alors des
 * sous-objectifs du jalon (niveau 2), donc eux-mêmes ne doivent pas en avoir.
 * C'est le chemin de reprise des objectifs d'avant ce chantier, qui ne sont
 * pas migrés automatiquement.
 */
export function peutPromouvoir(goal: Goal, goals: readonly Goal[]): boolean {
  if (goal.is_milestone || niveauDe(goal, goals) !== 1) return false;
  const enfants = goals.filter((g) => g.parent_goal_id === goal.id);
  return enfants.every((e) => !goals.some((g) => g.parent_goal_id === e.id));
}

/** Rétrograder un jalon : possible s'il n'a pas d'enfant (sinon ils tomberaient au niveau 3). */
export function peutRetrograder(goal: Goal, goals: readonly Goal[]): boolean {
  return !!goal.is_milestone && !goals.some((g) => g.parent_goal_id === goal.id);
}

/** L'objectif a-t-il une feuille de route (au moins une étape) ? */
export function aUneFeuilleDeRoute(goal: Pick<Goal, "id">, goals: readonly Goal[]): boolean {
  return goals.some((g) => g.parent_goal_id === goal.id);
}
