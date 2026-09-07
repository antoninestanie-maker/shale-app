# Pièges — le carnet des erreurs qui se répètent

*Ouvert le 2026-09-02, à la demande d'Antonin.*

## À quoi sert ce fichier, et comment on s'en sert

**Toute erreur qui peut se reproduire s'écrit ici, au moment où on la trouve.**
Pas à la fin du chantier, pas « si on y pense » : au moment où elle mord. Une
erreur trouvée deux fois par deux sessions différentes est une erreur qu'on a
payée deux fois.

**Ce qui a sa place ici** : une erreur qu'une autre session, sans contexte,
referait à l'identique. Un piège d'environnement, une API qui ment, un test qui
échoue pour une raison qui n'est pas la sienne, une convention dont l'oubli ne
se voit pas tout de suite.

**Ce qui n'a PAS sa place ici** : les décisions de conception (elles vont dans
`CLAUDE.md`), l'état d'un chantier (dans sa passation), et les bogues corrigés
une fois pour toutes dont il ne reste aucune trace piégeuse.

⭐ **La table d'aiguillage complète — où va quoi, et quand écrire — est dans
`DOCUMENTATION.md`.** Ce carnet-ci est l'une de ses cinq destinations ; la règle
qui l'oblige, elle, vaut pour toutes les sessions et pour tous les documents.

**Format d'une entrée** — quatre lignes, toujours les mêmes :

> **Le symptôme** (ce qu'on voit) · **La cause** (ce qui se passe vraiment) ·
> **La parade** (quoi faire) · **Comment on l'a payée** (pourquoi c'est ici)

⚠️ **Ne jamais retirer une entrée parce que « maintenant on le sait ».** La
prochaine session ne le saura pas.

---

# 1. Environnement et outillage

## 1.1 Un worktree hors de `~/Desktop/Shale-projet` casse deux suites de tests

**Symptôme.** `npm test` échoue **au chargement** de `sync/supabase.test.ts` et
`auth/activation.sql.test.ts` : `ENOENT: no such file or directory, open
'../../../../shale-site/supabase/sync.sql'`. Aucun test ne s'exécute, on croit
avoir cassé la synchronisation.

**Cause.** Ces tests lisent le SQL **du dépôt du site** par un chemin relatif
qui SORT du dépôt de l'app (`Shale/../shale-site`). C'est volontaire — une copie
finirait par diverger — mais cela suppose que le dépôt de l'app soit posé à côté
de celui du site. Un worktree dans `~/Desktop/Shale-chantiers/` ne l'est pas.

**Parade.** Un lien symbolique, posé une fois, valable pour tous les worktrees :

```
ln -sfn ~/Desktop/Shale-projet/shale-site ~/Desktop/Shale-chantiers/shale-site
```

⚠️ **Il existe déjà. Ne pas le supprimer** en faisant le ménage dans
`Shale-chantiers/`.

**Comment on l'a payée.** Chantier A, 2026-09-02 : diagnostiqué comme une
régression du socle avant de lire le message d'erreur en entier.

## 1.2 Les tâches planifiées ne tournent que si l'application est ouverte

**Symptôme.** Une tâche armée pour 5 h 15 n'a pas tourné à 10 h 45, et elle n'a
laissé aucune trace — ni journal, ni erreur.

**Cause.** Le planificateur vit dans l'application. Fermée, rien ne se déclenche ;
la tâche part au prochain lancement, ou pas du tout si elle a été retirée entre-temps.

**Parade.** Ne jamais promettre à Antonin qu'une chaîne de tâches se déroulera
pendant la nuit sans lui dire cette condition. Et vérifier l'état réel du disque
(worktrees créés ? carnet écrit ?) plutôt que de croire qu'une tâche a tourné.

**Comment on l'a payée.** 2026-09-02 : quatre chantiers armés à 1 h du matin,
zéro exécuté, découvert à 10 h 45.

## 1.2 bis ⭐ Une boucle d'attente en `pgrep -f` se voit ELLE-MÊME

**Symptôme.** On lance `until ! pgrep -f "ma-commande"; do sleep 20; done` pour
attendre la fin d'une compilation. La compilation se termine — et la boucle
**continue indéfiniment**. Les notifications n'arrivent jamais, on finit par
sonder à la main, et des shells tournent en fond pendant des heures.

**Cause.** `pgrep -f` cherche dans la ligne de commande COMPLÈTE de chaque
processus. La boucle d'attente contient le motif recherché **dans sa propre
ligne de commande** : elle se trouve elle-même, donc la condition n'est jamais
fausse.

**Parade.** Guetter un ARTEFACT plutôt qu'un processus — c'est plus sûr et plus
lisible :

```bash
until [ -d chemin/vers/la/sortie ]; do sleep 20; done
```

Si le processus est vraiment le seul repère, exclure sa propre boucle :
`pgrep -f "ma-commande" | grep -v "^$$\$"`, ou mieux, garder le PID rendu au
lancement et interroger `kill -0 "$PID"`.

⚠️ Corollaire du § 8.2 bis : avant de tuer ce que `pgrep` a trouvé, **lire
`ps -p <PID> -o command=`**. Ici, les trois « compilations encore actives »
étaient trois boucles d'attente — pas une seule compilation.

**Comment on l'a payée.** Chantier iOS, 2026-09-02 : trois guetteurs armés, zéro
notification utile, et un sondage manuel à la place.

⚠️ **Puis de nouveau le 2026-09-04**, deux jours après avoir écrit cette entrée,
sur `npm run tauri build`. Écrire un piège ne suffit pas à s'en garder : le
réflexe reste d'écrire `pgrep -f "<la commande>"`. **Le seul remède fiable est de
ne jamais guetter un processus quand un fichier fait l'affaire.**

## 1.2 ter ⭐ Le patch de MODE DÉMO casse `tsc` — ce ne sont pas tes régressions

**Symptôme.** On monte le mode démo (PASSATION § 5.3), on rejoue la ligne de
base, et `npx tsc --noEmit` sort deux erreurs dans `src/lib/auth/useAuth.ts` :
`TS2345` et `TS2322`, « `string | null` n'est pas assignable à `string` ». On
cherche ce qu'on vient de casser dans un fichier qu'on n'a pas touché.

**Cause.** La seconde ligne du patch remplace `if (!jeton)` par
`if (!jeton && AUTH_CONFIGURED)`. Le garde ne rétrécit donc plus le type de
`jeton` en aval, et les deux usages suivants ne compilent plus. C'est une
conséquence mécanique du patch, pas un défaut du dépôt.

**Parade.** **Démonter le mode démo AVANT de rejouer la ligne de base.** Et se
méfier du raccourci inverse : on est tenté de « corriger » les deux erreurs.

**Comment on l'a payée.** Calendrier V2, 2026-09-05 : quelques minutes à relire
`useAuth.ts` avant de comprendre que c'était ma propre modification temporaire.

## 1.3 `timeout` n'existe pas sur cette machine

**Symptôme.** `(eval):1: command not found: timeout`.

**Cause.** `timeout` est un outil GNU ; macOS ne le fournit pas.

**Parade.** Pour borner une commande réseau, utiliser l'option de l'outil
lui-même — par exemple `GIT_SSH_COMMAND="ssh -o BatchMode=yes -o
ConnectTimeout=20" git fetch`. `BatchMode=yes` évite en plus une invite de mot
de passe qui bloquerait indéfiniment.

---

# 2. Synchronisation — là où les erreurs sont silencieuses

> ⚠️ **La règle générale.** Une faute de synchronisation ne se voit JAMAIS sur
> l'appareil où l'on développe. Elle se voit sur le second, plus tard, sous la
> forme de données fausses — pas d'une erreur. Tout ce qui touche à `uid`, aux
> clés étrangères ou à l'ordre des lignes se prouve avec le banc à deux
> appareils (`sync/engine.testutil.ts`), jamais par relecture.

## 2.1 ⭐ Une colonne de données finissant par `_uid` était vidée en route

**Symptôme.** Une arête `object_links` créée sur le Mac arrive sur l'iPhone avec
ses deux extrémités **vides**. Aucune erreur, aucune alerte.

**Cause.** `appliquerLigne` (`sync/local.ts`) écartait **toute** colonne dont le
nom finit par `_uid`, en supposant que ces colonnes ne servent qu'à traduire une
clé étrangère. Le pari tenait tant qu'aucune table ne stockait un `uid` comme
**donnée** — ce que fait `object_links` depuis la migration 020.

**Parade.** Le tri se fait désormais sur la liste des **clés déclarées**
(`clesDe(table)`), pas sur le suffixe. Corrigé le 2026-09-02.
▶️ **Avant de nommer une colonne `<quelque chose>_uid`, relire `sync/local.ts`.**
Et déclarer la colonne **NOT NULL** quand c'est possible : c'est ce qui a
transformé cette corruption silencieuse en échec bruyant.

**Comment on l'a payée.** Chantier A : trouvée en écrivant le test, pas en
relisant le code. Avec l'ancien tri, 7 tests sur 8 tombent.

## 2.2 Une colonne en `_id` sur une table synchronisée fait échouer les tests — et c'est voulu

**Symptôme.** `fk.test.ts` : « TOUTE colonne en `_id` est traduite » échoue après
l'ajout d'une colonne.

**Cause.** Ce n'est pas un bogue du test. Un `id` est **local** : le faire
voyager rattacherait la ligne à n'importe quoi sur l'autre appareil, sans erreur.
Le test force à trancher avant que le dégât ne soit possible.

**Parade.** Soit déclarer la clé dans `CLES_ETRANGERES` (`sync/fk.ts`), soit
**ne pas stocker d'`id`** : `object_links` stocke des `uid`, parce que sa cible
dépend d'une autre colonne et qu'aucun `vers` fixe n'existe.

## 2.3 SQLite ne garantit aucun ordre entre deux triggers `AFTER INSERT`

Déjà documenté dans `CLAUDE.md` (§ pièges de la synchronisation), rappelé ici
parce qu'on le réapprend : `NEW.uid` peut être **NULL** dans un trigger de
création. Ne rien bâtir dessus.

---

# 3. SQL et schéma

## 3.1 `values` est un mot-clé SQL — ne jamais nommer une colonne ainsi

**Symptôme.** Erreur de syntaxe **à l'exécution**, donc en production, sur la
première requête qui a oublié d'échapper le nom.

**Parade.** La colonne des valeurs d'un objet s'appelle **`field_values`**.
Même prudence pour `order`, `group`, `select`, `from`, `check`, `default`.

## 3.2 `abs(random() % 4)`, jamais `abs(random()) % 4`

`random()` peut renvoyer `-9223372036854775808`, dont la valeur absolue déborde
l'entier signé 64 bits et fait échouer la requête. Le modulo d'abord.

## 3.3 `ALTER TABLE ADD COLUMN` n'accepte ni `UNIQUE` ni un défaut calculé

Une constante (`DEFAULT 0`) passe ; une expression (`DEFAULT (datetime('now'))`)
et `UNIQUE` non. La colonne naît nullable, on la remplit par `UPDATE`, et c'est
un index unique créé ensuite qui tient l'invariant.

## 3.4 Une contrainte `CHECK` peut arrêter la synchronisation

**Cause.** Une contrainte violée à l'application d'une ligne venue d'un autre
appareil — qui tourne peut-être une autre version de l'app — fait échouer
l'écriture, donc le cycle.

**Parade.** Les règles de **saisie** vivent en TypeScript et sont gardées par des
tests ; le SQL ne contraint que ce qui est vrai pour toutes les versions. C'est
pourquoi « une tâche récurrente n'a pas de date » n'est pas un `CHECK`.

---

# 4. Dates et heures

## 4.1 ⭐ Avancer d'un jour à partir de MINUIT recule d'un jour deux fois par an

**Symptôme.** Une grille de mois affiche deux fois le même jour, ou en saute un,
uniquement fin mars et fin octobre.

**Cause.** `new Date("2026-03-29T00:00:00")` + 24 h tombe à 23 h **la veille**
le jour du changement d'heure.

**Parade.** Construire les dates à **midi** (`T12:00:00`) et incrémenter avec
`setDate(getDate() + 1)`. Midi laisse huit heures de marge de chaque côté du
décalage.

## 4.2 La semaine commence le lundi, `getDay()` compte à partir du dimanche

Confondre les deux décale toute la grille d'un jour — ça se voit, mais ça
s'explique mal. Le recul jusqu'au lundi vaut `wd === 0 ? 6 : wd - 1`.

## 4.3 Tout est en heure LOCALE, sauf `sync_outbox`

`localNow()` et toute la logique « jour » comparent du local. Le seul UTC de
l'app est l'horodatage de l'outbox, parce qu'il départage deux écritures faites
sur deux appareils, et que deux heures locales de fuseaux différents ne sont pas
comparables.

## 4.3 bis ⭐ `toISOString().slice(0, 10)` fait sauter une journée entière

**Symptôme.** La sauvegarde automatique « une par jour » n'en produit qu'une
pour deux journées. Invisible à Paris, sauf à lancer l'app entre 00 h et 02 h.
Systématique pour un utilisateur à Auckland.

**Cause.** `new Date().toISOString().slice(0, 10)` rend le jour **UTC**. La
journée UTC et la journée de l'utilisateur ne coïncident pas : à UTC+12, tout
ce qui suit midi appartient déjà au lendemain UTC, donc un lancement le soir et
un lancement le lendemain matin portent la MÊME date. Le second est pris pour un
doublon, et la sauvegarde est **sautée**. Rien n'est écrasé — c'est pire : c'est
une copie qui n'existe pas, et personne ne s'aperçoit d'une absence.

**Parade.** `toDateStr(d)` / `todayStr()` de `src/lib/logic.ts`, **toujours**.
Le grep qui trouve les rechutes est `toISOString().slice(0, 10)` ; les autres
`toISOString()` de l'app sont des horodatages complets (des instants), qui sont
légitimes. Un `.slice(0, 10)` est légitime uniquement quand la date a été
CONSTRUITE en UTC juste avant — `finance/burn.ts` le fait avec `Date.UTC(…)`.

**Comment on l'a payée.** `src/lib/sauvegardes.ts` l'a portée depuis sa
création, dans le verrou `backup.last_at`. Trouvée le 2026-09-02 en relisant le
fichier, pas par un test ni par l'usage : à Paris, la fenêtre où elle mord fait
deux heures par nuit. `VueAgenda.tsx` porte un avertissement en commentaire sur
exactement le même piège — ce qui prouve qu'il avait déjà mordu une fois.

---

## 4.4 ⭐ 'HH:MM' affiché tel quel n'est juste QU'EN FRANÇAIS

**Symptôme.** L'app anglaise annonce « 06:00 » et « 14:37 » là où `en-US` dit
« 6:00 AM » et « 2:37 PM ». **Les deux outils i18n sont au vert.**

**Cause.** Le format de stockage de l'app ('HH:MM', heure locale) **est** le
format d'affichage français. Afficher la chaîne de la base est donc juste par
accident dans la langue de développement, et faux dans l'autre. Aucune clé n'est
en jeu : c'est de la donnée affichée telle quelle — l'angle mort du § 5.2 bis.

**Parade.** `formatHeure()` (`lib/i18n`), qui passe par
`toLocaleTimeString(localeTag(), { timeStyle: "short" })`.
⚠️ `timeStyle: "short"` et pas un couple `hour`/`minute` : mesuré, `hour:
"2-digit"` rend « 06:00 AM » en anglais et `hour: "numeric"` rend « 6:00 » en
français. Seul `timeStyle` est correct des deux côtés.
⚠️ **L'affichage seulement.** Ce qui part en base reste 'HH:MM' (`heureDe`) :
localiser une valeur stockée la rendrait illisible au prochain démarrage dans
une autre langue.

**Comment on l'a payée.** Calendrier V2, 2026-09-05, sur cinq points
d'affichage. Vu en basculant l'app en anglais, comme les trois défauts du
chantier B.

# 5. i18n

## 5.1 ⭐ `i18n:check` au vert ne veut PAS dire « traduit »

Une phrase française écrite en dur dans le JSX lui est **invisible**.
`npm run i18n:durs` est le seul outil qui la voit. **Lancer les deux.**

## 5.2 Jamais de `t()` dans une CONSTANTE de module

Elle est évaluée à l'import, donc **figée dans la langue de démarrage**. Les
tables de libellés gardent la phrase française comme valeur et sont traduites
**à l'affichage** : `{t(item.label)}`.

⚠️ **`src/lib/demo.ts` viole cette règle depuis toujours** (~200 `t()` dans des
constantes de module). Ses données de démonstration sont donc figées dans la
langue de démarrage. Signalé à Antonin le 2026-09-02, non corrigé : le code
ajouté depuis suit la convention du fichier plutôt que d'en introduire une
seconde au milieu.

## 5.2 bis ⭐ Une TABLE française de la logique métier échappe aux deux outils

**Symptôme.** L'app basculée en anglais affiche « LUN MAR MER JEU VEN SAM DIM »
en en-tête du calendrier. `i18n:check` **et** `i18n:durs` sont au vert.

**Cause.** `DAY_SHORT` (`src/lib/logic.ts`) est une table de chaînes françaises
sans clé de traduction. La passer à `t()` ne suffit pas : `i18n:check` ne voit
que les clés absentes **des appels qu'il reconnaît**, et `i18n:durs` « ne suit
pas la donnée ». Une table de constantes est de la donnée.

**Parade.** Pour tout ce qu'`Intl` sait dire — jours, mois, dates, nombres,
devises — **utiliser `toLocaleDateString(localeTag(), …)`** plutôt qu'une table
maison. `Intl` connaît toutes les langues sans qu'on lui en ajoute, et la
traduction ne peut pas se périmer.

⚠️ **Le même angle mort couvre toute clé DYNAMIQUE**, pas seulement les tables
françaises : `t(LIBELLE_DE_KIND[kind])` ne sera **jamais** réclamé par
`i18n:check`, qui ne lit que les clés littérales. Quand on écrit une table de
libellés traduite par clé calculée, il faut **ajouter les entrées d'`en.ts` à la
main** et les vérifier en basculant l'app. Le chantier C en a ajouté une
quinzaine de cette façon (familles d'objets, types de champ) — aucune n'aurait
été signalée manquante.

**Comment on l'a payée.** Chantier B, 2026-09-02 : vu à l'écran, jamais par les
outils. C'est la démonstration de la règle du § 3 de `PASSATION.md` — **la
preuve finale, c'est l'app basculée en anglais.**

## 5.3 Le défaut le plus facile à commettre est la MOITIÉ

`data-tip={paused ? t("Reprendre") : "Mettre en pause"}`. Un attribut traduit
juste au-dessus d'un attribut en dur.

## 5.4 Ajouter une clé déjà présente fait échouer le contrôle

`i18n:check` nomme les doublons. Avant d'ajouter un bloc de clés, **lancer le
contrôle et n'ajouter que ce qu'il réclame** — plusieurs mots courants
(« Statut », « Lien », « Terminé ») existent déjà.

---

# 6. Le code du dépôt

## 6.1 Un contrat recopié finit toujours par diverger

**Symptôme.** `demo.ts` ne compile plus après une modification de `repo.ts`.

**Cause.** `TaskInput` était **défini deux fois** — une fois dans `repo.ts`, une
fois dans `demo.ts`. Les deux sont restées d'accord tant que personne n'a touché
à l'une des deux.

**Parade.** `demo.ts` importe désormais les types de `repo.ts` (import de TYPE,
donc effacé à la compilation : pas de cycle à l'exécution). ⚠️ **`GoalInput` est
encore recopié** — même piège, pas encore désamorcé.

## 6.2 Un accès écrit d'un seul côté rend l'interface invérifiable

Toute fonction de `repo.ts` doit exister dans `demo.ts`. Sans elle, l'écran qui
s'en sert ne montre rien en preview navigateur — or c'est **le seul mode où l'on
peut auditer sans piloter la vraie base d'Antonin**.

## 6.2 bis ⭐ Des écouteurs de geste posés dans un `useEffect` ratent les gestes rapides

**Symptôme.** Le glisser-déposer ne fait RIEN. Pas d'erreur, pas de message : on
saisit, on relâche, l'élément n'a pas bougé. Le geste lent d'un humain marche
parfois ; le geste rapide, jamais.

**Cause.** Le `pointerdown` mettait un état React, et un `useEffect` dépendant de
cet état posait les écouteurs `pointermove` / `pointerup`. **Un effet ne
s'exécute qu'APRÈS le rendu.** Un geste dont l'appui, le déplacement et le
relâchement tiennent dans la même tâche du navigateur se termine avant que le
moindre écouteur n'existe.

**Parade.** Poser les écouteurs **dans le gestionnaire de `pointerdown`
lui-même**, et tenir l'état du geste dans un `useRef` — pas dans l'état React,
qui arrive trop tard. C'est déjà ce que fait `ResizableGrid` (« transform
impératif hors React »), pour la même raison.

**Comment on l'a payée.** Chantier B, 2026-09-02. ⚠️ Et il a fallu **deux**
diagnostics : le premier glissement d'essai portait sur une tâche **récurrente**,
que le code refuse volontairement de déplacer. Avant de conclure qu'un geste est
cassé, **vérifier sur quoi on tire** — `document.elementFromPoint(x, y)` le dit
en une ligne.

## 6.2 ter ⭐ Un événement envoyé à un module chargé en `lazy` tombe dans le vide

**Symptôme.** Cliquer une mention change bien de module… et ouvre le PREMIER
élément, pas celui qu'on a demandé. Aucune erreur.

**Cause.** `App.tsx` naviguait puis réémettait l'événement que le module écoute
(`sb:open-note`). Mais les vues sont chargées en `React.lazy` : au moment de
l'émission, la vue **n'est pas encore montée**, son écouteur n'existe pas,
l'événement se perd. ⚠️ Un `setTimeout(0)` ne corrige rien — ce n'est pas une
question de tick, c'est le TÉLÉCHARGEMENT d'un chunk, dont on ne connaît pas la
durée.

**Parade.** Déposer la demande dans un module (`lib/naviguer.ts`,
`deposerDemande`) et la faire **consommer par la vue à son montage**. L'événement
reste émis en plus, pour le cas — fréquent — où le module est déjà à l'écran.

**⚠️ Et un piège dans le piège** : quand un PARENT et son ENFANT s'intéressent à
la même demande (ici `KnowledgeView` pour l'onglet, `GalerieObjets` pour la
fiche), le parent monte d'abord et **consomme** ce que l'enfant attendait. On
arrive alors au bon onglet, devant la mauvaise fiche. D'où deux fonctions
distinctes : `regarderDemande` (sans consommer) et `consommerDemande`.

**Comment on l'a payée.** Chantier C, 2026-09-02, vue à l'écran deux fois de
suite — la seconde après avoir « corrigé » la première.

## 6.2 quater ⭐ Un accès démo TROP INDULGENT masque ce que le natif détruit

**Symptôme.** Une tâche posée sur le calendrier perd sa date quand on rouvre la
tâche pour corriger son titre. **Impossible à reproduire en mode démo**, où tout
se passe bien.

**Cause.** `repo.ts` fait `UPDATE tasks SET … due_date = $6 …` avec
`input.due_date ?? null` : une clé absente de l'entrée **vide la colonne**.
`demo.ts` fait `Object.assign(task, input)` : une clé absente **ne fait rien**.
Les deux implémentations ont la même signature et deux sémantiques différentes,
et c'est la plus indulgente qui sert à auditer.

**Parade.** Le § 6.2 dit « tout accès de `repo.ts` doit exister dans
`demo.ts` ». Ce n'est pas assez : il doit avoir la **même sémantique**, en
particulier sur ce qu'une valeur absente ou nulle EFFACE. Quand un accès écrit
un jeu de colonnes en bloc, `demo.ts` doit écrire les mêmes, `null` compris —
pas fusionner.

**Comment on l'a payée.** Calendrier V2, 2026-09-05. Le défaut existait depuis
la migration 020 et n'a été vu qu'en LISANT `updateTask`, jamais à l'usage :
c'est une perte de données qui ne se produit que sur la vraie base d'Antonin.

## 6.3 Un token de couleur inexistant échoue EN SILENCE

`text-amber` ne génère aucune classe (le token s'appelle `--color-yellow`) : la
couleur retombe sur l'héritage, sans erreur.

**Les cinq tokens de couleur RÉELS**, vérifiés dans `src/index.css` le
2026-09-02 : `blue`, `green`, `red`, `yellow`, `violet`.
⚠️ `CLAUDE.md` en cite un sixième, **`indigo`, qui n'existe pas** — l'employer
échouerait donc exactement de la façon décrite ci-dessus. Corrigé dans
`CLAUDE.md` le 2026-09-02.

## 6.3 bis ⭐ `prefers-reduced-motion` de l'app N'ATTEINT PAS `scroll-behavior`

**Symptôme.** On ajoute un défilement lissé quelque part, on se dit que la règle
globale d'accessibilité le couvre — elle ne le couvre pas. Quelqu'un qui a
demandé qu'on arrête de bouger continue de voir la page glisser.

**Cause.** La règle du § « préférences système » de `src/index.css` écrase
`animation-duration` et `transition-duration` sur `*`. **`scroll-behavior` est
une troisième famille**, qu'aucune des deux ne touche.

**Parade.** Couper à la main, sous la même requête média :

```css
@media (prefers-reduced-motion: reduce) {
  .ma-zone { scroll-behavior: auto; }
}
```

⭐ **Mais d'abord se demander si le lissé sert à quelque chose.**
`scroll-behavior` ne s'applique qu'aux défilements **programmatiques**
(`scrollTo`, ancres) — **jamais au geste de l'utilisateur**, qui garde son
inertie native quoi qu'on écrive. Sur la roulette d'heure il n'apportait rien et
coûtait un bogue (§ 7.7). Le meilleur correctif a été de le retirer.

**Comment on l'a payée.** Roulette d'heure, 2026-09-06.

## 6.4 Tout `vh`/`vw` doit être multiplié par `--zoom-inv`

Le `zoom` CSS de la densité multiplie **aussi** les unités de viewport : sans
correction, l'élément déborde de l'écran dès que la densité n'est pas à 100 %.

---

## 6.5 ⭐ Une prop qui arrive EN DIFFÉRÉ, lue par un effet qui dépend d'une AUTRE

**Symptôme.** Le contenu d'une note se retrouve dans une autre. On ouvre la note
B, l'éditeur affiche le corps de la note A ; la première frappe écrit ce corps
dans B, et le vrai corps de B est détruit. Aucune erreur, aucune alerte. Le
titre, lui, est le bon — et le pied de page affiche les bons liens, puisqu'ils
viennent de la donnée. **L'app se contredit elle-même à l'écran.**

**Cause.** `RichNoteEditor` est un `contenteditable` : son contenu vit dans le
DOM. Il le remplissait dans un `useEffect` dépendant de `[noteId]` SEUL, tout en
lisant `initialHtml`. Or `NotesView` passait `corpsFrais ?? selected.body`, où
`corpsFrais` arrive en différé et n'était pas remis à zéro au changement de
note. À l'instant du basculement, l'effet recevait donc **la nouvelle identité
et l'ancien contenu**, et il n'écoutait plus quand le bon arrivait, puisque
`noteId` n'avait plus bougé.

**Parade.** ⭐ **Une identité et le contenu qui lui correspond voyagent
ENSEMBLE, dans un seul objet, calculé par une fonction pure.** C'est
`graineDeNote` (`src/lib/graineEditeur.ts`) : le HTML rendu appartient toujours
à l'identifiant rendu, et le désaccord devient impossible à exprimer. Corollaire
général : **un effet ne doit jamais lire une valeur qui n'est pas dans ses
dépendances** — s'il le fait, il lit celle de l'instant, pas la bonne.

⚠️ **Le piège dans le piège, payé le même jour.** Le premier correctif mettait
« l'utilisateur a-t-il tapé » dans le calcul de la graine. La clé de rechargement
repassait donc de `frais` à `brut` à la première frappe : elle **revenait en
arrière**, l'effet resemait le DOM avec le texte d'avant, et la lettre partait en
base **en disparaissant de l'écran**. Les tests étaient verts.
▶️ **Une clé de rechargement ne recule jamais.** « Quel contenu » et « faut-il le
reposer » sont deux questions, donc deux fonctions (`graineDeNote` et
`doitResemer`).

**Comment on l'a payée.** Chantier H, 2026-09-05/06, quatre jours de bogue chez
Antonin — sans perte, par chance : il faut taper par-dessus la note mal affichée
pour que l'écrasement devienne réel. Le même défaut dormait dans
`GalerieObjets`, où il aurait emporté aussi le titre et les valeurs de champs ;
il n'a jamais mordu parce que la base d'Antonin contient zéro objet.
⭐ **Les trois contre-épreuves valent mieux que le raisonnement** : le Savoir
n'était pas touché (il passe `entry.body`, qui change dans le MÊME rendu) ; sur
téléphone, revenir à la liste réparait tout (c'était le seul endroit qui remettait
`corpsFrais` à zéro) ; et une note neuve, vide en base, affichait quand même un
corps.

## 6.6 Un module dont la doc décrit le VOISIN

**Symptôme.** On cherche un défaut là où la documentation dit qu'il ne peut pas
être. Ici : « enregistrement auto débouncé + **flush garanti à la fermeture** »
dans `CLAUDE.md`. Notes n'a jamais eu de flush — ni `beforeunload`, ni
`pagehide`, ni enregistrement au démontage. La phrase décrivait le lecteur du
**Savoir** (`KnowledgeView`), qui en a bien un. Conséquence : ce qui est tapé
dans les 700 ms avant la fermeture de l'app était perdu.

**Parade.** Quand une phrase de doc couvre deux modules qui se ressemblent,
**nommer celui dont on parle**. Et avant de rayer une hypothèse parce que « c'est
déjà géré », faire le `grep` — il coûte dix secondes.

**Comment on l'a payée.** Chantier H, 2026-09-06 : l'hypothèse « pas de flush »
avait été écartée à la lecture de `CLAUDE.md` avant d'être reprise.

---

# 7. Vérifier — et ce qui ne vérifie rien

> ## ⭐ LA RÈGLE QUI COIFFE TOUT CE CHAPITRE
>
> **Un contrôle doit pouvoir rendre « non ». Sinon ce n'est pas un contrôle.**
>
> Formulée le 2026-09-06 après en avoir rencontré **trois exemplaires en une
> soirée**, tous autour du même geste — la mise en service chez Antonin — et
> aucun repéré par son propre auteur :
>
> | Le contrôle | Pourquoi il ne pouvait pas échouer | Où |
> |---|---|---|
> | `grep "graineDeNote" dist/assets/*.js` | un nom de fonction est minifié : rend 0 quoi qu'il arrive | § 7.5 bis |
> | `end_date` **= 25** exactement | compte dispersé dans des chunks : rejette les bons bundles | § 7.5 bis |
> | `[ "$A" = "$B" ]` sur deux requêtes SQL fausses | les deux rendent la chaîne vide, donc l'égalité est vraie | § 7.5 quater |
>
> Les deux premiers auraient fait conclure à un défaut inexistant **au moment
> précis où l'on écrit dans `/Applications`** ; le troisième a affiché
> « ✅ identiques » sur une comparaison qui n'avait jamais tourné.
>
> ▶️ **Le geste qui les attrape tous les trois : faire échouer le contrôle
> exprès une fois.** C'est le § 7.2 (« un test qui passe ne prouve rien tant
> qu'on ne l'a pas vu échouer ») appliqué hors des tests — à un `grep`, à une
> comparaison de shell, à une requête. Si l'on ne sait pas construire le cas où
> il rend « non », il ne dit rien quand il rend « oui ».

## 7.1 ⭐ Aucun test de ce dépôt ne prouve une interface

Les tests sont **tous** de logique pure ou de schéma. Il n'existe aucune
infrastructure de test de rendu React. **Ne jamais écrire qu'un correctif
d'interface est « vérifié par un test ».** Une interface se vérifie à l'écran.

> ### ⭐ Précision ajoutée le 2026-09-06 : le vert peut être au MAUVAIS ENDROIT
>
> Cette règle se lit trop souvent comme « il manque des tests ». Le danger est
> plus retors : **des tests peuvent être verts parce qu'ils testent la bonne
> chose au mauvais endroit.** La fonction pure est juste, ses tests le prouvent,
> et le défaut est dans ce que le COMPOSANT en fait — un argument passé de
> travers, un effet qui la rappelle au mauvais moment. Aucune ligne rouge
> n'apparaît, et la suite entière donne l'impression de couvrir le sujet.
>
> **Trois fois en une semaine dans ce dépôt** : les trois défauts du chantier B
> (2026-09-02, vus seulement à la mise à l'écran), un événement récurrent qui se
> déplaçait au glisser-déposer alors que la règle était écrite et testée
> (2026-09-05), et le premier correctif du chantier Notes — sa fonction de
> décision était juste, mais le composant lui passait « l'utilisateur a-t-il
> tapé », ce qui faisait reculer la clé de rechargement et effaçait la lettre à
> l'écran tout en l'enregistrant en base (2026-09-06).
>
> ▶️ **Le corollaire pratique** : quand une correction d'interface s'accompagne
> d'une fonction pure et de ses tests, la partie prouvée est la fonction, pas la
> correction. Aller voir.

## 7.2 Un test qui passe ne prouve rien tant qu'on ne l'a pas vu échouer

**Parade.** Après avoir corrigé un défaut, **remettre brièvement l'ancien code**
et vérifier que le test tombe. Sans cela, on ne sait pas si le test a des dents.

**Comment on l'a payée.** Chantier A : c'est ce geste qui a confirmé que le
piège 2.1 était réel — 7 tests sur 8 tombent avec l'ancien tri.

## 7.2 bis ⭐ Un jeu d'essai qui ne dit pas ce qu'il croit dire

**Symptôme.** Deux tests passent, deux autres échouent — et le code semble juste.

**Cause.** L'aide qui fabriquait les données de test s'appelait `dixMardisDe()`
et égrenait en réalité des dates tous les **deux jours** : elle produisait des
mardis, des jeudis et des samedis. Le profil apprenait donc le samedi, et les
tests qui « vérifiaient » qu'il ne l'apprenait pas passaient pour de mauvaises
raisons.

**Parade.** Une aide de test qui prétend produire un jour de semaine précis doit
**partir d'une date de ce jour-là et reculer de 7 en 7**, jamais bricoler une
chaîne de caractères. Et quand un test échoue, **vérifier d'abord le jeu
d'essai** : `node -e 'console.log(new Date("2026-09-01T12:00:00").getDay())'`
coûte dix secondes.

**Comment on l'a payée.** Chantier B, 2026-09-02 : quinze minutes à chercher un
défaut de calcul qui n'existait pas.

## 7.2 ter ⭐ Une règle écrite en ÉNUMÉRANT des familles finit par avoir un trou

**Symptôme.** La règle « un événement récurrent ne se déplace pas au
glisser-déposer » est écrite, documentée, et **fausse depuis toujours**. Glisser
une occurrence hebdomadaire déplace la SÉRIE : cinq occurrences deviennent
trois, deux journées disparaissent sans erreur ni annulation.

**Cause.** Le garde disait `if (entree.kind === "recurrence" || entree.kind ===
"deadline") return;`. Or `"recurrence"` désigne les **tâches** récurrentes ; un
**événement** récurrent est un `kind: "event"` comme un autre. L'énumération
avait un trou de la taille exacte de la règle qu'elle prétendait tenir — et
l'audit d'origine n'avait essayé de glisser qu'une tâche.

**Parade.** Faire porter la règle par la **propriété** qu'elle vise, pas par une
liste de familles : ici un drapeau `serie` (« ceci est une occurrence
projetée »), calculé à un seul endroit. Une liste doit être tenue à jour à
chaque famille nouvelle ; une propriété se calcule.
⚠️ **Et vérifier chaque BRANCHE de l'énumération à l'écran**, pas la première.

**Comment on l'a payée.** Calendrier V2, 2026-09-05. Deux fois : réparer la
première moitié de la règle a cassé la seconde (« il s'ouvre, et l'utilisateur
décide » passait par le gestionnaire qu'on venait de court-circuiter), et
l'événement récurrent est devenu complètement inerte jusqu'au second essai.

## 7.2 quater ⚠️ Un sélecteur CSS peut être INERTE sans que rien ne le dise

**Symptôme.** On écrit une garde CSS, elle est dans le fichier, le build passe,
et elle ne s'applique jamais.

**Cause.** `[data-glisse="1"] .cal-anime` suppose que l'élément porteur de
`data-glisse` est un ANCÊTRE du calque animé. Il en était le descendant. Aucun
outil ne signale un sélecteur qui ne correspond à rien.

**Parade.** Lire le **CSSOM de l'app qui tourne**, pas le fichier source :

```js
// remonte toutes les règles qui mentionnent un sélecteur
function balaye(rs, out){ for(const r of rs){ if(r.selectorText?.includes("mon-motif")) out.push(r.cssText); if(r.cssRules) balaye(r.cssRules,out); } }
```

Cela prouve d'un coup que la règle a survécu à Tailwind ET qu'elle vise le bon
élément. ⚠️ Attention à la boucle elle-même : une version qui saute les feuilles
ayant `cssRules` rate toutes les règles imbriquées et fait conclure à tort que
la règle n'existe pas.

**Comment on l'a payée.** Calendrier V2, 2026-09-05 — sans conséquence, la garde
n'avait rien à garder, mais elle aurait pu.

## 7.3 Un test rouge n'est pas forcément le vôtre

**Symptôme.** `auth/activation.sql.test.ts` échoue sur deux cas d'essai gratuit.

**Cause.** Le test lit le SQL du **dépôt du site**, qui a changé le 2026-08-31
(Stripe LIVE, le paiement devient le mur) sans que le test de l'app ne suive.
**Ces deux échecs préexistent à tous les chantiers en cours.**

**Parade.** Avant de croire avoir cassé quelque chose, **rejouer le test sur la
branche intacte**.

**✅ Résolu le 2026-09-02.** L'intention des deux tests était juste ; c'est leur
MISE EN PLACE qui décrivait le monde d'avant. Ils attendaient un essai de
l'inscription, alors qu'il vient désormais de Stripe. Ils le posent maintenant
explicitement, comme le fait le webhook.

⚠️ **La leçon vaut au-delà de ce cas.** Un test qui échoue après un changement
de produit n'est pas forcément faux : regarder si c'est son ASSERTION qui est
périmée (alors on la met à jour) ou seulement sa MISE EN PLACE (alors on la
corrige et l'assertion reste). Ici, « réparer » en rouvrant l'essai sans carte
aurait contredit les CGV publiées — le test aurait été vert et le produit
illégal.

## 7.4 Vérifier un document dans l'arbre avant de le croire

**Symptôme.** Une consigne annonçait « douze modules est écrit en toutes lettres
à **8 endroits** dans `src/` ». Le grep rend bien 8 résultats — mais sept
parlent de douze **mois**, douze **loyers**, douze **mots**. **Aucun texte
affiché dans l'app n'annonce le nombre de modules** ; seuls deux commentaires de
code le mentionnent.

**Parade.** Un compte donné par un document se re-mesure avant d'être utilisé.
`grep -rn "douze"` n'est pas `grep -rn "douze modules"`.

## 7.4 bis ⭐ Ouvrir le clavier ne change PAS `innerHeight` sur iPhone

**Symptôme.** Un menu déroulant, une info-bulle ou un sélecteur positionné juste
sous le curseur s'affiche **sous le clavier logiciel** : invisible et
inatteignable. Sur le bureau, tout est parfait.

**Cause.** iOS ne redimensionne pas la fenêtre quand le clavier apparaît : il le
pose PAR-DESSUS. `window.innerHeight` continue donc d'annoncer la hauteur totale,
et tout calcul de dépassement fondé dessus se trompe de plusieurs centaines de
points.

**Parade.** `window.visualViewport` mesure ce qui reste **visible**, clavier
déduit. Son `offsetTop` compte aussi : la page peut avoir été poussée vers le
bas. Replier sur `innerHeight` pour le bureau, où les deux coïncident.

```js
const vv = window.visualViewport;
const basVisible = (vv?.offsetTop ?? 0) + (vv?.height ?? window.innerHeight);
```

**Comment on l'a payée.** Chantier iOS, 2026-09-02 — raisonné et corrigé avant
d'être vu, parce que le clavier logiciel n'est pas pilotable avec l'outillage
actuel. ⚠️ **Le correctif n'est donc PAS mesuré**, seulement documenté.

## 7.4 ter ⚠️ Au doigt, glisser et défiler sont le MÊME geste

**Symptôme.** Un glisser-déposer conçu à la souris devient, sur téléphone, une
machine à déplacer des éléments par accident : on essaie de faire défiler la vue,
et le premier élément touché part avec le doigt.

**Cause.** À la souris, la molette défile et le curseur ne fait que pointer : six
pixels de déplacement ne peuvent être qu'un glissement délibéré. Au doigt, le
même mouvement sert aux deux.

**Parade.** Exiger un **appui long** (400 ms) avant d'armer le glissement quand
`e.pointerType === "touch"`, et **annuler** si le doigt bouge avant l'échéance —
c'est un défilement, on rend la main au navigateur. Poser `touch-action: none`
**à l'armement seulement** : en permanence, plus rien ne défile ; sur les seules
cartes, on ne peut plus défiler en partant d'une carte.

⚠️ `navigator.vibrate` n'existe **pas** sur iOS Safari ni en WKWebView — l'appel
lève sans garde, et le retour haptique n'est de toute façon pas disponible là.

## 7.5 `getComputedStyle` n'est pas une preuve de couleur

Chromium rend une valeur périmée sous `backdrop-filter`. **La capture d'écran
tranche.**

## 7.5 bis ⭐ `tauri build` fige le front AU DÉBUT, puis compile le Rust pendant des minutes

**Symptôme.** On vérifie que le front compilé est postérieur au dernier commit,
la construction réussit, on installe — et l'app livrée n'a pas un correctif
fusionné entre-temps. L'invariant était vrai **quand on l'a vérifié**, et faux
**quand on a installé**.

**Cause.** `beforeBuildCommand` lance `vite build` à la toute première seconde,
puis `cargo` prend plusieurs minutes. Le dépôt peut bouger pendant ce temps —
une autre session qui fusionne, un `git pull`. Le front embarqué est celui du
DÉBUT du build, jamais celui de la fin.

**Parade, en deux temps.**
1. Revérifier l'invariant **juste avant la copie vers `/Applications`**, pas
   après la compilation.
2. Mieux : **prouver le CONTENU** plutôt que les horodatages. Chercher dans
   `dist/assets/*.js` le motif que le correctif est censé avoir fait
   disparaître. Les assets y sont minifiés mais lisibles — c'est dans le
   BINAIRE qu'ils deviennent illisibles (compressés), pas dans `dist/`.

   > ⭐ **PRÉCISION AJOUTÉE LE 2026-09-06, et elle est la moitié manquante de la
   > règle : LE MOTIF DOIT SURVIVRE À LA MINIFICATION.**
   >
   > « Minifiés mais lisibles » ne vaut que pour ce qui ne peut pas être
   > renommé. Un **nom de fonction**, de variable ou de composant est réécrit en
   > une ou deux lettres par esbuild : le chercher rend **toujours zéro**, que
   > le correctif soit présent ou absent. Le test ne prouve alors rien et, pire,
   > il fait conclure à un bundle périmé au moment exact où l'on s'apprête à
   > installer.
   >
   > **Ce qui survit** : une chaîne de caractères littérale, un nom de classe
   > CSS, un attribut `data-*`, un nom de colonne SQL. **Ce qui ne survit pas** :
   > tout identifiant du code.
   >
   > **Comment on l'a payée.** Le 2026-09-06, la session du chantier Notes a
   > transmis `grep -c "graineDeNote" dist/assets/*.js` comme preuve que son
   > correctif était embarqué. `graineDeNote` est une fonction exportée : le
   > compte est **0** alors que le correctif EST bien là — prouvé par la chaîne
   > `"Shale/notes: refused a write"`, qui, elle, rend 1. Personne n'avait
   > encore construit ; le témoin aurait été employé juste avant la copie vers
   > `/Applications`.
   >
   > ▶️ **Choisir le témoin AU MOMENT D'ÉCRIRE le correctif**, et le vérifier
   > sur un `npx vite build` avant de le transmettre à qui que ce soit.
   >
   > ⚠️ **Et un bon témoin PÉRIME.** Celui des Notes tient parce que son message
   > d'incident est écrit en dur, volontairement non traduit ; le jour où
   > quelqu'un le passera à `t()`, la chaîne quittera le code pour `en.ts` et le
   > témoin mourra avec elle — sans que rien ne le signale. Un témoin se
   > REVÉRIFIE avant chaque build, il ne se recopie pas d'une passation.
   > (Réserve trouvée par la session du chantier Notes, `PASSATION-NOTES.md`.)
3. Et après la copie, comparer les **sha256** du binaire installé et de la
   source : c'est la seule preuve que `ditto` a vraiment remplacé quelque chose.

   > ⚠️ **Deux angles morts de ce § 3, trouvés le 2026-09-06 pendant un vrai
   > build.**
   >
   > **① Une égalité de `sha256` ne prouve la copie que si les deux opérandes
   > étaient des fichiers DIFFÉRENTS au départ.** Ce soir-là, l'ancienne app et
   > la neuve avaient déjà la même empreinte AVANT le `ditto`.
   >
   > ⚠️ **CORRECTION DU 2026-09-06, 19 h — j'avais écrit ici trois causes
   > « toutes bénignes ». DEUX ONT ÉTÉ ÉLIMINÉES PAR LA MESURE, et le fait brut
   > est qu'on ne sait pas.**
   > · Ce n'était PAS le firmlink : les deux chemins hachés étaient bien
   >   `/Applications/…` et `src-tauri/target/release/bundle/macos/…`, deux
   >   fichiers distincts.
   > · Ce n'était PAS un `cargo --release` reproductible : le binaire du
   >   2026-09-04 existe encore et rend `ff645b6d…`, quand celui du 2026-09-06
   >   rend `8d03ecf0…`. Deux builds du même dépôt depuis deux worktrees ne
   >   coïncident pas sur cette machine.
   > · L'app installée avant la copie aurait donc dû rendre `ff645b6d…`. Elle a
   >   rendu `8d03ecf0…`, **et personne ne sait pourquoi** : l'ancien bundle
   >   avait été effacé avant qu'on s'en aperçoive, la preuve est détruite.
   >
   > **Verdict : INDÉTERMINÉ.** C'est une information, pas une lacune du carnet —
   > « on n'a pas pu savoir » se consigne, et la parade ne dépend pas de la cause.
   >
   > ⭐ **Comment on a su que l'élimination tenait : par l'HORODATAGE, pas par le
   > hash.** La valeur `ff645b6d…` figure aussi dans `COORDINATION.md` du
   > 2026-09-04 — donc la citer ne prouvait rien. Ce qui prouve que la mesure a
   > eu lieu, c'est le `mtime` rendu par `stat` : **11:51:49**, quand le carnet
   > écrivait « le bundle de 11:51 ». Deux faits indépendants, un lu sur le
   > disque et un écrit deux jours plus tôt par une autre session, concordants à
   > la seconde. Une recopie n'aurait pas produit l'horodatage.
   > ▶️ **Quand un chiffre existe déjà dans un document, ce n'est pas lui qui
   > distingue la mesure de la citation** — c'est ce qui l'accompagne et que le
   > document ne contient pas.
   >
   > ▶️ **Garder le `shasum` horodaté de l'ancien binaire AVANT de le
   > remplacer.** Un contrôle qui ne peut pas échouer ne contrôle rien.
   >
   > ⚠️ **ET LA PARADE VAUT POUR TOUT `rm -rf` SUR UN ARTEFACT DE BUILD, PAS
   > SEULEMENT POUR L'INSTALLATION.** Le binaire du 2026-09-04 a survécu à la
   > copie, et il est parti quarante minutes plus tard dans un ménage disque —
   > **fait par la même session, après qu'elle eut écrit la leçon sur le fait
   > d'avoir détruit la preuve une première fois.** Deux fois le même geste dans
   > la même soirée, la seconde en connaissant la règle. Tant qu'une question
   > reste ouverte sur un build, ses artefacts sont des pièces, pas de l'encombre.
   >
   > **② UN CORRECTIF PUREMENT FRONT N'EST PAS PROUVABLE DANS LE BINAIRE
   > INSTALLÉ.** Dans un bundle Tauri le front est COMPRESSÉ : `find Shale.app
   > -name '*.js'` est vide, et les trois témoins y rendent zéro. Mesuré côte à
   > côte dans le même binaire livré :
   >
   > | Motif cherché dans `/Applications/Shale.app/Contents/MacOS/shale` | Rendu |
   > |---|---|
   > | `ALTER TABLE calendar_events ADD COLUMN end_date` (SQL, `include_str!`) | **1** |
   > | `Shale/notes: refused a write` (chaîne du front) | **0** |
   >
   > ⭐ Seul ce que le **Rust** embarque en clair est prouvable sur l'app
   > réellement installée — et le SQL des migrations en fait partie, ce qui en
   > fait le meilleur témoin qui soit pour une migration. Pour une correction
   > front, il n'existe **aucune** preuve tirée du bundle : on ne peut que
   > relever les témoins sur `dist/` et chaîner par les horodatages
   > (`dist` 18:40 → binaire 18:47). C'est plus faible, et il faut le savoir
   > plutôt que de croire avoir prouvé.

**Comment on l'a payée.** 2026-09-04 : une session voisine a fusionné un
correctif 1 min 50 après le `vite build` et 1 min avant la fin du bundle. L'app
a été installée sans lui. **C'est elle qui l'a signalé, pas moi** — mon
invariant, vérifié au mauvais moment, disait que tout allait bien.

## 7.5 ter ⭐ `LENGTH()` compte des CARACTÈRES, et un constat de dégâts se fait en OCTETS

**Symptôme.** On relève « 45 835 octets de notes » avant une opération et
« 45 394 » après. On croit à une perte de 441 octets et on cherche ce qui a
disparu — alors que rien n'a été perdu.

**Cause.** `LENGTH(body)` en SQLite rend un nombre de **caractères** sur une
colonne TEXT. `LENGTH(CAST(body AS BLOB))` rend des **octets**. Sur du français,
chaque accent vaut deux octets pour un caractère : l'écart faisait ici 495 sur
45 000, soit très exactement l'ordre de grandeur d'une « perte » imaginaire.

**Parade.** Pour un constat de dégâts, **toujours `LENGTH(CAST(x AS BLOB))`**, et
écrire l'unité à côté du chiffre dans la passation. Et avant de conclure à une
perte, chercher ce qui a **bougé** plutôt que ce qui manque :

```sql
SELECT id, title, updated_at FROM notes WHERE updated_at > '<l'heure du relevé>';
```

**Comment on l'a payée.** 2026-09-06, après le build de mise en service. L'écart
réel entre les deux relevés était de **+54 octets** — une note écrite par Antonin
à 18:52:59, six minutes après la relance. Rien n'avait disparu ; quelque chose
avait été ajouté, et deux unités différentes le faisaient passer pour l'inverse.

## 7.5 quater ⚠️ En shell, une requête cassée se lit comme une preuve

**Symptôme.** Un contrôle de non-régression affiche « ✅ identiques » sur une
comparaison qui n'a jamais tourné.

**Cause.** `A=$(sqlite3 … "SELECT uid,title FROM tasks")` — la colonne s'appelle
`label`, pas `title`. Les DEUX côtés échouent, rendent la chaîne vide, et
`[ "$A" = "$B" ]` est vrai. Rien ne rougit : `sqlite3` écrit son erreur sur
stderr et rend 0 lignes sur stdout.

**Parade.** Toujours garder la non-vacuité avec la comparaison :

```bash
[ -n "$A" ] && [ "$A" = "$B" ] && echo "identiques"
```

Et pour du SQL écrit à la volée, vérifier le nom des colonnes
(`PRAGMA table_info(<table>)`) plutôt que de se fier à sa mémoire — dans ce
dépôt, `tasks` porte `label`, `notes` porte `title`, et `calendar_events` porte
`title` aussi.

**Comment on l'a payée.** 2026-09-06, pendant la vérification d'après-build sur
la vraie base d'Antonin. Vue en RELISANT la sortie, pas parce qu'un contrôle
avait échoué. C'est le même défaut que le témoin mort et que le compte trop
strict, une troisième fois dans la même soirée : **un contrôle qui ne peut pas
échouer ne contrôle rien.**

## 7.6 Vérifier que le bundle installé n'est pas plus vieux que le dernier commit

Trois minutes d'écart ont déjà fait passer un garde déjà écrit pour un défaut
(`MOBILE.md` § 19.1).

---

# 8. La machine d'Antonin

## 8.1 Antonin n'utilise JAMAIS le Terminal

Exécuter, ne pas prescrire. Une liste de commandes à recopier n'est pas un
livrable : c'est un travail terminé transformé en travail bloqué. Ce qui reste
hors de portée se décrit en **gestes d'interface** (nom de l'app, nom du bouton,
où il est à l'écran).

## 8.2 Ne jamais faire un `pkill` par motif

Plusieurs sessions Claude peuvent tourner en même temps : un `pkill` large tue
les serveurs de développement des sessions voisines.

## 8.2 bis ⭐ `lsof` sur un port ne dit PAS à qui appartient le processus

**Symptôme.** On veut arrêter son propre serveur de développement. `lsof -ti:5183`
rend un PID, on le tue — et **c'était le service réseau de l'application Claude
elle-même**, qui avait simplement une connexion CLIENTE ouverte vers ce port.

**Cause.** `lsof -ti:<port>` liste **tout** ce qui touche au port : le serveur
qui écoute **et** chaque client connecté. Le navigateur intégré compte parmi les
clients.

**Parade.** Ne jamais tuer un PID sans avoir lu sa ligne de commande **avant** :

```bash
ps -p <PID> -o command=
```

Et viser le serveur par son motif exact (`pkill -f "vite --port 5183"`), jamais
par le port. ⚠️ Voir aussi la règle générale : **jamais de `pkill` large**,
plusieurs sessions Claude peuvent tourner en même temps.

**Comment on l'a payée.** Chantier C, 2026-09-02. Sans conséquence durable — le
service réseau de Chromium se relance seul — mais c'était un coup de chance, pas
une garantie.

## 8.3 Une reconstruction native redemande l'accès au trousseau

La signature ad hoc change à chaque reconstruction : macOS redemande
l'autorisation au premier lancement. **Le dire à Antonin** — sinon il découvre
une fenêtre inexpliquée et ne sait pas s'il doit accepter.

⚠️ **Précision acquise le 2026-09-04, après s'être trompé dessus** : la fenêtre
revient dès que le **BINAIRE** change, pas seulement à la première installation.
Reconstruire deux fois de suite le MÊME code ne la fait pas revenir ; y ajouter
un seul commit, si. Ne jamais promettre à Antonin qu'elle ne réapparaîtra pas
sans avoir vérifié que le code n'a pas bougé entre les deux constructions.

## 8.4 Auditer en `tauri dev` pilote la VRAIE base d'Antonin

Avec un risque d'écriture à chaque `Tab`. Le mode démo navigateur n'est pas du
confort, c'est la seule façon sûre de regarder une interface.

## 7.7 ⭐ Un `scrollTo` lissé, un `scroll-snap` et un verrou anti-boucle se battent à trois

**Symptôme.** Une molette à défilement (`scroll-snap`) ne se positionne jamais
sur sa valeur : elle part vers le bon cran puis **retombe en haut**. Mesuré,
`scrollTop` valait 19 là où on attendait 392.

**Cause.** Trois mécanismes qui se marchent dessus :
1. `scrollTo({top})` **anime** quand le CSS porte `scroll-behavior: smooth` ;
2. `scroll-snap` recale à chaque image pendant cette animation ;
3. le verrou qui empêche la boucle « défilement → état → repositionnement » se
   relâche après un délai fixe — plus court que l'animation. Le gestionnaire de
   `scroll` relit alors une position **intermédiaire**, l'écrit dans l'état, et
   la molette se stabilise là où l'animation en était.

**Parade.** Positionner **instantanément** (`el.scrollTo({ top, behavior:
"auto" })`), ce qui supprime l'animation, donc la course, donc le besoin d'un
verrou long. Et retirer `scroll-behavior: smooth`, qui n'apportait rien (§ 6.3
bis).

⚠️ **Le verrou anti-boucle reste nécessaire** même en instantané : sans lui,
défiler écrit dans l'état, l'état repositionne, le repositionnement déclenche un
`scroll`, qui réécrit dans l'état. La molette vibre entre deux crans dès qu'on la
lâche entre les deux, et plus rien n'est visable.

**Comment on l'a payée.** Roulette d'heure, 2026-09-06 — **vu à l'écran, jamais
par un test** : aucun test de ce dépôt ne monte un composant (§ 7.1).

## 7.8 ⚠️ Une bordure retire deux pixels de hauteur utile

**Symptôme.** Une liste calée sur des crans de 28 px n'a jamais son élément
sélectionné tout à fait au centre. `clientHeight` rend **82** là où le style
demande 84.

**Cause.** `box-sizing: border-box` — universel dans ce dépôt — fait compter la
bordure DANS la hauteur. Trois crans de 28 px plus une bordure d'un pixel de
chaque côté laissent 82 px de contenu.

**Parade.** Mettre la bordure sur une **enveloppe**, et laisser au conteneur
défilant une hauteur qui est exactement un multiple du cran.

**Comment on l'a payée.** Roulette d'heure, 2026-09-06.

---

# 9. React, le DOM, et les fermetures — chantier « cartes mentales » (2026-09-07)

> **Ce chapitre a été ouvert le 2026-09-07.** Les six entrées ci-dessous ont
> toutes été trouvées **à l'écran**, en une seule soirée, sur un chantier dont
> les 57 tests unitaires étaient au vert du premier coup. C'est le § 7.1 dans sa
> forme la plus brutale : **le modèle était juste, et rien de ce qui suit ne
> pouvait être attrapé par un test de ce dépôt.**

## 9.1 ⭐⭐ Un `useCallback([])` dans un éditeur RENOMME la note

**Symptôme.** On insère une carte mentale dans une note. Le corps est
parfaitement enregistré — et **le titre de la note devient « Sans titre »**.
La note « Idées de reels » disparaît de la liste, remplacée par une « Sans
titre » qui contient exactement son contenu. Aucune erreur, aucune alerte.

**Cause.** L'enregistrement de la carte était mémoïsé avec des dépendances
**vides** :

```ts
const enregistrerCarte = useCallback((c) => { …; emit(); }, []);
```

Elle capturait donc le `emit` du **premier** rendu, donc le `onChange` du premier
rendu de `NotesView`, donc son état `title` — qui vaut `""` tant que l'effet de
chargement ne l'a pas rempli. `NotesView.flush()` fait
`updateNote(id, titre.trim() || "Sans titre", corps)` : le titre vide devient un
titre par défaut, et le vrai titre est détruit.

**Parade.** **Ne mémoïser AUCUNE fonction qui écrit dans le document.** Le coût
d'une fonction recréée à chaque rendu est nul ; le coût d'une fermeture périmée
est une perte de données. Quand la mémoïsation est indispensable, l'appelant
range la fonction fraîche dans une `ref` à chaque rendu
(`enregistrerRef.current = onEnregistrer`), et c'est la ref qu'on lit.

⚠️ **C'est le § 6.5 transposé aux fermetures** : *une fonction ne doit jamais
lire une valeur qui n'est pas dans ses dépendances*. Là c'était un effet, ici
c'est un `useCallback` — le mode d'échec est identique, et la perte aussi.

**Comment on l'a payée.** Cartes mentales, 2026-09-07. Vu à l'écran en
vérifiant tout autre chose (le backlink pointait vers « Sans titre » au lieu de
la note d'origine, et c'est CE détail qui a mis sur la piste).

## 9.2 ⭐⭐ `outerHTML` sur un élément de premier niveau d'un `<template>` LÈVE

**Symptôme.** Un nœud-référence continue d'afficher l'ANCIEN titre de sa cible
après un renommage. Le lien, lui, est intact. Aucune erreur en console, aucun
message : la fonctionnalité est simplement inerte.

**Cause.** Le rafraîchissement des titres travaille sur un `<template>` détaché
et remplaçait chaque bloc par `figure.outerHTML = …`. Or un bloc de carte est
toujours un enfant de **premier niveau** du corps : dans un `<template>`, son
parent est donc le `DocumentFragment`, pas un élément. Chrome lève alors

```
NoModificationAllowedError: Failed to set the 'outerHTML' property on 'Element':
This element's parent is of type '#document-fragment', which is not an element node.
```

L'exception remontait dans la promesse qui produit le corps « frais ». La
promesse était **rejetée**, le `.then()` ne partait jamais, et le corps
rafraîchi n'arrivait pas — sans que rien ne le dise.

**Parade.** `replaceWith()`, jamais `outerHTML`, dès qu'on manipule un
`<template>` ou un fragment : `replaceWith` travaille sur le parent **NŒUD**, pas
sur le parent **ÉLÉMENT**, et fonctionne partout.

```js
const neuf = document.createElement("template");
neuf.innerHTML = htmlDeRemplacement;
element.replaceWith(...Array.from(neuf.content.childNodes));
```

⚠️ **Et la vraie leçon est ailleurs** : une transformation de contenu ne doit
jamais pouvoir empêcher l'affichage. Le rafraîchissement est désormais dans un
`try/catch` qui journalise et rend le contenu inchangé — **un titre périmé se
voit, un corps absent ne se diagnostique pas.**

**Comment on l'a payée.** Cartes mentales, 2026-09-07. Une demi-heure de fausses
pistes (regex, échappement, ordre des attributs) avant de tester la ligne
elle-même dans la console.

## 9.3 ⭐ Un `setTimeout(0)` après un `setState` ne garantit PAS que le DOM existe

**Symptôme.** Un champ de saisie s'ouvre bien à l'écran, mais
`document.activeElement` reste `BODY` : tout ce qu'on tape tombe à côté.

**Cause.** Le focus était posé dans `window.setTimeout(() => champ.current?.focus(), 0)`
juste après `setEdition(id)`. Rien ne promet que React ait **commité** le rendu
quand la minuterie se déclenche — `champ.current` peut encore être nul, et
`focus()` sur `undefined` ne fait rien, silencieusement.

**Parade.** Un **effet** (`useEffect(..., [edition])`), qui s'exécute par
construction APRÈS le commit.

⚠️ **C'est le § 6.2 bis pris par l'autre bout** : là il fallait NE PAS attendre
l'effet (un geste rapide se termine avant), ici il faut l'attendre (le DOM
n'existe pas avant). La question à se poser n'est jamais « effet ou pas », c'est
**« qu'est-ce qui doit exister au moment où ce code tourne ? »**

**Comment on l'a payée.** Cartes mentales, 2026-09-07.

## 9.4 ⭐ Un `position: fixed` porté sur `document.body` passe SOUS un voile plus haut

**Symptôme.** Le sélecteur `@` s'ouvre, il contient les bons résultats, il est
positionné au bon endroit — **et on ne le voit pas**.

**Cause.** Il était porté sur `document.body` (`createPortal`) pour échapper au
`transform` de la scène. Il devenait donc un **frère** du voile plein écran de
l'éditeur. Le sélecteur est en `z-50`, le voile en `z-[75]` : à égalité de
parent, c'est le `z-index` qui tranche, et le sélecteur se peignait dessous.

**Parade.** Le rendre **DANS le calque** qui doit le couvrir, pas sur `body` —
à condition que ce calque n'ait pas de `transform` (celui-ci est un
`fixed inset-0`, donc son repère coïncide avec la fenêtre).

⚠️ **Les deux pièges sont opposés et il faut choisir en connaissance de cause** :
porter sur `body` échappe au `transform` d'un ancêtre mais fait perdre la
superposition ; rester dans le calque garde la superposition mais expose au
`transform`. **Regarder ce que l'ancêtre porte avant de trancher.**

**Comment on l'a payée.** Cartes mentales, 2026-09-07, vu à l'écran — et
diagnostiqué seulement après avoir vérifié en console que l'élément EXISTAIT
avec les bonnes coordonnées.

## 9.5 ⚠️ Le voile d'un plein écran s'arrête au bord du panneau qui le contient

**Symptôme.** Un éditeur « plein écran » ouvert depuis une note couvre la zone
de la note et **laisse la barre latérale allumée** à côté.

**Cause.** Encore le `transform` : un ancêtre animé (`animate-fade-up`) devient
le bloc conteneur de ses descendants `position: fixed`. `inset-0` ne veut alors
plus dire « la fenêtre », mais « cet ancêtre ».

**Parade.** `createPortal(…, document.body)`, comme le fait déjà `NoteComposer`
pour sa bulle de mise en forme et sa feuille de croquis.

**Comment on l'a payée.** Cartes mentales, 2026-09-07. ⚠️ **Et c'est la
troisième fois que ce dépôt paie ce piège** — il est écrit dans `CLAUDE.md`
depuis le 2026-07-21, avec le mot « portail obligatoire ». Le lire ne suffit
pas : le réflexe, en écrivant un composant plein écran, est de le rendre là où
on est. **Le geste qui l'attrape : ouvrir le composant et regarder si la barre
latérale est couverte.** Deux secondes.

## 9.6 ⚠️ Le panneau navigateur envoie « Entrée » avec un `key` VIDE

**Symptôme.** Un raccourci sur `Entrée` ne se déclenche jamais depuis
l'outillage, alors que le même code marche pour `Tab` et `Échap`. On croit à un
défaut du code et on le « corrige » — trois fois de suite.

**Cause.** Mesuré avec une sonde `keydown` : l'action `key: "Return"` du panneau
produit un événement dont `key` et `code` valent **la chaîne vide**. `Tab` rend
bien `key: "Tab"`. Aucun test `e.key === "Enter"` ne peut donc réussir.

**Parade.** Injecter un VRAI événement pour cette touche-là :

```js
document.activeElement.dispatchEvent(
  new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }),
);
```

Et, avant de conclure qu'un raccourci est cassé, **poser une sonde et lire ce
qui arrive vraiment** :

```js
window.addEventListener("keydown", (e) => console.log(e.key, e.code));
```

**Comment on l'a payée.** Cartes mentales, 2026-09-07 : trois diagnostics
successifs sur un code qui était juste.

## 9.7 ⚠️ Un `cd X && …` ne fait RIEN quand on est déjà dans X

**Symptôme.** Trois contrôles de suite affichent « tout va bien ». Aucun n'a
tourné.

**Cause.** `cd src-tauri && cp … && python …` lancé depuis un shell dont le
répertoire courant EST déjà `src-tauri`. Le `cd` échoue (« no such file or
directory »), et le `&&` fait sauter toute la suite. Le message d'erreur est une
seule ligne, noyée au milieu d'une sortie longue — et la commande **suivante**,
séparée par un retour à la ligne, s'exécute normalement et rend « ok ».

**Parade.** Chemins **absolus**, ou `cd` sur une ligne séparée dont on lit le
résultat. Et le geste général du chapitre 7 : **faire échouer le contrôle exprès
une fois.** Ici, casser le décodeur base64 volontairement a montré du premier
coup que les tests avaient des dents — et que la contre-épreuve précédente, elle,
n'avait jamais tourné.

**Comment on l'a payée.** Cartes mentales, 2026-09-07. Deux contre-épreuves et
une ligne de base Rust complète, toutes trois fantômes. **C'est le quatrième
exemplaire de « un contrôle qui ne peut pas échouer ne contrôle rien » dans ce
carnet** (§ 7, § 7.5 bis, § 7.5 quater, et celui-ci).

## 9.8 ⚠️ `pgrep -x Shale` ne peut PAS trouver l'app : le processus s'appelle `shale`

**Symptôme.** Avant de remplacer `/Applications/Shale.app`, on vérifie que l'app
n'est pas lancée. `pgrep -x Shale` ne rend rien, on conclut qu'elle est fermée —
et on fait un `rm -rf` sur un bundle **dont une instance tourne**.

**Cause.** Le binaire s'appelle `Contents/MacOS/shale`, en **minuscules** ; c'est
lui que voit le noyau. `pgrep -x` compare le nom du processus **exactement et en
respectant la casse**. `pgrep -x Shale` est donc un contrôle qui ne peut jamais
rendre « oui », quoi qu'il arrive.

**Parade.** Chercher le CHEMIN, pas un nom deviné :

```bash
pgrep -f '/Applications/Shale.app/Contents/MacOS/shale'
```

Et lire la ligne de commande de ce qu'on trouve (§ 8.2 bis) :
`ps -p <PID> -o command=`.

⚠️ **Et vérifier le contrôle lui-même** : ici, lancer l'app puis relancer le
`pgrep` aurait montré en dix secondes qu'il rend zéro dans les deux cas.

**Comment on l'a payée.** Cartes mentales, 2026-09-07, pendant l'installation :
le `rm -rf` a bien eu lieu sur un bundle en cours d'exécution. **Sans
conséquence** — macOS garde les inodes ouverts, le processus a continué, la base
est restée intacte (13 notes / 45 889 octets avant et après, `integrity_check`
ok) — mais c'était de la chance, pas une garantie. L'ancienne instance a ensuite
été refermée proprement par `osascript quit`, jamais par un `kill`.

⚠️ **Sixième exemplaire de « un contrôle qui ne peut pas échouer ne contrôle
rien »** dans ce carnet, et le deuxième de la même soirée. Les cinq autres :
§ 7 (les trois du 2026-09-06), § 9.7 (le `cd` qui saute), et le code de sortie
d'une tâche de fond, qui est celui de la DERNIÈRE commande — un `build ; tail`
rapporte le succès de `tail`.

## 9.9 ⚠️ Un `tauri ios build` lancé en tâche de fond se BLOQUE sur sa propre sortie

**Symptôme.** La compilation avance normalement pendant quelques minutes, puis
s'arrête net — sans erreur, sans message. `cargo` et `xcodebuild` sont toujours
là mais à **0 % de CPU**, et le fichier de log n'a plus bougé depuis des heures.
On croit à une compilation longue.

**Cause.** `tauri ios build` fait passer la sortie de `cargo` par `xcodebuild`,
qui la fait passer par le processus `tauri`, qui la fait passer par le shell.
Quand personne ne vide plus le tuyau à l'autre bout — un shell de tâche de fond
dont le lecteur s'est détaché — le tampon se remplit, et l'écrivain **bloque**.
Le processus n'est pas mort, il attend qu'on le lise, et il attendra
indéfiniment.

**Parade.** Guetter l'ARTEFACT et pas le processus (§ 1.2 bis) — mais surtout
**vérifier la CONSOMMATION CPU avant de conclure qu'une compilation est longue** :

```bash
ps -p <PID> -o %cpu=,command=
stat -f '%Sm' -t '%H:%M:%S' <le fichier de log>   # a-t-il encore bougé ?
```

Un `cargo` à 0 % qui n'écrit plus depuis dix minutes n'est pas en train de
compiler. Et pour relancer : rediriger vers un fichier **sans consommateur
intermédiaire**, et détacher proprement l'entrée (`</dev/null`).

⚠️ Avant de tuer quoi que ce soit : lire la ligne de commande ET remonter au
parent (§ 8.2 bis). Ici les trois PID à arrêter étaient bien `cargo`,
`xcodebuild` et le `node .../tauri ios build` qui les chapeautait — trois
processus nommés, jamais un `pkill` par motif.

**Comment on l'a payée.** Checkup du 2026-09-07 : environ quatre heures perdues
à croire qu'une compilation iOS était simplement longue.
