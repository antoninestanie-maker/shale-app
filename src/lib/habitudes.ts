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
 * ⭐ Les jours qu'une LIGNE d'habitude du Journal laisse cocher, du plus ancien
 * à aujourd'hui (2026-10-12, crible du labo, constat 8).
 *
 * Au bureau : quatorze carrés de 14 px, à côté du nom. Au téléphone ils ne
 * tiennent pas — ils écrasaient la colonne du nom à une largeur NULLE (trois
 * lignes « case, flamme, carrés » sans un mot), et un carré de 14 px ne se
 * touche pas. La ligne y montre donc SEPT jours, sur sa propre rangée, en
 * cases de 44 pt qui portent l'initiale du jour. Les douze semaines restent
 * lisibles dans la grille au-dessus.
 */
export const JOURS_LIGNE_BUREAU = 14;
export const JOURS_LIGNE_TELEPHONE = 7;

export function joursDeLigne(today: string, telephone: boolean): string[] {
  const n = telephone ? JOURS_LIGNE_TELEPHONE : JOURS_LIGNE_BUREAU;
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
