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

## 4. ⚠️ La session du simulateur

**Elle était ACTIVE avant ce chantier** — contrairement à ce qu'annonçait
`PASSATION.md`, qui la donnait perdue depuis le 2026-08-28. Quelqu'un l'a
rouverte entre-temps.

⚠️ **La réinstallation l'a donc fait perdre** : `simctl install` préserve
`shale.db` mais pas le trousseau, donc pas le `refresh_token` (§ 5.1 de
`PASSATION.md`). **Seul un geste humain d'Antonin la rouvre** — une session
Claude ne saisit pas d'identifiants.

C'était le prix inévitable du chantier : sans reconstruction, aucune des
fonctionnalités des chantiers A, B et C n'existe sur le simulateur, et il n'y a
rien à vérifier.

---

## 5. Ce qu'Antonin peut constater lui-même

⚠️ **Sur le simulateur uniquement.** Son application macOS installée date
toujours du **2026-08-28** : aucun de ces quatre chantiers n'y est.

Pour rouvrir la session du simulateur : l'app s'ouvre sur l'écran de connexion,
il faut y saisir son adresse et son mot de passe une fois. Les reconstructions
suivantes n'y toucheront plus tant qu'on ne réinstalle pas.

Ensuite, dans l'onglet **Plus** de la barre du bas, **Calendrier** apparaît entre
Tâches et Timer. En l'ouvrant sur téléphone : **Agenda** et **Jour** seulement —
la vue mois n'a pas de sens sur cette largeur.
