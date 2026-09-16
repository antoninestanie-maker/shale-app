# Passation — chantier « feuille de route des objectifs »

*Ouvert le 2026-09-14. Mis à jour le 2026-09-15 : arrêt n°2 bis validé (« on enchaîne »), toutes les phases livrées, fusionné sur `mobile-ios`, build natif en cours.*
*Cadrage : `~/Desktop/Prompt en attente/prompt/PROMPT-FEUILLE-DE-ROUTE.md`. Audit : `~/Desktop/Shale-chantiers/RAPPORT-PHASE0-FEUILLE-DE-ROUTE.md`.*

---

## 1. L'état

| | |
|---|---|
| Branche | **fusionné sur `mobile-ios`** (avance rapide) le 2026-09-16 ; `chantier/feuille-de-route` pointe au même endroit |
| Base de départ | `mobile-ios` @ `f48d037` |
| Commits | `481b9d0` phase A · `4fb57ff` phase B · `2fd5349` phase C · `cd6f0e5` phase D · `6f5f433` phases E+F · `db3cca0` phase G · `552b2dd` phase H · `d57ebc8` documentation |
| Migration | **026** `feuille_de_route` — enregistrée dans `lib.rs` et `schema.testutil.ts`. **Jamais jouée sur la vraie base** : aucun build natif n'a été fait |
| Poussé | **non** |
| Tests | vitest **1128 → 1206** · cargo test 133 (inchangé) · i18n 0 manquante (1946 entrées) |
| ▶️ Prochaine étape | vérifier l'app installée après le build (§ 7), puis pousser |

⚠️ **Une session voisine travaille dans le même dossier** : le 2026-09-15, `CLAUDE.md`
y portait une modification non commitée (adresse `www.shaleapp.com`) qui n'est pas
de ce chantier. Ne jamais faire `git add -A` ici ; ajouter ses fichiers par nom.

---

## 2. Les décisions d'Antonin (2026-09-14, « ok pour tout »)

1. Migration **026**, la 025 étant prise par les profils de licence.
2. **Le manuel reste souverain** : `manual_progress = 1` rend le % saisi, feuille de
   route ou pas. Un objectif manuel qui a des étapes le dit et propose « Mesurer depuis
   la feuille de route ». Les objectifs NEUFS naissent mesurés (`GoalModal`). Aucun
   chiffre existant ne bouge sans un geste.
3. `count_since` borne le compte « depuis le rattachement ».
4. `is_example` ajouté à `goals` (option retenue d'office : elle laisse la phase H libre).
5. Le mot « jalon » sera libéré dans les alertes du calendrier (phase F).

---

## 3. Ce qui est fait, et où

| Phase | Fichiers | Ce qui compte |
|---|---|---|
| A | `026_feuille_de_route.sql`, `types.ts`, `repo.ts`, `demo.ts` | dix colonnes, zéro table, zéro CHECK ; `majFeuilleDeRoute` (liste fermée de colonnes, repose `count_since`), `reordonnerObjectifs`, `rattacherTache` ; test de sync à deux appareils |
| B | `lib/objectifs/progression.ts`, `structure.ts`, `logic.ts` | `mesurer()` rend le chiffre ET son origine ; `effectiveProgress` délègue ; règle des trois niveaux à la saisie seulement ; mutation-testé |
| D | `lib/objectifs/contexte.ts`, `repo.ts` (`fetchContexteObjectifs`), `RattacherElement.tsx` | notes, fiches et événements se rattachent par une arête `object_links` d'origine `manual` ; le champ cherche ces quatre familles ; une ressource s'ouvre d'un clic et son panneau « Mentionné dans » cite l'étape |
| C | `components/objectifs/FeuilleDeRoute.tsx`, `RattacherElement.tsx`, `lib/objectifs/libelles.ts`, `GoalsView.tsx`, `GoalModal.tsx` | la vue ; libellés et repliement purs et testés |

**Constat des chiffres (phase B).** La vraie base contient 2 objectifs, manuels, sans
étape : **aucun chiffre ne change**. En démo, le seul objectif mesuré reste à 50 %.

---

## 4. ⛔ L'arrêt n°2 bis — ce qui a été montré

Mesuré dans Chrome piloté par puppeteer, en mode démo (§ 5.3 de `PASSATION.md`),
scripts dans le dossier scratchpad de la session du 2026-09-15.

1. **Gestes.** Objectif simple : 1 clic + le titre + Entrée — **identique à avant**.
   Trois jalons : +1 clic, +4 touches. Deux tâches existantes rattachées et une
   créée : +1 clic, +3 touches. Total : **3 clics, 8 touches** pour l'ensemble.
2. **Utilisateur existant.** Ses objectifs gardent leur chiffre. Un manuel à étapes
   affiche le bandeau « la feuille de route n'est pas lue ». Les jalons se découvrent
   par « + Ajouter une étape » et le « + » de la ligne.
3. **Six jalons dont quatre finis.** Quatre lignes « Terminé », le jalon en cours
   déplié, le dernier replié. L'objectif affiche 100 % mais **n'est pas marqué
   terminé** (deux jalons vides).
4. **Objectif de l'accueil.** « saisi à la main · 0 % », lisible à côté des autres.

Captures envoyées à Antonin le 2026-09-15.

---

## 5. Ce qui reste — à reprendre dans cet ordre

- ✅ **D — rattacher** : fait le 2026-09-15. Vu dans Chrome en démo : deux événements
  (un passé, un futur) → « 1/2 éléments » ; une note et une fiche → listées, ne
  comptent pas ; déjà rattaché → plus proposé ; clic sur la note → Notes, qui cite
  l'étape dans « Mentionné dans ».
  ⚠️ **Décision de conception prise en chemin** : toucher une étape ouverte D'OFFICE
  fige son ouverture. Sans ça, rattacher l'élément qui la termine la repliait sous les
  doigts, champ de saisie compris. Le repliement automatique ne vaut qu'à l'ouverture
  de la vue.
  ⚠️ **Non vérifié** : le rendu natif (les arêtes voyagent déjà par la sync, testé
  depuis le chantier Liaisons, mais pas vu entre deux vrais appareils).
- ✅ **E — cibles** : construit en phase C, vérifié à l'écran le 2026-09-15 sans code
  nouveau. L'habitude « Méditation » (trois mois de coches en démo) rend
  « 1 compté depuis le 15 septembre » ; source tâche ou habitude → plus aucun bouton
  +/−, le compte est LU.
- ✅ **F — intégrations** (2026-09-15) :
  - `peril.ts` mesure par `mesurer()` et saute un objectif ACHEVÉ, plus « à 100 % » ;
    un pourcentage gonflé par des étapes vides ne rassure plus (`rythme-insuffisant`) ;
  - `jalonsRestants` → `etapesRestantes`, texte « {n} étapes ou tâches restantes. »
    (l'ancien disait « jalons » en comptant aussi des tâches) ;
  - un jalon daté entre dans le péril et l'alerte nomme son objectif
    (« (étape de « Passer prop firm ») ») ;
  - carte Objectifs d'Aujourd'hui : « en cours » = pas achevé ;
  - `snapshotGoals` enregistre déjà la progression dérivée (phase B) ;
  - Rust inchangé : `data.rs` ne lit que `title, deadline`, un jalon daté y entre seul.
  ⚠️ **Plafond `MAX_ALERTES`** : prouvé par le code (`peril.slice(0, 2)` puis
  « + n autres »), pas vu à l'écran avec six jalons datés.
  ⚠️ **Question pour Antonin, non tranchée** : un objectif en péril ET ses jalons en
  péril font plusieurs alertes ; le plafond les tient à deux lignes, mais on pourrait
  n'afficher que le plus précis.
- ✅ **G — iPhone** (2026-09-15) : voir `MOBILE.md` § 22. Émulation Chrome seulement.
- ✅ **H — accueil** (2026-09-16, « fais comme tu le sens ») : un écran après le
  curseur, « Et ces {n} h, pour quoi faire ? », un titre + trois étapes TAPÉES au
  plus. L'objectif planté REMPLACE celui du curseur quand l'écran est rempli ; le
  chiffre du curseur devient sa description. Aucun jalon suggéré (les gabarits sont
  hors chantier), donc `is_example` reste à 0 partout. Les interdits sont tenus par
  `lib/onboarding/planification.ts` et ses tests. Trois chemins vus à l'écran.
- ✅ **I — clôture** (2026-09-16) : site à jour (dépôt site, commit « Objectifs : le
  site décrit la feuille de route »), section datée de `CLAUDE.md`, `SHALE.md` § 10 bis,
  `DETTE-SITE.md` § M, `PIEGES.md` § 14, `MOBILE.md` § 22, `PASSATION.md`.
  ⚠️ **Reste la capture du site** (`shots/v2/dark-objectifs.webp`), périmée : aucun
  générateur n'existe pour cette famille.

---

## 6. Ligne de base à rejouer

```
npx tsc --noEmit
npm run test:types
npm test
npm run build
npm run i18n:check
cd src-tauri && cargo check --lib --tests --bins && cargo test --lib
```

⚠️ Restaurer le mode démo avant : `grep -r AUDIT-TEMP src/` doit rendre zéro.

---

## 7. Le build natif du 2026-09-16 — la migration 026 sur la vraie base

**Sauvegarde AVANT**, par `sqlite3 .backup` (jamais `cp` : la base est en WAL) :
`shale-backups/avant-migration-026-20260916-1037/` — intégrité `ok`, base en
version **25**, 2 objectifs, 2 tâches, 13 notes.

**Chaîne d'horodatage** : commit `d57ebc8` 10:37:18 → `dist/assets` 10:38:01 →
binaire 10:38:54. Arbre propre au moment de la copie (seule la passation, un
document, restait à écrire).

**Témoins dans le front construit** (des CHAÎNES, jamais des noms de fonction —
PIEGES § 7.5 bis) : « Mesurer depuis la feuille de route » 2, « jalon vide, non
compté » 2, « Ses grandes étapes (facultatif) » 1, « étapes ou tâches
restantes » 2. Côté Rust, `strings` trouve `feuille_de_route` dans le binaire :
la migration 026 y est embarquée. ⚠️ Les chaînes du front NE se trouvent PAS dans
le binaire (les assets y sont compressés) : c'est `dist/assets` qui fait foi.

**Empreintes** : installée avant `f3dc06ac252f8148` → neuve `235cb492ac549e57`,
et l'installée APRÈS `ditto` vaut `235cb492ac549e57`. Une seule `Shale.app`
lançable (`/Applications`), aucune image disque restée montée, bundles de sortie
supprimés.

**Après relance** : base en version **26**, `integrity_check` **ok**,
`foreign_key_check` **0 violation**, `sync_outbox` **vide**. Données identiques à
la sauvegarde : 2 objectifs, 2 tâches, 13 notes, 6 fiches. Les deux objectifs
gardent leur `progress_pct` (0 et 50) et leur `manual_progress = 1` — **aucun
chiffre n'a bougé**, ce qui était la décision n° 2.

⚠️ **Antonin devra cliquer « Toujours autoriser » dans la fenêtre du trousseau** :
le binaire change, donc macOS redemande l'accès à `com.atnfx.shale`. Aucune
session ne peut le faire à sa place.
