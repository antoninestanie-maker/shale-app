# Shale sur iPhone — audit de faisabilité

**Date de l'audit : 2026-08-26.** Branche examinée : `responsive`, au commit
`749b981`, qui est **le même commit que `sync-chiffree`** (vérifié dans les deux
sens : aucun commit d'écart).

Ce document est le livrable d'une phase d'audit. **Aucune ligne de code
applicatif n'a été écrite pour iOS.** Il dit ce qui a été mesuré, ce qui reste
inconnu, et ce qui doit être décidé avant d'écrire quoi que ce soit.

Tout ce qui suit a été vérifié dans l'arbre — sources des greffons dans
`~/.cargo/registry`, code du dépôt, exécution réelle des tests. Ce qui n'a pas
pu être vérifié est signalé comme tel, jamais présenté comme un fait.

---

## 0. Ce que l'audit a trouvé avant de commencer

### 0.1 Trois blocages, dont un qu'Antonin seul peut lever

| # | Blocage | Preuve | Qui le lève |
|---|---|---|---|
| 1 | **Xcode n'est pas installé** | `xcode-select -p` → `/Library/Developer/CommandLineTools` ; `xcodebuild` répond « requires Xcode » ; `xcrun simctl` → « not a developer tool » | **Antonin** (§8) |
| 2 | **Les cibles Rust iOS sont absentes** | `rustup target list --installed` → `aarch64-apple-darwin`, `x86_64-pc-windows-msvc`. Ni `aarch64-apple-ios`, ni `aarch64-apple-ios-sim` | automatique une fois Xcode là |
| 3 | **Trois autres sessions Claude écrivent dans ce dépôt en ce moment** | voir ci-dessous — ce n'est pas un risque théorique, c'est arrivé pendant l'audit | **Antonin** (les fermer) |

**Le blocage 3, en détail, parce qu'il s'est matérialisé pendant cet audit :**

- 21:07 — l'audit commence. `git status` : 4 fichiers modifiés, branche `responsive`.
- 21:19 — `CLAUDE.md` gagne 144 lignes que je n'ai pas écrites. `repo.ts` et
  `auth/config.ts` sont touchés dans le même quart d'heure.
- 21:22 — `ps` confirme **trois processus `claude` actifs** en plus du mien.
- pendant la rédaction de ce document — l'autre session **commite** (`373dfba`,
  « Savoir : une sortie explicite dans le lecteur ») **et change la branche
  courante** : le worktree est passé de `responsive` à `feat/bouton-sortie-note`
  sans que rien ne le signale.

C'est la raison pour laquelle **la Phase 0 n'a pas été exécutée** : créer une
branche et committer dans ces conditions entrelacerait deux chantiers dans un
même commit, ou déposerait le travail iOS sur la branche de quelqu'un d'autre.
**Rien n'a été commité, aucune branche n'a été créée.** `MOBILE.md` est déposé
non suivi, ce qui le rend insensible aux changements de branche.

⚠️ Cet audit porte donc sur le commit **`749b981`** (`responsive` = `sync-chiffree`),
état constaté à 21:07. Le dépôt a bougé depuis.

### 0.2 Cinq prémisses du cahier des charges sont fausses

Elles ne sont pas des détails : trois d'entre elles commandaient des consignes
précises qui, appliquées telles quelles, auraient produit du faux travail.

| Prémisse | Ce qui est vrai |
|---|---|
| « Le worktree Windows a 16 fichiers non commités » | **`git status` y est vide.** Le port a été commité le 2026-08-24 : `a6b79ff` (12 fichiers : mur d'activation + correctif de sync) et sa fusion `0aaee26`. `STRIPE_ENABLED` était porté avant, par `02a2c4b`. **La Phase 0.1 était déjà faite.** |
| « `src/lib/platform.ts` existe déjà, c'est le bon endroit à étendre » | **Il n'existe pas sur le tronc.** `git ls-tree` le trouve uniquement sur `windows-build`. Il faut d'abord le *remonter* sur le tronc avant de pouvoir l'étendre — c'est un travail, pas un acquis. |
| « `AUDIT-RESPONSIVE.md` existe » | **Aucun fichier de ce nom, nulle part.** L'audit responsive vit dans `DESIGN.md` § « Côté app — ce qui a été fait, et ce qu'il ne faut PAS faire » (lignes 247-300) et dans le message du commit `b7b6d08`. |
| « Ajouter une entrée dans `JOURNAL.md` » | **`JOURNAL.md` n'existe pas.** L'historique du projet est tenu dans `CLAUDE.md` (2 487 lignes, sections datées). C'est là qu'il faudra écrire. |
| « `SHALE.md` à mettre à jour (§7, §2) » | Il existe, mais **hors du dépôt** : `~/Desktop/Shale-projet/SHALE.md`, non versionné, daté du 2026-08-11 — deux semaines de retard sur le code. |

### 0.3 La divergence Windows est bien réelle, mais ce n'est pas celle-là

C'est le point important, parce qu'il valide l'inquiétude de fond du cahier des
charges tout en déplaçant sa cible.

```
windows-build →  9 commits d'avance sur le tronc
windows-build → 20 commits de RETARD sur le tronc
```

Concrètement, `git diff sync-chiffree windows-build` porte sur **80 fichiers,
2 442 insertions et 6 952 suppressions**. La version Windows :

- **n'a pas le module Finance du tout** (`src/lib/finance/` entier, `FinanceView.tsx`, migration `018_finance.sql`) — soit un des douze modules ;
- **a encore `BenchmarkView.tsx`**, que le tronc a retiré (migration `019_drop_benchmark.sql`) ;
- n'a rien du chantier responsive ni de la doctrine adaptative de `DESIGN.md` ;
- possède en propre `src/lib/platform.ts` et `src/lib/tones.ts`, que le tronc n'a pas.

**Un module entier de différence entre deux plateformes, c'est déjà l'échec de
parité que le point 4 veut empêcher — et il est là, aujourd'hui, à deux
plateformes.** Ajouter iOS par-dessus sans réconcilier d'abord, c'est le
garantir à trois.

### 0.4 Ligne de base, mesurée

| Contrôle | Résultat |
|---|---|
| `cargo test --lib` | **88 tests, 0 échec**, 1,92 s — dont les **79 du moteur de rappels** (comptés fichier par fichier : `engine` 19, `task_streak` 13, `data` 10, `habits` 8, `streak` 8, `inactivity` 6, `store` 6, `scheduler` 6, `mod` 3) |
| `npm run test:types` | **vert** |

C'est l'étalon auquel comparer après le chantier iOS.

---

## 1. La décision d'architecture, et ce qu'elle coûte

L'audit **confirme** le choix du cahier des charges : une seule base de code, un
front React partagé, un Rust conditionnel. Rien dans ce qui a été inspecté ne le
rend impraticable.

Mais il faut énoncer le prix, parce qu'il est réel et qu'il se paiera à chaque
modification :

> Ajouter un module, changer un champ, renommer un onglet : il faudra désormais
> le penser pour trois plateformes d'un coup, et le vérifier sur trois. En
> échange, la divergence devient structurellement impossible plutôt que
> surveillée à la relecture — et la relecture, on sait maintenant qu'elle ne
> suffit pas : c'est exactement comme ça que Finance a disparu de Windows.

**Condition préalable non négociable** : réconcilier `windows-build` avec le
tronc *avant* d'ouvrir iOS. Sinon on ne construit pas une base unique, on
construit une troisième branche.

---

## 2. Ce qui survit dans la couche Rust

### 2.1 Les greffons Tauri, un par un

Niveaux lus dans `[package.metadata.platforms.support.ios]` du `Cargo.toml` de
chaque greffon, dans `~/.cargo/registry` — c'est la déclaration officielle du
projet Tauri, pas une supposition.

| Greffon | iOS | Conséquence pour Shale |
|---|---|---|
| `tauri-plugin-notification` 2.3.3 | **`full`** | ✅ La brique existe. Voir §3 : le greffon n'est pas le problème, le *planificateur* l'est. |
| `tauri-plugin-sql` 2.4.0 (sqlite) | **`full`** | ✅ `shale.db` et les 19 migrations passent. |
| `tauri-plugin-http` 2 | **`full`** | ✅ Market Brain, Binance, Yahoo, LLM. |
| `tauri-plugin-dialog` 2.7.1 | **`partial`** — « Does not support folder picker » | ⚠️ À vérifier : `sauvegardes.rs` n'utilise que `app_data_dir()`, donc rien de bloquant a priori. Le sélecteur de dossier n'apparaît nulle part dans le Rust. |
| `tauri-plugin-opener` 2 | **`partial`** — « Only allows to open URLs via `open` » | ⚠️ Suffisant : l'app s'en sert pour ouvrir le site (`ACCOUNT_URL`, `/legal`). |
| `tauri-plugin-global-shortcut` 2.3.2 | **`none`** | ❌ **À neutraliser.** Un raccourci global n'existe pas sur iPhone. |

### 2.2 Ce qui doit être neutralisé proprement, et pourquoi

Ces éléments ne « compilent pas à vide » : le compilateur les refuse. Les
attributs `cfg` cités sont ceux de `tauri` 2.11.5, lus dans la source.

| Dans `src-tauri/src/lib.rs` | Gate réelle | Traitement |
|---|---|---|
| `TrayIconBuilder`, `Menu`, `MenuItem` (le tray) | `#[cfg(all(desktop, feature = "tray-icon"))]` | `#[cfg(desktop)]` sur tout le bloc `setup`, et retirer `"tray-icon"` des features en mobile |
| `tauri_plugin_global_shortcut` + `toggle_capture` | greffon `level = "none"` | `#[cfg(desktop)]` autour du `.plugin(...)` |
| `RunEvent::Reopen` | `#[cfg(target_os = "macos")]` | `#[cfg(target_os = "macos")]` sur le `.run(...)` |
| `window.is_fullscreen()`, `.hide()`, `.show()`, `.set_focus()` | méthodes de fenêtre desktop | `#[cfg(desktop)]` sur `on_window_event` — sur iOS il n'y a pas de fermeture de fenêtre, le système suspend |
| La 2ᵉ fenêtre `"capture"` de `tauri.conf.json` | mobile ne gère qu'une webview | à sortir vers `tauri.macos.conf.json` / config de plateforme |
| `import_screenshot` (copie d'un fichier choisi) | dépend d'un chemin de fichier local | à repenser : sur iOS on passe par le sélecteur de photos, pas par un chemin |
| `macOSPrivateApi: true` | macOS uniquement | idem, config de plateforme |

`capabilities/default.json` est aussi à scinder : il pointe
`"$schema": "../gen/schemas/desktop-schema.json"` et déclare
`"windows": ["main", "capture"]`. Il faudra une capability mobile distincte,
sans les permissions `core:window:*` ni la fenêtre `capture`.

### 2.3 Le trousseau — bonne nouvelle, vérifiée

Le cahier des charges craignait que « l'API iOS n'est pas celle de macOS ».
C'est vrai de l'API système, mais **`keyring` 3.6.3 s'en charge déjà** :

- le dossier contient `macos.rs` **et** `ios.rs` ;
- `Cargo.toml` déclare `apple-native = ["dep:security-framework"]`, et
  `security-framework` est déclarée pour `cfg(target_os = "ios")` autant que pour
  macOS. **La feature actuelle du projet marche telle quelle sur iOS.**

Une contrainte à connaître, écrite dans l'en-tête de `ios.rs` : ni le *service*
ni le *compte* ne peuvent être la chaîne vide. Shale appelle
`Entry::new("com.atnfx.shale", key)` — les deux sont non vides. **Rien à
changer dans `secrets.rs`.**

Ce qui reste à faire : sur un appareil réel, l'accès au trousseau exige un
entitlement (`keychain-access-groups`) lié à l'App ID. Sur simulateur, non.
C'est donc un sujet de Phase 3+, pas de Phase 3.

⚠️ Conséquence sur la sync : `keystore.ts` range la **DEK** dans ce même
trousseau (`sync.dek`), avec un repli en mémoire assumé si le trousseau ne
répond pas. Sur iOS, ce repli signifierait *redemander le mot de passe à chaque
lancement*. À éprouver, pas à supposer.

### 2.4 SQLite : où vit la base

`db.ts` charge `sqlite:shale.db` et `sauvegardes.rs` n'utilise que
`app.path().app_data_dir()` : **aucun chemin macOS n'est écrit en dur dans le
code**. La seule mention de `~/Library/Application Support/` est un *commentaire*
en tête de `db.ts`, à corriger.

Sur iOS, `app_data_dir()` résout dans le bac à sable de l'app. Deux points
demandent une décision, pas une découverte :

1. **La sauvegarde iCloud.** Par défaut, ce qui est dans `Documents/` est
   sauvegardé par iCloud, ce qui expédierait `shale.db` — en clair — chez Apple.
   Le dossier `Library/Application Support/` du bac à sable l'est aussi. Le
   dossier qui ne l'est pas est `Library/Caches/`, mais le système peut le
   purger. **Il faudra poser explicitement l'attribut « exclure de la
   sauvegarde », ou décider que la sauvegarde iCloud est acceptable.**
   Ce n'est pas neutre : tout le raisonnement de `secrets.rs` (« protection
   contre la fuite passive : sauvegarde Time Machine, sync iCloud du dossier »)
   s'applique mot pour mot ici.
2. Le `WAL` de SQLite et le mécanisme de restauration de `sauvegardes.rs`
   (« écraser un fichier SQLite sous une connexion vivante corromprait le WAL »)
   doivent être revérifiés sous suspension iOS, où l'app peut être tuée à tout
   instant.

---

## 3. Les notifications — le point critique, et il est plus dur qu'annoncé

### 3.1 Le diagnostic, avec la preuve

Le cahier des charges dit : « aucun scheduler Rust ne tournera en arrière-plan ».
**C'est exact, et l'audit le confirme au code.** `scheduler.rs` :

```rust
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_DELAY).await;
        run(&app, Trigger::Foreground).await;
        loop {
            tokio::time::sleep(TICK).await;   // TICK = 60 s
            run(&app, Trigger::Scheduled).await;
        }
    });
}
```

C'est une boucle de scrutation. iOS suspend le processus dès que l'app quitte
l'écran : la boucle s'arrête, et rien ne la réveille.

L'ironie mérite d'être notée : l'en-tête du fichier explique que le tick d'une
minute existe **précisément parce que macOS suspend `Instant` pendant la
veille**. Le moteur sait déjà que le temps peut lui échapper — mais sa parade
suppose qu'il se réveille pour le constater. Sur iOS, il ne se réveille pas.

### 3.2 Le vrai problème n'est pas le planificateur, ce sont les règles

C'est le point que le cahier des charges ne voit pas, et il change la réponse.

Une notification locale iOS se **programme à l'avance** : on dit au système
« affiche ce texte à 20 h ». Or les règles de Shale ne sont pas des horaires,
ce sont des **conditions évaluées sur l'état de la base au moment du tick** :

| Règle | Ce qu'elle vérifie | Programmable à l'avance ? |
|---|---|---|
| `habits_pending` (`hour` = 20) | *à 20 h*, s'il **reste** des habitudes à cocher | l'heure oui, **la condition non** |
| `streak_at_risk` (`hour` = 21, `min_streak` = 3) | *à 21 h*, si une série ≥ 3 **est** menacée | idem |
| `inactivity` (`days` = 3) | N jours sans ouvrir une fiche du Savoir | **aucune heure du tout** |

Programmer bêtement une notification à 20 h, c'est annoncer « il te reste des
habitudes » à quelqu'un qui les a toutes cochées à 19 h. **Une notification
fausse est pire que pas de notification** — c'est celle qu'on désactive.

**Ce qui sauve la mise, et c'est une propriété réelle de Shale** : le front est
le seul écrivain de la base (`README.md` du module : « le front reste seul
écrivain »). Les données ne changent donc que pendant que l'app est ouverte.
On peut, à chaque passage en arrière-plan, évaluer les règles et
(re)programmer ou annuler les notifications en conséquence. L'état ne peut plus
bouger jusqu'à la prochaine ouverture.

**La fuite qui reste, et elle est directement causée par la sync** : si Antonin
coche ses habitudes sur le Mac, l'iPhone endormi n'en sait rien et notifiera à
tort. C'est le seul cas, mais c'est exactement son cas d'usage — deux appareils
synchronisés. Une notification push silencieuse est la seule parade propre.

### 3.3 Les trois voies, chiffrées

| | **A — Local seul** | **B — Push seul (APNs)** | **C — Local + push** |
|---|---|---|---|
| Rappels de tâches/habitudes | ✅ hors ligne | ❌ inutilement dépendant du réseau | ✅ |
| Briefings Market Brain 8 h / 14 h | ❌ **impossible** (§3.4) | ✅ | ✅ |
| Faux positifs après sync croisée | ⚠️ oui | ✅ non | ✅ résolu par push silencieux |
| Coût serveur | **zéro** | clé APNs + fonction planifiée Supabase + jetons + appels LLM côté serveur | idem B |
| Compte développeur Apple requis | non (simulateur) | **oui**, dès le développement | oui |
| Données qui sortent | **aucune** | jeton d'appareil, et le contenu du briefing transite | idem |
| Plafond iOS | 64 notifications en attente (limite Apple — **à revérifier**, elle a bougé par le passé) ; au-delà, seules les 64 plus proches survivent | sans objet | 64 pour la partie locale |

### 3.4 Pourquoi le briefing Market Brain ne peut pas être local

Vérifié : la génération vit **dans le front**, en TypeScript
(`src/lib/market/agent.ts` : « payload → LLM → mémoire »), et appelle un LLM par
le réseau. Un iPhone suspendu ne peut ni faire l'appel réseau, ni exécuter ce
code. **Ce n'est pas un défaut d'architecture** — c'est la conséquence d'avoir
mis l'intelligence côté client, ce qui est par ailleurs ce qui garde les
données chez l'utilisateur.

Le déplacer côté serveur n'est pas un portage : c'est **réécrire Market Brain**,
et y déplacer la clé d'API LLM — donc changer qui la paie et qui voit les
données de marché de l'utilisateur.

### 3.5 Ce que je recommande

**La voie A pour le squelette (Phase 3), la voie C comme cible — et la question
du briefing traitée séparément.**

Raisons :

1. La voie A **ne coûte rien et ne demande aucun compte Apple** : elle valide
   la chaîne complète (règle → programmation → réveil app fermée) dès le
   simulateur. C'est le jalon qui prouve le point fort du produit.
2. Les faux positifs de la voie A sont **bornés à un seul cas** (modification
   depuis un autre appareil) et cessent à la première ouverture de l'app.
   C'est un défaut acceptable pour un squelette, pas pour la version publiée.
3. Le briefing Market Brain est un chantier à part entière — pas une notification
   de plus. Le mêler à la décision « local ou push » ferait porter à toute la
   fonctionnalité notifications le coût d'un seul cas d'usage.

Un repli honnête existe pour le briefing sans aucun serveur : programmer une
notification locale à 8 h qui dit *« ton briefing t'attend »* et le générer à
l'ouverture. C'est moins bien — le briefing n'est pas prêt quand la bannière
tombe — mais c'est zéro euro et zéro donnée sortie.

### 3.6 L'autorisation

Ce que dit `emitter.rs` sur macOS ne vaut **pas** sur iOS. Sur macOS, le greffon
renvoie toujours `Granted` (des stubs) et `show()` jette son résultat — d'où le
choix, sain, de faire du centre in-app la source de vérité. Sur iOS,
l'autorisation est un vrai dialogue système, une seule fois, et un refus est
définitif dans l'app (il faut passer par Réglages).

Donc :

- **ne jamais la demander au premier lancement.** La demander au moment où
  Antonin active un rappel dans les préférences — là où la valeur est comprise ;
- **en cas de refus, l'app doit rester entière.** Elle l'est déjà par
  construction : le centre in-app reçoit toujours la notification, bannières
  coupées ou non. C'est un acquis, il faut juste ne pas le casser ;
- le bouton « envoyer une notification de test » (`notif_test`) prend sur iOS une
  valeur qu'il n'a pas sur macOS : il devient un vrai diagnostic, puisque le
  système répond.

---

## 4. Les raccourcis « dans la poche »

Tout ce qui suit est **hors de portée de Tauri** : ce sont des cibles natives
Swift dans le projet Xcode généré (`gen/apple/`), plus un **App Group** pour
partager les données entre l'app et l'extension.

⚠️ Le point à dire franchement : **une part du mobile ne sera pas du React.**
Un widget d'écran d'accueil est du SwiftUI qui lit des données ; il ne peut pas
afficher l'interface de Shale.

Et une contrainte qui commande le classement : **un widget ne peut pas lire
`shale.db` chiffrée ni déverrouiller la DEK.** Il faudra que l'app écrive, à
chaque mise à jour, un petit résumé en clair dans le conteneur de l'App Group.
C'est une **décision de confidentialité**, pas un détail d'implémentation.

| Fonction | Valeur pour Antonin | Coût Swift | Verdict |
|---|---|---|---|
| **App Shortcuts / Siri** — « Ajoute une tâche à Shale » | forte : c'est la capture rapide ⌥Espace, version poche | **faible** — un `AppIntent`, pas d'interface | ✅ **à faire en premier** |
| **Extension de partage** — envoyer une page/texte vers le Savoir | forte, très « mobile » | moyen — une petite interface | ✅ ensuite |
| **Widget écran d'accueil** — tâches du jour, anneau discipline | moyenne : consultation, pas action | moyen + **le résumé en clair** | ⚠️ après décision confidentialité |
| **Widget écran de verrouillage** | faible (redit le widget) | faible **une fois** le précédent fait | ➖ gratuit ensuite |
| **Contrôle du Centre de contrôle** | faible | moyen | ❌ pas maintenant |

### 4.1 ✅ Décision : un geste physique qui ouvre la note rapide

Antonin a tranché sur l'intention : *« une touche sur le téléphone qui me permet
d'ouvrir les notes rapides »*. C'est l'équivalent poche de ⌥Espace.

**Une seule chose à écrire en Swift : un `AppIntent`** — quelques dizaines de
lignes, aucune interface. Il ouvre l'app directement sur le composeur de note.
Une fois qu'il existe, iOS l'expose **partout, gratuitement** :

| Surface | Ce qu'Antonin fait | Condition |
|---|---|---|
| **Bouton Action** ⭐ *retenu par Antonin* | maintient le bouton latéral → la note s'ouvre | ⚠️ **iPhone 15 Pro et plus uniquement.** À vérifier sur son téléphone — sinon le Toucher au dos donne le même geste sur tout iPhone récent |
| **Toucher au dos** | tapote deux fois le dos du téléphone | tout iPhone récent — Réglages → Accessibilité → Toucher → Toucher au dos |
| **Écran d'accueil** | une icône dédiée, à côté de celle de Shale | aucune |
| **Siri / Spotlight** | « Nouvelle note Shale » | aucune |

**Les widgets ne sont pas retenus.** Ils exigeaient que l'app écrive un résumé
**en clair** dans un conteneur partagé — un compromis de confidentialité qui
n'avait de sens que pour de la consultation. La décision d'Antonin porte sur un
geste d'**action**, pas d'affichage : la question tombe d'elle-même.

⚠️ **Une limite à connaître, et elle est structurelle.** L'intent *ouvre* l'app,
il n'écrit pas tout seul. Une version « dicter la note à Siri sans ouvrir Shale »
demanderait au Swift d'écrire dans `shale.db` — ce qui casserait l'invariant
« le front est seul écrivain » sur lequel repose tout le module notifications
(§3.2) et la sync. Ce n'est pas un raffinement à ajouter plus tard sans y
réfléchir : c'est un changement d'architecture.

---

## 5. Le design mobile

### 5.1 Ce que le chantier responsive couvre déjà — et ce qu'il ne couvrira jamais

`DESIGN.md` porte déjà : échelles fluides `clamp()`, espacements fluides, quatre
points de rupture nommés (`xs` 420, `sm` 600, `md` 900, `lg` 1200), et surtout
une règle de **cibles tactiles** conditionnée à
`@media (max-width: 900px), (pointer: coarse)` — c'est-à-dire au *matériel de
pointage*, pas à la largeur. Cette règle-là s'applique à l'iPhone sans
modification.

Ce qui ne franchira pas le pas, parce qu'un téléphone n'est pas une fenêtre
étroite :

- `minWidth: 720` est un plancher de **fenêtre**. Un iPhone fait ~390 pt de
  large. La barre latérale repliée en icônes sous 1024 px (`Sidebar.tsx`) est
  une réponse au Split View, **pas** à un écran de 390 pt : 64 px de barre sur
  390, c'est encore 16 % de l'écran, en permanence, pour de la navigation ;
- **le survol n'existe pas.** Les « Hover Hints » (`DESIGN.md` § Info-bulle) sont
  un système entier de l'app. Sur iPhone, ils ne se déclenchent jamais ;
- zones sûres (encoche, barre d'accueil), clavier logiciel qui recouvre les
  champs, Dynamic Type : aucun n'a d'équivalent sur bureau ;
- ⚠️ **la divergence px/rem déjà ouverte dans `DESIGN.md`** (« l'app est encore
  en pixels ») devient beaucoup plus grave sur iPhone : le Dynamic Type est un
  réglage que les gens utilisent réellement. Une app en pixels durs y est
  insensible. Ce n'est plus une question esthétique, c'est de l'accessibilité.

### 5.2 La grille d'Aujourd'hui : il n'y a rien à faire, et c'est mesuré

Le cahier des charges demande de traiter « le même risque d'intégrité de données
que celui déjà signalé sur le chantier responsive ». **Le chantier responsive a
conclu l'inverse, en mesurant.** `DESIGN.md` :

> `ResizableGrid` est **déjà** container-responsive, et par construction : le
> plancher d'un panneau est exprimé en PIXELS (`MIN_PANEL_PX = 248`) puis traduit
> en colonnes d'après la largeur **mesurée** de la grille — jamais d'après un
> breakpoint de fenêtre. […] une disposition écrite à 1440 px, la fenêtre réduite
> à 720 puis ramenée à 1440 — la valeur stockée est identique au caractère près.
> […] **Écrire une migration des dispositions réécrirait la donnée qui,
> aujourd'hui, survit intacte.**

Sur iPhone, 390 pt de large contre un plancher de 248 px : la grille tombera à
une colonne. Le clamp vit au **rendu** ; `persistSizes` n'est appelé que sur
action de l'utilisateur. **La disposition du Mac survit donc intacte à un
passage sur iPhone, sans rien écrire.**

Ce qui reste à trancher n'est pas l'intégrité, c'est l'**ergonomie** : les
poignées de redimensionnement n'ont aucun sens au doigt et doivent être
masquées sous `(pointer: coarse)`.

### 5.3 Les douze modules

Règle par défaut : **présent**. Toute exception est argumentée.

| Module | Sur iPhone | Pourquoi |
|---|---|---|
| **Aujourd'hui** | plein usage, **repensé** | grille → pile verticale ; c'est l'écran d'accueil naturel |
| **Tâches** | plein usage | le cas d'usage mobile par excellence |
| **Timer** | plein usage | ⚠️ un timer suspendu par iOS doit se rattraper sur l'horloge murale, comme le fait déjà `scheduler.rs` |
| **Objectifs** | plein usage | listes et progression, rien de spécifique au bureau |
| **Performance** | **consultation** | graphiques `recharts` denses ; lisibles, pas manipulables au doigt |
| **Finance** | plein usage | saisie de montants ; le correctif « le champ montant ne se réécrit plus sous les doigts » (`4744ea0`) est justement à revérifier au clavier logiciel |
| **Notes** | plein usage | ⚠️ `SketchPad` (croquis) est du pointeur : à porter au tactile, où il sera *meilleur* qu'à la souris |
| **Journal** | plein usage | saisie de texte |
| **Savoir** | plein usage | + c'est la cible de l'extension de partage (§4) |
| **Trading** | plein usage | ⚠️ `import_screenshot` passe par un chemin de fichier : à refaire via le sélecteur de photos |
| **Market Brain** | **consultation** | la génération est côté client et coûteuse ; §3.4 |
| **Position** (sizing) | plein usage | calculateur : idéal en mobilité |
| *Réglages* | plein usage | |
| *Personnaliser* | **repensé** | l'ordre des modules garde du sens ; la « taille de fenêtre » (`AdminView.tsx`, `setSize`/`innerSize`/`scaleFactor`) n'en a aucun et doit disparaître de l'écran iOS, pas échouer silencieusement |

**Aucun module absent.** Deux en consultation, pour des raisons de densité et de
coût, pas de principe.

### 5.4 La navigation — à trancher

Douze modules + Réglages + Personnaliser = **14 destinations**. Aucune barre
d'onglets iOS n'en porte plus de 5.

#### ⚠️ Correction : il y a DEUX offres, et ma première proposition les ignorait

`src/lib/features.ts` est la source unique de la frontière commerciale :

```ts
export const TRADING_VIEWS = ["trading", "market", "sizing"] as const;
```

- **Shale** — 9 modules : Aujourd'hui, Tâches, Timer, Objectifs, Performance,
  Finance, Notes, Journal, Savoir ;
- **Shale Trade** — les 9 précédents **plus** Trading, Market Brain, Position.

Ma première proposition mettait **Trading en 4ᵉ onglet**. C'était faux : ce
module n'existe pas dans l'offre Shale. Un onglet permanent qui ouvre un
paywall est le pire endroit possible pour un mur de paiement.

Nuance qui compte, vérifiée dans `Sidebar.tsx` : les modules trading ne sont pas
**masqués** pour un compte Shale, ils sont **verrouillés et visibles**
(`isLocked`), avec l'argumentaire `TRADING_PITCH`. C'est le levier de
conversion, et il ne doit pas disparaître sur mobile.

#### ✅ Décision : 4 onglets communs aux deux offres, + « Plus »

**Aujourd'hui · Tâches · Notes · Journal · Plus**

Identique dans les deux offres. Les trois raisons :

1. **Ces quatre modules existent dans toutes les offres** — aucun onglet ne peut
   jamais afficher un cadenas ;
2. **ce sont les quatre où l'on ÉCRIT.** Un téléphone sert à capturer, pas à
   analyser : c'est aussi ce qui justifie que Performance et Market Brain soient
   en consultation (§5.3) ;
3. **aucune donnée nouvelle.** « Plus » ouvre la liste complète, dans l'ordre de
   `uiConfig.modules` — déjà personnalisable, déjà synchronisé — et affiche les
   modules trading **verrouillés** exactement comme la barre latérale.

Trading, Market Brain et Position sont donc à **deux touches** au lieu d'une pour
un abonné Shale Trade. C'est le prix d'une barre identique dans les deux offres,
et il est assumé : l'alternative — une barre qui change de forme selon l'offre —
donnerait deux apps différentes à documenter, à tester et à montrer sur le site.

#### ⚠️ Ce que les deux offres déclenchent côté App Store, et qui est nouveau

Aujourd'hui `STRIPE_ENABLED = false` : tout est déverrouillé, `entitlementsOf`
renvoie `shale_trade` à tout le monde, et la question dort.

**Le jour où il passe à `true` sur iOS, `TRADING_PITCH` devient un mur de
paiement pour du contenu numérique — et Apple exige alors son propre système
d'achat intégré** (règle 3.1.1), avec sa commission. Un paywall qui renvoie vers
le site pour payer est le motif de refus le plus courant de l'App Store.

Ce n'est pas un problème de code, et il ne se règle pas en Phase 3. Mais il
change la nature de la décision « abonnements » (§7.2) : elle ne porte plus
seulement sur *comment encaisser*, mais sur **si les deux offres peuvent exister
telles quelles sur iPhone**. À instruire avant de publier, pas avant de coder.

#### ✅ Décision : barre à 5, catégories conservées dans « Plus »

La réserve était que `Sidebar.tsx` groupe les modules en **catégories**
(`CATEGORIES` : « prod », « trading ») et que le site reproduit cette barre dans
sa démo jouable — une barre d'onglets à plat romprait ce vocabulaire.

**La résolution ne coûte rien : les catégories deviennent les intertitres de
l'écran « Plus ».** Le vocabulaire est conservé là où il porte du sens — la
liste complète — et absent là où il coûterait un niveau de navigation. Les cinq
onglets restent à plat.

Pourquoi ce n'est pas une divergence vis-à-vis du site : la règle de non-
divergence porte sur **l'ensemble des modules, leurs noms et ce qu'ils font**,
pas sur la géométrie du conteneur. Une barre latérale et une barre d'onglets sont
deux surfaces du même produit — au même titre que la barre latérale repliée en
icônes sous 1024 px n'a jamais été considérée comme une divergence.

⚠️ Ce qu'il faudra malgré tout porter au site : la démo jouable montre
aujourd'hui **une** interface. Le jour où iOS existe, elle en montre une qui
n'est pas celle de tout le monde. C'est une entrée à ajouter à la table de
`CLAUDE.md`, pas un blocage.

---

## 6. La sync — l'atout, et sa seule vraie inconnue

Ce qui a été vérifié :

- `src/lib/sync/crypto.ts` est **pur** : « il ne connaît ni Tauri, ni le réseau,
  ni la base ». AES-256-GCM, HKDF, HMAC-SHA-256, via WebCrypto. **Rien de macOS ;**
- la dérivation Argon2id passe par le Rust (`crypto.rs`, `kdf_argon2id`) —
  `argon2 = "0.5"` est du Rust pur, **il compile pour iOS** ;
- le schéma, les enveloppes, l'aveuglement des identifiants : tout est dans le
  code partagé. **Aucune migration de schéma n'est nécessaire pour iOS**, et
  aucune n'est proposée ici.

### ✅ L'inconnue est levée — mesurée sur le simulateur le 2026-08-27

C'était **le risque n°1 du projet**, avant même les notifications :
`crypto.subtle` n'existe que dans un « contexte sécurisé », et rien ne
garantissait que le schéma personnalisé servant l'app sur iOS en soit un. S'il
avait manqué, toute la synchronisation chiffrée tombait.

**Mesuré dans l'app réelle, sur iPhone 17 (iOS 26.5) :**

```
crypto.subtle   = object
isSecureContext = true
origin          = tauri://localhost
```

**WebCrypto est disponible. La synchronisation chiffrée de bout en bout
fonctionne telle quelle sur iPhone** — AES-256-GCM, HKDF et HMAC compris.
Aucune cryptographie à déplacer vers le Rust, aucun chantier à ouvrir. Le repli
envisagé (porter AES-GCM et HKDF côté Rust, comme Argon2 l'est déjà) **n'a pas
lieu d'être**.

⚠️ **Comment la mesure a été faite, parce que le premier essai a échoué.**
Le diagnostic était d'abord un `console.log`. Il n'a rien produit :
**sur iOS, la console d'une WKWebView ne remonte PAS dans le journal système**
— `log show` ne trouve rien, même avec le bon prédicat. Le diagnostic a donc été
réécrit en **bannière affichée à l'écran**, puis photographié. À retenir pour
tout futur débogage mobile : ce qui se voit se prouve, ce qui se journalise ne
se voit pas.

---

## 7. App Store — les contraintes qui décident du produit

*Documenté, non traité à cette phase.*

### 7.1 Règle 4.2 — fonctionnalité minimale

Une app de bureau reconditionnée se fait rejeter. **C'est précisément les
notifications (§3) et les raccourcis (§4) qui constituent la réponse** : ce sont
eux qui font qu'une app mobile est une app mobile et pas un site emballé.

Autrement dit : le point fort revendiqué du produit et la condition d'admission
à l'App Store sont **la même chose**. Les traiter comme deux sujets serait une
erreur.

### 7.2 Abonnements

`STRIPE_ENABLED = false` (`src/lib/auth/config.ts:100`) cesse d'être un
interrupteur pour devenir une décision structurante : achats intégrés Apple,
paiement alternatif, ou renvoi vers le site.

⚠️ Le cahier des charges affirme que « les conditions européennes changent au
1er octobre 2026 ». **Je ne peux ni le confirmer ni l'infirmer** — c'est
postérieur à ce que je sais. À vérifier à la source avant d'en tirer quoi que ce
soit. Le sujet est indépendant du code et n'a pas à être tranché maintenant.

### 7.3 Market Brain et le regard porté sur les apps financières

Market Brain produit du **biais de marché** et des **niveaux**. Une app qui
affiche ça est examinée de près, et Apple ne distingue pas « journal personnel »
de « conseil » sans qu'on le lui dise.

Ce qui existe, et il faut le porter au crédit du projet : `prompt.ts:20`
contraint explicitement le modèle — « Pas de conseil financier personnalisé, pas
de promesse de gain. Ce sont des scénarios conditionnels. »

Ce qui manque : **cette garantie n'est visible nulle part à l'écran.** C'est une
consigne donnée au modèle, pas un avertissement lu par l'utilisateur — et c'est
l'utilisateur, pas le modèle, qu'un examinateur Apple regarde. Il faudra un
positionnement explicite — *journal et outil personnel, pas conseil en
investissement* — visible dans `MarketBrainView.tsx`, pas seulement dans les CGU
du site.

---

## 8. Ce qu'Antonin doit faire lui-même, en gestes d'interface

**Rien de tout cela ne peut être fait à sa place.**

### 8.1 Installer Xcode — indispensable, et c'est le blocage n°1

1. Ouvrir l'**App Store** (l'icône bleue avec un « A », dans le Dock ou par
   Launchpad).
2. Dans le champ de recherche en haut à gauche, taper **Xcode**, puis Entrée.
3. Sur la fiche **Xcode** (éditeur : Apple), cliquer sur **Obtenir**, puis sur
   **Installer**.
4. C'est un très gros téléchargement (plus de 10 Go) : compter un long moment.
5. Une fois installé, **ouvrir Xcode une première fois**. Une fenêtre propose
   d'installer des composants supplémentaires : cliquer sur **Install** et
   saisir le mot de passe du Mac quand il est demandé.
6. Dans la barre de menus, **Xcode → Settings…**, onglet **Platforms** :
   vérifier que **iOS** apparaît avec une pastille verte. Sinon, cliquer sur le
   bouton **+** en bas à gauche et choisir **iOS**.

Sans cette étape, **la Phase 3 est impossible** : ni simulateur, ni compilation.

### 8.2 Fermer les autres sessions Claude

Trois autres sessions écrivent dans `~/Desktop/Shale` en ce moment. Tant
qu'elles tournent, aucun commit propre n'est possible. Les terminer avant de
relancer le chantier iOS.

### 8.3 Ce qui n'est PAS nécessaire tout de suite

Le **compte développeur Apple** (99 €/an) n'est requis que pour installer sur un
iPhone réel et pour publier. **Le simulateur iOS n'en demande aucun.** Toute la
Phase 3 telle qu'elle est décrite peut se faire sans dépenser un euro — sauf si
la voie push (§3.3 B ou C) est retenue, auquel cas le compte devient nécessaire
dès le développement.

---

## 8 bis. Ce que la Phase 3 a réellement prouvé (2026-08-27, ~1 h du matin)

Tout ce qui suit a été **exécuté**, pas supposé.

| Jalon | Résultat |
|---|---|
| Cible iOS initialisée (`tauri ios init`) | ✅ `gen/apple/shale.xcodeproj` |
| Compilation Rust pour `aarch64-apple-ios-sim` | ✅ |
| `Shale.app` installé et lancé sur iPhone 17 (iOS 26.5) | ✅ |
| Écran de connexion, marque, typographie, design V6 | ✅ rendus correctement, en français |
| `crypto.subtle` dans la webview iOS | ✅ **disponible** (§ 6) |
| macOS après coup | ✅ `cargo check --all-targets`, `cargo test --lib`, `test:types` |

### Deux prédictions de l'audit, confirmées à l'écran

**1. La deuxième fenêtre `capture` déborde sur mobile.** § 2.2 l'annonçait sans
pouvoir le prouver. La première capture d'écran l'a montré : la barre « Capture
une tâche… ⏎ AJOUTER · ÉCHAP FERMER » flottait **par-dessus** l'écran de
connexion. Sur iPhone il n'y a pas de seconde fenêtre : elle se superpose.

**Corrigé** par `src-tauri/tauri.ios.conf.json`, qui ne déclare que la fenêtre
principale — le mécanisme officiel de Tauri pour les réglages par plateforme.
`tauri.conf.json` n'est pas touché, donc **macOS est inchangé d'un octet**.

**2. Les gardes `cfg` héritées de Windows étaient fausses pour iOS.** Elles
disaient « macOS ou pas macOS » ; iOS n'étant pas macOS, le téléphone aurait
hérité du raccourci **Windows** `Ctrl+Alt+Espace`. Corrigé avant la première
compilation (commit `042f750`).

### ⚠️ Deux pièges d'outillage à ne pas re-diagnostiquer

**`tauri ios build` ne remplace pas une sortie existante.** Il échoue sur
`failed to rename app … Directory not empty`, et — c'est le piège — **le code
de sortie reste 0**. On croit avoir reconstruit, on installe l'ancienne app, et
on lit un résultat périmé. C'est arrivé une fois. **Supprimer
`gen/apple/build/arm64-sim/Shale.app` et `gen/apple/build/shale_iOS.xcarchive`
entre deux builds.**

**Le panneau interactif du simulateur peut lire une configuration périmée.**
Son serveur relève `xcode-select` à son démarrage : lancé avant l'installation
d'Xcode, il réclame indéfiniment un `sudo xcode-select -s …` **déjà inutile**.
Vérifier `xcode-select -p` avant de transmettre cette consigne à Antonin —
elle demanderait son mot de passe pour rien. `xcrun simctl` fait le même travail.

### L'outillage, et pourquoi il a coûté cher

Trois outils manquaient, et aucun n'était prévu par le cahier des charges :

| Outil | Obtention |
|---|---|
| **XcodeGen** | compilé depuis la source (Swift 6.3 d'Xcode) → `~/.local/bin` |
| **CocoaPods** | ⚠️ impossible sans Homebrew : exige Ruby ≥ 3.1, or macOS ne fournit que **Ruby 2.6.10** (2019). Figer les versions à la main mène de `ffi` à `securerandom` à `zeitwerk`, chacune réclamant un Ruby plus récent. **Cul-de-sac.** |
| **libimobiledevice** | idem — et `autoconf`/`pkg-config` manquent aussi |

Résolu par **Homebrew**, installé via un fichier `.command` à double-cliquer
posé sur le Bureau — conformément à la règle « Antonin n'utilise jamais le
Terminal », dont l'ordre de préférence prévoit exactement ce cas. Seul son mot
de passe Mac lui a été demandé, par macOS lui-même.

⚠️ **Ne pas retenter la voie « gems figés à la main »** : elle a été explorée
jusqu'au bout, elle ne mène nulle part sur Ruby 2.6.

## 9. La parité, mécaniquement — table à trois têtes

*Amorce. À compléter quand les décisions de §10 seront prises.*

Extension de la table « ce qui existe en plusieurs exemplaires » de `SHALE.md` §8.

| Valeur | macOS | Windows | iOS |
|---|---|---|---|
| `STRIPE_ENABLED` | `src/lib/auth/config.ts:100` | copie du worktree | **même fichier** (base unique) — mais l'App Store peut imposer une valeur différente : **première divergence légitime prévisible** |
| Raccourci de capture | `CAPTURE_SHORTCUT` dans `lib.rs` + `platform.ts` | `Ctrl+Alt+Espace` | **néant** — remplacé par un App Shortcut Siri (§4) |
| Le nombre « douze modules » | ~10 endroits en toutes lettres | idem | idem — **et le site devra dire « sur iPhone aussi »** |
| Moteur de rappels | `scheduler.rs`, boucle 60 s | idem | **notifications programmées** — même *règles*, planificateur différent |
| Trousseau | `keyring` `macos.rs` | (non porté) | `keyring` `ios.rs`, **même code appelant** |
| Design | `src/index.css` | idem | **même fichier** + zones sûres et `(pointer: coarse)` |

**Contrôle automatisable proposé** — modeste, et c'est délibéré : un script qui
compare, entre les trois plateformes, la liste des vues de `src/views/`, les
`MODULE_IDS` de `uiConfig.ts` et les clés d'`i18n`, et qui **échoue** dès qu'un
élément existe ici et pas là. Le dépôt a déjà `tools/i18n-check.mjs` : c'est le
même moule, et il n'y a donc rien de nouveau à inventer.

Un garde-fou imparfait vaut mieux qu'une relecture — **on sait maintenant que la
relecture a laissé passer un module entier** (§0.3).

---

## 10. Décisions prises (2026-08-26)

| # | Décision | Statut |
|---|---|---|
| 1 | **Réconcilier Windows avant tout iOS** | ✅ **fait le 2026-08-26** — commit `4ca4080`, tronc avancé. Détail en §11 |
| 2 | Notifications : **local + push (voie C)** | ✅ **arrêté.** Antonin veut « que Mac et téléphone soient liés dans tous les cas » — c'est exactement ce que le push silencieux résout, et lui seul (§3.2). Le compte développeur étant de toute façon nécessaire pour publier, l'argument « A est gratuit » perd son poids. **Ordre de construction : le local d'abord** (Phase 3, testable au simulateur sans compte), le push ensuite. |
| 3 | Briefing Market Brain : **le repli gratuit** — notification locale « ton briefing t'attend » à 8 h et 14 h, génération à l'ouverture de l'app | ✅ **arrêté**. Zéro serveur, zéro euro, zéro donnée sortie, et la clé LLM reste sur l'appareil. Le briefing n'est pas prêt quand la bannière tombe : **c'est le compromis accepté.** |
| 4 | Raccourcis natifs : un **geste physique qui ouvre la note rapide** | ✅ **arrêté sur l'intention.** Mise en œuvre : un `AppIntent` (§4.1) |
| 5 | Navigation mobile | ✅ **tranché** — barre d'onglets à 5 + « Plus » sectionné par catégories (§5.4) |
| 6 | Grille Aujourd'hui : **ne rien faire** | ✅ **arrêté** — conforme à la mesure du chantier responsive |
| 7 | **Performance** et **Market Brain** en consultation seule ; aucun module absent | ✅ **arrêté** |
| — | Résumé en clair pour les widgets d'écran d'accueil | ❌ **sans objet** — les widgets ne sont pas retenus (§4.1), la question de confidentialité disparaît avec eux |

---

## 11. Le plan de réconciliation Windows — mesuré, pas supposé

**Sens de la fusion : `windows-build` → le tronc.** Pas l'inverse. L'objectif
n'est pas de rattraper une branche, c'est de la faire **disparaître** : après
cette fusion, il n'y a plus de « version Windows », il y a une base unique où les
différences de plateforme vivent sous `cfg` et dans `platform.ts`. C'est la
condition d'entrée d'iOS.

### 11.1 Ce que la fusion à blanc donne (`git merge-tree`, en mémoire)

Base de fusion : `9a88795`. **Trois conflits seulement** — tout le reste
s'auto-résout, `src-tauri/src/lib.rs` et `tauri.conf.json` compris.

| Fichier en conflit | Nature | Résolution prévue |
|---|---|---|
| `CLAUDE.md` | les deux branches ont écrit des sections datées différentes | **garder les deux**, dans l'ordre chronologique |
| `src/lib/i18n/en.ts` | le tronc a ajouté Finance, Windows a reformulé les phrases qui mentionnaient macOS | **garder les deux** : les clés Finance du tronc **et** les reformulations neutres de Windows |
| `tsconfig.test.json` | divergence de configuration de test | à lire ligne à ligne |

### 11.2 Ce que la fusion arbitre correctement toute seule — vérifié sur l'arbre produit

| Fichier | Résultat | Pourquoi c'est juste |
|---|---|---|
| `src/lib/platform.ts` (+ `.test.ts`) | **arrive sur le tronc** | c'est le module que le cahier des charges croyait déjà là. Il est aussi le point d'extension d'iOS. |
| `src/views/FinanceView.tsx`, `src/lib/finance/**`, `018_finance.sql` | **conservés** | Windows n'y a jamais touché : rien à réconcilier |
| `BenchmarkView.tsx`, `benchmark.ts`, `BenchmarkPanel`, `BenchmarkTests`, `PreSessionCheck`, `tones.ts` | **restent supprimés** | le tronc les a retirés délibérément (`019_drop_benchmark.sql`) ; Windows ne les avait qu'en retard. `tones.ts` part avec eux : il n'était importé que par `BenchmarkTests.tsx` |
| `src-tauri/examples/transcribe.rs` | **reste supprimé** | ⭐ voir ci-dessous |
| `RECETTE-WINDOWS.md` | **arrive** | procédure d'acceptation Windows, toujours valable |

### 11.3 ⭐ La fusion corrige gratuitement l'échec connu de `cargo check --all-targets`

`src-tauri/examples/transcribe.rs` vit encore sur le tronc et importe
`whisper_rs` et `hound` — **deux crates absentes du `Cargo.toml`**, vestiges de
Jarvis manqués par la purge du 2026-07-26. C'est la cause de l'échec que la
consigne demandait de ne pas re-diagnostiquer.

`windows-build` l'a supprimé le 2026-08-05 (`7e4e51d`), justement parce qu'il
« cassait `cargo test` sur toutes les cibles ». **La fusion propage cette
suppression.** L'échec connu disparaît sans qu'on ait à le traiter.

### 11.4 Ce que la fusion apporte aussi, et qui sert directement iOS

Le commit `7e4e51d` avait déjà corrigé, sous `cfg`, deux défauts que l'audit iOS
retrouve mot pour mot en §2.2 :

- `RunEvent::Reopen` matché sans garde, alors qu'il est `#[cfg(target_os = "macos")]` ;
- `keyring` figé sur `apple-native`, désormais **choisi par cible**.

Autrement dit : **une partie du travail de portage iOS est déjà faite, sur une
branche que personne ne regardait.** C'est l'argument le plus concret en faveur
de la base unique.

### 11.5 Ce qui reste à faire à la main après la fusion

1. Résoudre les trois conflits (§11.1).
2. Étendre `platform.ts` : il ne connaît que `IS_MAC` / Windows. iOS est un
   troisième cas, et `CAPTURE_SHORTCUT` n'y a **aucun sens** (§9).
3. Rejouer la ligne de base : `cargo test --lib` (88), `npm run test:types`,
   `npm test`, et cette fois **`cargo check --all-targets`**, qui doit passer.
4. Mettre à jour la table de `CLAUDE.md` § « l'app et le site ne divergent
   jamais » : elle est écrite pour deux surfaces, il en faudra trois.

---

## 12. ▶️ REPRENDRE ICI (état au 2026-08-27, 01 h 45)

**Branche `mobile-ios`**, cinq commits, **rien n'est poussé sur GitHub**.
Le tronc (`sync-chiffree`) porte la réconciliation Windows (`4ca4080`).

### Ce qui est prouvé, exécuté, commité

| | |
|---|---|
| Réconciliation Windows | `4ca4080` — plus de branche par plateforme |
| Audit iOS | `c6b5867` — ce fichier |
| Rust sous `cfg(desktop)` + `keyring` iOS | `042f750` |
| L'app tourne sur iPhone 17, `crypto.subtle` disponible | `5ebc08b` |
| Barre d'onglets mobile | `360bd19` — **jamais vue à l'écran**, voir ci-dessous |

Ligne de base, rejouée à chaque commit : `cargo check --all-targets` ✅ ·
`cargo test --lib` 88 ✅ · `test:types` ✅ · `npm test` 381 ✅ ·
`i18n:check` 1046 entrées, 0 manquante ✅

### ⚠️ LE BLOCAGE, et il n'est pas technique

**L'app est au mur de connexion sur le simulateur, et personne ne l'a
franchi.** Claude ne saisit pas les identifiants d'Antonin — règle non
négociable. Tout ce qui vit derrière ce mur est donc **écrit mais non
vérifié** :

1. **La barre d'onglets n'a jamais été vue.** Tiennent-elles sur 393 pt ? Les
   libellés se tronquent-ils ? La feuille « Plus » s'ouvre-t-elle ? La zone
   sûre du bas est-elle juste ?
2. **`shale.db` n'existe pas** dans le conteneur de l'app — aucune vue n'a
   interrogé la base. Les 19 migrations n'ont donc **jamais tourné sur iOS**.
3. **La sync chiffrée n'a jamais été essayée** entre le Mac et l'iPhone.

**Première action de la prochaine session : demander à Antonin de se
connecter dans le simulateur**, puis capturer l'écran.

### La procédure qui marche, à ne pas redécouvrir

```
1. xcrun simctl boot "iPhone 17"
2. rm -rf gen/apple/build/arm64-sim/Shale.app gen/apple/build/shale_iOS.xcarchive
3. PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH" npm run tauri ios build -- --debug --target aarch64-sim
4. xcrun simctl install booted <…>/build/arm64-sim/Shale.app
5. xcrun simctl launch booted com.atnfx.shale
6. open -a Simulator   (pour qu'Antonin voie et agisse)
```

⚠️ **L'étape 2 n'est pas optionnelle** : `tauri ios build` échoue sur une
sortie existante (« Directory not empty ») **en rendant un code de sortie 0**.
Sans elle, on installe l'ancienne app et on lit un résultat périmé.

⚠️ **Attendre ~10 s avant la première capture** : une capture prise trop tôt
montre un écran blanc, qui ressemble à s'y méprendre à une régression. C'est
arrivé, et j'ai annoncé à tort avoir cassé quelque chose.

### Outils installés ce soir (ne pas les réinstaller)

Homebrew (`/opt/homebrew`), CocoaPods 1.17, libimobiledevice, XcodeGen 2.46
(compilé depuis la source, dans `~/.local/bin`), cibles Rust iOS, runtime
simulateur iOS 26.5.

⚠️ **Le panneau interactif du simulateur reste indisponible** tant que sa
session n'est pas relancée : son serveur a lu `xcode-select` avant l'install
d'Xcode. Son message réclame un `sudo` **inutile** — vérifier `xcode-select -p`
avant de transmettre quoi que ce soit à Antonin. `xcrun simctl` suffit.

### Ce qui reste de la Phase 3

- **La notification locale de bout en bout** — programmée depuis l'app, reçue
  app fermée. C'est LE jalon qui valide le point fort du produit, et il n'est
  pas commencé. Le moteur Rust tourne déjà sur iOS (`notifications.json` écrit,
  `last_run_at` renseigné), mais rien n'est encore PROGRAMMÉ auprès d'iOS.
- **Un module réellement fonctionnel** (Aujourd'hui ou Tâches), une fois le
  mur franchi.
- **L'`AppIntent`** du bouton latéral (§ 4.1) — Swift, non commencé.

### Décisions déjà prises — ne pas les rouvrir

§ 10 fait foi : local + push, briefing en repli gratuit, `AppIntent` pour la
note rapide, barre à 4 onglets + « Plus », grille d'Aujourd'hui inchangée,
Performance et Market Brain en consultation. Aucun module absent.
