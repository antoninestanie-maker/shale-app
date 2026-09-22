-- ─────────────────────────────────────────────────────────────────────────────
-- 027 — « Supprimés récemment » : une corbeille de 30 jours
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Chantier « menus contextuels », 2026-09-22. Jusqu'ici, supprimer un objet
-- créait une pierre tombale qui se propageait à tous les appareils et ne se
-- rattrapait pas (limite assumée le 2026-08-02). Un clic droit met la
-- suppression à un geste : on ne livre pas l'un sans l'autre.
--
-- ⭐⭐ POURQUOI UNE COLONNE, ET NON UNE TABLE D'INSTANTANÉS
--
-- Instruit à la Phase 0 (`RAPPORT-PHASE0-MENU-CONTEXTUEL.md`), validé par
-- Antonin à l'arrêt 1. Trois raisons, dans l'ordre de leur poids :
--
--   • LES ARÊTES. Les migrations 020 et 022 posent sept triggers `AFTER DELETE`
--     qui détruisent les `object_links` de l'objet supprimé. Mettre en corbeille
--     par un `UPDATE` ne les déclenche PAS : liens, mentions, rattachements,
--     `topic_id` des fiches — tout reste en place, et la restauration est
--     parfaite sans une ligne de code. Un vrai `DELETE` suivi d'une
--     réinsertion aurait dû sauvegarder puis rejouer toutes les arêtes, sur
--     chaque appareil.
--   • LA SYNCHRONISATION. Une colonne voyage comme n'importe quelle
--     modification : mise en corbeille, restauration et purge sont arbitrées
--     par le last-write-wins existant, sans une ligne de code de
--     synchronisation. La concurrence (restaurer au jour 29 sur un appareil,
--     purger au jour 30 sur l'autre) est tranchée par le trigger serveur
--     `sync_rows_lww`, sur `(client_ts, device_id)` : déterministe.
--   • LE PRÉCÉDENT. La 024 a déjà préféré une colonne à un registre, pour les
--     mêmes raisons. Et `habits.archived`, `finance_accounts.archived`,
--     `invoice_parties.archived` sont trois mises de côté qui tournent déjà.
--
-- ⚠️⚠️ LE PRIX, DIT EN FACE : chaque lecture doit écarter les lignes en
-- corbeille, et le premier oubli est SILENCIEUX. D'où le filtre posé AU FOND
-- (`repo.ts`, `demo.ts`, `notifications/data.rs`), jamais chez les appelants,
-- et un test qui interroge chaque fonction de lecture.
--
-- ⚠️⚠️ ET LE RISQUE N° 1 — MESURÉ le 2026-09-22 (`sync/corbeille.test.ts`).
-- Un appareil resté en version ≤ 026 ne connaît pas cette colonne ;
-- `appliquerLigne()` écarte en silence les colonnes inconnues (choix
-- documenté, pour qu'un vieil appareil continue de se synchroniser). Donc :
--   • il continue d'AFFICHER l'objet en corbeille ;
--   • s'il y écrit, les appareils qui ont DÉJÀ l'objet le gardent en
--     corbeille (la réception ne met à jour que les colonnes reçues) ;
--   • mais un appareil NEUF, qui reçoit l'objet pour la première fois,
--     l'insère VIVANT à partir de la version sans colonne.
-- Parade : que tous les appareils portent la 027 avant d'utiliser la
-- corbeille. Voir `PIEGES.md` § 19.
--
-- ⚠️ NE PLUS MODIFIER CE FICHIER une fois qu'il a été joué sur une vraie
-- base : le moteur de migrations en garde l'empreinte, et un fichier changé
-- après coup empêche l'app de démarrer.
--
-- ─── Le format ───────────────────────────────────────────────────────────────
--
-- `deleted_at` : NULL = vivant ; sinon l'instant de la mise en corbeille, en
-- UTC ISO à la milliseconde (`2026-09-22T00:20:33.123Z`), le format de
-- `sync_outbox.ts`. ⚠️ PAS l'heure locale du reste de l'app : cet instant est
-- comparé ENTRE APPAREILS (le décompte des 30 jours, et l'identité d'un lot).
--
-- ⭐ UN LOT = UN MÊME `deleted_at`. Un objectif mis en corbeille emporte ses
-- phases et ses sous-objectifs avec EXACTEMENT le même horodatage : c'est ce
-- qui permet de restaurer le lot entier, et seulement lui — jamais un enfant
-- qu'on avait jeté la veille pour son compte.
--
-- ─── Les tables ──────────────────────────────────────────────────────────────
--
-- Les OBJETS qu'un utilisateur crée, nomme et peut regretter. Pas leurs
-- feuilles (`task_completions`, `habit_checks`, `metric_entries`,
-- `invoice_lines`, `invoice_payments`) : elles ne se lisent qu'à travers leur
-- parent, et le filtre les écarte PAR LUI (jointure sur le parent dans
-- `fetchAll`). Une colonne de plus sur chacune n'aurait rien changé à l'écran
-- et aurait doublé le nombre de filtres à tenir.
--
-- Ni les réglages (`tags`, `object_types`, `invoice_series`,
-- `finance_categories`) ni la Finance à `archived` (comptes, tiers) : deux
-- mécanismes de mise de côté sur le même objet seraient un mensonge en
-- puissance. Ni le Trading, dont la sortie de l'app est décidée.
--
-- ⚠️ `ALTER TABLE ADD COLUMN` sans défaut : les lignes existantes prennent NULL
-- — vivantes — sans qu'une seule soit réécrite, donc sans une seule entrée
-- d'outbox. La migration ne réveille pas la synchronisation.
-- ⚠️ Aucune contrainte `CHECK` (`PIEGES` § 3.4) : une ligne venue d'un appareil
-- plus récent doit pouvoir s'écrire, quelle que soit sa forme.

ALTER TABLE notes             ADD COLUMN deleted_at TEXT;
ALTER TABLE tasks             ADD COLUMN deleted_at TEXT;
ALTER TABLE goals             ADD COLUMN deleted_at TEXT;
ALTER TABLE calendar_events   ADD COLUMN deleted_at TEXT;
ALTER TABLE knowledge_topics  ADD COLUMN deleted_at TEXT;
ALTER TABLE knowledge_entries ADD COLUMN deleted_at TEXT;
ALTER TABLE invoices          ADD COLUMN deleted_at TEXT;
ALTER TABLE journal_entries   ADD COLUMN deleted_at TEXT;
ALTER TABLE custom_metrics    ADD COLUMN deleted_at TEXT;
ALTER TABLE habits            ADD COLUMN deleted_at TEXT;

-- Index PARTIELS : ils ne portent que les lignes en corbeille — quelques-unes,
-- contre des centaines de vivantes. Ils servent la vue « Supprimés récemment »
-- et la purge des 30 jours, sans alourdir les écritures ordinaires.
CREATE INDEX idx_notes_corbeille             ON notes(deleted_at)             WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_tasks_corbeille             ON tasks(deleted_at)             WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_goals_corbeille             ON goals(deleted_at)             WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_calendar_events_corbeille   ON calendar_events(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_knowledge_topics_corbeille  ON knowledge_topics(deleted_at)  WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_knowledge_entries_corbeille ON knowledge_entries(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_invoices_corbeille          ON invoices(deleted_at)          WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_journal_entries_corbeille   ON journal_entries(deleted_at)   WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_custom_metrics_corbeille    ON custom_metrics(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_habits_corbeille            ON habits(deleted_at)            WHERE deleted_at IS NOT NULL;
