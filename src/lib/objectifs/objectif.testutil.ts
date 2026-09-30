import type { Completion, Goal, Habit, Task } from "../types";

/**
 * Un objectif de test, aux valeurs par défaut de la base.
 *
 * ⭐ UNE SEULE fabrique pour tout le dépôt. Trois fichiers de test recopiaient
 * chacun la leur ; la migration 026 a ajouté dix colonnes à `goals`, et les
 * trois copies ont cassé ensemble. Une colonne de plus ne se corrige plus
 * qu'ici.
 *
 * Les défauts sont ceux de SQLite (migrations 001 et 026), sauf
 * `manual_progress` : 0 ici, parce qu'un test d'objectif MESURÉ est le cas
 * courant et qu'un test du repli manuel le dit explicitement.
 */
export const objectif = (p: Partial<Goal> = {}): Goal => ({
  id: 1,
  title: "livrer",
  description: null,
  scope: "medium",
  category: null,
  parent_goal_id: null,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
  created_at: "2026-09-01 09:00:00",
  is_milestone: 0,
  position: 0,
  weight: 1,
  target_count: null,
  target_unit: null,
  count_source: "manual",
  manual_count: 0,
  count_ref_uid: null,
  count_since: null,
  is_example: 0,
  priority: "medium",
  ...p,
});

/**
 * Une tâche, une habitude et une coche de test (2026-09-29) — mêmes défauts que
 * les fabriques locales de `progression.test.ts`. Les tests neufs viennent ici
 * plutôt que d'en écrire une quatrième copie (PIEGES § 9.20).
 */
export const tache = (p: Partial<Task> = {}): Task => ({
  id: 1,
  label: "t",
  tag: null,
  priority: "medium",
  recurrence: "none",
  goal_id: null,
  created_at: "2026-09-01 09:00:00",
  due_date: null,
  start_at: null,
  end_at: null,
  postponed_count: 0,
  postponed_from: null,
  is_example: 0,
  ...p,
});

export const habitude = (p: Partial<Habit> = {}): Habit => ({
  id: 1,
  name: "backtest",
  color: "#3cd9b0",
  archived: 0,
  is_example: 0,
  ...p,
});

export const coche = (task_id: number, date = "2026-09-10", done = 1): Completion => ({
  id: task_id * 1000 + Number(date.slice(-2)),
  task_id,
  date,
  done,
});
