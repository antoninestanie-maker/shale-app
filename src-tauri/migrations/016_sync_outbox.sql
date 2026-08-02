-- Journal de changements local (outbox) — ce qui reste à envoyer au cloud.
--
-- PRINCIPE. Aucune écriture utilisateur ne doit attendre le réseau. L'app écrit
-- dans SQLite, point ; c'est le seul chemin critique. En marge, un journal note
-- « telle ligne a bougé » — et c'est tout ce qu'il fait. Sans réseau, il
-- s'accumule ; au retour du réseau, il se vide.
--
-- CE QUE LE JOURNAL NE CONTIENT PAS : les données. Ni en clair, ni chiffrées.
-- Il ne stocke qu'un POINTEUR vers la ligne (table + rowid) et un horodatage.
-- La ligne est lue, compressée et chiffrée au moment de l'envoi.
--   • Chiffrer sur le chemin d'une frappe clavier — une note du Savoir pèse
--     des centaines de ko — violerait le principe ci-dessus.
--   • Dix modifications successives d'une même note ne produisent alors qu'UN
--     seul blob à l'envoi, au lieu de dix.
--   • Et un trigger SQL ne PEUT de toute façon pas chiffrer.
--
-- CAPTURE PAR TRIGGERS, pas par le code applicatif. Les ~60 fonctions d'écriture
-- de `repo.ts` ne sont pas modifiées, et une écriture ajoutée dans six mois sera
-- journalisée sans que personne ait à y penser. C'est la même logique que les
-- uid de la migration 015.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Les trois tables techniques
-- ─────────────────────────────────────────────────────────────────────────────

-- File d'attente. APPEND-ONLY : une entrée par écriture, pas par ligne modifiée.
-- Modifier vingt fois la même note produit vingt entrées, regroupées en une
-- seule au moment de l'envoi (`coalesce()` côté TypeScript). C'est volontaire :
-- des triggers « upsert » seraient plus économes mais nettement plus retors,
-- et l'ordre d'insertion donne gratuitement un ordre d'envoi stable.
-- Une entrée pèse une soixantaine d'octets — mille modifications hors ligne
-- coûtent 60 ko.
CREATE TABLE sync_outbox (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  -- rowid local de la ligne à relire au moment de l'envoi.
  -- NULL pour une suppression : la ligne n'existe plus, il n'y a rien à relire.
  row_id     INTEGER,
  -- Identifiant global. Peut être NULL sur une CRÉATION — voir le piège des
  -- triggers plus bas — mais il est TOUJOURS renseigné sur une suppression,
  -- seul cas où il est indispensable.
  uid        TEXT,
  op         TEXT NOT NULL CHECK (op IN ('upsert', 'delete')),
  -- ⚠️ EN UTC, contrairement à TOUT le reste de l'app (`localNow()` écrit de
  -- l'heure locale, et la logique « jour » compare du local). C'est délibéré et
  -- c'est le SEUL endroit : cet horodatage sert à départager deux écritures
  -- faites sur DEUX APPAREILS. Deux heures locales de fuseaux différents ne
  -- sont pas comparables — un LWW bâti dessus donnerait un vainqueur arbitraire.
  -- Format `2026-08-02T20:44:33.123Z` : trié lexicographiquement = trié
  -- chronologiquement, et précis à la milliseconde.
  ts         TEXT NOT NULL
);

CREATE INDEX idx_sync_outbox_entite ON sync_outbox(table_name, row_id);
CREATE INDEX idx_sync_outbox_uid    ON sync_outbox(table_name, uid);

-- Miroir de ce que le SERVEUR connaît de chaque ligne. C'est la mémoire qui
-- permet au LWW de trancher : sans elle, impossible de distinguer « le serveur
-- a une version plus récente » de « le serveur n'a jamais vu cette ligne ».
CREATE TABLE sync_state (
  table_name TEXT NOT NULL,
  uid        TEXT NOT NULL,
  -- `client_ts` de la version que le serveur détient (horloge de l'appareil qui
  -- a écrit, UTC). C'est CE champ qui arbitre le last-write-wins.
  remote_ts  TEXT NOT NULL,
  -- `server_seq` de cette version : horloge du SERVEUR, qui sert de curseur de
  -- pagination. Ne JAMAIS l'utiliser pour arbitrer un conflit, ni utiliser
  -- `remote_ts` comme curseur : confondre les deux fait rater des lignes dès
  -- qu'une machine est mal réglée.
  server_seq INTEGER,
  deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (table_name, uid)
);

-- Réglages et état du moteur (clé/valeur). Séparé de la table `settings` de
-- l'app, car ceci est de la plomberie : ça ne se synchronise pas, ça ne
-- s'exporte pas, et ça ne doit pas apparaître dans les réglages utilisateur.
CREATE TABLE sync_meta (
  k TEXT PRIMARY KEY,
  v TEXT
);

INSERT INTO sync_meta (k, v) VALUES
  -- Drapeau anti-boucle : à '1' pendant qu'on applique des changements VENUS du
  -- cloud, pour que les triggers ne les renvoient pas d'où ils viennent. Sans
  -- lui, chaque synchronisation en déclencherait une autre, indéfiniment.
  ('applying', '0'),
  -- Dernier `server_seq` tiré. '0' = rien n'a jamais été récupéré.
  ('cursor', '0'),
  -- Identité de CETTE installation. Sert à départager deux écritures portant
  -- exactement le même horodatage : la comparaison des device_id est arbitraire
  -- mais DÉTERMINISTE, donc les deux appareils choisissent le même vainqueur et
  -- convergent. Sans ce départage, ils pourraient diverger définitivement.
  ('device_id', lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))),
  -- Horodatage du dernier échange réussi (affiché par l'indicateur d'état).
  ('last_push_at', ''),
  ('last_pull_at', '');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Les triggers de journalisation
-- ─────────────────────────────────────────────────────────────────────────────
-- Trois par table : création, modification, suppression. Toutes les tables de
-- données de l'app y passent — la synchronisation couvre l'application entière,
-- pas un sous-ensemble.
--
-- NE SONT PAS JOURNALISÉES, et ce ne sont pas des choix de périmètre :
--   `notes_fts`         — index FTS5 DÉRIVÉ de `notes`, reconstruit par ses
--                         propres triggers sur chaque appareil. Le transporter
--                         n'aurait aucun sens et corromprait l'index.
--   `_sqlx_migrations`  — état interne du moteur de migrations.
--   `sync_*`            — la plomberie elle-même (une boucle infinie évidente).
--
-- La table `settings`, elle, EST journalisée intégralement ; c'est à l'envoi
-- qu'une courte liste de clés propres à l'appareil est écartée (taille de
-- fenêtre, disposition des widgets…). Cette liste est du RÉGLAGE, pas du
-- schéma : elle vit dans `src/lib/sync/scope.ts` et se modifie sans migration.
--
-- ⚠️ PIÈGE MAJEUR — `NEW.uid` peut être NULL dans le trigger de CRÉATION.
-- SQLite ne garantit aucun ordre entre deux triggers `AFTER INSERT` sur la même
-- table (c'est ce qui avait corrompu l'index FTS5 en migration 015). Le trigger
-- qui pose l'uid peut donc passer APRÈS celui-ci. C'est sans gravité : le
-- journal retient le `row_id`, qui suffit à relire la ligne — et l'écriture de
-- l'uid déclenche de toute façon le trigger de modification, qui ré-enregistre
-- l'entrée avec l'uid. NE JAMAIS bâtir quoi que ce soit sur la présence de
-- `uid` pour un 'upsert' : il se résout à la relecture.
--
-- La suppression, elle, EFFACE d'abord les entrées en attente de cette ligne.
-- Une ligne créée puis supprimée hors ligne ne part donc jamais dans le cloud :
-- seule la pierre tombale subsiste. Et si la ligne y était déjà, la pierre
-- tombale la fait disparaître partout — c'est ce qui empêche une ligne
-- supprimée de « ressusciter » à la synchronisation suivante.
-- tasks
CREATE TRIGGER tasks_out_ins AFTER INSERT ON tasks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tasks', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER tasks_out_upd AFTER UPDATE ON tasks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tasks', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER tasks_out_del AFTER DELETE ON tasks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'tasks' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tasks', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- task_completions
CREATE TRIGGER task_completions_out_ins AFTER INSERT ON task_completions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('task_completions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER task_completions_out_upd AFTER UPDATE ON task_completions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('task_completions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER task_completions_out_del AFTER DELETE ON task_completions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'task_completions' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('task_completions', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- goals
CREATE TRIGGER goals_out_ins AFTER INSERT ON goals WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('goals', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER goals_out_upd AFTER UPDATE ON goals WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('goals', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER goals_out_del AFTER DELETE ON goals WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'goals' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('goals', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- custom_metrics
CREATE TRIGGER custom_metrics_out_ins AFTER INSERT ON custom_metrics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('custom_metrics', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER custom_metrics_out_upd AFTER UPDATE ON custom_metrics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('custom_metrics', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER custom_metrics_out_del AFTER DELETE ON custom_metrics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'custom_metrics' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('custom_metrics', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- metric_entries
CREATE TRIGGER metric_entries_out_ins AFTER INSERT ON metric_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('metric_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER metric_entries_out_upd AFTER UPDATE ON metric_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('metric_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER metric_entries_out_del AFTER DELETE ON metric_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'metric_entries' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('metric_entries', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- tags
CREATE TRIGGER tags_out_ins AFTER INSERT ON tags WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tags', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER tags_out_upd AFTER UPDATE ON tags WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tags', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER tags_out_del AFTER DELETE ON tags WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'tags' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('tags', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- quick_links
CREATE TRIGGER quick_links_out_ins AFTER INSERT ON quick_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('quick_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER quick_links_out_upd AFTER UPDATE ON quick_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('quick_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER quick_links_out_del AFTER DELETE ON quick_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'quick_links' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('quick_links', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- focus_sessions
CREATE TRIGGER focus_sessions_out_ins AFTER INSERT ON focus_sessions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('focus_sessions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER focus_sessions_out_upd AFTER UPDATE ON focus_sessions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('focus_sessions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER focus_sessions_out_del AFTER DELETE ON focus_sessions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'focus_sessions' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('focus_sessions', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- notes
CREATE TRIGGER notes_out_ins AFTER INSERT ON notes WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('notes', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER notes_out_upd AFTER UPDATE ON notes WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('notes', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER notes_out_del AFTER DELETE ON notes WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'notes' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('notes', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- journal_entries
CREATE TRIGGER journal_entries_out_ins AFTER INSERT ON journal_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('journal_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER journal_entries_out_upd AFTER UPDATE ON journal_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('journal_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER journal_entries_out_del AFTER DELETE ON journal_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'journal_entries' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('journal_entries', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- habits
CREATE TRIGGER habits_out_ins AFTER INSERT ON habits WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habits', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER habits_out_upd AFTER UPDATE ON habits WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habits', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER habits_out_del AFTER DELETE ON habits WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'habits' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habits', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- habit_checks
CREATE TRIGGER habit_checks_out_ins AFTER INSERT ON habit_checks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habit_checks', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER habit_checks_out_upd AFTER UPDATE ON habit_checks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habit_checks', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER habit_checks_out_del AFTER DELETE ON habit_checks WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'habit_checks' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('habit_checks', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- trades
CREATE TRIGGER trades_out_ins AFTER INSERT ON trades WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('trades', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER trades_out_upd AFTER UPDATE ON trades WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('trades', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER trades_out_del AFTER DELETE ON trades WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'trades' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('trades', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- position_size_calculations
CREATE TRIGGER position_size_calculations_out_ins AFTER INSERT ON position_size_calculations WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('position_size_calculations', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER position_size_calculations_out_upd AFTER UPDATE ON position_size_calculations WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('position_size_calculations', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER position_size_calculations_out_del AFTER DELETE ON position_size_calculations WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'position_size_calculations' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('position_size_calculations', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- benchmark_results
CREATE TRIGGER benchmark_results_out_ins AFTER INSERT ON benchmark_results WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('benchmark_results', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER benchmark_results_out_upd AFTER UPDATE ON benchmark_results WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('benchmark_results', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER benchmark_results_out_del AFTER DELETE ON benchmark_results WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'benchmark_results' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('benchmark_results', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- live_positions
CREATE TRIGGER live_positions_out_ins AFTER INSERT ON live_positions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('live_positions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER live_positions_out_upd AFTER UPDATE ON live_positions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('live_positions', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER live_positions_out_del AFTER DELETE ON live_positions WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'live_positions' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('live_positions', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- knowledge_topics
CREATE TRIGGER knowledge_topics_out_ins AFTER INSERT ON knowledge_topics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_topics', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER knowledge_topics_out_upd AFTER UPDATE ON knowledge_topics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_topics', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER knowledge_topics_out_del AFTER DELETE ON knowledge_topics WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'knowledge_topics' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_topics', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- knowledge_entries
CREATE TRIGGER knowledge_entries_out_ins AFTER INSERT ON knowledge_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER knowledge_entries_out_upd AFTER UPDATE ON knowledge_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_entries', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER knowledge_entries_out_del AFTER DELETE ON knowledge_entries WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'knowledge_entries' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('knowledge_entries', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- settings (clé primaire TEXT : pas de colonne id, pas d'uid dédié)
CREATE TRIGGER settings_out_ins AFTER INSERT ON settings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('settings', NEW.rowid, 'st:' || NEW.key, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER settings_out_upd AFTER UPDATE ON settings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('settings', NEW.rowid, 'st:' || NEW.key, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER settings_out_del AFTER DELETE ON settings WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'settings' AND row_id = OLD.rowid;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('settings', NULL, 'st:' || OLD.key, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
