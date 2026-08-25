-- Retrait du module Benchmark — remplacé par Finance le 2026-08-25.
--
-- CE QUE `DROP TABLE` EMPORTE TOUT SEUL, en SQLite : l'index unique
-- `idx_benchmark_results_uid` (migration 015), le trigger d'auto-uid
-- `benchmark_results_uid` (015) et les trois triggers d'outbox
-- `benchmark_results_out_{ins,upd,del}` (016). Rien à nettoyer à la main.
--
-- ⚠️ NE PAS « CORRIGER » LES MIGRATIONS 009, 015 ET 016. Sur une installation
-- neuve elles vont continuer de créer la table, ses colonnes et ses triggers,
-- avant que ce fichier ne la supprime. C'est normal : une migration jouée ne se
-- réécrit pas, et le détour coûte quelques millisecondes une seule fois.

DROP TABLE IF EXISTS benchmark_results;

-- La file d'envoi et le miroir d'état gardaient des lignes qui ne désignent
-- plus rien. Elles seraient inoffensives — `estTableSync()` les écarte déjà
-- côté TypeScript — mais elles resteraient là pour toujours, et le prochain qui
-- lira `sync_outbox` se demanderait ce que fait cette table inconnue.
DELETE FROM sync_outbox WHERE table_name = 'benchmark_results';
DELETE FROM sync_state  WHERE table_name = 'benchmark_results';

-- ⚠️ CE QUI RESTE, ET QU'ON NE PEUT PAS ATTEINDRE D'ICI : les lignes déjà
-- envoyées vers Supabase. Elles y demeurent, chiffrées et illisibles pour le
-- serveur, mais elles y demeurent. Les purger demande du SQL sur le projet
-- Supabase, hors de portée de l'app.
--
-- Aucune pierre tombale n'est émise, et ce n'est pas un oubli : le moteur
-- identifie les tables par un HMAC calculé À PARTIR DE `TABLES_SYNC`
-- (`dictionnaireTables`, sync/engine.ts). Sitôt `benchmark_results` retirée de
-- cette liste, son empreinte n'existe plus — ni pour émettre, ni pour recevoir.
-- C'est aussi ce qui garantit que ces lignes ne peuvent PAS ressusciter depuis
-- un autre appareil : à la réception, leur tag est inconnu, elles sont comptées
-- `ignorees` et jamais appliquées.
