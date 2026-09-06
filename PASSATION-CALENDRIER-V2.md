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
La parade tient en un mot — une `key={modale.event?.id ?? "neuf"}` sur
`<EventModal>` — et elle n'est pas posée, faute de défaut à corriger. C'est le
même piège que celui trouvé le 2026-09-06 dans `RichNoteEditor` par la session
[H-notes-contenu], à ceci près que là-bas il mordait pour de bon.

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

**Avant de construire, la marche à suivre est dans `CLAUDE.md` (2026-09-04) :**
1. sauvegarde `sqlite3 .backup` de la vraie base, **jamais un `cp`** (WAL) ;
2. prendre le verrou dans `COORDINATION.md` ;
3. ⚠️ revérifier l'état du dépôt **juste avant la copie**, pas après le build ;
4. prouver le **contenu** de `dist/assets/*.js`, pas les horodatages ;
5. comparer le `sha256` avant et après `ditto`.

## 6. Comment reprendre

Le mode démo se monte et se démonte avec les deux lignes du § 5.3 de
`PASSATION.md`. ⚠️ **Le démonter avant de rejouer la ligne de base** : le patch
fait sortir deux erreurs `tsc` dans `useAuth.ts` qui ne sont pas des régressions
(PIEGES § 1.2 ter).
