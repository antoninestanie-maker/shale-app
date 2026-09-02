# Passation — chantier A, le socle de données

*2026-09-02. Écrit pour une session qui n'a aucun contexte, et pour les
chantiers B, C et D qui vont consommer ce socle.*

---

## 1. L'état

| | |
|---|---|
| Worktree | `~/Desktop/Shale-chantiers/socle` |
| Branche | `chantier/socle`, basée sur `origin/mobile-ios` (`21ff979`) |
| Migration | **`020_calendrier_liaisons.sql`** — enregistrée dans `lib.rs` **et** dans `sync/schema.testutil.ts` |
| Interface | **aucune**, volontairement. Ce chantier ne pose pas d'écran |
| Tests ajoutés | **58** (16 liaisons, 19 objets, 15 tâches, 8 synchronisation) |

### Ligne de base

```
npx tsc --noEmit                            ✅
npm run test:types                          ✅
npm run i18n:check                          ✅ 0 manquante, 0 doublon (1421 entrées)
npm run i18n:durs                           ✅ 0 chaîne sûrement française
npm test                                    ⚠️ 455 / 457 — voir § 4
npx vite build                              ✅
cargo check --all-targets                   ✅
cargo test --lib                            ✅ 113
cargo check --target aarch64-apple-ios-sim  ✅
```

---

## 2. Ce qui est PROUVÉ

Tout ce qui suit est tenu par un test qui échoue si on le défait.

- **Une arête traverse la synchronisation avec ses deux extrémités intactes**,
  et elle pointe bien vers les bonnes lignes sur le second appareil — dont les
  numéros locaux sont volontairement décalés dans le test, sans quoi il
  passerait même si les arêtes voyageaient avec des `id`.
- **TypeScript et le trigger SQL calculent le même uid d'arête.** S'ils
  divergeaient, la même mention tapée des deux côtés produirait deux lignes
  serveur pour un seul fait, qui se battraient sans converger.
- **La même mention tapée sur les deux appareils converge en une seule arête.**
- **Supprimer une note sur A retire le backlink sur B**, et l'arête ne
  ressuscite pas au cycle suivant.
- **Une arête arrivée avant sa cible est conservée**, pas perdue.
- **Retirer un champ d'un type ne détruit aucune valeur**, et la valeur
  réapparaît si le champ revient.
- **Le seuil de report vaut 2**, une tâche récurrente ne se reporte jamais, et
  replanifier remet le compteur à zéro.
- **Les quatre types livrés ont un uid dérivé de leur nom**, donc pas de
  doublons sur le second appareil ; ils restent supprimables, et leur
  suppression emporte objets et arêtes.
- **Une régression du moteur est verrouillée** : avec l'ancien tri des colonnes
  `_uid`, 7 des 8 tests de `sync/liens.test.ts` tombent. Vérifié en le remettant.

---

## 3. Ce qui n'est PAS prouvé — à ne pas lire comme conforme

- ⚠️ **Rien n'a été vu à l'écran.** Ce chantier ne pose aucune interface, et les
  58 tests ajoutés sont **tous de logique pure ou de schéma**. Il n'existe
  aucune infrastructure de test de rendu React dans ce dépôt.
- ⚠️ **La migration n'a JAMAIS tourné sur la vraie base d'Antonin.** Elle a
  tourné des centaines de fois sur des bases neuves en mémoire (`node:sqlite`),
  ce qui prouve qu'elle s'applique — pas qu'elle s'applique **par-dessus des
  années de données réelles**. Le premier lancement de l'app reconstruite est le
  vrai contrôle. ⭐ **Une sauvegarde avant ce lancement n'est pas du zèle.**
- **Le mode démo n'a pas été ouvert dans un navigateur.** Les fonctions existent
  et compilent ; personne n'a encore cliqué dessus.
- **Aucun rebuild natif n'a été fait** (verrou `BUILD NATIF` non pris). L'app
  installée d'Antonin est **toujours celle du 2026-08-28** et ne connaît pas ces
  tables.
- **Rien n'a été vu sur iOS.** Seul `cargo check --target aarch64-apple-ios-sim`
  est passé, ce qui prouve que ça compile, pas que ça marche.

---

## 4. ⚠️ Les deux tests rouges, qui ne viennent PAS de ce chantier

`src/lib/auth/activation.sql.test.ts` échoue sur deux cas d'essai gratuit.
**Vérifié en les rejouant sur la branche intacte** (`~/Desktop/Shale-projet/
Shale`, `21ff979`, arbre propre) : ils y échouent déjà, à l'identique.

La cause est une divergence **app ↔ site** : ce test lit le SQL du dépôt du
site, qui a changé le **2026-08-31** (Stripe LIVE, le paiement devient le mur),
sans que le test de l'app ne suive.

▶️ **La décision revient à Antonin** : l'essai gratuit de 7 jours existe-t-il
encore ? Détail complet dans `~/Desktop/Shale-chantiers/DETTE-SITE-CALENDRIER.md`
§ A.1. **B, C et D verront ces deux tests rouges — ce n'est pas eux.**

---

## 5. Ce que B et C trouveront prêt

### Schéma
`tasks` datable · `calendar_events` · `object_types` · `objects` ·
`object_links`. Toutes synchronisées, toutes avec leur uid, leurs triggers
d'identité et d'outbox, et leur ligne dans `TABLES_SYNC`.

### Logique pure, testée, sans base ni Tauri
| Fichier | Ce qu'il porte |
|---|---|
| `src/lib/taches.ts` | les deux familles, le retard, le report, le seuil |
| `src/lib/liens.ts` | familles d'objets, uid d'arête, normalisation, `diffMentions`, résolution, groupement des backlinks |
| `src/lib/objets.ts` | lecture tolérante des champs, identité des champs, validation, **conservation des valeurs orphelines** |

### Accès — **des deux côtés**, natif et démo
`uidDe` · `fetchCalendarEvents` / `fetchRecurringEvents` / `create` / `update` /
`deleteCalendarEvent` · `fetchDatedTasks` · `setTaskSchedule` ·
`appliquerReport` · `fetchObjectTypes` + CRUD · `fetchObjects` + CRUD ·
`fetchLinksFrom` / `fetchLinksTo` / `createLink` / `deleteLink` /
`synchroniserMentions`.

`TaskInput` a gagné `due_date`, `start_at`, `end_at`, **optionnels** : les écrans
qui existaient avant continuent d'appeler sans eux.

### Données de démo, pour que B et C puissent vérifier en preview
Trois événements (dont un récurrent), trois tâches datées — dont **une au seuil
de report** (`postponed_count: 2`), pour que l'écran de décision de B soit
visible sans attendre trois jours —, les quatre types livrés et deux objets, et
une arête manuelle.

### ⚠️ Pièges à connaître avant de commencer
1. **`~/Desktop/Shale-chantiers/shale-site` est un lien symbolique** vers le
   dépôt du site. Sans lui, deux suites de tests échouent **au chargement** dans
   un worktree posé hors de `~/Desktop/Shale-projet` : elles lisent le SQL du
   site par un chemin relatif qui sort du dépôt. **Ne pas le supprimer.**
2. **Ne jamais nommer une colonne de données `<mot>_uid`** sans relire
   `sync/local.ts` : le tri est désormais correct, mais la logique reste
   subtile.
3. **`field_values`, pas `values`** — `VALUES` est un mot-clé SQL.
4. **Un `t()` dans une constante de module fige la langue.** `demo.ts` en est
   plein depuis toujours (voir § 6) ; le nouveau code de démo suit la convention
   du fichier plutôt que d'en introduire une seconde.

---

## 6. Ce qui reste ouvert, et qui décide

| Sujet | Qui tranche |
|---|---|
| **L'essai gratuit existe-t-il encore ?** (§ 4) — deux tests rouges en dépendent | **Antonin** |
| **Où vivent les objets personnalisés** — décidé : **onglet du Savoir**, pas de 14ᵉ module | ✅ tranché le 2026-09-02 |
| **Seuil de report** — décidé : **2** | ✅ tranché |
| **Repli du profil de disponibilité** — décidé : **9h-18h, réglable** | ✅ tranché |
| **`demo.ts` fige sa langue au démarrage** : ~200 `t()` dans des constantes de module. Défaut réel, ancien, hors périmètre de ce chantier | **Antonin** |
| **Import d'un calendrier externe** (`.ics`) | écarté de ce périmètre |

---

## 7. Ce qu'Antonin peut constater lui-même

⚠️ **Pour l'instant : rien.** Et c'est normal — ce chantier ne pose aucun écran.
L'app installée est toujours celle du 2026-08-28 ; elle ne connaît même pas ces
tables.

Ce qui deviendra visible viendra du **chantier B** (le module Calendrier dans la
barre latérale) et du **chantier C** (les mentions `@` et l'onglet Objets dans
le Savoir).

⚠️ **Quand un rebuild natif aura lieu**, deux choses à savoir :
1. **macOS redemandera l'accès au trousseau** au premier lancement. Il faut
   cliquer **« Toujours autoriser »** et saisir le mot de passe de session.
   C'est normal — la signature ad hoc change à chaque reconstruction — mais sans
   le savoir, on découvre une fenêtre inexpliquée.
2. **La migration 020 s'appliquera à la vraie base à ce moment-là.** Elle
   n'ajoute que des colonnes et des tables, elle n'en retire aucune — mais une
   sauvegarde avant est la seule chose qui rende l'opération réversible.
