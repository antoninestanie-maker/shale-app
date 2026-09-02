import { effectiveProgress } from "../logic";
import { joursEntre } from "./agenda";
import type { Completion, Goal, Task } from "../types";

/**
 * ⭐ Les objectifs qui ne tiendront pas dans les jours qui restent.
 *
 * LA THÈSE. Le module Objectifs sait ce qui est FAIT. Le calendrier sait combien
 * de jours restent. **Personne ne croisait les deux** — un objectif pouvait donc
 * afficher « 40 % » à trois jours de son échéance sans que rien ne le signale.
 *
 * ⚠️ L'HONNÊTETÉ DE LA MESURE EST TOUT L'INTÉRÊT. Le module Objectifs mesure la
 * progression sur ce qui est réellement fait (`effectiveProgress`), pas sur ce
 * qu'on déclare — sauf quand l'utilisateur a explicitement choisi le mode
 * manuel. Une alerte fondée sur du déclaratif ne vaut rien : elle dirait
 * exactement ce que l'utilisateur a bien voulu se dire.
 */

export interface ObjectifEnPeril {
  goal: Goal;
  /** Progression réelle, 0–100. */
  progression: number;
  /** Jours restants avant l'échéance, 0 le jour même, négatif si dépassée. */
  joursRestants: number;
  /** Jalons (sous-objectifs) non terminés. */
  jalonsRestants: number;
  /** Tâches non récurrentes rattachées et non faites. */
  tachesRestantes: number;
  /** ⚠️ Vrai quand la progression est DÉCLARÉE, pas mesurée. */
  declaratif: boolean;
  raison: "depassee" | "trop-peu-de-jours" | "rythme-insuffisant";
}

/**
 * Sous ce nombre de jours, un objectif encore loin du compte est signalé.
 *
 * Sept jours : c'est l'horizon sur lequel on peut encore réagir. Alerter à
 * trente jours ferait de l'alerte un décor permanent ; alerter à deux jours ne
 * laisserait rien faire de la nouvelle.
 */
export const HORIZON_JOURS = 7;

/**
 * Part de progression au-delà de laquelle on considère qu'un objectif tient sa
 * route, même proche de l'échéance.
 */
export const PROGRESSION_RASSURANTE = 80;

export function objectifsEnPeril(
  goals: readonly Goal[],
  tasks: readonly Task[],
  completions: readonly Completion[],
  aujourdhui: string,
): ObjectifEnPeril[] {
  const enPeril: ObjectifEnPeril[] = [];

  for (const g of goals) {
    if (!g.deadline) continue;

    const progression = effectiveProgress(g, [...goals], [...tasks], [...completions]);
    if (progression >= 100) continue;

    const joursRestants = ecartEnJours(aujourdhui, g.deadline);
    if (joursRestants > HORIZON_JOURS) continue;

    const enfants = goals.filter((x) => x.parent_goal_id === g.id);
    const jalonsRestants = enfants.filter(
      (x) => effectiveProgress(x, [...goals], [...tasks], [...completions]) < 100,
    ).length;
    const rattachees = tasks.filter(
      (t) => t.goal_id === g.id && (!t.recurrence || t.recurrence === "none"),
    );
    const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
    const tachesRestantes = rattachees.filter((t) => !faites.has(t.id)).length;

    const restant = jalonsRestants + tachesRestantes;

    let raison: ObjectifEnPeril["raison"] | null = null;
    if (joursRestants < 0) raison = "depassee";
    // Plus de jalons que de jours : même à un par jour, le compte ne tombe pas.
    else if (restant > Math.max(0, joursRestants)) raison = "trop-peu-de-jours";
    else if (progression < PROGRESSION_RASSURANTE) raison = "rythme-insuffisant";

    if (!raison) continue;

    enPeril.push({
      goal: g,
      progression,
      joursRestants,
      jalonsRestants,
      tachesRestantes,
      // ⚠️ À DIRE À L'ÉCRAN. Une alerte calculée sur une progression saisie à la
      // main ne mesure rien : elle répète ce que l'utilisateur a déclaré.
      declaratif: !!g.manual_progress,
      raison,
    });
  }

  // Le plus urgent d'abord : l'échéance dépassée, puis la plus proche.
  return enPeril.sort((a, b) => a.joursRestants - b.joursRestants || a.progression - b.progression);
}

/** Nombre de jours de `de` à `a`. Négatif si `a` est déjà passé. */
export function ecartEnJours(de: string, a: string): number {
  if (a === de) return 0;
  const [debut, fin, signe] = a > de ? [de, a, 1] : [a, de, -1];
  return signe * (joursEntre(debut, fin).length - 1);
}
