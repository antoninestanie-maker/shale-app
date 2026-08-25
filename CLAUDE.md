# Shale — contexte projet

**Fork commercial de Second Brain** (déclinaison vendue). App de productivité + trading.
**Desktop macOS : Tauri v2 (Rust) + React 19 + TypeScript + Tailwind v4 + Vite 7.**
Specs : `SPEC.md` (V1) et `SPEC-V2.md` (V2 Jarvis, phases A→F faites, G "polish"
restante).

## Ce qu'est Shale, en un écran

Une app de bureau **hors-ligne d'abord** : toutes les données vivent dans **un
seul fichier SQLite** sur la machine (`~/Library/Application Support/com.atnfx.shale/shale.db`,
17 migrations). Rien n'est indispensable au réseau sauf le briefing de marché et
la synchronisation. Elle ne se connecte à **aucun broker** : elle ne lit ni ne
passe d'ordres.

### Les douze modules, dans l'ordre de la barre latérale

`Sidebar.tsx` (`ITEMS`, `CATEGORIES`) fait foi pour les noms et l'ordre.
« Aujourd'hui » est hors catégorie — c'est l'accueil. **Réglages est un
treizième item de la barre, mais PAS un module** : c'est pour ça que le compte
tombe sur douze et non treize, et c'est l'erreur qu'on refait à chaque fois.

| # | Module | Catégorie | Ce qu'il fait réellement |
|---|---|---|---|
| 1 | **Aujourd'hui** | — | Tableau de bord. N'a pas de données propres : il rassemble ce que les onze autres produisent (discipline du jour, énergie, tâches, objectifs, session de marché ouverte). Cartes déplaçables, redimensionnables, masquables — on le réarrange, on ne le construit pas. |
| 2 | **Tâches** | Productivité | Trois priorités, étiquettes libres, récurrences (quotidienne · hebdomadaire · jours de marché). Une case cochée fait monter l'anneau de discipline et part horodatée dans le Journal. **L'un des rares endroits de saisie** : le reste de l'app s'en nourrit. |
| 3 | **Timer** | Productivité | Trois presets + durée sur mesure de 1 à 240 min, mémorisée. Une session peut être liée à une tâche ; le temps remonte dans Performance. Mode plein écran. Pas de son. |
| 4 | **Objectifs** | Productivité | Objectifs décomposés en sous-objectifs ; l'avancement se lit sur ce qui est **fait**, pas sur ce qu'on déclare. Catégories inventées par l'utilisateur, horizons court · moyen · long terme. |
| 5 | **Performance** | Productivité | **Ne trace PAS le P&L.** Complétion des tâches, temps de focus tenu, avancement des objectifs — jour, semaine ou mois. Elle juge le comportement, pas la chance. |
| 6 | **Benchmark** | Productivité | Trois tests : réaction, mémoire visuelle, séquence. Compare la mesure du jour à **ta propre moyenne** ; au-delà de 20 % plus lent, bandeau rouge sur le tableau de bord avant la séance. Aucun classement entre joueurs. |
| 7 | **Notes** | Productivité | Texte riche + index plein texte **local** (FTS SQLite) : on retrouve un post-mortem de huit mois dans l'avion, sans réseau. Les couleurs du texte suivent le thème. |
| 8 | **Journal** | Productivité | Humeur, énergie, réflexion — et dessous, ce que les autres modules ont écrit tout seuls (tâches cochées, calculs, trades dénoués, sessions). Habitudes sur **12 semaines glissantes**, séries incluses. |
| 9 | **Savoir** | Productivité | Base de connaissances par thèmes. Une fiche accepte texte, images collées/glissées, liens et **croquis vectoriels** dessinés dans l'app (donc modifiables plus tard). Images recompressées à l'import (1 Mo → ~12 ko). |
| 10 | **Trading** | Trading | Journal de positions. Une position envoyée depuis le calculateur arrive avec heure d'entrée et R:R théorique ; dénouement en un clic, **sorties partielles pondérées automatiquement**. Profit factor, drawdown max, stats par session. **Tout est mesuré en R.** |
| 11 | **Market-Brain** | Trading | Prix, volatilité, dollar, taux, calendrier économique, news, dérivés crypto — ramassés **sans aucune clé d'API**. La synthèse est rédigée par le LLM de l'utilisateur (Gemini ou Groq, sa clé). Sort un biais et une conviction par instrument, les niveaux, les créneaux à éviter. Deux briefings : **8 h pré-Londres, 14 h pré-New York (Paris)**. |
| 12 | **Position** | Trading | Calculateur de taille. La distance au stop vient **des prix saisis**, pas d'un comptage de pips — c'est ce qui supprime l'erreur de virgule à 3 h du matin. Spread en case à cocher, take-profit optionnel → R:R et gain potentiel. « Trader cette position » alimente le module Trading. FX, métaux, indices, crypto. |

⚠️ **Le nombre « douze » est écrit en toutes lettres à une dizaine d'endroits**,
dans l'app comme dans le site. Avant de conclure quoi que ce soit sur un ajout
ou un retrait de module : `grep -rn "douze\|SUR 12\|12 modules" src`.

### Ce que l'app promet, et qui doit rester vrai

Ces lignes sont le miroir de `SPECS` dans `shale-site/vitrine/src/lib/modules.ts`.
Toute évolution de l'app qui les contredit doit être répercutée là-bas **le jour
même** — c'est la règle « l'app et le site ne divergent jamais ».

- **Plateformes** — macOS 14+ Apple Silicon aujourd'hui ; Intel, Windows et web
  mobile ensuite. (Le worktree `~/Desktop/Shale-Windows`, branche
  `windows-build`, porte le portage Windows.)
- **Stockage** — un fichier SQLite local, ouvrable, sauvegardable, exportable.
- **Synchronisation** — chiffrée de bout en bout, la clé se déduit du mot de
  passe et ne quitte pas les appareils. Se coupe appareil par appareil.
- **Hors ligne** — total, sauf le briefing de marché.
- **Connexion broker** — aucune, jamais.
- **Clés d'API** — aucune pour le calculateur et les données de marché ; une clé
  LLM (celle de l'utilisateur) uniquement pour rédiger le briefing.
- **Sauvegarde** — compatible Time Machine, export manuel complet.
- **Raccourcis** — `⌘K` la palette de commandes, `⌘⇧N` une note.
  ⚠️ Il n'y a **plus** de raccourci `⌘1`…`⌘9` par module : le champ `key` a
  disparu de `modules.ts`. Les consignes qui le mentionnent sont périmées.
- **Langue** — français et anglais, suit macOS par défaut.
- **Licence** — `SPECS` annonce encore 12 €/mois · 96 €/an (Shale) et 19 €/mois ·
  180 €/an (Shale Trade) avec essai 7 jours. ⚠️ **Écart assumé** : le produit est
  aujourd'hui gratuit et fermé par activation manuelle. Voir « L'accès se donne
  compte par compte » en fin de fichier.

### Où vit quoi

| | |
|---|---|
| Vues des modules | `src/views/*View.tsx` |
| Barre latérale (noms, ordre, catégories) | `src/components/Sidebar.tsx` |
| Accès à SQLite | `src/lib/repo.ts` (+ `isTauri`) |
| Migrations de la base | `src-tauri/migrations/` (17) |
| Authentification | `src/lib/auth/` — `config.ts`, `access.ts`, `useAuth.ts`, `supabase.ts`, `stockage.ts` |
| Mur d'entrée (UI) | `src/components/auth/AuthGate.tsx`, `LoginScreen.tsx` |
| Synchronisation chiffrée | `src/lib/sync/` — `engine.ts` (cycle), `outbox.ts` (file), `crypto.ts`/`keys.ts` (clés), `transport.ts` (réseau) |
| Traductions | `src/lib/i18n/` — la CLÉ est la phrase française |
| Commandes natives (trousseau…) | `src-tauri/src/` — `secrets.rs` notamment |

**Le dossier EST un dépôt git** — `shale-app.git`. ⚠️ La branche de travail est
`domaine-shaleapp`, **pas `main`** (qui existe mais dort loin derrière), et
`~/Desktop/Shale-Windows` est un **worktree du même dépôt** sur `windows-build`.

## Couche commerciale (fork Shale, 2026-07-25)
- **Rebranding** : productName/identifier `com.atnfx.shale`, DB `shale.db`, lib Rust
  `shale_lib`, brandTitle "Shale / trading os", BootScreen "SHALE".
- **Auth gate** (`src/lib/auth/` + `src/components/auth/`) : `AuthGate` enveloppe `<App>`
  dans `main.tsx`. Écran login (email/mdp, rester connecté, mot de passe oublié) →
  vérif abonnement Supabase → app, sinon écran "Abonnement requis". Client Supabase REST
  via `fetch` (`supabase.ts`), session en localStorage (`useAuth.ts`), déconnexion dans
  Réglages (section "compte", via `useSession()`). **Mode démo** si `config.ts` non
  renseigné (`AUTH_CONFIGURED` faux) : n'importe quel identifiant entre — pour dev UI.
- **Onboarding** premier lancement (`Onboarding.tsx`, flag localStorage `shale.onboarded`),
  monté dans `App.tsx`.
- **Site + backend** : dossier séparé `~/Desktop/shale-site/compte/` (site statique commercial +
  schéma Supabase + edge functions Stripe checkout/webhook). Voir son `README.md` pour le
  branchement complet (Supabase + Stripe). La table `subscriptions` (statut d'abonnement,
  maintenue par le webhook Stripe) est ce que l'app interroge pour déverrouiller.
- **À faire pour vendre** : ~~renseigner `src/lib/auth/config.ts`~~ (fait le
  2026-08-10), ~~déployer le site~~ (fait le 2026-08-10 :
  **<https://shale-six.vercel.app>**, espace compte sous `/compte/`), rebrancher
  Stripe (`STRIPE_ENABLED`, cf. fin de fichier), **notariser l'app** (voir plus
  bas), remplacer l'icône (`npm run tauri icon <png>`), rebuild natif.
- Données **écrites en local** (SQLite) et utilisables hors ligne. ⚠️ Elles ne
  restent plus *seulement* là : depuis la synchronisation (2026-08-10), une copie
  **chiffrée de bout en bout** part vers `sync_rows` dès qu'un compte est
  connecté. Le backend ne peut pas les lire — il en stocke quand même. La phrase
  « toujours 100 % locales » qui vivait ici est fausse depuis ce jour-là, et le
  site la répétait à cinq endroits, politique de confidentialité comprise.

## Commandes
- `npx tsc --noEmit` — typecheck
- `npx vite build` — build front (`npm run build` = tsc + vite build)
- `npm run tauri dev` / `npm run tauri build` — app native
- `cargo check --lib --tests --bins` dans `src-tauri/` — check Rust (⚠️ PAS
  `--all-targets` : `examples/transcribe.rs` importe `whisper_rs`/`hound`, retirés des
  dépendances — dette connue, cf. section Notifications)
- `cargo test --lib` dans `src-tauri/` — 79 tests (moteur de notifications)
- `npm test` — tests TypeScript (vitest). `npm run test:watch` en continu.
- `npm run test:types` — typecheck des TESTS (séparé de l'app, cf. section sync)
- Preview navigateur (`npx vite`) = **mode démo** : `isTauri` (src/lib/repo.ts:28) est faux → données factices en mémoire (`src/lib/demo.ts`, `src/lib/market/demo.ts`), pas de SQLite ni de réseau natif.

**⚠️ Règle : après chaque modification majeure, réinstaller l'application.**
Antonin utilise l'app installée (bundle .app), pas le mode dev : toute modification
significative (code front ou Rust, et obligatoirement `capabilities/*.json`,
`tauri.conf.json` ou une migration SQL) doit se conclure par un
`npm run tauri build` puis la réinstallation du bundle généré
(`src-tauri/target/release/bundle/macos/`) pour être visible dans l'app réelle.

## Règle : l'app et le site ne divergent jamais

**Toute modification de l'app se termine par la mise à jour du site
(`~/Desktop/shale-site`), et réciproquement.** Le site ne décrit pas l'app de
loin : il la *montre* — sa barre latérale, ses douze modules, son design. Un
onglet renommé ici et pas là-bas, c'est un visiteur qui télécharge autre chose
que ce qu'il a vu, et une promesse commerciale que l'app ne tient pas. Ça vaut
pour le **fond** (ce que fait un module) comme pour la **forme** (couleurs,
typographie, icônes, disposition).

Rien n'est partagé entre les deux dépôts : le site recopie l'app à la main.

| Ce qui bouge ici | Ce qu'il faut mettre à jour dans `shale-site/vitrine/src/` |
|---|---|
| `src/components/Sidebar.tsx` — `ITEMS` / `CATEGORIES` : ajout, retrait, **renommage**, changement de catégorie ou d'ordre | `components/Demo.astro` → `NAV` — **la démo jouable** de la section `#essayer`, celle qui reproduit la barre latérale (+ `ICONS` pour une icône nouvelle) ; `lib/modules.ts` → `MODULES`, même ordre |
| Une vue de `src/views/` ajoutée ou supprimée | tout ce qui précède **plus** le compte de modules, écrit en toutes lettres à une dizaine d'endroits (« douze modules » dans `content.json` et `lib/i18n/en.ts`, « APERÇU · 3 MODULES SUR 12 » dans `Demo.astro`) |
| Ce que fait un module (écran, KPI, contenu) | la fiche du module dans `lib/modules.ts` : `desc`, `widget`, `specLabel`/`specValue`. Sa règle de vérité est écrite en tête du fichier — rien n'y figure qui n'existe dans l'app |
| Un raccourci clavier | le `key: "⌘1"…` du module **et** la ligne « Raccourcis clavier » de `SPECS` (`lib/modules.ts`) |
| `DESIGN.md` / `src/index.css` — couleurs, typo, rayons, physique du mouvement | `styles/global.css` — **un seul fichier** depuis la fusion du site (2026-08-11) ; `styles/compte.css` ne porte plus que les formulaires de compte, aucun token |
| Plateformes, stockage, hors-ligne, clés d'API, sauvegarde, langue, licence, gating | `SPECS` dans `lib/modules.ts` et `content.json` (`features`, `faq`) |

Le sens inverse tient aussi : **une promesse ajoutée au site doit exister dans
l'app avant d'être publiée** — le site n'est pas un cahier des charges. Et toute
chaîne française nouvelle côté site a besoin de sa traduction dans
`lib/i18n/en.ts`, sinon la page anglaise retombe en français sans le dire.

Aucun outil ne vérifie cette ressemblance (`npm run check` du site regarde le
SEO, l'accessibilité et une liste de valeurs périmées, pas la fidélité à l'app) :
le seul garde-fou est cette table. Sa jumelle est dans
`~/Desktop/shale-site/CLAUDE.md`, et les deux doivent rester alignées.

## Architecture générale
- `src/App.tsx` — routing par état `view`, monte `useFocus` + `useMarketBrain` au niveau App.
- `src/lib/repo.ts` — accès données : SQLite (tauri-plugin-sql) en natif, `demo.ts` sinon. Réglages = table `settings` clé/valeur (`getSetting`/`setSetting`).
- `src-tauri/migrations/001→017` — migrations SQL enregistrées dans `src-tauri/src/lib.rs`.
  DB : **`~/Library/Application Support/com.atnfx.shale/shale.db`** (l'ancien chemin
  `com.atnfx.secondbrain/second-brain.db` écrit ici était un reliquat de Second Brain,
  faux depuis le rebranding — c'est la base de l'AUTRE app).
- `src-tauri/capabilities/default.json` — **allowlist des domaines HTTP** (tauri-plugin-http). Tout nouveau domaine fetché doit y être ajouté, puis app rebuildée.
- ~~Vocal Jarvis~~ : **inexistant dans Shale** (le fork n'a jamais embarqué `voice.rs` ni `whisper-rs` ; cette ligne, héritée de Second Brain, était fausse). Vérifié le 2026-07-26 : 0 occurrence de jarvis/whisper/voice, front comme Rust.
- **15 vues** (`src/views/`) : Today, Tasks, Timer(Pomodoro), Goals, Performance, Benchmark,
  Notes(FTS5), Journal, **Knowledge(Savoir)**, Trading(journal de trades en R),
  **MarketBrain**, Sizing(calculateur de position), Settings, **Admin(Personnaliser)**,
  **Console(mode admin)**.

## Market Brain (`src/lib/market/` + `src/views/MarketBrainView.tsx`)
Agent IA qui génère 2×/jour (8h pré-Londres, 14h pré-NY, heure de Paris) un briefing
cross-asset (EUR/USD, GBP/USD, XAU/USD, NAS100, BTC/USD) : biais/conviction/scénario/
niveaux par instrument + landmines (no-trade) depuis le calendrier éco.

Pipeline : `useMarketBrain.ts` (scheduler 5 min, badge sidebar, rattrapage au lancement)
→ `agent.ts` (orchestrateur) → `payload.ts` (assemble les données) → `llm.ts` (Gemini
ou Groq, JSON validé) → `memory.ts` (table `market_briefings`, 1 ligne par session+jour,
purge 7 j, biais de la veille réinjecté dans le prompt).

Sources de données (toutes keyless, via tauri-plugin-http) :
- Prix/OHLC : API chart Yahoo `query1.finance.yahoo.com` (D1/H1/M15) → `prices.ts` + `indicators.ts` (SMA/RSI/ATR maison). Macro : DXY=`DX-Y.NYB`, US2Y=`2YY=F` (anticipations Fed), 10Y=`^TNX` (÷10 si >20), VIX=`^VIX`, S&P futures=`ES=F` (ton risque overnight). NAS100 = `NQ=F` (futures ~24h, PAS `^NDX` cash qui est figé hors séance US).
- Technique par instrument : tendances D1/H4/M15, RSI H1, ATR M15 + ATR D1, pivots classiques P/R1/S1 (bougie veille), `adr_used_pct` (% du range quotidien moyen 14 j déjà consommé — >85 % = extension improbable), veille H/B, range de nuit, S/R 10 j.
- Calendrier éco : ForexFactory JSON `nfs.faireconomy.media/ff_calendar_thisweek.json` (USD/EUR/GBP, impact high/medium) → `calendar.ts`.
- News RSS : InvestingLive (ex-ForexLive), FXStreet, CoinDesk → `news.ts` (DOMParser, tagging par mots-clés).
- Dérivés & sentiment BTC : Binance futures `fapi.binance.com` (funding + open interest + ratio long/short top traders) et Fear & Greed `api.alternative.me` → `crypto-derivs.ts` (lectures contrariennes, non bloquantes).
- Thème du jour déterministe (DXY×10Y×VIX×ES : dollar fort/faible, aversion/appétit pour le risque) : `correlations.ts`, injecté dans le payload.

LLM : clés dans settings `market.gemini_key` / `market.groq_key` / `market.llm_provider`
(auto|gemini|groq), configurables dans Réglages → market-brain. Modèles :
**`gemini-2.5-flash`** (⚠️ 2.0-flash retiré par Google le 2026-06-01) et
`llama-3.3-70b-versatile` (Groq). En mode auto : Gemini d'abord, bascule Groq sur
429/402/404/500/503 (`isSwitchable` dans llm.ts). Prompt système FR : `prompt.ts`.
Mode "flash" : lecture intra-séance ponctuelle, non persistée (`generateFlash`).

Garde-fous :
- Si tous les fetchers échouent, `payload.ts` retombe sur la démo (`_demo:true`) ;
  `agent.ts::assertRealData` refuse alors d'appeler le LLM et de stocker (erreur claire).
- `_errors[]` du payload = fetchers en échec, affichés en bandeau rouge dans la vue.
- Tout ce qui est "jour" côté Market Brain est en **Europe/Paris** (`parisDay` dans memory.ts), pas UTC.

## Corrections du 2026-07-11 (checkup)
1. **Panne majeure** : `gemini-2.0-flash` retiré par Google le 01/06/2026 → 404 sur
   chaque briefing. Migré vers `gemini-2.5-flash` + fallback Groq élargi (404/500/503
   en plus de 429/402). `src/lib/market/llm.ts`.
2. ForexLive → redirection 301 vers `investinglive.com` (rebranding) : URL du feed
   mise à jour (`news.ts`) + domaines ajoutés à l'allowlist (`capabilities/default.json`).
   **Nécessite un rebuild de l'app native.**
3. Boucle de régénération démo : closure périmée sur `briefing` dans le scheduler de
   `useMarketBrain.ts` → régénérait la démo toutes les 5 min. Corrigé via `briefingRef`.
4. `agent.ts` : n'analyse plus (ni ne stocke) des données démo quand le réseau est mort
   en natif (`assertRealData`).
5. `MarketBrainView.tsx` : filtre "calendrier aujourd'hui" utilisait le jour UTC au lieu
   du jour Paris (décalage la nuit) ; + bandeau d'avertissement si données brutes en
   fallback démo en natif.
6. `llm.ts::validate` : garde contre une entrée `instruments[]` nulle renvoyée par le LLM.
7. Le scheduler catch désormais ses erreurs (plus d'unhandled rejection dans l'intervalle).
8. **Rate limit Groq (429 TPM)** : le payload complet (~6k tokens) explosait la limite
   12k tokens/min dès 2 générations rapprochées. Le LLM reçoit désormais une version
   compacte (`prompt.ts::compactForLlm` : sans liens/ids/ticker, calendrier limité à
   aujourd'hui+demain, 15 news max) ; le payload complet reste stocké/affiché.
   + retry automatique unique après le délai annoncé par un 429 court (`llm.ts::retryAfterMs`).

Vérifié ce jour-là : tsc ✓, vite build ✓, cargo check ✓, endpoints Yahoo/FF/Binance/
FXStreet/InvestingLive répondent 200 ✓, UI démo complète sans erreur console ✓.

## Enrichissement analyste + refonte UI (2026-07-11, soir)
- Payload enrichi (voir Sources ci-dessus) : US2Y, ES futures, NQ=F au lieu de ^NDX,
  pivots P/R1/S1, ATR D1, adr_used_pct, long/short ratio Binance, Fear & Greed.
  Nouveau domaine allowlisté : `api.alternative.me` (→ rebuild natif obligatoire).
- `correlations.ts` : thèmes risk-off (VIX↑ ou ES↓) et risk-on (ES↑ et VIX↓) ajoutés.
- Prompt système mis à jour (lecture 2Y vs 10Y, ES overnight, règle ADR >85 %,
  signaux crypto croisés).
- `MarketBrainView.tsx` refait façon Apple : segmented control Briefing/Données/JSON,
  hero « thème du jour », rangée « en un coup d'œil » (5 chips biais + conviction en
  points, clic = scroll vers la carte), bandeau no-trade, jauges ADR, erreurs fetchers
  repliées dans un <details>. Le contrat `MarketBrainState` n'a pas changé.

## Design system V6 "Obsidian & Jade" (refonte 2026-07-21) — voir DESIGN.md
Refonte « Apple-grade » de la palette V5. Palette sombre quasi-OLED
(bg #07090d, surface #12151c, surface-2 #1c202a, texte #eef1f6, dim #8b94a6,
bleu #4d8dff, vert jade #14c8a0, rouge corail #ff5666, ambre #f0b341,
indigo #8e8bff) / clair « Alabaster » (bg #f4f5f7, surface #fff, texte #0b0d12,
bleu #1b62e5, vert #06825f, rouge #d22b3c). **Tous les accents passent AA**
(le bleu gagne 4.9→6.4:1 vs V5).

Nouveautés structurelles d'`index.css` :
- **Élévation réelle** : `--card-bg` est un dégradé vertical court en sombre
  (lumière haute), `--card-shadow`/`-hover` à deux étages, `--lift-shadow`
  pour les panneaux soulevés, `--glass-bg`/`--glass-blur` (classe `.glass`,
  utilisée par la sidebar et les barres d'outils de panneau).
- **Physique de mouvement tokenisée** : `--ease-out-quint`, `--ease-spring`,
  `--dur-fast|base|slow`. `prefers-reduced-motion` respecté globalement.
- Rayons : card 16→18px, field 10→12px. `--color-border-strong` ajouté.
- `.hud-label` tronque désormais en ellipse (un label long ne casse plus
  l'en-tête d'une carte) ; `overflow-wrap: anywhere` sur `p/li/dd/dt`.
- Utilitaires : `.auto-tiles-sm|.auto-tiles|.auto-tiles-lg` (grilles
  `auto-fit` réactives à la largeur du WIDGET, pas du viewport),
  `.clamp-1/2/3`, `.table-scroll`, `.glass`.
- ⚠️ **`couleur + "22"` est proscrit** (invalide si la couleur est un token
  `var(...)` → fond transparent). Remplacé partout par `color-mix`
  (TasksView, TaskModal, TodayTasks, TradingView `CountPills`).

### Historique V5 "Onyx & Émeraude" (2026-07-13, remplacée par V6)
Style "dark crypto premium" demandé par Antonin. Palette V5 : sombre onyx
(bg #0b0e14, surface #1a202c, surface-2 #242d3d, texte #e2e8f0, dim #94a3b8,
bleu #3b82f6, vert #00c896, rouge #f23645, ambre #f2b13d, indigo #818cf8,
hairlines/overlays teintés ardoise rgba(148,163,184,…)) / clair "papier froid"
accordé ardoise (bg #f1f5f9, texte #0f172a, bleu #2563eb, vert #047857,
rouge #dc2626, indigo #4f46e5). Changement 100 % token-level dans `index.css`
(3 blocs : @theme, light, media système) — aucun composant touché.
Contrastes re-vérifiés (détail DESIGN.md) ; rouge #f23645 = AA en semibold/mono.

### Historique V4 "Graphite & Signal" (2026-07-12, remplacée par V5)
Palette V4 : sombre graphite bleuté (bg #0c0f14, surface #141922, bleu #2e7ff2,
vert #33d17a, rouge #ff5d55, ambre #f2b13d, violet #a08cff) / clair "papier froid"
(bg #f3f5f8, bleu #1a6ce8, vert #178745, rouge #d63a2f, ambre #a16207).
Contrastes WCAG vérifiés. Nouveau token `--radius-field: 10px`. Les ~44 couleurs
codées en dur restantes (vieilles teintes V2 rgba(60,217,176)/rgba(14,125,240)/
#f0c04e etc.) ont été tokenisées via
`color-mix(in srgb, var(--color-x) N%, transparent)` — fichiers : DisciplineRing,
PerfStrip, BootScreen, QuickLinks, TimerPanel, Sidebar, BenchmarkTests, benchmark.ts,
RichNoteEditor (+ table COLOR_TO_VAR étendue aux hex V4), PerformanceView, JournalView,
TasksView (TAG_COLORS), demo.ts. Les hex restants = couleurs de données (labels stockés).

### Historique V3 (2026-07-11, remplacé par V4)
Tout vit dans `src/index.css`. L'esthétique HUD (grille, scanlines, orbes, glows,
coins tactiques, labels mono espacés) a été **supprimée** — sobriété type Apple.

**Thèmes** : sombre (défaut) / clair / système. Tokens définis dans `@theme` (sombre),
surchargés via `:root[data-theme="light"]` et un media query `prefers-color-scheme`
pour le mode système. Mécanique : `src/lib/theme.ts` (`loadTheme`/`saveTheme`,
setting `ui.theme`, attribut `data-theme` sur `<html>`) ; appliqué au boot dans
App.tsx ; sélecteur Système/Clair/Sombre dans Réglages → Apparence.

**Palette** — sombre : bg #0a0a0c, surface #131316, texte #f2f2f4, bleu #0a84ff,
vert #30d158, rouge #ff453a, jaune #ffd60a. Clair : bg #f5f5f7, surface #fff,
texte #1d1d1f, bleu #0071e3, vert #1e9e50, rouge #d93025, jaune #b45309.

**Règles impératives pour toute nouvelle UI** :
- JAMAIS de couleur codée en dur ni de voile `bg-white/x` ou `bg-black/x` (sauf
  backdrops de modales `bg-black/60`, OK dans les deux thèmes). Utiliser les tokens :
  `bg-overlay` (hover), `bg-overlay-2` (actif/sélection), `border-border`,
  `text-on-green` (texte sur bouton vert). Dans les SVG/Recharts/styles inline :
  `var(--color-blue)`, `var(--color-border)`, etc. — jamais d'hex.
- Un seul accent (bleu) ; vert/rouge réservés à la sémantique ; zéro glow/drop-shadow.
- `.card` = surface + hairline + ombre douce (vars `--card-bg`/`--card-shadow`).
- `.hud-label` = label 11px DM Sans 600 uppercase 0.05em (plus de mono espacé).
- Bouton primaire : `pill bg-blue text-white font-semibold` ; secondaire :
  `pill border border-border bg-surface-2`.
- En-tête de vue : overline `.hud-label` + h1 (Outfit 700, -0.022em, via base CSS).
- Global : chiffres tabulaires, scrollbars fines, `:focus-visible`, active scale(0.98).
- **Icônes : JAMAIS d'emoji dans l'UI.** Bibliothèque maison `src/components/icons.tsx`
  (SVG 24×24, trait 1.8, bouts ronds, currentColor, taille via className) : IconFlame,
  IconBolt, IconBan, IconTarget, IconAlert, IconCheck(-Circle), IconX, IconPlay/Pause/
  Stop (pleins), IconExpand, IconTrendUp/Down, IconDash, IconMic, IconSpeaker/Mute,
  IconMood(level 0-4). Ajouter les nouvelles icônes là-bas, même style. Les symboles
  clavier (⌘, ⌥) restent en texte.
- Market-Brain n'affiche QUE le briefing (les onglets Données/JSON ont été retirés le
  2026-07-11 ; le payload reste stocké en DB pour audit).

## Sidebar par catégories (2026-07-12, Phase 3)
`Sidebar.tsx` : nav en catégories repliables — « Aujourd'hui » hors catégorie (accueil),
**Productivité** (tasks/timer/goals/performance/benchmark/notes/journal) et **Trading**
(trading/market/sizing) ; Personnaliser/Réglages restent épinglés en bas (rôle Système).
Mapping statique `CATEGORIES`/`CATEGORY_OF` ; l'ordre/visibilité DANS une catégorie suit
toujours la page Personnaliser (uiConfig). État replié persisté (setting `sidebar.collapsed`,
JSON {catId: bool}) ; défaut premier lancement = seule la catégorie de la vue active ouverte.
La catégorie de la vue active se rouvre automatiquement à la navigation (sans fermer les
autres). Repli animé (grid-template-rows 0fr↔1fr, 240ms) + scrollIntoView à l'ouverture ;
badge vert remonté sur l'en-tête si un module masqué a un badge. Tout nouveau module doit
être ajouté à `CATEGORIES` (sinon il apparaît hors catégorie, sous Aujourd'hui).

## Page "Personnaliser" (admin UI, 2026-07-11 soir)
Nouvelle vue `admin` (sidebar, épinglée en bas avec Réglages, icône curseurs) :
`src/views/AdminView.tsx` + `src/lib/uiConfig.ts`.
- Config unique JSON dans settings `ui.config` (types `UiConfig`), fusionnée avec les
  défauts au chargement (`mergeList` : nouveaux modules/widgets ajoutés en fin).
- Pilote : identité (titre/sous-titre sidebar), taille de fenêtre au lancement
  (null = ne pas gérer ; bouton « Mémoriser la taille actuelle » ; nécessite les
  permissions `core:window:allow-set-size/inner-size/scale-factor`), densité
  (zoom 90–120 % via `applyZoom`, propriété CSS zoom), ordre/visibilité/libellés des
  modules sidebar (Aujourd'hui non masquable ; admin+settings fixes), ordre/visibilité
  des widgets du dashboard (3 groupes : dashTop/dashLeft/dashRight).
- Diffusion : hook `useUiConfig()` monté dans App (passé à Sidebar, TodayView,
  AdminView) ; resynchronisation via l'événement `sb:ui-config`. Sauvegarde immédiate
  à chaque changement (pas de bouton Enregistrer).
- TodayView rend ses widgets via un registre id→JSX ; tout nouveau widget du dashboard
  doit être ajouté au registre + aux défauts + à `WIDGET_LABELS`.
- **Dashboard = coup d'œil** (2026-07-12 soir) : `TimerCard.tsx` est une version COMPACTE
  (session en cours → temps + pause/stop ; sinon 3 presets + Lancer ; lien « Réglages
  détaillés → » vers la vue Timer via `onOpen`). Le panneau complet (`TimerPanel`) ne vit
  QUE dans la vue Timer. Ne pas remettre de formulaire détaillé dans un widget du dashboard.

## Code-splitting (2026-07-11, nuit)
Les vues (13 à l'époque, **15 aujourd'hui**) sont chargées en `React.lazy` + `Suspense` dans `App.tsx` (fallback
« Chargement… »), et `WeekChart` (recharts) est lazy dans `TodayView` : recharts
ne fait plus partie du bundle de démarrage. Résultat : chunk principal 867 → 308 kB
(gzip 253 → 99 kB), recharts (~288 kB) chargé seulement à l'ouverture d'une vue à
graphique. Plus de warning Vite « chunk > 500 kB ». Toute nouvelle vue doit rester
dans ce schéma lazy ; un composant lourd (chart, éditeur) gagne à être `lazy` + `Suspense`.

## Couleurs des notes suivent le thème (2026-07-11, nuit)
Bug : l'éditeur de notes appelait `execCommand("foreColor", "var(--color-x)")` **sans**
`styleWithCSS` → Chromium produisait `<font color="rgba(0,0,0,0)">` (texte transparent)
et jamais adapté au thème. Corrigé dans `RichNoteEditor.tsx` :
- `execColor()` active `styleWithCSS` le temps d'appliquer couleur/surlignage → produit
  `<span style="color: var(--color-x)">` qui suit le thème clair/sombre automatiquement
  (rebascule aussitôt en mode balises pour garder `<b>`/`<i>` sémantiques).
- `normalizeNoteColors()` (appelé dans `toEditorHtml`) réécrit les notes déjà
  enregistrées au chargement : `<font color>` → `<span>`, et couleurs figées de la
  palette (hex/rgb sombre+clair) → variable de thème ; transparent/noir hérité → 
  `var(--color-text)`. Table `COLOR_TO_VAR`. Surlignages translucides laissés tels quels.
- Nouveau token `--color-violet` (#a78bfa sombre / #7c3aed clair) dans les 3 blocs de
  palette de `index.css` ; le violet de l'éditeur passe de `#a78bfa` figé à `var(--color-violet)`.
Vérifié : couleur appliquée = rgb(255,69,58) en sombre → rgb(217,48,37) en clair, sans
ré-éditer la note ; normalizer OK sur font/rgb/transparent/déjà-var/texte brut.

## Widgets redimensionnables (grille, 2026-07-11 nuit)
Chaque carte encadrée des vues peut être redimensionnée en tirant la poignée du coin
bas-droit ; les autres se réorganisent sans jamais se chevaucher ni sortir du cadre.
- Composant : `src/components/grid/ResizableGrid.tsx` → `<ResizableGrid gridId>` +
  `<ResizablePanel id defaultW>`. Modèle « masonry » : CSS Grid 12 colonnes, rangées de
  1px + `grid-auto-flow: row dense` (le navigateur garantit l'absence de collision).
  **Largeur** = span de colonnes ; **hauteur par défaut** = hauteur réelle du contenu
  suivie par un `ResizeObserver` (aucune vue à régler). Tirer verticalement épingle la
  hauteur par pas de 24px. Un **bouton reset** (⟲, coin haut-droit) apparaît au survol
  quand le panneau a été redimensionné. CSS : `.rgrid-content` dans `index.css` neutralise
  les marges de tête/pied (sinon margin-collapsing → mauvaise mesure → chevauchement).
- Persistance : `getSetting/setSetting` clé `layout.<gridId>` (par vue), uniquement les
  panneaux modifiés. En **démo** (navigateur) c'est en mémoire → non conservé au reload ;
  en **natif** (SQLite) c'est persistant.
- Déployé sur : dashboard (`today`, widgets entrelacés depuis dashLeft/dashRight),
  `tasks`, `goals`, `journal`, `benchmark`, `settings`, `admin`, `timer`, `sizing`,
  `performance`, `trading`, `market`/`market-flash` (BriefingPanel, instruments en w6).
  **NotesView exclu** : layout pleine hauteur 2-panneaux (flex h-full) incompatible avec
  la grille masonry (qui dimensionne par le contenu). À voir séparément si besoin.
- Ajouter une vue/carte : envelopper la carte dans `<ResizablePanel id="unique" defaultW>`
  au sein d'un `<ResizableGrid gridId="vue">`, retirer les marges `mt-*` de la carte
  (la grille gère l'espacement). Vérifié : 12 vues, 0 chevauchement, 0 débordement, tsc/build ✓.
- **Moteur v2 « Apple-like » (refonte 2026-07-12, Phase 1 refonte UX)** :
  - Le panneau saisi **suit le curseur 1:1** (transform imperatif dans `pointermove`, hors
    React) et revient à son slot par une **animation ressort WAAPI** au relâchement
    (`springEasing()` : courbe masse-ressort échantillonnée en easing CSS `linear(...)`,
    repli `cubic-bezier(0.32,0.72,0,1)` si non supporté).
  - Voisins animés par **FLIP** batché (1 seul reflow forcé, lectures/écritures groupées),
    easing ressort. Le panneau saisi est exclu du FLIP ; son transform est recalculé après
    chaque réagencement pour rester sous le curseur (`startSlot`/`curSlot`).
  - Hit-test du drag sur les **positions finales de layout** (`slotRects`, coords locales
    grille, jamais des rects en cours d'animation) + cooldown 130ms → pas d'oscillation.
    Auto-scroll doux près des bords du conteneur scrollable (rAF, seul usage du rAF).
  - **Fix bug de calage** : la mesure `ResizeObserver` n'est plus suspendue pendant un
    resize (l'ancien garde `dragging.current` laissait une hauteur périmée → contenu
    chevauchant les cartes du dessous après un resize horizontal). L'empreinte suit
    toujours le contenu.
  - Resize : aperçu live par crans (colonne / 24px), les voisins glissent à chaque cran
    (`captureFlip(id)`), hauteur épinglée **préservée** lors d'un drag purement horizontal,
    **double-clic sur la poignée = hauteur automatique** (désépingle).
  - **Hauteur épinglée = le cadre suit** (fix « film » 2026-07-12 soir) : quand `h` est
    épinglé, `.rgrid-content` reçoit la classe `rgrid-fill` et le CSS
    `.rgrid-fill > :first-child { height:100%; overflow-y:auto }` force la carte
    (premier enfant) à prendre exactement la taille choisie, contenu scrollable dedans —
    plus de carte coupée par l'overflow du wrapper.
  - **Anti-superposition structurel** (2026-07-12 soir) : chaque wrap de panneau a
    `overflow-x: clip` (sauf pendant le drag, où overflow reste visible pour l'ombre) —
    aucun contenu ne peut plus baver horizontalement sur un voisin, quelle que soit la vue.
  - **Alignement** : hauteur auto arrondie au multiple de 8px supérieur (grille de base
    8pt) → bords des panneaux sur un rythme vertical commun.
  - **Poignée ↗ « ouvrir la vue complète »** (coin bas-gauche, au survol) : prop
    `onOpen?: () => void` sur `ResizablePanel`. Sur le dashboard, mapping
    `WIDGET_TARGET` (TodayView) widget→vue ; les anciens liens texte « ouvrir → »
    (PositionSizeWidget) et « Réglages détaillés » (TimerCard) ont été supprimés au
    profit de cette poignée uniforme.
  - **Masquer/réafficher des panneaux** : poignée ✕ (coin haut-droit, à côté du reset ⟲
    décalé à right-34px) → `hidden.<gridId>` (setting JSON). Les panneaux masqués
    apparaissent sous la grille en chips « + <titre> » (clic = restaure, FLIP animé).
    `ResizablePanel` accepte `title?: string` (libellé humain ; repli = id embelli).
    Titres posés sur Today (WIDGET_LABELS), Timer, Trading, Market-Brain.
  - Vérifié (démo) : reorder+resize sur Timer/Today/Trading, 0 chevauchement, 0 résidu
    (transform/z-index), 0 erreur console, tsc + vite build ✓.

## Widgets : structure réelle & contraintes (refonte 2026-07-21)

**Le bug historique** : `.rgrid-fill > :first-child` n'avait qu'un
`min-height: 100%`. Agrandir un widget étirait donc le CADRE sans toucher au
contenu (vide en bas = impression de « voile »), et le rétrécir ne faisait
que rogner la carte, dont le contenu débordait puis était coupé par
l'`overflow: clip` du wrap. Pire, `footprint = max(pinnedH, naturalFootprint)`
**interdisait** de descendre sous la hauteur du contenu : le resize vertical
était en grande partie inopérant.

**Correctif en trois temps :**
1. `index.css` : la carte fait EXACTEMENT son empreinte
   (`min-height: 100%` **+ `max-height: 100%`**) et `.rgrid-fill > .card`
   devient une **colonne flex**. Un panneau dont la racine n'est pas une
   carte (bandeau de tuiles) garde son `display` et s'étire via
   `.panel-stretch`.
2. Chaque widget déclare la région qui encaisse la variation de hauteur :
   `.panel-grow` (spacer / zone centrée), `.panel-scroll` (liste qui défile),
   `.panel-chart` (graphique à hauteur définie ET extensible : `height: 0` +
   `min-height`, sinon `<ResponsiveContainer height="100%">` mesure 0).
   Sans région déclarée, un ressort `::after` absorbe l'espace (contenu calé
   en haut, jamais étiré anormalement).
3. `ResizableGrid.tsx` **auto-détecte** `.panel-scroll` (ResizeObserver +
   MutationObserver) : quand la région existe, le plancher anti-troncature
   tombe à `minH` et le widget peut réellement être réduit — la liste défile
   dedans. Sinon le plancher reste la hauteur du contenu.

**Contraintes désormais appliquées (`ResizablePanel`)** :
- `minW` (colonnes) — **remonté automatiquement** par le moteur selon la
  largeur RÉELLE de la grille : `MIN_PANEL_PX = 248` traduit un plancher en
  pixels en nombre de colonnes. Sur une fenêtre étroite, un widget 4/12
  devient 6/12 puis 8/12 : responsive sans breakpoint de viewport.
- `maxW` (colonnes), `minH` / `maxH` (px). Plafond implicite = 90 % de la
  hauteur visible, **recalculé au `resize`/`orientationchange`** (avant, une
  taille enregistrée sur grand écran faisait « disparaître » le widget après
  passage sur un écran plus petit).
- Dépassement élastique (résistance 0.18) aux DEUX bornes pendant le drag,
  puis retour borné en ressort au relâchement.

**Poignées** : regroupées dans une seule barre « verre » en haut à droite
(⟲ réinitialiser · ⠿ déplacer · ✕ masquer), + ↗ (ouvrir la vue) en bas-gauche
et la poignée de resize en bas-droite. Toutes sont `pointer-events-none` au
repos — avant, des boutons invisibles interceptaient les clics destinés au
contenu de la carte sur tout le coin haut-droit.

**Règles pour toute nouvelle carte de grille :**
- racine = `.card` (colonne flex automatique) ; jamais de `mt-*` sur la racine ;
- marquer la zone extensible : `.panel-scroll` pour une liste (+ `minH` sur le
  panneau), `.panel-chart` pour un graphique, `.panel-grow` pour un spacer ;
- grilles internes en `.auto-tiles*` (jamais `grid-cols-N` fixe) — **et vérifier
  que la piste mini correspond au contenu réel** : `.auto-tiles` (120px) est trop
  permissif pour une tuile « icône + 2 lignes de texte », qui exige ~190px
  (cf. `.perf-tiles`, bug du 2026-07-26) ;
- tout conteneur flex portant du texte : `min-w-0` ; tout libellé long :
  `truncate` ou `clamp-2` + `title` ;
- **toute rangée de contrôles doit pouvoir se replier** : `flex-wrap` sur la
  rangée, et une **base flex** (`basis-[Nrem]`) sur le bloc de texte voisin —
  `min-w-0 flex-1` seul ne déclenche JAMAIS le repli, il comprime le texte
  jusqu'à une lettre par ligne. Ne jamais mettre `shrink-0` sur un groupe censé
  se replier (il bloque le repli de ses propres enfants). Sans ça, un contrôle
  sort du panneau et l'`overflow-x: clip` du wrap le rend **incliquable**.

## Roadmap 5 étapes (2026-07-12)
1. **Fermeture propre (fix bug cycle de vie).** `src-tauri/src/lib.rs` `on_window_event` :
   fermer la fenêtre `main` appelle désormais `window.app_handle().exit(0)` (avant :
   `prevent_close()` + `hide()` → processus fantôme en fenêtré, écran noir en plein écran).
   Contrepartie : l'app ne vit plus en arrière-plan → capture ⌥Espace / PTT ⌥J inactifs app fermée.
2. **Temps sur mesure.** `TimerPanel.tsx` : 4ᵉ chip « sur mesure » + champs travail/pause
   éditables (1–240 min), mémorisés (`timer_custom_work` / `timer_custom_break`).
3. **Bibliothèque audio (refonte du système d'ambiance).** Passage d'un modèle mono-ambiance
   à un **mixeur multi-pistes** :
   - `src/lib/soundMixer.ts` : moteur Web Audio, plusieurs pistes en simultané, boucle
     (BufferSource `loop` pour les fichiers décodés = sans coupure ; repli `<audio loop>` si
     `decodeAudioData` échoue, ex. MP4 vidéo). Gain maître, nettoyage explicite des nœuds.
   - `src/lib/soundLibrary.ts` : pistes intégrées (bruits, battements), fréquences custom,
     fichiers importés ; « session active » (`sound_active`) vs bibliothèque. Import via
     dialog + commande Rust `import_audio` (copie dans `<app_data>/audio/`, extensions
     mp3/m4a/aac/wav/mp4/ogg/flac/opus). Scope asset `$APPDATA/audio/**` ajouté à tauri.conf.
   - `AmbientControl.tsx` réécrit en UI de mixeur (session active / bibliothèque / import /
     volume / création de fréquence). `useFocus` (mode concentration) lance `startActiveMix()`
     et coupe via `stopAllTracks()`. Jarvis (`router.ts`) routé sur le mixeur.
   - **Supprimé** : `src/lib/ambientPresets.ts` (mort). `audio.ts` ne sert plus que `playChime`.
4. **Jauge de charge mentale (énergie restante).** `src/lib/mentalLoad.ts` (calcul + hook
   `useScreenTime` monté dans App qui accumule `screen_min_<jour>` chaque minute visible) ;
   `MentalLoadGauge.tsx` (widget dashboard `energy`, couleur verte→jaune→rouge). Énergie =
   startEnergy − trades·coûtTrade − heuresÉcran·coûtHeure, en % de startEnergy. Coefficients
   réglables dans Réglages → « charge mentale » (`energy_start` / `energy_cost_trade` /
   `energy_cost_hour`), événement `sb:mental-load-config` pour rafraîchir la jauge.

Vérifié (démo navigateur) : tsc ✓, vite build ✓, cargo check ✓, 0 chevauchement grille,
0 erreur console ; mixeur (ajout/retrait/loop) et jauge OK. **Import fichier + fermeture
plein écran = à tester dans l'app native** (non simulables en headless).

## Horloge de marché : mode week-end + sessions (2026-07-12, Phases 4-5)
`src/lib/market/clock.ts` — pure + hook `useMarketClock()` (tick 30 s, visibilitychange,
événement `sb:market-clock`) :
- **Week-end forex** : fermé du vendredi 17:00 New York au dimanche 17:00 New York
  (convention 5pm NY, DST-proof via Intl par place). `nextForexOpen()` par recherche
  heure→minute. Libellé « reprise dimanche/lundi à HH:MM » dans le fuseau de l'appareil.
- **Sessions** : Sydney 07-16 (Australia/Sydney), Tokyo 09-18 (Asia/Tokyo), Londres 08-17
  (Europe/London), New York 08-17 (America/New_York), calculées à l'instant absolu →
  indépendant du fuseau de l'appareil ; chevauchements naturels (ex. Londres+New York).
- **Simulation test** : `window.__sbSetFakeNow("2026-07-14T13:00:00Z")` (null = réel).
UI :
- `SessionIndicator.tsx` (pastille violette + nom(s) de session, double point si
  chevauchement, gris « marché fermé · reprise … » / « entre sessions ») — monté dans le
  pied de Sidebar et (compact) dans l'en-tête Market-Brain.
- MarketBrainView : bannière « Marché fermé » (dépliage animé grid-rows, sans flash),
  boutons Flash/Régénérer désactivés, instruments non-BTC + bandeau no-trade grisés
  (`WeekendDim`, opacity+grayscale transition 500 ms) ; **BTC/USD jamais grisé** (24/7).
  Sizing non concerné (calculateur pur, pas de prix live).
Vérifié par simulation : Lon+NY, Syd+Tokyo, rollover, samedi, vendredi 22:30/23:30 Paris,
dimanche réel → pastilles et grisage corrects dans tous les cas.

## Audit final refonte (2026-07-12, Phase 6)
- 26 combinaisons vue×thème parcourues en démo : **0 erreur console**, 0 chevauchement,
  0 débordement (mesures faites onglet visible — ⚠️ en préview navigateur, un onglet en
  arrière-plan a un viewport 0×0 : toute mesure gBCR y est invalide, tester au premier plan).
- Classes mortes `text-glow` retirées (TimerPanel, TimerView). Backdrops `bg-black/50-85`
  conservés (modales, conformes aux deux thèmes).
- Perf : drag = transforms impératifs hors React (0 re-render par frame), FLIP = 1 seul
  reflow forcé par lot, resize = 1 setState par cran ; intervalles (market clock 30 s)
  et listeners nettoyés au démontage. Aucune fuite détectée.
- Dette connue : NotesView toujours hors ResizableGrid (layout 2 panneaux plein écran,
  choix assumé) ; sessions forex = bornes conventionnelles fixes par place (pas de
  gestion des jours fériés locaux) ; palette `TAG_COLORS` extra (#fb8b4e/#ef6ba8/#3cc4de)
  = hex de données assumés.
- tsc ✓, vite build ✓, cargo check ✓, tauri build natif ✓ (voir ci-dessous).

## Refonte 2026-07-13 (widgets, catégories d'objectifs, retrait de Jarvis)
1. **Anti-troncature des widgets** (`ResizableGrid.tsx`) : le resize vertical ne peut plus
   descendre sous la hauteur NATURELLE du contenu (plancher arrondi 8px).
   `footprint = max(pinnedH, naturalFootprint)` → une taille déjà enregistrée trop petite
   est auto-remontée (plus de widget « coupé », ex. énergie). Le mode « remplir + scroll
   interne » (`pinnedTaller`) ne s'active que si on agrandit volontairement au-delà du contenu.
   **⚠️ Fix clignotement (même jour)** : quand la carte est étirée (`rgrid-fill`), son
   scrollHeight = hauteur imposée → le mesurer gonflait `autoH` → désétirage → remesure →
   boucle (clignotement + sauts). Règle dans `measure()` : carte étirée SANS débordement
   réel (scrollHeight ≤ clientHeight+2) → mesure ignorée (dernier naturel conservé) ;
   débordement réel → scrollHeight fiable, plancher remonté. Le plancher du resize lit
   `autoHRef` (mesure naturelle entretenue), jamais le scrollHeight d'une carte étirée.
   **Poignées** : ⠿ déplacé du coin haut-GAUCHE (il recouvrait les titres des cartes,
   « ⠿AILLE DE POSITION ») vers le groupe haut-droit — ordre : ⟲ (right-62) ⠿ (right-34)
   ✕ (right-1.5) ; ↗ ouvrir en bas-gauche, resize bas-droit.
2. **Catégories d'objectifs** : nouvelle colonne `goals.category TEXT` (migration
   `011_goal_category.sql`, enregistrée dans `lib.rs` v11). `Goal.category` +
   `GoalInput.category` (repo natif + demo). `GoalModal` : champ catégorie libre avec
   `<datalist>` + chips des catégories existantes. `GoalsView` regroupe les objectifs
   racines par catégorie (un `ResizablePanel` par catégorie, « Sans catégorie » en dernier).
3. **Jarvis / assistant vocal SUPPRIMÉ** (front) : `JarvisDock.tsx`, `lib/jarvis/`
   (router+useJarvis), `jarvisSay` (useFocus), sections Réglages voix (jarvis/whisper/tts +
   handlers `speak`/`voice_*`/`downloadModel`), icônes IconMic/Speaker/Mute, CSS `.jarvis-orb*`,
   mentions texte (TimerPanel/TimerView/TradingView/PerformanceView), ligne push-to-talk
   des raccourcis. **Conservés** : palette ⌘K (`CommandPalette`+`actions.ts`, lanceur clavier),
   ambiance sonore du focus (`soundMixer`/`AmbientControl`). ~~**Rust laissé dormant**~~ :
   historique de Second Brain — **Shale n'a jamais eu ce reliquat** (ni `voice.rs`, ni
   `alt+j`). Vérifié le 2026-07-26.
   Bundle démarrage : 318 → 300 kB.

## Alignement final & gouttières uniformes (2026-07-13, matin)
- **Remplissage permanent** : chaque carte remplit TOUJOURS son empreinte
  (`.rgrid-fill > :first-child { min-height: 100% }`, wrap `height: footprint`,
  overflow clip hors drag). Résultat mesuré : bords sur grille 8px partout,
  **gouttière verticale = 16px partout** (= gouttière horizontale), toutes vues.
- **Mesure du naturel exacte** : `measure()` retire la classe `rgrid-fill` le temps
  de lire `card.offsetHeight` (synchronement, avant paint — invisible) puis la remet.
  offsetHeight = hauteur de layout, insensible aux transforms du drag/lift. Plus
  aucun hack de gel, plus de boucle possible.
- **Bug historique corrigé** : le reset `.rgrid-content > :first-child { margin-top: 0 }`
  (couche `components`) était battu par les utilitaires Tailwind (`mt-4`, `mt-6`,
  couche `utilities` prioritaire) depuis toujours → marges racines infiltrées dans la
  grille (gouttières 24px erratiques). Reset passé en `!important` + marges racines
  retirées à la source (PreSessionCheck ×2, PerfStrip). **Règle : jamais de `mt-*`
  sur l'élément RACINE d'un widget de grille.**
- Normalisation interne des widgets dashboard : `card p-5` + `hud-label mb-3` partout
  (discipline était p-6/mb-4, week mb-2).
- Vérifié : gouttières {16} uniques sur Today/Timer/Trading/Objectifs/Market-Brain,
  0 chevauchement, 0 résidu, plancher anti-troncature actif, double-clic désépingle,
  reorder OK, 0 erreur console.

## Resize : largeur min, plafond & ressort (2026-07-13, midi)
- **Largeur minimale par widget** (`WIDGET_MIN_W` dans TodayView) : timer/discipline/
  energy/week/quicklinks = 3 col, position/tasks/goals = 4, perf/presession = 4. Sous ce
  seuil le contenu se chevauchait. Les presets du timer repassent en `grid-cols-3` +
  `overflow-hidden` (jamais de collision, garanti par le min 3 col). Vérifié : timer à
  span 3, 3 chips de 58px, 0 chevauchement.
- **Plafond de hauteur = ~90% de l'écran** (`maxFootprint`, jamais sous le naturel),
  appliqué AU RENDU → même une taille enregistrée démesurée (ancien override) est bornée
  au chargement : un widget ne peut plus « disparaître » plus bas.
- **Effet ressort** : pendant le drag vertical, dépassement ÉLASTIQUE au-delà du plafond
  (résistance 0.18, `compute(commit=false)`) → on VOIT le widget grandir ; au relâchement
  la valeur enregistrée est bornée (`commit=true`) et le retour glisse via FLIP.
  Vérifié : énergie montait à span 739 pendant le drag → revient à 648 (=max) au relâcher.
- `MAX_PX` supprimé (remplacé par le plafond dynamique viewport).

## Tracker live trading + workflow "Trader" (2026-07-13, après-midi)
Automatisation Positions → Trading : le bouton **"Trader"** (vue Position : carte
résultat + chaque ligne d'historique) envoie la position au **tracker live** en tête
de la vue Trading (onglet Live). Une seule action finale : **Gagnante / Perdante**
(+ BE optionnel). Cascade complète :
- **Données** : migration `012_live_tracker.sql` (v12 dans lib.rs) — table
  `live_positions` (opened_at exact, pair, direction, entry/SL/TP, lots, risque,
  `rr_theoretical`, status open/win/loss/be, `partials` JSON, `trade_id` de la ligne
  de journal créée à la clôture) + colonne `take_profit_price` sur
  `position_size_calculations`. ⚠️ Migration SQL → rebuild natif obligatoire (fait).
- **Logique pure** : `src/lib/liveTracker.ts` — `theoreticalRR` (R:R auto à la
  réception), `rAtPrice` (R signé à un prix de sortie), `finalResultR` (résultat
  pondéré par les sorties partielles : partielles à leur R + restant à R:R si win /
  −1R si loss / 0 si BE), `buildJournalNotes` (notes auto traçables), helpers
  d'affichage (fmtRR/fmtSignedR/fmtElapsed). Gagnante SANS TP connu → mini-form
  inline "prix de sortie" (aperçu du R en direct).
- **Repo** (`repo.ts` natif + `demo.ts` seeds, même API) : `openLivePosition`
  (capture localNow + calcule rr), `fetchLivePositions` (open only),
  `setLivePartials`, `setLiveTakeProfit` (recalcule rr), `closeLivePosition`,
  `deleteLivePosition` ; `createTrade`/`logTrade` renvoient désormais l'**id** du
  trade créé. Événement `window` **`sb:live-positions`** émis à chaque mutation
  (badge sidebar + refresh du tracker monté). `fetchTrackerSettings`/
  `saveTrackerSettings` (clés `tracker.fastTrack|autoOpen|allowBe`, défauts 0/0/1).
- **Vue Position** (`SizingView`) : champ TP optionnel (tuiles "R:R théorique" +
  "gain potentiel" dans la carte résultat), bouton primaire "Trader cette position",
  bouton "Trader" par ligne d'historique (colonne R:R ajoutée ; l'envoi marque
  aussi `used_for_trade`). Selon `tracker.fastTrack` : mini-popup de confirmation
  (`SendToTrackerModal.tsx`, TP éditable, case "ne plus demander") OU envoi direct
  en arrière-plan + toast (`Toast.tsx`, action "Voir le tracker"). `tracker.autoOpen`
  = bascule directe sur Trading. App passe `navigate` à SizingView.
- **Tracker** (`LiveTracker.tsx`, panneau `trading-tracker` en tête de grille,
  onglet Live uniquement) : heure d'entrée + durée (tick 30 s), paire/sens, niveaux
  (SL rouge / TP vert, "définir" si absent), taille, chip R:R, chips partielles +
  bouton "+ partielle" (mini-form % + prix → R calculé), Gagnante/Perdante/BE/✕
  (retrait confirmé sans log). À la clôture : `logTrade` (journal live, notes auto,
  métrique trades du jour) → `closeLivePosition` (archive + trade_id) → `refresh()`
  → toast "±xR". En-tête : nb positions + % de risque engagés (ambre).
- **Stats journal** (`trades.ts`) : `TradeStats.profitFactor` (R gagnés ÷ R perdus)
  + `maxDrawdownR` (pire creux pic→creux du R cumulé chronologique) — affichés
  dans les 4 cartes de période de TradingView ("PF x.x · DD max −xR").
- **Réglages** : section "tracker live trading — workflow trader" (3 ToggleRow,
  sauvegarde immédiate, événement `sb:tracker-config` écouté par le tracker).
- **Badge sidebar** : point vert sur "Trading" tant que des positions sont ouvertes
  (state dans App.tsx, sync via `sb:live-positions`).
Vérifié en démo navigateur (0 erreur console) : envoi popup + fast-track + autoOpen,
R:R auto (1:2), dénouement 1 clic (+2R archivé, stats/PF/DD à jour), partielle
50% @ +1R → clôture win = +1.5R exact, win sans TP via prix de sortie (+2R),
badge sidebar on/off, thèmes sombre + clair. tsc ✓ vite build ✓ cargo check ✓
tauri build + réinstallation ✓.

## Preview navigateur multi-session (2026-07-13)
`vite.config.ts` : le port dev lit `process.env.PORT` (repli 1420 strict pour
`tauri dev`). `.claude/launch.json` : `autoPort: true` (+ config "vite-preview")
→ plusieurs sessions Claude peuvent lancer leur propre serveur sans conflit de port.

## Info-bulles « Hover Hints » (2026-07-21)
Système d'aide contextuelle au survol, style « help tag » macOS.
`src/components/Tooltip.tsx` = **une seule bulle** montée dans App
(`<TooltipLayer />`), qui écoute `pointerover`/`focusin` en capture au niveau
du document. N'importe quel élément la déclenche par attributs — aucun
wrapper, aucun state local, zéro re-render par bouton :
- `data-tip` (libellé, obligatoire), `data-tip-sub` (2ᵉ ligne explicative),
  `data-tip-kbd` (raccourci en pastille), `data-tip-side`
  (`top|bottom|left|right`, défaut top ; la sidebar utilise `right`).
- Délai **400 ms à froid / 60 ms à chaud** (fenêtre de 550 ms après une
  fermeture) : la bulle « suit » le curseur d'un bouton à l'autre sans
  interrompre un geste. Fermeture immédiate au clic, au scroll, à la frappe.
- Placement mesuré en `useLayoutEffect` (avant peinture) : retournement
  automatique si ça ne tient pas, puis calage à 8 px des bords — jamais de
  débordement. Le wrapper porte la position (`translate3d`), la bulle porte
  l'animation (fondu + zoom 0.96→1, `--ease-spring`) : mesure exacte, aucun saut.
- **Zoom** : `getBoundingClientRect` renvoie des pixels écran alors qu'un
  `position: fixed` sous un `<html>` zoomé (densité, page Personnaliser)
  raisonne en pixels locaux → tous les calculs en écran, division par le
  facteur de zoom au moment d'écrire le transform.
- ⚠️ **Un bouton `disabled` ne reçoit pas d'événements de survol** : porter
  alors `data-tip` sur un `<span>` englobant (fait pour Flash/Régénérer du
  Market-Brain, ce qui permet justement d'expliquer POURQUOI c'est grisé).
- Styles/tokens dans `index.css` (`.tip-wrap`, `.tip`, `--tip-bg/-border/-shadow`
  déclinés sombre + clair + système).
- Déployé sur la sidebar (nom canonique + rôle du module), les poignées de
  grille, Market-Brain, tracker live, timer, tâches, objectifs, journal,
  trading, position, notes, réglages, personnaliser, savoir. Les anciens
  `title=""` DOM des éléments interactifs ont été convertis (plus de double
  bulle) ; les `title` restants sont soit des props de composants, soit des
  libellés tronqués.
- Convention : **pas de bulle sur une action déjà évidente** (Annuler,
  Enregistrer d'un formulaire, carte dont le titre est visible).
- Au passage : derniers emojis d'UI remplacés par des icônes maison
  (📷 → `IconImage` dans TradingView, 💾 → `IconSave` dans SettingsView).

## Onglet « Savoir » — base de connaissances (2026-07-21)
Nouveau module `knowledge` dans la catégorie **Productivité**
(`src/views/KnowledgeView.tsx`, ~900 l.), pensé pour capturer une idée sous
n'importe quelle forme et la retrouver vite.
- **Données** : migration `013_knowledge.sql` (v13 dans `lib.rs`) — tables
  `knowledge_topics` (nom, couleur, position) et `knowledge_entries`
  (`kind` note|link|image|sketch, title, body HTML, url, `media` data URL
  pleine résolution, `thumb` data URL d'aperçu, `data` JSON du croquis, tags
  CSV, pinned). ⚠️ Migration SQL → **rebuild natif obligatoire**.
- **Pas de FTS5** ici (contrairement aux notes) : la recherche se fait en
  mémoire (`matchesQuery`, tous les mots doivent correspondre) sur la liste
  déjà chargée — instantané à cette échelle et strictement identique en démo.
- **Deux niveaux de lecture** pour ne jamais trimballer les images :
  `fetchKnowledge()` renvoie thèmes + fiches SANS `media` (les cartes
  n'affichent que `thumb`), `fetchKnowledgeEntry(id)` renvoie la fiche
  complète à l'ouverture du lecteur.
- **Images en data URL, jamais en fichiers** (`lib/knowledge.ts::encodeImage`) :
  recompression canvas en WebP (repli JPEG si le moteur ne sait pas encoder le
  WebP — cas possible en WKWebView) à 1600 px + aperçu 480 px. Mesuré : PNG de
  976 ko → 12 ko. Import par bouton, **glisser-déposer** sur la vue ou
  **collage ⌘V**. Avantage : aucun chemin à re-résoudre, aucun scope d'asset
  Tauri, comportement identique démo/natif.
- **Croquis** (`src/components/SketchPad.tsx`) : feuille logique 1440×900,
  tracé stocké en **vectoriel** dans `data` (donc ré-éditable), rendu PNG dans
  `media`. Fond « papier » opaque et encres concrètes : l'export reste lisible
  quel que soit le thème. La gomme peint en couleur du papier (pas de
  `destination-out` qui trouerait le fond). ⌘Z annule, Échap ferme.
- **Lecteur immersif** : superposition verre, titre éditable, sélecteur de
  thème, épingle, tags, bascule **Lire / Modifier** (réutilise
  `RichNoteEditor`), ←/→ pour feuilleter la sélection courante, Échap ferme.
  Enregistrement auto débouncé (600 ms) + flush garanti à la fermeture.
- **Vue hors `ResizableGrid`** (comme NotesView) : layout plein écran à deux
  colonnes (rail de thèmes + grille `auto-tiles-lg`), chacune avec son scroll.
- Câblage : `View` + `ITEMS` + `CATEGORIES` (Sidebar), `MODULE_IDS`
  (uiConfig, donc renommable/masquable dans Personnaliser), route lazy dans
  App.tsx, action `nav.knowledge` dans la palette ⌘K.

## Savoir : unification autour de la note (2026-07-21, soir)
L'onglet n'a plus **qu'une seule unité de création : la NOTE**. Les entrées
séparées (lien, image, croquis) ont disparu de l'UI ; tout s'insère DANS le
corps d'une note.
- **Éditeur de blocs** : `src/components/NoteComposer.tsx`. Un bouton
  « Insérer » discret (image · croquis · lien · titre · sous-titre · texte ·
  listes · **case à cocher** · citation · séparateur) et une **bulle de mise
  en forme** qui n'apparaît que sur une sélection (gras/italique/souligné/
  barré, 6 couleurs de thème, lien ⌘K, effacer le format). Rien d'autre à
  l'écran : c'est l'esprit Apple Notes / Notion.
- Images : bouton, **collage ⌘V** ou **glisser-déposer** directement dans la
  note (recompression `encodeImage`). Croquis : `SketchPad` inséré en figure,
  **traits conservés en vectoriel** dans `data-sketch` → double-clic pour le
  rouvrir et le modifier. Liens : ouverts dans le navigateur système
  (`openExternal`), jamais dans la webview.
- **Le corps peut peser des centaines de ko** (images en data URL) → migration
  `014_knowledge_text.sql` (v14) : colonne `text` = texte brut matérialisé.
  La liste ne charge plus `body` (voir `LITE_COLUMNS` dans repo.ts) mais
  `text` + `thumb` + `LENGTH(body) AS body_len`. Recherche et extraits vivent
  sur `text`, dérivé une seule fois par enregistrement (jamais à la frappe),
  comme la vignette de couverture (première image du corps).
- **Rétrocompatibilité** : `kind`, `url`, `media`, `data` restent en base ;
  `legacyBodyOf()` reconstruit le corps d'une fiche créée avant l'unification
  (média → figure, lien → `<a>`), et la vue ré-indexe ces fiches une fois au
  montage avec `updateKnowledgeEntry(..., { touch: false })` — sans fausser
  `updated_at` ni réordonner la liste.
- ⚠️ **Piège corrigé** : le lecteur porte `animate-fade-up`, donc un
  `transform`, donc il devient le bloc conteneur de ses descendants
  `position: fixed`. La bulle de mise en forme et la feuille de croquis sont
  donc rendues via `createPortal(..., document.body)` — sinon décalage de
  plusieurs centaines de pixels / plein écran limité à la carte.
- ⚠️ **Piège corrigé** : le dégradé `--card-bg` laisse transparaître la vue
  floutée quand une carte flotte au-dessus d'un `backdrop-filter`. Nouvelle
  classe **`.card-solid`** (aplat `--color-surface`) pour les surfaces de
  modale (lecteur de note, feuille de croquis).
- `src/lib/richtext.ts` : normalisation des couleurs (extraite de
  `RichNoteEditor`, partagée), `plainText`, `firstImageSrc`, `countRich`.

## Widgets Trading : audit & correctifs (2026-07-21, soir)
Les règles de structure des widgets (cf. « Widgets : structure réelle ») sont
désormais appliquées à toute la vue Trading — chaque panneau **restructure**
son contenu au lieu d'étirer un cadre vide :
- **Régions extensibles** déclarées partout : `panel-scroll` (tracker live,
  stats mensuelles, par setup, liste des trades), `panel-chart` (équity),
  `panel-stretch` (bandeau de stats R). Vérifié en réduisant la liste des
  trades de 504 → 248 px : la carte remplit exactement l'empreinte, la liste
  défile dedans (scrollHeight 496 / clientHeight 246), zéro contenu coupé.
- **Contraintes** : `minW` 4–5 colonnes et `minH` 130–220 px selon le panneau
  (le moteur remonte encore ce plancher sur fenêtre étroite via `MIN_PANEL_PX`).
- **Layouts internes refaits** pour ne plus pouvoir se chevaucher :
  « par setup » passe en deux lignes (nom tronqué + chiffres, jauge dessous) ;
  la liste des trades est en `flex-wrap` (notes et actions passent à la ligne),
  date en `whitespace-nowrap` ; le tableau mensuel défile en X (`table-scroll`)
  ET en Y (`panel-scroll`) dans la carte ; niveaux et boutons du tracker live
  se replient au lieu de pousser la rangée hors cadre.
- **`.panel-chart` durci** (`index.css`) : `min-width: 0` — recharts pose une
  largeur explicite sur son SVG, qui devenait la taille min-content de l'item
  flex et empêchait la carte de rétrécir — plus `overflow: hidden` pour la
  frame de latence avant re-mesure. Correctif global : profite aussi aux
  graphiques de Today et Performance.
- Vérifié à 820 px comme à 1600 px de large : 0 débordement horizontal sur
  les 6 panneaux, 0 erreur console.
- ⚠️ **Piège de vérification** : dans le preview navigateur, les callbacks
  `ResizeObserver` ne sont livrés qu'au rendu d'une frame — tant qu'aucune
  capture n'est prise, un graphique semble « figé » à sa taille initiale.
  Ce n'est pas un bug de l'app : prendre une capture d'écran avant de mesurer.

## Anti-superposition des poignées + refonte Timer (2026-07-23)
Deux chantiers, front-only (aucun Rust / migration / capabilities → pas de rebuild
natif obligatoire, mais réinstaller pour voir dans l'app).

1. **Superposition barre de poignées ↔ en-têtes de widgets.** Au survol d'un panneau
   de grille, la barre « verre » (⠿ déplacer · ✕ masquer, + ⟲ si redimensionné,
   `right-1.5 top-1.5`) recouvrait les contrôles placés en haut à droite d'un widget
   (stepper Objectif quotidien, formulaire Habitudes, « baseline réaction » du Benchmark,
   boutons de période / select / formulaire de Performance, bouton « Refaire le test »
   de l'alcootest…), rendant le bouton le plus à droite incliquable.
   - **Correctif générique, sans toucher au moteur de grille ni à l'esthétique au repos** :
     nouvelle classe `.rgrid-head` (`index.css`) — au survol du panneau
     (`.group\/panel:hover`), la rangée d'en-tête réserve `padding-right` de la largeur
     de la barre (`--rgrid-handle-w`), donc son cluster de droite **glisse vers la gauche**
     le temps du survol (transition `--dur-base`). Au repos : padding nul → **aucun**
     changement de layout/rendu. La largeur est fournie par `ResizablePanel` via la var
     inline `--rgrid-handle-w` (`override ? 5.25rem : 4rem`, selon 3 ou 2 poignées).
   - Classe posée sur les en-têtes à contrôles droite : `timer-goal`, `journal-entry`,
     `journal-habits`, perf `completion/goals/trading/metrics`, `BenchmarkPanel`
     (+ `min-w-0 truncate` sur le h2 et `shrink-0` sur la baseline), `LiveTracker`,
     instruments Market-Brain (`BriefingInstrument`), et les 2 bandeaux `PreSessionCheck`.
   - Vérifié en démo (survol) : Objectif quotidien, Habitudes, Benchmark, alerte
     pré-session → contrôle décalé, barre ne recouvre plus rien ; repos identique. tsc ✓
     vite build ✓. **Restant assumé** : la 1ʳᵉ ligne des panneaux 100 % liste (tasks-list,
     trading-list…) peut passer sous la barre au survol — condition mineure préexistante,
     hors périmètre signalé (les en-têtes étaient la demande).

2. **Refonte Timer — minimaliste (retrait mode concentration + tout le son).**
   - `TimerPanel.tsx` : supprimés la bascule **« mode concentration »**, la bascule
     **« carillon de fin de session »** et **toute la section « ambiance sonore »**
     (`AmbientControl`) — dans le lanceur ET la vue session. Reste : presets, durée,
     tâche liée, une seule bascule « pause auto », bouton Lancer, pied « cycles ».
   - `useFocus.ts` : retiré `playChime` / `startActiveMix` / `stopAllTracks` et la lecture
     des réglages `timer_concentration` / `timer_sound_end`. **Le plein écran est
     conservé** (`FocusOverlay`, bouton « Plein écran », `openOverlay`) — c'est un simple
     compte à rebours sans distraction, ouvert à la demande.
   - **Fichiers morts supprimés** (cluster son, plus aucune référence front) :
     `AmbientControl.tsx`, `lib/soundLibrary.ts`, `lib/soundMixer.ts`, `lib/audio.ts`.
     Rust `import_audio` + scope asset `$APPDATA/audio/**` étaient restés **dormants**
     — **supprimés le 2026-07-26** (code mort : seul `import_screenshot` est appelé).
     Réglages orphelins (`sound_*`, `timer_concentration/_sound_end`) inertes en base.
   - Textes nettoyés : tips `TimerCard`/`TimerPanel`, description sidebar du module Timer.
   - Vérifié en démo : lanceur épuré, lancement/pause/terminer OK, plein écran OK
     (aucun son). tsc ✓ vite build ✓ (0 chunk `AmbientControl`, `TimerPanel` 7.9 kB).

## Benchmark : test Séquence réparé + page enrichie (2026-07-23, soir)
Front-only (aucun Rust / migration).

1. **Test « Mémoire visuelle » (Séquence) — 3 bugs de retour utilisateur.**
   `BenchmarkTests.tsx::SequenceMemoryTest` :
   - **Aucun retour sur un clic juste** : un appui correct ne faisait que
     `setStep(next)` — ni flash, ni son. On ne savait pas si le clic était pris.
     → la case s'allume 190 ms **et joue sa note** à chaque appui.
   - **La case fautive n'était jamais visible** : `setWrong(tile)` était suivi
     immédiatement de `finish()`, qui passe en phase "done" et démonte la grille.
     → l'erreur est désormais tenue **800 ms** (case rouge + grille verrouillée)
     AVANT l'écran de score. Vérifié en démo : fond
     `color-mix(… var(--color-red) 60% …)`, bordure `var(--color-red)`, voisines
     intactes, score encore masqué pendant la fenêtre puis affiché après.
   - **Timeout non suivi** : le `setTimeout` de 260 ms n'était pas poussé dans
     `timers` → survivait au démontage du modal. Tout passe maintenant par `push()`.
   - **Cas limite trouvé au test** : après un niveau réussi la grille restait
     cliquable pendant l'arpège, et le clic était évalué contre l'ANCIENNE
     séquence (échec injustifié) → on repasse en phase "show" immédiatement.
2. **Son des touches** (demandé) : `src/lib/tones.ts` — Web Audio minimal et
   **autonome**, une note par case (gamme pentatonique : toute séquence sonne
   juste), + buzz d'erreur et arpège de niveau. `unlockTones()` est appelé sur le
   clic « Démarrer » (WKWebView n'autorise l'audio que sur geste utilisateur).
   ⚠️ C'est du **feedback de jeu**, sans réglage ni persistance : ce n'est PAS une
   résurrection du système d'ambiance sonore retiré le 2026-07-23. Un bouton
   muet local au test est disponible (icônes `IconSound` / `IconSoundOff`).
3. **Jouable au clavier** : touches 1–9 = cases (repère chiffré discret sur
   chaque case, masqué quand elle s'allume). Grille passée en `grid-cols-3`
   STRICT — l'épreuve n'a de sens qu'en carré, et on est dans un modal, pas dans
   un widget redimensionnable (l'exception à la règle `.auto-tiles*` est assumée).
4. **Page Benchmark enrichie** (`BenchmarkPanel.tsx` + helpers `benchmark.ts`) :
   - **Forme du jour** par test : pastille d'écart vs baseline personnelle,
     `dailyForm()` — `deltaPct` est **déjà orienté performance** (positif = mieux),
     donc pas de piège sur la réaction où « plus bas = mieux ». États : `non testé`,
     valeur brute si < 3 jours d'historique, sinon ±% vert/rouge.
   - **Moyenne enfin affichée** : `benchStat.avg` était calculé depuis toujours
     mais jamais rendu. Ligne `moy. · dernier · N essais`.
   - **Tendance pour les TROIS tests** (avant : réaction seule) via
     `dailyTrend()` + sélecteur segmenté ; couleur et format suivent le test,
     axe Y entier pour mémoire/séquence. État vide explicite si < 2 jours.
   - **Repère indicatif** par test (`BENCH_META.reference`, affiché « ≈ ») pour
     situer un score — libellé volontairement non normatif.
   - `mt-4` retiré de la racine du panneau (règle : jamais de `mt-*` sur la
     racine d'un widget de grille).
   Vérifié en démo : jeu complet clavier + souris, erreur visible, sélecteur de
   tendance, 0 erreur console. tsc ✓ vite build ✓.

## Mode fenêtré / split-screen + purge Jarvis (2026-07-26)

### 1. Bug signalé : bandeau de perf illisible en demi-écran
`PerfStrip` (streak · 7 jours · focus · trading) utilisait `.auto-tiles`
(piste mini **120px**). Or une de ces tuiles = padding 32 + donut/icône 48 +
gouttière 12 + un label (« focus / 1 h », « trading 7 j ») ⇒ **~180px
incompressibles**. À 120px, `auto-fit` laissait donc tenir 4 colonnes dans une
largeur où elles ne rentrent pas → label tronqué en « TRA… », chiffre chevauché.
**Correctif** : nouvelle classe `.perf-tiles` (piste mini **190px**) dans
`index.css`. `auto-fit` retombe seul à 2 puis 1 colonne, sans breakpoint de
viewport, et garde 4 colonnes dès ~800px → **plein écran inchangé**.
⚠️ Piège rencontré : une première tentative par **container query** a échoué
deux fois — d'abord parce que `.perf-strip-cq .auto-tiles` (combinateur
descendant) ne matchait pas, les deux classes étant sur le MÊME élément ;
ensuite parce qu'un élément **ne peut pas interroger son propre conteneur**,
donc il fallait un div wrapper… lequel casse le contrat `panel-stretch` du
moteur de grille. Conclusion : **pour ce cas, dimensionner la piste `auto-fit`
est la bonne réponse ; la container query est un détour fragile.**

### 2. Bug plus grave trouvé en auditant : texte en colonne d'une lettre
`PreSessionCheck` (bannière « alcootest du trader ») : icône + texte
(`min-w-0 flex-1`) + bouton `shrink-0`. En fenêtre étroite le bloc de texte
tombait à **~25px** et s'affichait **une lettre par ligne** — illisible.
Ajouter `flex-wrap` NE SUFFIT PAS : un item `min-w-0` se comprime indéfiniment
au lieu de déclencher le retour à la ligne.
**Règle générale à retenir** : c'est la **base flex** (`basis-[Nrem]`) qui
décide du repli, pas `min-width`. Icône+texte sont donc regroupés dans un item
`flex min-w-0 flex-1 basis-[13rem]` ; sous ~13rem le bouton passe à la ligne,
et `min-w-0` laisse le bloc rétrécir une fois seul sur sa ligne.

### 3. Audit global : contrôles rendus INCLIQUABLES par `overflow-x: clip`
Mesuré par script (pas à l'œil) sur les 14 vues à 500 et 720px de large :
plusieurs rangées de contrôles sortaient de leur panneau, où l'`overflow-x:
clip` du wrap de grille les rendait **invisibles et donc inutilisables**
(ex. Performance : `<input>` à 528px et bouton « Ajouter » à 602px pour une
fenêtre de 500px). Motif systématique : **rangée `flex` sans `flex-wrap`,
largeurs fixes (`w-44`/`w-20`/`w-36`) sans `min-w-0`, et `shrink-0` sur un
groupe qui doit pouvoir se replier.**
Correctifs :
- **`.rgrid-head` porte désormais `flex-wrap: wrap` + `row-gap: .5rem`**
  (`index.css`) → toutes les rangées d'en-tête de panneau se replient d'office.
  Le repli ne se déclenche que s'il manque réellement de la place : en plein
  écran, rendu strictement inchangé. `row-gap` n'est qu'un repli, les
  utilitaires `gap-*` de Tailwind (couche utilities) gardent la priorité.
- `flex-wrap` + `min-w-0` ponctuels : `PerformanceView` (formulaire Métriques,
  sélecteur de période), `TasksView` (filtres, formulaire tag), `JournalView`
  (humeur, énergie, formulaire habitude), `GoalsView` (rangée d'objectif +
  `basis-[14rem]` sur le titre), `SettingsView` (thème, fournisseur LLM),
  `AdminView` (densité), `BenchmarkPanel` (sélecteur de tendance).
- ⚠️ **`shrink-0` empêche le repli interne** : sur le sélecteur de tendance du
  Benchmark, le groupe restait à 217px dans un parent de 152px (donc ses
  boutons ne pouvaient pas se replier) tant que `shrink-0` était là. Remplacé
  par `min-w-0`. À vérifier sur tout groupe `shrink-0 flex-wrap` — c'est
  contradictoire.

**Vérifié** (script de mesure, viewport 500px et 720px, 14 vues) : 0 contrôle
clippé, 0 débordement horizontal de page (`scrollWidth == clientWidth`),
0 troncature sévère. Les seules troncatures restantes portent une classe
`.truncate`/`.clamp-*` explicite (titres de tâches/objectifs et chips de tag
saisis par l'utilisateur) = comportement voulu. tsc ✓ vite build ✓ cargo check ✓.

**Dette assumée** : la sidebar garde une largeur fixe (~232px, soit 46 % d'une
fenêtre de 500px). Un repli automatique de la sidebar en fenêtre étroite
améliorerait nettement l'ergonomie, mais c'est un changement de UX à part
entière — non fait ici pour ne pas toucher au design principal.

### 4. Vérification Jarvis / whisper (demandée)
Contrôle demandé sur Shale : **le fork était déjà entièrement propre** — pas de
`voice.rs`, pas de `whisper-rs`/`cpal` dans `Cargo.toml`, pas de raccourci
`alt+j`, 0 occurrence côté front. Les mentions restantes dans ce fichier
étaient de la **doc héritée de Second Brain, factuellement fausse pour Shale** :
corrigées (voir plus haut).
Seul vrai reliquat trouvé et supprimé : **`import_audio`** (vestige du mixeur
d'ambiance), du **code mort** — seul `import_screenshot` est appelé par le
front — ainsi que le scope asset `$APPDATA/audio/**` de `tauri.conf.json` et la
dev-dep `hound` de `Cargo.toml`.
Vérifié : `grep -riE "jarvis|whisper|voice|import_audio"` sur `src/`,
`src-tauri/src/`, `capabilities/`, `tauri.conf.json`, `Cargo.toml` →
**0 occurrence**. `cargo check` sans warning.
⚠️ **Ces correctifs UI sont partagés avec Second Brain** (`~/Desktop/appli claude`) :
les fichiers concernés étaient identiques byte-for-byte et ont été resynchronisés.
`AdminView.tsx` et `SettingsView.tsx` ont en revanche du code PROPRE à Shale
(panneau « textes », panneau « compte »/`useSession`) → **ne jamais les copier
en bloc depuis Second Brain**, appliquer les changements ligne par ligne.

## Essai gratuit 7 jours + typographie unifiée (2026-07-27)

1. **Essai de 7 jours, sans Stripe.** `shale-site/supabase/schema.sql` : colonne
   `subscriptions.trial_ends_at`, trigger `handle_new_user` qui ouvre l'essai à la
   création du compte (`status='trialing'`, +7 j, plan mémorisé depuis
   `raw_user_meta_data`), et surtout la **vue `public.my_subscription`**
   (`security_invoker`) qui recalcule le statut À CHAQUE LECTURE : passé
   `trial_ends_at`, elle renvoie **`expired`**. L'essai expire donc côté SERVEUR —
   reculer l'horloge de la machine ne prolonge rien.
   - `src/lib/auth/supabase.ts` : `SubStatus` gagne `expired` ; `Subscription`
     gagne `trial_ends_at` / `trial_days_left` ; **`fetchSubscription` lit la vue
     `my_subscription`, plus la table**.
   - `SubscriptionRequired.tsx` : discours distinct quand l'essai vient de finir
     (« Ton essai est terminé », lecture seule, bouton « Choisir ma formule »).
   - `AuthGate.tsx` : bandeau `TrialBanner` pendant l'essai (jours restants,
     ambre à ≤ 2 jours, lien vers l'espace compte). Jamais affiché pour un abonné.
   - Durée en un seul endroit qui fasse foi : `public.trial_length()`. Les copies
     d'affichage (`TRIAL_DAYS` de `shale-site/vitrine/src/lib/compte.ts`,
     `config.trialDays` de `shale-site/vitrine/src/content.json`) doivent rester alignées.

2. **Typographie : Instrument Sans partout.** Outfit + DM Sans remplacés par une
   seule grotesque variable (`@fontsource-variable/instrument-sans`), la même que
   le site vitrine. Motif : Helvetica Neue (choix de la maquette du site) n'existe
   que sur macOS et retombait sur Arial ailleurs ; Instrument Sans est OFL,
   auto-hébergée, et très proche d'Helvetica Neue. `--font-display` et
   `--font-body` pointent désormais tous deux dessus (`src/index.css`, DESIGN.md
   mis à jour). Les tailles/tracking existants sont inchangés.
   ⚠️ Changement visuel global → à relire dans l'app installée.

## Logo « Strates » propagé à l'app (2026-07-27, soir)

Le site vitrine et l'espace compte portaient déjà la marque « Strates » depuis la
refonte ; **l'app était restée aux anciens chevrons**. Aligné :
- `src/components/auth/ShaleMark.tsx` — réécrit avec la géométrie **identique**
  à `shale-site/vitrine/src/components/Logo.astro` (les deux marques ont fusionné le 2026-08-11)
  (`paintMarks`) : grille 24×24, plaque rx 5.3, barres `x=4`, `y=3/8/13/18`,
  largeurs `16 · 10.88 · 16 · 7.36`, épaisseur 3, rx 1.5. **Les couches courtes
  s'alignent à GAUCHE.** Utilisé par LoginScreen, AuthGate, Onboarding,
  SubscriptionRequired.
- `src-tauri/icons/` — **régénéré** depuis `~/Desktop/export/shale-appicon-1024.png`
  via `npm run tauri icon` (icns/ico/png + android/ios). L'icône du tray suit
  automatiquement (`app.default_window_icon()`). → rebuild + réinstallation.

**Couleur de l'accent, choix assumé** : la marque prend l'accent de SA surface —
`var(--color-blue)` (#4d8dff sombre / #1b62e5 clair) dans l'app, cyan
(`oklch(0.72 0.13 225)` / `#3aa7dd`) sur le site et sur l'icône du bundle. Motif :
la règle « jamais d'hex, uniquement des tokens » du design system. Conséquence
visible : l'icône du Dock est cyan, la marque dans l'app est bleue. Si l'on veut
la parité exacte, ajouter un token de marque dédié dans `index.css` plutôt que de
coder la couleur en dur.

Sources des visuels : `~/Desktop/export/` (jeu le plus récent) et
`~/Desktop/Shale/logos/` — mêmes fichiers sauf `avatar-accent` et `avatar-rond`,
plus récents dans `export/`.

## Notifications intelligentes (2026-07-27)

Moteur de rappels **100 % local** en Rust : `src-tauri/src/notifications/`
(**lire son `README.md`** — règles, ajout d'une règle, configuration, pièges).
Deux surfaces : notification système macOS + centre in-app (cloche de la sidebar).

- **Trois règles** livrées, chacune un fichier dans `rules/` + une ligne dans
  `REGISTRY` : `streak_at_risk` (série habitudes **ou** tâches en danger, 21 h),
  `habits_pending` (habitudes non cochées, 20 h), `inactivity` (N jours sans
  ouvrir une fiche du Savoir, défaut 3). La 1ʳᵉ **met en sourdine** la 2ᵉ quand
  c'est la série d'habitudes qui est menacée (`Candidate::supersedes`).
- **Le moteur** (`engine.rs`) porte TOUTES les contraintes transverses — fenêtre
  horaire, plafond quotidien, cooldown, idempotence, regroupement en une notif de
  synthèse. Une règle dit seulement si son constat est vrai. Fonction **pure** :
  `now` est un champ d'`EvalContext`, jamais un appel système → testable avec une
  fausse horloge (79 tests, `cargo test --lib`).
- **Persistance** : `notifications.json` (app_data_dir), préférences + journal +
  `last_run_at`, **écrit uniquement par le Rust** (écriture atomique, fichier
  corrompu mis de côté en `.corrupt.json`, jamais écrasé). La base n'est lue
  qu'en `SELECT`. Une seule clé ajoutée à `settings` : `knowledge.last_viewed_at`
  (écrite par `markKnowledgeViewed()` à l'ouverture d'une fiche du Savoir).
  **Aucune migration SQL.**
- **Front** : `src/lib/notifications.ts` (façade + hook `useNotifications`),
  `src/components/NotificationBell.tsx` (cloche + badge + panneau **en portal** —
  la sidebar est un contexte d'empilement, un panneau posé dedans passerait sous
  le contenu), section « notifications » de `SettingsView.tsx`. Ajouter une règle
  côté Rust sans toucher à `RULE_META` reste sans danger : elle apparaît avec un
  interrupteur et un cooldown génériques.

⚠️ **Trois pièges de plateforme, détaillés dans le README du module :**
1. **La base est en WAL** → une connexion `read_only(true)` ne peut pas créer le
   `-shm` et échoue sur `SQLITE_CANTOPEN (14)` tant que le front n'a pas ouvert
   `shale.db` — soit exactement le cas visé. `data.rs` ouvre donc en RW et
   n'émet que des `SELECT` (discipline, pas garantie du mode d'ouverture).
2. **`Instant` ne compte pas la veille sur macOS** → un `sleep(15 min)` posé
   avant 3 h de veille se réveille 3 h en retard. Le planificateur dort par
   tranches de 60 s et décide sur l'**horloge murale**.
3. **macOS ne signale pas un refus de notifications** : dans
   `tauri-plugin-notification`, `permission_state()` renvoie toujours `Granted`
   sur desktop et `show()` jette le résultat de l'envoi. D'où le champ
   `handed_to_system` (« remise au système », pas « affichée ») et le bouton
   « Envoyer un test » comme seul diagnostic honnête.

**Changement de cycle de vie** (`lib.rs`) : fermer la fenêtre principale **en
mode fenêtré** la CACHE désormais (l'app vit dans le tray, le planificateur
tourne) ; **en plein écran** elle quitte comme avant — c'est ce mode qui
produisait l'espace macOS fantôme. Désactivable (« garder Shale actif en
arrière-plan »). `RunEvent::Reopen` géré (clic sur l'icône du Dock). La barre de
titre passe en `data-tauri-drag-region="deep"` : avec l'attribut nu, seul un clic
DIRECT sur l'élément porteur déclenche le drag, donc le titre n'était pas une
poignée — les éléments cliquables (la cloche) restent exclus du drag.

⚠️ **`task_streak.rs` est un PORTAGE de `src/lib/logic.ts`** (`isDueOn`,
`dayStat`, `todayTasks`, `computeStreak`), assumé après arbitrage. **La source de
vérité reste le TypeScript** : toute évolution de ces fonctions doit être
répercutée. Piège vérifié : les deux call sites du front utilisent
`pctOfList(todayTasks(...))` et NON `dayStat` pour le jour en cours — porter
`dayStat` aurait fait diverger la notification de ce qu'affiche l'écran.

Dette connue : `src-tauri/examples/transcribe.rs` importe `whisper_rs`/`hound`,
qui ne sont plus des dépendances → **`cargo check --all-targets` échoue** (déjà
le cas avant ce chantier ; l'audit du 2026-07-26 ne couvrait pas `examples/`).
Utiliser `cargo check --lib --tests --bins`.

## Deux offres + gating trading (2026-08-02)

L'abonnement passe d'un niveau unique à **deux offres**, et les modules trading
sont gatés en conséquence.

  `shale`        12 €/mois · 96 €/an   → productivité
  `shale_trade`  19 €/mois · 180 €/an  → + Market Brain, tracker live, journal R,
                                          calculateur de position, perf trading

**Pendant l'essai de 7 jours, TOUT est ouvert** quel que soit le tier choisi à
l'inscription — c'est le levier de conversion, pas un bug. La règle est écrite
dans la base (`my_subscription.has_trading`), pas seulement côté client.

### Où vit quoi
- **Le tier est en Postgres, PAS en SQLite.** `subscriptions` vit chez Supabase
  (`shale-site/supabase/schema.sql`) : colonnes `tier` et
  `billing_period`, migration rejouable dans `supabase/migrations/001_tiers.sql`.
  **Aucune migration `src-tauri/migrations/` n'a été ajoutée** — la base locale
  ne stocke aucun droit. ⚠️ Arbitrage assumé : les comptes existants repartent
  sur `shale` (aucun client payant au 2026-08-02) ; le bloc « grandfathering »
  du fichier de migration est prêt mais **désactivé**.
- **`src/lib/features.ts` = la frontière, SOURCE UNIQUE.** `TRADING_VIEWS`,
  `TRADING_WIDGETS`, `TRADING_PANELS`, l'argumentaire du paywall. Ne jamais
  tester `view === "market"` ailleurs : ajouter un module trading se fait ici.
- **`src/lib/entitlements.ts` = le droit.** `useEntitlements()` →
  `{ tier, isTrialing, hasTrading, billingPeriod, trialDaysLeft }`, dérivé de
  l'abonnement porté par le contexte `AuthGate` (aucun fetch supplémentaire).
  Repli de calcul local si la base est antérieure à la migration 001.

### Le gating est une GARDE DE NAVIGATION, pas un masquage
`App.tsx` expose `navigate()` ; **`setView` reste privé et ne doit jamais être
passé à un enfant**. Toutes les portes passent par là : sidebar, palette ⌘K,
poignées ↗ des widgets, boutons « Trader » de la vue Position, actions du
Journal. Un `useEffect` de repli renvoie sur `today` si l'offre change en cours
de session (fin d'essai détectée par `recheck`). Il n'y a pas d'URL dans l'app —
c'est cette garde qui en tient lieu.

Surfaces gatées, toutes dérivées de `features.ts` :
sidebar (grisée + cadenas + info-bulle « Inclus dans Shale Trade », **jamais
`disabled`** : un bouton désactivé ne reçoit pas le survol, donc perdrait la
bulle qui explique le cadenas) · `UpgradeModal.tsx` (paywall, en portal) ·
widget `position` du dashboard · tuile « trading 7 j » de `PerfStrip` · panneau
`perf-trading` de Performance · sections « market-brain » et « tracker » de
Réglages · actions ⌘K portant `requires: "trading"`.
⚠️ Les panneaux gatés sont **retirés du rendu**, pas masqués : un
`ResizablePanel` simplement caché réapparaîtrait dans les chips « + <titre> »
sous la grille.
⚠️ `trade.presession` (test de réaction) reste OUVERT malgré sa catégorie
« trading » — c'est le même test que le module Benchmark, qui est productivité.
D'où le drapeau `requires` par action, et non un filtre sur `category`.

**Tester sans backend** : Réglages → compte → « offre simulée (démo) »
(Shale · Shale Trade · essai). Visible uniquement quand `AUTH_CONFIGURED` est
faux. Recharge la fenêtre, car `useAuth` fabrique l'abonnement démo au montage.

### Clé LLM : trousseau + point d'extension
- `src/lib/llm/provider.ts` — **interface unique** d'accès au modèle.
  `resolveCredentials()` renvoie des candidats ORDONNÉS `{ vendor, source, key }`
  avec `source: 'user_key' | 'shale_managed'`. `market/llm.ts` les consomme et
  ne sait plus d'où vient le droit d'appeler. **`shale_managed` n'est PAS
  implémenté** : le point d'extension (`MANAGED_ENDPOINT`) est commenté avec les
  trois étapes à suivre le jour de l'add-on « clé Shale incluse ».
- `src/lib/llm/secrets.ts` + `src-tauri/src/secrets.rs` — les clés passent par
  le **trousseau macOS** (crate `keyring`, service `com.atnfx.shale`), avec
  **repli sur la table `settings`** si le trousseau ne répond pas (preview
  navigateur, trousseau verrouillé). Une clé déjà en clair est **migrée à la
  première lecture** puis effacée de la base — rien à ressaisir. Réglages dit
  honnêtement où la clé est rangée plutôt que de promettre un chiffrement qui
  n'a pas eu lieu. ⚠️ Nouvelle dépendance Rust → **rebuild natif obligatoire**.

### Contrôle
`npm run i18n:check` (nouveau : `tools/i18n-check.mjs`, l'ancien script de
session est devenu permanent) — 0 clé manquante. tsc ✓ · vite build ✓ ·
cargo check ✓ · 79 tests Rust ✓ · parcours démo vérifié dans le navigateur sur
les trois états (shale / shale_trade / essai), 0 erreur console.

## Reste à faire (phase G + idées)
- Icône app custom, export/backup. (~~wake word "Jarvis"~~ : abandonné, aucun vocal dans Shale.)
- Market Brain : bloc `sentiment` (SSI retail forex) vide — source à trouver ;
  `fed_bias` toujours "n/a" ; notification native à la génération du briefing du matin
  (le socle existe désormais : ajouter une règle dans `notifications/rules/`).
- Tracker live : édition du SL en cours de position (trailing) ; export CSV des
  positions archivées ; drawdown affiché en % du capital (aujourd'hui en R).

## Bilingue FR / EN (2026-07-28)

**Sélecteur dans Réglages → « langue » : Système · Français · English.** Défaut =
langue de macOS (`navigator.language`), anglais si elle n'est ni FR ni EN.

### Mécanique
- `src/lib/i18n/index.ts` — `t()`, `tp()` (pluriel), `pick()`, `localeTag()`,
  `formatDate/Time/Number`, hooks `useLang()`/`useLangPref()`.
  **La clé de traduction est la phrase FRANÇAISE** (`t("Nouvelle tâche")`) : le code
  reste lisible, et une chaîne non traduite retombe sur le français plutôt que
  d'afficher une clé technique. Dictionnaire anglais : `src/lib/i18n/en.ts` (~800 clés).
- Persistance : **localStorage `shale.lang`** (lu SYNCHRONEMENT au premier rendu,
  donc avant la base et avant le login), recopié dans le setting `ui.lang`.
- `LangRoot` (`main.tsx`) **remonte l'arbre React** au changement de langue via une
  `key` : garantit que même les valeurs mémorisées (useMemo, état initial) repassent.
- Mot trop générique pour servir de clé (« notes », « navigation », qui sont aussi
  des identifiants de vue) : suffixe de contexte — `t("notes|palette")`.

### ⚠️ Pièges à connaître
1. **Jamais de `t()` dans une constante de MODULE.** Elle est évaluée à l'import,
   donc figée dans la langue de départ. Les tables (`ITEMS`/`DESCRIPTIONS`/`CATEGORIES`
   de Sidebar, `ACTIONS`, `WIDGET_LABELS`, `SESSIONS`, `MODULE_LABELS`) gardent la
   phrase FRANÇAISE comme valeur et sont traduites **à l'affichage**. Les petites
   tables locales sont devenues des fonctions (`benchMeta()`, `ruleMeta()`,
   `defaultTexts()`, `priorities()`, `recModes()`, `statusMeta()`, `tabHints()`…).
2. **Ne jamais nommer une variable locale `t`** : elle masque la fonction i18n.
   Les lambdas `.map((t) => …)` ont été renommées (`tag`, `topic`, `test`).
3. **Mode démo** : `lib/demo.ts` construit son jeu de données au chargement du
   module → changer de langue **recharge la fenêtre** (`SettingsView::changeLang`,
   uniquement quand `!isTauri`). En natif, le remontage suffit.
4. **Market-Brain** : `prompt.ts` demande au LLM d'écrire les champs de texte libre
   en anglais, mais **les énumérations restent en français** (`bias`
   haussier/baissier/neutre, `conviction` faible/moyenne/forte) — ce sont des
   identifiants validés par `llm.ts` et utilisés pour la couleur des chips. Elles
   sont traduites à l'affichage.
5. **Notifications Rust** : le planificateur tourne fenêtre fermée, sans accès au
   localStorage. La langue est **poussée** dans `notifications.json`
   (`Prefs.lang`, via `syncLang()` appelé au changement de langue) et les trois
   règles choisissent leur formulation avec `ctx.pick(fr, en)` / `ctx.lang()`.

### Contrôle
`node /chemin/audit.mjs src` (script de session) vérifie que **toute clé passée à
`t()` existe dans `en.ts`** — 0 manquante au 2026-07-28. En dev, `t()` journalise
aussi les traductions manquantes dans la console.
Vérifié : tsc ✓ · vite build ✓ · cargo check ✓ · 79 tests Rust ✓ · parcours démo
FR + EN dans le navigateur ✓.

## Synchronisation cloud chiffrée (chantier en cours, depuis le 2026-08-02)

Branche `sync-chiffree`. Objectif : sync **offline-first, chiffrée de bout en bout**,
entre appareils, sans rien changer au comportement actuel — SQLite local reste la
source de vérité pour toutes les lectures et écritures. Le réseau n'est JAMAIS sur le
chemin critique d'une action utilisateur.

### Périmètre : TOUTE l'app
**Source unique : `src/lib/sync/scope.ts`.** Aucun autre fichier ne décide de la portée.
Les 19 tables de données y sont listées **dans l'ordre d'application (parents avant
enfants)** ; les exclusions y sont listées AVEC leur motif, et un test échoue si une
table de la base n'est ni synchronisée ni explicitement écartée — une table ajoutée plus
tard ne peut donc pas disparaître en silence de la sauvegarde cloud.

Exclusions, dont aucune n'est un choix de périmètre :
- `notes_fts` (+ ses tables internes) — index FTS5 **dérivé** de `notes`, reconstruit par
  ses propres triggers sur chaque appareil. Le transporter corromprait l'index.
- `goal_progress_log` — ré-écrit à chaque lancement par `snapshotGoals()`.
- `market_briefings` — régénérable, purgé à 7 jours, gros payloads JSON.
- `sync_*`, `_sqlx_migrations`, `sqlite_sequence` — plomberie.

**`settings` est synchronisé INTÉGRALEMENT, sauf liste d'exclusion** (`SETTINGS_EXCLUS`).
⚠️ Posture volontairement inversée par rapport à un refus par défaut : un réglage ajouté
demain part dans le cloud **sans action de personne**. Sont exclus : `layout.*`,
`hidden.*`, `sidebar.collapsed`, `ui.config` (géométrie, dépend de la taille d'écran),
`screen_min_*` (le LWW écrase au lieu d'additionner → jauge d'énergie fausse),
`market.*_key` (secrets, déjà au trousseau), `knowledge.last_viewed_at` (alimente les
notifications locales). Filet supplémentaire : toute clé ressemblant à un identifiant de
connexion (`*_key`, `*_token`, `*secret*`, `*password*`) est refusée même non listée —
le mode d'échec d'une liste de refus est l'oubli, et il est silencieux.
⚠️ `ui.config` contient AUSSI l'ordre et les libellés des modules, qui mériteraient de
suivre. C'est un seul blob JSON : le découper est un chantier à part.

### Décisions structurantes
- **Identité globale (migration 015)** : colonne `uid TEXT` + index unique sur 18 tables.
  Les `id` auto-incrémentés sont LOCAUX — deux appareils créent chacun une tâche `id=42`
  sans rapport. Les `id` et les clés étrangères existantes n'ont PAS bougé : `repo.ts`
  n'a pas été touché, l'app se comporte à l'identique.
  - Identité arbitraire (tâche, note, trade) → **UUID v4 aléatoire**.
  - **Clé naturelle** (« l'habitude X le jour J », `journal_entries.date`, `tags.name`)
    → **uid DÉRIVÉ** de cette clé, via le `uid` du PARENT (jamais son `id` local).
    Les deux appareils calculent alors le même uid sans s'être parlé → une seule ligne
    côté serveur, conflit résolu par LWW. Avec un uid aléatoire, un même fait donnerait
    deux lignes serveur qui se battraient sans jamais converger.
  - Génération par **triggers** `WHEN NEW.uid IS NULL` : aucun des ~60 points d'écriture
    à modifier, et une ligne reçue de la sync **garde son uid d'origine** — sans cette
    garde, chaque note se dupliquerait à chaque synchronisation.
- **L'uid ne part jamais en clair.** Un uid dérivé contient du contenu utilisateur
  (`tg:silver-bullet` révélerait le nom d'un tag). Ce qui transite est
  `HMAC(clé dérivée, uid)` : déterministe entre appareils, opaque pour le serveur.
- **Journal de changements (migration 016)** : `sync_outbox`, `sync_state`, `sync_meta`,
  alimentées par 57 triggers (3 par table). `repo.ts` n'est toujours pas touché.
  - **Chiffrement au PUSH, pas à l'écriture.** L'outbox ne stocke que
    `(table, row_id, uid, op, ts)` — jamais de données, ni en clair ni chiffrées. La
    ligne est relue, compressée et chiffrée au moment de l'envoi. Motif : chiffrer une
    note de plusieurs centaines de ko sur le chemin d'une frappe clavier violerait le
    principe offline-first, et vingt modifications ne produisent ainsi qu'un blob.
  - **File APPEND-ONLY**, regroupée à l'envoi par `regrouper()` (`outbox.ts`, pur donc
    testable). Des triggers « upsert » seraient plus économes mais nettement plus
    retors ; une entrée pèse ~60 octets. Les 'upsert' sont regroupés par **row_id** et
    non par uid (l'uid peut manquer à la création, cf. piège n°1).
  - **Suppression = pierre tombale**, et le trigger EFFACE d'abord les entrées en
    attente de cette ligne : une ligne créée puis supprimée hors ligne ne part jamais
    dans le cloud, et une ligne déjà synchronisée ne peut plus « ressusciter ».
  - **`sync_meta.applying`** à '1' pendant l'application des changements distants : les
    triggers se taisent, sinon chaque sync en déclencherait une autre indéfiniment.
  - **`sync_meta.device_id`** départage deux écritures au même horodatage. Arbitraire
    mais DÉTERMINISTE : les deux appareils élisent le même vainqueur, donc convergent.
- **⚠️ `sync_outbox.ts` est le SEUL endroit de l'app en UTC.** Partout ailleurs
  (`localNow()`, la logique « jour ») c'est de l'heure locale. Ici c'est délibéré : cet
  horodatage départage deux écritures faites sur DEUX APPAREILS, et deux heures locales
  de fuseaux différents ne sont pas comparables. Format `2026-08-02T20:44:33.123Z` —
  tri lexicographique = tri chronologique, précision à la milliseconde.
- **Deux enveloppes, une seule clé de données** (`src/lib/sync/crypto.ts`).
  `Argon2id(mot de passe)` → KEK₁ et `Argon2id(code de récupération)` → KEK₂ chiffrent la
  MÊME DEK aléatoire. Changer de mot de passe re-chiffre quelques dizaines d'octets,
  jamais les données. La DEK est rangée dans le **trousseau macOS**
  (`src-tauri/src/secrets.rs`, déjà en place pour les clés LLM).
  - **Deux sous-clés HKDF** depuis la DEK : `cleLignes` (AES-256-GCM, contenu) et
    `cleUid` (HMAC-SHA-256, aveuglement). Réutiliser une clé pour deux primitives est
    une faute classique aux conséquences imprévisibles.
  - **AAD = `userId|table|uid|ts`** sur chaque ligne, avec `table` et `uid` AVEUGLÉS —
    c'est ce que le serveur détient, donc ce que le destinataire peut vérifier. Empêche
    de recoller le contenu d'une ligne sur une autre ou de rejouer une vieille version
    en réécrivant l'horodatage. Une AAD également posée sur les enveloppes interdit de
    présenter celle de récupération comme celle du mot de passe, ou celle d'un compte
    pour un autre.
  - **Compression gzip AVANT chiffrement**, et seulement si elle fait gagner de la
    place (une fiche du Savoir pleine d'images base64 est déjà compressée). Après
    chiffrement tout est incompressible. `CompressionStream` absent (Safari < 16.4) →
    envoi non compressé, un drapeau dans l'enveloppe dit laquelle des deux formes a été
    employée : appareils anciens et récents restent interopérables.
- **Argon2id vit en Rust** (`src-tauri/src/crypto.rs`, crate `argon2`, commande
  `kdf_argon2id`). WebCrypto n'expose que PBKDF2, qui ne coûte que du CPU — un attaquant
  qui récupère les enveloppes chez Supabase en teste des milliards par seconde sur GPU.
  Argon2id coûte de la MÉMOIRE. Paramètres de production : 64 Mio / 3 passes ≈ 150 ms,
  versionnés et stockés à côté de l'enveloppe pour pouvoir être durcis plus tard.
  ⚠️ **`kdf.ts` ne retombe VOLONTAIREMENT pas sur PBKDF2** quand le Rust est absent :
  les deux produisent des clés différentes, donc un repli silencieux fabriquerait des
  enveloppes illisibles — un échec qui ne se voit qu'une fois la sauvegarde censée
  exister. Il lève `KdfIndisponible`. (En preview navigateur il n'y a de toute façon ni
  SQLite ni synchronisation.)
- **Code de récupération, pas phrase de douze mots** (`src/lib/sync/recovery.ts`).
  Base 32 de Crockford, 26 caractères = 130 bits, + 2 de contrôle, affichés
  `SHALE-XXXX-…`. Motif : une liste BIP-39 imposerait 2048 mots ET une langue, or l'app
  est bilingue et la langue se change dans les réglages — une phrase générée en français
  devrait rester valable en anglais, donc la liste ne peut pas suivre l'affichage.
  L'alphabet exclut I, L, O, U ; la saisie tolère minuscules, espaces, absence de tirets
  et les confusions I/L→1, O→0. La somme de contrôle attrape une faute de recopie AVANT
  les 150 ms de dérivation — ce n'est PAS une protection cryptographique, c'est AES-GCM
  qui tranche.
- **Deux horloges à ne pas confondre** : le curseur de pull suit l'horloge **serveur**
  (`server_seq`), le LWW suit l'horloge **client** (`client_ts`). Les mélanger fait
  rater des lignes dès qu'une machine est mal réglée.

### ⚠️ Pièges rencontrés (pas supposés — reproduits en test)
1. **SQLite ne garantit AUCUN ordre entre deux triggers `AFTER INSERT`** sur la même
   table. Conséquence n°1 : le trigger d'uid faisait un `UPDATE` sur `notes`, qui
   déclenchait la réindexation FTS5 — quand il passait avant `notes_ai`, FTS5 recevait
   l'ordre de retirer de l'index une ligne pas encore indexée, **index corrompu**
   (« database disk image is malformed » à chaque création de note). Correctif :
   `notes_au` restreint à `AFTER UPDATE OF title, body` — l'écriture de l'uid devient
   invisible pour l'index. Toute future colonne technique ajoutée à `notes` est
   désormais sans danger.
   Conséquence n°2 : **l'outbox ne peut pas lire `NEW.uid`** à l'insertion (il peut ne
   pas encore être posé). Elle enregistre le `rowid` local pour les créations/
   modifications, et `OLD.uid` pour les suppressions — seul moment où l'uid est
   indispensable, et où il est garanti présent.
2. `ALTER TABLE ADD COLUMN` n'accepte ni `UNIQUE` ni un défaut sous forme d'expression :
   la colonne naît nullable, est remplie par un `UPDATE`, et c'est l'index unique créé
   ensuite qui tient l'invariant.
3. En SQL, écrire `abs(random() % 4)` et **jamais** `abs(random()) % 4` : `random()`
   peut renvoyer `-9223372036854775808`, dont la valeur absolue déborde l'entier signé
   64 bits et fait échouer la requête.
4. **`crypto.getRandomValues` refuse au-delà de 65 536 octets** — limite de la
   spécification, pas du navigateur. `octetsAleatoires()` lève désormais un message
   explicite : elle sert aux nonces et aux clés, pas à produire des données en volume.
5. **`Error.cause` n'existe pas en ES2020**, la cible du projet. Une classe d'erreur qui
   veut porter son origine doit déclarer son propre champ (cf. `KdfIndisponible.origine`).
6. **Le filtre anti-secret ne devine pas les noms maison.** `sync.dek` ne contient ni
   `key`, ni `token`, ni `secret` : sans l'exclusion explicite du préfixe `sync.`, la clé
   de données serait partie dans le cloud — chiffrée avec elle-même. Toute plomberie
   rangée dans `settings` doit être exclue nommément.

### Côté Supabase — `shale-site/supabase/sync.sql`
Fichier autonome (comme `site-content.sql`), idempotent, **pas encore joué en production**.
- **`sync_keys`** : une ligne par utilisateur, les deux enveloppes de la clé de données +
  les paramètres Argon2id. La colonne de récupération est **nullable** — la décision de
  garder ou non ce filet reste ouverte sans migration.
- **`sync_rows`** : PK `(user_id, table_tag, row_tag)`, les deux `*_tag` étant les valeurs
  AVEUGLÉES. `payload bytea` chiffré, `payload_ref` prévu pour le bucket. Index de pull
  sur `(user_id, server_seq)`.
- **Le last-write-wins est appliqué PAR LE SERVEUR** (trigger `sync_rows_lww`) et pas
  seulement par le client : deux appareils qui poussent en même temps arriveraient dans
  un ordre quelconque, et le dernier ARRIVÉ écraserait le plus RÉCENT. Le trigger pose
  aussi lui-même `server_seq` (le client ne choisit pas sa place dans la file) et ignore
  silencieusement une écriture non strictement plus récente — ce qui rend le renvoi d'un
  lot **idempotent par construction**.
- Bucket **privé** `sync-blobs` pour les gros contenus, chemin `<user_id>/…` contraint par
  politique. (Contrairement à `site-assets`, qui est public parce qu'il sert un site.)
- `sync_purge_tombstones(interval)` — non planifiée (`pg_cron` n'est pas sur tous les
  plans). Délai généreux à dessein : un appareil qui n'a jamais vu une pierre tombale
  garde sa copie locale pour toujours.
- ⚠️ **PostgREST expose un `bytea` en hexadécimal préfixé** (`"\\x48656c…"`) et l'attend
  sous cette forme. Pas en base64 — qui serait accepté puis stocké comme du texte,
  illisible ensuite. (Le protocole binaire, lui, veut des octets bruts : les deux formes
  coexistent légitimement, cf. `supabase.testutil.ts`.)

### Le moteur — `src/lib/sync/engine.ts`
`synchroniser(ctx)` = **envoyer PUIS recevoir**, jamais l'inverse : recevoir
d'abord ferait appliquer une ligne distante par-dessus une modification locale non
encore partie, qui serait perdue au lieu de gagner le conflit.
- **`resolution.ts`** — la règle, pure et isolée. `arbitrer()` compare
  `(horodatage, appareil)`, dans cet ordre. Le départage par appareil n'a aucun sens
  métier : il n'a qu'à être **stable**, pour que les deux appareils élisent le même
  vainqueur. La MÊME comparaison est écrite dans le trigger Postgres — les deux
  doivent rester d'accord.
- **`fk.ts`** — traduction des clés étrangères. `goal_id: 7` ici désigne autre chose
  là-bas : ce sont les `uid` qui voyagent. Une clé oubliée ne fait pas échouer la
  sync, elle rattache la tâche au mauvais objectif **sans erreur**. Trois tests
  confrontent la table au schéma réel, dont un qui balaie les colonnes **par leur
  nom** (`*_id`) : `live_positions.sizing_calc_id` et `.trade_id` n'ont pas de clause
  `FOREIGN KEY`, un contrôle par `PRAGMA foreign_key_list` les manquerait.
  ⚠️ `tasks.tag` n'est PAS une clé à traduire : elle stocke le NOM du tag.
- **Quarantaine** — un enfant reçu avant son parent est mis de côté et rejoué tant
  que ça progresse. Le curseur **ne dépasse jamais** une ligne encore en quarantaine,
  sinon l'orpheline ne reviendrait plus.
- **`transport.ts`** — la seule pièce non testable ici (elle n'existe que pour parler
  à un vrai Supabase), d'où sa petitesse délibérée : aucune logique, que de la mise
  en forme. Le moteur, lui, est testé contre un serveur simulé qui applique la même
  règle que le trigger.

### ⚠️ Deux bogues de DIVERGENCE DÉFINITIVE, trouvés par les tests
Tous deux silencieux : pas d'erreur, pas d'alerte — juste deux appareils qui
affichent des données différentes, pour toujours.
1. **La photographie des écritures en attente se prend APRÈS l'envoi.** Elle sert à
   protéger une saisie fraîche contre une ligne distante plus ancienne. Prise avant,
   elle mentait : une écriture déjà envoyée **et rejetée par le serveur** (un autre
   appareil avait plus récent) y figurait encore comme en attente, donc l'appareil
   refusait la version gagnante et gardait la sienne.
2. **`sync_state` retient le couple `(remote_ts, device_id)`**, jamais l'horodatage
   seul (migration 017). Quand deux appareils écrivent dans la **même milliseconde**,
   l'arbitrage se joue sur l'appareil — et le perdant reconnaissait « son »
   horodatage dans la version du gagnant, concluait « je la connais déjà » et gardait
   la sienne.

### Clé de données : ouverture et rangement
- **`keys.ts`** — activer, ouvrir (mot de passe **ou** code), changer de mot de passe,
  poser/retirer le code. La dérivation ET le dépôt sont **injectés**, donc toute la
  mécanique se teste sans Tauri ni réseau (22 tests). Changer de mot de passe re-scelle
  UNE enveloppe et **ne touche pas au code de récupération** : sinon un changement de
  mot de passe invaliderait en silence le papier rangé dans un tiroir.
- **`keystore.ts`** — trousseau macOS + dépôt Supabase. ⚠️ Sans trousseau, la clé vit
  **en mémoire pour la session** et le mot de passe est redemandé au lancement suivant.
  On ne retombe PAS sur la table `settings`, contrairement aux clés d'API LLM : une clé
  d'API en clair n'ouvre qu'un service tiers, la clé de données en clair à côté de la
  base qu'elle protège annulerait l'intérêt du chiffrement de la copie cloud.
- **`planificateur.ts`** — démarrage, retour du réseau, retour au premier plan,
  intervalle de 90 s, recul exponentiel plafonné à 5 min. Un cycle déjà en cours
  **absorbe** les déclenchements suivants (deux cycles videraient la même file et
  enverraient deux fois les mêmes lignes). Pas de sonde réseau dédiée :
  `navigator.onLine` ne sert que de signal NÉGATIF, la tentative de sync EST la sonde.
  Un échec n'est pas remonté — réseau coupé = état normal, pas exception.

### Interface
- **`SyncProvider`** monté dans `App.tsx`, SOUS `AuthGate` (besoin de la session). Un
  contexte plutôt que des props : l'indicateur vit dans la sidebar, les commandes dans
  Réglages — une vue chargée en `lazy`.
- **`SyncIndicator`** — pied de sidebar, même grammaire que `SessionIndicator`. Ne montre
  RIEN quand la synchronisation est indisponible : afficher « indisponible » en
  permanence dans une app qui marche très bien sans cloud transformerait un choix
  volontaire en défaut apparent.
- **`SyncSettings`** — activation, déverrouillage (mot de passe **ou** code), gestion du
  code, « oublier la clé ». L'avertissement sur la perte de mot de passe est affiché
  AVANT l'activation, pas découvert le jour où ça arrive.
- **L'activation est explicite**, dans Réglages. La clé exige le mot de passe, qui
  n'existe que le temps de l'écran de connexion ; l'intercepter au login mêlerait la
  porte d'entrée de l'app à une fonctionnalité optionnelle. Ensuite le trousseau prend
  le relais et les lancements suivants ouvrent en silence.
- **Mode démo** (`shale.demo.sync`, sélecteur en bas de la section) : sans Tauri ni
  Supabase, toute cette interface renverrait `null` et ne serait relisible qu'après avoir
  branché le backend ET reconstruit l'app native. Même parti que « offre simulée » pour
  le paywall. ⚠️ La section reste affichée même en état « indisponible » quand l'auth
  n'est pas configurée — sinon le sélecteur disparaîtrait avec elle, sans retour possible.

### ⚠️ Un token de couleur inexistant échoue EN SILENCE
`text-amber` ne génère aucune classe (le token s'appelle `--color-yellow`) : la couleur
retombe sur l'héritage, sans erreur ni avertissement. Constaté sur l'encadré
d'avertissement de `SyncSettings`, qui s'affichait en blanc. Vérifier une couleur au
`getComputedStyle`, pas à l'œil. Tokens réels : `blue`, `green`, `red`, `yellow`,
`violet`, `indigo`.

### ⚠️ Une pierre tombale PORTE une charge utile
Minuscule (l'identifiant de ligne chiffré), mais indispensable : `row_tag` est un
HMAC, donc irréversible. Sans elle, l'appareil qui reçoit la pierre tombale ne peut
pas savoir QUELLE ligne supprimer chez lui.

### Tests
`npm test` (vitest). Aucun runner JS n'existait avant ce chantier.
- **Le moteur est testé à DEUX APPAREILS** (`engine.testutil.ts`) : deux vraies bases
  SQLite montées par les migrations réelles, la vraie couche de chiffrement, et un
  serveur en mémoire qui applique **mot pour mot** la règle du trigger Postgres. Seul
  le réseau est simulé. C'est le seul montage capable de prouver ce qui compte : que
  la saisie faite ici réapparaisse là-bas, qu'un conflit se résolve du même côté des
  deux côtés, et qu'une suppression ne ressuscite pas.
- ⚠️ **Jamais de date écrite en dur dans un test.** Une date figée finit par passer
  dans le passé : les envois sont alors rejetés comme périmés et le test cesse
  **silencieusement** de couvrir quoi que ce soit. (Constaté : une date du 2 août
  devenue caduque le 3.) Calculer à partir de `Date.now()`.
- **Le schéma Supabase est exécuté pour de vrai**, via **PGlite** (Postgres 18 compilé en
  WebAssembly, dev-dep) : ni Postgres, ni Docker, ni la CLI Supabase sur cette machine, et
  ce fichier porte le LWW serveur et les politiques d'isolation — trop critique pour être
  livré sans avoir jamais tourné. `sync.sql` est lu **depuis l'autre dépôt** plutôt que
  recopié (d'où `server.fs.allow` dans `vitest.config.ts`) : une copie divergerait, et on
  validerait une version qui n'est pas celle exécutée. Les briques Supabase (`auth.uid()`,
  `storage.*`, rôles) sont simulées fidèlement dans `supabase.testutil.ts` — restent donc
  à vérifier sur le vrai projet : les politiques du bucket et le rendu PostgREST.
- Config **séparée** de `vite.config.ts` (`vitest.config.ts`) : la config de build de
  l'app ne dépend pas du runner, ni l'inverse. Pas de `globals: true` → les tests
  importent `describe`/`it`/`expect`, donc le `tsc` du build les typecheck.
- Les tests de schéma tournent sur une **vraie base SQLite** montée par les migrations
  RÉELLES (`node:sqlite`, intégré à Node 22 — aucune dépendance native), lues depuis
  `src-tauri/migrations/` via `?raw`. **Toute migration ajoutée à `lib.rs` doit l'être
  aussi dans `src/lib/sync/schema.testutil.ts`**, sinon les tests valident un schéma
  périmé.
- ⚠️ **Les tests sont typés SÉPARÉMENT de l'app** — `npm run test:types`
  (`tsconfig.test.json`), pendant que `tsconfig.json` les EXCLUT.
  Histoire, parce que le piège est retors : `@types/node` était volontairement
  absent, et `node:sqlite` déclaré à la main, pour que les globales Node
  (`process`, `Buffer`) ne deviennent pas valides dans le code de l'app, où elles
  n'existent pas à l'exécution. Puis `@types/node` est arrivé en dépendance
  **transitive** (vite, vitest, happy-dom) : la déclaration maison a perdu le match
  contre la vraie, et `process.env.FOO` a cessé d'être une erreur **partout**.
  `"types": []` ne suffit PAS à refermer la fuite : il ne coupe que l'inclusion
  automatique, et dès qu'un seul fichier du programme importe un module Node, tout
  l'espace global arrive avec. Seule l'exclusion des tests de la compilation de l'app
  tient. Vérifié par sonde (`const x = process.env.FOO` doit lever dans `src/`).
- `npm run build` (= `tsc && vite build`) ne typecheck donc QUE l'app. Lancer aussi
  `npm run test:types` après avoir touché aux tests.

### Sauvegarde avant migration
`~/Library/Application Support/com.atnfx.shale/backups/shale-avant-sync-2026-08-02.db`
(`VACUUM INTO`, `integrity_check` ok). ⚠️ Migration SQL → **rebuild natif obligatoire**
pour qu'elle s'applique à la base réelle.

### Limite assumée (à connaître)
Il n'y a **pas de corbeille** : une suppression crée un tombstone qui se propage à tous
les appareils et ne se rattrape pas. Hors périmètre du chantier, arbitré le 2026-08-02.

## Sync : passage du « testé » au « livrable » (2026-08-05)

Séance consacrée à ce que les tests ne peuvent PAS atteindre. Le moteur était
correct contre un serveur simulé ; restaient le vrai réseau, le vrai jeton, et
un parcours d'activation qui n'existait pas. **Deux étapes de la séance n'ont
pas pu être exécutées** (voir « Ce qui reste à faire », plus bas) : le schéma
Supabase n'a pas été joué, et la recette à deux machines n'a pas tourné.

### ⚠️ Le jeton n'était renouvelé qu'AU DÉMARRAGE de l'app
Le défaut le plus grave trouvé, et il dépassait la synchronisation.
`useAuth` rafraîchissait la session dans son `useEffect` de montage, et nulle
part ailleurs. Or un jeton Supabase vit **une heure** et la sync tourne **toutes
les 90 secondes** : une app laissée ouverte synchronisait pendant une heure,
puis récoltait un 401 à chaque cycle jusqu'au redémarrage — **sans rien dire**.
Invisible partout où on l'aurait cherché : les tests n'ont pas de jeton, une
session de développement dépasse rarement l'heure, et un appel déclenché par un
clic ne le voit pas (l'utilisateur relance l'app avant de s'en apercevoir).

Correctif : `AuthState.jetonFrais(forcer?)`, et le transport reçoit un
**fournisseur** de jeton, plus un jeton. Trois précautions qui ne sont pas
décoratives :
- **`sessionRef` plutôt que `session`** en dépendance — sinon `jetonFrais`
  change d'identité à chaque renouvellement et redémarre le planificateur.
- **Un seul renouvellement en vol** (`renouvellementRef`) : GoTrue fait TOURNER
  le refresh token à chaque usage, donc trois appels simultanés en grilleraient
  deux et déconnecteraient l'utilisateur.
- **Reprise UNE fois** sur 401 dans le transport, jamais en boucle : si le jeton
  renouvelé est refusé lui aussi, l'expiration n'était pas la cause.

### ⚠️ Le pull ne tirait QU'UNE page de 200 lignes par cycle
Un cycle toutes les 90 s : 5 000 lignes — quelques mois d'usage — descendaient
en près de 40 minutes sur un appareil neuf, l'indicateur affichant tout du long
un « synchronisé » sincère et faux. Le test de volume existant ne l'attrapait
pas parce qu'il appelait `converger()` deux fois, soit quatre cycles : c'est
exactement ce qui masquait le défaut. `synchroniser()` boucle désormais tant que
les pages sont pleines, plafond `PAGES_MAX = 25`.
⚠️ La boucle s'arrête aussi quand la **quarantaine retient le curseur** — sinon
elle redemanderait la même page indéfiniment, et le cycle ne rendrait jamais la
main. Deux tests couvrent les deux sorties.

### `http.ts` — quatre échecs, quatre conduites
Le réseau échoue de quatre façons que le serveur simulé ne connaît pas, et les
confondre coûte cher. `ReseauInjoignable` (coupure, timeout) : état NORMAL,
rien à dire. `SessionExpiree` (401) : réessayer avec le même jeton échouera
toujours. `ServeurOccupe` (429/5xx) : attendre ce qu'il demande.
`RequeteRefusee` (400/403/404) : **ne guérira jamais**.
- ⚠️ `RequeteRefusee` est le cas « `sync.sql` jamais joué » (404 PostgREST) et
  « politique RLS » (42501). Le noyer dans un recul silencieux produirait le
  pire scénario possible : une app qui affiche « hors ligne » pendant des jours
  sur un backend qui n'a jamais existé. Le planificateur part directement au
  plafond de 5 min — sans abandonner, pour que ça reparte le jour où le schéma
  est joué, sans relancer l'app.
- ⚠️ **`Retry-After` a DEUX formes** : un nombre de secondes, ou une date HTTP.
  Ne gérer que la première donne `NaN` sur la seconde, donc `setTimeout(NaN)`,
  donc un rappel IMMÉDIAT — l'exact inverse de ce que le serveur demandait.
- ⚠️ **Le timeout n'est pas un luxe.** Sans lui, une requête partie sur un
  réseau qui s'évanouit (Wi-Fi d'hôtel, veille du Mac) attend indéfiniment. Le
  verrou du planificateur étant tenu pendant ce temps, TOUTE synchronisation
  ultérieure serait absorbée par ce cycle fantôme : l'app cesserait de
  synchroniser sans jamais signaler d'erreur. 20 s, `AbortController` (pas
  `AbortSignal.timeout()`, qui date d'ES2022 et la cible est ES2020).

### Le parcours d'activation (`SyncOnboarding.tsx`)
Quatre temps : ce que ça coûte → mot de passe (saisi deux fois) → code MONTRÉ →
preuve qu'il a été noté → **puis** activation.
- ⚠️ **`activer()` reçoit le code, elle ne le tire plus.** Ce n'est pas un
  détail de signature : `activer()` écrit les enveloppes chez Supabase, donc
  quand elle rend la main la synchronisation EXISTE. Si le code en sortait, on
  ne pourrait le montrer qu'APRÈS — et la case « je l'ai noté » deviendrait une
  formalité cochée sur un fait accompli, ce qui est l'inverse de son rôle.
  `genererCode()` est pure : la tirer dans l'écran ne coûte et n'engage rien.
- La preuve est une **re-saisie de deux groupes**, jamais le premier (celui-là
  se retient sans rien noter). Tirés une seule fois par `useMemo` — les rejouer
  à chaque frappe changerait la question sous les doigts de l'utilisateur.
- ⚠️ **La comparaison passe par `canoniser()`, extraite de `recovery.ts`.**
  Première version : une copie locale des quatre `replace`. Elle rendait cet
  écran PLUS SÉVÈRE que le déverrouillage qu'il prépare — quelqu'un qui note
  consciencieusement `O` là où l'alphabet de Crockford n'a qu'un `0` échouait
  ici, alors que son papier ouvre parfaitement ses données. On lui aurait appris
  à se méfier d'un code valable. Une seule copie de la règle, comme pour le LWW.

### `SyncUnlock.tsx` — déverrouillage au lancement
Le trousseau rend ce moment rare, mais **silencieux** : sans écran, l'app
démarre normalement, `sync_outbox` se remplit, et rien ne part. L'utilisateur
croit synchroniser et découvre le contraire sur l'autre appareil, plus tard.
⚠️ **Esquivable, et c'est voulu** : Shale marche entièrement hors ligne, bloquer
l'entrée sur un mot de passe pour une fonctionnalité facultative transformerait
un confort en péage. « Plus tard » referme pour la session (variable de module,
pas d'état React : reproposer à chaque rendu serait du harcèlement), et
l'indicateur de la sidebar reste le chemin du retour.

### L'indicateur ne peint plus tout en rouge
Trois échecs très différents se cachaient derrière un seul « sync en échec ».
`EtatSync.raison` les sépare : `passagere` (gris, pas d'alerte — une coupure est
un état normal d'une app offline-first, et la peindre en rouge apprend à ignorer
le rouge), `session` (ambre, « reconnexion requise »), `configuration` (rouge,
ça doit se voir). Un échec passager n'est plus **cliquable** : ouvrir les
réglages n'y changerait rien, et le proposer suggérerait le contraire.

### Ce qui a été vérifié, et comment
- `npx tsc --noEmit`, `npm run test:types`, `npm run build`,
  `cargo check --lib --tests --bins`, `cargo test --lib` (88), `npm test`
  (**216 tests**, +33), `npm run i18n:check` (0 clé manquante) — tous verts.
- **`transport.ts` n'est plus le seul fichier sans tests.** Ce qu'on lui
  reprochait n'était pas « est-ce que Supabase répond ? » mais « est-ce que ce
  qu'on envoie a la bonne forme ? » — et ça, c'est vérifiable : `fetch` est
  remplacé et on regarde l'octet près ce qui part. 14 tests verrouillent
  l'hexadécimal préfixé (le piège base64), les zéros de tête, `gt.` et non
  `gte.`, `merge-duplicates`, et la reprise sur 401.
- **Parcours complet joué dans le navigateur**, en mode démo : les quatre étapes
  de l'activation, la re-saisie fausse (bordure rouge) puis juste en minuscules
  (verte), l'activation, l'écran de déverrouillage et son « Plus tard ».
  Contrôlé que la section reste visible et le sélecteur accessible en état
  « indisponible » — la règle documentée tient.
- ⚠️ **La couleur d'avertissement vérifiée au `getComputedStyle`**, pas à l'œil,
  conformément au piège déjà consigné : `rgb(240, 179, 65)` = `#f0b341` =
  `--color-yellow`. Le token mord.
- ⚠️ Au passage : **`--color-indigo` n'existe pas** dans `index.css`, alors que
  la liste des tokens réels plus haut dans ce fichier le cite. Tokens réels :
  `blue`, `green`, `red`, `yellow`, `violet`. Un `text-indigo` échouerait en
  silence exactement comme `text-amber`.

### Ce qui reste à faire — et pourquoi ça n'a pas pu l'être ici
- ~~**Le schéma Supabase n'est TOUJOURS PAS joué.**~~ **PÉRIMÉ depuis le
  2026-08-10** : le projet existe, les quatre fichiers SQL sont joués, et
  `npm run sync:verifier` est passé dessus — 14 contrôles conformes. Voir la
  section « Authentification réelle + Stripe débranché » en fin de fichier.
  (Ce qui suit décrit la situation d'avant, gardé pour le raisonnement.)
- **La recette PC ↔ PC n'a pas tourné** : une seule machine, et elle dépend du
  point précédent.
- À la place, `tools/verifier-sync-supabase.mjs` (`npm run sync:verifier`)
  remplace la vérification « à l'œil dans le dashboard » par une commande. Il se
  connecte en tant que **vrai utilisateur** — jamais avec une `service_role`,
  qui contournerait RLS et validerait un schéma refusant tous les vrais clients
  — et contrôle : présence des tables, **rendu hexadécimal du `bytea`** (avec
  des octets choisis pour piéger les encodages vicieux : `0x00`, `0x0f`, `0xff`,
  `0x5c`), LWW serveur qui mord, cloisonnement en écriture et sans session,
  politiques du bucket, **que le bucket soit bien privé**, et que
  `sync_purge_tombstones` soit hors de portée des clients. Aucun secret lu ni
  écrit dans le dépôt : tout passe par l'environnement, le temps d'une commande.
- `RECETTE-SYNC.md` : les 7 scénarios à deux machines, chacun conclu par une
  **lecture en base sur les deux côtés** (jamais « ça a l'air bon »), avec le SQL
  exact. ⚠️ Comparer les `uid`, jamais les `id` — ces derniers sont locaux.
- **Si un écart apparaît entre la recette et ce que les tests laissaient
  attendre**, c'est que le serveur simulé de `engine.testutil.ts` n'est pas
  fidèle à PostgREST : corriger **le simulateur ET le code**, jamais le seul
  code, sinon le prochain défaut du même genre repassera à travers les tests.

## Authentification réelle + Stripe débranché (2026-08-10)

Le backend commercial est **branché pour de bon** : projet Supabase
`pdlprlddouzacinfpkes`, URL et clé anon renseignées dans
`src/lib/auth/config.ts` (et son jumeau `vitrine/src/lib/compte.ts` côté
site). Le mode démo ne se déclenche donc plus. Les quatre fichiers SQL
(`schema.sql`, `sync.sql`, `site-content.sql`, `migrations/002_admin.sql`) ont
été exécutés sur le projet.

### `STRIPE_ENABLED` — l'interrupteur, pas la suppression
Stripe n'est pas encore branché, et **tout compte créé a accès à l'intégralité
du produit**. C'est porté par un unique booléen, `STRIPE_ENABLED` dans
`auth/config.ts`, dupliqué côté site dans `assets/config.js` — **les deux
doivent rester alignés**.

À `false`, il court-circuite quatre choses :
- `hasAccess()` (`src/lib/auth/access.ts`, nouveau) répond oui sans consulter
  `my_subscription` → pas d'écran « Abonnement requis » ;
- `entitlementsOf()` renvoie `shale_trade` / `hasTrading: true` → aucun module
  verrouillé, `UpgradeModal` inatteignable ;
- le bandeau d'essai d'`AuthGate` ne s'affiche pas ;
- Réglages → compte affiche « Accès complet » au lieu du statut brut.

Rien n'est supprimé : les offres, `startCheckout()`, le webhook et la vue
`my_subscription` restent en place. Repasser le drapeau à `true` **des deux
côtés** les réactive tels quels.

**Un piège corrigé au passage** : si la lecture de `my_subscription` échouait
(réseau, vue absente), `resolve()` basculait en `noSub` — donc un mur de
paiement *accidentel* alors qu'aucun droit n'était à vérifier. Sous
`STRIPE_ENABLED = false`, cet échec laissait donc entrer.

> ⚠️ **PÉRIMÉ depuis le 2026-08-13.** Le raisonnement tenait à sa prémisse —
> « aucun droit à vérifier » — et cette prémisse est tombée : `my_subscription`
> porte désormais l'**activation**, qui se vérifie toujours. Un échec de lecture
> ne peut donc plus valoir autorisation, et `resolve()` renvoie au mur de
> connexion avec le motif. Voir « L'accès se donne compte par compte », en fin
> de fichier.

### Le bandeau d'essai fantôme — trouvé en ouvrant l'app, pas en la testant
`AuthGate` lisait `subscription.status` **en direct**, sans passer par
`entitlementsOf()`. Or la base ouvre une ligne `trialing` à chaque création de
compte : c'est son rôle, et il ne dépend pas de Stripe. Résultat, un compte tout
neuf voyait « Essai gratuit — 7 jours restants · Choisir ma formule » — une
échéance inventée au-dessus d'un produit sans mur de paiement, et un bouton
d'achat qui ne mène nulle part.

Ni `tsc` ni les tests ne pouvaient le voir : il fallait ouvrir l'app avec un
vrai compte. **Leçon générale : toute lecture directe de `subscription.status`
hors de `entitlements.ts` est suspecte.** Les trois autres occurrences ont été
vérifiées (`SubscriptionRequired` — inatteignable ; `ConsoleView` — statistiques
admin sur une liste ; `SettingsView` — déjà gardée).

### Inscription et mot de passe dans l'app
- `signUpWithPassword()` (`auth/supabase.ts`) renvoie `Session | null` : `null`
  quand le projet exige une confirmation par e-mail. L'écran doit alors dire
  « va cliquer le lien » au lieu d'attendre une entrée qui ne viendra pas.
- `updatePassword(token, mdp)` prend un **jeton en paramètre** : macOS passe par
  `jetonFrais()`, Windows renouvelle à la main avant l'appel (il n'a pas encore
  `jetonFrais`). Sans ça, une app ouverte depuis plus d'une heure récolte un 401
  au moment précis où l'utilisateur croit sécuriser son compte.
- `LoginScreen` bascule inscription ↔ connexion sur place ; l'inscription
  renvoyait vers le navigateur pour retaper les mêmes identifiants.

### Le rôle admin est une donnée, plus un réglage
`shale-site/supabase/migrations/002_admin.sql` crée `public.admins` +
`public.is_admin()` et réécrit les politiques de `site_content` et du bucket
`site-assets`.

**Ce qu'elle répare** : ces politiques disaient `auth.role() = 'authenticated'`,
c'est-à-dire **tout compte connecté**. Ça ne valait « administrateur » que tant
que les inscriptions publiques étaient fermées — condition vraie nulle part dans
le code, et qui a disparu le jour où l'inscription s'est ouverte. Sans la
migration, le premier inscrit venu réécrivait le site public.

Personne ne peut se promouvoir : la table n'a **aucune** politique d'écriture,
donc seul le SQL Editor (`service_role`) peut y insérer. Le rattachement se fait
**par e-mail** — rejouer la migration rattrape un compte créé entre-temps.

`src/lib/auth/admin.sql.test.ts` (8 tests) exécute cette migration sous PGlite.
Le test a été **vérifié non vacueux** : migration neutralisée, l'assertion
« un inscrit quelconque ne peut pas écrire » échoue — la faille était réelle.

### Ce qui a été vérifié sur le vrai projet
- Parcours app complet (macOS **et** Windows) : inscription → entrée immédiate,
  sans mur ni bandeau → changement de mot de passe → déconnexion → **ancien**
  mot de passe refusé, **nouveau** accepté.
- Parcours site : connexion → « Accès complet », aucune offre → changement de
  mot de passe (ancien refusé / nouveau accepté, contrôlé côté GoTrue) →
  déconnexion, jetons effacés.
- Verrou admin, **les deux moitiés** : `/edit` refuse un compte non-admin avec
  identifiants valides ; et côté serveur, ce même compte obtient 0 ligne
  modifiée sur `site_content` (contenu vérifié intact après coup) et un 403 sur
  une tentative d'auto-promotion.
- `npm run sync:verifier` : **premier passage sur un vrai projet**, 14 contrôles
  conformes — dont le rendu hexadécimal du `bytea`, le seul irrattrapable.

⚠️ **Piège de méthode rencontré** : une vérification qui renvoyait une chaîne
codée en dur (`'connecté'`) au lieu de lire l'état réel a produit un faux
positif. Lire ce que la page affiche, jamais ce qu'on croit qu'elle affiche.

### Reste à faire
- ~~**Déploiement**~~ — **fait le 2026-08-10 : <https://shale-six.vercel.app>**
  (Vercel, dépôt `shale-site`, racine `vitrine`). L'espace compte y est servi
  sous `/compte/`, les liens internes sont relatifs. ⚠️ `shale.app` n'est
  **pas détenu** et répond 403 : ne plus l'écrire nulle part en dur.
- **L'app n'est ni signée ni notarisée.** `bundle.macOS` est vide dans
  `src-tauri/tauri.conf.json`. Depuis que le site propose l'app en
  téléchargement direct (`/telechargements/Shale_aarch64.dmg`), c'est le frein
  n°1 : macOS met le `.dmg` en quarantaine et l'utilisateur doit le débloquer à
  la main dans Réglages Système, juste après le clic que tout le site sert à
  provoquer. Demande le compte Apple Developer (99 $/an) puis les secrets
  `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_ID`,
  `APPLE_TEAM_ID` au moment du build.
- **Supabase n'autorise pas encore l'adresse de production** dans ses
  *Redirect URLs* : les e-mails de confirmation et de réinitialisation renvoient
  vers `localhost:4330`. Réglage tableau de bord, cf.
  `shale-site/SETUP-SUPABASE.md` § A4.
- **La vitrine promet encore un essai de 7 jours et des prix** (15 emplacements
  dans `vitrine/src/content.json`) alors que le produit donne tout
  gratuitement. Décision commerciale, volontairement non tranchée ici.
- **Les CGV décrivent un essai et un abonnement payants**
  (`vitrine/src/lib/legal.json`) : document contractuel, à ne pas modifier sans
  décision explicite.
- **Le site charge le SDK Supabase depuis `esm.sh`** à chaque connexion. Panne
  observée deux fois pendant cette session. Un bloqueur de pub ou un réseau
  d'entreprise suffit à empêcher un visiteur de se connecter. L'embarquer dans
  `assets/` (~120 Ko) supprimerait ce point de rupture.
- ~~**« Mot de passe oublié » depuis l'app**~~ — la cible suit désormais
  `WEBSITE_URL`, corrigé le 2026-08-10. ⚠️ C'est une constante **compilée dans
  le binaire** : la correction n'atteint les utilisateurs qu'après une nouvelle
  version publiée. Les versions déjà distribuées pointent toujours vers le 403.

## L'espace compte rentre dans le site (2026-08-10, soir)

`compte.shale.app` est abandonné : l'espace compte est servi sous **`/compte/`**
du site vitrine, en un seul déploiement. Cliquer « Se connecter » ne fait plus
sortir du site.

Côté app, cela ajoute **`ACCOUNT_URL`** dans `auth/config.ts` :

```ts
// Adresse RÉELLE du site. « https://shale.app » n'est PAS détenu (403) : y
// laisser cette valeur envoyait « Se connecter » et les liens légaux de
// l'onboarding sur une page d'erreur. Corrigé le 2026-08-10.
// ⚠️ Existe en DEUX exemplaires : ici (branche `sync-chiffree`) et dans le
// worktree ~/Desktop/Shale-Windows (branche `windows-build`).
export const WEBSITE_URL = "https://shale-six.vercel.app";  // vitrine seule
export const ACCOUNT_URL = `${WEBSITE_URL}/compte`;    // inscription, login, compte
```

Tous les `openExternal()` des écrans d'auth passent par `ACCOUNT_URL`, avec des
**`.html` explicites**. Ce n'est pas de la verbosité : viser `/compte/reset`
supposerait les « URLs propres » activées chez l'hébergeur, et le jour où elles
ne le sont pas, c'est le lien de réinitialisation **envoyé par e-mail** qui tombe
en 404 — le pire endroit pour découvrir un réglage manquant.

**Défaut préexistant corrigé au passage** : `Onboarding.tsx` ouvrait
`${WEBSITE_URL}/cgu.html` et `${WEBSITE_URL}/confidentialite.html`, des fichiers
de l'espace compte cherchés à la racine de la vitrine. Ces deux liens étaient
morts bien avant ce déplacement. Ils visent désormais `/legal#cgu` et
`/legal#confidentialite`, qui existent réellement.

⚠️ `WEBSITE_URL` reste le **seul** endroit où le domaine est écrit en dur des
deux côtés (macOS et Windows). À mettre à jour au déploiement — le site, lui,
n'utilise plus que des chemins relatifs.

### Ce que la batterie de contrôles du site a révélé (2026-08-10, tard)

`shale-site/vitrine` a sa propre suite (`npm run check` : check → audit →
nojs-check → wrap-check → narrow-audit → behaviour). Lancée après coup, elle a
sorti deux vrais défauts — dont un que ni `tsc`, ni les 224 tests, ni le build
ne pouvaient voir :

- **`/compte/` n'existait qu'au build.** La copie de l'espace compte se faisait
  dans `astro:build:done` seulement, donc en `astro dev` tous les liens vers
  `/compte/…` renvoyaient 404 : « Se connecter » cassé en développement,
  fonctionnel en production. Un middleware `astro:server:setup` sert désormais
  le même dossier, depuis la même constante que le build.
- **L'audit du site dénonçait les prix courants.** Sa liste de valeurs périmées
  avait gardé « 19 € » et « 12 €/mois » après que la migration du 2026-08-02 en
  a fait les tarifs en vigueur — quatre faux positifs par exécution, depuis huit
  jours.

**La leçon vaut au-delà de ces deux points : un outil de contrôle porte ses
propres hypothèses, et elles vieillissent.** Avant de conclure « tout est bon »,
vérifier que ce qui vérifie est lui-même à jour.

⚠️ **Consigne de commit de `config.ts` — arbitrage, pas règle.**
`RECETTE-SYNC.md` dit « ne pas committer ce fichier renseigné ». La clé `anon`
est pourtant *publique par conception* : elle part dans le JavaScript servi au
visiteur, et ce qui protège la base est la RLS. Côté site, elle **est**
committée — un déploiement depuis git n'a pas d'autre moyen de la connaître.
Côté app, `config.ts` reste non committé, ce qui veut dire qu'un clone neuf
compile en **mode démo**. À trancher consciemment. Ce qui n'est pas négociable :
la clé `service_role` ne quitte jamais le tableau de bord Supabase.

## Sync : connecté = synchronisé (2026-08-10, soir)

**Il n'y a plus rien à activer.** Plus d'écran d'onboarding, plus de code de
récupération à noter, plus de case à cocher. Se connecter suffit ; la
synchronisation démarre seule, et hors ligne les écritures s'empilent comme
avant.

### D'où vient le secret, maintenant
Le chiffrement de bout en bout est **conservé** — ce qui change, c'est le chemin
du secret. Il exige le mot de passe, qui n'existe que le temps de l'écran de
connexion (« rester connecté » conserve une session, **pas** un mot de passe).
Plutôt que de le redemander dans une cérémonie, on le saisit **au vol** :
`useAuth` le dépose dans `src/lib/sync/sas.ts`, `useSync` le retire et l'efface.

⚠️ Le sas est une variable de MODULE, pas un état React : un mot de passe dans
un état React se retrouve dans les outils de développement, survit aux rendus et
se recopie dans chaque closure. Le retrait est **destructif** — un second appel
renvoie `null`. Et l'événement `sb:sync-secret` **ne transporte pas** le secret,
il signale seulement qu'il y en a un à retirer : un mot de passe dans un
`CustomEvent.detail` serait lisible par tout autre écouteur de la page.

### Trois chemins, dans l'ordre (`ouvrirSansRienDemander`)
1. clé déjà au trousseau → on démarre, rien à demander ;
2. mot de passe dans le sas → on **crée** la clé (premier appareil) ou on la
   **rouvre** (nouvel appareil), en silence ;
3. ni l'un ni l'autre → verrouillé, l'app fonctionne, la file se remplit.

### ⚠️ Re-scellement SYSTÉMATIQUE à chaque mot de passe vu
Pas seulement au changement explicite : il couvre surtout la **réinitialisation
par e-mail**, faite ailleurs, dont l'app n'est jamais informée. Sans lui,
l'enveloppe resterait scellée par l'ancien mot de passe et le prochain appareil
ne pourrait plus rien ouvrir — alors que la clé était là, intacte, sur celui-ci.
Coût : une dérivation (~150 ms) et un POST, une fois par connexion. Vérifier
d'abord si c'est nécessaire coûterait la même dérivation.

### Ce que le choix coûte — statut `orpheline`
Sans code de récupération, si le mot de passe est réinitialisé **et** qu'aucun
appareil ne détient plus la clé, la copie cloud est irrécupérable. Les données
LOCALES restent intactes. La sortie est `republier(motDePasse)` : nouvelle clé,
effacement du cloud (`Transport.effacerTout`), remise en file de TOUTES les
lignes locales. ⚠️ Ce qui n'existait que sur un autre appareil et n'est jamais
arrivé ici est alors perdu — c'est dit **avant** l'action, pas après.

`toutRemettreEnFile()` écrit `uid = uid` : une mise à jour sans effet qui
déclenche les triggers existants. Un remplissage manuel de `sync_outbox` aurait
divergé en silence le jour où son schéma change. Aucune colonne métier n'est
touchée (test dédié : `updated_at` inchangé).

### Le moteur tolère une charge illisible
`dechiffrerLigne` levait et faisait échouer le cycle ENTIER — donc à chaque
tentative, pour toujours. Désormais comptée dans `Resultat.illisibles` et
enjambée, curseur compris.
⚠️ **Le cas « autre clé » ne passe PAS par là** : le nom de table est aveuglé
par une sous-clé de la même DEK, donc une autre clé produit d'autres empreintes
de table et les lignes sont écartées comme « table inconnue » **avant** tout
déchiffrement. `illisibles` ne se déclenche que sur une charge réellement
corrompue. Les deux tests distinguent explicitement les deux chemins.

### Supprimé
`SyncOnboarding.tsx`, `SyncUnlock.tsx`, et six méthodes de `ApiSync` (`activer`,
`deverrouiller`, `deverrouillerAvecCode`, `reSceller`, `regenererCodeRecuperation`,
`supprimerCodeRecuperation`) : plus aucun appelant. Les fonctions de `keys.ts`
sont **conservées et toujours testées** — c'est la couche où le code de
récupération reviendrait si la décision produit changeait.

⚠️ Le garde du mode démo est passé de `!AUTH_CONFIGURED` à `!isTauri`. Ce qui
rend la synchronisation impossible en preview navigateur est l'absence de Tauri,
pas celle des clés Supabase. Tant que le backend n'était pas branché les deux
coïncidaient ; depuis qu'il l'est, l'ancien garde faisait disparaître l'état
simulé, et avec lui toute possibilité de relire ces écrans hors de l'app native.

### Non vérifié dans le navigateur
`AUTH_CONFIGURED` étant vrai, la preview exige un vrai compte Supabase. Ces
écrans n'ont donc PAS été relus visuellement cette fois — seulement typés,
testés (237) et construits. À regarder au premier lancement de l'app native.

## L'accès se donne compte par compte (2026-08-13)

**Avoir un compte ne suffit plus à ouvrir l'app.** Il faut en plus une ligne
dans `public.activations` — accordée à la main, par le SQL Editor. Un compte non
activé est renvoyé sur **l'écran de connexion**, avec la raison écrite.

### Pourquoi, et ce que ça répare vraiment
Le mur d'entrée du 2026-08-12 vérifiait consciencieusement *qui* entre. Mais
l'inscription est ouverte à tout le monde depuis le 2026-08-11 : il prouvait
donc une identité que le visiteur venait de se délivrer à lui-même en trente
secondes. Il répondait « qui es-tu », jamais « as-tu le droit d'être là ».

Ce n'est **pas** un mur de paiement. `STRIPE_ENABLED` reste à `false`, rien ne
s'achète, rien n'expire. C'est une liste d'invités.

### Les deux questions, et leur cumul
`src/lib/auth/access.ts` porte les deux, et elles ne se remplacent pas :

| | question | dépend de `STRIPE_ENABLED` ? |
|---|---|---|
| `estActive(sub)` | cette personne est-elle **invitée** ? | non — vaut toujours |
| `isActive(sub.status)` | cette personne a-t-elle **payé** ? | oui — ignoré tant qu'il est faux |

Le jour où Stripe s'allume, un invité non abonné sera refusé par la seconde, et
un abonné non invité par la première.

⚠️ **`activated === true`, jamais un test de véracité.** `undefined` veut dire
« la question n'a pas de réponse » (migration non jouée, lecture ratée, pas de
ligne d'abonnement) — et une question sans réponse ne peut pas valoir « oui ».
C'est la règle qui manquait le 2026-08-12, quand l'échec d'une vérification
ouvrait l'app en grand.

### Trois trous rebouchés en même temps, tous dans le même sens
1. **L'échec de lecture n'ouvre plus.** `resolve()` s'autorisait à conclure
   « ready » quand `fetchSubscription` échouait et que Stripe était éteint. Il
   n'y avait alors « aucun droit à vérifier » ; il y en a un maintenant, et
   toujours. Le jeton n'est pas effacé pour autant — une panne n'est pas un
   refus, et un 500 passager ne doit pas coûter son délai de grâce hors ligne à
   quelqu'un de légitime.
2. **Le mode hors ligne ne contourne plus l'activation.** Sans quoi le chemin
   le plus court pour entrer sans invitation était : s'inscrire, se voir
   refuser, couper le réseau, relancer. La méta sur disque porte désormais
   `activated`, et le délai de grâce l'exige autant que la date.
   ⚠️ Corollaire d'ordre : `memoriser()` est appelée **avant** la vérification
   (le `refresh_token` que GoTrue vient de faire tourner est le seul valide, ne
   pas l'écrire condamnerait le prochain démarrage), donc elle écrit d'abord
   `activated: false`. `marquerActive()` repasse derrière. Tué entre les deux,
   ce qui reste sur le disque dit « non activé » : l'erreur va dans le bon sens.
3. **Un refus ne peut plus être silencieux.** `LoginScreen` n'affichait que les
   erreurs de sa propre promesse, jamais l'état `error` du hook. Un compte non
   activé aurait vu le bouton « Se connecter » s'arrêter de tourner et l'écran
   ne rien dire. D'où deux ajouts : `resolve()` **rend** le motif du refus (et
   `signIn`/`signUp` le lèvent), et `Mur` passe `erreurInitiale` — qui répare
   aussi, au passage, les messages de démarrage muets depuis le 2026-08-12
   (« hors ligne depuis plus de 30 jours » ne s'affichait nulle part).

### Pas d'écran « en attente », volontairement
Le refusé retourne au mur de connexion, pas vers `SubscriptionRequired` : cet
écran propose d'acheter, et il n'y a rien à vendre. Il n'y a rien à *faire* dans
l'app tant qu'on n'est pas invité — donc rien à montrer d'autre que la porte et
la raison pour laquelle elle est close.

### Côté base
`shale-site/supabase/migrations/003_activation.sql` : table `public.activations`
(aucune politique d'écriture — personne ne s'active soi-même), `is_activated()`,
et la vue `my_subscription` qui expose `activated`. Le mode d'emploi — activer,
révoquer, lister ceux qui attendent, tout ouvrir — est en §5 du fichier.

⚠️ **Cette migration recrée `my_subscription`, que `schema.sql` remplace.** Tout
rejeu de `schema.sql` doit être suivi d'un rejeu de `003_activation.sql`, sinon
la colonne disparaît, l'app lit `undefined`, et **plus personne n'entre**.

⚠️ **La révocation n'est pas instantanée** sur une app déjà ouverte : elle est
constatée au prochain démarrage, et le mode hors ligne tolère jusqu'à
`GRACE_JOURS` (30). Compromis assumé, hérité du mur d'entrée.

### Vérifié
- **25 tests d'auth**, dont deux fichiers neufs : `activation.sql.test.ts` joue
  `schema.sql` + la migration sur un vrai Postgres (PGlite) — RLS comprise — et
  `access.test.ts` verrouille la règle du `=== true`.
  ⚠️ Le banc accorde **volontairement** `insert/update/delete` à `authenticated`
  sur `activations` : Supabase le fait (`grant all … to authenticated`), et ne
  donner que `select` ferait échouer les tentatives sur un « permission denied »
  — un banc plus sévère que la production, donc des politiques jamais éprouvées.
  C'est le premier jet de ce test, et il passait pour cette mauvaise raison.
- 237 tests + `tsc` + build : verts.

### Non vérifié
- **Rien n'a été joué sur le vrai projet Supabase** : la migration est écrite et
  testée sur PGlite, pas exécutée. Tant qu'elle ne l'est pas, `activated`
  n'existe pas dans la vue, `fetchSubscription` échoue en 400, et **l'app ne
  s'ouvre plus pour personne** — y compris le compte propriétaire.
- L'app native n'a pas été relancée après ces changements.

## La synchronisation bloquée par un doublon dans son propre lot (2026-08-13)

Constaté sur un vrai compte, pas en test : la file est passée de 1400 entrées à
32 puis n'a plus jamais bougé. `sync_state` contenait **exactement 50** lignes —
soit `TAILLE_LOT` — et `last_push_at` était **vide** alors que 50 entités
étaient parties. Ces deux faits ensemble ne laissent qu'une lecture : le premier
lot est passé, le second a **levé**, et `envoyer()` n'a jamais atteint sa
dernière ligne.

### La cause
`outbox.ts`, fonction `cle()` :

```js
return e.op === "delete" ? `${e.table_name}!${e.uid}` : `${e.table_name}#${e.row_id}`;
```

**Les suppressions sont regroupées par `uid`, les créations par `rowid`.**
Supprimer puis recréer une ligne donne donc DEUX entités — qui portent le même
`uid` dès lors que celui-ci est **déterministe**. Deux tables seulement sont
dans ce cas : `habit_checks` (`hc:<habitude>:<date>`) et `metric_entries`
(`me:<métrique>:<date>`). Partout ailleurs l'uid est un uuid tiré au sort, donc
une recréation en produit un autre et rien ne se télescope.

Cocher, décocher, recocher la même habitude le même jour suffit. Les deux
entités s'aveuglent vers le même `row_tag`, atterrissent dans le même envoi, et
`insert … on conflict do update` refuse d'affecter deux fois la même ligne :
Postgres lève `21000` et **rejette le lot entier**.
⚠️ `Prefer: resolution=merge-duplicates` n'y peut rien — il arbitre entre le lot
et la table, pas à l'intérieur du lot.

**Ce n'est pas une écriture perdue, c'est un bouchon.** L'exception traverse
`envoyer()`, donc rien n'est purgé, rien n'est noté, et le même lot repart
échouer à l'identique toutes les 90 s. Comme les tables filles sont envoyées en
DERNIER (ordre parent → enfant), tout ce qui les suit reste derrière elles.
Indéfiniment, et sans que rien ne le signale.

### Pourquoi 30 tests d'engine ne l'ont pas vu
Le serveur simulé d'`engine.testutil.ts` écrivait les lignes une par une dans
une `Map` : deux fois la même clé, le dernier gagnait, tout allait bien. Il
déclarait donc conforme un envoi que le vrai serveur renvoie en 400.

C'est exactement le cas prévu par la consigne de ce fichier — « corriger **le
simulateur ET le code**, jamais le seul code ». Le simulateur refuse désormais
un lot contenant deux fois le même `(table_tag, row_tag)`, avec le message de
Postgres. Les 30 tests existants passent toujours : aucun ne jouait ce cas.

### Le correctif, et pourquoi il est dans `engine.ts` et pas dans `outbox.ts`
Dédoublonnage par `(table_tag, row_tag)` juste avant l'envoi, le plus récent
l'emportant (`client_ts`, puis l'ordre d'écriture local) ; le perdant est purgé
avec le lot, il est *superseded*, pas perdu.

⚠️ **Le corriger dans `regrouper()` n'était pas possible** : l'uid d'une
création y est souvent `null` (le piège des triggers, documenté dans
`outbox.ts`), donc l'identité logique n'y est pas toujours connue. Elle ne l'est
qu'une fois le `row_tag` calculé — c'est-à-dire à l'endroit précis où le
serveur, lui, tranchera.

### Vérifié
Un test rejoue le cas réel (cocher / décocher / recocher, plus une écriture
d'une autre table derrière) et vérifie les trois choses qui comptent : la coche
arrive, **la ligne suivante arrive aussi**, et la file est vide. Il échouait
avec le message exact du serveur avant le correctif. 255 tests macOS,
263 Windows.

### Non résolu
La file d'un vrai compte ne se débloquera qu'avec une app **reconstruite** : le
binaire livré porte le défaut. Les 32 entrées en attente repartiront seules au
premier cycle de la nouvelle version.

## Règle : Antonin n'utilise jamais le Terminal

**Il n'est pas développeur.** Il ne doit avoir à taper aucune commande.
Demandé explicitement le 2026-08-24. La règle est écrite en entier dans
`~/Desktop/Shale-projet/shale-site/CLAUDE.md` ; l'essentiel :

- **Exécuter, ne pas prescrire.** Une liste de commandes à recopier n'est pas
  un livrable — c'est un travail terminé transformé en travail bloqué.
- Ce qui reste hors de portée se décrit en **gestes d'interface** (nom de
  l'app, nom du bouton), jamais en commandes.
- Ordre de préférence : je le fais → app graphique → double-clic sur un
  `.command`, en précisant qu'il n'aura rien à taper.
- Ne jamais lui faire ouvrir un fichier pour en copier le contenu.

✅ **`git push` fonctionne depuis le 2026-08-25** : les dépôts sont passés en
SSH (clé `ed25519`, sans phrase de passe). Pousser fait partie du travail, ce
n'est plus une consigne à donner à Antonin.

❌ **Jouer du SQL sur Supabase reste hors de portée** (ni `service_role`, ni
CLI) : le SQL se colle dans Supabase Studio → SQL Editor, et se colle **dans le
message**. En revanche *vérifier* le résultat se fait très bien en `curl` avec
la clé anon : le faire, plutôt que de demander « ça a marché ? ».
