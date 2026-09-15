import type { Goal } from "../types";

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
  ...p,
});
