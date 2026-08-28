# Audit UI/UX — bureau (macOS) et iOS

*2026-08-28. Branche `mobile-ios`, arbre propre. Aucun code modifié à l'écriture
de ce document : c'est le point d'arrêt de la Phase 4.*

---

## Comment cet audit a été mené, et ce que ça vaut

**Bureau.** Le front a été piloté dans une webview (`vite` sur `localhost:5199`),
aux largeurs **720** (le plancher `minWidth`) et **1440**, thèmes sombre et
clair. `AuthGate` a été franchi en forçant le **mode démo documenté** de
`config.ts` — deux lignes modifiées localement, **jamais commises, restaurées**
(`git status` propre, zéro résidu `AUDIT-TEMP`). Ce choix n'est pas de confort :
auditer en `tauri dev` aurait piloté la vraie base d'Antonin, avec un risque
d'écriture accidentelle à chaque `Tab` ou `Entrée`.

⚠️ **Conséquence à connaître** : en mode démo, `isTauri` est faux — les données
sont celles de `src/lib/demo.ts`. La mise en page, la troncature et les thèmes
sont fidèles ; les états d'erreur natifs (SQLite, trousseau, réseau) ne le sont
pas et n'ont **pas** été audités.

**iOS.** Simulateur **iPhone 17, iOS 26.5, 402 × 874 pt**. Bundle installé
vérifié **plus récent que le dernier commit du front** (18:52:50 contre
15:47:07 — la règle du § 19.1 est passée avant la première capture). Les données
du simulateur sont les **vraies données d'Antonin** (synchronisées) : rien n'a
été enregistré, aucun champ rempli, aucune note créée.

**Jamais sur l'iPhone réel.** L'appareil est `unavailable` (non connecté).
Toutes les observations iOS de ce document viennent du **simulateur**.

### Trois outils de mesure, et leur fiabilité

| Sonde | Ce qu'elle mesure | Fiable ? |
|---|---|---|
| Rognage sans `title` | `scrollWidth > clientWidth` sur un `text-overflow: ellipsis` | ✅ oui, recoupée à l'écran |
| Débordement horizontal | `documentElement.scrollWidth` vs `clientWidth` | ✅ oui |
| **Contraste WCAG** | luminance relative texte/fond | ❌ **NON — écartée** |

⚠️ **La sonde de contraste a été jetée.** Elle remontait des ratios de 1,00–1,08
(texte strictement invisible) sur des libellés parfaitement lisibles à l'écran :
elle remonte au mauvais ancêtre pour le fond. Et le thème s'est réinitialisé en
cours de parcours. **Aucun chiffre de contraste n'est rapporté ici.** Le
contraste a été vérifié par échantillon visuel seulement — c'est
« non systématiquement vérifié », pas « conforme ».

---

## Les cinq niveaux

- **G1** — inutilisable : contenu inatteignable, action impossible, débordement hors écran
- **G2** — perte silencieuse : texte tronqué sans indice, donnée invisible, échec muet
- **G3** — accessibilité : cible < 44 pt, contraste sous AA, focus invisible, hover-only
- **G4** — incohérence : libellé, icône, espacement, matériau qui contredisent le système
- **G5** — inconfort : ça marche, c'est juste désagréable

---

## Surface iOS

| # | Vue | Défaut | Gravité | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| **i1** | **Toutes — paysage** | En paysage, la barre d'onglets disparaît et la **barre latérale de bureau** la remplace ; la **Dynamic Island se pose par-dessus la colonne de navigation**. Il ne reste d'atteignable que la cloche, « Aujourd'hui », « Personnaliser » et « Réglages » — **les douze modules sont dans la zone recouverte**. | **G1** | Capture paysage redressée. Cause lue dans le code : `platform.ts` `REQUETE_TELEPHONE = "(max-width: 600px) and (pointer: coarse)"` → faux à 874 pt ; `App.tsx` ne pose `env(safe-area-inset-top)` que si `isPhone`, et **jamais** `-left`/`-right`. `Info.plist` déclare `LandscapeLeft`+`LandscapeRight`. | ⚠️ **Arbitrage — je ne tranche pas.** Deux voies : (a) verrouiller le portrait dans `Info.plist` (1 ligne, ferme la porte à l'iPad) ; (b) garder le paysage et traiter les zones sûres latérales + revoir le seuil de `useIsPhone`. |
| **i2** | Personnaliser | Le panneau **« Largeur 1280 / Hauteur 800 / Appliquer / Mémoriser la taille actuelle »** est rendu **sans aucune garde** sur iPhone, avec le texte « la fenêtre garde sa taille » — sur un appareil sans fenêtre. `isTauri` étant **vrai** sur iOS, le garde « Disponible dans l'app native uniquement » ne se déclenche jamais ; `setSize()` part **sans `catch`**. Aucun retour visible au tap. | **G4** (G2 si l'échec est muet) | Capture iPhone. `AdminView.tsx:148-158` + `:270-336` — `grep IS_IOS\|useIsPhone src/views/AdminView.tsx` : **aucune occurrence**. Attendu explicite : `MOBILE.md` § 5.3. | Encadrer le panneau `admin-window` par `!IS_IOS`. La décision est **déjà prise** en § 5.3 (« doit disparaître de l'écran iOS, pas échouer silencieusement »). |
| **i3** | Toutes | **158 `data-tip` répartis dans 35 fichiers sont inatteignables au doigt.** `Tooltip.tsx:115` : `if (e.pointerType === "touch") return;`. Le repli au focus (`focusin` + `:focus-visible`) n'existe qu'avec un clavier externe. | **G3** | Ligne de code + `grep -c 'data-tip='`. | ⚠️ **Arbitrage.** Chiffré en Phase 7. |
| **i4** | Personnaliser | Libellés de widgets rognés : « Bandeau performance (str… », « Énergie restante (charge … », « Calculateur de position (w… », **sans `title`**. | **G2** | Capture iPhone. `AdminView.tsx:120`. | `title={label}`. Évident et local. |
| **i5** | Personnaliser | Vocabulaire de bureau sur téléphone : **« MODULES DE LA SIDEBAR »**, **« COLONNE GAUCHE / COLONNE DROITE »** — alors que le téléphone n'a ni barre latérale ni colonnes (pile verticale). | **G4** | Capture iPhone. | Libellés neutres, ou conditionnés à `isPhone`. |
| **i6** | Aujourd'hui | **« 7 DERNIERS JOURS » est un grand rectangle blanc vide** : ni barres, ni message, ni invitation. Seuls les jours restent. | **G4** | Capture iPhone, bas de vue. | État vide avec une phrase, comme « Aucun objectif en cours » qui, lui, est correct. |
| **i7** | Tâches | Le filtre **ÉCHÉANCE** affiche son libellé puis **une pastille vide** : aucun gabarit, aucune icône de calendrier, aucune affordance de tap. Le correctif `bce159b` a bien posé le libellé, mais le contrôle reste muet. | **G5/G3** | Capture iPhone. | Un gabarit visible (`jj/mm/aaaa`) ou une icône, côté app — iOS ne rend rien pour un `date` vide. |
| **i8** | Tâches | Palette de tags : **les 5 premières pastilles suivent le thème, les 3 dernières non**. En clair, 1-5 passent à leurs variantes foncées et 6-8 restent identiques au thème sombre. Rangée visiblement bâtarde. | **G4** | Capture iPhone (thème clair). `TasksView.tsx:31-39` mêle `var(--color-*)` et `#fb8b4e`/`#ef6ba8`/`#3cc4de`. Même défaut dans `JournalView.tsx:28` (`HABIT_COLORS`). | Décider : soit 8 tokens, soit 8 hex. Pas les deux. ⚠️ Ce sont des couleurs **stockées en base** — voir la note en fin de document. |

### Ce qui tient sur iOS, vérifié au défilement

- **Zone sûre HAUTE** : au défilement, le contenu **ne remonte pas** sous la Dynamic Island. La correction du § 18.2 (réserve hors du défilant) tient. ✅
- **Zone sûre BASSE** : en bas d'« Aujourd'hui », la dernière carte s'arrête **au-dessus** de la barre d'onglets. ✅
- **Tiroir « Plus »** : poignée, intertitres par catégorie, et le bloc de pied **Admin · Personnaliser · Réglages avec leurs icônes** — la correction `ITEMS_PIED` du § 18.2 tient. ✅
- **Savoir** : grille de thèmes repliée en une colonne, aucun débordement, états vides présents. ✅
- **Finance** : la mise en route n'est plus écrasée par son bouton (§ 18.3-1 fermé). ✅

### Non vérifié sur iOS — à ne pas lire comme « conforme »

Timer · Objectifs · Performance · Notes · Journal · Trading · Market-Brain ·
Position · Réglages · Console **n'ont pas été ouverts sur le simulateur** dans
cette passe. Le clavier logiciel, les sélecteurs natifs et les couches plein
écran n'ont pas été éprouvés non plus.

---

## Surface bureau (macOS)

| # | Vue | Défaut | Gravité | Preuve | Correctif proposé |
|---|---|---|---|---|---|
| **d1** | **Finance** | **Deux comptes différents s'affichent tous deux « Compte … »** — « Compte courant » et « Compte de trading » deviennent indistinguables, et **aucun `title`** ne permet de les départager. Idem « Carte de … », « Boursora… », « Trading · I… », « Prestatio… ». **16 libellés rognés sans `title`** dans la seule vue Finance. | **G2** | Capture 720 px + sonde. `ComptesPanel.tsx:169,237,238,389` · `FluxPanel.tsx:129,193,194` · `PositionsPanel.tsx:65,66`. Règle violée : `DESIGN.md` § Règles impératives. | Ajouter `title` sur chaque libellé tronqué. **Évident et local.** |
| **d2** | **Timer** | ⚠️ **Rectifié après vérification dans le code.** Les quatre presets sont bien tous rognés à l'écran (« POMOD… », « DEEP W… », « ULTRADI… », « SUR MES… ») — mais **trois portent déjà leur `title`** (`TimerPanel.tsx:214`) et restent donc relisibles au survol. **Seul « sur mesure » n'en avait pas.** La première rédaction de cette ligne généralisait ce que la capture montrait ; la sonde, elle, n'avait signalé que « sur mesure ». | **G2** | `TimerPanel.tsx:236` vs `:214`. | `title` sur « sur mesure ». **Évident et local.** |
| **d3** | Timer | **« OBJECTIF ATTEI… »** tronqué sans `title`, alors que la place ne manque pas à droite de la carte. | **G2** | Capture 720 px, bas de vue. | `title`, et laisser la tuile respirer. |
| **d4** | Performance | « 25 min » rogné sans `title`. | **G2** | Sonde. | `title`. |
| **d5** | **Toutes — barre repliée** | Sous 1024 px, **aucun bouton de navigation n'a de nom accessible**. Mesuré : `innerText: ""`, `aria-label: null`, et le seul `title` est posé sur un `<span>` en **`display: none`**. ⚠️ Le commentaire de `Sidebar.tsx` qui affirme « Chaque libellé porte déjà `title` : replié, le survol le rend » est **faux** — c'est `data-tip` qui sauve le survol, et `data-tip` n'est pas une propriété d'accessibilité. | **G3** | Relevé DOM à 720 px et à 1440 px (comparaison). `Sidebar.tsx` ~L.430. | `aria-label={label}` **sur le bouton**. Évident et local ; corrige aussi le commentaire mensonger. |
| **d6** | Aujourd'hui | À 720 px, **« Tâches du jour » et « Objectifs en cours » laissent 199 px de rangée vides** à leur droite, quand toutes les autres cartes vont au bord. Bord droit en dents de scie sur les deux panneaux les plus denses. | **G5** | Mesuré : ces deux cartes finissent à `right: 479`, les six autres à `right: 678`, grille de 582 px. Le garde `minCols = minColsPx*2 > columns ? columns : minColsPx` (`ResizableGrid.tsx:759`) ne se déclenche pas : `minColsPx = 6`, et `6×2 = 12` n'est pas `> 12`. | ⚠️ **Arbitrage.** Le garde ne couvre que « aucun panneau ne peut partager la rangée » ; il ne couvre pas « le reste de MA rangée est sous le plancher ». Touche le moteur de grille — au rendu seulement, aucune donnée. |
| **d7** | Trading | **Un emoji `📷` dans l'interface**, en violation directe de « Icônes : bibliothèque maison, jamais d'emoji ». | **G4** | `TradeModal.tsx:243`. | Remplacer par une icône de `icons.tsx`. Évident et local. |
| **d8** | Savoir | Un **`.card` posé directement au-dessus d'un `backdrop-blur-sm`**, là où le système impose `.card-solid` (le dégradé `--card-bg` laisse transparaître le flou). | **G4** | `KnowledgeView.tsx:669-670`. Règle : `DESIGN.md` § Matériaux. | `card card-solid`, comme aux quatre autres couches qui le font déjà. |
| **d9** | Transverse | Les voiles de backdrop prennent **trois valeurs** : `bg-black/50` (CommandPalette, MobileNav, ComptesPanel), `bg-black/60` (six modales), `bg-black/85` (TradingView:631). La doctrine n'en nomme qu'une. | **G4** | `grep 'bg-black/'`. | Aligner sur `bg-black/60`, ou documenter l'exception du lecteur plein écran. |
| **d10** | Transverse | **38 textes sous le plancher de 11 px** (36 × `text-[10px]`, 2 × `text-[9px]`) dans 20 fichiers, plus `.tip-kbd` à 10,5 px dans `index.css`. `DESIGN.md` pose 11 px comme plancher et dit que tout ce qui est dessous « remonte ». | **G3** | Comptage exhaustif. | ⚠️ **Arbitrage** — lié à la question px→rem, chiffrée en Phase 7. |
| **d11** | Transverse | **La règle des cibles tactiles de `DESIGN.md` n'existe pas dans l'app.** `grep '--tap'` → 0 ; `grep '44px'` → 0 hors ombres ; une seule `@media (pointer: coarse)` dans `index.css`, et elle ne concerne que le padding des poignées de grille. | **G3** | `grep` sur `src/`. `DESIGN.md` § Cibles tactiles annonce `--tap: 44px`. | ⚠️ **Arbitrage.** Le token est côté **site** uniquement — `DESIGN.md` le dit (« l'app suit la même doctrine mais pas encore les mêmes tokens »). L'écart est donc documenté, pas accidentel. |

### Non vérifié sur le bureau — à ne pas lire comme « conforme »

- La largeur **1024 px** n'a pas été parcourue systématiquement (720 et 1440 l'ont été).
- Le **thème clair** n'a été regardé qu'à l'écran sur « Aujourd'hui » ; les 14 autres vues ne l'ont pas été.
- **Focus clavier** (`Tab` sur toute la vue, anneau visible, piège de focus), **`Échap`** dans chaque couche, **états de chargement et d'erreur**, **modales et tiroirs à chaque largeur** : **non éprouvés** dans cette passe.
- **Contrastes** : non mesurés (voir l'avertissement en tête).

---

## Ce qui n'est PAS un défaut

| Constat | Pourquoi ce n'en est pas un |
|---|---|
| **~390 « rognages » dans l'app** | Du design appliqué. `DESIGN.md` : « tout libellé potentiellement long porte `truncate`/`clamp-2` **et** un `title` ». Le défaut n'est pas la troncature — c'est le `title` manquant, et il ne concerne qu'une partie des sites (§ d1–d4). |
| **Tables larges de Trading, Position, Console** | `min-w-[760px]`, `min-w-[820px]`, `min-w-[640px]` **débordent** du viewport à 720 px — mais chacune est dans un conteneur réellement défilant (`.table-scroll` / `overflow-x-auto`), **vérifié en remontant les ancêtres**, et `document.scrollWidth` reste à 720. C'est `.table-scroll` qui fait son travail. |
| **`<textarea rows={2}>` de Personnaliser** | Le texte **défile** dedans, rien n'est perdu. Déjà tranché au § 18.3-3 de `MOBILE.md`. Reconfirmé à l'écran sur iPhone. |
| **`settings` présent dans `ITEMS` **et** `ITEMS_PIED`** | Pas de doublon : `MODULE_IDS` (`uiConfig.ts`) exclut `settings`, donc `config.modules` ne le contient jamais. Sa présence dans `ITEMS` sert à `BY_ID.get("settings")` et à `DESCRIPTIONS`. |
| **La concaténation `couleur + "22"`** | **Déjà corrigée.** Zéro occurrence ; 25 `color-mix` corrects. Seule trace : le commentaire de `TasksView.tsx:321` qui raconte l'ancien défaut. |
| **Les encres du `SketchPad` en hex** | Un croquis est une **donnée**. Son encre doit rester stable quel que soit le thème — un trait noir ne devient pas blanc parce qu'on passe en sombre. |
| **Les couleurs de `knowledge.ts`** | Hex stockés en base, mais **exactement les valeurs des tokens V6** : « accordées aux tokens », comme le demande `DESIGN.md`. |
| **La grille d'`Aujourd'hui`** | Rien à migrer, conformément à `DESIGN.md`. Le § d6 porte sur le **clamp au rendu**, pas sur la donnée : `persistSizes` n'écrit que sur action de l'utilisateur. |
| **`AUDIT-RESPONSIVE.md`** | N'a jamais existé (aucun commit, aucune branche). Les conclusions du chantier adaptatif vivent dans `DESIGN.md` § Adaptatif. |

---

## Une observation qui n'est pas un défaut d'UI, mais qui la fragilise

`TAG_COLORS` (`TasksView.tsx`) et `HABIT_COLORS` (`JournalView.tsx`) **écrivent
en base des chaînes `var(--color-blue)`**, alors que `DESIGN.md` les décrit comme
« des hex stockés en base ».

Ça fonctionne aujourd'hui parce que ces valeurs ne servent que dans des `style`
inline, où le CSS résout la variable. Mais ce sont des **données synchronisées**,
et elles cassent silencieusement dans tout contexte non-CSS : un `<canvas>`
(`SketchPad.tsx:61` fait déjà `ctx.strokeStyle = s.color`), un `<input type="color">`,
un export. Il n'y a **aucun** `input type="color"` dans l'app aujourd'hui — donc
pas de bogue actuel. C'est une mine, pas une explosion.

---

## Corrigé le 2026-08-28 — un commit par défaut

| Défaut | Commit | Ce qui était faux |
|---|---|---|
| **d1** | `b704e2f` | Finance : 9 libellés tronqués sans `title` — deux comptes indistinguables |
| **d2 + d3** | `d117278` | Timer : « sur mesure » et « objectif atteint » rognés sans recours |
| **d4** | `7833ec8` | Performance : la **valeur** de tuile rognée (le libellé, lui, avait son `title`) |
| **i4** | `cbe77cb` | Personnaliser : nom des widgets rogné sur 402 pt |
| **d5** | `cb4777d` | Barre repliée : aucun nom accessible sur les 13 onglets + commentaire mensonger corrigé |
| **d7** | `d8bde66` | L'emoji `📷` → `IconImage` |
| **d8** | `7b9baa2` | Savoir : `.card` → `.card-solid` au-dessus d'un flou |
| **i2** | `ad071bb` | Le panneau « taille de fenêtre » disparaît de l'iPhone ; la densité reste |
| **d5 bis** | `54224cd` | Les deux en-têtes de catégorie n'avaient pas de nom non plus — trouvé **en vérifiant** `cb4777d` |

### Vérifié à l'écran après correctif (sonde rejouée à 720 px)

| Vue | Avant | Après |
|---|---|---|
| Finance | **16** libellés rognés sans `title` | **0** |
| Timer | 2 | **0** |
| Performance | 1 | **0** |
| Boutons de la barre repliée | `aria-label: null` | **`aria-label` présent**, texte visible toujours vide |
| Bouton de catégorie | `aria-label: null` | **`aria-label: "Productivité"`** |

⚠️ **Ce que ces correctifs NE font PAS.** Un `title` ne se déclenche qu'au
SURVOL. Sur iPhone, où il n'y a pas de survol, les libellés de Finance et de
Personnaliser restent tronqués **sans recours** : le remède est lui-même
hover-only. Le bureau est réparé ; le téléphone attend l'arbitrage § i3
(`AMELIORATIONS-UI.md` § 2).

Ligne de base rejouée après les huit : `tsc` ✅ · `test:types` ✅ ·
`i18n:check` 0 manquante (1116) ✅ · `npm test` **392/392** ✅ · `vite build` ✅ ·
`cargo check --all-targets` ✅ · `cargo test --lib` **112** ✅ ·
`--target aarch64-apple-ios-sim` ✅ · `--target aarch64-apple-ios` ✅

## Second tour — 2026-08-28, après arbitrage

Décisions prises : **traiter** le paysage (pas verrouiller), **appui long** pour
les info-bulles, **px→rem plus tard**, et les petits laissés à mon jugement.

| Défaut | Commit | Vérifié à l'écran |
|---|---|---|
| **i1 — paysage** (G1) | `0dec33c` | ✅ barre d'onglets revenue, contenu à droite de l'îlot |
| **i3 — 158 bulles au doigt** | `2482660` | ✅ bulle du ✕ « Supprimer le tag » affichée, **et le tag non supprimé** |
| **i6 — rectangle blanc** | `1ac84f9` puis `ef0aca8` | ✅ après correction de ma propre erreur |
| **i5 — vocabulaire** | `1ac84f9` | ✅ « GROUPE 1 / GROUPE 2 » + explication |
| **i7 — filtre de date** | `1ac84f9` | ✅ icône de calendrier |
| **d9 — voiles** | `1ac84f9` | — (le `/85` reste, documenté) |
| **Troncature au doigt** | `785d66a` puis `a05c99a` | ✅ après correction de ma propre erreur |
| `DESIGN.md` « l'app est en pixels » | `2665977` | — |

### ⚠️ Deux correctifs à moi n'ont PAS marché du premier coup

Et dans les deux cas, c'est **la vérification à l'écran** qui l'a dit — pas la
relecture, pas `tsc`, pas les 392 tests.

1. **`WeekChart`** — j'avais traité « aucune donnée » (`pct === null`) et écrit
   que les vrais zéros « restent un graphique ». Le cadre est resté blanc : le
   cas réel est *des tâches dues, aucune cochée*, donc `pct = 0`. Sept barres de
   hauteur zéro rendent le même vide que sept barres absentes.
2. **`.truncate-souris`** — écrasée en silence par `truncate`. `truncate` est un
   utilitaire Tailwind (couche `utilities`), ma classe vivait dans `components`,
   et à spécificité égale la couche postérieure gagne. ⚠️ **Le dépôt s'était déjà
   fait prendre là-dessus** (reset de marge de `.rgrid-content`, 2026-07-13) :
   le piège était consigné, je l'ai repris quand même.

### ⚠️ Ce que le `title` ne pouvait pas réparer

Les correctifs `title` du premier tour ont réparé **le bureau seulement** : un
`title` ne se rend qu'au survol. L'appui long ne rattrape pas ce cas non plus —
il lit `data-tip`, pas `title`. D'où `.truncate-souris` : sous `(pointer: coarse)`
le texte passe à la ligne et se lit **sans aucun geste**.

### Non prouvé, et il faut le dire

**Le défilement en PAYSAGE n'a pas été piloté.** L'injection tactile du
simulateur reste dans le repère portrait (402 × 874) et aucun des deux axes
n'atteint le défilant. Ce qui est établi : les réserves latérales sont posées
sur le **même conteneur non défilant** que la réserve du haut, dont le maintien
au défilement est vérifié. C'est solide par construction — ce n'est pas une
capture.

⚠️ **Une fausse piste écartée** : j'ai cru un moment que l'app restait bloquée
en paysage au retour au portrait. C'était le menu du Simulateur qui ne répond
pas sans `activate` préalable. **Aucun défaut de l'app.**

## En attente d'arbitrage

**i1** (paysage — verrouiller ou traiter les zones sûres latérales),
**i3** (info-bulles au doigt), **i5/i6/i7** (vocabulaire de bureau, état vide du
graphique, affordance du filtre de date), **i8** (palette mi-tokens mi-hex),
**d6** (grille en dents de scie), **d9** (voiles à trois valeurs),
**d10/d11** (px→rem et cibles 44 pt).

## Phase 8 — la divergence app ↔ site

**Le site n'a pas été modifié.** Voici ce que ce chantier oblige — ou n'oblige
pas — à y répercuter.

### Rien des huit correctifs n'a à être répercuté

Vérifié entrée par entrée contre la table de `CLAUDE.md` § « l'app et le site ne
divergent jamais » :

| Correctif | Répercussion sur le site ? |
|---|---|
| d1–d4, i4 — attributs `title` | **Non.** Invisible pour le site. |
| d5 + en-têtes de catégorie — `aria-label` | **Non.** |
| d7 — emoji → `IconImage` | **Non.** L'emoji était dans `TradeModal`, que la démo ne montre pas. |
| d8 — `card` → `card-solid` | **Non.** Matériau interne d'une couche que le site n'a pas. |
| i2 — panneau « taille de fenêtre » masqué sur iOS | **Non.** La démo ne montre pas Personnaliser. |

**Et la fidélité de fond est intacte, vérifiée :** `Demo.astro` → `NAV` porte
les mêmes douze modules, dans le même ordre, avec les mêmes libellés et les
mêmes deux catégories que `Sidebar.tsx` → `ITEMS` / `CATEGORIES`.

### Ce qu'il faut noter, sans que ce soit une divergence

**La démo jouable montre une barre latérale ; l'iPhone montre une barre
d'onglets.** `MOBILE.md` § 5.4 l'avait anticipé, et la règle est explicite : la
**géométrie** d'un conteneur n'est pas une divergence — au même titre que la
barre latérale repliée en icônes sous 1024 px n'en a jamais été une. Les
modules, leurs noms, leurs icônes et ce qu'ils font sont identiques.

⚠️ Ce qui **deviendrait** une divergence : si l'arbitrage sur le paysage (§ i1)
retirait des modules du téléphone, ou si « Plus » cessait de montrer les modules
trading verrouillés. Aucun des deux n'est proposé.

### ⭐ Une phrase de `DESIGN.md` est fausse, et le site en dépend

> « ### ⚠️ Divergence ouverte : l'app est encore en pixels »

**C'est inexact, et mesuré :** l'échelle Tailwind est rendue en `rem`
(`--text-xs: .75rem`), et elle porte **526 des 662 déclarations de taille de
texte** — soit **79 %**. Les pixels durs sont **136 valeurs dans 40 fichiers**,
pas « l'app ».

Ça change la décision, pas seulement la formulation : le passage px→rem qui
paraissait un chantier de refonte est un chantier de **136 remplacements**. Le
chiffrage complet est dans `AMELIORATIONS-UI.md` § 1.

▶️ **À corriger dans `DESIGN.md` quand l'arbitrage px→rem sera pris** — et à
répercuter côté site, dont la doctrine adaptative cite cette divergence.

### Aucun outil ne surveille cette ressemblance

Inchangé, et rappelé ici parce que c'est le seul garde-fou : `npm run check` du
site regarde le SEO, l'accessibilité et une liste de valeurs périmées, **pas la
fidélité à l'app**. La table de `CLAUDE.md` et sa jumelle dans
`shale-site/CLAUDE.md` sont tout ce qu'il y a.

## Un défaut mineur relevé au passage, non corrigé (hors périmètre du lot)

`TradeModal.tsx:245` — la chaîne « Screenshot : app native uniquement » n'est
pas passée à `t()`. `i18n:check` ne la voit pas (il n'inspecte que les appels à
`t()`), donc la page anglaise l'affichera en français. Une ligne, mais c'est un
défaut d'i18n et non d'UI : à traiter séparément.
