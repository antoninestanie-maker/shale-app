# Design system V6 — « Obsidian & Jade »

Source de vérité : les tokens CSS de `src/index.css` (`@theme` = sombre par défaut,
surcharges `:root[data-theme="light"]` + media query pour le mode système).
Ce fichier documente les valeurs, les règles d'usage et les justifications.
(V6 remplace V5 « Onyx & Émeraude » le 2026-07-21 — refonte « Apple-grade »
demandée : fond quasi-OLED, vraie hiérarchie d'élévation, accents désaturés,
physique de mouvement unifiée.)

## Intention

App mixte **productivité + trading** utilisée plusieurs heures d'affilée :

- fond **quasi-OLED** (`#07090d`) : chaque cran de luminosité gagné réduit
  l'éblouissement en session prolongée. Jamais de noir pur — les ombres
  restent lisibles et le scroll ne « clignote » pas ;
- **trois plans distincts** (fond → surface → surface-2), chacun avec son
  ombre et son liseré interne : c'est cette hiérarchie d'élévation qui donne
  la profondeur « matériau » d'une app Apple, au lieu d'aplats juxtaposés ;
- **un seul accent** (bleu azur `#4d8dff`) pour l'interactif ;
- couleurs vives **réservées aux signaux de trading** : vert jade =
  achat/win/long, rouge corail = vente/loss/short, ambre = alerte,
  indigo = sessions & segments ;
- sobriété Apple : typographie, espace, hairlines — zéro glow décoratif ;
- la famille neutre (fond/surfaces/texte/hairlines) partage la même teinte
  ardoise (hue ~220°) pour un rendu homogène « premium ».

## Couleurs

| Token | Sombre « Obsidian » | Clair « Alabaster » | Usage |
|---|---|---|---|
| `--color-bg` | `#07090d` | `#f4f5f7` | fond de fenêtre |
| `--color-surface` | `#12151c` | `#ffffff` | cartes, sidebar |
| `--color-surface-2` | `#1c202a` | `#ebedf1` | inputs, boutons secondaires, pistes |
| `--color-text` | `#eef1f6` | `#0b0d12` | texte principal |
| `--color-text-dim` | `#8b94a6` | `#5c6474` | texte secondaire, labels |
| `--color-blue` | `#4d8dff` | `#1b62e5` | accent unique : actions, liens, focus, sélection |
| `--color-green` | `#14c8a0` | `#06825f` | sémantique : achat / win / long / go |
| `--color-red` | `#ff5666` | `#d22b3c` | sémantique : vente / loss / short / stop |
| `--color-yellow` | `#f0b341` | `#96650b` | alertes, avertissements, risque engagé |
| `--color-violet` | `#8e8bff` | `#4b45d6` | sessions de trading, catégories |
| `--color-border` | ardoise 11 % | encre 9 % | hairlines |
| `--color-border-strong` | ardoise 20 % | encre 16 % | séparateurs appuyés |
| `--color-overlay` / `-2` | ardoise 6/12 % | encre 4.5/8.5 % | hover / sélection |
| `--color-on-green` | `#04150f` | `#ffffff` | texte sur aplat vert |

### Matériaux & élévation (hors Tailwind)

| Token | Rôle |
|---|---|
| `--card-bg` | **dégradé vertical court** en sombre (`#171b24` → `#12151c`) : simule une source de lumière haute. Aplat blanc en clair. |
| `--card-shadow` / `--card-shadow-hover` | ombre à deux étages (contact + ambiante) + liseré interne clair |
| `--card-border-hover` | hairline au survol |
| `--lift-shadow` | panneau soulevé pendant un drag / resize |
| `--glass-bg` + `--glass-blur` | matériau verre (`.glass`) : sidebar, barres d'outils flottantes |
| `.card-solid` | aplat opaque pour une carte posée AU-DESSUS d'un `backdrop-filter` (modale, lecteur) : le dégradé `--card-bg` y laisserait transparaître la vue floutée |
| `--ambient` | halo bleu unique, très doux, en haut de fenêtre |
| `--scrollbar-thumb(-hover)` | scrollbars fines translucides |

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
est respecté globalement (animations et transitions neutralisées).

### Contrastes (WCAG 2.1)

Sur le fond `#07090d` :

- texte principal `#eef1f6` : ~17:1 — AAA ; sur surface `#12151c` : ~15:1 ;
- `--color-text-dim` `#8b94a6` : ~6.2:1 — AA (AA large partout) ;
- `--color-blue` `#4d8dff` : ~6.4:1 — AA même en corps de texte
  (contre 4.9:1 en V5 : gain net de lisibilité) ;
- `--color-green` `#14c8a0` : ~9.6:1 — AAA ;
- `--color-red` `#ff5666` : ~6.6:1 — AA ;
- `--color-yellow` `#f0b341` : ~11:1 — AAA ;
- en clair, tous les accents sont ≥ 5:1 sur blanc.
- vert et rouge diffèrent aussi en **luminosité** (pas seulement en teinte)
  → différenciables en cas de daltonisme rouge-vert ; les montants gardent
  toujours leur signe (`+5R` / `−2R`) en plus de la couleur.

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

## Règles impératives (inchangées depuis V3)

- **Jamais** de couleur codée en dur ni de voile `bg-white/x`/`bg-black/x`
  (exception : backdrops de modales `bg-black/60`). Tokens partout ; dans les
  SVG/Recharts/styles inline : `var(--color-*)` ; pour une teinte translucide :
  `color-mix(in srgb, var(--color-x) N%, transparent)`.
  ⚠️ **Jamais de concaténation `couleur + "22"`** : invalide dès que la couleur
  est un token `var(...)` (fond transparent silencieux) — utiliser `color-mix`.
- Un seul accent (bleu). Vert/rouge = sémantique uniquement — dans le tracker
  live : bouton plein vert « Gagnante » (`text-on-green`), plein rouge
  « Perdante » (`text-white`). Zéro glow décoratif.
- `.card` = matériau + hairline + ombre à deux étages. `.hud-label` pour tout
  micro-label. `.glass` pour la sidebar et les barres d'outils flottantes.
- Bouton primaire : `pill bg-blue text-white font-semibold` ; secondaire :
  `pill border border-border bg-surface-2`.
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

- **V5 « Onyx & Émeraude »** (2026-07-13 → 2026-07-21) : bg #0b0e14, surface
  #1a202c, bleu #3b82f6, vert #00c896, rouge #f23645. Remplacée par V6.
- **V4 « Graphite & Signal »** (2026-07-12) : bg #0c0f14, bleu #2e7ff2.
- **V3** (2026-07-11) : suppression de l'esthétique HUD (grille, scanlines,
  orbes, glows, coins tactiques) au profit d'une sobriété type Apple.
