-- Tracker live trading : positions envoyées depuis le calculateur ("Trader"),
-- en attente de dénouement (Gagnante / Perdante / BE), avec sorties partielles.
-- À la clôture, une ligne est créée dans `trades` (journal) et la position
-- reste ici en archive (status ≠ 'open', trade_id renseigné).

-- TP initial optionnel sur les calculs de sizing (permet le R:R théorique)
ALTER TABLE position_size_calculations ADD COLUMN take_profit_price REAL;

CREATE TABLE live_positions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opened_at TEXT NOT NULL,          -- heure exacte d'entrée (capturée au clic "Trader")
  pair TEXT NOT NULL,
  direction TEXT CHECK(direction IN ('long','short')) NOT NULL,
  entry_price REAL NOT NULL,
  stop_loss_price REAL NOT NULL,
  take_profit_price REAL,           -- TP initial (nullable, éditable dans le tracker)
  lots REAL,                        -- taille issue du calculateur
  risk_percent REAL,
  risk_amount REAL,                 -- risque en devise du compte
  rr_theoretical REAL,              -- ratio R:R calculé à la réception
  sizing_calc_id INTEGER,           -- calcul d'origine (traçabilité)
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','win','loss','be')),
  closed_at TEXT,
  result_r REAL,                    -- résultat final en R (pondéré par les partielles)
  partials TEXT NOT NULL DEFAULT '[]', -- JSON [{at, pct, price, r}]
  trade_id INTEGER,                 -- ligne du journal créée à la clôture
  notes TEXT
);

CREATE INDEX idx_live_positions_status ON live_positions(status);
