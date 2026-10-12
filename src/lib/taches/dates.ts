import { addDays, weekdayOf } from "../logic";
import type { Task } from "../types";

/**
 * Les dates qu'on pose sur une tâche d'un geste — le menu « Dater », la ligne
 * d'ajout rapide. Logique pure : le jour s'injecte.
 */

/**
 * La prochaine occurrence d'un jour de la semaine, STRICTEMENT après
 * `aujourdhui` (`jourSemaine` : 0 = dimanche … 6 = samedi, comme `getDay()`).
 *
 * ⚠️ Jamais aujourd'hui, même si on est ce jour-là : « lundi prochain » un
 * lundi, c'est dans sept jours. Un raccourci qui rendrait la date du jour ne
 * raccourcit rien et laisse croire qu'il n'a pas marché (règle déjà posée pour
 * les raccourcis de `ChampDate`, 2026-09-18).
 */
export function prochainJourDeSemaine(aujourdhui: string, jourSemaine: number): string {
  const ecart = (jourSemaine - weekdayOf(aujourdhui) + 7) % 7 || 7;
  return addDays(aujourdhui, ecart);
}

/** Le lundi STRICTEMENT après aujourd'hui — « lundi prochain », même un lundi. */
export function lundiProchain(aujourdhui: string): string {
  return prochainJourDeSemaine(aujourdhui, 1);
}

/**
 * ⭐ « + 1 jour » : repousser une tâche d'un jour, en un geste (2026-10-11).
 *
 * Le crible du labo : les cinq utilisateurs ont cherché à « reporter d'un
 * jour » ; « Demain » partait d'aujourd'hui, pas de la date de la tâche.
 *
 *   • datée d'aujourd'hui ou plus tard → le lendemain de SA date (le 16 → le 17) ;
 *   • en retard, ou sans date           → demain. Repousser d'un jour une tâche
 *     d'avant-hier la laisserait en retard : le geste n'aurait servi à rien.
 */
export function plusUnJour(task: Pick<Task, "due_date">, aujourdhui: string): string {
  const base = task.due_date && task.due_date >= aujourdhui ? task.due_date : aujourdhui;
  return addDays(base, 1);
}
