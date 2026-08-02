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
