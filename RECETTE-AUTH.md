# Recette du mur d'authentification

Ce document est la **procédure d'acceptation** de la porte d'entrée de Shale.

Il existe parce que les tests unitaires ne peuvent pas couvrir ce qui compte
ici. Ils prouvent que le code fait ce qu'on lui a dit *contre un serveur
simulé*, ce qui laisse ouvertes exactement quatre choses : le vrai GoTrue, le
vrai trousseau système, un vrai réseau qui tombe, et un utilisateur qui triche.
Cette recette ne couvre que celles-là.

⚠️ **Aucun secret dans ce fichier, ni dans aucun fichier du dépôt.** Les mots de
passe des comptes de recette restent hors du dépôt. Les comptes eux-mêmes
s'appellent `shale-test-*@example.com` — jamais une adresse réelle.

---

## Lire la vérité, pas l'écran

C'est le même principe que [RECETTE-SYNC.md](RECETTE-SYNC.md), et il est plus
important encore ici : **un écran qui affiche « connecté » ne prouve rien.**
Toute la faille corrigée le 2026-08-12 tenait dans cet écart — l'app affichait un
état d'authentification qu'aucun serveur n'avait confirmé.

Chaque scénario se conclut donc à un endroit où l'interface ne peut pas mentir :

```bash
# Les données locales.
alias shaledb='sqlite3 ~/Library/Application\ Support/com.atnfx.shale/shale.db'

# Le trousseau : c'est là que vit le jeton de rafraîchissement.
security find-generic-password -s com.atnfx.shale -a auth.refresh_token -w
```

```js
// Le stockage clair, dans la console du webview (⌥⌘I en dev).
// Ce qui doit s'y trouver : l'identité et la date de vérification. RIEN d'autre.
JSON.parse(localStorage.getItem("shale.auth.meta"))
Object.keys(localStorage)
```

```bash
# Ce que le SERVEUR pense du jeton. C'est la seule autorité.
curl -s "$SUPABASE_URL/auth/v1/user" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ACCESS_TOKEN"
```

⚠️ **Deux endroits, pas un.** Le `refresh_token` est au trousseau, l'identité et
`lastVerifiedAt` en clair. Un scénario qui ne regarde qu'un des deux ne prouve
rien : c'est précisément la répartition qui rend la purge de déconnexion
vérifiable.

---

## Prérequis

1. **Les quatre fichiers SQL sont joués**, dans l'ordre, dans Supabase Studio →
   SQL Editor : `shale-site/supabase/schema.sql`, `sync.sql`,
   `site-content.sql`, puis `migrations/002_admin.sql`.

2. **La migration `003_auth.sql` est passée.** Elle ne se contente pas
   d'appliquer : elle **vérifie** sept invariants dans le catalogue Postgres et
   lève une exception explicite si l'un manque. Elle se termine par :

   ```
   ✅ 003_auth : RLS, politiques, droits et vue vérifiés dans le catalogue.
   ```

   *(Passée le 2026-08-12. Contrôle rapide depuis l'extérieur : `POST
   /rest/v1/rpc/is_admin` avec la clé anon doit renvoyer **401 / 42501**. S'il
   renvoie `200 false`, la migration n'a pas pris.)*

3. **« Confirm email » est activé** — Authentication → Providers → Email.
   C'est le correctif central du bug d'origine.

4. **Un SMTP externe est branché** — Settings → Authentication → SMTP
   Configuration. Sans lui, le service intégré plafonne à **2 messages/heure** et
   ne livre qu'aux membres de l'organisation : le scénario 5 est alors
   inexécutable, et lui seul le révèle.

---

## Scénario 1 — installation neuve : le mur, et rien derrière

| | Étape |
|---|---|
| 1 | Vider le stockage : `localStorage.clear()` dans la console |
| 2 | Supprimer l'entrée du trousseau (commande `security` ci-dessus, option `-D`) |
| 3 | Relancer l'app |

**Vérification** — l'écran de connexion s'affiche, plein cadre. Puis, dans la
console :

```js
// Le châssis visible derrière le formulaire est-il une MAQUETTE ?
document.body.innerText.includes("Aujourd'hui")   // → false attendu
```

✅ Le décor ne contient **aucun texte réel** : c'est `ChassisFactice`, qui ne rend
que des rectangles. Si de vraies données apparaissent, l'app a été montée avant
l'authentification et le mur ne protège que l'affichage.

⚠️ **Ne pas se contenter du regard.** Un flou n'est pas une protection : il se
retire depuis l'inspecteur en une seconde. Ce qui compte, c'est qu'il n'y ait
rien à retirer.

---

## Scénario 2 — mot de passe erroné

| | Étape |
|---|---|
| 1 | Saisir une adresse valide et un mot de passe faux |
| 2 | Valider |

**Vérification** :

- Le message est **neutre** — il ne doit pas laisser deviner si le compte existe.
- `Object.keys(localStorage)` → aucune clé d'authentification écrite.
- Le trousseau ne contient pas de nouvelle entrée.

---

## Scénario 3 — compte non confirmé

| | Étape |
|---|---|
| 1 | Créer un compte, ne PAS cliquer le lien reçu |
| 2 | Tenter de se connecter avec le bon mot de passe |

**Vérification** — la connexion est refusée.

⚠️ **Constaté le 2026-08-12, et contre-intuitif** : GoTrue répond
`invalid_credentials`, **pas** « adresse non confirmée » — et ce, alors que le
mot de passe est correct. Le serveur masque donc la distinction lui aussi.

C'est bon pour la confidentialité et mauvais pour l'utilisateur légitime, qui n'a
aucun moyen de deviner ce qui lui manque. D'où le lien **« Tu n'as pas reçu
l'e-mail de confirmation ? »**, affiché en permanence sur la page de connexion du
site — et non conditionnellement, ce qui désignerait les adresses en attente.

---

## Scénario 4 — adresse bien formée, mais inexistante

**C'est le bug d'origine.** Une adresse au format valide suffisait à entrer.

| | Étape |
|---|---|
| 1 | S'inscrire avec `shale-test-<x>@example.com` — domaine réservé (RFC 2606), **aucun destinataire possible** |
| 2 | Observer la réponse |

**Vérification** :

```bash
curl -s -X POST "$SUPABASE_URL/auth/v1/signup" -H "apikey: $ANON" \
  -H "Content-Type: application/json" \
  -d '{"email":"shale-test-x@example.com","password":"…"}' | jq '.access_token'
```

✅ **`null` attendu.** Aucune session immédiate, donc aucun accès.

> **Passé le 2026-08-12.** Avant correction, `mailer_autoconfirm` valait `true`
> et deux comptes créés sur `example.com` obtenaient une session complète dans la
> seconde. Après activation de « Confirm email » : plus de session, et la
> connexion répond `Invalid login credentials`.

⚠️ **Ne pas refaire ce test à la légère.** Depuis que « Confirm email » est
actif, Supabase tente **réellement** de livrer, et `example.com` rejette tout.
Les rebonds dégradent la réputation d'un domaine d'envoi neuf.

---

## Scénario 5 — la chaîne complète, sur une vraie adresse

| | Étape |
|---|---|
| 1 | S'inscrire depuis le site avec **ta propre adresse**, externe au domaine |
| 2 | Recevoir l'e-mail, cliquer le lien |
| 3 | Atterrir sur `/compte/confirmation` |
| 4 | Se connecter dans l'app |

**Vérification** — en base, la ligne doit porter une date de confirmation :

```bash
curl -s "$SUPABASE_URL/auth/v1/user" -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN" | jq '.email_confirmed_at'
```

> ❌ **NON EXÉCUTÉ au 2026-08-12 — c'est le seul scénario non validé, et il est
> bloquant.** Aucun envoi vers une adresse externe réelle n'a été vérifié. Tant
> qu'il ne passe pas, on ne sait pas si un visiteur peut confirmer son adresse —
> et donc si quiconque peut créer un compte utilisable.

Tester aussi le **lien périmé** : attendre plus d'une heure, ou recliquer un lien
déjà utilisé. La page doit dire « Ce lien n'est plus valable » et proposer le
renvoi — pas afficher « Chargement… » puis rediriger en silence.

---

## Scénario 6 — redémarrage

| | Étape |
|---|---|
| 1 | Se connecter |
| 2 | Quitter l'app complètement (⌘Q) |
| 3 | Relancer |

**Vérification** — l'app s'ouvre sans ressaisie, et :

```js
JSON.parse(localStorage.getItem("shale.auth.meta")).lastVerifiedAt
// → un horodatage de MAINTENANT, pas d'il y a une semaine
```

✅ La date doit avoir été **rafraîchie au démarrage**. Si elle ne bouge pas, la
session n'a pas été revalidée auprès du serveur : on est retombé dans le défaut
d'origine.

---

## Scénario 7 — mode avion, session récente

| | Étape |
|---|---|
| 1 | Se connecter normalement (le réseau valide la session) |
| 2 | Activer le mode avion |
| 3 | Relancer l'app |

**Vérification** :

- L'app s'ouvre, avec le **bandeau « Hors ligne »** en haut.
- Les données locales sont là et modifiables.
- **Aucune requête authentifiée ne part** — la synchronisation ne démarre pas
  hors de l'état `ready`. À vérifier dans l'onglet Réseau : rien vers Supabase.

⚠️ **Ce scénario doit être joué DEUX FOIS** : une avec un jeton valide, une avec
un jeton bidon (voir le scénario 9). C'est la leçon du défaut ci-dessous.

> **Un défaut trouvé en écrivant cette recette, le 2026-08-12.** Au premier
> essai, l'app s'ouvrait en mode hors ligne avec des métadonnées entièrement
> forgées. Cause : `refreshSession` levait une `Error` **sans code de statut**,
> si bien que `estPanneReseau()` ne pouvait pas distinguer « le serveur a
> REFUSÉ » de « le serveur n'a pas RÉPONDU » — et retombait sur le défaut
> confortable, qui est le défaut **permissif**. Corrigé par `erreurHttp()` dans
> `src/lib/auth/supabase.ts`.
>
> Morale, et raison d'être de cette recette : **tester le mode avion avec un
> jeton valide ne teste rien.** Les deux chemins se ressemblent à l'écran et
> divergent complètement dans le code.

---

## Scénario 8 — mode avion, aucune session

| | Étape |
|---|---|
| 1 | Purger le stockage et le trousseau (scénario 1) |
| 2 | Activer le mode avion |
| 3 | Lancer l'app |

**Vérification** — le mur s'affiche, avec un message **explicite** : la première
connexion demande une connexion Internet. Pas un écran de chargement infini, pas
une erreur technique.

---

## Scénario 9 — hors délai de grâce, et jeton refusé

Le délai est de **30 jours** (`GRACE_JOURS` dans `useAuth.ts`), comptés depuis la
**dernière validation serveur** — pas depuis le dernier démarrage. Rester hors
ligne ne le prolonge donc jamais.

**Pour tester sans attendre un mois**, vieillir la date à la main :

```js
const m = JSON.parse(localStorage.getItem("shale.auth.meta"));
m.lastVerifiedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
localStorage.setItem("shale.auth.meta", JSON.stringify(m));
```

| | Cas | Attendu |
|---|---|---|
| a | Mode avion + date vieillie de 31 jours | Mur, message « hors ligne depuis plus de 30 jours » |
| b | Réseau actif + `refresh_token` remplacé par `"bidon"` | Mur, et **stockage purgé** — le serveur a refusé, ce n'est pas une panne |
| c | Reconnexion après (a) ou (b) | L'app rouvre, **toutes les données locales intactes** |

✅ Le cas (c) est le plus important : `shaledb "SELECT COUNT(*) FROM tasks"` doit
donner le même nombre qu'avant le re-verrouillage. **Se déconnecter n'est pas se
désinscrire.**

---

## Scénario 10 — déconnexion : la purge est-elle réelle ?

| | Étape |
|---|---|
| 1 | Être connecté |
| 2 | Réglages → Se déconnecter |

**Vérification, aux DEUX endroits** :

```js
Object.keys(localStorage)        // → aucune clé shale.auth.* ni auth.refresh_token
```
```bash
security find-generic-password -s com.atnfx.shale -a auth.refresh_token -w
# → doit échouer : « The specified item could not be found »
```
```bash
shaledb "SELECT COUNT(*) FROM tasks"   # → INCHANGÉ
```

> **Passé le 2026-08-12** (volet stockage clair) : après un refus de session,
> `Object.keys(localStorage)` renvoie `[]`. Le volet trousseau reste à jouer sur
> une vraie installation Tauri — en preview navigateur, il n'y a pas de trousseau.

---

## Scénario 11 — le compte B ne voit rien du compte A

Deux comptes de test, deux jetons, et **des `curl` en clé anon** — pas l'écran de
l'app, qui n'affiche de toute façon que ce qu'on lui donne.

```bash
q() { curl -s -H "apikey: $ANON" -H "Authorization: Bearer $2" "$SUPABASE_URL/rest/v1/$1"; }

q "subscriptions?select=user_id&user_id=eq.$UID_A"   "$TOKEN_B"   # → []
q "my_subscription?select=user_id&user_id=eq.$UID_A" "$TOKEN_B"   # → []
q "sync_keys?select=user_id&user_id=eq.$UID_A"       "$TOKEN_B"   # → []
q "sync_rows?select=user_id&user_id=eq.$UID_A"       "$TOKEN_B"   # → []
```

⚠️ **Le contrôle négatif est OBLIGATOIRE.** Un `[]` partout prouve seulement que
les tables sont vides. Il faut vérifier que A se voit lui-même :

```bash
q "subscriptions?select=user_id,status" "$TOKEN_A"   # → une ligne
```

> **Passé le 2026-08-12** : les quatre requêtes croisées renvoient `[]`, et A se
> voit lui-même avec `status: trialing`. Tentative d'écriture au nom d'autrui
> (`INSERT` dans `sync_keys` avec le `user_id` de A) → **403 / 42501**.

---

## Scénario 12 — un compte ordinaire ne réécrit pas le site

```bash
# 1. Lire AVANT.
curl -s "$SUPABASE_URL/rest/v1/site_content?id=eq.1&select=overrides" -H "apikey: $ANON"

# 2. Tenter d'écrire avec un compte ORDINAIRE.
curl -s -X PATCH "$SUPABASE_URL/rest/v1/site_content?id=eq.1" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" -d '{"overrides":{"PREUVE":"intrusion"}}'

# 3. Relire APRÈS.
curl -s "$SUPABASE_URL/rest/v1/site_content?id=eq.1&select=overrides" -H "apikey: $ANON"
```

⚠️ **LE PIÈGE, et il est sérieux.** L'étape 2 renvoie **HTTP 200**, pas 403 :
PostgREST répond 200 avec un tableau vide quand la clause `USING` de la politique
ne sélectionne aucune ligne — l'`UPDATE` a porté sur zéro ligne.

**Seule la comparaison avant/après tranche.** Un test qui regarderait le code
HTTP conclurait à une faille inexistante ; sur une base réellement ouverte, le
200 serait identique.

Vérifier aussi qu'on ne peut pas se promouvoir :

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/admins" -H "apikey: $ANON" \
  -H "Authorization: Bearer $TOKEN_B" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$UID_B\"}"     # → 403 / 42501
```

> **Passé le 2026-08-12** : contenu inchangé, `admins` en 403.

---

## Scénario 13 — les adresses du site, après la fusion

L'espace compte a fusionné dans la vitrine le 2026-08-11 et ses adresses ont
perdu leur `.html`. **Les anciennes doivent continuer de répondre** : l'app déjà
installée pointe dessus et ne sera pas recompilée.

```bash
for p in /compte/ /compte/connexion /compte/inscription /compte/mot-de-passe \
         /compte/confirmation /en/account/sign-in; do
  printf "%-26s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' -L "https://www.shaleapp.com$p")"
done

for p in /compte/login.html /compte/signup.html /compte/reset.html; do
  printf "%-26s %s → %s\n" "$p" \
    "$(curl -s -o /dev/null -w '%{http_code}' "https://www.shaleapp.com$p")" \
    "$(curl -s -o /dev/null -w '%{redirect_url}' "https://www.shaleapp.com$p")"
done
```

✅ Les premières en **200**, les anciennes en **308** vers les nouvelles.

⚠️ **308 et non 302** : la redirection doit conserver le **fragment** de l'URL.
Le lien de réinitialisation porte son jeton dans le fragment (`#access_token=…`).
Une `<meta http-equiv="refresh">` l'effacerait, et le visiteur atterrirait sur un
formulaire sans session — panne invisible sauf en cliquant un vrai lien reçu par
courrier.

Et le `noindex` :

```bash
curl -s -L "https://www.shaleapp.com/compte/connexion" | grep -o 'name="robots"[^>]*'
# → content="noindex, follow"
```

> **Passé le 2026-08-12** : toutes en 200, anciennes en 308, `canonical` sur
> `https://www.shaleapp.com/`, `noindex, follow` présent.

---

## État au 2026-08-12

| Scénario | État |
|---|---|
| 1 · installation neuve → mur | ✅ passé |
| 2 · mot de passe erroné | ⏳ à jouer |
| 3 · compte non confirmé | ⏳ à jouer |
| 4 · adresse inexistante | ✅ passé |
| 5 · chaîne e-mail complète | ❌ **non fait — bloquant** |
| 6 · redémarrage | ⏳ à jouer |
| 7 · avion, session récente | ⏳ à jouer *(deux fois)* |
| 8 · avion, sans session | ⏳ à jouer |
| 9 · hors délai de grâce | ⏳ à jouer |
| 10 · déconnexion | ✅ partiel *(stockage clair ; trousseau à faire)* |
| 11 · cloisonnement A/B | ✅ passé |
| 12 · écriture du contenu | ✅ passé |
| 13 · adresses du site | ✅ passé |

Les scénarios en attente demandent une **vraie installation Tauri** : le mode
avion, le trousseau et le redémarrage n'existent pas en preview navigateur.

---

## Ménage

Trois comptes de recette traînent dans la base de **production** :
`shale-test-a`, `-b` et `-c@example.com`. À supprimer dans Supabase →
Authentication → Users, en cherchant `example.com`.

Ils sont inertes — `-c` n'est même pas confirmé — mais un compte de test oublié
dans une base de production est exactement le genre de chose qu'on retrouve six
mois plus tard sans savoir ce que c'est.
