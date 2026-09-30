import { isDueOn } from "./logic";
import { rangPriorite } from "./priorite";
import { estRecurrente } from "./taches";
import type { Completion, Task } from "./types";

/**
 * ⭐ LA VUE TÂCHES, RANGÉE PAR MOMENT (refonte du 2026-09-30).
 *
 * Antonin : « améliore le design de l'onglet Tâches, son intuitivité ». La
 * liste d'avant était PLATE : toutes les tâches à la suite, triées par
 * priorité, sans aucune date à l'écran — alors que les tâches en portent une
 * depuis la migration 020. Une tâche en retard se lisait comme une tâche du
 * mois prochain. La question que la vue doit régler d'un coup d'œil est
 * « qu'est-ce que je fais maintenant ? » : on range donc par MOMENT.
 *
 * Six sections, dans cet ordre, et une tâche n'est que dans une seule :
 *   • En retard   — datée, non faite, due AVANT aujourd'hui ;
 *   • Aujourd'hui — datée d'aujourd'hui, ou récurrente due aujourd'hui ;
 *   • À venir     — datée, plus tard ;
 *   • Sans date   — ponctuelle, sans échéance ;
 *   • Routines    — récurrente, PAS due aujourd'hui (elle reviendra seule) ;
 *   • Faites      — ponctuelle cochée un jour, ou récurrente cochée AUJOURD'HUI.
 *
 * ⚠️ Une récurrente manquée n'est jamais « en retard » (`lib/taches.ts`) : elle
 * reste dans les routines. C'est la règle de l'app, pas un choix de la vue.
 *
 * Logique pure : ni base, ni horloge. Le jour s'injecte.
 */

export type CleSection = "retard" | "aujourdhui" | "avenir" | "sansDate" | "routines" | "faites";

/** L'ordre d'affichage. ⚠️ Des CLÉS : les libellés se traduisent dans la vue. */
export const ORDRE_SECTIONS: readonly CleSection[] = ["retard", "aujourdhui", "avenir", "sansDate", "routines", "faites"];

export interface LigneVue extends Task {
  /** Cochée, au sens de la vue (voir `estFaite`). */
  done: boolean;
  /** Le jour de la coche qui la dit faite — pour ranger les faites, la plus récente d'abord. */
  faiteLe: string | null;
}

/**
 * Faite, au sens de la vue : une RÉCURRENTE l'est si elle est cochée
 * aujourd'hui (demain, elle revient) ; une PONCTUELLE, si elle l'a été un jour
 * quelconque. C'est la règle de l'ancienne vue, gardée telle quelle.
 */
export function estFaite(task: Task, completions: readonly Completion[], aujourdhui: string): { faite: boolean; le: string | null } {
  if (estRecurrente(task)) {
    const c = completions.find((x) => x.task_id === task.id && x.date === aujourdhui && x.done);
    return { faite: !!c, le: c ? aujourdhui : null };
  }
  let le: string | null = null;
  for (const c of completions) {
    if (c.task_id !== task.id || !c.done) continue;
    if (le == null || c.date > le) le = c.date;
  }
  return { faite: le != null, le };
}

/** La section d'une tâche, pour un jour donné. */
export function sectionDe(task: Task, faite: boolean, aujourdhui: string): CleSection {
  if (faite) return "faites";
  if (estRecurrente(task)) return isDueOn(task, aujourdhui) ? "aujourdhui" : "routines";
  if (!task.due_date) return "sansDate";
  if (task.due_date < aujourdhui) return "retard";
  if (task.due_date === aujourdhui) return "aujourdhui";
  return "avenir";
}

/** Minuscule, sans accent : « Réviser » se trouve en tapant « revis ». */
export function normaliser(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Une tâche répond-elle à la recherche ? Son libellé, son tag et le titre de
 * son objectif — les trois choses qu'on voit sur sa ligne. Tous les mots
 * doivent s'y trouver, dans n'importe quel ordre.
 */
export function correspond(task: Pick<Task, "label" | "tag">, objectif: string | null, requete: string): boolean {
  const mots = normaliser(requete).split(/\s+/).filter(Boolean);
  if (mots.length === 0) return true;
  const texte = normaliser([task.label, task.tag ?? "", objectif ?? ""].join(" "));
  return mots.every((m) => texte.includes(m));
}

/** L'ordre à l'intérieur d'une section — ce qu'on fera en premier, en haut. */
function comparer(section: CleSection): (a: LigneVue, b: LigneVue) => number {
  const parPriorite = (a: LigneVue, b: LigneVue) => rangPriorite(a.priority) - rangPriorite(b.priority);
  const parLibelle = (a: LigneVue, b: LigneVue) => a.label.localeCompare(b.label);
  switch (section) {
    case "retard":
    case "avenir":
      // La plus proche d'abord ; le même jour, l'heure, puis la priorité.
      return (a, b) =>
        (a.due_date ?? "").localeCompare(b.due_date ?? "") ||
        (a.start_at ?? "99").localeCompare(b.start_at ?? "99") ||
        parPriorite(a, b) ||
        parLibelle(a, b);
    case "aujourdhui":
      // Ce qui a une HEURE d'abord, dans l'ordre de la journée ; le reste par priorité.
      return (a, b) =>
        (a.start_at ?? "99").localeCompare(b.start_at ?? "99") || parPriorite(a, b) || parLibelle(a, b);
    case "sansDate":
      // La plus récente en haut à priorité égale : c'est celle qu'on vient d'ajouter.
      return (a, b) => parPriorite(a, b) || b.id - a.id;
    case "routines":
      return (a, b) => parPriorite(a, b) || parLibelle(a, b);
    case "faites":
      // La dernière cochée d'abord.
      return (a, b) => (b.faiteLe ?? "").localeCompare(a.faiteLe ?? "") || b.id - a.id;
  }
}

/**
 * Range les tâches par section, chacune triée.
 *
 * `coche` : l'état AFFICHÉ de la case (la coche optimiste — voir
 * `useCochesOptimistes`) ; par défaut, celui de la base.
 * `garder` : les tâches qu'on vient de cocher restent un instant dans la
 * section où l'on a cliqué — une ligne qui s'enfuit sous le curseur au moment
 * du clic, on ne voit même pas qu'on l'a cochée.
 */
export function ranger(
  tasks: readonly Task[],
  completions: readonly Completion[],
  aujourdhui: string,
  options: {
    coche?: (task: Task, faite: boolean) => boolean;
    garder?: ReadonlyMap<number, CleSection>;
  } = {},
): Map<CleSection, LigneVue[]> {
  const out = new Map<CleSection, LigneVue[]>(ORDRE_SECTIONS.map((s) => [s, []]));
  for (const task of tasks) {
    const { faite, le } = estFaite(task, completions, aujourdhui);
    const done = options.coche ? options.coche(task, faite) : faite;
    const section = options.garder?.get(task.id) ?? sectionDe(task, done, aujourdhui);
    out.get(section)!.push({ ...task, done, faiteLe: done ? (le ?? aujourdhui) : null });
  }
  for (const s of ORDRE_SECTIONS) out.get(s)!.sort(comparer(s));
  return out;
}
