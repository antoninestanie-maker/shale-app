# Passation — profils de licence sur devis

*Chantier du 2026-09-13. Se suffit : état, ce qui est prouvé, ce qui ne l'est
pas, ce qui reste et qui décide. Les décisions et leur pourquoi sont dans la
section datée de `CLAUDE.md` ; les pièges dans `PIEGES.md` § 12 ; l'audit de
départ dans `AUDIT-LICENCE-PROFILS.md`.*

## 1. En une phrase

Un compte peut recevoir du serveur un **profil signé** qui masque des modules,
en impose l'ordre, renomme leurs libellés et pose un nom de marque — **sans
jamais rien déverrouiller** — et l'app retombe en silence sur l'offre nue dès
que ce profil est absent, expiré, altéré ou illisible.

## 2. État

| | |
|---|---|
| Branche | `chantier/licence-profils`, fusionnée dans `mobile-ios` (voir § 6) |
| Migration app | **025** `license_profile` — cache local, **hors synchronisation** |
| Migration serveur | `shale-site/supabase/migrations/005_licence_profils.sql` — ⛔ **pas encore jouée** sur le projet Supabase |
| Clé de signature | paire n° 1, générée le 2026-09-13. Privée : `~/Desktop/Shale-projet/administratif/licence-profils/cle-privee.jwk` (600, hors dépôt). Publique : `src/lib/licence/cles.ts` |
| Profils émis en production | **aucun** |
| Code | `src/lib/licence/` (catalogue, payload, signature, resoudre, transport, useProfil, cles), `resolveEntitlements()` dans `src/lib/entitlements.ts`, `tools/licence-profil.mjs` |

### Ligne de base après ce chantier

```
npx tsc --noEmit                              # ✅
npm run test:types                            # ✅
npm run i18n:check                            # ✅ 0 manquante, 1847 entrées
npm run i18n:durs                             # ✅ 0 sûrement française
npm test                                      # ✅ 1124 / 1124, 82 fichiers
npx vite build                                # ✅ (l'avertissement de taille de chunk préexistait)
cd src-tauri && cargo check --all-targets     # ✅
cargo test --lib                              # ✅ 133
cargo check --target aarch64-apple-ios-sim    # ✅
cargo check --target aarch64-apple-ios        # ✅
```

## 3. Ce qui est prouvé, et comment

| Promesse | Preuve |
|---|---|
| Profil absent, expiré, mal signé, JSON malformé, autre compte, autre palier → palier nu | `licence/resoudre.test.ts` |
| Clé i18n inconnue ignorée ; champ inconnu (script, URL, CSS) ignoré | `licence/payload.test.ts` |
| Module masqué alors qu'il est la vue active → retour à l'accueil | `resoudre.test.ts` + concordance avec `App.tsx` |
| Hors ligne pendant la validité : le cache s'applique ; au-delà de l'expiration : palier nu | `licence/transport.test.ts` |
| Retour en ligne après expiration : profil renouvelé repris, ou cache effacé si le contrat est fini | `transport.test.ts` |
| « Je ne sais pas » (réseau, 401, 404, 500) n'efface jamais le cache | `transport.test.ts` |
| Modifier n'importe quel champ signé invalide la signature ; rotation de clé | `licence/signature.test.ts` |
| L'outil d'émission et l'app signent les mêmes octets | `licence/outil.test.ts` **exécute** l'outil |
| RLS serveur : chacun ne lit que son profil, aucun client n'écrit ; texte rendu à l'octet | `licence/serveur.sql.test.ts` (PGlite) |
| Cache hors sync, sans trigger, texte gardé tel quel | `licence/cache.sql.test.ts`, `sync/outbox.test.ts` |
| Chaque action ⌘K déclare son module | `licence/actions.test.ts` |
| Le catalogue colle à `Sidebar.tsx` et `uiConfig.ts` | `licence/catalogue.test.ts` |
| Hors ligne, l'offre retenue est rendue | `auth/access.test.ts` |
| Les tests mordent | cinq mutations des gardes, chacune a fait tomber au moins un test (`PIEGES.md` § 12.7) |
| **À l'écran**, mode démo, Chrome headless | barre latérale (ordre, libellés, catégorie renommée, marque), onglets iPhone à 390 px, palette ⌘K, Personnaliser (modules masqués absents, libellés imposés verrouillés), tuile trading retirée, FR **et** EN, profils vide / expiré / signature altérée identiques à « aucun », zéro erreur console |

## 4. Ce qui n'est PAS prouvé — ne pas le lire comme conforme

- ⛔ **Le trajet réel serveur → app.** La migration 005 n'est pas jouée : aucun
  profil n'a jamais été téléchargé depuis le vrai Supabase. Le transport est
  testé contre un `fetch` simulé et la table contre PGlite.
- **L'app installée avec un profil.** La migration 025 tourne au build natif,
  mais aucun profil n'existe pour le compte d'Antonin : ce qui est vérifiable
  après build, c'est que **rien ne change** et que la base passe en version 25.
- **iPhone réel et simulateur** : non lancés pour ce chantier. La barre
  d'onglets a été vue en viewport 390 px dans Chrome, pas en WKWebView.
- **WebCrypto ECDSA dans WKWebView / WebView2** : vérifié dans Node et Chromium
  seulement. `crypto.subtle` est disponible sur iOS (`CLAUDE.md`, 2026-08-27),
  ECDSA P-256 fait partie du socle WebCrypto, mais **aucune signature n'a été
  vérifiée dans WebKit**. Si elle échouait, la dégradation serait silencieuse :
  c'est le premier point à regarder avec un vrai profil.

## 5. Émettre un profil — la marche à suivre

Antonin ne tape aucune commande : c'est une session Claude qui fait les étapes
1 à 3, et lui qui colle le SQL.

1. Écrire le payload du client dans un fichier JSON (modèle :
   `PAYLOAD_CONSEIL` dans `src/lib/demo.ts`). Clés de libellé acceptées :
   `CLES_LIBELLES_PROFIL` de `src/lib/licence/catalogue.ts`.
2. Trouver l'UUID du compte (Supabase → Authentication → Users) et son palier
   (`subscriptions.tier`). ⚠️ Le profil ne s'applique **que** si son palier est
   celui du compte : un compte rétrogradé perd son profil.
3. Depuis `~/Desktop/Shale-projet/Shale` :
   ```bash
   node tools/licence-profil.mjs emettre --cle ../administratif/licence-profils/cle-privee.jwk --compte <uuid> --palier shale_trade --version 1 --expire 2027-09-30 --payload <fichier.json>
   ```
4. Antonin colle le SQL affiché dans **Supabase Studio → SQL Editor → Run**.
5. Vérifier en `curl` avec la clé anon **et le jeton du compte** que la ligne se
   lit — sans jeton, la RLS doit rendre `[]`.

Renouveler = réémettre avec `--version` + 1 (l'insert fait un upsert). Retirer =
`delete from public.license_profiles where user_id = '…';` — l'app efface son
cache au prochain téléchargement, et hors ligne le profil vit jusqu'à
`expires_at` : **choisir la durée en conséquence**.

## 6. Ce qui reste, et qui décide

| Sujet | État | Qui |
|---|---|---|
| **Jouer `005_licence_profils.sql`** sur le projet Supabase | ⛔ à faire — geste d'Antonin dans Studio, SQL prêt | **Antonin** |
| **Sauvegarder la clé privée** sur un support hors ligne | recommandé — la perdre empêche tout renouvellement avant un nouveau build | **Antonin** |
| Premier vrai profil de bout en bout (dont vérification ECDSA dans WebKit) | à faire après le point 1 | session suivante |
| Offre `shale_business` (Stripe, `CHECK` Postgres, site) | hors périmètre, chantier commercial | **Antonin** |
| Plancher des frais de mise en place, engagement, sort du profil en fin de contrat, support N1 | hors code (cadrage § « À trancher côté commercial ») | **Antonin** |
| Réserve de propriété sur la verticale restauration | non vérifiée — la démo a été faite sur un cabinet de conseil | **Antonin** |
| Surcharge générale des phrases de l'app / titres d'actions ⌘K | non fait, décision de périmètre (`CLAUDE.md`) | **Antonin** |
| Réglages imposés par profil | mécanisme prêt, liste vide tant qu'aucun écran n'en consomme | à la demande |
| Indicateur de session de marché visible sans Market-Brain | préexistant, jamais gaté | **Antonin** |
