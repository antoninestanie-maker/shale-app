-- Journal de trading
CREATE TABLE trades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,             -- YYYY-MM-DD
  instrument TEXT NOT NULL,       -- NQ, EURUSD…
  direction TEXT CHECK(direction IN ('long','short')) NOT NULL,
  setup TEXT,                     -- Silver Bullet, OB, FVG…
  risk_r REAL DEFAULT 1,
  result_r REAL NOT NULL,         -- résultat en R (+2.5, -1, 0 = BE)
  screenshot_path TEXT,
  notes TEXT,
  created_at TEXT
);

CREATE INDEX idx_trades_date ON trades(date);
