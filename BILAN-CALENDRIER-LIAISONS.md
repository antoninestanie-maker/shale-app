# Bilan — la série Calendrier & Liaisons (2026-09-02 → 2026-09-04)

*Le document de clôture de quatre chantiers, plus deux qui s'y sont greffés, et
de la mise en service du 2026-09-04. Les quatre passations détaillées restent à
côté ; celle-ci dit **ce qui est livré, ce qui tourne chez Antonin, et ce qui
reste ouvert**.*

> **Ce qui a changé pour Antonin, en une phrase** : l'app a un **calendrier**
> (13ᵉ module), les objets **se citent entre eux** avec `@`, et tout cela tourne
> **sur son Mac et sur son iPhone** depuis le 2026-09-04 à 11:51.

---

## 1. L'état à la clôture

| | |
|---|---|
| Branche | `mobile-ios`, à `5511fc8`, propre, poussée sur `origin` |
| Base de données | migration **020** appliquée à la **vraie base** d'Antonin le 2026-09-04 à 11:41 |
| App macOS | `/Applications/Shale.app`, reconstruite le **2026-09-04 à 11:51** |
| App iOS | **simulateur** iPhone 17 (iOS 26.5) uniquement — voir § 6 |
| Tests front | **553 / 553** |
| Tests Rust | **129** |
| Modules | **treize** — le compte est passé de douze à treize |
| Volume | 73 fichiers, +11 216 lignes, 39 fichiers neufs |
| Worktrees | tous refermés |

### La ligne de base, à rejouer avant de croire quoi que ce soit

```
npx tsc --noEmit
npm run test:types
npm run i18n:check
npm run i18n:durs
npm test
npx vite build
cargo check --all-targets && cargo test --lib
cargo check --target aarch64-apple-ios-sim
```

⚠️ **Un échec est désormais un vrai échec.** Les deux tests rouges d'`activation.sql`
qui traînaient depuis le 2026-08-31 sont réparés (§ 4) : il n'y a plus de « dette
connue » derrière laquelle se cacher.

---

## 2. Les six chantiers, dans l'ordre où ils sont entrés

| | Chantier | Commit | Ce qu'il pose | Détail |
|---|---|---|---|---|
| **A** | le socle de données | `010c942` | migration 020, table `object_links`, dates sur les tâches, types d'objets. **Aucune interface** | `PASSATION-SOCLE.md` |
| **B** | le calendrier | `a3f6c3b` | 13ᵉ module, vues mois/semaine/jour, surcharge, report, créneaux appris, objectifs en péril | `PASSATION-CALENDRIER.md` |
| **C** | liaisons et objets | `f9472e9` | mentions `@`, backlinks, types d'objets libres, recherche ⌘K étendue | `PASSATION-LIAISONS.md` |
| **D** | parité iPhone | `60d11a3` | vue agenda, glisser au doigt, sélecteur `@` au-dessus du clavier, rappel ponctuel | `PASSATION-IOS.md` |
| **E** | l'essai gratuit | `db8652d` | l'essai reste **possible**, il n'est plus **obligatoire** | § 4 |
| **F** | la sauvegarde quotidienne | `67ce66e` | elle sautait un jour entier — verrou sur le jour UTC | § 5 |

**A → B → C → D est un ordre, pas une préférence** : B et C consomment le socle,
D consomme B et C. Chacun a été fusionné et poussé avant que le suivant ne
commence, et le carnet de coordination
(`~/Desktop/Shale-chantiers/COORDINATION.md`) porte chaque PRISE, LIBÈRE et
FUSIONNÉ.

### Ce que chaque chantier a laissé derrière lui

- **A** — le socle a corrigé au passage un bogue latent de synchronisation :
  `local.ts` vidait **les deux extrémités de chaque arête reçue**, silencieusement.
  Sans le test qui l'a vu, aucune liaison n'aurait survécu au passage d'un
  appareil à l'autre.
- **B** — le moteur de récurrence était écrit **deux fois** ; il est maintenant
  dans `src/lib/logic.ts` et personne n'en a de copie.
- **C** — un module chargé paresseusement n'est pas monté quand l'événement de
  navigation part. D'où `naviguer.ts` : on **dépose une demande**, la vue la
  consomme en arrivant.
- **D** — le rappel « événement imminent » n'était **jamais à l'heure sur iPhone
  app fermée**. `instants_du_calendrier()` sonde désormais `début − avant_min`,
  sans réécrire une seule règle.

---

## 3. Ce qui tourne chez Antonin depuis le 2026-09-04

C'est la partie qui n'existait dans aucun document : les quatre chantiers étaient
fusionnés depuis le 2026-09-02, mais **l'app installée datait du 2026-08-28** et
ne connaissait pas la migration 020.

### La séquence, telle qu'elle a été menée
1. **Deux sauvegardes cohérentes** de la base, prises avec `sqlite3 .backup`
   (jamais une copie de fichier — le WAL) : app ouverte, puis app fermée.
   `integrity_check` → `ok` sur les deux.
   → `~/Desktop/Shale-projet/shale-backups/avant-migration-020-20260904-1135/`
2. Verrou **BUILD NATIF** pris dans le carnet de coordination — une seule session
   compile à la fois.
3. Compilation, installation, lancement.
4. **La migration 020 s'est appliquée sur la base réelle, non vide** : quatre
   tables créées, `_sqlx_migrations` en version 20, `integrity_check` → `ok`,
   **aucune donnée perdue** (14 notes, 2 tâches, 5 fiches de savoir, 4 types
   d'objets).
5. ⚠️ Le premier bundle a dû être refait — voir § 5.
6. Verrou libéré, `sha256` du binaire vérifié identique à la source après copie.

### ⚠️ Le trousseau redemande l'autorisation
macOS redemande l'accès au trousseau **dès que le binaire change** — donc à
chaque reconstruction qui embarque du code neuf. Reconstruire le même code ne la
déclenche pas. Antonin doit cliquer « Toujours autoriser » ; **aucune session ne
peut le faire à sa place** (saisir un mot de passe est interdit).

---

## 4. La décision produit : l'essai gratuit

> **Décision d'Antonin, 2026-09-02 : l'essai gratuit reste POSSIBLE pour Shale,
> mais il n'est PAS obligatoire.**

En instruisant la question, il s'est avéré que le « pas obligatoire » **existait
déjà côté site** : `create-checkout` accepte un drapeau `sansEssai` pour
s'abonner directement, et n'accorde les sept jours qu'à la première souscription.
**Aucun fichier du site n'a eu besoin d'être touché.**

Ce qui restait était dans l'app, et ce n'était pas ce qu'on croyait : les deux
tests rouges depuis le 2026-08-31 n'avaient pas une **assertion** fausse, ils
avaient une **mise en place périmée**. Ils attendaient un essai ouvert par
l'inscription, alors qu'il vient maintenant de Stripe. Ils posent désormais
l'essai comme le fait le webhook.

⚠️ **Ce qu'il ne fallait surtout pas faire** : « réparer » ces tests en rouvrant
l'essai sans carte. Le test serait passé au vert et **le produit aurait contredit
ses propres CGV**, qui promettent une carte à la souscription et un premier
prélèvement au 8ᵉ jour.

---

## 5. Les trois erreurs qui ont coûté le plus

Elles sont toutes dans `PIEGES.md` avec leur parade. Résumées ici parce qu'elles
disent quelque chose sur la manière de travailler, pas seulement sur le code.

**① L'invariant de fraîcheur, vrai au mauvais moment.** `tauri build` fige le
front à la première seconde puis compile le Rust pendant plusieurs minutes.
L'invariant « front ≥ dernier commit » a été vérifié **après** la compilation :
vrai, et pourtant l'app installée n'avait pas le correctif `67ce66e` fusionné
entre-temps par une session voisine. **C'est elle qui l'a signalé, pas
l'invariant.** Parade : revérifier juste avant la copie, et prouver le **contenu**
du bundle plutôt que ses horodatages.

**② Le guetteur qui se cherche lui-même.** Une boucle d'attente en `pgrep -f`
contient le motif qu'elle cherche : elle se trouve elle-même et ne s'arrête
jamais. Fait **trois fois**, dont une **deux jours après avoir écrit l'entrée qui
le décrit**. Écrire un piège ne suffit pas à s'en garder — d'où la parade
formulée en interdit : ne jamais guetter un processus quand un fichier fait
l'affaire.

**③ Tuer un PID sans lire ce qu'il est.** `lsof -ti:<port>` liste **tout** ce qui
touche au port : celui qui écoute **et chaque client connecté**. Le navigateur
intégré était un client ; son service réseau est parti avec la commande destinée
au serveur de développement. Sans conséquence durable, mais c'était de la chance.
Parade : `ps -p <PID> -o command=` avant de tuer quoi que ce soit.

---

## 6. Ce qui reste ouvert — à lire avant de promettre quoi que ce soit

- ⚠️ **Rien n'a été vu sur un iPhone réel.** Tout ce qui est écrit « iPhone »
  dans les passations veut dire **simulateur** (iPhone 17, iOS 26.5). Le geste au
  doigt n'est pas éprouvé à la main, et **le dépôt réel d'une notification iOS
  n'a jamais été observé**.
- ⚠️ **Les mentions ne sont pas branchées dans l'éditeur de blocs du Savoir**
  (`NoteComposer`) — seulement dans Notes et dans les fiches d'objets.
- ⚠️ **La projection des notifications suppose que l'état ne bougera plus.** Un
  événement créé sur le Mac pendant que l'iPhone dort ne sera annoncé qu'à la
  prochaine ouverture. Seule la voie push résout ce cas (`MOBILE.md` § 3.2/3.3).
- ⚠️ **62 cibles tactiles anciennes** restent sous les 44 pt
  (`AMELIORATIONS-UI.md` § 8). Les 19 ajoutées par B et C sont, elles, au-dessus.
- ⚠️ **Le site n'a pas suivi.** Il est hors périmètre par décision d'Antonin, qui
  mène sa refonte de son côté. La règle « l'app et le site ne divergent jamais »
  n'est pas annulée, elle est **différée et tracée** dans `DETTE-SITE.md` — le
  compte de modules y est le point principal.

---

## 7. Comment cette série a été menée, et ce qu'on en garde

Quatre chantiers, quatre **worktrees git** séparés, un carnet de coordination
partagé et **non versionné** (`~/Desktop/Shale-chantiers/COORDINATION.md`) où
chaque session écrit ce qu'elle prend, ce qu'elle libère et ce qu'elle fusionne.
Un verrou nommé **BUILD NATIF** garantit qu'une seule session compile à la fois.

Ce qui a marché : les fichiers chauds partagés (`en.ts`, `App.tsx`, `repo.ts`…)
n'ont **jamais** été en conflit, parce qu'un chantier ne démarrait qu'après la
fusion du précédent.

Ce qui a failli échouer : la mise en service, où deux sessions ont travaillé sur
la même app installée. **C'est le carnet qui a rattrapé le coup** — la session
voisine y a lu l'heure du build et su qu'il ne pouvait pas contenir son
correctif.

---

*Écrit le 2026-09-04. Voir `DOCUMENTATION.md` pour la règle qui a produit ce
document — et qui vaut pour toutes les sessions suivantes.*
