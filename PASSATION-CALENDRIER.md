# Passation — chantier B, le calendrier

*2026-09-02. Écrit pour une session sans contexte, et pour le chantier D
(parité iPhone) qui devra rendre tout cela utilisable au doigt.*

---

## 1. L'état

| | |
|---|---|
| Worktree | `~/Desktop/Shale-chantiers/calendrier` |
| Branche | `chantier/calendrier`, basée sur `mobile-ios` après le socle |
| Module | **Calendrier**, 13ᵉ, en Productivité entre Tâches et Timer |
| Tests ajoutés | **59** en TypeScript (agenda, disponibilité, charge, péril) + **9** en Rust |
| Vérifié à l'écran | ✅ oui — mode démo, en français **et** en anglais |

### Ligne de base

```
npx tsc --noEmit                            ✅
npm run test:types                          ✅
npm run i18n:check                          ✅ 0 manquante (1488 entrées)
npm run i18n:durs                           ✅ 0 chaîne sûrement française
npm test                                    ⚠️ 514 / 516 — les deux mêmes qu'avant (§ 5)
npx vite build                              ✅
cargo check --all-targets                   ✅
cargo test --lib                            ✅ 122 (113 + 9)
cargo check --target aarch64-apple-ios-sim  ✅
```

---

## 2. Ce qui est PROUVÉ

### Par des tests
- L'agenda rassemble les quatre familles **dans l'ordre de lecture** : par heure
  d'abord, par famille ensuite.
- Une occurrence d'habitude **n'est jamais en retard** et **ne se reporte
  jamais** ; le seuil de report vaut 2 et `replanifier()` remet à zéro.
- Les grilles de dates **traversent le changement d'heure** sans perdre ni
  doubler un jour, la semaine commence le **lundi**, la grille du mois fait
  **toujours** six semaines.
- Le profil de disponibilité **refuse d'apprendre** sous dix sessions, répartit
  une session à cheval sur toutes les heures traversées, ignore les pauses et
  les sessions en cours, et **apprend le week-end** si c'est là qu'on travaille.
- La capacité est la **médiane** des journées observées.
- La charge **ne suppose aucune durée** et ne compte pas les échéances.
- Une journée sans capacité **ne peut pas** être surchargée.
- Les objectifs en péril **disent quand la progression est déclarative**.
- La règle Rust se tait sur un rendez-vous déjà commencé, sur ce qui est encore
  loin, et **sur une base sans la migration 020**.

### À l'écran (mode démo, les deux langues)
Vues mois / semaine / jour, le bandeau d'intelligence, le widget du tableau de
bord, la modale d'événement, la note du jour, les créneaux proposés — **et le
glisser-déposer**, éprouvé de bout en bout : une tâche en retard déposée au
mercredi 07:30 a fait passer la charge de 2 h à 3 h et **fait disparaître son
alerte de report**, le compteur étant remis à zéro.

---

## 3. ⚠️ Ce qui n'est PAS prouvé

- ⚠️ **Rien n'a été vu sur iPhone ni sur le simulateur.** Seul
  `cargo check --target aarch64-apple-ios-sim` est passé : ça compile, ce n'est
  pas « ça marche ».
- ⚠️ ⭐ **Le rappel « événement imminent » n'est PAS ponctuel sur iOS, app
  fermée.** La règle n'a pas de paramètre `hour` : le planificateur ne la
  projette qu'à l'ouverture de la plage autorisée. Sur le bureau, le scheduler
  scrute chaque minute et le rappel est juste. **Ne pas écrire que les rappels
  du calendrier sont vérifiés sur iPhone.** Le rendre ponctuel demande un dépôt
  par événement — chemin qui n'existe pas encore. **C'est le premier vrai sujet
  du chantier D.**
- **Le geste au doigt n'a pas été essayé.** Il est écrit en `PointerEvent`
  précisément pour que ce soit possible, mais personne n'y a touché du doigt.
- **Aucun rebuild natif n'a été fait** (verrou `BUILD NATIF` jamais pris) :
  l'app installée d'Antonin est **toujours celle du 2026-08-28** et ne connaît
  ni la migration 020 ni ce module.
- **Le comportement avec un historique RÉEL de sessions** est inconnu : le
  profil a été éprouvé sur les données de démonstration et sur des jeux d'essai,
  jamais sur des mois de vraies sessions.

---

## 4. Où vit quoi

| Fichier | Rôle |
|---|---|
| `src/lib/calendrier/agenda.ts` | ce qui occupe une journée, les grilles de dates |
| `src/lib/calendrier/disponibilite.ts` | le profil appris, la capacité, les créneaux libres |
| `src/lib/calendrier/charge.ts` | la journée surchargée |
| `src/lib/calendrier/peril.ts` | les objectifs qui ne tiendront pas |
| `src/lib/logic.ts` | ⭐ `occurrenceLe()` — **le** moteur de récurrence, partagé |
| `src/views/CalendarView.tsx` | la vue, le bandeau, la vue mois, la note du jour |
| `src/components/calendrier/GrilleHoraire.tsx` | semaine et jour, le glisser-déposer |
| `src/components/calendrier/EventModal.tsx` | créer / modifier / supprimer un événement |
| `src/components/CalendarCard.tsx` | le widget « Calendrier du jour » |
| `src-tauri/src/notifications/rules/calendar.rs` | la règle de rappel |

---

## 5. ⚠️ Les deux tests rouges ne viennent toujours pas d'ici

`auth/activation.sql.test.ts`, sur l'essai gratuit. Ils échouaient **avant le
socle**, vérifié sur la branche intacte. Cause : le SQL du site a changé le
2026-08-31 sans que le test de l'app ne suive.
▶️ Décision attendue d'Antonin — `DETTE-SITE-CALENDRIER.md` § A.1.

---

## 6. Ce que le chantier D trouvera, et ce qui l'attend

- **La vue semaine ne tiendra pas sur un écran de 6 pouces.** Une vue **agenda**
  (liste chronologique) est le bon défaut mobile ; la vue jour reste pertinente.
- **Le geste est déjà en `PointerEvent`**, donc compatible doigt par
  construction — mais un appui long avant le glissement, et un retour haptique,
  restent à ajouter.
- **Les cibles tactiles du module n'ont pas été mesurées.** Les puces de la
  bande « sans heure » et les cartes de la grille sont **sous 44 pt**.
- **La règle de notification** : voir le § 3, c'est le vrai sujet.
- ⚠️ `GrilleHoraire` utilise `max-h-28` et un conteneur `max-h-[70vh]` **déjà
  multiplié par `--zoom-inv`** — ne pas ajouter de `vh` sans cette précaution.

---

## 7. Ce qu'Antonin peut constater lui-même

⚠️ **Rien pour l'instant dans l'app installée** : elle date du 2026-08-28. Ce
qui suit se verra après une reconstruction.

Dans la barre latérale, un nouvel onglet **Calendrier**, entre Tâches et Timer.
En l'ouvrant :

- en haut, **la semaine en cours** — c'est la vue par défaut, celle où la
  planification se décide. Trois boutons **Mois · Semaine · Jour** ;
- un **bandeau d'avertissements** quand il y a lieu : journée surchargée,
  objectif en péril, tâche trop souvent repoussée — avec ses trois boutons
  **La faire maintenant · Replanifier dans 7 jours · Supprimer** ;
- **une tâche se saisit et se pose sur une heure**, à la souris : elle se
  replante là où on la lâche, au quart d'heure près ;
- en vue **Jour**, sous la grille : **les créneaux libres proposés** (et, s'il
  n'y en a pas, la raison), **la charge de la journée**, et **la note de cette
  journée** — la même que celle du module Journal, mais pour n'importe quel jour ;
- sur **Aujourd'hui**, un widget **Calendrier** qui montre la journée en cours.

⚠️ **Ce que l'app avoue** : tant qu'elle n'a pas dix sessions de concentration,
elle écrit **« capacité par défaut »** au lieu de faire croire qu'elle a appris
tes heures. C'est voulu.
