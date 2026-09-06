# Passation — Calendrier V2 (2026-09-05 / 06)

*Reprise du 13ᵉ module, deux jours après sa mise en service. Les décisions et
leur pourquoi sont dans la section datée de `CLAUDE.md` ; les pièges dans
`PIEGES.md`. Ce document dit **ce qui est fait, ce qui est prouvé, et ce qui
reste**.*

## 1. L'état

| | |
|---|---|
| Branche | `chantier/calendrier-v2`, **sept commits**, rebasée sur `mobile-ios` après le chantier Notes (`95f0e00`) |
| Fusionnée ? | **OUI**, en avance rapide. Rebase sans le moindre conflit : **aucun fichier en commun** avec le chantier Notes |
| Migration | **021**, `end_date` sur `calendar_events`. **PAS encore appliquée à la vraie base d'Antonin** |
| App macOS installée | toujours celle du **2026-09-04 à 11:51** — elle ne connaît rien de ce chantier |
| Tests front | **600 / 600** — 583 après ce chantier (+30), plus les 17 du chantier Notes |
| Tests Rust | 129, inchangés — aucune ligne de Rust modifiée hors l'enregistrement de la migration |

### Les cinq commits

| Commit | Ce qu'il répare |
|---|---|
| `976ab05` | La saisie à la minute : clic au quart d'heure, durée par défaut, heures par `Intl`, « Thin » → « End » |
| `021dc6e` | Journée entière en bandeau séparé, et événements multi-jours (migration 021) |
| `71d960a` | Vocabulaire de récurrence unifié + **un récurrent se déplaçait au glisser-déposer** |
| `2250d2e` | Dater une tâche depuis le module Tâches + **renommer une tâche datée effaçait sa date** |
| `b27f915` | Les animations de navigation, interruptibles et muettes sous `prefers-reduced-motion` |

## 2. Les critères d'acceptation, un par un

⚠️ **VU** = regardé à l'écran en mode démo. **MESURÉ** = un chiffre relevé, pas
une impression. **LU** = raisonné sur le code ou tenu par un test, jamais vu.

| # | Critère | État |
|---|---|---|
| 1 | 14:37 se crée et se retrouve à 14:37 | **MESURÉ** — la carte se pose 34,53 px sous la ligne de 14 h, soit 37,0 min. ⚠️ « **après redémarrage** » n'est pas VU : `demo.ts` est en mémoire et le mode démo ne redémarre rien. Prouvé au niveau du stockage par `calendrier/stockage.test.ts`, sur une base montée par les **vraies** migrations |
| 2 | Le clic et le glissement se calent à 15 min | **VU** — clic à 6 px du bas de la case 14 h → 14:45 ; glissement → 16:30 |
| 3 | La journée entière ne fausse pas la charge | **VU** — la ligne passe de « 1 tâche sans horaire » à « 2 », les heures posées ne bougent pas |
| 4 | Le multi-jours s'affiche continûment en mois et en semaine | **VU** dans les deux, chevrons de troncature compris |
| 5 | Un récurrent se crée, se projette, refuse d'être déplacé | **VU** — projeté sur les seuls mardi et jeudi choisis ; le glissement ne bouge plus rien et le clic ouvre bien la série |
| 6 | Une tâche reçoit une date depuis `TasksView` et apparaît au calendrier | **VU** — sans rechargement |
| 7 | Le changement de semaine est animé et interruptible | **MESURÉ** — `getAnimations().length` vaut 1 après trois clics ; `--cal-dx` change de signe selon le sens ; le nœud DOM du calque est le même après trois navigations |
| 7 bis | Muet sous `prefers-reduced-motion` | **LU dans le CSSOM de l'app qui tourne** — la règle `*` avec `!important` est présente après Tailwind. ⚠️ Le réglage système lui-même n'a **pas** été basculé : l'outillage ne le permet pas |
| 8 | La ligne de base au vert | **VU**, en entier, à chaque commit |
| 9 | Les cinq fichiers de documentation | **fait** |

## 3. Ce qui n'a PAS été vu, et qu'il ne faut pas lire comme conforme

- ⚠️ **L'app installée.** Rien de ce chantier n'y est. Le rebuild natif n'a pas
  été fait — voir § 5.
- ⚠️ **Le simulateur iOS.** Non lancé. Les champs neufs (date de fin, sélecteur
  de jours, créneau de tâche) n'ont **jamais** été touchés au doigt. Le cadrage
  mettait leur ergonomie hors périmètre, mais « rien ne se casse sur
  simulateur » n'est pas vérifié non plus.
- ⚠️ **`<input type="time">` dans la WKWebView.** Tout l'audit a tourné dans
  Chromium. Les deux défauts trouvés expliquent entièrement le symptôme
  d'Antonin sans qu'il faille supposer un défaut de WebKit, mais ce n'est pas
  une preuve.
- ⚠️ **Le rendu du bandeau quand plus de trois séjours se chevauchent.** Les
  étages sont calculés et testés, mais je n'en ai vu que deux à l'écran.

### Une fragilité à un cheveu, signalée par la session voisine

`EventModal` initialise **six** états par `useState(event?…)` — j'en ai ajouté
quatre (`plusieurs`, `finJour`, `recMode`, `jours`). Un initialiseur `useState`
ne se rejoue **pas** au changement de prop : si le composant restait monté en
passant de l'événement A à l'événement B, le formulaire afficherait les valeurs
de A tout en enregistrant sur B.

**Ce n'est pas atteignable aujourd'hui, et c'est mesuré, pas déduit** : les
quatre chemins qui ouvrent la modale sont couverts par son propre voile
`fixed inset-0 z-50`. Vérifié à l'écran — modale ouverte sur un événement, clic
sur « + Nouvel événement » : le voile intercepte, la modale se ferme, **rien ne
se rouvre**. Le composant est donc toujours démonté entre deux événements.

⚠️ **Mais une seule ouverture qui contournerait le voile suffirait** : un
raccourci clavier, une notification cliquable, un lien depuis un autre module.

⭐ **Et la parade n'est PAS une `key`**, contrairement à ce que j'avais d'abord
écrit ici. La session [H-notes-contenu] a corrigé exactement ce piège dans
`RichNoteEditor` le 2026-09-06, et son premier correctif — fondé sur la même
intuition — **était faux, vert aux tests, et n'a été démasqué qu'à l'écran** :
la clé de rechargement pouvait REVENIR EN ARRIÈRE à la première frappe, le DOM
était resemé avec le texte d'avant, et la lettre partait en base en disparaissant
de l'écran. Le motif à reprendre est `doitResemer()` dans
`src/lib/graineEditeur.ts` : une clé de rechargement ne recule jamais, et
« quel contenu » et « faut-il le reposer » sont deux questions distinctes.

## 4. Ce qui reste ouvert

- **La ligne de charge appelle un événement « une tâche »** — « plus 1 tâche
  sans horaire » pour un séminaire. Le compte est juste, le mot non. Signalé à
  Antonin, **non corrigé** : la règle « aucun refactoring opportuniste » vaut
  aussi quand la correction tient en un mot. **C'est une décision qui lui
  revient.**
- **`recurrenceLabel()` utilise encore `DAY_SHORT`**, la table française
  invisible aux deux outils i18n. `TaskModal` ne l'emploie plus ; l'affichage de
  la liste des tâches, si.
- **La règle Rust `calendar_soon` ne verra jamais les occurrences projetées** —
  décision documentée du chantier B, laissée intacte (`CLAUDE.md`).
- **Une fin de série** (jamais / après N / à une date) : hors périmètre,
  `occurrenceLe()` ne sait pas l'exprimer.

## 5. ⛔ Le rebuild natif — ce qu'il reste à faire, et la coordination

**La migration 021 doit atteindre la machine d'Antonin pour que ce chantier lui
serve à quelque chose.** Le verrou **BUILD NATIF** n'a pas été pris.

⭐ **Décision d'Antonin, 2026-09-06 : UN SEUL BUILD pour les deux chantiers.**
Le chantier Notes ([H-notes-contenu], trois commits, quatre défauts corrigés) a
fusionné le premier ; celui-ci a été rebasé par-dessus et fusionné ensuite. Un
seul build porte donc les deux, et Antonin ne voit qu'une fois la fenêtre de
trousseau (PIEGES § 8.3).

⚠️ **La ligne de base a été rejouée EN ENTIER sur l'arbre COMBINÉ**, ce qu'aucun
des deux chantiers n'avait pu faire seul : 600 tests front, 129 Rust, les trois
cibles. Et vérifié à l'écran que les deux coexistent — le bandeau du calendrier
et le passage d'une note à l'autre, dans la même session.

**Avant de construire, la marche à suivre est dans `CLAUDE.md` (2026-09-04),
précisée ici sur trois points que la soirée du 2026-09-06 a fait apparaître :**

1. **Sauvegarde `sqlite3 .backup` de la vraie base, PRISE AU MOMENT DU BUILD.**
   Jamais un `cp` (la base est en WAL). Deux copies — app ouverte puis fermée —
   et `integrity_check` sur les deux.
   ⚠️ **Ne PAS reprendre une sauvegarde existante comme référence.** Celle du
   chantier Notes (`avant-correctif-notes-20260905-2107/`) date du 2026-09-05 au
   soir : si Antonin a écrit depuis, elle ne permet plus de dire « rien n'a été
   perdu ».
   ⚠️ **Relever le compte de notes, de tâches et de fiches AVANT.** Sans ce
   chiffre, la vérification d'après n'a rien à quoi se comparer — et « ça a l'air
   d'aller » n'est pas un constat.
2. Prendre le verrou **BUILD NATIF** dans `COORDINATION.md`.
3. ⚠️ Revérifier l'état du dépôt **juste avant la copie**, pas après le build.
4. **Prouver le CONTENU** de `dist/assets/*.js`, pas les horodatages. Les trois
   témoins, revérifiés sur un build propre le 2026-09-06 :

   | Ce qu'il prouve | Motif | Attendu |
   |---|---|---|
   | le correctif Notes | `Shale/notes: refused a write` | **1** — littéral unique |
   | le multi-jours | `end_date` | **≥ 1** — jamais un compte exact |
   | les animations | `cal-glisse` (dans le `.css`) | **2** — deux images clés |

   ⚠️ **`end_date` se teste en PRÉSENCE, pas en compte.** J'avais écrit « 25 »
   ici, et c'était une erreur : ce sont des occurrences dispersées dans des
   chaînes SQL et des littéraux d'objet, dont le nombre **dépend du découpage en
   chunks**. Un build parfaitement sain peut en rendre 23 ou 27, et abandonner
   pour cette raison serait exactement le défaut que ces témoins existent pour
   éviter — une conclusion fausse au moment d'installer. Seul **zéro** est un
   signal. Les deux autres motifs sont stables parce qu'ils n'existent qu'une
   fois dans le source.

   ⚠️ **Les revérifier sur un `vite build` à blanc avant de s'en servir pour
   trancher**, et ne jamais les recopier d'ici sans le faire : un témoin périme
   (`PIEGES.md` § 7.5 bis). ⚠️ Et **jamais un nom de fonction** — mesuré, les
   cinq noms exportés du module Notes ET cinq des miens rendent tous zéro.
5. Comparer le `sha256` avant et après `ditto`.

⚠️ **LE MOMENT LE PLUS RISQUÉ N'EST PAS LA COMPILATION, C'EST LE PREMIER
LANCEMENT** : la migration **021** s'applique alors à une base NON VIDE. Le
chantier D l'a fait sans casse pour la 020 le 2026-09-04, ce qui est rassurant
mais ne prouve rien pour celle-ci.

⭐ **Trois contrôles DISTINCTS, et pas un seul** — ils ne disent pas la même
chose et peuvent diverger :

```sql
SELECT version FROM _sqlx_migrations ORDER BY version DESC LIMIT 1;  -- 21
PRAGMA table_info(calendar_events);                                  -- doit lister end_date
PRAGMA integrity_check;                                              -- ok
```

Le premier dit que sqlx **croit** avoir appliqué, le second que la colonne **est
là**. Une migration interrompue à mi-chemin les fait diverger — et le défaut ne
se verrait pas autrement : les lectures du calendrier sont tolérantes à l'échec
(`notifications/data.rs`), donc l'app s'ouvrirait normalement pendant que chaque
lecture d'événement échouerait en silence.

⚠️ **Si `integrity_check` n'est pas `ok` : RESTAURER depuis la sauvegarde et
s'arrêter.** Une seconde tentative sur une base à moitié migrée est le geste qui
transforme un incident récupérable en perte réelle.

⚠️ **Prévenir Antonin de la fenêtre du trousseau AVANT de relancer.** Le binaire
a changé, macOS redemandera l'autorisation, il doit cliquer « Toujours
autoriser » — et personne ne peut le faire à sa place. S'il n'est pas devant
l'écran, les contrôles ci-dessus se feront sur une app privée de son trousseau.

⚠️ **Ne pas guetter le processus de compilation** (`pgrep -f` se trouve lui-même,
§ 1.2 bis — commis trois fois dans ce dépôt). Guetter un artefact :
`until [ -d src-tauri/target/release/bundle ]; do sleep 20; done`.

## 6. Comment reprendre

Le mode démo se monte et se démonte avec les deux lignes du § 5.3 de
`PASSATION.md`. ⚠️ **Le démonter avant de rejouer la ligne de base** : le patch
fait sortir deux erreurs `tsc` dans `useAuth.ts` qui ne sont pas des régressions
(PIEGES § 1.2 ter).
