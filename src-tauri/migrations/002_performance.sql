-- Historique de progression des objectifs (un snapshot par jour, écrit au lancement)
CREATE TABLE goal_progress_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  pct INTEGER NOT NULL,
  UNIQUE(goal_id, date),
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);

-- Une valeur de métrique par jour (upsert)
CREATE UNIQUE INDEX idx_metric_entries_unique ON metric_entries(metric_id, date);
