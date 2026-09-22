# ▶️ SHALE — LE FICHIER UNIQUE DE L'APP

> **Ce fichier se suffit.** Il est écrit pour une session qui n'a AUCUN contexte :
> ce qu'est Shale, comment elle est faite, où elle en est, ce qui est prouvé, ce
> qui ne l'est pas, ce qui reste, et qui décide. **Il n'y a rien à lire d'autre
> pour comprendre le projet de bout en bout.**
>
> **Refondu le 2026-09-18**, à la demande d'Antonin : vingt-trois documents de
> chantier ont été repliés ici (§ 16 dit lesquels et où leur contenu est parti).
> Avant cette date, l'état du projet était éparpillé dans une quinzaine de
> `PASSATION-*.md` qui se contredisaient par endroits.

> ### Ce qui distingue un fait d'une croyance, dans ce document
> **Tout ce qui est marqué ✅ a été VU ou MESURÉ le 2026-09-18**, dans l'arbre,
> dans la vraie base de données, ou en exécutant la commande. Ce qui est repris
> d'un document antérieur sans avoir été revérifié est marqué *(d'après la doc)*.
> La distinction n'est pas du zèle : trois affirmations de la documentation se
> sont révélées fausses en septembre, et chacune a coûté une demi-journée.

---

## 0. Les quatre autres fichiers, et quand les ouvrir

Après ce fichier, il ne reste **que quatre documents vivants** dans le dépôt de
l'app. Chacun répond à une question que celui-ci ne traite pas.

| Fichier | Ce qu'on y trouve | Quand l'ouvrir |
|---|---|---|
| `CLAUDE.md` | **Le POURQUOI de chaque décision**, chantier par chantier, depuis juillet. 5 400 lignes, par ordre chronologique. C'est lui qui fait foi sur une intention | quand on veut savoir *pourquoi* c'est fait comme ça, avant de le défaire |
| `PIEGES.md` | **Le carnet des erreurs qui se répètent** — 120 entrées, format symptôme · cause · parade · ce qu'elle a coûté | **avant de commencer**, et à COMPLÉTER dès qu'on s'en prend une nouvelle |
| `MOBILE.md` | **iOS** : le portage, le simulateur, l'iPhone réel, les contraintes App Store | si on touche à iOS, jamais autrement |
| `DOCUMENTATION.md` | **La règle d'écriture** : où va quoi, quand écrire, la liste de contrôle avant de rendre la main | à chaque session, avant de dire « c'est fini » |

Et trois fichiers de service, qui ne se lisent pas d'un bout à l'autre :
`DESIGN.md` (les tokens et les règles du système visuel), `DETTE-SITE.md` (ce
que l'app promet et que le site ne dit pas encore), `AMELIORATIONS-UI.md` (le
catalogue chiffré des améliorations UI **non faites**). Plus les deux recettes
d'acceptation qui ne se rejouent qu'au moment voulu : `RECETTE-AUTH.md`,
`RECETTE-SYNC.md`, `RECETTE-WINDOWS.md` (jamais exécutée, § 12).

> ⚠️ **La règle de documentation n'a pas changé** : une session qui a modifié le
> projet et n'a rien écrit n'a pas fini son travail. Ce qui change, c'est la
> destination — **l'état du projet vient ICI**, plus dans un fichier de chantier
> nouveau. Un chantier en cours peut ouvrir un fichier temporaire ; il se replie
> ici à la livraison, et disparaît.

---

## 1. Ce qu'est Shale, en une page

**Shale est une application de bureau de productivité et de trading**, vendue
par abonnement, accompagnée d'un site qui la présente, la vend et la distribue.

- **macOS (Apple Silicon)**, en **Tauri v2 (Rust) + React 19 + TypeScript +
  Tailwind v4 + Vite 7**. Version du bundle : `0.1.0`. Identifiant :
  `com.atnfx.shale`. Base locale : `shale.db`. Bibliothèque Rust : `shale_lib`.
- **Fork commercial de « Second Brain »**, le projet personnel dont elle est
  issue (specs d'origine `SPEC.md` / `SPEC-V2.md`, repliées au § 11.0).
- **Hors-ligne d'abord.** Toutes les données vivent dans **un seul fichier
  SQLite** sur la machine. Le réseau n'est **jamais** sur le chemin critique
  d'une action de l'utilisateur.
- **Mais plus « 100 % local » depuis le 2026-08-10** : dès qu'un compte est
  connecté, une **copie chiffrée de bout en bout** part vers Supabase. Le
  serveur stocke sans pouvoir lire. ⚠️ **La phrase « données 100 % locales » est
  FAUSSE et ne doit plus être écrite nulle part**, ni dans l'app, ni sur le site,
  ni dans la politique de confidentialité.
- **Treize modules** ✅ (compté dans `src/components/Sidebar.tsx` le 2026-09-18),
  en deux catégories, plus trois vues qui n'en sont pas :
  - *Productivité (10)* — Aujourd'hui, Tâches, **Calendrier**, Timer, Objectifs,
    Performance, **Finance**, Notes, Journal, Savoir ;
  - *Trading (3)* — Trading, Market-Brain, Position ;
  - *hors catégorie* — Réglages, Personnaliser (admin), Console.
  ⚠️ Le compte est passé de douze à treize le 2026-09-02 (Calendrier), et
  Benchmark a été **remplacé** par Finance le 2026-08-25. Tout document qui dit
  « douze modules » est antérieur à septembre.
- **Le morceau singulier, c'est le Market Brain** : un agent qui génère deux
  briefings par jour (8 h pré-Londres, 14 h pré-NY, heure de Paris) sur EUR/USD,
  GBP/USD, XAU/USD, NAS100, BTC/USD. Toutes les données de marché sont **sans
  clé** (Yahoo Finance, ForexFactory, RSS, Binance) ; seule la **rédaction**
  appelle un LLM (Gemini 2.5 Flash ou Groq Llama 3.3 70B) **avec la clé de
  l'utilisateur**, pas la nôtre.
- **Le site** — `https://www.shaleapp.com` — vend l'app, la distribue en
  téléchargement direct (`.dmg`), et héberge l'espace compte sous `/compte/`.

---

## 2. Où vivent les choses

```
~/Desktop/Shale-projet/
├─ SHALE.md              l'index du dossier (court) — pointe ici
├─ Shale/                L'APP. Dépôt git privé `shale-app`. Branche de travail : mobile-ios
│  ├─ PASSATION.md       ← CE FICHIER
│  ├─ CLAUDE.md · PIEGES.md · MOBILE.md · DOCUMENTATION.md
│  ├─ DESIGN.md · DETTE-SITE.md · AMELIORATIONS-UI.md · RECETTE-*.md
│  ├─ src/               React : views/ (16 vues), components/, lib/
│  ├─ src-tauri/         Rust : lib.rs, crypto.rs, sauvegardes.rs, notifications/, migrations/
│  └─ tools/             i18n-check, i18n-durs, icone-ios, licence-profil, verifier-sync-supabase
├─ shale-site/           LE WEB. AUTRE dépôt git `shale-site`. Branche : sync-chiffree
│  ├─ vitrine/           le site public (Astro) : vente, blog, légal, /edit
│  ├─ supabase/          schéma SQL, migrations, fonctions edge Stripe
│  ├─ JOURNAL.md         le journal du site — l'équivalent de ce fichier, côté web
│  └─ design/ marque/ archives/
├─ administratif/        ⚠️ HORS GIT, volontairement — INPI, SIREN, clés de licence
├─ marketing/            le plan de communication (PDF)
├─ shale-backups →       LIEN vers le disque externe « Crucial X6 »
└─ shale-backups.ancien-mac/   les sauvegardes prises avant le changement de Mac
```

**Deux dépôts git, pas un** : `shale-app.git` (privé — c'est pour ça que le
`.dmg` n'est pas servi par une release GitHub) et `shale-site.git`.
⚠️ **`Shale-Windows` n'existe plus** : ce worktree a été replié sur le tronc le
2026-08-26. Tout document qui le mentionne est périmé.

⚠️ **Des alias du Bureau pointent ici** (`~/Desktop/Shale`,
`~/Desktop/shale-site`). Des centaines de chemins, dans la doc, les scripts
`.command` et les `launch.json`, passent par eux. **Ne pas les supprimer.**

**Voisins, hors de ce dossier** : `~/Desktop/Shale-chantiers/` (rapports de
phase 0 et coordination inter-sessions), `~/Desktop/Prompt en attente/prompt/`
(les cadrages qu'Antonin écrit avant d'ouvrir un chantier),
`~/Desktop/Shale-brainstorm/`, `~/Desktop/shale-motion/` (les vidéos).

---

## 3. L'état — vérifié le 2026-09-18

| | |
|---|---|
| Branche de travail | ✅ **`mobile-ios`**, à `98dc4c8`. `main` est **249 commits en arrière** et n'est plus le tronc depuis longtemps |
| Arbre | ✅ **propre** |
| Poussé ? | ✅ **oui**, `origin/mobile-ios` à jour au 2026-09-18 (le dépôt du site aussi). Pour pousser sans Terminal : double-cliquer `Envoyer sur GitHub.command` |
| App installée | ✅ `/Applications/Shale.app`, binaire du **2026-09-16 à 10:38**, 21,2 Mo. C'est la version qui porte la feuille de route des objectifs |
| App en fonctionnement | ✅ **elle tourne** (processus `shale`, vue le 2026-09-18) |
| Base de données | ✅ **version 26** (`_sqlx_migrations`, 026 `feuille_de_route` jouée le 2026-09-16 à 10:40), 47 tables |
| Contenu réel | ✅ 3 objectifs · 2 tâches · 14 notes · 1 trade · 0 profil de licence |
| Synchronisation | ✅ **elle fonctionne** — dernier envoi ET dernière lecture le **2026-09-17 à 22:37 UTC**, curseur à 554. ⭐ **Cela prouve que la fenêtre de trousseau a été autorisée** après le build du 16 : c'était le dernier geste en attente, il est fait |
| File de sortie | ⚠️ `sync_outbox` contient **1 ligne** en attente — normal si l'app vient d'écrire ; anormal si ça ne bouge plus |
| Sauvegardes | ✅ automatiques dans `~/Library/Application Support/com.atnfx.shale/backups/` — la dernière du 2026-09-16 21:34. Plus les sauvegardes manuelles d'avant-chantier sur le disque externe |
| App iOS | *(d'après la doc)* simulateur iPhone 17 / iOS 26.5. **Sur l'iPhone RÉEL** : installée une fois le 2026-08-27, **profil expiré le 2026-09-03** — elle ne s'y lance plus (§ 10) |
| Windows | code sur le tronc, **jamais compilé** (§ 12) |

> ⚠️ **2026-09-22 — l'interface est passée au design system V7 « Ink & Azure »**
> (§ 11.z). ⚠️ **L'app INSTALLÉE ne la porte PAS encore** : aucun build natif n'a
> été fait, il est à grouper avec les chantiers voisins non installés (cases à
> cocher `6e8b0c7`, menus contextuels + corbeille). Le reste du tableau
> ci-dessus date du 2026-09-18.

### ⭐ Ce qui a changé par rapport à ce que disait la documentation
1. **Le geste de trousseau est fait.** Tous les documents d'avant le 2026-09-18
   le donnaient « en attente ». La synchronisation a tourné hier soir : il est
   fait. Plus rien n'attend un clic d'Antonin.
2. **`cargo check --all-targets` PASSE.** ✅ Mesuré. `SHALE.md` affirmait depuis
   le 2026-08-11 qu'il échouait, « dette connue, ne pas la re-diagnostiquer » :
   c'est faux aujourd'hui.
3. **Antonin s'est servi de la feuille de route.** La vraie base porte un
   troisième objectif, créé **en mode mesuré** (`manual_progress = 0`) — les
   deux anciens restent manuels, exactement comme la décision n° 2 du chantier
   le prévoyait.

---

## 4. La ligne de base — rejouée ENTIÈREMENT le 2026-09-20

Tout est vert. **Un échec est donc un vrai échec** : il n'y a aucune dette
connue derrière laquelle se cacher.

```
npx tsc --noEmit                              ✅
npm run test:types                            ✅   (ce n'est PAS le même que le précédent)
npm test                                      ✅   1273 tests, 91 fichiers, 54 s  (2026-09-22)
npm run i18n:check                            ✅   0 clé manquante, 0 doublon, 2021 entrées
npm run i18n:durs                             ✅   0 chaîne sûrement française (58 à vérifier)
npx vite build                                ✅
cd src-tauri
cargo check --all-targets                     ✅
cargo test --lib                              ✅   133 tests
```

⚠️ **`npx tsc --noEmit` NE REMPLACE PAS `npm run test:types`** : le premier passe
pendant que le second échoue, parce que les fabriques des `*.test.ts` ne
compilent que sous `tsconfig.test.json`. **Jouer les deux.**

⚠️ **Machine calme pour `npm test`** : l'« intermittence PGlite » a une cause
mesurée, c'est la charge machine (`PIEGES.md` § 9.11). Si un test tombe,
**capturer son nom AVANT de relancer**.

⚠️ **Démonter le mode démo avant de rejouer la ligne de base** :
`grep -r AUDIT-TEMP src/` doit rendre zéro, et `git diff --exit-code src/lib/auth/`
doit passer. Le patch de mode démo fait sortir deux erreurs TypeScript qui ne
sont pas des régressions (`PIEGES.md` § 1.2 ter).

---

## 5. L'architecture, en un coup d'œil

```
   App macOS (Tauri)            ┌────────────────────────────────┐
   ┌───────────────────┐        │  Supabase  (pdlprlddouzacinfpkes)
   │ React 19 (webview)│        │   · auth (GoTrue)              │
   │        ↕ invoke   │        │   · subscriptions / my_subscription
   │ Rust  (shale_lib) │        │   · activations  · admins      │
   │        ↕          │        │   · sync_rows   (blobs chiffrés)
   │ SQLite  shale.db  │──────▶ │   · site_content (textes /edit)│
   │  = LA VÉRITÉ      │ copie  │   · license_profiles (signés)  │
   └───────────────────┘chiffrée└────────────────────────────────┘
                                          ▲            ▲
   Site Astro (Vercel)  ─────────────────┘            │
   + espace compte /compte/                    Stripe ┘ (webhook, LIVE)
```

- **L'app lit et écrit toujours en local**, dans
  `~/Library/Application Support/com.atnfx.shale/shale.db`.
- **Le Rust fait ce que le navigateur ne sait pas faire** : SQLite, le
  trousseau (`secrets.rs`), la dérivation de clé (`crypto.rs`, Argon2), les
  sauvegardes (`sauvegardes.rs`), les notifications et la planification
  (`notifications/`), la capture rapide globale (`note_rapide.rs`).
- **Le site est 100 % statique** (Astro), déployé sur Vercel depuis le dépôt,
  racine `vitrine`. Chaque `git push` redéploie. `compte/site/` est **copié**
  dans `dist/compte/` par une intégration d'`astro.config.mjs` : un seul
  domaine, un seul déploiement.
- **Le droit ne vit PAS dans SQLite** : la base locale ne stocke aucun droit.
  `src/lib/features.ts` dit ce qui est « trading », `src/lib/entitlements.ts`
  dit ce dont un compte dispose, `src/lib/auth/access.ts` dit qui a le droit
  d'entrer. Trois fichiers, trois questions distinctes.
- **Le gating est une garde de navigation**, pas un masquage : `App.tsx` expose
  `navigate()` et garde `setView` privé. Il n'y a pas d'URL dans l'app — cette
  garde en tient lieu.

---

## 6. Les treize modules, un par un

| Module | Ce qu'il fait | À savoir |
|---|---|---|
| **Aujourd'hui** | le tableau de bord : widgets redimensionnables sur une grille, tâches du jour, charge, objectifs, horloge de marché | c'est l'écran qui s'ouvre. Les widgets ont une structure et des contraintes propres (`CLAUDE.md`, 2026-07-21) |
| **Tâches** | tâches, sous-tâches, récurrence, dates, rattachement à un objectif | une tâche récurrente ne compte pas « en binaire » pour un objectif : elle alimente un nombre |
| **Calendrier** | le 13ᵉ module (2026-09-02). Événements, multi-jours, récurrence, saisie à la minute, roulette d'heure | migrations 020 et 021. « journée entière » s'annonce encore comme « 1 tâche sans horaire » — mot faux, compte juste, **non corrigé faute de mandat** |
| **Timer** | Pomodoro, sessions de focus, plein écran | |
| **Objectifs** | ⭐ **refondu le 2026-09-16** : un objectif se découpe en jalons ordonnés, puis en sous-objectifs ; le pourcentage se **déduit**, il ne se saisit plus | migration 026. Voir § 11 (2026-09-16) — c'est le dernier gros chantier |
| **Performance** | métriques personnalisées, habitudes, séries, graphiques (recharts) | |
| **Finance** | remplace Benchmark (2026-08-25). Comptes, soldes, positions, cours, récurrents — **et la facturation** depuis le 2026-09-10 | migrations 018, 019, 023. ⚠️ Deux écrans manquent pour un usage réel : **l'émetteur** (identité, SIRET, régime) et **les tiers**. Sans eux, aucune facture ne peut être adressée à quelqu'un |
| **Notes** | éditeur riche, recherche plein texte (FTS5), mentions `@`, **cartes mentales** (SVG, export PNG/SVG) | le chantier H (2026-09-06) a corrigé une **perte de données** : le contenu d'une note s'écrivait dans une autre |
| **Journal** | entrées datées | |
| **Savoir** | base de connaissances. ⭐ **Un seul objet depuis le 2026-09-07 : le SUJET** — les « thèmes » et les « objets » ont fusionné (migration 022) | le chiffre qui a tranché : 5 jours après la livraison des objets, 4 thèmes utilisés, **0 objet** |
| **Trading** | journal de trades en R, modes live / backtest | verrouillé hors offre trading |
| **Market-Brain** | les deux briefings quotidiens (§ 1) | verrouillé hors offre trading |
| **Position** | calculateur de taille de position, alertes, historique | verrouillé hors offre trading |

Et les trois vues qui ne sont pas des modules : **Réglages** (langue, apparence,
densité, sauvegardes, synchronisation, raccourcis), **Personnaliser** (admin :
réordonner et masquer les modules), **Console**.

⚠️ **La Console affiche des données de DÉMONSTRATION**, pas les vrais comptes
(`ConsoleView.tsx`, en-tête du fichier). Elle attend d'être branchée sur
Supabase via une session admin ou une fonction edge. Personne ne doit lire ses
chiffres comme une réalité commerciale.

---

## 7. La base locale, et ses vingt-six migrations

Un seul fichier SQLite, 47 tables, migrations jouées par `sqlx` au démarrage et
enregistrées dans `_sqlx_migrations`. Les fichiers sont dans
`src-tauri/migrations/`, et **chacun doit être déclaré dans `lib.rs` ET dans
`schema.testutil.ts`** — oublier le second fait échouer les tests d'une façon
qui n'accuse pas la migration.

| # | Nom | Ce qu'elle apporte |
|---|---|---|
| 001–005 | initial, performance, capture, focus, notes | le socle : tâches, objectifs, métriques, capture rapide, notes + FTS5 |
| 006–009 | trading, trade_mode, position_sizing, benchmark | le côté trading |
| 010–012 | market, goal_category, live_tracker | Market Brain, catégories d'objectifs, tracker live |
| 013–014 | knowledge, knowledge_text | le module Savoir |
| 015–017 | sync_identity, sync_outbox, sync_state_device | la synchronisation chiffrée |
| 018 | finance | le module Finance |
| 019 | drop_benchmark | Benchmark est retiré, Finance le remplace |
| 020 | calendrier_liaisons | le socle du calendrier et des liaisons entre objets |
| 021 | evenements_multi_jours | `end_date` |
| 022 | fusion_sujets | thèmes + objets = le SUJET |
| 023 | facturation | factures, séries, lignes, paiements, émetteur, tiers |
| 024 | onboarding_exemples | le contenu de départ du premier lancement |
| 025 | licence_profil | le cache local du profil de licence signé |
| 026 | feuille_de_route | ⭐ dix colonnes, **zéro table nouvelle** : un jalon EST un objectif |

⚠️ **Avant tout build natif qui porte une migration : sauvegarder la base avec
`sqlite3 .backup`, JAMAIS avec `cp`** — la base est en WAL, une copie de fichier
donne un état incohérent. Puis vérifier `integrity_check` et `foreign_key_check`
après la relance.

---

## 8. La synchronisation chiffrée

C'est le gros chantier de l'été (2026-08-02 → 2026-08-10), et ce qui change le
plus la nature du produit.

- **Hors-ligne d'abord, chiffré de bout en bout.** SQLite local reste la source
  de vérité ; une file (`sync_outbox`) part vers `sync_rows` quand le réseau est
  là. Conflit : **last-write-wins par ligne**, avec pierres tombales pour que
  les suppressions ne ressuscitent pas. Le départage est **appliqué par le
  serveur**, pas par le client — et c'est testé contre un vrai PostgREST.
- **Périmètre : toute l'app.** Les tables synchronisées sont listées dans
  `src/lib/sync/scope.ts`, **source unique**. Un test échoue si une table de la
  base n'est ni synchronisée ni explicitement écartée **avec son motif** : une
  table ajoutée plus tard ne peut pas disparaître en silence de la sauvegarde.
- **Connecté = synchronisé.** Rien à activer, pas de code de récupération à
  noter. La clé est dérivée du mot de passe, saisi **au vol** à la connexion,
  via un « sas » (`src/lib/sync/sas.ts`) qui est **une variable de module, pas
  un état React** — un mot de passe dans un état React se retrouverait dans les
  outils de développement.
- **Le prix de cette simplicité** : si le mot de passe est réinitialisé **et**
  qu'aucun appareil ne détient plus la clé, la copie cloud est irrécupérable
  (statut `orpheline`). **Les données locales restent intactes.** La sortie est
  `republier(motDePasse)` — et ses conséquences sont dites **avant** l'action.
- **Le cache du profil de licence est HORS synchronisation**, décision de portée
  du 2026-09-13 (`PIEGES.md` § 12.1).

---

## 9. Le commerce

**La boutique est ouverte depuis le 2026-08-31** : `STRIPE_ENABLED = true` ✅
(`src/lib/auth/config.ts:93`), Stripe en LIVE, prouvé par un vrai paiement
encaissé puis remboursé.

### Les offres

| Offre | Code | Mensuel | Annuel | Contenu |
|---|---|---|---|---|
| Shale | `shale` | 12 € | 96 € (8 €/mois) | les modules de productivité |
| **Shale Pro** | `shale_pro` | 19 € | 180 € (15 €/mois) | + le trading |
| **Shale Business** | `shale_business` | 29 €/siège | 288 €/siège (24 €/mois) | 2 à 5 sièges en ligne, au-delà sur devis |
| *Shale Trade* | `shale_trade` | — | — | **ancienne** offre, encore reconnue par l'app, **plus vendue par le site** |

Source unique des prix affichés : `shale-site/vitrine/src/lib/tarifs.ts`. ⚠️ Ce
qui fait foi pour l'**encaissement**, ce sont les prix Stripe — et **rien ne
vérifie automatiquement que les deux sont d'accord**.

⚠️ **Franchise en base de TVA** (art. 293 B du CGI) : aucune TVA n'est facturée.
C'est la raison pour laquelle les CGV ont dû être réécrites — elles promettaient
un taux par pays via le régime OSS, ce qui est impossible sous ce régime.

### Les murs, et lequel s'applique

**Un seul à la fois**, selon `STRIPE_ENABLED` (`src/lib/auth/access.ts`) :
- **Stripe allumé** (aujourd'hui) → le mur est le **paiement**. La table
  `public.activations` n'est plus consultée : un abonné jamais invité entre.
- **Stripe éteint** → le mur redevient l'**activation** manuelle, compte par
  compte. Le retour en arrière est sûr : la table n'est ni supprimée ni vidée.

⚠️ Les deux ne se **cumulent pas** — un commentaire du dépôt a affirmé
l'inverse jusqu'au 2026-08-30 en décrivant une règle que le code n'appliquait
plus.

**L'essai de 7 jours est réel et ne dépend pas de Stripe** : un trigger ouvre une
ligne `trialing`, et la vue `my_subscription` **recalcule le statut à chaque
lecture** — reculer l'horloge de sa machine ne prolonge rien.

### Les profils de licence sur devis (2026-09-13)

Un compte peut recevoir du serveur un **profil signé** qui masque, réordonne et
renomme ses modules — **sans jamais rien déverrouiller** : un profil borne
l'affichage, jamais les droits. Clés de signature dans
`administratif/licence-profils/` (la privée **n'est pas dans git**, et ne doit
jamais y entrer). Émission : `node tools/licence-profil.mjs emettre …`, puis le
SQL produit se colle dans Supabase Studio.

✅ **Aucun profil n'est émis à ce jour** (0 ligne dans `license_profile`) : à
l'écran, rien ne change pour personne.

⚠️ **Un texte signé ne se normalise JAMAIS** — ni `jsonb`, ni `timestamptz`, ni
`JSON.stringify` : la signature porte sur des octets exacts (`PIEGES.md` § 12.4).

---

## 10. iOS — où on en est vraiment

> ⚠️ **Dans toute la documentation, « iPhone » veut dire LE SIMULATEUR**, sauf
> aux endroits qui disent explicitement le contraire. La confusion s'est
> produite le 2026-08-27 et fait chercher une app qui n'est pas là.

- **Le portage tient debout** depuis le 2026-08-27 : l'app se construit, se
  lance, franchit le mur de connexion, et les quatorze écrans ont été passés en
  revue un par un (`MOBILE.md` § 15 à 21).
- **Sur l'iPhone RÉEL d'Antonin** (iPhone 16), Shale a été installée **une fois**,
  le 2026-08-27 à 17 h 04, avec un profil de **compte Apple gratuit**. ⛔ **Ce
  profil a expiré le 2026-09-03** : l'app est toujours sur le téléphone mais
  **refuse de s'ouvrir**. La remettre en état demande de rebrancher le
  téléphone, reconstruire, réinstaller — et ça durera encore 7 jours.
- **Tout ce qui a été livré depuis septembre** (Calendrier V2, cartes mentales,
  facturation, accueil, feuille de route) a été vérifié **au simulateur ou en
  émulation Chrome**, jamais sur l'appareil réel.
- **Le clavier** : ouvrir le clavier ne change PAS `innerHeight` sur iPhone
  (`PIEGES.md` § 7.4 bis). **Au doigt, glisser et défiler sont le même geste**
  (§ 7.4 ter) — c'est la contrainte qui décide de la plupart des interactions.
- ⚠️ **Ne JAMAIS lancer `simctl uninstall` ni `simctl erase`.** Et
  `simctl install` par-dessus une app existante **peut provisionner un NOUVEAU
  conteneur** et faire disparaître l'ancien : deux notes non synchronisées ont
  été détruites comme ça le 2026-09-07 (`PIEGES.md` § 9.10). **Copier la base
  avant d'installer** est la seule parade.

---

## 11. La chronologie des chantiers — ce qui a été construit, et quand

*Une ligne par chantier. Le **pourquoi** de chacun est dans la section datée du
même jour de `CLAUDE.md` — c'est là qu'il faut aller avant de défaire quoi que
ce soit.*

### 11.0 L'origine (juillet 2026)
Second Brain V1 (tableau de bord local, tâches, objectifs, performance) puis V2
« Jarvis » (interface HUD, modules de la boucle capture → focus → exécution →
journal → revue). **Jarvis, le pilotage vocal, a été purgé le 2026-07-26** : il
ne reste que le squelette de modules. Les specs d'origine ont été repliées ici
le 2026-09-18 ; leur seule survivance utile est cette phrase.

| Date | Chantier |
|---|---|
| 07-11 → 07-13 | Refonte UI, widgets redimensionnables, code-splitting, catégories de barre latérale, tracker live, horloge de marché |
| 07-21 | ⭐ **Design system V6 « Obsidian & Jade »** (remplace V5) · info-bulles · onglet **Savoir** |
| 07-23 | Anti-superposition des poignées, refonte du Timer |
| 07-26 | Mode fenêtré / split-screen, **purge de Jarvis** |
| 07-27 | Essai gratuit 7 jours, typographie unifiée, logo « Strates », **notifications intelligentes** (moteur Rust) |
| 07-28 | **Bilingue FR / EN** |
| 08-02 | ⭐ **Deux offres + gating trading** · début de la synchronisation chiffrée |
| 08-05 | **Support Windows** (code écrit, jamais compilé) · la sync passe de « testé » à « livrable » |
| 08-10 | ⭐ **Authentification réelle** · l'espace compte rentre dans le site · **connecté = synchronisé** |
| 08-11 | Le domaine `shaleapp.com` est acheté et branché ; regroupement des quatre dossiers |
| 08-13 | L'accès se donne **compte par compte** · un doublon dans son propre lot bloquait la sync |
| 08-25 | ⭐ **Finance remplace Benchmark** |
| 08-26 | Savoir : l'accueil devient une grille de **thèmes** · **réconciliation Windows sur le tronc** · une seule app installée, et c'est `/Applications/Shale.app` |
| 08-27 | ⭐ **Portage iOS** : le squelette tient, le mur de connexion tombe, l'app tourne sur l'**iPhone réel** à 19 h |
| 08-28 | ⭐ **Chantier UI/UX + audit i18n complet** (246 clés anglaises ajoutées) · **Densité absorbe Dynamic Type** — et le piège des unités de viewport |
| 08-31 | ⭐⭐ **La boutique ouvre** : Stripe en LIVE, mentions légales complètes |
| 09-02 | ⭐ **Socle Calendrier & Liaisons** (migration 020) · le **13ᵉ module** · les mentions `@` entre objets · la parité iPhone |
| 09-04 | Mise en service chez Antonin · ⭐ ouverture de `DOCUMENTATION.md` |
| 09-05 → 09-06 | ⭐ **Calendrier V2** (saisie à la minute, multi-jours, récurrence, roulette d'heure) · ⭐⭐ **chantier H : le contenu d'une note se retrouvait dans une autre** |
| 09-07 | ⭐ **Cartes mentales** dans les Notes et le Savoir · **thèmes + objets = le SUJET** (022) · **checkup complet** : 5 défauts, 2 affirmations de doc fausses |
| 09-08 | ⭐ Le côté d'une branche se **porte**, il ne se déduit plus |
| 09-10 | ⭐ **Facturation dans Finance** (023, Factur-X non certifié, et c'est dit) · ⭐ **le premier démarrage** : un accueil qui CONFIGURE (024) |
| 09-12 | L'icône iOS sans halo · l'animation d'entrée devient réglable |
| 09-13 | ⭐ **Profils de licence sur devis** (025) |
| 09-14 | Les offres **Pro** et **Business** reconnues par l'app |
| 09-15 → 09-16 | ⭐⭐ **La feuille de route des objectifs** (026) · **refonte du site en ligne** |

### ⭐ Le dernier chantier, en détail — la feuille de route des objectifs (2026-09-16)

C'est le seul qu'il faut connaître en détail, parce qu'il vient d'arriver chez
Antonin et qu'il change une habitude.

**Le pourcentage d'un objectif ne se déclare plus : il se déduit.** Un objectif
se découpe en **jalons ordonnés**, puis en sous-objectifs ; chaque étape avance
soit par ses **éléments réels** (tâches cochées, rendez-vous tenus), soit par un
**nombre à atteindre** (50 backtests, 10 000 €, jours d'habitude tenue). Le
chiffre est calculé **à la lecture**, et chaque ligne dit d'où il vient.

Les six choses à savoir sans lire le code :
1. **La barre manuelle n'est pas morte** — elle reste pour un objectif qui ne se
   découpe pas, et `manual_progress = 1` reste **souverain**. ✅ Les objectifs
   déjà saisis gardent leur chiffre : rien ne bouge sans un geste.
2. **Écrire n'est pas avancer** : une note ou une fiche rattachée s'affiche
   comme ressource et ne fait **jamais** monter le pourcentage.
3. **« 100 % » n'est pas « terminé »** quand des étapes sont restées vides :
   elles sont exclues du calcul, comptées à part, et le calendrier le signale.
4. **`count_since`** borne le compte « depuis le rattachement » : une habitude
   tenue depuis trois mois ne fait pas apparaître un objectif à moitié fait.
5. **L'accueil du premier lancement plante le premier objectif** avec jusqu'à
   trois étapes **tapées par l'utilisateur** — l'app n'en suggère aucune.
6. **Migration 026, zéro table nouvelle** : un jalon est un objectif, avec un
   parent et un rang.

⚠️ **Ce qui n'a pas été vu** : le plafond `MAX_ALERTES` (prouvé par le code, pas
à l'écran avec six jalons datés) et le rendu **natif** du rattachement entre
deux vrais appareils. Et une **question non tranchée** : un objectif en péril ET
ses jalons en péril produisent plusieurs alertes ; le plafond les tient à deux
lignes, mais on pourrait n'afficher que la plus précise.

---

### 11.x Le 2026-09-22 — cocher / décocher

| Date | Chantier |
|---|---|
| 09-22 | ⭐ **Une tâche ponctuelle cochée un autre jour se décoche enfin** (`basculerTache`) · case à cocher unique `CaseACocher` (Aujourd'hui, Tâches, habitudes, feuille de route), instantanée au clic, zone de clic élargie |

Aucune migration, aucun Rust. ⛔ Rebuild natif dû, à grouper. Pourquoi :
`CLAUDE.md` section du 2026-09-22 ; pièges : `PIEGES.md` § 20.

---

### 11.x Le 2026-09-18 — champ de date unique, et la tâche depuis l'objectif

| Date | Chantier |
|---|---|
| 09-18 | ⭐ **`ChampDate` remplace les treize `<input type="date">` de l'app** (calendrier en portail, à la Apple, clavier conservé) · **« ＋ Tâche »** visible dans la feuille de route, avec son échéance · l'échéance s'affiche sur la ligne d'une tâche, en rouge si elle est passée |

**Aucune migration, aucun Rust, aucune dépendance npm.** ⚠️ Mais **un rebuild
natif reste dû** : l'app installée date du 2026-09-16 et ne porte pas ce
chantier. Le pourquoi est dans la section datée du 2026-09-18 de `CLAUDE.md`,
les pièges dans `PIEGES.md` § 16, l'iPhone dans `MOBILE.md` § 23, le site dans
`DETTE-SITE.md` § N.

---

## 12. ▶️ Ce qui reste — et qui décide

**Rien n'est « en cours ».** La file de réparations est vide : tout ce qui suit
attend une décision d'Antonin, un achat, ou une machine.

### 12.1 Ce qui attend un geste ou une dépense d'Antonin

| Sujet | Où ça bloque | Ce que ça coûte |
|---|---|---|
| ⛔ **L'app n'est ni signée ni notarisée** | `bundle.macOS` vide dans `tauri.conf.json`. macOS met le `.dmg` en quarantaine : le visiteur doit le débloquer à la main **juste après le clic que tout le site sert à provoquer** | **compte Apple Developer, 99 $/an.** C'est le frein n° 1 sur l'objectif n° 1 |
| ⛔ **Windows n'a jamais été compilé** | le code est sur le tronc, audité ; la compilation croisée depuis macOS est **impraticable** (essayée, tranchée, avec preuve) | une machine, une VM ou un runner CI. ⚠️ **Ne pas re-litiger ce point.** Publier = déposer `Shale_x64-setup.exe` dans `vitrine/public/telechargements/` et renseigner `config.exeWindows` |
| **Certificat Authenticode Windows** | sans lui, SmartScreen avertit à chaque installation | ~200–400 €/an |
| **L'iPhone réel** | profil expiré le 2026-09-03 (§ 10) | rebrancher le téléphone ; ou le compte Apple Developer, qui règle les deux |
| **Achat réel Pro / Business** | le tunnel est en ligne, **aucun achat de bout en bout n'a été fait** sur ces deux offres | un vrai paiement, remboursé ensuite |
| **Ménage du DerivedData Xcode** | proposé, **sans réponse**. Quatre bundles iOS traînent. Les effacer force une reconstruction complète | un mot |
| ~~**Le disque est plein**~~ | ✅ **RÉGLÉ le 2026-09-18** : le disque est passé de **8,2 Go à 28 Go de libre** (67 % → 37 % d'occupation). Voir § 13.6 pour ce qui a été supprimé et ce que ça coûte de le refaire | — |
| **L'ancien projet `~/Desktop/appli claude`** | c'est **Second Brain**, l'ancêtre dont Shale est le fork. Sa source (150 Mo) est là, **hors de tout dépôt git** — donc elle n'existe qu'ici. Son cache de compilation (9,7 Go) a été supprimé le 2026-09-18 | **Antonin** : garder la source, l'archiver sur le disque externe, ou s'en défaire |
| **`Second Brain.app`** dans `/Applications` (2026-07-26) et ses données | 182 Mo, dont un modèle de reconnaissance vocale de 181 Mo (`ggml-small-q5_1.bin`) pour une fonction **purgée de Shale depuis le 2026-07-26**. ⚠️ Sa base `second-brain.db` (856 Ko) contient des données d'avant le fork | **Antonin** : rien n'a été supprimé, c'est de la donnée personnelle |

### 12.2 Les décisions ouvertes, techniques

| Sujet | État | Qui tranche |
|---|---|---|
| **px → rem** | Le but *accessibilité* est atteint autrement (Densité absorbe Dynamic Type) : un `rem` **ne suit pas** Dynamic Type dans une WKWebView. Ce qui reste est un argument de cohérence avec le site — **136 valeurs, 40 fichiers**, risque sur `.hud-label` | **Antonin** |
| **Cibles tactiles de 44 pt** | `.cible-tactile` existe et sert à 28 endroits. Ce qui reste ouvert est le **tri exhaustif** des cibles encore sous 44 px | **Antonin** |
| **Palette mi-tokens mi-hex** (`TAG_COLORS`, `HABIT_COLORS`) | Écarté : la moitié « lignes déjà en base » est une **migration de données**, et n'en faire que la moitié laisserait un état mixte pire | **Antonin** |
| **Grille en dents de scie à 720 px** | Écarté : moteur de grille, pur confort | **Antonin** |
| **« journée entière » annoncé comme « 1 tâche sans horaire »** | compte juste, mot faux. **Non corrigé faute de mandat** | **Antonin** |
| **Plusieurs alertes pour un objectif et ses jalons** | le plafond les tient à deux lignes ; on pourrait n'afficher que la plus précise | **Antonin** |
| **`Alt+Espace` → `Ctrl+Alt+Espace` sur Windows** | raccourci réservé par le système ; choix proposé, **jamais arbitré** | **Antonin** |
| **macOS 14+ ou 10.13 ?** | le site promet 14+, le bundle déclare `LSMinimumSystemVersion 10.13`. Soit le site descend, soit le bundle monte | **Antonin** |
| **Les douze raccourcis clavier** annoncés jadis par le site | retirés du site ; les implémenter dans l'app reste une option | **Antonin** |
| **Android** | prévu par la stratégie de l'été, dépend de la sync — qui est faite. Le gros du travail est un **chantier design**, pas un portage | **Antonin** |

### 12.3 Ce qui est incomplet dans l'app, et qui se sait

- **Finance sait facturer, mais deux écrans manquent** : l'émetteur (identité,
  SIRET, régime) et les tiers. Les accès aux données existent des deux côtés et
  sont testés ; sur la vraie base, il n'y a **aucun client** — donc aucune
  facture ne peut encore être adressée à quelqu'un.
- **Factur-X n'est pas un PDF/A-3 certifié**, et c'est dit aux trois endroits où
  quelqu'un pourrait le croire : dans `CLAUDE.md`, dans `facturx.ts`, et à
  l'écran.
- **La Console montre des données de démonstration** (§ 6).
- **Les états d'erreur natifs** (SQLite illisible, trousseau refusé, réseau
  coupé) **n'ont jamais été vus** : ils ne sont pas auditables en mode démo.
- **La capture du module Objectifs, sur le site, montre l'ANCIENNE vue**
  (`DETTE-SITE.md` § M.2) : aucun générateur n'existe pour cette famille
  d'images.

---

## 13. Les procédures — les six gestes qui reviennent

### 13.1 Reconstruire et installer l'app macOS

⚠️ **Antonin utilise l'app INSTALLÉE, pas le mode dev.** Toute modification
significative (front, Rust, et **obligatoirement** `capabilities/*.json`,
`tauri.conf.json` ou une migration SQL) doit se conclure par une reconstruction
et une réinstallation, sinon il utilise une version périmée sans le savoir.

```
# 1. SAUVEGARDER LA BASE — jamais un `cp`, la base est en WAL
sqlite3 "$HOME/Library/Application Support/com.atnfx.shale/shale.db" \
        ".backup '<dossier>/shale.db'"
# 2. Construire
npm run tauri build
# 3. Installer avec `ditto`, jamais `cp -R`
ditto src-tauri/target/release/bundle/macos/Shale.app /Applications/Shale.app
# 4. Prouver que c'est bien la neuve : comparer les condensats sha256
```

Les quatre pièges qui font livrer une version périmée :
1. **`tauri build` fige le front AU DÉBUT**, puis compile le Rust pendant des
   minutes : une modification du front faite pendant la compilation **n'est pas
   dedans** (`PIEGES.md` § 7.5 bis). Vérifier `dist/assets`, pas le binaire.
2. **Chercher des CHAÎNES dans le bundle, jamais des noms de fonction** — la
   minification les renomme. Et les chaînes du front **ne sont pas** dans le
   binaire Rust : les assets y sont compressés.
3. **`/Applications/Shale.app` peut être remplacée PENDANT le build** sans
   `ditto` (§ 10.6) : une seule `Shale.app` doit rester lançable.
4. **Le trousseau** : macOS redemande l'accès dès que le **binaire** change.
   Antonin doit cliquer **« Toujours autoriser »**, et **aucune session ne peut
   le faire à sa place**. ⭐ **Grouper les builds** : chaque build lui coûte une
   fenêtre de trousseau.

### 13.2 Auditer l'interface sans toucher aux vraies données

`AuthGate` bloque, et une session Claude ne saisit pas d'identifiants. Deux
lignes à modifier **localement, JAMAIS à committer** :

```
src/lib/auth/config.ts:15   →  export const SUPABASE_URL = "";
src/lib/auth/useAuth.ts:364 →  if (!jeton && AUTH_CONFIGURED) {
```

Puis `npx vite --port 5199`. L'app s'ouvre en **mode démo** : `isTauri` est
faux, les données viennent de `src/lib/demo.ts`, **aucun réseau, aucune vraie
donnée**. Pour l'anglais : `localStorage.setItem("shale.lang","en")`.

⚠️ **Restaurer ensuite, et le vérifier** : `grep -r AUDIT-TEMP src/` doit rendre
zéro et `git diff --exit-code src/lib/auth/` doit passer.
⚠️ **Auditer en `tauri dev` piloterait la VRAIE base d'Antonin**, avec un risque
d'écriture à chaque `Tab` ou `Entrée`. Le mode démo n'est pas du confort.
⚠️ **Vérifier dans Chrome piloté, pas dans le panneau navigateur** : caché, il
ne rend ni les scripts ni les animations, et son viewport vaut 0×0 — il fait
croire à du code cassé (`PIEGES.md` § 11.6).

### 13.3 Émettre un profil de licence

```
node tools/licence-profil.mjs emettre --compte <uid> --profil <fichier.json>
```
puis coller le SQL produit dans Supabase Studio → SQL Editor. La clé privée est
dans `administratif/licence-profils/`, **hors git**, et ne doit jamais y entrer.

### 13.4 Pousser sur GitHub
Double-cliquer **`Envoyer sur GitHub.command`** à la racine du dossier. Il pousse
les deux dépôts, ne commite rien, et dit ce qui reste non commité.

### 13.5 Faire de la place sur le disque — ce qui est jetable, ce qui ne l'est pas

*Fait le 2026-09-18 : de 8,2 Go à **28 Go** de libre. Le tout s'est reconstruit
en **2 minutes**, `cargo check --all-targets` compris — le coût est très
inférieur à ce que la taille des dossiers laisse croire.*

**Jetable sans réfléchir** — tout se reconstruit, rien n'est suivi par git :

```
rm -rf src-tauri/target/debug                    # 4,6 Go
rm -rf src-tauri/target/aarch64-apple-ios-sim    # 3,7 Go
rm -rf src-tauri/target/aarch64-apple-ios        # 624 Mo
rm -rf src-tauri/gen/apple/Externals             # 465 Mo
rm -rf src-tauri/gen/apple/build                 # 109 Mo
rm -rf ~/Library/Developer/Xcode/DerivedData/*   # 198 Mo
npm cache clean --force && rm -rf ~/.npm/_npx    # 2,7 Go
git gc --prune=now                               # dans les deux dépôts
```

⚠️ **`gen/apple` n'est PAS jetable en entier.** Seuls `Externals/` et `build/`
le sont : les **20 autres fichiers sont suivis par git et édités à la main** —
`project.yml`, `Info.plist`, les entitlements, le `LaunchScreen.storyboard`, et
surtout `Assets.xcassets`, que `tauri icon` ne régénère pas (`PIEGES.md` § 11.2).
Un `rm -rf gen/apple` ferait perdre le travail d'icône du 2026-09-12.

**À garder** :
- `src-tauri/target/release` (1,4 Go) — c'est lui qui rend le prochain
  `tauri build` rapide, et le prochain build est celui qui part chez Antonin ;
- `~/.cargo/registry` (336 Mo) — c'est ce qui permet de tout recompiler sans
  rien retélécharger ;
- `dist/` — c'est `dist/assets` qui fait foi pour vérifier ce qu'un bundle
  contient (§ 13.1).

**Jamais** : `shale-backups/`, `shale-backups.ancien-mac/`, `administratif/`,
et la base `second-brain.db` de l'ancien projet. Ce sont des données, pas des
caches.

### 13.6 Les commandes du site
```
cd ~/Desktop/shale-site/vitrine
npm run dev                      # port 4321, /compte/ inclus
npm run build && npm run check   # AVANT toute publication — six outils
node tools/legal-export.mjs      # régénère compte/site/legal.html (JAMAIS édité à la main)
```
Chaque `git push` sur le dépôt du site redéploie Vercel en une minute environ.

---

## 14. Les règles qui coûtent cher quand on les oublie

*Les dix qui ont réellement mordu. Les cent dix autres sont dans `PIEGES.md`.*

1. ⭐ **`i18n:check` au vert ne veut PAS dire « traduit ».** Une phrase
   française écrite en dur dans le JSX lui est **invisible**. `i18n:check`
   répond « toute clé passée à `t()` a-t-elle sa traduction ? », `i18n:durs`
   répond « quel texte affiché ne passe PAS par `t()` ? ». **La preuve finale
   n'est ni l'un ni l'autre : c'est l'app basculée en anglais.**
2. ⭐ **Jamais de `t()` dans une CONSTANTE de module** — évaluée à l'import,
   donc figée dans la langue de démarrage. Les tables de libellés gardent la
   phrase française comme **valeur** et sont traduites **à l'affichage**.
3. **Ne jamais nommer une variable locale `t`, `tp` ou `pick`.**
4. ⭐ **Le défaut le plus facile à commettre est la MOITIÉ** : un `data-tip`
   traduit au-dessus d'un `data-tip-sub` en dur.
5. ⭐ **`getComputedStyle` n'est pas une preuve de couleur** ici : Chromium rend
   une valeur périmée sous `backdrop-filter`. **La capture d'écran tranche.**
   Et pour changer de thème, passer par Réglages → Apparence, jamais par
   l'attribut `data-theme`.
6. **Tout `vh`/`vw` doit être multiplié par `--zoom-inv`** : le `zoom` CSS de
   « Densité » multiplie AUSSI les unités de viewport.
7. **La couche `utilities` de Tailwind bat la couche `components`** à
   spécificité égale : le dépôt s'est fait prendre deux fois, d'où des
   `!important` explicitement commentés.
8. ⭐ **Aucun test de ce dépôt ne prouve une interface** (§ 7.1 de `PIEGES.md`).
   Un test qui passe ne prouve rien tant qu'on ne l'a pas vu **échouer**.
9. ⚠️ **Ne jamais faire un `pkill` par motif** : plusieurs sessions travaillent
   en parallèle dans le même dossier, et on tue les serveurs des voisines. Pour
   la même raison, **ne jamais faire `git add -A`** : ajouter ses fichiers par
   nom.
10. ⭐ **Un outil de contrôle porte ses propres hypothèses, et elles
    vieillissent.** Quand un contrôle est vert et que l'écran dit le contraire,
    **c'est le contrôle qu'il faut relire d'abord**.

---

## 15. Comment travailler avec Antonin

- **Il n'est pas développeur et n'ouvre JAMAIS le Terminal.** Tout ce qui lui
  est demandé doit être un geste d'interface : un double-clic, un bouton, une
  fenêtre. Un `.command` à double-cliquer est acceptable ; une commande à taper
  ne l'est pas.
- **Il ne relira pas le code pour retrouver une décision.** La seule mémoire du
  projet est ce qui est écrit dans ces `.md`.
- **Il autorise d'office** : il ne veut pas qu'on l'attende. Franchir les portes
  seul, et **recommander** plutôt que demander quand une question se pose.
- **Plusieurs sessions travaillent en parallèle** dans le même dossier, sans se
  voir. Ce qu'une session ne consigne pas, la suivante le repaiera.
- **L'app et le site ne divergent jamais.** Toute modification de l'app se
  termine par la mise à jour du site, et réciproquement — le site ne décrit pas
  l'app de loin, il la *montre*. **Rien ne surveille cette ressemblance** : le
  seul garde-fou est `DETTE-SITE.md` et la relecture.
- **Ce qui existe en plusieurs exemplaires** est le principal risque du projet :
  `STRIPE_ENABLED` (app + site), la durée d'essai (3 endroits), l'adresse du
  site (6), les prix (site + Stripe), le design (3 fichiers CSS), le nombre de
  modules (écrit en toutes lettres à une dizaine d'endroits). **Aucun lien
  mécanique** entre eux.
- **Corriger large, pas au plus juste** : le même défaut ailleurs se corrige
  aussi, même s'il n'a pas encore mordu.

---

## 16. Annexe — les documents repliés ici le 2026-09-18

Vingt-trois fichiers ont été supprimés du dépôt ce jour-là. **Rien n'est perdu :
git les conserve intégralement** — `git show c312ce0:<nom>.md` les rend
tels qu'ils étaient. Ils ont été supprimés parce qu'ils décrivaient des
chantiers **livrés**, que leur contenu vivait déjà en double dans `CLAUDE.md`
et `PIEGES.md`, et que l'un contredisait l'autre sur l'état du projet.

| Fichiers supprimés | Ce qu'ils disaient | Où c'est maintenant |
|---|---|---|
| `PASSATION-SOCLE.md`, `-CALENDRIER.md`, `-CALENDRIER-V2.md`, `-LIAISONS.md`, `-IOS.md`, `BILAN-CALENDRIER-LIAISONS.md` | la série Calendrier & Liaisons (09-02 → 09-06) | § 6, § 11 · `CLAUDE.md` sections du 2026-09-02 au 09-06 |
| `PASSATION-NOTES.md` | le chantier H, la perte de données des Notes | § 11 · `CLAUDE.md` 2026-09-05/06 |
| `PASSATION-MINDMAP.md` | les cartes mentales | § 6, § 11 · `CLAUDE.md` 2026-09-07 |
| `PASSATION-ONBOARDING.md` | le premier démarrage | § 11 · `CLAUDE.md` 2026-09-10 |
| `PASSATION-FACTURATION.md` | la facturation dans Finance | § 6, § 12.3 · `CLAUDE.md` 2026-09-10 |
| `PASSATION-LICENCE-PROFILS.md`, `AUDIT-LICENCE-PROFILS.md` | les profils de licence | § 9 · `CLAUDE.md` 2026-09-13 |
| `PASSATION-FEUILLE-DE-ROUTE.md` | la feuille de route des objectifs | § 11 (en détail) · `CLAUDE.md` 2026-09-16 |
| `PASSATION-UI.md`, `AUDIT-UI-2026-08.md`, `AUDIT-I18N-2026-08.md` | le chantier UI/UX et l'audit i18n d'août | § 14 · `CLAUDE.md` 2026-08-28 |
| `CHECKUP-2026-09-07.md` | le checkup complet | § 11 · `CLAUDE.md` 2026-09-07 |
| `PASSATION-savoir-site.md` | déjà marqué **périmé** dans son propre en-tête | — |
| `SPEC.md`, `SPEC-V2.md`, `STRATEGIE-V3.md` | les specs V1/V2 et le cap commercial d'août | § 1, § 9, § 11.0 |
| `PROMPT_ETAPE1_SYNC.md`, `PROMPT_ETAPE2_WINDOWS.md` | des cadrages de chantiers terminés | § 8, § 12.1 |

⚠️ **Les autres documents du dépôt les citent encore**, dans des phrases
écrites avant cette date. Une référence à un `PASSATION-*.md` disparu se résout
par ce tableau. Elles n'ont **pas** été réécrites une par une : corriger deux
cents phrases de prose au passé aurait fait plus de dégâts que de bien.

---

*Dernière vérification complète de ce fichier : **2026-09-18**. Tout ce qui est
marqué ✅ a été mesuré ce jour-là. Quand tu modifieras le projet, c'est ICI que
l'état se met à jour — et dans `CLAUDE.md` que le pourquoi se consigne.*

### 11.y Le 2026-09-20 — la feuille de route lisible, et la carte mentale dans les deux sens

Quatre demandes d'Antonin en une phrase : l'ergonomie de la feuille de route, des
tâches dès la création d'un objectif, la carte mentale dans les deux sens, et le
mot « jalon » remis en question.

**Ce qui a changé à l'écran.**
- « jalon » → **« phase »**, avec sa phrase d'explication au moment du choix. La
  colonne `is_milestone` et le type `GenreEtape` n'ont pas bougé : c'est du
  texte qui change, pas une donnée.
- un **en-tête** sur la feuille de route (« FEUILLE DE ROUTE · 3 étapes ») et un
  bouton **« Carte »** ;
- l'**échéance d'une étape** se pose dans l'étape, plus dans une fenêtre ;
- **« Par quoi commencer »** dans la fenêtre de création : premières étapes,
  premières tâches (avec leur date). Facultatif, plafonné à cinq lignes, absent
  de la fenêtre de modification ;
- la **carte mentale d'un objectif**, en lecture seule (`EditeurCarte lecture`) ;
- **« En faire un objectif »** depuis n'importe quelle carte mentale, avec un
  panneau qui annonce les comptes avant d'écrire.

**Fichiers neufs.** `lib/objectifs/carte.ts` (+ tests),
`lib/objectifs/creation.ts` (+ tests), `lib/objectifs/creerDepuisCarte.ts`,
`components/objectifs/CarteObjectif.tsx`, `components/objectifs/DepuisCarte.tsx`.

**Trois défauts trouvés à l'écran** (détail dans `PIEGES.md` § 18) : la carte des
objectifs était **inerte** (portail manquant), l'objectif créé depuis une carte
**n'apparaissait pas** (aucun canal de rafraîchissement hors-vue), et la clé
i18n `« Carte »` **écrasait** celle de Finance (« Card »). Plus deux au doigt :
le bouton « Créer » sous la barre d'onglets, et la carte cadrée à 25 %.

⚠️ **Ce qui n'est PAS prouvé** : l'iPhone n'a été vu qu'en **émulation Chrome**
(390 × 844, appuis tactiles réels) — ni simulateur, ni appareil. Ce que
l'émulation ne peut pas dire reste écrit dans `MOBILE.md` § 24.

### 11.z Le 2026-09-22 — design system V7 « Ink & Azure »

Cadrage `PROMPT-DA-V7.md`. La V6 « Obsidian & Jade » était jugée fade ; la V7
garde la structure et repeint : **accent bleu de Shazam `#0088ff`**, un second
bleu `#0070f0` pour les aplats qui portent du blanc, un **dégradé bleu → cyan**
réservé à cinq emplois (bouton primaire, jauges, anneau de discipline, courbe du
patrimoine, filet de survol), signaux plus saturés. Plus deux mouvements : un
filet d'1 px au survol des cartes (invisible au repos) et l'entrée en cascade
des panneaux. Pourquoi : `CLAUDE.md` (section datée). Valeurs : `DESIGN.md`.

**Commits** (branche `chantier/design-v7`, fusionnée dans `mobile-ios`) :
tokens · bouton primaire / remplissages / jauges / état actif · graphique Finance,
anneau, survol, cascade · couleurs codées en dur → tokens · documentation.

**Ce qui est prouvé.**
- ✅ Contrastes remesurés sur les valeurs écrites : tous au niveau du cadrage
  (tableau dans `DESIGN.md`).
- ✅ 13 modules + Réglages, en sombre et en clair (Système), + clair explicite,
  sidebar repliée, modale, info-bulle, accueil : captures V6 / V7 dans Chrome
  headless, mode démo.
- ✅ Mesuré dans le DOM : filet à opacité 0 au repos sur les 13 cartes dans les
  trois thèmes, 1 au survol ; délais de cascade 0 → 440 ms plafonnés ; sous
  `prefers-reduced-motion`, délais 0 et durée 1e-6 s.
- ✅ Ligne de base : 1276 tests, `tsc`, `test:types`, `i18n:check`, build,
  `cargo check --all-targets`. Trois tests de concordance neufs (les deux blocs
  du thème clair ; le fond de `tauri.conf.json` ; `PALETTE_EXPORT` des cartes
  mentales), chacun vu échouer.

**Ce qui ne l'est pas.**
- ⚠️ **Pas d'app installée** : rebuild natif à grouper (voir l'encadré du § 3).
- ⚠️ Le soulèvement au survol n'a été vu qu'en Chrome, pas dans WKWebView.
- ⚠️ iOS non vu : `LaunchBackground` volontairement laissé en V6 (écart d'1/255
  par canal, invisible ; phase E non jouée) ; le blanc de la WKWebView au
  lancement reste non traité (`MOBILE.md` § 21.5).

**Ce qui reste, et où c'est écrit.** Site, démo jouable et icônes : dette
`DETTE-SITE.md` (entrée Q). `TAG_COLORS` / `HABIT_COLORS` / `TOPIC_COLORS` :
couleurs de données, intactes. ⚠️ Mesuré : les six hex bruts de `TAG_COLORS` et
`HABIT_COLORS` (`#fb8b4e`, `#ef6ba8`, `#3cc4de`, `#a78bfa`, `#fb923c`, `#f472b6`)
donnent 6,5 à 9:1 sur la surface sombre, mais **seulement 2,1 à 2,9:1 sur le
blanc du thème clair** — c'était déjà vrai en V6 (la surface claire n'a pas
bougé), la V7 ne l'aggrave pas. Signalé, pas corrigé (décision § 12.2 : pas de
palette mi-tokens mi-hex, pas de migration). Le cyan `#3cc4de` est en outre
proche de la fin du dégradé de marque. Deux réglages proposés à Antonin
et **non appliqués** : signaux encore plus saturés, halo du bouton primaire.
