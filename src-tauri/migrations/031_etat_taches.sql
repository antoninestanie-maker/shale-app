-- ============================================================================
-- 031 — L'ÉTAT D'UNE TÂCHE (2026-10-20)
-- ============================================================================
--
-- Antonin : « j'aimerais que les tâches puissent avoir des sortes de tags dans
-- le sens de la tâche peut-être terminée ou quelque chose comme ça ». Retenu
-- avec lui le 2026-10-20 : un ÉTAT à choix unique, pas des étiquettes libres
-- (le `tag` thématique de la 001 garde son rôle).
--
--   'todo'    — à faire, l'état par défaut : rien ne s'affiche ;
--   'doing'   — en cours : un badge, rien d'autre ne change ;
--   'waiting' — en attente de quelqu'un ou de quelque chose (`waiting_for`),
--               avec une date de relance facultative (`follow_up_on`) ;
--   'dropped' — abandonnée : sort des listes sans être supprimée.
--
-- « Terminée » n'est PAS un état : c'est la case à cocher, qui vit dans
-- `task_completions` (une coche par jour pour les routines). Deux façons de
-- dire « faite » finiraient par se contredire.
--
-- ⭐ `state_since` : le jour où l'état a été posé. Une tâche en attente ou
-- abandonnée n'est plus PRÉVUE à partir de ce jour-là — elle ne fait pas
-- baisser la Discipline, ne passe pas « en retard », et une routine se met en
-- pause. Sans cette date, mettre une routine en pause aujourd'hui effacerait
-- aussi ses jours passés du compte : l'historique se réécrirait. Voir
-- `estSuspendue` dans `src/lib/taches.ts` (et son portage Rust,
-- `notifications/task_streak.rs`).
--
-- ⚠️ PAS DE CHECK, exprès (même raison que la 030) : un appareil resté en
-- version antérieure refuserait une valeur inconnue et sa synchronisation
-- échouerait indéfiniment. L'app lit une valeur inconnue comme 'todo'
-- (`etatDe`).
--
-- Aucun trigger à recréer : ceux de la 016 (`tasks_out_upd`) se déclenchent
-- sur toute mise à jour de la ligne, et la synchronisation lit la ligne entière
-- (`sync/local.ts`). Un appareil plus ancien reçoit la ligne sans les colonnes
-- et voit la tâche « à faire » — c'est le repli le moins faux.
--
-- ⚠️ `ALTER TABLE ADD COLUMN` n'accepte que des défauts littéraux (PIEGES § 3.3).

ALTER TABLE tasks ADD COLUMN state TEXT NOT NULL DEFAULT 'todo';
ALTER TABLE tasks ADD COLUMN state_since TEXT;   -- 'YYYY-MM-DD' local, NULL = depuis toujours
ALTER TABLE tasks ADD COLUMN waiting_for TEXT;   -- de quoi, de qui on attend (texte libre)
ALTER TABLE tasks ADD COLUMN follow_up_on TEXT;  -- 'YYYY-MM-DD' local, le jour où relancer
