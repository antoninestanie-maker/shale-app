import { addDays } from "./logic";
import { debutsDesHabitudes, serieHabitudes } from "./performance/analyse";
import type { Habit, HabitCheck } from "./types";

/**
 * ⭐ L'ANNEAU DE DISCIPLINE D'AUJOURD'HUI SE LIT SUR LES HABITUDES (2026-10-20).
 *
 * Antonin : « j'aimerais que le score de discipline de l'accueil soit par
 * rapport aux habitudes plutôt qu'aux tâches », puis « rattache [la série en
 * cours] à la discipline ». L'anneau ET la tuile « série en cours » du bandeau
 * lisent donc cette série. Les tâches gardent leur compte ailleurs (carte
 * « Tâches du jour », mini-barres 7 jours, Performance, notification de série).
 *
 * La règle est celle de Performance, pas une seconde : une habitude compte à
 * partir de sa première coche (`debutsDesHabitudes`), les exemples ne comptent
 * pas.
 *
 * ⭐ Un jour est « tenu » à 75 %, pas à 80 % comme les tâches (Antonin,
 * 2026-10-20 : « revois le pourcentage légèrement à la baisse »). Avec peu
 * d'habitudes les pourcentages vont par paliers, et 80 % exigeait un sans-faute
 * à 4 ou 8 habitudes (3/4 = 75 %). 75 % pardonne une habitude manquée sur
 * quatre ; 67 % rendrait la série trop facile à 3 habitudes (2/3).
 * Le seuil des séries de TÂCHES (`STREAK_THRESHOLD`) reste à 80.
 *
 * ⚠️ PORTÉE EN RUST (2026-10-20) : `src-tauri/src/notifications/discipline_habitudes.rs`,
 * que lit la notification « série en danger ». Toute évolution de cette règle
 * (seuil, début d'une habitude, exemples) se répercute là-bas.
 */
export const SEUIL_JOUR_TENU = 75;

export interface DisciplineHabitudes {
  /** Habitudes tenues aujourd'hui, sur celles qui comptent. */
  tenues: number;
  actives: number;
  /** `null` tant qu'aucune habitude ne compte. */
  pct: number | null;
  /** Jours tenus d'affilée ; aujourd'hui compte dès qu'il atteint le seuil. */
  serie: number;
}

/**
 * `tenueAujourdhui` : la coche telle qu'affichée (coche optimiste de la vue),
 * pour que l'anneau bouge au clic, avant la relecture de la base.
 */
export function disciplineHabitudes(
  habits: readonly Habit[],
  checks: readonly HabitCheck[],
  today: string,
  tenueAujourdhui: (habitId: number) => boolean,
): DisciplineHabitudes {
  const actives = [...debutsDesHabitudes(habits, checks, today).keys()];
  const tenues = actives.filter((id) => tenueAujourdhui(id)).length;
  const pct = actives.length > 0 ? Math.round((tenues / actives.length) * 100) : null;

  let serie = pct !== null && pct >= SEUIL_JOUR_TENU ? 1 : 0;
  const hier = addDays(today, -1);
  const passe = serieHabitudes(habits, checks, addDays(today, -365), hier, today);
  for (let i = passe.length - 1; i >= 0; i--) {
    const p = passe[i].pct;
    if (p === null) continue; // aucune habitude ne comptait : jour neutre
    if (p >= SEUIL_JOUR_TENU) serie++;
    else break;
  }
  return { tenues, actives: actives.length, pct, serie };
}
