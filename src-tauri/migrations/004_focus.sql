-- Sessions de focus (Pomodoro) — liées à une tâche ou libres
CREATE TABLE focus_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER,               -- optionnel
  label TEXT,                    -- intitulé libre si pas de tâche
  started_at TEXT NOT NULL,      -- YYYY-MM-DD HH:MM:SS (local)
  ended_at TEXT,                 -- NULL = en cours
  planned_min INTEGER NOT NULL,
  kind TEXT DEFAULT 'focus',     -- 'focus' | 'break'
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_focus_started ON focus_sessions(started_at);
