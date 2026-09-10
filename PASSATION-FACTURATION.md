# PASSATION — Facturation dans Finance (2026-09-10)

> **Ce document se suffit.** Il dit ce qui est livré, ce qui est **prouvé**, ce
> qui ne l'est pas, et ce qui reste. La thèse et les décisions sont dans
> `CLAUDE.md` (section « Facturation dans Finance ») ; les erreurs rencontrées
> dans `PIEGES.md` § 9.15 à 9.21.

---

## 1. État en une phrase

**Le chantier est livré et commité en six commits atomiques sur `mobile-ios`.**
Le pipeline complet est vert. **Rien n'a encore tourné sur la vraie base
d'Antonin** : la migration 023 est enregistrée, elle jouera au prochain build
natif.

## 2. Ce qui est livré

| Phase | Contenu | Commit |
|---|---|---|
| A | Migration 023, six tables, scope/fk/schéma de test | `266af98` |
| B | Logique pure : totaux, numérotation, collisions, statuts, créances, change | `a3e68ff` |
| C | Solde composé, second runway, projection, déclaré vs encaissé | `8a11566` |
| — | Accès aux données, mode démo, exposition par `useFinance` | `8095adc` |
| D | Section dans `FinanceView` : trois panneaux, quatre modales | `b44f253` |
| E | PDF + XML Factur-X (`pdf-lib`) | `1fa226f` |
| F·G·H | Devis → facture, relances au calendrier, export comptable | `1149e70` |

**Le compte de modules reste à TREIZE.** `Sidebar.tsx` n'est pas touché.

## 3. Ligne de base — à rejouer telle quelle

```
npx tsc --noEmit          ✓
npm run test:types        ✓
npm run build             ✓
npm test                  ✓  949 tests, 62 fichiers
npm run i18n:check        ✓  0 clé manquante, 1783 entrées
cargo check               ✓  (dans src-tauri/)
```

⚠️ La fragilité connue de `auth/admin.sql.test.ts` et `activation.sql.test.ts`
(PGlite, § 9.11 de `PIEGES.md`) **ne s'est pas manifestée** sur les exécutions de
ce chantier. Elle est antérieure ; elle n'a pas été « réparée ».

## 4. ⭐ Ce qui est PROUVÉ, et par quoi

- **La règle du solde composé** — un test rejoue la séquence complète (relevé →
  encaissement → nouveau relevé), plus les deux bornes : un mouvement daté le
  jour même du relevé est absorbé, un compte jamais relevé reste `null`.
- **Le trou qu'une division masquerait** — un test place l'épuisement en octobre
  pour un paiement en décembre. Une division répondrait « 6 mois ».
- **La TVA s'arrondit par taux** — dix lignes à 10,01 € donnent 20,02 € et non
  20,00 €.
- **Le runway prudent n'a pas changé** — `git diff` sur `runway.ts`, `burn.ts`,
  `pont-trading.ts`, `montants.ts` : **zéro ligne**.
- **Le XML est bien dans le PDF** — lu dans le **catalogue**, pas cherché dans
  les octets (§ 9.18).
- **La démo est cohérente** — 19 tests : totaux qui correspondent aux lignes,
  aucune collision, aucun compteur en retard, le solde composé monte, les deux
  runways sont calculables et différents.
- **L'interface, à l'écran** — en français ET en anglais, en mode démo : les
  deux runways, les encours, la liste et ses filtres, le formulaire, l'écran de
  confirmation d'émission, l'aperçu PDF, « Déjà facturé : F-2026-0005 ».

## 5. ⚠️ Ce qui n'est PAS prouvé — à lire avant d'annoncer quoi que ce soit

1. **La migration 023 n'a pas tourné sur la vraie base.** Elle est validée à
   blanc (les 23 migrations jouent d'affilée sur une base neuve, uid dérivés
   corrects, cascades vérifiées, aucun `REAL`), mais la base d'Antonin est
   toujours en **version 22**. ⛔ **Prendre une sauvegarde `sqlite3 .backup`
   avant le prochain build** — jamais un `cp`, la base est en WAL — et rejouer
   la migration sur une COPIE d'abord.
2. **L'app installée ne contient rien de ce chantier.** Tout a été vérifié en
   **preview navigateur** (mode démo). Le chemin d'écriture natif
   (`plugin-sql` / SQLite) n'a pas été exercé.
3. **Le PDF n'a pas été ouvert par un lecteur tiers.** Il est valide et
   relisible par pdf-lib ; personne ne l'a ouvert dans Aperçu, Acrobat, ni
   soumis à un **validateur Factur-X**. C'est le contrôle qui manque le plus.
4. **Aucun test de rendu React** — le dépôt n'en a aucun (29 fichiers de test,
   tous de logique pure). Les composants de ce chantier n'en ont donc pas.
5. **Rien n'a été vérifié au doigt.** Les cibles tactiles portent
   `.cible-tactile-ligne`, mais l'ergonomie iPhone de la section n'a pas été
   regardée.
6. **La synchronisation des six tables n'a pas été jouée à deux appareils.**
   Les garde-fous automatiques passent (`scope`, `fk` contre le `PRAGMA` réel),
   mais aucun test du banc à deux appareils ne cible `invoices` — contrairement
   à ce qui avait été fait pour `calendar_events` le 2026-09-06. **C'est le
   premier chantier à reprendre** : le § 2 de `PIEGES.md` dit que cette classe
   de défaut ne se voit pas sur l'appareil où l'on développe.

## 6. Ce qui a été volontairement laissé de côté

- **La fiche client** (encours, historique, délai de paiement moyen) : la
  logique existe et est testée (`delaiPaiementMoyen`), l'écran n'existe pas.
  `FacturesPanel` filtre déjà par client, ce qui couvre l'essentiel.
- **La gestion des tiers et des séries à l'écran** : les accès existent des deux
  côtés (`createInvoiceParty`, `updateInvoiceSeries`…), aucun formulaire ne les
  appelle. Les quatre tiers et trois séries de la démo suffisent à vérifier le
  reste ; sur la vraie base, la migration livre deux séries et **aucun tiers** —
  donc **un client ne peut pas encore être créé depuis l'interface**. C'est le
  manque le plus visible pour un premier usage réel.
- **L'écran de l'émetteur** (identité, logo, régime) : `updateInvoiceIssuer`
  existe et est testé, l'écran n'existe pas. La ligne est créée vide par la
  migration, donc `manquesLegaux()` criera tant qu'elle n'est pas remplie —
  c'est le comportement voulu, mais il faut un endroit pour la remplir.
- **Le multi-devise à la saisie** : `change.ts` est complet et testé, mais le
  formulaire n'expose ni le choix de devise ni le taux. Tout est en devise du
  module.
- **La remise en pourcentage** : la remise est en valeur (centimes). Un
  pourcentage se traduit à la saisie, et il faudrait décider s'il porte sur la
  ligne ou sur la facture — deux réponses défendables, donc une décision
  d'Antonin.
- **Le recalage d'un compteur de série** : l'alerte le signale, le geste de
  correction n'existe pas (il faudrait passer par un formulaire de série).

## 7. ⚠️ Trois écarts assumés avec le cadrage — et leur raison

1. **Migration 023, pas 022.** La 022 (`fusion_sujets`) était prise depuis le
   2026-09-07.
2. **`_id` + `fk.ts` au lieu de `_uid` en dur.** Le stockage direct d'uid est
   réservé au polymorphe (`object_links`, 020 § 5), où aucun `vers` n'est
   déclarable. Ici chaque colonne pointe une table fixe.
3. **Les relances passent par `agenda.ts`, pas par `object_links`.** Son `CHECK`
   est une liste fermée, et SQLite ne sait pas modifier un CHECK : y ajouter
   `'invoice'` imposerait de recréer la table d'arêtes. Le vrai socle
   réutilisable du calendrier n'a jamais été la table d'arêtes.

Les trois ont été soumis à Antonin en phase 0 et validés.

## 8. Qui décide quoi

- **Antonin** : la mise en page du PDF (deux exemplaires envoyés), les colonnes
  de l'export CSV (trois fichiers envoyés), la remise en pourcentage, et le
  moment du build natif.
- **La session suivante** : le test de synchronisation à deux appareils (§ 5.6),
  puis les écrans manquants du § 6 — **l'émetteur et les tiers d'abord**, sans
  quoi la section n'est pas utilisable sur une vraie base.

## 9. Coordination

Une ligne a été inscrite dans `~/Desktop/Shale-chantiers/COORDINATION.md` le
2026-09-09 pour avertir les sessions voisines que **la 023 est désormais
enregistrée** — donc que le prochain build natif, quel qu'il soit, la jouera.
Le verrou **BUILD NATIF** n'a **pas** été pris par ce chantier.
