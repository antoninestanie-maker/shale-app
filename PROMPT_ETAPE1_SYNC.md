# Prompt Claude Code — Shale, Étape 1 : couche de sync cloud E2E

> À coller tel quel dans Claude Code, dans le dossier `~/Desktop/Shale`.
> Contexte déjà présent dans `CLAUDE.md` du dépôt (branche `sync-chiffree` en cours) — ce prompt suppose que Claude Code le lit automatiquement.

---

Tu travailles sur Shale, l'app desktop Tauri v2 + React 19 (fork commercial de Second Brain). Lis `CLAUDE.md` à la racine avant toute chose : il documente l'état exact du chantier de sync chiffrée déjà entamé sur la branche `sync-chiffree` (schéma Supabase, migrations 015/016/017, moteur, tests). Ne le relis pas comme une simple référence — c'est l'état réel du code, avec les pièges déjà rencontrés et corrigés listés noir sur blanc. Ne redécouvre pas un problème qui y est déjà documenté.

## Objectif de cette session

Faire passer la couche de sync cloud E2E de « chantier testé unitairement » à « fonctionnalité livrable » : le backend Supabase joué en vrai, le flux d'activation/onboarding bout en bout dans l'app, et la validation croisée PC ↔ PC. C'est la fondation : mobile (étape 3) et build Windows (étape 2) n'ont aucun sens tant que deux appareils desktop ne se synchronisent pas correctement en conditions réelles.

## Ce qui existe déjà (ne pas refaire)

- Schéma complet `shale-site/supabase/sync.sql` (tables `sync_keys`/`sync_rows`, trigger LWW, bucket privé) — écrit, testé via PGlite, **jamais joué sur le vrai projet Supabase**.
- Migrations SQLite locales 015 (uid), 016 (outbox/triggers), 017 (sync_state) — déjà dans `src-tauri/migrations/`, déjà enregistrées dans `lib.rs`.
- `src/lib/sync/` : `scope.ts`, `crypto.ts`, `kdf.ts` (+ `src-tauri/src/crypto.rs` Argon2id), `recovery.ts`, `resolution.ts`, `fk.ts`, `outbox.ts`, `engine.ts`, `keys.ts`, `keystore.ts`, `planificateur.ts`, `transport.ts`.
- UI : `SyncProvider`, `SyncIndicator` (sidebar), `SyncSettings` (Réglages).
- Suite de tests vitest (moteur à deux appareils simulés, PGlite pour le schéma Postgres).

## Ce qu'il reste à faire, dans cet ordre

### 1. Jouer le schéma Supabase pour de vrai
- Appliquer `shale-site/supabase/sync.sql` sur le projet Supabase réel (celui déjà utilisé pour `subscriptions`/auth).
- Vérifier à la main dans le dashboard Supabase : tables créées, trigger LWW actif, RLS/policies correctes, bucket `sync-blobs` privé avec la bonne policy de chemin.
- Tester une insertion/lecture manuelle via l'API REST (Postgrest) pour confirmer le format `bytea` hex (`\\x...`) évoqué dans `CLAUDE.md` — ne pas supposer, vérifier avec une vraie requête.

### 2. Brancher `transport.ts` sur le vrai Supabase
- `transport.ts` est actuellement la seule pièce non testée en conditions réelles. Vérifier qu'il parle correctement au projet réel : auth (JWT utilisateur), push (upsert `sync_rows`), pull (curseur `server_seq`), lecture du bucket pour `payload_ref`.
- Ajouter la gestion d'erreur réseau/HTTP réaliste (timeouts, 401 si session expirée, 429) — pas juste le happy path simulé par les tests.

### 3. Écran d'onboarding de la sync
- Flow complet : activation (Réglages → sync) → choix mot de passe → génération + affichage du code de récupération (`SHALE-XXXX-...`) avec avertissement clair AVANT l'activation (déjà noté comme exigence dans `CLAUDE.md`) → confirmation que l'utilisateur a noté le code (checkbox ou re-saisie partielle) → activation effective.
- Écran de déverrouillage au lancement suivant (mot de passe OU code de récupération) si le trousseau macOS n'a pas la clé en mémoire.
- Vérifier le comportement en mode démo (`AUTH_CONFIGURED` faux) : la section doit rester visible et utilisable en simulation, conformément à ce qui est déjà noté dans `CLAUDE.md`.

### 4. Validation PC ↔ PC réelle
- Construire l'app en natif (`npm run tauri build`), l'installer sur deux profils macOS distincts (ou deux comptes utilisateurs) pointant vers le même compte Shale.
- Scénario de test minimal à exécuter et documenter :
  1. Créer une tâche sur l'appareil A, vérifier son apparition sur B après sync.
  2. Modifier la même ligne sur A et B hors-ligne puis reconnecter les deux → vérifier que le LWW converge vers la même valeur des deux côtés (pas juste « ça a l'air bon », lire la valeur en base sur les deux machines).
  3. Supprimer une ligne sur A → vérifier la disparition sur B, et qu'elle ne « ressuscite » pas après une note modifiée hors-ligne sur B avant la suppression.
  4. Couper le réseau, faire des modifications, le reconnecter → vérifier la reprise automatique du planificateur (backoff exponentiel documenté dans `planificateur.ts`).
- Noter tout écart avec le comportement attendu par les tests unitaires : si les tests passent mais le comportement réel diverge, c'est que le simulateur de serveur dans les tests ne reflète pas fidèlement Postgrest/Supabase — corriger le simulateur ET le code.

### 5. Indicateur d'état de sync — passe de finition
- Vérifier que `SyncIndicator` reflète honnêtement les états réels observés à l'étape 4 : en cours, à jour, erreur réseau (silencieuse, pas d'alerte anxiogène), clé verrouillée.
- Pas d'affichage d'état « indisponible » permanent quand la sync n'est simplement pas activée (déjà une règle documentée) — vérifier que ça tient aussi une fois branché en vrai.

## Contraintes non négociables (rappel des règles du projet)

- Le réseau ne doit **jamais** être sur le chemin critique d'une action utilisateur (créer une tâche doit rester instantané, sync ou pas).
- Toute migration SQL déjà appliquée aux migrations 015/016/017 ne doit **pas** être modifiée rétroactivement — si un ajustement est nécessaire, nouvelle migration.
- Ne jamais committer de clé Supabase, mot de passe de test ou code de récupération réel dans le dépôt.
- Respecter scrupuleusement le design system V6 (tokens, pas de hex, pas de `couleur + "22"") pour tout nouvel écran (onboarding, déverrouillage).
- Après toute modification de `capabilities/*.json`, `tauri.conf.json` ou une migration SQL : rebuild natif + réinstallation obligatoires avant de considérer la tâche terminée.

## Definition of done

- `npx tsc --noEmit`, `npm run test:types`, `npm run build`, `cargo check --lib --tests --bins`, `cargo test --lib`, `npm test` tous verts.
- Schéma Supabase réellement appliqué et vérifié en dashboard.
- Scénario PC ↔ PC de la section 4 exécuté sur deux machines/profils réels, résultat documenté (succès ou écarts trouvés + correctifs).
- Écran d'onboarding + déverrouillage fonctionnels dans l'app installée (bundle .app), pas seulement en `tauri dev`.
- CLAUDE.md mis à jour avec la date du jour, ce qui a été fait, et toute divergence trouvée entre simulateur de tests et comportement Supabase réel — dans le même style factuel et daté que les entrées existantes (pas de reformulation, ajouter une section).

## Ce que je veux en retour

Ne me redemande pas de choisir entre plusieurs architectures pour cette étape — la conception est déjà figée dans le code existant et documentée dans `CLAUDE.md`. Si tu bloques sur une vraie décision produit (ex. durée du délai de purge des tombstones, format exact du message d'onboarding), pose la question ; sinon avance et documente les arbitrages que tu prends toi-même, comme le reste du fichier le fait déjà.
