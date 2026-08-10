# Recette de la synchronisation — deux appareils, en conditions réelles

Ce document est la **procédure d'acceptation** de la couche de synchronisation.
Il n'est pas une checklist de confort : les tests unitaires prouvent que le
moteur est correct *contre un serveur simulé*, ce qui laisse ouvertes exactement
trois choses — le vrai PostgREST, le vrai trousseau macOS, et deux vraies
horloges qui ne sont pas d'accord. Cette recette ne couvre que celles-là.

⚠️ **Aucun secret dans ce fichier, ni dans aucun fichier du dépôt.** Le mot de
passe de synchronisation et le code de récupération employés pendant la recette
restent hors du dépôt. Le code de récupération affiché à l'activation ne se
recopie nulle part ailleurs que sur le papier de la recette, qui n'est pas
versionné.

---

## Prérequis

1. **Le schéma est joué.** `shale-site/compte/supabase/sync.sql` exécuté dans
   Supabase Studio → SQL Editor, puis :

   ```bash
   SHALE_SUPABASE_URL="https://xxxx.supabase.co" SHALE_SUPABASE_ANON_KEY="…" SHALE_TEST_EMAIL="…" SHALE_TEST_PASSWORD='…' npm run sync:verifier
   ```

   Le script doit se terminer par « Tout est conforme. » Il vérifie ce que
   PGlite ne peut pas : le rendu hexadécimal du `bytea`, les politiques du
   bucket, et que le bucket est bien privé. **Ne pas continuer tant qu'il
   échoue** — un `bytea` rendu en base64 corrompt en silence.

2. **`src/lib/auth/config.ts` renseigné** (URL + clé anon du projet réel).
   C'est le cas depuis le 2026-08-10.

   ⚠️ **La consigne « ne pas committer ce fichier » demande un arbitrage, pas
   une application aveugle.** La clé `anon` est *publique par conception* :
   elle part de toute façon dans le JavaScript servi au visiteur, et ce qui
   protège la base est la RLS, pas son secret. Côté site, elle **est** committée
   — un déploiement depuis git n'a pas d'autre moyen de la connaître.

   Côté app, `config.ts` reste aujourd'hui **non committé**. Conséquence à
   assumer : un clone neuf du dépôt compile une app en **mode démo**. À trancher
   consciemment, dans un sens ou dans l'autre.

   Ce qui n'est PAS négociable : la clé `service_role`, qui contourne toute la
   RLS, ne doit jamais quitter le tableau de bord Supabase — ni dépôt, ni app,
   ni site, ni fichier de log.

3. **Deux profils macOS distincts** (Réglages système → Utilisateurs), ou deux
   Mac. Deux comptes utilisateurs sont indispensables : le trousseau et
   `~/Library/Application Support/com.atnfx.shale/` sont par utilisateur, et
   c'est précisément ce cloisonnement qu'on veut éprouver.

4. **Build natif installé sur les deux**, pas `tauri dev` :

   ```bash
   npm run tauri build
   ```

   ⚠️ Obligatoire après toute migration SQL, tout changement de
   `capabilities/*.json` ou de `tauri.conf.json`. Une migration ne s'applique à
   la base réelle qu'au lancement du bundle.

5. **Sauvegarde des deux bases avant de commencer.**

   ```bash
   sqlite3 ~/Library/Application\ Support/com.atnfx.shale/shale.db "VACUUM INTO '$HOME/shale-avant-recette.db'"
   ```

---

## Lire la vérité, pas l'écran

Chaque scénario se conclut **en base**, sur les deux machines. L'interface peut
afficher une valeur mise en cache par React ; la base, non.

```bash
# Le raccourci employé partout ci-dessous.
alias shaledb='sqlite3 ~/Library/Application\ Support/com.atnfx.shale/shale.db'
```

```sql
-- L'identité de l'appareil et l'avancement du curseur.
SELECT k, v FROM sync_meta WHERE k IN ('device_id', 'cursor', 'last_push_at', 'last_pull_at');

-- Ce qui attend encore de partir.
SELECT COUNT(*) FROM sync_outbox;

-- Une ligne, avec l'uid qui fait foi entre appareils (l'`id` est LOCAL).
SELECT id, uid, label, priority FROM tasks ORDER BY id DESC LIMIT 5;

-- Ce que l'appareil croit que le serveur détient pour cette ligne.
SELECT * FROM sync_state WHERE row_uid = '<uid>';
```

⚠️ **Comparer les `uid`, jamais les `id`.** Deux appareils créent chacun une
tâche `id = 42` sans le moindre rapport ; c'est tout l'objet de la migration 015.

---

## Scénario 1 — une création traverse

| | Appareil A | Appareil B |
|---|---|---|
| 1 | Créer une tâche « recette-1 » | — |
| 2 | Attendre la sync (≤ 90 s) ou cliquer « Synchroniser maintenant » | — |
| 3 | — | Attendre la sync |

**Vérification**, sur les deux :

```sql
SELECT uid, label FROM tasks WHERE label = 'recette-1';
```

✅ Le **même `uid`** des deux côtés. Les `id` peuvent différer — ils le doivent,
même, si les bases n'ont pas le même historique.

⏱️ Noter le délai réel entre la saisie sur A et l'apparition sur B.

---

## Scénario 2 — le conflit, et sa convergence

C'est le scénario qui compte. Un LWW qui ne converge pas ne se voit pas : les
deux appareils affichent chacun une valeur cohérente, différente, pour toujours.

| | Appareil A | Appareil B |
|---|---|---|
| 1 | — | — |
| 2 | **Couper le Wi-Fi** | **Couper le Wi-Fi** |
| 3 | Renommer « recette-1 » en « recette-1-par-A » | Renommer « recette-1 » en « recette-1-par-B » |
| 4 | Noter l'heure exacte de la modification | Noter l'heure exacte |
| 5 | **Rétablir le Wi-Fi** | attendre 10 s, puis **rétablir** |
| 6 | Laisser deux cycles complets passer des deux côtés | |

**Vérification**, sur les deux :

```sql
SELECT uid, label FROM tasks WHERE uid = '<uid du scénario 1>';
SELECT remote_ts, remote_device FROM sync_state WHERE row_uid = '<uid>';
```

✅ **`label` STRICTEMENT identique des deux côtés**, et c'est la modification la
plus récente qui gagne — pas la dernière arrivée. `remote_ts` et `remote_device`
doivent eux aussi être identiques : c'est le couple qui départage, l'horodatage
seul ne suffit pas (cf. migration 017).

⚠️ Refaire l'essai en inversant l'ordre de reconnexion. Le vainqueur doit être
le même — l'ordre d'arrivée ne doit rien changer, c'est tout l'objet du trigger
serveur.

---

## Scénario 3 — une suppression ne ressuscite pas

| | Appareil A | Appareil B |
|---|---|---|
| 1 | — | **Couper le Wi-Fi** |
| 2 | — | Modifier « recette-1 » (ex. changer la priorité) |
| 3 | Supprimer « recette-1 » | — |
| 4 | Laisser la sync partir | — |
| 5 | — | **Rétablir le Wi-Fi**, laisser deux cycles |

**Vérification**, sur les deux :

```sql
SELECT COUNT(*) FROM tasks WHERE uid = '<uid>';       -- attendu : 0
SELECT deleted, remote_ts FROM sync_state WHERE row_uid = '<uid>';  -- deleted = 1
```

✅ La tâche est absente **des deux côtés**, et `sync_state` porte la pierre
tombale. Une modification hors ligne postérieure à la suppression peut
légitimement gagner (le LWW s'applique aussi aux tombstones) : dans ce cas la
ligne réapparaît **des deux côtés**. Ce qui serait un défaut, c'est qu'elle
réapparaisse d'**un seul** côté.

---

## Scénario 4 — le réseau revient

| | Appareil A |
|---|---|
| 1 | Couper le Wi-Fi |
| 2 | Créer 5 tâches, 2 notes, modifier un objectif |
| 3 | Vérifier l'indicateur : il doit dire « hors ligne » ou « N en attente », **jamais rouge** |
| 4 | `shaledb "SELECT COUNT(*) FROM sync_outbox"` → non nul |
| 5 | Rétablir le Wi-Fi **sans toucher à l'app** |

✅ La synchronisation repart **seule**, sans clic. Le planificateur écoute
l'événement `online`.

✅ `sync_outbox` retombe à 0.

✅ Pendant la coupure, **créer une tâche reste instantané**. Si une saisie
marque le moindre temps d'attente, le réseau est sur le chemin critique — c'est
une régression, pas un détail.

**Recul exponentiel** : couper le réseau et laisser tourner. Les tentatives
s'espacent 5 s → 10 s → 20 s… plafonnées à 5 min. Elles ne doivent JAMAIS
s'arrêter définitivement.

---

## Scénario 5 — le second appareil part de zéro

Le cas le plus lourd, et le seul qui exerce la pagination.

| | Appareil B (base vide ou récente) |
|---|---|
| 1 | Réglages → synchronisation → « J'ai perdu mon mot de passe » ou saisir le mot de passe |
| 2 | Chronométrer jusqu'à ce que l'indicateur passe à « synchronisé » |

✅ Les données de A sont **toutes** là, en **un seul** cycle si le volume est
sous 5 000 lignes. Un rattrapage qui progresserait par paliers de 200 toutes les
90 secondes signalerait que la boucle de pagination ne tourne pas.

```sql
-- Sur les deux, les comptes doivent coïncider table par table.
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'notes', COUNT(*) FROM notes
UNION ALL SELECT 'trades', COUNT(*) FROM trades
UNION ALL SELECT 'goals', COUNT(*) FROM goals;
```

---

## Scénario 6 — la session expire

Le défaut le plus discret de tous, et invisible en session courte.

| | Appareil A |
|---|---|
| 1 | Ouvrir l'app et **la laisser ouverte plus d'une heure** (jeton Supabase = 1 h) |
| 2 | Créer une tâche |
| 3 | Attendre un cycle |

✅ La tâche part. L'indicateur ne montre **pas** « reconnexion requise ».

C'est ce que corrige `jetonFrais` : avant, la sync récoltait un 401 toutes les
90 secondes après la première heure, sans que rien ne le dise.

Pour forcer le cas sans attendre : supprimer `shale.session` du `localStorage`
et remettre un `expires_at` passé.

---

## Scénario 7 — le trousseau

| | Appareil A |
|---|---|
| 1 | Quitter l'app, la relancer |

✅ Aucun mot de passe demandé : le trousseau a rendu la clé.

| | Appareil A |
|---|---|
| 2 | Réglages → « Oublier la clé sur cet appareil », quitter, relancer |

✅ L'écran de déverrouillage s'affiche au lancement. « Plus tard » le referme, et
l'app fonctionne normalement — les saisies s'empilent dans `sync_outbox` et
partent au déverrouillage.

✅ Le code de récupération ouvre aussi bien que le mot de passe.

---

## Ce que la recette ne couvre pas

- **Le bucket `sync-blobs` en écriture.** L'app n'émet aujourd'hui aucune charge
  par référence : seule la lecture est implémentée (tolérance à une version
  ultérieure). `npm run sync:verifier` éprouve les politiques du bucket.
- **La purge des pierres tombales.** `sync_purge_tombstones()` n'est pas
  planifiée (`pg_cron` n'est pas sur tous les plans) et son délai est de
  180 jours : rien à observer sur une recette.
- **Trois appareils ou plus.** Rien dans la conception ne distingue le troisième
  du second, mais ce n'est pas éprouvé.

---

## Compte rendu

Reporter le résultat dans `CLAUDE.md`, section « Recette PC ↔ PC », avec la
date, les versions des deux machines, et **tout écart entre le comportement réel
et ce que les tests laissaient attendre**. Un écart signifie que le serveur
simulé de `engine.testutil.ts` n'est pas fidèle à PostgREST : corriger alors
**le simulateur ET le code**, jamais le seul code — sinon le prochain défaut du
même genre repassera à travers les tests.
