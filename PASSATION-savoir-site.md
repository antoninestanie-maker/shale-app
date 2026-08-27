# Passation — refonte de « Savoir » vers le site

Écrit le 2026-08-26, depuis la session app (branche `savoir-themes`, dépôt `Shale`).
**Rien n'a été touché dans `shale-site` ni dans le worktree `Shale-Windows`.**

Ce document existe parce que rien ne surveille la ressemblance entre l'app et le
site : le site recopie l'app à la main, et la seule garde-fou est la table de
correspondance de `CLAUDE.md` (§ « Règle : l'app et le site ne divergent jamais »).

---

## 1. Ce qui a changé visuellement dans Savoir

L'accueil du module **n'est plus une liste de notes bordée d'un rail de thèmes**.
C'est maintenant une **grille de thèmes**, et les notes vivent d'un cran plus bas.

**Avant** (jusqu'au 2026-08-25)
- Deux colonnes : un rail étroit de 232 px à gauche (thèmes en lignes de 13 px,
  pastille de couleur + compteur), et à droite la grille de cartes de notes.
- Les « grosses cases » de l'écran étaient donc les **notes**.
- Aucun écran dédié au cas « aucun thème » : le rail affichait une phrase grise.

**Après**
- **Niveau 1 — l'accueil : une grille de cases de thèmes.** Même matériau que les
  cartes de notes (`.card` dans `.auto-cards`, piste de 232 px). Chaque case
  porte : un filet de couleur du thème sur son bord gauche, le micro-label
  `THÈME`, le nom, un **aperçu des trois dernières notes** (leurs titres), le
  **nombre de notes** et la **date de dernière modification**.
- Trois natures de cases, distinctes à l'œil :
  1. **thème** — carte pleine, filet coloré, actions au survol (déplacer avant /
     après, renommer, supprimer) ;
  2. **« Sans thème »** — carte à bordure **tiretée**, sans couleur, micro-label
     `HORS CLASSEMENT`. N'apparaît que s'il existe des notes non classées ;
  3. **« Nouveau thème »** — bordure tiretée, pas de matériau de carte : c'est une
     action, pas un contenu.
- **Niveau 2 — un thème ouvert :** la grille de cartes de notes, inchangée. Le
  titre de la vue devient le nom du thème, précédé d'une pastille de sa couleur,
  et un **fil d'Ariane « ‹ SAVOIR »** ramène à la grille (`Échap` aussi).
- **Barre d'outils, à la même place aux deux niveaux** : champ de recherche, deux
  pastilles transverses (« toutes les notes » et « épinglés », avec leur compte),
  puis le compteur — `n thèmes` à l'accueil, `n notes` dans une liste.
- **Recherche depuis l'accueil = recherche dans tous les thèmes.** Chaque
  résultat porte le nom de son thème sur la carte. Depuis un thème, la recherche
  reste dans ce thème mais annonce les résultats qu'elle cache
  (« 2 notes correspondent, mais elles sont rangées ailleurs » + **Chercher partout**).
- **Écran vide (aucun thème)** : titre « Un thème, c'est un tiroir pour tes
  notes », une phrase, un bouton **Créer mon premier thème**, puis trois thèmes
  tout prêts créés **en un clic** (Productivité · Trading · Lectures), et — s'il
  existe des notes sans thème — la mention « n notes attendent un thème. Les voir ».
- **Création en ligne, dans la grille** : un seul champ (le nom), `Entrée` valide,
  `Échap` annule, focus posé. La **teinte est attribuée d'office** et n'est
  proposée qu'à la modification — créer un thème ne doit demander qu'un nom.
- **Suppression** : confirmation qui dit combien de notes sont concernées et ce
  qu'elles deviennent (« elles passent "sans thème" et restent accessibles depuis
  l'accueil »). Les notes ne sont jamais supprimées avec le thème.

**Ce qui n'a PAS changé** : le design system (aucun token, aucune couleur,
aucune police nouvelle), le lecteur immersif, `NoteComposer`, `SketchPad`, la
compression d'images, les croquis vectoriels, les tags, l'épinglage. Le modèle de
données est **inchangé** — les thèmes existaient déjà (`knowledge_topics`,
migration `013`) : aucune migration, aucune table nouvelle.

---

## 2. Ce qu'il faut mettre à jour sur le site

### 2.1 `vitrine/src/lib/modules.ts` — fiche du module « Savoir » (~l. 334)

C'est le point le plus important : la fiche décrit aujourd'hui un module dont
l'écran d'accueil montre des fiches, pas des thèmes.

| Champ | État actuel | Ce qu'il faut y lire après |
|---|---|---|
| `tagline` | « Ta méthode, en fiches : du texte, des captures, des croquis à main levée. » | Faire apparaître le classement par thèmes comme la **porte d'entrée**, pas comme un attribut des fiches. |
| `desc` | « Une base de connaissances rangée par thèmes. Une fiche accepte… » | La phrase reste vraie mais sous-vend : l'accueil EST la grille de thèmes. À reformuler pour dire qu'on ouvre un thème, puis ses notes. |
| `points[0]` | « Thèmes colorés : setups, règles, macro, psychologie — les tiens. » | Toujours vrai. Peut préciser que chaque thème affiche son volume, sa fraîcheur et un aperçu. |
| `points[3]` | « Lecteur plein écran, et les flèches pour feuilleter un thème. » | Toujours vrai, inchangé. |
| `widget.kind` | `"cards"` avec 4 fiches portant chacune un `topic` | ⚠️ **C'est l'écran d'AVANT.** Le widget doit maintenant montrer des **cases de thèmes** (nom + nombre de notes + date), pas des fiches étiquetées d'un thème. |
| `widget.value` | `"5 thèmes"` | Cohérent, à garder. |
| `specLabel` / `specValue` | « Contenu d'une fiche » / « texte · images · croquis · liens » | Toujours vrai. Un second couple sur le classement serait juste. |

⚠️ **Rappel de la règle de vérité écrite en tête de `modules.ts`** : rien n'y
figure qui n'existe dans l'app. Ne pas y annoncer de sous-thèmes, de couleurs
choisies à la création, ni de note appartenant à plusieurs thèmes — **rien de
tout cela n'existe** (voir § 4).

### 2.2 `vitrine/src/components/Demo.astro` — la démo jouable

**Rien à faire, et c'est vérifié** : Savoir figure bien dans `NAV` (`{ id: "know",
label: _("Savoir"), icon: "card" }`, l. 28) mais **n'est pas l'un des trois
modules jouables** (`live: true` n'est posé que sur `journal` et `position`). La
mention « APERÇU · 3 MODULES SUR 12 » reste juste, le nombre de modules ne bouge
pas (douze avant, douze après), l'icône ne bouge pas, l'ordre de la sidebar ne
bouge pas.

**Si la démo devait un jour rendre Savoir jouable**, c'est la grille de thèmes
qu'elle devrait montrer en premier écran — plus le rail de gauche.

### 2.3 Captures et illustrations

Toute capture du module montrant le **rail de thèmes à gauche** est périmée. À
refaire, dans cet ordre d'importance :

1. **l'accueil peuplé** — la grille de thèmes avec 3–4 cases + la case
   « Nouveau thème » (c'est la capture qui porte le changement) ;
2. **l'écran vide** — celui qui propose de créer un premier thème ; c'est le
   meilleur argument « prise en main » du module ;
3. un thème ouvert, avec son fil d'Ariane, si une capture de la liste de notes
   est utilisée quelque part.

### 2.4 `content.json`

À relire uniquement si une entrée de `features` ou de `faq` décrit l'écran de
Savoir. Le **compte de modules ne change pas** — ne rien toucher là-dessus.

---

## 3. Traductions anglaises nécessaires — `vitrine/src/lib/i18n/en.ts`

Toute chaîne française nouvelle côté site a besoin de sa traduction, sinon la
page anglaise retombe en français sans le dire. Ce sont les **textes du site**
qui sont à traduire, pas ceux de l'app (l'app a les siens, déjà ajoutés dans
`src/lib/i18n/en.ts` de ce dépôt — 48 clés, `npm run i18n:check` est vert).

À traduire, une fois `modules.ts` réécrit :
- la nouvelle `tagline` de Savoir ;
- la nouvelle `desc` ;
- chaque `points[]` réécrit ;
- les libellés du `widget` s'ils changent (`label`, `value`, et les `t` / `k` /
  `topic` de chaque élément) ;
- `specLabel` / `specValue` s'ils changent.

**Vocabulaire de référence** — celui déjà retenu côté app, à garder identique
pour que les deux surfaces disent le même mot :

| Français | Anglais retenu dans l'app |
|---|---|
| thème | topic |
| thèmes | topics |
| Sans thème | No topic |
| Toutes les notes | All notes |
| hors classement | unfiled |
| Nouveau thème | New topic |
| Un thème, c'est un tiroir pour tes notes | A topic is a drawer for your notes |
| Créer mon premier thème | Create my first topic |
| Chercher partout | Search everywhere |

⚠️ **« topic », pas « theme »** : `theme` en anglais se lit comme le thème
graphique clair/sombre, qui existe par ailleurs dans les Réglages. La confusion
serait immédiate.

---

## 4. Ce que le site ne doit PAS annoncer

Trois questions ont été tranchées **d'après le code existant**, pas par envie.
Elles délimitent ce qui est vrai aujourd'hui :

- **Une note appartient à UN thème, ou à aucun.** `knowledge_entries.topic_id`
  est un entier nullable, pas une table de liaison. Pas de note multi-thèmes.
- **Pas de sous-thèmes.** Aucune notion de parent nulle part.
- **La couleur d'un thème existe** (elle est stockée, elle peint la case) **mais
  elle n'est pas demandée à la création** : elle est attribuée d'office et se
  change ensuite. Ne pas vendre « choisis une couleur en créant ton thème ».

Et les deux règles permanentes du projet :
- ne jamais écrire que les données sont « 100 % locales » — c'est faux depuis la
  synchronisation chiffrée ;
- `STRIPE_ENABLED` reste à `false`, des deux côtés.

---

## 5. Le portage Windows est une AUTRE session

La branche `windows-build` du worktree `~/Desktop/Shale-Windows` n'a **pas** été
touchée. Le portage de cette refonte y fera l'objet d'une session dédiée. Les
fichiers à reporter sont listés au § 2 du rapport de session, et se résument à
cinq fichiers front — **aucune migration SQL, aucun code Rust**, ce qui rend le
portage mécanique.

---

## 6. Où regarder dans le dépôt app

| Fichier | Ce qu'il porte |
|---|---|
| `src/views/KnowledgeView.tsx` | toute la refonte : `TopicGrid`, `TopicTile`, `UnfiledTile`, `TopicForm`, `ConfirmDeleteTopic`, `ThemesEmptyState`, `Placeholder` |
| `src/lib/knowledge.ts` | `TOPIC_COLORS` (ordre revu), `sameTopicName` |
| `src/lib/repo.ts` | `reorderKnowledgeTopics` |
| `src/lib/demo.ts` | même fonction côté démo + tri des thèmes par `position` |
| `src/lib/i18n/en.ts` | les 48 clés anglaises du module |
