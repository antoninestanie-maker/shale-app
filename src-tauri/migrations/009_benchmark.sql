-- Human Benchmark : résultats des mini-tests cognitifs (réaction, mémoire…).
-- Sert aussi de socle à l'"alcootest" pré-session (test de réaction avant de trader).
CREATE TABLE benchmark_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test TEXT NOT NULL,          -- 'reaction' | 'memory' | 'sequence'
  score REAL NOT NULL,         -- réaction: ms (plus bas = mieux) ; mémoire: niveau (plus haut = mieux)
  detail TEXT,                 -- JSON optionnel (manches, etc.)
  pre_session INTEGER DEFAULT 0, -- 1 si lancé comme contrôle pré-trading
  created_at TEXT NOT NULL     -- YYYY-MM-DD HH:MM:SS (local)
);

CREATE INDEX idx_benchmark_created ON benchmark_results(test, created_at);
