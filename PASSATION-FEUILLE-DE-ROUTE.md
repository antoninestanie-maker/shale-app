# Passation — chantier « feuille de route des objectifs »

*Ouvert le 2026-09-14. Mis à jour le 2026-09-15, à l'ARRÊT N°2 bis (phase C montrée, en attente de validation).*
*Cadrage : `~/Desktop/Prompt en attente/prompt/PROMPT-FEUILLE-DE-ROUTE.md`. Audit : `~/Desktop/Shale-chantiers/RAPPORT-PHASE0-FEUILLE-DE-ROUTE.md`.*

---

## 1. L'état

| | |
|---|---|
| Branche | `chantier/feuille-de-route`, dans le dossier principal `~/Desktop/Shale-projet/Shale` |
| Base de départ | `mobile-ios` @ `f48d037` |
| Commits | `481b9d0` phase A · `4fb57ff` phase B · `2fd5349` phase C |
| Migration | **026** `feuille_de_route` — enregistrée dans `lib.rs` et `schema.testutil.ts`. **Jamais jouée sur la vraie base** : aucun build natif n'a été fait |
| Poussé | **non** |
| Tests | vitest **1128 → 1191** · cargo test 133 (inchangé) · i18n 0 manquante (1929 entrées) |
| ⛔ Prochaine étape | **ARRÊT N°2 bis** : Antonin valide la démonstration de la phase C avant la phase D |

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

- **D — rattacher** les notes, fiches et événements par `object_links` (le champ ne
  cherche aujourd'hui que des tâches ; `mesurer()` sait déjà lire les arêtes). Charger
  les arêtes des objectifs et les événements cités : ils ne sont pas dans `AppData`.
- **E — cibles** : fait pour l'essentiel en phase C (cible, unité, source, compte lu).
  Reste à vérifier les sources tâche/habitude à l'écran.
- **F — intégrations.**
  ⚠️ **`peril.ts` saute tout objectif à 100 %** : un objectif à étapes vides (100 %
  mais pas achevé) échappe donc aux alertes. Utiliser `estAcheve()`.
  ⚠️ Libérer le mot « jalon » dans `peril.ts` et ses deux clés `en.ts`.
  Vérifier le plafond `MAX_ALERTES` avec six jalons datés.
- **G — iPhone.** Rien ne déborde à 390 px et les actions sont visibles au doigt, mais
  **la ligne d'étape se replie mal** : poignée et chevron restent seuls sur une ligne.
  Le réordonnancement au doigt n'a pas été essayé.
- **H — accueil** : ⛔ arrêt n°3, maquette à faire valider.
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
