-- ─────────────────────────────────────────────────────────────────────────────
-- 025 — Le cache local du profil de licence
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Chantier « profils de licence sur devis », 2026-09-13. Un profil de licence
-- est un objet de configuration DÉLIVRÉ PAR LE SERVEUR (`public.license_profiles`
-- chez Supabase), signé, appliqué par-dessus les droits du palier : il masque,
-- réordonne et renomme — jamais il ne déverrouille. Cette table n'en garde
-- qu'une COPIE, pour que l'app s'ouvre avec son profil hors ligne et sans
-- attendre le réseau.
--
-- ⭐⭐ HORS SYNCHRONISATION — décision du 2026-09-13, consignée dans `PIEGES.md`
-- et `src/lib/sync/scope.ts` (`TABLES_HORS_SYNC`).
--
-- Un profil n'est pas une donnée de l'utilisateur : c'est un droit commercial.
-- Le faire transiter par la synchronisation chiffrée, c'est le confier au canal
-- dont l'UTILISATEUR détient la clé — il pourrait y garder indéfiniment une
-- version périmée. Chaque appareil le redemande donc au serveur, et c'est
-- pourquoi AUCUN trigger d'outbox n'est posé ici (contrairement aux tables de
-- la 016 et suivantes).
--
-- ⚠️ `uid` N'EST PAS l'identité de synchronisation des autres tables : c'est
-- l'identifiant du COMPTE Supabase auquel le profil est destiné. Clé primaire,
-- donc un seul profil par compte ; deux comptes sur la même machine ne
-- partagent pas le leur, et la résolution refuse une ligne dont l'`uid` n'est
-- pas le compte connecté.
--
-- ⚠️ Textes STOCKÉS TELS QUE SIGNÉS. `issued_at`, `expires_at` et `payload` ne
-- sont jamais normalisés ni re-sérialisés : la signature porte sur leurs octets
-- exacts (`src/lib/licence/signature.ts`). Un `datetime()` appliqué à
-- l'écriture invaliderait toutes les signatures.
--
-- ⚠️ Pas de `CHECK` sur `tier` : la liste des paliers appartient au serveur,
-- et une contrainte ici rejetterait silencieusement un palier ajouté demain.
-- La résolution compare le palier du profil au palier du compte, c'est tout.

CREATE TABLE IF NOT EXISTS license_profile (
  uid             TEXT PRIMARY KEY,
  tier            TEXT NOT NULL,
  profile_version INTEGER NOT NULL,
  issued_at       TEXT NOT NULL,
  expires_at      TEXT NOT NULL,
  payload         TEXT NOT NULL,
  signature       TEXT NOT NULL,
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
