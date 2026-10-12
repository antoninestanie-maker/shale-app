import { sansExemples } from "../onboarding/exemples";
import type { FocusSession, Habit, HabitCheck, TodayTask } from "../types";
import { debutsDesHabitudes, minutesDeSeance, seancesDeFocus } from "./analyse";

/**
 * ⭐ LE JOUR EN COURS, À PART (2026-10-11).
 *
 * LE DÉFAUT (crible du labo, constat 2 — rejoué). Après une tâche cochée, une
 * habitude cochée et une séance terminée, Performance affichait « Tâches
 * tenues — », « Focus 0 min », « Aucune séance de focus », « Lance ta première
 * session… ». Le Timer, à côté, écrivait « 1 min ». Un compte neuf ne voyait
 * rien de son premier jour, et les six essais des prototypes ont relevé un
 * chiffre du Timer contredit par Performance.
 *
 * LA RÈGLE QUI RESTE (décision du 2026-10-09). Une période est faite de jours
 * FINIS : aujourd'hui n'entre dans aucune moyenne ni aucun écart, sinon tout
 * plonge chaque matin. Sa raison tient, on n'y touche pas.
 *
 * CE QUI CHANGE. Aujourd'hui se VOIT : une rangée nommée, à part, qui ne se
 * compare à rien. Ce fichier en fabrique les trois nombres.
 *
 * ⚠️ IL NE DÉCIDE PAS CE QU'EST « UNE TÂCHE DU JOUR ». La liste lui est
 * fournie par l'appelant (`todayTasks`, `lib/logic.ts`) : c'est elle qui porte
 * la définition, et elle est en train de changer (chantier « tâche du jour »).
 * Ce fichier ne fait que la COMPTER, avec le même filtre que `pctOfList` — le
 * contenu de départ ne compte pas.
 */

export interface JourEnCours {
  date: string;
  /** Les tâches de la liste du jour : faites sur dues, exemples exclus. */
  taches: { faites: number; dues: number };
  /** Les habitudes : cochées aujourd'hui sur celles qui comptent. */
  habitudes: { tenues: number; actives: number };
  /** Les séances de concentration TERMINÉES commencées aujourd'hui. */
  focus: { minutes: number; seances: number };
}

export function jourEnCours(p: {
  /** `todayTasks(tasks, completions, today)` — la liste vivante, telle qu'affichée. */
  listeDuJour: readonly TodayTask[];
  habits: readonly Habit[];
  habitChecks: readonly HabitCheck[];
  focusSessions: readonly FocusSession[];
  today: string;
}): JourEnCours {
  const { today } = p;
  const liste = sansExemples(p.listeDuJour);

  // Les habitudes qui comptent aujourd'hui : toutes celles d'`debutsDesHabitudes`
  // (une habitude jamais cochée compte à partir d'aujourd'hui, donc y est).
  const actives = debutsDesHabitudes(p.habits, p.habitChecks, today);
  const tenues = new Set<number>();
  for (const c of p.habitChecks) if (c.date === today && actives.has(c.habit_id)) tenues.add(c.habit_id);

  const seances = seancesDeFocus(p.focusSessions, today, today);

  return {
    date: today,
    taches: { faites: liste.filter((t) => t.done).length, dues: liste.length },
    habitudes: { tenues: tenues.size, actives: actives.size },
    focus: { minutes: seances.reduce((a, s) => a + minutesDeSeance(s), 0), seances: seances.length },
  };
}

/**
 * La période n'a-t-elle RIEN mesuré ? Aucun jour fini avec une tâche due,
 * aucun avec une habitude, aucune minute de focus.
 *
 * Sert à ne pas écrire « Rien ne décroche sur cette période. » sur une période
 * vide : la phrase se lisait comme un bon point, sur un compte créé le matin.
 */
export function periodeSansMesure(p: { taches: number | null; habitudes: number | null; focus: number }): boolean {
  return p.taches === null && p.habitudes === null && p.focus === 0;
}
