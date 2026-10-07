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
| **Objectifs** | ⭐ **refondu le 2026-09-16** : un objectif se découpe en jalons ordonnés, puis en sous-objectifs ; le pourcentage se **déduit**, il ne se saisit plus. ⭐ **Depuis le 2026-09-29** : la vue est en **maître-détail** — la liste (chaque objectif avec sa **prochaine action**) et la fiche de celui qu'on choisit (une phrase d'origine, la feuille de route, une icône par niveau) ; sur iPhone, la liste OU la fiche. Sa carte mentale est ÉDITABLE — ajouter (typé), renommer, cocher, supprimer depuis la carte, la feuille de route suit. ⭐ **Depuis le 2026-09-30** : une **priorité** (faible, moyenne, élevée) sur les étapes comme sur les tâches — à la création, au clic droit, dans « Modifier… » ; le repli « Avancé / Poids » et les phrases d'aide de la feuille de route sont partis (bulles au survol de deux secondes) | migrations 026 et 030. Voir § 11 (2026-09-16), § 11.z (2026-09-29) et § 11.p (2026-09-30) |
| **Performance** | métriques personnalisées, habitudes, séries, graphiques (recharts) | |
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
| Ce qui reste | Le retour d'Antonin après essai. Tout défaut se corrige sur `mobile-ios` (le worktree `Shale-chantiers/timer` est gardé pour ça) |

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
| **L'iPhone réel** | profil expiré le 2026-09-03 (§ 10) | rebrancher le téléphone ; ou le compte Apple Developer, qui règle les deux |
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
