# Audit — profils de licence sur devis (phase 0)

*Écrit le 2026-09-12, en lecture seule : aucun code touché. Répond au cadrage
`PROMPT-LICENCE-PROFILS.md` (dossier « Prompt en attente »). Tout ce qui suit a
été lu dans l'arbre à `cc2bd0b` (branche `mobile-ios`), pas déduit des documents.*

> ## ⛔ Point d'arrêt 1 — trois écarts bloquent la suite
>
> 1. **L'offre « Business » n'existe pas.** Le code et la base ne connaissent
>    que deux offres, `shale` et `shale_trade`. `shale_pro` et `shale_business`
>    n'apparaissent **nulle part** : ni dans l'app, ni dans `shale-site/supabase`,
>    ni dans le webhook Stripe. « Shale Pro » est l'ancien nom de Shale Trade
>    (`STRATEGIE-V3.md`, signalé périmé dans `SHALE.md`). Réserver les profils
>    aux « licences Business », c'est les réserver à une offre qu'il faudrait
>    d'abord créer, et la tarification Stripe est hors périmètre du cadrage.
> 2. **« La facturation réservée à Pro » n'est pas un cas de gating.** La
>    facturation (migration 023) est ouverte à toutes les offres. Le seul
>    gating qui existe est celui des modules **trading**.
> 3. **La démo « restauration » est concernée par la réserve de propriété** que
>    le cadrage pose lui-même (« vérifier avant de construire quoi que ce soit
>    de réutilisable sur ce terrain »). Un profil de démonstration restauration
>    est réutilisable sur ce terrain.
>
> La recommandation qui lève les trois est au § 8.

---

## 1. Droits actuels

### Où le palier est lu, stocké, rafraîchi

| | |
|---|---|
| **Source de vérité** | Postgres chez Supabase, **pas SQLite**. Table `subscriptions` (colonne `tier`, `CHECK (tier in ('shale','shale_trade'))`), maintenue par `functions/stripe-webhook`. L'app lit la **vue** `my_subscription`, qui calcule `status`, `is_active`, `has_trading` et fait expirer l'essai côté serveur |
| **Lecture** | `fetchSubscription()` — `src/lib/auth/supabase.ts:256` |
| **Stockage côté app** | **aucun sur disque.** L'abonnement vit dans un état React de `useAuth` (`useAuth.ts:193`) et se diffuse par le contexte d'`AuthGate`. Sur disque il n'y a que la méta de session (`stockage.ts` : `userId`, `email`, `lastVerifiedAt`, `activated`) et le refresh token au trousseau |
| **Rafraîchissement** | seulement dans `resolve()` : au **démarrage**, à la **connexion/inscription**, et sur **`recheck`** (bouton « Réessayer » du mur ou du bandeau hors ligne). **Aucune relecture périodique** : le renouvellement du jeton toutes les heures (`jetonFrais`) ne relit pas l'abonnement |
| **Dérivation des droits** | `entitlementsOf(sub)` — `src/lib/entitlements.ts`, hook `useEntitlements()`. Rend `{ tier, isTrialing, hasTrading, billingPeriod, trialDaysLeft }`. `has_trading` du serveur fait foi ; recalcul local seulement si la colonne manque |
| **Droit d'entrée** | `hasAccess(sub)` — `src/lib/auth/access.ts`. `STRIPE_ENABLED = true` (`config.ts:93`) : le mur est le paiement (`status` actif ou essai) |
| **Frontière fonctionnelle** | `src/lib/features.ts` : `TRADING_VIEWS`, `TRADING_WIDGETS`, `TRADING_PANELS` |

### Hors ligne

`useAuth.ts:400-436`. Si le serveur ne répond pas (panne réseau, pas refus), et
que la dernière vérification date de moins de **`GRACE_JOURS` = 30** avec
`activated` vrai, l'app s'ouvre en **`offlineGrace`** avec un bandeau.

⚠️ **Écart à connaître pour la phase E.** Dans cet état, `setSubscription(null)`.
Or `entitlementsOf(null)` avec Stripe allumé rend **`tier: "shale"`,
`hasTrading: false`**. Autrement dit : **un abonné Shale Trade qui démarre hors
ligne perd ses modules trading** pendant toute la durée de la coupure. Le palier
n'est mémorisé nulle part. Le scénario de test « passage hors ligne pendant la
validité » du cadrage ne peut donc pas se tenir tel quel. Il demande de mettre
le palier en cache, ce qui touche au mur d'entrée, du code sensible.

### À l'expiration

- **Essai** : la vue renvoie `expired` à la lecture suivante. Sur une app déjà
  ouverte, rien ne se passe avant le prochain démarrage ou `recheck`.
- **Abonnement résilié / impayé** : même chose, le statut change côté serveur et
  n'est constaté qu'au prochain `resolve()`.
- **Bascule d'offre en cours de session** : `App.tsx:233` renvoie sur
  « Aujourd'hui » si la vue courante devient verrouillée.

## 2. Gating existant

**Le mécanisme est centralisé pour la frontière, dispersé pour l'application.**
Une seule question (`hasTrading`) et une seule liste (`features.ts`), mais onze
fichiers qui l'appliquent chacun à sa surface :

| Fichier | Ce qui est gaté |
|---|---|
| `src/App.tsx:190-234` | **la garde de navigation** : `navigate()` ouvre le paywall au lieu de la vue ; filet de repli sur `today` ; badges de la barre |
| `src/components/Sidebar.tsx:318` | module grisé + cadenas + bulle « Inclus dans Shale Trade » (jamais `disabled`) |
| `src/components/MobileNav.tsx:74` | même règle sur téléphone |
| `src/components/CommandPalette.tsx` → `src/lib/actions.ts:325` | actions `requires: "trading"` retirées de ⌘K |
| `src/components/UpgradeModal.tsx` | le paywall |
| `src/views/TodayView.tsx:217` | widget `position` |
| `src/components/PerfStrip.tsx:133` | tuile « trading 7 j » |
| `src/views/PerformanceView.tsx:451` | panneau `perf-trading` |
| `src/views/FinanceView.tsx:303` | panneau `finance-trading` (Trading → €) |
| `src/views/SettingsView.tsx:447, 782, 878, 972` | sections market-brain, tracker, et l'argumentaire |
| `src/lib/notifications.ts:246` → `src/lib/market/rappels.ts:118` | rappel de briefing de marché |

Deux gatings **d'une autre nature**, à ne pas confondre avec le palier :
`isAdmin` (liste d'e-mails en dur, `config.ts:74`, pour la Console) et le
**masquage choisi par l'utilisateur** dans Personnaliser (§ 3).

⚠️ Les panneaux gatés sont **retirés du rendu**, pas masqués : un panneau caché
réapparaîtrait dans les chips « + titre » sous la grille. Toute restriction
venant d'un profil devra suivre la même règle.

## 3. Registre des modules

**Statique pour la définition, déjà dérivé de données pour l'affichage.** C'est
le point le plus important de l'audit : **un mécanisme de surcharge existe déjà.**

| Quoi | Où | Nature |
|---|---|---|
| Identifiants, libellés, icônes | `ITEMS` — `src/components/Sidebar.tsx` (13 modules), `ITEMS_PIED` (Console, Personnaliser, Réglages) | statique, fait foi sur le compte |
| Catégories | `CATEGORIES` / `CATEGORY_OF` — `Sidebar.tsx:276-302` | **statique, non configurable** |
| Descriptions (bulles) | `DESCRIPTIONS` — `Sidebar.tsx` | statique |
| **Ordre, visibilité, libellé par module** | **`UiConfig.modules`** — `src/lib/uiConfig.ts`, clé `settings` `ui.config`, édité dans **Personnaliser** (`AdminView.tsx`) | **donnée**, lue par `Sidebar` (l. 491-564) et `MobileNav` (l. 120-156) |
| Titre et sous-titre de marque | `UiConfig.brandTitle` / `brandSubtitle` | donnée |
| Widgets du tableau de bord | `UiConfig.dashTop/Left/Right` | donnée |
| Textes commerciaux (accueil, login, mur) | `src/lib/appTexts.ts`, **localStorage** `shale.app.texts` | donnée |

Conséquences pour les phases B et C :

- **Un profil n'a pas besoin d'inventer un moteur de visibilité ni d'ordre** : il
  doit **contraindre** `UiConfig.modules` au rendu, comme `mergeList` le fait
  déjà pour les modules inconnus.
- ⚠️ **Il y a un conflit à trancher : le profil contre l'utilisateur.** Aujourd'hui
  l'utilisateur masque, réordonne et renomme ses modules lui-même. Si un profil
  masque un module, Personnaliser ne doit plus pouvoir le réafficher ; s'il
  impose un ordre, l'ordre de l'utilisateur est-il ignoré ou appliqué dedans ?
- ⚠️ **Le cadrage demande « la catégorie issue du résolveur »** (phase C) mais le
  payload n'a **aucun champ de catégorie**. Les catégories sont statiques.
- ⚠️ **Masquer n'est pas interdire** : un module masqué dans Personnaliser reste
  atteignable par ⌘K (`actions.ts` ne filtre que le trading) et par une
  mention `@`. C'est cohérent avec « modifie ce que l'utilisateur voit », mais
  il faut le décider, pas le découvrir.
- « Aujourd'hui » n'est **pas masquable** (règle de Personnaliser), et Réglages
  n'est pas un module.

## 4. i18n

⚠️ **Écart avec le cadrage : l'i18n ne passe pas « par `Intl` uniquement ».**

- **Mécanique** : `t(fr, vars?)` — `src/lib/i18n/index.ts:112`. **La clé est la
  phrase française** ; le dictionnaire anglais est l'objet statique `EN` de
  `src/lib/i18n/en.ts` (~1 800 entrées), importé à la compilation. En français,
  `t()` rend la clé (moins le discriminant `|contexte`). Il y a aussi `tp()`
  (pluriel) et `pick(fr, en)`.
- **`Intl` ne sert qu'aux formats** (`formatDate`, `formatTime`, `formatHeure`,
  `localeTag`).
- **Point d'injection runtime pour surcharger un libellé : il n'en existe pas
  dans `t()`.** `EN` est une constante de module, la langue est lue une fois.
  Les seules surcharges runtime existantes sont **`UiConfig.modules[].label`**
  (une chaîne brute, monolingue, par module) et **`appTexts`** (quatre textes).
- Le « catalogue » contre lequel valider une clé serait `Object.keys(EN)`.
  ⚠️ Mais **une clé française n'a pas besoin d'être dans `EN` pour être
  légitime** : les 57 mots identiques dans les deux langues (« Date », « Setup »…)
  n'y sont pas, et des clés dynamiques (`t(cat + "|palette")`) échappent à tout
  scan. « Clé existante » est donc plus difficile à définir que le cadrage ne
  le suppose.

Pièges qui contraindront la phase C, tous dans `PIEGES.md` et `CLAUDE.md` :

1. **jamais de `t()` dans une constante de module**, figée dans la langue de
   départ ;
2. **un libellé client est-il monolingue ?** « Réservations » pour « Tâches » en
   français : que voit l'app basculée en anglais ? Le payload n'a pas de langue ;
3. **le profil arriverait APRÈS le premier rendu** (lecture SQLite ou réseau).
   Changer un libellé ensuite demande le même remontage que `LangRoot`
   (`main.tsx`), sinon les valeurs mémorisées gardent l'ancien libellé ;
4. **`i18n:check` et `i18n:durs` au vert ne prouvent rien ici** : la preuve est
   l'app basculée en anglais, profil appliqué.

## 5. Synchronisation — `src/lib/sync/scope.ts`

Contenu intégral lu (191 lignes). Trois listes :

- **`TABLES_SYNC`** : **32 tables**, dans l'ordre parents → enfants, de
  `settings` à `object_links`. Toute l'app se synchronise.
- **`TABLES_HORS_SYNC`**, chaque exclusion avec son motif :
  `notes_fts` (+ 4 tables internes FTS5, index dérivé), `benchmark_results`
  (table supprimée, documentaire), `goal_progress_log` (réécrit à chaque
  lancement), `market_briefings` (régénérables, purgés à 7 j),
  `finance_quotes_cache` et `finance_fx_cache` (données publiques
  reconstructibles), `sync_outbox` / `sync_state` / `sync_meta` (plomberie),
  `_sqlx_migrations`, `sqlite_sequence`.
- **`SETTINGS_EXCLUS`** : `layout.`, `hidden.`, `sidebar.collapsed`,
  **`ui.config`**, `screen_min_`, les deux clés LLM, `knowledge.last_viewed_at`,
  `sync.`, `backup.` — plus un filtre qui refuse toute clé ressemblant à un
  secret.

Deux faits qui pèsent sur l'arbitrage de la phase A :

- ⭐ **Le garde-fou existe déjà.** Un test échoue si une table de la base n'est
  ni dans `TABLES_SYNC` ni dans `TABLES_HORS_SYNC`. Une table `license_profile`
  ne peut donc **pas** disparaître en silence de la sauvegarde. Elle **doit**
  être classée, et le test force la décision.
- ⚠️ **`ui.config` est déjà hors synchronisation**, parce qu'il décrit la
  machine. L'ordre et les libellés choisis dans Personnaliser ne suivent donc
  pas d'un appareil à l'autre. Un profil rangé hors sync et rafraîchi depuis le
  serveur serait **cohérent** avec ce précédent.

La recommandation du cadrage (hors scope, rafraîchi du serveur, cache local) est
**confirmée par le code**. Précision : l'aveuglement de la sync ne protégerait
de toute façon pas un droit commercial, puisque l'utilisateur détient la clé.
Seule une **signature vérifiée à chaque lecture** empêche de figer ou de forger
un profil, où qu'il soit rangé.

## 6. Mode démo

- **Bascule** : `isTauri` (`src/lib/repo.ts:65`). Faux en navigateur, alors
  chaque accès de `repo.ts` délègue à `src/lib/demo.ts`, jeu de données **en
  mémoire**, construit à l'import du module (d'où le rechargement de fenêtre au
  changement de langue).
- **Contrat** : même API des deux côtés, **et même sémantique** (`PIEGES.md`
  § 6.2 et `CLAUDE.md` : `updateTask` démo trop indulgent avait masqué une
  perte de date en natif).
- **Abonnement simulé** : `demoTier()` / `setDemoTier()` (`useAuth.ts:132-177`),
  localStorage `shale.demo.tier` (`shale` · `shale_trade` · `trialing`), et
  sélecteur « offre simulée » dans Réglages → compte. **Visible seulement si
  `AUTH_CONFIGURED` est faux.**
- ⚠️ **L'auth réelle est configurée** : pour auditer en démo il faut le patch
  local à ne jamais committer (`PASSATION.md` § 5.3 : `SUPABASE_URL = ""` et la
  garde de `useAuth.ts`), puis `npx vite`. Les numéros de ligne du patch ont
  bougé depuis le 2026-08-28 : relire avant d'appliquer.
- Un profil de démo s'activerait naturellement comme l'offre simulée : un
  sélecteur « profil simulé » à côté, lu au montage de `useAuth`.

## 7. Autres écarts entre le cadrage et le dépôt

| Le cadrage dit | Le dépôt dit |
|---|---|
| « Le worktree Windows a dérivé de 16 fichiers non commités » | ce worktree **n'existe plus** (`~/Desktop/Shale-Windows` absent). La branche a été réconciliée sur le tronc le 2026-08-26. Le seul autre worktree vivant est `~/Desktop/Shale-chantiers/apercu` (`grille-semaine-design`) |
| `resolveEntitlements()` | le point d'entrée existe déjà sous le nom **`entitlementsOf()`** / `useEntitlements()`. L'étendre vaut mieux qu'en créer un second |
| « Toute personnalisation passe par des données » | c'est déjà vrai pour ordre, visibilité, libellés et marque (`UiConfig`), mais **au niveau de l'utilisateur**, pas du serveur |
| Signature du profil | **aucune primitive de vérification de signature** dans l'app. `crypto.subtle` est disponible partout, iOS compris (`CLAUDE.md`, 2026-08-27) : **ECDSA P-256** se vérifie sans dépendance. Aucune table ni fonction de profil côté Supabase. ⚠️ Le SQL se joue dans Supabase Studio par Antonin, et la clé privée de signature serait un secret d'Edge Function posé par lui |
| `SHALE.md` à vérifier contre `MOBILE.md` | écart confirmé et **plus grand que prévu** : `SHALE.md` (parent) est daté du **2026-08-11**, `MOBILE.md` du **2026-09-12**. `SHALE.md` dit encore « douze modules » (13 depuis le 02/09) et « `STRIPE_ENABLED = false` » (vrai depuis le 31/08) |
| Pipeline : TS, build, tests, `cargo check` | ligne de base réelle un peu plus longue : aussi `npm run test:types` (distinct de `tsc`) et `npm run i18n:check` / `i18n:durs` (`PASSATION.md` § 1). ⚠️ Suites PGlite sensibles à la charge machine (`PIEGES.md` § 9.11) |
| Phase F : « les cinq fichiers datés du protocole » | aucun document n'appelle ainsi un protocole. Lecture retenue : la table d'aiguillage de `DOCUMENTATION.md` — section datée de `CLAUDE.md`, `PIEGES.md`, `PASSATION-LICENCE-PROFILS.md`, `PASSATION.md`, `DETTE-SITE.md` |

## 8. Recommandation — ce qui permet de reprendre

1. **Découpler le profil du nom d'offre.** Le client n'a pas besoin de savoir ce
   qu'est une licence Business. Il vérifie une signature et applique le profil
   **par-dessus** `entitlementsOf()`. La règle « réservé à Business » vit **au
   seul endroit qui délivre** : le serveur ne signe un profil que pour un compte
   éligible. Créer l'offre `shale_business` (Stripe, `CHECK` Postgres, site)
   devient un chantier commercial séparé, qui ne bloque pas celui-ci.
2. **Étendre `UiConfig` au lieu de le doubler** : le profil **borne** ce que
   Personnaliser peut afficher (modules masqués retirés de la liste, ordre du
   profil prioritaire), et **remplace** les libellés de module. Recommandation
   sur le conflit du § 3 : **le profil gagne sur la visibilité, l'utilisateur
   garde la main dans ce qui reste.**
3. **Libellés** : restreindre la première version aux **libellés de modules et
   au titre de marque**, qui ont déjà un point d'injection. Une surcharge
   générale de `t()` touche toute l'app et pose la question de la langue. À
   décider, pas à glisser dedans.
4. **Stockage** : **hors synchronisation**, classé dans `TABLES_HORS_SYNC` avec
   son motif, signature ECDSA P-256 vérifiée **à chaque lecture**, dégradation
   silencieuse vers le palier nu.
5. **Hors ligne** : mettre le **palier** en cache avec la méta de session
   (`stockage.ts`), sinon le scénario E « hors ligne pendant la validité » est
   faux dès le départ (§ 1). Même discipline que `activated` : l'écart d'un cache
   ne peut que restreindre, jamais ouvrir.
6. **Démo** : remplacer la verticale restauration par une **verticale neutre**
   (par exemple un cabinet de conseil) tant que la réserve de propriété n'est pas
   levée.

**Décisions qui reviennent à Antonin** : (a) valider le découplage du point 1 ;
(b) la verticale de démonstration ; (c) monolingue ou bilingue pour les
libellés client. Le reste suit la recommandation.
