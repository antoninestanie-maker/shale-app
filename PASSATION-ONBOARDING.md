# Chantier « premier démarrage » — état au 2026-09-10

*L'accueil qui configure l'app, la grille de la semaine, et le contenu de
départ. Les DÉCISIONS et leur pourquoi sont dans la section datée du
2026-09-10 de `CLAUDE.md` ; ce document dit **où on en est**.*

---

## 1. L'état

| | |
|---|---|
| Worktree | `~/Desktop/Shale-chantiers/onboarding` |
| Branche | `onboarding-premiere-ouverture`, basée sur **`origin/mobile-ios` (`6b17f60`)** |
| Pourquoi pas le `mobile-ios` local | il porte 2 commits **non poussés** de la session voisine [K-facturation] (migration 023). Partir de l'origine évite d'emporter son travail en cours |
| Migration | **024** (`024_onboarding_exemples.sql`). ⛔ La **023 est à la facturation** — le trou dans `lib.rs` et `schema.testutil.ts` est ATTENDU sur cette branche et se referme à la fusion |
| Fusionné | **non** |
| Build natif | **non** — verrou jamais pris |
| Base d'Antonin | **intacte** : rien n'a tourné en `tauri dev`, la migration 024 n'a jamais été jouée sur la vraie base |

---

## 2. La ligne de base — rejouée en entier, verte

```
npx tsc --noEmit                              ✅
npm run test:types                            ✅
npm run i18n:check                            ✅ 0 manquante, 1669 entrées
npm run i18n:durs                             ✅ 0 chaîne sûrement française
npm test                                      ✅ **683 → 746 / 746** (51 fichiers)
npx vite build                                ✅
cd src-tauri
cargo check --all-targets                     ✅
cargo test --lib                              ✅ 133
cargo check --target aarch64-apple-ios-sim    ✅
cargo check --target aarch64-apple-ios        ✅
```

**Tests ajoutés par ce chantier : 63.** La ligne de base de `origin/mobile-ios`
était de **683**, mesurée sur cette branche avant la première ligne écrite.

| Fichier | Ce qu'il tient |
|---|---|
| `lib/onboarding/grille.test.ts` (19) | 168 cases, le sommeil qui franchit minuit, l'arrondi à l'occupé, les bornes du curseur, et l'**interdiction de nommer une fonction « heures perdues »** |
| `lib/onboarding/reglages.test.ts` (18) | les clés sont bien synchronisées, le skip reproduit l'ancien repli, la relecture tolérante champ par champ |
| `lib/onboarding/exemples.test.ts` (15) | le contenu, la mention qui se relit, l'absence d'heure et de durée dans l'habitude, et l'exclusion des compteurs |
| `lib/sync/exemples.test.ts` (9) | **les points 3 et 4 de la recette**, sur deux vraies bases SQLite |
| `lib/calendrier/disponibilite.test.ts` (+2) | les jours du repli sont réglables ; une liste vide ne propose rien |

---

## 3. La recette d'acceptation — ce qui est prouvé, et COMMENT

| # | Point | Statut | Preuve |
|---|---|---|---|
| 1 | Premier lancement sur appareil vierge | ✅ | à l'écran, mode démo : les 5 écrans, la grille cohérente (67 h libres par défaut, 62 h avec un trajet), l'objectif créé, l'atterrissage sur Tâches avec la tâche saisie |
| 2 | Skip complet | ✅ | à l'écran : app utilisable, `REGLAGES_PAR_DEFAUT` écrits, **aucun objectif créé**, contenu de départ semé. Un test vérifie que ces défauts sont EXACTEMENT l'ancien repli |
| 3 | Second appareil : pas de rejeu, pas de doublon | ⚠️ **mécanisme prouvé, trajet non** | `sync/exemples.test.ts` — deux vraies bases SQLite, vraie couche de chiffrement, réseau simulé. **Aucun second Mac, aucun iPhone** : le simulateur est déconnecté depuis le 2026-09-02 et seul Antonin peut le rouvrir |
| 4 | Suppression sur A → disparition sur B | ⚠️ **idem** | même fichier ; et vérifié à l'écran côté A |
| 5 | Rejeu depuis les Réglages | ✅ | à l'écran : le bouton écrase les 4 clés horaires et le drapeau, l'accueil se rejoue au démarrage suivant, **les données restent** |
| 6 | Statistiques et séries | ✅ | à l'écran (anneau à « 1/6 tâches » avec 7 tâches affichées, dont l'exemple) **et** par tests sur `dayStat`, `pctOfList`, `computeStreak`, `effectiveProgress` |
| 7 | Mobile | ✅ | 375 × 812 : grille **entière** (168 cases, 293 px de large), aucun débordement horizontal, parcours complet réalisable |

### ⚠️ Ce que la vérification à l'écran NE PEUT PAS couvrir

- **Le mode natif.** Tout a été vu en mode démo (`isTauri` faux). SQLite, le
  trousseau et la synchronisation réelle n'y sont pas — c'est le prix de ne pas
  piloter la vraie base d'Antonin (`PIEGES.md` § 8.4).
- **Le rendu en WKWebView** — voir ci-dessous.
- **Le rendu en WKWebView.** Rien n'a été vu sur le simulateur iOS.

### ⭐ La migration 024 EST vérifiée sur une COPIE de la vraie base d'Antonin

Jouée sur une copie de `shale-backups/avant-cote-branches-20260908-2111/shale.db`
(version 22, la plus récente). ⚠️ Une **copie**, jamais la base elle-même.

| | avant | après |
|---|---|---|
| notes | 13 | **13** |
| octets de corps de notes | 51 761 | **51 761** |
| tâches · habitudes | 2 · 3 | **2 · 3** |
| fiches · sujets | 6 · 4 | **6 · 4** |
| `integrity_check` | ok | **ok** |
| `foreign_key_check` | — | **0 violation** |
| lignes dans `sync_outbox` | 1 | **1** |

Et les cinq colonnes sont bien là, avec **zéro ligne existante marquée comme
exemple** (`is_example = 1` rend 0 partout) : aucune donnée d'Antonin n'est
prise pour du contenu de départ.

⚠️ L'`outbox` **ne bouge pas** : `ALTER TABLE ADD COLUMN` ne déclenche aucun
trigger de mise à jour. La migration ne renvoie donc pas les 13 notes d'Antonin
dans la file de synchronisation — c'était le risque à écarter, et il l'est.

---

## 4. Ce qui reste à faire

1. ⛔ **Fusionner** — après la fusion de [K-facturation], pour que les
   migrations 023 et 024 se rangent dans l'ordre. Rebaser, rejouer la ligne de
   base en entier, vérifier que `lib.rs` porte bien 23 **et** 24.
2. ⛔ **Build natif** — la migration 024 doit atteindre la machine d'Antonin.
   Le verrou est partagé : **un seul build pour la facturation et ce
   chantier**, sinon Antonin doit autoriser le trousseau deux fois. Sauvegarde
   `sqlite3 .backup` obligatoire avant, et la 024 jouée sur une COPIE d'abord.
3. **Le simulateur iOS**, quand Antonin le rouvre : la grille en WKWebView, et
   la synchronisation réelle du drapeau vers un second appareil.

---

## 5. Ce qui a été supprimé, et qu'il ne faut pas ressusciter

`src/components/auth/Onboarding.tsx` — les trois écrans de présentation. Ils ne
branchaient rien, ce que le cahier des charges interdit explicitement. Ses deux
textes éditables depuis « Personnaliser » (`onboardingTitle`,
`onboardingBody` d'`appTexts.ts`) sont **conservés** et affichés en tête du
premier écran du nouvel accueil : les retirer aurait cassé une fonction d'admin
en silence.

⚠️ Le corps par défaut a été **réécrit** : l'ancien annonçait « l'essentiel en
trois écrans », ce qui décrivait des écrans qui n'existent plus.

---

## 6. Où vit quoi

| | |
|---|---|
| Logique pure (grille, réglages, contenu) | `src/lib/onboarding/` — `grille.ts`, `reglages.ts`, `exemples.ts` |
| Écritures en base | `src/lib/onboarding/semer.ts` |
| Le moment où l'on tranche | `src/lib/onboarding/useAccueil.ts` |
| Écrans | `src/components/onboarding/` — `Accueil.tsx`, `GrilleSemaine.tsx`, `PorteAccueil.tsx`, `BadgeExemple.tsx`, `BarreExemples.tsx` |
| Le marqueur, côté données | `repo.ts` (fin de fichier) et `demo.ts` (fin de fichier) |
| Le filtre des statistiques | `lib/logic.ts` — `dayStat`, `pctOfList`, `effectiveProgress` |
| Le branchement calendrier | `lib/calendrier/disponibilite.ts` — `OptionsProfil.jours`, `REPLI_JOURS` |
