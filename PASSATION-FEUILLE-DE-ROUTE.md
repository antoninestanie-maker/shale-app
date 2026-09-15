# Passation — chantier « feuille de route des objectifs »

*Ouvert le 2026-09-14. Mis à jour le 2026-09-15 : arrêt n°2 bis validé (« on enchaîne »), phases D à G livrées ; ⛔ ARRÊT N°3 (maquette de l'accueil proposée, en attente).*
*Cadrage : `~/Desktop/Prompt en attente/prompt/PROMPT-FEUILLE-DE-ROUTE.md`. Audit : `~/Desktop/Shale-chantiers/RAPPORT-PHASE0-FEUILLE-DE-ROUTE.md`.*

---

## 1. L'état

| | |
|---|---|
| Branche | `chantier/feuille-de-route`, dans le dossier principal `~/Desktop/Shale-projet/Shale` |
| Base de départ | `mobile-ios` @ `f48d037` |
| Commits | `481b9d0` phase A · `4fb57ff` phase B · `2fd5349` phase C · `cd6f0e5` phase D · `6f5f433` phases E+F · `db3cca0` phase G |
| Migration | **026** `feuille_de_route` — enregistrée dans `lib.rs` et `schema.testutil.ts`. **Jamais jouée sur la vraie base** : aucun build natif n'a été fait |
| Poussé | **non** |
| Tests | vitest **1128 → 1197** · cargo test 133 (inchangé) · i18n 0 manquante (1936 entrées) |
| ⛔ Prochaine étape | **ARRÊT N°3** : Antonin choisit entre les options de la maquette d'accueil (§ 5, phase H) |

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
- ⛔ **H — accueil** : maquette proposée le 2026-09-15, en attente. En résumé :
  un écran « Et ces heures, pour quoi faire ? » après le curseur (un objectif +
  jusqu'à trois jalons TAPÉS, jamais suggérés : les gabarits sont hors chantier), puis
  la première tâche rattachée au premier jalon. Question ouverte : l'objectif planté
  REMPLACE-t-il celui du curseur (recommandé : oui, si l'écran est rempli ; le chiffre
  du curseur passe dans sa description) ou S'AJOUTE-t-il ?
- **I — clôture** : site (`modules.ts:197-206`), section datée de `CLAUDE.md`,
  `SHALE.md`, build natif + réinstallation (la migration 026 l'impose).

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
