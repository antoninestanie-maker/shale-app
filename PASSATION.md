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
  ⭐ **Depuis le 2026-09-30, le trading est MIS DE CÔTÉ** : les trois modules
  trading sont ABSENTS de l'app pour tout le monde (ni cadenas, ni paywall) —
  **dix modules visibles**. Le code et les données restent ; un interrupteur,
  `TRADING_ACTIF` dans `src/lib/features.ts`, les rallume (§ 11.x du
  2026-09-30, `CLAUDE.md` section du même jour).
  ⚠️ Le compte est passé de douze à treize le 2026-09-02 (Calendrier), et
  Benchmark a été **remplacé** par Finance le 2026-08-25. Tout document qui dit
  « douze modules » est antérieur à septembre.
- **Le morceau singulier, c'était le Market Brain** *(mis de côté avec le
  trading le 2026-09-30 : son planificateur ne tourne plus)* : un agent qui génère deux
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
`~/Desktop/Shale-brainstorm/`, `~/Desktop/Shale marketing/` (le marketing : reels, dont `Shale reels/shale-motion` → disque externe, plans, skills).

---

## 3. L'état — vérifié le 2026-09-18

| | |
|---|---|
| Branche de travail | ✅ **`mobile-ios`**, à `98dc4c8`. `main` est **249 commits en arrière** et n'est plus le tronc depuis longtemps |
| Arbre | ✅ **propre** |
| Poussé ? | ✅ **oui**, `origin/mobile-ios` à jour au 2026-09-18 (le dépôt du site aussi). Pour pousser sans Terminal : double-cliquer `Envoyer sur GitHub.command` |
| App installée | ✅ `/Applications/Shale.app`, binaire du **2026-09-16 à 10:38**, 21,2 Mo. C'est la version qui porte la feuille de route des objectifs |
| App installée — mise à jour | ⭐ **2026-09-30 à 11:25**, mobile-ios `0467fa8` : trading mis de côté (§ 11.x du 2026-09-30) |
| App en fonctionnement | ✅ **elle tourne** (processus `shale`, vue le 2026-09-18) |
| Base de données | ✅ **version 27** (`_sqlx_migrations`, 027 `corbeille` jouée le 2026-09-23 à 19:20 sur la vraie base : integrity ok, 0 violation FK, comptes identiques à la sauvegarde `shale-backups/avant-menus-corbeille-20260923-1914/`), 47 tables |
| Contenu réel | ✅ 3 objectifs · 2 tâches · 14 notes · 1 trade · 0 profil de licence |
| Synchronisation | ✅ **elle fonctionne** — dernier envoi ET dernière lecture le **2026-09-17 à 22:37 UTC**, curseur à 554. ⭐ **Cela prouve que la fenêtre de trousseau a été autorisée** après le build du 16 : c'était le dernier geste en attente, il est fait |
| File de sortie | ⚠️ `sync_outbox` contient **1 ligne** en attente — normal si l'app vient d'écrire ; anormal si ça ne bouge plus |
| Sauvegardes | ✅ automatiques dans `~/Library/Application Support/com.atnfx.shale/backups/` — la dernière du 2026-09-16 21:34. Plus les sauvegardes manuelles d'avant-chantier sur le disque externe |
| App iOS | *(d'après la doc)* simulateur iPhone 17 / iOS 26.5. **Sur l'iPhone RÉEL** : ⭐ **0.8.0 reposée le 2026-10-13 à 10:38** (`mobile-ios` `f91e1c4`, même code que l'app Mac de 01:16) ; **profil valable jusqu'au 2026-10-20 à 10:06**, après quoi elle ne s'ouvre plus ; Antonin l'a ouverte, déjà connecté et synchronisé (`MOBILE.md` § 29). ⚠️ **Corrigé le 2026-10-13 au soir : il ne RECEVAIT plus rien depuis début septembre** (curseur figé à 39) ; réparé à 23:05, tâches et objectifs identiques au Mac (entrée « Synchronisation » du 2026-10-13, nuit) |
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
npm test                                      ✅   1494 tests, 109 fichiers, 46 s  (2026-09-26)
                                                   1686 tests, 124 fichiers, 49 s  (2026-09-30, chantier sans-trading)
                                                   1905 tests, 143 fichiers  (2026-10-07, chantier ios-soumission ; voir § 11.x du 2026-10-06)
npm run i18n:check                            ✅   0 clé manquante, 0 doublon, 2021 entrées
npm run i18n:durs                             ✅   0 chaîne sûrement française (58 à vérifier)
npx vite build                                ✅
cd src-tauri
cargo check --all-targets                     ✅
cargo test --lib                              ✅   133 tests
cargo test --test permissions_fenetres        ✅   3 tests   (ajouté le 2026-09-30)
```

⚠️ **Ajouté le 2026-09-30 — `cargo test --lib` NE LANCE PAS
`tests/permissions_fenetres.rs`.** C'est un test d'intégration : il vérifie, sur
l'ACL compilée, que chaque appel natif du front est permis dans la fenêtre qui
le fait (PIEGES § 26.1). Tout nouvel appel natif du front s'y ajoute.

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
| **Tâches** | tâches, récurrence, dates, rattachement à un objectif. ⭐ **Depuis le 2026-09-30** : rangées **par moment** (En retard, Aujourd'hui, À venir, Sans date, Routines, Faites), **ajout rapide** (Entrée), recherche, une ligne de méta par tâche (échéance, créneau, rythme, objectif cliquable, report) | une tâche récurrente ne compte pas « en binaire » pour un objectif : elle alimente un nombre. ⭐ **Depuis le 2026-09-30, un objectif supprimé EMPORTE ses tâches** (même lot de corbeille), et une carte mentale supprimée emporte les objets de ses nœuds — § 11.z du 2026-09-30 |
| **Calendrier** | le 13ᵉ module (2026-09-02). Événements, multi-jours, récurrence, saisie à la minute, roulette d'heure | migrations 020 et 021. « journée entière » s'annonce encore comme « 1 tâche sans horaire » — mot faux, compte juste, **non corrigé faute de mandat** |
| **Timer** | Pomodoro, sessions de focus, plein écran ; *(2026-09-29)* **horloge à volets** et **fenêtre séparée** | ✅ fusionné et **installé le 2026-09-29 à 23:40** — ⛔ **jamais vu à l'écran** par une session : Antonin est le premier à le regarder. § 11.x du 2026-09-29 |
| **Objectifs** | ⭐ **refondu le 2026-09-16** : un objectif se découpe en jalons ordonnés, puis en sous-objectifs ; le pourcentage se **déduit**, il ne se saisit plus. ⭐ **Depuis le 2026-09-29** : la vue est en **maître-détail** — la liste (chaque objectif avec sa **prochaine action**) et la fiche de celui qu'on choisit (une phrase d'origine, la feuille de route, une icône par niveau) ; sur iPhone, la liste OU la fiche. Sa carte mentale est ÉDITABLE — ajouter (typé), renommer, cocher, supprimer depuis la carte, la feuille de route suit. ⭐ **Depuis le 2026-09-30** : une **priorité** (faible, moyenne, élevée) sur les étapes comme sur les tâches — à la création, au clic droit, dans « Modifier… » ; le repli « Avancé / Poids » et les phrases d'aide de la feuille de route sont partis (bulles au survol de deux secondes) | migrations 026 et 030. Voir § 11 (2026-09-16), § 11.z (2026-09-29) et § 11.p (2026-09-30). ⚠️ **Depuis le 2026-10-08, le maître-détail est remplacé** : la liste pleine largeur, puis la PAGE d'un objectif, avec « le fil » (la barre de progression du site) — section datée en fin de fichier |
| **Performance** | métriques personnalisées, habitudes, séries, graphiques (recharts). ⭐ **Depuis le 2026-10-09** : un onglet d'ANALYSE — une période pour toutes les cartes, chaque chiffre comparé à la période d'avant, la discipline des tâches et celle des habitudes en courbe + carrés, par jour de la semaine, et une carte « À améliorer » (faits chiffrés, calculés localement) | `lib/performance/analyse.ts`. Section datée en fin de fichier |
| **Finance** | remplace Benchmark (2026-08-25). Comptes, soldes, positions, cours, récurrents — **et la facturation** depuis le 2026-09-10 | migrations 018, 019, 023. ⚠️ Deux écrans manquent pour un usage réel : **l'émetteur** (identité, SIRET, régime) et **les tiers**. Sans eux, aucune facture ne peut être adressée à quelqu'un |
| **Notes** | éditeur riche, recherche plein texte (FTS5), mentions `@`, **cartes mentales** (SVG, export PNG/SVG ; depuis le 2026-09-29 : nœuds **déplaçables** à la main et **typés** — étape, tâche, habitude), **pièces jointes** depuis le 2026-09-23 | le chantier H (2026-09-06) a corrigé une **perte de données** : le contenu d'une note s'écrivait dans une autre. Les pièces jointes sont installées depuis le build du 2026-09-26 (la vraie base est en 028 : carnet de coordination, entrée [V-filet]) ; leur clic n'a jamais été vérifié à la main |
| **Journal** | entrées datées | |
| **Savoir** | base de connaissances. ⭐ **Un seul objet depuis le 2026-09-07 : le SUJET** — les « thèmes » et les « objets » ont fusionné (migration 022) | le chiffre qui a tranché : 5 jours après la livraison des objets, 4 thèmes utilisés, **0 objet** |
| **Trading** | journal de trades en R, modes live / backtest | ⏸ **mis de côté le 2026-09-30** — absent pour tous (`TRADING_ACTIF`). Avant : verrouillé hors offre trading |
| **Market-Brain** | les deux briefings quotidiens (§ 1) | ⏸ **mis de côté le 2026-09-30** — absent, planificateur arrêté |
| **Position** | calculateur de taille de position, alertes, historique | ⏸ **mis de côté le 2026-09-30** — absent |

Et les trois vues qui ne sont pas des modules : **Réglages** (langue, apparence,
densité, sauvegardes, synchronisation, raccourcis), **Personnaliser** (admin :
réordonner et masquer les modules), **Console**.

⚠️ **La Console affiche des données de DÉMONSTRATION**, pas les vrais comptes
(`ConsoleView.tsx`, en-tête du fichier). Elle attend d'être branchée sur
Supabase via une session admin ou une fonction edge. Personne ne doit lire ses
chiffres comme une réalité commerciale.

---

## 7. La base locale, et ses vingt-huit migrations

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
| 027 | corbeille | ⭐ une colonne `deleted_at` sur dix tables, **aucun trigger** : « Supprimés récemment », 30 jours. Lue en bas de `repo.ts` (`VIVANT`) et dans `notifications/data.rs` (`filtre_vivant`, qui vérifie que la colonne existe) |
| 028 | pieces_jointes | la table `files` (signalement ; les octets vivent dans `<app_data>/pieces-jointes/`), et `object_links` RECRÉÉE sans son `CHECK` pour accueillir la 8ᵉ famille `file`. Répétée le 2026-09-24 sur une copie de la vraie base en 27 : integrity ok, outbox à 0 |
| 030 | priorite_etapes | ⭐ **une colonne** `goals.priority` (`'medium'` par défaut, **sans CHECK**) : la priorité d'une étape, les mêmes valeurs que `tasks.priority`. Numérotée 030 avant la 029, réservée par le chantier IA de Shale Pro et pas encore fusionnée — sqlx applique une migration manquante quel que soit son rang (vérifié dans `sqlx-core` 0.8.6, `migrator.rs`) |

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
| **Shale Pro** | `shale_pro` | 19 € | 180 € (15 €/mois) | ~~+ le trading~~ — périmé : depuis le 2026-09-15 le site vend Pro pour le support prioritaire et l'accès anticipé, et le trading est mis de côté depuis le 2026-09-30. Le chantier [X-ia-pro] y met l'IA (non fusionné au 2026-09-30) |
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

### ⭐ Sur iPhone, l'app ne vend RIEN (décision du 2026-09-26, codée le 2026-09-29)

Apple ne prélève aucune commission : tout se paie sur le site, l'app iOS ne
sert qu'à **se connecter** à un compte déjà abonné (règle App Store 3.1.3(f)).
**Un seul module décide** : `src/lib/boutique.ts` (`COMMERCE_AUTORISE`, faux sur
iPhone et iPad). Sur iOS : pas d'inscription, pas d'offre ni de prix, pas de
bandeau d'essai, pas de paywall, pas de cadenas (un module hors palier est
**absent**), « Compte actif » dans Réglages, et un compte sans abonnement ne
voit que « Aucun abonnement actif n'est associé à ce compte. » + déconnexion.
**macOS est inchangé.** Détail, tableau surface par surface et note à coller
dans App Store Connect : `MOBILE.md` § 25. **La préparation de la soumission
(2026-10-06) : `MOBILE.md` § 28.**

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
- **L'app iOS est « connexion seule »** depuis le 2026-09-29 : aucune vente,
  aucune incitation, aucune inscription (§ 9, `MOBILE.md` § 25). La question
  « achats intégrés contre Stripe » est **tranchée** : ni l'un ni l'autre dans
  l'app.
- ⭐ **La soumission à l'App Store est préparée (2026-10-06), pas faite** :
  Antonin n'a pas encore payé le programme développeur (99 $). Le projet Xcode
  a reçu ce qui lui manquait (manifeste de confidentialité, texte de l'appareil
  photo, iOS 17 minimum ; **iPhone ET iPad, version 0.8.0** depuis le 2026-10-07), un lien vers la politique
  de confidentialité est dans Réglages, et une fuite a été corrigée (un nom
  d'offre dans Personnaliser). Les textes de la fiche, les réponses de
  confidentialité, la note au relecteur et le SQL du compte de démonstration
  sont hors dépôt (`administratif/App Store iPhone/`). **La suite, dans
  l'ordre : `MOBILE.md` § 28.7.**
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

### 11.x Le 2026-09-23 — menus contextuels et « Supprimés récemment »

| Date | Chantier |
|---|---|
| 09-23 | ⭐⭐ **Un menu contextuel sur chaque objet** — clic droit, Ctrl+clic, tap à deux doigts, Maj+F10, ET un bouton « ⋯ » jumeau (visible au doigt) : notes, tâches (Tâches, Aujourd'hui, Calendrier), événements et créneaux, objectifs et étapes, sujets et fiches du Savoir, habitudes et entrée du jour, métriques, documents de facturation · ⭐⭐ **« Supprimés récemment »** (027), 4ᵉ entrée du pied de la barre latérale : 30 jours, puis purge au lancement · un toast « … est dans Supprimés récemment · Voir · Annuler » après chaque suppression |

Les cinq choses à savoir sans lire le code :
1. **Une suppression n'efface plus rien** : elle pose `deleted_at` (horodatage
   UTC). Les lignes qui partent ENSEMBLE (un objectif et ses étapes) partagent
   le même horodatage : c'est un **lot**, restauré ou purgé d'un bloc.
2. **Les feuilles** (coches, entrées de métrique, lignes de facture,
   paiements) n'ont pas de colonne : elles suivent leur parent par jointure.
3. **Une facture ÉMISE ne va pas à la corbeille** — elle s'annule par avoir.
   Comptes et tiers s'archivent. Le reste hors corbeille est déclaré dans
   `AMELIORATIONS-UI.md` § E.
4. **La synchronisation porte `deleted_at` comme une colonne ordinaire**
   (last-write-wins) : jeter sur un appareil jette sur l'autre, restaurer
   aussi. Un appareil resté en version 26 ignore la colonne : il continue
   d'AFFICHER l'objet jeté, et un appareil NEUF qui le reçoit d'abord de lui
   l'insère vivant — risque mesuré, `PIEGES.md` § 19.9. ⛔ Tous les appareils
   en 27 avant de se servir de la corbeille (l'iPhone : Phase 5).
5. **Le menu natif de la WebView** (Reload, Inspect…) est remplacé hors des
   champs de texte, et l'app se déclare en français (`Info.plist`,
   `CFBundleLocalizations`) : le menu des champs suit la langue du Mac.

Même soir : **ce qui reste définitif demande une confirmation en ligne**
(positions et encaissements de Finance, historique de Position —
`ConfirmationEnLigne`). **iOS vérifié au simulateur** (« ⋯ » au doigt, écran de
la corbeille par « Plus », base du simulateur migrée en 27 sans perte ;
`CFBundleLocalizations` aussi dans `gen/apple`). Recette à deux appareils :
`RECETTE-SYNC.md` scénarios 8 et 9 — **pas encore jouée sur de vraies
machines**.

**Build n° 2 installé le 2026-09-24 à 00:04** (`012f1335…`) : confirmations +
correction du survol de [U-survol] (`2c397b6`, fusionnée dans la branche des
menus). Base inchangée en 27. ✅ **Fusionnée dans `mobile-ios` le 2026-09-24**,
après le commit des pièces jointes : `lib.rs` et `schema.testutil.ts` déclarent
027 PUIS 028, sans trou.

**2026-09-24, vérification complète** : menu sur les BLOCS d'une note (carte,
croquis, image, pièce jointe — clic droit, ou toucher au doigt) et sur les
NŒUDS d'une carte ; clic droit sur trades, tracker, calculs de Position,
comptes, flux, positions, tags, liens rapides, liens entre objets ;
confirmations en ligne pour tout ce qui est définitif et coûte à refaire. Trois
défauts du menu corrigés (sous les fenêtres, Échap en double, focus perdu) —
`PIEGES.md` § 19.15–19.18, `CLAUDE.md` section du 2026-09-24.

**2026-09-25, suite** : menu sur les PANNEAUX de toutes les grilles (clic
droit, « ⋯ », clavier ; Avancer / Reculer d'une place) ; plus aucun bouton
seulement au survol (crayons Finance, croix des notifications, ▶ Focus,
désormais dans le « ⋯ » au doigt) ; une pièce jointe absente de l'appareil DIT
qu'elle n'y est pas au lieu de ne rien faire. `PIEGES.md` § 19.19–19.21,
`CLAUDE.md` section du 2026-09-25. ⛔ Pas encore de build natif pour ces
changements.

Pourquoi : `CLAUDE.md` section du 2026-09-23 « Menus contextuels » ; pièges :
`PIEGES.md` § 19 ; hors périmètre : `AMELIORATIONS-UI.md` § A–F.

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

### 11.x Le 2026-09-29 — l'app iPhone ne vend rien

Chantier « connexion seule » (décision d'Antonin du 2026-09-26). Nouveau
`src/lib/boutique.ts` ; gardes posées dans `LoginScreen`, `SubscriptionRequired`,
`AuthGate` (bandeau d'essai), `UpgradeModal`, `App.tsx` (navigation),
`Sidebar`, `MobileNav`, `SettingsView`, `AdminView`, `useAuth`. Les anciennes
gardes `IS_IOS` du paywall et du mur **nommaient encore shaleapp.com** — c'était
une incitation (`PIEGES.md` § 23.1). Tests : `boutique.test.ts` et
`ios-sans-achat.test.ts` (écrans rendus sous user-agent iPhone et Mac, vérifiés
non vacants). Ligne de base verte : 1513 tests. Simulateur : compte abonné et
écran de connexion **vus** ; compte sans abonnement **pas vu** (disque plein,
`PIEGES.md` § 23.3), couvert par le test de rendu. Tout est dans `MOBILE.md` § 25.

### 11.x Le 2026-09-29 — Timer : horloge à volets et fenêtre séparée

Demande d'Antonin, sur vidéo : la séance lancée doit pouvoir partir **dans sa
propre fenêtre** (en plus du plein écran), et l'anneau laisse place à **une
horloge à volets** (cartes MM / SS qui basculent), adaptée au thème. Nouveaux :
`components/timer/` (`HorlogeVolets`, `EcranTimer`, `volets.css`),
`lib/timerFenetre.ts`, `TimerPane.tsx`, capacité Tauri `timer.json` ; modifiés :
`TimerView`, `FocusOverlay`, `main.tsx`, `capabilities/default.json`, `en.ts`.
Aucune migration, **aucune ligne de Rust** — mais les capacités sont compilées
dans le binaire, donc **rien n'existe dans l'app installée avant un build natif**.

| | |
|---|---|
| Branche | `chantier/timer-flip` (worktree `~/Desktop/Shale-chantiers/timer`), rebasée sur `7d51729` après la fusion de carte-objectifs, puis **fusionnée dans `mobile-ios` en avance rapide : `c82898f`, poussée** |
| Installé | ✅ **2026-09-29, 23:40**, sur « go » d'Antonin. Build de `c82898f` (23:35:28 → 23:39:07, code 0, arbre inchangé pendant la compilation). Témoins dans le `dist` consommé : `shale:timer-etat`, `volet-moitie volet-haut volet-tombe`, « Fenêtre séparée », « Garder au premier plan », `@font-face` « Instrument Sans Etroit » + fichier `wdth` ; contre-épreuve : la classe de l'ancien anneau (`relative mt-6 h-64 w-64`) absente. Capacités compilées : `default` (main, capture) 15 permissions, `timer` 5. Empreintes : ancienne `b7465140…` ≠ source `bc1c9f36…` = installée, `diff -r` identique. Base : sauvegarde `Shale-chantiers/sauvegardes/avant-timer-flip-20260929-2335/`, aucune migration (28), après relance integrity ok, 0 violation FK, 77 objectifs / 51 tâches / 20 notes / 10 séances — identiques. ⚠️ **Second build de la soirée** (celui de carte-objectifs était parti 20 min plus tôt) : une seconde fenêtre de trousseau possible pour Antonin |
| Prouvé | tsc, test:types, i18n:check ; après rebase **1 605 / 1 605** ; avant rebase **1 532 tests** (passe complète : 1 526 + 6 délais dépassés dans `sync/engine` et `sync/supabase`, machine chargée par d'autres sessions — § 9.11 de PIEGES ; les deux fichiers repassés seuls : 49/49) ; `timerFenetre.test.ts` (13, calculs + arrondi identique à `useFocus`) et `HorlogeVolets.test.ts` (6, mécanique de la bascule, happy-dom) — les deux vus échouer sur mutation ; `vite build` embarque bien la police étroite |
| **PAS prouvé** | ⛔ **Rien n'a été vu à l'écran** : ni l'horloge, ni la bascule, ni les thèmes, ni la fenêtre. Le patch démo (§ 13.2) a été refusé par le garde-fou du mode automatique de la session, et le serveur de dev avec lui ; Antonin a choisi d'essayer directement l'app installée. Ne pas lancer de séance à sa place dans l'app installée : elle écrit dans la vraie base. Restent à voir : la création de la fenêtre (permissions), le plein écran macOS d'une fenêtre SECONDAIRE (et sa fermeture en plein écran — cf. l'espace fantôme de 2026-07-26), « Garder au premier plan », le déplacement par le fond |
| Second passage | ✅ **Installé le 2026-10-11 à 12:16** (`a2268ab`, build de `a408624`, groupé avec la jauge d'énergie `376bfd0` et retours-reel-018). Retours d'Antonin du 30/09 : plein écran ÉPURÉ (l'horloge seule, Échap pour sortir, vrai plein écran macOS), fenêtre séparée avec × et ⌘W (`destroy()` après sortie du plein écran ; cause du bouton rouge sans effet NON identifiée), volets refaits (une pièce à deux faces, rebond, ombres, charnière), cadence calée sur la seconde. Écrit le 30/09, session interrompue, repris le 11/10. Témoins du dist : `volet-clapet`, `volet-pivot`, « Fermer la fenêtre » ; contre-épreuve `volet-tombe` 0. Capacités compilées : default 16, fenetre-principale 2, timer 6. Empreintes : `931dab08…` → `b27fb93c…` = source, `diff -r` identique. Base : sauvegarde `sauvegardes/avant-timer-2-20261011-1212/`, version 30 avant et après, integrity ok, FK 0, 88 objectifs / 81 tâches / 22 notes. 1986/1986. ⚠️ Vu sur page d'essai figée (WebKit + Chrome), **jamais dans l'app** ; `cargo test permissions_fenetres` NON rejoué (cache debug absent) — les trois lignes ajoutées sont prouvées par les capacités compilées seulement |
| Ce qui reste | Le retour d'Antonin après ce second essai |

Le pourquoi (source de vérité unique dans la fenêtre principale, instant de fin
plutôt que reste, fenêtre créée à la demande, chiffres à l'encre et non crème) :
`CLAUDE.md`, section du 2026-09-29.

### 11.x Le 2026-09-30 — le fond natif de la fenêtre, et la poignée de la barre latérale

Suite du § 26.1 de `PIEGES.md` (constat raisonné du chantier Timer). **Deux
appels natifs de la fenêtre principale étaient refusés par l'ACL, en silence,
depuis toujours** : le fond (`set_background_color`, depuis le 2026-09-12) et le
déplacement par la barre latérale (`start_dragging`, depuis l'import du 2 août).
Et le premier, même permis, envoyait sa couleur sous un nom que Rust ne lit pas
(bogue de `@tauri-apps/api` 2.11, § 26.6). Modifiés : `lib/theme.ts`,
`main.tsx` ; nouveaux : `capabilities/fenetre-principale.json` (réservée à
`main`), `src-tauri/tests/permissions_fenetres.rs`, `lib/theme.fenetre.test.ts`.
Aucune migration, aucune ligne de `lib.rs` — mais une capacité, donc **rien
n'existe dans l'app installée avant un build natif**.

| | |
|---|---|
| Branche | `chantier/fond-fenetre` (worktree `~/Desktop/Shale-chantiers/fond-fenetre`), depuis `85dd58d` |
| Prouvé | **Le refus** : `permissions_fenetres.rs` lancé AVANT correction → 2 refus sur 41 appels, les deux dans `main` ; après → 3/3. Contre-épreuve : permission remise dans `default.json` → échec sur `[capture]`. Le binaire installé `bc1c9f36…` ne contient pas la clé `plugin:window|set_background_color`. **Le mauvais nom d'argument** : la vraie `@tauri-apps/api` sur un faux pont IPC envoie `{ color }` (`theme.fenetre.test.ts`, 8 tests ; ancien code remis → 4 échecs). Ligne de base : tsc, test:types, **1 627 / 1 627**, i18n (2248), i18n:durs, vite build, `cargo check --all-targets`, `cargo test --lib` 139 |
| **PAS prouvé** | ⛔ **Rien n'a été vu à l'écran.** Ni le fond clair au redimensionnement, ni le déplacement par la barre latérale, ni le suivi de macOS en réglage « Système ». Pas de console dans l'app de production, `tauri dev` exclu (vraie base), et aucune session ne prend le curseur d'Antonin |
| À regarder (Antonin, 30 s) | ① Réglages → Apparence → **Clair**, puis agrandir la fenêtre d'un geste rapide par le coin bas-droit : le bord qui apparaît doit être **clair**, plus sombre. ② Attraper le **haut de la barre latérale** (autour du nom « Shale ») et tirer : la fenêtre doit suivre. ③ Réglage « Système », puis basculer macOS clair ↔ sombre (Réglages Système → Apparence) : même test qu'en ①. ④ La barre de capture (raccourci global) doit rester **sans fond**, comme avant |
| Ce qui reste | ⚠️ Un éclair sombre **à l'ouverture** en thème clair n'est pas couvert : la fenêtre naît avec le `#07080b` de `tauri.conf.json` avant que le JS ne tourne (`CLAUDE.md`, section du 2026-09-30) |

Le pourquoi (capacité à part plutôt que garde seule, `invoke` direct plutôt que
monter Tauri, liste d'une fenêtre autorisée) : `CLAUDE.md`, section du
2026-09-30.

### 11.x Le 2026-09-26 — le filet contre l'écran blanc, et les dépendances

| Date | Chantier |
|---|---|
| 09-26 | ⭐ **`FiletErreur`** : un module qui plante au rendu n'emporte plus la fenêtre (message + « Réessayer »), et un filet racine propose « Recharger Shale » · `npm audit fix` (nanoid, postcss) · mises à jour mineures (React 19.3, recharts 3.10, Tailwind 4.3.3…) |

Aucune migration, aucun Rust. ⚠️ **Les paquets `@tauri-apps/*` n'ont PAS été
montés** : leurs versions doivent rester alignées sur les crates Rust
(`Cargo.lock`), donc on les monte ensemble, au prochain build natif. Reste une
faille *moderate* dans vitest (outil de test, jamais embarqué) dont le
correctif impose vitest 5 — non fait. ✅ **Installé le 2026-09-26 à 01:11**
(avec la suite des menus `9e90a35`) ; les `@tauri-apps/*` ont été montés avec
leurs crates au même build (`6fa996d`, http retenu à 2.6.1). Pourquoi :
`CLAUDE.md` section du 2026-09-26.

---

### 11.x Le 2026-10-06 — l'app iPhone préparée pour l'App Store (sans compte développeur)

Chantier `chantier/ios-soumission`. Tout le détail : `MOBILE.md` § 28.

**Ce qui est fait.**
- Projet Xcode : manifeste de confidentialité, texte d'autorisation de
  l'appareil photo (FR/EN), **iOS 17 minimum** (était 14), **iPhone seul** (à
  confirmer par Antonin).
- Réglages → compte : lien « Politique de confidentialité » (exigé par Apple
  dans l'app), sur toutes les plateformes.
- ⭐ Une fuite corrigée : Personnaliser listait « Brief du jour (IA, Shale
  Pro) » à tout le monde — un nom d'offre sur iPhone (`widgetListable`,
  `lib/widgets-listables.test.ts`, vu rouge règle neutralisée).
- Défauts vus au simulateur et corrigés : champ d'heure qui déborde à l'accueil,
  bandeau des exemples écrasé, textes « macOS », réglage « arrière-plan » et
  section « raccourcis » affichés sur iPhone, « trades » dans l'export et dans
  Performance.
- Hors dépôt (`administratif/App Store iPhone/`) : textes de la fiche FR/EN
  relus avec le skill `aso`, réponses de confidentialité, six captures à
  produire avec leurs légendes, SQL du compte de démonstration, note au
  relecteur corrigée.

**Ce qui est prouvé.**
- ✅ Build iOS de simulateur de la branche, contenu du bundle contrôlé.
- ✅ **L'écran « compte sans abonnement » VU au simulateur** — c'était le seul
  jamais vu (`MOBILE.md` § 25.5) : constat neutre + « Se déconnecter ».
- ✅ Connexion sans inscription ; feuille « Plus » sans Trading, Finance ni
  cadenas ; « Compte actif » ; Personnaliser sans nom d'offre.
- ✅ `tsc`, `test:types`, `i18n:check` (2660 entrées), `i18n:durs` (0), build
  Vite. vitest : **1904 / 1905** ; le seul échec est une EXPIRATION de
  `finance/facturation/demo.test.ts` (60 s) quand toute la suite tourne sous
  charge — seul, il passe en 4 s, ici comme sur `mobile-ios` intacte (§ 9.11).

**Ce qui ne l'est pas.**
- ⛔ `cargo check` et `cargo test` de BUREAU non rejoués (aucun Rust touché ;
  `tauri.conf.json` a gagné `bundle.iOS.minimumSystemVersion`, lu sans erreur
  par le build iOS). **Aucun build Mac** : les corrections de texte et le lien
  de confidentialité n'y sont donc pas encore.
- ⛔ Synchronisation, Calendrier, Objectifs, Journal, Savoir, Timer,
  Performance : pas revus au simulateur dans ce build (`MOBILE.md` § 28.5).
- ⛔ Rien sur un vrai iPhone ; rien de signé ; SQL du compte jamais joué.
- ⚠️ Rien n'est poussé ni fusionné.

### 11.x Le 2026-10-07 — iPhone ET iPad, version 0.8.0

Décisions d'Antonin : l'app iOS vise tous les formats (iPhone et iPad), la
version est **0.8.0**, l'inscription Apple se fera en **individuel** ; la
réponse sur le chiffrement se choisira plus tard. Détail : `MOBILE.md` § 28.10.

- `project.yml` : `TARGETED_DEVICE_FAMILY: "1,2"`, version 0.8.0 (aussi dans
  `package.json`, `Cargo.toml`, `tauri.conf.json`, le workflow de publication
  macOS). ⚠️ Le numéro vaut aussi pour le **prochain build Mac**.
- Zones sûres posées pour l'iPad (`App.tsx`, `Sidebar.tsx`, sous `IS_IOS`) :
  le contenu passait sous l'heure système. Le Mac n'est pas touché.
- **Vu au simulateur** (mode démonstration) : iPad Pro 13" et iPad mini —
  connexion, accueil, Aujourd'hui. **Non vu** : iPhone 17e / Pro Max, paysage,
  Split View, les autres modules sur iPad.
- ⚠️ « Coordonnées publiques aussi » : compris comme « à décider plus tard » —
  **à confirmer par Antonin**.
- Rien n'est poussé ni fusionné : branche `chantier/ios-soumission`, locale.

## 12. ▶️ Ce qui reste — et qui décide

**Rien n'est « en cours ».** La file de réparations est vide : tout ce qui suit
attend une décision d'Antonin, un achat, ou une machine.

### 12.1 Ce qui attend un geste ou une dépense d'Antonin

| Sujet | Où ça bloque | Ce que ça coûte |
|---|---|---|
| ⛔ **L'app n'est ni signée ni notarisée** | `bundle.macOS` vide dans `tauri.conf.json`. macOS met le `.dmg` en quarantaine : le visiteur doit le débloquer à la main **juste après le clic que tout le site sert à provoquer** | **compte Apple Developer, 99 $/an.** C'est le frein n° 1 sur l'objectif n° 1 |
| ⛔ **Windows n'a jamais été compilé** | le code est sur le tronc, audité ; la compilation croisée depuis macOS est **impraticable** (essayée, tranchée, avec preuve) | une machine, une VM ou un runner CI. ⚠️ **Ne pas re-litiger ce point.** Publier = déposer `Shale_x64-setup.exe` dans `vitrine/public/telechargements/` et renseigner `config.exeWindows` |
| **Certificat Authenticode Windows** | sans lui, SmartScreen avertit à chaque installation | ~200–400 €/an |
| **L'iPhone réel** | reposé le 2026-10-13 ; le profil gratuit expire le **2026-10-20** (`MOBILE.md` § 29) | rebrancher le téléphone tous les sept jours ; ou le compte Apple Developer, qui règle les deux |
| ⛔ **Publier l'app iPhone** | tout ce qui se fait sans compte développeur est fait (2026-10-06, `MOBILE.md` § 28). Restent : payer, signer, TestFlight, le parcours au doigt sur le vrai iPhone, la fiche, la soumission — 19 gestes ordonnés au § 28.7 | **le même compte Apple Developer, 99 $/an** |
| **Deux décisions restent avant l'envoi à Apple** | réponse sur le chiffrement (`MOBILE.md` § 28.8) · coordonnées publiques du statut européen « professionnel ». ✅ Tranché le 2026-10-07 : **iPhone ET iPad**, **version 0.8.0**, inscription en **individuel** (`MOBILE.md` § 28.10) | **Antonin** |
| **Compte de démonstration pour Apple** | la relecture App Store l'exige : un compte **abonné**, adresse dédiée, créé sur le site ; e-mail et mot de passe saisis dans App Store Connect → « Sign-in information », **jamais dans le dépôt**. Le SQL qui l'abonne à la main est prêt, **jamais joué** (`administratif/App Store iPhone/`). La note de relecture a été corrigée le 2026-10-06 (`MOBILE.md` § 28.6 ; celle du § 25.4 est périmée) | quelques minutes |
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
npm cache clean --force && rm -rf ~/.npm/_npx    # 2,7 Go — ⚠️ voir ci-dessous
git gc --prune=now                               # dans les deux dépôts
```

⚠️ **`~/.npm/_npx` n'est jetable que si RIEN ne tourne dessus** (vu le
2026-09-30) : les serveurs MCP lancés par `npx` (ici cinq `mcp-pdf-server`)
s'exécutent DEPUIS ce dossier. `ps -Ao command | grep _npx` avant ; s'il rend
quelque chose, laisser `_npx` et le cache npm.

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
  ⚠️ *Correction du 2026-09-23* : « 1 au survol » était mesuré en survol FORCÉ
  du panneau seul, la carte n'étant pas survolée. En vrai survol, la carte
  montait de 2 px dans son panneau et y perdait bord haut et filet — Antonin
  l'a vu dans l'app installée. Corrigé, voir § 11.z du 2026-09-23 (survol).
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


### 11.z Le 2026-09-22 — la suppression d'un nœud de carte se fait en deux temps

Une demande d'Antonin, en une phrase : « la suppression d'un nœud de carte
mentale doit se faire en deux temps, pas instantanément ». Raisons et pièges :
`CLAUDE.md`, section du 2026-09-22.

**Ce qui a changé à l'écran.** Le premier ⌫ — ou le premier clic sur
« Supprimer » — n'efface plus rien : il **arme**. Le nœud visé **et tout son
sous-arbre** passent en rouge pointillé (arêtes comprises), le bouton devient
rouge et dit « Confirmer », et le pied de la fenêtre remplace la légende des
raccourcis par ce qui va partir, **avec le chiffre** et « Échap annuler ». Le
second appui confirme.

**Une exception assumée** : le ⌫ sur un nœud **vide ET sans descendance** reste
instantané — c'est le geste qui annule le Tab qu'on vient de taper.

| Fichier | Ce qui y est entré |
|---|---|
| `src/lib/carte.ts` | `OptionsRendu.peril` + le rendu du sous-arbre condamné. **Pur, 65 tests** |
| `src/components/carte/EditeurCarte.tsx` | l'état `arme`, son invariant, le bouton rouge, le pied d'alerte |
| `src/lib/i18n/en.ts` | 6 clés (2027 entrées) |

**Ce qui est prouvé.** Deux tests neufs : armer marque tout le sous-arbre et rien
d'autre ; **sans arme, le rendu est identique au caractère près** (le bloc écrit
dans la note et l'export ne passent jamais `peril` — sans ce test, une carte
pourrait rester alarmée en rouge pour toujours dans le corps d'une note). Et à
l'écran en mode démo : armer, annuler par Échap, confirmer par un second ⌫.

⚠️ **Ce qui n'est PAS prouvé** : le geste n'a pas été essayé **au doigt**, ni
dans l'app native — la vérification est en mode démo, au navigateur. Et **aucun
build natif** n'a été fait : ce qui précède n'est pas encore dans
`/Applications/Shale.app`.

⚠️ **Un défaut vu en passant, NON corrigé** : cliquer sur la racine d'une carte
neuve puis taper immédiatement ne pose pas le texte — la racine reste vide. Vu
deux fois, le 2026-09-08 et le 2026-09-22, toujours dans un enchaînement de
frappes très rapide (donc peut-être un artefact du pilotage automatisé, pas un
défaut de l'app). **À reproduire à la main avant d'y toucher.**

### 11.z Le 2026-09-23 — le « réussi » à l'encre

Antonin n'aimait pas le vert menthe de la V7. Planche comparative (5 verts,
cyan, encre, sur les mêmes écrans) → il choisit **l'encre**. Le « réussi »
(case cochée, gain, trade gagnant, habitude tenue, jauge terminée, « en
direct ») prend la couleur du texte ; les grandes surfaces (barres, cartes de
chaleur) une encre adoucie. Pourquoi : `CLAUDE.md` (section datée) ; règle
endroit par endroit : `DESIGN.md` § « Le réussi à l'encre ».

**Ce qui est prouvé.** ✅ Captures des 13 modules en sombre et en clair (mode
démo, Chrome headless), dont Trading, Market-Brain et Position enfin vraiment
capturés (PIEGES § 21.8). ✅ Ligne de base : 1288 tests, `tsc`, `test:types`,
`i18n:check`, build. ✅ `theme.encre.test.ts` : réussi = texte dans les trois
blocs, `--color-green` toujours là — les deux gardes vus échouer.

**Ce qui ne l'est pas.** ⚠️ Pas dans l'app installée : part avec le build de
[P-menus]. ⚠️ Vu en Chrome, pas en WKWebView.

**Ce qui reste.** `--color-green` n'est plus un signal mais une couleur choisie
(`#4ade80` / `#287845`) : **ne jamais le supprimer ni le renommer** (données en
base, PIEGES § 21.9). Le site et la démo jouable gardent l'ancien vert — même
dette que la V7 (`DETTE-SITE.md`, entrée Q).

### 11.z Le 2026-09-23 — le survol rognait le haut des cartes

Antonin, dans l'app installée : « les onglets au survol s'affichent mal, et le
trait en dégradé aussi ». Reproduit dans **WebKit** (le moteur de l'app), avec
`tools/webkit-pilote.swift`, en vrai survol : la carte montait de 2 px DANS son
panneau de grille, dont l'`overflow: clip` coupait le bord haut à plat — coins
aplatis, filet invisible, tuiles d'Aujourd'hui tronquées. Cause : une règle
d'annulation trop peu spécifique (PIEGES § 21.10). Même défaut trouvé par
audit à deux autres endroits : la grille des sujets de **Savoir** (première
rangée collée au bord d'une zone qui défile) et le bandeau « Marché fermé » de
**Market-Brain**.

**Ce qui est prouvé.** ✅ Vrai survol WebKit : panneau, tuile et carte de sujet
gardent coins et filet. ✅ Audit des 14 écrans : aucune carte soulevée contre
un bord qui rogne. ✅ `theme.survol.test.ts` (vu rouge sur l'ancienne règle).
✅ Ligne de base : 1291 tests, `tsc`, `test:types`, `i18n:check`, build.

**Ce qui ne l'est pas.** ⚠️ Pas encore dans l'app installée (build groupé).
⚠️ L'audit ne couvre que le haut de chaque vue, dans les données de démo.

### 11.z Le 2026-09-23 — joindre un fichier à une note

Demandé par Antonin : « ce serait bien de pouvoir ajouter des fichiers, notes
documents dans les notes ». Décisions et pourquoi : `CLAUDE.md`, section datée.
Pièges : `PIEGES.md` § 22. **Migration 028.**

**Ce qui est livré.** Un bouton « Fichier » dans la barre d'outils des Notes,
une entrée « Fichier » dans le menu « Insérer » du Savoir, et un jeton en ligne
dans le corps de la note — pictogramme, nom, taille — qui s'ouvre d'un clic dans
le logiciel du système. Un fichier devient du même coup la **huitième famille du
graphe** : il se cite, il porte des backlinks, il peut être un nœud de carte.

**Les deux choses à savoir avant d'y toucher :**

1. **Les octets ne sont pas dans la note.** La table `files` porte le
   signalement, les octets vivent dans `<app_data>/pieces-jointes/<uid>`. La
   ligne se synchronise, **les octets non** : sur l'autre appareil la pièce
   jointe s'affiche grisée, « pas sur cet appareil ». L'en-tête de la 028 porte
   le calcul qui a tranché.
2. **`object_links` n'a plus de `CHECK`.** Il refusait la huitième famille, et
   une contrainte violée par une ligne distante arrête le CYCLE de
   synchronisation, pas la ligne. La règle est en TypeScript, gardée par deux
   tests. Les arêtes citant un fichier **ne quittent pas la machine** — c'est ce
   qui protège un appareil resté en version antérieure.

**Fichiers neufs.** `lib/piecesJointes.ts` (pur, 22 tests),
`lib/piecesJointesDom.ts` (+ 13 tests sous `happy-dom`),
`components/useDepotPieceJointe.ts`, `src-tauri/src/pieces_jointes.rs` (4 tests),
`src-tauri/migrations/028_pieces_jointes.sql`.

**⛔⛔ AVANT TOUT BUILD NATIF — LIRE CECI.** La base réelle d'Antonin est en
**027** (`corbeille`, jouée le 2026-09-23 par le chantier voisin), et la 027
**n'est PAS sur `mobile-ios`** : elle dort sur `chantier/menus-contextuels`.
`sqlx` valide à chaque démarrage que toute migration enregistrée dans la base
existe encore dans le binaire (`ignore_missing` vaut `false`, et
`tauri-plugin-sql` ne le change jamais). Construire depuis `mobile-ios` seul
ferait donc échouer le démarrage sur `VersionMissing(27)` — **l'app ne s'ouvre
plus du tout**. ▶️ **Fusionner `chantier/menus-contextuels` AVANT de construire.**
Détail et commande de contrôle : `PIEGES.md` § 22.9.
✅ **Résolu le 2026-09-24** : la branche des menus est fusionnée, `mobile-ios`
porte 027 ET 028. La règle générale du § 22.9 (contrôler la base contre le
dossier des migrations avant tout build) reste valable.

**⛔ CE QUI RESTE, ET QUI EST IMPORTANT.**

- ⭐ **VU sur le vrai moteur** via `webkit-pilote.swift` (l'outil de
  [P-menus]) : bouton présent, **trois états du jeton distincts en sombre et en
  clair**, tokens CSS qui résolvent, aucun débordement. Captures :
  `/tmp/pj-shots/sombre.png` et `clair.png` (temporaires).
- ⛔ **PAS VU : le clic, et l'entrée du menu « Insérer » du Savoir.** Le pas
  `{"clic"}` de l'outil ne produit aucun événement DOM (§ 22.8, établi par
  contre-épreuve). Le hit-test, lui, est prouvé : le clic toucherait `.pj-nom`
  et `closest()` remonte au bon jeton. **Premier geste de la reprise** : joindre
  un vrai fichier et cliquer le jeton, dans l'app installée ou dans Chrome.
- **Aucun build natif** : la 028 n'a jamais tourné sur la vraie base d'Antonin,
  et la commande Rust n'a jamais copié un octet. À grouper avec [P-menus] et
  [T-encre] — chaque build lui coûte une fenêtre de trousseau.
- ⚠️ **Sauvegarder la base avant ce build.** La 028 RECRÉE `object_links`
  (copie, `DROP`, renommage). C'est éprouvé sur base neuve et sur les 27
  migrations d'affilée, jamais sur ses vraies données.
- **Le numéro 027 appartient à [P-menus]** (corbeille), non fusionné. Les deux
  migrations sont compatibles dans les deux sens, vérifié.
- Une pièce jointe supprimée **ne passe pas par la corbeille** (`files` n'a pas
  de `deleted_at`) — couture laissée au chantier qui possède ce motif.

### 11.z Le 2026-09-29 — cartes déplaçables et typées, carte d'objectif éditable, vue Objectifs en maître-détail

Cadrage `PROMPT-CARTE-OBJECTIFS.md`. Branche **`chantier/carte-objectifs`** (worktree
`~/Desktop/Shale-chantiers/carte-objectifs`), depuis `mobile-ios` `340bdf4`.
Phases A à E faites, **fusionnée dans `mobile-ios`** ; le build natif et son
installation sont consignés en fin d'entrée. Aucune migration, aucun Rust touché.
Le pourquoi : `CLAUDE.md` (section datée) ; pièges : `PIEGES.md` § 24.

**Ce qui a changé à l'écran.**
- Carte de note / du Savoir : **glisser déplace un nœud à l'écran** (et sa
  descendance) sans rien changer d'autre ; **⌥ + glisser** ou **« Rattacher à un
  autre nœud… »** le rattache ailleurs ; **« Réorganiser »** en deux temps (le
  premier montre la carte rangée) ; un bouton **« Actions » (⋯)** dans la barre.
- **Menu « Type »** d'un nœud (clic droit, « Actions », ⌥T) : Étape / Tâche /
  Habitude créent le vrai objet, rangé d'après la hiérarchie de la carte, après
  un panneau qui annonce ce qui va être écrit. Icône de type dans la note et
  l'export ; coche, échéance, série et % en direct dans l'éditeur. Détyper.
- **« En faire un objectif »** ne recopie plus une étape citée et ne déplace plus
  une tâche rattachée ailleurs.
- **Carte d'un objectif éditable** : Tab ajoute un enfant TYPÉ, renommer renomme
  l'objet, cocher coche, supprimer met en corbeille (une note rattachée se
  détache) ; glisser ne change que la place, rangée dans le réglage synchronisé
  `carte.objectif.<uid>`. Le texte des nœuds est le titre seul (plus de « · 42 % »
  ni de « ✓ » figés dans l'export).
- ⭐ **Vue Objectifs en maître-détail** (direction B « épurée », arrêt 3) : à
  gauche la liste, chaque objectif avec son pourcentage et **sa prochaine
  action** (la tâche la plus en retard, sinon la plus proche, sinon la première
  de la feuille de route) ; à droite la fiche de l'objectif choisi — une seule
  phrase d'origine (« Saisi à la main : la feuille de route ne compte pas. La
  faire compter » remplace le bandeau contradictoire), « Carte », un seul « ⋯ »,
  la feuille de route. Une icône par niveau (dossier = phase, cible = sous-
  objectif) à la place de la pastille « PHASE » ; l'habitude ou la tâche qui
  compte une étape est nommée dans sa ligne. Sur iPhone, la liste OU la fiche.
  « Voir l'objectif » (mention, carte) ouvre SA fiche (`sb:open-goal`).

**Ce qui est prouvé.**
- ✅ 12 empreintes du rendu relevées AVANT le chantier : une carte sans position
  se dessine au caractère près comme avant (une seule changée exprès : une tâche
  citée prend son icône — un test prouve que c'est la seule différence).
- ✅ Test § 9.13 (huit gestes, aucune position manuelle ne bouge) ; test
  d'identité (deux états opposés, un même bloc) ; rattachement par la hiérarchie ;
  positions d'objectif (clé synchronisée, aller-retour, fusion). Mutations vues
  rouges sur chacun.
- ✅ À l'écran (Chrome sans fenêtre, démo) : le nœud suit le curseur au pixel ;
  les trois typages ; la tâche cochée depuis la carte (50 % en direct) ; les
  objets présents dans Objectifs, Tâches, Journal ; les **quatre preuves** de la
  carte d'objectif (créer → feuille de route ; renommer dans la feuille de route →
  la carte suit, et l'inverse ; supprimer → corbeille → restaurer → de retour ;
  glisser → ordre de la feuille de route inchangé, position retrouvée).
- ✅ App en **anglais** : aucune clé manquante au journal de `t()` ; **thème
  clair** ; **390 × 844 au doigt** en émulation.
- ✅ Phase D : `prochaineAction` (9 tests, cinq mutations vues rouges) ; à
  l'écran en démo — sombre et clair, français et anglais (aucune clé manquante),
  bureau et 390 × 844 au doigt : la liste, la fiche, une phase créée par le menu,
  un sous-objectif compté par une habitude (« 1/30 · 🔥 Méditation ») ;
  « ouvrir l'objectif » depuis les Notes (vue non montée), depuis la vue déjà
  ouverte, et à la création d'un objectif → la bonne fiche à chaque fois.
- ✅ **Ligne de base finale, SANS le patch de démo** (2026-09-29 22:29) : `tsc`,
  `test:types`, `i18n:check` (2241 entrées : 18 phrases de l'ancienne vue
  retirées), `i18n:durs` (0), build Vite, vitest **1586 / 1586**. `grep -r
  AUDIT-TEMP src/` → 0, `git diff --exit-code src/lib/auth/` propre. Rejouée à
  22:45 après le dernier correctif (une ponctuation des Réglages, PIEGES
  § 24.11), sous une charge de ~95 (rendu After Effects + `cargo` iOS) : 1583,
  et 3 EXPIRATIONS toutes dans `sync/` (§ 9.11) — ces deux fichiers rejoués
  avec un délai large : **49 / 49**.
- ✅ `cargo check --all-targets`, `--target aarch64-apple-ios` et `--target
  aarch64-apple-ios-sim` : code 0 tous les trois (29 et 11 min à cache vide,
  machine chargée). Aucun Rust touché.
- ✅ **Installé le 2026-09-29 à 23:22** — un seul build, groupé avec « iOS
  connexion seule » (`d195774`, jamais construit). *(Précision du 2026-10-06 :
  « jamais construit » parlait de l'app MAC, jusqu'à ce soir-là. Côté iPhone,
  l'app du jour a été construite et regardée le 2026-10-06 — `MOBILE.md` § 28.)* mobile-ios `faa7b5b`, build
  code 0 ; témoins de la nouvelle vue dans `dist/assets` (et 0 pour les phrases
  de l'ancienne) ; sha256 installée = source (`b7465140…`), ≠ ancienne
  (`a270fd00…`). Aucune migration : base en 28 avant et après, integrity ok,
  0 violation de clé étrangère, comptes identiques à la sauvegarde
  `Shale-chantiers/sauvegardes/avant-carte-objectifs-20260929-2322/`.
  ⛔ Le trousseau peut redemander l'accès : « Toujours autoriser ».

**Ce qui ne l'est pas.**
- ⛔ Rien n'a été essayé À LA MAIN dans l'app installée (WKWebView) : toutes les
  preuves à l'écran sont en Chrome, en démo. Pas d'iPhone réel ni de simulateur
  (dettes : `MOBILE.md` § 26).
- ⚠️ Une version antérieure de l'app qui RÉÉCRIT une carte en efface les positions
  et les nœuds-habitudes (`PIEGES.md` § 24.1) : tous les appareils à la même
  version avant de s'en servir.
- ⚠️ Deux appareils qui déplacent deux nœuds de la même carte d'objectif au même
  instant : l'un des deux déplacements est perdu (last-write-wins sur le réglage).

**Retours d'Antonin après essai (2026-09-29, 23 h), faits le soir même.**
- **Typer d'un clic** : le menu « Type » propose Idée, Phase, Sous-objectif,
  Tâche, Habitude et crée l'objet sans fenêtre ; une ligne dans l'en-tête de la
  carte dit où il est allé. Seul reste un choix « sous quel objectif ? » quand
  aucun objectif n'est au-dessus du nœud. Habitude rattachée : 30 jours par
  défaut, réglables dans la feuille de route.
- **Supprimer un nœud typé emporte son objet** (tâche, habitude, étape, et
  l'étape qui comptait une habitude) dans « Supprimés récemment », en un toast ;
  « Annuler » et ⌘Z rendent objets ET nœuds. Jamais une note, une fiche, un
  événement, ni un objectif racine cité.
- **Le toast « Annuler » était inerte** sous tout éditeur plein écran — porté
  hors de `#root` (`PIEGES.md` § 24.13).
- ✅ Prouvé en démo (Chrome) : les quatre typages directs sans dialogue et leur
  ligne d'en-tête ; le choix d'objectif pour une carte libre ; la suppression
  d'une phase qui emporte sa tâche, son habitude et l'étape qui la comptait
  (« … et 3 éléments ») ; « Annuler » cliquable (`inert` absent, au premier
  plan) qui rend tout ; ⌘Z, ⌘⇧Z, ⌘Z ; dans la carte d'objectif, une habitude
  créée sans panneau puis supprimée avec son étape ; en anglais, rien ne manque.
  `planDirect` (7 tests) et `objetsEmportes` (7 tests) : sept mutations vues
  rouges. Ligne de base sans le patch de démo (23:51) : `tsc`, `test:types`,
  `i18n:check` (2233 : 19 phrases de l'ancien panneau retirées), `i18n:durs`
  (0), build Vite, vitest **1600 / 1600** ; rebasé sur le Timer (`9276471`) :
  **1619 / 1619**.
- ✅ **Installé le 2026-09-30 à 00:03** (mobile-ios `85dd58d`) : témoins du
  typage direct dans `dist/assets`, 0 pour l'ancien panneau ; sha256 installée
  = source (`755990c9…`) ; base en 28 avant et après, integrity ok, comptes
  identiques à `sauvegardes/avant-retours-cartes-20260930-0003/`.

**Ce qui reste.** Essayer à la main dans l'app installée (Antonin n'a rien pu
essayer en démo — arrêt 2). iPhone : `MOBILE.md` § 26, dont la vue Objectifs à
390 pt. Site : `DETTE-SITE.md` entrée S (captures Objectifs à régénérer).
Écarté : `AMELIORATIONS-UI.md` (fin de fichier). Le réglage `layout.goals`
(géométrie des anciens panneaux par catégorie) est orphelin, sans effet.

### 11.z Le 2026-09-30 — la vue Tâches rangée par moment ; un objectif ou une carte supprimés emportent leurs tâches

Demande directe d'Antonin : « améliore le design de l'onglet Tâches, son
intuitivité », puis « si une carte mentale liée à un objectif ou un objectif
seul est supprimé, les tâches liées le soient aussi ». Branche
**`chantier/taches`** (worktree `~/Desktop/Shale-chantiers/taches`), depuis
`mobile-ios` `b6e9443`. Aucune migration, aucun Rust. Le pourquoi :
`CLAUDE.md` (section du 2026-09-30) ; pièges : `PIEGES.md` § 27.

**Ce qui a changé à l'écran.**
- **Tâches** : une ligne d'**ajout rapide** en haut (un libellé, Entrée — sans
  date, avec le tag qu'on regarde) ; les tâches **rangées par moment** —
  En retard (en rouge), Aujourd'hui, À venir, Sans date, Routines (récurrentes
  qui ne tombent pas aujourd'hui), Faites (repliées, 20 puis « Afficher les
  autres ») ; sous chaque tâche UNE ligne de méta : échéance relative
  (« hier », « ven. 2 oct. »), créneau, rythme, **objectif cliquable** (ouvre sa
  fiche, étape comprise), « reportée n fois » ; la **priorité colore le contour
  de la case** (haute rouge, moyenne ambre) au lieu d'un point de 6 px ;
  **toucher une tâche l'ouvre** ; cochée, elle reste 1,2 s barrée à sa place
  puis rejoint « Faites » ; filtres = les tags + une recherche (libellé, tag,
  objectif ; sans accents) ; la gestion des tags derrière « Gérer ».
  Retirés : les filtres « Toutes / À faire / Faites », le filtre « échéance »
  (un jour précis — le Calendrier le fait), la grille redimensionnable, les
  deux boutons au survol (le « ⋯ » et le clic droit portent les mêmes gestes).
- **Un objectif supprimé emporte ses tâches** — les siennes et celles de ses
  étapes — sous le même horodatage : une seule ligne dans « Supprimés
  récemment », restaurées avec lui. Les confirmations le disent (« Il part dans
  Supprimés récemment avec 2 étapes et 5 tâches ») et apparaissent aussi quand
  il n'emporte que des tâches. Cela vaut pour TOUS les chemins (menu, feuille de
  route, carte d'objectif, nœud d'une carte) : la règle est dans les données.
- **Une carte mentale supprimée emporte ce que ses nœuds ont créé** (tâches,
  étapes, habitudes — jamais l'objectif racine cité, jamais une note ou une
  fiche citée) : la note, la fiche du Savoir ou le sujet qui la porte, et
  « Supprimer la carte » sur le bloc. Un toast, un « Annuler » qui rend tout.
- Au passage (même défaut que les rythmes) : le **graphique de la semaine**
  nommait ses jours en français dans l'app anglaise.

**Prouvé.** En démo (Chrome piloté), clair et sombre, français et anglais,
1360 et 390 pt : sections, ajout rapide (sa section se déplie, la ligne se
surligne), coche qui reste puis part, recherche « revis », « Gérer », menu clic
droit ; objectif racine supprimé → « … et 7 éléments », il ne reste que les
2 tâches étrangères, « Annuler » rend les 7 ; bloc « Supprimer la carte » →
confirmation qui annonce, « Carte retirée de la note, et 2 éléments… »,
« Annuler » remet bloc et tâches ; note ouverte supprimée → « … et 2 éléments ».
Tests : corbeille natif ET démo (`api.test.ts`, `base.test.ts` — 17 vus rouges
avant la règle), `lots.test.ts`, `emportes.test.ts` (8 vus rouges),
`tachesVue.test.ts` (mutations vues rouges), `geste.test.ts` (note + carte en
démo, vu rouge sans la règle).

- ✅ **Installé le 2026-09-30 à 10:49** (mobile-ios `3a6ed9f`, build groupé avec
  le fond de fenêtre `6bcab1c`) : témoins dans `dist/assets` (« Ajouter une
  tâche… » 4, « Il part dans Supprimés récemment avec {liste}. » 2, « Carte
  retirée de la note, et » 2), 0 pour « Ses tâches restent » et l'ancien filtre ;
  `plugin:window|set_background_color` dans le binaire : 1 ; sha256 installée =
  source (`3c28746c…`, ancienne `755990c9…`) ; base en 28 avant et après,
  integrity ok, FK 0, comptes identiques à `sauvegardes/avant-taches-20260930-1047/`.
- ⚠️ **Constaté dans la vraie base, sans y toucher** : 51 tâches parties dans
  « Supprimés récemment » le 30/09 entre 00:14:00 et 00:14:08 (heure de Paris),
  une par une — la signature d'UN geste qui en emporte beaucoup (suppression
  d'un nœud de carte typé, build de 00:03). 42 appartenaient à des objectifs
  supprimés les 26–27/09. Restaurables jusqu'au 29/10 ; décision à Antonin.

**Ce qui reste.** Retirer une carte au CLAVIER (sélection puis ⌫, ou couper)
n'emporte rien : seuls « Supprimer la carte » et la suppression de la page le
font (`CLAUDE.md`). iPhone : `MOBILE.md` § 27. Site : `DETTE-SITE.md` entrée V
(deux captures). Écarté ou reporté : `AMELIORATIONS-UI.md` (fin de fichier).

### 11.x Le 2026-09-30 — ⭐ le trading est mis de côté (app et site)

**Demandé par Antonin** au passage en pré-lancement. **Un interrupteur**,
`TRADING_ACTIF = false` (`src/lib/features.ts`) : Trading, Market-Brain et
Position sont **absents** pour tout le monde, sur toutes les plateformes —
aucun cadenas, aucun paywall, aucun « Passer à Shale Trade ». **Rien n'est
supprimé** : ni code, ni tables, ni les trades de la vraie base (1 trade au
2026-09-18), qui se synchronisent comme avant. Le pourquoi, la liste de ce qui
débordait des modules, et ce qu'il faut savoir avant de rallumer : `CLAUDE.md`,
section du 2026-09-30. Les pièges : `PIEGES.md` § 28.

**Ce qui change à l'écran** (en plus des trois modules) : plus de pastille des
sessions de marché ni de « trading os » dans la barre ; plus de trades dans la
jauge d'énergie ; Personnaliser ne liste plus les modules trading ; le
Calendrier **propose enfin des créneaux en semaine** (il n'en proposait aucun,
pour personne, `PIEGES.md` § 28.2) ; la catégorie Finance « Trading » et le type
Savoir « Setup de trading » (semés dans chaque base) ne se proposent plus, sauf
à qui s'en sert ; les exemples des formulaires ne parlent plus de trading.
**Le jeu de démo devient celui d'un indépendant** (design) : il fait les
captures du site.

**Prouvé.** Ligne de base : 1686/1686 (`trading-de-cote.test.ts` : 15 tests,
les règles dans les deux positions de l'interrupteur ; le filet « aucun mot de
trading dans la démo » vu rouge sur l'ancienne démo), `tsc`, `test:types`,
`i18n:check` (0 manquante), `i18n:durs` (0 sûrement française), `vite build`.
Aucune ligne de Rust touchée, aucune migration.

- ✅ **Installé le 2026-09-30 à 11:25** (mobile-ios `0467fa8`, build seul :
  rien d'autre n'était prêt) : témoins dans `dist/assets` (« Règle son point de
  départ et son rythme » 2, « séances, €, pages » 2, « Prospection 1 h » 2),
  0 pour « ex. Backtester 1 h », « Passer trader full-time », « Setup cassure
  H4 » ; sha256 installée = source (`d14a5c11…`, ancienne `3c28746c…`) ; base
  en 28 avant et après, integrity ok, FK 0, comptes identiques (1 trade,
  78 objectifs, 52 tâches, 21 notes) à `Shale-chantiers/sauvegardes/
  avant-sans-trading-20260930-1121/` (copie aussi sur Crucial X6).
  ⚠️ L'app ouverte attendait depuis 10:50 la fenêtre de trousseau du build
  Tâches : arrêtée et relancée (`PIEGES.md` § 28.4). **Une fenêtre de trousseau
  attend Antonin** (« Toujours autoriser »).

**⛔ Pas prouvé.** **Rien n'a été vu à l'écran** : le patch de démo du § 13.2 a
été refusé par le mode automatique (`PIEGES.md` § 26.2, § 28.3), et l'app
installée n'a pas été regardée non plus. Et les **26
captures du site montrent encore la démo trader** — même refus
(`DETTE-SITE.md` § W.1).
✅ *Corrigé le 2026-09-30 au soir : patch démo autorisé par Antonin, les 26
captures refaites, regardées et en ligne (site `7be4f7d`, `DETTE-SITE.md`
§ W.1). Du même coup, l'interface sans trading a été VUE en mode démo — dix
modules, deux thèmes, bureau et iPhone. L'app installée, elle, ne l'a
toujours pas été.*

**Site** (dépôt du site, branche `chantier/sans-trading-site`) : encadré de fin
des articles (« calcul de position, sessions de marché »), exemple « 50
backtests », 113 traductions orphelines retirées, `shoot-v2.mjs` ne réécrit
plus la démo en libellés de trading. L'avertissement juridique des mentions
légales est **proposé, pas écrit** (`DETTE-SITE.md` § W.2).

### 11.p Le 2026-09-30 — la priorité des étapes et des tâches ; la feuille de route épurée

**Demandé par Antonin** : « donner un ordre de priorité aux étapes et aux
tâches dès la création […] faible, moyenne, élevée […] pas un mode avancé avec
un poids » ; et « c'est trop de texte […] ça doit être expliqué dans
l'onboarding et pas marqué dans l'app tout le temps ». Chantier
`chantier/priorites`.

- **Trois niveaux, pas quatre** (il proposait « très élevée ») :
  `tasks.priority` porte un `CHECK` depuis la 001, un quatrième niveau
  demanderait de reconstruire la table des tâches, synchronisation comprise.
  Un seul vocabulaire partout, **Faible · Moyenne · Élevée** (« Haute / Basse »
  retirés) : `src/lib/priorite.ts`.
- **Migration 030** : `goals.priority`, sans CHECK. `weight` reste en base (à 1
  sur les 79 objectifs de la vraie base, vérifié en lecture seule) ; plus rien
  ne l'affiche.
- **Où se pose la priorité** : à la création (pastille qui tourne d'un clic à
  côté du champ — étape, tâche de la feuille de route, ajout rapide de Tâches ;
  elle repart « moyenne » après chaque ajout), au **clic droit** (menu « ⋯ »
  d'une étape ; « Priorité ▸ » dans le menu de toute tâche, y compris dans la
  feuille de route, qui gagne ce menu), et dans **« Modifier… »** (fenêtre de
  l'étape, qui s'appelait « Échéance et description… » ; fenêtre de la tâche).
- **Ce qu'elle change** : la couleur du repère (contour de la case d'une tâche,
  icône d'une étape — rouge, jaune, neutre), l'ordre des tâches d'une étape,
  et la **prochaine action** d'un objectif (à date égale, la plus prioritaire ;
  la date reste reine). **Pas l'avancement** : chaque étape compte pour une.
- **Retiré de l'écran** : « Rien à mesurer pour l'instant… », « vide, non
  comptée » (et « · n vides, non comptées »), « Rien de rattaché pour
  l'instant. », « récurrente, non comptée » (un ↻), « note / fiche, ne compte
  pas », l'aide sous le champ de saisie d'une étape, « Saisis le nombre à
  atteindre… », le repli « Avancé / Poids ». Les explications vivent dans des
  bulles `data-tip-attente="longue"` (2 s de survol, jamais « à chaud »,
  `Tooltip.tsx`) et dans l'écran « objectif » de l'accueil (deux lignes).
  Une PANNE reste écrite (« source introuvable », « cible à zéro »).

**Vérifié** : 1714/1714 tests, dont ceux du chantier, vus rouges avant le code
(données natif ET démo, sync, menu, prochaine action, bulle longue), `tsc`, types des
tests, i18n (0 manquante, 22 orphelines retirées), `vite build`. **À l'écran en
démo** : clair/FR et sombre/EN à 1280, iPhone émulé à 390 ; changer la priorité
au clic droit d'une étape (l'icône passe au rouge), « Priorité ▸ » d'une tâche,
la pastille qui ne vole pas le focus du champ (étape créée « élevée », tâche
créée « faible »).

**Installé le 2026-09-30 à 21:47** (build de `60366b8`, 21:31 → 21:46, code 0) :
sha256 installée = source (`3f338570…`, ancienne `d14a5c11…`), `diff -r`
identique. Sauvegardes `Shale-chantiers/sauvegardes/avant-priorites-20260930-2131/`
(app ouverte, puis app fermée). **Migration 030 jouée sur la vraie base** :
version 28 → 30, integrity ok, FK 0, 79 objectifs tous « medium », comptes
identiques (56 tâches, 21 notes, 4 habitudes). Fenêtre de trousseau ouverte :
« Toujours autoriser » attend Antonin.

**Pas vérifié** : l'app installée à la main par Antonin ; la bulle de deux
secondes sous un vrai curseur (testée en happy-dom seulement) ; l'iPhone réel.
Pièges : `PIEGES.md` § 29.

### 11.p bis Le 2026-10-01 — un liseré par type dans la feuille de route

Antonin trouvait encore qu'on s'y perdait : « de légers liserés autour des
étapes, d'autres pour les tâches ». Quatre maquettes proposées (cartes
emboîtées, arborescence, bandeaux, un liseré par type) ; **il a choisi la D**,
et demandé qu'une légende dise quelle icône est quoi.

- **Phase** : cadre marqué (1,5 px, `border-strong`, 14 px d'arrondi, fond
  `surface`). **Sous-objectif** : cadre en **pointillé**. **Tâche** (et note,
  fiche, événement rattachés) : sa propre **pastille** au liseré fin, fond
  `overlay` (`PASTILLE_ELEMENT`). Le panneau « Compter des éléments / Atteindre
  un nombre » a perdu son fond gris : les pastilles suffisent.
- **Légende** en tête, à côté de « Feuille de route » : dossier = Phase,
  cible = Sous-objectif, case = Tâche (`Legende`). Un nom par icône, pas
  d'explication.

**Vérifié** en démo : clair/FR, sombre/EN à 1280, iPhone émulé à 390. `tsc`,
i18n (2281), `vite build`. Tests : 1713/1714 — l'échec restant
(`finance/facturation/demo.test.ts`, « le solde composé MONTE ») **existe aussi
sans ce changement** : il dépend du jour du mois (vu le 1er octobre). Proposé
en session séparée.

**Installé le 2026-10-01 à 00:41** (build de `4cdc44a`, code 0) : sha256
installée = source (`b2a72863…`, ancienne `3f338570…`), `diff -r` identique.
Sauvegarde `Shale-chantiers/sauvegardes/avant-liseres-20261001-0033/`. Aucune
migration : base en 30 avant et après, integrity ok, FK 0, 79 objectifs,
56 tâches. Fenêtre de trousseau ouverte : « Toujours autoriser » attend Antonin.

### 11.d Le 2026-10-01 — la démo Finance tient n'importe quel jour du mois

`finance/facturation/demo.test.ts` (« le solde composé MONTE ») tombait du 1er
au 4 de chaque mois, sans changement de code : les relevés de la démo étaient
datés du 1er du mois courant, et les encaissements récents (J-3, J-5) tombaient
avant eux, donc absorbés par le solde composé (PIEGES § 30.1).

- **`demo.ts`** : le dernier relevé de chaque compte a toujours au moins une
  semaine (`debutDeMois(addDays(todayStr(), -7))`). Du 8 à la fin du mois,
  rien ne change ; du 1er au 7, la courbe s'arrête au 1er du mois précédent.
- **Le test** balaie chaque jour du 01/10/2026 au 30/09/2027, plus du 25/02 au
  05/03/2028 (bissextile) : solde composé > solde nu, aucun relevé manquant ni
  périmé, runway calculable et meilleur avec créances, runway de la démo
  Finance entre 5 et 11 mois, encours non vides, les trois situations de
  facture. Contre-épreuve : l'ancienne datation y fait lister 52 jours
  (1 à 4 de chaque mois), et rien d'autre.

**Vérifié** : les quatre fichiers de test qui lisent la démo passent sous six
dates simulées (01/10, 07/10, 15/10, 31/10/2026, 29/02 et 01/03/2028). `tsc`,
`test:types`, i18n (2281), `vite build`. Suite complète 1713/1715 sous une
charge machine de 118 : les deux échecs sont les tests de volume de
`sync/engine.test.ts` (expirés à 35 s), 33/33 relancés seuls.

**Aucun build natif** : la démo ne sert que hors Tauri (`repo.ts`, `isTauri`).
Les captures du site ne changent pas (prises un 30, hors de la fenêtre).
### 11.i Le 2026-10-01 — ⭐ la barre latérale par intention ; Finance mise de côté

*Branche `chantier/intentions`, worktree `~/Desktop/Shale-chantiers/intentions`.
Tests et types verts ; **pas encore fusionnée, pas encore construite en natif**
(le build se groupe avec le prochain, une fenêtre de trousseau par build).*

Demande d'Antonin, sur le site refait : « j'aime bien le groupé par intention,
et ce serait bien que ce soit vrai dans l'app aussi. Supprime Finance, et
remplace Productivité par les trois items du site. »

- **`CATEGORIES` (`Sidebar.tsx`)** : « Productivité » (neuf modules en vrac)
  devient **Décider quoi faire** (Tâches, Calendrier) · **Avancer et mesurer**
  (Timer, Objectifs, Performance) · **Penser et retenir** (Notes, Journal,
  Savoir) — les trois groupes de `vitrine/src/views/refonte/Modules.astro`, dans
  le même ordre. Aujourd'hui reste hors catégorie, au-dessus. La feuille
  « Plus » de l'iPhone suit (elle lit `CATEGORIES`). Les réglages de repli
  enregistrés sous l'ancien identifiant `prod` sont simplement ignorés : les
  trois groupes s'ouvrent dépliés.
- **Finance mise de côté**, même mécanique que le trading (§ 11.x) :
  `FINANCE_ACTIF = false` dans `lib/features.ts`. Rien n'est supprimé — code,
  tables, comptes, factures, relevés restent et se synchronisent. Éteinte,
  Finance est **absente**, jamais verrouillée : `presenceModule` rend `absent`
  (barre latérale, feuille « Plus », garde de navigation), `afficheModule`
  faux, la palette ⌘K n'offre plus « Aller à Finance » ni ses raccourcis, et
  le calendrier (vue et carte) ne pose plus les échéances de factures. Un
  quatrième groupe **« Tenir les comptes »** (`comptes`) ne porte que Finance :
  sans membre visible il ne se dessine pas ; rallumer Finance le fait
  réapparaître après « Penser et retenir ».
- **Profils de licence** : les quatre libellés de catégorie entrent dans
  `CLES_LIBELLES_PROFIL` (`licence/catalogue.ts`), « Productivité » en sort ;
  `catalogue.test.ts` vérifie les nouveaux identifiants.
- **Tests** : `lib/finance-de-cote.test.ts` (interrupteur, présence dans les
  deux positions, palette, forme exacte de `CATEGORIES` lue dans le source) ;
  `trading-de-cote.test.ts` ne compte plus Finance parmi la productivité.
- **Site** : `Modules.astro` et l'accueil n'ont plus Finance ni « Tenir les
  comptes » (chantier `accueil-epure` du site, même jour) — l'app et le site
  disent la même chose.

⚠️ Le trading et Finance sont **deux interrupteurs indépendants**. Un nouvel
endroit qui montre Finance lit `presenceModule` / `afficheModule`, pas la
constante (sauf sans accès aux droits, comme pour le trading).



### 11.z Le 2026-09-29 — l'IA de Shale Pro (chantier en cours : phase A faite)

Cahier des charges : `~/Desktop/Prompt en attente/prompt/PROMPT-IA-PRO.md`
(phases 0, A à H, avec des arrêts obligatoires). Audit et réponses d'Antonin :
`~/Desktop/Shale-chantiers/AUDIT-IA-PRO.md`. Décisions : `CLAUDE.md`, section
datée. Pièges : `PIEGES.md` § 25.

**Où en est-on.**

| Phase | État |
|---|---|
| 0 — audit | ✅ validé par Antonin le 2026-09-29 (Business SANS IA ; recommandations retenues) |
| A — serveur | ✅ écrit et testé, validé par Antonin (« ok on continue », 2026-09-29). **Migration Supabase 008 JOUÉE en production** (sauvegarde JSON `shale-backups/avant-ia-008-20260929-2332/`). ⛔ **Fonction `ai` NON déployée, secret de budget NON posé** : refusés par le garde-fou de permissions (déploiement en production) |
| B — socle app | ✅ commitée (`cbdeb61`) |
| C — brief et clôture | ✅ écrite, testée, vue à l'écran en démo (WebKit piloté) — ⛔ arrêt obligatoire : validation d'Antonin |
| ↪ 2026-10-01 | **Passage sur Gemini** (décision d'Antonin : plus économique) — migration Supabase **010** (`ai_config.provider`, tout sur `gemini-3.5-flash-lite`, la revue sur `gemini-3.8-flash`), adaptateur `coeur/gemini.ts`, textes du consentement. ✅ 010 **jouée et contrôlée le 2026-10-01 au soir** (sauvegarde `shale-backups/avant-ia-010-20261001-2218/`) ; ✅ fonction `ai` **déployée** et budget posé (50 $) le même soir par Antonin — contrôlée sans session seulement (401, CORS) ; ⛔ pas de `GEMINI_API_KEY`, tout `enabled = false`, aucun appel authentifié jamais fait |
| D — capture | ✅ écrite, testée, vue à l'écran en démo (2026-10-01) |
| E — tâches et objectifs | ✅ écrite, testée, vue à l'écran en démo (2026-10-01) : découper, estimer, décomposer, proposer des tâches, objectif en péril — `components/ia/ActionsIa.tsx`, `lib/ia/planifier.ts` |
| F — notes | ✅ écrite, testée, vue à l'écran en démo (2026-10-01) : résumer, réécrire (⌘Z), liens @, développer, traduire (nouvelle note liée), carte mentale — `components/ia/NoteIa.tsx`, `lib/ia/texteNote.ts`. ⚠️ Notes seulement : le Savoir (`NoteComposer`) n'a pas le bouton |
| G — revue hebdomadaire | ✅ écrite, testée, vue à l'écran en démo (2026-10-01) : carte dans Performance, règle de notification Rust `weekly_review`. ⚠️ **#39 (runway « et si… ») NON construite : Finance est mise de côté** |
| H — site, docs, recette | ⛔ **ARRÊT** (2026-10-01) : recette écrite (`~/Desktop/Shale-chantiers/RECETTE-IA.md`), mode d'emploi dans `CLAUDE.md`, liste des changements du site à valider (`DETTE-SITE.md` § T.7) — **rien n'est appliqué au site, rien n'est déployé, rien n'est fusionné** |

**⚠️ Migration SQLite 029 (`ia_contenus`) sur la branche** : jamais jouée sur la
vraie base. Elle partira avec le prochain build natif APRÈS fusion — sauvegarder
avant (`sqlite3 .backup`).

**Pour voir la phase C en démo** : patch `AUDIT-TEMP` (§ 13.2), offre simulée
`shale_pro` (`localStorage["shale.demo.tier"]`), Réglages → IA → Activer, puis
un sujet et l'heure du brief avant l'heure courante. Chrome étant souvent non
connecté, le pilote `tools/webkit-pilote.swift` suffit — les clics se font en
JavaScript (`.click()`), son pas `{"clic"}` ne produisant aucun événement DOM.

**Ce qui existe (dépôt du SITE, branche `chantier/ia-pro`, non poussée)** :
`supabase/migrations/008_ia.sql` (tables `ai_config`, `ai_usage`, `ai_events`,
fonctions `ai_offre`, `ai_reserver`, `ai_regler`, `ai_purger_evenements`) et
`supabase/functions/ai/` (entrée Deno `index.ts` + cœur `coeur/`, une seule
fonction servie : `resumer`). **Côté app (branche `chantier/ia-pro`)** : les
tests seulement, `src/lib/ia/serveur.sql.test.ts` et `serveur.test.ts`
(42 tests). Aucun écran, aucune migration SQLite, aucun Rust.

**⚠️ Le checkout principal du site est sur `chantier/ia-pro`**, pas sur
`sync-chiffree` — c'est lui que lisent les tests PGlite de l'app. À remettre sur
`sync-chiffree` à la fusion.

**Pour mettre en service (après accord d'Antonin)** : jouer la 008 (répétée
d'abord sur le banc), déployer `ai` avec `--no-verify-jwt`, qu'Antonin pose
**lui-même** `ANTHROPIC_API_KEY` dans Supabase → Edge Functions → Secrets, poser
`AI_GLOBAL_MONTHLY_BUDGET_USD`, puis un premier appel réel (`index.ts` n'a jamais
tourné : pas de Deno sur ce Mac).

## 2026-10-05 — Accueil épuré (cases d'heures, contenu de départ qui explique l'app)

Détail des décisions : `CLAUDE.md`, même date. Ce qui est fait : cases d'heures à la place du curseur ; contenu de départ refondu (« Exemple · … », objectif d'exemple compté dans « Supprimer les N exemples ») ; essai = plan classique sans IA (code app + `create-checkout` + SQL 013 du site, **non déployés**). Vérifié dans le navigateur en compte neuf (démo vidée) : six écrans, exemples créés, calendrier propre, suppression des 12 exemples (objectif compris). Non vérifié : l'app native installée (rebuild à grouper) ; le visuel des cases (seul le texte a été lu côté session).


## 2026-10-07 — Aujourd'hui : « Habitudes à tenir » à la place du graphique 7 jours

Décisions : `CLAUDE.md`, même date. **Fait** : widget `habitudes` (cochable, série, ↗ vers le Journal), `WeekChart.tsx` supprimé, disposition enregistrée migrée à la lecture (`mergeConfig`), 3 tests (`uiConfig.test.ts`). Aucune migration, aucun Rust.
**Vu à l'écran** (Chrome sans fenêtre, mode démo, vrais clics souris) : la carte affiche 3 habitudes et « 1/3 » ; cocher « Sport » → « 2/3 », série 0 → 1 ; la poignée ↗ ouvre le Journal, où « Sport » est cochée. Plus de « 7 derniers jours » dans la page.
**Pas vu** : au doigt (iPhone), l'anglais à l'écran (clés présentes, `i18n:check` vert), l'état vide (« Aucune habitude pour l'instant. »).
**Installé le 2026-10-07 à 10:14** : build depuis `mobile-ios` `cb64713`, sha256 `5a228f0d3c58…` (ancienne `1c866242a249…`), base 30 avant/après, intégrité ok, 83 tâches / 22 notes / 4 habitudes identiques. Sauvegarde : `sauvegardes-locales/avant-habitudes-aujourdhui-20261007-1003/`. ⚠️ Non regardé dans l'app installée par la session (elle pilote la vraie base).


## 2026-10-07 — La page Admin réservée au compte d'Antonin, par tous ses chemins

Décisions : `CLAUDE.md`, même date. **Fait** : `lib/auth/admin.ts` + trois gardes dans `App.tsx` (navigation, repli, rendu), `admin.test.ts`. Aucune migration, aucun Rust.
**Pas fait** : le code de la Console reste dans le binaire (inerte pour les autres comptes) ; pas de build natif (changement invisible pour Antonin, à grouper avec le prochain).


## 2026-10-08 — Objectifs : liste → page d'un objectif, et « le fil »

Décisions : `CLAUDE.md`, même date. Branche `chantier/objectifs-fil` (worktree `~/Desktop/Shale-chantiers/objectifs-fil`).
**Fait** : `GoalsView.tsx` (liste pleine largeur, page d'un objectif, Échap, retour au même défilement), `FeuilleDeRoute.tsx` (prop `fil`), `lib/objectifs/fil.ts` + 11 tests, `index.css` (`.fil-item`, `.fil-h`, `.objectif-entree`), 2 clés dans `en.ts`. Aucune migration, aucun Rust, aucune dépendance.
**Vu à l'écran** (Chrome sans fenêtre, mode démo, vrais clics — config d'essai hors dépôt `Shale-chantiers/vite.essai-objectifs.mjs`, aucun fichier source patché) : la liste (sombre) ; la page en sombre FR et en clair EN ; 390 × 844 au doigt (liste et page, aucun débordement) ; chaque tronçon finit au centre du nœud suivant (mesuré) ; cocher la dernière tâche d'une étape → son nœud et son tronçon passent à l'encre, le pourcentage suit ; Échap ferme le menu « ⋯ » de la page, le « ⋯ » d'une étape ou le champ « Ajouter une étape » SANS quitter la page, puis ramène à la liste avec le focus sur la ligne ; clic droit sur une ligne → le menu de l'objectif ; l'état « atteint » (dessin forcé, les deux thèmes).
**Pas vu** : l'app native À L'ÉCRAN (installée, voir dessous, mais pas regardée) ; l'animation elle-même (captures fixes) ; un objectif réellement atteint de bout en bout (la démo a une étape saisie à la main à 80 %) ; le glisser pour réordonner les étapes avec le rail ; l'iPhone réel ou le simulateur ; la densité (zoom) autre que 100 %.
**Installé le 2026-10-09 à 00:13** : build depuis `mobile-ios` `a36c959`, sha256 `13c5ad28951f…` (ancienne `64be2614ff03…`, un build du 08/10 à 23:17 non consigné au carnet), base 30 avant/après, intégrité ok, 88 objectifs / 83 tâches / 22 notes / 4 habitudes identiques. Sauvegarde : `sauvegardes-locales/avant-objectifs-fil-20261009-0008/`. Ce build porte aussi la garde de la page Admin (`36774ed`). ⚠️ Non regardé dans l'app installée par la session (elle pilote la vraie base).


## 2026-10-09 — Performance : période unique, courbes de discipline, « À améliorer »

Décisions : `CLAUDE.md`, même date. Branche `chantier/performance` (worktree `~/Desktop/Shale-chantiers/performance`).
**Fait** : `lib/performance/analyse.ts` (pur, 27 tests), `components/performance/Discipline.tsx` (courbe, légende, carrés), `PerformanceView.tsx` (période, tuiles comparées, « À améliorer », deux cartes de discipline, jours de la semaine, focus dans le temps, focus par tag sur la période), clés dans `en.ts`. Aucune migration, aucun Rust, aucune dépendance.
**Vu à l'écran** (Chrome sans fenêtre, mode démo, `Shale-chantiers/vite.essai-performance.mjs`) : l'onglet entier en sombre FR 30 j, clair EN 6 mois, 390 pt 7 j ; aucun débordement ; les cinq graphiques dessinés ; la période choisie est retenue en quittant l'onglet ; « Voir les tâches » ouvre Tâches, « Ouvrir le Journal » ouvre le Journal ; la bulle de la courbe (« ce jour-là », « moyenne 7 jours »).
**Pas vu** : l'app native ; de vraies données sur 6 mois (la démo n'a que 12 jours de coches) ; une période sans rien à signaler à l'écran (couvert par un test) ; le simulateur et l'iPhone réel ; la densité autre que 100 %.
**À savoir** : dans la démo, « Tâches tenues » affiche 38 % parce que les tâches y sont dues depuis plus longtemps que les 12 jours de coches — ce n'est pas un défaut du calcul.
**Installé le 2026-10-09 à 16:53** : build depuis `mobile-ios` `2cbc00e`, sha256 `931dab08ca4e…` (ancienne `13c5ad28951f…`), base 30 avant/après, intégrité ok, 88 objectifs / 83 tâches / 22 notes / 4 habitudes / 8 coches d'habitude / 32 coches de tâche identiques. Sauvegarde : `sauvegardes-locales/avant-performance-20261009-1649/`. ⚠️ Non regardé dans l'app installée par la session (elle pilote la vraie base). ⚠️ La vraie base est presque vide de coches : l'onglet y sera clairsemé.


## 2026-10-10 — Retours du tournage en anglais (reel 018) : cinq défauts corrigés

Décisions : `CLAUDE.md`, même date. Branche `chantier/retours-reel-018` (worktree `~/Desktop/Shale-chantiers/retours-reel-018`).
**Fait** :
- `lib/taches.ts` (`ponctuellesFaites`, `tachesADecider`, `reportsAAppliquer`), `lib/calendrier/agenda.ts`, `CalendarView.tsx` : une tâche faite quitte le bandeau « à décider » et perd son sablier.
- `t("Annuler|défaire")` → “Undo” : `corbeille/geste.tsx` (2), `menu/useMenuBlocs.tsx`, `carte/EditeurCarte.tsx`, `SketchPad.tsx`.
- `PerfStrip.tsx`, `DisciplineRing.tsx` : « {n} j » par la clé.
- `champDate.ts` : `formaterDansPhrase`, utilisée par le bandeau.
- La maxime sans chiffre (choix d'Antonin), en français et en anglais.
- Tests : `taches.test.ts`, `agenda.test.ts`, `champDate.test.ts`, `i18n/retours-anglais.test.ts` (neuf). Aucune migration, aucun Rust, aucune dépendance. `demo.ts` non touché.
**Ligne de base** : vitest 1981 verts, `tsc`, `test:types`, `i18n:check` (2715 entrées), `i18n:durs`, `vite build`. Les tests d'agenda et d'i18n ont été vus rouges contre le code d'avant (5 échecs).
**Vu à l'écran** (Chrome sans fenêtre, mode démo, 1440 × 900, FR et EN, `Shale-chantiers/vite.essai-retours-018.mjs`) :
- « Do it now » : le bandeau disparaît, le sablier aussi, la tâche est barrée dans la grille, et « Done » passe à 3 dans Tâches.
- « Delete » : toast « … is in Recently Deleted | View | Undo » ; « Undo » rend la tâche et le bandeau. En français : « Annuler ».
- Aujourd'hui : « 7 d » (EN), « 7 j » (FR).
- Bandeau : « due on October 7 », « prévue le 7 octobre », puis la nouvelle maxime.
**Pas vu** : l'app native ; l'iPhone ; ⌘Z de la carte et du croquis en anglais (couverts par un test de source seulement) ; le toast de retrait d'un bloc de note.
**À savoir** : dans la démo, « Envoyer le devis à Studio Hélice » (due dans 2 jours, cochée il y a 3 jours) apparaît maintenant barrée dans le Calendrier, comme elle est déjà dans « Faites » côté Tâches. À connaître pour les captures (`chantier/demo-captures-v3`).
**Pas de build natif** : l'app installée ne porte pas ces correctifs ; à grouper avec le prochain build.
## 2026-10-09 — Aujourd'hui : la jauge « Énergie restante » ne restait plus qu'à 100 %

Branche `chantier/jauge-energie` (worktree `~/Desktop/Shale-chantiers/jauge-energie`), depuis `mobile-ios` `589d478`. Le piège : `PIEGES.md` § 34.1.
**Fait** : `lib/mentalLoad.ts` — `num()` rend la valeur par défaut pour un réglage absent (`null`) ou vide, au lieu de 0. `mentalLoad.test.ts`, 7 tests, dont 4 échouent sans la correction (vérifié en la retirant). `tsc` vert, vitest 1961 / 1961 (147 fichiers). Aucune migration, aucun Rust, aucune dépendance.
**Vérifié à la lecture** : `getSetting()` rend bien `null` pour une clé absente, en natif (`rows[0]?.value ?? null`, `repo.ts`) comme en démo.
**Pas vu** : la jauge à l'écran, ni en démo ni dans l'app native. La vraie base n'a été ni lue ni écrite : on ne sait donc pas si elle porte déjà les trois réglages `energy_*` (auquel cas l'app installée n'était pas touchée) ou non.
**Pas fait** : ni poussé, ni fusionné, ni installé — en attente de l'accord d'Antonin.



## 2026-10-11 — Widgets d'Aujourd'hui, hauteur sous densité, barre latérale réductible

Branche `chantier/barre-laterale`, fusionnée dans `mobile-ios`. Front seul : aucune migration, aucun Rust, aucune dépendance. Décisions : `CLAUDE.md`, même date. Pièges : `PIEGES.md` § 35.

**Corrigé (chaque point reproduit puis remesuré dans Chrome sans fenêtre, mode démo, 1470×923 à 110 % — les réglages réels d'Antonin) :**
- « Liens rapides » : hauteur épinglée 144 → rendue 160, « + lien » entier, plus de barre dans la carte.
- Hauteur de l'app : racine = fenêtre à 90, 100, 110 et 120 % (avant : 920 px dans 836 à 110 %).
- Grille : le panneau glissé reste sous le curseur à 90 / 100 / 110 / 120 % (avant : 20 px d'avance après 200 px à 110 %) ; redimensionnement juste.
- Poignées par-dessus le compteur d'Habitudes, les points du Timer, la pastille « Surchargée » : `.rgrid-head` sur les trois en-têtes.
- En-tête Calendrier d'Aujourd'hui aligné sur les autres ; emoji ⌛ → `IconSablier` (carte, agenda, grille horaire) ; « timer » en dur → `t()`.
- 0 calque `backdrop-filter` au repos sur Aujourd'hui (une vingtaine avant) ; `overscroll-behavior` ; `defilerVers()`.
- Balayage des 11 vues à 1470@110, 1120@110, 900@100, 720@100, 1470@120 : aucun contrôle rogné, aucun débordement, aucun défilement parasite. Reste : poignées sur la tuile « cycles du jour » (vue Timer).

**Barre latérale** (`Sidebar.tsx`, `lib/barre.ts`, bloc « Barre latérale » d'`index.css`) :
- « Aujourd'hui » fixe ; titres de catégorie collants (vérifié : le titre collé est bien AU-DESSUS, `elementFromPoint`) ; replier une catégorie collée recale la liste ; fondu en bas, filet en haut.
- Réduire / étendre : ligne du pied, ⌥⌘S, palette ⌘K. Icônes au même pixel dans les deux états (écart 0) ; bouton 41 px en réduit ; 1 seule livraison du `ResizeObserver` de la zone principale par bascule ; aucune mutation d'état dans les 2,5 s après montage.
- Régime étroit / large en pixels locaux, seuil 1000 (vérifié à 100, 110, 120 %).
- Titre long, module renommé long, module masqué, densité 120 %, thème clair, anglais : vus, justes.

**Ligne de base :** vitest **2006** (1981 + 25 : `barre.test.ts`, `barre.source.test.ts`) · `tsc`, `test:types`, `i18n:check` (2722), `i18n:durs`, `build` verts.

**Rejoué dans WebKit** (`tools/webkit-pilote.swift`, démo, 1360×880 à 110 %) : racine = fenêtre, titre `sticky` collé et au-dessus, fondu puis volet à la réduction, cadre et contenu en contre-translation à l'extension, icônes immobiles (écart 0).

⚠️ **Pas vu** : l'app INSTALLÉE elle-même (la session ne la pilote pas : elle ouvre la vraie base) ; l'iPad (cette barre est aussi la sienne) ; le doigt. La fluidité du défilement n'est jugeable que par Antonin.

**Installé le 2026-10-11 à 12:30** : build depuis `mobile-ios` `a30007c` (arbre inchangé avant et après), 12:26 → 12:28, code 0. Témoins dans `dist/assets` : « Ne garde que les icônes. », `sb:barre-basculer`, `shale.barre.categories`, `barre-voile`, `--barre-bg` présents ; contre-épreuve (phrase jamais écrite) 0. sha256 installée = source `a46ec40e80a1…` (ancienne `b27fb93cf854…`, le build Timer de 12:16), `diff -r` identique. Base 30 avant et après, intégrité ok, 88 objectifs / 81 tâches / 22 notes / 4 habitudes / 3 liens identiques. Sauvegarde : `sauvegardes-locales/avant-barre-laterale-20261011-1223/`. Bundle supprimé, aucune image montée.
⚠️ L'instance précédente ne répondait pas à « Quitter » (bloquée derrière la fenêtre du trousseau du build de 12:16, restée sans réponse) : arrêtée par son numéro de processus, après sauvegarde. Antonin doit cliquer **« Toujours autoriser »** pour ce binaire-ci.
⚠️ Sa disposition garde `quicklinks: { h: 144 }` : la carte se rend désormais à la hauteur de son contenu, la valeur enregistrée n'est pas modifiée.

**Outils laissés hors dépôt** : `Shale-chantiers/vite.essai-barre.mjs` (démo, port 5193), entrée `barre-demo` de `Shale-projet/.claude/launch.json`, captures dans `Shale-projet/audit-2026-10/barre-laterale-20261011/`.

## 2026-10-11 — Le labo : des agents « utilisateurs » ont passé l'app au crible et éprouvé des idées de modules

Demande d'Antonin : un système d'agents qui crée des modules, les fait essayer par des agents utilisateurs, les valide ou non, puis passe l'app actuelle au crible. Décisions et pourquoi : `CLAUDE.md`, même date. Pièges : `PIEGES.md` § 36.

**Où.** Tout est HORS de ce dépôt, dans `Shale-projet/labo/` (mode d'emploi : `labo/LISEZ-MOI.md`), plus `Shale-projet/.claude/agents/labo-*.md` et `.claude/workflows/labo-*.js`. Rien n'est versionné, comme `audit-2026-10/`.
- `labo/outils/construire.mjs` : build statique d'un commit en mode démo (plugin à la volée, aucune source modifiée ; compte habité ou compte neuf), servi sur 127.0.0.1.
- `labo/outils/pilote.mjs` : un Chrome sans fenêtre par agent ; rend l'écran en texte et une capture. C'est aussi le moyen le plus court de VOIR l'app en démo depuis une session (bureau, 390 px tactile, anglais).
- Cinq personas, huit rôles, `labo/CARTE-PRODUIT.md` (à tenir à jour quand un module change).

**Version testée : `fee37d6`.** ⚠️ `a408624`, `a30007c` et les passations du 11/10 sont arrivés pendant la passe : le crible ne les a pas vus (barre latérale réductible, hauteur sous densité, jauge d'énergie).

**Le crible de l'app** (`labo/passes/2026-10-11-app/SYNTHESE.md`) : cinq parcours, 87 frictions, les 41 non mineures toutes rejouées (36 confirmées, 2 réfutées, 3 artefacts du pilote) ; 40 constats, dont 28 établis par rejeu. Étalonnage : 4 témoins retrouvés sur les 5 qui étaient sur le chemin.
- Reviennent chez plusieurs : « Tâches du jour » liste toutes les tâches ouvertes et la Discipline baisse quand on en note une sans date (A17-19) ; Performance vide le jour même ; l'avancement d'un objectif ignore les étapes vides ; Aujourd'hui tait les retards ; l'ajout rapide ne lit aucune date ; reporter d'un jour n'a pas de geste (cinq sur cinq).
- Défauts de l'audit rejoués le 11/10 : **corrigés** — A17-09, A07a-01, A07a-02, A07b-05, A07b-14 ; **toujours présents** — A17-19, A06a-09, A17-15, A17-01, A06a-12, A07a-07, A07b-12, A12a-11, A06a-02, A12b-01 ; non tranchés — A07b-04, A17-03.

**Les modules** (`labo/modules/2026-10-11/`) : douze candidats, trois fiches, quinze améliorations d'écrans existants. Gardien du produit : **aucun nouveau module** ; « Boîte d'entrée » et « Devis et relances » refusées. Seule « Semaine » (heures promises à un objectif face aux heures passées) a passé le panel (5 sur 5) ; construite sous deux formes et essayée trois fois chacune. Jury (`VERDICT.md`) : **les deux « À retravailler »** ; retenir le bloc sur la page d'un objectif, pas le module, et pas avant que Performance compte le jour même.

**Ce qui reste, et qui décide.**
- L'ordre proposé par le gardien (une seule définition de la tâche du jour et Performance au jour même ; dater et reporter sur place ; la ligne « En retard » ; la fiche Client trouvable ; puis le bloc « Rythme ») est une RECOMMANDATION : Antonin tranche.
- Deux branches LOCALES, ni poussées ni fusionnées : `chantier/labo-semaine` (`db3d065`) et `chantier/labo-rythme` (`891c404`), worktrees `Shale-chantiers/labo-semaine` et `labo-rythme`. Prototypes jetables (magasin en mémoire, pas de migration) : seuls `src/lib/labo/*Calcul.ts` et leurs tests se reprennent. Worktree détaché `Shale-chantiers/labo-base` (`fee37d6`).
- Deux défauts trouvés par les prototypeurs, non corrigés : l'accueil montre une case d'heures cochée par défaut mais ne l'enregistre que si on la clique ; le sélecteur « tâche liée » du Timer ne propose que les tâches du jour.

**Non vérifié.** Tout : utilisateurs simulés, mode démo, Chrome et non WebKit, téléphone simulé. « Rejoué » veut dire revu dans ce même Chrome. Rien n'a été installé, aucun build natif, aucune migration, rien sur le site.


## 2026-10-11 (soir) — le bord de la barre latérale se tire

Suite du chantier du jour, même branche. Front seul : `Sidebar.tsx`, `lib/barre.ts`, bloc « Barre latérale » d'`index.css`, trois clés dans `en.ts`. Décisions : `CLAUDE.md`, même date.

**Vu à l'écran** (Chrome sans fenêtre, démo, 1470×923 à 110 %, vraie souris) : le bord reste sous le curseur (écart ≤ 0,5 px) de 184 à 400 px ; au-delà il s'arrête à 400 ; sous 124 la barre passe en icônes, et se rouvre en repassant le seuil ; au lâcher le choix est écrit (`shale.barre`), retrouvé après rechargement ; « Réduire » puis « Étendre » rendent la largeur choisie ; ← → Entrée et le double-clic répondent ; un simple clic sur le bord ne change rien. Images pendant le glissement sur Aujourd'hui : médiane 16,7 ms, p95 20,4 ms, 0 tâche longue.
**Rejoué dans WebKit** (`webkit-pilote`, événements de pointeur émis en JS) : même largeur au pixel (345 attendu, 345 lu), trait visible, pas de débordement.

⚠️ **Pas vu** : l'app installée, la vraie souris dans WKWebView (l'outil ne produit pas de vrais clics, PIEGES § 22.8), le doigt sur iPad.

**Installé le 2026-10-12 à 09:53** (Antonin : « go l'essayer ») : build depuis le worktree `barre-laterale` à `eff0b24` (= `origin/mobile-ios`), cache de compilation du dossier principal (PIEGES § 35.9), 09:42 → 09:52, code 0, machine très chargée. Témoins dans `dist/assets` : « Régler la largeur », « Largeur de la barre latérale », `barre-poignee` ; contre-épreuves 0 (une phrase jamais écrite, et « Ne se mesure pas », qui appartient aux commits non poussés de [correctifs]). sha256 installée = source `a49a0d58a5f1…` (ancienne `a46ec40e80a1…`), `diff -r` identique. Base 30 avant et après, intégrité ok, 88 objectifs / 81 tâches / 22 notes / 4 habitudes / 3 liens identiques. Sauvegarde : `sauvegardes-locales/avant-bord-barre-20261012-0941/`. Bundle supprimé.
⚠️ « Quitter » a réussi sans arrêter le processus (PIEGES § 35.8) : arrêté par son numéro, nouvelle instance vérifiée (numéro de processus différent). Antonin doit cliquer **« Toujours autoriser »**.
⚠️ Ce build ne contient PAS les huit commits de [correctifs] (`bdb8cc0`…`7923482` : jauge retirée, étape vide cochable, Notes « À trier ») : au moment du build ils n'étaient que dans le `mobile-ios` LOCAL du dossier principal ; ils ont été poussés pendant la compilation (vers 09:50). L'app installée est donc à `eff0b24`, huit commits derrière `origin/mobile-ios`.

## 2026-10-12 — Les correctifs d'après le labo : Tâches, Aujourd'hui, Performance, Objectifs, Notes, téléphone ; la jauge d'énergie retirée

**Tout est fusionné dans `mobile-ios` et poussé.** Aucune migration (base 30, dépôt 30). Du Rust est touché par `taches-jour` seulement (`src-tauri/src/notifications/` : le portage de la règle du jour). Suite complète au vert sur l'ensemble fusionné, machine calme : **169 fichiers, 2415 tests** (2025 la veille) ; `tsc`, `test:types`, `i18n:check` (0 manquante), `i18n:durs` (0 sûrement française).

**Vérifié** : chaque chantier à l'écran, en mode démo dans Chrome (bureau, téléphone 390 px, anglais). **Pas vérifié** : l'app native et l'iPhone réel au moment où ces lignes sont écrites — l'installation fait l'objet de l'entrée suivante ; la synchronisation des nouveaux réglages (`taches.rangement`, `objectifs.heures_semaine`) entre deux appareils.

**Reste, et qui décide** : les décisions listées dans `CLAUDE.md` (même date) ; garder ou retirer l'onglet « Par objectif » de Performance (à l'essai) ; le Timer (sa tuile « cette semaine » compte sept jours glissants, sans dates) ; la barre d'outils de l'éditeur de notes au téléphone (22 cibles sous 44 pt) ; la molette sur le voile d'une fenêtre au bureau ; un build iOS pour porter tout cela sur l'iPhone.

**Worktrees laissés** dans `Shale-chantiers/` : sans-energie, taches-jour, etapes-cochables, notes-a-trier, performance-jour, telephone, etapes-taches, notes-sans-titre, finitions (branches toutes fusionnées) ; `src-tauri/target/` de taches-jour pèse plusieurs gigaoctets (compilation des tests Rust).

### `sans-energie` — la jauge « Énergie restante » est retirée

#### 2026-10-11 — Jauge « Énergie restante » retirée ; Aujourd'hui en deux colonnes

Branche `chantier/sans-energie` (worktree `~/Desktop/Shale-chantiers/sans-energie`), depuis `mobile-ios` `147dc3e`. Commits `a77ea06` et `7f5a3ee`. **Ni fusionnée, ni installée.**

**Fait.**
- La carte d'Aujourd'hui, la section des Réglages, le compteur de minutes d'écran et les textes associés sont retirés pour tout le monde. La note « Énergie » du Journal n'est pas touchée.
- Une disposition enregistrée qui porte `energy` se charge sans trou. Vu à l'écran avec les quatre réglages semés (`ui.config`, `order.today`, `hidden.today`, `layout.today`) : pas de carte vide, pas de pastille « masqués », Personnaliser ne liste plus la jauge.
- Aujourd'hui, disposition par défaut : deux colonnes continues, plus de trou sous Discipline.
- Fichiers touchés : `src/App.tsx`, `src/views/TodayView.tsx`, `src/views/SettingsView.tsx`, `src/components/Sidebar.tsx`, `src/components/grid/ResizableGrid.tsx`, `src/lib/uiConfig.ts` (+ test), `src/lib/grille.ts` (+ test, nouveaux), `src/lib/i18n/en.ts`, `src/lib/sync/scope.ts`, `src/lib/sync/outbox.test.ts`, `src/lib/calendrier/disponibilite.ts`, `src/lib/licence/catalogue.ts`, `src/lib/trading-de-cote.test.ts`. Supprimés : `src/components/MentalLoadGauge.tsx`, `src/lib/mentalLoad.ts`, `src/lib/mentalLoad.test.ts`.

**Vérifié.** `tsc`, `test:types`, `i18n:check` (0 manquante, 2709 entrées), `i18n:durs` (0 sûrement française) verts. Vitest des zones touchées : 37 fichiers, 517 tests verts (`uiConfig`, `grille`, `sync`, `licence`, `calendrier`, `trading-de-cote`, `widgets-listables`). **La suite complète n'a pas été lancée** (consigne des correctifs du 11/10). À l'écran, en mode démo : Aujourd'hui au bureau (1440 et 1280), au téléphone (390), en anglais, en thème clair, compte habité et compte neuf ; Réglages en français et en anglais. Captures dans `~/Desktop/Shale-chantiers/captures-correctifs/sans-energie/`.

**Pas fait.**
- Aucune donnée nettoyée : `energy_*` et `screen_min_*` restent dans les bases (voulu).
- `CLAUDE.md` garde le point 4 de la session du 12/07 (« Jauge de charge mentale ») et `PIEGES.md` son § 34 : ce sont des traces d'époque, à annoter « retirée le 2026-10-11 » à la fusion plutôt qu'à effacer.
- Le site n'est pas touché (voir DETTE-SITE).

**Pas vérifié.**
- **Rien dans l'app native** (pas de build, consigne). En particulier : une vraie base qui porte des mois de `screen_min_*` et un `ui.config` enregistré.
- **Le glisser d'un panneau** : l'outil du labo ne sait pas glisser. Seul « Reculer d'une place » (menu « ⋯ ») a été joué : la grille redevient libre, rien ne casse. Le moment où l'ancre tombe en plein glisser n'a pas été vu.
- **Une fenêtre entre le téléphone et 1280 px** : l'outil n'a que trois tailles. La règle qui lâche l'ancre en fenêtre étroite est tenue par un test, pas par une capture.
- La synchro réelle entre un appareil à jour et un appareil en ancienne version.

**Vu en passant, pas corrigé (hors chantier).** Dans les Réglages en mode démo, un vide d'environ 200 px sépare « Synchronisation chiffrée » de « Données » : le panneau `settings-sauvegardes` a un plancher de 200 px et son contenu ne s'affiche que dans l'app native. C'est la démo, pas le produit. Il gêne la lecture des captures du labo.

### `taches-jour` — la tâche du jour, l'ajout rapide daté, le report, « En retard », Tâches par objectif

#### Fait

1. **La définition du jour** : `estPrevueLe`, `todayTasks`, `statDeListe`, `dayStat`, `tachesAFaire` (`lib/logic.ts`), `tachesEnRetard` (`lib/taches.ts`) ; l'anneau, le brief, la revue, le minuteur, la palette ; le portage Rust.
2. **L'ajout rapide daté** : `lib/taches/saisieRapide.ts`, `components/taches/SaisieRapide.tsx`, branché dans Tâches et dans la carte d'Aujourd'hui.
3. **Le report sur place** : le sous-menu « Dater », le calendrier flottant, la date-bouton, `replanifier()` dans le geste commun.
4. **Aujourd'hui** : la ligne « En retard », la carte « Objectifs en cours » sur les racines, le retard dans la liste Objectifs.
5. **Le menu** : « ⋯ › Renommer », « Focus 25 min » dans Tâches, le « ⋯ » visible au repos.
6. **Le rangement par objectif**, retenu.

#### Pas fait

- **La vue Performance** n'est pas touchée (un autre chantier la reprend). Elle lit la nouvelle définition par `todayTasks` et `dayStat`. La limite « une tâche datée pas faite sort du compte à minuit » lui est laissée.
- **La page d'un objectif et la feuille de route** ne sont pas touchées. Leur menu de tâche reçoit les nouvelles entrées de « Dater » (c'est le catalogue commun), sans « Focus 25 min ».
- **Les étapes en retard** ne sont signalées ni sur Aujourd'hui ni dans la carte : seulement les objectifs racines.
- **Le « ▶ » de la carte d'Aujourd'hui** n'apparaît toujours qu'au survol de la ligne. Sa fonction est dans le « ⋯ », lui visible au repos.
- **Les autres listes de l'app** (notes, fiches, étapes…) gardent un « ⋯ » révélé au survol. Seules les lignes de tâche l'ont visible au repos.
- **Renommer une tâche** ne lit pas de date dans le nouveau nom : seul l'ajout rapide le fait.
- **`lib/ia/revue.ts` garde sa copie de la règle « prévue ce jour-là »** (voir CLAUDE) : une ligne à changer après la fusion.
- **⌘Z sur une suppression, les habitudes, le Calendrier, le site** : hors mission.
- **Le « + 1 jour » d'une routine** n'existe pas : « Dater » reste grisé pour une tâche récurrente, avec sa raison.

#### Pas vérifié

- **Rien n'a été vu dans l'app native** (macOS ni iPhone) : seulement le mode démo, sous Chrome sans fenêtre, au pilote du labo. Pas de build natif (interdit pendant les chantiers). En particulier : le calendrier flottant et le clavier logiciel d'iOS ; la notification « série en danger » réelle.
- **Le Rust est testé, pas exécuté dans l'app** : `cargo test --lib notifications::` passe (131 tests), mais la notification n'a pas été déclenchée sur une vraie base.
- **La synchronisation du réglage `taches.rangement`** entre deux appareils n'a pas été essayée. Il suit le chemin de `perf.plage`.
- **La suite complète (`npm test`) n'a pas été jouée** (consigne : quatre chantiers en parallèle). Jouées : les zones touchées, 41 fichiers, 737 tests.
- **La fusion** avec `mobile-ios` n'a pas été faite, mais elle a été **simulée sans rien fusionner** (`git merge-tree`, contre `mobile-ios` `7923482`) : **aucun conflit**. Cinq fichiers sont touchés des deux côtés et se fusionnent seuls : `src/views/TodayView.tsx`, `src/App.tsx`, `src/lib/i18n/en.ts`, `src/views/GoalsView.tsx`, `src/lib/logic.ts` (`effectiveProgress` n'y est pas touché). Sur une copie de l'arbre fusionné : `tsc --noEmit` passe, `i18n:check` donne 0 clé manquante, 33 fichiers de tests des zones touchées passent (578 tests). La suite complète reste à jouer après la vraie fusion.
- **Le thème clair** a été vu en anglais (bureau et téléphone), pas en français.
- **Le compte neuf** a été vu au bureau en français, pas au téléphone.

#### À décider par Antonin

1. **Cocher une tâche sans date ou en retard la fait entrer dans la liste et la Discipline du jour, comme faite.** Voulu ici pour que le chiffre du soir soit celui du lendemain. L'autre lecture de la demande : seules les tâches datées d'aujourd'hui comptent, faites ou non.
2. **Un jour passé ne compte pas une tâche datée de ce jour et jamais faite.** Le chiffre monte donc à minuit. Le compter demanderait de garder l'histoire des dates d'une tâche. À trancher avec le chantier Performance.
3. **« jeudi » tapé un jeudi = dans sept jours.** L'autre choix serait aujourd'hui.
4. **« + 1 jour » et « Demain » coexistent** dans le menu, même quand ils écrivent la même date.
5. **Les étapes en retard** : faut-il les montrer sur Aujourd'hui ?

### `etapes-cochables` — une étape vide se coche et compte

#### 2026-10-11 — Étapes cochables (branche `chantier/etapes-cochables`, NON fusionnée, NON installée)

**Fait**
- La règle de mesure (`src/lib/objectifs/progression.ts`) : étape vide = unité à cocher ; pannes à 0 chez le parent ; `estAcheve` = 100 % ; `pourcentDe` ; `estCochee` ; objectif d'exemple mesuré sur ses exemples.
- L'accès `cocherEtape(id, faite)` dans `repo.ts` et `demo.ts`. Il n'écrit que `progress_pct`, ne touche jamais une ligne suivie à la main, n'adopte pas un exemple.
- Les libellés (`libelles.ts`) : « 1 étape sur 3 · 2 tâches sur 5 » ; `pourquoiVide` devient `pourquoiSansMesure` (pannes seulement). Sept clés anglaises retirées (elles expliquaient pourquoi une étape vide « ne comptait pas »), quatorze ajoutées (`en.ts`, dans le bloc des objectifs, pas en fin de fichier).
- La feuille de route (`FeuilleDeRoute.tsx`) : case sur la ligne d'une étape vide, bascule optimiste, entrée « Marquer faite / Marquer à faire » dans le menu « ⋯ » (même fonction). Rangée d'ajout au niveau de l'objectif. `AjoutEtape` est scindé (`ChampEtape`).
- La page d'un objectif (`GoalsView.tsx`, fonction `page` et menu) : case « Atteint » pour un objectif vide ; entrée de menu « Marquer atteint / Marquer non atteint ». ⚠️ La LIGNE de la liste (`ligneListe`) n'est pas touchée : elle lit seulement le nouveau chiffre.
- `effectiveProgress` (`logic.ts`, une ligne), `calendrier/peril.ts`, `ia/revue.ts` (une ligne) : délégation à `pourcentDe`.
- Tests : `progression.test.ts` (bloc de l'ancienne règle mis à jour EXPRÈS, daté, chaque ancien chiffre gardé en commentaire ; nouveaux tests : 0 / 100, 33 %, bascule, sans perte, manuel souverain, pannes, exemple A06a-02), `fil.test.ts`, `libelles.test.ts` (français et anglais), `charge.test.ts` (péril), `cocher.api.test.ts` (natif SQLite et démo, 12 tests).

**Vérifié**
- `npx tsc --noEmit` : vert. `npm run test:types` : vert. `npm run i18n:check` : 0 manquante (2730 entrées), 0 doublon. `npm run i18n:durs` : 0 sûrement française.
- `npx vitest run src/lib/objectifs src/lib/logic src/lib/calendrier src/lib/onboarding` : 21 fichiers, 415 tests, verts. Aussi `src/lib/ia src/lib/carteEtat src/components src/views` : verts.
- À l'écran, au pilote du labo, build démo du commit (captures dans `~/Desktop/Shale-chantiers/captures-correctifs/etapes-cochables/`) :
  - compte habité, bureau, français : objectif à trois étapes, une cochée → 33 % sur la page, dans la liste et sur Aujourd'hui ; tâche ajoutée à l'étape cochée → la case part, 0 % ; tâche détachée → la case revient cochée ; décoché par le menu ; objectif sans étape : deux tâches ajoutées directement (50 % après une coche), puis vidé et coché « Atteint » (100 %, « Atteint » dans la liste) ; phase vide cochée ;
  - téléphone 390 px, français : la même feuille de route, case cochée au doigt, tâche ajoutée à l'objectif ;
  - téléphone, anglais : objectif sans étape, tâche directe, « Reached » ;
  - bureau, anglais, thème clair : « 1 step out of 3 » ;
  - compte neuf (accueil passé), bureau français puis téléphone anglais : A06a-02 rejoué, 0 % → 50 % → 100 %.

**PAS fait**
- **Aujourd'hui, Tâches, Calendrier, accueil, IA, liste des objectifs** : hors périmètre, non touchés (sauf la ligne de délégation de `ia/revue.ts`).
- **La phrase de l'accueil** (`components/onboarding/Accueil.tsx`) : « Une étape avance quand tu coches ses tâches, ou quand tu atteins un nombre que tu t'es fixé… » ne dit pas qu'une étape vide se coche. À compléter par qui a l'accueil. Deux commentaires (`Accueil.tsx` l. 124, `onboarding/semer.ts` l. 195) citent encore « 0/1 élément » : l'écran dit maintenant « 0 tâche sur 1 ».
- **A06a-03** (un objectif « Atteint » dès 99,5 %, à cause de l'arrondi) : toujours présent, pas de ce chantier.
- **Événements rattachés : deux chiffres possibles, défaut ANTÉRIEUR.** La page et la liste des objectifs lisent les événements rattachés ; la carte d'Aujourd'hui, le relevé quotidien, le péril et la revue de l'IA ne les lisent pas (ils n'ont pas les arêtes). Un objectif dont le seul élément est un événement peut donc afficher un chiffre différent sur Aujourd'hui. Non corrigé : il faut charger les arêtes dans `GoalsPreview.tsx`, que le chantier voisin touche.
- **Cocher une étape depuis la carte mentale** : pas fait. La carte montre le bon pourcentage, elle ne coche pas l'étape.
- **`DESIGN.md`** : non modifié (voir « Dessin » ci-dessus, à recopier).
- **Vocabulaire phase / sous-objectif / étape** : non touché.

**PAS vérifié**
- L'app native (SQLite réel dans Tauri, iPhone) : rien n'a été construit ni installé. Le chemin natif de `cocherEtape` est tenu par un test sur une vraie base SQLite, pas vu dans l'app.
- La synchronisation entre deux appareils : la coche voyage dans une colonne déjà synchronisée, non rejoué. Un appareil resté sur l'ancienne version affiche une étape cochée comme avant (« — », exclue).
- La suite complète `npm test` : non jouée (consigne). Le build Rust : non concerné.
- La hauteur de la case au doigt : vue sur capture en émulation 390 px, pas mesurée au pixel ni sur un vrai téléphone.
- Le relevé quotidien de Performance : la courbe « Objectifs » marquera une marche vers le bas le jour de la mise à jour pour tout objectif qui a des étapes vides. Non vu à l'écran.

**À décider par Antonin**
1. Ajouter une tâche à une étape cochée remet l'étape à 0 % (et fait baisser l'objectif). La coche revient si l'étape redevient vide. Est-ce le comportement voulu, ou préfères-tu que la coche soit effacée pour de bon à ce moment-là ?
2. Un réglage cassé (cible à zéro, source supprimée) pèse maintenant 0 chez son parent, au lieu d'être ignoré. C'est la suite logique (« ce qui est à l'écran compte »), mais c'est un second changement de chiffre.
3. Le vocabulaire (constat 22), voir l'avis dans la section CLAUDE.

### `etapes-taches` — une chose à faire est une tâche ; « étape », et « phase » quand elle en contient d'autres

#### 2026-10-12 — Étapes et tâches (branche `chantier/etapes-taches`, NON fusionnée, NON installée)

**Fait**
- Les règles pures : `lib/objectifs/structure.ts` (`natureDe`, `peutAjouterEtape` sans genre, `premierAccueil`, `peutRangerSous`, `hauteurSous`, `cleDeNature` ; `peutPromouvoir` et `peutRetrograder` supprimées), `lib/objectifs/ajout.ts` (ce qui s'écrit pour une étape neuve), `lib/objectifs/conversion.ts` (le plan de conversion), `lib/objectifs/libelles.ts` (`nomDeNature`, `aideDeNature`, `deplieParDefaut` par contenu ; `nomDeGenre` et `aideDeGenre` supprimées), `lib/objectifs/typage.ts` (le menu « Type » : `planDirect` à trois types ; `planEtape`, `planHabitude`, `planTache`, `genresPour` supprimées, plus aucun écran ne les appelait).
- Les écritures : `lib/objectifs/ajouter.ts` (`ajouterEtape`), `repo.ts` (`convertirEtapeEnTache`, `annulerConversionEnTache`), `lib/objectifs/typer.ts`, `lib/ia/planifier.ts`.
- Le genre lu dans le contenu partout où il se dessine : `lib/objectifs/carte.ts`, `lib/carteEtat.ts`, `repo.infosDeCartes` (en SQL) et `demo.infosDeCartes`.
- Les écrans : `components/objectifs/FeuilleDeRoute.tsx` (ligne, menu, champ d'étape, légende), `RattacherElement.tsx` (rangée d'ajout), `gesteConversion.tsx` (nouveau), `GoalModal.tsx` (bloc « Par quoi commencer » et liste des parents seulement — la structure de la fenêtre n'est pas touchée, le chantier `telephone` s'en occupe), `views/GoalsView.tsx` (menu, focus par défaut), `components/carte/EditeurCarte.tsx`, `PanneauType.tsx`, `components/objectifs/CarteObjectif.tsx`, `components/ia/ActionsIa.tsx`, `components/corbeille/geste.tsx`, `components/icons.tsx` (`IconEtape`), `lib/carte.ts` (le même tracé pour le rendu enregistré).
- `DESIGN.md` : un bloc daté du 2026-10-12 en tête de la section du vocabulaire, et les tableaux mis à jour.
- Des commentaires qui décrivaient le présent avec l'ancien mot sont mis à jour (corbeille, calendrier, types) : aucun code changé dans ces fichiers.
- Tests neufs : `structure.test.ts` (19), `conversion.test.ts` (15), `conversion.api.test.ts` (16 : natif SQLite et démo), `ajouter.api.test.ts` (6 : natif et démo). Tests mis à jour EXPRÈS, datés, l'ancien comportement gardé en commentaire : `libelles.test.ts`, `progression.test.ts` (bloc « profondeur »), `typage.test.ts`, `carteEtat.test.ts`, `ia/planifier.test.ts`.

**Vérifié**
- `npx tsc --noEmit` : vert. `npm run test:types` : vert. `npm run i18n:check` : 0 clé manquante (2832 entrées). `npm run i18n:durs` : 0 sûrement française.
- `npx vitest run src/lib/objectifs src/lib/logic src/lib/calendrier src/lib/onboarding src/lib/corbeille src/lib/carte src/lib/ia src/lib/carteEtat src/components src/views src/lib/i18n src/lib/performance src/lib/taches` : 68 fichiers, 1151 tests verts, 1 sauté (il l'était déjà).
- Le test d'accès attrape une régression : deux lignes retirées exprès de `convertirEtapeEnTache` ont fait échouer 4 tests, puis remises.
- À l'écran, au pilote du labo, builds démo (captures dans `~/Desktop/Shale-chantiers/captures-correctifs/etapes-taches/`) :
  - compte habité, bureau, français (commit 84917b3) : la fenêtre de création (tâches d'abord) ; une tâche puis deux étapes ajoutées à un objectif ; une étape sous une étape, qui devient une phase (dossier, cadre plein) ; une étape vide convertie, les compteurs passent de « 0 étape sur 3 · 0 tâche sur 2 » à « 0 étape sur 2 · 0 tâche sur 3 », 0 % avant et après ; la tâche retrouvée dans Tâches (« Sans date », avec son objectif) et l'étape dans Supprimés récemment ; « Annuler » rend l'étape ; le menu « ⋯ » d'une étape vide ; la bande « Sa description ne suit pas… » ; la seule étape d'une phase convertie (« 0 étape sur 1 » devient « 0 tâche sur 1 ») ; la carte mentale de l'objectif et son menu d'ajout ; le menu « Type » d'un nœud dans la carte d'une note, l'étape rangée sous un objectif choisi, puis le repli « la feuille de route n'a que trois niveaux » ;
  - téléphone 390 px, français : deux étapes, une étape sous une étape, la conversion et son toast ;
  - bureau, anglais, thème clair : la fenêtre de création, « Phase · Step · Task », « Make it a task », le toast « … is now a task », le menu de la carte ;
  - compte neuf, bureau, français (commit 7c9a2d5), accueil joué en entier : l'objectif de l'accueil et ses deux étapes (enregistrées comme phases, affichées comme étapes) ; un objectif créé nu s'ouvre sur le champ « Tâche » ; l'objectif d'exemple ;
  - compte neuf, téléphone, anglais : la fenêtre de création ;
  - compte habité, bureau, français (commit b25f804, le dernier) : une étape citée par `@` dans une note, la bande « Citée 1 fois… », la conversion, la note rattachée à l'objectif.

**PAS fait**
- **Aujourd'hui, Tâches, Performance, le Calendrier, les fenêtres au téléphone, le serveur d'IA, le site** : hors périmètre, non touchés. Dans `calendrier/agenda.ts` et `calendrier/peril.ts`, seuls trois commentaires ont changé.
- **Le serveur d'IA** : `decomposer_objectif` et ses prompts disent toujours « sous-objectifs ». Les réponses de l'IA peuvent donc employer le mot dans un titre qu'elle propose.
- **Le sélecteur `@` et Supprimés récemment** nomment une étape par sa famille : « Objectif », « Objectifs ». Non changé (il faudrait que ces listes connaissent le parent de la ligne).
- **Le Calendrier** écrit « étape de … » : déjà le bon mot, non relu.
- **L'import d'une liste** (`lib/objectifs/importChecklist.ts`) : le modèle de texte à donner à une IA dit encore « Une sous-étape (facultative, seulement sous une étape) ». C'est une consigne de format, pas un nom de l'app. Laissé. À décider.
- **« dont 2 phases »** dans « En faire un objectif » (`DepuisCarte.tsx`) et dans l'import : gardé, c'est le bon mot (des étapes qui en contiennent d'autres).
- **La phrase de l'accueil** (`components/onboarding/Accueil.tsx`) : non touchée. Elle reste vraie.
- **Convertir depuis la carte mentale** : pas fait. La carte ne propose pas « En faire une tâche ».
- **Convertir un objectif racine vide en tâche libre** : pas fait, pas demandé.

**PAS vérifié**
- L'app native (SQLite dans Tauri, iPhone) : rien n'a été construit ni installé. Le chemin natif de la conversion et de l'ajout est tenu par des tests sur une vraie base SQLite, pas vu dans l'app.
- La synchronisation entre deux appareils : non rejouée. Un appareil resté sur l'ancienne version verra « Phase » ou « Sous-objectif » selon `is_milestone`, et ne pourra pas ajouter d'étape sous une étape que la nouvelle version n'a pas encore fait devenir phase.
- La suite complète `npm test` : non jouée (consigne).
- Les bulles (survol prolongé) : écrites, pas vues à l'écran.
- « Annuler » au doigt : vu sur le bureau seulement. Le thème clair : vu sur le bureau en anglais seulement.
- La conversion d'une étape qui porte une tâche récurrente : prouvée par test (natif et démo), pas vue à l'écran.
- Le bloc ENREGISTRÉ d'une carte dans le corps d'une note (le losange dans l'image figée) : vu dans l'éditeur de carte, pas dans la note refermée.
- La hauteur au doigt de « En faire une tâche » : vue sur capture à 390 px, pas mesurée au pixel.
- La vraie base d'Antonin : non relue aujourd'hui (poids des étapes, étapes vides).

**À décider par Antonin**
1. Les notes rattachées à une étape convertie passent à l'objectif (ou à l'étape au-dessus), pas à la tâche. Est-ce ce que tu veux ?
2. L'étape convertie reste 30 jours dans Supprimés récemment ; la restaurer plus tard fait un doublon avec la tâche. Préfères-tu qu'elle soit effacée pour de bon une fois le toast passé ?
3. Un objectif créé nu s'ouvre sur le champ « Tâche ». À garder ?
4. Le losange comme icône de l'étape.
5. Le sélecteur `@` et Supprimés récemment disent « Objectif » pour une étape : faut-il qu'ils disent « Étape » ?
6. Le modèle d'import dit « sous-étape » : à remplacer par « une étape sous une étape » ?

### `performance-jour` — Performance au jour même, et « Par objectif » à l'essai

#### 2026-10-11 — `performance-jour`

**Fait**
- Rangée « Aujourd'hui », dates sur chaque chiffre, « hors compte » sous « Tâches tenues », légendes complètes, un seul mot pour la série, messages vides corrigés, barre du jour dans le focus, carré du jour jamais rouge.
- Onglet « Par objectif » : heures passées / promises, reste d'ici dimanche, huit semaines précédentes, hors objectif, faits d'échéance, état sans minuteur.
- Promesse dans `settings` (`objectifs.heures_semaine`), écrite par l'onglet et par l'accueil.
- Accueil : la case d'heures allumée est retenue pour l'objectif planté.
- Anglais : 83 clés ajoutées, dans un bloc placé après les clés de Performance (pas en fin de fichier).

**Fichiers touchés**
- Nouveaux : `src/lib/performance/{jour,dates,durees,parObjectif,promesses,promessesAcces}.ts`, leurs tests (`jour.test.ts`, `dates.test.ts`, `parObjectif.test.ts`, `promesses.test.ts`, `promesses.api.test.ts`), `src/components/performance/{ParObjectif,RangeeAujourdhui}.tsx`.
- Modifiés : `src/views/PerformanceView.tsx`, `src/components/performance/Discipline.tsx`, `src/lib/performance/analyse.ts` et son test, `src/lib/onboarding/{planification,semer}.ts`, `planification.test.ts`, `src/components/onboarding/Accueil.tsx`, `src/lib/i18n/en.ts`.

**Vérifié par les tests** (`npx vitest run src/lib/performance src/lib/onboarding src/lib/sync/scope src/lib/sync/outbox.test.ts src/lib/i18n` : 12 fichiers, tout passe)
- le jour en cours à part et hors des moyennes ; A07b-06 ; lignes + hors objectif = total ; semaine du lundi au dimanche ; pas de zéro avant la création ; les faits de date ; la clé synchronisable ; la promesse écrite seulement quand elle change, des deux côtés (vraie base SQLite et démo) ; l'accueil qui écrit la promesse.
- `npx tsc --noEmit`, `npm run test:types`, `npm run i18n:check` (0 manquante), `npm run i18n:durs` (0 sûrement française) : propres.
- ⚠️ La suite complète (`npm test`) n'a PAS été jouée (règle du soir : quatre chantiers en parallèle).

**Vu à l'écran** (mode démo, Chrome sans fenêtre ; captures dans `~/Desktop/Shale-chantiers/captures-correctifs/performance-jour/`)
- Compte neuf, accueil joué en choisissant 5 h, une séance d'une minute liée à la première tâche : la rangée « Aujourd'hui » montre « 1 min » ; « Par objectif » montre « 1 min / 5 h » et « reste 4 h 59 d'ici dimanche ». Rejoué aussi sans cliquer de case : la case allumée (10 h) est retenue.
- Compte habité : les deux vues, 7 j et 30 j ; promesses posées, changées, saisie « 2h30 » lue 2,5, saisie illisible refusée ; le titre d'une ligne ouvre l'objectif.
- Téléphone (390 px, au doigt), anglais, thème clair : les deux vues.
- Les bulles (tuile Tâches, tuile Focus, écart, seuil de 80 %) : lues à l'écran par survol.

**Recoupement avec le Timer, le 12 octobre (compte habité)**
- Timer « aujourd'hui » 25 min = rangée « Aujourd'hui » 25 min = « Par objectif », total de la semaine 25 min (un lundi, la semaine commence).
- Timer « cette semaine » 8 h 15 (6–12 oct.) ; Performance « 7 j » 9 h 35 (5–11 oct.). L'écart vient des deux jours qui ne sont pas communs : Performance compte le 5 octobre et pas aujourd'hui, le Timer l'inverse. 9 h 35 − 1 h 45 (le 5 octobre, déduit et cohérent avec sa barre) + 25 min (aujourd'hui) = 8 h 15. La bulle de la tuile Focus écrit « 8 h 15 ».
- Compte neuf : Timer 1 min partout, Performance 1 min aujourd'hui, « Par objectif » 1 min. Aucun écart.

**PAS fait**
- Le Timer : aucune date sous sa tuile « cette semaine ». Vu en passant, pendant une séance en cours : sa carte « sessions du jour » dit « Aucune session aujourd'hui — lance la première. ».
- Les comptes qui ont déjà passé l'accueil n'ont aucune promesse : elle n'est pas relue dans la phrase de la description (deviner un nombre dans un texte, en deux langues, a été écarté). Elle se tape dans l'onglet.
- La phrase de la description ne change pas quand la promesse change (relevé par le jury du labo).
- Aucun rappel de la promesse dans Aujourd'hui ; rien sur la page d'un objectif.
- Pas d'historique des promesses.
- La tuile « Jours tenus d'affilée » : son nom, plus long, passe sous les poignées de la grille quand on survole le panneau des tuiles.
- En anglais, les durées gardent le format français (« 2 h 30 ») — déjà noté le 2026-10-10.
- La période de l'onglet ne s'applique toujours pas à la carte « Objectifs » ni aux métriques (elles écrivent maintenant leurs propres dates).
- Clés anglaises devenues sans appelant, laissées : « Série en cours », « Historique des streaks », « focus — par semaine », « sur 7 jours », « Pas encore de streak… ».

**PAS vérifié**
- Rien n'a été vu dans l'app native (WKWebView) ni sur iPhone réel : seulement en démo sous Chrome.
- La promesse entre deux appareils : prouvée jusqu'à la file d'envoi sur une vraie base, pas sur un vrai échange.
- `Intl.DateTimeFormat.formatRange` sous WKWebView : présent depuis Safari 14.1 ; un repli existe, non vu.
- Le dimanche (« reste … d'ici ce soir ») et le changement de semaine : tenus par les tests, pas vus à l'écran.

**À décider par Antonin**
1. Garder l'onglet « Par objectif », ou le retirer. S'il reste : une colonne sur `goals` à la place du réglage.
2. Le Timer : écrire ses dates, ou passer sa « semaine » du lundi au dimanche.
3. A07b-06 : la tuile dit ce qu'elle ne compte pas. L'autre voie (faire peser une tâche reportée sur son jour) se décide dans `dayStat`, donc pour l'anneau, les séries et les notifications.
4. L'accueil : la case allumée vaut pour l'objectif planté seulement. Faut-il aussi qu'elle crée « Récupérer N h par semaine » quand l'écran suivant est laissé vide ? Aujourd'hui non.

### `notes-sans-titre` — l'onglet de Notes devient « Sans titre »

**Fait, sur `chantier/notes-sans-titre` (un commit, `0d95dde`) :**

- L'onglet « Sans titre » (« Untitled ») à côté de « Toutes les notes », avec
  son compte ; à zéro, pas de chiffre ; vide : « Aucune note sans titre. ». La
  recherche filtre aussi dans l'onglet.
- Dans l'onglet, ouvrir une note met le curseur dans son titre.
- Dans la liste (les deux onglets), une note sans titre montre le début de son
  texte.
- Le critère dans `src/lib/notesSansTitre.ts` : 38 tests (22 purs, 16 par l'API
  publique sur vraie base SQLite et en démo).
- Tout ce qui servait « À trier » est retiré (liste ci-dessus).
- Trois phrases ajoutées à `en.ts`, douze retirées.

**Vu à l'écran, au pilote, en mode démo** (captures dans
`~/Desktop/Shale-chantiers/captures-correctifs/notes-sans-titre/`) : bureau en
français, bureau en thème clair, bureau en anglais, écran de portable
(1280 px), téléphone 390 px en français et en anglais, compte neuf. Joué : trois
notes par ⌘⇧N, chacune paraît dans l'onglet avec le début de son texte ; un
titre donné, elle en sort ; le titre effacé, elle y revient ; l'état vide sur
le compte habité et sur le compte neuf.

**PAS fait :**

- La note rapide ne met pas le curseur dans le texte. Après ⌘⇧N, la note
  s'ouvre mais il faut cliquer dans le texte pour écrire. C'était déjà le cas
  avant ce chantier ; vu au pilote, pas corrigé (hors mission).
- Rien dans la palette ⌘K ni dans la recherche : une note sans titre s'y
  appelle toujours « Nouvelle note ».
- Aucun compteur ailleurs dans l'app — exprès.

**PAS vérifié :**

- **L'app native** (macOS, iPhone) : aucun build natif. Le critère est prouvé
  sur une vraie base SQLite par les tests, pas l'écran.
- **Le clavier de l'iPhone.** Dans l'onglet, toucher une note met bien le
  curseur dans le titre au pilote. Sur un vrai iPhone, iOS n'ouvre pas toujours
  le clavier pour un curseur posé par le code : il faudra peut-être toucher le
  titre. À regarder au prochain build.
- **Le raccourci de l'iPhone** (AppIntent) : il appelle la même fonction que
  ⌘⇧N, qui a été jouée au pilote.
- **Une note créée en anglais puis relue en français** : prouvé par les tests
  (les deux titres sont reconnus quelle que soit la langue), pas joué à l'écran
  — le pilote ne change pas de langue en cours de séance.
- La suite de tests complète (`npm test`) : non lancée, par consigne.

### `telephone` — le tour complet au téléphone

#### Fait

Les constats du crible, vus au téléphone. Les captures sont dans `~/Desktop/Shale-chantiers/captures-correctifs/telephone/` : `avant/` (la version de départ), `apres/` (le dernier commit, `b5cbe4d` : français, anglais, thème clair, compte neuf, bureau à 900 et 700 px de haut ; `apres-6944dbe/` est la même série sur le commit d'avant), `bureau/` (la comparaison de mise en page), `outils/` (la sonde et ses rejeux). Les dossiers `essai1` à `essai3` sont des passes intermédiaires.

| Constat | État | Mesure |
|---|---|---|
| 8 — habitudes sans nom au Journal | corrigé, téléphone et bureau | les trois noms entiers, 176 px de large au téléphone |
| 14 — habitudes tout en bas d'Aujourd'hui | corrigé au sens de la demande | « Habitudes à tenir » à 1 420 px du haut au lieu de 1 980 ; **voir « À décider »** |
| 20 / A17-15 — « Créer » sous le bas de la fenêtre | corrigé, toutes les fenêtres de saisie | bouton visible au bureau à 900 et 700 px de haut, et au téléphone |
| A17-01 — Échap ferme toute la fenêtre | corrigé : objectif, tâche, événement | le calendrier se ferme, la fenêtre reste, le titre saisi est intact |
| 34 — « Annuler » parti trop tôt | corrigé | encore là à 13 s, parti à 16 s ; boutons de 44 pt |
| 34 — « Supprimés récemment » sous le pli | corrigé | visible sans défiler, tuile de 91 × 72 |
| 36 — titres coupés | corrigé sur Aujourd'hui et le Timer | plus aucun texte coupé sans recours sur les treize écrans |
| 36 — boutons de 26 à 38 px | corrigé | 204 cibles sous 44 px avant, voir le tableau |
| 36 — pastille du minuteur sur le titre | corrigé | en bas, 44 pt de haut, titre dégagé |
| 36 — l'onglet Tâches se rouvre en bas de liste | **non reproduit** | quitté défilé à 310/310, rouvert à 0 ; le crible l'avait classé « incertain » |
| « Lier » écrase l'éditeur (chantier Notes) | corrigé | barre d'outils 109 px, texte 183 px, panneau dessous |

Ce qui vient d'être livré (partie 2), rejoué au doigt sur compte habité et compte neuf : l'ajout rapide et sa pastille de date, le calendrier ouvert sur place (il tient dans l'écran, entre 8 et 545 px de haut), le menu « ⋯ › Dater », la ligne « En retard », « Par moment / Par objectif », la case d'une étape vide et la rangée « Ajouter une étape · Tâche · Rattacher », l'onglet « À trier » et sa bande, Aujourd'hui sans la carte Énergie. Rien ne déborde ni ne passe sous la barre. Ce qui était trop petit est corrigé (date d'une ligne : 22 → 46 px de large ; titre d'une tâche : 19 → 44 px de haut).

Le tour à 390 px (partie 3), mesuré par une sonde (`captures-correctifs/telephone/outils/sonde.mjs`) sur les treize écrans, compte habité. Entre parenthèses : compte neuf, anglais, thème clair.

| Écran | Cibles de moins de 44 px, avant → après | Ce qui était faux | Ce qui reste |
|---|---|---|---|
| Aujourd'hui | 14 → 4 (0, 4, 4) | habitudes en bas ; titres coupés ; préréglages du Timer à 38 px ; marge de 32 px | les 4 croix des liens rapides : dessin de 16 px, zone de toucher de 44 |
| Tâches | 8 → 0 | titre d'une ligne à 19 px de haut ; date d'une ligne à 22 px de large ; champ de recherche à 30 px | rien |
| Calendrier | 1 → 0 | « + Nouvel événement » à 36 px ; « Supprimer » écrasé dans le bandeau ; 23 titres coupés | la vue agenda défile dans une carte, elle-même dans la page |
| Timer | 6 → 0 | libellés des préréglages coupés ; « − / + » à 36 et 24 px ; interrupteur à 16 px ; pastille sur le titre | rien |
| Objectifs | 2 → 0 | « Importer », « + Nouvel objectif » à 36-38 px ; titre d'une étape à 20 px | rien |
| Performance (regardée seulement) | 17 → 0 | période « 7 j » à 26 px, champs à 30 px | marge de page de 32 px (fichier d'un autre chantier) |
| Notes | 0 → 0 en liste | éditeur écrasé par « Lier » ; « supprimer » à 24 px | **22 cibles de 32 et 16 px dans la barre d'outils de l'éditeur** |
| Journal | 55 → 0 | habitudes sans nom ; 42 carrés de 14 px ; visages et éclairs à 36 px ; pastilles de couleur à 16 px | rien |
| Savoir | 5 → 0 | boutons d'en-tête à 34-36 px, recherche à 38 px | rien |
| Feuille « Plus » | — | « Supprimés récemment » sous le pli | rien |
| Réglages | 27 → 0 | pastilles de choix à 28-34 px, boutons à 38 px | rien |
| Personnaliser | 69 → 0 | « Masquer / Monter / Descendre » à 22-24 px, champs à 30 px | les mots « colonne gauche / droite » (voir « À décider ») |
| Supprimés récemment | 0 → 0 | rien | rien |
| **Total** | **204 → 4** | | |

Sur les treize écrans, après : aucun débordement horizontal de page, aucun texte coupé sans recours (26 avant), aucun contrôle sous la barre d'onglets en fin de défilement (sauf la suite de la vue agenda du Calendrier, qui défile dans sa propre carte), aucune action visible seulement au survol.

Le bureau (1440 × 900), comparé élément par élément avant et après (`outils/bureau.mjs`, `outils/comparer.mjs`) : **identique** sur Aujourd'hui, Calendrier, Timer, Objectifs et la page d'un objectif, Notes et une note ouverte, Savoir, Réglages, Personnaliser, Supprimés récemment, Tâches. Changé, exprès : les lignes d'habitudes du Journal (le nom s'élargit, la flamme passe contre les carrés) et « Nouvel objectif » quand son contenu déborde (la fenêtre prend la hauteur de l'écran, le pied reste). « Nouvelle tâche » et « Nouvel événement » : mêmes positions, au pixel.

#### Pas fait

- **Performance et l'accueil** : hors mission (autre chantier). Regardés seulement. Performance profite de la règle générale (ses 17 cibles trop petites n'en sont plus) mais garde 32 px de marge de page.
- **La barre d'outils de l'éditeur de notes** : 22 cibles de 32 px (gras, italique, titres, dix pastilles de couleur de 16 px). Les passer à 44 pt ferait une barre de cinq rangées. Voir « À décider ».
- **Les croix des liens rapides** d'Aujourd'hui : le dessin reste à 16 px, la zone de toucher fait 44 (pseudo-élément). Une sonde qui mesure les rectangles les compte encore.
- **Le défaut des fenêtres au bureau** : la molette sur le voile fait défiler la page derrière et emporte la fenêtre (mesuré sur « Nouvel événement » : 84 px vers le haut, titre hors écran). Antérieur à ce chantier. Le corriger change la place de toutes les fenêtres du bureau, ce que la mission interdisait. Voir « À décider ».
- **`AMELIORATIONS-UI.md` § 8** (anciennes cibles trop petites) : la règle générale et les retouches en traitent la quasi-totalité au téléphone. Restent les deux lots ci-dessus.

#### Pas vérifié

- **L'app native** (macOS, iPhone, iPad) : aucun build. Tout a été vu sous Chrome, en mode démo.
- **La suite de tests complète** (`npm test`) : non lancée, par consigne.

**Ce qui ne peut être su que sur un vrai iPhone :**

1. **Le clavier.** Sur iPhone il se pose par-dessus la fenêtre sans en changer la hauteur. Une fenêtre de saisie ouverte, clavier sorti : le champ touché est-il visible, le pied atteignable ? Le corps défile, donc WebKit devrait amener le champ ; ce n'est pas vu. Même question pour le calendrier ouvert sur place (il mesure `visualViewport`), pour le champ « Lier » des notes et pour l'ajout rapide.
2. **L'encoche et la barre d'accueil.** Toutes les réserves passent par `env(safe-area-inset-*)`, qui vaut 0 sous Chrome. La feuille « Plus » monte jusqu'à 2,5 rem sous l'encoche ; la pastille du minuteur se pose à 4,75 rem au-dessus de la barre d'accueil ; le voile des fenêtres réserve le haut et le bas. Les valeurs sont calculées, pas vues.
3. **WebKit.** Trois choses reposent sur lui : `:has()` (la vue ne défile pas derrière une fenêtre), le fondu du bas du corps d'une fenêtre (`mask-image`), et le fait qu'un `position: fixed` redevienne fixe à l'écran une fois l'animation d'entrée finie. Les trois existent dans Safari 15.4 et après ; le rendu n'est pas vu.
4. **Le toucher réel.** 44 pt est mesuré en pixels CSS. Qu'une case d'habitude de 44 × 44 ou une date de 46 × 44 se touche sans rater, seul un doigt le dit.
5. **Le glissé sur une fenêtre.** Le défaut (la fenêtre qui part avec la page) a été mesuré et corrigé sous Chrome en émulation tactile. À refaire au pouce.
6. **Le survol collant d'iOS** : une tape allume l'état `:hover` jusqu'à la tape suivante. Non observable sous Chrome.
7. **La taille de texte du système** (Dynamic Type) : la densité de l'app s'y ajoute. Les cibles suivent (elles sont en px, donc agrandies par le zoom), les débordements à 390 px n'ont été mesurés qu'à 100 %.

#### À décider par Antonin

1. **Aujourd'hui au téléphone : faut-il monter aussi les tâches ?** Les habitudes sont maintenant juste sous les tâches, comme demandé. Mais la carte « Tâches du jour » commence elle-même à 956 px du haut, après « En retard », trois compteurs et l'anneau de Discipline : plus d'un écran de défilement. Mettre tâches puis habitudes en tête au téléphone tient en une ligne (`ordreAujourdhuiAuTelephone`). Le crible le dit deux fois (« aucune tâche avant de défiler », « cocher mes trois habitudes dès l'ouverture »).
2. **La barre d'outils des notes au téléphone.** Une seule rangée de boutons de 44 pt qui défile de côté (l'usage sur iPhone), ou la laisser à 32 px ?
3. **Les fenêtres au bureau** : la molette sur le voile emporte la fenêtre. Le corriger demande de sortir les fenêtres de la zone qui défile (un portail) : elles se centreraient alors sur la fenêtre entière, voile par-dessus la barre latérale. À faire ?
4. **Sept jours par habitude au téléphone**, au lieu de quatorze. Quatorze ne tiennent pas en cases touchables.
5. **Quatorze secondes** pour un toast à geste au doigt. Le chiffre est un choix.
6. **Le Journal au bureau** : la flamme est maintenant contre les carrés, plus contre le nom.
7. **Personnaliser au téléphone** parle encore de « colonne gauche » et « colonne droite » pour Aujourd'hui, alors qu'il n'y a qu'une colonne — et que les habitudes y sont maintenant placées d'office sous les tâches. Non touché (formulation à décider, déjà relevée dans `AMELIORATIONS-UI.md` § 9).

#### Vu en passant, non corrigé (hors mission)

- **Performance, téléphone** : marge de page de 32 px (les autres vues sont à 16).
- **Calendrier, téléphone** : la vue agenda est une carte qui défile à l'intérieur de la page qui défile. Deux défilements emboîtés ; rien n'est inatteignable.
- **Aujourd'hui, téléphone** : trois compteurs (série, sept jours, focus) occupent trois cartes pleine largeur avant tout contenu.
- **Objectifs, téléphone** : une étape réserve à gauche la place de sa poignée de glissement et de son chevron ; le titre commence au milieu de la carte.

### `fusion` — fusion et finitions

#### Finitions (branche `chantier/finitions`, fusionnée)

Fait et vu à l'écran en démo : ⌘⇧N depuis Aujourd'hui puis frappe immédiate ; bouton « + » puis frappe ; une note existante ouverte ne prend pas le clavier ; l'onglet « Sans titre » vise toujours le titre. Non vérifié : le clavier de l'iPhone (iOS n'ouvre pas toujours le clavier pour un curseur posé par le code).

**Installé le 2026-10-12 à 12:37** : build depuis `mobile-ios` `dbca19a` (= `origin/mobile-ios`, arbre inchangé avant et après), 12:34 → 12:36, code 0. Il porte les huit chantiers ci-dessus et le bord de la barre latérale (`eff0b24`). Témoins dans `dist/assets` : « En faire une tâche », « Aucune note sans titre. », « Régler la largeur », « Par objectif », « En retard » ; contre-épreuves à 0 : « Énergie restante », « Garder telle quelle », « Sous-objectif », une phrase jamais écrite. sha256 installée = source `fb70acefa8b3…` (ancienne `a49a0d58a5f1…`), `diff -r` identique ; « Quitter » a bien arrêté l'ancien processus, le numéro a changé après relance (PIEGES § 35.8). Base 30 avant et après, intégrité ok, 88 objectifs / 81 tâches / 22 notes / 4 habitudes / 32 coches identiques. Sauvegarde : `sauvegardes-locales/avant-correctifs-labo-20261012-1234/`. Bundle supprimé, aucune image disque montée.

⚠️ **Pas vu dans l'app installée** : aucune session ne peut la regarder. La fenêtre du trousseau (« Toujours autoriser ») est à valider par Antonin. Le Rust des notifications a changé (la règle du jour) : la notification « série en danger » n'a pas été observée en réel. **L'iPhone n'a rien reçu** : il faut un build iOS.

## 2026-10-12 (suite) — La seconde passe du labo, et ses deux retours

**Fusionné dans `mobile-ios` et poussé ; PAS installé** (le build de 12:36 ne le porte pas). Aucune migration, aucun Rust. À grouper avec le prochain build.
- Horloge plein écran : toujours SEULE (décision du 30/09). Espace met en pause et reprend, Échap réduit, plus aucune touche ni clic n'atteint la page de derrière ; le focus revient à la ligne d'où l'on venait. Vu en démo : « ⋯ › Focus 25 min » depuis Tâches, deux Espace puis Échap → la tâche est toujours dans « Aujourd'hui », le menu ne s'est pas ouvert ; depuis la page Timer, « Plein écran », Espace, Échap → la page affiche « Reprendre ».
- Ajout rapide : « avant jeudi 22 » donne le 22 ; l'heure est lue (« jeudi 14h30 » → créneau d'une heure).
- **Question ouverte pour Antonin** : garder l'horloge seule, ou montrer ses commandes (six utilisateurs simulés sur douze n'ont pas trouvé comment en sortir).

### `retours-passe2` — le clavier de l'horloge plein écran, la date et l'heure lues par l'ajout rapide

**Fait, et vu à l'écran (mode démo, compte habité).**
- Horloge plein écran : nom de la tâche, « Pause » / « Reprendre », « Terminer », « Réduire ». Bureau 1440 et 1280, téléphone 390 au doigt, tablette 820 au doigt, anglais, thème clair.
- Depuis Tâches **et** depuis Aujourd'hui, « ⋯ › Focus 25 min » : Espace met en pause, le menu de la tâche ne s'ouvre pas, la tâche n'est pas marquée faite. Espace reprend. Échap réduit. Le focus revient sur le « ⋯ » d'où l'on venait. La pastille rouvre l'horloge. « Terminer » enregistre la séance (lue dans « sessions du jour » de la page Timer).
- Horloge ouverte : ⌘K ne fait rien, Tab reste sur les trois boutons. Horloge réduite : ⌘K rouvre la palette.
- Dates : « Commander le chêne avant jeudi 22 » → « Commander le chêne », « jeu. 22 oct. », dans Tâches et dans Aujourd'hui. « RDV clinique Saint-Jean jeudi 14h30 » → créneau 14:30–15:30. « Appeler Paul à 14h » sur Aujourd'hui. « mercredi prochain » → « mer. 14 oct. ». En anglais : “before thursday 22”, “Thursday, October 22 at 2:30pm”, “next wednesday”.
- Fenêtre séparée, **dans sa forme navigateur** (`/?pane=timer`, 560 × 360 et 380 × 300, deux onglets du même Chrome) : « Session libre », « Pause », « Terminer » tiennent ; Espace met en pause et reprend ; « Terminer » arrête la séance dans l'app.

**Pas vu — ne se voit que dans l'app native.**
- Le vrai plein écran macOS que l'horloge demande (`usePleinEcranNatif`) : pas touché, pas vu.
- La fenêtre séparée native : sa barre de titre, « Garder au premier plan », son plein écran (mode épuré, inchangé).
- iPhone et iPad réels : la zone sûre (encoche) autour de « Réduire ». L'en-tête garde `pt-[max(1.25rem,env(safe-area-inset-top))]`, écrit le 29/09, jamais vu sur un appareil.
- WebKit : `inert` et le retour du focus ont été vus sous Chrome seulement. `inert` existe depuis Safari 15.5 ; la carte mentale et le croquis s'en servent déjà dans l'app installée.
- Un toast cliqué par-dessus l'horloge : non rejoué (les toasts vivent déjà hors de `#root`).

**Pas fait.**
- La date n'est toujours lue **que** dans les deux champs d'ajout rapide. Le formulaire « Nouvelle tâche », le champ d'une étape, le titre d'un événement (« jeudi 14h30 » posé sans heure au jour par défaut) : hors mission, toujours ouverts (constat 2, seconde moitié).
- « jeudi soir », « jeudi matin » : « jeudi » est lu, « soir » reste dans le titre. Comme avant.
- Une date choisie ensuite au calendrier remet le titre entier et **perd l'heure lue** (règle d'avant : une date choisie ne touche pas au titre).
- En anglais, « Read the 22nd chapter » lit « the 22nd » comme une date. Défaut d'avant ce chantier, non corrigé : la croix de la pastille garde le titre.
- Le calcul du temps (la pause comptée comme du travail, « cette semaine ») : constat 10, hors mission.
- Les info-bulles « Ne laisse que le chrono à l'écran. Échap pour en sortir. » (boutons « Plein écran » du Timer) n'ont pas été réécrites : elles restent vraies à un mot près.
- La palette n'a toujours ni « Pause » ni « Reprendre ».

**Vérifications** (sur `72b6193`) : `tsc --noEmit` 0 erreur ; `test:types` 0 erreur ; `i18n:check` 0 manquante (2827 entrées) ; `i18n:durs` 0 sûrement française ; `vitest run src/lib/taches src/components src/lib/menu src/lib/calque.test.ts src/lib/timerEcran.test.ts src/lib/timerFenetre.test.ts src/lib/i18n src/lib/fenetres.source.test.ts src/lib/calendrier` : 26 fichiers, 449 tests, tous verts. **La suite complète n'a pas été jouée** (consigne).

## 2026-10-12 (soir) — barre latérale : largeur continue, textes fondus, glissement allégé

Même branche (`chantier/barre-laterale`). Front seul : `Sidebar.tsx`, `SyncIndicator.tsx`, `lib/barre.ts`, `ResizableGrid.tsx` (veille), bloc « Barre latérale » d'`index.css`. Décisions : `CLAUDE.md`, même date.

**Vu à l'écran** (Chrome sans fenêtre, démo, 1470×923 à 110 %, vraie souris) :
- le bord reste sous le curseur (écart 0) de 80 à 400 px ; sous 80 il passe au rail (66) ; il se rouvre à 81 ;
- icônes au même pixel à toutes les largeurs (x = 24) ; au rail, cloche centrée sur la colonne d'icônes (33,1 contre 32,5), bouton de 41 px, libellés à largeur nulle, pastille de synchro seule ;
- textes coupés en fondu à 170, 125, 90 px (captures) ; l'horloge s'estompe puis se replie avant le rail ;
- lâché au rail depuis 300 : « Étendre » rend 300 ; lâché à 130 : 130 gardé ; clavier ← → Entrée ; double-clic ;
- la grille se remesure au lâcher (largeur 960 → 862 à 400 px), aucun contenu rogné après ; `sb:barre-lachee` émis une fois ;
- « Réduire » / « Étendre » : fondu, volet, cadre — inchangés.
**Mesure de fluidité** (glissement sur Aujourd'hui, processeur ralenti ×4, ancien et nouveau code à la même charge machine) : médiane 45,2 → 18,6 ms ; pire dixième 102 → 23,7 ms ; images de plus de 34 ms 151 → 1 ; tâches longues 76 → 0. Sans ralentissement : 16,7 ms, aucune image manquée.
**Rejoué dans WebKit** (`webkit-pilote`, pointeur simulé) : masque rendu, bord à 95 px puis rail, pastille de synchro sans débordement, veille posée puis retirée.

**Ligne de base** : vitest 2488 (1 ignoré), `tsc`, `test:types`, `i18n:check` (2827), `i18n:durs`, `build` verts.

**Installé le 2026-10-12 à 22:22** : build depuis `mobile-ios` `07a4d07` (arbre inchangé), 22:20 → 22:22. Témoins dans `dist/assets` : `sb:barre-lachee`, `data-barre-glisse`, `barre-coupe`, `barre-repli`, `--barre-marge` ; contre-épreuve 0. sha256 installée = source `287ecb4716fb…` (ancienne `fb70acefa8b3…`), `diff -r` identique. Base 30 avant et après, intégrité ok, 88 objectifs / 81 tâches / 22 notes / 4 habitudes / 3 liens identiques. Sauvegarde : `sauvegardes-locales/avant-barre-continue-20261012-2220/`. Ce build porte aussi `chantier/retours-passe2` de [correctifs], fusionné l'après-midi et jamais installé.
⚠️ **Deux anomalies de ce build, sans conséquence constatée** (PIEGES § 10.6, ajout du 12/10) : l'étape DMG a échoué (`bundle_dmg.sh`, code 1 — le `.app` était déjà produit), et `/Applications/Shale.app` portait DÉJÀ le nouveau binaire avant tout `ditto` de la session, l'ancienne instance fermée proprement. Image restée montée : démontée (`hdiutil detach`). Bundle supprimé. Shale relancée (processus neuf). Antonin doit cliquer **« Toujours autoriser »**.

⚠️ **Pas vu** : l'app installée, la vraie souris dans WKWebView, l'iPad. Pendant le geste, un panneau d'Aujourd'hui dont le texte passe à la ligne garde sa hauteur jusqu'au lâcher (voulu : c'est la veille).

## 2026-10-12 (soir) — Retours d'Antonin après essai : Performance, minuteur, dates

Trois chantiers fusionnés par `chantier/retours-essai`. État de chacun ci-dessous, tel que rendu. Ce qui reste commun : rien n'a été vu dans l'app native avant le build ; la barre des menus n'existe pas en démo.

### `perf-epure` — Performance épurée, et les cartes qui ne bougent plus au survol

##### `perf-epure` — 2026-10-12 (soir)

**Fait** (branche `chantier/perf-epure`, dernier commit `52c3bfb`)
- Tuiles « Tâches tenues », « Habitudes tenues », « Focus » retirées ; moyenne et écart dans les cartes de discipline ; note A07b-06 dans la carte des tâches ; total de focus dans « focus — par jour ».
- « Jours tenus d'affilée » dans la rangée « Aujourd'hui » ; record dans « Séries de jours tenus ».
- Carte « focus par tag » retirée ; test des identifiants orphelins `perf-tiles` et `perf-focus`.
- Onglet « Par objectif » retiré d'un bloc ; `objectifs.heures_semaine` laissé inerte.
- Grille : la réserve de la barre de poignées est mesurée ; plus aucun panneau ne change de hauteur au survol.
- « vs » retiré de l'onglet ; six clés mortes retirées de `en.ts`.

**Fichiers touchés**
`src/views/PerformanceView.tsx`, `src/components/performance/RangeeAujourdhui.tsx`, `src/components/grid/ResizableGrid.tsx`, `src/components/grid/entetes.ts` (nouveau), `src/lib/grille.ts`, `src/lib/grille.test.ts`, `src/index.css` (bloc « Anti-superposition des poignées » seulement), `src/lib/onboarding/semer.ts` (trois retraits, rien de réordonné), `src/lib/i18n/en.ts`.
Supprimés : `src/components/performance/ParObjectif.tsx`, `src/lib/performance/parObjectif.ts`, `parObjectif.test.ts`, `promesses.ts`, `promesses.test.ts`, `promesses.api.test.ts`, `promessesAcces.ts`.

**Vu à l'écran** (build de démo du commit `52c3bfb`, Chrome sans fenêtre)
- Bureau 1470×923 à 110 %, français : toute la page, et le survol réel de chaque panneau. Aucun ne change de hauteur ni de place sur Performance (8 panneaux, aux quatre périodes), Aujourd'hui (8), Journal (2), Timer (5), Réglages (9), Personnaliser (5). Aucun contrôle sous la barre.
- Aussi à 1120×740 à 110 %, 1280×800 à 100 %, 1700×1000 à 90 % : rien ne bouge. À 1120×740, « par jour de la semaine » devient serré à son tour (deux lignes en permanence, 32 px de plus que sa voisine).
- Anglais à 110 %, thème clair à 110 %, téléphone 390 px, compte neuf (tout à « — », messages d'état vide).
- L'accueil d'un compte neuf, jusqu'au bout, avec un objectif planté : il se crée, aucune erreur.

**Pas fait**
- La vue Finance n'a pas été survolée : elle n'est pas dans le build de démo de cette offre. Ses en-têtes passent par la même jauge.
- Aucune vérification dans l'app native (WKWebView) : tout est mesuré dans Chrome. La jauge lit des rectangles et des hauteurs, rien de propre à Chrome, mais ce n'est pas vu.
- Une disposition enregistrée avec `perf-tiles` ou `perf-focus` n'a pas été rejouée à l'écran (la démo garde ses réglages en mémoire) : c'est tenu par les tests de `grille.test.ts`.
- La classe `.perf-tiles` d'`index.css` n'a plus d'appelant. Laissée : `CLAUDE.md` la cite comme exemple (« Widgets : structure réelle & contraintes »). À retirer avec cette phrase, ou à garder comme exemple.
- Les poignées passent toujours sur le texte d'un panneau SANS `.rgrid-head` (la tuile « cycles du jour » du Timer, 61×15 px de texte sous la barre) : déjà signalé le 2026-10-11, pas de ce chantier.
- Les « streak » hors de l'onglet (voir CLAUDE) et les pourcentages collés.

**À décider par Antonin**
1. « Objectif quotidien » du Timer tient maintenant sur deux lignes à sa taille de fenêtre (le sélecteur sous le titre). C'est le prix de « rien ne bouge au survol » tant que cet en-tête porte un titre et un sélecteur côte à côte dans une carte étroite. Si ça ne lui plaît pas : déplacer le sélecteur dans la carte (chantier Timer), ou réduire la barre de poignées à « ⋯ » seul pour les cartes étroites.
2. L'écart de focus à la période d'avant n'est plus affiché nulle part (sauf dans « À améliorer » quand il chute de 30 %). À remettre dans la bulle du total si ça manque.

### `focus-ile` — le focus sans plein écran, la pastille du minuteur, la barre des menus

##### Fait

- Lancer une séance n'ouvre plus le plein écran ; la pause enchaînée garde l'état.
- « Focus 25 min » dans tous les menus de tâche, avec son état et sa raison. Calendrier et feuille de route compris.
- La pastille : clic = page Timer, bouton Pause / Reprendre, « ⋯ » et clic droit = menu de l'app, entrée animée.
- La carte Timer d'Aujourd'hui : un bouton « Plein écran » nommé, les chiffres ne se cliquent plus.
- La palette : même geste, sans plein écran, avec un message.
- Barre des menus du Mac : titre et deux entrées de menu (écrit, compilé, testé ; **pas vu**).
- En-tête de `FocusOverlay.tsx` corrigé et daté.
- Clés retirées d'`en.ts` : « Focus 25 min », « Agrandir la session ». Clés ajoutées dans un bloc daté en fin de dictionnaire.

##### Pas fait

- **La carte mentale.** Son menu de nœud n'a pas l'entrée Focus. Deux raisons : ce n'est pas un menu de tâche ; et l'éditeur de carte recouvre tout l'écran, pastille comprise. Une séance lancée de là partirait sans que rien ne le montre. Il faudrait d'abord faire passer la pastille au-dessus de l'éditeur.
- **iPhone : aucun code.** Voir la note de faisabilité plus bas.
- **La traduction du menu du tray.** Il était déjà en français seulement.
- **Le libellé d'une séance reprise au redémarrage.** Une séance liée à une tâche revient nommée « Focus » : son nom n'est pas en base (`label` nul quand `task_id` est posé). Défaut ancien, non touché. La règle, elle, reconnaît toujours la tâche par son numéro.
- **La pause n'est pas gardée en base.** Une séance mise en pause puis l'app fermée : au retour, le temps de fermeture a compté. Défaut ancien, non touché.

##### Vu à l'écran (mode démo, pilote du labo, build `7fdb522`)

Bureau 1440×900, densité « Confort » (110 %), thème sombre puis clair ; téléphone 390 px au doigt, en français puis en anglais.

- Tâches › « ⋯ » › Focus 25 min : la séance part, la pastille apparaît, on reste dans Tâches.
- Pendant la séance : « Autre session en cours » grisée sur une autre tâche (bulle lue), « Focus en cours » sur la même.
- Séance en pause : « Reprendre le focus » dans le menu et sur le ▶ d'Aujourd'hui ; il reprend.
- Aujourd'hui : ▶ sur une tâche récurrente ; carte Timer « Lancer 25 min » ; ses trois boutons en séance.
- En retard : l'entrée est là, au repos comme en séance.
- Calendrier (clic droit sur une tâche) et feuille de route d'un objectif : l'entrée est là.
- Tâche cochée : grisée, bulle « Cette tâche est faite. Rouvre-la pour lancer un focus. »
- Palette : ⌘K › Lancer un focus › « maquettes » : séance lancée, pas de plein écran, message.
- **Pause enchaînée** : 1 minute de travail lancée de la page Timer, attendue dans Tâches. La pause démarre sans plein écran ; « Focus 25 min » est actif et lance par-dessus elle.
- Pastille : clic (ouvre Timer), bouton pause, clic droit, « ⋯ », Maj+F10 puis flèche et Entrée (« Terminer la session »).
- Plein écran demandé par le menu de la pastille : l'horloge seule ; Échap rend la pastille.
- Téléphone : pastille en bas, 46 px ; menu au-dessus d'elle ; dernière ligne de la liste dégagée en fin de défilement.

##### Non vérifié

- ⚠️ **Toute la barre des menus** : le titre, sa mise à jour chaque seconde, les deux entrées du menu, leur effet. À regarder après le build :
  1. lancer une séance : « 25:00 » apparaît-il à droite de l'icône Shale, et descend-il chaque seconde ?
  2. **la barre des menus tremble-t-elle** ? Les chiffres de macOS n'ont pas tous la même largeur : le titre peut changer de largeur d'un pixel et pousser les icônes voisines. Si c'est gênant, deux sorties : n'écrire que les minutes (« 24 min »), ou poser une police à chiffres fixes par du code macOS (non écrit) ;
  3. mettre en pause dans l'app : « · pause » s'ajoute-t-il ?
  4. cliquer l'icône : « Pause » et « Terminer la session » sont-elles en tête ? Agissent-elles ?
  5. terminer : le titre disparaît-il, et les deux entrées avec ?
  6. passer sur une autre app, fenêtre de Shale recouverte ou fermée : le titre continue-t-il d'avancer ? (C'est pour cela que le compte est en Rust.)
- **L'entrée de la pastille en mouvement** : vue sur des images fixes seulement.
- **WKWebView** : tout a été vu dans Chrome.
- **Le plein écran natif de macOS** quand on le demande : inchangé, non revu.
- **Un démarrage qui échoue** : le message est testé, pas provoqué à l'écran.
- La suite complète de tests n'a pas été jouée (consigne).

##### Commandes

- `npx tsc --noEmit` : rien.
- `npm run test:types` : rien.
- `npm run i18n:check` : 0 clé manquante (2838 entrées).
- `npm run i18n:durs` : 0 chaîne sûrement française.
- `npx vitest run src/lib/calque.test.ts src/lib/timerFenetre.test.ts src/lib/timerEcran.test.ts src/components src/lib/seance` : 14 fichiers, 126 tests, tous verts. Dont 30 neufs (`focusTache` 15, `gesteFocus` 11, `seance` 4) et 5 réécrits dans `tache.test.ts`.
- `cargo check --all-targets` : terminé sans avertissement.
- `cargo test --lib` : 165 réussis, dont 8 neufs (`seance_tray`).
- `cargo test --test permissions_fenetres` : 3 réussis.

##### Note de faisabilité — la séance sur l'iPhone (Activité en direct, Dynamic Island)

Aucun code écrit. Faits lus dans `src-tauri/gen/apple/project.yml`, `gen/apple/Sources/shale/`, `gen/apple/shale_iOS/` et `MOBILE.md`.

**Où l'on en est.**
- Le projet Xcode a **une seule cible** (`shale_iOS`, une application). Aucune extension, aucun widget.
- Cible iOS **17.0** : les Activités en direct existent depuis iOS 16.1, le système convient.
- Le fichier de droits (`shale_iOS.entitlements`) est **vide**. `Info.plist` n'a pas la clé `NSSupportsLiveActivities`.
- Signature : équipe gratuite d'Antonin (`QXU2BNU373`), profil de 7 jours. Le programme payant (99 $) n'est pas souscrit (`MOBILE.md` § 28).
- **L'app ne tourne plus sur le vrai iPhone** depuis le 3 septembre (profil expiré). Tout est vérifié au simulateur depuis.
- Le seul pont natif existant va **du Swift vers l'app**, par un fichier-drapeau (`QuickNoteIntent.swift` → `note_rapide.rs`). **Rien ne va de l'app vers le Swift.** Le Swift du projet n'a pas accès à la page (`QuickNoteIntent.swift` le dit en commentaire).
- `MOBILE.md` § 4 et § 4.1 ont déjà écarté les widgets : « hors de portée de Tauri », cible Swift à part, groupe d'apps.

**Ce qu'il faudrait.**
1. **Une cible d'extension de widget** dans `project.yml` (WidgetKit + SwiftUI), avec son identifiant, son `Info.plist`, ses droits. C'est elle qui dessine l'écran verrouillé et la Dynamic Island.
2. **`NSSupportsLiveActivities`** dans l'`Info.plist` de l'app.
3. **Du Swift dans l'app** qui démarre, met à jour et termine l'activité (ActivityKit : `Activity.request`, `update`, `end`). ActivityKit ne se pilote que depuis l'app, pas depuis l'extension.
4. **Un pont de l'app vers ce Swift**, qui n'existe pas. Le plus propre est un greffon Tauri mobile (Swift appelé depuis Rust) : trois commandes, démarrer, mettre à jour, terminer. C'est le premier du dépôt.
5. **Rien à diffuser chaque seconde** : l'activité reçoit l'instant de fin, et iOS décompte seul (`Text(timerInterval:)`). C'est le même principe que la fenêtre séparée et la barre des menus. Une mise à jour suffit à chaque pause, reprise ou fin.
6. Les boutons Pause / Terminer **dans** l'activité demandent des App Intents (iOS 17) et un état partagé entre l'app et l'extension, donc un groupe d'apps. Une première version peut s'en passer : toucher l'activité ouvre l'app.

**Ce que permet l'équipe gratuite.** `MOBILE.md` ne dit qu'une chose : pas de notifications poussées. Une Activité en direct mise à jour **par l'app** n'en a pas besoin. Une extension se signe en principe avec une équipe gratuite. **Le groupe d'apps (point 6) avec une équipe gratuite : non vérifié**, ni dans le dépôt ni ailleurs. À essayer avant de s'y engager.

**Ce que ça risque.**
- **La fin de séance.** iOS suspend l'app en arrière-plan. À zéro, personne ne termine l'activité : elle reste affichée, à « 0:00 », jusqu'au retour dans l'app. On peut lui donner une date de péremption à la création. Et aujourd'hui **aucune notification n'est programmée pour la fin d'une séance** : elle est envoyée par la page au moment où elle le constate, donc pas si l'app dort. Sans corriger cela d'abord, l'activité promettrait une fin que le téléphone ne sonne pas.
- **La pause n'est pas en base** : après une suspension, l'app et l'activité peuvent se contredire.
- **`gen/apple` se régénère en partie.** `xcodegen generate` réécrit le projet Xcode depuis `project.yml` : une cible ajoutée dans Xcode seulement disparaîtrait. Elle doit être écrite dans `project.yml`.
- **Le build.** `tauri ios build` ne relance pas XcodeGen ; le script de compilation Rust est attaché à la seule cible `shale_iOS`. Une seconde cible dans ce montage n'a jamais été essayée ici.
- **La vérification.** Une Dynamic Island ne se juge que sur un vrai iPhone, et l'app n'y est plus installée.
- **L'App Store.** Une extension de plus dans le dossier de soumission en cours (`MOBILE.md` § 28).

**Combien c'est gros.** Plusieurs jours, pas une soirée. Dans l'ordre : programmer la notification de fin de séance (utile seule) ; garder la pause en base ; écrire le greffon Swift ; ajouter la cible de widget ; dessiner les trois présentations (écran verrouillé, île compacte, île étendue) ; rebrancher un vrai iPhone pour voir. C'est le premier morceau de Swift de ce dépôt qui reçoit des ordres de l'app : tout le reste de l'iPhone a été fait sans.

**Recommandation.** Ne pas l'entreprendre avant le compte développeur payant et un iPhone sur lequel l'app s'installe. La première marche utile, et petite, est la notification de fin de séance programmée à l'avance : elle sert aussi sans Activité en direct.

### `dates-claires` — la pastille « sans date », l'échéance d'un objectif

##### 2026-10-12 (soir) — `dates-claires`

**Fait, et vu à l'écran** (mode démo, Chrome sans fenêtre, outils du labo) :
- Tâches : la pastille « sans date » avant d'écrire et pendant qu'on écrit ; la date lue (« jeu. 15 oct. · 14:30 ») ; le calendrier ouvert sur place depuis la pastille ; après l'ajout, ligne surlignée sans défilement (bureau, 110 %) ; au téléphone, pas de saut, message « Ajoutée dans « Sans date » · Voir », et « Voir » y mène.
- Objectifs : la page sans échéance (« Ajouter une échéance »), avec échéance cette année (« 11 semaines pleines d'ici là »), l'an prochain (« ven. 12 févr. 2027 », « 17 semaines pleines d'ici là »), dépassée (« Dépassée de 41 jours. … »), en péril (« 3 jours restants, 62 % fait. ») ; poser, changer la date sur place ; la liste ; un objectif neuf daté à cinq jours (« 5 jours d'ici là », aucun bandeau au Calendrier).
- Aujourd'hui : « Objectifs en cours » et « En retard » avec la date écrite.
- Une étape datée en 2027 : pastille « 30 janvier 2027 ».
- Accueil (compte neuf) : avec date (bureau) et sans date (téléphone) ; le calendrier s'ouvre au-dessus de l'accueil ; l'objectif planté porte sa date.
- Anglais et thème clair : Tâches, liste et page d'un objectif.
- Bureau à la densité 110 % (« Confort ») : Tâches, liste et page d'un objectif.

**Résultat des commandes** : `tsc --noEmit` propre · `test:types` propre · `i18n:check` 0 manquante (2839 entrées) · `i18n:durs` 0 sûrement française · `vitest run src/lib/taches src/lib/objectifs src/lib/onboarding src/lib/calendrier` + `defilement.test.ts` : 32 fichiers, 653 tests verts. Aussi lancés : `src/lib/ia`, `src/lib/performance` (ils lisent le péril), les tests de source. **La suite complète n'a pas été lancée.**

**Pas fait** :
- Les messages de report d'une tâche (« … est prévue le jeudi 15 octobre ») n'écrivent toujours pas l'année. Hors mission (ce sont des tâches).
- La liste des objectifs n'écrit pas la date d'une échéance **dépassée** : elle garde « en retard de 41 j ». La date est sur la page et sur Aujourd'hui.
- Performance › « Par objectif » n'est pas touché (il part avec `perf-epure`).
- Aucune date d'échéance n'est proposée ni déduite pour les jalons de l'accueil.

**Pas vérifié** :
- Rien n'a été vu dans l'app native (WKWebView, macOS ou iPhone). En particulier `estEnVue` sous la densité, et le message « Ajoutée dans… » quand le clavier de l'iPhone est ouvert.
- La règle « né aujourd'hui ou hier » sur une vraie base (date de création en temps universel) : tenue par des tests, pas vue.
- L'accueil à 110 % (un compte neuf démarre à 100 %), l'accueil en anglais, l'accueil en thème clair.
- Les info-bulles des nouvelles pastilles n'ont pas été regardées à l'écran.

**Vu en passant, pas corrigé** : au téléphone, dans la feuille de route, le titre d'une étape sur deux lignes chevauche sa pastille de date (« Signer deux clients récurrents » / « 15 août »). Antérieur à ce chantier.

## 2026-10-12 (nuit) — « l'écriture est floue » : la pastille du minuteur, et tout ce qui était centré de la même façon

Branche `chantier/texte-net` (worktree `Shale-chantiers/texte-net`). Front seul : `timer/PastilleSeance.tsx` (la pastille y a déménagé le même soir, chantier `focus-ile`), `timer/pastille.css` (commentaire), `NoteComposer.tsx`, `EditeurCarte.tsx`, `Sidebar.tsx`, `LoginScreen.tsx`, `KnowledgeView.tsx`, `PositionSizeWidget.tsx`, `lib/nettete.source.test.ts`, `tools/webkit-pilote.swift`. Ni `index.css`, ni `en.ts`, ni migration, ni Rust. Décisions : `CLAUDE.md`, même date. Pièges : § 41.

**Mesuré dans WebKit** (pilote, démo, 1470×923 à 110 %, sombre, en lisant ce que l'écran compose) :
- avant : pastille à x = 657,75 ; gradient moyen 0,0256 ; la même, centrée par des marges : 0,0278 ;
- après (build de démo du correctif, AVANT recalage : l'ancienne pastille, mêmes classes de centrage) : pastille centrée sur 735,00 (fenêtre de 1470), `translate: none` ; gradient 0,0282 ; au survol elle ne bouge pas ;
- une entrée animée tenue par `both` (`transform` identité) ne la rend pas floue : 0,0282 — utile au chantier `focus-ile` ;
- bulle de mise en forme du Savoir : centrée sur la sélection (535,38 des deux côtés), 8 px au-dessus, nette à la capture ;
- la NOUVELLE pastille (`PastilleSeance.tsx`, build de démo `a064b55`) : centrée sur 735,00 en marche (220,63 de large) comme en pause (289,02), `translate: none`, immobile au survol, nette à la capture de l'écran. Pas de chiffre avant / après pour elle : la comparaison dans le même passage a raté ;
- repère d'onglet actif : 10,5 px au-dessus, 10,5 px au-dessous ; loupe du Savoir : 11,98 et 12,01.

**Tests** (sur `a064b55`) : `nettete.source.test.ts` (4), vu rouge sur l'ancien code (sept fichiers) ; `tsc --noEmit` et `test:types` 0 erreur ; 122 tests des fichiers touchés verts. ⚠️ Suite complète NON rejouée (machine à 60–150 de charge toute la soirée).

⚠️ **Pas vu** :
- l'app installée ;
- les trois bandeaux de la carte mentale (ils n'existent que pendant un glissement) ;
- l'œil du mot de passe et le « % » du calculateur (écran de connexion et module de côté) : équivalence de CSS, pas de mesure ;
- la comparaison des positions avec l'ancien build : le passage est resté bloqué, machine à plus de 90 de charge ;
- un écran non Retina. La capture d'Antonin fait 1 pixel par point : soit son écran, soit le collage l'a réduite.


**Pas installé.** ⚠️ Le build natif du 13/10 à 00:23 (`eff40f0`, session [correctifs]) est parti quelques minutes AVANT cette fusion : il porte la nouvelle pastille, encore floue. Le correctif part avec le build suivant.

## 2026-10-12 (nuit) — « Supprimés récemment » : la suppression définitive et « Vider » réparés

Branche `chantier/corbeille-definitive`. Demande d'Antonin : « des fois certains items ne se suppriment pas dans Supprimés récemment, et Tout supprimer ne marche pas tout le temps, vérifie et corrige ». Décisions : `CLAUDE.md`, même date. Pièges : `PIEGES.md` § 42.

**La cause, en deux lignes.** La base applique les clés étrangères (sqlx les allume d'office ; `repo.ts` disait le contraire). Un objectif qui a un historique de progression, ou une tâche qui a une séance de focus, ne pouvait pas être effacé ; et « Vider » s'arrêtait au premier refus sans relire la liste ni rien dire.

**Rejoué sur une copie de la vraie base** (prise par `.backup` en lecture seule le 12/10 à 23:35 ; la base réelle n'a pas été touchée) :

| | Lignes en corbeille | Objets effacés | Refus |
|---|---|---|---|
| Avant le geste | 63 (128 objets : 76 objectifs, 50 tâches, 1 habitude, 1 événement) | — | — |
| Code d'avant, boucle de la vue | 62 restent | 1 | arrêt au premier (`FOREIGN KEY constraint failed`) |
| Code d'avant, boucle tolérante | 7 restent | 104 | 7 |
| **Code corrigé** | **0** | **128** | **0** |

Après le code corrigé, sur la copie : objets vivants inchangés (12 objectifs, 30 tâches, 3 habitudes, 21 notes, 6 fiches, 4 sujets, 1 événement), 18 séances de focus avant et après (une détachée de sa tâche), `integrity_check` ok, `foreign_key_check` 0.

**Fichiers.** `src/lib/suppression.ts` (nouveau, avec son test), `repo.ts` (les `delete*`, `viderCorbeille`, `purgerCorbeille`, `supprimerExemples`), `demo.ts` (`deleteTask`), `sync/local.ts` (`supprimerLigne`), `views/CorbeilleView.tsx`, `components/corbeille/geste.tsx`, `en.ts` (3 clés). Aucune migration, aucun Rust.

**Tests.**
- `suppression.test.ts` (7) : toute clé étrangère du schéma est connue de `DEPENDANTS` ; contre-épreuve faite (une ligne retirée → rouge).
- `corbeille/api.test.ts` (+7, natif et démo) : objectif suivi, tâche chronométrée, purge, vider, vider et purge après un refus, exemples. Vus rouges avant le correctif.
- `sync/corbeille.test.ts` (+3, deux appareils) : les trois en `FOREIGN KEY constraint failed` sans le correctif de `supprimerLigne`.

**Vu à l'écran** (build de démo du chantier, Chrome piloté du labo, bureau 1440×900) : une tâche et un objectif à 2 étapes et 4 tâches jetés ; « Supprimés récemment » affiche 2 lignes, « Vider (8 éléments) » ; « Tout supprimer » → « Rien à restaurer » et le toast « 8 éléments supprimés pour de bon ».

⚠️ **Pas vu.**
- L'app installée : rien n'est installé. Le correctif n'atteint Antonin qu'après un build natif.
- Le message d'échec (« … n'a pas pu être supprimé ») : le mode démo ne sait pas fabriquer un refus de la base. Le chemin est tenu par les tests natifs et par les types.
- Deux vraies machines : le correctif de synchronisation est prouvé sur le banc à deux bases, pas sur un vrai second appareil.

▶️ **Après le build : un seul geste d'Antonin.** Ouvrir « Supprimés récemment », cliquer « Vider », puis « Tout supprimer ». Les 63 lignes partent. Rien à faire sinon : aucune donnée n'est à réparer.

⚠️ **À savoir avant ce geste.** Vider envoie 76 pierres tombales d'objectifs et 50 de tâches. Un appareil resté sur une version D'AVANT ce correctif, et qui a ces objets, verrait sa synchronisation s'arrêter dessus (PIEGES § 42.2). L'iPhone et le simulateur doivent recevoir ce correctif avant de resynchroniser.

**Ligne de base** (après recalage sur `d420ab4`) : `tsc`, `test:types`, `i18n:check` (2807), `i18n:durs` verts. vitest : 2525 verts, 3 ignorés, **1 échec** — `finance/facturation/demo.test.ts`, « jour par jour », délai de 60 s dépassé. Le même test dépasse son délai sur le tronc SANS ce chantier, rejoué dans la même minute (machine à 70 puis 110 de charge : rendus Blender et ffmpeg d'une autre session). Ce n'est pas ce chantier ; à rejouer machine calme.

**Installé le 2026-10-13 à 01:16**, par le build groupé de la session [correctifs] (carnet, 01:17) : `mobile-ios` `7727898`, 01:10 → 01:16, code 0. Il porte aussi le correctif de netteté de [texte-net]. Témoin dans `dist/assets` : « n'a pas pu être supprimé » (3). Relu par cette session : sha256 du binaire installé `8ea6fc7989f8…`, base en version 30, corbeille INCHANGÉE (76 objectifs, 50 tâches, 1 habitude, 1 événement) — elle attend le geste d'Antonin, personne ne l'a vidée à sa place.

⚠️ **Pas vu dans l'app installée** : ni « Vider », ni la suppression d'une ligne. Le premier essai réel sera celui d'Antonin.

## 2026-10-13 (01:16) — build groupé installé : retours d'Antonin, texte net, corbeille

- **Installé** : `/Applications/Shale.app` = `mobile-ios` `7727898`, empreinte `8ea6fc7989f8`. Il porte les trois chantiers du soir du 12 (Performance épurée, focus sans plein écran + pastille + barre des menus, dates), la pastille nette de [texte-net] et la corbeille réparée de [corbeille-definitive]. Pas le renommage d'habitude (non fusionné à cette heure).
- Un premier build (`eff40f0`, 00:45) a précédé de trente minutes ; l'app qu'il avait lancée attendait la fenêtre du trousseau et ne répondait pas à « quit » : arrêtée par son numéro de processus avant l'installation du second.
- Base : version 30, intégrité ok, 88 objectifs / 80 tâches / 21 notes / 4 habitudes / 18 séances, identiques aux deux sauvegardes (`sauvegardes-locales/avant-retours-essai-20261013-0022`, `avant-build-groupe-20261013-0104`).
- **À regarder par Antonin, jamais vu par une session** : le temps restant dans la barre des menus pendant une séance (« 24:31 », « · pause », les deux entrées du menu de l'icône, la disparition en fin de séance, pas de tremblement).
- **iPhone** : rien d'installé. Le téléphone n'était pas branché et son profil gratuit a expiré le 3 septembre. Le Rust neuf compile pour iOS (`cargo check --lib --target aarch64-apple-ios-sim`, code 0). Pour le mettre à jour : brancher l'iPhone, le déverrouiller, puis procédure de `MOBILE.md` § 20.
- **Décisions en attente d'Antonin** : listées en tête de la section du 2026-10-12 (soir) de `CLAUDE.md`.
- Suite de tests : 2 467 verts sur `eff40f0` + trois fichiers tombés en délai sous charge (50 à 117), verts rejoués seuls ; sur `7727898`, la suite de [corbeille-definitive] (2 525 verts, le même délai dépassé de Finance) fait foi.

## 2026-10-13 (10:38) — Shale 0.8.0 reposée sur l'iPhone réel

- **Installé sur l'iPhone 16 d'Antonin** : `mobile-ios` `f91e1c4`, build `release`, version 0.8.0 — le code de l'app Mac installée (`7727898`), la documentation en plus. `devicectl device info apps` rend `Shale com.atnfx.shale 0.8.0`. Procédure et preuves : `MOBILE.md` § 29 ; pièges : `PIEGES.md` § 43.
- Xcode n'avait plus aucun compte Apple sur ce Mac : Antonin s'y est reconnecté. Profil gratuit recréé, **valable jusqu'au 2026-10-20 à 10:06**.
- **Constaté par Antonin** (après avoir refait confiance au développeur : Réglages → Général → VPN et gestion de l'appareil) : l'app s'ouvre, **sans demande de connexion** (la session d'août a survécu à la pose), et tout est synchronisé. ⚠️ **Faux pour la réception**, constaté le soir même : le téléphone s'arrêtait au 29 septembre (entrée « Synchronisation » du 2026-10-13, nuit). **Pas vu par une session** : l'écran du téléphone ; le clavier, la zone sûre, les notifications restent dus.
- Le Mac n'est pas touché : `/Applications/Shale.app` reste à `8ea6fc7989f8`, la base n'a pas été ouverte.
- Gardé : `src-tauri/target/aarch64-apple-ios` (1,2 Go de cache Rust, pour la pose de la semaine prochaine). Supprimé : `gen/apple/build/arm64`, l'archive Xcode ; les deux fichiers que Tauri réécrit à chaque build (`project.pbxproj`, `Info.plist`) sont remis.

## 2026-10-13 (soir) — démo : les habitudes d'allure naturelle

- **Fait** : l'historique des trois habitudes du jeu de démo est écrit à la main (`src/lib/demoHabitudes.ts`, lu par `demo.ts`) ; le damier du Journal a disparu. Pourquoi et comment : `CLAUDE.md`, section du 2026-10-13.
- **Vu à l'écran**, en démo, un mardi (13/10), en français : le Journal (grille de douze semaines et quatorze jours par habitude) ; Performance sur 30 jours — « « Sport » : tenue 43 % du temps. », « Le samedi : 42 % de tes habitudes tenues, contre 63 % en moyenne. », Méditation 26/30, Sport 13/30, Lecture 18/30. En anglais, Performance seule : « “Exercise”: kept 43% of the time. », « Saturday: 42% of your habits kept, against 63% on average. ». Aucune erreur en console.
- **Pas vu à l'écran** : les six autres jours de la semaine (tenus par le test, qui balaie sept jours), le Journal en anglais, le téléphone.
- **Rien à installer** : la démo ne sert que hors Tauri. Aucun build natif, aucune migration, aucun Rust, `en.ts` non touché.
- **Hors dépôt, à faire par la session des reels** : `~/Desktop/Shale marketing/Shale reels/shale-reels-claude/_kit/vite.film.mjs` remplaçait ces trois règles à la volée. ⚠️ Il ne les trouvera plus et S'ARRÊTE sur « règle d'habitude introuvable » : retirer son bloc `HABITUDES` / `REGLES` et la branche `demo.ts` de son `transform` (le reste — mode démo sans Supabase — sert toujours).
- **Signalé, non corrigé** : tâches, focus, métriques, progression des objectifs et humeur de la démo sont aussi réguliers (détail dans `CLAUDE.md`). La branche `chantier/demo-captures-v3` les réécrit et n'est pas fusionnée.
- **Ligne de base** : `tsc`, `test:types`, `i18n:check` (2807) verts. vitest : 176 fichiers, 2 535 tests (6 neufs). Deux passes complètes sous une charge de 50 à 60 (autres sessions) : 2 puis 5 fichiers en délai dépassé — `finance/facturation/demo.test.ts` (« jour par jour », 60 s), `sync/engine.test.ts` (volume), `ia/serveur*.test.ts` (crochet de 60 s). Rejoués seuls dans la minute : 108 tests verts sur ces cinq fichiers. Aucun ne lit les habitudes.

## 2026-10-13 (soir) — iPhone : la barre du bas se choisit dans Personnaliser

Demande d'Antonin. Décisions : `CLAUDE.md`, même date. Mode d'emploi et fichiers : `MOBILE.md` § 30.

- **Fait** : Personnaliser → « barre du bas » (téléphone seulement). Retirer, ajouter, ranger les onglets ; quatre au plus, un au moins ; « Plus » fixe ; « Par défaut ». Le défaut est la barre d'avant (Aujourd'hui · Tâches · Notes · Journal) : rien ne change pour qui ne touche à rien.
- **Fichiers** : `src/lib/onglets.ts` (neuf, la règle) et son test ; `uiConfig.ts` (champ `onglets`) ; `MobileNav.tsx` ; `AdminView.tsx` ; `en.ts` (9 clés). Aucune migration, aucun Rust, aucune dépendance.
- **Ligne de base** (worktree `Shale-chantiers/barre-du-bas`) : `tsc` vert ; `test:types` vert ; `i18n:check` 0 manquante, 2816 entrées ; `i18n:durs` 0 chaîne sûrement française ; vitest ciblé 142/142, dont 24 nouveaux (`onglets.test.ts`).
- **Vu à l'écran** : Chrome piloté, mode démonstration, 390 × 844 au doigt, français sombre et anglais clair — tout le parcours du § 30.4 de `MOBILE.md`. Captures : `~/Desktop/Shale-chantiers/captures-barre-du-bas/`.
- ⚠️ **Pas vu** : WebKit ; la barre relue après une fermeture de l'app (la démo garde ses réglages en mémoire) ; un compte sous licence (module masqué) — ce cas n'est tenu que par les tests.
- ⭐ **Posée sur l'iPhone d'Antonin à 22:03** (`mobile-ios` `138e331`, release, 0.8.0, `.ipa` `284c44007845`) : « App installed », données du téléphone intactes (base copiée avant : `sauvegardes-locales/avant-barre-du-bas-iphone-20261013-2158/`). Profil du matin réutilisé, valable jusqu'au **2026-10-20 à 10:06**. ⛔ **Pas vue ouverte** : le lancement à distance a été refusé, téléphone verrouillé. Détail : `MOBILE.md` § 30.5.
- **Le Mac n'est pas touché** : `/Applications/Shale.app` reste au build du 13/10 à 01:16. La section n'existe que sur téléphone.
- **Non fait** : choisir les tuiles du pied de « Plus ». (Glisser les onglets au doigt : fait le soir même, ci-dessous.)
- **Remarqué en passant, non corrigé** : en anglais, à 390 pt, le sélecteur de densité de Personnaliser passe sur deux lignes (« Large » seul dessous).

## 2026-10-13 (nuit) — barre du bas : ranger les onglets en glissant, après un maintien

Demande d'Antonin, après avoir reçu la section du soir. Décisions : `CLAUDE.md`, même date. Détail : `MOBILE.md` § 30.6. Piège : `PIEGES.md` § 45.3.

- **Fait** : dans Personnaliser → « barre du bas », une ligne maintenue 0,4 s se soulève et se glisse à sa place ; ses voisines s'écartent ; lâcher écrit l'ordre. Les flèches restent. Une phrase de la section dit le geste.
- **Fichiers** : `src/components/useGlisserListe.ts` (neuf) ; `src/lib/onglets.ts` (trois fonctions) et son test (32 tests, dont 8 nouveaux) ; `AdminView.tsx` ; `en.ts` (une clé). Aucune migration, aucun Rust.
- **Ligne de base** : `tsc` vert ; `test:types` vert ; `i18n:check` 0 manquante, 2817 entrées ; `onglets.test.ts` 32/32.
- **Vu au doigt** dans Chrome sans fenêtre (390 × 844, démo), à 100 % et à 110 % : 33 vérifications sur 33 — liste dans `MOBILE.md` § 30.6. Capture : `~/Desktop/Shale-chantiers/captures-barre-du-bas/04-ligne-en-main.jpg`.
- ⭐ **Posé sur l'iPhone d'Antonin le 14/10 à 00:08** (`mobile-ios` `c88e372`, release, 0.8.0, `.ipa` `8e36fb5a69d4`) : « App installed », conteneur gardé. ⛔ Pas vue ouverte (téléphone verrouillé). ⚠️ Ce build s'arrête à `c88e372` : le correctif de synchronisation `a2e36a0`, fusionné pendant qu'il tournait, n'est PAS sur le téléphone. `MOBILE.md` § 30.7.
- ⚠️ **Pas vu sur un iPhone** : la retenue du défilement dans WebKit, la loupe et la sélection de texte pendant le maintien. Si la page défile sous le doigt une fois la ligne soulevée, c'est `retenir` (`useGlisserListe.ts`) qu'il faut regarder.
- **Non fait** : le même geste pour les autres listes de Personnaliser (modules, widgets) — non demandé ; une animation de pose au lâcher (la ligne tombe à sa place sans transition).

## 2026-10-13 (nuit) — démo : huit habitudes, jours blancs, tâches sur la même période

Suite du point précédent, après le retour d'Antonin sur les captures. Détail et raisons : `CLAUDE.md`, section du 2026-10-13 (soir).

- **Fait** : `src/lib/demoHistorique.ts` (ex-`demoHabitudes.ts`) écrit huit semaines d'habitudes ET de routines. Huit habitudes au lieu de trois ; quatre jours blancs ; les tâches et le focus remontent au même lundi que les habitudes (17 août, vu le 13 octobre) ; cinq noms d'habitudes ajoutés à `en.ts`.
- **Vu à l'écran**, en démo, un mardi, en français : le Journal (huit lignes, quatre cases vides dans la grille) ; Performance sur 30 jours et sur 3 mois (les deux courbes partent du même jour) ; Aujourd'hui (série de 7 jours et bande des 7 jours inchangées, « Habitudes à tenir 2/8 », huit lignes sans débordement). Aucune erreur en console.
- **Pas vu à l'écran** : les six autres jours de la semaine (le test balaie sept jours) ; l'anglais (les cinq clés existent, `i18n:check` vert) ; le téléphone, où huit habitudes allongent la carte d'Aujourd'hui et le Journal.
- **Rien à installer** : démo seule. Ni Rust, ni migration, ni build natif.
- ⚠️ **Captures et reels** : tout écran de démo montrant Journal, Performance ou « Habitudes à tenir » a changé (huit habitudes). `_kit/vite.film.mjs` reste à nettoyer (point précédent).
- **Ligne de base** : `tsc`, `i18n:check` (0 clé manquante) verts ; `demoHistorique.test.ts` 9 sur 9. Suite complète sous une charge de 35 à 70 : 2 494 verts, 9 fichiers en délai dépassé (bancs Postgres de `auth/`, `ia/`, `licence/`, `sync/` ; `finance/facturation/demo.test.ts`), tous verts rejoués à part — sauf le balayage « jour par jour » de Finance, qui dépasse ses 60 s sur le TRONC aussi ce soir. Contrôlé : la démo se charge aussi vite qu'avant (0,5 à 1 s par chargement des deux côtés, 375 chargements dans ce test), et le test passe (20 sur 20, 258 s) avec un délai élargi le temps de la mesure. À rejouer machine calme.

## 2026-10-13 (nuit) — Synchronisation : l'iPhone était figé depuis septembre ; une orpheline ne retient plus le curseur

Branche `chantier/sync-orpheline`. Antonin : « quand j'ai mis l'app sur mon tel ce matin je me suis rendu compte que les tâches n'étaient pas bien sync ». Décisions : `CLAUDE.md`, même date. Pièges : `PIEGES.md` § 46.

**La cause, en trois lignes.** L'habitude « Leve avant 9H » existe sur le Mac depuis le 26 juillet, avant les triggers d'outbox : jamais modifiée, donc jamais envoyée. Ses coches, elles, étaient sur le serveur. L'iPhone les mettait en quarantaine, retenait son curseur devant elles (39) et relisait à chaque cycle la même page de 200 lignes : il ne voyait rien d'écrit après le 29 septembre.

**Lu sur les deux bases** (Mac : lecture seule ; iPhone : copie par `devicectl`, base + `-wal`) :

| | Mac | iPhone à 22:23 | iPhone à 23:06 |
|---|---|---|---|
| Curseur | 1278 | **39** | 1306 (Mac : 1306) |
| Tâches (dont en corbeille) | 80 (50) | 32 (30) | 80 (50) |
| Objectifs | 88 | 64 | 88 |
| Habitudes | 4 | 3 | 4 |
| Dernière tâche connue | 12 octobre | 29 septembre | 12 octobre |

La sauvegarde automatique de l'iPhone de 10:44 (avant sa première synchronisation du jour) portait déjà le curseur à 39, dernière lecture le 3 septembre : le défaut date d'avant la pose de ce matin. « Déjà connecté et synchronisé » (ligne « App iOS » du tableau du § 4, et entrée de 10:38) était faux pour la réception.

**Le geste sur la vraie base du Mac (22:32).** Une écriture sans effet (`UPDATE … SET uid = uid`) sur l'habitude (id 1) et ses six coches, `applying = '0'` vérifié dans la même transaction : sept entrées de file. L'app du Mac les a envoyées à 22:32:50. Sauvegarde avant : `sauvegardes-locales/avant-sync-orpheline-20261013-2231` (version 30, intégrité ok, 88 objectifs / 80 tâches / 22 notes / 4 habitudes / 10 coches). Les coches ont été réécrites exprès : elles reprennent un numéro de séquence APRÈS leur habitude, ce qui les sort de la page où l'ancien moteur butait.

**Vérifié après la resynchronisation de l'iPhone (23:05:40)**, ligne à ligne, par `EXCEPT` entre les deux bases : tâches (libellé, priorité, récurrence, dates, corbeille) 0 écart dans les deux sens ; coches de tâches 28 / 28, 0 écart ; objectifs 88 / 88, 0 écart ; rattachement tâche → objectif 0 écart ; coches d'habitudes 10 / 10 ; notes 22 / 22.

**Le moteur** (`src/lib/sync/`) : `engine.ts` (réception réécrite, bloc « Orphelines »), `transport.ts` (`tirerParSeq`), `engine.testutil.ts` (le serveur simulé sait relire par numéro), `useSync.ts` (la republication vide la liste). Aucune migration, aucun Rust, aucune dépendance.

**Tests.**
- `orphelines.test.ts` (10, banc à deux appareils) : le parent jamais envoyé ; le parent à plus d'une page ; le parent qui arrive un cycle plus tard ; l'orpheline modifiée ou supprimée entre-temps ; le cycle coupé entre deux pages ; la relecture qui échoue ; aucune lecture de plus tant que rien n'arrive.
- `transport.test.ts` (+2) : la forme `in.(40,41)`, la liste vide, le découpage par 150.
- Sur le vrai serveur, sans session (donc sans rien lire) : `server_seq=in.(40,41)` rend 200, brut comme encodé ; un opérateur faux rend 400.

⚠️ **Pas fait.**
- **Aucun build.** Le Mac et l'iPhone tournent avec l'ancien moteur. Les données sont réparées ; le correctif du moteur n'arrive qu'au prochain build de chacun. D'ici là, le défaut ne revient que si une nouvelle orpheline apparaît sur le serveur. Vu depuis le Mac ce soir, il n'y en a aucune (coches → tâches, coches → habitudes, tâches → objectifs, objectifs → parents, séances → tâches, fiches → sujets : 0).
- **Huit lignes du Mac ne sont toujours pas sur le serveur** : un trade, deux calculs de position et une position du 2 août, quatre séances de focus du 26 juillet (dont une de 4 h 19). Rien n'en dépend. D'où l'écart restant : 19 séances sur le Mac, 15 sur l'iPhone. Les renvoyer est le même geste que pour l'habitude (`PIEGES.md` § 46.2) ; le garde-fou de la session l'a refusé, c'est à Antonin de le demander.
- **L'indicateur** ne dit pas qu'un appareil a des orphelines en attente.

⚠️ **Pas vu.** Le nouveau moteur sur un vrai appareil ; `tirerParSeq` avec une vraie session (la forme de la requête est vérifiée, pas son résultat).

**Installé sur le Mac le 2026-10-14 à 08:54** (build groupé, `mobile-ios` `d54fc8f` : ce moteur + les retours du 13/10 de [retours-1310]). sha256 installée = source `a17bcfd9cf29…` (ancienne `8ea6fc7989f8…`). Base relue après relance : version 30, intégrité ok, 88 / 80 / 22 / 4 / 19, identique à la sauvegarde `sauvegardes-locales/avant-build-sync-20261014-0847`. ⚠️ La synchronisation du Mac attend le clic « Toujours autoriser » d'Antonin dans la fenêtre du trousseau (dernière lecture : 13/10 à 21:15 UTC). **L'iPhone n'a pas ce moteur** : il n'était pas branché ; [retours-1310] fait le build iOS ensuite.

**Ligne de base** (machine à 40 puis 80 de charge, plusieurs sessions) : `tsc`, `test:types` verts. `vitest run src/lib/sync` : 20 fichiers, 292 verts, **1 échec** — `supabase.test.ts`, délai de 60 s dépassé au démarrage de PGlite. Rejoué seul à 80 de charge : 10 verts, 7 délais dépassés, tous au même crochet. Ce fichier n'importe que PGlite et `sync.sql` : aucun fichier de ce chantier (`PIEGES.md` § 9.11). La suite complète de l'app n'a pas été lancée : le chantier ne touche que `src/lib/sync/`. `orphelines.test.ts` vu rouge avant le correctif (7 échecs sur 9, première rédaction des tests).
## 2026-10-14 — retours d'Antonin du 13/10 : dix points, FUSIONNÉS dans `mobile-ios` (4727415)

> ⭐ **Mis à jour le 2026-10-14 au matin** : le test en échec était `onglets.test.ts` (la durée du maintien cherchée par son texte dans `GrilleHoraire.tsx`, déménagée dans `calendrier/appuiLong.ts` — PIEGES § 47.4) ; corrigé. Suite complète verte après rebase sur 6f70fc4 : **178 fichiers, 2583 tests**. Fusionné par avance rapide et poussé (`4727415`). Docs écrites : CLAUDE (section du 14/10), PIEGES § 47, MOBILE § 31, DETTE-SITE § AH. Le paragraphe ci-dessous date de la nuit (« ni fusionnés ») ; il reste vrai pour tout le reste. Builds : voir la fin de cette section.

*(Rédigé dans la nuit, avant la fusion :)*

Branche `chantier/retours-1310` (worktree `~/Desktop/Shale-chantiers/retours-1310`), depuis `mobile-ios` `f7af91d`. Front seul : ni Rust, ni migration. **Session coupée par la limite d'usage avant la fusion** : le code est commité sur la branche, rien n'est dans `mobile-ios`, rien n'est installé (ni Mac, ni iPhone).

**Fait, et vu en démo dans Chrome (bureau 1470 px à 110 %, téléphone 390 px) :**
- **Journal** — une barre de jours (`components/BarreJours.tsx`, aujourd'hui par défaut, futur éteint) ; la case d'une habitude coche le jour CHOISI et rien d'autre ; les carrés d'une ligne ne se cliquent plus (`components/habitudes/Grilles.tsx`). Humeur et énergie retirées de l'écran ; `upsertJournal(date, body)` n'écrit plus que le texte, les colonnes `mood` / `energy` restent en base, intactes. Case « inclure l'humeur et l'énergie » de la revue IA retirée.
- **« Énergie restante »** — déjà retirée le 11/10 (`sans-energie`, fusionnée) : rien à refaire, à vérifier seulement sur les apps installées.
- **Toast de corbeille** — il part toujours seul : 6 s à la souris (8 avant), 10 s au doigt (14 avant), le survol le retient mais reprend où il en était, plafond au double, filet de compte à rebours visible. ⚠️ Le toast « qui ne part jamais » n'a PAS été reproduit (Chrome, WebKit piloté) : c'est une correction de robustesse, pas une cause prouvée.
- **Performance** — les écarts s'écrivent « −3 % », plus « −3 pts » ; « À améliorer » dit « 69 %, contre 72 % la période d'avant ».
- **Timer** — choix Volets / Anneau en tête de la page Timer (`lib/timerStyle.ts`, réglage `timer_style`, synchronisé) ; l'anneau (`timer/HorlogeAnneau.tsx`) vaut pour la page, le plein écran et la fenêtre séparée (le style voyage dans `EtatTimerPartage`).
- **Calendrier** — ⚠️ défaut trouvé : un clic droit sur un événement horaire ouvrait le menu ET la fenêtre de l'événement par-dessus (`GrilleHoraire.saisir` ne regardait pas le bouton de la souris). Corrigé. Au doigt : maintien relâché sur place = le même menu (`calendrier/appuiLong.ts`), y compris dans l'agenda. Semaine par défaut partout, téléphone compris (grille `compact`, les « sans heure » y deviennent un compte par jour).
- **Les « carrés pointillés blancs »** — c'étaient les créneaux libres PROPOSÉS : sans libellé, proposés aussi sur les jours passés, et dessinés sous la dernière heure de la grille. Ils portent « Créneau libre » et leur heure, la grille s'étend pour les contenir, plus aucun dans le passé, aucun dans la semaine du téléphone.
- **Aujourd'hui** — « Habitudes à tenir » porte la grille des douze semaines et les derniers jours de chaque habitude ; plancher de hauteur 216 (136 avant), ce qui l'aligne sur le Timer dans la disposition d'Antonin (8 colonnes, hauteur épinglée 168 remontée au rendu).

**Vérifié.** `tsc`, `test:types`, `i18n:check` (0 manquante, 2844 entrées), `i18n:durs` (0 sûrement française) ; 30 fichiers de tests des zones touchées verts (506 tests). Suite complète lancée sous charge 37 : voir le message de commit.

**Reste à faire.** Relire le carnet, fusionner dans `mobile-ios`, build groupé macOS + pose iOS. Sections datées de `CLAUDE.md`, `PIEGES.md` (le clic droit sans test du bouton ; le pointillé hors grille), `MOBILE.md` (semaine et maintien au téléphone), `DETTE-SITE.md` (Journal sans humeur ni énergie, Timer à deux visages) : NON écrites. Rien de tout cela n'a été vu dans WKWebView ni sur l'iPhone réel.

### Suite du 2026-10-14 au matin — Mac installé, iPhone construit

- **Mac : installé à 08:54** par le build groupé de [sync-orpheline] (relancé à ma demande pour porter les deux chantiers, une seule fenêtre de trousseau). `mobile-ios` `d54fc8f`, sha256 installée `a17bcfd9cf29`. Contrôlé de mon côté : « Créneau libre » et `timer_style` présents dans le front du build. ⛔ Rien de ce chantier n'a encore été vu DANS l'app installée.
- **iPhone : build release fait** (`8988663`, 08:55 → 09:00, cache Rust repris). `.ipa` copié hors du dépôt : `Shale-chantiers/retours-1310-ipa/Shale-8988663.ipa` (sha256 `87fdd39ae023`). Il porte aussi le moteur de synchronisation (`a2e36a0`) que le téléphone n'avait pas. **Pas encore posé** : l'iPhone était « unavailable » (non branché). Pose : `xcrun devicectl device install app --device 9A784CC4-9486-5B91-A82B-B75DA758035D <ipa>`, après une copie de la base du téléphone (MOBILE § 30.5). Profil valable jusqu'au 2026-10-20 10:06.
- ⭐ **iPhone : posé et lancé à 09:02** (Antonin a branché le téléphone). `.ipa` `87fdd39ae023`, `mobile-ios` `8988663`. Base du téléphone copiée avant : `sauvegardes-locales/avant-retours-1310-iphone-20261014-0902` (integrity ok ; tâches 80, objectifs 88, habitudes 4), relue après le lancement : identique. ⛔ Pas encore vu à l'écran du téléphone.

## 2026-10-19 — Audit « alléger » : six allègements, FUSIONNÉS dans `mobile-ios` (dfcb929, local, non poussé), NON installés

Demande d'Antonin : l'app est jugée peu intuitive et trop chargée ; alléger textes et design, placer onglets et actions aux endroits habituels, surtout au téléphone. Audit court (≈ 1 h), en mode démo dans Chrome (labo, téléphone 390×844 et portable 1280×800). Rapport complet, avec les 13 pistes NON faites : `Shale-projet/audit-2026-10/ALLEGEMENT-2026-10-19.md`.

**Fait, sur `chantier/allegement`** (worktree `Shale-chantiers/allegement`, depuis `mobile-ios` `1e4b16d`), vu à l'écran sur le build de démo `f0c96f1` :
1. Téléphone, Aujourd'hui : tâches, habitudes, calendrier, timer en tête ; les cartes de chiffres après (`ordreAujourdhuiAuTelephone`, `lib/grille.ts`).
2. Téléphone, « Plus » : n'affiche plus les modules déjà en onglet (`MobileNav.tsx`).
3. Téléphone, Tâches : « + » rond à droite du titre ; rangement et recherche sur une rangée (`TasksView.tsx`).
4. Notes : « 18 oct. » au lieu de « 2026-10-18 » (`dateDeLigne`, `NotesView.tsx`).
5. Bureau : toutes les catégories de la barre latérale ouvertes au premier lancement (`Sidebar.tsx`). Un état replié déjà enregistré est gardé.
6. Bureau : « systèmes actifs » retiré du pied de la barre (clé `en.ts` retirée).

**Prouvé** : `tsc`, `i18n:check` verts ; `grille.test.ts`, `onglets.test.ts`, `barre*.test.ts`, `admin.test.ts` verts (assertion de `barre.source.test.ts` passée de 6 à 5 libellés coupés). Suite complète sur `f0c96f1` : 179 fichiers, 2 584 verts, 3 ignorés, 0 échec.
**Pas prouvé** : rien vu dans WKWebView ni sur l'iPhone réel. **Reste** : pousser, puis build groupé Mac + pose iPhone (aucun build lancé, à la demande d'Antonin).

## 2026-10-19 — Accents V8 « Encre & Braise » (accent sobre tiré du logo), sur `chantier/da-sobre`

Demande d'Antonin : accents « vraiment très légers, bien moins visibles qu'avec le bleu d'avant ». Nouveau token `--color-accent` (`#cfa5a7` sombre / `#774e51` clair) et `--color-accent-solid` (`#73474a`) ; classes `*-blue` d'interface → `*-accent` (73 fichiers) ; bouton primaire à l'encre ; dégradé de marque réduit à deux tons d'accent ; halo cramoisi à 4,5 / 2,5 %. `--color-blue` reste (couleur choisie, données). Détail : `DESIGN.md` (tête), `CLAUDE.md` même date, site : `DETTE-SITE.md` § AI.

**Prouvé** : `tsc`, `test:types`, `theme.accent.test.ts` (contrastes AA recalculés, bleu inchangé, aucune classe bleue d'interface), suite complète et `i18n:check` (voir le commit de fusion). Vu à l'écran en mode démo (build labo `857248e`, Chrome sans fenêtre, 1470×923 à 110 % et 390×844), clair et sombre : Aujourd'hui, Tâches, Objectifs, Calendrier, Notes, Réglages. Planches avant/après : `Shale-chantiers/DOC-da-sobre-*.jpg`.
**Pas prouvé** : rien vu dans WKWebView, ni sur l'iPhone. **Reste** : build groupé avec `logo-entree` (aucun build lancé). Les règles `.entree-*` lisent encore `--gradient-brand-*` (rose cendré tant que `logo-entree` ne les a pas remplacées).

## 2026-10-19/20 — Nouvelle marque et animation d'entrée (`chantier/logo-entree`), NON installée

Demande d'Antonin (relayée par la session de coordination) : le logo choisi le 19/10 (S de deux traits blancs, lueur, plaque cramoisie) partout, et **un seul logo du clic sur l'icône jusqu'à l'app**, Mac et iPhone ; animation n° 1 « la lueur s'allume ». Référence : `~/Desktop/Shale-projet/marque/MARQUE.md`. Décisions : `CLAUDE.md` (section du 2026-10-19), `DESIGN.md`, `MOBILE.md` § 21.6, `PIEGES.md` § 49.

**Fait** (worktree `Shale-chantiers/logo-entree`, depuis `mobile-ios` `f49a7ac`) :
1. Icônes : bureau (`npm run tauri icon` sur `src-tauri/icons/source-bureau-1024.png`, plaque arrondie 824/1024), iOS clair = sombre (même fichier) + teintée, barre des menus macOS en image gabarit (`icons/tray-gabarit.png`, `lib.rs`). Outil : `node tools/icones-marque.mjs` (Chrome sans fenêtre), qui remplace `tools/icone-ios.mjs`.
2. Écran de lancement iOS : fond `#070506` dans les deux apparences, halo et icône 96 pt centrés (`LaunchHalo`, `LaunchIcon`). Storyboard compilé seul par `ibtool` : OK. Fenêtre Tauri : `backgroundColor` `#070506`.
3. `index.html` peint la même première image avant le CSS (`#lancement`) ; `Splash` la reprend ; `AuthGate` retire celle d'`index.html`.
4. `ShaleMark.tsx` réécrit (plaque / trait / lueur seule / pro) ; connexion, abonnement, accueil le reprennent sans changement d'appel. Icône Pro dans la fenêtre d'offre Pro et Réglages → compte d'un abonné Pro.
5. Animation : `EntryTransition.tsx` + section CSS réécrites (lueur 600 ms ease-out, maintien 150, sortie 450). Machine : « Courte » joue les trois temps, raccourcis (test mis à jour, daté).

**Vu à l'écran** (Chrome sans fenêtre piloté, mode démo, animations figées temps par temps) : ouverture à froid en sombre et en clair (densité 110 % simulée : l'icône garde 96 px au même pixel, 672 × 402), connexion (l'icône du mur reste, le formulaire s'efface, sortie), téléphone 390 px (icône au centre, 147 × 374). Défaut trouvé et corrigé à l'écran : le halo, plus large qu'un téléphone, était décalé à droite (`margin: auto`).
**Pas vu** : WKWebView, l'app native, le simulateur, l'iPhone ; l'icône dans le Dock et dans la barre des menus ; la fenêtre d'offre Pro et le compte Pro (rendu par le même SVG que la référence, tenu par un test, mais pas regardé) ; le blanc de WKWebView avant le premier paint (MOBILE § 21.5) peut-être devenu nuit grâce à `backgroundColor`.
**Reste** : build natif GROUPÉ avec `da-sobre` (macOS + pose iPhone), une seule fenêtre de trousseau pour Antonin. Après `tauri icon`, toujours `git clean` sur `AppIcon.appiconset/` (§ 49.1). `src-tauri/icons/ios/` garde les PNG « Strates », inutilisés.
