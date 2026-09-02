# Passation — chantier D, la parité iPhone

*2026-09-02. Quatrième et dernier chantier de la série.*

---

## 1. L'état

| | |
|---|---|
| Worktree | `~/Desktop/Shale-chantiers/ios` |
| Branche | `chantier/ios`, sur `origin/mobile-ios` après B et C |
| Tests ajoutés | **7** en Rust (ponctualité du rappel de calendrier) |
| ⚠️ « iPhone » ci-dessous | **= LE SIMULATEUR** (iPhone 17, iOS 26.5). Rien n'a été vu sur l'appareil réel |

---

## 2. Ce que ce chantier a réglé

### 2.1 ⭐ Le rappel « événement imminent » est ponctuel — c'était LE sujet
La passation du chantier B le signalait comme sa principale limite. `calendar_soon`
n'a pas de paramètre `hour` et ne peut pas en avoir ; elle était donc sondée à la
seule ouverture de la plage autorisée, ce qui suffit sur le bureau (scrutation
chaque minute) mais **jamais sur iOS app fermée**.

`instants_du_calendrier()` ajoute maintenant, pour chaque élément daté à venir,
l'instant `début − avant_min` aux instants sondés. **Aucune règle n'a été
réécrite** — c'est exactement la méthode du § 13.5 de `MOBILE.md`.

**Prouvé par sept tests**, dont un de bout en bout : un rendez-vous de 14 h
produit une échéance déposée **à 13 h**.

### 2.2 La vue agenda remplace mois et semaine sur téléphone
Sept colonnes sur six pouces font moins de cinquante points chacune. Mois et
Semaine sont **retirées du menu** sur téléphone — pas rétrécies. À la place, une
liste chronologique sur trente jours, qui est le défaut mobile ; la semaine reste
le défaut du bureau.

### 2.3 Le glisser-déposer accepte le doigt
Appui long de 400 ms avant l'armement, parce qu'au doigt le geste de glissement
est aussi celui du défilement. Un mouvement avant l'échéance annule. Le blocage
du défilement (`touch-action: none`) n'est posé **qu'à l'armement**.

### 2.4 Le sélecteur `@` tient au-dessus du clavier
⚠️ Ouvrir le clavier ne change pas `innerHeight` sur iPhone. Le sélecteur se
place désormais d'après `visualViewport`, seule mesure qui déduise le clavier.

### 2.5 Dix-neuf cibles tactiles passées à 44 pt
Via `.cible-tactile` / `.cible-tactile-ligne`, **sous `pointer: coarse`
uniquement** : la densité du bureau est un choix, pas un oubli.

---

## 3. ⚠️ Ce qui n'est PAS prouvé, et ce qui ne peut pas l'être ici

- ⚠️ **RIEN N'A ÉTÉ VU SUR L'IPHONE RÉEL.** Tout ce qui suit vaut pour le
  **simulateur**. Ne jamais écrire « vu sur ton iPhone ».
- ⚠️ **Le geste au doigt n'est pas réellement vérifiable avec cet outillage.**
  L'injection tactile du simulateur produit des événements pointeur, mais elle
  ne reproduit ni l'inertie, ni la paume, ni la latence d'un vrai doigt.
  **L'appui long et le retour haptique n'ont donc PAS été éprouvés à la main.**
- ⚠️ **Le défilement en PAYSAGE reste non pilotable** (l'injection tactile reste
  dans le repère portrait, `MOBILE.md`). Rien n'a été vérifié dans cette
  orientation.
- ⚠️ **Le clavier logiciel n'a pas été ouvert** dans un champ de mention sur le
  simulateur : le correctif `visualViewport` est raisonné et documenté, il n'est
  pas mesuré.
- ⚠️ **Le dépôt réel d'une notification de calendrier sur iOS n'a pas été
  observé.** Les sept tests prouvent que le PLAN contient la bonne échéance à la
  bonne heure ; ils ne prouvent pas qu'iOS l'a acceptée. Le seul moyen de le
  vérifier est de lire
  `<appareil>/data/Library/UserNotifications/<uuid>/PendingNotifications.plist`,
  comme l'a fait le § 13.6 de `MOBILE.md`.
- **Les 62 cibles tactiles anciennes** (`AMELIORATIONS-UI.md` § 8) restent
  entières : ce chantier n'a traité que celles qu'il a créées.

---

## 4. ⚠️ La session du simulateur — une observation qui contredit la doc

**Elle était active avant ce chantier**, contrairement à ce qu'annonçait
`PASSATION.md` (« toujours perdue » depuis le 2026-08-28).

⭐ **Et elle a SURVÉCU à la réinstallation.** Après `simctl install` puis
`launch`, l'app s'est ouverte directement sur le tableau de bord, sans écran de
connexion, et l'entrée **Admin** — réservée au compte propriétaire — était
présente dans le tiroir. Le § 5.1 de `PASSATION.md` et le § D.4 du cahier des
charges annonçaient l'inverse.

⚠️ **Une observation n'est pas une règle.** Je n'ai vu ce comportement qu'une
fois, sur iOS 26.5, avec un `simctl install` par-dessus une app de même
identifiant. Ce n'est **pas** une raison de retirer l'avertissement des
documents : le coût d'une session perdue reste élevé, et la prudence
(« faire l'audit visuel AVANT de reconstruire ») reste la bonne conduite. La
note est ajoutée à côté de la règle, elle ne la remplace pas.

### ⭐ Ce que la réinstallation a prouvé au passage
La base du simulateur (13 notes, 2 tâches — de vraies données synchronisées) a
survécu, **et la migration 020 s'y est appliquée** : `calendar_events` existe et
`object_types` contient bien ses quatre types livrés.

C'est la première fois que cette migration tourne **sur une base non vide et
réelle**, ce que la passation du chantier A donnait explicitement comme non
prouvé. ⚠️ Cela vaut pour la base du SIMULATEUR ; la base macOS d'Antonin n'a
toujours pas été migrée, faute de reconstruction native.

---

## 5. Ce qui a été VU à l'écran, sur le simulateur

Tout ce qui suit a été constaté, pas déduit :

- le module **Calendrier** apparaît dans le tiroir « Plus », entre Tâches et
  Timer, avec son icône ;
- en l'ouvrant : **Agenda** et **Jour** seulement — mois et semaine sont bien
  absentes, et l'agenda est sélectionné par défaut ;
- l'état vide dit « Rien de prévu sur les 30 prochains jours » ;
- la vue **Jour** affiche sa grille horaire, sa bande « sans heure » et le jour
  courant en pastille bleue ;
- **Savoir** porte ses deux onglets **Fiches** / **Objets** ;
- l'onglet **Objets** montre les quatre types livrés — Personne, Ressource,
  Projet, Setup de trading — chacun à zéro fiche, plus le bouton **+ Type**.

⚠️ **Un défaut trouvé là, et corrigé** : l'en-tête de la vue agenda affichait le
titre de la SEMAINE (« 31 Août – 6 Sept. ») pour une vue qui couvre trente
jours.

## 6. Ce qu'Antonin peut constater lui-même

⚠️ **Sur le simulateur uniquement.** Son application macOS installée date
toujours du **2026-08-28** : aucun de ces quatre chantiers n'y est, et sa base
macOS n'a pas encore reçu la migration 020.

Dans l'onglet **Plus** de la barre du bas, **Calendrier** apparaît entre Tâches
et Timer. En l'ouvrant sur téléphone : **Agenda** et **Jour** seulement — la vue
mois n'a pas de sens sur cette largeur.

Dans **Savoir**, deux onglets : **Fiches** et **Objets**.
