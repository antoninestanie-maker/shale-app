-- Market-Brain : mémoire des briefings générés (2×/jour, conservés 7 jours).
-- Sert à l'affichage persistant de l'onglet + à la rétroaction (biais de la veille
-- réinjecté dans le prompt du lendemain).
CREATE TABLE market_briefings (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session       TEXT NOT NULL,              -- 'pre_london' | 'pre_ny'
  day           TEXT NOT NULL,              -- 'YYYY-MM-DD' (Europe/Paris) — clé d'unicité
  generated_at  TEXT NOT NULL,              -- ISO local Europe/Paris
  payload_in    TEXT NOT NULL,              -- JSON envoyé au LLM (audit/debug)
  output_json   TEXT NOT NULL,              -- sortie de l'agent (briefing)
  dismissed     INTEGER NOT NULL DEFAULT 0, -- 1 quand l'utilisateur ferme l'onglet
  UNIQUE(session, day)
);

CREATE INDEX idx_market_briefings_gen ON market_briefings(generated_at);
