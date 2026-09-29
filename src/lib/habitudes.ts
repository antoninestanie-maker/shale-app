import { addDays } from "./logic";
import type { HabitCheck } from "./types";

/**
 * Les habitudes — ce que le Journal (où elles vivent) et les cartes mentales
 * (où un nœud peut en devenir une, 2026-09-29) doivent calculer PAREIL.
 *
 * ⚠️ Sorti de `views/JournalView.tsx` le 2026-09-29, à l'identique : la carte
 * affiche la série d'une habitude, et deux calculs de série finiraient par
 * donner deux chiffres pour la même habitude.
 */

/**
 * ⚠️ DES COULEURS DE DONNÉES : elles sont ENREGISTRÉES dans `habits.color`.
 * Ne jamais en retirer ni en renommer une (PIEGES § 21.9) — seulement ajouter.
 * La première est celle qu'une habitude reçoit quand on ne choisit pas.
 */
export const HABIT_COLORS = ["var(--color-green)", "var(--color-blue)", "var(--color-yellow)", "#a78bfa", "#fb923c", "#f472b6"];

/**
 * Jours d'affilée où l'habitude a été tenue, jusqu'à aujourd'hui.
 *
 * Aujourd'hui pas encore coché ne casse pas la série : la journée n'est pas
 * finie. On compte alors à partir d'hier.
 */
export function serieHabitude(habitId: number, checks: readonly HabitCheck[], today: string): number {
  const set = new Set(checks.filter((c) => c.habit_id === habitId).map((c) => c.date));
  let d = today;
  if (!set.has(d)) d = addDays(d, -1);
  let serie = 0;
  while (set.has(d)) {
    serie++;
    d = addDays(d, -1);
  }
  return serie;
}
