-- ─────────────────────────────────────────────────────────────────────────────
-- 026 — La feuille de route des objectifs
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Chantier « feuille de route », 2026-09-14. Un objectif se décompose en JALONS
-- ordonnés, chaque jalon en SOUS-OBJECTIFS, chaque sous-objectif en éléments
-- réels (tâches, événements) ou en une CIBLE CHIFFRÉE. Le pourcentage n'est plus
-- saisi : il est calculé à la lecture (`src/lib/objectifs/progression.ts`).
--
-- (Le prompt du chantier annonçait « 025 » : le numéro a été pris la veille par
-- `025_licence_profil.sql`. Décision d'Antonin, 2026-09-14 : 026.)
--
-- ⭐⭐ POURQUOI AUCUNE TABLE NOUVELLE
--
-- Un jalon EST un objectif : une ligne de `goals`, `parent_goal_id` sur la
-- racine, `is_milestone = 1`. Les sous-objectifs pointent sur le jalon. Trois
-- niveaux, une seule table — déjà synchronisée, déjà traduite par `sync/fk.ts`
-- (`parent_goal_id` → `goals`), déjà citable par `object_links` (kind `'goal'`).
-- Une table `goal_milestones` aurait coûté une entrée de `sync/scope.ts`, un
-- ordre d'application cyclique (`goals.milestone_id` pointant en avant), et une
-- extrémité d'arête absente du `CHECK` d'`object_links`, que SQLite ne sait pas
-- modifier.
--
-- ⚠️ AUCUNE CONTRAINTE `CHECK` (PIEGES § 3.4). Ni sur `count_source`, ni sur la
-- profondeur, ni sur `weight`. Une ligne distante qui violerait un CHECK
-- ARRÊTERAIT la synchronisation, alors que ce ne sont que des règles de saisie.
-- Elles vivent dans `src/lib/objectifs/`, et la lecture tolère l'inattendu :
-- une source inconnue compte comme `'manual'`, un poids ≤ 0 compte comme 1, une
-- profondeur au-delà de trois niveaux se lit sans planter.
--
-- ⚠️ `ALTER TABLE ADD COLUMN` n'accepte que des défauts littéraux (PIEGES § 3.3).
-- Toutes les colonnes `NOT NULL` ont donc un `DEFAULT` : les objectifs existants
-- restent valides sans qu'une seule ligne soit réécrite.
--
-- ⚠️⚠️ AUCUNE DONNÉE EXISTANTE N'EST MIGRÉE
--
-- Un objectif qui a déjà des enfants les garde comme sous-objectifs DIRECTS,
-- sans jalon — état légal du modèle, le jalon est facultatif. Les promouvoir
-- inventerait une structure qu'Antonin n'a pas dessinée, sur ses vraies données.
-- La promotion en jalon est un geste manuel de l'interface.
--
-- ⭐ LE MANUEL RESTE SOUVERAIN — décision d'Antonin, 2026-09-14
--
-- `manual_progress` vaut 1 PAR DÉFAUT depuis la 001 : la plupart des objectifs
-- existants sont en manuel, y compris ceux qui ont déjà des enfants. Ignorer le
-- manuel dès qu'une feuille de route existe aurait changé leur chiffre au
-- premier lancement, sans un geste. Donc :
--   • `manual_progress = 1` → le % saisi, feuille de route ou pas ;
--   • ajouter une étape à un objectif manuel PROPOSE de passer en mesuré ;
--   • les NOUVEAUX objectifs naissent en mesuré (c'est `createGoal` qui le dit —
--     le DEFAULT SQL de la 001 ne peut pas être changé sans recréer la table,
--     et il n'a pas à l'être : l'app écrit toujours la colonne).
-- Aucune valeur n'est effacée : repasser en manuel rend le % d'avant.

-- Niveau 2 : 1 = jalon. Un objectif racine ou un sous-objectif vaut 0.
ALTER TABLE goals ADD COLUMN is_milestone INTEGER NOT NULL DEFAULT 0;

-- Ordre d'affichage entre frères, croissant. Les lignes existantes valent toutes
-- 0 : à égalité, la lecture garde l'ordre d'aujourd'hui (échéance, puis id), si
-- bien que rien ne bouge à l'écran tant que personne n'a réordonné.
ALTER TABLE goals ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

-- Poids dans la moyenne du parent. 1 = tout le monde pèse pareil ; le champ est
-- masqué dans l'interface tant qu'on n'ouvre pas le repli « avancé ».
ALTER TABLE goals ADD COLUMN weight INTEGER NOT NULL DEFAULT 1;

-- Cible chiffrée. NULL = pas de cible : le sous-objectif avance par ses éléments.
-- ENTIER, jamais REAL (règle du dépôt) : pour des décimales, l'unité s'ajuste
-- (« g » plutôt que « kg », « centimes » plutôt que « € »).
ALTER TABLE goals ADD COLUMN target_count INTEGER;

-- Unité libre, affichée telle quelle (« backtests », « € »). Texte de
-- l'utilisateur : jamais traduit.
ALTER TABLE goals ADD COLUMN target_unit TEXT;

-- D'où vient le compte d'une cible : 'manual' · 'task' · 'habit'.
--   'manual' → `manual_count`
--   'task'   → occurrences cochées de la tâche `count_ref_uid` (récurrente)
--   'habit'  → jours tenus de l'habitude `count_ref_uid`
-- ⚠️ `habit` n'est PAS une famille d'`object_links` (CHECK de la 020) : une
-- habitude ne se rattache pas par arête, elle n'entre QUE par ici. C'est
-- suffisant, puisqu'une habitude ne compte jamais en binaire.
ALTER TABLE goals ADD COLUMN count_source TEXT NOT NULL DEFAULT 'manual';

-- Compteur saisi à la main, lu seulement si `count_source = 'manual'`.
-- Distinct de `progress_pct` : l'un compte des unités, l'autre est un %.
ALTER TABLE goals ADD COLUMN manual_count INTEGER NOT NULL DEFAULT 0;

-- ⭐ L'`uid` de la tâche ou de l'habitude qui compte — JAMAIS son `id`.
-- Un `id` est local : sur le second appareil il désignerait autre chose, sans
-- erreur. Même raison que les extrémités d'`object_links`.
-- La colonne ne finit pas par `_id` : elle n'entre pas dans `sync/fk.ts`, et
-- `appliquerLigne` (`sync/local.ts`) ne l'écarte pas, puisqu'il trie sur les
-- clés DÉCLARÉES et non sur le suffixe `_uid` (vérifié le 2026-09-14).
ALTER TABLE goals ADD COLUMN count_ref_uid TEXT;

-- Date locale 'YYYY-MM-DD', incluse, à partir de laquelle la source compte.
-- « Depuis le rattachement, jamais depuis toujours » : sans elle, choisir
-- l'habitude « méditer » tenue depuis deux ans remplirait la cible le jour même.
-- L'app la pose quand `count_source` ou `count_ref_uid` change.
-- NULL (ligne écrite hors de ce chemin) → la lecture retombe sur la date de
-- `created_at` : une borne honnête, jamais « depuis toujours ».
-- HEURE LOCALE, comme toute la logique « jour » de l'app.
ALTER TABLE goals ADD COLUMN count_since TEXT;

-- Même colonne que la 024 sur les autres tables, et mêmes promesses : un
-- objectif ou un jalon SUGGÉRÉ par l'accueil se voit comme exemple, se retire
-- d'un geste, et ne compte nulle part. Ce que l'utilisateur écrit lui-même
-- reste à 0. (Absente de la 024 : aucun exemple n'était un objectif.)
ALTER TABLE goals ADD COLUMN is_example INTEGER NOT NULL DEFAULT 0;

-- Les frères se lisent dans l'ordre : un index sur (parent, position) sert la
-- vue Objectifs à chaque rendu.
CREATE INDEX idx_goals_parent_position ON goals(parent_goal_id, position);
