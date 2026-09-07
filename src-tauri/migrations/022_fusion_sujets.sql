-- ─────────────────────────────────────────────────────────────────────────────
-- 022 — Les thèmes et les objets n'en font plus qu'un : le SUJET
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Décision d'Antonin, 2026-09-07. Le module Savoir avait DEUX moitiés, et elles
-- étaient exactement complémentaires — c'est-à-dire que chacune manquait de ce
-- que l'autre avait :
--
--                          thème        objet
--   contient des fiches      oui         non
--   se cite avec `@`         non         oui
--   a une page, des champs   non         oui
--   se crée en tapant un nom oui         non   (il fallait choisir un type)
--
-- Le constat qui a tranché : sur la vraie base, cinq jours après la livraison
-- des objets, il y avait **4 thèmes utilisés et 0 objet**. Le thème est employé
-- parce qu'il est gratuit ; l'objet ne l'est pas parce qu'il fait payer son
-- entrée avant de rendre le moindre service, et qu'en plus il ne peut pas
-- contenir de fiches.
--
-- Après cette migration il n'y a plus qu'un « sujet » : il range des fiches, il
-- se cite avec `@`, il a une page et — FACULTATIVEMENT — un type qui lui donne
-- des champs.
--
-- ⚠️⚠️ POURQUOI LA TABLE S'APPELLE ENCORE `knowledge_topics`
--
-- C'est la fusion des thèmes DANS les objets qui aurait été la rédaction
-- naturelle. Elle a été écartée sur une raison de sécurité, pas de goût :
--
--   • `objects.type_id` est `NOT NULL`. Le rendre nullable impose de RECRÉER la
--     table (SQLite ne sait pas modifier une colonne).
--   • `knowledge_entries.topic_id` déclare `REFERENCES knowledge_topics(id)`.
--     Faire pointer les fiches vers `objects` impose de recréer AUSSI
--     `knowledge_entries` — la table qui porte les vraies notes d'Antonin, avec
--     leurs images en base64.
--
-- Deux recréations de table, dont une sur les seules données qui comptent, pour
-- déplacer 0 ligne. Le sens inverse — les objets rejoignent les thèmes — se
-- fait entièrement en `ALTER TABLE ADD COLUMN`, ne touche pas une seule ligne
-- de `knowledge_entries`, et laisse sa clé étrangère intacte.
--
-- ▶️ Donc : le NOM PHYSIQUE de la table reste `knowledge_topics`, et ce qu'elle
-- contient s'appelle un SUJET. Renommer la table changerait son empreinte de
-- synchronisation (le `table_tag` est un HMAC du nom), donc republierait les
-- quatre lignes réelles sous une autre identité — un coût réel pour un gain
-- cosmétique. Le code TypeScript, lui, dit `Sujet` partout.
--
-- ⚠️ AUCUNE RECRÉATION DE TABLE DANS CE FICHIER. C'est le point à préserver si
-- quelqu'un reprend cette migration : chaque `ADD COLUMN` est réversible dans sa
-- tête, une recréation ne l'est pas.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Le thème gagne ce que l'objet savait faire
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ `ADD COLUMN` avec une clause `REFERENCES` n'est accepté par SQLite que si
-- le défaut de la colonne est NULL — c'est le cas ici (défaut implicite). Un
-- `NOT NULL` y serait refusé, comme le rappelle le piège n°2 de `CLAUDE.md`.
ALTER TABLE knowledge_topics ADD COLUMN type_id INTEGER REFERENCES object_types(id);

-- La page du sujet : du HTML riche, même format que le corps d'une fiche, donc
-- les mentions `@` du chantier C y vivent telles quelles.
ALTER TABLE knowledge_topics ADD COLUMN body TEXT;

-- Les valeurs de champs, indexées par l'`id` DU CHAMP et jamais par son nom.
-- ⭐ Une valeur dont le champ a été retiré du type est CONSERVÉE ici : elle
-- cesse d'être affichée, elle n'est pas effacée (`src/lib/objets.ts`).
ALTER TABLE knowledge_topics ADD COLUMN field_values TEXT NOT NULL DEFAULT '{}';

-- `updated_at` n'existait pas sur un thème : la table n'avait que `created_at`.
-- Le sujet, lui, s'écrit (page, champs) et doit donc pouvoir être trié et
-- arbitré par le last-write-wins comme n'importe quelle autre ligne.
ALTER TABLE knowledge_topics ADD COLUMN updated_at TEXT;
UPDATE knowledge_topics SET updated_at = created_at WHERE updated_at IS NULL;

CREATE INDEX idx_knowledge_topics_type ON knowledge_topics(type_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Les objets existants deviennent des sujets
-- ─────────────────────────────────────────────────────────────────────────────
-- ⭐ L'`uid` EST CONSERVÉ, et c'est la ligne la plus importante du fichier. Les
-- arêtes de `object_links` désignent leurs extrémités par `uid` : un objet qui
-- changerait d'uid en devenant sujet perdrait TOUTES ses mentions et tous ses
-- backlinks, sans erreur et sans que rien ne le dise.
--
-- ⚠️ LA COULEUR N'EST PAS REPRISE DU TYPE, et c'est un vrai piège évité :
-- `knowledge_topics.color` stocke un HEX (`#4d8dff`, cf. `TOPIC_COLORS`) tandis
-- que `object_types.color` stocke un NOM DE TOKEN (`blue`). Recopier l'un dans
-- l'autre produirait `var(--color-#4d8dff)` à l'affichage — une couleur qui
-- échoue en silence, exactement le défaut consigné dans `CLAUDE.md`. Les sujets
-- migrés prennent donc le bleu par défaut, modifiable ensuite.
--
-- `position` : les objets n'en avaient pas (ils étaient triés par date). On les
-- range APRÈS les thèmes existants, pour que l'ordre de la grille ne bouge pas
-- sous les yeux de quelqu'un qui avait déjà rangé ses thèmes.
--
-- ⚠️ La borne haute est SNAPSHOTÉE avant la moindre insertion. Un
-- `(SELECT MAX(position) FROM knowledge_topics)` écrit directement dans le
-- SELECT serait réévalué à chaque ligne insérée — donc croissant, donc faux dès
-- le deuxième objet.
CREATE TEMP TABLE _rang_base AS SELECT COALESCE(MAX(position), -1) AS base FROM knowledge_topics;

INSERT INTO knowledge_topics (uid, name, color, position, type_id, body, field_values, created_at, updated_at)
SELECT
  o.uid,
  o.title,
  '#4d8dff',
  (SELECT base FROM _rang_base) + 1 + (SELECT COUNT(*) FROM objects o2 WHERE o2.id < o.id),
  o.type_id,
  o.body,
  o.field_values,
  o.created_at,
  o.updated_at
FROM objects o;

DROP TABLE _rang_base;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) La table `objects` disparaît
-- ─────────────────────────────────────────────────────────────────────────────
-- ⚠️ AUCUNE PIERRE TOMBALE N'EST ÉMISE, et ce n'est pas un oubli — c'est le
-- précédent exact de la migration 019 (retrait de `benchmark_results`). Le
-- moteur identifie les tables par un HMAC calculé à partir de `TABLES_SYNC` :
-- sitôt `objects` retirée de cette liste, son empreinte n'existe plus, ni pour
-- émettre ni pour recevoir. C'est précisément ce qui empêche ces lignes de
-- ressusciter depuis un autre appareil.
--
-- Les lignes déjà envoyées à Supabase y restent, chiffrées et illisibles.
--
-- ⚠️ Les triggers d'une table tombent avec elle. On les nomme quand même, pour
-- que la lecture de ce fichier suffise à savoir ce qui a disparu :
--   objects_uid · objects_links_del · objects_out_ins/upd/del  (migration 020)
DROP TRIGGER IF EXISTS object_types_objects_del;
DROP TABLE objects;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4) La cascade d'arêtes suit le sujet
-- ─────────────────────────────────────────────────────────────────────────────
-- Elle vivait sur `objects` (trigger `objects_links_del`, migration 020 § 8) et
-- vient de tomber avec la table. Sans ce remplaçant, supprimer un sujet
-- laisserait ses arêtes derrière lui : un backlink « Mentionné dans » pointant
-- vers rien, pour toujours, et qu'aucune clé étrangère ne surveille.
--
-- ⚠️ VOLONTAIREMENT PAS GARDÉ PAR `applying` : quand l'autre appareil nous
-- envoie la suppression du sujet, la cascade doit se produire ICI AUSSI. C'est
-- le trigger d'OUTBOX qui est gardé, et lui seul.
--
-- ⚠️ Le `kind` reste `'object'`. Le vocabulaire visible dit « sujet », mais
-- changer la valeur stockée réécrirait `from_kind`/`to_kind` ET l'uid dérivé de
-- chaque arête (`ol:kind:uid:kind:uid`) — c'est-à-dire l'identité que les deux
-- appareils calculent chacun de leur côté. Un renommage cosmétique ne vaut pas
-- une divergence d'identité.
CREATE TRIGGER knowledge_topics_links_del AFTER DELETE ON knowledge_topics BEGIN
  DELETE FROM object_links WHERE (from_kind = 'object' AND from_uid = OLD.uid) OR (to_kind = 'object' AND to_uid = OLD.uid);
END;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5) ⭐ Supprimer un TYPE ne détruit plus ses sujets — il les DÉTYPE
-- ─────────────────────────────────────────────────────────────────────────────
-- La migration 020 faisait cascader la suppression : effacer le type
-- « Personne » effaçait toutes les fiches Personne. C'était défendable tant
-- qu'un objet n'était qu'un porte-champs — sans son type, il n'avait ni champs
-- ni écran, donc il aurait été invisible.
--
-- Ce n'est plus vrai. Un sujet a maintenant un nom, une page, des FICHES
-- rangées dedans et des backlinks : il existe parfaitement sans type. Garder
-- l'ancienne cascade signifierait qu'un clic sur « supprimer le type » emporte
-- des notes — le pire dégât que ce module puisse faire.
--
-- C'est la même règle que « retirer un champ conserve ses valeurs », d'un cran
-- au-dessus : on retire l'étiquette, jamais la chose.
CREATE TRIGGER object_types_detype AFTER DELETE ON object_types BEGIN
  UPDATE knowledge_topics SET type_id = NULL WHERE type_id = OLD.id;
END;
