import { estAcheve, mesurer, type ContexteProgression, type SourcesProgression } from "../objectifs/progression";
import { racineDe } from "../objectifs/structure";
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
  /**
   * Étapes (jalons ou sous-objectifs) directes non ACHEVÉES.
   *
   * ⚠️ S'appelait `jalonsRestants` avant la migration 026, du temps où tout
   * enfant d'un objectif s'appelait « jalon ». Le mot désigne désormais un
   * niveau précis de la feuille de route : le garder ici aurait annoncé
   * « 3 jalons non terminés » pour trois sous-objectifs.
   */
  etapesRestantes: number;
  /** Tâches non récurrentes rattachées et non faites. */
  tachesRestantes: number;
  /**
   * L'objectif racine quand l'alerte porte sur une ÉTAPE datée (un jalon peut
   * porter une échéance) : « Passer le challenge » ne dit rien seul.
   */
  racine: Goal | null;
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
  /** Habitudes et coches : une cible chiffrée peut en dépendre (migration 026). */
  contexte: Partial<ContexteProgression> = {},
): ObjectifEnPeril[] {
  const enPeril: ObjectifEnPeril[] = [];

  // ⭐ UNE mesure par la règle unique (`lib/objectifs/progression.ts`) : le péril
  // ne recalcule pas un pourcentage dans son coin.
  const sources: SourcesProgression = {
    goals,
    tasks,
    completions,
    ...contexte,
    maintenant: contexte.maintenant ?? `${aujourdhui} 00:00`,
  };

  for (const g of goals) {
    if (!g.deadline) continue;

    const m = mesurer(g, sources);
    // ⚠️ ACHEVÉ, pas « à 100 % » : quatre jalons finis et deux vides font 100 %,
    // et c'est précisément l'objectif qu'il faut signaler à l'approche de
    // l'échéance (feuille de route, 2026-09-15).
    if (estAcheve(m)) continue;
    // Un objectif vide rend son % stocké — même repli qu'`effectiveProgress`.
    const progression = m.pct ?? g.progress_pct ?? 0;

    const joursRestants = ecartEnJours(aujourdhui, g.deadline);
    if (joursRestants > HORIZON_JOURS) continue;

    const enfants = goals.filter((x) => x.parent_goal_id === g.id && !x.is_example);
    const etapesRestantes = enfants.filter((x) => !estAcheve(mesurer(x, sources))).length;
    const rattachees = tasks.filter(
      (t) => t.goal_id === g.id && (!t.recurrence || t.recurrence === "none"),
    );
    const faites = new Set(completions.filter((c) => c.done).map((c) => c.task_id));
    const tachesRestantes = rattachees.filter((t) => !faites.has(t.id)).length;

    const restant = etapesRestantes + tachesRestantes;

    let raison: ObjectifEnPeril["raison"] | null = null;
    if (joursRestants < 0) raison = "depassee";
    // Plus de jalons que de jours : même à un par jour, le compte ne tombe pas.
    else if (restant > Math.max(0, joursRestants)) raison = "trop-peu-de-jours";
    // ⚠️ Un pourcentage gonflé par des étapes VIDES ne rassure pas : elles sont
    // sorties du dénominateur, pas faites. Quatre jalons finis sur six affichent
    // 100 % — ce n'est pas un objectif qui tient sa route.
    else if (progression < PROGRESSION_RASSURANTE || m.videsProfonds > 0) raison = "rythme-insuffisant";

    if (!raison) continue;

    enPeril.push({
      goal: g,
      progression,
      joursRestants,
      etapesRestantes,
      tachesRestantes,
      racine: g.parent_goal_id != null ? racineDe(g, goals) : null,
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
