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

## 6.3 Un token de couleur inexistant échoue EN SILENCE

`text-amber` ne génère aucune classe (le token s'appelle `--color-yellow`) : la
couleur retombe sur l'héritage, sans erreur.

**Les cinq tokens de couleur RÉELS**, vérifiés dans `src/index.css` le
2026-09-02 : `blue`, `green`, `red`, `yellow`, `violet`.
⚠️ `CLAUDE.md` en cite un sixième, **`indigo`, qui n'existe pas** — l'employer
échouerait donc exactement de la façon décrite ci-dessus. Corrigé dans
`CLAUDE.md` le 2026-09-02.

## 6.4 Tout `vh`/`vw` doit être multiplié par `--zoom-inv`

Le `zoom` CSS de la densité multiplie **aussi** les unités de viewport : sans
correction, l'élément déborde de l'écran dès que la densité n'est pas à 100 %.

---

# 7. Vérifier — et ce qui ne vérifie rien

## 7.1 ⭐ Aucun test de ce dépôt ne prouve une interface

Les tests sont **tous** de logique pure ou de schéma. Il n'existe aucune
infrastructure de test de rendu React. **Ne jamais écrire qu'un correctif
d'interface est « vérifié par un test ».** Une interface se vérifie à l'écran.

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
3. Et après la copie, comparer les **sha256** du binaire installé et de la
   source : c'est la seule preuve que `ditto` a vraiment remplacé quelque chose.

**Comment on l'a payée.** 2026-09-04 : une session voisine a fusionné un
correctif 1 min 50 après le `vite build` et 1 min avant la fin du bundle. L'app
a été installée sans lui. **C'est elle qui l'a signalé, pas moi** — mon
invariant, vérifié au mauvais moment, disait que tout allait bien.

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
