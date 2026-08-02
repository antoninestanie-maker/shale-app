-- Identité globale des lignes — socle de la synchronisation multi-appareils.
--
-- LE PROBLÈME. Toutes les tables sont en `INTEGER PRIMARY KEY AUTOINCREMENT`.
-- Deux appareils créeront chacun une tâche `id = 42` sans le moindre rapport
-- l'une avec l'autre. Aucun moteur de sync ne peut travailler là-dessus : il
-- faut d'abord que chaque LIGNE porte un identifiant qui ait le même sens
-- partout.
--
-- CE QU'ON NE FAIT PAS. Migrer les clés primaires en TEXT. Ce serait la
-- solution « propre » sur le papier, mais elle casserait `notes_fts`
-- (`content_rowid = 'id'` exige un entier), les ~40 requêtes de `repo.ts` et
-- toutes les clés étrangères. Disproportionné.
--
-- CE QU'ON FAIT. Une colonne `uid TEXT` en plus, avec index unique. Les `id`
-- locaux et les clés étrangères existantes ne bougent pas d'un octet : le code
-- de l'app continue de tourner exactement comme avant, et la couche de sync
-- travaille sur `uid`.
--
-- DEUX FAMILLES DE TABLES, DEUX STRATÉGIES.
--
--   • Tables à identité arbitraire (une tâche, une note, un trade) :
--     `uid` ALÉATOIRE (UUID v4). Deux appareils qui créent chacun une note
--     créent bien deux notes distinctes — c'est le comportement voulu.
--
--   • Tables à CLÉ NATURELLE (« l'habitude X le jour J », « le journal du
--     jour J ») : `uid` DÉRIVÉ de cette clé. Les deux appareils calculent
--     alors le MÊME uid sans s'être parlé, donc la même ligne logique n'existe
--     qu'en un exemplaire côté serveur et le conflit se résout tout seul par
--     LWW. Avec un uid aléatoire, on obtiendrait deux lignes serveur pour un
--     seul fait, qui se battraient indéfiniment sans jamais converger.
--     Le uid dérivé référence le `uid` du PARENT, jamais son `id` local (qui
--     n'a aucun sens sur l'autre appareil).
--
-- ⚠️ L'uid dérivé contient du contenu utilisateur en clair (`tg:silver-bullet`
-- révélerait le nom d'un tag). Il ne QUITTE JAMAIS la machine tel quel : ce qui
-- part sur le réseau est `HMAC(clé dérivée, uid)` — déterministe entre les
-- appareils, opaque pour le serveur. Voir la couche de chiffrement (étape 3).
--
-- GÉNÉRATION. Par triggers `AFTER INSERT ... WHEN NEW.uid IS NULL`, et non
-- dans `repo.ts` : aucun des ~60 points d'écriture n'a à être modifié, et une
-- écriture ajoutée dans six mois recevra son uid sans que personne y pense.
--
-- TABLES VOLONTAIREMENT LAISSÉES DE CÔTÉ (aucun uid, jamais synchronisées) :
--   `goal_progress_log` — recalculé à chaque lancement par `snapshotGoals()`.
--   `market_briefings`  — régénérable, purgé à 7 jours, gros payloads JSON.
--   `notes_fts`         — index dérivé de `notes`, reconstruit par ses triggers.
--   `settings`          — sa clé primaire est déjà du TEXT globalement valable :
--                         elle sert d'uid telle quelle, sans colonne en plus.
--                         (Toutes les clés ne sont pas synchronisées pour
--                         autant — voir l'allowlist côté TypeScript.)

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Colonnes
-- ─────────────────────────────────────────────────────────────────────────────
-- `ALTER TABLE ADD COLUMN` n'accepte ni NOT NULL sans défaut constant ni UNIQUE :
-- la colonne naît donc nullable, elle est remplie juste après, et c'est l'index
-- unique + les triggers qui tiennent l'invariant ensuite.

ALTER TABLE tasks                      ADD COLUMN uid TEXT;
ALTER TABLE goals                      ADD COLUMN uid TEXT;
ALTER TABLE habits                     ADD COLUMN uid TEXT;
ALTER TABLE custom_metrics             ADD COLUMN uid TEXT;
ALTER TABLE quick_links                ADD COLUMN uid TEXT;
ALTER TABLE focus_sessions             ADD COLUMN uid TEXT;
ALTER TABLE notes                      ADD COLUMN uid TEXT;
ALTER TABLE trades                     ADD COLUMN uid TEXT;
ALTER TABLE live_positions             ADD COLUMN uid TEXT;
ALTER TABLE position_size_calculations ADD COLUMN uid TEXT;
ALTER TABLE benchmark_results          ADD COLUMN uid TEXT;
ALTER TABLE knowledge_topics           ADD COLUMN uid TEXT;
ALTER TABLE knowledge_entries          ADD COLUMN uid TEXT;

ALTER TABLE tags                       ADD COLUMN uid TEXT;
ALTER TABLE task_completions           ADD COLUMN uid TEXT;
ALTER TABLE habit_checks               ADD COLUMN uid TEXT;
ALTER TABLE metric_entries             ADD COLUMN uid TEXT;
ALTER TABLE journal_entries            ADD COLUMN uid TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Remplissage des lignes déjà en base
-- ─────────────────────────────────────────────────────────────────────────────
-- UUID v4 en SQL pur : `randomblob()` est ré-évalué à CHAQUE ligne (fonction
-- non déterministe), donc un seul UPDATE suffit à donner un uid distinct à
-- tout le monde. Le `4` et le caractère de variante ('8','9','a','b') sont
-- posés en dur pour produire un v4 conforme.
--
-- ⚠️ `abs(random() % 4)` et non `abs(random()) % 4` : `random()` peut renvoyer
-- -9223372036854775808, dont la valeur absolue déborde l'entier signé 64 bits
-- et fait échouer la requête. Le modulo d'abord, la valeur absolue ensuite.

UPDATE tasks                      SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE goals                      SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE habits                     SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE custom_metrics             SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE quick_links                SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE focus_sessions             SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE notes                      SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE trades                     SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE live_positions             SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE position_size_calculations SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE benchmark_results          SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE knowledge_topics           SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;
UPDATE knowledge_entries          SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE uid IS NULL;

-- Clés naturelles. L'ORDRE COMPTE : les tables filles lisent le `uid` de leur
-- parent, qui vient d'être rempli juste au-dessus.
--
-- Le `COALESCE(..., 'orphan-' || <id>)` couvre une ligne fille dont le parent
-- aurait disparu (incohérence héritée). Mieux vaut un uid laid mais unique
-- qu'un uid NULL qui ferait échouer l'index unique et donc la migration
-- entière — c'est-à-dire l'app qui ne démarre plus.

UPDATE tags               SET uid = 'tg:' || name WHERE uid IS NULL;
UPDATE journal_entries    SET uid = 'je:' || date WHERE uid IS NULL;
UPDATE task_completions   SET uid = 'tc:' || COALESCE((SELECT t.uid FROM tasks t           WHERE t.id = task_completions.task_id),  'orphan-' || task_id)   || ':' || date WHERE uid IS NULL;
UPDATE habit_checks       SET uid = 'hc:' || COALESCE((SELECT h.uid FROM habits h          WHERE h.id = habit_checks.habit_id),     'orphan-' || habit_id)  || ':' || date WHERE uid IS NULL;
UPDATE metric_entries     SET uid = 'me:' || COALESCE((SELECT m.uid FROM custom_metrics m  WHERE m.id = metric_entries.metric_id),  'orphan-' || metric_id) || ':' || date WHERE uid IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Index uniques
-- ─────────────────────────────────────────────────────────────────────────────
-- C'est l'index qui garantit l'invariant « un uid = une ligne » ; si un jour un
-- trigger produisait un doublon, l'écriture échouerait bruyamment ici plutôt
-- que de créer une divergence silencieuse entre appareils.

CREATE UNIQUE INDEX idx_tasks_uid                      ON tasks(uid);
CREATE UNIQUE INDEX idx_goals_uid                      ON goals(uid);
CREATE UNIQUE INDEX idx_habits_uid                     ON habits(uid);
CREATE UNIQUE INDEX idx_custom_metrics_uid             ON custom_metrics(uid);
CREATE UNIQUE INDEX idx_quick_links_uid                ON quick_links(uid);
CREATE UNIQUE INDEX idx_focus_sessions_uid             ON focus_sessions(uid);
CREATE UNIQUE INDEX idx_notes_uid                      ON notes(uid);
CREATE UNIQUE INDEX idx_trades_uid                     ON trades(uid);
CREATE UNIQUE INDEX idx_live_positions_uid             ON live_positions(uid);
CREATE UNIQUE INDEX idx_position_size_calculations_uid ON position_size_calculations(uid);
CREATE UNIQUE INDEX idx_benchmark_results_uid          ON benchmark_results(uid);
CREATE UNIQUE INDEX idx_knowledge_topics_uid           ON knowledge_topics(uid);
CREATE UNIQUE INDEX idx_knowledge_entries_uid          ON knowledge_entries(uid);
CREATE UNIQUE INDEX idx_tags_uid                       ON tags(uid);
CREATE UNIQUE INDEX idx_task_completions_uid           ON task_completions(uid);
CREATE UNIQUE INDEX idx_habit_checks_uid               ON habit_checks(uid);
CREATE UNIQUE INDEX idx_metric_entries_uid             ON metric_entries(uid);
CREATE UNIQUE INDEX idx_journal_entries_uid            ON journal_entries(uid);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) Génération automatique à l'insertion
-- ─────────────────────────────────────────────────────────────────────────────
-- `WHEN NEW.uid IS NULL` : le trigger ne se déclenche que si personne n'a fourni
-- d'uid. C'est indispensable — quand la couche de sync insérera une ligne venue
-- d'un autre appareil, elle fournira l'uid d'origine, qui doit être conservé tel
-- quel. Sans cette garde, chaque appareil réinventerait un uid à la réception et
-- la même note se dupliquerait à l'infini.
--
-- Le trigger fait un UPDATE juste après l'INSERT. Conséquence à connaître pour
-- l'étape suivante : le journal de changements verra un INSERT puis un UPDATE
-- sur la même ligne. C'est sans effet, la file d'attente ne garde qu'une entrée
-- par ligne (la plus récente écrase la précédente).

CREATE TRIGGER tasks_uid AFTER INSERT ON tasks WHEN NEW.uid IS NULL BEGIN
  UPDATE tasks SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER goals_uid AFTER INSERT ON goals WHEN NEW.uid IS NULL BEGIN
  UPDATE goals SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER habits_uid AFTER INSERT ON habits WHEN NEW.uid IS NULL BEGIN
  UPDATE habits SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER custom_metrics_uid AFTER INSERT ON custom_metrics WHEN NEW.uid IS NULL BEGIN
  UPDATE custom_metrics SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER quick_links_uid AFTER INSERT ON quick_links WHEN NEW.uid IS NULL BEGIN
  UPDATE quick_links SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER focus_sessions_uid AFTER INSERT ON focus_sessions WHEN NEW.uid IS NULL BEGIN
  UPDATE focus_sessions SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER notes_uid AFTER INSERT ON notes WHEN NEW.uid IS NULL BEGIN
  UPDATE notes SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER trades_uid AFTER INSERT ON trades WHEN NEW.uid IS NULL BEGIN
  UPDATE trades SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER live_positions_uid AFTER INSERT ON live_positions WHEN NEW.uid IS NULL BEGIN
  UPDATE live_positions SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER position_size_calculations_uid AFTER INSERT ON position_size_calculations WHEN NEW.uid IS NULL BEGIN
  UPDATE position_size_calculations SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER benchmark_results_uid AFTER INSERT ON benchmark_results WHEN NEW.uid IS NULL BEGIN
  UPDATE benchmark_results SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER knowledge_topics_uid AFTER INSERT ON knowledge_topics WHEN NEW.uid IS NULL BEGIN
  UPDATE knowledge_topics SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;
CREATE TRIGGER knowledge_entries_uid AFTER INSERT ON knowledge_entries WHEN NEW.uid IS NULL BEGIN
  UPDATE knowledge_entries SET uid = lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-' || substr('89ab', abs(random() % 4) + 1, 1) || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))) WHERE id = NEW.id;
END;

-- Clés naturelles : uid DÉRIVÉ, donc identique sur tous les appareils.
--
-- Une remarque sur `tags` : le nom d'un tag est déjà son identité réelle dans
-- l'app — `tasks.tag` stocke le NOM, pas l'id, et `addTag` fait un upsert sur
-- `name`. Dériver l'uid du nom ne fait donc qu'entériner ce qui existe.

-- ─────────────────────────────────────────────────────────────────────────────
-- 4 bis) Cohabitation avec l'index plein texte des notes
-- ─────────────────────────────────────────────────────────────────────────────
-- `notes_fts` est une table FTS5 à CONTENU EXTERNE : elle ne stocke pas le
-- texte, elle pointe vers `notes` par rowid. Son trigger de mise à jour
-- (migration 005) retire l'ancienne version de l'index puis réinsère la
-- nouvelle — et il se déclenchait sur N'IMPORTE QUEL `UPDATE` de `notes`, y
-- compris celui, purement technique, qui pose le `uid` ci-dessus.
--
-- Or SQLite ne garantit AUCUN ordre entre deux triggers `AFTER INSERT` sur la
-- même table. Quand `notes_uid` passe avant `notes_ai`, le `UPDATE` de l'uid
-- demande à FTS5 de retirer une ligne qui n'a pas encore été indexée : sur une
-- table à contenu externe, cette suppression fantôme corrompt l'index, et la
-- moindre insertion de note échoue ensuite sur « database disk image is
-- malformed ». Reproduit en test, pas supposé.
--
-- Correctif : restreindre le trigger aux colonnes qu'il indexe réellement.
-- `AFTER UPDATE OF title, body` ne se déclenche que si l'une des deux figure
-- dans le SET — l'écriture de l'uid devient donc invisible pour l'index, et
-- l'ordre des triggers n'a plus d'importance. C'est aussi correct sur le fond :
-- réindexer une note parce qu'une colonne étrangère a bougé n'a jamais eu de
-- sens.

DROP TRIGGER notes_au;
CREATE TRIGGER notes_au AFTER UPDATE OF title, body ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, body) VALUES ('delete', old.id, old.title, old.body);
  INSERT INTO notes_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER tags_uid AFTER INSERT ON tags WHEN NEW.uid IS NULL BEGIN
  UPDATE tags SET uid = 'tg:' || NEW.name WHERE id = NEW.id;
END;
CREATE TRIGGER journal_entries_uid AFTER INSERT ON journal_entries WHEN NEW.uid IS NULL BEGIN
  UPDATE journal_entries SET uid = 'je:' || NEW.date WHERE id = NEW.id;
END;
CREATE TRIGGER task_completions_uid AFTER INSERT ON task_completions WHEN NEW.uid IS NULL BEGIN
  UPDATE task_completions
     SET uid = 'tc:' || COALESCE((SELECT t.uid FROM tasks t WHERE t.id = NEW.task_id), 'orphan-' || NEW.task_id) || ':' || NEW.date
   WHERE id = NEW.id;
END;
CREATE TRIGGER habit_checks_uid AFTER INSERT ON habit_checks WHEN NEW.uid IS NULL BEGIN
  UPDATE habit_checks
     SET uid = 'hc:' || COALESCE((SELECT h.uid FROM habits h WHERE h.id = NEW.habit_id), 'orphan-' || NEW.habit_id) || ':' || NEW.date
   WHERE id = NEW.id;
END;
CREATE TRIGGER metric_entries_uid AFTER INSERT ON metric_entries WHEN NEW.uid IS NULL BEGIN
  UPDATE metric_entries
     SET uid = 'me:' || COALESCE((SELECT m.uid FROM custom_metrics m WHERE m.id = NEW.metric_id), 'orphan-' || NEW.metric_id) || ':' || NEW.date
   WHERE id = NEW.id;
END;
