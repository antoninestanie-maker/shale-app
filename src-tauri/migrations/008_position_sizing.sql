-- Calculateur de taille de position (money management)
-- Historique des calculs, loggé automatiquement pour analyse ultérieure.
CREATE TABLE position_size_calculations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  capital REAL NOT NULL,
  risk_percent REAL NOT NULL,
  pair TEXT NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL,
  spread_pips REAL,
  include_spread INTEGER NOT NULL DEFAULT 1,
  direction TEXT CHECK(direction IN ('long', 'short')) NOT NULL,
  sl_distance_pips REAL NOT NULL,
  position_size_lots REAL NOT NULL,
  risk_amount_usd REAL NOT NULL,
  pip_value_per_lot REAL,          -- valeur du pip utilisée (overridable par broker)
  used_for_trade INTEGER NOT NULL DEFAULT 0, -- marqué comme utilisé pour un trade réel
  notes TEXT
);

CREATE INDEX idx_pos_size_created ON position_size_calculations(created_at);

-- Réglages du calculateur (clé/valeur, réutilise la table settings existante) :
--   sizing.capital, sizing.risk, sizing.maxRisk, sizing.maxLots,
--   sizing.currency, sizing.pipOverrides (JSON), sizing.customPairs (JSON)
