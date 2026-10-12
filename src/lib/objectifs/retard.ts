import { racineDe } from "./structure";
import type { Goal } from "../types";

/**
 * Le retard d'un OBJECTIF sur son échéance (2026-10-11).
 *
 * Le crible du labo (constats 4 et 13) : « échéance dépassée de 73 jours »
 * n'était écrit qu'au Calendrier. Ni Aujourd'hui, ni la liste des objectifs ne
 * le disaient ; une utilisatrice l'a lu par hasard, quarante gestes plus tard.
 * Cette règle est lue par la ligne « En retard » d'Aujourd'hui, la carte
 * « Objectifs en cours » et la ligne de la liste Objectifs.
 *
 * Logique pure : le jour s'injecte.
 */

/**
 * De combien de jours l'échéance est dépassée — 0 si elle ne l'est pas (pas
 * d'échéance, échéance aujourd'hui ou à venir). L'échéance du jour même n'est
 * PAS un retard : il reste la journée.
 *
 * ⚠️ Compté à MIDI, pour qu'un passage à l'heure d'été ne retire pas un jour
 * (PIEGES § 4.1).
 */
export function joursDeRetard(echeance: string | null | undefined, aujourdHui: string): number {
  if (!echeance) return 0;
  const jour = echeance.slice(0, 10);
  if (jour >= aujourdHui) return 0;
  const midi = (j: string) => new Date(`${j}T12:00:00`).getTime();
  const ecart = Math.round((midi(aujourdHui) - midi(jour)) / 86_400_000);
  return Number.isFinite(ecart) && ecart > 0 ? ecart : 0;
}

/** Un objectif est RACINE s'il n'est l'étape d'aucun objectif présent. */
export function estRacine(goal: Goal, goals: readonly Goal[]): boolean {
  return racineDe(goal, goals).id === goal.id;
}

export interface ObjectifEnRetard {
  goal: Goal;
  /** Jours écoulés depuis l'échéance — toujours ≥ 1. */
  jours: number;
}

/**
 * Les objectifs RACINES dont l'échéance est dépassée et qui ne sont pas
 * achevés — le plus en retard d'abord.
 *
 * ⚠️ Les racines seulement : une étape en retard se lit sur la page de son
 * objectif. La remonter ici referait de chaque étape un objectif à part — le
 * défaut que la carte « Objectifs en cours » vient de perdre (A06a-09).
 *
 * `acheve` est injecté : l'avancement se mesure ailleurs
 * (`objectifs/progression.ts`), ce fichier ne recompte rien.
 */
export function objectifsEnRetard(
  goals: readonly Goal[],
  acheve: (goal: Goal) => boolean,
  aujourdHui: string,
): ObjectifEnRetard[] {
  return goals
    .filter((g) => estRacine(g, goals))
    .map((goal) => ({ goal, jours: joursDeRetard(goal.deadline, aujourdHui) }))
    .filter((x) => x.jours > 0 && !acheve(x.goal))
    .sort((a, b) => b.jours - a.jours || a.goal.id - b.goal.id);
}
