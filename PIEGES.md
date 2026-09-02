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

## 6.3 Un token de couleur inexistant échoue EN SILENCE

`text-amber` ne génère aucune classe (le token s'appelle `--color-yellow`) : la
couleur retombe sur l'héritage, sans erreur. Tokens réels : `blue`, `green`,
`red`, `yellow`, `violet`, `indigo`.

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

## 7.3 Un test rouge n'est pas forcément le vôtre

**Symptôme.** `auth/activation.sql.test.ts` échoue sur deux cas d'essai gratuit.

**Cause.** Le test lit le SQL du **dépôt du site**, qui a changé le 2026-08-31
(Stripe LIVE, le paiement devient le mur) sans que le test de l'app ne suive.
**Ces deux échecs préexistent à tous les chantiers en cours.**

**Parade.** Avant de croire avoir cassé quelque chose, **rejouer le test sur la
branche intacte**. Et ne jamais annoncer « ligne de base au vert » sans
mentionner ces deux-là. Décision attendue d'Antonin :
`~/Desktop/Shale-chantiers/DETTE-SITE-CALENDRIER.md` § A.1.

## 7.4 Vérifier un document dans l'arbre avant de le croire

**Symptôme.** Une consigne annonçait « douze modules est écrit en toutes lettres
à **8 endroits** dans `src/` ». Le grep rend bien 8 résultats — mais sept
parlent de douze **mois**, douze **loyers**, douze **mots**. **Aucun texte
affiché dans l'app n'annonce le nombre de modules** ; seuls deux commentaires de
code le mentionnent.

**Parade.** Un compte donné par un document se re-mesure avant d'être utilisé.
`grep -rn "douze"` n'est pas `grep -rn "douze modules"`.

## 7.5 `getComputedStyle` n'est pas une preuve de couleur

Chromium rend une valeur périmée sous `backdrop-filter`. **La capture d'écran
tranche.**

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

## 8.3 Une reconstruction native redemande l'accès au trousseau

La signature ad hoc change à chaque reconstruction : macOS redemande
l'autorisation au premier lancement. **Le dire à Antonin** — sinon il découvre
une fenêtre inexpliquée et ne sait pas s'il doit accepter.

## 8.4 Auditer en `tauri dev` pilote la VRAIE base d'Antonin

Avec un risque d'écriture à chaque `Tab`. Le mode démo navigateur n'est pas du
confort, c'est la seule façon sûre de regarder une interface.
