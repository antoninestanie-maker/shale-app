import { estRecurrente } from "./taches";
import type { Task } from "./types";

/**
 * ⭐ À QUELLE DATE UNE COCHE S'ÉCRIT (lot 3 de l'audit du 2026-10-20).
 *
 * Deux règles, et chaque écran qui coche passe par l'une d'elles.
 */

/**
 * Une tâche cochée depuis un bloc daté (Calendrier) : une PONCTUELLE se coche à
 * aujourd'hui, comme dans Tâches, Aujourd'hui ou « La faire maintenant » ; une
 * RÉCURRENTE se coche à son occurrence, la date du bloc (temps-3).
 *
 * Avant, la ponctuelle recevait la date du bloc : cochée le 20 depuis son bloc
 * du 15, le 15 passait de « — » à 1/1 = 100 % ; cochée lundi depuis son bloc de
 * vendredi, elle ne comptait pas lundi et préremplissait vendredi.
 */
export function jourDeCocheTache(t: Pick<Task, "recurrence">, dateDuBloc: string, aujourdhui: string): string {
  return estRecurrente(t) ? dateDuBloc : aujourdhui;
}

/**
 * Une case « d'aujourd'hui » (habitude, tâche du jour) : la date se relit AU
 * CLIC, pas au dernier rendu (rythme-3).
 *
 * L'app restée ouverte la nuit ne se redessine pas forcément à minuit : la case
 * cochée à 7 h écrivait sur la VEILLE, puis apparaissait vide au rafraîchissement
 * — on recochait, et la veille se retrouvait « tenue ». Une case qui montrait
 * un AUTRE jour (le jour choisi dans Habitudes) garde ce jour-là.
 */
export function jourDeCocheAffiche(jourAffiche: string, aujourdhuiAuRendu: string, aujourdhuiAuClic: string): string {
  return jourAffiche === aujourdhuiAuRendu ? aujourdhuiAuClic : jourAffiche;
}
