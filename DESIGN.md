# Design system V7 — « Ink & Azure »

Source de vérité : les tokens CSS de `src/index.css` (`@theme` = sombre par défaut,
surcharges `:root[data-theme="light"]` + media query pour le mode système).
Ce fichier documente les valeurs, les règles d'usage et les justifications.
(V7 remplace V6 « Obsidian & Jade » le 2026-09-22 — décidée par Antonin le
2026-09-20 sur maquette interactive : « même famille, en plus claquant ». La V6
avait remplacé la V5 le 2026-07-21 ; son détail est dans *Historique*.)

## Intention

App mixte **productivité + trading** utilisée plusieurs heures d'affilée :

- **le fond reste une encre presque neutre** (`#07080b`, teinte ~220°). La force
  vient de ce qu'on pose dessus, pas d'un fond coloré. Trois variantes plus
  douces ont été comparées côte à côte sur maquette et écartées ;
- **un accent qui claque : `#0088ff`, le bleu de Shazam exact**, pour le texte,
  les icônes, le focus, les états actifs et les liserés de sélection ;
- **un dégradé de marque bleu → cyan, avec une seule règle : il signale une
  FONCTION, il ne décore jamais un contenant au repos.** Cinq emplois, pas un
  de plus : l'**action** (bouton primaire), la **progression** (jauges
  linéaires, anneau de discipline, courbe du patrimoine en Finance), la
  **sélection** (soulignement d'onglet actif — il n'en existe aucun dans l'app
  aujourd'hui), et l'**interaction** (filet de survol d'une carte, invisible
  au repos). **Aucun liseré coloré permanent sur une carte** : c'est le tic
  visuel des interfaces « IA » ;
- **trois plans distincts** (fond → surface → surface-2), chacun avec son
  ombre et son liseré interne neutre : c'est la hiérarchie d'élévation qui donne
  la profondeur « matériau » ;
- couleurs vives **réservées aux signaux de trading**, plus saturées qu'en V6
  mais lisibles en session longue (le néon a été écarté) : rouge =
  vente/loss/short, ambre = alerte, indigo = sessions & segments ;
- ⭐ **le « réussi » est à l'encre** *(2026-09-23)* : case cochée, gain, trade
  gagnant, habitude tenue, jauge terminée, « en direct » prennent **la couleur
  du texte**, pas une couleur. C'est littéralement *Ink & Azure* : de l'encre
  et du bleu, et seules les alertes (ambre, rouge) sortent de la famille. Le
  vert n'est plus un signal — il ne reste que comme couleur **qu'on choisit**
  (étiquette, habitude, événement…), voir § « Le réussi à l'encre » ;
- sobriété : typographie, espace, hairlines — zéro glow décoratif, **sauf
  l'ombre teintée du bouton primaire** (`--btn-primary-shadow`) ;
- **un peu de mouvement, à deux endroits précis** : le filet de survol des
  cartes et l'entrée en cascade des panneaux (§ « Physique du mouvement »).

⚠️ **Testé et écarté, ne pas implémenter** : un dégradé sur les chiffres héros
(texte blanc → azur par `background-clip: text`). Antonin l'a essayé sur
maquette, a hésité, puis a tranché contre (2026-09-20).

**Honnêteté sur ce que la V7 change** : les neutres restent proches de la V6,
c'est voulu. Le gain vient de l'accent, des dégradés et des signaux.

## Couleurs

| Token | Sombre « Ink » | Clair | Usage |
|---|---|---|---|
| `--color-bg` | `#07080b` | `#f5f6f8` | fond de fenêtre |
| `--color-surface` | `#111318` | `#ffffff` | cartes, sidebar |
| `--color-surface-2` | `#1a1d24` | `#ebedf1` | inputs, boutons secondaires, pistes |
| `--color-text` | `#f4f6fa` | `#0a0c12` | texte principal |
| `--color-text-dim` | `#9aa1b2` | `#5a6272` | texte secondaire, labels |
| `--color-blue` | `#0088ff` | `#0060dc` | accent unique : texte, icônes, focus, états actifs. **Ne porte pas de blanc** |
| `--color-blue-solid` | `#0070f0` | `#0070f0` | **aplat bleu qui porte du texte** (jour choisi, compteur, pastille sélectionnée) |
| `--color-on-blue` | `#ffffff` | `#ffffff` | texte sur `--color-blue-solid` / `.fill-primary` |
| `--color-success` | `#f4f6fa` | `#0a0c12` | **le réussi, à l'encre** : texte, coche, bouton plein, point « en direct ». **= `--color-text`**, verrouillé par `theme.encre.test.ts` |
| `--color-success-fill` | `#c7ccd6` | `#323741` | le réussi en **grande surface** : barres de graphique, cartes de chaleur |
| `--color-on-success` | `#07080b` | `#ffffff` | texte sur aplat d'encre (« Lancer », « Gagnante ») |
| `--color-green` | `#4ade80` | `#287845` | **plus un signal** : une couleur qu'on choisit (étiquettes, habitudes, événements, texte de note, types, branches de carte). Reste parce que les données enregistrent `var(--color-green)` / `green` |
| `--color-red` | `#ff4d5e` | `#c8122b` | sémantique : vente / loss / short / stop |
| `--color-yellow` | `#ffc23a` | `#8f5300` | alertes, avertissements, risque engagé |
| `--color-violet` | `#9a8cff` | `#4b40e0` | sessions de trading, catégories |
| `--color-border` | ardoise `rgb(160 170 190)` 13 % | encre `rgb(10 12 18)` 9 % | hairlines |
| `--color-border-strong` | ardoise 20 % | encre 16 % | séparateurs appuyés |
| `--color-overlay` / `-2` | ardoise 6/12 % | encre 4.5/8.5 % | hover / sélection |

### ⭐ Pourquoi deux bleus

`#0088ff` se lit en texte sur fond sombre (5,3:1 sur la surface) mais **du blanc
posé dessus ne donne que 3,5:1**, sous le seuil AA de 4,5. `#0070f0`, à peine plus
profond, porte le blanc à **4,6:1** et reste un bleu franc. Donc : texte et icônes
prennent le bleu Shazam exact ; tout aplat bleu qui porte du texte prend
`--color-blue-solid` ; le bouton primaire prend `--gradient-primary`, dont les deux
arrêts portent le blanc (4,6 et 5,6). **Ne pas remplacer `#0088ff` « pour le
contraste »** : le compromis est déjà fait par ces deux tokens.

### Dégradés et ombre du bouton (hors Tailwind)

| Token | Sombre | Clair | Emploi — et AUCUN autre |
|---|---|---|---|
| `--gradient-primary` | `linear-gradient(180deg, #0070f0, #0062dc)` | identique | fond du bouton primaire, via `.fill-primary` seulement |
| `--gradient-brand` | `linear-gradient(90deg, #0088ff, #00c2ff)` | `… #0060dc, #0082e6` | jauges linéaires (état en cours ; « atteint » passe à l'encre), soulignement d'onglet actif, filet de survol |
| `--gradient-brand-from` / `-to` | `#0088ff` / `#00c2ff` | `#0060dc` / `#0082e6` | les deux arrêts bruts, pour les `<linearGradient>` SVG (anneau de discipline, courbe du patrimoine) — un `stop-color` n'accepte pas un raccourci `background` |
| `--btn-primary-shadow` | ombre bleue 55 % + reflet interne | ombre `--color-blue-solid` 50 % | bouton primaire seulement |

**`.fill-primary`** (`index.css`, à côté de `.glass`) : `--gradient-primary` +
`--color-on-blue` + `--btn-primary-shadow`. **Au survol il s'assombrit
(`brightness(.92)`, blanc à 5,3:1), jamais il ne s'éclaircit** — éclaircir ferait
retomber le blanc sous 4,5. Sa transition reprend `transform`, sans quoi elle
écraserait celle de `button` et l'appui (`scale(.975)`) sauterait.

Dans un SVG : un `id` de dégradé **par montage** (`useId()`), jamais un id fixe —
le premier `<linearGradient>` du document gagnerait si le composant était monté
deux fois.

### Matériaux & élévation (hors Tailwind)

| Token | Rôle |
|---|---|
| `--card-bg` | **dégradé vertical court** en sombre (`#161920` → `#111318`) : simule une source de lumière haute. Aplat blanc en clair. |
| `--card-shadow` / `--card-shadow-hover` | ombre à deux étages (contact + ambiante, noir neutre) + liseré interne clair `rgb(255 255 255 / .05)` — un reflet neutre, sans couleur : c'est la substance du bord, pas un ornement |
| `--card-border-hover` | hairline au survol |
| `--lift-shadow` | panneau soulevé pendant un drag / resize |
| `--glass-bg` + `--glass-blur` | matériau verre (`.glass`) : la surface à 72 % (sombre) / blanc à 78 % (clair) |
| `.card-solid` | aplat opaque pour une carte posée AU-DESSUS d'un `backdrop-filter` (modale, lecteur) : le dégradé `--card-bg` y laisserait transparaître la vue floutée |
| `--ambient` | halo unique, très doux, en haut de fenêtre : `#0088ff` à 12 % (sombre) / 7 % (clair). Pas plus fort : un halo appuyé a été écarté |
| `--scrollbar-thumb(-hover)` | scrollbars fines translucides |

⚠️ **Les `rgb(… / a)` dérivés ne suivent pas les tokens tout seuls** : verre,
bulle, voiles et ombres sont écrits avec leurs propres canaux. Toute retouche d'une
couleur de base les oblige à être recalculés à la main.

⚠️ **Le thème clair est écrit DEUX fois** (`[data-theme="light"]` et le media
query du mode Système). `theme.premier-paint.test.ts` échoue si les deux blocs
diffèrent d'une ligne.

### Info-bulle (« hover hint »)

| Token | Rôle |
|---|---|
| `--tip-bg` | verre **plus dense** que les panneaux (0.9 en sombre, 0.92 en clair) : la bulle flotte au-dessus de tout, y compris d'une carte claire |
| `--tip-border` | hairline propre à la bulle |
| `--tip-shadow` | ombre portée courte + liseré interne (sombre) |

Classes `.tip-wrap` (position) et `.tip` (matériau + animation) —
voir `src/components/Tooltip.tsx` pour le comportement. Le mouvement d'entrée
part **du bord de l'élément survolé** (4 px) avec un zoom 0.96 → 1 et une
origine de transformation alignée sur le côté choisi : la bulle « sort » de
l'élément au lieu d'apparaître de nulle part. Fondu 120 ms, ressort 190 ms.

### Physique du mouvement

`--ease-out-quint` (`cubic-bezier(.22,1,.36,1)`), `--ease-spring`
(`cubic-bezier(.32,.72,0,1)`), `--dur-fast` 120 ms, `--dur-base` 200 ms,
`--dur-slow` 320 ms. **Toutes** les micro-interactions les utilisent, ce qui
donne à l'app une signature de mouvement unique. `prefers-reduced-motion`
est respecté globalement : durée des animations et des transitions **et, depuis
la V7, délai des animations** (sans quoi un élément à délai restait invisible le
temps de son délai, puis surgissait).

Le mouvement est **gelé**, à deux exceptions nommées (V7) :

**Le filet de survol d'une carte.** Invisible au repos. Au survol à la souris
(`@media (hover: hover) and (pointer: fine)` — iOS simule un survol collant), la
carte se soulève de 2 px (`translate`, `--dur-base`) et un filet d'1 px apparaît
en haut, dans le rayon (14 px de retrait), dégradé
`transparent → from → to → transparent`. Jamais un contour complet, jamais un
halo. Écrit une fois, sur `.card`. Trois exclusions, chacune pour une raison :
- `.card-solid` (modales, lecteur) : toujours sous la souris, ils garderaient le
  filet allumé en permanence ;
- une carte qui contient un `.fixed` : le `translate` ferait d'elle le bloc
  conteneur d'une modale rendue à l'intérieur (PIEGES § 9.5) ;
- **dans la grille, c'est le panneau (`[data-pid]`) qui se soulève**, pas la
  carte : le panneau porte `overflow: clip`, qui rognerait les 2 px du haut et
  le filet avec. Par `translate`, indépendant du `transform` du FLIP.

**L'entrée en cascade des panneaux** — la seule animation d'entrée du système,
avec le fondu de vue qui existait déjà (`animate-fade-up` sur le conteneur de
vue). Au montage d'une grille (`ResizableGrid`, donc à chaque changement de vue) :
`opacity 0→1`, `translate 0 10px → 0`, 420 ms, `--ease-out-quint`.
**Délai = 55 ms × (rang − 1), plafonné à 440 ms dès le 9e panneau**, en CSS pur
(`:nth-of-type`). `fill-mode: backwards`, pas `both` : une fois jouée,
l'animation ne tient plus rien. La classe `.rgrid-entree` ne vit qu'une seconde
(un minuteur la retire, il ne calcule rien) : React **déplace** les nœuds quand on
réordonne, et une animation se rejoue sur un nœud réinséré.

### Contrastes (WCAG 2.1) — mesurés le 2026-09-22 sur les valeurs écrites

| | fond | surface | surface-2 |
|---|---|---|---|
| **Sombre** | | | |
| texte `#f4f6fa` | 18,51 | 17,17 | 15,59 |
| texte atténué `#9aa1b2` | 7,74 | 7,18 | 6,52 |
| bleu `#0088ff` | 5,69 | 5,28 | 4,79 |
| encre du réussi = texte | 18,51 | 17,17 | 15,59 |
| encre adoucie `#c7ccd6` (non textuel) | 12,43 | 11,54 | 10,47 |
| vert choisi `#4ade80` | 11,49 | 10,66 | 9,68 |
| rouge `#ff4d5e` | 6,18 | 5,73 | 5,20 |
| ambre `#ffc23a` | 12,43 | 11,53 | 10,46 |
| indigo `#9a8cff` | 7,22 | 6,70 | 6,08 |
| **Clair** | | | |
| texte `#0a0c12` | 18,08 | 19,55 | 16,68 |
| texte atténué `#5a6272` | 5,67 | 6,13 | 5,23 |
| bleu `#0060dc` | 5,24 | 5,67 | 4,83 |
| encre du réussi = texte | 18,08 | 19,55 | 16,68 |
| encre adoucie `#323741` (non textuel) | 11,04 | 11,94 | 10,19 |
| vert choisi `#287845` | 5,03 | 5,44 | 4,64 |
| rouge `#c8122b` | 5,43 | 5,87 | 5,01 |
| ambre `#8f5300` | 5,70 | 6,17 | 5,26 |
| indigo `#4b40e0` | 6,25 | 6,75 | 5,76 |

Et : blanc sur `#0070f0` **4,59** · sur `#0062dc` 5,55 · sur `#0070f0` assombri
(`brightness(.92)`) 5,27 · blanc sur `#0088ff` **3,52** (d'où les deux bleus) ·
`--color-on-success` sur encre 18,51 (sombre) / 19,55 (clair) · fin du
dégradé de jauge clair (`#0082e6`) sur surface-2 3,36 (élément non textuel,
seuil 3) · bouton « Perdante » (blanc sur rouge sombre) **3,24** — 3,1 en V6, pas
de régression, accepté tel quel.

*(2026-09-23)* Encre et rouge diffèrent en **luminosité** autant qu'en teinte :
écart OKLab 0,30 en deutéranopie simulée, contre 0,11 pour l'ancienne menthe —
le gain/la perte se lisent désormais sans voir les couleurs. Les montants
gardent toujours leur signe (`+5R` / `−2R`) : un gain à l'encre ne se distingue
d'un zéro QUE par son signe, c'est voulu.

### ⭐ Le réussi à l'encre — quelle forme à quel endroit (2026-09-23)

Antonin a comparé cinq verts et deux pistes sans vert, sur les mêmes écrans
(planche « Le vert de Shale »), et a choisi l'encre en demandant qu'elle soit
« bien intégrée selon les endroits ». Un simple remplacement de token ne
suffisait pas : le blanc pur, posé sur de grandes surfaces, écrase tout le
reste. D'où la règle, par FORME et non par écran :

| Ce que c'est | Classe / token | Exemples |
|---|---|---|
| texte, icône, montant positif | `text-success` | « +2R », série en cours, « Enregistré », ∞ du runway |
| coche, bouton plein, point « en direct » | `bg-success` (+ `text-on-success`) | case cochée, « Lancer 25 min », « Gagnante », systèmes actifs |
| puce/chip « fait » ou « choisi » | `border-success/40 bg-success/10 text-success` | trade gagnant, cycle fait, « haussier » |
| jauge fine terminée | `bg-success` | objectif atteint, phase achevée, streak |
| **grande surface** : barres, cartes de chaleur | `var(--color-success-fill)` | complétion des tâches, 7 jours, discipline, habitudes |

**Ce qui n'est PAS devenu de l'encre, exprès :**

- les **pastilles « nouveau »** de la barre latérale et de la barre d'onglets
  mobile → **bleu**, comme la pastille de la cloche : un appel à l'attention,
  pas un réussi ;
- l'**interrupteur « pause auto »** du Timer → **bleu**, comme les
  interrupteurs de Réglages ;
- la série **« liquide »** de la courbe du patrimoine → `--color-text` : c'est
  une série, pas un réussi ;
- toutes les **couleurs choisies** (`TAG_COLORS`, `HABIT_COLORS`, couleurs
  d'événement, texte coloré des notes, types, branches de carte) restent sur
  `--color-green` — seule sa valeur a changé (menthe → `#4ade80` / `#287845`,
  le « vert tendre » de la planche). **Aucune donnée touchée.**

Les tâches du calendrier et les créneaux libres proposés, verts jusque-là,
sont à l'encre : un ton neutre, que les couleurs d'événement dominent.

## Typographie

- `--font-display` **Instrument Sans** (variable, 600/700) : h1–h4, chiffres héros.
  Tracking optique : `-0.022em` (h2–h4), `-0.03em` (h1). `text-wrap: balance`.
- `--font-body` **Instrument Sans** (variable, 400/500) : texte courant, UI.
  Une seule grotesque pour l'app ET le site vitrine — elle remplace le couple
  Outfit + DM Sans. Auto-hébergée (OFL), donc identique hors ligne et sur
  toutes les plateformes.
- `--font-mono` **JetBrains Mono** (400/600) : chiffres de marché, prix,
  timers, heures. `font-variant-numeric: tabular-nums` global.
- `overflow-wrap: anywhere` sur `p/li/dd/dt` : aucun mot ne peut casser une
  mise en page, quelle que soit la taille du widget.

Échelle pratiquée : 11 px `.hud-label` (600, +0.05em, uppercase, **tronqué
en ellipse**) · 12–13 px métadonnées · 14 px corps · 17 px h3 · 20–22 px h2 ·
30 px h1 · 48–60 px chiffres héros.

## Formes & espace

- `--radius-card: 18px` (cartes), `--radius-field: 12px` (champs, petits
  boutons carrés), `--radius-pill: 100px` (boutons, chips).
- Grille : 12 colonnes, gouttières 16 px (`ResizableGrid`), padding de vue 32 px.
- Espacements internes de carte : 16–24 px ; entre groupes : 24–32 px.

## Structure des widgets (classes de layout)

Le redimensionnement doit **restructurer** le contenu, pas étirer un cadre vide.
Cinq classes suffisent — voir `CLAUDE.md` § « Widgets : structure réelle ».

| Classe | Rôle |
|---|---|
| `.panel-col` | sous-bloc en colonne flex (`min-height: 0`) |
| `.panel-grow` | absorbe la hauteur gagnée (spacer ou zone centrée) |
| `.panel-scroll` | zone qui **défile** dans la carte ; sa présence autorise le moteur à descendre sous la hauteur du contenu |
| `.panel-chart` | zone de graphique à hauteur **définie et extensible** (`height:0` + `min-height`), avec `min-width: 0` + `overflow: hidden` : sans cela le SVG explicitement dimensionné de recharts empêche la carte de rétrécir |
| `.panel-stretch` | racine en grille : les tuiles se partagent la hauteur |

Et pour la largeur : `.auto-tiles-sm|.auto-tiles|.auto-tiles-lg`
(`repeat(auto-fit, minmax(min(100%, N), 1fr))`, N = 72/120/200 px) — les
tuiles se réorganisent selon la largeur **réelle du widget**, jamais selon
un breakpoint de viewport. `.clamp-1/2/3` pour les textes longs,
`.table-scroll` pour les tableaux larges.

## Adaptatif — échelles fluides et points de rupture

Ajouté le 2026-08-25, **côté site d'abord** (`shale-site`, phase 2 du chantier
« Adaptatif »). L'app suit la même doctrine mais pas encore les mêmes tokens :
voir l'avertissement en fin de section.

### La règle de fond : `rem` pour le texte, `clamp()` pour les titres

`1rem` vaut la taille de police de base choisie par le visiteur ou par le
système. Une taille en `px` l'ignore ; une taille en `rem` la suit. C'est la
seule façon de tenir le WCAG 1.4.4 — et c'est ce qui manquait : avant ce
chantier, le site portait **290 tailles en pixels contre une seule en `rem`**,
et agrandir la police système n'y produisait strictement aucun effet.

⚠️ **Un `clamp()` dont les deux bornes sont en `px` refige ce que le `rem`
venait de libérer.** D'où la séparation :

- **texte courant et interface → `rem` pur**, sans `clamp()`. Il n'a pas à
  changer d'échelle entre un téléphone et un 27 pouces ; il a seulement à suivre
  le réglage du lecteur ;
- **titres → `clamp()` dont chaque borne est en `rem`**, avec la partie fixe de
  l'interpolation en `rem` elle aussi. `clamp(34px, 4.6vw, 58px)` est
  insensible au zoom texte ; `clamp(2.125rem, 1.603rem + 2.609vw, 3.625rem)`
  ne l'est pas.

Les valeurs sont calées pour rendre **exactement les pixels d'avant** à 16 px de
base. Rien ne bouge à l'œil pour qui n'a pas touché ses réglages ; tout suit
pour qui y a touché.

| Token | Valeur | Rendu à 16 px | Emploi |
|---|---|---|---|
| `--fs-2xs` | `0.6875rem` | 11 px | `.eyebrow`, mentions techniques — **plancher du site** |
| `--fs-xs` | `0.75rem` | 12 px | métadonnées |
| `--fs-sm` | `0.8125rem` | 13 px | légendes, liens fins |
| `--fs-md` | `0.875rem` | 14 px | corps d'interface, nav, petits boutons |
| `--fs-base` | `0.9375rem` | 15 px | listes, corps dense |
| `--fs-lg` | `1rem` | 16 px | corps de bouton, corps de lecture |
| `--fs-xl` | `1.09375rem` | 17,5 px | corps de lecture long |
| `--fs-h3` | `clamp(1.25rem, 1.163rem + 0.435vw, 1.5rem)` | 20 → 24 px | h3 |
| `--fs-h2` | `clamp(1.625rem, 1.364rem + 1.304vw, 2.375rem)` | 26 → 38 px | h2 |
| `--fs-h1` | `clamp(2.125rem, 1.603rem + 2.609vw, 3.625rem)` | 34 → 58 px | h1 de section |
| `--fs-hero` | `clamp(3rem, 1.783rem + 6.087vw, 6.5rem)` | 48 → 104 px | héros |

⚠️ **Le plancher du site est 11 px, et c'est délibéré.** L'outil d'audit
signale sous 11,5 px : c'est un filet, pas une norme. Monter à 11,5 n'améliore
rien de mesurable et décale une trentaine d'étiquettes en capitales espacées,
calibrées au pixel. En revanche, tout ce qui est SOUS 11 px remonte : 9,5 px
(`.baseline`), 10 px, 10,5 px.

### Espacements fluides

Toutes les rampes vont de **320 px** (le plus petit téléphone de la matrice) à
**1240 px** (`--page`, au-delà duquel la colonne ne grandit plus).

| Token | Rampe | Remplace |
|---|---|---|
| `--gutter` | 18 → 40 px | la bascule 40 → 22 px à 900 px, **seul point de rupture global du site** |
| `--section` | 64 → 130 px | les dix `padding-bottom: 130px` du rythme vertical |
| `--card-pad` | 20 → 34 px | les paddings de carte figés |
| `--gap-sm/md/lg` | 8→12 · 14→24 · 24→44 px | les `gap:` figés des grilles |
| `--tap` | `44px` | le minimum de cible tactile, en dur nulle part |

⚠️ **`--gutter` est déclaré en `@property … syntax: "<length>"`.** Sans cet
enregistrement, sa valeur *calculée* reste la chaîne « clamp(…) » : le
`parseFloat()` de `tools/dev/wrap-check.mjs` lit `NaN`, retombe sur son défaut
de 40 px, et dénonce chaque page comme fautive.

### Points de rupture

Une media query ne sait pas lire une variable CSS : ces quatre valeurs sont une
**convention**, pas des tokens. Elles doivent être respectées à la main.

| Nom | Valeur | Ce qui bascule (site) |
|---|---|---|
| `xs` | 420 px | la marque perd son mot ; les CTA longs reviennent à la ligne |
| `sm` | 600 px | la pastille FR/EN descend dans le menu ; les grilles à 2 colonnes s'empilent |
| `md` | 900 px | la barre passe au burger ; les grilles à 2-3 colonnes s'empilent |
| `lg` | 1200 px | l'explorateur de modules passe en accordéon ; la démo passe en onglets |

Avant ce chantier, **sept** valeurs cohabitaient sans nomenclature : 420, 560,
620, 700, 800, 900, 1000.

### Cibles tactiles

La condition est « le pointeur **peut** être un doigt », pas « l'écran est
étroit » : `@media (max-width: 900px), (pointer: coarse)`. `pointer` interroge
le matériel, la clause de largeur sert aux fenêtres de bureau réduites — et
c'est la seule des deux qu'un navigateur sans tête sait vérifier.

⚠️ **Ce n'est pas de la détection par user-agent** : `pointer` est une media
feature standard qui décrit le dispositif de pointage réel. Ce qui est interdit,
c'est l'inverse — déduire le matériel d'une chaîne d'identité.

### Ce qui ne s'applique PAS au site

`.panel-col`, `.panel-grow`, `.panel-scroll`, `.panel-chart`, `.panel-stretch`
et `.auto-tiles-*` sont des classes de **widget d'app**. Le site n'a pas de
widgets redimensionnables : les y copier ne créerait que du code mort et
l'illusion d'un système commun.

En revanche `overflow-wrap: anywhere` (sur `p/li/dd/dt`), `.table-scroll` et
`.clamp-1/2/3` **valent pour les deux surfaces** et ont été portés à l'identique
dans `shale-site/vitrine/src/styles/global.css`. Ils n'y existaient pas avant le
2026-08-25 : le chantier « Adaptatif » les supposait partagés, ils ne l'étaient
pas. Ils le sont désormais.

### Côté app — ce qui a été fait, et ce qu'il ne faut PAS faire

**La barre latérale se replie en icônes sous 1024 px** (`Sidebar.tsx`). Elle
mesurait 232 px de 720 à 2560 px sans jamais céder un pixel : 32 % de la fenêtre
en Split View. Repliée, elle fait 64 px et le tableau de bord gagne 168 px.

Icônes plutôt que tiroir superposé : les treize items restent à UN clic, sur une
app dont on change d'onglet en permanence. Un tiroir en coûterait deux. Il
n'aurait de sens que sous ~600 px, largeur que `minWidth` interdit.

⚠️ **Trois composants du pied de barre écrivent du TEXTE** — horloge, session,
synchronisation. Repliés dans 64 px, l'horloge se cassait caractère par
caractère. Horloge et session reviennent avec les libellés (`hidden lg:contents`) ;
l'indicateur de synchronisation RESTE, réduit à sa pastille — c'est le seul
endroit où une panne de sync se voit.

**`minWidth` passe de 900 à 720 px** (`tauri.conf.json`) : c'est la largeur d'une
demi-fenêtre en Split View sur un écran de 1440. L'audit a montré que l'interface
s'y comporte correctement — il n'y avait aucune raison de l'interdire.

#### ⚠️ La grille d'Aujourd'hui n'a PAS besoin de migration

`ResizableGrid` est **déjà** container-responsive, et par construction : le
plancher d'un panneau est exprimé en PIXELS (`MIN_PANEL_PX = 248`) puis traduit
en colonnes d'après la largeur **mesurée** de la grille — jamais d'après un
breakpoint de fenêtre.

Vérifié en mesurant : une disposition écrite à 1440 px, la fenêtre réduite à
720 puis ramenée à 1440 — la valeur stockée est identique au caractère près, et
les panneaux retrouvent exactement leurs largeurs. Le clamp vit au rendu ;
`persistSizes` n'est appelé que par une action de l'utilisateur.

**Écrire une migration des dispositions réécrirait la donnée qui, aujourd'hui,
survit intacte.** C'est le contraire de ce qu'il faut faire.

#### Ce qui n'est pas un défaut : la troncature

Un audit naïf compte ~390 « rognages » dans l'app. Ce sont des `.truncate` et
des `.clamp-N`, c'est-à-dire du design appliqué : « tout libellé potentiellement
long porte `truncate` ou `clamp-2` **et** un `title` » (§ Règles impératives), et
`.hud-label` est décrit plus haut comme « tronqué en ellipse ». Une fois ces
éléments exclus, il reste **quatre** constats sur 13 vues × 7 tailles × 2 thèmes.

### ⚠️ Sur téléphone, une couche PLEIN ÉCRAN doit réserver la barre d'onglets

**La barre d'onglets est en `fixed`, donc posée PAR-DESSUS tout le reste.** Une
couche plein écran — modale, lecteur, feuille — qui ne réserve rien lui passe
dessous, et ce qu'elle met en bas devient inatteignable. Le haut a le même
problème avec la Dynamic Island.

La réserve, partout la même :

```
paddingTop:    calc(env(safe-area-inset-top) + 0.5rem)
paddingBottom: calc(env(safe-area-inset-bottom) + 4.75rem)
```

⚠️ **Elle va sur le conteneur qui NE DÉFILE PAS.** Un `padding` posé à
l'intérieur d'une zone défilante défile avec elle : au repos tout paraît juste,
et le contenu remonte sous l'îlot dès qu'on fait défiler. C'est exactement le
défaut qui a traversé les quatorze vues jusqu'au 2026-08-27.

⚠️ **Et une capture AU REPOS ne prouve rien d'une zone qui défile.** C'est ce
qui a fait passer le défaut pour réglé pendant une demi-journée.

Cette règle est écrite parce que l'oubli s'est produit **deux fois le même
jour** : la réserve haute des vues (`App.tsx`), puis le pied du lecteur de
Savoir, dont « Terminé » et la corbeille tombaient sous la barre — soit
précisément la sortie que ce pied venait d'ajouter.

Le cas particulier du BAS : quand la couche défile elle-même sur toute la
hauteur (une vue), la réserve du bas reste sur le défilant — c'est de l'espace
qu'on veut pouvoir atteindre en défilant, pas une bordure.

### ⚠️ Divergence ouverte : l'app est MIXTE — corrigée, puis requalifiée le 2026-08-28

⚠️ **Cette section disait « l'app est encore en pixels ». C'est faux, et c'est
mesuré sur le CSS PRODUIT, pas sur la source :**

```
.text-xs{font-size:var(--text-xs)}   →   --text-xs: .75rem
.text-sm{font-size:var(--text-sm)}   →   --text-sm: .875rem
```

L'échelle Tailwind est **déjà en `rem`** et porte l'essentiel du texte :

| | Occurrences | Fichiers |
|---|---|---|
| déjà en `rem` (`text-xs`, `text-sm`, `text-3xl`…) | **526** | — |
| en pixels durs (`text-[Npx]` arbitraires) | **131** | 39 |
| en pixels dans `index.css` (`font-size: Npx`) | **5** | 1 |

Soit **79 % du texte déjà insensible au problème**, et **136 valeurs à migrer**
— pas « l'app ». Dont **38 SOUS le plancher de 11 px** que cette même page se
donne (36 × 10 px, 2 × 9 px, plus `.tip-kbd` à 10,5 px).

L'écart avec le site reste réel. Mais le chantier n'a pas l'ampleur que cette
section lui prêtait, **et surtout il n'achète pas ce qu'on croyait**.

### ⭐ Le motif d'accessibilité est TOMBÉ — mesuré le 2026-08-28 au soir

Cette section a longtemps supposé que passer en `rem` rendrait l'app sensible à
la taille de police du système. **C'est faux dans une WKWebView**, et c'est
mesuré, pas déduit : simulateur iPhone, taille système poussée à
accessibility-XXXL, la racine reste à **16 px** — `11px` et `0.6875rem` rendent
tous deux 14 px, comme au défaut. Seul `font: -apple-system-body` réagit
(17 → 53 px).

Et la question « à instruire avant de migrer » a sa réponse : le `zoom` multiplie
la valeur UTILISÉE, une seule fois, **quelle que soit l'unité**. « Densité » et
`rem` ne se composent pas en produit. Ce verrou-là n'existait pas.

▶️ **Ce que fait l'app depuis le 2026-08-28** : elle lit la taille demandée par
le système sur un élément sonde et la replie dans la densité
(`facteurDynamicType()` dans `src/lib/uiConfig.ts`). Le facteur vaut exactement
1 au réglage par défaut. **Aucune unité n'a été migrée.**

⚠️ **Règle qui en sort, et qui vaut pour toute nouvelle règle CSS** : le `zoom`
multiplie AUSSI les unités de viewport. Tout `vh`/`vw` doit être multiplié par
`var(--zoom-inv)` — mesuré, `max-h-[88vh]` rendait 792 px dans un écran de 600
à densité 150 %, donc débordait. Ça valait déjà pour la densité « Large ».

**Ce qui reste ouvert**, et qui n'est plus de l'accessibilité : la cohérence
d'unités avec le site. Le passage doit toujours être décidé **pour les deux
surfaces ou pour aucune** — mais l'argument est désormais l'homogénéité, pas
Dynamic Type. Détail et chiffrage : `AMELIORATIONS-UI.md` § 1 bis.

## Règles impératives (depuis V3 ; bouton primaire et dégradé revus en V7)

- **Jamais** de couleur codée en dur ni de voile `bg-white/x`/`bg-black/x`
  (exception : backdrops de modales `bg-black/60`). Tokens partout ; dans les
  SVG/Recharts/styles inline : `var(--color-*)` ; pour une teinte translucide :
  `color-mix(in srgb, var(--color-x) N%, transparent)`.
  ⚠️ **Jamais de concaténation `couleur + "22"`** : invalide dès que la couleur
  est un token `var(...)` (fond transparent silencieux) — utiliser `color-mix`.
- Un seul accent (bleu). Encre/rouge = sémantique — dans le tracker
  live : bouton plein encre « Gagnante » (`bg-success text-on-success` ;
  c'était vert jusqu'au 2026-09-23), plein rouge
  « Perdante » (`text-white`). Zéro glow décoratif — *(nuance V7, 2026-09-22)*
  sauf l'ombre teintée du bouton primaire (`--btn-primary-shadow`) ; et le
  dégradé de marque (`--gradient-brand`, `--gradient-primary`) ne sert que cinq
  emplois nommés — l'action, la progression (jauges, anneau de discipline,
  graphique Finance) et la sélection — plus un filet de survol de carte,
  invisible au repos, jamais à décorer un contenant en permanence.
- **Aplat bleu qui porte du texte** : `bg-blue-solid text-on-blue`, jamais
  `bg-blue text-white` (3,5:1). `bg-blue` seul reste pour ce qui n'écrit rien
  (pastilles, interrupteurs, points).
- `.card` = matériau + hairline + ombre à deux étages. `.hud-label` pour tout
  micro-label. `.glass` pour la sidebar et les barres d'outils flottantes.
- Bouton primaire : `pill fill-primary font-semibold` *(V7 ; c'était
  `pill bg-blue text-white font-semibold` jusqu'au 2026-09-22)* — pas de
  `hover:opacity-*` ni de `transition-opacity` : la classe porte son survol ;
  secondaire : `pill border border-border bg-surface-2`.
- Icônes : bibliothèque maison `src/components/icons.tsx`, jamais d'emoji.
- **Toute action non triviale porte une info-bulle** : `data-tip` (+ `data-tip-sub`
  pour la conséquence, `data-tip-kbd` pour le raccourci). Une action évidente
  (« Annuler », « Enregistrer » d'un formulaire, carte au titre visible) n'en
  porte PAS — une bulle qui répète le libellé est du bruit. Un bouton
  `disabled` ne reçoit pas le survol : poser la bulle sur un conteneur.
- Les couleurs de **données** (labels de tâches, habitudes) sont des hex stockés
  en base : la palette proposée aux nouveaux éléments vit dans `TasksView.tsx`
  (`TAG_COLORS`) et doit rester accordée aux tokens.
- Tout conteneur flex qui reçoit du texte porte `min-w-0` ; tout libellé
  potentiellement long porte `truncate` ou `clamp-2` **et** un `title`.

### Historique

- **V6 « Obsidian & Jade »** (2026-07-21 → 2026-09-20, remplacée dans le code le
  2026-09-22) : bg #07090d, surface #12151c, surface-2 #1c202a, texte #eef1f6,
  dim #8b94a6, bleu #4d8dff, vert #14c8a0, rouge #ff5666, ambre #f0b341,
  indigo #8e8bff ; clair bg #f4f5f7, texte #0b0d12, bleu #1b62e5, vert #06825f,
  rouge #d22b3c, ambre #96650b, indigo #4b45d6. Jugée « un peu fade » : accent
  désaturé, signaux adoucis, aucun élément de marque. Contrastes V6 : texte ~17:1,
  dim ~6.2:1, bleu ~6.4:1, vert ~9.6:1, rouge ~6.6:1, ambre ~11:1.
- **V5 « Onyx & Émeraude »** (2026-07-13 → 2026-07-21) : bg #0b0e14, surface
  #1a202c, bleu #3b82f6, vert #00c896, rouge #f23645. Remplacée par V6.
- **V4 « Graphite & Signal »** (2026-07-12) : bg #0c0f14, bleu #2e7ff2.
- **V3** (2026-07-11) : suppression de l'esthétique HUD (grille, scanlines,
  orbes, glows, coins tactiques) au profit d'une sobriété type Apple.

---

## Entrer dans Shale — la traversée de la marque

*(ajouté le 2026-09-12)*

Ce n'est **pas** un écran de chargement avec un logo. C'est une **transition
d'élément partagé** : la marque déjà affichée au-dessus du formulaire de
connexion ne disparaît pas — c'est elle qui grandit, et qu'on traverse.

### Les trois temps

| Temps | Durée | Ce qui bouge |
|---|---|---|
| **1. Poser** | 200 ms | Le formulaire, le titre et le sous-titre s'effacent (`opacity`, 8 px de `translateY`). La marque **ne bouge pas** — c'est ce qui vend la continuité. |
| **2. Approche** | 400 ms, ease **in** | La marque grossit vers l'écran (×4,5). Les quatre strates se décollent : facteurs 1,00 / 1,06 / 1,12 / 1,18 **autour d'un centre commun**. |
| **3. Traversée** | 300 ms | L'app, déjà montée dessous, s'ouvre par un cercle parti du centre de la marque, en remontant de `scale(1.04)` à `1`. La marque continue de grossir et s'efface. |

C'est la parallaxe des strates du temps 2 qui porte le spectacle, pas la durée.

### La règle qui gouverne tout

**La transition habille du TRAVAIL RÉEL.** Elle démarre quand la porte s'ouvre,
l'app est montée derrière pendant qu'elle joue, et elle se termine au **plus
tard** de (fin de l'animation, app prête).

- L'app est prête avant → on ne ralentit rien, l'animation va au bout.
- L'app est en retard → on ne rallonge pas, on **tient la dernière image**.
- Jamais de délai inventé pour faire joli.

Un minuteur de 2 500 ms force l'état final : un chargement bloqué ne doit
jamais piéger quelqu'un derrière un logo. Une tape ou une touche saute à la
fin. Un onglet caché aussi — une animation que personne ne regarde n'a rien à
jouer.

### Ce qu'elle a le droit d'animer

`transform`, `opacity` et `clip-path`. **Rien d'autre.** Aucun `filter`, aucun
`backdrop-filter` animé, aucune animation de `width`, `height` ou `box-shadow`
— animer par-dessus le verre de la sidebar est ce qui coûte le plus cher dans
WKWebView. `will-change` est posé au démarrage et retiré à la fin, jamais laissé
en permanence.

⚠️ **Des animations, jamais des transitions.** Une transition sur une propriété
qui ne change pas n'émet jamais `transitionend`, et la machine à états
attendrait pour toujours. Une animation émet `animationend` même à durée quasi
nulle — ce qui est le cas sous `prefers-reduced-motion`, où la règle globale
d'`index.css` écrase `animation-duration` sur `*`.

### Les trois portes

Trois murs mènent à la même porte, et la transition part des trois :
connexion **ou création de compte** (`signedOut`), ouverture à froid
(`loading`), et retour du mur d'abonnement (`noSub`). Chacun relève la position
de sa marque avant de disparaître, pour que la traversée reparte de sa vraie
place et non du centre de l'écran.

### Le réglage, et pourquoi il existe

**Réglages → Apparence → Animation d'entrée** : `Complète` (défaut) · `Courte`
· `Aucune`.

Une animation spectaculaire vue dix fois par jour finit par être perçue comme
de la lenteur. « Aucune » ne montre vraiment rien — pas une image de voile.
`prefers-reduced-motion` l'emporte sur « Complète » (un fondu de 150 ms, sans
mouvement), mais pas sur « Aucune », qui montre déjà moins.

### ▶️ Parité site — décision d'Antonin, 2026-09-12

**La démo jouable de la page d'accueil du site commence APRÈS la transition.**
Un visiteur n'a pas de session à ouvrir : la traversée n'y habillerait aucun
travail réel, elle ne serait qu'une seconde d'attente avant de pouvoir toucher
quoi que ce soit. C'est la règle « elle couvre du travail réel », appliquée.

## Saisir une date — `ChampDate`, et rien d'autre (2026-09-18)

**Il n'y a plus aucun `<input type="date">` dans l'app.** Toute date passe par
`src/components/ChampDate.tsx`. Un contrôle natif par formulaire, c'était treize
rectangles gris qui ignoraient le thème et, sur iOS, un panneau système toujours
en clair par-dessus une app sombre.

**La forme.** Un bouton qui a l'allure d'un champ (`--radius-field`, `bg-surface-2`,
bordure `--color-border`, `hover:border-border-strong`), portant l'icône de
calendrier et **la valeur écrite en clair** — « Demain », « jeu. 24 sept. », ou
son placeholder quand rien n'est posé. C'est cette valeur qui rend le contrôle
identifiable : le natif, vide, n'affichait rien du tout au doigt.

**Le panneau.** `.card .card-solid rounded-2xl` — l'aplat opaque, parce qu'il
flotte au-dessus du reste (règle du dégradé de `.card` sous un `backdrop-filter`).
Dedans : le mois en titre (cliquable pour revenir au mois courant), deux
chevrons, la grille de six semaines **du lundi au dimanche** comme partout dans
l'app, les trois raccourcis, et le champ de frappe.

**Les états d'une cellule**, et ils ne se confondent pas :
- **choisie** : aplat `--color-blue`, texte blanc, semi-gras ;
- **aujourd'hui** : texte bleu semi-gras, jamais d'aplat — sinon on ne
  distinguerait plus « le jour où l'on est » de « le jour qu'on a choisi » ;
- **curseur clavier** : un anneau `--color-border-strong` d'un pixel ;
- **hors du mois** : `text-text-dim/55` ;
- **hors bornes** : `disabled`, sans survol.

**Densité et doigt.** Les cellules portent `.cible-tactile` : 36 × 28 px à la
souris, **44 pt sous `pointer: coarse`** (mesuré). Le panneau fait 17,5 rem de
large, donc il tient sur un écran de 390 pt avec ses marges.

⚠️ **Il garde le clavier**, et c'est une règle de conception, pas un détail
d'accessibilité : flèches, `PageUp/PageDown`, `Entrée`, `Échap`, plus un champ
où l'on tape « 24/09 ». Même arbitrage que `RouletteHeure` — la molette
S'AJOUTE au champ de texte, elle ne le remplace pas, parce que taper bat viser.

## La feuille de route : le vocabulaire, et la carte qui la montre (2026-09-20)

### « Phase », et plus « jalon »

Antonin : « le nom de jalon n'est peut-être pas assez parlant, réfléchis-y,
sinon laisse-le. » Il ne l'était pas, et pour une raison précise : dans la langue
courante, un **jalon** est un REPÈRE qu'on franchit — un point sur une ligne.
Ici, c'est un CONTENANT : le niveau qui regroupe plusieurs sous-objectifs. Le mot
promettait une date, il livrait un dossier.

    objectif
    ├── PHASE  (niveau 1, regroupe)          ← s'appelait « jalon »
    │    └── sous-objectif (niveau 2)
    └── sous-objectif direct (niveau 1)

« Phase » dit exactement cela, en un mot court, identique dans les deux langues,
et sans entrer en collision avec **étape** — le mot générique qui désigne les
deux genres — ni avec **sous-objectif**.

⚠️ **Le mot affiché change, les identifiants ne bougent pas** : la colonne
`goals.is_milestone` reste (aucune migration pour un mot), et le type
`GenreEtape = "jalon" | "sous-objectif"` reste, parce que c'est une clé et non du
texte. Le mot vit à un seul endroit, `nomDeGenre()` dans
`lib/objectifs/libelles.ts`, avec sa phrase d'explication (`aideDeGenre()`)
affichée sous le champ de saisie : **une étiquette sans explication ne fait que
déplacer la question.**

### Ce que la feuille de route a gagné

- **un en-tête qui dit son nom** — « FEUILLE DE ROUTE · 3 étapes ». Sans lui, la
  zone indentée sous un objectif était un empilement d'étapes sans titre : on ne
  savait pas ce qu'on regardait, donc pas davantage ce qu'on pouvait y ajouter ;
- **l'échéance d'une étape se pose SUR PLACE** (`ChampDate` dans le panneau de
  l'étape ouverte), au lieu d'exiger la fenêtre « Échéance et description… » du
  menu « ⋯ ». C'est la donnée dont dépend l'alerte « objectif en péril » : elle
  ne peut pas coûter trois gestes et un changement de contexte ;
- **un objectif naît garni** — voir ci-dessous.

### « Par quoi commencer » : des étapes et des tâches à la création

Dans la fenêtre de **création** seulement (`GoalModal`), deux listes de lignes
qui poussent d'elles-mêmes (`Entrée` descend d'un champ), plafonnées à cinq :
les premières étapes, et les premières tâches — chacune avec son `ChampDate`.

⚠️ **Jamais en modification** : sur un objectif existant, ces listes feraient un
second chemin d'ajout à côté de la feuille de route, qui le fait déjà mieux
(elle enchaîne à l'infini, elle sait promouvoir une phase, elle rattache
l'existant). Deux chemins pour une même écriture finissent par diverger.

⚠️ **Et tout reste facultatif** : un titre et `Entrée` créent un objectif nu, au
même coût qu'avant. Les étapes naissent **sous-objectifs** (pas phases : une
phase vide afficherait « phase vide, non comptée » sur chaque ligne qu'on vient
de taper), **mesurées**, **sans échéance**. Les tâches se rattachent à
l'objectif, jamais à une étape devinée.

### La carte mentale, dans les deux sens

**Un objectif SE REGARDE en carte** — bouton « Carte » de l'en-tête. C'est
`EditeurCarte` en mode **lecture** : zoom, panoramique, « tout voir », repli,
export PNG/SVG, et un clic qui OUVRE l'étape ou la tâche du nœud. Aucun geste
d'écriture, parce que la carte est **dérivée** : la feuille de route est l'unique
auteur de ces nœuds, et un dessin que personne ne relira serait un piège.

**Une carte mentale DEVIENT un objectif** — bouton « Objectif » de l'éditeur de
carte, dans une note ou une fiche. La correspondance est fixe et dite à
l'écran :

    centre                → l'objectif
    niveau 1 AVEC enfants → une PHASE
    niveau 1 SANS enfant  → un sous-objectif direct
    niveau 2              → un sous-objectif de la phase
    niveau 3 et au-delà   → des TÂCHES du sous-objectif qui les porte

Le panneau **annonce les comptes avant d'écrire** (« 3 étapes · dont 1 phase »,
« 1 tâche créée ») : une carte de quarante nœuds crée une dizaine d'objectifs
d'un seul clic, et personne ne doit le découvrir après. Un nœud qui **cite déjà**
une tâche la rattache au lieu de la recopier ; une note ou une fiche citée est
rattachée par une arête.

⚠️ **Les deux formes ne sont PAS synchronisées**, et c'est écrit à l'écran : la
carte reste dans sa note, la reconvertir créerait un second objectif. Une carte
branchée sur les objectifs devrait répondre à « que se passe-t-il quand on
supprime un nœud ? », et la seule réponse honnête serait « on supprime
l'objectif » — un geste destructeur derrière un geste de dessin.
