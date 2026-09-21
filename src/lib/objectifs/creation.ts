import type { GoalInput, TaskInput } from "../repo";
import { planificationDeSaisie } from "../taches";
import type { Goal } from "../types";

/**
 * ⭐ CE QU'UN OBJECTIF NEUF EMPORTE AVEC LUI — ses premières étapes, ses
 * premières tâches.
 *
 * Antonin, 2026-09-20 : « je voudrais aussi la possibilité d'ajouter des tâches
 * directement à la création de l'objectif. »
 *
 * ⚠️ La raison pour laquelle ce fichier existe, au lieu de trois boucles dans
 * `GoalModal` : la traduction « ce que l'utilisateur a tapé » → « ce qui va
 * s'écrire en base » est la seule partie testable du geste, et c'est celle qui
 * porte les décisions (les lignes vides qu'on écarte, la position qu'on
 * numérote, l'horizon et la catégorie qu'on hérite, la planification qui passe
 * par la frontière unique). Aucun test de ce dépôt ne prouve un formulaire
 * (PIEGES § 7.1) : tout ce qui peut sortir du JSX doit en sortir.
 *
 * ⚠️ Ce module est PUR : aucune écriture, aucun accès à la base. Il rend des
 * `GoalInput` / `TaskInput`, l'appelant les envoie dans l'ordre.
 */

/**
 * Cinq lignes, et pas plus.
 *
 * ⭐ Le plafond n'est pas une limite technique, c'est un refus de transformer la
 * création d'un objectif en formulaire de planification. Cinq étapes tiennent à
 * l'écran sans faire défiler la fenêtre ; au-delà, la feuille de route est
 * l'endroit fait pour ça, et elle enchaîne les lignes à l'infini.
 */
export const MAX_LIGNES = 5;

/** Les lignes réellement saisies : rognées, les vides écartées, plafonnées. */
export function lignesUtiles(lignes: readonly string[]): string[] {
  return lignes
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, MAX_LIGNES);
}

/**
 * Faut-il ouvrir une ligne de plus ? Oui dès que la dernière est remplie.
 *
 * ⭐ Une liste qui pousse toute seule vaut mieux qu'un bouton « ＋ ajouter une
 * ligne » : le geste devient « taper, Entrée, taper », et rien ne demande de
 * viser un contrôle entre deux étapes.
 */
export function lignesAffichees(lignes: readonly string[]): string[] {
  const propres = [...lignes];
  const derniere = propres[propres.length - 1] ?? "";
  if (propres.length < MAX_LIGNES && derniere.trim().length > 0) propres.push("");
  return propres.length === 0 ? [""] : propres;
}

/** L'horizon et la catégorie dont héritent les étapes — jamais réinventés. */
export type BaseObjectif = Pick<Goal, "scope" | "category">;

/**
 * Les étapes du premier jet, à créer sous `parentId`.
 *
 * ⚠️ Elles naissent SOUS-OBJECTIFS, pas phases (`is_milestone: 0`). Une phase
 * n'a de sens que si elle regroupe : la déclarer d'office rendrait « phase vide,
 * non comptée » sur chacune des trois lignes qu'on vient de taper — l'objectif
 * afficherait « — » juste après avoir été rempli. On promeut ensuite, d'un geste,
 * celle qui se découpe (menu « ⋯ » → « En faire une phase »).
 *
 * ⚠️ Et elles naissent MESURÉES (`manual_progress: 0`) comme tout ce qui est
 * neuf depuis le 2026-09-14, sans échéance : une date inventée ici ferait crier
 * « objectif en péril » sur une feuille de route qui vient de naître.
 */
export function etapesACreer(
  base: BaseObjectif,
  titres: readonly string[],
  parentId: number,
): GoalInput[] {
  return lignesUtiles(titres).map((titre, i) => ({
    title: titre,
    description: null,
    scope: base.scope,
    category: base.category,
    parent_goal_id: parentId,
    deadline: null,
    progress_pct: 0,
    manual_progress: 0,
    is_milestone: 0,
    position: i,
  }));
}

export interface LigneTache {
  nom: string;
  /** 'YYYY-MM-DD' ou vide. Une tâche sans échéance reste une tâche. */
  echeance: string;
}

/**
 * Même règle pour les tâches : une ligne de plus dès que la dernière porte un
 * nom. L'échéance ne compte pas — une date sans nom ne crée rien
 * (`tachesACreer`), donc elle n'a pas à ouvrir une ligne.
 */
export function tachesAffichees(lignes: readonly LigneTache[]): LigneTache[] {
  const propres = [...lignes];
  const derniere = propres[propres.length - 1];
  if (propres.length < MAX_LIGNES && (derniere?.nom.trim().length ?? 0) > 0) {
    propres.push({ nom: "", echeance: "" });
  }
  return propres.length === 0 ? [{ nom: "", echeance: "" }] : propres;
}

/**
 * Les premières tâches, rattachées à `goalId`.
 *
 * ⚠️ Elles se rattachent à l'OBJECTIF, jamais à une étape — même quand des
 * étapes sont saisies dans le même écran. Deviner laquelle des trois lignes
 * porte la tâche serait deviner ; et la feuille de route compte les éléments
 * rattachés à sa racine exactement comme ceux d'une étape (« Rattaché
 * directement »). Rien n'est perdu, rien n'est inventé.
 *
 * ⚠️ La planification passe par `planificationDeSaisie`, jamais par une écriture
 * directe de `due_date` : la frontière datée / récurrente est tenue à un seul
 * endroit (`lib/taches.ts`).
 */
export function tachesACreer(lignes: readonly LigneTache[], goalId: number): TaskInput[] {
  const out: TaskInput[] = [];
  for (const ligne of lignes) {
    const label = ligne.nom.trim();
    if (!label) continue;
    if (out.length >= MAX_LIGNES) break;
    out.push({
      label,
      tag: null,
      priority: "medium",
      recurrence: "none",
      goal_id: goalId,
      ...planificationDeSaisie("none", ligne.echeance, "", ""),
    });
  }
  return out;
}
