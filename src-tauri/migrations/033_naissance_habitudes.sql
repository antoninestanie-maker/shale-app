-- ============================================================================
-- 033 — LE JOUR OÙ UNE HABITUDE EST NÉE (2026-10-21, lot 3 de l'audit du 20/10)
-- ============================================================================
--
-- ⭐ `habits.created_at` — l'instant de création, comme `tasks.created_at`.
--
-- Faute de cette colonne, une habitude comptait depuis sa PREMIÈRE COCHE
-- (`debutsDesHabitudes`, PIEGES § 33.3). Deux défauts en découlaient, que
-- l'anneau d'Aujourd'hui rend visibles depuis qu'il lit les habitudes :
--   • rythme-1 — cocher une habitude pour un jour PASSÉ (Habitudes, barre des
--     jours) reculait son début : chaque jour entre les deux devenait un jour
--     « actif et raté », l'historique chutait et la série tombait à 0 ;
--   • rythme-2 — une habitude JAMAIS cochée ne comptait qu'aujourd'hui : le
--     soir l'anneau disait 1/4, le lendemain ce même jour se relisait 1/1, et la
--     série montait d'un jour à chaque minuit.
-- La règle devient (`src/lib/performance/analyse.ts`, portée en Rust dans
-- `notifications/discipline_habitudes.rs`) : une habitude compte à partir du
-- jour de sa CRÉATION ; une coche posée sur un jour d'avant compte en plus, ce
-- jour-là seulement — cocher ne fait plus jamais baisser un jour.
--
-- Le remplissage reprend la règle d'avant, pour ne rien réécrire : la première
-- coche, et pour une habitude jamais cochée, aujourd'hui. Format local
-- 'YYYY-MM-DD HH:MM:SS', comme les autres `created_at`.
--
-- ⚠️ Synchronisation : rien à changer. La ligne voyage entière (`sync/local.ts`)
-- et un appareil plus ancien ignore la colonne. Une ligne venue sans elle reste
-- à NULL : la règle retombe alors sur la première coche (l'ancienne règle).
-- Le remplissage passe par les triggers d'outbox : chaque habitude repart une
-- fois vers le cloud, avec la même valeur sur chaque appareil à jour.
--
-- ⚠️ `ALTER TABLE ADD COLUMN` n'accepte que des défauts littéraux (PIEGES § 3.3) :
-- d'où le remplissage par UPDATE, et `addHabit` qui écrit l'instant lui-même.

ALTER TABLE habits ADD COLUMN created_at TEXT;   -- 'YYYY-MM-DD HH:MM:SS' local, NULL = inconnu

UPDATE habits
   SET created_at = COALESCE(
         (SELECT MIN(c.date) FROM habit_checks c WHERE c.habit_id = habits.id) || ' 00:00:00',
         datetime('now', 'localtime')
       )
 WHERE created_at IS NULL;
