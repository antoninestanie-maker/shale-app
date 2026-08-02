CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  tag TEXT,
  priority TEXT CHECK(priority IN ('low','medium','high')) DEFAULT 'medium',
  recurrence TEXT DEFAULT 'none', -- 'daily', 'weekdays', 'none', ou JSON de jours ex. '[1,3,5]'
  goal_id INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (goal_id) REFERENCES goals(id)
);

CREATE TABLE task_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  done BOOLEAN DEFAULT 0,
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  UNIQUE(task_id, date)
);

CREATE INDEX idx_completions_date ON task_completions(date);

CREATE TABLE goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  scope TEXT CHECK(scope IN ('short','medium','long')),
  parent_goal_id INTEGER,
  deadline TEXT,
  progress_pct INTEGER DEFAULT 0,
  manual_progress BOOLEAN DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (parent_goal_id) REFERENCES goals(id)
);

CREATE TABLE custom_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT
);

CREATE TABLE metric_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_id INTEGER NOT NULL,
  date TEXT NOT NULL, -- YYYY-MM-DD
  value REAL,
  FOREIGN KEY (metric_id) REFERENCES custom_metrics(id)
);

CREATE INDEX idx_metric_entries_date ON metric_entries(metric_id, date);

-- Tags personnalisables avec couleur
CREATE TABLE tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#0e7df0'
);
