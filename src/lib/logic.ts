
import { localeTag } from "./i18n";import type {
  Completion,
  DayStat,
  Goal,
  Recurrence,
  Task,
  TodayTask,
} from "./types";

export const DAY_SHORT = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

/** Libellé lisible d'une récurrence, null pour les tâches ponctuelles. */
export function recurrenceLabel(rec: Recurrence): string | null {
  if (!rec || rec === "none") return null;
  if (rec === "daily") return "quotidien";
  if (rec === "weekdays") return "lun–ven";
  try {
    const days = JSON.parse(rec);
    if (Array.isArray(days) && days.length > 0) {
      return days
        .slice()
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b))
        .map((d) => DAY_SHORT[d])
        .join(", ");
    }
  } catch {
    // récurrence illisible → traitée comme ponctuelle
  }
  return null;
}

/** Date locale au format YYYY-MM-DD (pas d'UTC : la journée bascule à minuit local). */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + n);
  return toDateStr(date);
}

/** Jour de la semaine JS (0 = dimanche … 6 = samedi). */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function isRecurring(task: Task): boolean {
  return !!task.recurrence && task.recurrence !== "none";
}

/**
 * LE moteur de récurrence de l'app — un seul, pour tout le monde.
 *
 * ⚠️ Les tâches ET les événements du calendrier parlent le même dialecte
 * ('none' | 'daily' | 'weekdays' | JSON de jours `getDay()`), et c'est
 * délibéré : deux grammaires, ce seraient deux moteurs de projection à écrire,
 * à tester et à garder d'accord (voir le § 2 de la migration 020). Cette
 * fonction est donc la seule à savoir lire ce dialecte ; `isDueOn` en est la
 * spécialisation pour les tâches.
 *
 * `depuis` est la date de naissance de la série : rien n'a lieu avant elle.
 */
export function occurrenceLe(
  recurrence: Recurrence,
  depuis: string | null,
  dateStr: string,
): boolean {
  if (depuis && depuis.slice(0, 10) > dateStr) return false;
  if (!recurrence || recurrence === "none") return false;
  if (recurrence === "daily") return true;
  const wd = weekdayOf(dateStr);
  if (recurrence === "weekdays") return wd >= 1 && wd <= 5;
  try {
    const days = JSON.parse(recurrence);
    return Array.isArray(days) && days.includes(wd);
  } catch {
    return false;
  }
}

/** Une tâche récurrente est-elle due ce jour-là ? (les one-off retournent false) */
export function isDueOn(task: Task, dateStr: string): boolean {
  return occurrenceLe(task.recurrence, task.created_at, dateStr);
}

/**
 * Tâches affichées aujourd'hui : récurrentes dues ce jour + one-off
 * pas encore faites (ou faites aujourd'hui, pour rester visibles cochées).
 */
export function todayTasks(
  tasks: Task[],
  completions: Completion[],
  today: string,
): TodayTask[] {
  const doneToday = new Map(
    completions
      .filter((c) => c.date === today)
      .map((c) => [c.task_id, !!c.done]),
  );

  return tasks
    .filter((t) => {
      if (isDueOn(t, today)) return true;
      if (isRecurring(t)) return false;
      if (t.created_at && t.created_at.slice(0, 10) > today) return false;
      const doneComp = completions.find((c) => c.task_id === t.id && c.done);
      return !doneComp || doneComp.date === today;
    })
    .map((t) => ({ ...t, done: doneToday.get(t.id) ?? false }));
}

/**
 * Stats d'un jour passé, reconstituées : récurrentes dues ce jour-là
 * + one-off ayant une ligne de complétion ce jour-là.
 */
export function dayStat(
  tasks: Task[],
  completions: Completion[],
  date: string,
): DayStat {
  const comps = completions.filter((c) => c.date === date);
  const doneIds = new Set(comps.filter((c) => c.done).map((c) => c.task_id));
  const byId = new Map(tasks.map((t) => [t.id, t]));

  const due = new Set<number>();
  for (const t of tasks) if (isDueOn(t, date)) due.add(t.id);
  for (const c of comps) {
    const t = byId.get(c.task_id);
    if (t && !isRecurring(t)) due.add(c.task_id);
  }

  const total = due.size;
  const done = [...due].filter((id) => doneIds.has(id)).length;
  return {
    date,
    total,
    done,
    pct: total > 0 ? Math.round((done / total) * 100) : null,
  };
}

export function pctOfList(list: TodayTask[]): number | null {
  if (list.length === 0) return null;
  return Math.round((list.filter((t) => t.done).length / list.length) * 100);
}

/** 7 derniers jours (aujourd'hui inclus) ; le jour courant est calculé sur la liste live. */
export function weekStats(
  tasks: Task[],
  completions: Completion[],
  today: string,
  todayList: TodayTask[],
): DayStat[] {
  const out: DayStat[] = [];
  for (let i = 6; i >= 1; i--) {
    out.push(dayStat(tasks, completions, addDays(today, -i)));
  }
  out.push({
    date: today,
    total: todayList.length,
    done: todayList.filter((t) => t.done).length,
    pct: pctOfList(todayList),
  });
  return out;
}

/** Une tâche ponctuelle est "faite" si elle a au moins une complétion done. */
export function isOneOffDone(task: Task, completions: Completion[]): boolean {
  return completions.some((c) => c.task_id === task.id && c.done);
}

/**
 * Progression effective d'un objectif : son % si manuelle, sinon la moyenne
 * des sous-objectifs (progression effective) et des tâches ponctuelles liées
 * (100 si faite, 0 sinon). Les tâches récurrentes ne comptent pas (elles ne
 * se "terminent" jamais). Sans enfant ni tâche liée, retombe sur le % stocké.
 */
export function effectiveProgress(
  goal: Goal,
  goals: Goal[],
  tasks: Task[],
  completions: Completion[],
  seen: Set<number> = new Set(),
): number {
  if (goal.manual_progress) return goal.progress_pct;
  if (seen.has(goal.id)) return 0; // garde-fou anti-cycle
  seen.add(goal.id);

  const parts: number[] = [];
  for (const child of goals.filter((g) => g.parent_goal_id === goal.id)) {
    parts.push(effectiveProgress(child, goals, tasks, completions, seen));
  }
  for (const t of tasks.filter(
    (t) =>
      t.goal_id === goal.id && (!t.recurrence || t.recurrence === "none"),
  )) {
    parts.push(isOneOffDone(t, completions) ? 100 : 0);
  }

  if (parts.length === 0) return goal.progress_pct ?? 0;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

/** Descendants d'un objectif (pour interdire les cycles dans le choix du parent). */
export function descendantIds(goalId: number, goals: Goal[]): Set<number> {
  const out = new Set<number>();
  const walk = (id: number) => {
    for (const g of goals) {
      if (g.parent_goal_id === id && !out.has(g.id)) {
        out.add(g.id);
        walk(g.id);
      }
    }
  };
  walk(goalId);
  return out;
}

const STREAK_THRESHOLD = 80;

export interface StreakRun {
  start: string;
  end: string;
  length: number;
}

/**
 * Toutes les séries de jours ≥80% sur les `maxDays` derniers jours,
 * la plus récente en premier. Même convention que computeStreak :
 * les jours sans tâche due sont neutres.
 */
export function streakHistory(
  tasks: Task[],
  completions: Completion[],
  today: string,
  todayPct: number | null,
  maxDays = 365,
): StreakRun[] {
  const runs: StreakRun[] = [];
  let current: StreakRun | null = null;

  for (let i = maxDays; i >= 0; i--) {
    const date = addDays(today, -i);
    const pct = i === 0 ? todayPct : dayStat(tasks, completions, date).pct;
    if (pct === null) continue;
    if (pct >= STREAK_THRESHOLD) {
      if (!current) current = { start: date, end: date, length: 0 };
      current.end = date;
      current.length++;
    } else if (current) {
      runs.push(current);
      current = null;
    }
  }
  if (current) runs.push(current);
  return runs.reverse();
}

export type Period = "day" | "week" | "month";

export interface PeriodStat {
  label: string;
  pct: number;
  isCurrent: boolean;
}

/** Lundi de la semaine d'une date. */
function mondayOf(dateStr: string): string {
  const wd = weekdayOf(dateStr);
  return addDays(dateStr, wd === 0 ? -6 : 1 - wd);
}

/**
 * Complétion agrégée pour le graphique Performance :
 * jour = 30 derniers jours, semaine = 12 dernières semaines (moyenne des
 * jours avec tâches), mois = 12 derniers mois. Aujourd'hui est calculé
 * depuis la liste live (todayPct).
 */
export function aggregateStats(
  tasks: Task[],
  completions: Completion[],
  today: string,
  todayPct: number | null,
  period: Period,
): PeriodStat[] {
  const pctOf = (date: string): number | null =>
    date === today ? todayPct : dayStat(tasks, completions, date).pct;

  if (period === "day") {
    const out: PeriodStat[] = [];
    for (let i = 29; i >= 0; i--) {
      const date = addDays(today, -i);
      out.push({
        label: date.slice(8) + "/" + date.slice(5, 7),
        pct: pctOf(date) ?? 0,
        isCurrent: i === 0,
      });
    }
    return out;
  }

  const buckets: { key: string; label: string; dates: string[] }[] = [];
  if (period === "week") {
    const thisMonday = mondayOf(today);
    for (let w = 11; w >= 0; w--) {
      const start = addDays(thisMonday, -7 * w);
      const dates: string[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, d);
        if (date <= today) dates.push(date);
      }
      buckets.push({
        key: start,
        label: start.slice(8) + "/" + start.slice(5, 7),
        dates,
      });
    }
  } else {
    const [y, m] = today.split("-").map(Number);
    for (let k = 11; k >= 0; k--) {
      const d = new Date(y, m - 1 - k, 1);
      const monthKey = toDateStr(d).slice(0, 7);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const dates: string[] = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${monthKey}-${String(day).padStart(2, "0")}`;
        if (date <= today) dates.push(date);
      }
      buckets.push({
        key: monthKey,
        label: d.toLocaleDateString(localeTag(), { month: "short" }),
        dates,
      });
    }
  }

  return buckets.map((b, i) => {
    const pcts = b.dates
      .map((d) => pctOf(d))
      .filter((p): p is number => p !== null);
    return {
      label: b.label,
      pct: pcts.length
        ? Math.round(pcts.reduce((a, x) => a + x, 0) / pcts.length)
        : 0,
      isCurrent: i === buckets.length - 1,
    };
  });
}

/**
 * Jours consécutifs à ≥80% de complétion. Les jours sans tâche due sont
 * neutres (ne comptent pas, ne cassent pas). Aujourd'hui compte s'il est
 * déjà ≥80%, sinon il est ignoré (la journée n'est pas finie).
 */
export function computeStreak(
  tasks: Task[],
  completions: Completion[],
  today: string,
  todayPct: number | null,
): number {
  let streak = 0;
  if (todayPct !== null && todayPct >= STREAK_THRESHOLD) streak++;
  let d = addDays(today, -1);
  for (let i = 0; i < 365; i++) {
    const s = dayStat(tasks, completions, d);
    if (s.pct !== null) {
      if (s.pct >= STREAK_THRESHOLD) streak++;
      else break;
    }
    d = addDays(d, -1);
  }
  return streak;
}
