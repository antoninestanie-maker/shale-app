-- Onglet « Savoir » : base de connaissances personnelle.
-- Deux tables seulement : des THÈMES (classement visuel) et des FICHES
-- (note riche, lien, image ou croquis). Volontairement sans FTS5 : la
-- recherche se fait en mémoire sur la liste déjà chargée (titre, tags,
-- texte), ce qui reste instantané à cette échelle et garde un comportement
-- identique en mode démo (navigateur) et en natif.

CREATE TABLE knowledge_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#4d8dff', -- teinte du thème (hex de données)
  position INTEGER NOT NULL DEFAULT 0,   -- ordre d'affichage dans le rail
  created_at TEXT NOT NULL
);

CREATE TABLE knowledge_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id INTEGER,                      -- NULL = fiche non classée
  kind TEXT NOT NULL DEFAULT 'note'
    CHECK(kind IN ('note','link','image','sketch')),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',         -- HTML riche (note) ou légende
  url TEXT,                              -- lien hypertexte (kind = 'link')
  media TEXT,                            -- data URL pleine résolution (image / croquis)
  thumb TEXT,                            -- data URL d'aperçu (chargée dans la liste)
  data TEXT,                             -- JSON annexe : traits du croquis (ré-éditable)
  tags TEXT NOT NULL DEFAULT '',         -- tags libres, séparés par des virgules
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (topic_id) REFERENCES knowledge_topics(id)
);

CREATE INDEX idx_knowledge_entries_topic ON knowledge_entries(topic_id);
CREATE INDEX idx_knowledge_entries_updated ON knowledge_entries(updated_at DESC);
