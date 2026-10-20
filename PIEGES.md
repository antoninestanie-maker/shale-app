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

### ⭐ Mise à jour du 2026-09-22 : il ne casse pas que `tsc`, il casse aussi DES TESTS

`tsc` n'est que la moitié visible. La PREMIÈRE ligne du patch vide
`SUPABASE_URL`, et **trois fichiers de tests s'appuient dessus** :

| Fichier | Ce qu'il devient, patch monté |
|---|---|
| `src/lib/licence/transport.test.ts` | 2 tests rouges |
| `src/lib/auth/activation.sql.test.ts` | ne se collecte même plus (`FAIL` d'entrée) |
| `src/lib/auth/admin.sql.test.ts` | idem |

**Vérifié dans les deux sens le 2026-09-22** : rouges avec le patch, `34 tests
passed` sans, sans toucher à une ligne de code. Une session qui rejoue `npm
test` en mode démo lit donc six fichiers en échec et part chercher une
régression qui n'existe pas — d'autant que les **tests de synchro (PGlite)
tombent en même temps**, mais pour une tout autre raison : ils durent 175 s
chacun et expirent sous la charge du serveur de dév resté allumé (§ 9.11).

**Parade, en un ordre.** ① Vérifier à l'écran avec le patch. ② **Le démonter.**
③ **Arrêter le serveur de dév.** ④ Seulement alors, rejouer la ligne de base.
Faire les quatre dans le désordre, c'est fabriquer six faux rouges.

⚠️ Et **ne jamais lire un résultat de tests à travers `| tail`** : le code de
sortie devient celui de `tail`, donc **toujours 0**. C'est ce qui a failli faire
prendre une suite à six échecs pour une suite verte — deux fois de suite.

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

## 7.2 quinquies ⭐⭐ Un test de traduction de clé étrangère peut être VACUEUX

**Symptôme.** On écrit un test « la clé étrangère est bien traduite d'un
appareil à l'autre », il passe, on est content. Il passe **aussi** quand on
retire la traduction.

**Cause.** Le test décalait les `id` en insérant une ligne sur l'appareil B…
mais la table visée (`object_types`) est peuplée par la MIGRATION, identiquement
sur les deux appareils. « Projet » avait donc le numéro 3 des deux côtés, et
l'arête pointait juste par accident. Le décalage était une intention, pas un
fait.

**Parade, en deux temps :**
1. décaler pour de vrai — créer la ligne visée sur A **après** avoir inséré des
   lignes de bourrage sur B, pour qu'elle reçoive des numéros différents ;
2. ⭐ **ASSERTER LE DÉCALAGE** (`expect(idB).not.toBe(idA)`). Sans cette
   assertion, le test redeviendra vacueux le jour où le nombre de lignes livrées
   par la migration changera — et personne ne le saura.

**Comment on l'a payée.** Fusion des sujets, 2026-09-07 : le test a été écrit,
il passait, et c'est en le faisant échouer volontairement (retrait de la ligne
de `fk.ts`) qu'on a vu qu'il ne prouvait rien. Le § 7.2 dit « un test qui passe
ne prouve rien tant qu'on ne l'a pas vu échouer » — c'est exactement ce cas, et
il avait déjà été écrit dans ce fichier.

## 7.9 ⭐ Une mesure de débordement qui ignore les conteneurs DÉFILANTS ment

**Symptôme.** Une sonde balaie les vues à 720 px et dénonce trois boutons
« hors écran, donc incliquables » dans la vue Position. On s'apprête à corriger
une mise en page qui n'a rien.

**Cause.** Les boutons vivaient dans un `div.overflow-x-auto` de 820 px de
contenu pour 540 px de large : ils sont **atteignables en faisant défiler le
tableau**, ce qui est précisément le patron `.table-scroll` que le dépôt
recommande. Comparer un `getBoundingClientRect()` à `innerWidth` ne distingue
pas « sorti du cadre et clippé » de « plus loin dans une zone qui défile ».

**Parade.** Avant de conclure, **remonter les ancêtres** et écarter l'élément
dès qu'un parent a `overflow-x: auto|scroll` ET `scrollWidth > clientWidth` :

```js
const defilable = (el) => { let p = el.parentElement;
  while (p && p !== document.documentElement) {
    const cs = getComputedStyle(p);
    if ((cs.overflowX === "auto" || cs.overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) return true;
    p = p.parentElement;
  } return false; };
```

**Comment on l'a payée.** Checkup du 2026-09-07 : quelques minutes, et l'envie
de « réparer » une vue saine.

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

**Parade la plus simple, mesurée le 2026-09-07 (barre d'outils des cartes)** :
écrire **`key: "Enter"`**, et non `key: "Return"`. Le panneau livre alors un
événement complet (`e.key === "Enter"`), et le raccourci se déclenche. C'est
`"Return"` — le nom macOS de la touche — qui n'est pas traduit et arrive vide.
Essayer les deux avant de conclure quoi que ce soit.

**Parade de secours**, si un nom de touche reste muet : injecter un VRAI
événement pour celle-là :

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

## 9.10 ⚠️⚠️ `simctl install` peut créer un NOUVEAU conteneur de données — et l'ancien disparaît

**Symptôme.** On réinstalle l'app sur le simulateur en s'appuyant sur une phrase
écrite noir sur blanc dans la documentation du dépôt : « `simctl install`
par-dessus l'app **préserve les données** (`shale.db` intact) ». Après
l'installation, l'app repart avec une base **neuve** — et l'ancienne, avec ce
qu'elle contenait, **n'existe plus sur le disque**.

**Cause.** iOS n'attache pas la base au *bundle identifier* seul : il provisionne
un **conteneur de données** par installation, sous
`…/Devices/<UDID>/data/Containers/Data/Application/<UUID>/`. Quand le bundle
installé change suffisamment — signature, build, provenance — le système en
alloue un **nouveau** et **retire l'ancien**. Mesuré : le conteneur est passé de
`D77D31BD-…` à `EA43202F-…`, et une recherche exhaustive de `shale.db` sur tout
le simulateur n'a plus rendu qu'un seul fichier.

**Parade — en trois mots : COPIER AVANT D'INSTALLER.**

```bash
SIMDB=$(find ~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Containers/Data/Application \
        -name 'shale.db' | head -1)
cp "$SIMDB" /un/endroit/sûr/shale-sim-$(date +%Y%m%d-%H%M).db
xcrun simctl install booted …
```

⚠️ **Et vérifier le conteneur APRÈS**, en comparant le chemin : s'il a changé,
la base d'avant n'est plus celle que l'app ouvre.

**Comment on l'a payée.** Checkup du 2026-09-07. Deux notes écrites sur le
simulateur et jamais synchronisées ont été détruites par la réinstallation :
une note vide, et une note du 2026-09-03 dont le corps disait
**« Mindmap dans notes »**. ⭐ **Rien n'a été perdu pour de bon** — le contenu
avait été LU et recopié dans `MOBILE.md` une demi-heure plus tôt, en comparant
les deux bases. Mais c'est un coup de chance, pas une méthode : la lecture avait
été faite pour établir un constat, pas pour se prémunir d'une destruction.

⚠️ **La phrase du § 5.1 de `PASSATION.md` est donc CORRIGÉE, pas effacée** :
`simctl install` préserve les données **parfois**, et rien ne prévient quand ce
n'est pas le cas. Le raisonnement « la doc dit que c'est sûr » a remplacé une
sauvegarde de dix secondes.

▶️ **La règle générale, qui dépasse le simulateur** : avant toute opération qui
remplace un binaire au-dessus d'une base — installation, restauration,
`ditto` — on copie la base. Ce carnet contient déjà deux entrées sur des preuves
détruites par un `rm -rf` (§ 7.5 bis) ; c'est la même faute, appliquée à des
données au lieu d'un artefact.

## 9.12 ⭐⭐ Les deux outils i18n au vert ne prouvent RIEN pour une valeur de table

**Symptôme.** `i18n:check` rend « 0 clé manquante » et `i18n:durs` « 0 chaîne
sûrement française ». L'app basculée en anglais affiche pourtant « Aller au
Calendrier », « Calendrier du jour » et « Vue d'ensemble : ce qui est chargé, ce
qui est libre. »

**Cause.** Ces chaînes ne sont pas écrites dans un appel `t("…")` : elles vivent
comme VALEURS dans une table (`ACTIONS`, `WIDGET_LABELS`, `DESCRIPTIONS` de la
sidebar, les vues du calendrier, `correlations.ts`) et sont traduites au point
d'affichage par `t(item.title)`. `i18n:check` ne peut pas les réclamer — il lit
les littéraux passés à `t()`. `i18n:durs` les VOIT (il les liste en
`[table] "…"`) mais ne dit pas si elles sont traduites : sa question est
« est-ce affiché sans `t()` ? », pas « est-ce traduit ? ».

**Parade, dans cet ordre :**
1. **la seule preuve** — basculer l'app en anglais et LIRE LE JOURNAL de `t()`,
   qui écrit en console `[i18n] traduction anglaise manquante : "…"`. Poser une
   sonde sur `console.warn` et parcourir les modules ramasse tout ;
2. **la version statique**, à rejouer après tout ajout de table : croiser les
   entrées `[table]` de `i18n:durs` avec les clés de `en.ts`.

⚠️ **Le corollaire, dans l'autre sens** : ne JAMAIS purger les clés de `en.ts`
« jamais référencées » d'après un scan textuel. Une clé dynamique
(`t(cat + "|palette")`) n'apparaît nulle part en toutes lettres, et l'effacer
fait retomber l'app anglaise en français **sans un mot**.

**Comment on l'a payée.** Checkup du 2026-09-07 : huit chaînes, sept venant du
chantier Calendrier du 2026-09-02 — cinq jours en production dans l'app
anglaise.

## 9.11 ⭐ L'« intermittence PGlite » a une cause MESURABLE : la charge machine

**Symptôme.** `npm test` échoue sur `sync/supabase.test.ts` avec
`Hook timed out in 60000ms` — dans le `beforeEach`, jamais sur une assertion. On
relance, ça passe, ou ça échoue ailleurs. Le dépôt appelle ça depuis longtemps
« intermittence connue sur les suites PGlite » et s'arrête là.

**Cause, mesurée le 2026-09-07.** Ce n'est pas du hasard, c'est de la
**contention**. Ces trois fichiers montent une instance Postgres COMPLÈTE dans
leur `beforeEach` ; sur une machine chargée, le hook n'obtient pas le processeur
dans les 60 s et rend la main. Deux exécutions de la MÊME suite, même code :

| Charge (`uptime`, 1 min) | Mémoire libre | Durée | Résultat |
|---|---|---|---|
| **37** | **65 Mo** | **1 416 s** | 2 échecs |
| **7** | 830 Mo | **16,8 s** | **17 / 17** |

**Un facteur 84 sur la durée, et le rouge disparaît.**

**Ce qui chargeait la machine, et c'est le vrai enseignement** : le **panneau du
simulateur iOS laissé attaché**. Il fait tourner deux encodeurs `VideoToolbox`
en permanence pour diffuser l'écran. À eux seuls ils prenaient plus de 12 % de
processeur, en plus du simulateur lui-même.

**Parade.**
1. **Avant de lancer la ligne de base : `uptime`.** Au-dessus de ~10 de charge,
   un rouge PGlite ne veut rien dire — ni dans un sens ni dans l'autre.
2. **Détacher le panneau du simulateur** (`detach`) et **éteindre le simulateur**
   (`simctl shutdown`) dès qu'on n'en a plus besoin. Ce n'est pas de l'hygiène,
   c'est ce qui fait la différence entre 17 s et 24 minutes.
3. Et le geste déjà écrit dans `PASSATION.md` : **capturer le nom du test AVANT
   de relancer**. Ici il a servi — le nom montrait un `beforeEach`, donc un
   problème d'environnement, pas une assertion fausse.

⚠️ **Ne pas augmenter le `hookTimeout` pour faire taire le symptôme.** Il est
déjà à 60 s, six fois la valeur par défaut. Le porter plus haut rendrait la
suite encore plus lente sans rien réparer, et masquerait le jour où le hook
échoue pour une VRAIE raison.

**Comment on l'a payée.** Checkup du 2026-09-07 : environ quarante minutes à
soupçonner une régression de mes propres modifications, alors que la seule chose
qui avait changé était la charge de la machine.

### ⭐ Mise à jour du 2026-09-22 : la suite se charge elle-même, maintenant

La suite est passée de **683 à 1278 tests** en quinze jours. Vitest lance les 92
fichiers en parallèle — donc **plusieurs Postgres complets à la fois** — et c'est
désormais la suite qui produit la contention, sans aucun simulateur, sans aucun
panneau attaché. Mesuré le 2026-09-22, même code, même machine :

| Comment | Durée | Résultat |
|---|---|---|
| Les trois fichiers de synchro **seuls** | 1 007 s | **58 / 58** |
| Les mêmes **dans `npm test` complet** | 3 633 s pour `supabase.test.ts` seul | 10 échecs, **tous des expirations** |

Un test à 30 s de plafond qui met **971 894 ms** au compteur ne dit rien sur le
code : il dit que le processus n'a pas eu le processeur. ⚠️ Et **les tests qui
tombent CHANGENT d'une exécution à l'autre** (`conflits` puis `volume` dans
`engine.test.ts`, deux fois deux tests différents dans `supabase.test.ts`) —
c'est la signature d'une contention, jamais celle d'une régression.

**Parade, en plus des trois ci-dessus.** Quand les rouges sont **tous** dans
`sync/` et **tous** des `timed out`, **rejouer ces fichiers SEULS** avant de
soupçonner quoi que ce soit. S'ils passent, la suite est verte — le dire
comme ça, plutôt que d'annoncer un faux rouge ou, pire, de le taire.

## 9.13 ⭐⭐ Déduire d'un RANG une propriété visible, c'est signer une réorganisation à chaque insertion

**Symptôme.** L'utilisateur signale que l'ajout d'un élément « l'envoie un coup
à gauche, un coup à droite ». On regarde le nouvel élément — il est correct. Ce
qui est faux, ce sont les AUTRES : ils ont bougé.

**Cause.** Une propriété visible et durable — un côté, une couleur, une colonne,
une voie — était CALCULÉE à partir de l'index dans une liste
(`rang % 2`, `rang % COULEURS.length`). Insérer au milieu décale tous les rangs
suivants, donc **repeint et redéplace tout ce qui suit**. Le calcul n'est jamais
faux ; il est juste recalculé pour des éléments auxquels personne n'a touché.
Mesuré sur les cartes mentales de Shale, le 2026-09-08 : sur trois branches,
`⌘Entrée` sur la première **en déplaçait deux et en repeignait deux**.

**Parade.** Une propriété que l'utilisateur VOIT et considère comme acquise doit
être **posée sur l'objet**, pas dérivée de sa position. La règle de répartition
ne disparaît pas : elle se déplace du rendu vers la CRÉATION (« la nouvelle va
du côté le moins chargé »), ce qui donne exactement la même silhouette sans
jamais toucher à l'existant. Deux précautions vont avec :

1. **Inscrire le champ à la lecture** pour ce qui a été écrit avant lui, d'après
   l'ancienne règle — sinon le remède déplace lui-même, une bonne fois, tout ce
   qui existait déjà. Le rendre facultatif garde la relecture par une version
   antérieure de l'app possible.
2. **Rendre le geste explicite**, parce qu'on vient de le retirer sans le dire.
   Tant que le côté se déduisait du rang, réordonner suffisait à faire traverser
   la carte à une branche. Figer la propriété sans offrir « changer de côté »
   enlève une capacité que l'utilisateur avait, même s'il l'avait par accident.

**Le test qui l'attrape**, et qui vaut pour toute la famille : relever la
propriété de tous les éléments AVANT, insérer au milieu, et **exiger qu'aucun de
ceux d'avant n'ait changé**. Il ne coûte rien et il échoue franchement — vérifié
en le rejouant contre le code d'avant.

**Comment on l'a payée.** Rien, cette fois : Antonin l'a vu à l'œil nu et a
demandé si c'était normal. Le vrai coût est celui qu'on n'a pas payé — le défaut
vivait depuis la création du module, il ne mordait qu'à l'insertion au milieu,
et aucun test ne le regardait.

## 9.14 ⚠️ `.claude/launch.json` existe DÉJÀ et il est suivi par git — ne pas l'écraser

**Symptôme.** On crée un `.claude/launch.json` pour ouvrir l'aperçu, on le
retire proprement à la fin… et `git status` annonce
`D .claude/launch.json`. On vient d'effacer un fichier **suivi**, écrit par
quelqu'un d'autre. Pris sur le fait le 2026-09-08, rattrapé avant le `push`.

**Cause.** Deux dossiers `.claude/` cohabitent, et ils ne servent pas la même
chose :

- `Shale/.claude/launch.json` — **suivi par git**, deux entrées `vite` et
  `vite-preview` (ports 1420 / 1430). C'est du dépôt.
- `<racine de travail>/.claude/launch.json` — **c'est celui que `preview_start`
  lit**, à la racine du répertoire de travail principal, PAS dans `Shale/`.
  L'erreur du serveur donne d'ailleurs le chemin exact qu'il attend.

**Parade.** Écrire l'entrée d'attache dans le `.claude/` de la **racine de
travail**, et à la fin ne retirer QUE ce fichier-là, en vérifiant que
`git status` ne montre aucun `D`. Plus généralement : **regarder ce qu'on
supprime avant de le supprimer** — un `rm` sur un chemin qu'on croit être le
sien coûte le fichier de quelqu'un d'autre.

⚠️ Et vérifier la liste que `git add -A` s'apprête à emporter : la même session
a failli committer un `src-tauri/migrations/023_facturation.sql` non suivi,
posé dans l'intervalle par une session voisine. **`git status --short` avant le
commit, pas après.**

## 9.15 ⭐⭐ Un seuil de comparaison FIXE ment dès qu'un montant peut être négatif

**Trouvé à l'écran le 2026-09-10**, pendant le chantier facturation, et il a
fallu DEUX corrections parce que la première a créé un second défaut.

`statutCalcule` décidait qu'une facture est soldée avec `reste <= 0`, ce qui est
juste — un trop-perçu solde la facture, et l'égalité stricte l'aurait laissée
« partiellement encaissée » pour toujours.

Sauf qu'un **AVOIR porte un total NÉGATIF**. Son reste dû vaut −1 500 € tant que
rien n'a été remboursé : `reste <= 0` est donc vrai **d'emblée**, et l'avoir
s'affichait « Encaissée » alors que personne n'avait rien versé.

▶️ **La règle : un document est soldé quand son reste a atteint zéro EN VENANT
DU CÔTÉ de son total**, pas quand il est passé sous une borne fixe.

```ts
const solde = total > 0 ? reste <= 0 : reste >= 0;   // et non `reste <= 0`
```

### ⚠️ Et la correction évidente de la correction était fausse aussi

En réparant ça, j'ai passé l'exigibilité de `reste > 0` à `reste !== 0`, par
symétrie. L'écran l'a démenti immédiatement : l'avoir affichait **« En retard de
58 jours »** et comptait dans « 2 documents en retard ».

Or le retard sert à décider s'il faut **RELANCER** quelqu'un — et on ne relance
pas un client pour un avoir qu'on lui doit. Un reste dû négatif est de l'argent
qui part, pas une créance à recouvrer. Retour à `reste > 0`, ce que le cadrage
disait depuis le début.

**La leçon générale : une symétrie mathématique n'est pas une symétrie
métier.** Les deux corrections portaient sur la même donnée, et une seule des
deux devait être symétrique.

## 9.16 ⚠️ Le dépôt substitue `{n}`, PAS `%n` — et `i18n:check` ne le voit pas

`t()` remplace `{n}` (`out.split('{'+k+'}')`), et `tp(n, une, autre)` passe la
variable à `t()`. Une clé écrite avec `%n` **existe** dans `en.ts`, donc
`i18n:check` est au vert — et l'écran affiche littéralement
« **%n documents en retard** ».

Constaté sur 22 clés d'un coup. Le seul contrôle qui l'attrape est de
**regarder l'écran**.

## 9.17 ⭐⭐ Croiser les valeurs de table avec `en.ts` : sur la CLÉ EXACTE, jamais par `includes`

Le § 9.12 dit déjà que les deux outils i18n ne prouvent rien pour une valeur de
table. Le piège suivant est dans la **vérification elle-même**.

J'ai croisé mes tables avec `en.includes("Tous")` → vert. L'app anglaise
affichait quand même « Tous ». La raison : `en.ts` contient
`"Tous les clients": …`, dont la sous-chaîne « Tous » satisfait `includes`.

▶️ **Chercher la clé sous sa forme d'entrée d'objet** :

```js
en.includes("\n  " + JSON.stringify(cle) + ":")   // et non en.includes(cle)
```

Avec le bon test, 17 des 20 chaînes que je croyais traduites ne l'étaient pas.

### Et « mois » est invariable en français, pas en anglais

`"mois": "month"` existait déjà, au singulier, et servait ailleurs. Affiché
derrière un nombre, il donnait « **9.3 month** ». Deux clés désambiguïsées par
le suffixe `|` de `t()` (`"mois|un"`, `"mois|plusieurs"`) règlent le cas sans
toucher à la clé partagée.

## 9.18 ⚠️ Chercher une chaîne dans les OCTETS d'un PDF ne prouve rien

pdf-lib écrit par défaut des **object streams**, qui sont compressés. Chercher
`factur-x.xml` dans le PDF rend `false` **alors que la pièce jointe est bien
là**. Mesuré dans les deux modes : trouvée avec `useObjectStreams: false`,
introuvable avec le défaut.

▶️ Interroger le **catalogue** (`Names` → `EmbeddedFiles`), pas le texte.

⚠️ Au passage : `dict.lookup(clé, Type)` **LÈVE** quand la clé est absente.
Pour une question dont la réponse peut être « il n'y en a pas » — un devis, qui
n'a légitimement aucune pièce jointe — c'est **`lookupMaybe`** qu'il faut.

## 9.19 ⚠️ Les polices standard d'un PDF sont en WinAnsi : un caractère hors jeu fait LEVER

`StandardFonts.Helvetica` ne couvre pas l'Unicode. Un idéogramme, un emoji — ou
simplement le signe **€** — dans une raison sociale fait lever `drawText`,
c'est-à-dire **au moment de l'émission**, sur un document que l'utilisateur
croyait prêt.

▶️ **Assainir plutôt qu'échouer** : tiret cadratin → tiret, apostrophe
typographique → droite, € → « EUR », inconnu → `?`. Incorporer une police
complète réglerait le fond mais ajouterait ~300 ko à chaque PDF.

## 9.20 ⭐ Ne pas inventer la forme d'un type : la lire, ou appeler son constructeur

En testant les relances, j'ai écrit à la main un `ProfilDisponibilite`
plausible — `{ appris, parJour, debutMedian, finMediane, sessions }`. Le vrai
type porte `minutes`, `totauxParJour`, `sessions`, `appris` et `repli`. Le test
échouait sur `Cannot read properties of undefined (reading 'fin')`, très loin de
la cause.

▶️ `profilDisponibilite([])` construit le repli documenté en un appel. **Un
objet littéral inventé dans un test est une seconde définition du type**, et
elle diverge dès la première évolution.

## 9.21 ⚠️ Un compteur de série ne se compare qu'à SES propres numéros

`compteursEnRetard` cherchait le plus grand numéro déjà émis pour dire si le
compteur d'une série était en retard. Il comptait aussi les factures
d'**ACHAT** — dont le numéro vient du **fournisseur**. Un « FA-2291 » reçu d'un
imprimeur faisait croire que ma série F était en retard de 2 285 numéros.

▶️ Ce que je numérote et ce que je reçois n'appartiennent pas à la même suite.
Trouvé par le test de cohérence de la démo, pas par la lecture.
# 10. Chantier « premier démarrage » (2026-09-10)

## 10.1 ⭐⭐ Insérer un `import` « après le dernier `import` » tombe DANS un `import type { … }`

**Symptôme.** Un script d'édition ajoute une ligne d'import en cherchant la
dernière ligne qui commence par `import `. Le fichier ne compile plus, et
`tsc` sort des `TS1003: Identifier expected` sur une ligne qu'on n'a pas
touchée.

**Cause.** Un import **multi-lignes** commence par `import type {` et se
poursuit sur dix lignes qui, elles, ne commencent PAS par `import`. La
« dernière ligne d'import » est donc l'OUVERTURE du dernier bloc, et l'insertion
se fait entre l'accolade et son premier membre :

```ts
import type {
import { sansExemples } from "./onboarding/exemples";   // ← ici
  Completion,
```

**Parade.** Ne jamais viser « la dernière ligne d'import » : viser une **ancre
textuelle unique et refermée** (`} from "../lib/types";`, ou la ligne d'import
précise qu'on connaît). Et **relancer `tsc` après CHAQUE fichier patché par
script**, pas après la série : deux fichiers cassés se lisent beaucoup moins
bien qu'un seul.

**Comment on l'a payée.** Deux fois dans la même heure, le 2026-09-10 —
`lib/logic.ts` puis `views/KnowledgeView.tsx`. La seconde alors que la première
venait d'être corrigée : la parade n'avait pas été écrite, seulement appliquée.

## 10.2 ⭐ Ajouter un champ OBLIGATOIRE à un type partagé : `tsc` passe, `test:types` tombe

**Symptôme.** On ajoute `is_example: number` à `Task`, on corrige les erreurs
que `npx tsc --noEmit` signale, tout est vert. `npm run test:types` échoue
ensuite sur trois fabriques de tests jamais ouvertes.

**Cause.** Les `*.test.ts` ne compilent que sous `tsconfig.test.json` — ils sont
hors du programme de `tsc`. Or c'est précisément là que vivent les fabriques
`const tache = (p: Partial<Task> = {}): Task => ({ … })`, qui doivent fournir
CHAQUE champ obligatoire.

**Parade.** Après tout ajout d'un champ obligatoire à un type de `lib/types.ts`,
**jouer les deux** immédiatement. `PASSATION.md` le dit déjà en général ; ce qui
est nouveau ici, c'est le déclencheur : *un champ obligatoire de plus = des
fabriques de test à compléter*. Chercher `): Task => ({`, `): Habit => ({`, etc.

**Comment on l'a payée.** 2026-09-10 : découvert par la ligne de base complète,
après que `tsc` seul eut donné une fausse assurance pendant une demi-heure.

## 10.3 ⭐ Un compteur lu HORS de `AppData` reste figé après une écriture

**Symptôme.** L'accueil du premier démarrage sème son contenu d'exemple, puis
rend la main. Le bandeau « supprimer les 4 exemples » **n'apparaît pas**. Il
apparaît au démarrage SUIVANT — c'est-à-dire jamais au moment qui compte.

**Cause.** Le compte se lit en base (`compterExemples()`) et non dans `AppData`,
parce qu'une des quatre tables — les fiches du Savoir — n'y est pas. Le
composant le lisait donc dans un `useEffect(…, [])`, qui ne se rejoue jamais.
`refresh()` renouvelle `data` ; il ne dit rien à qui n'en dépend pas.

**Parade.** Tout composant qui lit la base **à côté** d'`AppData` doit recevoir
un signal de fraîcheur — l'objet `data` lui-même fait très bien l'affaire, il
est recréé à chaque `refresh()`. Le mettre dans les dépendances de l'effet.

⚠️ Le corollaire est plus large : **`refresh()` n'est pas un rafraîchissement
global de l'écran**, c'est une relecture d'`AppData`. Ce qui vit en dehors ne
bouge pas.

**Comment on l'a payée.** 2026-09-10, vu en mode démo. Aucun test ne pouvait
l'attraper : il n'y a pas de test de rendu React dans ce dépôt (§ 7.1).

## 10.4 ⚠️ Un contrôle i18n joué AVANT la dernière modification ne prouve rien

**Symptôme.** `npm run i18n:check` rend « 0 clé manquante ». Vingt minutes plus
tard, l'app basculée en anglais affiche un paragraphe entier en français.

**Cause.** Le texte fautif a été écrit APRÈS le contrôle. L'outil ne ment pas :
il décrit l'état du dépôt à l'instant où on l'a lancé, et c'est tout.

**Parade.** Les deux contrôles i18n se jouent **en dernier**, avec la ligne de
base, jamais au milieu du chantier. Et la preuve finale reste la même :
**basculer l'app en anglais et regarder** (`localStorage.setItem("shale.lang","en")`).
C'est comme cela que ce défaut-ci a été vu, pas par l'outil.

**Comment on l'a payée.** 2026-09-10 : le texte de bienvenue par défaut
(`appTexts.ts`) réécrit après le contrôle, donc jamais traduit.

## 10.5 ⚠️ Supprimer un LOT d'objets laisse leur contenant vide derrière

**Symptôme.** On clique « supprimer les 4 exemples ». Les quatre objets
disparaissent — et le sujet « Méthode » du Savoir reste dans la grille, vide,
créé par l'app, alors que le bouton vient d'annoncer le contraire.

**Cause.** Le contenant n'était pas marqué, sur le raisonnement — juste — qu'un
sujet peut recevoir des fiches de l'utilisateur et qu'on ne doit pas les
emporter. Le raisonnement était bon, la conclusion trop courte : il fallait
marquer le contenant ET conditionner sa suppression à ce qu'il soit **resté
vide**, pas renoncer à le supprimer.

**Parade.** Pour tout lot d'objets créé par l'app, se demander **ce qui les
contient**, et lui appliquer la règle « je pars si je suis vide ». Un bouton qui
tient sa promesse à quatre objets sur cinq se lit comme un défaut, pas comme une
nuance.

**Comment on l'a payée.** 2026-09-10, vu à l'écran en mode démo — jamais par un
test, puisque le test vérifiait exactement ce que le code faisait.

## 10.6 ⚠️⚠️ `/Applications/Shale.app` peut être REMPLACÉE pendant `tauri build`, sans `ditto`

**Symptôme.** On relève l'empreinte de l'app installée AVANT le build (§ 7.5 bis
l'exige), on lance `npm run tauri build`, et au moment d'installer on trouve
`/Applications/Shale.app` **déjà remplacée par le bundle neuf** : même sha256
que la sortie de build, et tout le contenu du bundle horodaté à la seconde du
binaire. Aucun `ditto`, aucun `cp` n'a été lancé.

**Mesuré le 2026-09-10.** Avant : `1307bfa2…`, mtime 2026-09-08 21:13:13. Après
le build : `35198bea…`, et `Contents/`, `Info.plist`, `MacOS/`, `Resources/`
tous à 10:46:10 — l'horodatage exact du binaire produit. `diff -r` entre l'app
installée et `target/release/bundle/macos/Shale.app` rend **identiques, fichier
par fichier**.

**Cause : INDÉTERMINÉE au moment d'écrire.** Ce qui avait été éliminé, mesures à
l'appui : ce n'est pas un lien symbolique (`readlink` échoue, et les inodes
diffèrent — 41902400 contre 41902233) ; il n'y a **aucun**
`beforeBuildCommand`/hook d'installation dans `package.json` ni
`tauri.conf.json` (`grep -rn "/Applications"` sur les scripts et la config rend
zéro) ; aucun hook git ; aucune image disque de Shale montée (les deux montées
sont les runtimes de simulateur d'Apple) ; et le journal unifié ne garde aucune
trace sur la fenêtre concernée.

### ⭐⭐ MIS À JOUR LE 2026-09-11 — l'outillage est HORS DE CAUSE, et le build est REPRODUCTIBLE

Le lendemain, un second build a été lancé **avec une surveillance armée sur
l'empreinte de `/Applications/Shale.app`**, interrogée toutes les cinq secondes
pendant toute la compilation. Résultat : **elle n'a jamais bougé.** Build
terminé (code de sortie 0, `Shale.app` et le DMG produits), et l'app installée
toujours à `35198bea…`, mtime **2026-09-10 10:46:10** — inchangée.

▶️ **`tauri build` ne copie donc RIEN dans `/Applications`.** L'hypothèse d'un
outillage qui installerait à notre insu est éliminée par la mesure, pas par le
raisonnement. Reste l'explication qui colle à tout le reste et qu'on ne peut pas
prouver d'ici : **un geste humain** — une installation depuis le DMG, qui
préserve les mtimes de la source et expliquerait aussi la fenêtre de trousseau
apparue à 10:48. Écrit comme hypothèse, pas comme fait.

⭐ **Et une découverte qui vaut pour tous les futurs builds : le profil `release`
de ce dépôt est REPRODUCTIBLE.** Deux builds d'un même contenu, à trente-sept
heures d'intervalle, ont produit **exactement le même binaire** — `35198bea…`
des deux côtés, et `diff -r` entre l'app installée et la sortie neuve rend
« identiques, fichier par fichier ».

⚠️ Ce que cela change concrètement, et c'est une bonne nouvelle pour Antonin :
**reconstruire sans avoir changé le code ne déclenche AUCUNE fenêtre de
trousseau**, puisque le binaire est identique et que macOS n'attache ses
autorisations qu'à la signature. Vérifié le 2026-09-11 : aucun `SecurityAgent`
après relance.

⚠️ Le revers, à ne pas oublier : **quand deux empreintes sont identiques avant la
copie, aucune comparaison d'après ne prouve quoi que ce soit** — ni que la copie
a eu lieu, ni qu'elle a échoué. Il faut alors prouver par le CONTENU (`diff -r`,
témoins Rust dans le binaire installé) et dire franchement qu'on n'a rien
installé, parce qu'il n'y avait rien à installer.

**Parade.** ⚠️ **Ne pas supposer que `/Applications` est intacte pendant un
build.** Concrètement :

1. relever l'empreinte AVANT, comme le § 7.5 bis le dit déjà — c'est ce qui a
   permis de VOIR le remplacement ;
2. **re-relever l'empreinte de l'installée juste avant de copier**, et si elle
   est déjà celle de la source, ne pas conclure « ma copie a marché » : rien n'a
   été copié, et la comparaison d'après n'a plus aucune valeur probante (elle
   rend « identique » dans les deux cas) ;
3. prouver l'installation par le **CONTENU** — `diff -r` du bundle entier, et
   les témoins Rust dans le binaire installé — jamais par le seul fait qu'une
   commande de copie a rendu 0.

**Comment on l'a payée.** Chantier « premier démarrage », 2026-09-10 : dix
minutes d'enquête, et surtout le risque d'écrire « installé et prouvé » pour un
geste qu'on n'a pas fait. Le dépôt a déjà une entrée sur un build qui n'emportait
pas ce qu'on croyait (§ 7.5 bis) ; celle-ci est la symétrique — une installation
qu'on n'a pas faite et qu'on aurait pu s'attribuer.

---

### ⚠️ 2026-10-12 — troisième constat, cette fois avec un échec de l'étape DMG

Build de 22:20 (`07a4d07`). Faits, sans interprétation :
- `npm run tauri build` rend **code 1** : `failed to run …/bundle_dmg.sh`. Le `.app` était produit (22:22:15).
- À la première lecture d'empreinte après le build (≈ 22:23), `/Applications/Shale.app` valait DÉJÀ `287ecb47…`, celle du bundle — inode différent, dates de création et de modification à la seconde du bundle, `diff -r` identique. **Aucun `ditto` de la session.**
- Aucun processus Shale ne tournait ; la base était fermée proprement (ni `-wal` ni `-shm`), modifiée à 22:22.
- L'image `/Volumes/dmg.DTRHA0` était restée montée, avec `Shale.app` et le lien `Applications → /Applications` ; `rw.*.dmg` laissé dans `bundle/macos/`.
- Aucune autre session n'a écrit au carnet dans la minute.

**Ce que ça ajoute.** Les deux fois où l'app a été remplacée « toute seule » (10/09, 12/10), une fenêtre de DMG s'ouvre dans le Finder pendant le build, et Antonin était devant son Mac. L'hypothèse du geste humain (glisser l'app sur « Applications » dans cette fenêtre) colle à ces faits ; elle n'est toujours PAS prouvée. Si c'est cela, l'échec du script s'expliquerait aussi (volume occupé).

**Parade, en attendant de savoir.** Après un build : lire l'empreinte installée AVANT `ditto` ; si elle vaut déjà celle du bundle, ne pas recopier, vérifier `diff -r`, vérifier qu'aucune ancienne instance ne tourne, relancer. Toujours `mount | grep dmg` puis `hdiutil detach` : une image restée montée fait échouer le DMG du build suivant. ⚠️ `sqlite3 -readonly` échoue (erreur 14) sur la base quand l'app est fermée (WAL sans `-shm`) : lire par `file:…?immutable=1`.

# 11. Chantier « icône iOS et transition d'entrée » (2026-09-11 / 12)

## 11.1 ⚠️⚠️ Un commentaire XML qui contient `--` casse le build iOS, et le message est enterré

**Le fait.** J'ai écrit le nom du token de fond du design system, avec ses deux
tirets, dans un commentaire de `gen/apple/LaunchScreen.storyboard`. XML interdit
le double tiret dans un commentaire. `ibtool` refuse, `xcodebuild` rend 65, et
le build iOS échoue.

**Pourquoi ça coûte cher.** Le message utile —
`error: Line 33: Comment must not contain '--' (double-hyphen)` — arrive **au
bout d'un build complet**, noyé sous une page de lignes de commande `actool` et
`swiftc`. Et **rien d'autre ne l'attrape** : ni `tsc`, ni `npm test`, ni
`cargo check`, ni `i18n:check`. Le pipeline est vert et le build est mort.

**Parade.** Après toute modification d'un `.storyboard` ou d'un `.xib`, compiler
le fichier SEUL avant de lancer le build complet — c'est deux secondes :

```
xcrun ibtool --errors --warnings --notices --output-format human-readable-text \
  --compile /tmp/sb-out/LaunchScreen.storyboardc \
  src-tauri/gen/apple/LaunchScreen.storyboard
```

Et, en écrivant le commentaire, nommer les tokens sans leurs tirets
(« le token `color-bg` » plutôt que la forme CSS complète).

## 11.2 ⚠️⚠️ `tauri icon` ne touche PAS le catalogue d'assets iOS

**Le fait.** Mesuré dans un worktree jetable le 2026-09-10 :
`npm run tauri icon` régénère les 18 PNG de `src-tauri/icons/ios/` et ne modifie
**pas un octet** de `src-tauri/gen/apple/Assets.xcassets/`. Or c'est le catalogue
que le build compile, et lui seul qu'iOS lit.

On peut donc « régénérer l'icône », voir 18 fichiers réécrits, committer, et
n'avoir rien changé du tout à l'écran d'accueil.

**Deuxième moitié du piège.** La commande écrase AUSSI macOS, Windows et
Android. Et ce qui est juste pour iOS est FAUX pour macOS : iOS applique son
propre masque et veut une source pleine cadre, macOS n'en applique aucun et
attend que l'icône dessine sa plaque et sa marge. Une source unique pour les
deux est une erreur de conception, pas un raccourci.

**Parade.** Les icônes iOS ne passent plus par `tauri icon`. `tools/icone-ios.mjs`
écrit les trois variantes directement dans le catalogue, et ne touche à rien
d'autre. `src-tauri/icons/` reste la source du bureau.

## 11.3 ⚠️ Sur iOS 26, l'icône ne suit PAS l'apparence du système

**Le fait.** Vérifié sur simulateur : téléphone en apparence **sombre**, style
d'icônes « Par défaut » → c'est la variante CLAIRE qui s'affiche. Les icônes
d'Apple elles-mêmes ne basculent pas.

L'icône suit le **style d'icônes choisi par l'utilisateur** — Écran d'accueil →
maintien long → `+` → **Personnaliser** → « Par défaut / Sombre / Transparent /
Teinté ». La variante sombre n'apparaît qu'avec le style « Sombre », qui a
lui-même un sous-choix « Toujours / Automatique » ; c'est ce dernier, et lui
seul, qui suit l'apparence système.

⚠️ Corollaire pour les captures : `xcrun simctl ui <udid> appearance dark` ne
suffit pas à photographier la variante sombre. Il faut passer par ce menu.
Et il n'y a **pas** de réglage correspondant dans les Réglages du simulateur
(pas de section « Affichage et luminosité »).

## 11.4 ⚠️⚠️ Un `animationend` ne remonte qu'à ses ANCÊTRES — un gestionnaire sur un frère n'entend rien

**Le fait.** La copie animée de la marque est la **sœur** du voile, et non son
enfant : il le faut, sinon le `z-index: 200` du voile l'enfermerait dans son
contexte d'empilement et elle passerait sous l'app. Le `onAnimationEnd` posé sur
le voile ne recevait donc jamais les `animationend` de la copie.

**Le symptôme est trompeur** : la machine à états reste dans son premier temps
et n'en sort qu'au minuteur de sécurité. À l'écran, ça ressemble à « l'animation
ne joue pas », alors qu'elle joue très bien — c'est l'ÉCOUTE qui manque.

**Parade.** Chaque élément qui porte une animation dont la machine dépend porte
aussi son propre gestionnaire. Et le dire dans le code, parce que ça ressemble à
une redondance.

## 11.5 ⭐⭐ Un temps animé sur un élément CONDITIONNEL est une machine qui se bloque

**Le fait.** Le premier temps de la transition d'entrée n'était animé que sur
`.entree-part`, c'est-à-dire sur le formulaire de connexion. À l'ouverture **à
froid**, il n'y a pas de formulaire : aucun élément ne portait l'animation,
`animationend` n'arrivait jamais, la machine restait bloquée 2 515 ms — jusqu'au
minuteur de sécurité.

Relevé dans l'app : `2936 poser` → `5451 done`, pour une animation de 200 ms.

**La règle.** Une machine à états pilotée par `animationend` doit poser son
horloge sur un élément qui existe dans **tous** les cas de figure. Si le temps ne
doit rien changer visuellement, une animation qui ne change rien fait très bien
l'affaire — son seul travail est de FINIR.

**Pourquoi les tests de la machine ne l'attrapent pas.** La machine était juste.
C'est le CÂBLAGE entre le CSS et elle qui était faux. Il faut un test de
CONCORDANCE, qui lit le CSS et le composant et vérifie que chaque temps a une
horloge : `src/lib/entree/temps.test.ts`.

## 11.6 ⚠️ Le panneau navigateur caché ne rend AUCUNE animation, et son viewport vaut 0×0

**Le fait.** Quand le panneau (`mcp__Claude_Browser__*`) n'est pas affiché —
son état normal pendant qu'on travaille dans le terminal :

- `document.hidden === true` ;
- **zéro `requestAnimationFrame` en 300 ms** ;
- les animations CSS restent `playState: "running"` avec un `currentTime`
  bloqué à **0**, indéfiniment, et n'émettent jamais `animationend` ;
- `window.innerWidth` et `innerHeight` valent **0** — donc tout
  `getBoundingClientRect` lu est du bruit (relevé : une marque à `y = -1711`).

`tabs_select` ne corrige rien : il met un onglet au premier plan **dans** le
panneau, il n'ouvre pas le panneau.

**Parade.** Pour vérifier une animation, utiliser le **simulateur iOS**, qui
rend pour de vrai : rafale de `xcrun simctl io <udid> screenshot` (≈ 280 ms par
image) puis diff image par image sur une vignette pour trouver où ça bouge.

⚠️ Et pour lire l'état interne côté iOS, où il n'y a pas de console
(MOBILE.md § 14.1) : écrire un journal dans `localStorage`, puis le relire hors
de l'app dans
`…/Devices/<UDID>/data/Containers/Data/Application/*/Library/WebKit/com.atnfx.shale/WebsiteData/Default/*/*/LocalStorage/localstorage.sqlite3`.
Les valeurs y sont en **UTF-16 LE** : `sqlite3` en ligne de commande n'en montre
qu'un caractère sur deux, il faut décoder en Python.

## 11.7 ⚠️ `git rm` laisse ses suppressions DANS L'INDEX, et le commit suivant les emporte

**Le fait.** J'ai supprimé les 18 anciennes icônes avec `git rm` pendant la
phase A, puis committé la phase B avec `git add <fichiers de B>` suivi de
`git commit`. `git commit` sans `-a` valide **l'index**, qui contenait encore
les 18 suppressions : le commit de la phase B a emporté du travail de la phase A.

Pire que le mélange : le dépôt passait par un état où `Contents.json` citait des
fichiers supprimés — **un commit qui ne construit pas**.

**Parade.** Avant tout commit partiel, lire `git diff --cached --stat` et
vérifier que la liste est exactement celle qu'on croit. `git status --short`
seul ne suffit pas : une suppression déjà indexée n'y saute pas aux yeux.

## 11.8 ⭐ `transform-box: fill-box` fait grossir chaque forme SVG autour de SON centre

**Le fait.** Pour que les quatre strates de la marque se décollent, elles doivent
grossir autour d'un centre **commun**. Avec `transform-box: fill-box` (ou par
défaut sur certaines formes), chacune grossit autour du sien : elles
s'épaississent sur place, la parallaxe disparaît, et le rendu reste plausible —
donc le défaut passe la revue.

**Parade.** `transform-box: view-box` avec `transform-origin: center` : l'origine
devient le centre du `viewBox`, partagé par toutes les formes.

---

# 12. Chantier « profils de licence sur devis » (2026-09-13)

## 12.1 ⭐⭐ DÉCISION DE PORTÉE — le cache du profil est HORS synchronisation

Le cadrage demandait de consigner ce choix ici, et il mérite de l'être : c'est
l'exception à la règle « toute nouvelle table se synchronise ».

**Le fait.** `license_profile` (migration 025) figure dans `TABLES_HORS_SYNC`,
et aucun trigger d'outbox ne la surveille. `outbox.test.ts` aurait échoué sans
ce classement — la règle « une table non classée disparaît en silence de la
sauvegarde » est tenue par un test, pas par la mémoire.

**Pourquoi.** Un profil n'est pas une donnée de l'utilisateur, c'est un droit
commercial délivré par le serveur. Le synchroniser, c'est le confier au canal
dont l'utilisateur détient la clé : il pourrait y figer une version périmée.
Chaque appareil le redemande donc au serveur (`public.license_profiles`) et
n'en garde qu'une copie **vérifiée à chaque lecture**.

**⚠️ Ce qui protège vraiment, c'est la signature, pas la portée.** Même hors
sync, le cache vit dans la base de l'utilisateur, qui peut l'éditer. Un profil
modifié à la main tombe sur `signatureValide` et l'app repasse au palier nu.
Ne jamais « optimiser » la vérification en ne la faisant qu'au téléchargement.

## 12.2 ⚠️⚠️ Un filtre écrit sur un MOTIF DE NOMMAGE a le trou exact des noms qui n'ont pas suivi

**Symptôme.** Profil « cabinet de conseil », module Position masqué : la
palette ⌘K propose encore « Calculateur de taille de position ». Tests verts.

**Cause.** Le filtre retirait les actions dont l'identifiant commence par
`nav.` ; celle-ci s'appelle `sizing.open`. C'est le même défaut de famille que
§ 7.2 ter (une règle écrite en énumérant des familles), pris par un autre bout.

**Parade.** Chaque action DÉCLARE son module (`module: View`), et
`licence/actions.test.ts` vérifie que toute action qui appelle
`ctx.navigate("x")` déclare `module: "x"`. Filtrer sur la propriété visée, pas
sur la forme d'un nom.

**Payée.** Vue à l'écran en mode démo, pas par les 1 119 tests.

## 12.3 ⚠️ Le contenu d'un module vit AUSSI hors de sa vue

**Symptôme.** Le trading est retiré de la barre latérale, mais l'accueil montre
« TRADING 7 J · +5R », Performance et Finance leurs panneaux trading, Réglages
le Market-Brain.

**Cause.** Ces surfaces n'étaient gatées que sur `hasTrading` — l'offre. Masquer
un module ne retire que son entrée de navigation.

**Parade.** `useEntitlements().afficheModule(m)` (palier ET profil) pour tout
contenu montré hors de la vue du module ; `MODULE_DU_WIDGET` pour les widgets
du tableau de bord. ⚠️ Ne PAS « simplifier » en réécrivant `hasTrading` avec le
profil : ce serait laisser un profil agir sur un droit (règle 1 du résolveur).

## 12.4 ⚠️⚠️ Un texte signé ne se normalise JAMAIS — ni `jsonb`, ni `timestamptz`, ni `JSON.stringify`

**Le fait.** La signature d'un profil porte sur les octets exacts de
`issued_at`, `expires_at` et `payload`. Postgres réécrit un `timestamptz` dans
son format et un `jsonb` réordonne les clés ; `JSON.parse` puis `stringify`
retire les espaces ; SQLite `datetime()` change le séparateur.

**Conséquence si on se trompe.** Toutes les signatures deviennent invalides, et
comme la dégradation est **silencieuse par contrat**, l'app repasse au palier nu
chez le client qui a payé, sans un message. Rien ne crie.

**Parade.** Colonnes `text` des deux côtés, écriture telle que reçue.
`serveur.sql.test.ts` et `cache.sql.test.ts` vérifient le rendu à l'octet près,
avec une apostrophe, des accents, des espaces et des millisecondes.

## 12.5 ⚠️ En mode hors ligne, l'abonnement était `null` — donc l'offre de BASE

**Symptôme.** Un abonné Shale Trade qui démarre sans réseau ne voit plus ses
modules trading, pendant toute la coupure.

**Cause.** `useAuth` passait `setSubscription(null)` en `offlineGrace`, et
`entitlementsOf(null)` rend `tier: "shale"`. Le palier n'était retenu nulle
part. Trouvé à l'audit, pas par un utilisateur.

**Parade.** `MetaSession.palier` (écrit par `marquerActive(palierDe(sub))`,
préservé par `memoriser` pour le même compte) et `abonnementHorsLigne()`.
⚠️ Ce palier n'ouvre aucune porte : l'entrée hors ligne reste décidée par
`activated` et le délai de grâce.

## 12.6 ⚠️ « Le téléchargement a échoué » ne veut PAS dire « pas de profil »

**Le piège.** La rédaction naturelle (`catch → effacer le cache`) efface la
licence d'un client à chaque coupure Wi-Fi, chaque 401 de jeton périmé, et pour
toujours si la migration serveur n'a pas été jouée (404).

**Parade.** `telechargerProfil` rend trois réponses distinctes — `profil`,
`aucun` (tableau vide : le serveur a répondu « rien pour toi »), `inconnu` (tout
le reste) — et seule `aucun` efface. Un profil reçu mais mal signé ne remplace
pas non plus un cache valide. Tenu par `transport.test.ts` et vérifié par
mutation (§ 12.7).

## 12.7 ⭐ Des tests verts du premier coup se vérifient en cassant le code

**Le fait.** Les 81 tests du chantier sont passés au premier lancement. Cinq
mutations ont ensuite été appliquées une par une — retirer la vérification de
signature, le test d'expiration, la distinction « inconnu / aucun », le filtre
des clés i18n, la protection de l'accueil — et **chacune** a fait tomber au
moins un test. Sans ce contrôle, « tout est vert » ne distinguait pas un banc
qui mord d'un banc vacant (cf. le test de traduction de `type_id`, section « Les thèmes et les objets
n'en font plus qu'un » de `CLAUDE.md`, écrit vacant la première fois).

## 13.1 ⚠️⚠️ Une politique RLS ne peut pas lire `auth.users`

**Symptôme.** `permission denied for table users` sur un simple
`select * from public.business_members` — y compris pour le propriétaire, dont
la politique n'avait pourtant rien à voir avec `auth.users`.

**Cause.** Postgres évalue TOUTES les politiques `select` d'une table (elles se
combinent en OU). Une seule politique qui fait `(select email from auth.users …)`
suffit à faire échouer chaque lecture : le rôle `authenticated` n'a aucun droit
sur `auth.users`, ni en production Supabase ni sur le banc.

**Parade.** Passer par une fonction `security definer` qui ne rend que l'adresse
du compte courant (`public.current_user_email()`, migration 006 du site).

**Payé.** Trouvé sur le banc PGlite (`shale-site/supabase/outils/verifier-006.mjs`)
le 2026-09-14, avant tout déploiement.

## 13.2 ⚠️ Révoquer `execute` à `anon` sur une fonction appelée par une vue lisible par `anon` casse la vue

**Symptôme.** `permission denied for function business_seat_for` en lisant
`my_subscription` sans session — alors que la RLS ne rendait de toute façon
aucune ligne.

**Cause.** Le droit d'exécuter une fonction se vérifie à l'initialisation de la
requête, AVANT le filtrage des lignes. Le réflexe « révoquer `anon` par
prudence » (appris sur `is_admin()`, cf. `shale-site/CLAUDE.md`) est faux dès que
la fonction entre dans une vue que `anon` peut lire.

**Parade.** Laisser `execute` à `anon` et rendre la fonction muette sans session
(`where p_user = auth.uid()`). Le banc vérifie les deux : pas d'erreur, aucune
ligne.

⚠️ **Le banc PGlite doit accorder à `anon` et `authenticated` les privilèges par
défaut de Supabase** (`grant select … to anon, authenticated`) : sans eux, la
lecture échoue sur la table avant d'atteindre la fonction, et ce piège-ci reste
invisible.

## 14.1 ⚠️⚠️ Un menu en `absolute` dans une carte de grille est RONGÉ sous la dernière ligne

**Symptôme.** Le menu « ⋯ » de la dernière étape d'une feuille de route s'ouvre,
se voit à moitié, et le clic sur une entrée du bas ne fait rien. Aucune erreur.
Mesuré : `getBoundingClientRect().top` à 1 025 px dans une fenêtre de 1 000,
même après `scrollIntoView` — et `elementFromPoint` rendait autre chose.

**Cause.** Le wrap de `ResizablePanel` porte `overflow: clip` (anti-superposition,
2026-07-12). Tout ce qui déborde de la carte est coupé ET hors de portée du
défilement de la page : il n'y a rien sous la carte à faire défiler.

**Parade.** Un menu flottant sort dans un PORTAIL (`createPortal(…, document.body)`)
en `position: fixed`, mesuré avant la peinture, retourné vers le haut s'il ne
tient pas en dessous, divisé par `zoomFactor()` comme `Tooltip`, et qui SUIT le
défilement plutôt que de se refermer. Une liste de suggestions, elle, peut
simplement rester DANS le flux (`RattacherElement`).

**Payé.** Chantier feuille de route, 2026-09-15 — vu en pilotant Chrome, pas en
relisant le code. Le même défaut vaut pour toute liste déroulante posée en
`absolute` près du bas d'un panneau de grille.

## 14.2 ⚠️ Un test qui appelle `t()` passe ou casse selon la langue de la machine

**Symptôme.** `expected '3/7 items' to be '3/7 éléments'`. Le test est juste, le
code aussi.

**Cause.** `lib/i18n` fixe la langue À L'IMPORT, depuis `navigator.language`. La
suite hérite de la langue du runner.

**Parade.** Poser `navigator` AVANT d'importer le module testé : `vi.resetModules()`,
`vi.stubGlobal("navigator", { language: "fr-FR", … })`, puis `await import(…)`
dans un `beforeAll` — le montage de `notifications.test.ts`, repris dans
`objectifs/libelles.test.ts`. `setLangPref()` ne convient pas : il touche au
`document`, absent en `environment: "node"`.

**Payé.** Chantier feuille de route, 2026-09-15.

## 14.3 ⚠️ Un script de navigateur en mode démo est interrompu par l'accueil au bout de 8 s

**Symptôme.** Un parcours piloté par puppeteer tape dans le vide à mi-chemin ;
la capture montre « Bienvenue dans Shale » par-dessus la vue.

**Cause.** `useAccueil()` attend le premier cycle de synchronisation, ou HUIT
secondes. En démo il n'y en a pas : l'accueil s'ouvre au bout du délai, au milieu
du scénario.

**Parade.** Poser `localStorage.setItem("shale.onboarded", "1")` dans
`evaluateOnNewDocument`, avant le chargement — c'est la clé de l'ancien accueil,
que `accueilNecessaire()` reprend comme « déjà vu ».

**Payé.** Chantier feuille de route, 2026-09-15 : un premier comptage de gestes
faux (« aucune tâche rattachée ») avant d'avoir regardé la capture.

## 15.1 ⚠️⚠️ Un `opacity: 0` EN LIGNE sur un bloc `[data-reveal]` le rend invisible pour toujours

**Symptôme.** Une page du site montre ses titres mais pas ses cartes, même avec
JavaScript et après défilement.

**Cause.** Le style en ligne l'emporte sur `[data-reveal].in { opacity: 1 }`.
Les maquettes Claude Design écrivent l'état de départ de l'animation dans
l'attribut `style` ; le script ajoute bien la classe `.in`, sans effet.

**Parade.** Ne jamais porter `opacity`/`transform` initiaux en ligne sur un
`[data-reveal]` : `global.css` s'en charge. `node tools/dev/nojs-check.mjs` le
détecte (« bloc(s) invisibles »), `check.mjs` non.

**Payé.** Refonte du site, 2026-09-15 : quatre pages Fonctionnalités vides.

## 15.2 ⚠️⚠️ `npx astro build` saute le `prebuild` que Vercel, lui, exécute

**Symptôme.** Build local vert, push fait, et le site en ligne reste l'ancien —
sans aucun message côté dépôt.

**Cause.** Vercel lance `npm run build`, donc `prebuild` (`tools/dev/assets-check.mjs`).
`npx astro build` ne le lance pas. Ici, l'outil lisait `/shots/v2/dark-X.webp`
dans un COMMENTAIRE et refusait le build pour une image « manquante ».

**Parade.** Avant de pousser : `npm run build` (jamais `npx astro build`), idéalement
dans un clone propre. Vérifier ensuite que la page en ligne a changé.

## 15.3 ⚠️ `curl` sur www.shaleapp.com répond 403 (« Vercel Security Checkpoint »)

**Cause.** La protection anti-robots de Vercel défie les clients sans navigateur.
Ce n'est pas une panne. **Parade.** Vérifier la prod avec puppeteer (Chrome réel,
User-Agent normal) : 200 et le vrai contenu.

## 15.4 ⚠️ `i18n-check.mjs` ignore les mots isolés et les fragments comme « /mois »

**Symptôme.** « 0 sans traduction », et `/en/pricing` affiche « /siège /mois ».
**Cause.** Le contrôle écarte les chaînes ASCII d'un seul mot et celles qui
commencent par `/`. **Parade.** Relire ces clés à la main (ou chercher les `_("…")`
absents de `en.ts` sans filtre) après tout portage de pages.

## 15.5 ⚠️⚠️ Un audit piloté par puppeteer ne descend pas si la page verrouille le défilement

**Symptôme.** Les audits du site passent au vert, et pourtant une capture du bas
de page ne s'affiche pas chez un visiteur. Ou l'inverse : l'audit signale une
image « qui ne charge pas » alors qu'elle s'affiche parfaitement.

**Cause.** L'accueil bloque le défilement pendant l'animation du héros
(`accueil.ts`, `lockScroll` : un écouteur `scroll` qui repose la page à `y`).
Un `window.scrollTo` d'audit est annulé à chaque pas — l'outil mesure toujours
le haut de la page, et les images `loading="lazy"` restent à `naturalWidth = 0`.

**Parade.** Émuler le réglage qui désactive le verrou :
`await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }])`.
C'est fait dans `check.mjs`, `audit.mjs`, `narrow-audit.mjs` et `wrap-check.mjs`.
`behaviour.mjs`, lui, ne doit PAS l'émuler : il teste le vrai comportement.

**Payé.** Vérification du site, 2026-09-16 : une journée de mesures faites sur le
seul premier écran, et un faux « image manquante » classé sans suite la veille.

## 15.6 ⚠️ Un champ d'éditeur qui n'est plus lu par personne ment en silence

**Symptôme.** On modifie un texte dans /edit, la page affiche « Modifié ✓ », on
publie — et le site ne change pas. Aucune erreur.

**Cause.** Les pages ont changé de source (ici : les textes sont passés dans le
dictionnaire i18n), mais `content.json` gardait ses clés. L'éditeur les liste,
les enregistre et les publie : tout fonctionne, sauf l'effet.

**Parade.** Après un changement de source de contenu, retirer les clés
orphelines. Le test tient en une ligne : lister les clés de `content.json` et
chercher chacune dans `src/` — celles qui n'apparaissent nulle part sont mortes.
Et dire dans l'éditeur, par section, si la valeur agit tout de suite ou au
prochain déploiement.

**Payé.** 154 champs morts sur 191 dans /edit, découverts le 2026-09-16.

## 15.7 ⚠️ `@astrojs/sitemap` 3.7 casse silencieusement sur Astro 4

**Symptôme.** `npm run build` s'arrête sur « Cannot read properties of undefined
(reading 'reduce') » dans `@astrojs/sitemap/dist/index.js`, sans autre indice.

**Cause.** La 3.7 lit les routes par l'API d'Astro 5. Sur Astro 4.16, l'argument
est absent. **Parade.** Épingler `@astrojs/sitemap@3.2.1` tant que le site est en
Astro 4. Et ne pas passer l'option `i18n` : elle attend un préfixe de langue sur
toutes les adresses, or le français n'en a pas.

# 16. Chantier « champ de date à la Apple » (2026-09-18)

## 16.1 ⚠️⚠️ Un analyseur de date qui DEVINE déplace l'échéance en silence

**Symptôme.** Le panneau du champ de date annonçait « jeudi 24 décembre 2026 »
sur une saisie qui contenait un caractère parasite (`24/12x`). Et « 12 mars »
était lu comme le 12 du mois AFFICHÉ — un mois faux, sur une saisie que
l'utilisateur croyait explicite.

**Cause.** Découper sur « tout ce qui n'est pas un chiffre » traite les lettres
comme des séparateurs. `"12 mars".split(/[^\d]+/)` rend `["12"]`, donc « le 12 »,
donc le mois courant.

**Parade.** Une lettre suffit à REFUSER : `if (/\p{L}/u.test(brut)) return null`.
C'est la même exigence que le jour impossible — `new Date(2026, 1, 31)` rend le
3 mars sans rien dire, donc `31/02` est refusé et ne roule pas. Ce qu'on ne sait
pas lire entièrement, on ne le devine pas.

⭐ **Ce qui a permis de le voir** : le panneau ÉCRIT ce qu'il a lu avant qu'on
valide. Sans cette ligne, la mauvaise lecture n'aurait été visible qu'une fois
la date posée. Un champ qui interprète doit rendre son interprétation.

**Payé.** Vu en pilotant Chrome, 2026-09-18.

## 16.2 ⚠️ Un panneau flottant qui SUIT le défilement sort de l'écran avec son ancre

**Symptôme.** `top: 1606px` dans une fenêtre de 900 : le calendrier de l'export
comptable de Finance, ouvert alors que son champ était hors écran, était placé
hors écran lui aussi — visible, ouvert, et invisible.

**Cause.** La parade du § 14.1 dit qu'un panneau doit SUIVRE le défilement
plutôt que se refermer (un défilement involontaire ne doit rien coûter). Mais
« suivre » sans borne, c'est suivre dehors.

**Parade.** Deux règles, et l'ordre compte :
- l'ancre entièrement hors écran (`bottom < 0 || top > innerHeight`) → on
  REFERME. La recaler de force poserait un calendrier au milieu de l'écran,
  détaché du champ qu'il modifie : il ne dirait plus ce qu'il change ;
- l'ancre à demi visible → on borne le `top` des DEUX côtés, la marge haute
  gagnant si la fenêtre est trop courte pour le panneau.

⚠️ **Et la mesure elle-même était le piège** : un clic programmé sur une ancre
hors écran ne prouve rien de l'usage réel. Un script d'audit doit amener le
contrôle sous les yeux (`scrollIntoView`) avant de cliquer, comme un utilisateur.

**Payé.** 2026-09-18, en auditant les treize champs de date un par un.

## 16.3 ⚠️⚠️ `.truncate-souris` REND le retour à la ligne — le voisin doit pouvoir se replier

**Symptôme.** Sur iPhone 390 pt, le titre d'une tâche de la feuille de route se
cassait au milieu d'un mot : « Backtesti / ng 1h ». Trois mots sur trois lignes.

**Cause.** `.truncate-souris` annule `truncate` sous `pointer: coarse` — et
c'est voulu : au doigt il n'y a pas de survol, donc un titre coupé l'est sans
recours. Mais un titre qui a le droit de revenir à la ligne a besoin de la
LARGEUR ; à côté d'une date et d'une croix en `shrink-0`, il ne reçoit que
quelques dizaines de pixels et se replie lettre par lettre.

**Parade.** La règle du 2026-07-26, appliquée à la ligne d'élément :
`flex-wrap` sur la rangée, une BASE flex (`basis-[9rem]`) sur le titre, et les
métadonnées groupées dans un seul bloc `ml-auto shrink-0` qui passe à la ligne
d'un coup. `min-w-0` seul ne déclenche jamais le repli — il comprime.

⭐ **La leçon qui dépasse ce cas** : ajouter une colonne à une ligne de liste
(ici l'échéance) suffit à réveiller ce défaut sur une ligne qui allait bien.
Toute colonne ajoutée à une rangée se vérifie à 390 pt, pas seulement en large.

**Payé.** 2026-09-18, en émulant l'iPhone dans Chrome.

## 16.4 ⚠️ Deux libellés de filtre en dur dans un tableau : les DEUX outils i18n au vert

**Symptôme.** Dans l'app anglaise, la barre de Tâches affichait
« **Toutes** · To do · **Faites** » — un libellé traduit entre deux qui ne
l'étaient pas.

**Cause.** Le § 5.2 bis, pris par un troisième bout. `i18n:check` ne voit que les
clés ÉCRITES dans un `t()` : une chaîne nue lui est invisible. Et `i18n:durs`
« ne suit pas la donnée » : ces trois libellés vivent dans un tableau
(`[["all", "Toutes", …], …]`), donc il les range en « entrées de table » et ne
dit pas si elles sont traduites.

**Parade.** La preuve reste **l'app basculée en anglais**, regardée. Et le motif
à chercher n'est pas l'oubli complet mais la MOITIÉ : dans une table de
libellés, vérifier que les entrées voisines passent toutes par `t()`.

**Payé.** Défaut antérieur au chantier, trouvé en relisant la capture anglaise
du filtre d'échéance voisin, 2026-09-18.

## 17.1 ⚠️⚠️ `gen/apple` ressemble à un dossier généré : 20 de ses fichiers sont suivis et écrits à la main

**Symptôme.** On cherche de la place, on voit `src-tauri/gen/` peser 575 Mo, et
le nom du dossier (`gen` = *generated*) dit qu'il se régénère. Un `rm -rf
gen/apple` paraît sans risque.

**Cause.** Il est généré **une fois**, puis **édité**. `git ls-files
src-tauri/gen` rend **20 fichiers** : `project.yml`, `Info.plist`,
`shale_iOS.entitlements`, `LaunchScreen.storyboard`, `ExportOptions.plist`,
`Podfile`, les sources Swift de la capture rapide — et
**`Assets.xcassets/AppIcon.appiconset/`**, que `tauri icon` ne touche PAS
(§ 11.2) et qui porte le travail d'icône du 2026-09-12 : les trois variantes
`any` / `dark` / `tinted` et la correction du halo blanc (§ 21.1 de `MOBILE.md`).
Les 574 Mo sont dans **deux sous-dossiers seulement**, non suivis :
`Externals/` (465 Mo, les bibliothèques Rust pour iOS) et `build/` (109 Mo).

**Parade.** Ne jamais supprimer `gen/apple` en bloc. Supprimer
`gen/apple/Externals` et `gen/apple/build`, puis **vérifier que git ne voit
aucune suppression** :

```
git status --porcelain src-tauri/gen     # doit rendre ZÉRO ligne
```

La même vérification vaut pour n'importe quel dossier qu'on croit jetable :
**c'est git qui répond, pas le nom du dossier.**

**Ce que ça aurait coûté.** Le chantier d'icône du 2026-09-12 en entier — trois
variantes, un catalogue d'assets que l'outil de Tauri ne sait pas reconstruire,
et la découverte que l'icône ne suit pas l'apparence système sur iOS 26.

## 17.2 ⭐ Un cache de compilation de 10 Go se reconstruit en 2 minutes

**Symptôme.** `src-tauri/target/` pèse 10 Go, le disque est plein, et on
n'ose pas y toucher : « il va falloir tout recompiler ».

**Cause.** La peur porte sur la mauvaise quantité. Ce qui coûte du temps, ce
n'est pas la taille du cache, c'est le **téléchargement** des dépendances — et
il vit ailleurs, dans `~/.cargo/registry` (336 Mo). Tant que le registre est
là, `cargo check --all-targets` reconstruit les 4,6 Go de `debug` en **2 min
04 s** (mesuré le 2026-09-18, après suppression complète).

**Parade.** Supprimer `target/debug` et les cibles iOS sans hésiter quand la
place manque ; **garder `target/release`** (le prochain `tauri build` est celui
qui part chez Antonin) et **garder `~/.cargo/registry`**, qui est ce qui rend la
reconstruction rapide. Supprimer le registre est l'erreur inverse : on gagne
336 Mo et on paie un retéléchargement complet.

**Ce que ça a rapporté.** 20 Go, sur un disque qui n'avait plus que 8,2 Go de
libre — dont 9,7 Go dans le cache de l'ANCIEN projet (`~/Desktop/appli claude`),
que plus rien ne compile depuis le fork.

## 18.1 ⚠️⚠️ Un composant qui pose `inert` sur `#root` DOIT être porté sur `document.body` — sinon il s'éteint lui-même

**Symptôme.** La carte mentale d'un objectif s'affichait parfaitement, le
clavier la pilotait (flèches, Espace, Échap), et **aucun clic ne faisait rien** :
ni un nœud, ni les boutons de la barre d'outils. Aucune erreur, aucun
avertissement.

**Cause.** `EditeurCarte` pose `inert` sur `#root` le temps de sa vie, pour que
la tabulation n'atteigne pas ce qui est derrière lui. Rendu dans l'arbre d'une
vue, il **est lui-même un descendant de `#root`** : l'attribut l'englobait. Un
sous-arbre `inert` n'est pas seulement non-tabulable, il n'est **plus
hit-testable** — d'où le symptôme trompeur : le clavier marchait, parce que son
écouteur est posé sur `window`, c'est-à-dire hors de l'arbre.

**Comment ça s'est vu.** Pas à l'œil — en mesurant
`document.elementFromPoint()` au centre d'un nœud : il rendait `BODY`. Et
attention au piège de méthode qui va avec : un script qui clique par
`element.click()` **court-circuite le test de survol** et voit donc un bouton
« fonctionnel » qu'un doigt ou une souris n'atteindraient jamais. Pour ce genre
de contrôle, cliquer aux **coordonnées** (`page.mouse.click`,
`page.touchscreen.tap`), jamais par `.click()`.

**Parade.** `createPortal(…, document.body)`. Les deux hôtes historiques de
l'éditeur (Notes, Savoir) le faisaient déjà — pour une **autre** raison (le
`transform` d'un ancêtre animé devient le bloc conteneur d'un `position: fixed`).
Deux raisons différentes, une seule parade : une couche modale se monte sur
`document.body`, jamais dans la vue qui l'ouvre.

## 18.2 ⚠️ Une écriture faite loin de la vue qui l'affiche ne se voit pas

**Symptôme.** Le panneau « En faire un objectif » (dans l'éditeur de carte d'une
note) annonçait « l'objectif est créé » — et la vue Objectifs restait vide. Les
lignes existaient vraiment en base.

**Cause.** Les vues lisent `data`, relu par le seul `refresh()` d'`App.tsx`, qui
descend en prop. Un composant situé cinq niveaux plus bas dans un AUTRE module ne
l'a pas. Il existait bien un canal `sb:data-changed`, mais côté **Tauri
uniquement** (la fenêtre de capture rapide) : rien, côté front, ne permettait de
dire « j'ai écrit ».

**Parade.** `App.tsx` écoute désormais le même nom d'événement sur `window`, et
tout écrivain hors-vue le déclenche. **Le même nom pour les deux canaux** : un
second nom finirait par n'être écouté qu'à moitié.

**Généralisation.** Toute fonctionnalité qui écrit une table depuis un module qui
ne l'affiche pas doit émettre ce signal. Le symptôme, sinon, est le pire
possible : une confirmation sincère devant un écran qui semble ne rien avoir fait.

## 18.3 ⚠️ Une clé i18n EN DOUBLE écrase la précédente — et `« Carte »` voulait déjà dire « Card »

**Symptôme.** Aucun, à la lecture du diff. `npm run i18n:check` l'a dit :
« 1 clé(s) EN DOUBLE dans en.ts — la seconde écrase la première ».

**Cause.** Le bouton de la feuille de route s'appelle « Carte » (au sens carte
mentale). La clé `"Carte"` existait depuis Finance, où elle traduit la **carte
bancaire** (`"Carte": "Card"`). Ajouter la seconde aurait fait parler Finance de
cartes mentales dans toute l'app anglaise.

**Parade.** Le discriminant de contexte, déjà en usage dans le dépôt :
`t("Carte|carte mentale")`, avec la clé `"Carte|carte mentale"` dans `en.ts`.
Tout ce qui suit la barre est retiré du repli français.

**Ce qu'il faut en retenir.** `i18n:check` ne sert pas qu'à trouver les
manquantes : c'est lui qui voit les collisions, et une collision est **muette**
en français (le repli rend la clé) — elle ne se voit que dans l'autre langue,
sur un écran qu'on n'avait pas de raison de rouvrir.

## 18.4 ⚠️ Une fenêtre modale centrée passe SOUS la barre d'onglets du téléphone

**Symptôme.** Sur iPhone 390 × 844, le pied de la fenêtre « Nouvel objectif » —
donc le bouton **« Créer »** — tombait derrière la barre d'onglets. Le contrôle
existait, il était « dans la fenêtre » au sens de `getBoundingClientRect`, et il
était intouchable.

**Cause.** `MobileNav` est en `position: fixed` PAR-DESSUS le contenu (~80 px).
Une modale plafonnée à `90vh` et centrée verticalement dépasse donc par le bas.

**Parade.** Au doigt, plafonner à **78vh** :
`[@media(pointer:coarse)]:max-h-[calc(78vh*var(--zoom-inv))]`. C'est exactement
la valeur que `MobileNav` applique déjà à sa propre feuille, pour cette raison.
⚠️ Et toujours `* var(--zoom-inv)` : le `zoom` CSS de la densité multiplie aussi
les unités de viewport (règle du 2026-08-28).

**Portée.** Les autres modales de l'app (tâche, événement, trade) n'ont AUCUN
plafond de hauteur : le défaut est latent chez elles dès que leur contenu
grandit. Corrigé ici sur la seule fenêtre de ce chantier, consigné pour la
prochaine qu'on touche.

## 18.5 ⚠️ « Tout voir » sur un téléphone montre tout et ne laisse rien lire

**Symptôme.** La carte mentale d'un objectif s'ouvrait à **25 %** sur un écran de
390 pt : les huit nœuds étaient à l'écran, illisibles.

**Cause.** Le cadrage initial est un « fit » : il prend le plus petit des deux
rapports. Une carte mentale est LARGE (elle pend des deux côtés du centre), une
fenêtre de téléphone est étroite — le rapport de largeur gagne toujours, et très
bas.

⚠️ Et il n'y a **aucun repli au doigt** : la scène porte `touch-action: none`
(indispensable au glissement, § 7.4 ter), donc **le pincement ne zoome pas**. Il
ne reste que les deux loupes, que personne ne va chercher devant un écran qu'il
croit simplement raté.

**Parade.** Un **plancher de zoom au cadrage initial seulement**
(`toutVoir(0.5)` sous `pointer: coarse`) : on montre le centre, lisible, et on
laisse glisser. Le bouton « Tout voir », lui, garde son plancher habituel — il
PROMET de tout montrer, et un bouton qui ne tient pas son nom est pire qu'un
bouton qui montre petit.

**Au passage.** Le pied d'aide disait « Clic ouvrir · molette : déplacer » sur un
appareil qui n'a ni clic ni molette. Deux pieds, choisis par `pointer: coarse`
en CSS — pas par un `matchMedia` en JS, qui ne suivrait pas une rotation sans
écouteur.

## 20.1 ⚠️⚠️ Une tâche PONCTUELLE cochée un autre jour ne se décochait plus

**Symptôme.** Vue Tâches, sans filtre de date : une tâche ponctuelle cochée
hier reste cochée quand on clique dessus. On clique encore, rien ne bouge.

**Cause.** L'affichage et l'écriture ne parlaient pas du même jour. La vue dit
« faite » dès qu'**une** complétion la dit faite, quel que soit le jour ; le
clic écrivait `done = 0` pour **aujourd'hui** seulement. La coche d'hier restait
en base, donc la case restait cochée. La feuille de route des objectifs lit la
même règle (« faite un jour quelconque »).

**Parade.** `basculerTache()` (`repo.ts` + `demo.ts`) : décocher une ponctuelle
passe TOUTES ses complétions à `done = 0` (UPDATE, pas DELETE : le trigger
d'outbox pousse la ligne). Une récurrente se décoche toujours jour par jour.
Tout clic de case de tâche passe par elle, jamais par `setTaskDone` en direct.
Test : `src/lib/basculerTache.test.ts`, vu échouer sur l'ancien comportement.

**Comment on l'a payé.** Signalé par Antonin le 2026-09-22 comme « ajuster le
cocher/décocher ». Le défaut existait depuis que la vue Tâches affiche les
ponctuelles « faites un jour » — personne ne décochait une tâche de la veille.

## 20.2 ⚠️ Une case qui attend la base avant de basculer fait défaire sa propre coche

**Symptôme.** On clique une case, rien ne bouge pendant l'écriture + le
`refresh()` complet (relecture de 400 jours de données) ; on reclique, et la
seconde écriture défait la première.

**Parade.** `useCochesOptimistes()` (`components/CaseACocher.tsx`) : la case
bascule au clic, les écritures d'une même case s'enchaînent dans une file, et
la surcharge tombe quand la dernière est finie — y compris en cas d'échec, où
la case revient à ce que dit la base.

---

# 21. Design system V7 (2026-09-22)

## 21.1 ⚠️⚠️ Un `dot` en FONCTION sur une `<Area>` recharts 3 fige la courbe sur son premier segment

**Symptôme.** Après avoir ajouté un point sur la dernière valeur de la courbe du
patrimoine, la courbe ne se dessine plus : à 3,5 s, seul le premier segment est
visible, et le point final flotte seul à droite. Aucune erreur.

**Cause.** Passer une fonction à `dot` sur l'`<Area>` bloque son animation
d'entrée. `useCallback` n'y change rien (vu : pire encore, plus rien du tout) —
ce n'est pas une question d'identité de la fonction.

**Parade.** Porter le point par une série à part : `<Line dataKey="fin"
stroke="none" isAnimationActive={false} legendType="none" tooltipType="none" />`
sur une clé qui ne vaut quelque chose qu'au dernier point
(`CourbePatrimoine.tsx`).

**Payé.** V7, deux essais, vu sur capture — rien d'autre ne l'aurait montré.

## 21.2 ⚠️⚠️ Soulever une carte au survol en fait le bloc conteneur de ses `position: fixed`

**Symptôme (évité).** Une modale rendue DANS sa carte se replierait dans la carte
dès qu'on la survole — et on la survole forcément, puisqu'on s'en sert.

**Cause.** `translate`, comme `transform`, fait de l'élément le bloc conteneur de
ses descendants `fixed` (le même mécanisme que § 9.5, par un autre chemin).

**Parade.** Garder le soulèvement hors des cartes qui en contiennent :
`.card:hover:not(:has(.fixed))`. Toute règle de survol qui déplace un conteneur
doit porter la même garde.

**Payé.** Repéré en phase 0 de la V7, avant d'écrire la règle.

## 21.3 ⚠️ Le FLIP de `ResizableGrid` laissait `transition: none` EN LIGNE, pour toujours

**Symptôme.** Une transition CSS posée sur les panneaux de la grille (le
soulèvement V7) marche… jusqu'au premier réordonnancement ; ensuite elle saute.

**Cause.** L'étape 1 du FLIP écrit `style.transition = "none"` sur TOUS les
panneaux pour mesurer ; l'étape 4 ne réécrivait que les panneaux qui avaient
bougé. Les autres gardaient `none` en ligne, qui écrase toute feuille de style.

**Parade.** Rendre `style.transition = ""` aux panneaux immobiles (étape 4) et au
panneau lâché (`finish`). Plus généralement : un style EN LIGNE posé
temporairement doit être retiré, pas seulement écrasé quand ça arrange.

**Payé.** V7, lu dans le code en phase 0.

## 21.4 ⚠️ Un commentaire qui promet un test n'est pas un test

**Symptôme.** `PALETTE_EXPORT` (export des cartes mentales) disait : « un test la
compare au fichier de style ». Aucun test ne le faisait. Les jetons sont passés en
V7, la copie serait restée en V6, sans que rien ne casse.

**Parade.** Avant de croire un « c'est vérifié par un test », chercher le test
(`grep -rn NOM src --include='*.test.ts'`). Écrit : `carte.palette.test.ts`.

**Payé.** V7, trouvé au balayage des hex de la V6.

## 21.5 ⚠️ `prefers-reduced-motion` de l'app neutralisait la DURÉE, pas le DÉLAI

**Symptôme (évité).** Sous mouvement réduit, une carte à délai (entrée en
cascade) resterait invisible pendant son délai (jusqu'à 440 ms), puis surgirait.

**Cause.** La règle globale écrasait `animation-duration` et
`transition-duration`. `animation-delay` est une troisième propriété (même
famille d'oubli que `scroll-behavior`, § 6.3 bis).

**Parade.** `animation-delay: 0s !important` ajouté à la règle existante —
mesuré : délais 0 s, durée 1e-6 s. Aucune autre animation de l'app n'avait de
délai.

**Payé.** V7, phase 0.

## 21.6 ⚠️ Un worktree dont `node_modules` est un LIEN fait refuser les polices par Vite

**Symptôme.** Dans un worktree de `Shale-chantiers/`, l'app de démo s'affiche en
police système. Le journal de Vite dit : « The request id …woff2 is outside of
Vite serving allow list ». Les captures ont l'air justes — elles ne le sont pas.

**Cause.** Le lien `node_modules → Shale-projet/Shale/node_modules` sort de la
racine du worktree ; `server.fs.allow` ne l'autorise pas.

**Parade.** Lancer Vite avec une config enveloppe qui étend `fs.allow`
(`--config` vers un `.mjs` qui importe `vite.config.ts` et ajoute
`server.fs.allow: ["/Users/antonin/Desktop"]`). Ne pas modifier la config du dépôt.

**Payé.** V7 : une première série de 48 captures V6 à refaire.

## 21.7 ⚠️ En démo, forcer `data-theme` à la main ne tient pas

**Symptôme.** Un script pose `document.documentElement.dataset.theme = "light"`,
et la capture sort en sombre.

**Cause.** L'app réapplique son réglage de thème (« Système » en démo), qui
retire l'attribut.

**Parade.** Émuler `prefers-color-scheme` (`page.emulateMediaFeatures`) pour le
mode Système, et cliquer « Clair » dans Réglages pour le choix explicite.

**Payé.** V7, une série de captures « claires » qui étaient sombres.

## 21.8 ⚠️ `button[aria-label="Trading"]` attrape la CATÉGORIE, pas le module

**Symptôme.** Un script de captures clique `button[aria-label="Trading"]`, et
l'écran capturé est celui d'avant (Savoir, Aujourd'hui…) — sans erreur.

**Cause.** Dans la barre latérale, l'en-tête de catégorie repliable « Trading »
porte le même `aria-label` que le module « Trading » qu'il contient, et il vient
en premier dans le DOM : `querySelector` renvoie l'en-tête, le clic replie ou
déplie la catégorie, et la vue ne change pas.

**Parade.** Prendre le DERNIER bouton qui porte le libellé
(`querySelectorAll(...)`, puis `[length - 1]`), et vérifier sur la capture que
le titre de la page est le bon.

**Payé.** V7 puis Encre (2026-09-22 et 23) : deux séries où « Trading »,
« Market-Brain » et « Position » n'avaient en fait jamais été capturés.

## 21.9 ⚠️⚠️ Un token de couleur que les DONNÉES enregistrent ne se supprime pas

**Symptôme** (évité, 2026-09-23). Passer le « réussi » à l'encre en
redéfinissant `--color-green` aurait blanchi, chez l'utilisateur, toutes les
étiquettes, habitudes, couleurs d'événement et textes de note qu'il avait
choisis VERTS.

**Cause.** Les palettes de choix (`TAG_COLORS`, `HABIT_COLORS`, les couleurs
de texte des notes, `richtext.ts`) enregistrent la chaîne `var(--color-green)`
en base ; les événements, types et branches de carte enregistrent le nom
`green`. Le token est donc une donnée, pas seulement un style.

**Parade.** Un NOUVEAU token pour le nouveau sens (`--color-success`), et
`--color-green` garde son nom. `src/lib/theme.encre.test.ts` échoue si
`--color-green` disparaît d'un des trois blocs de thème.

# 19. Chantier « menus contextuels et corbeille » (2026-09-21)

*Cinq pièges payés pendant la Phase 1 (le socle du menu). Les quatre premiers
étaient de VRAIS défauts ; les quatre ont passé `tsc`, les tests et le build au
vert, et les quatre n'ont été trouvés qu'en pilotant le navigateur. Le
cinquième est un piège de l'OUTIL de pilotage, pas de l'app — il est ici parce
que la prochaine session tombera dedans.*

## 19.1 ⚠️⚠️ Un vrai clic droit de souris arrive avec `detail: 0`

**Symptôme.** Le menu contextuel s'ouvre, il est joli, il est **au mauvais
endroit** : sous la ligne entière, au lieu d'être sous le curseur. Aucune
capture d'écran ne le trahit — un menu sous sa ligne a l'air parfaitement
normal. On ne le voit qu'en comparant le coin du menu au point cliqué.

**Cause.** La première version demandait « est-ce venu du clavier ? » avec
`e.detail === 0 || (clientX === 0 && clientY === 0)`, et se servait de la
réponse POUR DEUX QUESTIONS : où poser le menu, et faut-il surligner la
première entrée. Or, mesuré sur l'événement réel : `isTrusted: true`,
`button: 2`, `clientX: 404`, **`detail: 0`**. Chromium met `detail` à 0 sur un
`contextmenu` de souris. Tous les clics droits passaient donc pour du clavier.

**Parade.** Deux questions, deux règles (`components/menu/useMenuContextuel.ts`) :
- **où** poser le menu → on ne regarde QUE les coordonnées (`sansPoint`) ;
- **faut-il** surligner la première entrée → on regarde le bouton (`sansSouris`,
  `button !== 2`).

Se tromper sur la seconde coûte une ligne surlignée ; se tromper sur la première
coûtait un menu mal placé. Deux erreurs de prix différent n'ont pas à partager
le même test. Verrouillé par `useMenuContextuel.test.ts`, **vu rouge** en
remettant l'ancienne règle (3 tests tombent).

**Payé.** Phase 1, 2026-09-21.

## 19.2 ⚠️⚠️ Maj+F10 n'ouvre RIEN sur macOS : aucun `contextmenu` n'est émis

**Symptôme.** Le cahier des charges demande l'ouverture au clavier par « Maj+F10
/ touche Menu ». Rien ne s'ouvre. Pas d'erreur.

**Cause.** Mesuré dans le moteur de l'app : `keydown:F10+shift`,
`keyup:F10+shift`… et **aucun `contextmenu`**. Maj+F10 est une convention
WINDOWS, que le navigateur traduit là-bas en `contextmenu`. macOS ne la connaît
pas, et un Mac n'a pas de touche Menu. Compter sur le navigateur, c'était livrer
une ouverture au clavier **qui ne marche jamais sur la machine d'Antonin**.

**Parade.** Écouter la touche soi-même (`toucheDuMenu()` + `ouvrirAuClavier()`)
et appeler `preventDefault()` : sous Windows, cela empêche aussi le navigateur
d'envoyer son propre `contextmenu` derrière — sans quoi le menu s'ouvrirait deux
fois.

**Payé.** Phase 1, 2026-09-21. La séquence clavier entière avait été jouée sur
un menu FERMÉ avant qu'on s'en aperçoive : chaque étape « passait », puisqu'il
n'y avait rien pour échouer. ⭐ **Vérifier que le menu est ouvert AVANT de lire
la moindre étape suivante.**

## 19.3 ⚠️⚠️ Un sous-menu dans son propre portail passe pour « l'extérieur »

**Symptôme.** On survole « Copier », le sous-menu s'ouvre, on clique « Le
titre ». Le menu se ferme. **Rien n'est copié.** Aucune erreur.

**Cause.** La fermeture au clic extérieur testait `panneau.contains(cible)`.
Mais le sous-menu vit dans SON PROPRE portail : il n'est pas un descendant du
panneau dans le DOM — il ne l'est que dans l'arbre React. Le `pointerdown` sur
« Le titre » était donc vu comme extérieur, le menu se fermait, et le `click`
n'arrivait jamais. Mesuré : presse-papier `null`.

**Parade.** Marquer les deux panneaux d'un même attribut (`data-menu-contextuel`)
et tester `cible.closest("[data-menu-contextuel]")`. ⚠️ Vaut pour TOUT panneau
flottant qui ouvre un second portail : `contains` ne traverse pas les portails.

**Payé.** Phase 1, 2026-09-21. Le survol marchait, la capture était belle, le
défaut ne se voyait qu'en CLIQUANT et en regardant ce qui en sortait.

## 19.4 ⚠️ Un élément en `visibility: hidden` ne peut pas prendre le focus

**Symptôme.** Au clavier, → ouvre le sous-menu, et ↓ mène bien à « Le texte »
— l'état interne est juste. Mais le **focus** reste sur « Copier ». Un lecteur
d'écran annonce la mauvaise entrée. Rien ne se voit.

**Cause.** Un panneau flottant naît en `visibility: hidden`, le temps d'être
mesuré (`PIEGES` § 14.1). Et `focus()` sur un élément invisible **échoue en
silence**. Le parent posait le focus dans son effet, AVANT que le sous-menu ait
reçu sa place et soit devenu visible.

**Parade.** Le panneau pose le focus LUI-MÊME, dans un effet qui dépend de sa
place (`useEffect(…, [place, rang])`) : il attend d'être visible. Et en test,
**attendre avant de lire le focus** — la première lecture, faite trop tôt,
ressemblait à une course et masquait le vrai défaut.

**Payé.** Phase 1, 2026-09-21.

## 19.5 ⚠️ Outil de pilotage : la touche « Down » envoie `e.key === ""`

**Symptôme.** Au clavier piloté, ↓ et → ne font rien dans le menu, alors que
Début, Fin et Échap marchent. On croit le menu cassé.

**Cause.** L'OUTIL, pas l'app. Mesuré : le nom `Down` produit `e.key === ""`
(et `e.code` vide) ; le nom `ArrowDown` produit bien `"ArrowDown"`. Idem pour
`Right`/`ArrowRight`, `Left`/`ArrowLeft`. Un vrai clavier envoie TOUJOURS les
noms longs.

**Parade.** Dans un script de pilotage, écrire `ArrowDown`, `ArrowUp`,
`ArrowLeft`, `ArrowRight` — jamais `Down`, `Up`, `Left`, `Right`. Et ne PAS
« corriger » l'app pour accepter `""` : ce serait coder contre un défaut qui
n'existe que dans l'outil.

**Payé.** Phase 1, 2026-09-21 — plusieurs essais à chercher un défaut dans le
code avant de mesurer ce qui arrivait vraiment.

## 19.6 ⚠️⚠️ Une requête récursive en `UNION ALL` tourne à l'infini sur une boucle

**Symptôme.** Le processus de test MEURT (« Channel closed », pile V8 native),
sans un message qui accuse le code. Dans l'app : ouvrir la corbeille aurait
figé Shale.

**Cause.** `WITH RECURSIVE … UNION ALL` suit `parent_goal_id` de parent en
enfant. Sur une boucle (A parent de B, B parent de A), il n'y a pas de fin : la
mémoire monte jusqu'à la mort du processus. Une telle boucle ne devrait pas
exister — mais une synchronisation interrompue peut en fabriquer une.

**Parade.** `UNION` (qui écarte les lignes déjà produites) plutôt que
`UNION ALL`. Puis, pour le mode démo qui n'a pas de SQL, la règle des lots a
été sortie en fonctions PURES (`lib/corbeille/lots.ts`), chaque traversée
gardant l'ensemble des nœuds VUS. Un test pose exprès une boucle.

**Payé.** Phase 2, 2026-09-22 — trouvé parce qu'on avait écrit le test de la
boucle AVANT d'en avoir besoin.

## 19.7 ⚠️⚠️ Un filtre `deleted_at IS NULL` posé en aveugle éteint TOUTES les notifications

**Symptôme.** Plus aucune notification. Aucune erreur visible.

**Cause.** Le lecteur Rust des notifications (`notifications/data.rs`) est
TOLÉRANT par construction : une requête qui échoue rend une liste vide, pour
survivre à une base ancienne. Or le planificateur peut tourner sur une base
PAS ENCORE MIGRÉE (avant que le front ait joué la 027) : là, la colonne
n'existe pas, la requête filtrée échoue, la liste est vide — et toutes les
règles se taisent.

**Parade.** `filtre_vivant()` : ne filtrer QUE si la table porte la colonne
(`pragma_table_info`). Sans la colonne, rien ne peut être en corbeille : ne pas
filtrer est alors EXACT. Vu rouge : poser le filtre sans vérifier fait tomber
6 tests.

**Payé.** Phase 2, 2026-09-22 — trouvé en relisant le mot « tolérant » dans
l'en-tête du fichier, avant d'écrire la ligne.

## 19.8 ⚠️ Un essai de mutation qui n'affiche RIEN n'a pas tourné

**Symptôme.** Neuf essais de mutation d'affilée, neuf lignes vides : ni rouge,
ni vert. On est tenté de lire « rien n'a cassé ».

**Cause.** `timeout` (GNU coreutils) N'EXISTE PAS sur macOS. La commande
échouait avant de lancer quoi que ce soit ; le `grep` en aval ne trouvait
rien à filtrer, et le fichier était restauré juste après — tout avait l'air
propre.

**Parade.** Un essai compte s'il affiche une ligne `Tests …`, rouge ou verte.
Une sortie vide est un essai qui n'a pas eu lieu. Et sur ce Mac, pas de
`timeout` : laisser l'outil de la session gérer la durée.

**Payé.** Phase 2, 2026-09-22.

## 19.9 ⚠️⚠️ Le risque « vieil appareil » était mal décrit — mesuré, il est plus étroit

**Ce qui avait été écrit** (rapport de Phase 0, § 4 b) : un appareil resté en
version 026 ignore `deleted_at` ; s'il écrit sur un objet jeté, il le renvoie
sans la colonne, et l'objet « ressort de la corbeille PARTOUT ».

**Ce qui est vrai, mesuré** (`sync/corbeille.test.ts`) :
- `appliquerLigne()` écrit `ON CONFLICT … DO UPDATE SET` sur les SEULES colonnes
  reçues. Un appareil qui a DÉJÀ l'objet le garde en corbeille ; seul le titre
  change. La corbeille TIENT.
- MAIS le vieil appareil continue d'AFFICHER l'objet jeté ;
- ET un appareil NEUF (installation, réinstallation) qui reçoit l'objet pour la
  première fois l'INSÈRE à partir de la version du vieil appareil — sans la
  colonne, donc VIVANT.

**Parade.** Inchangée : tous les appareils en 027 avant d'utiliser la
corbeille. Aujourd'hui un seul appareil est actif (l'iPhone ne lance plus
l'app depuis le 2026-09-03) : le risque est nul maintenant, réel dès que
l'iPhone revient avec une vieille version.

**La leçon générale.** Un risque décrit en lisant le code se VÉRIFIE en test
avant d'être répété. Le premier constat était plausible, argumenté, et faux.
Un test le fige désormais : si une parade est ajoutée un jour, il devra être
changé EXPRÈS.

**Payé.** Phase 2, 2026-09-22. Le rapport de Phase 0 porte une correction datée.

## 19.10 ⚠️ La démo divergeait du natif sur trois points — tous dans la famille de la corbeille

Relevés en écrivant la corbeille de la démo, et corrigés (règle « corriger
large ») parce que sa purge passe par ces chemins :
- `demo.fetchAll` rendait TOUTES les habitudes ; le natif écarte les archivées
  (`WHERE archived = 0`) ;
- `demo.deleteNote`, `deleteTask`, `deleteGoal`, `deleteKnowledgeEntry`
  gardaient les arêtes de l'objet supprimé ; le natif les emporte par trigger ;
- aucun test ne comparait les deux.

**Parade.** `lib/corbeille/api.test.ts` joue le MÊME scénario deux fois, sur
une vraie base puis en démo, par la seule API publique de `repo.ts`. C'est
§ 6.2 quater (« un accès démo trop indulgent masque ce que le natif détruit »)
transformé en test — et c'était nécessaire ici : les captures d'écran des
phases 3 et 4 se font EN MODE DÉMO.

**Payé.** Phase 2, 2026-09-22.

## 19.11 ⚠️⚠️ Masquer un lien À LA LECTURE + réécrire la ligne ENTIÈRE = lien perdu en base

Première version de la corbeille : `fetchAll` rendait `goal_id = NULL` pour une
tâche dont l'objectif était en corbeille (« détacher les jetés »). Or la
fenêtre d'une tâche enregistre par `updateTask`, qui réécrit TOUTES les
colonnes. Ouvrir la tâche, corriger une virgule, enregistrer : le `NULL` lu
était écrit. Restaurer l'objectif ne ramenait plus sa tâche — et rien ne le
disait, puisque le lien manquant ne se voit que de l'autre côté.

**Parade.** Une tâche garde son `goal_id` tel quel ; seuls les OBJECTIFS dont
le parent est jeté sont détachés à la lecture, et aucune écriture entière ne
les relit. Test rouge d'abord, en natif ET en démo : « MODIFIER une tâche par
sa fenêtre … ne coupe pas le lien » (`lib/corbeille/api.test.ts`). Règle
générale : **ne jamais masquer à la lecture une colonne qu'un écrivain
ligne-entière réécrit** — c'est § 6.2 vu par l'autre bout.

**Payé.** 2026-09-23.

## 19.12 ⚠️ `data-heure` du calendrier ne porte que l'HEURE (« 14 »), pas le créneau

Le clic droit sur un créneau vide lisait `data-heure` : « Nouvel événement
ici » tombait toujours à l'heure pile, même en visant 14 h 30. **Parade.**
`creneauSous(e)` (exporté par `GrilleHoraire`) calcule le créneau depuis la
position du pointeur, exactement comme le clic gauche. Les événements et les
tâches posés dans la grille portent `data-entree` pour que le clic droit sache
ce qu'il vise.

**Payé.** 2026-09-23.

## 19.13 ⚠️⚠️ Le panneau navigateur CACHÉ rend des captures périmées et un viewport de 0 × 0

Pendant la vérification du chantier, les captures du panneau intégré
montraient l'état d'AVANT le clic, et `innerWidth` valait 0 : un menu
parfaitement placé paraissait hors écran. **Parade.** Vérifier dans un Chrome
sans fenêtre piloté par le protocole DevTools, profil JETABLE (script sans
dépendance : `Page.navigate`, `Input.dispatchMouseEvent`,
`Page.captureScreenshot`). Émulation tactile par
`Emulation.setTouchEmulationEnabled` + `setDeviceMetricsOverride({ mobile:
true })` : `matchMedia("(pointer: coarse)")` y répond bien `true`.
Corollaire : une bulle `data-tip` a un délai d'entrée — une capture prise
700 ms après le survol ne la montre pas encore ; attendre ~1,5 s.

**Payé.** 2026-09-23 (et mémoire « Vérifier avec Chrome, pas le panneau »).

## 19.14 ⚠️ Le menu contextuel NATIF de la WebView était en anglais sur un Mac français

Clic droit hors d'une zone de texte dans l'app installée : « Reload »,
« Inspect Element »… en anglais, alors que macOS est en français. Cause : le
paquet ne déclarait que l'anglais (`CFBundleDevelopmentRegion`, aucune
`CFBundleLocalizations`), et WebKit choisit la langue de ses menus parmi
celles que DÉCLARE l'app. **Parade.** `src-tauri/Info.plist` :
`CFBundleLocalizations = [en, fr]` + `CFBundleAllowMixedLocalizations`. Et
hors des zones de texte, `installerMenuNatif` remplace ce menu par celui de
l'app (production seulement). Vérifier après build que la clé est bien dans
`Shale.app/Contents/Info.plist` — Tauri FUSIONNE ce fichier, il ne le copie pas.

**Payé.** 2026-09-23.

## 21.10 ⚠️⚠️ Une règle qui « annule » un survol peut perdre en silence : la spécificité

**Symptôme.** Au survol, le haut d'un panneau de grille est coupé à plat : coins
arrondis disparus, filet dégradé invisible ; les tuiles du bandeau d'Aujourd'hui
tronquées. Vu par Antonin dans l'app installée (2026-09-23).

**Cause.** La V7 soulevait toute carte par
`.card:not(.card-solid):hover:not(:has(.fixed))` — spécificité (0,4,0) — et
croyait l'annuler dans la grille par `.rgrid-content .card:hover
{ translate: none }` — (0,3,0). **L'annulation ne gagnait jamais.** La carte
montait de 2 px à l'intérieur de son panneau (qui montait aussi), et
l'`overflow: clip` du panneau rognait ses 2 px du haut.

**Pourquoi personne ne l'a vu.** La vérification V7 a mesuré le panneau en
survol FORCÉ, sans survoler la carte elle-même ; le défaut n'existe qu'en vrai
survol. Il est identique dans Chrome : ce n'est pas un défaut WebKit.

**Parade.** Exclure dans le sélecteur même (`:not(.rgrid-content .card)`,
`:not(.overflow-hidden > .card)`) plutôt qu'annuler après coup. Et vérifier un
survol en VRAI survol, en mesurant l'élément ET son parent qui rogne.
`theme.survol.test.ts` interdit le retour de l'annulation.

## 21.11 Vérifier un survol dans WebKit sans prendre le curseur d'Antonin

**Symptôme.** Un WKWebView piloté par script ignore tous les mouvements de
souris synthétiques : `:hover` ne s'allume jamais. Et la page capturée est vide.

**Causes, et parades** (toutes dans `tools/webkit-pilote.swift`) :
1. Fenêtre invisible → WebKit la croit cachée (`visibilityState: hidden`) et ne
   peint plus : couper `_setWindowOcclusionDetectionEnabled:` (appel par IMP,
   pas par KVC — KVC lève une exception).
2. WebKit ignore la souris hors de la fenêtre active : sous-classer `NSWindow`
   pour que `isKeyWindow` rende `true`. Pas besoin d'activer l'app, donc on ne
   vole ni le focus ni le curseur.
3. Passer par `_simulateMouseMove:` (la porte des tests de WebKit).
Le repli « copier les règles `:hover` en classe » fonctionne pour la peinture,
mais ne survole que les éléments marqués — c'est lui qui a caché le § 21.10.

---

# 22. Chantier « pièces jointes » (2026-09-23)

## 22.1 ⚠️⚠️ Deux chantiers, la MÊME migration 027 — et rien ne l'aurait dit

**Symptôme.** Aucun. C'est tout le problème. `027_pieces_jointes.sql` et
`027_corbeille.sql` vivaient dans deux arbres différents, chacun enregistré
sous `version: 27` dans son propre `lib.rs`. Les deux passaient leurs tests.

**Ce qui serait arrivé — et ce n'est PAS une hypothèse.** `sqlx` enregistre une
migration jouée dans `_sqlx_migrations` **par son numéro**. Vérifié sur la vraie
base d'Antonin le 2026-09-24, après coup :

```
$ sqlite3 "$HOME/Library/Application Support/com.atnfx.shale/shale.db" \
    "SELECT version, description, success FROM _sqlx_migrations ORDER BY version DESC LIMIT 2;"
27|corbeille|1
26|feuille_de_route|1
```

**La 027 de la corbeille avait DÉJÀ tourné chez lui.** Une migration des pièces
jointes restée numérotée 027 aurait donc été **sautée en silence** au premier
build : `files` jamais créée, `CHECK` jamais retiré — et une arête citant un
fichier refusée par ce `CHECK`, donc le cycle de synchronisation arrêté (§ 22.3).
Aucune erreur au démarrage, aucun message : le défaut ne se serait vu qu'à la
première pièce jointe, sur SA machine.

**Comment il a été attrapé.** Pas par un test, pas par une relecture : par la
phrase de `CLAUDE.md` qui dit « la 027 de [P-menus] n'est pas fusionnée », lue
quand le fichier s'est chargé en cours de session. Puis
`find ~/Desktop -name "027_*.sql"`, qui a rendu deux fichiers.

**Parade, avant d'écrire la moindre ligne d'une migration :**
```bash
find ~/Desktop -name "0*_*.sql" -not -path "*/node_modules/*" | sort
```
Les worktrees de `~/Desktop/Shale-chantiers/` ne sont PAS dans le dépôt
principal : un `ls src-tauri/migrations` ne les voit pas. Puis **inscrire le
numéro pris dans `~/Desktop/Shale-chantiers/COORDINATION.md`** — c'est le seul
canal entre sessions parallèles, et il existe exactement pour ça.

**Qui cède ?** Le moins avancé. Ici la corbeille avait trois commits et une
phase 2 livrée, les pièces jointes vingt minutes : elles sont passées en 028.
Le précédent est dans l'en-tête de la 026, qui a cédé son 025 à la licence.

## 22.2 ⚠️ `ALTER TABLE … RENAME TO` reparse TOUT le schéma

**Symptôme.**
```
error in trigger notes_links_del: no such table: main.object_links
```
La migration échoue, sur un trigger qu'on n'a pas touché.

**Cause.** Recréer une table impose la séquence `CREATE new` → `INSERT SELECT`
→ `DROP old` → `RENAME`. Or le `RENAME` fait revalider par SQLite **tous les
triggers du schéma** — et entre le `DROP` et le `RENAME`, la table n'existe
plus. Les sept triggers `*_links_del` des autres tables la nomment : ils
deviennent invalides le temps d'une instruction, et ça suffit.

**Parade.** Supprimer ces triggers AVANT la manœuvre et les recréer APRÈS.
`PRAGMA legacy_alter_table = ON` ferait taire l'erreur en deux lignes, mais il
fait dépendre une migration jouée sur les VRAIES données d'un réglage dont le
comportement varie d'une version de SQLite à l'autre.

⚠️ **Et ne PAS recopier les triggers depuis la migration qui les a créés.** La
020 en déclare un `objects_links_del` que la 022 a supprimé avec sa table. Les
lire dans le schéma réel :
```sql
SELECT name, sql FROM sqlite_master WHERE sql LIKE '%object_links%';
```

## 22.3 ⭐⭐ Une contrainte `CHECK` ne refuse pas une ligne : elle arrête le CYCLE

Le § 3.4 disait « une contrainte violée peut arrêter la synchronisation ». La
lecture du moteur, ce jour-là, a montré que c'est plus dur que ça.

`appliquerReçue` (`sync/engine.ts`) ne rattrape que `ParentManquant` et
**relance tout le reste**. Une erreur SQL traverse donc `enApplication`, fait
échouer le cycle entier — et comme le curseur n'avance pas, **la même page
repart échouer à l'identique, indéfiniment**. Ce n'est pas une ligne perdue,
c'est la synchronisation de l'appareil qui s'arrête pour toujours.

▶️ **Conséquence pratique** : ajouter une valeur à une énumération contrainte
en SQL (un `kind`, un `origin`, un `status`) est un changement à **DEUX temps**
— jamais un seul. Soit on retire la contrainte (c'est ce qu'a fait la 028 pour
`object_links`), soit on s'assure que la valeur neuve **ne quitte jamais la
machine** tant que tous les appareils n'ont pas la migration. La 028 fait les
deux : `CHECK` retiré ici, et garde `<> 'file'` sur les triggers d'outbox.

## 22.4 ⚠️ Un test qui lit `sqlite_master` lit AUSSI les commentaires

**Symptôme.** Un test « la table ne porte plus de `CHECK` » échoue en désignant
un `CHECK`… qui est dans le commentaire expliquant pourquoi il a été retiré.

**Cause.** `sqlite_master.sql` rend le texte INTÉGRAL du `CREATE TABLE`,
commentaires compris. Sur un dépôt qui commente ses migrations aussi
abondamment que celui-ci, c'est la règle et non l'exception.

**Parade.** Retirer les commentaires avant de chercher, et viser la forme
syntaxique et non le mot :
```js
const schema = sql.replace(/--[^\n]*/g, "");
expect(schema).not.toMatch(/\bCHECK\s*\(/i);
```
⚠️ Sans ce nettoyage, le réflexe est de « réparer » le test en effaçant le
commentaire — donc de supprimer l'explication pour faire passer la vérification.

## 22.5 ⚠️ Un U+00A0 littéral dans la source est indistinguable d'une espace

**Cause.** Un jeton `contenteditable="false"` en fin de bloc emprisonne le
curseur : il faut une espace insécable derrière pour pouvoir continuer à taper.
Écrite en caractère littéral, elle est **invisible à la relecture** — et le
premier nettoyage venu la remplace par une espace ordinaire, rouvrant le défaut
sans que rien ne le signale.

**Parade.** Une constante nommée, en échappement : `const ESPACE_INSECABLE =
"\u00a0"`. La remplacer demande alors de le vouloir.

## 22.6 ⭐ « Ce fichier n'a aucun test, et c'est structurel » était FAUX

**Symptôme.** Trois modules DOM du dépôt (`mentionsDom`, `carteDom`, et la
première version de `piecesJointesDom`) portent en tête la même affirmation :
pas de test possible, les tests tournent en `environment: "node"`.

**Cause.** La config GLOBALE est bien en `node` — mais un fichier de test peut
en demander une autre par un simple docblock `// @vitest-environment happy-dom`,
et **deux fichiers du dépôt le faisaient déjà** (`sync/sas.test.ts`,
`sync/planificateur.test.ts`). `happy-dom` est une dev-dépendance depuis
toujours.

**Ce que ça a coûté / rapporté.** `piecesJointesDom.test.ts` couvre en 13 tests
l'insertion, les trois états d'affichage et la remontée du clic — dont un défaut
(le clic qui n'atteint pas l'enfant cliqué) qui serait passé pour de
l'imprécision de souris.

▶️ **La leçon dépasse le cas** : une affirmation d'impossibilité recopiée de
module en module ne se vérifie jamais. `mentionsDom.ts` et `carteDom.ts`
restent sans tests, et **rien ne s'y oppose** — c'est une dette, pas une
fatalité.

## 22.7 ⚠️ Le panneau intégré rend un viewport 0×0 — mesuré, pas supposé

Rappel du piège déjà connu, confirmé ce jour-là faute de Chrome disponible :
```js
({ viewport: `${innerWidth}x${innerHeight}`, visible: !document.hidden,
   racineMontee: !!document.querySelector("#root")?.firstElementChild })
// → { viewport: "0x0", visible: false, racineMontee: false }
```
▶️ **Toujours mesurer ces trois valeurs avant de croire une observation faite
dans le panneau.** Une racine non montée et un viewport nul font passer une app
parfaitement saine pour du code cassé.

## 22.8 ⚠️ `webkit-pilote.swift` : le SURVOL marche, le CLIC non

**Symptôme.** Un pas `{"clic":[x,y]}` ne produit aucun événement DOM : un
écouteur `click` posé en capture ne voit rien, et le bouton visé ne réagit pas.

**Ce qui l'établit, et c'est la partie qui compte.** Le doute porte toujours sur
son propre code. La contre-épreuve consiste à cliquer un bouton LIVRÉ ET CONNU
POUR MARCHER — ici « Carte mentale », dans la barre d'outils des Notes. Il ne
s'ouvre pas davantage. Le défaut est donc dans l'outil, pas dans le code testé.

**Cause probable.** `souris()` n'emprunte `_simulateMouseMove:` que pour
`.mouseMoved` ; les boutons passent par `win.sendEvent`, qui ne remonte pas
jusqu'à la `WKWebView` dans cette configuration (fenêtre `borderless`,
`alphaValue 0.01`). L'outil a été écrit pour le SURVOL — c'est ce qu'annonce son
en-tête — et il le fait très bien.

**Ce qu'on peut vérifier malgré tout, et qui vaut presque autant :**
```js
document.elementFromPoint(x, y)            // ce qu'un vrai clic TOUCHERAIT
  .closest("[data-fichier]")               // ce à quoi il remonterait
```
C'est ce qui a confirmé, sur le vrai moteur, que le clic sur une pièce jointe
atterrit sur l'enfant `.pj-nom` et **jamais sur le jeton** — donc que le
`closest()` de `pieceJointeCliquee` n'est pas une précaution mais la condition
pour que le clic fonctionne (§ 18.1, cas réel et non hypothétique).

▶️ **Ne pas conclure « le clic est vérifié » avec cet outil.** Le survol, la
géométrie, les styles calculés et les captures : oui, et c'est beaucoup.

## 22.9 ⛔⛔ UN TROU dans la suite des migrations EMPÊCHE L'APP DE DÉMARRER

**C'est la conséquence opérationnelle du § 22.1, et elle est plus grave que la
collision elle-même.**

Au 2026-09-24, l'état est celui-ci :

| | version des migrations |
|---|---|
| La **base réelle** d'Antonin | **27** (`corbeille`, jouée le 2026-09-23) |
| La branche **`mobile-ios`** | 026, puis **028** — la 027 n'y est pas |
| La branche `chantier/menus-contextuels` | 027, non fusionnée |

✅ *(2026-09-24)* Fusionnée : `mobile-ios` porte 027 puis 028. Le tableau
ci-dessus décrit l'état du 23 au soir ; la leçon, elle, reste.

**Ce qui se passe si on construit l'app depuis `mobile-ios` seul.** `sqlx`
valide, à CHAQUE démarrage, que toute migration enregistrée dans la base existe
encore dans la liste compilée :

```rust
// sqlx-core-0.8.6/src/migrate/migrator.rs:28 et :161
fn validate_applied_migrations(...) {
    if migrator.ignore_missing { return Ok(()); }   // ← false par défaut (:51)
    for applied in applied_migrations {
        if !migrations.contains(&applied.version) {
            return Err(MigrateError::VersionMissing(applied.version));
        }
    }
}
```

`tauri-plugin-sql` n'appelle **jamais** `set_ignore_missing`. Donc : la base dit
« 27 jouée », le binaire ne connaît pas de 27, et le démarrage échoue sur
`VersionMissing(27)`. **L'app ne s'ouvre plus du tout** — pas un module cassé,
pas une table manquante : la porte d'entrée.

▶️ **LA RÈGLE, jusqu'à ce que la 027 soit sur le tronc : ne JAMAIS construire
l'app depuis `mobile-ios` sans avoir fusionné `chantier/menus-contextuels`
d'abord.** Le contrôle avant tout build natif tient en une commande :

```bash
sqlite3 "$HOME/Library/Application Support/com.atnfx.shale/shale.db" \
  "SELECT version FROM _sqlx_migrations ORDER BY version;"   # ce que la BASE a
ls src-tauri/migrations/                                      # ce que le BUILD aura
```
Toute version présente à gauche et absente à droite est un refus de démarrage.

⚠️ **Et la réciproque est bénigne** : une migration présente dans le binaire mais
absente de la base est le cas NORMAL — c'est une migration à jouer. Seul le sens
« la base en sait plus que le binaire » tue.


# 19 bis. Menus contextuels — la vérification complète (2026-09-24)

> § 19.19–19.21 : suite du 2026-09-25 (contrôles au survol, pièces jointes muettes, cache Vite).

*Numérotés à la suite du § 19, placés ici parce que le § 22 a été écrit entre
les deux. Quatre défauts, tous invisibles aux tests et au build, tous trouvés
en pilotant Chrome.*

## 19.15 ⚠️⚠️ Un écouteur clavier en CAPTURE sur `window` passe avant le menu

**Symptôme.** Clic droit sur un nœud de carte mentale, puis Échap : le menu se
ferme… et l'éditeur de carte AUSSI. On perdait la carte ouverte en voulant
seulement renoncer à un menu.

**Cause.** `EditeurCarte` (comme `SketchPad` et `DepuisCarte`) écoute
`keydown` sur `window` en phase de CAPTURE — c'est ce qui lui permet de passer
avant le lecteur de note. Il passait donc aussi avant le menu, qui n'avait pas
encore reçu la touche qu'il aurait marquée (`preventDefault`).

**Parade.** `menuContextuelOuvert()` (`lib/menu/tactile.ts`) : les trois
écouteurs de capture rendent la main tant qu'un `[data-menu-contextuel]` est
dans le document. Tout NOUVEL écouteur de capture doit faire de même.

## 19.16 ⚠️⚠️ Un menu en `z-[60]` se peignait SOUS les fenêtres

**Symptôme** (trouvé par lecture, confirmé par `elementFromPoint`). Le menu
vivait à `z-[60]` ; le lecteur du Savoir est à `z-[70]`, l'éditeur de carte à
`z-[75]`, plusieurs fenêtres à `z-[80]`. Un menu ouvert DANS l'une d'elles
existait, avait le focus, et ne se voyait pas.

**Parade.** `z-[95]` (sous-menu `z-[96]`) : au-dessus de toute fenêtre, sous le
sélecteur de date (190) et les bulles (200). La preuve à rejouer : le point
central de la première entrée doit rendre CETTE entrée par
`document.elementFromPoint` — une capture ne suffit pas, un menu recouvert
peut sembler « un peu terne ».

## 19.17 ⚠️⚠️ Ouvert sur un bloc d'un `contenteditable`, le menu n'a PAS le focus

**Symptôme.** Dans le lecteur du Savoir, clic droit sur une carte de la fiche,
puis Échap : le lecteur se FERMAIT avec le menu. Mesuré : `activeElement`
était l'éditeur (`.note-rich`), pas le panneau du menu.

**Cause.** Le clic droit dans un `contenteditable` y laisse (ou y remet) le
focus, et le lecteur écoute Échap sur `window` : la touche partait chez lui.

**Parade.** Tant qu'il est ouvert, `MenuContextuel` écoute `keydown` en
CAPTURE sur `window` : une touche de menu née HORS du menu lui est rendue
(focus sur le panneau, puis le même `surTouche`). Le clavier est au menu
ouvert, où que soit le focus — comme un menu du système.

## 19.18 Outil : sous émulation tactile, `Input.dispatchMouseEvent` peut ne jamais rendre la main

**Symptôme.** Script CDP bloqué indéfiniment sur un clic, avec
`Emulation.setEmitTouchEventsForMouse` actif.

**Parade.** Au doigt, toucher par `Input.dispatchTouchEvent`
(`touchStart` puis `touchEnd`) : c'est le vrai geste, et il rend la main.
Arrêter un script bloqué par le PID exact de son Node et de SON Chrome
(`--remote-debugging-port=9333`), jamais par motif.

**Payé.** 2026-09-24, vérification complète demandée par Antonin après « je ne
peux pas supprimer une carte mentale dans une note avec un clic droit ».

## 19.19 ⚠️⚠️ `opacity-0` CACHE un bouton, il ne LIBÈRE PAS sa place

**Symptôme.** Sur téléphone, les noms de tâches d'Aujourd'hui se coupaient
au milieu des mots (« Sessio n… », « Publi er u… »), mesuré à 390 px. Le
▶ « Focus 25 min » était invisible au doigt (révélé au survol seulement), et
pourtant ses 28 px comptaient.

**Cause.** Un bouton en `opacity-0` reste dans la mise en page. « Révélé au
survol » coûte donc sa place même là où le survol n'existe pas.

**Parade.** Au doigt, un contrôle de survol se RETIRE (`[@media(pointer:coarse)]:hidden`)
quand son action est ailleurs (ici : l'entrée « Focus 25 min » du « ⋯ »,
toujours visible au doigt). Sinon il se RÉVÈLE (`[@media(pointer:coarse)]:opacity-100`).
Il ne reste jamais invisible en gardant sa place.

**Payé.** 2026-09-25, en rendant le ▶ visible au doigt : la capture a montré
que la place était prise depuis toujours.

## 19.20 ⚠️⚠️ `void promesse()` jette le `false` ET l'erreur : un échec devient muet

**Symptôme.** Cliquer une pièce jointe dont les octets ne sont pas sur cet
appareil ne faisait RIEN. C'est pourtant le cas normal sur un second appareil,
puisque les octets ne se synchronisent jamais.

**Cause.** Cinq appelants écrivaient `void ouvrirPieceJointe(uid)`. Le booléen
rendu (`false` = « pas ici ») était jeté, et l'exception aussi.

**Parade.** Un seul chemin, `lib/piecesJointesOuvrir.tsx`
(`ouvrirPieceJointeOuDire`), qui DIT l'échec dans un toast avec l'icône
d'alerte (pas la coche verte par défaut, qui dirait « réussi »). Avant d'écrire
`void f()`, lire ce que `f` rend.

**Payé.** 2026-09-25, en vérifiant enfin le clic sur une pièce jointe à l'écran
(il ne l'avait jamais été).

## 19.21 Outil : Vite garde en cache un fichier RENOMMÉ `.ts` → `.tsx`

**Symptôme.** Page blanche en démo, sans erreur dans le navigateur. Le journal
de Vite dit : `Failed to load url /src/lib/X.ts … Does the file exist?`.

**Parade.** Relancer le serveur. L'arrêter par les PID exacts de `npm exec vite`
et de son enfant (`pgrep -P`), jamais par motif. Lire le journal de Vite AVANT
de soupçonner le code.

# 23. App Store — l'app iPhone qui ne vend rien (2026-09-29)

## 23.1 ⛔ Une « mention neutre » qui NOMME le site est une incitation

**Symptôme.** La branche `mobile-ios` portait déjà des gardes `IS_IOS` sur le
paywall et le mur d'abonnement, commentées « aucun CTA de paiement (règle
3.1.1) ». Elles remplaçaient le bouton par un texte non cliquable :
« Ton compte se gère sur shaleapp.com. », « Shale Trade se gère depuis ton
compte sur shaleapp.com. » — sous le titre « Abonnement requis ».

**Cause.** La règle qui s'applique (3.1.3(f)) interdit l'achat dans l'app
**et** « calls to action for purchase outside of the app ». Un titre
« abonnement requis » + l'adresse du site EST un appel à acheter ailleurs, lien
ou pas. Et le cadenas, le bandeau d'essai, le lien de Réglages et
l'inscription n'étaient pas gardés du tout.

**Parade.** `src/lib/boutique.ts` décide seul (`COMMERCE_AUTORISE`), et un
compte sans abonnement reçoit un CONSTAT : « Aucun abonnement actif n'est
associé à ce compte. » + déconnexion. Ni nom d'offre, ni site, ni « revérifier ».
`ios-sans-achat.test.ts` rend les écrans et refuse `shaleapp`, `formule`,
`Shale Trade`, etc. (`MOBILE.md` § 25).

**Payé.** Rien encore — trouvé à l'audit avant toute soumission. C'est le motif
de refus le plus courant de l'App Store.

## 23.2 `renderToStaticMarkup` échappe l'apostrophe : `&#x27;`

**Symptôme.** Un test qui cherche `"J'ai souscrit — revérifier"` dans le HTML
rendu échoue alors que le bouton est bien là.

**Parade.** Décoder `&#x27;` et `&amp;` avant de comparer (fait dans
`boutons()` de `ios-sans-achat.test.ts`), ou chercher la forme échappée.
Rendre en `react-dom/server` sous `environment: "node"` suffit pour lire un
écran : pas besoin de happy-dom tant que le composant ne touche pas au DOM au
rendu (`createPortal` le fait — d'où l'intérêt que `UpgradeModal` sorte AVANT).

## 23.3 ⛔ Un second build iOS dans un worktree remplit le disque — et sort en code 0

**Symptôme.** Le build iOS « Finished » dans le journal, `echo $?` rend 0, mais
`gen/apple/build/arm64-sim/` est VIDE. Juste après, toute commande échoue sur
« no space left on device ».

**Cause.** Chaque worktree a son propre `src-tauri/target` : un build iOS de
simulateur y pèse **3,7 Go**. Avec ~4 Go libres, le second build de la session a
rempli le disque au moment d'archiver `libshale_lib.a` (« os error 28 »,
`ARCHIVE FAILED`) — et `tauri ios build` a quand même rendu 0 (même famille que
le piège du `rm -rf` sans préfixe, `MOBILE.md` § 12).

**Parade.** `df -h /` AVANT un build iOS ; **exiger 8 Go libres**. Juger un
build au contenu de `arm64-sim/`, jamais au code de sortie ; `grep -i "error"`
dans le journal. Après la session, supprimer le `src-tauri/target` du worktree
(régénérable). ⚠️ Disque plein = l'app Mac d'Antonin ne peut plus écrire sa base.

**Payé.** 2026-09-29 : le parcours « compte sans abonnement » n'a pas pu être vu
au simulateur (`MOBILE.md` § 25.5).

---

# 24. Chantier « cartes déplaçables et typées · carte d'objectif éditable » (2026-09-29)

*Les pièges payés pendant les phases A à C. Tous trouvés à l'écran (Chrome sans
fenêtre, mode démo) ou en écrivant les tests — aucun par un test au vert.*

## 24.1 ⚠️⚠️ `lireCarte` JETTE les champs qu'il ne connaît pas — une version antérieure EFFACE ce qu'elle réécrit

**Symptôme (attendu, jamais vu faute d'appareil ancien).** Un nœud posé à la
main, ou un nœud-habitude, redevient automatique / une idée sur un appareil
resté en version antérieure — puis PARTOUT, dès que cet appareil réécrit le bloc.

**Cause.** `lireCarte` reconstruit chaque nœud champ par champ
(`lib/carte.ts`). Ce qui n'est pas dans sa liste n'est pas recopié : `pos`,
une `ref` de famille `habit` (écartée par `estKindDeCarte` d'une version qui
ne la connaît pas), `genre`. Le cadrage disait « une version antérieure ignore
le champ » : vrai à la LECTURE, faux à l'ÉCRITURE. `cote`/`teinte` ont eu
exactement ce sort le 2026-09-08, et personne ne l'avait écrit.

**Parade.** Aucune côté nouveau code — le vieux code est figé. Tous les
appareils à la même version (dette écrite dans `MOBILE.md`, chantier iOS).
▶️ **Tout champ ajouté à `Noeud` hérite de ce risque** : le dire dans son
commentaire, comme `pos` le fait.

**Payé.** Rien encore : trouvé en lisant `lireCarte` pendant l'audit (phase 0).

## 24.2 ⚠️ `onClick={fonction}` passe l'ÉVÉNEMENT comme premier argument — « Tout voir » zoomait à NaN

**Symptôme.** Le bouton « Tout voir » de l'éditeur de carte ne cadre plus rien.

**Cause.** `<Outil onClick={toutVoir}>` : le bouton appelle `toutVoir(event)`.
Le 2026-09-20, `toutVoir` a reçu un paramètre facultatif (`plancher`) — et
l'événement de clic est devenu le plancher : `Math.max(event, …)` = `NaN`.
Rien ne l'a dit : le type de `onClick` est `() => void`, qu'une fonction à
paramètre facultatif satisfait.

**Parade.** `onClick={() => toutVoir()}` dès qu'une fonction a un paramètre,
même facultatif. Et ajouter un paramètre à une fonction déjà branchée sur un
`onClick` = relire tous ses `onClick`.

**Payé.** Déduit du code le 2026-09-29 (non reproduit : corrigé avant d'ouvrir
l'écran). Le bouton cadre bien après correction.

## 24.3 ⚠️ Une clé i18n à deux sens : « annuler » voulait dire « undo », et le pied disait « Esc undo »

**Symptôme.** App en anglais, suppression d'un nœud armée : « **Esc undo** ».

**Cause.** `"annuler": "undo"` sert à ⌘Z. Sous Échap, « annuler » veut dire
RENONCER. Même famille que « Carte » = « Card » (§ 18.3), sauf qu'ici la clé
n'était pas en double : elle était juste FAUSSE dans un contexte. Aucun outil
ne le voit — la clé existe, elle est traduite.

**Parade.** Le discriminant de contexte : `t("annuler|renoncer")` → « cancel ».
Corrigé aux trois pieds (suppression en deux temps, qui l'avait depuis le
2026-09-22, « Réorganiser » et le rattachement).

**Payé.** Vu à l'écran pendant le parcours en anglais, 2026-09-29.

## 24.4 ⚠️ Une classe Tailwind qui n'existe pas ne dit rien : `gradient-brand`

**Symptôme.** La jauge d'une étape, dans la couche vivante de la carte, aurait
été invisible.

**Cause.** Le dégradé de marque n'est pas une classe mais un token
(`--gradient-brand`). La forme du dépôt est `bg-[image:var(--gradient-brand)]`.
C'est le § 6.3, sous une autre forme : une classe inconnue échoue EN SILENCE.

**Parade.** Avant d'écrire une classe de couleur neuve, la chercher dans une
vue qui l'emploie déjà (`grep -rn "gradient-brand" src/views`).

**Payé.** Attrapé en relisant avant la mise à l'écran.

## 24.5 ⚠️ Deux écouteurs clavier EN CAPTURE sur `window` : l'ordre est celui du dernier réabonné

**Symptôme (évité).** Échap dans un panneau ouvert sur la carte (« Type »,
« En faire un objectif ») fermerait la carte ENTIÈRE.

**Cause.** L'éditeur et le panneau écoutent tous deux `keydown` en capture sur
`window`. L'éditeur se désabonne et se réabonne à chaque changement de ses
dépendances : selon ce qui a bougé en dernier, il passe AVANT le panneau.

**Parade.** Un garde explicite en tête de l'écouteur de l'éditeur :
`if (typage || versObjectif) return;` — le panneau ouvert a les touches. Ne
jamais compter sur l'ordre d'abonnement.

**Payé.** Vu en écrivant le panneau « Type » ; « En faire un objectif » avait
le même trou depuis le 2026-09-20.

## 24.6 ⚠️ Outil — puppeteer : `{ clickCount: 2 }` n'envoie PAS de `dblclick`

**Symptôme.** Un double-clic piloté sur un bloc de carte ne rouvre pas
l'éditeur. On croit le geste cassé.

**Cause.** Dans `puppeteer-core` récent, `clickCount` fixe le `detail` de
l'événement, pas le NOMBRE de clics. `{ count: 2 }` fait deux clics, donc un
`dblclick`.

**Parade.** `page.mouse.click(x, y, { count: 2 })`.

**Payé.** 2026-09-29, une fausse alerte.

## 24.7 ⚠️ Outil — une émulation CDP (`setDeviceMetricsOverride`) meurt avec la session qui l'a posée

**Symptôme.** Un parcours « au doigt » à 390 pt produit des captures en
largeur bureau, avec des coordonnées hors de l'écran (x = 597 sur 390).

**Cause.** L'émulation vit dans la session DevTools du script. `browser.
disconnect()` à la fin d'un script la referme — et l'émulation avec elle. Les
gestes tactiles, eux, arrivent bien (`pointerType: "touch"`).

**Parade.** Émuler, agir et mesurer DANS LE MÊME script ; rendre la main par
`clearDeviceMetricsOverride` à la fin.

**Payé.** 2026-09-29, une série de mesures à refaire.

## 24.8 ⚠️ Outil — le rechargement à chaud de Vite VIDE la démo au milieu d'un parcours

**Symptôme.** Après une modification de code, le parcours piloté ne trouve
plus la carte qu'il venait de créer.

**Cause.** Modifier certains modules (ici `EditeurCarte`, `CarteObjectif`)
provoque un rechargement COMPLET de la page ; les données de la démo vivent
en mémoire (`demo.ts`) : elles repartent de zéro, et l'accueil de connexion
revient.

**Parade.** Un script de remise en place (`connexion → module → données`) à
rejouer avant chaque scénario qui suit une modification.

## 24.9 Rappel mesuré : le patch de démo fait tomber `licence/transport.test.ts`

Deux échecs (« une ligne → profil », « aucune ligne → aucun ») avec
`SUPABASE_URL = ""`. Sans le patch : 13/13. C'est le § 1.2 ter, pour une
suite de plus. **Rejouer ce fichier sans le patch avant de conclure.**

## 24.10 Un bouton « retour » posé DANS la zone qui défile part avec le contenu

**Symptôme.** Sur iPhone (390 pt), dans la fiche d'un objectif, on descend dans
la feuille de route : « ← Tous les objectifs » a disparu, il faut remonter tout
en haut pour sortir.

**Cause.** Le retour était le premier enfant de la `<section>` en
`overflow-y-auto` : il défile avec elle. Les Notes ne le montraient pas, parce
que leur fiche ne défile pas en bloc (c'est le champ de texte qui défile).

**Parade.** Le retour vit HORS de la zone qui défile : un conteneur
`flex flex-col min-h-0`, le bouton en `shrink-0`, la fiche en
`flex-1 overflow-y-auto` (`GoalsView`). Même règle pour toute barre d'en-tête
d'une vue en maître-détail.

**Payé.** 2026-09-29, trouvé par le parcours piloté — qui a lui-même raté le
bouton (§ 24.12).

## 24.11 Une ponctuation française collée à `t()` dans le JSX passe telle quelle en anglais

**Symptôme.** VoiceOver lit « Next action : » en anglais — l'espace avant les
deux-points est française.

**Cause.** `{t("Prochaine action")} :` : les deux-points sont HORS de la clé.
`i18n:check` ne voit que les clés, `i18n:durs` que les chaînes de plus d'un mot
— une ponctuation isolée ne relève d'aucun des deux.

**Parade.** La ponctuation qui dépend de la langue passe par `pick(" :", ":")`,
ou entre DANS la clé. Chercher `")} :` et `")} ;` dans le JSX avant de livrer.

**Payé.** 2026-09-29, vu au texte de la page en anglais. Corrigé large : le seul
autre cas trouvé par cette recherche (« Déposés auprès d'iOS : », `SettingsView`,
visible sur iPhone seulement) l'est aussi.

## 24.12 ⚠️ Outil — `page.touchscreen.tap` sur un élément HORS de l'écran tape à côté

**Symptôme.** Au doigt émulé, un bouton trouvé (`$` le rend) ne réagit pas au
toucher ; l'état attendu n'arrive pas, sans erreur.

**Cause.** `boundingBox()` rend des coordonnées hors du viewport quand
l'élément est plus bas dans une zone qui défile ; `touchscreen.tap` tape à ces
coordonnées-là, c'est-à-dire sur rien. `page.click` fait défiler, le toucher
non.

**Parade.** `el.scrollIntoView({ block: "center" })` avant `boundingBox()`, dans
l'aide de toucher elle-même (`tel.mjs` du chantier).

**Payé.** 2026-09-29, deux parcours à rejouer.

## 24.13 ⭐ Un toast VISIBLE au-dessus d'un éditeur plein écran, mais INERTE

**Symptôme.** On supprime un nœud dans une carte mentale (ou dans la carte d'un
objectif) : le toast « … est dans Supprimés récemment · Annuler » s'affiche
bien, par-dessus l'éditeur — et « Annuler » ne répond pas au clic. Il ne
répondait pas davantage au clavier.

**Cause.** L'hôte global des toasts est rendu par `App.tsx`, donc DANS `#root`.
Les éditeurs plein écran (`EditeurCarte`, `SketchPad`) posent `inert` sur
`#root` pour garder le clavier chez eux (§ 18.1). `z-[90]` le fait passer
au-dessus visuellement (l'éditeur est en `z-[75]`) ; `inert`, lui, ne regarde pas
le `z-index` : tout ce qui vit sous `#root` est mort au pointeur. Livré ainsi
avec la carte d'objectif éditable, le soir même — les preuves de restauration
passaient par la vue « Supprimés récemment », jamais par le toast.

**Parade.** L'hôte global est porté sur `document.body` (`createPortal`), hors
de `#root`. Règle générale : **tout ce qui doit rester cliquable pendant un
éditeur modal vit hors de `#root`** — l'éditeur lui-même, ses menus, et les
toasts qu'il provoque. Vérifier par `elementFromPoint` au centre du bouton ET
`bouton.closest("[inert]")` — l'un sans l'autre ne prouve rien.

**Payé.** 2026-09-29, trouvé en câblant la suppression qui emporte l'objet.

# 26. Timer — horloge à volets et fenêtre séparée (2026-09-29)

## 26.1 ⚠️⚠️ Une API de fenêtre Tauri sans SA permission échoue en silence — et un `catch` la rend invisible

**Symptôme.** Aucun, et c'est le problème. `peindreLaFenetre()` (`lib/theme.ts`)
appelle `getCurrentWindow().setBackgroundColor(…)` au démarrage et à chaque
changement de thème, dans un `try/catch` commenté « du confort visuel, jamais un
blocage ». Rien ne signale qu'elle échoue.

**Cause.** Chaque commande de fenêtre exige sa permission dans la capacité de la
fenêtre qui l'appelle. `core:window:allow-set-background-color` n'est **ni dans
`capabilities/default.json`, ni dans `core:window:default`** (lu dans
`src-tauri/gen/schemas/acl-manifests.json` le 2026-09-29 : le jeu par défaut ne
contient que des lectures — `is-*`, tailles, positions, thème). L'appel est donc
très probablement refusé depuis qu'il existe, et le `catch` l'avale.
⚠️ **Raisonné, pas observé** : personne n'a regardé la console de l'app native.

**Parade.** Pour une NOUVELLE fenêtre : poser la couleur **à la création**
(option `backgroundColor` de `WebviewWindow`), qui ne demande aucune permission —
c'est ce que fait `ouvrirFenetreTimer()`. Pour la fenêtre principale :
⚠️ **ne PAS ajouter la permission telle quelle** — `default.json` couvre aussi la
fenêtre `capture`, TRANSPARENTE, et `main.tsx` appelle `peindreLaFenetre` dans
toutes les fenêtres : la barre de capture deviendrait un rectangle opaque. Il
faudrait d'abord que `peindreLaFenetre` épargne `capture`. Non fait (hors du
chantier Timer).

**Généralisation.** Toute nouvelle commande de fenêtre appelée depuis le front
(`setFullscreen`, `setAlwaysOnTop`, `close`, `startDragging`…) → chercher sa
permission dans la capacité de la fenêtre **qui l'appelle**, avant d'écrire le
`catch`. Un `catch` silencieux autour d'un appel natif ne doit jamais être la
première ligne de défense.

**Payé.** Rien encore — trouvé en écrivant la capacité `timer.json`.

> ### ⭐ Mis à jour le 2026-09-30 — PROUVÉ, deux fois, et corrigé
> Le « raisonné, pas observé » ci-dessus est levé :
> - **Par l'ACL réelle.** `src-tauri/tests/permissions_fenetres.rs` interroge
>   l'autorité que `generate_context!` compile depuis `capabilities/*.json` — la
>   même que dans le binaire — pour chaque appel natif du front (41 couples
>   fenêtre × commande). Lancé AVANT correction, il a rendu exactement deux
>   refus, tous deux dans `main` : `set_background_color`, et
>   **`start_dragging`** — la poignée `data-tauri-drag-region` de `Sidebar.tsx`,
>   « la seule poignée de la fenêtre », que `drag.js` de Tauri traduit en cette
>   commande. Même défaut, second exemplaire, présent depuis l'import du 2 août.
> - **Par le binaire installé** (`bc1c9f36…`, build du 29/09 23:40) : la clé
>   `plugin:window|set_background_color` y apparaît **0 fois**, quand chaque
>   commande accordée (`hide`, `set_focus`, `set_size`…) y figure.
>
> ⚠️ **Et la permission seule n'aurait RIEN réparé** : même autorisé, l'appel
> envoyait l'argument sous le mauvais nom (§ 26.6). Le correctif naïf aurait
> même empiré le thème sombre sur un macOS clair.
>
> **Corrigé** (`chantier/fond-fenetre`) : nouvelle capacité
> `capabilities/fenetre-principale.json`, réservée à `main` (fond +
> déplacement) ; `peindreLaFenetre` ne peint QUE `main` (liste d'une fenêtre
> autorisée, pas de fenêtres exclues) ; `invoke` direct avec `value` ; le `catch`
> journalise au lieu de se taire. Contre-épreuve faite : la permission remise
> dans `default.json` fait échouer le test sur `[capture]`.
>
> **Ce que le refus masquait** : rien ne repeignait la fenêtre quand macOS change
> d'apparence en cours de route (réglage « Système ») — la page suivait par sa
> media query, pas la fenêtre. Ajouté : `suivreLApparenceDuSysteme()`.
>
> **Parade, désormais outillée** : tout nouvel appel natif du front entre dans
> `APPELS` du test, avec la fenêtre QUI L'APPELLE. `cargo test --test
> permissions_fenetres` (il ne tourne PAS avec `cargo test --lib`).

## 26.2 ⚠️ Le patch démo du § 13.2 de `PASSATION.md` est refusé par le garde-fou du mode automatique

**Symptôme.** 2026-09-29 : la modification locale de `auth/config.ts` et
`auth/useAuth.ts` (mode démo, jamais commitée) est refusée par le classificateur
du mode automatique (« Security Weaken »). Le refus s'étend ensuite à ce qui sert
le même but — y compris lancer le serveur de dev pour regarder l'interface.

**Cause.** Le patch désactive l'authentification ; le garde-fou le juge comme tel,
quel que soit l'usage (local, jamais commité).

**Parade.** Ne pas contourner. **Demander à Antonin, AU DÉBUT du chantier**, s'il
autorise la procédure du § 13.2 pour la session (ou s'il la lance lui-même) —
pas au moment où on en a besoin, quand tout le reste est écrit et qu'il n'y a
plus qu'à regarder.

**Payé.** Le chantier Timer du 2026-09-29 est livré sur sa branche **sans avoir
été vu à l'écran**.

## 26.6 ⚠️⚠️ `@tauri-apps/api` 2.11 : `setBackgroundColor(c)` envoie `{ color }`, Rust lit `value` — et un `Option` absent devient `None` sans erreur

**Symptôme.** Aucun, encore. La promesse se résout, aucune erreur. Mais la
fenêtre prend le fond **du système** (gris clair si macOS est clair, sombre
sinon), pas la couleur passée.

**Cause.** `node_modules/@tauri-apps/api/window.js` (2.11.1) :
`invoke('plugin:window|set_background_color', { color })`. Côté Rust (tauri
2.11.5, `window/plugin.rs`) : `setter!(set_background_color, Option<Color>)`,
dont l'argument s'appelle `value`. Et `ipc/command.rs` (`deserialize_option`) :
**une clé absente est lue comme `None`**, pas comme une erreur. `None` sur une
fenêtre opaque = `setBackgroundColor(nil)` = fond système (tao,
`platform_impl/macos/window.rs`). Bogue amont, corrigé dans `@tauri-apps/api`
**2.12.0** (`{ label, value: color }`) — même défaut, même correction, pour
`Webview.setBackgroundColor`.

**Parade.** Tant que le paquet JS est en 2.11 : `invoke` direct avec
`{ value }` (`lib/theme.ts`). ⚠️ **Ne pas monter `@tauri-apps/api` seul** : ses
versions suivent les crates Rust (§ 11.x du 2026-09-26 de `PASSATION.md`), on
monte les deux ensemble. `theme.fenetre.test.ts` fait tourner la VRAIE
bibliothèque sur un faux pont IPC : son premier test échouera le jour de la
montée en 2.12 — c'est le signal pour revenir à `setBackgroundColor`.
**Généralisation** : une commande Tauri dont un argument est `Option<T>` ne dira
JAMAIS qu'on lui a mal nommé cet argument. Pour un appel natif dont l'effet ne
se voit pas, lire la signature Rust, pas seulement la doc JS.

Vérifié le 2026-09-30 pour les autres appels du front : `set_size`,
`set_fullscreen`, `set_always_on_top` envoient bien `value` en 2.11.1 ; `show`,
`hide`, `set_focus`, `unminimize`, `close` n'ont pas d'argument à nommer. Seul
`setBackgroundColor` (fenêtre et webview) est touché.

**Payé.** Rien — trouvé en lisant les sources avant d'ajouter la permission.
Sans cette lecture, le correctif « ajouter la permission » serait parti tel quel.

## 26.7 Outil — un worktree neuf recompile tout le Rust à froid ; le disque ne le supporte pas

**Symptôme.** 2026-09-30 : 4,5 Go libres ; le `target/debug` du worktree
principal pèse 4,9 Go. Un `cargo test` dans un worktree de `Shale-chantiers/`
le reconstruirait en entier.

**Parade.** `CARGO_TARGET_DIR=~/Desktop/Shale-projet/Shale/src-tauri/target
cargo test …` depuis le worktree : les dépendances sont reprises, seule la
crate `shale` se recompile (35 s). Pas de collision : le chemin du paquet entre
dans l'empreinte de ses artefacts, et cargo verrouille le dossier par profil (un
`tauri build` en release à côté n'est pas gêné). ⚠️ Ne pas le faire pour un
`tauri build` : le build natif part du worktree principal (§ 13.1 de
`PASSATION.md`).

**Payé.** Rien — mesuré avant de lancer.

## 27.1 ⚠️ `DAY_SHORT` vivait encore dans deux écrans — et les deux outils i18n restaient verts

**Symptôme.** Dans l'app anglaise, les rythmes des Tâches s'affichaient
« quotidien », « lun–ven », « lun, mer, ven », et l'axe du graphique de la
semaine « lun, mar… ». Vu en refaisant la vue Tâches, 2026-09-30.

**Cause.** `recurrenceLabel` renvoyait deux mots en dur et tirait les jours de
`DAY_SHORT`, table française ; `WeekChart` aussi. C'est exactement le § 5.2 bis :
`i18n:check` ne voit que les clés écrites, `i18n:durs` ne suit pas la donnée.

**Parade.** Les mots du formulaire (`t("Quotidien")`, `t("Lun–ven")`) et
`nomCourtDuJour` (Intl), lundi d'abord (`ORDRE_SEMAINE`). Test en anglais dans
`tachesVue.test.ts`. `grep -rn DAY_SHORT src` ne rend plus que sa définition.

## 27.2 Un séparateur « · » collé à un morceau qu'on masque : le morceau part, le point reste

**Symptôme.** Toutes les lignes de méta finissaient par « · » au bureau.

**Cause.** Le tag, masqué au bureau (`sm:hidden`), portait la classe sur SON
contenu ; le séparateur, posé avant lui dans l'enveloppe, restait affiché.

**Parade.** La classe responsive va sur l'enveloppe qui contient le morceau ET
son séparateur. Et une ligne qui se replie (au doigt) ne doit pas porter de
séparateurs du tout : le point tombe en tête de ligne.

## 27.3 ⭐ Retourner une décision : elle vivait dans quatre phrases à l'écran, deux commentaires et deux tests

**Constat.** « Un objectif part sans ses tâches » (027) était écrit dans quatre
confirmations (« … Ses tâches restent. »), deux commentaires de code et deux
tests qui l'AFFIRMAIENT. Changer la règle sans chercher ces phrases aurait
laissé l'app annoncer le contraire de ce qu'elle fait.

**Parade.** Avant de retourner une décision : `grep` le texte affiché (et sa
traduction dans `en.ts`), les commentaires, et les tests qui l'affirment ; les
tests se RETOURNENT d'abord, se voient rouges, puis la règle change.

## 27.4 `Intl.ListFormat` n'est pas dans la `lib` TypeScript du projet

**Symptôme.** `tsc` : « Property 'ListFormat' does not exist on type 'typeof Intl' ».

**Parade.** Ne pas toucher `tsconfig` pour une phrase : deux morceaux au plus,
joints par une clé traduite (`"{a} et {b}"`).

## 27.5 ⚠️ Outil — l'accueil de la démo revient à chaque rechargement

**Symptôme.** Un script de capture qui recharge la page photographie l'accueil
(« Bienvenue dans Shale ») par-dessus la vue.

**Parade.** Attendre que le bouton « Passer » existe (il paraît après la
connexion), puis le cliquer par son TEXTE exact (`textContent === "Passer"`),
en boucle tant qu'il reste.

---

# 28. Mettre une fonction de côté (le trading, 2026-09-30)

## 28.1 ⭐ Une fonction ne vit pas que dans son module : graines de migration, démo, exemples, planificateurs

**Constat.** `features.ts` se présentait comme LA frontière du trading (« toute
la logique de gating lit CE fichier »). Elle couvrait les trois modules, le
widget, deux panneaux et la palette. Elle ne couvrait pas : le planificateur de
Market Brain (monté dans `App.tsx`, actif pour tous), la pastille des sessions
de marché, le sous-titre « trading os », « Passer à Shale Trade » des Réglages,
la jauge d'énergie, Personnaliser, un filtre du Calendrier, **deux lignes semées
par les migrations 018 et 020 dans chaque base**, les placeholders de quatre
formulaires, et le jeu de démo — qui fait les captures du site.

**Parade.** Avant de dire « c'est retiré », chercher la fonction par son
VOCABULAIRE, pas par son drapeau : `grep -rniE "trad(e|ing)|backtest|market|
briefing|session|pips|setup|prop firm"` dans `src/`, `src-tauri/migrations/`
(les `INSERT` de graines), `src/lib/demo.ts`, et `en.ts` (une phrase traduite
est une phrase affichée quelque part). Et le filet : `trading-de-cote.test.ts`
refuse tout mot de trading dans la démo.

**Payé.** Rien en données. Sans la recherche par vocabulaire, l'accueil du site
aurait continué d'afficher « Passer trader full-time » après la « suppression ».

## 28.2 ⚠️ Un filtre « aucune session de marché ouverte » ne laisse AUCUN créneau en semaine

**Symptôme.** Le Calendrier ne proposait jamais de créneau libre du lundi au
vendredi — pour tout le monde, offre Trade ou non. Trouvé en lisant le code le
2026-09-30, jamais signalé à l'écran (le bandeau de propositions restait vide,
ce qui ressemble à une semaine pleine).

**Cause.** `creneauxLibres(…, { eviterMarche: true })` en dur dans
`CalendarView`, et `marcheOuvertPendant` teste `activeSessions(d).length > 0`.
Sydney 7-16 h, Tokyo 9-18 h, Londres 8-17 h, New York 8-17 h, chacune à son
heure locale : à Paris, elles se relaient de 23 h à 23 h. Le commentaire parlait
de « l'ouverture de Londres » ; le code testait « n'importe quelle session ».

**Parade.** `eviterMarche` suit `afficheModule("market")`. Si le trading revient,
restreindre la règle aux ouvertures (Londres, New York) plutôt qu'aux sessions.

## 28.3 ⚠️ Outil — le refus du patch de démo (§ 26.2) bloque AUSSI les captures du site

**Constat (2026-09-30, deuxième occurrence du § 26.2).** Même refus du mode
automatique. Ce que le § 26.2 ne disait pas : `vitrine/tools/shoot-v2.mjs`
force le même mode démo à la volée (il réécrit `auth/config.ts` servi par
vite) — le refus couvre donc aussi la régénération des 26 captures du site.
Ne pas le contourner.

**Conséquence.** Un chantier qui change ce que montrent les captures (ici : la
démo trader devenue indépendant) laisse le site en retard tant qu'Antonin n'a
pas autorisé l'action. Le dire dans `DETTE-SITE.md`, pas seulement ici.

## 28.4 ⚠️⚠️ « Quitter » ne répond pas quand une fenêtre de trousseau attend — et l'installation part quand même

**Symptôme.** 2026-09-30, 11:24 : `osascript -e 'tell application "Shale" to
quit'` échoue après deux minutes (« Délai dépassé pour un AppleEvent »,
-1712). La commande enchaînée par `;` a lancé `ditto` quand même : le binaire
a été remplacé sous une app encore ouverte.

**Cause.** Le build précédent (10:49) avait changé le binaire ; au lancement,
macOS a ouvert sa fenêtre de trousseau, et personne n'avait cliqué. L'app
était **bloquée derrière elle** depuis 10:50 : elle ne traitait aucun
AppleEvent, et n'avait même pas ouvert la base (`lsof -p <pid> | grep
shale.db` : 0). Deux builds dans la même matinée, et Antonin absent.

**Parade.** Avant d'installer : `pgrep -l SecurityAgent` et `lsof -p $(pgrep -x
shale) | grep -c shale.db`. Si une fenêtre attend et que la base n'est pas
ouverte, `kill <pid>` est sans risque (rien à écrire), et relancer sur la
neuve remplace DEUX fenêtres à venir par une seule. **Enchaîner l'installation
par `&&` après une vérification « fermée », jamais par `;`.**

**Payé.** Rien : l'app n'avait pas la base ouverte, et `ditto` a écrit une
copie complète (condensat vérifié). Mais sur une app qui écrivait, ce `;`
remplaçait le binaire sous ses pieds.

## 28.5 ⚠️ Outil — sous vite, un module chargé à la demande se photographie « Ouverture du module… »

**Symptôme.** 2026-09-30, première passe de `shale-site/vitrine/tools/shoot-v2.mjs`
sur l'app en démo : `light-taches.webp` écrit, coché ✓… et l'image montre une
page vide avec « Ouverture du module… » au centre. L'outil n'a rien signalé.

**Cause.** Les vues sont en `React.lazy`. Sous `npx vite` (dev), le premier
affichage d'un module compile et charge son code à la volée : plusieurs
secondes, bien plus que les 900 ms que l'outil attendait après le clic. Une
fois chargé, le même module s'affiche d'un coup — d'où une passe « à moitié
bonne » qui passe inaperçue si on ne regarde pas CHAQUE image.

**Parade.** Après chaque changement de module, attendre que le texte
« Ouverture du module » ait disparu de la page (fait dans `shoot-v2.mjs`,
20 s au plus, sinon arrêt sans écrire). Et toujours ouvrir les images avant de
les publier : le ✓ de l'outil dit qu'un fichier existe, pas ce qu'il montre.

**Payé.** Rien : vu à la relecture, avant tout commit.

## 28.6 Une note sur iPhone coupe son titre à ~14 caractères

**Constat (2026-09-30, captures iPhone du site).** Dans l'éditeur de note en
largeur téléphone (390 px), le titre partage sa ligne avec « ENREGISTRÉE » et
« supprimer » : « Méthode de devis » s'affiche « Méthode de de », coupé net,
sans points de suspension. C'est l'écran de l'app, pas l'outil de capture.

**Parade provisoire.** Les captures iPhone du site ouvrent « Tarifs 2026 »,
qui tient. **Non corrigé dans l'app** : l'en-tête devrait passer les actions
sous le titre, ou au moins tronquer avec « … ».

# 29. La priorité des étapes et des tâches (2026-09-30)

## 29.1 ⚠️ Un `<select>` à côté d'un champ qui valide en perdant le focus crée l'objet avant qu'on ait choisi

`ChampLigne` (feuille de route) valide quand il perd le focus — « on ne perd
jamais une frappe en cliquant ailleurs ». Un `<select>` natif doit PRENDRE le
focus pour ouvrir son menu : cliquer la priorité après avoir tapé le titre
créait l'étape en « moyenne », et la cliquer avant de taper refermait le champ
vide. **Règle** : à côté d'un champ qui valide au `blur`, un contrôle est un
bouton qui empêche `pointerdown` (`PastillePriorite`, les boutons « Phase /
Sous-objectif ») — jamais un `<select>`, un `<input>` ni un menu qui prend le
focus. Vérifié en démo : après deux clics sur la pastille, le focus est
toujours dans le champ.

## 29.2 Outil — écrire dans la démo par `repo` ne rafraîchit pas la vue

Planter des données en démo par `import("/src/lib/repo.ts")` dans la page les
écrit dans le magasin en mémoire, mais la vue affichée garde ses données : il
faut `window.dispatchEvent(new CustomEvent("sb:data-changed"))` (`App.tsx`).
Et la phase EN COURS s'ouvre d'office (`deplieParDefaut`) : cliquer son
chevron la REFERME — ne cliquer que ceux dont `aria-expanded="false"`, choisis
par leur libellé (« Déplier « … » »), pas le premier `button[aria-expanded]`
de la ligne, qui peut être le « ⋯ ».

## 29.3 Une migration peut passer avant une migration réservée

La 029 est réservée par le chantier IA de Shale Pro, non fusionné ; la
priorité a pris la 030. sqlx (`sqlx-core` 0.8.6, `Migrator::run_direct`)
n'impose aucun ordre : il refuse une migration APPLIQUÉE absente du code ou
dont l'empreinte a changé, mais applique toute migration manquante quel que
soit son rang. La 029 passera donc après la 030. **Ce qu'il faut tenir** :
`lib.rs` et `sync/schema.testutil.ts` doivent lister les migrations dans le
même ordre que le code les déclare, et le chantier qui fusionne la 029 l'insère
AVANT la 030 dans les deux (conflit d'ajout trivial).


# 30. Un test de démo qui dépend du jour du mois (2026-10-01)

## 30.1 ⚠️ Des données datées « depuis aujourd'hui » et d'autres calées sur le 1er du mois se croisent une fois par mois

**Symptôme.** Le 1er octobre 2026, `finance/facturation/demo.test.ts` tombe sur
« le solde composé MONTE par rapport au solde nu » (`expected 1056967 to be
greater than 1056967`) sans qu'une ligne de code ait changé — y compris sur
origin/mobile-ios vierge. Deux chantiers l'ont vu la même nuit et l'ont pris
pour une régression de l'autre. En démo, la section Facturation de Finance ne
montrait rien ces jours-là.

**Cause.** Dans `demo.ts`, les relevés de solde étaient datés du **1er du mois
courant** (`debutDeMois(todayStr())`), les encaissements **depuis aujourd'hui**
(J-3, J-5, J-25, J-38). `patrimoineAu` n'ajoute que les mouvements
**strictement après** le dernier relevé. Du 1er au 4 de **chaque** mois,
l'encaissement le plus récent (J-3) tombait au plus tard le jour du relevé :
tout était absorbé, solde composé = solde nu. Balayage sur 375 jours simulés :
exactement les jours 1 à 4 de chaque mois, et aucun autre test touché.

**Parade.** Le dernier relevé de la démo a toujours au moins une semaine
(`debutDeMois(addDays(todayStr(), -7))`) : du 1er au 7, c'est celui du mois
précédent (37 jours au plus, sous le seuil de péremption de 45). Et le test
balaie désormais **chaque jour d'une année** plus la fin de février 2028
(`vi.useFakeTimers({ toFake: ["Date"] })`, `vi.resetModules()` puis
`await import("../../demo")` par jour — la démo construit son jeu à l'import).
Contre-épreuve faite : remis à l'ancienne datation, le balayage liste les 52
jours fautifs et eux seuls. **Règle générale** : un jeu de données qui mélange
des dates relatives à aujourd'hui et des dates calées sur un calendrier
(1er du mois, lundi, 1er janvier) a des jours où leur ordre s'inverse. Le test
qui les compare doit tourner sur tous les jours, pas sur celui où on le lance.

**Payé.** Une nuit de pipelines rouges pour deux chantiers ([P-priorites],
[X-ia-pro]), chacun vérifiant que ce n'était pas le sien.

## 30.2 Outil — faire tourner vitest sous une date simulée

`vitest run --setupFiles …` n'existe pas en ligne de commande (vitest 3.2 :
« Unknown option »). Passer par une config enveloppe hors du dépôt
(`mergeConfig` de `vitest.config.ts`, `root` = le worktree,
`test.setupFiles` = un fichier qui fait `vi.useFakeTimers({ toFake: ["Date"] })`
puis `vi.setSystemTime(...)`). ⚠️ Si l'enveloppe vit hors du dépôt (scratchpad),
elle ne trouve pas le paquet `vitest` : lui donner un lien `node_modules`.
⚠️ **Ne pas lancer un processus vitest par date en parallèle** : six à la fois
ont poussé la charge de la machine au-delà de 100 et fait expirer les tests de
volume (`sync/engine.test.ts`, 35 s) des autres sessions. Pour balayer beaucoup
de jours, boucler **dans un seul test** avec `vi.resetModules()` (§ 30.1 :
375 jours en 5 s).

# 25. L'IA de Shale Pro (chantier `ia-pro`, 2026-09-29)

## 25.1 Un `timestamptz` passé par `jsonb_build_object` sort dans le fuseau de la SESSION

**Symptôme.** Le test de l'essai Pro attend `resetsAt: "2026-10-20T00:00:00+00:00"`
et reçoit `"2026-10-20T01:00:00+01:00"` — la même heure, écrite autrement.

**Cause.** `jsonb_build_object('fin_essai', s.trial_ends_at)` sérialise le
`timestamptz` dans le fuseau `TimeZone` de la session Postgres. PGlite prend
celui de la machine (Paris) ; Supabase répond en UTC. Le même SQL rend donc
deux textes selon l'endroit où il tourne — et l'app compare des chaînes.

**Parade.** Ne jamais relayer tel quel un horodatage sorti de Postgres :
`new Date(x).toISOString()` côté TypeScript (fait dans
`reinitialisationDe`, `supabase/functions/ai/coeur/limites.ts`, dépôt du site).

**Payé.** 2026-09-29, un test rouge — attrapé avant tout déploiement.

## 25.2 Le cache de prompt ne fait RIEN sur Haiku 4.5 sous 4 096 jetons — sans erreur

**Symptôme.** `cache_control` est posé sur le prompt système, la requête passe,
et `usage.cache_read_input_tokens` reste à 0 à chaque appel.

**Cause.** Le préfixe minimum cachable dépend du modèle : **4 096 jetons pour
Haiku 4.5**, 1 024 pour `claude-sonnet-5`, 512 pour les plus récents. En
dessous, l'API ignore le marqueur en silence (ni erreur, ni surcoût). Un prompt
système de fonction Shale fait quelques centaines de jetons.

**Parade.** Garder le marqueur (il ne coûte rien et servira sur un modèle au
seuil plus bas), mais **ne compter aucune économie de cache** dans les calculs
de coût tant que le prompt reste court. Le constater sur
`cache_read_input_tokens`, jamais le supposer.

**Payé.** Rien encore — relevé dans la référence de l'API pendant l'audit de la
phase 0, avant d'écrire un calcul qui l'aurait supposé.

## 25.3 L'outil imposé (`tool_choice`) casse en changeant de modèle

**Symptôme (évité).** Une fonction qui force sa sortie JSON par
`tool_choice: {type: "tool"}` marche sur Haiku 4.5 et `claude-sonnet-5`, puis
renvoie **400** le jour où `ai_config.model` passe à `claude-sonnet-5-5`.

**Cause.** Les modèles les plus récents (Sonnet 5.5, Opus 5.5, Fable 5.1)
refusent `tool_choice` `any` / `tool`. Même famille : `thinking:
{type: "disabled"}` est accepté par `claude-sonnet-5`, **refusé** par
`claude-sonnet-5-5` (qui veut `between_tools`).

**Parade.** Sortie par `output_config.format` (JSON Schema), accepté par tous
les modèles en service ; et le réglage de réflexion dans `ai_config.thinking`,
à changer **avec** `model`. Un test (`serveur.test.ts`, « changer de modèle et
de réflexion ») le garde.

## 25.4 La CLI Supabase perd son autorisation — et `2>/dev/null` la rend muette

**Symptôme.** `npx supabase db query --linked … --output-format json "…" 2>/dev/null
> sauvegarde.json` « réussit » : le fichier existe, la suite de la commande ne dit
rien. Le fichier contient en fait
`{"_tag":"Error","error":{"code":"DbConfigLoginRoleStatusError","message":"unexpected login role status 401 …"}}`.

**Cause.** Le jeton d'accès personnel rangé par `Connecter Supabase.command` n'est
plus accepté (expiré ou révoqué — il marchait la veille, 2026-09-29). La CLI écrit
l'erreur en JSON sur la sortie standard, pas sur l'erreur standard : le
`2>/dev/null` ne la cache pas, il fait croire qu'une sauvegarde a été écrite.

**Parade.** Avant toute écriture en production : une requête témoin SANS
redirection, et vérifier qu'elle rend des lignes (`"rows":[…]`), pas `"_tag":"Error"`.
Ne jamais juger une sauvegarde à l'existence de son fichier : lire son contenu.
Pour rétablir : Antonin double-clique `Connecter Supabase.command` (il colle un
jeton `sbp_…`, rien d'autre à taper).

**Payé.** 2026-10-01 : la migration 010 n'a pas pu être jouée ; une « sauvegarde »
vide a été créée puis retirée. Rien n'a été écrit en base. Le soir même, CLI
reconnectée : 010 jouée, après une sauvegarde RELUE (19 lignes). ⚠️ Deuxième façon
de fabriquer une fausse sauvegarde : `--project-ref` sans `--linked` rend
`DbQueryMutuallyExclusiveFlagsError` — écrit dans le fichier si l'on redirige.

**Et ce que Claude Code ne fera pas, même avec l'accord d'Antonin** (garde-fou des
permissions, 2026-10-01) : `supabase secrets set …` et `supabase functions deploy …`.
Ce sont des gestes d'Antonin — lui donner la commande, ne pas chercher un détour.

## 25.5 ⚠️ Une borne de date DÉJÀ PASSÉE rend toute réponse du modèle inacceptable

**Symptôme.** Une fonction d'IA qui date ses propositions « entre aujourd'hui et
l'échéance » finit en `bad_output` (deux appels payés, rien d'affiché) — mais
seulement sur les objectifs EN RETARD. En démo : des sous-objectifs tous datés du
1er septembre, un 1er octobre.

**Cause.** Le contrôle de sortie exige `jour ≤ date ≤ échéance`. Échéance passée :
l'intervalle est vide, aucune date ne passe. La réponse factice de la démo, elle,
« rabattait » sur l'échéance — donc dans le passé.

**Parade.** `dateDansFenetre` (`coeur/fonctions.ts`) : une limite antérieure au
jour ne borne plus rien. Le prompt le dit au modèle, la démo suit la même règle,
et la fenêtre l'écrit (« l'échéance est déjà passée : datés à partir d'aujourd'hui »).
Toute nouvelle fonction qui borne une date passe par `dateDansFenetre`, et son
test compte un cas « en retard ».

**Payé.** 2026-10-01, phase E — vu sur la capture de la démo, avant tout appel réel.

---

# 31. Préparer l'app iPhone pour l'App Store (2026-10-06)

## 31.1 ⛔ Une garde iOS posée un jour ne couvre pas les chantiers fusionnés ensuite

**Symptôme.** Sur iPhone, « Personnaliser » listait le widget « Brief du jour
(IA, Shale Pro) » : un nom d'offre, dans une app qui ne doit en nommer aucune
(règle 3.1.3(f) d'Apple). Tous les tests étaient verts.

**Cause.** Les gardes « connexion seule » datent du 29 septembre. L'IA de Shale
Pro a été fusionnée le 1er octobre : ses ÉCRANS ont bien été masqués sur iOS,
mais son LIBELLÉ de widget vit dans une table (`WIDGET_LABELS`) qu'un autre
écran affiche. Et `ios-sans-achat.test.ts` ne rend que les trois écrans
d'authentification.

**Parade.** `widgetListable()` (`lib/features.ts`) et
`lib/widgets-listables.test.ts`. Et surtout : **avant chaque envoi à Apple,
refaire la recherche de `MOBILE.md` § 28.4** dans tout `src/` — les textes
arrivent par des tables, pas seulement par des écrans.

**Payé.** 2026-10-06 : trouvé à la relecture, avant tout envoi.

## 31.2 `xcodegen generate` échoue dans un worktree neuf

**Symptôme.** « Target "shale_iOS" has a missing source directory …/Externals »
(et `…/assets`).

**Cause.** Ces deux dossiers sont créés par le build et ignorés par git : un
worktree neuf ne les a pas.

**Parade.** `mkdir -p Externals assets` dans `gen/apple`, puis `xcodegen generate`.

## 31.3 ⚠️ Lancer la ligne de base PUIS poser le patch de démo dans le même dossier

**Symptôme.** `licence/transport.test.ts` échoue (2 tests) alors que rien n'y a
été touché.

**Cause.** `npm test` tournait encore (machine chargée : plus de dix minutes)
quand le patch de mode démo a vidé `SUPABASE_URL`. Les fichiers de test lus
après le patch ont vu une app « non configurée ».

**Parade.** Attendre la fin de la ligne de base avant de patcher — ou la jouer
dans un autre dossier que celui qu'on patche.

**Payé.** 2026-10-06 : une ligne de base à refaire.

## 31.4 Un build iOS avec 4 Go libres : le cache sur le disque externe

**Symptôme évité.** Celui du § 23.3 (disque plein, build « réussi » et vide).

**Parade.** Image disque APFS sur le disque externe, `src-tauri/target` en lien
symbolique vers elle (`MOBILE.md` § 28.9). ⚠️ Pas directement sur le disque
externe : il est en exFAT. ⚠️ C'est lent : compter large à cache vide.

## 31.5 Écran blanc dans le simulateur : la machine, pas l'app

**Symptôme.** L'app installée s'ouvre sur un écran blanc qui ne bouge plus.

**Cause.** Simulateur tout juste démarré + machine saturée (charge > 100 : un
build venait de finir). Le front tourne — `shale.db` et `backups/` sont écrits —
mais WebKit n'affiche rien : `RemoteRenderingBackendProxy … Timeout` dans
`xcrun simctl spawn <id> log show --last 4m --predicate 'process == "Shale"'`.

**Parade.** Attendre que la charge retombe (`uptime`), puis `simctl terminate`
et `simctl launch`. Regarder si la base a été écrite avant de soupçonner le code.
Éteindre le simulateur pendant un build : il prend sa part de la machine.

## 31.6 Sur iOS, un `<input type="time">` ne suit pas `w-full`

**Symptôme.** Deux champs d'heure côte à côte : le second sort de la carte.

**Cause.** Le contrôle natif d'iOS porte sa propre largeur minimale.

**Parade.** Classe `.champ-heure` (`index.css`, iOS seulement) et `min-w-0` sur
le champ et sur son parent flex. Invisible en émulation Chrome : seul le
simulateur le montre.

**Payé.** 2026-10-06 : c'était le PREMIER écran que voit un nouvel utilisateur.

## 31.7 L'image disque du cache est illisible le lendemain

**Symptôme.** Double-clic sur `cache.sparsebundle` : « Container superblock is
invalid », le volume ne monte pas, `src-tauri/target` est un lien mort.

**Cause.** Disque externe débranché (ou Mac mis en veille) pendant que l'image
était montée et qu'un build y écrivait.

**Parade.** Ce n'est qu'un cache : supprimer l'image et la recréer
(`MOBILE.md` § 28.9), puis accepter un build à cache vide (15 à 25 min).
Éjecter le volume `ShaleCache` AVANT de débrancher le disque.

**Payé.** 2026-10-07 : une demi-heure de recompilation.

## 31.8 Passer une app iOS à l'iPad ne pose pas les zones sûres

**Symptôme.** Sur iPad, le titre de la vue passe sous l'heure système et le
pied de la barre latérale sous la barre d'accueil.

**Cause.** Les réserves `env(safe-area-inset-*)` n'étaient posées que dans la
branche « téléphone » (`useIsPhone()`). L'iPad prend la mise en page du bureau,
qui n'en avait aucune.

**Parade.** Les poser sous `IS_IOS` sur les conteneurs qui ne défilent pas
(`App.tsx`, `Sidebar.tsx`). Invisible en émulation : seul le simulateur iPad le
montre.

**Payé.** 2026-10-07, vu à la première capture sur iPad Pro 13".

# 32. La page d'un objectif et le fil (2026-10-08)

## 32.1 Une ref écrite en ligne est rappelée à CHAQUE rendu

**Symptôme.** La liste des objectifs devait retrouver son défilement au retour d'une page. Écrit `ref={(el) => { if (el && ancien !== el) restaurer(); ancien = el; }}` : la liste serait remontée en haut à chaque rendu.

**Cause.** Une fonction de ref créée dans le JSX change d'identité à chaque rendu ; React appelle l'ancienne avec `null`, puis la nouvelle avec l'élément. Retenir ce `null`, c'est faire passer chaque rendu pour un montage.

**Parade.** Ne jamais retenir `null` (`if (!el || ancien === el) return;`), ou une ref stable (`useCallback`). Vu à la relecture, avant l'écran — `GoalsView.tsx`.

## 32.2 Échap : `defaultPrevented` lu trop tôt vaut toujours faux

**Symptôme attendu.** Échap sur la page d'un objectif devait fermer un menu ouvert, PAS la page.

**Cause.** La convention « lire `e.defaultPrevented`, puis marquer » suppose que l'écouteur du dessus passe AVANT. Or tous sont sur `window`, servis dans l'ordre de POSE : la page pose le sien à son montage, le menu à son ouverture — donc après. La page lisait `false` et se fermait avec le menu.

**Parade.** L'écouteur le plus ANCIEN lit `defaultPrevented` après la distribution : `setTimeout(() => { if (!e.defaultPrevented) … }, 0)` (un microtask passerait encore avant l'écouteur suivant). L'état « une fenêtre est ouverte » se lit, lui, tout de suite. Prouvé à l'écran sur trois cas (menu de la page, menu d'une étape, champ de saisie).

## 32.3 Piloter la barre latérale : une entrée repliée a une hauteur, et un module `lazy` n'est pas là en 2 s

**Symptôme.** Script puppeteer : « Objectifs » trouvé, cliqué, rien ne s'ouvre ; puis ouvert, mais `[data-objectif]` introuvable.

**Cause.** (1) Une catégorie repliée (`grid-template-rows: 0fr`) laisse ses entrées dans le DOM avec leur hauteur : `getBoundingClientRect().height > 0` ne prouve pas qu'elles sont visibles. (2) En dev, le premier chargement d'une vue `lazy` dépasse un délai fixe (« Ouverture du module… »).

**Parade.** Cliquer d'abord l'en-tête de la catégorie ; attendre l'ÉTAT (`waitForSelector`), jamais une durée. Modèle : `voir.mjs` du brouillon de session (non versionné) — le reprendre dans `tools/` si un troisième chantier en a besoin.

# 33. L'analyse de Performance (2026-10-09)

## 33.1 Une moyenne glissante qui inclut AUJOURD'HUI plonge chaque matin

**Symptôme.** La courbe « moyenne 7 jours » se terminait par une chute, tous les jours, quelle que soit la semaine.

**Cause.** Le dernier point est aujourd'hui, et à 9 h aujourd'hui vaut 20 %. Même défaut pour toute moyenne ou comparaison de période qui s'arrête à aujourd'hui.

**Parade.** Une période est faite de jours FINIS (`bornes()` s'arrête à hier) ; la moyenne glissante aussi. Aujourd'hui reste tracé, à part. `lib/performance/analyse.ts`.

## 33.2 `type="monotone"` (recharts) invente des valeurs entre deux points

**Symptôme.** Sur une série qui alterne 100 % et 33 %, le trait dépassait 100 % et descendait sous 0.

**Cause.** L'interpolation arrondie convient à une série lisse (la moyenne), pas à une série en dents de scie.

**Parade.** `linear` pour une série brute, `monotone` pour une série lissée. `components/performance/Discipline.tsx`.

## 33.3 Une table sans date de création réécrit le passé

**Symptôme évité.** Diviser « habitudes cochées ce jour-là » par le nombre d'habitudes d'AUJOURD'HUI : ajouter une habitude fait baisser tous les jours passés.

**Parade.** Faute de `created_at`, une ligne compte depuis sa première trace (`debutsDesHabitudes` : la première coche). À reprendre pour toute statistique sur une table qui n'a pas de date de création.

## 33.4 Un script de retouche qui échoue au milieu laisse une moitié écrite

**Symptôme.** Un script Python qui retouchait deux fichiers a levé une assertion sur le second : le premier était déjà écrit, le second non, et `tsc` restait vert.

**Parade.** Écrire les fichiers À LA FIN, tous ensemble, ou relancer la moitié manquante — et ne pas conclure « appliqué » sur un `tsc` vert : relire la sortie du script.

## 33.5 Une phrase RETIRÉE de l'écran reste dans le bundle : mauvaise contre-épreuve

**Symptôme.** Au build du 2026-10-09, la contre-épreuve « cette phrase supprimée doit rendre 0 dans `dist/assets` » a rendu 1.

**Cause.** La CLÉ d'une traduction est la phrase française : tant que son entrée reste dans `en.ts`, la phrase est dans le bundle, même si plus aucune vue ne l'affiche.

**Parade.** Pour une contre-épreuve, prendre une phrase qui n'a JAMAIS existé, ou purger d'abord l'entrée de `en.ts`. Les témoins POSITIFS (phrases neuves) restent fiables (§ 7.5 bis).

# 34. Retours du tournage en anglais (2026-10-10)

## 34.1 « Faite » lue à deux endroits avec deux règles

**Symptôme.** « La faire maintenant » : la tâche passe dans « Faites » côté Tâches, mais le Calendrier garde son bandeau de décision et son sablier.

**Cause.** Le Calendrier cherchait la coche à la DATE D'ÉCHÉANCE (`faites.get(id:jour)`) ; le reste de l'app dit qu'une ponctuelle est faite dès qu'une coche existe. Le bouton coche à aujourd'hui une tâche échue : les deux règles divergeaient pile sur ce cas. Les tests d'agenda cochaient toujours à la date d'échéance, donc restaient verts.

**Parade.** `ponctuellesFaites` (`lib/taches.ts`) pour toute tâche datée ; la coche « par jour » ne vaut que pour une récurrente. Dans un test de coche, décaler le jour de la coche et le jour d'échéance.

## 34.2 Une clé i18n à deux sens : `i18n:check` vert, traduction fausse

**Symptôme.** Le bouton qui rend une tâche supprimée disait “Cancel” en anglais.

**Cause.** « Annuler » veut dire « fermer sans rien faire » ET « défaire ». La clé est la phrase française : une seule entrée, un seul anglais.

**Parade.** Un discriminant : `t("Annuler|défaire")`. À chercher pour tout mot français qui porte deux gestes (« Fermer », « Retirer », « Valider »).

## 34.3 Outils : trois faux pas de cette session

- **zsh ne découpe pas `$F`** : `git checkout -- $F` avec `F="a b c"` cherche UN fichier nommé « a b c ». Utiliser un tableau, `F=(a b c)`.
- **`git stash` est commun à tous les worktrees** : pour une contre-épreuve, passer par `git diff -- fichiers > x.patch`, `git checkout -- fichiers`, puis `git apply x.patch`.
- **puppeteer « Attempted to use detached Frame »** au premier passage sur un serveur Vite neuf : Vite ré-optimise ses dépendances et recharge la page. Relancer le script, ce n'est pas l'app.

# 26 (suite). Timer, second passage (2026-09-30, fusionné le 2026-10-11)
## 26.3 ⚠️⚠️ `backface-visibility: hidden` ne cache pas le dos d'un volet dans WebKit

**Symptôme.** Volet à deux faces (`preserve-3d`, dos en `rotateX(180deg)`) :
dans WebKit, le dos — le bas du NOUVEAU chiffre, à l'envers — recouvre le devant
dès le départ, et le bas reste grisé à l'arrivée. Chrome rend la même page
juste. Mesuré le 2026-09-30 sur la page d'essai des volets.

**Cause.** Au moins dans le chemin de capture de `webkit-pilote` (voir 26.5),
la culture des faces arrière n'est pas appliquée ; on ne peut pas exclure que
l'app la perde aussi dans certains cas (les faces contiennent des couches
animées, que WebKit compose à part).

**Parade.** Ne pas dépendre de `backface-visibility` seule : chaque face est
aussi ÉTEINTE / ALLUMÉE (`visibility`, en paliers) à l'instant où le volet
passe la verticale — il est alors vu par la tranche, rien ne se voit. L'instant
se calcule sur la courbe (46,2 % ici) ; recalculer si la courbe change.

**Payé.** Une version fausse aurait été installée sans la page d'essai.

## 26.4 ⚠️ Un `setInterval(1000)` fait sauter et doubler des secondes à l'écran

**Symptôme.** Sur une horloge à volets, de temps en temps deux bascules
collées puis une seconde sans bascule.

**Cause.** Le chiffre change quand le reste franchit une demi-seconde (arrondi).
Un battement fixe calé à quelques millisecondes de cette frontière, avec la
gigue normale des minuteurs, la voit tantôt avant, tantôt après.

**Parade.** Se réveiller juste APRÈS chaque frontière :
`delaiAvantProchaineSeconde` (`lib/timerFenetre.ts`), utilisé par `useFocus`
et la fenêtre séparée. Un test simule la gigue et prouve les deux sens.

**Payé.** Probablement une bonne part du « manque de fluidité » constaté par
Antonin au premier essai.

## 26.5 Outil — regarder une animation 3D image par image

**Trois pièges, une recette.**
1. Figer une animation en changeant `animation-delay` (négatif) + `paused`
   **ne marche pas** sur une animation déjà finie : elle reste finie, toutes les
   images sont identiques. Piloter le temps par l'API Web Animations :
   `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t })`.
2. La capture de `webkit-pilote` (`takeSnapshot`) passe par le **rendu
   logiciel** : pas de perspective, et la face arrière n'y est pas cachée (26.3).
   Elle dit l'ordre et le contenu des faces, pas le relief.
3. Chrome sans interface (`--headless=new --screenshot`) rend par le vrai
   compositeur — mais **un profil par capture** (`--user-data-dir` distinct) et
   une alarme (`perl -e 'alarm 25; exec @ARGV' …`) : une instance qui ne se
   referme pas garde le profil verrouillé, et les suivantes attendent pour
   toujours. Ne tuer que ses propres processus (motif = son dossier de profil).

La page d'essai elle-même : le balisage RÉEL du composant (rendu happy-dom dans
un test jetable, jamais commité), son CSS réel, les jetons du thème recopiés
d'`index.css`, la police en `data:`. Rien de l'app, rien de l'authentification.
# 34. La jauge d'énergie (2026-10-09)

> ⚠️ **La jauge a été retirée le 2026-10-11** (chapitre des correctifs d'après le labo). Le piège `Number(null)` ci-dessous vaut toujours pour tout réglage lu en nombre.

## 34.1 `Number(null)` vaut 0 : un réglage ABSENT passait pour un réglage à zéro

**Symptôme.** En mode démo, la jauge « Énergie restante » d'Aujourd'hui affichait 100 % et « −0 % » avec 4 h 26 d'écran.

**Cause.** `num(raw, fallback)` de `lib/mentalLoad.ts` faisait `Number(raw)` puis gardait tout nombre fini et positif. Or `getSetting()` rend `null` pour une clé absente, `Number(null)` et `Number("")` valent 0 : le défaut n'était jamais rendu, les deux coûts valaient 0.

**Parade.** Écarter `null` et la chaîne vide AVANT `Number()`. À reprendre partout où un réglage texte est lu comme un nombre avec une valeur par défaut non nulle. `lib/mentalLoad.test.ts`.

# 35. Widgets, densité et barre latérale (2026-10-11)

## 35.1 `.panel-scroll` autorise une carte PLUS COURTE que son contenu — même quand rien ne doit défiler

**Symptôme.** « Liens rapides » : le bouton « + lien » coupé en deux, une barre de défilement dans la carte (photo d'Antonin).

**Cause.** `layout.today` portait `quicklinks: { h: 144 }`. Un widget qui déclare `.panel-scroll` peut rester sous la hauteur de son contenu (`ResizableGrid`, plancher = `minH`). Un lien de plus, ou la densité à 110 %, fait passer « + lien » à la ligne : il faut 160, la carte reste à 144.

**Parade.** `.panel-scroll` seulement pour une vraie LISTE. Des pastilles, un formulaire, une jauge : pas de région défilante, et le plancher de la grille redevient le contenu. Pour diagnostiquer un widget rogné, lire d'abord `layout.<grille>` dans la base (`sqlite3 -readonly`).

## 35.2 `h-screen` sur la racine : l'app dépasse la fenêtre dès que la densité n'est pas 100 %

**Symptôme.** À 110 %, le pied de la barre latérale sous le bord et toute l'app qui défile de 84 px ; à 90 %, une bande vide en bas.

**Cause.** `h-screen` = `100vh`, que le `zoom` multiplie (§ 6.4). `body` était corrigé, pas la racine d'`App.tsx` ni les écrans de connexion. Mesuré : racine 920 px dans 836.

**Parade.** `h-[calc(100vh*var(--zoom-inv))]`. `barre.source.test.ts` refuse un `h-screen` nu hors de `TimerPane` et `CapturePane` (qui n'appliquent pas la densité).

## 35.3 Grille : un `translate` écrit en pixels écran devance le curseur sous densité

**Symptôme.** À 110 %, le panneau glissé part 20 px devant le curseur après 200 px ; tirer la poignée de 60 px ajoute 88 px de hauteur.

**Cause.** `clientX` et `getBoundingClientRect` sont en pixels ÉCRAN ; un `translate` et une hauteur s'écrivent en pixels LOCAUX, que le `zoom` multiplie ensuite.

**Parade.** Diviser par `zoomFactor()` au moment d'ÉCRIRE (transform, hauteur). Comparer deux mesures écran entre elles (hit-test) reste juste. À vérifier à 90, 110 et 120 %, pas seulement à 100.

## 35.4 Un `backdrop-filter` à opacité nulle reste un calque

**Constat.** Aujourd'hui portait une vingtaine d'éléments « verre » invisibles (poignées de panneau, opacité 0), plus la barre latérale, qui ne floutait rien (rien ne passe derrière elle).

**Parade.** Poser le flou seulement quand l'élément est révélé (`group-hover:[backdrop-filter:…]`). ⚠️ Pas `visibility: hidden` : les poignées se révèlent aussi au clavier (`focus-within`), et un élément caché ne reçoit pas le focus. ⚠️ Le gain n'a PAS été mesuré dans WKWebView.

## 35.5 Un en-tête collant a besoin d'un fond opaque

Un titre `position: sticky` posé sur une barre en verre (72 %) fait une bande plus dense, et la liste se lit à travers. D'où `--barre-bg` (opaque) pour la barre ET ses titres. Les boutons sont `relative` : sans `z-index` sur le titre collant, ils passent par-dessus.

## 35.6 Outils de cette session

- **zsh, encore** (§ 34.3) : `lancer $cfg` avec `cfg="1120 780 110"` passe UN argument ; le script a tourné trois fois à la taille par défaut en annonçant trois tailles. Passer les arguments un par un.
- **HMR et fermetures** : après avoir changé une constante de `lib/barre.ts`, l'observateur déjà monté gardait l'ancienne valeur. Recharger la page avant de mesurer.
- **puppeteer sous `zoom`** : `boundingBox()` ne tombe pas où l'on croit ; viser par `getBoundingClientRect()` lu dans la page.
- **Extension Chrome non connectée** : Chrome sans fenêtre (`--remote-debugging-port`, `--disable-features=MacAppCodeSignClone`) + `puppeteer-core` de `shale-site/vitrine/node_modules`.

## 35.7 ⚠️ Relire le carnet JUSTE AVANT de toucher au worktree principal — pas une heure plus tôt

**Ce qui s'est passé.** Carnet lu à 11:19 : verrou de build libre. À 12:15, fusion lancée dans `Shale-projet/Shale` sans le relire — une autre session avait pris **BUILD NATIF** à 12:12 sur ce même dossier. La fusion a buté sur `PIEGES.md` et a laissé le dossier en conflit pendant une minute, sous un build en cours. Annulée (`git merge --abort`) ; le `dist/` de l'autre session datait de 12:13, donc rien n'est parti dans son binaire.

**Parade.** `tail -5 COORDINATION.md` dans la MÊME commande que la fusion, et s'arrêter si le verrou est pris. Rebaser dans SON worktree (`git rebase mobile-ios`), jamais fusionner dans le principal pour « voir si ça passe ». Trois sessions le même jour ajoutent toutes en fin de `PIEGES.md`, `PASSATION.md`, `CLAUDE.md` : le conflit y est certain, et se résout en gardant les deux.

# 36. Le labo : piloter l'app par des agents (2026-10-11)

Outil : `Shale-projet/labo/outils/pilote.mjs`. Ces pièges valent pour tout script qui lit ou pilote l'app dans Chrome.

## 36.1 `checkVisibility()` répond faux sur un `display: contents` — et tout ce qui est dessous disparaît

- **Symptôme.** La lecture d'écran rendait « 0 élément » sur une app parfaitement affichée (la capture le prouvait).
- **Cause.** Un élément en `display: contents` n'a pas de boîte : `checkVisibility()` y répond faux, alors que ses enfants sont à l'écran. Couper la descente dessus coupe toute l'app.
- **Parade.** Ne jamais élaguer un sous-arbre sur `checkVisibility()` sans laisser passer `display: contents`.
- **Comment on l'a payée.** Deux relances du pilote avant de comparer le texte à la capture.

## 36.2 ⌘A ne sélectionne rien dans un champ sous Chrome piloté

- **Symptôme.** « Vider le champ » (⌘A puis Retour arrière) n'effaçait qu'un caractère. Trois agents sur cinq ont écrit que l'app ne laissait pas vider un champ.
- **Cause.** Sous macOS, une touche envoyée par CDP ne déclenche pas la commande d'édition « tout sélectionner ».
- **Parade.** Sélectionner par le DOM (`input.select()`, ou une plage sur un `contenteditable`), puis Retour arrière ; et relire la valeur pour dire ce qui reste.
- **Comment on l'a payée.** Un faux défaut dans trois rapports, écarté par le vérificateur.

## 36.3 Un clic « réussi » n'est pas un clic qui a fait quelque chose

- **Symptôme.** L'outil répondait « ok » à un clic sans aucun effet ; l'agent enchaînait sur un écran qu'il croyait changé.
- **Parade.** Comparer une empreinte de l'écran (texte, focus, coches, défilement) avant et après chaque geste, et le dire quand rien n'a bougé. C'est aussi la mesure d'une impasse.

## 36.4 Un `aria-label` n'est pas un libellé que l'utilisateur lit

- **Symptôme.** Un agent « lit » le nom d'un bouton-icône et s'en sert, là où une personne ne voit qu'un dessin.
- **Parade.** Séparer dans tout relevé d'écran ce qui se VOIT (texte, texte d'invite, libellé voisin d'une case) de ce qui ne se voit pas (`aria-label`, `data-tip`, `title`), et chercher un élément par son texte visible d'abord.

## 36.5 Un bouton sous le bas d'une fenêtre qui défile n'est ni « à l'écran » ni « plus bas dans la page »

- **Symptôme.** « Créer » d'une fenêtre trop haute n'apparaissait dans aucune liste : son rectangle est dans la fenêtre du navigateur, mais rogné par le cadre qui défile (c'est le défaut A17-15, vu par l'outil avant de l'être par un agent).
- **Parade.** Tester le centre de l'élément contre le rectangle de chaque ancêtre qui rogne, et le compter à part (« cachés dans un cadre qui défile »).

## 35.8 « Quitter » peut réussir SANS que le processus s'arrête — et `open` réveille alors l'ancien binaire

**Symptôme.** 2026-10-12 : `osascript … to quit` rend la main sans erreur (aucune fenêtre de trousseau en attente, ce n'est pas le § 28.4), mais `pgrep` montre encore le processus huit secondes plus tard. L'app vit dans la barre de menus (« garder Shale actif en arrière-plan »).

**Risque.** Installer puis `open -a Shale` : macOS réactive le processus DÉJÀ lancé, donc l'ancien binaire. On croit essayer la nouvelle version, on regarde l'ancienne — et le sha256 du fichier installé, lui, est juste.

**Parade.** Après « Quitter », vérifier par `pgrep -f "^/Applications/Shale.app/Contents/MacOS/shale$"`. S'il reste un processus, l'arrêter par son numéro (il a déjà traité la demande de sortie), puis installer, puis vérifier que le numéro de processus a CHANGÉ après `open`.

## 35.9 Construire ce qui est POUSSÉ quand le dossier principal porte le travail d'une autre session

Le 2026-10-12, `mobile-ios` du dossier principal avait huit commits d'une autre session, ni poussés ni annoncés au carnet. Construire là aurait installé un travail que personne n'avait déclaré fini. Build lancé depuis le worktree du chantier (au commit d'`origin/mobile-ios`) avec `CARGO_TARGET_DIR=<principal>/src-tauri/target` : le cache des dépendances sert, seule la caisse `shale` se recompile, et le bundle sort dans le `target` principal. Contre-épreuve dans `dist/assets` : une phrase de l'AUTRE session doit rendre 0.

# 37. Correctifs d'après le labo (2026-10-11 et 12)

Huit chantiers en parallèle, un agent par worktree. Chaque entrée dit de quel chantier elle vient.

## 37.1 La grille « au premier endroit libre » ne fait pas deux colonnes

*Chantier `sans-energie`.*

**Symptôme.** Sur Aujourd'hui, un trou sous l'anneau de Discipline ; le Calendrier et les Objectifs à gauche alors que Personnaliser les range dans la « colonne droite ». Selon le nombre de tâches du jour, le trou apparaît ou disparaît.

**Cause.** `grid-auto-flow: row dense` pose chaque carte à la première place libre en partant du haut. Une carte étroite (4 colonnes) qui suit une carte large plus courte que sa voisine se glisse sous elle, pas sous la voisine. La carte large suivante a besoin de 8 colonnes libres d'un seul tenant : elle descend, et laisse un vide qu'aucune carte restante ne peut remplir. Aucun ordre de cartes ne corrige cela dans tous les cas (essayé sur le papier : cartes larges d'abord, étroites d'abord, première rangée égalisée — chaque variante casse pour une autre hauteur de contenu).

**Parade.** Donner une colonne aux cartes : `ancre="debut"` ou `ancre="fin"` sur `ResizablePanel` (`lib/grille.ts`). L'ancre ne vaut que pour la disposition intacte ; toute disposition retouchée à la main retrouve le placement libre.

**Comment on l'a payé.** Le trou datait d'avant ce chantier et personne ne l'avait écrit. La capture d'étalonnage du labo du 11/10 ne le montrait pas : ce jour-là la démo avait quatre tâches, et « Liens rapides » tombait par chance exactement dans le vide. **Regarder Aujourd'hui avec trois tâches et avec un compte neuf, pas seulement avec le jeu de démo du jour.**

## 37.2 Retirer un widget décale l'alternance gauche/droite : un ordre enregistré ne « redevient » pas l'ordre par défaut

*Chantier `sans-energie`.*

**Symptôme.** Après le retrait de `energy`, un `order.today` enregistré par l'ancienne version, même jamais réarrangé, ne correspond plus à l'ordre du code.

**Cause.** `TodayView` alterne colonne gauche et colonne droite (`interleave`). Ôter le deuxième widget de gauche décale tous les suivants d'un cran : `discipline, tasks, energy, calendar, timer…` devient, une fois filtré, `discipline, tasks, calendar, timer…`, alors que le code rend maintenant `discipline, tasks, timer, calendar…`.

**Parade.** Ne rien supposer d'un ordre enregistré : il est respecté tel quel (`ordreEffectif`), et la grille de cet utilisateur reste « libre ». Ne pas écrire de test qui attend que l'ancien ordre par défaut soit reconnu comme intact.

**Comment on l'a payé.** Vu en semant une disposition d'avant dans un build de vérification ; sans cet essai, on aurait annoncé à tort que tous les comptes passent en deux colonnes.

## 37.3 Vérifier une disposition enregistrée en mode démo demande de la semer au build

*Chantier `sans-energie`.*

**Symptôme.** Impossible de voir, dans le labo, ce que devient un réglage enregistré par une version antérieure.

**Cause.** En mode démo, les réglages vivent dans une `Map` en mémoire (`lib/demo.ts`), pas dans le `localStorage` : rien à poser avant le chargement, et le pilote n'exécute pas de script dans la page.

**Parade.** Un build de vérification qui ajoute, par un plugin `transform` de Vite, quelques `settings.set(...)` à la fin de `demo.ts` (même principe que `labo/outils/construire.mjs`, aucun fichier source modifié), servi par `construire.mjs servir`.

## 37.4 « ⋯ › Renommer » ne fait rien : le menu reprend le focus au champ qu'il vient d'ouvrir

*Chantier `taches-jour`.*

- **Symptôme.** On choisit « Renommer » dans le menu ouvert par le bouton « ⋯ ». Le menu se ferme, aucun champ ne s'ouvre. Par clic droit, le même geste marche. Au téléphone, où « ⋯ » est le seul accès, l'entrée est morte.
- **Cause.** Le champ s'ouvre bien, avec le focus. Mais le menu, en se fermant, rend le focus à l'élément qui l'avait avant — une image plus tard (`requestAnimationFrame`). Par « ⋯ », cet élément est le bouton « ⋯ », toujours à l'écran : il reprend le focus au champ. Or quitter le champ **valide** le renommage : il se referme aussitôt, inchangé. Par clic droit, l'élément d'avant était la case, que le champ remplace : rien à qui rendre le focus.
- **Parade.** `rendreLeFocus` (`components/menu/useMenuContextuel.ts`) : on ne rend le focus que s'il n'est **nulle part** (sur `<body>`, ou encore dans le menu). Si l'action l'a posé quelque part, il y reste. Tenu par `useMenuContextuel.focus.test.ts`.
- **Comment on l'a payé.** Relevé à l'audit (A11-08), retrouvé par une utilisatrice du crible au téléphone, classé « incertain » jusqu'au rejeu. Aucune erreur, aucun test rouge : le champ existe pendant seize millisecondes.
- **À retenir.** Toute action de menu qui ouvre un champ, un calendrier ou une fenêtre avec le focus est concernée — pas seulement « Renommer ».

## 37.5 Un panneau qui naît invisible ne peut pas recevoir le focus

*Chantier `taches-jour`.*

- **Symptôme.** Le calendrier ouvert par « Dater › Choisir une date… » s'affiche, mais les flèches ne déplacent rien : le focus est resté sur le bouton « ⋯ ».
- **Cause.** Le panneau naît en `visibility: hidden`, le temps d'être mesuré et placé. Un élément invisible ne peut pas recevoir le focus : `focus()` échoue en silence. L'effet qui posait le focus sur la cellule tournait avant que le panneau soit visible.
- **Parade.** Dans `PanneauDate` (`components/ChampDate.tsx`), l'effet de focus dépend de « le panneau est placé ». Même piège, déjà payé le 2026-09-21 par le sous-menu (`MenuContextuel`, commentaire de `SousMenu`).
- **Comment on l'a payé.** Vu au pilote : l'écran en texte disait « a le focus » sur le « ⋯ », pas sur une cellule. Une capture ne l'aurait pas montré.

## 37.6 « Défiler au plus près » pose l'élément sous la barre d'onglets du téléphone

*Chantier `taches-jour`.*

- **Symptôme.** À 390 px, la tâche qu'on vient d'ajouter arrive coupée par le bas de l'écran, sous la barre d'onglets.
- **Cause.** `scrollIntoView({ block: "nearest" })` amène l'élément au bord le plus proche de la zone qui défile. Pour un élément plus bas, c'est le bord bas — que la barre d'onglets, posée par-dessus, recouvre.
- **Parade.** `defilerVers(el, { block: "center" })` quand on veut **montrer** ce qu'on vient de créer (`TasksView`).
- **Comment on l'a payé.** Le pilote annonçait « 3 présents mais inatteignables » sur la ligne ajoutée.

## 37.7 Une carte qui mesure un objectif sans ses événements donne un autre chiffre que sa page

*Chantier `taches-jour`.*

- **Symptôme.** « Objectifs en cours » (Aujourd'hui) et la page de l'objectif n'affichent pas le même pourcentage quand un événement est rattaché.
- **Cause.** Les arêtes et les événements rattachés vivent hors d'`AppData` (`fetchContexteObjectifs`). Qui appelle `effectiveProgress` avec les seules tâches et habitudes obtient une mesure incomplète, sans erreur.
- **Parade.** `useSourcesProgression(data)` (`lib/objectifs/useProgression.ts`) rend les sources complètes. Tout écran qui affiche l'avancement d'un objectif hors de la vue Objectifs passe par lui.

## 37.8 Les tests qui montent une base PGlite expirent pendant une compilation Rust

*Chantier `taches-jour`.*

- **Symptôme.** `src/lib/ia/serveur.test.ts` et `serveur.sql.test.ts` échouent sur « Hook timed out in 60000ms ».
- **Cause.** Une première compilation `cargo test` (quinze minutes ici) occupe tous les cœurs. Rien à voir avec le code testé. C'est PIEGES § 9.11, avec une autre source de charge.
- **Parade.** Ne pas lancer vitest sur tout `src/lib/ia` pendant que cargo compile ; nommer les fichiers.

## 37.9 `tp()` met zéro au pluriel — juste en anglais, faux en français

*Chantier `etapes-cochables`.*

**Symptôme.** Un compteur qui démarre à zéro affiche « 0 étapes sur 3 ».

**Cause.** `tp(n, un, plusieurs)` choisit le singulier pour 1 seulement. C'est la règle anglaise (“0 steps”). En français, zéro s'accorde au singulier (« 0 étape »).

**Parade.** Pour un compteur qui s'affiche souvent à zéro : choisir la forme soi-même (`auSingulier` dans `objectifs/libelles.ts` : 1, ou 0 en français), et écrire chaque clé EN LITTÉRAL dans son `t("…")`.

**Comment on l'a payée.** Vu en écrivant le test français, avant l'écran. La première version passait les clés par une variable : `i18n:check` annonçait « 0 manquante » avec six clés sans traduction (c'est le § 5.2, clé dynamique).

## 37.10 `sqlite3 -readonly` sur la vraie base répond « unable to open database file (14) »

*Chantier `etapes-cochables`.*

**Symptôme.** `sqlite3 -readonly "~/Library/Application Support/com.atnfx.shale/shale.db" "select …"` échoue, alors que `ls` voit le fichier. Même échec sur une copie.

**Cause.** La base est en mode WAL : même pour lire, SQLite veut ouvrir ses fichiers `-wal` / `-shm`, ce que `-readonly` (et le bac à sable d'une session) lui refuse.

**Parade.** Copier `shale.db` dans le dossier de brouillon, l'ouvrir en `sqlite3 "file:<copie>?immutable=1"`, puis SUPPRIMER la copie (ce sont les données d'Antonin). Ne jamais ouvrir l'original en écriture.

**Comment on l'a payée.** Trois essais avant de lire douze lignes. ⚠️ Le § 35.1 recommande `sqlite3 -readonly` tel quel : il ne marche pas depuis une session en bac à sable.

## 37.11 Le compte « neuf » du labo n'a PAS les exemples si l'accueil est sauté

*Chantier `etapes-cochables`.*

**Symptôme.** Pour rejouer A06a-02 (l'objectif d'exemple), on ouvre le build `neuf` : aucun objectif, « Aucun objectif en cours ».

**Cause.** Le pilote saute l'accueil par défaut (`--accueil sauter`), et c'est la fin de l'accueil qui sème les exemples.

**Parade.** `pilote.mjs demarrer … --accueil voir`, puis « Passer » sur le premier écran : les douze exemples sont semés.

**Comment on l'a payée.** Une session du pilote pour rien.

## 37.12 Dans une commande du pilote, un numéro vaut pour l'écran d'AVANT

*Chantier `etapes-cochables`.*

**Symptôme.** `[{"clic":"Détacher…"},{"clic":9}]` : le second clic ne fait rien, ou clique autre chose.

**Cause.** Les numéros changent à chaque écran ; le 9 lu avant la commande ne désigne plus la même chose après le premier pas. Et `{"clic":"texte"}` ne trouve pas une case par son nom de lecteur d'écran, seulement par un texte visible.

**Parade.** Un geste qui change l'écran, puis une NOUVELLE commande pour relire les numéros. Pour une case à cocher : son numéro, jamais son libellé.

**Comment on l'a payée.** Deux fois un « rien n'a changé » pris un instant pour un bogue de la coche.

## 37.13 Un « Annuler » de toast ne se teste pas en deux commandes du pilote

*Chantier `etapes-taches`.*

**Symptôme.** On convertit (ou on supprime), on lit l'écran, puis on envoie `[{"clic":"Annuler"}]` : rien ne revient. On croit l'annulation cassée.

**Cause.** Le toast reste 8 secondes (`DUREE_ANNULER`). Le pilote met environ dix secondes entre deux commandes : le toast est parti avant le second clic.

**Parade.** Le geste et son annulation dans LA MÊME commande : `[{"clic":40},{"attendre":700},{"capture":"toast"},{"clic":"Annuler"},{"attendre":700}]`. Et lire la ligne `PAS n` du clic : « rien à l'écran ne s'appelle Annuler » dit que le toast n'y était plus.

**Comment on l'a payée.** Une commande, et cinq minutes à relire un accès qui marchait (ses tests le disaient).

## 37.14 `i18n:check` ne dit pas qu'une clé anglaise n'a plus d'emploi — et un commentaire la fait passer pour vivante

*Chantier `etapes-taches`.*

**Symptôme.** On retire un bouton. Sa clé reste dans `en.ts` pour toujours : `i18n:check` annonce « 0 clé manquante » et rien d'autre. Une recherche à la main de la clé dans `src` la trouve encore… dans le commentaire qui raconte qu'on l'a retirée.

**Cause.** L'outil cherche les clés MANQUANTES, pas les clés orphelines. Et dans ce dépôt, on cite souvent une ancienne phrase entre guillemets dans un commentaire daté.

**Parade.** Comparer les clés sans emploi AVANT et APRÈS : extraire `src` du commit de départ (`git archive <commit> src | tar -x -C <brouillon>`), lister dans chaque arbre les clés d'`en.ts` qu'aucun fichier `.ts`/`.tsx` ne contient, et faire la différence. Puis vérifier une à une celles qu'on sait avoir retirées et que la liste ne montre pas : elles vivent dans un commentaire. Ici : 27 trouvées par la différence, 6 de plus à la main (quatre citées dans un commentaire, deux déjà orphelines avant le chantier).

**Comment on l'a payée.** Vu avant de commiter. Sans la seconde passe, « Sous-objectif », « En faire une phase » et « Redevenir un sous-objectif » restaient dans le dictionnaire — les trois mots que le chantier retirait.

## 37.15 Jeter une étape emporte ses tâches récurrentes

*Chantier `etapes-taches`.*

**Symptôme.** On veut « remplacer » une étape par autre chose (ici : une tâche) en la jetant. Ses tâches récurrentes disparaissent de Tâches et d'Aujourd'hui.

**Cause.** Depuis le 2026-09-30, un objectif ou une étape mis à la corbeille emportent TOUTES leurs tâches (`corbeille/lots.ts`), récurrentes comprises. Or une étape peut être « vide » pour la mesure et porter quand même une récurrente (une récurrente ne compte jamais comme une unité).

**Parade.** Avant de jeter une étape qu'on remplace : rattacher ses tâches ailleurs (`rattacherTache`), et noter lesquelles pour pouvoir les rendre. C'est ce que fait `convertirEtapeEnTache` (le reçu `tachesDeplacees`).

**Comment on l'a payée.** Vu en écrivant le plan, avant l'écran. Un test le tient (« rien n'est perdu en silence »).

## 37.16 `rattacherTache` et `setTaskDone` ADOPTENT un exemple

*Chantier `etapes-taches`.*

**Symptôme.** Une tâche d'exemple qu'un geste technique déplace ou coche cesse d'être un exemple : « Supprimer les exemples » ne l'emporte plus.

**Cause.** Les deux accès appellent `adopter` (un exemple cesse d'en être un dès que l'utilisateur y touche). C'est voulu pour un geste de l'utilisateur, pas pour une écriture que l'app fait à sa place.

**Parade.** Dans une écriture composée : cocher D'ABORD, marquer exemple ENSUITE (`marquerExemple(table, id, true)`), et re-marquer toute tâche d'exemple qu'on vient de déplacer.

**Comment on l'a payée.** Vu à la lecture de `repo.ts`. Le test « une étape d'EXEMPLE donne une tâche d'exemple » échoue si on inverse l'ordre.

## 37.17 Dans la fenêtre « Nouvel objectif », « Créer » est sous le pli : le pilote ne le voit pas

*Chantier `etapes-taches`.*

**Symptôme.** `{"clic":"Créer"}` : « rien à l'écran ne s'appelle Créer », alors que la fenêtre est ouverte.

**Cause.** À 900 px de haut, dès qu'une ligne est saisie dans « Par quoi commencer », le pied de la fenêtre passe sous le bas (constat 20 du labo, que le chantier `telephone` corrige).

**Parade.** En attendant sa fusion : `{"defiler":"bas","sur": <n° d'un champ de la fenêtre>}`, puis `{"clic":"Créer"}`.

**Comment on l'a payée.** Une commande.

*(Déjà écrit par le chantier précédent, et repayé une fois ici : dans une commande du pilote, un numéro vaut pour l'écran d'AVANT. Après avoir ajouté une ligne, relire les numéros.)*

## 37.18 `formatRange` existe dans tous les moteurs, pas dans les types du projet

*Chantier `performance-jour`.*

- **Symptôme** : `npx tsc --noEmit` refuse `new Intl.DateTimeFormat(…).formatRange(a, b)` (« Property 'formatRange' does not exist »). Le code tourne pourtant sous Node et Chrome.
- **Cause** : la cible de compilation (ES2021) n'a pas les types d'`Intl` plus récents.
- **Parade** : lire la méthode à travers un type local, et garder un repli (`lib/performance/dates.ts`). Ne pas changer la `lib` du projet pour un appel.
- **Payé** : une passe de `tsc`.

## 37.19 `.at(-1)` passe sous vitest et casse `npm run test:types`

*Chantier `performance-jour`.*

- **Symptôme** : les tests sont verts, `tsc -p tsconfig.test.json` échoue (« Property 'at' does not exist… es2022 »).
- **Cause** : vitest exécute sans vérifier les types ; la cible des types de test est ES2021.
- **Parade** : `tableau[tableau.length - 1]`. Toujours jouer `test:types` après avoir écrit un test.
- **Payé** : trois lignes à reprendre.

## 37.20 `title` + `data-tip` sur le même élément : deux bulles

*Chantier `performance-jour`.*

- **Symptôme** : au survol, la bulle de l'app, puis une seconde, grise, du navigateur.
- **Cause** : `title` déclenche la bulle native en plus de `data-tip`.
- **Parade** : l'un ou l'autre. Si l'élément porte `data-tip`, donner son nom par `aria-label`, pas par `title`.
- **Payé** : rattrapé avant le premier build.

## 37.21 Une durée dans une phrase se coupe en fin de ligne

*Chantier `performance-jour`.*

- **Symptôme** : dans une bulle étroite, « 8 h 15 » devient « 8 » puis « h 15 ».
- **Cause** : des espaces ordinaires.
- **Parade** : `enHeuresInsecable` (`lib/performance/durees.ts`) pour toute durée placée dans une phrase ; `enHeures` pour un chiffre seul.
- **Payé** : vu au survol, un build de plus.

## 37.22 Labo — les numéros du pilote changent après un clic, et un pas raté n'arrête pas la capture

*Chantier `performance-jour`.*

- **Symptôme** : `[{"clic":"Par objectif"},{"dans":20,"taper":"5"}]` : la capture montre l'onglet sans la saisie, sans erreur visible si l'on ne lit que la dernière ligne.
- **Cause** : le « 20 » était le numéro d'un élément de l'écran d'AVANT le clic. Le pas n'est pas joué.
- **Parade** : un `faire` pour changer d'écran, relire les numéros, un second `faire` pour agir. Lire le texte rendu, pas seulement le chemin de la capture.
- **Payé** : une capture à refaire.

## 37.23 Labo — le pilote ne survole que ce qui se clique

*Chantier `performance-jour`.*

- **Symptôme** : `{"survol":"9 h 35"}` répond « rien à l'écran ne s'appelle… » : impossible de voir la bulle d'une tuile ou d'une légende.
- **Cause** : le pilote ne numérote que les éléments actionnables.
- **Parade** : un petit script à part, avec le même `puppeteer-core` (celui de `shale-site/vitrine`), `--disable-features=MacAppCodeSignClone`, un profil jetable supprimé à la fin, les requêtes hors `127.0.0.1` bloquées. Entrer d'abord dans le panneau avant de viser un élément de son en-tête : l'en-tête se décale pour laisser la place aux poignées de la grille, et la souris tombait sur « Actions ». Attendre 2,7 s : les explications (`data-tip-attente="longue"`) n'apparaissent qu'après 2 s.
- **Payé** : trois essais du script.

## 37.24 Machine chargée : `tsc` dépasse deux minutes

*Chantier `performance-jour`.*

- **Symptôme** : `npx tsc --noEmit` ne rend pas la main en 120 s, avec quatre chantiers en parallèle (charge moyenne à 41).
- **Cause** : § 9.11, la charge machine.
- **Parade** : lancer les vérifications longues et les builds du labo en arrière-plan, avec un délai de dix minutes.

## 37.25 Un champ ouvert depuis un menu contextuel perd le focus une image plus tard

*Chantier `notes-a-trier`.*

- **Symptôme.** « Rattacher… » choisi dans le menu « ⋯ » ouvrait bien le champ
  « Lier », mais la frappe partait dans le vide : le focus était sur la ligne de
  la liste. Le même bouton, cliqué dans l'éditeur, laissait le focus au champ.
- **Cause.** `useMenuContextuel.fermer` rend le focus à l'élément d'origine dans
  un `requestAnimationFrame`, et le menu se ferme AVANT d'exécuter l'entrée. Le
  champ prend le focus à son montage (`autoFocus`), puis le menu le lui reprend.
- **Parade.** Dans le composant qui ouvre le champ, redemander le focus dans un
  `requestAnimationFrame` posé par l'effet : demandé après celui du menu, il
  passe après lui (`PanneauLiens`, effet de `demandeAjout`).
- **Comment on l'a payée.** Vu au pilote (« a le focus » sur la mauvaise
  ligne) ; une reconstruction de plus.

## 37.26 Au pilote, un « Annuler » de toast a disparu avant la commande suivante

*Chantier `notes-a-trier`.*

- **Symptôme.** `{"clic":"Annuler"}` répond « rien à l'écran ne s'appelle
  Annuler » alors que la capture précédente montrait le toast.
- **Cause.** Un toast avec « Annuler » dure 8 s ; une dizaine de secondes
  passent entre deux commandes `faire`.
- **Parade.** Enchaîner le geste et « Annuler » dans la MÊME commande `faire`.
- **Comment on l'a payée.** Un aller-retour, et un doute de deux minutes sur le
  bouton.

## 37.27 Un fichier « pur » qui importe `lib/actions.ts` embarque tout le dépôt

*Chantier `notes-a-trier`.*

- **Symptôme.** Aucun à l'écran. `norm` (minuscules, sans accents) vit dans
  `lib/actions.ts`, qui importe `repo.ts`.
- **Parade.** Prendre `normaliser` dans `lib/tachesVue.ts` (même formule, pur),
  et tenir les deux d'accord par un test. Il y a déjà trois copies de cette
  formule (`actions.ts`, `tachesVue.ts`, `knowledge.ts`) : ne pas en écrire une
  quatrième.

## 37.28 Un titre « par défaut » est une DONNÉE, figée dans la langue du jour de la création

*Chantier `notes-sans-titre`.*

- **Symptôme.** Aucun à l'écran tant qu'on ne change pas de langue. Une note
  créée par ⌘⇧N en anglais s'appelle « New note » pour toujours, même une fois
  l'app repassée en français. Un critère qui compare le titre à
  `t("Nouvelle note")` — la langue du jour — la raterait.
- **Cause.** `createNote(t("Nouvelle note"), "")` traduit à la création et
  stocke le résultat. Et l'enregistrement d'un titre effacé écrit « Sans
  titre » en dur, en français, même en anglais.
- **Parade.** Reconnaître **toutes** les formes à la fois, sans regarder la
  langue du jour (`TITRES_D_OFFICE` dans `lib/notesSansTitre.ts`), et tenir la
  liste d'accord avec `en.ts` par un test. Si une traduction change, garder
  l'ancienne dans la liste.
- **Comment on l'a payée.** Pas payée : trouvée en lisant `createNote` avant
  d'écrire le critère.

## 37.29 `tools/i18n-check.mjs` lit aussi les commentaires des tests

*Chantier `notes-sans-titre`.*

- **Symptôme.** `npm run i18n:check` : « 1 clé sans traduction anglaise : "…" »,
  dans un fichier de test.
- **Cause.** Un commentaire citait la forme d'un appel, avec `t(` suivi d'un
  guillemet et de points de suspension. L'outil cherche ce motif dans tout
  `src`, tests et commentaires compris.
- **Parade.** Dans un commentaire, décrire l'appel en mots plutôt que le citer.
- **Comment on l'a payée.** Un aller-retour.

## 37.30 Au pilote, cliquer par son nom un onglet qui porte le même mot qu'un texte d'invite

*Chantier `notes-sans-titre`.*

- **Symptôme.** `{"clic":"Sans titre"}` répond « ok » mais l'onglet ne change
  pas.
- **Cause.** Le champ du titre a « Sans titre » pour texte d'invite : le pilote
  a cliqué le champ, pas l'onglet.
- **Parade.** Cliquer l'onglet par son numéro (`{"clic":20}`), lu sur l'écran
  précédent. Et dans une même commande `faire`, les numéros sont ceux de
  l'écran de DÉPART : après un clic qui change d'écran, relancer une commande.
- **Comment on l'a payée.** Deux commandes pour rien.

## 37.31 De `DOC-notes-a-trier.md`, à recopier quand même

*Chantier `notes-sans-titre`.*

- « Au pilote, un "Annuler" de toast a disparu avant la commande suivante » :
  toujours vrai.
- « Un fichier "pur" qui importe `lib/actions.ts` embarque tout le dépôt » :
  toujours vrai.
- « Un champ ouvert depuis un menu contextuel perd le focus une image plus
  tard » : le piège reste vrai (c'est `useMenuContextuel.fermer` qui rend le
  focus), mais le code qui servait d'exemple (`PanneauLiens`, `demandeAjout`)
  n'existe plus. L'exemple vivant est `renommerNote` dans `NotesView.tsx`, qui
  demande le focus dans un `requestAnimationFrame`.

## 37.32 Deux écouteurs clavier sur `window` : c'est l'ordre de POSE qui décide, pas l'ordre des couches

*Chantier `telephone`.*

**Symptôme.** Échap sur le calendrier de date ferme la fenêtre qui le porte, saisie comprise. Le garde `if (e.defaultPrevented) return` est pourtant écrit dans la fenêtre, et le calendrier appelle bien `preventDefault()`.

**Cause.** Les deux écoutent `window` en phase de remontée. À phase égale, les écouteurs d'un même élément passent dans l'ordre où ils ont été posés. La fenêtre est montée avant le calendrier : elle lit la touche avant qu'elle ne soit marquée.

**Parade.** La couche qui s'ouvre par-dessus écoute en **capture** (`addEventListener("keydown", f, true)`, et le même `true` au retrait). Elle y ajoute `|| menuContextuelOuvert()` : en capture, elle passerait aussi avant un menu contextuel. Tenu par `src/lib/fenetres.source.test.ts`.

**Comment on l'a payée.** Témoin A17-01 de l'audit d'octobre, resté ouvert alors que la règle était écrite dans `CLAUDE.md` et appliquée des deux côtés. Aucun utilisateur du crible ne l'a vu : personne n'a pressé Échap à cet endroit.

## 37.33 Un `position: fixed` dans une vue DÉFILE avec elle — au doigt, la fenêtre s'en va

*Chantier `telephone`.*

**Symptôme.** Une fenêtre ouverte, on glisse du doigt sur son pied : la page derrière défile, et la fenêtre monte avec elle hors de l'écran. Au bureau, même chose avec la molette sur le voile. Et ouvrir une fenêtre ramène la vue tout en haut.

**Cause.** Suite du § 9.5. La zone qui défile (`App.tsx`) porte `animate-fade-up`, dont le remplissage `both` tient `transform: translateY(0)` après l'animation. Elle devient le bloc conteneur de ses descendants `fixed` : `inset-0` y veut dire « le contenu de la vue », qui défile. Le champ en `autoFocus` de la fenêtre explique le retour en haut : le navigateur fait défiler la vue pour le montrer.

**Parade.** Au téléphone : `animation-fill-mode: backwards` sur `.vue-defilante`, et `overflow-y: hidden` tant qu'elle contient un `.fenetre-voile`. Au bureau le défaut reste (voir PASSATION). Pour une couche nouvelle : un portail sur `document.body`.

**Comment on l'a payée.** Trouvé en pilotant au doigt, par hasard : la sonde amenait un champ à l'écran (`scrollIntoView`) et la fenêtre sortait par le haut. Mesuré ensuite avec un vrai glissé tactile : 550 px.

## 37.34 Un conteneur flex borné COMPRIME ses enfants avant de défiler

*Chantier `telephone`.*

**Symptôme.** Dans une fenêtre pleine, une zone de texte perd une ligne de hauteur ; rien d'autre ne semble changé.

**Cause.** Un corps écrit `flex flex-col gap-4` dont la hauteur est bornée (`overflow-y: auto`, `min-height: 0`) : ses enfants ont `flex-shrink: 1`, donc ils rétrécissent tant qu'ils le peuvent — un `<textarea>` le peut — et le défilement n'arrive qu'ensuite.

**Parade.** `flex-shrink: 0` sur les enfants d'un corps qui défile (`.fenetre-corps > *`).

**Comment on l'a payée.** Vu seulement en comparant, élément par élément, la mise en page du bureau avant et après (`outils/bureau.mjs` puis `comparer.mjs`) : 62 px devenus 49. À l'œil, sur la capture, rien.

## 37.35 Une règle de la couche `components` perd contre un utilitaire, quelle que soit sa spécificité

*Chantier `telephone`.*

**Symptôme.** `html[data-telephone] .vue-defilante { animation-fill-mode: backwards }`, écrit dans `@layer components`, ne change rien : l'élément garde `both`.

**Cause.** `animate-fade-up` est déclaré dans `@layer utilities`, couche postérieure. Entre deux couches, la dernière gagne — la spécificité ne compte qu'à l'intérieur d'une couche. Même piège que `.truncate-souris` (qui s'en sort par `!important`).

**Parade.** Écrire la règle hors de toute couche (elle passe devant toutes), ou en utilitaire (`telephone:…`), ou avec `!important` quand elle doit battre un utilitaire posé par la vue (`.fenetre-voile` et ses marges).

## 37.36 Outils de mesure : trois façons de se tromper

*Chantier `telephone`.*

- **Chercher un élément par son texte trouve d'abord celui qui est DERRIÈRE le voile.** « Échéance » désignait la date d'une tâche de la liste, sous la fenêtre ouverte ; le toucher tombait sur le voile et fermait la fenêtre. Le rejeu concluait « Échap ferme la fenêtre » alors qu'Échap n'y était pour rien. Parade : chercher DANS la fenêtre (`dans: ".fenetre"`).
- **`innerText` rend le texte tel qu'il est AFFICHÉ.** Un titre en `text-transform: uppercase` s'y lit « MENTIONNÉ DANS » : une recherche de « Mentionné dans » ne le trouve pas, et une mesure qui dépend de lui répond « pas de chevauchement » sur un élément absent. Parade : comparer sans la casse, et vérifier que l'élément a été trouvé avant de conclure.
- **Un contrôle replié dans un cadre qui masque a toujours un rectangle.** Les modules d'un groupe fermé de la barre latérale mesurent 36 px de haut, sous un parent de hauteur nulle. Un clic à leurs coordonnées tombe ailleurs. Parade : écarter ce qui est hors du rectangle d'un ancêtre en `overflow: hidden`.
- **Une zone de toucher élargie par un pseudo-élément ne se mesure pas** avec `getBoundingClientRect()` : le rectangle rendu est celui du dessin.

## 37.37 Une ref lue pendant le rendu, remise à zéro dans l'effet, annule l'effet

*Chantier `fusion`.*

- **Symptôme.** Le curseur allait dans le texte après ⌘⇧N, jamais après le bouton « + ». Aucune erreur.
- **Cause.** La « note à saisir » était une `useRef`, lue pendant le rendu pour calculer la dépendance de l'effet, et remise à `null` DANS l'effet. Au rendu suivant (le « + » en provoque un, ⌘⇧N non) la dépendance changeait, et le nettoyage de l'effet annulait le `requestAnimationFrame` avant qu'il pose le focus.
- **Parade.** Ce qui décide d'un effet est un ÉTAT, pas une ref ; et on le remet à zéro quand le geste est FAIT (dans le rappel), pas quand il est programmé.
- **Comment on l'a payée.** Deux builds de démo et trois rejeux au pilote.

## 37.38 `git merge-tree` propre ne promet pas un `git rebase` propre

*Chantier `fusion`.*

- **Symptôme.** Un chantier annonçait « fusion simulée sans conflit » ; son rebase sur le tronc s'est arrêté au premier commit.
- **Cause.** Un rebase rejoue les commits UN PAR UN : un fichier modifié puis rendu à son état d'origine dans la branche (ici `ia/revue.ts`) entre en conflit au commit intermédiaire, alors que l'état final fusionne sans rien.
- **Parade.** Quand une branche a plusieurs commits et que le tronc a bougé : `git merge mobile-ios` DANS le worktree de la branche, vérifier là, puis avance rapide du tronc. `git rebase --abort` ne laisse rien.

## 37.39 Deux chantiers ajoutent la même clé à `en.ts` : la fusion passe, `tsc` refuse

*Chantier `fusion`.*

- **Symptôme.** Après une fusion sans conflit : `error TS1117: An object literal cannot have multiple properties with the same name` sur `en.ts`.
- **Cause.** « Par objectif » ajoutée par deux chantiers, à deux endroits du fichier, avec la même traduction. Git n'y voit aucun conflit.
- **Parade.** `npx tsc --noEmit` après CHAQUE fusion, avant de pousser. ⚠️ Et lire son code de sortie sans tuyau : `npx tsc --noEmit | tail; echo $?` affiche le code de `tail`, toujours 0.

## 37.40 Fusionner dans le worktree principal sans l'écrire au carnet

*Chantier `fusion`.*

- **Symptôme.** Une session voisine a pris le verrou de build et trouvé huit commits locaux « non poussés et non annoncés » dans le worktree principal. Elle a dû construire depuis son propre worktree.
- **Cause.** Trois branches fusionnées en avance rapide puis vingt minutes de tests avant la ligne `FUSIONNÉ` et le `git push`.
- **Parade.** Vérifier la branche fusionnée DANS SON worktree d'abord ; puis, d'un seul geste : avance rapide du tronc, `git push`, ligne au carnet.

# 38. Retours de la seconde passe du labo (2026-10-12)

Un seul chantier, après la seconde passe du labo.

## 38.1 Un calque plein écran qui ne prend pas le clavier laisse la page de derrière répondre

*Chantier `retours-passe2`.*

**Symptôme.** L'horloge du minuteur couvre tout l'écran. On appuie sur Espace pour mettre en pause : le menu « ⋯ » d'une tâche s'ouvre par-dessus l'horloge. Un second Espace marque la tâche faite. Rien ne le montre.

**Cause.** Recouvrir n'est pas prendre la main. Le calque était un simple `fixed inset-0` : le focus restait sur le bouton d'où l'on avait lancé la séance, sous le calque. Et le menu contextuel **rendait** le focus à ce bouton une image après s'être fermé (`rendreLeFocus`).

**Parade.** `ouvrirCalque()` (`src/lib/calque.ts`) : `inert` sur `#root`, focus dans le calque, retour du focus à la fermeture. Le calque vit sur `document.body` (§ 18.1). `rendreLeFocus` ne donne jamais le focus à un élément sous `[inert]`. Un test de source (`calque.test.ts`) tient la règle pour l'horloge, la carte mentale et le croquis.

**Payé.** Seconde passe du labo, 12 octobre : trois utilisateurs sur trois qui ont cherché la pause au clavier y sont tombés. Le défaut existait depuis le 30 septembre ; l'entrée « Focus 25 min » du menu de Tâches, ajoutée le 11 octobre, l'a mis sur le chemin de tout le monde.

## 38.2 `inert` posé à la main par deux calques : le premier fermé rallume l'app sous le second

*Chantier `retours-passe2`.*

**Symptôme.** Aucun vu : trouvé en écrivant. Deux calques l'un sur l'autre posent `inert` sur `#root` ; le premier qui se ferme le retire, et l'app redevient cliquable sous celui qui reste.

**Cause.** `setAttribute("inert")` / `removeAttribute("inert")` dans le `useEffect` de chaque calque, sans compter.

**Parade.** `rendreLeResteInerte()` (`src/lib/calque.ts`) compte. Personne ne pose `inert` sur `#root` autrement ; un test de source le refuse.

## 38.3 Arrêter une touche en capture sur `window` coupe aussi ce qui écoute `document` en capture

*Chantier `retours-passe2`.*

**Symptôme.** Évité avant d'être payé. Pour que le clavier n'aille plus à l'app derrière l'horloge, le premier réflexe est un écouteur en capture sur `window` qui arrête tout. L'info-bulle de l'app se referme à la frappe par un écouteur en capture sur `document` : elle n'aurait plus reçu aucune touche.

**Parade.** Écouter sur `document`, en remontée, et arrêter la touche là. Les raccourcis de l'app écoutent `window` : ils sont un cran plus haut et ne la voient pas. Ce qui écoute `document` en capture est déjà passé.

## 38.4 Deux sections de `CLAUDE.md` sur le même écran, la seconde rangée loin de la première

*Chantier `retours-passe2`.*

**Symptôme.** La section « 2026-09-29 — Timer » décrit un plein écran avec « Pause », une jauge, des gestes de fenêtre. L'écran n'en montre aucun. On cherche un bogue : composant pas branché, calque passé dessous.

**Cause.** Il n'y a pas de bogue. La section « 2026-09-30 — Timer, second passage » retire ces boutons à la demande d'Antonin. Elle a été fusionnée le 11 octobre et se trouve 850 lignes plus bas, après des sections datées d'octobre. La première ne renvoie pas à la seconde.

**Parade.** Avant de corriger un écart entre `CLAUDE.md` et l'écran, chercher le nom du composant dans **tout** le fichier (`grep -n "epure\|épuré" CLAUDE.md`). Et, en écrivant une section qui en retourne une autre, ajouter une ligne à l'ancienne.

**Payé.** 12 octobre : la mission de ce chantier a été écrite en croyant à un défaut de branchement. Dix minutes de lecture pour le voir, mais la décision retournée a failli passer pour une simple réparation.

## 38.5 Un numéro après un jour de la semaine : date, heure, plage ou quantité

*Chantier `retours-passe2`.*

**Symptôme.** « avant jeudi 22 » donnait le jeudi 15 et laissait « 22 » dans le titre. En le corrigeant sans garde : « jeudi 14h30 » lit le 14, « jeudi 2 baguettes » lit le 2 du mois, « jeudi 8-10h » lit le 8, « Jeudi 22 : commander » ne lit plus rien (les deux points étaient pris pour une heure).

**Parade.** Dans `saisieRapide.ts` : `pasUneDate` écarte ce qui suit un numéro quand c'est une heure (« h », « : » suivi d'un chiffre, am / pm), une plage (tiret suivi d'un chiffre), un pourcentage ou un décimal. Et ce qui suit le numéro décide : rien, une ponctuation ou une heure → date ; un nom → quantité, sauf si le numéro tombe ce jour-là. Chaque cas a son test, dans les deux langues.

## 38.6 Outil — taper dans un numéro d'élément périmé replie la barre latérale

*Chantier `retours-passe2`.*

**Symptôme.** Au pilote, `{"dans": 15, "taper": …}` après un changement d'écran : le n° 15 n'était plus le champ mais « Réduire » la barre. La barre s'est repliée, le texte est parti nulle part, puis s'est ajouté au champ au pas suivant.

**Parade.** Relire les numéros après chaque geste qui change l'écran (le protocole le dit : deux à quatre pas par commande). Avant de retaper : `{"clic": n}` puis `{"vider": true}`.

# 39. Barre latérale continue (2026-10-12)

## 39.1 Un `padding` ne rétrécit pas : une « réserve de fondu » déborde au rail

**Symptôme.** Au rail, la pastille de synchro affichait « syn… » HORS de son contour.

**Cause.** Pour fondre un texte dans une boîte serrée sur lui, on lui donne un `padding-right` (qui porte le fondu) et une marge négative égale. Un élément flex ne descend jamais sous son padding : à largeur nulle, il reste 20 px de texte visible.

**Parade.** Faire dépendre la réserve de la largeur (`clamp(0px, calc(var(--barre-w) - 100px), 10px)`) ET borner la boîte par un `max-width` calculé qui atteint 0 au rail. Et ne jamais donner à la réserve plus que le padding du conteneur, sinon le fondu sort du contour.

## 39.2 Un masque de fondu sur une boîte serrée sur son texte mange la fin du mot

Un `mask-image` en dégradé s'applique à la BOÎTE. Si elle épouse le texte, les vingt derniers pixels du mot sont toujours estompés, même quand tout tient. Deux sorties : la boîte prend la place restante (`flex-1`, le fondu tombe dans le vide), ou elle porte une réserve (§ 39.1).

## 39.3 Comparer deux mesures de fluidité prises à des charges machine différentes

**Ce qui a failli être écrit.** « 178 ms → 24 ms au pire dixième. » Le 178 avait été pris machine à 55 de charge (une autre session lançait vitest), le 24 à 5.

**Parade.** Remesurer l'AVANT dans la même minute : `git diff > x.patch`, `git checkout -- src`, mesurer, `git apply x.patch` (§ 34.3 — pas `git stash`, commun aux worktrees). Le vrai avant valait 102, pas 178.

## 39.4 Un geste piloté hors de React : tout rendu au milieu doit relire la valeur vive

Pendant qu'on tire le bord, la largeur est écrite sur l'élément. Un rendu de la barre qui tomberait au milieu (la cloche, un badge) remettrait la largeur d'avant pour une image. D'où `vive` (une ref) lue par le rendu : `vive.current ?? largeurDeLEtat`.

## 39.5 Outils

- Le dossier de travail de la session (`scratchpad`) est VIDÉ quand la session redémarre : scripts de mesure, captures, profil Chrome. Recopier dans le projet ce qui doit survivre.
- puppeteer : `page.tracing.stop()` rend des octets ; `.toString()` en fait une liste de nombres. `Buffer.from(…).toString("utf8")`.

## 40. Retours après essai du 2026-10-12 (soir)

Pièges rencontrés par les trois chantiers du soir du 12 octobre. Numérotation : 40.x dans l'ordre de lecture.

### `perf-epure` — Performance épurée, et les cartes qui ne bougent plus au survol

##### Une réserve posée AU SURVOL sur un conteneur qui sait se replier

**Symptôme.** Une carte grandit quand la souris passe dessus, et ses voisines changent de place. Rien au repos, rien dans les captures.
**Cause.** `.rgrid-head` posait un `padding-right` au survol du panneau, et la même classe donne `flex-wrap: wrap`. Quand le padding mange la place libre, le dernier enfant passe à la ligne : 24 px de plus, que la grille (`grid-auto-flow: dense`) répercute sur tout le reste.
**Parade.** Tout ce qui change de taille au survol doit être inerte pour la mise en page (`transform`, `opacity`), ou bien décidé AVANT le survol par une mesure. Ici : `components/grid/entetes.ts`. Pour vérifier : une vraie souris (`page.mouse.move`), et lire `offsetHeight` de tous les panneaux avant et pendant.
**Comment on l'a payée.** Antonin l'a vu dans l'app installée, sur l'écran qu'il regardait.

##### Mesurer un survol avec `getBoundingClientRect` : tous les panneaux « bougent »

**Symptôme.** L'outil de mesure annonce que chaque panneau de chaque vue monte de 2,2 px au survol.
**Cause.** Le panneau survolé se soulève de 2 px par `translate` (V7, voulu) : c'est du dessin, pas de la mise en page. `getBoundingClientRect` voit les transformations. Et à 110 %, ses valeurs sont en px d'écran quand `scrollTop` est en px locaux.
**Parade.** Pour la mise en page, lire `offsetTop`, `offsetLeft`, `offsetWidth`, `offsetHeight` (remontés par `offsetParent`) : insensibles aux transformations et à la densité.
**Comment on l'a payée.** Un premier relevé illisible, où le vrai défaut (une carte sur trente) était noyé dans trente faux.

##### Tester une valeur en la posant en ligne : le navigateur anime le retour

**Symptôme.** Un en-tête se replie puis se déplie tout seul à chaque mesure ; la mesure se relance.
**Cause.** L'élément a `transition: padding-right`. Poser un padding d'essai en ligne, lire, puis le retirer : au recalcul suivant le navigateur voit le padding passer de la valeur d'essai à la valeur de repos, et l'anime.
**Parade.** Tenir `transition: none !important` en ligne pendant tout l'essai, retirer la valeur d'essai, FORCER une lecture (`offsetHeight`), et seulement alors retirer `transition`. Écrit en tête de `entetes.ts`. Évité à l'écriture, pas rencontré à l'écran.

##### `set -- $variable` ne découpe pas en zsh

**Symptôme.** Une boucle de mesures « à quatre tailles de fenêtre » rend quatre fois le même résultat.
**Cause.** zsh ne découpe pas une variable sur les espaces : `set -- $cfg` pose UN argument, les autres sont vides, et le script retombe sur ses valeurs par défaut sans rien dire.
**Parade.** Passer les arguments un par un à une fonction, et faire écrire au script la taille et la densité qu'il a réellement prises — c'est cette ligne (« fenêtre 1470×923 · zoom 1 ») qui a montré l'erreur.

### `focus-ile` — le focus sans plein écran, la pastille du minuteur, la barre des menus

##### Une option « vraie par défaut » rend l'effet à tous ceux qui l'oublient

*Chantier `focus-ile`.*

**Symptôme.** « Focus 25 min » depuis une tâche recouvre toute l'app d'une horloge. Depuis la carte Timer, non.

**Cause.** `useFocus.start` ouvrait le plein écran sauf si l'appelant écrivait `openOverlay: false`. Deux appelants sur cinq l'écrivaient. Les trois autres (menu de Tâches, ▶ d'Aujourd'hui, palette) l'avaient oublié, ou ne savaient pas qu'il fallait.

**Parade.** Un effet lourd se demande, il ne se refuse pas : l'option vaut « non » quand elle est absente. Un test de source refuse tout `openOverlay: true` dans le dépôt (`gesteFocus.test.ts`).

**Payé.** Le défaut du labo du 12 octobre (six utilisateurs devant l'horloge) et le retour d'Antonin du soir viennent de là.

##### Une règle recopiée dans chaque vue manque dans celles qui ne l'ont pas recopiée

*Chantier `focus-ile`.*

**Symptôme.** « Focus 25 min » est dans le menu d'une tâche à tel endroit, pas à tel autre, et disparaît par moments.

**Cause.** `focus && !focus.session ? (task) => focus.start(…) : undefined`, écrit dans chaque vue. Le Calendrier et la feuille de route ne l'avaient pas : pas d'entrée. Et `undefined` pendant une séance : l'entrée disparaissait au lieu de dire pourquoi.

**Parade.** La règle dans un fichier pur (`lib/seance/focusTache.ts`), le geste dans un contexte (`ContexteFocus`). Une entrée qui ne peut pas agir est grisée avec sa raison, jamais retirée. Deux tests de source : tout menu de tâche lit le geste ; aucune vue ne lance le minuteur à la main sur une tâche.

**Payé.** « Je n'arrive pas à tout le temps lancer le focus depuis la tâche » (Antonin, 12 octobre).

##### Un texte ajouté à la fin d'une ligne coupée ne se lit jamais

*Chantier `focus-ile`.*

**Symptôme.** La pastille d'une séance en pause n'écrit pas « en pause » quand le nom de la tâche est long.

**Cause.** « nom · en pause » dans un seul `truncate` : c'est la fin qui part dans les points de suspension.

**Parade.** L'état dans son propre élément, qui ne rétrécit pas (`shrink-0`), placé avant le texte qui peut être coupé.

**Payé.** Vu sur la première capture, corrigé avant de rendre.

##### Une pastille qui contient des cibles de 44 pt ne fait plus 44 pt

*Chantier `focus-ile`.*

**Symptôme.** Au téléphone, la pastille mesure 54 px ; sa réserve (`--reserve-seance`) en compte 52.

**Cause.** Elle était un bouton de 44 pt, bordure comprise. Devenue un cadre qui contient trois boutons de 44 pt, elle ajoute sa marge intérieure et son filet.

**Parade.** Pas de marge verticale au téléphone ; la réserve est recalculée (46 + 8). Toute variable qui réserve la place d'un élément se remesure quand l'élément change de structure.

**Payé.** Mesuré sur capture à 390 px avant de rendre.

##### Outil — un numéro d'élément lu avant un geste ne vaut plus après

*Chantier `focus-ile`. Déjà noté au § 38.6 ; second cas.*

**Symptôme.** Deux tâches cochées par erreur, puis une pause prise et reprise dans la même commande.

**Cause.** La pastille ajoute trois boutons en tête d'écran : tous les numéros suivants se décalent de trois dès qu'une séance démarre. Un survol qui révèle un ▶ décale aussi.

**Parade.** Relire l'écran après tout geste qui lance ou termine une séance. Préférer le texte au numéro (`{"clic":"Focus 25 min"}`).

### `dates-claires` — la pastille « sans date », l'échéance d'un objectif

##### Le calendrier de l'app passe SOUS un calque plus haut que 190

- **Symptôme** : un `ChampDate` posé dans l'accueil aurait semblé ne rien ouvrir. Le panneau s'ouvre, derrière le voile.
- **Cause** : `PanneauDate` vit dans un portail à `z-[190]`. L'accueil était à `z-[200]`, seul élément de l'app au-dessus de 96.
- **Parade** : avant de poser un `ChampDate` (ou un `ouvrirSelecteurDate`) dans un calque, lire son `z-index`. L'accueil est maintenant à `z-[180]`. Les info-bulles sont à 200, l'écran de démarrage au-dessus.
- **Comment on l'a payée** : rien, lu avant d'essayer. Vérifié à l'écran ensuite (bureau et téléphone).

##### Une règle sur la « naissance » d'un objet : la démo est plus indulgente que le natif

- **Symptôme** : une règle « créé aujourd'hui » juste en démo, fausse en natif entre minuit et 2 h du matin.
- **Cause** : en démo `created_at` vaut `todayStr()` (jour local). En natif SQLite écrit `datetime('now')`, en temps universel : un objectif créé à 0 h 30 à Paris porte la date de la veille.
- **Parade** : comparer avec un jour de marge (`vientDeNaitre` : aujourd'hui ou hier), et l'écrire dans un test avec une date de la veille.
- **Comment on l'a payée** : rien, vu en lisant la migration 001.

##### La fabrique de test `objectif()` naît le jour même où plusieurs tests se placent

- **Symptôme** : une règle qui lit `created_at` fait tomber des tests sans rapport.
- **Cause** : `objectif.testutil.ts` crée au `2026-09-01 09:00:00`, et plusieurs suites prennent le 1er septembre 2026 pour « aujourd'hui ».
- **Parade** : dans un test qui dépend de l'âge, donner `created_at` explicitement (`charge.test.ts` le fait déjà : 1er août).
- **Comment on l'a payée** : un test neuf à corriger.

##### Pilote du labo : deux faux pas

- Taper une date dans le calendrier : à l'ouverture le focus est sur la grille, pas sur le champ « jj/mm/aaaa ». `{"taper": "17/10"}` seul ne tape nulle part. Il faut `{"dans": <n° du champ>, "taper": …}`.
- `{"clic": "Aujourd'hui"}` depuis le Calendrier touche le bouton « Aujourd'hui » du Calendrier, pas la barre latérale. Passer par le numéro.

# 41. Texte flou : un calque décalé par un `translate` (2026-10-12)

## 41.1 `left-1/2 -translate-x-1/2` sur un élément fixe : il n'est plus calé sur les pixels

**Symptôme.** Antonin : « l'écriture est floue dans l'app », capture de la pastille du minuteur. Le reste de l'écran est net.

**Cause.** La pastille était centrée par `left-1/2 -translate-x-1/2`. Un élément `fixed` (ou « verre », ou animé) est un calque à part. Sans `translate`, WebKit cale ce calque sur la grille de pixels. Avec, il ne le fait plus — et la moitié d'une largeur tombe presque toujours sur une fraction : à 110 %, x = 657,75, soit 1315,5 pixels d'écran. Le calque est rééchantillonné : texte, point et contour flous.

**Mesure** (même pastille, même instant, ce que l'écran compose) : gradient moyen 0,0256 avec le `translate`, 0,0278 centrée par des marges.

**Parade.**
- centrer en largeur : `inset-x-0 mx-auto w-fit` ; en hauteur : `inset-y-0 my-auto h-fit` ;
- poser au-dessus d'un point : une ancre `flex h-0 w-0 items-end justify-center`, l'élément dedans (`NoteComposer`, la bulle) ;
- position calculée en JS : la caler sur les pixels physiques (`Tooltip.tsx`, `snap` — le même défaut y avait déjà été payé) ;
- `nettete.source.test.ts` refuse `-translate-x-1/2`, `-translate-y-1/2`, `-translate-*-full` et `translate(-N%)`. Deux exceptions nommées.

⚠️ Une `.card` se soulève de 2 px au survol (`translate: 0 -2px`). Sur un élément centré par des marges, ce soulèvement s'applique de nouveau (avant, la classe de centrage l'écrasait) : poser `translate-none`.

## 41.2 `takeSnapshot` ne montre PAS ce flou

La capture du pilote WebKit (`{"capture":…}`) redessine la page : 0,0283 de gradient dans les deux cas, pastille nette. Le défaut était invisible à l'outil qui sert à vérifier l'app. Chrome sans fenêtre ne le montre pas non plus (autre moteur).

**Parade.** `{"fond":true}` en tête de plan, puis `{"ecran":"nom","zone":[…]}` : la fenêtre passe sous le bureau, opaque, et on lit ce que le serveur de fenêtres compose. Comparer deux captures par un chiffre (gradient moyen), pas à l'œil : agrandies par `sips`, elles sont lissées et se ressemblent.

## 41.3 Non corrigé : le soulèvement des cartes au survol, à 110 %

`translate: 0 -2px` vaut 2,2 px à 110 % : le texte d'une carte survolée n'est pas calé le temps du survol. Non mesuré, non corrigé (`index.css` était pris par un autre chantier ce soir-là). Piste : `calc(-2px * var(--zoom-inv))`.

## 41.4 Un correctif qui rate le build de quelques minutes

Le chantier `focus-ile` réécrivait la pastille le même soir (`PastilleSeance.tsx`), avec le même centrage. Il a été fusionné et son build natif lancé à 00:23, pendant que ce correctif finissait ses mesures : le build du 13/10 à 00:23 porte donc ENCORE la pastille floue. Corrigée au recalage, dans le fichier neuf.

**Parade.** Quand le carnet annonce qu'une autre session réécrit le fichier fautif, lui écrire la correction (une ligne) DÈS que la cause est prouvée, avant de finir ses propres vérifications.

## 41.5 Outils

- La charge machine : une autre session rendait dans Blender et lançait vitest (charge 60 à 150). Un plan du pilote WebKit de vingt pas a pris plus de dix minutes. Lancer ces plans en arrière-plan.
- `git stash` est commun aux worktrees (§ 34.3) : je l'ai utilisé pour la contre-épreuve du test, à tort. Rien n'a été perdu ; `git diff > x.patch` puis `git checkout`.

# 42. La base applique les clés étrangères (2026-10-12)

## 42.1 ⭐⭐ `PRAGMA foreign_keys` est ALLUMÉ dans l'app : un `DELETE` sur une ligne citée échoue

**Symptôme.** Antonin : « certains items ne se suppriment pas dans Supprimés récemment, et Tout supprimer ne marche pas tout le temps ». Sur une copie de sa base : 63 lignes en corbeille (128 objets) ; « Vider » en effaçait 1 puis s'arrêtait.

**Cause.** `tauri-plugin-sql` ouvre SQLite par `sqlx`, et `sqlx` pose `PRAGMA foreign_keys = ON` d'office (`sqlx-sqlite-0.8.6/src/options/mod.rs`, ligne 185). Deux commentaires de `repo.ts` disaient le contraire depuis août. Aucun `ON DELETE` n'est déclaré dans le schéma : la base ne cascade rien, mais elle REFUSE (`FOREIGN KEY constraint failed`). Deux tables n'étaient défaites par aucune fonction `delete*` :
- `goal_progress_log` — `snapshotGoals` y écrit une ligne par objectif à chaque lancement. Tout objectif qui a vécu un jour était ineffaçable ;
- `focus_sessions` — une tâche chronométrée une fois était ineffaçable.

**Trois dégâts de plus, de la même cause :**
- `deleteGoal` remontait les enfants et déliait les tâches AVANT le `DELETE` qui échouait : un échec laissait l'arbre modifié ;
- la purge des 30 jours s'arrêtait au premier objet refusé, à chaque lancement ;
- « Supprimer les exemples » échouait dès qu'un exemple avait été chronométré, ou que l'objectif d'exemple avait vécu un lancement.

**Parade.** `src/lib/suppression.ts` : UNE table, `DEPENDANTS`, dit ce qui cite chaque table et ce qu'on en fait (effacer, détacher, remonter). `effacerLigne(db, table, id)` défait puis efface. Toutes les fonctions `delete*` qui avaient des enfants y passent. `suppression.test.ts` lit `PRAGMA foreign_key_list` de tout le schéma : une clé étrangère ajoutée par une migration et absente de la table fait échouer la suite.

▶️ **Toute nouvelle clé étrangère demande une ligne dans `DEPENDANTS`** (ou dans `GARDES_PAR_REFUS` si le parent ne s'efface que libre). Le test le rappelle.

▶️ **Les bancs de test ont les clés étrangères allumées aussi** (`node:sqlite` les active par défaut) : un `DELETE` qui passe en test passe dans l'app. Un test le vérifie (`PRAGMA foreign_keys` = 1).

## 42.2 ⭐⭐ Une pierre tombale reçue fait le même `DELETE` — sur un appareil qui a ses propres lignes dessous

**Ce qui serait arrivé.** Une fois la corbeille vidable sur le Mac, 76 pierres tombales d'objectifs partaient. Sur l'autre appareil, `supprimerLigne` (`sync/local.ts`) faisait `DELETE FROM goals` : refusé, à cause de l'historique LOCAL (`goal_progress_log` n'est pas synchronisé, personne ne lui dira jamais de l'effacer). `appliquerReçue` ne rattrape que `ParentManquant` : l'erreur remontait, le curseur ne passait plus cette ligne, la synchronisation de l'appareil s'arrêtait pour de bon.

**Même défaut sans table locale.** L'envoi va des parents vers les enfants : la pierre tombale d'une tâche arrive AVANT celles de ses coches. Rejoué sur le banc à deux appareils : trois tests, les trois en `FOREIGN KEY constraint failed` sans le correctif.

**Parade.** `supprimerLigne` appelle `libererDependants` avant son `DELETE` — la même table que `repo.ts`. On est sous `applying` : ce ménage ne repart pas dans le cloud.

⚠️ **Pas couvert.** Les deux tables de `GARDES_PAR_REFUS` (`invoice_parties`, `invoice_series`) : une pierre tombale reçue pour un tiers encore cité par une facture locale lèverait toujours. Finance est de côté ; à traiter avant de la rallumer.

## 42.3 Une boucle d'écritures dans une vue, sans `try` : le premier refus arrête tout, et l'écran ne le dit pas

**Symptôme.** « Tout supprimer » qui « ne marche pas tout le temps » : la boucle de `CorbeilleView` levait au premier objet refusé. `setViderDemande(false)`, la relecture et le toast étaient APRÈS la boucle : rien ne se passait à l'écran, alors que des objets étaient partis.

**Parade.** La boucle vit dans `repo.ts` (`viderCorbeille`) : un `try` par élément, un bilan `{ effaces, echecs }`. La vue relit la liste dans son `finally`, et dit combien sont restés. Le bouton d'une ligne (`supprimerPourDeBon`) dit aussi son échec. `purgerCorbeille` passe à l'objet suivant.

▶️ Pour toute boucle d'écritures lancée par un bouton : relire l'écran dans le `finally`, pas après la boucle.

## 42.4 Méthode — rejouer sur une COPIE de la vraie base

Le défaut ne se voyait sur aucune base de test : il fallait des objectifs qui avaient vécu plusieurs lancements. Ce qui l'a montré en dix minutes :
1. `sqlite3 "file:$DB?mode=ro" ".backup 'copie.db'"` (lecture seule, la base réelle n'est pas touchée) ;
2. un test vitest TEMPORAIRE qui ouvre la copie par `node:sqlite`, branche `repo.ts` dessus (`vi.mock("../db")`, comme `corbeille/api.test.ts`) et joue le geste de la vue ;
3. le même test après le correctif.

⚠️ Vite écrase la variable d'environnement `MODE` (elle vaut `test`) : un test qui lit `process.env.MODE` prend toujours la même branche. Lui donner un autre nom.

# 43. Reposer l'app sur l'iPhone réel (2026-10-13)

## 43.1 ⭐ « No Accounts » : le certificat est dans le trousseau, mais Xcode n'a plus de compte

**Symptôme.** `xcodebuild -allowProvisioningUpdates` : « No Accounts: Add a new account in Accounts settings », puis « No profiles for 'com.atnfx.shale' were found ». Pourtant `security find-identity -v -p codesigning` rend bien « Apple Development: … (3HG9D3LX2X) », valable jusqu'au 2027-08-27.

**Cause.** Le certificat vit dans le trousseau ; le PROFIL d'une équipe gratuite se fabrique par la session du compte Apple dans Xcode, et ce Mac n'en avait aucune (`defaults read com.apple.dt.Xcode DVTDeveloperAccountManagerAppleIDLists` : liste vide). Un certificat présent ne dit rien du compte.

**Parade.** Geste d'Antonin, et de lui seul : Xcode → Settings → Accounts → « + » → Apple Account. Le vérifier AVANT de lui annoncer un build : la commande `defaults` ci-dessus, deux secondes.

**Payé.** Dix minutes : la précompilation Rust a été lancée pendant qu'il se connectait, rien n'a été perdu.

## 43.2 Le téléphone verrouillé ou « en préparation » bloque `-destination id=…`, pas le profil

**Symptôme.** « The developer disk image could not be mounted on this device … kAMDMobileImageMounterDeviceLocked », puis, une fois déverrouillé, « Device is busy (Preparing iPhone de Antonin) » ; `xcodebuild` attend puis abandonne (« Timed out waiting for all destinations »).

**Cause.** Xcode monte une image de développement sur le téléphone à chaque premier branchement ; il faut l'écran déverrouillé, puis quelques minutes.

**Parade.** Le profil n'a pas besoin du téléphone : `-destination 'generic/platform=iOS'` le crée tout de suite (l'appareil est déjà inscrit dans l'équipe depuis le 2026-08-27). Le téléphone ne sert qu'à la pose, à la fin — il a fini de se préparer d'ici là.

## 43.3 Précompiler le Rust pendant qu'on attend : le cache est repris

`tauri ios build` ne compile pas une ligne sans profil (§ 20.3 de `MOBILE.md`). Lancée à la main pendant l'attente, cette commande remplit le même cache :

```
cd src-tauri && IPHONEOS_DEPLOYMENT_TARGET=17.0 \
  cargo build --release --target aarch64-apple-ios --lib --features tauri/custom-protocol
```

C'est, aux options de couleur près, celle que lance Tauri (`cargo build --package shale … --target aarch64-apple-ios --features tauri/custom-protocol --lib --release`, lue dans `ps`). Mesuré : 235 bibliothèques après la précompilation, 237 après le build de Tauri. ⚠️ Deux `cargo` sur le même dossier s'attendent l'un l'autre : le second ne démarre qu'à la fin du premier.

## 43.4 Compter un témoin dans `dist` : `grep -c` sur le fichier, pas `cat | grep -o | wc -l` dans une boucle

Ma boucle `for s in "…"; do cat dist/assets/*.js | grep -o -F "$s" | wc -l; done` a rendu **0** pour la pastille nette, présente dans le fichier (`grep -o -h -E` l'a montrée l'instant d'après). Cause non cherchée. Un témoin à 0 se recontrôle par une seconde commande avant de conclure que le correctif manque.

## 44.1 Le worktree qu'ouvre l'app Claude (`Shale/.claude/worktrees/…`) part d'une branche d'août

**Symptôme.** Une session ouverte depuis l'app Claude démarre dans `Shale/.claude/worktrees/<nom>`, sur une branche `claude/<nom>` à `4ca4080` (26 août). Son `CLAUDE.md` parle de douze modules et de `sync-chiffree`, `PASSATION.md` n'y existe pas, le dépôt y a 397 commits de retard sur `origin/mobile-ios` (36 pour le seul `demo.ts`).
**Cause.** Non cherchée. Constat : l'outil annonce `sync-chiffree` comme branche principale, et le worktree ne part pas de `mobile-ios`.
**Parade.** Avant toute lecture : `git worktree list` et `git log -1 origin/mobile-ios`. Travailler dans un worktree `~/Desktop/Shale-chantiers/<chantier>` créé sur `origin/mobile-ios` (carnet `COORDINATION.md`), et lire les documents de CE worktree-là.
**Payé.** Dix minutes, le 2026-10-13 : le fichier demandé par le cadrage (`PASSATION.md`) était introuvable, ce qui a donné l'alerte. Sans cela, le correctif partait d'un `demo.ts` d'août.

## 44.2 Une série « il y a N jours » validée à l'image n'est juste que le jour de la semaine où on l'a regardée

**Symptôme.** Trois historiques d'habitudes de soixante caractères, validés un mardi avec « des week-ends plus faibles ». Recopiés tels quels (indice = nombre de jours avant aujourd'hui), le jour faible avance d'un cran chaque jour : « Le mercredi : 42 % ».
**Cause.** Une donnée de démo relative à aujourd'hui n'a pas de jour de la semaine. Ce qu'on a validé, c'est son alignement du jour.
**Parade.** Ranger la série par semaines (lundi → dimanche), la dernière étant la semaine en cours ; tester sur sept jours consécutifs, pas sur aujourd'hui (`demoHabitudes.test.ts`).
**Payé.** Rien : vu avant d'écrire, en posant les séries en lignes de sept.

# 45. Vérifier la barre du bas avec le pilote du labo (2026-10-13)

## 45.1 Retirer un onglet décale TOUS les numéros du pilote d'un cran

**Symptôme.** Dans Personnaliser, au téléphone, je retire un onglet (`{"clic":20}`), puis j'enchaîne un second retrait sur le numéro que j'ai calculé de tête. Le second clic AJOUTE un onglet. On croit à un défaut de l'app (un toucher fantôme sur la ligne remontée sous le doigt).
**Cause.** Le pilote numérote dans l'ordre du document, et la barre d'onglets passe en premier (« navigation »). Un onglet de moins = un bouton de moins en tête : tout ce qui suit perd un rang. Le numéro visé désignait le « + » d'une autre ligne.
**Parade.** Un geste par `faire`, et relire les numéros dans la sortie de CE `faire` avant le suivant. Ou cliquer par le texte quand il est unique (`{"clic":"Par défaut"}`).
**Payé.** Dix minutes, à chercher un défaut de toucher qui n'existait pas.

## 45.2 `sqlite3` sans `-readonly` sur une copie avec son `-wal` la consolide

**Symptôme.** Copie de la base de l'iPhone (`devicectl device copy from`, les trois fichiers). Après un `PRAGMA integrity_check`, `shale.db-wal` fait 0 octet et `shale.db` a changé de date.
**Cause.** Ouvrir en écriture rejoue le journal dans le fichier principal à la fermeture.
**Parade.** Sans gravité pour une sauvegarde (elle est complète, en un fichier). Pour garder la copie telle qu'elle a été prise : `sqlite3 -readonly`, ou contrôler une copie de la copie.
**Payé.** Rien.

## 45.3 ⚠️ Retenir le défilement après un maintien : ni `touch-action` posé à l'armement, ni un écouteur ajouté pendant le geste

**Le besoin.** Au doigt, une ligne ne se prend qu'après un maintien (§ 7.4 ter). Une fois prise, le doigt ne doit plus faire défiler la page.
**Ce qui ne suffit pas, par construction.** `touch-action` est lu au début du toucher : le changer 400 ms plus tard ne vaut que pour le toucher SUIVANT. Et un `touchmove` non passif ajouté dans le `pointerdown` arrive après que le moteur a décidé s'il devait attendre le JavaScript avant de défiler.
**Parade** (`useGlisserListe.ts`). Un `touchmove` `{ passive: false }` posé AU MONTAGE sur le conteneur des lignes, qui ne refuse (`preventDefault`) que si une ligne est en main et si l'événement est encore annulable. Sur la liste seule, pas sur le document.
**Ce qui est prouvé.** Chrome en format téléphone : pendant le glissement la page ne défile pas ; sans maintien elle défile et rien n'est rangé. ⛔ Pas mesuré dans WebKit sur un iPhone : la seconde moitié de « ce qui ne suffit pas » est raisonnée, pas observée.
**À savoir.** Le glisser du Calendrier (`GrilleHoraire.tsx`) s'appuie sur `touch-action` posé à l'armement (`data-glisse`). Non touché ; s'il laisse défiler la grille sur un vrai téléphone, c'est par là qu'il faut regarder.

# 46. Synchronisation : un appareil figé sans erreur (2026-10-13)

## 46.1 ⭐ « Synchronisé » à l'écran, et rien de neuf depuis des semaines : comparer les curseurs

**Symptôme.** Sur l'iPhone, les tâches et les objectifs s'arrêtent au 29 septembre. L'indicateur dit « synchronisé », `last_pull_at` est d'il y a dix minutes, aucune erreur. Ce que le téléphone ÉCRIT arrive bien sur le Mac.
**Cause.** Le curseur du téléphone valait 39, celui du Mac 1278. Une ligne orpheline (une coche d'habitude dont l'habitude n'était pas sur le serveur) retenait le curseur juste avant elle. Le moteur relisait à chaque cycle la même page de 200 lignes (séquences 40 à 1046) et s'arrêtait là. `last_pull_at` avance à chaque lecture, même quand le curseur ne bouge pas : il ne prouve rien.
**Parade.** Le moteur est corrigé le 2026-10-13 (`engine.ts`, « Orphelines » : le curseur avance toujours). Pour diagnostiquer un appareil qui « ne reçoit pas » : lire `sync_meta` des DEUX appareils et comparer `cursor`. Un écart qui ne se referme pas d'un cycle à l'autre est le défaut. `sync_meta.orphelines` liste les numéros de séquence des lignes qui attendent leur parent.
**Payé.** Six semaines d'un iPhone figé (curseur à 39 depuis le 3 septembre au moins), prises pour un téléphone « déjà synchronisé » à chaque réinstallation.

## 46.2 Une ligne d'avant la migration 016 jamais modifiée n'a JAMAIS été envoyée

**Symptôme.** Une habitude existe sur le Mac et pas sur le serveur ; ses coches, si.
**Cause.** Les triggers d'outbox datent de la 016. Une ligne créée avant et jamais réécrite depuis n'a aucune entrée de file : rien ne l'envoie. La première activation de la synchronisation n'a pas remis l'existant en file (seule la republication le fait, `toutRemettreEnFile`). Seule la base d'Antonin a des lignes d'avant la 016 : une installation neuve journalise tout dès la première écriture.
**Parade.** Les trouver : pour chaque table de `TABLES_SYNC`, `SELECT … FROM <table> x LEFT JOIN sync_state s ON s.table_name = '<table>' AND s.uid = x.uid WHERE s.uid IS NULL`. Les faire partir : `UPDATE <table> SET uid = uid WHERE …` (écriture sans effet, mais journalisée par le trigger), après avoir vérifié `sync_meta.applying = '0'` dans la même transaction. Si la ligne est un PARENT dont des enfants sont déjà partis, réécrire aussi ces enfants : ils reprennent un numéro de séquence APRÈS leur parent. ⚠️ Les lignes semées par une migration (catégories Finance, séries et émetteur de factures, types d'objets) sortent aussi de cette requête : elles existent sur chaque appareil sous le même uid, ne pas les renvoyer.
**Payé.** Voir 46.1 : c'est cette habitude-là qui a figé le téléphone.

## 46.3 Lire la base de l'iPhone branché, sans rien y écrire

**Symptôme.** On ne sait pas ce que le téléphone a réellement reçu ; l'écran ne le dit pas.
**Cause.** —
**Parade.** `xcrun devicectl list devices`, puis `xcrun devicectl device copy from --device <id> --domain-type appDataContainer --domain-identifier com.atnfx.shale --source "Library/Application Support/com.atnfx.shale/shale.db" --destination <copie>` — et de même pour `shale.db-wal` : sans lui, la copie a plusieurs heures de retard (la base est en WAL). Lire la copie, jamais l'original. Ça marche parce que l'app est signée en développement ; la base du téléphone garde aussi ses sauvegardes automatiques dans `backups/`, utiles pour dater un défaut (celle de 10:44 portait déjà le curseur à 39).
**Payé.** Rien : c'est ce qui a donné la cause en vingt minutes.

## 45.4 Un build iOS de 4 minutes en a pris 86 : la mémoire, pas le processeur

**Symptôme.** `tauri ios build` lancé à 22:41, fini à 00:07. Le même build, trois heures plus tôt : 4 minutes. `tsc` 20 min, `vite build` 10 min, `rustc` sur `shale_lib` 25 puis 17 min (deux passes).
**Cause.** Plusieurs sessions compilaient et testaient en même temps : `sysctl -n vm.swapusage` rendait 9 Go d'échange utilisés sur 10, et `ps` montrait `tsc` avec 42 Mo en mémoire vive — presque tout son tas était sur le disque. La charge (40 à 80) ne disait pas ça : à 21:58 elle était comparable et le build filait.
**Parade.** Avant de prendre le verrou BUILD NATIF : `sysctl -n vm.swapusage`. Au-delà de quelques Go utilisés, attendre que les suites des autres sessions finissent — le verrou tenu 86 minutes bloque tout le monde, et un checkout principal figé pendant ce temps prend du retard (deux fusions ont eu lieu pendant celui-ci, donc le binaire posé était déjà en retard de deux commits).
**À savoir.** `tauri ios build` compile `shale_lib` DEUX fois (un `xcodebuild` puis un `xcodebuild -quiet` pour l'archive) : à vide c'est invisible, sous échange c'est le double.


## 46.4 Un test de synchronisation qui écrit parent et enfant dans le même envoi ne contrôle pas leur ordre sur le serveur

**Symptôme.** Premier jet de `orphelines.test.ts` : « l'orpheline est en séquence 1 » échoue, elle est en 4. Le test du cycle coupé attend un curseur à 200 et ne le trouve pas.
**Cause.** J'ai écrit la coche, puis trois tâches, puis UN envoi. L'envoi range les entrées par table, parents d'abord (`RANG_TABLE`, `outbox.ts`) : les tâches passent avant les coches d'habitude, quel que soit l'ordre d'écriture. Le numéro de séquence suit l'ordre d'ENVOI, pas l'ordre d'écriture.
**Parade.** Quand un test dépend de la place d'une ligne sur le serveur, l'envoyer seule (`sync(a)` juste après l'avoir écrite), puis le reste. C'est ce que fait `cocheSansHabitude()`.
**Payé.** Trois minutes de suite de tests et un aller-retour, sous une charge de 45.

## 46.5 J'ai écrit dans la documentation un geste avant de l'avoir fait — et il a été refusé

**Symptôme.** `CLAUDE.md` disait « elles ont été remises en file à la main » pour huit lignes du Mac. L'écriture sur la vraie base a ensuite été refusée par le garde-fou de la session : la phrase était fausse.
**Cause.** J'ai rédigé la section pendant que les tests tournaient, en décrivant ce que j'allais faire comme déjà fait.
**Parade.** Une phrase de documentation qui affirme un geste sur une donnée réelle s'écrit APRÈS le geste et sa vérification. Avant, l'écrire au futur ou ne pas l'écrire. Corrigé avant le commit.
**Payé.** Rien, vu à temps. Sans relecture, la doc aurait annoncé une sauvegarde cloud complète qui ne l'était pas.

## 46.6 Un `Monitor` en `tail -f` sur un journal de build réécrit par le build suivant rapporte l'ANCIEN résultat

**Symptôme.** Build arrêté pour être relancé sur une tête plus récente (demande d'une session voisine). Le moniteur, toujours armé, annonce « code 143 », puis des étapes du NOUVEAU build mêlées.
**Cause.** `npm run tauri build > build.txt` tronque le fichier ; `tail -f` continue de lire au même descripteur et rend ce qui reste de l'ancien contenu, puis la suite.
**Parade.** Un moniteur par build, sur un fichier de journal par build (nom horodaté), ou une boucle `until grep -q "^code " fichier` lancée APRÈS le démarrage du build. Arrêter l'ancien moniteur avant de relancer.
**Payé.** Une alerte « code 143 » à interpréter : c'était le build arrêté exprès, pas un échec.

## 46.7 Deux sessions ont numéroté leur section du carnet « § 46 » le même soir

**Symptôme.** Après la fusion de [retours-1310], `PIEGES.md` avait deux « # 46. », et leurs renvois (« PIEGES § 46.4 ») devenaient ambigus.
**Cause.** Chaque session choisit son numéro en lisant la fin de SON worktree. La mienne, fusionnée à 23:59, avait pris le 46 ; l'autre l'avait choisi plus tôt sur une branche partie avant.
**Parade.** Au moment de rebaser (pas au moment d'écrire), relire `grep -n "^# [0-9]" PIEGES.md` sur `origin/mobile-ios` et renuméroter sa propre section si le numéro est pris — renvois compris (`grep -rn "§ NN"`). Ici, la section arrivée seconde est passée au § 47 (64db5f4), et la session concernée prévenue.
**Payé.** Dix minutes.

## 46.8 J'ai lancé un build sans demander au carnet si une fusion était imminente

**Symptôme.** Build macOS lancé à 08:47 sur 6f70fc4. À 08:50, [retours-1310] pousse 4727415 et demande un build groupé : le mien est arrêté en pleine compilation Rust et relancé.
**Cause.** Le carnet montrait [retours-1310] « en PAUSE » depuis 00:36 ; j'en ai déduit qu'il ne fusionnerait pas. Une session en pause peut reprendre à tout moment.
**Parade.** Avant de prendre le verrou BUILD NATIF, si une session a une branche commitée mais non fusionnée, lui écrire (`SendMessage`) ou écrire au carnet « build dans 10 min, fusionnez avant si vous voulez y être », et attendre ce délai.
**Payé.** Trois minutes de build perdues. Sans le message de la session voisine, Antonin aurait eu deux fenêtres de trousseau.

# 47. Retours d'Antonin du 13/10 (chantier `retours-1310`, 2026-10-14)

## 47.1 Un `pointerdown` qui arme un geste doit tester le BOUTON

**Symptôme.** Clic droit sur un événement horaire du Calendrier : le menu s'ouvre… et la fenêtre de l'événement s'ouvre par-dessus. « Supprimer » est sous la fenêtre ; Antonin conclut qu'on ne peut pas supprimer d'un clic droit.
**Cause.** `GrilleHoraire.saisir` (posé en `onPointerDown`) prenait tout appui comme le début d'un glisser ; au relâché, « un simple clic OUVRE ». Le `contextmenu` arrive entre les deux et ne l'empêche pas.
**Parade.** `if (pointerType !== "touch" && (button !== 0 || ctrlKey)) return;` en tête de tout `pointerdown` qui arme un geste. Ctrl+clic est le clic droit du Mac.
**Payé.** Le défaut a vécu depuis les menus contextuels (26/09) : aucune vérification ne faisait un VRAI clic droit (`mouse.down({button:"right"})`) sur un bloc horaire — les bandeaux « journée » n'ont pas ce `pointerdown`, et c'est sur eux qu'on testait.

## 47.2 Un calque positionné en absolu se dessine hors de la plage qu'on a calculée sans lui

**Symptôme.** « Des carrés quadrillés blancs » sous la dernière heure de la grille, dans le vide.
**Cause.** La plage d'heures (6 h – 22 h, élargie pour les événements) ignorait les créneaux proposés ; ceux-ci sont posés en `top` absolu depuis `heureMin` et sortent donc de la grille dès qu'ils tombent après 22 h.
**Parade.** Tout ce qui est posé en absolu dans la grille entre dans le calcul de la plage. Contrôle : `getBoundingClientRect().bottom` de chaque calque ≤ celui de la dernière cellule.
**Payé.** Un retour d'Antonin, capture à l'appui.

## 47.3 Un minuteur suspendu au survol doit REPRENDRE, et avoir un plafond

**Symptôme.** Antonin : le bandeau de corbeille « reste jusqu'à ce qu'on le ferme ». Non reproduit (Chrome, WebKit piloté).
**Cause probable, non prouvée.** Le minuteur s'arrêtait au survol et REPARTAIT DE ZÉRO à la sortie : frôler le bandeau le prolongeait de huit secondes ; au doigt, quatorze secondes en bas d'écran se vivent comme « toujours ».
**Parade.** Reprendre le reste (`resteApresSuspension`), plafonner (`plafondAffichage`), montrer le compte à rebours. Tenu par `lib/toast.test.ts`.
**Payé.** Une demi-heure à chercher une cause unique dans trois moteurs.

## 47.4 Un test de source qui cherche une constante par son TEXTE casse quand elle déménage

**Symptôme.** `onglets.test.ts` rouge : « expected … to match /const APPUI_LONG_MS = 400;/ » après le chantier.
**Cause.** La constante est passée dans `calendrier/appuiLong.ts` ; le test lisait `GrilleHoraire.tsx`.
**Parade.** Importer la valeur et la comparer ; ne garder en lecture de source que ce qui ne s'importe pas (« la grille l'importe, ne la redéclare pas »).
**Payé.** Une suite complète de 3 minutes relancée pour retrouver le nom du test : la première ne gardait que `tail -60`. Lancer la suite avec `--reporter=dot` et filtrer `FAIL`.

## 47.5 Le pilote du labo refuse `localhost`, et Vite n'écoute pas `127.0.0.1` par défaut

**Symptôme.** `pilote.mjs demarrer --url http://127.0.0.1:5199/` : `ERR_CONNECTION_REFUSED` ; avec `localhost` : « --url doit viser http://127.0.0.1 ».
**Parade.** `server.host: "127.0.0.1"` dans la configuration enveloppe de la démo. Et `demarrer` détaché meurt parfois avec la commande : lancer `pilote.mjs _gardien '<json>'` en tâche de fond. Pour une fenêtre de 1470 × 895 (celle d'Antonin), un petit script puppeteer à soi : le pilote n'a que quatre écrans fixes.
**Payé.** Dix minutes.

## 47.6 La grille d'Aujourd'hui ne relit pas `layout.today` quand on l'écrit à chaud

**Symptôme.** En démo, `setSetting("layout.today", …)` puis capture : rien n'a bougé.
**Cause.** `ResizableGrid` lit ses tailles au MONTAGE ; et recharger la page vide la mémoire de la démo.
**Parade.** Écrire le réglage, puis aller sur une autre vue et revenir (`allerVers("tasks")`, `allerVers("today")`).
**Payé.** Une capture fausse, vue avant d'en tirer quoi que ce soit.

# 48. Un ornement qui déborde de sa boîte finit toujours rogné (2026-10-16)

**Symptôme.** Sur la page d'un objectif, le halo bleu de l'orbe du fil était coupé net à gauche : un carré de lumière tranché. Signalé par Antonin, capture à l'appui.
**Cause.** Le halo (`.fil-orbe::before`, rayon 19 px) était centré sur un fil posé à 11 px du bord de son item : 8 px dehors. La zone qui défile (`section.overflow-y-auto` de `GoalsView`) rogne aussi en largeur — `overflow-y: auto` force `overflow-x` à `auto`. La tête du fil couché (`.fil-h-tete`, anneau de 5 px) débordait de même, de 6 px à gauche et 3 px en haut.
**Parade.** Ne pas « dégager » le conteneur (le prochain qui rogne recommencera) : la position d'un ornement se DÉDUIT de sa taille. `--fil-halo` est le rayon ; `--fil-x`, les marges du fil couché et sa hauteur sont des `calc()` de cette variable. `src/lib/objectifs/fil.css.test.ts` lit le CSS et tombe si l'un redevient un nombre écrit à côté de l'autre.
**Règle générale.** Tout halo, anneau ou ombre qui doit rester entier tient dans la boîte de son élément : jamais `inset` négatif ni `box-shadow` qui sort, sans que la boîte lui ait fait la place. Une ombre de carte qui peut être rognée sans dommage n'est pas concernée.
**Vérifié.** Chrome sans fenêtre, 1470 × 923, mode démo : bord gauche du halo à 436 px, section à 435 px.

# 49. La nouvelle marque et l'entrée (2026-10-19, chantier `logo-entree`)

## 49.1 `npm run tauri icon` écrit DANS le catalogue iOS, maintenant

Le 2026-09-10 (`MOBILE.md` § 21.3), la commande ne touchait pas
`gen/apple/Assets.xcassets/`. Le 2026-10-19 elle y a déposé treize PNG
(`AppIcon-20x20@1x.png` … `AppIcon-512@2x.png`), non déclarés dans
`Contents.json`, rendus depuis la source de BUREAU — avec sa marge
transparente, donc le halo blanc du § 21.1 si jamais un `Contents.json` les
citait. ▶️ Parade : après `tauri icon`, `git clean` sur `AppIcon.appiconset/`,
puis `node tools/icones-marque.mjs`. Lire `git status` après tout outil qui
« ne touche qu'à » un dossier.

## 49.2 Une animation d'entrée posée en pixels mesurés saute quand la densité arrive

`applyZoom()` (densité, Dynamic Type) pose `zoom` et `--zoom-inv` sur `<html>`
au montage d'`App` — c'est-à-dire PENDANT la transition d'entrée, derrière le
voile. Une copie en `position: fixed` posée en pixels mesurés, ou à une taille
en `px`, change alors de taille à l'écran (+10 % à 110 %). ▶️ Toute position
ou taille de la transition se multiplie par `var(--zoom-inv, 1)` ; à froid,
l'icône est CENTRÉE par le CSS, pas mesurée.

## 49.3 Vite écoute `localhost` (IPv6), pas `127.0.0.1`

Un script puppeteer qui ouvre `http://127.0.0.1:<port>/` sur un `npx vite`
sans `--host` reçoit `ERR_CONNECTION_REFUSED` et prend des captures de la page
d'erreur de Chrome — 26 captures « vides » avant de regarder l'image. Même
cause que le § 47.5. ▶️ `localhost`, ou `--host 127.0.0.1`.

## 49.4 La taille de fenêtre mémorisée tombait pendant la transition d'entrée

Personnaliser enregistre une taille de fenêtre (`ui.config.window`). Le front
l'appliquait (`App.tsx`, `setSize`) au premier chargement de la config, donc
APRÈS la connexion, au milieu de la lueur : la fenêtre passait de 1120 × 780
(`tauri.conf.json`) à 1470 × 923, et l'icône, centrée par le CSS, sautait vers
le nouveau centre. Vu au vrai lancement, en rafale de captures (2026-10-20) ;
invisible en mode démo, où il n'y a pas de fenêtre native.
▶️ Tout ce qui change la géométrie de la fenêtre au lancement se fait dans le
`setup` du Rust, avant que la page ne charge (`fenetre_lancement.rs`). Le
`setSize` du front reste en filet : à taille égale il ne fait rien.

## 49.5 Agrandir un calque de ×20 par `transform` le rend flou

Le navigateur peint un calque une fois, puis l'étire : une image de 96 px
agrandie vingt fois devient une tache. C'est pourquoi le trou de l'entrée
(2026-10-20) n'est PAS un calque qu'on agrandit. ▶️ Ce qui doit rester net en
grossissant se dessine à sa taille FINALE et se RÉDUIT (les coins du trou),
ou ne s'agrandit pas du tout et se TRANSLATE (les pans unis). Les traits de
l'icône, eux, sont agrandis, et c'est pour ça qu'ils s'effacent à ×5.

## 49.6 Une échelle arrondie au millième décolle des pièces jointives

Les coins du trou sont réduits de `s / 19` : à l'inspiration, ≈ 0,045. Arrondie
à trois décimales, l'échelle perdait 0,6 % et le coin ne tombait plus sur le
bord du pan. Vu par un test, pas à l'écran. ▶️ Six décimales dans les
transformations qu'on calcule (`trou.ts`).

## 50.1 L'`easing` global d'un `element.animate()` déforme le temps de TOUTES ses images clés

Une image clé placée à `offset: 0.85` d'une animation dont l'`easing` est un
ressort (`cubic-bezier(0.32, 0.72, 0, 1)`) n'arrive pas à 85 % du temps : le
ressort atteint 85 % de sa progression vers le premier tiers. Un fondu « à la
fin » du retour d'un objectif tombait donc au premier tiers : une carte
fantôme, vue au ralenti (×10, `Animation.setPlaybackRate` par CDP) le
2026-10-20. ▶️ Une animation qui mêle un mouvement et un fondu : `easing:
"linear"` au niveau de l'animation, et l'`easing` du ressort posé sur l'image
clé qui ouvre le segment du mouvement (`lib/objectifs/transition.ts`).

## 50.2 La règle `prefers-reduced-motion` d'`index.css` n'atteint pas `element.animate()`

Elle écrase la durée des `@keyframes` et des transitions CSS ; une animation
Web Animations garde la sienne. ▶️ Tout film en `element.animate()` teste
`mouvementReduit()` (`lib/defilement.ts`) et se saute (la page s'ouvre sans
film). Même famille que le défilement lissé, déjà rangé là.

## 50.3 Une découpe ou un déplacement calculés depuis `getBoundingClientRect` sont faux de 10 % à la densité 110 %

`getBoundingClientRect` rend des pixels écran ; un `clip-path: inset(…)` ou un
`translate(…)` s'écrivent en pixels LOCAUX sous le `zoom` de `<html>`
(`applyZoom`). La carte d'objectif s'ouvrait depuis un rectangle décalé, de plus
en plus loin vers le bas de la liste. ▶️ Diviser toute distance mesurée par
`zoomFactor()` (`lib/uiConfig.ts`) ; une échelle (rapport de deux mesures) n'en
a pas besoin. Tenu par `transition.test.ts`.

## 51. Couleurs V9 et point d'action (2026-10-20)

### 51.1 `src/lib/actions.ts` existe déjà : c'est la palette ⌘K
Le nom vient tout seul pour « les actions requises ». Écrit par-dessus le 2026-10-20, rattrapé avant le commit (`git status` disait `M`, pas `??`). La règle du point d'action vit dans `src/lib/pointAction/`. **Avant de créer un fichier, `ls` le chemin** — un Write sur un fichier existant ne prévient pas.

### 51.2 Un chiffre blanc sur le rouge vif ne tient pas l'AA
`#ffffff` sur `#ff3b4a` = 3,5:1 (texte de 10 px). La forme « compte » écrit le chiffre DANS la couleur d'action sur un voile d'elle-même ; en clair il faut un rouge plus sombre pour le chiffre (`--color-action-texte: #b0121f`, 5,5:1), sinon 3,96.

### 51.3 L'export des cartes mentales a ses empreintes figées
`carte.positions.test.ts` garde au caractère près le SVG d'export d'une carte d'avant le 2026-09-29. Comme `PALETTE_EXPORT` recopie le thème clair, **tout changement des neutres clairs fait tomber les quatre empreintes d'export** (et elles seules). Vérifier que thème, rendu armé et JSON restent identiques, puis remplacer les empreintes d'export avec une note datée.

### 51.4 Un point qui suit un « · » orphelin
Dans la méta d'une ligne de Tâches, chaque morceau poussé reçoit son séparateur. Un point d'action poussé comme morceau à part s'affichait « hier · reportée 2 fois · ● ». Le point se colle au morceau qui dit pourquoi (le report, sinon la date).

## 52.1 Une horloge injectée ne fige pas le `now()` de Postgres : une date en dur dans un banc PGlite est une bombe à retardement

`serveur.test.ts` injecte `maintenant: () => 2026-10-14` dans le cœur de la
fonction `ai`, mais `ai_offre` (migration 008) décide « essai en cours » par
`trial_ends_at > now()`, et le `now()` de PGlite est la VRAIE heure. La fin
d'essai du test, écrite en dur au `2026-10-20T00:00:00Z`, est passée à minuit
UTC (02:00 à Paris) le 2026-10-20 : le compte d'essai n'avait plus d'offre et
la fonction rendait 403 au lieu de 200, sans aucun commit en cause (vert à
01:39, rouge à 02:27). Le serveur avait raison ; le test mêlait deux horloges.
▶️ Dans un banc SQL, toute date que Postgres compare à `now()` (`trial_ends_at`,
`current_period_end`, `created_at`…) se calcule depuis `Date.now()` — comme
`demain` et `hier` de `serveur.sql.test.ts` —, jamais depuis l'horloge injectée
ni en dur. Diagnostic express d'un test qui rougit « tout seul » : chercher une
date littérale proche du jour de la panne.

## 53.1 Une fonction edge Supabase s'exécute au plus près de l'appelant, et une région mal écrite n'est pas refusée

Mesuré le 2026-10-13 sur `…/functions/v1/ai` (en-tête de réponse `x-sb-edge-region`) : sans région demandée, `eu-central-2` depuis la France ; `x-region: us-east-1` → `us-east-1` ; une région qui n'existe pas (`zz-nowhere-9`) → `eu-central-2`, **sans erreur**. La région du PROJET (Paris) ne dit donc rien de l'endroit où tourne une fonction. `runAi.ts` la fixe par `?forceFunctionRegion=` ; l'en-tête `x-region` ferait échouer le contrôle préalable CORS tant que la fonction ne l'autorise pas. Pour vérifier : `curl -s -o /dev/null -D - -X OPTIONS '<url>?forceFunctionRegion=eu-west-3'` et lire `x-sb-edge-region`.

## 54. Les données qui s'abîment sans prévenir — lot 1 de l'audit (2026-10-20)

### 54.1 ⭐ Un éditeur qui reste monté garde, dans ses `useCallback([])`, l'enregistrement du PREMIER rendu
**Symptôme.** Savoir : ouvrir A, ← / → vers B, coller une capture : A recevait le corps de B plus l'image, son propre contenu perdu. **Cause.** Le lecteur ne remonte pas l'éditeur en feuilletant, seul `noteId` change. `addImages` (dépendances vides) gardait `insertBlock → emit → onChange → patch → flush` du premier rendu, donc l'`entryId` de A — avec le DOM de B. **Parade.** Un geste qui finit après coup ne doit JAMAIS porter la cible dans sa fermeture : `emit` lit le dernier `onChange` par une ref et envoie l'identité du DOM (`idDuDom`, posée au semis), l'appelant range l'écriture sous CETTE identité ; un geste asynchrone compare un compteur de semis (`identite()`) avant d'agir. Même famille que le chantier H du 2026-09-05 (Notes). **Payé.** Le seul défaut « critique » de l'audit, présent depuis l'audit du 6–8 octobre.

### 54.2 « Son parent est toujours dans le document » ne prouve pas que c'est la même note
**Symptôme.** « Annuler » après le retrait d'une carte, une autre note ouverte entre-temps : la carte atterrissait à la fin de l'autre note. **Cause.** Un bloc de premier niveau a pour parent la RACINE `contenteditable`, que les deux éditeurs gardent d'une note à l'autre (ils ne font que resemer `innerHTML`) ; `parent.isConnected` restait vrai. **Parade.** `retirerBloc(bloc, toujoursLa)` : la remise est refusée si l'identité de l'éditeur a bougé. Toute « cible capturée au retrait » doit capturer l'identité du CONTENU, pas un nœud qui survit au changement.

### 54.3 « Pas de balise, donc texte brut » ré-échappait les notes d'une ligne
**Symptôme.** « Dupont & fils » devenait « Dupont &amp; fils » à la réouverture, puis « &amp;amp; »… **Cause.** L'éditeur enregistre `innerHTML` : une ligne nue s'enregistre SANS balise mais DÉJÀ échappée ; `toEditorHtml` la prenait pour un vieux texte brut. **Parade.** `estTexteBrut` (richtext.ts) : ce que `innerHTML` ne produit jamais (`<`/`>` nus, `&` hors entité, saut de ligne). Les notes déjà abîmées sont réparées au chargement, dans les nœuds texte seulement (`reparerEchappements`). ▶️ Une heuristique « ressemble à X » se teste par un ALLER-RETOUR (semer, relire `innerHTML`, resemer), pas sur un exemple.

### 54.4 Une écriture « technique » (`touch: false`) part quand même dans le cloud, au présent
**Symptôme.** Chaque visite du Savoir renvoyait au cloud le corps complet (images en data URL) des fiches « image seule », et pouvait battre une légende ajoutée sur l'iPhone. **Cause.** `touch: false` ne bouge pas `updated_at`, mais le déclencheur d'outbox pose une entrée à CHAQUE `UPDATE`, horodatée maintenant — et le moteur arbitre sur cet horodatage. Le tri « texte vide » retenait pour toujours une fiche faite d'images. **Parade.** Une écriture automatique ne part que si elle CHANGE quelque chose (`reindexationDe` rend `null` sinon). ▶️ Toute réécriture « sans effet » au démarrage ou à l'ouverture d'une vue est un envoi au cloud, et une victoire LWW potentielle sur un autre appareil.

### 54.5 Un drapeau global en base est un verrou : tout ce qui écrit à côté est concerné, et un `finally` ne tourne pas si l'app est tuée
**Symptôme.** Une tâche cochée pendant qu'une page reçue s'applique ne partait jamais vers les autres appareils ; après un arrêt brutal pendant une application, plus rien ne partait. **Cause.** `applying = '1'` fait taire TOUS les déclencheurs d'outbox ; `repo.ts` écrivait sans le savoir, et la remise à '0' n'était que dans un `finally`. **Parade.** Une porte (`sync/verrou.ts`) : l'application la ferme et attend les écritures en vol AVANT de lever le drapeau, les écritures de l'app (par `getDb`) attendent derrière ; le moteur écrit par `getDbBrute` (par `getDb`, il s'attendrait lui-même pour toujours). Le drapeau est baissé au démarrage de la fenêtre principale (`remettreEnOrdre`). ⚠️ **Pas couvert** : les fenêtres capture et Timer ont leur propre contexte JavaScript, donc leur propre porte.

### 54.6 La copie « de secours » avant restauration copiait `shale.db` sans son `-wal`, que la ligne suivante supprimait
L'en-tête de `sauvegardes.rs` disait pourquoi on utilise `VACUUM INTO` ; le filet de la restauration, trente lignes plus bas, faisait un `fs::copy`. **Parade.** `copier_coherente` pour les deux. ▶️ Une règle écrite en tête de module ne protège que le code qui la lit : chercher les `fs::copy` d'une base à chaque fois qu'on touche à ce fichier.

### 54.7 Restaurer une sauvegarde rapporte AUSSI son curseur de synchronisation
**Symptôme.** La note restaurée était effacée de nouveau au premier cycle. **Cause.** `sync_meta.cursor` et `sync_state` voyagent dans la copie : le moteur repartait du curseur d'hier et appliquait la pierre tombale d'aujourd'hui. **Parade.** Le Rust marque la base restaurée (`sync_meta.restauree = '1'`, et `applying` baissé) ; le front, au démarrage, fait ce que fait « republier » (curseur 0, `sync_state` vidé, tout remis en file). Prouvé sur le banc à deux appareils (`sync/restauration.test.ts`, avec un témoin qui montre le défaut sans marque).

### 54.8 Bancs Rust : `drop` d'une `SqliteConnection` ne ferme pas tout de suite
`drop(conn)` délègue la fermeture à un fil de sqlx : en WAL, le journal n'est pas encore reporté quand la ligne suivante copie le fichier (« no such table » sur la copie). Et une connexion encore ouverte sur un fichier qu'on écrase y reporte son journal en se fermant. **Parade.** `conn.close().await` dans les tests ; pour simuler un plantage, copier `shale.db` ET `shale.db-wal` pendant que la connexion vit, puis fermer.

### 54.9 La démo cache un défaut de corbeille : ses objets jetés QUITTENT la liste
`demo.updateKnowledgeEntry` ne trouvait pas une fiche jetée (elle n'est plus dans `knowledgeEntries`) ; le natif, lui, faisait `UPDATE … WHERE id = $n` sans `deleted_at IS NULL` et écrivait dans la ligne en corbeille. Un défaut de corbeille ne se prouve pas en démo : banc SQL (`corbeille/donnees.repo.test.ts`).

### 54.10 La fenêtre de 400 jours de `fetchAll` tronquait aussi ce qui n'est PAS de l'historique
Les coches servaient à deux choses : l'historique (séries, graphiques — 400 jours suffisent) et l'état présent d'une tâche ponctuelle (« faite »), plus le compte des cibles d'objectif depuis leur début. **Parade.** Le `WHERE` garde toute coche de ponctuelle et de source de compte. ▶️ Avant de borner une lecture par date, se demander si une seule ligne ancienne décide d'un état AUJOURD'HUI.

## 55. Une règle de tâche neuve ne mord que là où l'on va la chercher : « faite » et « en retard » sont recalculés en ligne à quinze endroits (2026-10-20)

La 031 (états des tâches) a branché `estSuspendue` et l'état dans les fichiers
qu'elle connaissait ; l'audit du soir en a trouvé quatre qu'elle ignorait —
le péril (`calendrier/peril.ts`), la feuille de route (`FeuilleDeRoute.tsx`),
la carte mentale (`carteEtat.ts`), la charge du calendrier (`charge.ts`,
`disponibilite.ts`) — et chacun mentait à sa façon : un objectif « en péril »
pour des tâches abandonnées, une abandonnée rouge « en retard ». Cause :
« faite » s'écrivait `new Set(completions.filter((c) => c.done).map(...))` en
ligne, et « en retard » `due_date < aujourdhui && !faite`, sans passer par
`lib/taches.ts`. Un même oubli guettait `ponctuelle_depuis` (032).
▶️ Depuis le lot 2, `ponctuellesFaites(completions, tasks)` exige les tâches
(un appel qui les oublie ne compile plus) et remplace les copies en ligne.
Avant de livrer une règle de tâche, chercher les copies :
`grep -rnE "c\.done\)\.map|due_date < " src` — et la règle Rust
(`notifications/task_streak.rs`). Payé : sept défauts d'audit, une demi-journée.

## 56. Retirer un instant une classe pour MESURER remet à zéro le défilement des enfants

- **Symptôme.** Au téléphone, cocher une habitude en bas de la carte la ramenait en haut ; le « ⋯ » d'une ligne du bas ouvrait un menu sous une AUTRE ligne (audit du 20/10, constat 1).
- **Cause.** `ResizablePanel` lit la hauteur naturelle d'une carte en retirant `.rgrid-fill` le temps d'un `offsetHeight`. Sans l'étirement, la région `.panel-scroll` n'a plus rien à défiler : le navigateur ramène son `scrollTop` à 0, et remettre la classe ne le rend pas. Chaque re-mesure (une coche, un menu ouvert) relançait le défaut.
- **Parade.** `garderDefilement` (`lib/grille.ts`) relève les `scrollTop` avant la lecture et les repose après. Toute mesure qui change la mise en page d'un parent le temps d'une lecture doit faire de même.
- **Payé.** Vu par deux utilisateurs simulés, mesuré dans WebKit le 2026-10-21 (lot 4).
## 57. Lot 5 de l'audit — deux erreurs qui se répètent (2026-10-20)

### 57.1 Recoller les chiffres d'une date tapée la rend ambiguë
**Symptôme.** « 20/02/2027 » répondait « Date illisible » ; « 15/01/2027 » passait. Seuls les jours 19 à 22 étaient touchés.
**Cause.** `parserSaisie` retirait les séparateurs puis, devant huit chiffres, essayait l'ISO d'abord dès que les quatre premiers faisaient une année plausible (1900–2200) : « 2002 », mois 20. Les tests ne prenaient que des jours (24, 7) qui ne tombent pas dans la plage.
**Parade.** Une saisie AVEC séparateurs se lit morceau par morceau ; seuls huit chiffres collés passent par la lecture « collée », langue d'abord. Tester un format de date sur TOUTES les dates d'une année, pas sur trois exemples (`champDate.test.ts` le fait).
**Payé.** Trois utilisateurs du labo sur trois au format demandé ; « moment de fermer » de Léa.

### 57.2 Une fonction de branchement testée n'est pas une fonction branchée
**Symptôme.** L'accueil promettait « c'est de là que partent les créneaux que le calendrier te proposera » ; le calendrier proposait 09:00 à qui avait déclaré 08:30 – 17:00, et les blocs fixes n'étaient nulle part.
**Cause.** `repliDuTravail` (2026-09-10) avait ses tests, le commit annonçait le branchement ; aucun appelant de `profilDisponibilite` ne lui passait d'options. Les tests de la fonction étaient verts, le produit n'en voyait rien.
**Parade.** Quand une fonction existe POUR être branchée quelque part, un test de source tient l'appel (`onboarding/horaires.test.ts` vérifie `CalendarView` et `CalendarCard`). Avant de documenter « branché », `grep -rn "nomDeLaFonction(" src | grep -v test`.
**Payé.** Six semaines de réglages déclarés pour rien ; constat 7 de l'audit (Monique : « j'aurais douté de tout le reste »).

## 58. Lot 7 de l'audit du 2026-10-20 (finitions d'Objectifs et divers)

### 58.1 Un verrou tenu dans un `useState` ne garde pas deux événements du même instant
**Symptôme** : deux Entrée rapprochées (ou une touche qui rebondit) créent la même étape, la même tâche, ou rattachent deux fois. **Cause** : `if (occupe) return; setOccupe(true)` — l'état ne change qu'au rendu suivant, et le second événement lit encore `occupe === false` (`ComposerTache`, `RattacherElement`, `ChampLigne` de la feuille de route). **Parade** : le verrou LU est une `useRef` (`enCours.current`), posée avant le premier `await` ; l'état ne sert plus qu'à griser le bouton. **Payé** : objectifs-13 (A06a-46), trois composants corrigés le même jour.

### 58.2 Une réponse de recherche peut être celle de la frappe d'AVANT
**Symptôme** : on tape « Réviser chapitre 2 » puis Entrée tout de suite, et « Réviser chapitre 1 » (rattachée à un autre objectif) est arrachée à son objectif. **Cause** : la recherche part 120 ms après la frappe et répond plus tard encore ; Entrée agissait sur la liste affichée. **Parade** : retenir la requête dont la liste est la réponse (`resultatsPour`) ; sur Entrée, si elle diffère du champ, redemander la recherche et choisir dans la réponse JUSTE. Le clic, lui, garde ce qu'on a vu. **Payé** : objectifs-11 (A06a-04), deux audits.

### 58.3 Une clé i18n partagée entre deux sens prend la traduction de l'un pour l'autre
**Symptôme** : l'app anglaise ouvre le menu d'une tâche sur « End ». **Cause** : `t("Terminer")` sert à la fois à arrêter le minuteur (« End ») et à cocher une tâche ; le dictionnaire n'a qu'une entrée par clé. `i18n:check` ne voit rien (la clé existe). **Parade** : un discriminant (`t("Terminer|tâche")`, retiré du français) dès qu'un mot français a deux sens dans l'app. **Payé** : constat d'usage 41, vu par trois personas.

### 58.4 `import("module?x=…")` donne bien une instance par requête… et une TRANSFORMATION par requête
**Symptôme** : pour accélérer le balayage d'un an de la démo Finance, une instance de `demo.ts` par jour (`import(\`../../demo.ts?jour=${jour}\`)`) au lieu de `vi.resetModules()` : le test passe de 55 s à plus de 60 s. **Cause** : Vite traite chaque requête comme un module distinct et re-transforme les 3 000 lignes à chaque jour (« transform 36 s »). **Parade** : découper le balayage (un `it` par mois) plutôt que chercher à le rendre plus rapide. **Payé** : donnees-10, une heure.

### 58.5 Une vue entière se rend dans vitest (happy-dom), pas seulement un composant de trois lignes
Depuis le 2026-10-20, `GoalsView`, `FeuilleDeRoute`, `RattacherElement`, `EditeurCarte` et `CommandPalette` ont des tests de RENDU (`*.test.ts`, `// @vitest-environment happy-dom`, `createRoot` + `act`). Trois choses à savoir : `useIaPossible` lit la session (`AuthGate`) — `vi.mock("../lib/ia/useIa", …)` ; la langue se fixe par `setLangPref("fr")` avant d'importer la vue ; une saisie se simule par le *setter natif* de `value` puis un événement `input` (React n'écoute pas l'affectation directe). Le film d'une carte d'objectif (`jouerTransition`) se remplace par un faux qui compte ses départs.

## 59. Chiffres qui se contredisent d'un écran à l'autre — lot 3 de l'audit (2026-10-21)

### 59.1 Un écran qui ÉCRIT à son ouverture fait dépendre les chiffres des autres écrans du parcours
**Symptôme.** La Discipline des tâches du jour n'était pas la même selon qu'on avait ouvert le Calendrier ou non. **Cause.** Le Calendrier reporte les tâches en retard dans un `useEffect` monté avec la vue (`due_date` ← aujourd'hui), et toutes les règles de compte lisaient `due_date === jour` comme « prévue ». **Parade.** La donnée écrite par l'effet doit garder son sens dans chaque règle : une tâche reportée jusqu'au jour (`estGlisseeJusquA`) reste en retard. Un test rejoue « avant / après l'ouverture » et exige les mêmes comptes (`reportCalendrier.compte.test.ts`). ▶️ Avant d'ajouter un effet qui écrit à l'ouverture d'une vue, chercher qui lit la colonne écrite.

### 59.2 Deux appels d'un même crochet d'état ne partagent RIEN
**Symptôme.** L'anneau d'Aujourd'hui annonçait une « coche optimiste » ; il n'avançait qu'après la relecture de la base. **Cause.** `useCochesOptimistes()` appelé dans TodayView ET dans la carte `HabitudesDuJour` : deux `useState`, deux mondes. Le commentaire disait le contraire. **Parade.** Passer l'instance du parent en prop (`coches`). ▶️ « Les deux lisent les mêmes coches optimistes » ne vaut que s'ils lisent la même instance.

### 59.3 Mesurer un objectif sans ses arêtes ni ses événements — encore
**Symptôme.** Point d'action « objectif dépassé » sur un objectif que sa page dit atteint. **Cause.** Le piège était consigné (mesure incomplète sans `fetchContexteObjectifs`) ; le point d'action du 20/10, le péril de la page Objectifs et du Calendrier, l'IA et l'instantané quotidien appelaient la mesure avec les seules tâches et habitudes. **Parade.** `useContexteObjectifs(data)` / `useSourcesProgression(data)` partout où un objectif se mesure hors de sa page. ▶️ `grep -rn "objectifsEnPeril(\|effectiveProgress(" src` : chaque appel doit recevoir `liens` et `evenements`.

### 59.4 `Math.round` sur un pourcentage d'achèvement déclare « terminé » ce qui ne l'est pas
**Symptôme.** 299 séances sur 300 : « Atteint ». **Cause.** `pct = Math.round(fraction * 100)` puis `estAcheve = pct === 100`. **Parade.** `pctDe` : 100 seulement pour une fraction entière, 99 au plus sinon.

### 59.5 Une durée lue `fin − début` partout, et une pause tenue en mémoire seulement
**Symptôme.** 25 min de travail et 30 min de pause valaient 55 min ; une séance finie pendant la veille du Mac valait jusqu'au réveil. **Cause.** La reprise décalait le départ en mémoire, la fin écrivait l'heure du moment. **Parade.** Écrire dans `ended_at` la durée VRAIE (début + temps travaillé, borné au prévu) plutôt que de corriger chaque lecteur (`seance/duree.ts`). Une `setTimeout` ne se déclenche qu'au réveil : toute fin « naturelle » se borne au prévu.

### 59.6 Une date capturée au RENDU, utilisée au CLIC
**Symptôme.** Cochée à 7 h, l'habitude partait sur la veille. **Cause.** `const today = todayStr()` au rendu ; l'app ouverte la nuit ne se redessine pas forcément à minuit. **Parade.** Relire la date au clic (`jourDeCocheAffiche`) ; une case qui montre un autre jour choisi garde ce jour.

### 59.7 Labo : dans un même `faire`, les numéros sont ceux de l'écran D'AVANT
**Symptôme.** `[{"clic":"Habitudes"},{"clic":21}]` a cliqué l'élément 21 de l'écran précédent. Et `{"clic":"Aujourd'hui"}` dans le Calendrier a pris son bouton « Aujourd'hui », pas la barre latérale. **Parade.** Après un changement d'écran, viser par texte, ou finir le `faire` et relire les numéros ; pour la barre latérale, son numéro (« Aujourd'hui » = 2).
