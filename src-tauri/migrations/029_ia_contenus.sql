-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029 — les contenus rédigés par l'IA de Shale Pro (2026-09-29)
--
-- QUOI. Une table, `ia_contenus`, pour ce que l'IA a rédigé et qu'on garde :
-- le brief du matin, la clôture du soir, la revue hebdomadaire.
--
-- POURQUOI LES STOCKER, alors que la règle du projet est de ne jamais stocker
-- l'état dérivé : ce ne sont PAS de l'état dérivé. Un brief est un CONTENU —
-- il a coûté de l'argent, il dépend de flux qui auront changé demain, et il
-- doit être le même sur tous les appareils. Les statuts calculés (« en
-- retard », « en péril »), eux, restent calculés à la lecture.
--
-- UNE TABLE, PAS TROIS (décision d'Antonin, 2026-09-29, audit Q9) : les trois
-- ont la même forme — un genre, un jour, un contenu JSON. `kind` vaut
-- `brief`, `cloture` ou `revue`, SANS `CHECK` (PIEGES § 3.4 : une contrainte
-- violée par une ligne distante arrête tout le cycle de synchronisation, pas
-- la ligne ; un appareil plus récent pourra ajouter un genre).
--
-- IDENTITÉ DÉTERMINISTE. L'app écrit l'uid elle-même : `<kind>:<jour>` (ex.
-- `brief:2026-10-14`). Deux appareils qui génèrent le brief du même jour
-- écrivent donc la MÊME ligne : la synchronisation garde la plus récente au
-- lieu d'en montrer deux. Le trigger d'identité n'est que le filet.
--
-- `contenu` : le JSON rendu par la fonction `ai`, tel que revalidé par l'app,
-- plus ce que l'app y ajoute (ex. : les propositions acceptées de la clôture).
-- `lu_le` : quand l'utilisateur l'a ouvert — sert à ne pas le re-proposer.
--
-- Synchronisée comme le reste (chiffrée de bout en bout). Pas de `deleted_at` :
-- la table n'est pas dans la corbeille (un brief se régénère, il ne se
-- restaure pas).
--
-- ⚠️ Ne jamais modifier ce fichier une fois joué (PIEGES : sqlx vérifie la
-- somme de contrôle de chaque migration appliquée).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE ia_contenus (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  uid      TEXT,
  kind     TEXT NOT NULL DEFAULT '',
  jour     TEXT NOT NULL DEFAULT '',
  contenu  TEXT NOT NULL DEFAULT '{}',
  cree_le  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  lu_le    TEXT
);

CREATE UNIQUE INDEX idx_ia_contenus_uid ON ia_contenus(uid);
CREATE INDEX idx_ia_contenus_kind_jour ON ia_contenus(kind, jour);

-- Filet d'identité : uid dérivé du genre et du jour, comme l'app l'écrit.
CREATE TRIGGER ia_contenus_uid AFTER INSERT ON ia_contenus WHEN NEW.uid IS NULL BEGIN
  UPDATE ia_contenus SET uid = NEW.kind || ':' || NEW.jour WHERE id = NEW.id;
END;

CREATE TRIGGER ia_contenus_out_ins AFTER INSERT ON ia_contenus WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('ia_contenus', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER ia_contenus_out_upd AFTER UPDATE ON ia_contenus WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('ia_contenus', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER ia_contenus_out_del AFTER DELETE ON ia_contenus WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'ia_contenus' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('ia_contenus', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
