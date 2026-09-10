# ▶️ COMMENCER ICI

*Écrit pour une session qui n'a AUCUN contexte. Ce document se suffit : où on
en est, ce qu'il ne faut pas refaire, ce qui reste, et qui décide.*

**§ 1 (l'état) est tenu à jour — dernière révision le 2026-09-07.** Les sections
suivantes sont le récit du 2026-08-28 et restent valables comme telles.

**Il y a beaucoup de `.md` à la racine.** Ordre de lecture :

| # | Fichier | Quand le lire |
|---|---|---|
| 1 | **ce fichier** | toujours, en premier |
| 1 bis | ⭐ **`DOCUMENTATION.md`** | **la règle d'écriture, systématique à CHAQUE session.** Où va quoi, quand écrire, la liste de contrôle avant de rendre la main |
| 1 ter | ⭐⭐ **`CHECKUP-2026-09-07.md`** | **le checkup complet du 2026-09-07** — les cinq défauts trouvés, les DEUX affirmations de doc qui étaient fausses, et ce qui reste ouvert |
| 2 | `CLAUDE.md` | la référence permanente du projet — long, mais c'est lui qui fait foi |
| 2 bis | ⭐ **`PIEGES.md`** | **le carnet des erreurs qui se répètent.** À lire AVANT de commencer, et à COMPLÉTER dès qu'on en rencontre une nouvelle |
| 2 ter | ⭐ **`PASSATION-CALENDRIER-V2.md`** | **le chantier du 2026-09-05/06** — saisie à la minute, multi-jours, récurrence, dates sur les tâches, animations. ⛔ Contient le rebuild natif RESTANT À FAIRE |
| 2 penta | ⭐⭐ **`PASSATION-FACTURATION.md`** | **le chantier du 2026-09-10** — Finance sait facturer (migration 023). ⛔ Contient le point le plus urgent : **la 023 n'a pas encore tourné sur la vraie base**, et le prochain build natif la jouera |
| 2 quater | ⭐ **`PASSATION-MINDMAP.md`** | **le chantier du 2026-09-07** — les cartes mentales dans les Notes et le Savoir. Livré et installé ; ce qui reste ouvert est en § 6 |
| 3 | ⭐ **`BILAN-CALENDRIER-LIAISONS.md`** | **ce qui a été livré du 2026-09-02 au 2026-09-04** — calendrier, mentions, parité iPhone, et ce qui reste ouvert |
| 3 bis | `PASSATION-SOCLE.md`, `-CALENDRIER.md`, `-LIAISONS.md`, `-IOS.md` | le détail chantier par chantier de cette série |
| 3 ter | ⭐ **`PASSATION-NOTES.md`** | **le chantier H du 2026-09-05/06 — la perte de données des Notes.** Ce qui est corrigé, ce qui ne l'est pas, et les deux choses qui restent ouvertes (build natif, synchro iPhone) |
| 4 | `DETTE-SITE.md` | **avant de toucher au site**, ou dès que l'app promet quelque chose de neuf |
| 5 | `MOBILE.md` | si tu touches à iOS |
| 6 | `PASSATION-UI.md`, `AUDIT-I18N-2026-08.md` | le chantier UI/UX d'août et les chaînes affichées |
| 7 | `AUDIT-UI-2026-08.md`, `AMELIORATIONS-UI.md` | les preuves et le chiffrage du chantier UI |
| 8 | `PASSATION-savoir-site.md` | **périmé** — ce chantier est livré (site commit `0e6b51c`) |

---

## ⭐ Dernier chantier livré — la FACTURATION (2026-09-10)

Finance sait émettre des factures. **Lire `PASSATION-FACTURATION.md`** : il se
suffit — état, ligne de base, ce qui est prouvé, ce qui ne l'est pas, ce qui
reste et qui décide.

⛔ **Le point à connaître avant tout build natif : la migration 023 est
enregistrée dans `lib.rs` mais n'a PAS encore tourné sur la vraie base**
(toujours en version 22). Le prochain build la jouera, quel que soit le chantier
qui le lance. Prendre une sauvegarde `sqlite3 .backup` avant — jamais un `cp`,
la base est en WAL.

⚠️ **Deux écrans manquent pour un premier usage réel** : celui de l'émetteur
(identité, SIRET, régime) et celui des tiers. Les accès aux données existent des
deux côtés et sont testés ; sur la vraie base, la migration livre deux séries et
**aucun client** — donc aucune facture ne peut encore être adressée à quelqu'un.

## 1. L'état — révisé le 2026-09-07

> ### ⚠️ À lire avant tout : l'app installée d'Antonin porte un bogue corrigé
> Le chantier H a corrigé une **perte de données dans les Notes** (le contenu
> d'une note s'écrivait dans une autre). Le correctif est sur `mobile-ios`
> depuis `95f0e00`, mais **AUCUN BUILD NATIF N'A ÉTÉ FAIT** : `/Applications/Shale.app`
> date du 2026-09-04 et porte encore le défaut. C'est une décision d'Antonin —
> un seul build portera ce correctif ET le chantier calendrier, pour qu'il n'ait
> à autoriser le trousseau qu'une fois. **Aucune note n'a été perdue** (constat
> uid par uid dans `PASSATION-NOTES.md` § 4).

| | |
|---|---|
| Dépôt app | `~/Desktop/Shale-projet/Shale` |
| Branche | **`mobile-ios`** à `24a4954`, poussée. Elle porte le chantier Notes, le Calendrier V2, la roulette d'heure, et **les cartes mentales** (5 commits, 2026-09-07) |
| Arbre | **propre** |
| Dépôt site | `~/Desktop/Shale-projet/shale-site`, branche `responsive-site` — **hors périmètre**, Antonin mène sa refonte ; la dette est tracée dans `DETTE-SITE.md` |
| Base de données | **migration 020 appliquée à la vraie base** le 2026-09-04 à 11:41 — 4 tables créées, aucune donnée perdue. ⛔ **La 021 (`end_date`) existe dans le dépôt et n'est PAS appliquée** |
| Sauvegardes | **`avant-cartes-mentales-20260907-0332/`** (la plus récente), `avant-migration-020-20260904-1135/` et `avant-correctif-notes-20260905-2107/` (deux copies, app ouverte puis fermée), prises avec `sqlite3 .backup`, `integrity_check` ok |
| App macOS | reconstruite le **2026-09-07 à 17:31**, binaire `683f0e99…`, installation prouvée par sha256. Elle porte la roulette d'heure, les cartes mentales, et les cinq correctifs du checkup. ⚠️ macOS peut redemander l'accès au trousseau au premier usage (§ 8.3) : cliquer **« Toujours autoriser »**. *(build intermédiaire du même jour à 03:39, `e0966e0b…`.)* *(historique, conservé pour mémoire : le build du 2026-09-04 à 11:51 ne connaissait ni le correctif Notes ni le Calendrier V2 ; celui du 2026-09-06 à 18:47 les portait mais pas la roulette.)* |
| App iOS | **simulateur** iPhone 17 (iOS 26.5), réinstallée le 2026-09-02 |
| iPhone réel | **jamais** — rien n'y a été vu. Tout ce qui dit « iPhone » ailleurs veut dire *simulateur* |
| Modules | **treize** — le compte est passé de douze à treize le 2026-09-02 (Calendrier) |
| Trousseau | ⚠️ macOS redemande l'autorisation dès que le **binaire** change. Seul Antonin peut cliquer « Toujours autoriser » |

### Ligne de base — à rejouer AVANT de croire quoi que ce soit

```
npx tsc --noEmit                              # ✅
npm run test:types                            # ✅
npm run i18n:check                            # ✅ 0 manquante, 0 doublon
npm run i18n:durs                             # ✅ 0 chaîne sûrement française
npm test                                      # ✅ 674 / 674, 47 fichiers — ⚠️ MACHINE CALME (PIEGES § 9.11)
npx vite build                                # ✅
cd src-tauri
cargo check --all-targets                     # ✅
cargo test --lib                              # ✅ 133 (129 avant le 2026-09-07)
cargo check --target aarch64-apple-ios-sim    # ✅
cargo check --target aarch64-apple-ios        # ✅
```

⚠️ **Un échec est désormais un VRAI échec.** Les deux tests rouges d'`activation.sql`
qui traînaient depuis le 2026-08-31 sont réparés (`db8652d`) : il n'y a plus de
dette connue derrière laquelle se cacher.

⚠️ **`npx tsc --noEmit` NE REMPLACE PAS `npm run test:types`** : le premier passe
pendant que le second échoue, parce que les fabriques des `*.test.ts` ne
compilent que sous `tsconfig.test.json`. Jouer les deux.
⚠️ **Démonter le mode démo AVANT de rejouer la ligne de base** : le patch de
`src/lib/auth/` fait sortir deux erreurs `TS2345`/`TS2322` dans `useAuth.ts` qui
ne sont pas des régressions.

⚠️ Si `npm test` échoue, **capturer le nom du test AVANT de relancer** :
intermittence connue sur les suites PGlite (`MOBILE.md` § 17.6).

---

## 1 ter. ⛔ Ce qui attend une action — au 2026-09-07

0 quater. ⭐ **LE CHECKUP COMPLET EST FAIT — `CHECKUP-2026-09-07.md`.**
   Cinq défauts corrigés (dont la sauvegarde quotidienne, qui ne partait pas
   sans être connecté), deux affirmations de la documentation corrigées parce
   qu'elles étaient FAUSSES, et l'« intermittence PGlite » enfin expliquée.
   Tout est livré, construit et installé.

0 ter. ⚠️ **LE SEUL GESTE QUI PEUT RESTER EST HUMAIN : la fenêtre de trousseau.**
   L'app a été reconstruite et installée le **2026-09-07 à 17:31**, et elle
   tourne. macOS redemande l'accès au trousseau quand le binaire change
   (§ 8.3) : si la fenêtre apparaît, **cliquer « Toujours autoriser »**. Aucune
   session ne peut le faire à sa place. Sans ce clic, la synchronisation ne
   retrouve pas son jeton.

0 bis. ~~⛔ **LES CARTES MENTALES SONT ÉCRITES ET NON LIVRÉES.**~~
   **LIVRÉES le 2026-09-07 à 03:39** — fusionnées (`24a4954`), poussées,
   construites et installées. Vérifié à l'écran en mode démo : insertion dans
   les deux modules, clavier, `@`, backlinks des deux côtés, export PNG/SVG,
   thème clair et sombre, anglais, et **réseau coupé (zéro requête tentée)**.
   ⚠️ **Rien n'a été vu sur la vraie base ni en WKWebView** : c'est le premier
   point à regarder. Détail : `PASSATION-MINDMAP.md`.

0. ~~⛔ **LA ROULETTE D'HEURE N'EST PAS SUR LA MACHINE D'ANTONIN.**~~
   **RÉGLÉ le 2026-09-07 à 03:39** — le build des cartes mentales portait les
   deux chantiers, comme prévu. Prouvé par le contenu du bundle consommé :
   `roulette` y apparaît 10 fois. *(Texte d'origine :)* elle était arrivée APRÈS
   le build du 2026-09-06 à 18:47, et il fallait un nouveau build.
1. ~~⛔ **LE REBUILD NATIF N'EST PAS FAIT.**~~ **FAIT le 2026-09-06 à 18:47** —
   un seul build pour les deux chantiers, migration 021 appliquée sur base non
   vide, aucune donnée perdue. Reste le point 0 ci-dessus.
   *(Texte d'origine conservé pour mémoire :)* `mobile-ios` porte deux chantiers que
   la machine d'Antonin ignore : les Notes (le contenu d'une note se retrouvait
   dans une autre) et le Calendrier V2 (dont la **migration 021**, `end_date`,
   pas encore appliquée à la vraie base). **Décision d'Antonin le 2026-09-06 :
   un seul build pour les deux**, ce qui est fait côté dépôt — il ne reste que
   la construction. Marche à suivre : `PASSATION-CALENDRIER-V2.md` § 5.
2. **Une question en attente pour Antonin** : la ligne de charge du calendrier
   annonce un événement « journée entière » comme « 1 tâche sans horaire ». Le
   compte est juste, le mot est faux. Correction non faite, faute de mandat.

## 1 bis. Depuis cette passation — la série Calendrier & Liaisons

Du 2026-09-02 au 2026-09-04 : six chantiers, +11 216 lignes, le 13ᵉ module, les
mentions `@` entre objets, la parité iPhone, et la mise en service sur la machine
d'Antonin. **Tout est dans `BILAN-CALENDRIER-LIAISONS.md`** — y compris les six
points encore ouverts, qu'il faut lire avant de promettre quoi que ce soit.

---

## 2. Ce qui s'est passé le 2026-08-28

Trois chantiers, dans cet ordre.

### 2.0 Le soir — Dynamic Type, et une prémisse qui tombe (`f23f02a` → `66d721c`)

Le dernier chantier prioritaire ouvert, « px → rem », était bloqué par une
question que le document réclamait d'instruire AVANT de décider. Elle l'a été,
en WKWebView — et elle a **renversé la prémisse** : un `rem` ne suit pas
Dynamic Type dans cette webview, donc migrer les 136 valeurs n'aurait apporté
aucune accessibilité. Le verrou redouté (« Densité × rem en produit »),
lui, **n'existe pas**.

Antonin a tranché pour l'autre voie : **replier Dynamic Type dans « Densité »**.
Livré le soir même — un fichier, aucune unité migrée, et le facteur vaut
exactement 1 au réglage par défaut.

⚠️ Au passage, un défaut **latent de « Densité », déjà livré** : le `zoom` CSS
fait déborder les unités de viewport. Voir le § 6 et `CLAUDE.md`.

### 2.1 et 2.2 — les deux chantiers du jour

Les 9 commits vont de `536e051` à `55ab40c`.

### 2.1 Le matin — la fin du chantier UI/UX

La file de réparations était vide sauf un item : « états vides d'Objectifs et
Market-Brain ». **Il reposait sur une mesure fausse.** Les deux états vides
existaient déjà — `GoalsView.tsx:240` depuis le tout premier import du projet,
et `MarketBrainView.tsx:400` avec ses deux branches.

Le tableau qui les comptait à zéro cherchait les messages passant par `t()`.
Ces deux vues écrivaient les leurs **en français dans le JSX**. Le défaut réel
n'était donc pas une absence d'état vide, c'était **du français affiché dans
l'app anglaise**.

### 2.2 L'après-midi — l'audit i18n complet (ouvert par Antonin)

**45 fichiers, ~250 chaînes, 246 clés anglaises** (1146 → 1392 entrées). Le
palier « sûrement français » est passé de **61 à 0**. Puis le Rust, puis les
raccourcis clavier de Réglages.

Détail complet, limites comprises : **`AUDIT-I18N-2026-08.md`**.

---

## 3. ⚠️ Les deux outils i18n — lequel répond à quoi

C'est le point le plus utile de cette passation. **Les confondre a coûté un
chantier entier.**

| Commande | Question à laquelle elle répond | Ce qu'elle NE voit PAS |
|---|---|---|
| `npm run i18n:check` | « toute clé passée à `t()` / `tp()` a-t-elle sa traduction anglaise ? » (+ les clés écrites deux fois) | **qu'une chaîne affichée passe par `t()`** |
| `npm run i18n:durs` | « quel texte AFFICHÉ ne passe PAS par `t()` ? » | ce qui n'est pas dans ses listes blanches, et il ne suit pas la donnée |

> ### ⭐ `i18n:check` au vert ne veut PAS dire « traduit ».
> Une phrase française écrite en dur dans le JSX lui est **totalement
> invisible**. Elle s'affiche telle quelle dans l'app anglaise, et le contrôle
> reste vert.

**La preuve finale n'est ni l'un ni l'autre : c'est l'app basculée en anglais.**
Réglages → Langue → English. Deux des défauts trouvés ce jour-là (un « jours »
sous une propriété `suffix`, et les en-têtes du tableau d'historique de
Position) **ont été vus à l'écran, pas par l'outil**.

### Quatre défauts d'outillage corrigés en s'en servant

1. ⭐ **`i18n:check` était aveugle à `tp()` depuis toujours** — sa regex `\bt\(`
   ne matche pas `tp(`. Toutes les clés de pluriel lui échappaient.
2. Le scanner écartait les mots capitalisés isolés → il ratait « Gagnante »,
   « Perdante », « Terminé », des libellés de bouton.
3. Le scanner lisait les comparaisons comme du texte affiché
   (`{statut === "active" && …}`) → ~42 fausses entrées.
4. Une clé écrite deux fois passait en silence → `i18n:check` la nomme
   maintenant. Sept doublons réels attrapés.

---

## 4. ⚠️ Les règles à ne PAS réapprendre

Elles sont dans `CLAUDE.md`, répétées ici parce qu'elles coûtent cher.

### 4.1 Jamais de `t()` dans une CONSTANTE de module
Elle est évaluée à l'import, donc figée dans la langue de démarrage. Les tables
de libellés (`ITEMS` de `Sidebar`, `ACTIONS`, `SCOPE_LABEL`, `TIMER_PRESETS`…)
gardent la phrase **française** comme valeur et sont traduites **à
l'affichage** : `{t(item.label)}`. Une **fonction** (`const widths = () => […]`)
n'a pas ce problème.

### 4.2 Ne jamais nommer une variable locale `t`, `tp` ou `pick`
`SendToTrackerModal` a un état local `tp` (le take-profit) : y importer la
fonction de pluriel la masquerait. La consigne d'origine ne parlait que de `t`.

### 4.3 Le défaut le plus facile à commettre ici, c'est la MOITIÉ
Pas l'oubli complet : `data-tip={paused ? t("Reprendre la session") : "Mettre
en pause"}`. Un `data-tip-sub` traduit juste au-dessus d'un `data-tip` en dur.
**Lancer `npm run i18n:durs` après avoir touché une vue coûte deux secondes.**

### 4.4 Ne pas traduire un mot vers lui-même
« Date », « Instrument », « Direction », « Setup », « lots », « pips »,
« Break-even », « Stop », « No-trade », « Live », « Backtest », « Horizon »,
« Deadline » sont identiques en anglais. 57 chaînes sont laissées ainsi
**volontairement** — c'est écrit au § 5 de `AUDIT-I18N-2026-08.md`.

---

## 5. ⚠️ Les pièges de l'environnement — ne pas les re-diagnostiquer

Le détail est au § 3 de `PASSATION-UI.md`. Les quatre qui mordent le plus :

### 5.1 ⭐ Réinstaller sur le SIMULATEUR déconnecte la session

> ⚠️ **Observation du 2026-09-02, qui ne remplace PAS la règle.** Une
> réinstallation ce jour-là (iOS 26.5, `simctl install` par-dessus la même app)
> a **conservé** la session : l'app s'est ouverte sur le tableau de bord, entrée
> « Admin » comprise. Une seule observation ne fait pas une règle, et le coût
> d'une session perdue reste élevé : **continuer à faire l'audit visuel AVANT de
> reconstruire.**
⚠️ **CORRIGÉ LE 2026-09-07, ET C'EST L'INVERSE QUI EST ARRIVÉ.** La phrase
d'origine — « `simctl install` par-dessus l'app **préserve les données**
(`shale.db` intact) mais **fait perdre l'accès au trousseau** » — s'est révélée
fausse dans les deux moitiés, le même jour :
· **les données N'ONT PAS été préservées** : iOS a provisionné un NOUVEAU
  conteneur (`D77D31BD-…` → `EA43202F-…`) et retiré l'ancien. Deux notes non
  synchronisées ont été détruites (`PIEGES.md` § 9.10) ;
· **la session, elle, a survécu** : l'app est repartie sur le tableau de bord et
  a resynchronisé (`last_pull_at` au 2026-09-07).
▶️ **La seule parade est de COPIER la base avant d'installer.** Ne plus se fier
à cette phrase dans un sens ou dans l'autre.
*(Texte d'origine, conservé :)* `simctl install` préserve les données
(`shale.db` intact) mais fait perdre l'accès au trousseau, donc le `refresh_token`. L'app repart
sur l'écran de connexion, et **une session Claude ne peut pas s'y reconnecter**.
▶️ **Faire tout l'audit visuel AVANT de reconstruire.** C'est le cas
actuellement : la session du simulateur est perdue, seul un geste humain
d'Antonin la rouvre.
⚠️ Ne JAMAIS lancer `simctl uninstall` ni `simctl erase`.

### 5.2 ⭐ `getComputedStyle` n'est PAS une preuve de couleur ici
Chromium rend une valeur périmée sous `backdrop-filter` — le bogue que
`src/lib/theme.ts` contourne déjà. **La capture d'écran tranche, la mesure
non.** Et pour basculer le thème, passer par Réglages → Apparence, jamais par
l'attribut `data-theme`.

### 5.3 Comment auditer l'interface sans toucher aux vraies données
`AuthGate` bloque et une session Claude ne saisit pas d'identifiants. Deux
lignes à modifier **localement, JAMAIS à committer** :

```
src/lib/auth/config.ts:15   →  export const SUPABASE_URL = "";
src/lib/auth/useAuth.ts:364 →  if (!jeton && AUTH_CONFIGURED) {
```

Puis `npx vite --port 5199`. L'app s'ouvre en **mode démo** : `isTauri` est
faux, les données viennent de `src/lib/demo.ts`, **aucun réseau, aucune vraie
donnée**. Pour l'anglais : `localStorage.setItem("shale.lang","en")`.

⚠️ **Toujours restaurer ensuite, et le vérifier** :
`grep -r AUDIT-TEMP src/` doit rendre zéro et `git diff --exit-code
src/lib/auth/` doit passer.
⚠️ Auditer en `tauri dev` piloterait la VRAIE base d'Antonin, avec un risque
d'écriture à chaque `Tab` ou `Entrée`. C'est pour ça que le mode démo n'est pas
du confort.

### 5.4 La couche `utilities` de Tailwind bat la couche `components`
À spécificité égale, la couche postérieure gagne. Le dépôt s'est fait prendre
deux fois. D'où des `!important` explicitement commentés dans le CSS.

---

## 6. ▶️ Ce qui reste — et qui décide

**La file de réparations est VIDE.** Tout ce qui suit attend une décision
d'Antonin ou a été écarté avec un motif. Rien n'est « en cours ».

| Sujet | État | Qui tranche |
|---|---|---|
| ~~**px → rem**~~ | ⭐ **Le BUT est atteint autrement, le 2026-08-28 au soir** (`4a60058`). La prémisse était fausse : un `rem` **ne suit pas Dynamic Type** dans une WKWebView. Shale suit désormais la taille de texte du système en la repliant dans « Densité » — **un fichier, aucune unité migrée**. Détail et mesures : `AMELIORATIONS-UI.md` § 1 bis | — |
| **px → rem, pour la cohérence avec le site** | Reste ouvert, mais ce n'est PLUS de l'accessibilité : l'argument se réduit à « le site est en `rem`, l'app en pixels ». **136 valeurs, 40 fichiers**, risque de régression sur `.hud-label` | **Antonin** |
| **Cibles tactiles de 44 pt** | ⚠️ **PLUS « intact » — corrigé le 2026-09-07 en recomptant.** Le chantier D (2026-09-02) a livré `.cible-tactile` et `.cible-tactile-ligne` dans `src/index.css`, **utilisées à 28 endroits**, sous requête média tactile. Ce qui reste ouvert n'est donc pas la règle mais le TRI exhaustif des cibles restées sous 44 px. `MOBILE.md` (« un utilitaire, pas une refonte ») et `AMELIORATIONS-UI.md` § 8. *(Texte d'origine : « Reste ouvert et INTACT… `grep '--tap'` → 0 » — l'unique occurrence de `--tap` est aujourd'hui un COMMENTAIRE qui explique que ce grep rend zéro.)* | **Antonin** |
| **Palette mi-tokens mi-hex** (`TAG_COLORS`, `HABIT_COLORS`) | Écarté : sa moitié « lignes déjà en base » est une **migration de données**. N'en faire que la moitié laisserait un état mixte pire | **Antonin** |
| **Grille en dents de scie à 720 px** | Écarté : moteur de grille, pur confort (199 px vides à droite de deux panneaux) | **Antonin** |
| **États d'erreur natifs** | SQLite illisible, trousseau, réseau — **non auditables en mode démo**, donc jamais vus | — |
| **Ménage du DerivedData Xcode** | Proposé, **sans réponse**. Quatre bundles iOS traînent (`~/Library/Developer/Xcode/DerivedData`, et deux dans un scratchpad). Ce ne sont pas des apps macOS, ils ne peuvent pas être lancés par erreur. Les effacer force une reconstruction iOS complète | **Antonin** |

▶️ **Instruction FAITE, et arbitrage RENDU — `AMELIORATIONS-UI.md` § 1 bis.** Elle répond
aux deux questions et en ouvre une troisième :
1. « Densité » et `rem` **ne se composent pas** en produit — mesuré, le verrou
   est levé ;
2. mais un `rem` **ne suit pas Dynamic Type** dans une WKWebView, donc la
   migration seule n'apporte rien à l'accessibilité ;
3. la voie la moins chère pour suivre le réglage système était de **replier
   Dynamic Type dans « Densité »** — **choisie par Antonin, et livrée le soir
   même** (`4a60058`). Vérifiée sur le simulateur en exécutant le vrai module :
   17 px → ×1,0000 · 21 px → ×1,1176 · 53 px → ×1,2500 plafonné.

⚠️ **Nouveau, et ça dépasse Dynamic Type** : le `zoom` CSS multiplie AUSSI les
unités de viewport. Tout `vh`/`vw` doit être multiplié par **`--zoom-inv`**,
sinon il déborde de l'écran dès que la densité n'est pas à 100 %. Les cinq
usages de l'app sont corrigés ; **tout nouveau `vh`/`vw` doit suivre la
règle.**

---

## 7. ⚠️ Ce qui n'a PAS été prouvé — ne pas le lire comme conforme

- **Le rendu NATIF en anglais.** Tout l'audit i18n a été vérifié en **mode démo
  navigateur**. L'app installée et l'iPhone n'ont pas été relus dans cette
  langue.
- **La qualité des 246 traductions**, écrites en une session, relues par
  personne d'autre. Registre visé : celui de l'en-tête d'`en.ts` — anglais
  direct à la deuxième personne, vocabulaire de trading standard.
- **L'i18n du Rust n'a AUCUN outil.** Elle a été vérifiée à la main, par
  lecture. Les trois règles de notification sont bilingues, la notification de
  test et la synthèse groupée l'ont été rendues.
- **L'iPhone réel** : rien n'y a jamais été vu. Profil de signature valable
  jusqu'au **2026-09-03 à 17 h 04**.
- **Les contrastes WCAG** : jamais mesurés (cf. § 5.2), échantillon visuel
  seulement.
- **Le défilement en PAYSAGE sur iPhone** : l'injection tactile reste dans le
  repère portrait, donc non pilotable avec cet outillage.

---

## 8. Les règles permanentes du projet

Elles sont dans `CLAUDE.md`, mais on les oublie :

- ⭐ **Antonin n'utilise JAMAIS le Terminal.** Il n'est pas développeur.
  Exécuter, ne pas prescrire — une liste de commandes à recopier n'est pas un
  livrable. Ce qui reste hors de portée se décrit en **gestes d'interface**.
- ✅ **`git push` fonctionne** depuis cette machine (SSH, clé `ed25519` sans
  phrase). **Commiter et pousser font partie du travail.**
- ❌ **Jouer du SQL sur Supabase reste hors de portée** : le SQL se colle dans
  Supabase Studio → SQL Editor. En revanche *vérifier* en `curl` avec la clé
  anon, oui — le faire plutôt que demander « ça a marché ? ».
- ⭐ **L'app et le site ne divergent JAMAIS.** Table de correspondance dans
  `CLAUDE.md`. Rien n'automatise cette ressemblance ; c'est le seul garde-fou.
  **Rien du travail du 2026-08-28 n'oblige le site** : l'i18n de l'app n'a pas
  de miroir côté vitrine, et aucun module, nom ou promesse n'a bougé.
- **Une seule app Shale installée : `/Applications/Shale.app`.**
  `/System/Volumes/Data/Applications/Shale.app` est le MÊME fichier vu par le
  firmlink (même inode) — ne jamais « supprimer le doublon ». Après chaque
  installation : `rm -rf src-tauri/target/*/bundle`.
- **Après une modification, reconstruire et réinstaller.** Antonin utilise le
  bundle installé, pas le mode dev.
  ⚠️ Au premier lancement, macOS redemande l'accès au trousseau : cliquer
  **« Toujours autoriser »**. C'est normal — la signature ad hoc change à chaque
  reconstruction. **Le lui dire**, sinon il découvre une fenêtre inexpliquée.
- ⚠️ ~~**`STRIPE_ENABLED` reste à `false`**, des deux côtés.~~ **PÉRIMÉ, corrigé
  le 2026-09-02.** C'est faux depuis le **2026-08-31** : la boutique est ouverte,
  Stripe est en **LIVE**, `STRIPE_ENABLED = true` (`src/lib/auth/config.ts:93`),
  et **le paiement est devenu le mur d'entrée** — le mur d'activation manuelle a
  été retiré. Vérifié dans l'arbre, pas déduit. Ne jamais se fonder sur la
  phrase barrée ci-dessus, ni sur celle du `SHALE.md` du dossier parent, qui
  porte la même erreur.
- **Ne jamais écrire que les données sont « 100 % locales »** — faux depuis la
  synchronisation chiffrée.

---

## 9. Ce qu'Antonin peut constater lui-même

**En français, rien n'a changé** — c'était l'objet du travail : retirer du
français d'une app qui devait être en anglais.

Pour le voir : **Réglages → Langue → English**, puis

- **Objectifs** — « short / medium / long term », « D−125 », « 29 d overdue » ;
- **Timer** — « START 25 MIN », « TARGET REACHED », et « 90·15 **ultradian** » ;
- **Trading** — « LIVE TRACKER — AWAITING OUTCOME », « 2 positions · 1.5%
  committed », « WIN » / « LOSS » ;
- **Position** — les en-têtes de l'historique (« pair », « direction », « at
  risk ») et l'onglet « CALCULATOR » ;
- **Réglages → raccourcis** — les trois raccourcis suivent la plateforme ET la
  langue (« ⌥ Space » au lieu de « ⌥ Espace »).

Repasser en **Français** ensuite : rien d'autre n'a bougé.

⚠️ **Sur le simulateur iPhone, l'app est déconnectée** (§ 5.1) : il faut s'y
reconnecter à la main une fois, et les rebuilds suivants entreront tout seuls.
