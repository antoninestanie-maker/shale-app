import type { Completion, EtatTache, Task } from "./types";

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
 * ⭐ CE QU'UNE SAISIE ÉCRIT DANS LES TROIS COLONNES DE PLANIFICATION.
 *
 * La frontière datée / récurrente est tenue ICI plutôt que dans chaque
 * formulaire, et pour la même raison qu'elle n'est pas une contrainte `CHECK` :
 * une règle recopiée à deux endroits finit par diverger. L'interface rend déjà
 * le mélange impossible en retirant le champ ; cette fonction fait que le
 * mélange reste impossible même si elle change, ou si un troisième formulaire
 * apparaît.
 *
 * ⚠️ Une récurrence n'a JAMAIS de date, quoi qu'ait contenu l'état avant que
 * l'utilisateur ne change d'avis — c'est le cas réel : on saisit une échéance,
 * puis on coche « quotidien ». Sans cette remise à zéro, la tâche serait à la
 * fois datée et récurrente, et `estDatee()` la déclarerait non datée pendant
 * que la colonne `due_date`, elle, resterait pleine.
 *
 * ⚠️ Et un créneau sans jour ne se pose nulle part : une heure sans date
 * n'apparaîtrait dans aucune journée du calendrier.
 */
export function planificationDeSaisie(
  recurrence: string,
  dueDate: string,
  debut: string,
  fin: string,
): { due_date: string | null; start_at: string | null; end_at: string | null } {
  const datee = (!recurrence || recurrence === "none") && !!dueDate;
  if (!datee) return { due_date: null, start_at: null, end_at: null };
  return { due_date: dueDate, start_at: debut || null, end_at: fin || null };
}

/**
 * Au-delà de ce nombre de glissements, l'app cesse de reporter en silence.
 *
 * ⭐ Décidé par Antonin le 2026-09-02 : deux reports passent inaperçus, le
 * troisième demande une décision. Le motif est le sens même de la
 * fonctionnalité — une tâche qu'on reporte sans cesse n'est pas une tâche, c'est
 * une décision qu'on évite de prendre. Reporter indéfiniment en silence ferait de
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
 * Les tâches PONCTUELLES faites : une coche suffit, quel que soit son jour.
 *
 * ⚠️ C'est la règle de `basculerTache` et de la vue Tâches (`estFaite`), et le
 * calendrier ne la suivait pas (corrigé le 2026-10-09) : il cherchait la coche
 * À LA DATE D'ÉCHÉANCE. Or « La faire maintenant » coche à AUJOURD'HUI une
 * tâche dont l'échéance est passée — elle restait donc « pas faite » pour le
 * calendrier seul : bandeau de décision toujours là, sablier toujours là, et
 * rangée dans « Faites » côté Tâches.
 *
 * ⚠️ Ne vaut PAS pour une récurrente, qui se coche jour par jour.
 */
export function ponctuellesFaites(
  completions: readonly Pick<Completion, "task_id" | "done">[],
): Set<number> {
  return new Set(completions.filter((c) => c.done).map((c) => c.task_id));
}

/**
 * Les tâches à présenter dans le bandeau « à décider » du calendrier : datées,
 * échues (aujourd'hui compris), au seuil de reports — et PAS FAITES. Une tâche
 * faite n'attend plus aucune décision.
 */
export function tachesADecider<
  T extends Pick<Task, "id" | "due_date" | "recurrence" | "postponed_count" | "state" | "state_since">,
>(tasks: readonly T[], completions: readonly Pick<Completion, "task_id" | "done">[], jour: string): T[] {
  const faites = ponctuellesFaites(completions);
  // En attente ou abandonnée (031) : la décision est déjà prise.
  return tasks.filter(
    (t) =>
      estDatee(t) &&
      demandeUneDecision(t) &&
      (t.due_date as string) <= jour &&
      !faites.has(t.id) &&
      !estSuspendue(t, jour),
  );
}

/**
 * Une tâche datée, due avant `jour`, et non faite.
 *
 * `faite` est injectée : la complétion vit dans `task_completions`, que ce
 * module ne lit pas. C'est aussi ce qui permet de tester le retard sans monter
 * une base.
 */
export function estEnRetard(
  t: Pick<Task, "due_date" | "recurrence" | "state" | "state_since">,
  jour: string,
  faite: boolean,
): boolean {
  // ⭐ En attente ou abandonnée (031) : jamais en retard, donc jamais reportée.
  if (faite || !estDatee(t) || estSuspendue(t, jour)) return false;
  return (t.due_date as string) < jour;
}

/**
 * ⭐ Les tâches EN RETARD d'un jour donné : datées d'avant, pas faites — la plus
 * ancienne d'abord.
 *
 * C'est la ligne « En retard » d'Aujourd'hui (2026-10-11) et la section du même
 * nom dans la vue Tâches. Elles ne sont PAS dans le compte du jour (`todayTasks`,
 * `lib/logic.ts`) : une tâche d'hier n'est pas « prévue aujourd'hui », elle
 * attend qu'on la fasse ou qu'on la replanifie. Cochée, elle entre dans le
 * compte du jour où on la coche.
 *
 * ⚠️ « Faite » se lit comme partout (`ponctuellesFaites`). Une routine manquée
 * n'est jamais en retard (`estRecurrente`).
 */
export function tachesEnRetard<T extends Pick<Task, "id" | "due_date" | "recurrence">>(
  tasks: readonly T[],
  completions: readonly Pick<Completion, "task_id" | "done">[],
  jour: string,
): T[] {
  const faites = ponctuellesFaites(completions);
  return tasks
    .filter((t) => estEnRetard(t, jour, faites.has(t.id)))
    .sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string) || a.id - b.id);
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

/**
 * Les reports à écrire à l'ouverture du calendrier, un par tâche en retard.
 *
 * ⚠️ « Faite » se lit comme partout (`ponctuellesFaites`) : une tâche cochée
 * aujourd'hui dans Tâches alors qu'elle était due hier ne se reporte pas — elle
 * y gagnait un report de plus, pour une tâche terminée.
 */
export function reportsAAppliquer(
  tasks: readonly Pick<Task, "id" | "due_date" | "recurrence" | "postponed_count" | "postponed_from">[],
  completions: readonly Pick<Completion, "task_id" | "done">[],
  jour: string,
): { id: number; report: Report }[] {
  const faites = ponctuellesFaites(completions);
  const out: { id: number; report: Report }[] = [];
  for (const t of tasks) {
    const report = reporter(t, jour, faites.has(t.id));
    if (report) out.push({ id: t.id, report });
  }
  return out;
}

// ─── L'ÉTAT D'UNE TÂCHE (migration 031, 2026-10-20) ─────────────────────────

/**
 * ⭐ En cours, en attente, abandonnée — un ÉTAT à choix unique, retenu avec
 * Antonin le 2026-10-20 plutôt que des étiquettes libres. « Faite » n'en est pas
 * un : c'est la case à cocher.
 *
 * Ce que chaque état CHANGE, et rien d'autre :
 *   • 'doing'   — un badge sur la ligne ; la tâche reste où elle était ;
 *   • 'waiting' — elle n'est plus prévue, plus en retard, et une routine se met
 *                 en pause ; elle REVIENT le jour de sa relance (`aRelancer`) ;
 *   • 'dropped' — comme 'waiting', sans retour : rangée dans « Abandonnées ».
 */
export const ETATS: readonly EtatTache[] = ["todo", "doing", "waiting", "dropped"];

/** L'état lu en base. Une valeur inconnue (appareil plus récent) vaut 'todo'. */
export function etatDe(t: Pick<Task, "state">): EtatTache {
  return (ETATS as readonly string[]).includes(t.state ?? "") ? (t.state as EtatTache) : "todo";
}

/**
 * ⭐ LA TÂCHE EST-ELLE SUSPENDUE ce jour-là ? En attente ou abandonnée, et
 * depuis un jour qui n'est pas après `jour`.
 *
 * C'est la seule règle que lisent la liste du jour, la Discipline, les séries,
 * le retard et le report (`estPrevueLe`, `isDueOn`, `estEnRetard`) — et le
 * portage Rust (`notifications/task_streak.rs`), à tenir d'accord à la main.
 *
 * ⚠️ `state_since` protège l'HISTORIQUE : une routine mise en pause aujourd'hui
 * reste comptée les jours d'avant. Sans date (ligne venue d'ailleurs), la
 * suspension vaut depuis toujours — le seul repli qui ne fasse pas compter un
 * manque à une tâche que l'utilisateur a écartée.
 */
export function estSuspendue(t: Pick<Task, "state" | "state_since">, jour: string): boolean {
  const etat = etatDe(t);
  if (etat !== "waiting" && etat !== "dropped") return false;
  return !t.state_since || t.state_since.slice(0, 10) <= jour;
}

/**
 * En attente, et le jour de la relance est venu (ou passé). La tâche reparaît
 * alors dans « Aujourd'hui » avec le badge « À relancer » — sans compter dans
 * la Discipline : relancer n'est pas une tâche prévue, c'est un rappel.
 */
export function aRelancer(t: Pick<Task, "state" | "follow_up_on">, jour: string): boolean {
  return etatDe(t) === "waiting" && !!t.follow_up_on && t.follow_up_on <= jour;
}

/**
 * ⭐ Les tâches À RELANCER d'un jour donné, pas faites — la relance la plus
 * ancienne d'abord. Elles rejoignent le bloc du haut d'Aujourd'hui, à côté des
 * retards (`EnRetard`), sans entrer dans le compte du jour.
 */
export function tachesARelancer<T extends Pick<Task, "id" | "state" | "follow_up_on">>(
  tasks: readonly T[],
  completions: readonly Pick<Completion, "task_id" | "done">[],
  jour: string,
): T[] {
  const faites = ponctuellesFaites(completions);
  return tasks
    .filter((t) => aRelancer(t, jour) && !faites.has(t.id))
    .sort((a, b) => (a.follow_up_on as string).localeCompare(b.follow_up_on as string) || a.id - b.id);
}

/** Ce qu'un changement d'état écrit dans les quatre colonnes. */
export interface ChangementEtat {
  state: EtatTache;
  state_since: string | null;
  waiting_for: string | null;
  follow_up_on: string | null;
}

/**
 * Le changement d'état à écrire. Les champs de l'attente ne survivent pas à un
 * autre état : une tâche reprise n'attend plus personne, et une relance oubliée
 * la ferait reparaître sans raison.
 */
export function changerEtat(
  etat: EtatTache,
  jour: string,
  attente: { waiting_for?: string | null; follow_up_on?: string | null } = {},
): ChangementEtat {
  if (etat === "waiting") {
    const pour = attente.waiting_for?.trim();
    return { state: etat, state_since: jour, waiting_for: pour || null, follow_up_on: attente.follow_up_on || null };
  }
  return { state: etat, state_since: etat === "todo" ? null : jour, waiting_for: null, follow_up_on: null };
}

// ─── Les badges DÉDUITS (2026-10-20) ─────────────────────────────────────────

/**
 * Un créneau de quinze minutes ou moins : une tâche « rapide », à glisser entre
 * deux choses. Déduit du créneau, jamais saisi.
 */
export const MINUTES_RAPIDE = 15;

export function estRapide(t: Pick<Task, "start_at" | "end_at">): boolean {
  if (!t.start_at || !t.end_at) return false;
  const min = (h: string) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  };
  const duree = min(t.end_at) - min(t.start_at);
  return duree > 0 && duree <= MINUTES_RAPIDE;
}
