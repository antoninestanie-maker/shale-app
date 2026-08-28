# ▶️ PASSATION — chantier UI/UX du 2026-08-28

*Écrit pour quelqu'un qui n'a rien vécu de ce qui précède. Ce document se
suffit : état du dépôt, ligne de base, ce qui a été fait, ce qui reste, et les
pièges à ne pas re-diagnostiquer.*

Les deux livrables détaillés sont `AUDIT-UI-2026-08.md` (le tableau, les
preuves) et `AMELIORATIONS-UI.md` (les propositions chiffrées, non
implémentées).

---

## 1. L'état, en six lignes

| | |
|---|---|
| Branche | `mobile-ios`, **poussée** (`origin/mobile-ios`) |
| Arbre | **propre** |
| Branches non fusionnées | **zéro** |
| App macOS | reconstruite et réinstallée le 2026-08-28 à 12:57:59 |
| App iOS | reconstruite et réinstallée sur le **simulateur** (iPhone 17) à 12:57:33 |
| iPhone réel | **jamais** — l'appareil est `unavailable`. Rien de ce chantier n'y a été vu |

**L'invariant du § 19.1 de `MOBILE.md` tient** : les deux bundles sont
POSTÉRIEURS au dernier commit qui touche `src/`.

### Ligne de base, à rejouer avant de croire quoi que ce soit

```
npx tsc --noEmit                              # ✅
npm run test:types                            # ✅
npm run i18n:check                            # ✅ 1125 entrées, 0 manquante
npm test                                      # ✅ 392 / 392
npx vite build                                # ✅
cd src-tauri
cargo check --all-targets                     # ✅
cargo test --lib                              # ✅ 112
cargo check --target aarch64-apple-ios-sim    # ✅
cargo check --target aarch64-apple-ios        # ✅
```

⚠️ Si `npm test` échoue, **capturer le nom du test AVANT de relancer**
(intermittence connue, `MOBILE.md` § 17.6). Il n'a pas récidivé de tout ce
chantier — une douzaine d'exécutions vertes.

---

## 2. Ce qui a été corrigé — 18 commits, un par défaut

De `b704e2f` à `e0231f5`. Dans l'ordre de gravité, pas chronologique.

### G1 — inutilisable

| Défaut | Commit |
|---|---|
| **En paysage, l'iPhone perdait ses douze modules.** Le seuil de `useIsPhone()` portait sur la LARGEUR ; un iPhone couché fait 874 pt, donc la barre latérale de bureau remplaçait la barre d'onglets — et les réserves de zone sûre, conditionnées à `isPhone`, disparaissaient avec, laissant la Dynamic Island sur la colonne de navigation | `0dec33c` |

### G2 — perte silencieuse

| Défaut | Commit |
|---|---|
| **Un seul `Échap` fermait DEUX étages** dans toute la famille des modales — ⌘K par-dessus un formulaire, et la saisie partait avec | `00a2e2d` |
| Finance tronquait 9 libellés sans `title` : deux comptes différents s'affichaient tous deux « Compte … » | `b704e2f` |
| Timer : « sur mesure » et « objectif atteint » rognés sans recours | `d117278` |
| Performance : la **valeur** de tuile rognée (le libellé, lui, avait son `title`) | `7833ec8` |
| Personnaliser : nom des widgets rogné sur 402 pt | `cbe77cb` |
| **Tronqué à la souris, replié au doigt** — un `title` ne se rend qu'au survol ; sous `(pointer: coarse)` le texte passe à la ligne | `785d66a` + `a05c99a` |

### G3 — accessibilité

| Défaut | Commit |
|---|---|
| **158 info-bulles n'existaient que pour la souris.** Appui long de 500 ms, avec le clic qui suit AVALÉ | `2482660` |
| La barre repliée ne nommait aucun de ses 13 onglets (`aria-label`) | `cb4777d` |
| Les 2 en-têtes de catégorie non plus | `54224cd` |

### G4 / G5

| Défaut | Commit |
|---|---|
| Personnaliser proposait de redimensionner une fenêtre qui n'existe pas sur iPhone | `ad071bb` |
| Un emoji `📷` dans le formulaire de trade → `IconImage` | `d8bde66` |
| Savoir : `.card` au lieu de `.card-solid` au-dessus d'un flou | `7b9baa2` |
| `WeekChart` : rectangle blanc → état vide rédigé | `1ac84f9` + `ef0aca8` |
| Vocabulaire de bureau sur téléphone, affordance du filtre de date, voiles à trois valeurs | `1ac84f9` |
| `DESIGN.md` : « l'app est encore en pixels » était **faux** | `2665977` |

---

## 3. ⚠️ Les pièges découverts — ne pas les re-diagnostiquer

### 3.1 ⭐ Réinstaller sur le SIMULATEUR déconnecte la session

`simctl install` par-dessus une app existante **préserve les données**
(`shale.db` intact, vérifié) mais **fait perdre l'accès au trousseau**, donc le
`refresh_token`. L'app repart sur l'écran de connexion, et **une session Claude
ne peut pas s'y reconnecter** (elle ne saisit pas d'identifiants).

▶️ **Conséquence : faire tout l'audit visuel AVANT de reconstruire.** Détail
complet dans `MOBILE.md` § 22.

### 3.2 ⭐ Sur cette app, `getComputedStyle` n'est PAS une preuve de couleur

**Trois** sondes de mesure ont dû être jetées pendant ce chantier, toutes sur
les couleurs :

1. une sonde de contraste WCAG qui annonçait des ratios de 1,00 sur des textes
   parfaitement lisibles (elle remontait au mauvais ancêtre pour le fond) ;
2. une sonde de « figement entre thèmes » qui annonçait les libellés de la barre
   latérale figés au token SOMBRE en thème clair ;
3. le fait de poser `data-theme` à la main pour mesurer.

Les trois butent sur le même mur : **`getComputedStyle` rend une valeur périmée
sur les éléments sous `backdrop-filter`** — exactement le bogue Chromium que
`src/lib/theme.ts` documente et contourne déjà (`repaintBackdrops`).

▶️ **La capture d'écran tranche, la mesure non.** Et pour basculer le thème,
passer par l'interface (Réglages → Apparence), jamais par l'attribut.

### 3.3 La couche `utilities` de Tailwind bat la couche `components`

`.truncate-souris` (couche `components`) était écrasée en silence par
`truncate` (couche `utilities`) : à spécificité égale, la couche postérieure
gagne. D'où le `!important`, avec son explication dans le CSS.

⚠️ **Le dépôt s'était DÉJÀ fait prendre là-dessus** en juillet 2026 (reset de
marge de `.rgrid-content`, cf. `CLAUDE.md`). Le piège était consigné et il a été
repris quand même.

### 3.4 Le menu du Simulateur ne répond pas sans `activate`

Faire pivoter le simulateur par AppleScript **échoue silencieusement** si
Simulator n'est pas au premier plan. Il faut `tell application "Simulator" to
activate` + `delay 1.5` AVANT de cliquer l'item de menu.

⚠️ Sans ça, on croit que l'app reste bloquée en paysage. **Ce n'est pas un
défaut de l'app** — j'ai failli le rapporter comme tel.

### 3.5 L'injection tactile reste dans le repère PORTRAIT

En paysage, `tap`/`swipe`/`touch_path` continuent de raisonner en 402 × 874, et
**aucun des deux axes n'atteint le défilant**. Le défilement en paysage n'est
donc **pas pilotable** avec cet outillage.

### 3.6 `simctl io screenshot` rend toujours le tampon natif

1206 × 2622 quelle que soit l'orientation, contenu pivoté à l'intérieur. **Les
dimensions de la capture ne disent RIEN de l'orientation.** Pour lire une
capture en paysage : `sips -r -90`.

---

## 4. Comment auditer l'interface sans toucher aux vraies données

`AuthGate` bloque, et une session Claude ne saisit pas d'identifiants. Deux
lignes à modifier **localement, jamais à committer** :

```
src/lib/auth/config.ts   →  SUPABASE_URL = ""
src/lib/auth/useAuth.ts  →  if (!jeton && AUTH_CONFIGURED) {   // au lieu de if (!jeton) {
```

Puis `npx vite --port 5199`. L'app s'ouvre en **mode démo** : `isTauri` est
faux, les données viennent de `src/lib/demo.ts`, **aucun réseau, aucune vraie
donnée**.

⚠️ **Toujours restaurer ensuite**, et le vérifier :
`grep -r AUDIT-TEMP src/` doit rendre zéro, et
`git diff --exit-code src/lib/auth/` doit passer.

⚠️ **Ce choix n'est pas du confort** : auditer en `tauri dev` piloterait la
vraie base d'Antonin, avec un risque d'écriture à chaque `Tab` ou `Entrée`.

⚠️ **Ce que le mode démo ne montre PAS** : les états d'erreur natifs (SQLite
illisible, trousseau, réseau). Ils restent **non audités**.

---

## 5. ▶️ Ce qui reste — et qui décide

**La file de réparations est vide.** Ce qui suit est soit reporté par décision
d'Antonin, soit écarté avec un motif.

| Sujet | État | Qui tranche |
|---|---|---|
| **px → rem + cibles 44 pt** | Reporté par Antonin le 2026-08-28 : « chantier dédié ». **136 valeurs, 40 fichiers**, dont 38 sous le plancher de 11 px. Chiffrage complet dans `AMELIORATIONS-UI.md` § 1 | Antonin |
| **Palette mi-tokens mi-hex** (`TAG_COLORS`, `HABIT_COLORS`) | Écarté : sa moitié « lignes déjà en base » est une **migration de données**, hors périmètre. N'en faire que la moitié laisserait un état mixte pire | Antonin |
| **Grille en dents de scie à 720 px** | Écarté : moteur de grille, pur confort (199 px vides à droite de deux panneaux) | Antonin |
| **États vides d'Objectifs et Market-Brain** | Petits, jamais demandés. `WeekChart` est fait | libre |
| **États d'erreur natifs** | Non auditables en mode démo | — |

⚠️ **Avant de rouvrir px→rem, lire l'avertissement d'`AMELIORATIONS-UI.md`
§ 1** : `applyZoom()` pose un `zoom` CSS, qui multiplie AUSSI les `rem`.
« Densité » et Dynamic Type risquent de se composer en produit. À instruire
AVANT, pas après.

---

## 6. Ce qui n'a PAS été prouvé, et qu'il ne faut pas lire comme conforme

- **Le défilement en PAYSAGE sur iPhone** (cf. § 3.5). Les réserves latérales
  sont posées sur le **même conteneur non défilant** que la réserve du haut,
  dont le maintien au défilement est vérifié — c'est solide *par construction*,
  ce n'est pas une capture.
- **L'iPhone réel** : rien de ce chantier n'y a été vu. Profil valable jusqu'au
  **2026-09-03 à 17 h 04**.
- **Les contrastes WCAG** : jamais mesurés (cf. § 3.2). Vérifiés par échantillon
  visuel seulement.
- **Les états de chargement et d'erreur natifs.**

---

## 7. Le site

**Non modifié, et rien de ce chantier ne l'oblige** — vérifié entrée par entrée
contre la table de `CLAUDE.md`. La démo jouable porte les mêmes douze modules,
même ordre, mêmes libellés, mêmes catégories que `Sidebar.tsx`.

⚠️ Une seule chose à répercuter le jour où px→rem sera tranché : `DESIGN.md`
disait « l'app est encore en pixels », c'était faux, c'est corrigé
(`2665977`) — et la doctrine adaptative du site cite cette divergence.

---

## 8. Ce qu'Antonin peut constater lui-même

**Sur le Mac** — ouvrir Finance à demi-écran : les noms de comptes se lisent au
survol, « Compte courant » ne se confond plus avec « Compte de trading ».
Ouvrir une nouvelle tâche puis ⌘K par-dessus : un `Échap` ferme la palette et
**laisse le formulaire**.
⚠️ Au premier lancement, macOS redemande l'accès au trousseau — cliquer
**« Toujours autoriser »**. C'est normal, la signature ad hoc change à chaque
reconstruction.

**Sur le téléphone** — tourner l'appareil en paysage : la barre d'onglets reste,
les douze modules restent atteignables. Appuyer **longuement** sur n'importe
quel bouton : sa bulle d'aide apparaît, et le bouton ne se déclenche pas.
