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
 * ⭐ Les derniers jours qu'une LIGNE d'habitude montre, du plus ancien à
 * aujourd'hui : quatorze carrés de 14 px, à LIRE.
 *
 * ⚠️ Jusqu'au 2026-10-13 ces jours se COCHAIENT, et le téléphone n'en montrait
 * que sept, en cases de 44 pt (`joursDeLigne(today, telephone)`, crible du labo
 * du 2026-10-12, constat 8). Antonin, le 13 : « il y a la possibilité de cocher
 * directement un autre jour, ce n'est pas bon ». La coche est désormais celle
 * du jour choisi dans la barre du Journal, et rien d'autre ; les carrés ne se
 * touchent plus, donc quatorze tiennent partout (sous le nom, au téléphone).
 */
export const JOURS_HISTORIQUE = 14;

export function derniersJours(today: string, n: number = JOURS_HISTORIQUE): string[] {
  const jours: string[] = [];
  for (let i = n - 1; i >= 0; i--) jours.push(addDays(today, -i));
  return jours;
}

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
