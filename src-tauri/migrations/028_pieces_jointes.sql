-- ─────────────────────────────────────────────────────────────────────────────
-- 028 — Les pièces jointes
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Chantier « pièces jointes », 2026-09-23. Une note — dans Notes comme dans le
-- Savoir — peut porter un FICHIER : un PDF, un tableur, une archive, n'importe
-- quoi. Le fichier devient du même coup la HUITIÈME famille du graphe : il se
-- cite avec `@`, il porte des backlinks, il peut être un nœud de carte mentale.
--
-- ⭐⭐ LES OCTETS NE SONT PAS DANS LA NOTE, ET C'EST TOUT LE SUJET
--
-- Les images du Savoir sont écrites EN CLAIR dans le corps, en base64
-- (`lib/knowledge.ts`, `encodeImage`). Tenable pour une image recompressée en
-- WebP à 1600 px ; intenable pour un fichier quelconque, pour trois raisons qui
-- se cumulent :
--
--   1. `notes_fts` (migration 005) indexe le corps BRUT. Un PDF de 3 Mo
--      deviendrait 4 Mo de base64 dans la note, PLUS 4 Mo d'index de recherche
--      — pour un contenu dont pas un mot n'est cherchable.
--   2. La synchronisation chiffre et envoie la LIGNE ENTIÈRE à chaque
--      enregistrement. Une note qui porte un PDF repartirait en entier à chaque
--      frappe, par lots qui ont une limite de taille (`sync/engine.ts`).
--   3. Le même raisonnement avait déjà tranché pour les cartes mentales le
--      2026-09-07 : 22 ko de SVG contre 114 ko de WebP, et 143 ko d'index FTS
--      évités. On ne le refait pas dans l'autre sens.
--
-- Donc : cette table porte le SIGNALEMENT du fichier (nom, type, taille), les
-- octets vivent sur le disque, et le corps de la note ne porte qu'un JETON —
-- exactement comme un jeton de mention.
--
-- ⭐ CE QUI SE SYNCHRONISE, ET CE QUI NE SE SYNCHRONISE PAS
--
-- Cette table SE SYNCHRONISE ; les octets NON. C'est délibéré, et les deux
-- moitiés de la décision se tiennent :
--
--   • le signalement voyage, donc l'iPhone SAIT qu'une pièce jointe existe et
--     l'affiche grisée, « pas sur cet appareil », au lieu de faire comme si le
--     paragraphe n'avait jamais rien porté ;
--   • les octets ne voyagent pas, parce que la synchronisation chiffre ligne à
--     ligne et envoie par lots — un PDF de 5 Mo n'y passe pas. Les faire suivre
--     demande un stockage chiffré chez Supabase : un autre chantier, et une
--     facture.
--
-- ⚠️ Le jour où ce chantier-là se fera, c'est ICI qu'il faudra revenir, et
-- non dans `lib/`.
--
-- ⚠️⚠️ POURQUOI LES ARÊTES `file` NE SORTENT PAS DE LA MACHINE — le point dur
--
-- `object_links` portait un `CHECK` qui ÉNUMÉRAIT les sept familles. Un appareil
-- resté sur une version antérieure à cette migration refuserait donc une arête
-- dont une extrémité vaut `'file'`. Et ce refus n'est pas bénin : `appliquerReçue`
-- (`sync/engine.ts`) ne rattrape que `ParentManquant` et RELANCE tout le reste,
-- ce qui fait échouer le cycle entier — à chaque tentative, indéfiniment. C'est
-- très exactement le mode d'échec que `PIEGES.md` § 3.4 décrit, et il coûterait
-- la synchronisation de l'iPhone jusqu'à sa mise à jour.
--
-- La parade est en DEUX temps, parce qu'aucun des deux ne suffit seul :
--
--   a) le `CHECK` disparaît ICI (§ 2). Sans cela, cette machine-ci refuserait
--      ses propres arêtes de pièce jointe. C'était de toute façon une dette :
--      § 3.4 dit qu'une règle de saisie vit en TypeScript, pas en SQL. Elle y
--      vit — `estKindConnu()`, `areteValide()`, et leurs tests.
--
--   b) les arêtes dont une extrémité est un fichier NE SONT PAS JOURNALISÉES
--      (§ 3). Elles ne partent donc jamais, et aucun appareil d'une version
--      antérieure n'en voit une. Le coût est mince et assumé : le panneau
--      « Mentionné dans » d'un fichier est LOCAL. C'est cohérent — les octets
--      le sont aussi.
--
-- ⚠️ `files`, elle, peut voyager sans risque : une table INCONNUE est ignorée
-- par les versions antérieures (`sync/engine.ts`, « Table inconnue »), et le
-- curseur avance quand même. C'est le `CHECK` d'une table CONNUE qui tue, pas
-- l'arrivée d'une table nouvelle.
--
-- ⚠️ AUCUNE CONTRAINTE `CHECK` DANS CE FICHIER (§ 3.4). Ni sur `mime`, ni sur
-- `size`. La lecture est tolérante : un type inconnu s'affiche avec l'icône
-- générique, une taille absurde s'affiche telle quelle.
--
-- ⚠️ AUCUNE COLONNE EN `_id` (PIEGES § 2.2), et aucune en `_uid` non plus
-- (§ 2.1) : cette table ne pointe vers rien. Le rattachement d'un fichier à une
-- note passe par `object_links`, comme tout le reste.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Le signalement d'un fichier
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ `name` est le nom d'ORIGINE, affiché tel quel. Il ne sert JAMAIS à
-- nommer quoi que ce soit sur le disque : deux « Contrat.pdf » déposés le même
-- jour s'écraseraient, et un nom venu de l'extérieur peut contenir `/` ou `..`.
-- Le fichier sur le disque est nommé par son `uid`, qui est un UUID — donc sans
-- séparateur, sans remontée possible, et unique par construction.
CREATE TABLE files (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  name       TEXT NOT NULL,
  -- Type MIME déclaré par le système au dépôt. Peut être vide : un fichier sans
  -- extension connue n'en a pas, et ce n'est pas une erreur.
  mime       TEXT NOT NULL DEFAULT '',
  -- Taille en octets, telle que mesurée au dépôt. Sert à l'affichage et à la
  -- garde de taille ; elle n'est pas relue depuis le disque, qui peut être
  -- celui d'un AUTRE appareil (donc vide).
  size       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_files_uid ON files(uid);

-- IDENTITÉ ARBITRAIRE → uid aléatoire (UUID v4), comme `calendar_events`.
-- Deux appareils qui déposent chacun le même PDF déposent bien deux fichiers :
-- ils n'ont aucun moyen de savoir que c'est le même, et le prétendre ferait
-- disparaître l'un des deux.
--
-- ⚠️ `abs(random() % 4)` et jamais `abs(random()) % 4` (PIEGES § 3.2).
-- ⚠️ En pratique l'app écrit TOUJOURS l'uid elle-même (`crypto.randomUUID()`) :
-- elle a besoin de le connaître avant d'écrire les octets sur le disque, et
-- SQLite ne garantit aucun ordre entre deux `AFTER INSERT` (PIEGES § 2.3). Ce
-- trigger est le filet, pas le chemin normal.
CREATE TRIGGER files_uid AFTER INSERT ON files WHEN NEW.uid IS NULL BEGIN
  UPDATE files SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) `object_links` sans son `CHECK` — la huitième famille devient possible
-- ─────────────────────────────────────────────────────────────────────────────
-- SQLite ne sait pas modifier une contrainte : il faut recréer la table.
--
-- ⚠️⚠️ LE PIÈGE, PAYÉ ICI MÊME. `ALTER TABLE … RENAME TO` fait REPARSER TOUT
-- LE SCHÉMA par SQLite, triggers des autres tables compris. Or entre le `DROP`
-- et le `RENAME`, `object_links` n'existe plus — et sept triggers la nomment
-- (`notes_links_del` et ses frères, migration 020 § 8). La migration échoue
-- alors sur :
--
--     error in trigger notes_links_del: no such table: main.object_links
--
-- La parade tient en une règle : **ces sept triggers sont supprimés AVANT la
-- manœuvre et recréés APRÈS** (§ 2 bis). On aurait pu poser
-- `PRAGMA legacy_alter_table = ON` autour du renommage — c'est deux lignes au
-- lieu de vingt — mais cela fait dépendre une migration jouée sur les VRAIES
-- données d'un réglage dont le comportement varie d'une version de SQLite à
-- l'autre. Les triggers recréés à la main ne dépendent de rien.
--
-- ⚠️ La liste des sept n'est pas devinée : elle vient d'une requête sur le
-- schéma réel au 2026-09-23 —
--     SELECT name FROM sqlite_master WHERE sql LIKE '%object_links%'
-- ⚠️ `objects_links_del` (migration 020) n'y est PAS : la migration 022 a
-- supprimé la table `objects` et l'a remplacé par `knowledge_topics_links_del`.
-- Le recopier d'après la 020 aurait fait échouer la migration.
--
-- ⚠️ `DROP TABLE` emporte les index ET les triggers DE CETTE TABLE — ils sont
-- donc tous recréés plus bas (§ 3).
--
-- ⚠️ `DROP TABLE` ne déclenche PAS les triggers `AFTER DELETE`. Rien n'est donc
-- journalisé comme suppression pendant cette opération — ce qui est exactement
-- ce qu'on veut : aucune arête n'est supprimée, elles sont RECOPIÉES.
--
-- ⚠️ La copie se fait AVANT la création des triggers d'outbox, sans quoi les
-- arêtes existantes repartiraient toutes dans le cloud pour rien.
DROP TRIGGER notes_links_del;
DROP TRIGGER knowledge_entries_links_del;
DROP TRIGGER tasks_links_del;
DROP TRIGGER goals_links_del;
DROP TRIGGER calendar_events_links_del;
DROP TRIGGER trades_links_del;
DROP TRIGGER knowledge_topics_links_del;

CREATE TABLE object_links_new (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  -- ⚠️ Plus de `CHECK` : la liste des familles vit dans `src/lib/liens.ts`
  -- (`LINK_KINDS`, `estKindConnu`), gardée par ses tests. Voir l'en-tête.
  from_kind  TEXT NOT NULL,
  from_uid   TEXT NOT NULL,
  to_kind    TEXT NOT NULL,
  to_uid     TEXT NOT NULL,
  origin     TEXT NOT NULL DEFAULT 'mention',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO object_links_new (id, uid, from_kind, from_uid, to_kind, to_uid, origin, created_at)
  SELECT id, uid, from_kind, from_uid, to_kind, to_uid, origin, created_at FROM object_links;

DROP TABLE object_links;

ALTER TABLE object_links_new RENAME TO object_links;

-- Les index de la migration 020, à l'identique.
CREATE UNIQUE INDEX idx_object_links_uid   ON object_links(uid);
CREATE UNIQUE INDEX idx_object_links_arete ON object_links(from_kind, from_uid, to_kind, to_uid);
CREATE INDEX idx_object_links_source ON object_links(from_kind, from_uid);
CREATE INDEX idx_object_links_cible  ON object_links(to_kind,   to_uid);

-- L'identité dérivée, à l'identique. ⚠️ DOIT rester mot pour mot celle de
-- `uidArete()` dans `src/lib/liens.ts` — un test compare les deux.
CREATE TRIGGER object_links_uid AFTER INSERT ON object_links WHEN NEW.uid IS NULL BEGIN
  UPDATE object_links
     SET uid = 'ol:' || NEW.from_kind || ':' || NEW.from_uid || ':' || NEW.to_kind || ':' || NEW.to_uid
   WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2 bis) Les sept triggers de ménage, recréés MOT POUR MOT
-- ─────────────────────────────────────────────────────────────────────────────
-- Ce sont ceux supprimés en tête du § 2, rendus tels que le schéma réel les
-- portait avant cette migration — `sqlite_master`, pas la migration 020, pour
-- la raison dite plus haut (la 022 a remplacé `objects_links_del`).
--
-- ⚠️ Volontairement NON gardés par `applying` : quand la suppression de la note
-- arrive de l'autre appareil, la cascade doit se produire ici aussi
-- (migration 020 § 8).
CREATE TRIGGER notes_links_del AFTER DELETE ON notes BEGIN
  DELETE FROM object_links WHERE (from_kind = 'note' AND from_uid = OLD.uid) OR (to_kind = 'note' AND to_uid = OLD.uid);
END;
CREATE TRIGGER knowledge_entries_links_del AFTER DELETE ON knowledge_entries BEGIN
  DELETE FROM object_links WHERE (from_kind = 'knowledge' AND from_uid = OLD.uid) OR (to_kind = 'knowledge' AND to_uid = OLD.uid);
END;
CREATE TRIGGER tasks_links_del AFTER DELETE ON tasks BEGIN
  DELETE FROM object_links WHERE (from_kind = 'task' AND from_uid = OLD.uid) OR (to_kind = 'task' AND to_uid = OLD.uid);
END;
CREATE TRIGGER goals_links_del AFTER DELETE ON goals BEGIN
  DELETE FROM object_links WHERE (from_kind = 'goal' AND from_uid = OLD.uid) OR (to_kind = 'goal' AND to_uid = OLD.uid);
END;
CREATE TRIGGER calendar_events_links_del AFTER DELETE ON calendar_events BEGIN
  DELETE FROM object_links WHERE (from_kind = 'event' AND from_uid = OLD.uid) OR (to_kind = 'event' AND to_uid = OLD.uid);
END;
CREATE TRIGGER trades_links_del AFTER DELETE ON trades BEGIN
  DELETE FROM object_links WHERE (from_kind = 'trade' AND from_uid = OLD.uid) OR (to_kind = 'trade' AND to_uid = OLD.uid);
END;
CREATE TRIGGER knowledge_topics_links_del AFTER DELETE ON knowledge_topics BEGIN
  DELETE FROM object_links WHERE (from_kind = 'object' AND from_uid = OLD.uid) OR (to_kind = 'object' AND to_uid = OLD.uid);
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Journalisation — le patron de la migration 016, avec UNE différence
-- ─────────────────────────────────────────────────────────────────────────────
-- Trois triggers par table, gardés par `applying` : rien n'est journalisé
-- pendant qu'on applique des changements VENUS du cloud.
--
-- ⭐ LA DIFFÉRENCE : les triggers d'`object_links` portent en plus la garde
-- `<> 'file'`. Une arête dont une extrémité est un fichier ne quitte JAMAIS la
-- machine — c'est la moitié (b) de la parade décrite en en-tête, et c'est la
-- seule chose qui protège un appareil resté en version antérieure.
--
-- ⚠️ Retirer cette garde un jour (quand les octets sauront voyager) suppose
-- que TOUS les appareils ont joué cette migration. Sinon : cycle de
-- synchronisation en échec permanent sur celui qui ne l'a pas jouée.

-- files
CREATE TRIGGER files_out_ins AFTER INSERT ON files WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('files', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER files_out_upd AFTER UPDATE ON files WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('files', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER files_out_del AFTER DELETE ON files WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'files' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('files', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- object_links — recréés à l'identique SAUF la garde `<> 'file'`.
CREATE TRIGGER object_links_out_ins AFTER INSERT ON object_links
WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0'
 AND NEW.from_kind <> 'file' AND NEW.to_kind <> 'file' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_links_out_upd AFTER UPDATE ON object_links
WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0'
 AND NEW.from_kind <> 'file' AND NEW.to_kind <> 'file' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_links_out_del AFTER DELETE ON object_links
WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0'
 AND OLD.from_kind <> 'file' AND OLD.to_kind <> 'file' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'object_links' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Le ménage des arêtes — le patron de la migration 020 § 8
-- ─────────────────────────────────────────────────────────────────────────────
-- Supprimer un fichier emporte ses arêtes des deux côtés, sur CHAQUE appareil.
--
-- ⚠️ Volontairement NON gardé par `applying` : quand la suppression du fichier
-- arrive de l'autre appareil, la cascade doit se produire ici aussi. C'est le
-- trigger d'OUTBOX qui est gardé, et lui seul.
CREATE TRIGGER files_links_del AFTER DELETE ON files BEGIN
  DELETE FROM object_links WHERE (from_kind = 'file' AND from_uid = OLD.uid) OR (to_kind = 'file' AND to_uid = OLD.uid);
END;
