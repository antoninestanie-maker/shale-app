# Améliorations proposées — UI/UX

*2026-08-28. **Rien de ce document n'est mis en œuvre.** Chaque entrée dit ce
que ça change pour toi, ce que ça coûte, et quelle porte ça ouvre ou ferme.
Classé par rapport valeur/coût.*

Ce qui a été **réparé** est dans `AUDIT-UI-2026-08.md`. Ici, c'est ce qui dépasse
« réparer ».

---

## Les trois pistes que tu as demandées explicitement

### 1. px → rem et Dynamic Type — **l'ampleur est cinq fois plus petite qu'annoncé**

**⚠️ La prémisse « l'app est en pixels » est fausse.** Mesuré sur le CSS
*produit*, pas sur la source :

```
.text-xs{font-size:var(--text-xs)}   →   --text-xs: .75rem
.text-sm{font-size:var(--text-sm)}   →   --text-sm: .875rem
```

L'échelle Tailwind est **déjà en `rem`**, et elle porte l'essentiel du texte.

| | Occurrences | Fichiers |
|---|---|---|
| **Déjà en `rem`** (`text-xs`, `text-sm`, `text-lg`, `text-3xl`…) | **526** | — |
| **En pixels durs** (`text-[Npx]` arbitraires) | **131** | 39 |
| **En pixels dans `index.css`** (`font-size: Npx`) | **5** | 1 |
| **Total à migrer** | **136** | **40** |

Soit **79 % du texte déjà insensible au problème**. La migration porte sur 136
valeurs, pas sur toute l'app.

**Et elles sont concentrées là où ça compte le plus** :

| Valeur | Occurrences |
|---|---|
| `text-[11px]` | 63 |
| `text-[10px]` | 36 |
| `text-[13px]` · `text-[12px]` | 18 |
| `text-[9px]` | 2 |
| autres (15, 17, 22, 32, 13.5) | 12 |

**38 valeurs sont SOUS le plancher de 11 px** que `DESIGN.md` s'est lui-même
donné (36 × 10 px, 2 × 9 px), plus `.tip-kbd` à 10,5 px. Ce sont précisément
les micro-libellés qu'un utilisateur de Dynamic Type a besoin d'agrandir.

**Ce que ça change pour toi.** Aujourd'hui, agrandir la taille de texte dans
Réglages iOS ne produit **aucun effet** sur ces 136 valeurs. Après migration,
elles suivent. Sur macOS l'enjeu est moindre (pas de réglage équivalent), mais
la cohérence app/site est rétablie — `DESIGN.md` § « Divergence ouverte » dit que
le passage « doit être décidé pour les deux surfaces ou pour aucune », et le
site est déjà passé.

**Le coût.** 40 fichiers, 136 remplacements mécaniques (`text-[11px]` →
`text-[0.6875rem]`, calés pour rendre **exactement les mêmes pixels à 16 px de
base** — rien ne bouge à l'œil pour qui n'a pas touché ses réglages). Risque de
régression **faible mais réel** : `.hud-label` en capitales espacées est calibré
au pixel, et un agrandissement le fera déborder de conteneurs qui ne l'attendent
pas. Il faudrait repasser la matrice largeurs × thèmes après.

⚠️ **Un piège que `DESIGN.md` documente déjà et qu'il ne faut pas retomber
dedans** : un `clamp()` dont les bornes sont en px refige ce que le `rem` venait
de libérer.

⚠️ **Un point à instruire avant de décider** : `applyZoom()` pose
`document.documentElement.style.zoom`. Le `zoom` CSS multiplie **aussi** les
`rem`. Il faut vérifier que « Densité » et Dynamic Type se composent
proprement, sinon un utilisateur en « Large » + gros Dynamic Type obtient un
produit des deux.

**Mon avis : favorable, mais pas maintenant.** C'est de l'accessibilité réelle,
le volume est raisonnable, et l'argument « les deux surfaces ou aucune » est
solide. Mais ça se fait en un chantier dédié avec sa propre recette visuelle —
pas en marge d'un audit. **Priorité : haute. Urgence : basse.**

---

### 2. Les « hover hints » sur tactile — **158 bulles, zéro atteignable au doigt**

**Chiffré, pas estimé** :

```
Tooltip.tsx:115   if (e.pointerType === "touch") return;   // pas de survol au doigt
grep -c 'data-tip='  →  158 occurrences, dans 35 fichiers
```

Le repli existe (`focusin` + `:focus-visible`), mais il ne se déclenche qu'avec
un **clavier externe**. Sur iPhone au doigt : **rien**.

**Ce que ça change pour toi.** Tout le système d'aide contextuelle de Shale —
`data-tip` pour le nom canonique, `data-tip-sub` pour la conséquence,
`data-tip-kbd` pour le raccourci — est invisible sur téléphone. Ce n'est pas
une gêne cosmétique : plusieurs actions ne sont explicitées *que* là. Exemple
mesuré : le bouton « Appliquer » de Personnaliser portait
`data-tip-sub="Redimensionne la fenêtre à ces valeurs"` — la seule phrase qui
disait ce qu'il fait, et aucun doigt ne pouvait la lire.

**Trois voies, par coût croissant :**

| Voie | Ce que ça donne | Coût | Ce que ça ferme |
|---|---|---|---|
| **(a) Appui long** — `pointerdown` + 500 ms sans mouvement ouvre la bulle | Les 158 bulles deviennent atteignables **sans toucher un seul point d'appel** | ~40 lignes dans `Tooltip.tsx` seul | Rien. Mais l'appui long est une convention **découvrable par personne** — il faut l'enseigner ou l'accepter comme un bonus |
| **(b) Un « ⓘ » là où c'est indispensable** | Explicite et découvrable | Il faut **choisir** lesquelles : décision produit, 158 fois | Alourdit visuellement les vues denses |
| **(c) Sous-titre inline sous `(pointer: coarse)`** | Zéro geste à apprendre | Coût de mise en page élevé ; le `data-tip-sub` fait souvent deux lignes | Casse la densité des vues déjà serrées |

**Mon avis : (a) d'abord, tout de suite après ton arbitrage.** C'est le seul qui
rende les 158 accessibles pour un coût localisé dans un fichier, et il n'empêche
aucun des deux autres ensuite. ⚠️ Un piège à traiter dans l'implémentation :
`Tooltip.tsx` écoute `pointerdown` pour **fermer** la bulle — il faudra
distinguer « appui qui ouvre » de « appui qui ferme ».

**Priorité : haute. Coût : faible.**

---

### 3. Les états vides — **8 vues sur 15 en ont un digne de ce nom**

Compté sur `src/views/` et sur les widgets du dashboard :

| Vue | État vide rédigé ? |
|---|---|
| Savoir | ✅ 4 messages, dont « Aucune note pour l'instant. » |
| Notes | ✅ 3, dont « Aucune note. Crée la première ! » |
| Performance | ✅ 2, dont « Pas encore de streak — vise ≥80% de tes tâches un jour donné. » |
| Tâches · Timer · Trading · Journal · Console · Réglages | ✅ 1 chacun |
| **Aujourd'hui** | ❌ **0 dans la vue elle-même** (les widgets en portent : `TodayTasks` 1, `GoalsPreview` 2) |
| ~~**Objectifs**~~ | ⚠️ **COMPTAGE FAUX — corrigé le 2026-08-28.** La vue en a un depuis le premier import (`GoalsView.tsx:240`) : « Aucun objectif. Commence par le long terme… ». Voir l'encadré ci-dessous |
| **Finance** | ❌ **0** — compensé par le parcours « MISE EN ROUTE · 1/3 », qui est meilleur qu'un état vide |
| ~~**Market-Brain**~~ | ⚠️ **COMPTAGE FAUX — corrigé le 2026-08-28.** Deux états vides, distincts et rédigés (`MarketBrainView.tsx:400`) : « pas de clé LLM » et « le briefing arrivera à {h}h », ce dernier avec son bouton **Générer maintenant** |
| **Position** | ❌ **0** — un calculateur vide est son état normal, pas un état vide |

> ### ⚠️ La sonde d'états vides était fausse — quatrième du chantier
>
> Ce tableau a été construit en cherchant les messages **qui passent par
> `t()`**. Objectifs et Market-Brain écrivaient les leurs **en français dans le
> JSX**, sans `t()` : invisibles à la mesure, parfaitement visibles à l'écran.
>
> Le tableau ne relevait donc pas une absence d'état vide — il relevait, sans
> le savoir, **une fuite de français dans l'app anglaise**. C'est ce défaut-là
> qui a été corrigé, et il était plus large que les deux états vides : les
> horizons (« court / moyen / long terme »), le compteur de tâches liées, le
> « J−3 », toute la modale d'objectif, et sept bandeaux de Market-Brain.
>
> ▶️ **`npm run i18n:check` ne peut PAS voir ce défaut** : il vérifie que
> chaque clé passée à `t()` existe en anglais, jamais qu'une chaîne affichée
> passe par `t()`. Vert ne veut pas dire traduit. C'est la même leçon que
> § 3.2 de `PASSATION-UI.md` : la mesure ne tranche pas, l'écran tranche.

**Les vrais rectangles blancs, vérifiés à l'écran :**

1. ⭐ **`WeekChart` (« 7 DERNIERS JOURS »)** — `grep` : **zéro** message d'état
   vide. À zéro donnée il rend sept barres de hauteur nulle : un grand cadre
   blanc avec des noms de jours dessous. **Vu sur iPhone**, capture à l'appui.
   C'est le pire des trois, parce qu'il occupe une carte pleine.
2. **`QuickLinks`** — un seul « + lien » en pointillés. Minimal mais honnête :
   l'action est là.
3. **`PositionSizeWidget`** — « LOTS — » avec un tiret. Le « entre entrée +
   stop » à côté sauve la lecture.

**Ce que ça change pour toi.** Un écran vide qui n'explique rien se lit comme
une panne, pas comme un début. C'est le premier écran que voit quelqu'un qui
installe Shale — et c'est exactement l'état dans lequel j'ai trouvé le
simulateur ce matin.

**Le coût.** `WeekChart` : ~10 lignes, un fichier, zéro risque. Objectifs et
Market-Brain : un message chacun. **Le meilleur rapport valeur/coût de tout ce
document.**

**Mon avis : franchement favorable, et c'est petit.**

---

## Les arbitrages ouverts par l'audit

### 4. ⭐ Le paysage sur iPhone — **il faut trancher, c'est un G1**

Rappel du constat (`AUDIT-UI-2026-08.md` § i1) : en paysage, la barre d'onglets
disparaît au profit de la barre latérale de bureau, et la Dynamic Island
recouvre la colonne de navigation. **Les douze modules deviennent inatteignables.**

| Voie | Coût | Ce que ça ferme |
|---|---|---|
| **(a) Verrouiller le portrait** — retirer `LandscapeLeft`/`Right` de `Info.plist` | **1 ligne** | Ferme l'iPad, où le paysage est l'orientation naturelle. ⚠️ `MOBILE.md` mentionne l'iPad (`iPad mini 744 pt garde sa barre latérale`) |
| **(b) Traiter le paysage** — `env(safe-area-inset-left/right)` sur le conteneur qui ne défile pas, et revoir le seuil de `useIsPhone` | ~1 jour, touche `App.tsx` + `platform.ts` — deux fichiers structurants | Ne ferme rien |

⚠️ **Le seuil est le vrai sujet, pas le padding.** `REQUETE_TELEPHONE` est
`(max-width: 600px) and (pointer: coarse)`. Un iPhone couché fait 874 pt : la
condition tombe, et **c'est le comportement du bureau qui s'installe sur un
téléphone**. Corriger le padding sans corriger le seuil laisserait une barre
latérale de 232 px sur un écran de 874 — 27 % de l'écran pour de la navigation.

**Mon avis : (a) maintenant, (b) si et quand l'iPad devient une cible.**
Le portrait verrouillé est ce que font la plupart des apps de capture, et
`MOBILE.md` § 5.4 assume déjà que le téléphone sert à **écrire**, pas à
analyser. Mais **c'est ta décision** : tu m'as demandé de constater, pas de
choisir.

### 5. La grille en dents de scie à 720 px

`ResizableGrid` : le garde « le plancher se hisse à la rangée entière » ne
couvre que le cas où **aucun** panneau ne peut partager la rangée
(`minColsPx * 2 > columns`). Il ne couvre pas « le reste de MA rangée est sous
le plancher » : à 720 px, « Tâches du jour » et « Objectifs en cours » laissent
**199 px vides** chacun.

**Coût** : un fichier (`ResizableGrid.tsx`), au **rendu uniquement**, aucune
donnée touchée — `persistSizes` n'écrit que sur action de l'utilisateur, et
`DESIGN.md` est explicite là-dessus. **Risque** : c'est le moteur de grille,
donc une régression y est visible partout à la fois. À faire avec une recette
aux sept largeurs.

**Mon avis : favorable, mais après le reste.** C'est du confort, pas une perte.

### 6. La palette mi-tokens mi-hex

`TAG_COLORS` (`TasksView.tsx`) et `HABIT_COLORS` (`JournalView.tsx`) mêlent
`var(--color-*)` et des hex figés. Conséquence **visible** : en thème clair, les
cinq premières pastilles passent à leurs variantes foncées et les trois
dernières restent identiques au thème sombre. La rangée est bâtarde.

⚠️ **Et le fond du problème n'est pas la couleur, c'est le stockage.** Ces
valeurs sont **écrites en base et synchronisées**. Une chaîne
`var(--color-blue)` en base ne se résout que dans un `style` inline. Elle casse
silencieusement dans tout contexte non-CSS : un `<canvas>` (`SketchPad.tsx:61`
fait déjà `ctx.strokeStyle = s.color`), un `<input type="color">`, un export.
**Il n'y en a aucun aujourd'hui — c'est une mine, pas une explosion.**

**Deux voies** : (a) huit tokens (cohérent avec le thème, mais on stocke des
`var()` en base, donc on garde la mine) ; (b) huit hex accordés aux tokens
(comme `knowledge.ts` fait déjà, correctement) — la palette ne suit plus le
thème, mais ce sont des couleurs de **données**, et une étiquette « Trading »
bleue a vocation à rester bleue.

**Mon avis : (b).** C'est ce que `DESIGN.md` décrit déjà (« des hex stockés en
base […] accordés aux tokens ») et ce que `knowledge.ts` applique. ⚠️ Migration
des lignes existantes à instruire — **hors périmètre, c'est du schéma de
données**.

### 7. Les voiles de backdrop à trois valeurs

`bg-black/50` · `bg-black/60` · `bg-black/85`. La doctrine n'en nomme qu'une.
**Coût : trivial** (5 fichiers). ⚠️ Le `/85` du lecteur plein écran de Trading
est peut-être délibéré — à confirmer avant d'aligner.

### 8. Les cibles tactiles de 44 pt

`DESIGN.md` annonce `--tap: 44px` et une règle sous
`(max-width: 900px), (pointer: coarse)`. Dans l'app : `grep '--tap'` → **0**,
`grep '44px'` → **0** hors ombres, et **une seule** `@media (pointer: coarse)`,
qui ne concerne que le padding des poignées de grille.

**Ce n'est pas un oubli** — `DESIGN.md` dit lui-même « l'app suit la même
doctrine mais pas encore les mêmes tokens ». C'est une divergence **documentée**.
Reste qu'elle est réelle : les onglets de la barre mobile mesurent bien ≥ 44 pt
(vérifié), mais rien ne le **garantit** ailleurs.

**Coût** : porter `--tap` et la règle dans `index.css`, puis recenser ce qui
passe dessous — mesuré à **62 cibles sous 44 px** à 720 px sur le bureau, dont
beaucoup sont légitimes à la souris. **Le vrai travail est le tri, pas la
règle.**

**Mon avis : à faire en même temps que px→rem.** Même chantier, même recette.

### 9. Deux détails relevés au passage

- **`TradeModal.tsx:245`** — « Screenshot : app native uniquement » n'est pas
  passée à `t()`. `i18n:check` ne la voit pas (il n'inspecte que les appels à
  `t()`) : la page anglaise l'affichera en français. **Une ligne.**
- **Vocabulaire de bureau sur téléphone** — « MODULES DE LA **SIDEBAR** »,
  « COLONNE GAUCHE / COLONNE DROITE » dans Personnaliser, alors que le téléphone
  n'a ni barre latérale ni colonnes. `MOBILE.md` § 5.3 classe déjà Personnaliser
  comme « **repensé** » sur iOS ; seule la moitié « taille de fenêtre » a été
  faite (commit `ad071bb`). **Coût : faible**, mais c'est une décision de
  formulation, donc la tienne.

---

## ⚠️ Mise à jour du 2026-08-28 — trois de ces pistes sont FAITES

Ce document a été écrit avant l'arbitrage. Depuis :

- **§ 2 (info-bulles au doigt)** — fait, voie (a), appui long. `2482660`.
  Le piège du clic avalé était réel et il est traité : long-presser un bouton
  de suppression montre sa bulle **sans supprimer**, vérifié à l'écran.
- **§ 3 (états vides)** — `WeekChart` fait (`ef0aca8`). Objectifs et
  Market-Brain : **clos le 2026-08-28**, mais pas comme prévu — leurs états
  vides existaient déjà, le comptage était faux. Ce qui a été réparé, c'est le
  français en dur qu'il masquait. Encadré au § 3.
- **§ 4 (paysage)** — tranché : **traiter**, pas verrouiller. Fait (`0dec33c`).
- **§ 7 (voiles)** — fait (`1ac84f9`). Le `/85` de la visionneuse reste,
  délibérément, et c'est désormais écrit dans le code.
- **§ 9 (les deux détails)** — la chaîne non traduite de `TradeModal` est faite
  (`785d66a`) ; le vocabulaire de Personnaliser aussi (`1ac84f9`).
  ⚠️ Le `data-tip` mort de `LoginScreen:190` **reste**, et ce n'est pas un
  défaut d'accessibilité : ce bouton porte déjà un `aria-label`. J'avais laissé
  entendre le contraire, c'était inexact.

**Restent ouverts** : § 1 (px→rem, reporté par décision), § 5 (grille en dents
de scie), § 6 (palette mi-tokens mi-hex), § 8 (cibles 44 pt).

⚠️ **Sujet neuf ouvert par la correction du § 3** : le français en dur n'est
pas propre aux deux modules réparés — la cloche de la barre latérale annonce
encore « Notifications, 1 non lue » en anglais (`aria-label`, relevé à l'écran
le 2026-08-28). **Aucun audit i18n complet n'a été fait**, et il n'existe aucun
outil capable de le faire : `i18n:check` regarde les clés, pas les chaînes
affichées. À instruire comme un chantier à part.

## Si je devais n'en faire que trois

1. **Les états vides** (§ 3) — le meilleur rapport valeur/coût du document, et
   `WeekChart` est un rectangle blanc constaté à l'écran.
2. **L'appui long pour les info-bulles** (§ 2, voie a) — 158 bulles rendues
   accessibles pour ~40 lignes dans un seul fichier.
3. **Trancher le paysage** (§ 4) — c'est le seul G1 encore ouvert, et une des
   deux voies coûte une ligne.
