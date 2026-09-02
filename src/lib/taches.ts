import type { Task } from "./types";

/**
 * Les deux familles de tâches, et ce qu'il advient d'une tâche non faite.
 *
 * SOURCE UNIQUE de la distinction datée / récurrente. Elle n'est PAS tenue par
 * une contrainte SQL, et c'est délibéré : une contrainte `CHECK` violée à
 * l'application d'une ligne venue d'un autre appareil arrêterait la
 * synchronisation, là où la règle n'est qu'une règle de saisie (voir le § 1 de
 * la migration 020). Elle est donc tenue ici, et gardée par des tests.
 *
 * ⚠️ Logique pure : ni base, ni Tauri, ni horloge implicite. Le « jour »
 * s'injecte, ce qui rend le report testable sans attendre demain.
 */

/**
 * Une tâche DATÉE arrive une fois, à une date. Non faite, elle est en retard.
 * C'est la seule famille que le calendrier reporte.
 */
export function estDatee(t: Pick<Task, "due_date" | "recurrence">): boolean {
  return !!t.due_date && !estRecurrente(t);
}

/**
 * Une tâche RÉCURRENTE n'a pas de date : ses occurrences se calculent.
 *
 * ⚠️ Une occurrence manquée n'est PAS en retard — elle est manquée. Reporter
 * une habitude quotidienne au lendemain en ferait deux le lendemain, puis trois
 * le surlendemain : l'app transformerait un jour de repos en dette, ce qui est
 * exactement l'inverse de ce qu'on attend d'elle. Cette distinction est
 * structurante ; elle est écrite ici plutôt que laissée à chaque appelant.
 */
export function estRecurrente(t: Pick<Task, "recurrence">): boolean {
  return !!t.recurrence && t.recurrence !== "none";
}

/** Une tâche a-t-elle un créneau horaire, ou occupe-t-elle seulement un jour ? */
export function aUnCreneau(t: Pick<Task, "start_at">): boolean {
  return !!t.start_at;
}

/**
 * Au-delà de ce nombre de glissements, l'app cesse de reporter en silence.
 *
 * ⭐ Décidé par Antonin le 2026-09-02 : deux reports passent inaperçus, le
 * troisième demande une décision. Le motif est le sens même de la
 * fonctionnalité — une tâche reportée cinq fois n'est pas une tâche, c'est une
 * décision qu'on évite de prendre. Reporter indéfiniment en silence ferait de
 * l'app la complice de cet évitement.
 */
export const SEUIL_REPORT = 2;

/**
 * Cette tâche a-t-elle assez glissé pour qu'on arrête de la reporter tout seul ?
 * L'appelant doit alors proposer les trois issues : la faire maintenant, la
 * replanifier explicitement, la supprimer.
 */
export function demandeUneDecision(t: Pick<Task, "postponed_count">): boolean {
  return t.postponed_count >= SEUIL_REPORT;
}

/**
 * Une tâche datée, due avant `jour`, et non faite.
 *
 * `faite` est injectée : la complétion vit dans `task_completions`, que ce
 * module ne lit pas. C'est aussi ce qui permet de tester le retard sans monter
 * une base.
 */
export function estEnRetard(
  t: Pick<Task, "due_date" | "recurrence">,
  jour: string,
  faite: boolean,
): boolean {
  if (faite || !estDatee(t)) return false;
  return (t.due_date as string) < jour;
}

/** Ce qu'un report écrit dans la tâche. `null` quand il ne doit pas avoir lieu. */
export interface Report {
  due_date: string;
  postponed_count: number;
  postponed_from: string;
}

/**
 * Le report d'une tâche en retard vers `jour`.
 *
 * Rend `null` — et ne reporte donc RIEN — dans les trois cas où le report
 * serait une faute :
 *   • la tâche est récurrente (voir `estRecurrente`) ;
 *   • elle n'est pas en retard ;
 *   • elle a déjà atteint le seuil, et attend une décision plutôt qu'un
 *     glissement de plus.
 *
 * `postponed_from` garde la date d'ORIGINE, jamais la précédente : c'est ce qui
 * permet de dire « prévue le 3, repoussée 5 fois » au lieu du seul compteur,
 * qui ne dit pas depuis quand.
 */
export function reporter(
  t: Pick<Task, "due_date" | "recurrence" | "postponed_count" | "postponed_from">,
  jour: string,
  faite: boolean,
): Report | null {
  if (!estEnRetard(t, jour, faite)) return null;
  if (demandeUneDecision(t)) return null;
  return {
    due_date: jour,
    postponed_count: t.postponed_count + 1,
    postponed_from: t.postponed_from ?? (t.due_date as string),
  };
}

/**
 * Replanifier explicitement : le compteur repart de zéro.
 *
 * C'est la différence entre glisser et décider. Une tâche qu'on choisit de
 * déplacer au 12 n'a pas « été repoussée six fois » : elle est prévue le 12.
 * Garder le compteur ferait réapparaître l'avertissement dès le lendemain, et
 * l'app punirait un geste qu'elle vient de demander.
 */
export function replanifier(jour: string): Report {
  return { due_date: jour, postponed_count: 0, postponed_from: jour };
}
