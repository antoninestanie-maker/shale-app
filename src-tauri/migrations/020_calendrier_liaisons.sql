-- Socle du Calendrier et des Liaisons — 2026-09-02.
--
-- CE QUE CETTE MIGRATION INSTALLE, ET POUR QUI. Deux fonctionnalités arrivent
-- derrière elle : un calendrier (13ᵉ module) et un système de liaisons entre
-- objets, façon Capacities. Toutes deux ont besoin de schéma. Si chacune
-- écrivait le sien, elles écriraient deux fois la migration `020`, et le
-- conflit ne se verrait qu'à la fusion — quand les deux ont déjà tourné sur des
-- bases différentes. Ce fichier est donc leur socle COMMUN, écrit une fois.
--
-- CE QU'IL N'Y A PAS ICI. Aucune interface, aucune vue, aucun libellé affiché
-- (sauf les quatre types d'objets livrés, qui sont de la DONNÉE). Ce fichier
-- décrit un modèle et rien d'autre.
--
-- ⚠️ TROIS POINTS ONT ÉTÉ INSTRUITS AVANT D'ÊTRE ÉCRITS, et chacun a son
-- paragraphe plus bas, parce que se tromper sur l'un des trois produirait des
-- données silencieusement fausses sur le SECOND appareil, jamais sur celui où
-- on développe :
--   1. de quoi une arête tient ses extrémités (§ 5) — le plus dangereux ;
--   2. ce que devient une arête quand sa cible est supprimée (§ 8) ;
--   3. ce qui rend une arête unique (§ 5).
--
-- Le patron suivi de bout en bout est celui de `018_finance.sql` : colonne
-- `uid` + index unique, trigger d'identité de la bonne famille (015), triggers
-- d'outbox (016), et une ligne dans `TABLES_SYNC` (`src/lib/sync/scope.ts`).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Les tâches deviennent datables
-- ─────────────────────────────────────────────────────────────────────────────
-- CONSTAT. `tasks` n'avait AUCUNE date : `label`, `tag`, `priority`,
-- `recurrence`, `goal_id`, `created_at`. C'est précisément ce manque qui
-- empêchait tout calendrier — une tâche ne pouvait pas être « le mardi ».
--
-- Décision : une tâche reçoit une date, et OPTIONNELLEMENT un créneau horaire ;
-- à la création comme plus tard. Dès qu'elle a une date, elle est du ressort du
-- calendrier.
--
-- ⚠️ DEUX FAMILLES DE TÂCHES, ET ELLES NE SE MÉLANGENT PAS. `recurrence`
-- existait déjà et n'est PAS dupliquée ici :
--
--   • tâche DATÉE      → `due_date` renseignée, `recurrence = 'none'`.
--     Elle arrive une fois, à une date. Non faite, elle est EN RETARD, et le
--     calendrier la reporte (voir `postponed_count`).
--
--   • tâche RÉCURRENTE → `recurrence <> 'none'`, `due_date` NULLE.
--     Ses occurrences se CALCULENT, elles ne sont pas stockées. Une occurrence
--     manquée n'est pas en retard : elle est manquée, et elle ne se reporte
--     jamais. Reporter une habitude quotidienne au lendemain en ferait deux le
--     lendemain, ce qui est absurde et décourageant.
--
-- Rien n'INTERDIT en SQL de renseigner les deux (une contrainte CHECK aurait
-- fait échouer l'application d'une ligne distante écrite par une version plus
-- ancienne ou plus récente de l'app — la synchronisation s'arrêterait net).
-- C'est la couche TypeScript qui tient la règle, et un test qui la garde.
--
-- HEURE LOCALE, comme partout dans l'app (`localNow()`, la logique « jour »).
-- Le seul endroit en UTC reste `sync_outbox`, qui compare deux APPAREILS.
ALTER TABLE tasks ADD COLUMN due_date TEXT;         -- 'YYYY-MM-DD', local
ALTER TABLE tasks ADD COLUMN start_at TEXT;         -- 'HH:MM', début du créneau
ALTER TABLE tasks ADD COLUMN end_at   TEXT;         -- 'HH:MM', fin. NULL = pas de créneau, juste un jour

-- Combien de fois cette tâche a glissé au jour suivant sans être faite.
-- Au-delà du seuil (2, décidé par Antonin le 2026-09-02), l'app cesse de la
-- reporter en silence et demande une décision : la faire, la replanifier, ou
-- la supprimer. Une tâche reportée cinq fois n'est pas une tâche.
ALTER TABLE tasks ADD COLUMN postponed_count INTEGER NOT NULL DEFAULT 0;

-- La date à laquelle elle était prévue À L'ORIGINE, pour pouvoir dire
-- « prévue le 3, repoussée 5 fois » plutôt que le seul compteur, qui ne dit pas
-- depuis quand. Nulle tant que la tâche n'a jamais glissé.
ALTER TABLE tasks ADD COLUMN postponed_from TEXT;   -- 'YYYY-MM-DD'

-- Le calendrier interroge « les tâches du jour J » à chaque changement de vue.
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Les événements du calendrier
-- ─────────────────────────────────────────────────────────────────────────────
-- Un événement est ce qui n'est ni une tâche, ni un objectif : un rendez-vous,
-- un créneau bloqué, un anniversaire. Il ne se « fait » pas, il a lieu — c'est
-- exactement ce qui le distingue d'une tâche datée, et pourquoi il ne se
-- reporte pas.
--
-- `all_day` est DISTINCT de « start_at est nul », volontairement : une journée
-- entière déclarée comme telle et un événement dont on ignore l'heure ne
-- s'affichent pas pareil. Le premier occupe le bandeau du haut, le second
-- attend qu'on lui donne une heure.
--
-- `recurrence` reprend MOT POUR MOT le vocabulaire de `tasks.recurrence`
-- ('none' | 'daily' | 'weekdays' | JSON de jours) plutôt que d'inventer un
-- second dialecte. Deux grammaires de récurrence dans la même app, c'est deux
-- moteurs de projection à écrire, à tester et à garder d'accord.
--
-- `color` : un nom de token (`blue`, `green`, `red`, `yellow`, `violet`,
-- `indigo`), jamais une valeur hexadécimale. ⚠️ Un token inexistant échoue EN
-- SILENCE côté CSS (cf. CLAUDE.md) — la validation est côté TypeScript.
CREATE TABLE calendar_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  title      TEXT NOT NULL,
  body       TEXT,
  date       TEXT NOT NULL,                  -- 'YYYY-MM-DD', local
  start_at   TEXT,                           -- 'HH:MM'
  end_at     TEXT,                           -- 'HH:MM'
  all_day    INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0,1)),
  color      TEXT,
  recurrence TEXT NOT NULL DEFAULT 'none',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_calendar_events_date ON calendar_events(date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Les types d'objets
-- ─────────────────────────────────────────────────────────────────────────────
-- Décision d'Antonin : des types LIVRÉS D'ORIGINE, PLUS la création libre.
-- La « liste fermée » a été explicitement écartée.
--
-- ⚠️ `builtin` DIT D'OÙ VIENT LE TYPE, IL NE LE VERROUILLE PAS. Un type livré
-- reste modifiable et supprimable. Sans cette règle, on retomberait sur la
-- liste fermée qui a été écartée — avec l'illusion du choix en plus.
--
-- `fields` est le SCHÉMA des champs, en JSON :
--   [{ "id": "f1", "name": "Rôle", "type": "text", "required": 0 }]
-- Types de champ : 'text' | 'number' | 'date' | 'link' | 'choice'
-- ('choice' porte en plus `options: string[]`).
--
-- ⭐ CHAQUE CHAMP A UN `id` STABLE, et les valeurs des objets sont rangées SOUS
-- CET ID, jamais sous le nom. Renommer « Rôle » en « Fonction » ne doit pas
-- effacer ce que trois cents fiches contiennent — or c'est exactement ce que
-- ferait un dictionnaire indexé par le nom, et sans le moindre message.
CREATE TABLE object_types (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  name       TEXT NOT NULL,
  icon       TEXT,                            -- nom d'icône de `src/components/icons.tsx`
  color      TEXT,                            -- nom de token
  fields     TEXT NOT NULL DEFAULT '[]',      -- JSON, voir ci-dessus
  builtin    INTEGER NOT NULL DEFAULT 0 CHECK (builtin IN (0,1)),
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_object_types_position ON object_types(position);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Les objets
-- ─────────────────────────────────────────────────────────────────────────────
-- `body` est du HTML riche, comme les fiches du Savoir : c'est le même éditeur
-- (`RichNoteEditor`), donc le même format, et les mentions `@` du chantier C y
-- vivront comme dans une note.
--
-- ⚠️ LA COLONNE S'APPELLE `field_values`, PAS `values`. `VALUES` est un mot-clé
-- SQL : la colonne aurait dû être échappée dans chacune des requêtes de
-- `repo.ts`, et le premier oubli aurait produit une erreur de syntaxe à
-- l'exécution — donc en production, pas à la compilation.
--
-- `field_values` est un dictionnaire JSON indexé par l'`id` du champ :
--   { "f1": "Développeur", "f3": "2026-04-12" }
--
-- ⭐ UNE VALEUR DONT LE CHAMP A ÉTÉ RETIRÉ DU TYPE EST CONSERVÉE ICI. Elle
-- cesse d'être affichée, elle n'est pas effacée. Retirer un champ est un geste
-- d'une seconde ; il ne doit pas détruire en silence ce que des centaines de
-- fiches portent. Si le champ est remis, les valeurs réapparaissent. C'est la
-- couche TypeScript (`src/lib/objets.ts`) qui tient cette promesse, et un test
-- qui la garde.
CREATE TABLE objects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  uid          TEXT,
  type_id      INTEGER NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT,                          -- HTML riche
  field_values TEXT NOT NULL DEFAULT '{}',    -- JSON { "<id de champ>": valeur }
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (type_id) REFERENCES object_types(id)
);

CREATE INDEX idx_objects_type ON objects(type_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) ⭐ Les liaisons — le point le plus dangereux de cette migration
-- ─────────────────────────────────────────────────────────────────────────────
-- Une arête générique entre deux objets de l'app, valable pour tous les
-- modules. C'est ce qui permet de lier une note à une fiche du Savoir, une
-- tâche à un objet « Personne », un événement à un objectif.
--
-- ⚠️ POINT INSTRUIT N°1 — DE QUOI L'ARÊTE TIENT SES EXTRÉMITÉS.
--
-- La rédaction naturelle serait `from_id INTEGER` / `to_id INTEGER`. Elle est
-- FAUSSE ici, et le dépôt sait exactement pourquoi :
--
--   • Un `id` est LOCAL. Sur le second appareil, la note n°7 est une autre
--     note. Une arête qui voyagerait avec des `id` ne serait pas cassée à
--     l'arrivée — elle pointerait vers AUTRE CHOSE, sans erreur ni alerte.
--     C'est le dégât que `src/lib/sync/fk.ts` existe pour empêcher.
--
--   • La traduction de `fk.ts` ne peut PAS s'appliquer ici : elle associe une
--     colonne à UNE table fixe (`goal_id` → `goals`). Nos extrémités sont
--     POLYMORPHES — c'est `from_kind` qui dit vers quelle table on pointe.
--     Il n'existe aucun `vers` honnête à déclarer.
--
--   • Et le test « TOUTE colonne en `_id` est traduite » (`fk.test.ts`) le dit
--     déjà : une colonne `from_id` ferait échouer la suite tant que personne
--     n'aurait tranché. Le garde-fou a fait son travail avant même d'exister
--     pour ce cas.
--
-- DÉCISION : l'arête stocke directement les `uid` de ses deux extrémités
-- (`from_uid`, `to_uid`), en TEXT. Ils ont le même sens sur tous les appareils,
-- ils voyagent tels quels, et il n'y a rien à traduire. Le prix est un `JOIN`
-- sur `uid` plutôt que sur `id` pour relire une arête ; chaque table
-- synchronisée porte un INDEX UNIQUE sur `uid` (migration 015), donc ce join
-- coûte le même prix qu'un join sur la clé primaire.
--
-- ⭐ `from_uid` et `to_uid` sont NOT NULL, et ce n'est pas de la coquetterie :
-- c'est ce qui transforme une corruption SILENCIEUSE en échec bruyant. Le
-- moteur écartait autrefois toute colonne finissant par `_uid` à l'application
-- d'une ligne distante ; sans ce NOT NULL, les arêtes seraient arrivées avec
-- leurs deux extrémités vides, sans erreur ni alerte. Avec lui, l'écriture
-- refuse, le test le voit, et le défaut se corrige au lieu de dormir.
--
-- ⚠️ Conséquence à connaître : ces colonnes ne sont PAS des clés étrangères
-- SQL, et ne peuvent pas l'être (SQLite ne sait pas référencer une table
-- choisie par une autre colonne). L'intégrité est donc tenue par le § 8
-- ci-dessous et par la lecture, pas par le moteur.
--
-- ⚠️ POINT INSTRUIT N°3 — CE QUI REND UNE ARÊTE UNIQUE.
-- Deux mentions de la même note dans le même texte ne font qu'UNE arête : le
-- panneau « Mentionné dans » afficherait sinon deux fois la même ligne.
-- L'unicité porte sur les quatre colonnes de l'arête, et JAMAIS sur `origin` —
-- sans quoi rattacher à la main une note déjà mentionnée créerait un doublon
-- que l'interface ne saurait pas expliquer. Quand les deux origines se
-- rencontrent, le LWW en garde une ; laquelle est sans importance, l'arête
-- existe et c'est tout ce que l'utilisateur voit.
CREATE TABLE object_links (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  uid        TEXT,
  from_kind  TEXT NOT NULL CHECK (from_kind IN ('note','knowledge','task','goal','event','trade','object')),
  from_uid   TEXT NOT NULL,
  to_kind    TEXT NOT NULL CHECK (to_kind   IN ('note','knowledge','task','goal','event','trade','object')),
  to_uid     TEXT NOT NULL,
  origin     TEXT NOT NULL DEFAULT 'mention' CHECK (origin IN ('mention','manual')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_object_links_arete ON object_links(from_kind, from_uid, to_kind, to_uid);

-- Les deux sens de lecture, et ils ne se valent pas :
--   • `source` sert la vue « ce que CE texte mentionne » ;
--   • `cible`  sert les BACKLINKS — « qui parle de moi ». C'est la moitié qui
--     donne sa valeur au système, et la seule qui n'ait pas d'autre chemin
--     d'accès : sans cet index, chaque ouverture de note balaierait toute la
--     table.
CREATE INDEX idx_object_links_source ON object_links(from_kind, from_uid);
CREATE INDEX idx_object_links_cible  ON object_links(to_kind,   to_uid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6) Les quatre types d'objets livrés
-- ─────────────────────────────────────────────────────────────────────────────
-- Une galerie de types vide est inutilisable, comme l'était un module financier
-- sans catégories (migration 018, § 7). Ces quatre-là couvrent ce qu'Antonin a
-- décrit, avec des champs qui ont du sens — pas des coquilles vides.
--
-- Ils restent MODIFIABLES ET SUPPRIMABLES (cf. § 3).
--
-- Les noms et les libellés de champs sont en FRANÇAIS, conformément à la
-- convention i18n du projet : la clé de traduction EST la phrase française.
-- L'interface les passera par `t()` à l'affichage ; un type renommé par
-- l'utilisateur retombera simplement sur lui-même, ce qui est le comportement
-- voulu.
--
-- Leur uid est posé par le trigger du § 7, DÉRIVÉ DU NOM : ces lignes sont
-- insérées à la création de la base, donc SUR CHAQUE APPAREIL. Avec un uid
-- aléatoire, le second appareil synchronisé se retrouverait avec deux
-- « Personne », deux « Projet », et personne pour dire laquelle est la bonne.
INSERT INTO object_types (name, icon, color, builtin, position, fields) VALUES
  ('Personne', 'user', 'blue', 1, 1,
   '[{"id":"f1","name":"Rôle","type":"text","required":0},' ||
    '{"id":"f2","name":"Rencontré le","type":"date","required":0},' ||
    '{"id":"f3","name":"Contact","type":"text","required":0}]'),

  ('Ressource', 'book', 'violet', 1, 2,
   '[{"id":"f1","name":"Support","type":"choice","required":1,"options":["Livre","Vidéo","Article","Podcast"]},' ||
    '{"id":"f2","name":"Auteur","type":"text","required":0},' ||
    '{"id":"f3","name":"Lien","type":"link","required":0},' ||
    '{"id":"f4","name":"Terminé le","type":"date","required":0}]'),

  ('Projet', 'target', 'green', 1, 3,
   '[{"id":"f1","name":"Statut","type":"choice","required":1,"options":["En cours","En pause","Terminé","Abandonné"]},' ||
    '{"id":"f2","name":"Échéance","type":"date","required":0},' ||
    '{"id":"f3","name":"Prochaine action","type":"text","required":0}]'),

  ('Setup de trading', 'chart', 'yellow', 1, 4,
   '[{"id":"f1","name":"Paire","type":"text","required":0},' ||
    '{"id":"f2","name":"Biais","type":"choice","required":1,"options":["Long","Short","Neutre"]},' ||
    '{"id":"f3","name":"Règle d''entrée","type":"text","required":0},' ||
    '{"id":"f4","name":"R visé","type":"number","required":0}]');

-- ─────────────────────────────────────────────────────────────────────────────
-- 7) Identité globale (patron de la migration 015)
-- ─────────────────────────────────────────────────────────────────────────────
-- Les quatre types livrés viennent d'être insérés SANS uid (la table n'avait
-- pas encore son trigger) : on les rattrape ici, avec la dérivation que le
-- trigger appliquera ensuite. Même geste qu'au § 8 de la migration 018.
UPDATE object_types SET uid = 'ot:' || name WHERE uid IS NULL;

CREATE UNIQUE INDEX idx_calendar_events_uid ON calendar_events(uid);
CREATE UNIQUE INDEX idx_object_types_uid    ON object_types(uid);
CREATE UNIQUE INDEX idx_objects_uid         ON objects(uid);
CREATE UNIQUE INDEX idx_object_links_uid    ON object_links(uid);

-- IDENTITÉ ARBITRAIRE → uid aléatoire (UUID v4).
-- Deux appareils qui créent chacun un événement créent bien deux événements ;
-- c'est le comportement voulu.
-- ⚠️ `abs(random() % 4)` et jamais `abs(random()) % 4` (piège n°3, CLAUDE.md).
CREATE TRIGGER calendar_events_uid AFTER INSERT ON calendar_events WHEN NEW.uid IS NULL BEGIN
  UPDATE calendar_events SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER objects_uid AFTER INSERT ON objects WHEN NEW.uid IS NULL BEGIN
  UPDATE objects SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;

-- CLÉ NATURELLE → uid DÉRIVÉ, identique sur tous les appareils sans qu'ils
-- aient eu à se parler.
--
-- `object_types` : dérivé du NOM, exactement comme `finance_categories`
-- (migration 018) et pour la même raison — les types livrés naissent sur chaque
-- appareil. Comme pour les catégories, pas de contrainte d'unicité sur `name` :
-- renommer un type ne change PAS son uid (le trigger ne se déclenche que sur un
-- uid nul), et deux types homonymes sont une gêne cosmétique, là où une
-- contrainte violée à l'application d'une ligne distante casserait la
-- synchronisation.
CREATE TRIGGER object_types_uid AFTER INSERT ON object_types WHEN NEW.uid IS NULL BEGIN
  UPDATE object_types SET uid = 'ot:' || NEW.name WHERE id = NEW.id;
END;

-- `object_links` : l'arête EST sa clé naturelle. Deux appareils qui écrivent la
-- même mention calculent le même uid, donc une seule ligne côté serveur, et le
-- conflit se résout tout seul par LWW. Avec un uid aléatoire, la même mention
-- tapée des deux côtés produirait deux lignes serveur pour un seul fait, qui se
-- battraient indéfiniment sans converger.
--
-- ⚠️ `origin` n'entre PAS dans la dérivation, pour la même raison qu'il n'entre
-- pas dans l'index unique (§ 5).
CREATE TRIGGER object_links_uid AFTER INSERT ON object_links WHEN NEW.uid IS NULL BEGIN
  UPDATE object_links
     SET uid = 'ol:' || NEW.from_kind || ':' || NEW.from_uid || ':' || NEW.to_kind || ':' || NEW.to_uid
   WHERE id = NEW.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8) ⚠️ POINT INSTRUIT N°2 — ce que devient une arête quand sa cible disparaît
-- ─────────────────────────────────────────────────────────────────────────────
-- LE RISQUE. Une note effacée sur le Mac laisserait, sur l'iPhone, un backlink
-- « Mentionné dans » qui pointe vers rien. Pire : l'arête resterait dans la
-- table pour toujours, puisque aucune clé étrangère SQL ne la surveille (§ 5).
--
-- LA PARADE, EN DEUX TEMPS, parce qu'aucun des deux ne suffit seul :
--
--   a) CES TRIGGERS effacent les arêtes des deux côtés dès que l'objet est
--      supprimé. La suppression de l'arête est alors journalisée comme
--      n'importe quelle autre (§ 9), donc elle voyage : l'autre appareil reçoit
--      une vraie pierre tombale, pas un silence.
--
--      ⚠️ Ces triggers ne sont VOLONTAIREMENT PAS gardés par `applying` :
--      quand l'autre appareil nous envoie la suppression de la note, la cascade
--      doit se produire ICI AUSSI. C'est le trigger d'OUTBOX qui est gardé, et
--      lui seul — les deux appareils font donc le même ménage, chacun chez soi,
--      sans se renvoyer l'écho de l'autre.
--
--   b) LA LECTURE ne rend jamais une arête dont l'extrémité ne se résout pas
--      (`src/lib/liens.ts`). Indispensable malgré (a), parce que l'ordre
--      d'arrivée n'est pas garanti : une arête peut être appliquée AVANT
--      l'objet qu'elle cite. Elle est alors conservée — et non mise en
--      quarantaine — puis devient visible d'elle-même quand sa cible arrive.
--
-- LIMITE ASSUMÉE, à connaître plutôt qu'à découvrir : une arête dont la cible a
-- été supprimée sur un appareil resté longtemps hors ligne peut survivre sans
-- jamais se résoudre. Elle est invisible (b) et pèse une centaine d'octets. Un
-- ramassage périodique serait du zèle ; il n'y en a pas.
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
CREATE TRIGGER objects_links_del AFTER DELETE ON objects BEGIN
  DELETE FROM object_links WHERE (from_kind = 'object' AND from_uid = OLD.uid) OR (to_kind = 'object' AND to_uid = OLD.uid);
END;

-- Supprimer un TYPE d'objet supprime ses objets, qui à leur tour emportent
-- leurs arêtes par le trigger ci-dessus. Sans cette cascade, les fiches
-- resteraient en base sans type, donc sans champs et sans écran pour les
-- afficher : invisibles, mais toujours là. Le geste « supprimer le type
-- Personne » doit être complet ou ne pas exister.
CREATE TRIGGER object_types_objects_del AFTER DELETE ON object_types BEGIN
  DELETE FROM objects WHERE type_id = OLD.id;
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9) Journalisation pour la synchronisation (patron de la migration 016)
-- ─────────────────────────────────────────────────────────────────────────────
-- Trois triggers par table synchronisée, gardés par `applying` : rien n'est
-- journalisé pendant qu'on applique des changements VENUS du cloud, sinon
-- chaque synchronisation en déclencherait une autre, indéfiniment.
--
-- Rappel du piège n°1 (016) : `NEW.uid` peut être NULL dans le trigger de
-- CRÉATION — SQLite ne garantit aucun ordre entre deux `AFTER INSERT` sur la
-- même table. C'est sans gravité : le `row_id` suffit à relire la ligne, et
-- l'écriture de l'uid déclenche le trigger de modification, qui ré-enregistre
-- l'entrée complète.

-- calendar_events
CREATE TRIGGER calendar_events_out_ins AFTER INSERT ON calendar_events WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('calendar_events', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER calendar_events_out_upd AFTER UPDATE ON calendar_events WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('calendar_events', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER calendar_events_out_del AFTER DELETE ON calendar_events WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'calendar_events' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('calendar_events', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- object_types
CREATE TRIGGER object_types_out_ins AFTER INSERT ON object_types WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_types', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_types_out_upd AFTER UPDATE ON object_types WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_types', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_types_out_del AFTER DELETE ON object_types WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'object_types' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_types', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- objects
CREATE TRIGGER objects_out_ins AFTER INSERT ON objects WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('objects', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER objects_out_upd AFTER UPDATE ON objects WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('objects', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER objects_out_del AFTER DELETE ON objects WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'objects' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('objects', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;

-- object_links
CREATE TRIGGER object_links_out_ins AFTER INSERT ON object_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_links_out_upd AFTER UPDATE ON object_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NEW.id, NEW.uid, 'upsert', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
CREATE TRIGGER object_links_out_del AFTER DELETE ON object_links WHEN (SELECT v FROM sync_meta WHERE k = 'applying') = '0' BEGIN
  DELETE FROM sync_outbox WHERE table_name = 'object_links' AND row_id = OLD.id;
  INSERT INTO sync_outbox (table_name, row_id, uid, op, ts) VALUES ('object_links', NULL, OLD.uid, 'delete', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
END;
