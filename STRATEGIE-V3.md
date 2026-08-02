# Shale — Stratégie V3 : offres, sync & mobile

_Rédigé le 2026-08-02. Décisions prises avec Antonin. Ce document fixe le cap
commercial et technique de la prochaine grande étape : passer de l'app desktop
mono-poste à une suite multi-plateformes synchronisée, avec deux offres claires._

---

## 1. Offres & pricing

Deux tiers assumés. Essai gratuit 7 jours conservé sur les deux (socle déjà en
place, cf. `subscriptions.trial_ends_at` + vue `my_subscription`).

| Offre | Prix mensuel | Prix annuel (~2 mois offerts) | Contenu |
|---|---|---|---|
| **Shale** (productivité) | **10 €** | ~96 € | Today, Tasks, Timer, Goals, Notes, Journal, Savoir, Benchmark + **sync multi-appareils** |
| **Shale Pro** (+ trading) | **19 €** | ~180 € | Tout Shale + Market Brain, tracker live, journal de trades en R, calculateur de position, perf trading |

**Logique du prix.** 10 € en entrée pour élargir la cible « dev perso » (reste
au-dessus de Todoist/Notion mais justifié par la sync et le Savoir). L'écart
10 → 19 fait sentir la valeur unique du trading sans la brader. La cible
productivité-sans-trading est jugée réelle par Antonin → deux offres justifiées.

**Frontière productivité / trading.** Cœur trading = Market Brain, tracker live,
journal de trades, calculateur de position, perf/benchmark trading. Tout le reste
= productivité. Le gate d'abonnement devra masquer/verrouiller la catégorie
« Trading » de la sidebar quand l'utilisateur est sur le tier Shale.

**Clé LLM.** Au lancement : l'utilisateur fournit sa clé Gemini/Groq (zéro coût
marginal, zéro risque). Plus tard : add-on « clé Shale incluse » sur Pro
(+3-5 €), marge nette et argument de vente (supprime le mur d'onboarding de la
clé).

---

## 2. Architecture de synchronisation

### Principe : offline-first

L'app lit et écrit **toujours dans la base SQLite locale** (comme aujourd'hui).
Instantané, fonctionne sans réseau. Le cloud est un « plus », jamais une
dépendance. Un moteur de sync pousse/récupère les changements quand une
connexion est disponible ; sinon les changements s'empilent localement et
partent au prochain contact. Indicateur UI discret : « synchronisé / en attente ».

Ce modèle colle nativement à Shale, déjà 100 % SQLite local.

### Résolution de conflits : last-write-wins par ligne

**Décision : le dernier qui enregistre gagne, partout — y compris le corps des
notes / Savoir.** Pas de CRDT au lancement. Un utilisateur seul sur ses propres
appareils entre rarement en conflit dur ; la simplicité prime. Chaque ligne
synchronisée porte un horodatage ; en cas de conflit, l'écriture la plus récente
écrase l'ancienne.

_Réévaluation possible plus tard uniquement si l'édition simultanée des notes
devient un vrai problème usage → introduire alors un merge caractère par
caractère (CRDT) sur ce seul champ. Hors périmètre du lancement._

### Chiffrement de bout en bout (E2E)

**Rupture assumée avec la règle actuelle « données trading 100 % locales ».**
Les données montent dans le cloud mais **chiffrées côté client** : le serveur
(Supabase) ne voit jamais le contenu en clair. Promesse « tes trades restent
privés » préservée + argument marketing fort.

- Clé de chiffrement dérivée du mot de passe utilisateur (+ phrase de
  récupération à définir).
- Chaque ligne SQLite est sérialisée puis chiffrée avant push.
- Le moteur de sync manipule des **blobs chiffrés** + métadonnées **en clair**
  strictement nécessaires au tri (id, table, horodatage, tombstone de
  suppression).
- ⚠️ Conséquence à assumer et à expliquer à l'utilisateur : mot de passe perdu
  **sans** phrase de récupération = données cloud illisibles. C'est le prix du
  vrai privé. Prévoir un écran d'onboarding qui fait sauvegarder la phrase de
  récupération.

### Mécanique concrète

- **Journal de changements local** : chaque INSERT/UPDATE/DELETE écrit une entrée
  (table + id + horodatage + payload chiffré) dans une file d'attente.
- **Détection réseau** : Tauri (desktop) et les API mobiles signalent l'état de
  connexion → sync à la reconnexion + périodique.
- **Rejeu** : à la connexion, la file locale part vers le cloud, puis on récupère
  les changements distants et on applique le last-write-wins par horodatage.
- **Suppressions** : gérées par tombstones (marqueur de suppression daté), sinon
  une ligne supprimée localement « ressusciterait » depuis le cloud.
- **Stockage** : Supabase (déjà en place pour l'auth) peut porter les blobs
  chiffrés + métadonnées. À dimensionner (une table de sync par utilisateur).

---

## 3. Roadmap « grosses briques » (ordonnée par dépendances)

L'ordre est imposé par la technique, pas par l'envie : sans sync, le mobile est
une coquille vide.

### Étape 1 — Couche de sync cloud E2E _(fondation, le plus gros morceau)_
- Schéma de sync côté Supabase (table de changements chiffrés par utilisateur).
- Journal de changements local + file d'attente dans l'app.
- Moteur push/pull, last-write-wins par ligne, tombstones.
- Chiffrement E2E (dérivation de clé, phrase de récupération, écran d'onboarding).
- Indicateur d'état de sync dans l'UI.
- **À faire en premier. Tout le reste en dépend.**

### Étape 2 — Build Windows _(quasi gratuit, en parallèle de l'étape 1)_
- Tauri v2 fait déjà Windows → surtout du build/packaging/signature.
- Valide vite le multi-plateforme desktop et teste la sync PC ↔ PC.

### Étape 3 — iOS puis Android
- Tauri v2 fait les deux. Build iOS direct depuis le Mac d'Antonin.
- **Gros du travail = UI mobile dédiée** : les widgets redimensionnables desktop
  (`ResizableGrid`) n'ont pas de sens sur mobile → layout mobile repensé
  (navigation, listes plein écran, gestes). C'est un chantier design, pas juste
  un portage.
- iOS d'abord (plus simple à builder pour Antonin), Android ensuite.

### Étape 4 — Option « clé LLM incluse » sur Pro
- Petit chantier, gros levier commercial, une fois Pro installé et rôdé.
- Supprime le mur d'onboarding de la clé LLM pour les abonnés Pro.

---

## 4. Points encore ouverts / à trancher plus tard

- **Phrase de récupération E2E** : format, écran d'onboarding, rappels.
- **Dimensionnement Supabase** : volume des blobs, quotas, coût au nombre
  d'utilisateurs.
- **Gate d'abonnement productivité vs Pro** : masquage de la catégorie Trading
  dans la sidebar + revérification serveur du tier (la vue `my_subscription`
  devra distinguer les deux plans).
- **UI mobile** : maquette dédiée à concevoir avant le build iOS.
- **CRDT notes** : reporté, à rouvrir seulement si l'usage le réclame.
