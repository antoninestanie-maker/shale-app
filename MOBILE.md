# Shale sur iPhone — audit, puis journal de portage

> ## ▶️ Vous arrivez sur ce document ? Allez au **§ 17**.
>
> Il donne l'état exact, la file d'attente par ordre, et ce qu'une session
> Claude ne peut pas faire seule. Le reste se lit à la demande.

**§ 0 à 14 : l'audit**, daté du 2026-08-26, écrit avant qu'une ligne de code
iOS n'existe. Branche examinée : `responsive`, commit `749b981` — le même que
`sync-chiffree`, vérifié dans les deux sens.

**§ 15 à 17 : le journal du portage**, depuis le 2026-08-27. L'audit n'a pas
été réécrit après coup : là où il s'est trompé, la correction est datée à
l'endroit de l'erreur plutôt que substituée à elle. C'est volontaire — un
raisonnement faux qu'on efface se refait.

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

### ⚠️ Cinq pièges d'outillage à ne pas re-diagnostiquer

**`tauri ios build` ne remplace pas une sortie existante.** Il échoue sur
`failed to rename app … Directory not empty`, et — c'est le piège — **le code
de sortie reste 0**. On croit avoir reconstruit, on installe l'ancienne app, et
on lit un résultat périmé. C'est arrivé une fois. **Supprimer
`gen/apple/build/arm64-sim/Shale.app` et `gen/apple/build/shale_iOS.xcarchive`
entre deux builds.**

**Le piège s'est retendu une troisième fois, le 2026-08-27 au matin.** Un `cd`
laissé d'une commande précédente a fait porter le `rm -rf` sur un chemin relatif
qui n'existait pas depuis là. Le nettoyage n'a pas eu lieu, le build a réutilisé
sa sortie périmée, et le code de sortie est resté 0 — l'app installée ne
contenait pas une ligne du Swift qu'on venait d'écrire. **Nettoyer en chemin
ABSOLU**, toujours.

**`tauri ios build` NE RELANCE PAS XcodeGen.** Il consomme le `.pbxproj` tel
qu'il est. Ajouter un fichier source sous `gen/apple/Sources/` ne suffit donc
pas : il faut lancer `xcodegen generate` dans `gen/apple`. Sans ça le fichier
est simplement absent de la compilation, sans le moindre avertissement. Le
`.pbxproj` étant suivi par git, le résultat se relit —
`grep -c "MonFichier.swift in Sources"`.

**Régénérer APRÈS un premier build embarque `libapp.a` dans le bundle.**
XcodeGen classe l'archive statique produite par le build en RESSOURCE et la
recopie dans l'app. `excludes: ["**/*.a"]` sur le groupe `Externals` de
`project.yml` le règle définitivement ; le lien, lui, vient de
`dependencies: framework: libapp.a`, pas de ce groupe.

**~~Le panneau interactif du simulateur peut lire une configuration périmée.~~**
~~Son serveur relève `xcode-select` à son démarrage.~~

⚠️ **CORRECTION DU 2026-08-27, 11 h 40 — ce document a dit le contraire trois
fois, et il avait TORT.** Le panneau interactif du simulateur réclame un
`sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`. Trois
rédactions successives ont conclu « commande inutile, `xcode-select -p` renvoie
déjà le bon chemin — ne pas la transmettre à Antonin ». **C'était une erreur de
diagnostic, et elle a coûté une demi-journée de navigation impossible.**

Ce qui a été mesuré, enfin :

```
DEVELOPER_DIR                 : (vide)
/var/db/xcode_select_link     : n'existe pas
xcode-select -p               : /Applications/Xcode.app/Contents/Developer
env -i /usr/bin/xcode-select -p : /Applications/Xcode.app/Contents/Developer
```

`xcode-select -p` répond bien — **mais par REPLI**. Sans le lien
`/var/db/xcode_select_link`, il cherche Xcode aux emplacements par défaut et le
trouve. Rien n'est donc *sélectionné* : Xcode est seulement *trouvé*. Les
compilations marchent (elles se contentent du repli) ; l'outil, lui, exige la
sélection explicite, et il a raison de la distinguer.

**La leçon, et elle vaut au-delà de ce cas :** `xcode-select -p` ne répond pas
à la question « Xcode est-il sélectionné ? », il répond à « quel dossier de
développement sera utilisé ? ». Vérifier la SÉLECTION, c'est regarder
`/var/db/xcode_select_link`. Trois fois de suite, la mauvaise question a rendu
la bonne réponse à une autre question.

**Ce qu'il faut faire — et sans Terminal :** Xcode → menu Xcode → Settings…
(⌘,) → onglet **Locations** → liste **Command Line Tools** → choisir
**Xcode 26.6**. macOS demande le mot de passe administrateur dans sa propre
fenêtre. C'est l'équivalent graphique exact du `xcode-select -s`, et il est
plus haut dans l'ordre de préférence de la règle « Antonin n'utilise jamais le
Terminal » qu'un fichier `.command`.

En attendant la sélection explicite, `xcrun simctl` couvre l'installation, le
lancement et la capture — mais pas la saisie tactile.

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
| 3 | Briefing Market Brain : **le repli gratuit** — notification locale « ton briefing t'attend » à 8 h et 14 h, génération à l'ouverture de l'app | ✅ **FAIT le 2026-08-27** (§ 16), armé et lu dans le magasin d'iOS. **Mobile UNIQUEMENT** : la parité bureau est écartée, pas oubliée (§ 17.3). ✅ **arrêté**. Zéro serveur, zéro euro, zéro donnée sortie, et la clé LLM reste sur l'appareil. Le briefing n'est pas prêt quand la bannière tombe : **c'est le compromis accepté.** |
| 4 | Raccourcis natifs : un **geste physique qui ouvre la note rapide** | ✅ **FAIT le 2026-08-27** — `AppIntent` Swift + pont par fichier, mesuré au simulateur (§ 16). Reste à Antonin : l'associer au bouton Action |
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

## 12. Le mur de connexion — franchi le 2026-08-27 à 2 h

*Cette section était le « REPRENDRE ICI » de la session précédente. Elle est
conservée parce qu'elle documente ce qui a débloqué, et comment.*

### Ce qui bloquait

L'app restait au mur de connexion sur le simulateur : Claude ne saisit pas les
identifiants d'Antonin, règle non négociable. Tout ce qui vivait derrière ce mur
était donc **écrit mais non vérifié** — barre d'onglets, base, synchronisation.

**La levée a coûté un geste humain de dix secondes**, et rien d'autre :
Antonin s'est connecté dans la fenêtre du Simulateur.

⚠️ **C'est une fois pour toutes.** `xcrun simctl install` par-dessus le même
identifiant de paquet **préserve le conteneur de données** : `shale.auth.meta`
survit dans le `localStorage`, le `refresh_token` dans le trousseau du
simulateur. Les rebuilds suivants entrent directement. Seuls `simctl uninstall`
et `simctl erase` reperdraient la session.

### Ce que le franchissement a immédiatement prouvé

| Jalon | Résultat |
|---|---|
| `shale.db` dans le bac à sable | ✅ `Library/Application Support/com.atnfx.shale/shale.db` |
| Les 19 migrations | ✅ `select count(*) from _sqlx_migrations` → **19** |
| Données synchronisées depuis le Mac | ✅ tâches, notes, journal, habitudes, tags, métriques |
| **Barre d'onglets, VUE** | ✅ cinq libellés sur 402 pt, aucune troncature, zone sûre du bas juste |
| Vue Aujourd'hui | ✅ rend de vraies données |

### La procédure qui marche, à ne pas redécouvrir

```
1. xcrun simctl boot "iPhone 17"
2. rm -rf src-tauri/gen/apple/build/arm64-sim/Shale.app \
         src-tauri/gen/apple/build/shale_iOS.xcarchive
3. PATH="/opt/homebrew/bin:$HOME/.local/bin:$PATH" npm run tauri ios build -- --debug --target aarch64-sim
4. xcrun simctl install booted src-tauri/gen/apple/build/arm64-sim/Shale.app
5. xcrun simctl launch booted com.atnfx.shale
6. open -a Simulator   (pour qu'Antonin voie et agisse)
```

⚠️ **Le préfixe `src-tauri/` de l'étape 2 n'est pas cosmétique.** La première
rédaction de cette procédure l'omettait ; le `rm -rf` ne visait alors aucun
fichier, le nettoyage n'avait pas lieu, et le build échouait sur
« Directory not empty » — **avec un code de sortie 0**. Le piège s'est donc
retendu tout seul, sur sa propre documentation.

⚠️ **Attendre ~10 s avant la première capture** : une capture prise trop tôt
montre un écran blanc, qui ressemble à s'y méprendre à une régression.

### Outils installés (ne pas les réinstaller)

Homebrew (`/opt/homebrew`), CocoaPods 1.17, libimobiledevice, XcodeGen 2.46
(compilé depuis la source, dans `~/.local/bin`), cibles Rust iOS, runtime
simulateur iOS 26.5.

⚠️ **Le panneau interactif du simulateur reste indisponible.** La cause écrite
ici — « son serveur a relevé `xcode-select` avant l'installation d'Xcode » —
**était fausse**, et le § 8 bis porte le diagnostic correct depuis le
2026-08-27 à 11 h 40 : Xcode n'est pas *sélectionné*, il est seulement *trouvé
par repli*. La commande que le panneau réclame est légitime, et elle se donne
sans Terminal par Xcode → Settings → Locations → Command Line Tools.

Tant que ce n'est pas fait : `xcrun simctl` couvre l'installation, le lancement
et la capture, mais **pas la saisie tactile** — aucun tap, aucun swipe.

---

## 13. Le contrat de planification iOS — mesuré, et il réserve deux pièges

*Mesuré le 2026-08-27 vers 2 h, avant d'écrire une seule ligne de
planification. Ce sont les deux questions dont dépend TOUT le §3 : elles sont
tranchées, elles ne sont plus à explorer.*

### 13.1 Ce que le greffon expose vraiment sur mobile

`tauri-plugin-notification` 2.3.3 n'offre pas la même API des deux côtés, et
c'est ce qui commande le découpage `cfg` :

| Méthode | `desktop.rs` | `mobile.rs` |
|---|---|---|
| `show()`, `builder()` | ✅ | ✅ |
| `request_permission()`, `permission_state()` | ✅ (**des stubs** : toujours `Granted`) | ✅ **réels** |
| `schedule(...)` sur le constructeur | accepté, **sans effet** | ✅ |
| `pending()`, `cancel()`, `cancel_all()` | ❌ **n'existent pas** | ✅ |
| `remove_active()`, `active()`, `remove_all_active()` | ❌ | ✅ |

Autrement dit : **tout le code qui programme, liste ou annule des
notifications ne compile que sous `#[cfg(mobile)]`.** Ce n'est pas une
précaution de style, c'est le compilateur.

### 13.2 ⚠️ Piège n°1 — `Schedule::At` n'est pas un rendez-vous, c'est un minuteur

Lu dans le Swift du greffon (`ios/Sources/Notification.swift`,
`handleScheduledNotification`) :

```swift
let dateInterval = DateInterval(start: Date(), end: dateInfo.date!)
return UNTimeIntervalNotificationTrigger(
  timeInterval: dateInterval.duration, repeats: repeating)
```

`At` est traduit en **`UNTimeIntervalNotificationTrigger`**, dont la durée est
calculée `cible − maintenant`. Trois conséquences :

1. une date **passée** lève `pastScheduledTime` — l'appel échoue, il ne se tait
   pas ;
2. `repeating: true` ne veut **pas** dire « tous les jours à la même heure » :
   il veut dire « toutes les *durée* secondes ». Programmer 20 h à 14 h avec
   `repeating` donne une notification toutes les six heures, pas une par jour ;
3. seul `Schedule::Interval` produit un **`UNCalendarNotificationTrigger`**
   (`dateMatching:, repeats: true`), c'est-à-dire le vrai rendez-vous
   quotidien, évalué dans `Calendar.current` — donc à l'heure locale.

### 13.3 ⚠️ Piège n°2 — le `Z` de `At` est un caractère, pas un fuseau

Le Rust sérialise (mesuré, `serde_json::to_string`) :

```
{"at":{"date":"2026-08-17T21:00:00.000000000Z","repeating":false,…}}
```

Le Swift le relit avec un format **fixe** :

```swift
dateFormatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"
```

Deux choses à savoir, et je les ai mesurées plutôt que déduites — un petit
programme Swift lancé sur ce Mac :

```
fuseau par défaut du formateur : Optional(Europe/Paris)
2026-08-17T21:00:00.000000000Z → parsé, en UTC : 2026-08-17 19:00:00 Z
2026-08-17T21:00:00.000Z       → parsé, en UTC : 2026-08-17 19:00:00 Z
```

- **les neuf décimales passent** : ICU consomme les chiffres de façon gloutonne,
  alors que le format n'en déclare que trois. Ce n'était pas acquis, c'est
  vérifié ;
- **le `Z` est entre apostrophes : c'est un littéral.** Le formateur n'a donc
  aucun indicateur de fuseau et retombe sur celui du système. Une instant écrit
  en UTC est relu comme une heure **locale**.

**Conséquence pour Shale, chiffrée :** passer au greffon un `OffsetDateTime` en
UTC ferait tomber le rappel **deux heures trop tôt** en été (une heure en
hiver). Et il n'y a pas d'échappatoire par l'autre bout : un `OffsetDateTime`
porteur d'un décalage réel se sérialiserait `+02:00`, que le format fixe ne sait
pas lire — l'appel échouerait franchement.

**La parade, et elle est contre-intuitive :** prendre l'heure murale **locale**
visée, et l'étiqueter UTC. Le Swift la relira comme locale, et le tour est
juste. Ce n'est pas une élégance, c'est la seule forme que le greffon accepte.

### 13.4 ⚠️ Ce que ces deux mesures décident — et une erreur que j'y avais mise

**La première rédaction de cette section était fausse**, et il faut le dire
parce que le raisonnement faux est séduisant. Elle assignait `Schedule::Interval`
aux règles à heure fixe (habitudes 20 h, série 21 h), au motif que c'est le seul
vrai rendez-vous quotidien. C'est exact sur le *mécanisme*, et faux sur le
*produit* : un `Interval` répète **inconditionnellement**. Il annoncerait « il te
reste des habitudes » chaque soir à 20 h, y compris à quelqu'un qui les a toutes
cochées à 19 h — c'est-à-dire exactement la notification fausse que le § 3.2
interdit, et exactement celle qu'on désactive.

**Les règles de Shale ne sont pas des horaires, ce sont des conditions.** Aucune
d'elles ne peut donc utiliser un déclencheur répétitif.

| Ce qu'on programme | Planificateur | Pourquoi |
|---|---|---|
| Toutes les règles conditionnelles (`habits_pending`, `streak_at_risk`, `inactivity`) | **`Schedule::At`, ponctuel, reprogrammé à chaque passage en arrière-plan** | c'est la seule forme qui laisse la CONDITION décider. Le § 3.2 la rend légitime : le front est seul écrivain, donc l'état ne bouge plus une fois l'app fermée |
| Le briefing Market Brain 8 h / 14 h (§ 10 décision 3) | `Schedule::Interval { hour, minute }` | c'est le seul cas **sans condition** — « ton briefing t'attend » est vrai tous les jours. Il gagne donc le vrai rendez-vous quotidien, et évite les deux pièges |

**Conséquence : le piège du fuseau (§ 13.3) frappe presque tout**, pas le seul
`inactivity` comme l'annonçait la version fausse. Toute heure passée en `At`
doit être l'heure murale LOCALE étiquetée UTC.

### 13.5 Comment on évalue une condition qui n'est pas encore vraie

Le point qui rendait « programmer à l'avance » difficile : `habits.rs` refuse
d'émettre **avant** son heure (`if ctx.now.hour() < hour { return None }`). À
14 h, la règle ne dit rien de ce qu'elle dira à 20 h.

**La sortie est de ne rien réécrire.** `engine::evaluate` est pur et lit son
« maintenant » dans `EvalContext.now`. On peut donc l'appeler avec un `now`
**projeté** — aujourd'hui 20 h — sur l'image de la base lue à l'instant présent.
Ce qu'il rend est, littéralement, la notification qui partirait à 20 h.

Ça vaut mieux qu'un raccourci : plage horaire silencieuse, plafond quotidien,
cooldown, idempotence et fusion des candidats s'appliquent **au même code**, à
l'heure projetée. Aucune règle n'est réimplémentée, donc aucune ne peut diverger
entre le bureau et le téléphone — ce qui est très exactement le point 4 du
cahier des charges.

### 13.6 ⚠️ DEUX BUGS DU GREFFON sur iOS — mesurés à l'exécution

*Ceux-là ne se lisent pas dans la doc : ils se voient quand on essaie. Les deux
concernent la même chose — **savoir ou effacer ce qui est en attente** — et à
eux deux ils ferment toutes les portes officielles.*

**Bug n°1 — `cancel_all()` ne peut pas marcher.** Le Rust envoie `()`, donc
`null` :

```rust
pub fn cancel_all(&self) -> crate::Result<()> {
    self.0.run_mobile_plugin("cancel", ())   // → null
}
```

et le Swift, lui, exige un objet **sans condition** :

```swift
@objc func cancel(_ invoke: Invoke) throws {
  let args = try invoke.parseArgs(CancelArgs.self)   // { notifications: [Int] }
```

Résultat observé, mot pour mot :

```
annulation impossible : DecodingError.valueNotFound: Expected value of type
Dictionary<String, Any> but found null instead
```

Il n'existe par ailleurs **aucun appel à `removeAllPendingNotificationRequests()`**
dans le Swift du greffon. La fonction n'est pas mal appelée : elle est
inopérante.

**Bug n°2 — `pending()` ne peut pas se désérialiser.** Le `PendingNotification`
Rust réclame quatre champs, dont un **non optionnel** :

```rust
pub struct PendingNotification { id, title, body, schedule: Schedule }
```

Le `PendingNotification` Swift n'en encode que trois :

```swift
struct PendingNotification: Encodable { let id: Int; let title: String; let body: String }
```

`schedule` manque toujours, donc la désérialisation échoue toujours.

⚠️ **Ce bug-là est vicieux, parce qu'il MENT par omission.** Notre code faisait
`en_attente(&app).unwrap_or_default()` : l'erreur devenait une liste vide, et
l'écran de diagnostic annonçait « déposés : 1 · en attente côté système : 0 ».
On a cru pendant trois cycles que le dépôt échouait. **Il n'échouait pas.**

**Comment on a tranché : en lisant le magasin d'iOS à la main.** Le simulateur
range ses échéances dans

```
<appareil>/data/Library/UserNotifications/<uuid>/PendingNotifications.plist
```

Décodé, il contenait exactement ce qu'il fallait :

```
identifiants : ['737976655']            ← notre id_systeme
titres       : ["2 habitudes t'attendent"]
intervalles  : [60231.33]               ← 16 h 43 min, déposé à 03:16:08
```

`03:16:08 + 16 h 43 min 51 s = 20:00:00`. **Le rappel était armé, à la bonne
heure, depuis le début** — et au passage, c'est la confirmation de bout en bout
du contournement de fuseau du § 13.3 : un instant UTC aurait donné deux heures
de moins.

**Le contournement retenu : tenir le registre nous-mêmes.** `cancel(ids)`, lui,
marche — il porte ses arguments. On garde donc les identifiants déposés dans
`EngineState::scheduled_ids` (`notifications.json`), et on annule exactement
ceux-là au tour suivant. `id_systeme` étant stable, redéposer remplace de toute
façon l'échéance de même identifiant côté iOS ; le registre ne sert qu'au cas
où une échéance n'a plus de plan du tout.

Et l'écran **n'affiche plus** de « en attente côté système » : un compte qui
vaudra toujours zéro fait accuser le dépôt d'un échec qui n'a pas lieu. C'est
littéralement ce qui s'est passé.

### 13.7 Un défaut mineur, relevé au passage

`emitter.rs`, `deliver_test()` choisit son texte ainsi :

```rust
body: if cfg!(target_os = "macos") { "…les notifications macOS…" }
      else { "…les notifications Windows…" }
```

Sur iPhone, le bouton de test annoncera donc **« Windows »**. À corriger en même
temps que le reste — c'est trois lignes, mais c'est précisément le bouton dont
le §3.6 dit qu'il devient un vrai diagnostic sur iOS.

---

## 14. Déboguer une webview iOS — le canal qui marche

*§ 6 avait établi la moitié du problème : « sur iOS, la console d'une WKWebView
ne remonte PAS dans le journal système », et en avait tiré « ce qui se voit se
prouve » — une bannière à l'écran, photographiée. C'est vrai, mais coûteux :
une bannière demande un rebuild par question posée, et ne rend qu'un texte
court, jamais une pile d'appels.*

### 14.1 Ce qui ne marche pas, revérifié

| Voie | Résultat |
|---|---|
| `console.log` → `log show` / `log stream` | ❌ rien (§ 6) |
| `xcrun simctl launch --console-pty` | ❌ **fichier vide** — la sortie native de l'app ne porte pas la console JS, et `eprintln!` du Rust n'y arrive pas non plus |
| Panneau interactif du simulateur | ❌ indisponible (§ 12) — donc ni tap ni swipe |

### 14.2 ✅ Le `localStorage` est un fichier SQLite, et il est lisible depuis le Mac

C'est la découverte utile de la nuit. La WKWebView persiste `localStorage`
dans le conteneur de l'app :

```
<conteneur>/Library/WebKit/com.atnfx.shale/WebsiteData/
  Default/<hash>/<hash>/LocalStorage/localstorage.sqlite3
```

Donc : **le front écrit, le Mac lit, sans écran, sans bannière, sans photo.**

```bash
D=$(xcrun simctl get_app_container booted com.atnfx.shale data)
LS=$(find "$D/Library/WebKit" -name "localstorage.sqlite3" | head -1)
cp "$LS" /tmp/ls.sqlite3; cp "$LS-wal" /tmp/ls.sqlite3-wal
sqlite3 /tmp/ls.sqlite3 "select hex(value) from ItemTable where key='diag';" \
  | python3 -c "import sys,binascii; \
      print(binascii.unhexlify(sys.stdin.read().strip()).decode('utf-16-le'))"
```

⚠️ **Deux pièges dans cette lecture, et les deux m'ont eu :**

1. les valeurs sont des **blobs UTF-16**. `cast(value as text)` rend `0` ou une
   chaîne tronquée au premier octet nul — d'où le passage par `hex()` puis
   `utf-16-le`. Ne pas conclure « la clé est vide » ;
2. **copier le `-wal` avec la base.** Les dernières écritures n'y sont pas
   encore fusionnées ; sans lui on lit un état périmé.

⚠️ Le conteneur change d'identifiant à chaque `install` : toujours le demander
à `simctl get_app_container`, jamais le figer dans une note.

### 14.3 Ce que le canal a servi à trancher, en un cycle

L'app restait sur « Chargement… ». Deux `Chargement…` **identiques à l'écran**
cohabitent dans `App.tsx` : le repli de `Suspense` (chunk `lazy()` en vol) et
le cas `!data`. Impossible de les distinguer sur une capture.

Un module de diagnostic jetable — `window.onerror`, `unhandledrejection`, et
trois marqueurs — a rendu ceci, lu sur disque :

```
boot / App:render / fetchAll:start / fetchAll:ok tasks=2 notes=9
chunk:today:start / chunk:today:ok
```

**Tout réussissait.** Le blocage ne s'est pas reproduit, et l'hypothèse « chunk
`lazy()` qui ne charge pas sur `tauri://localhost` » est tombée sans coûter une
seule modification de code.

Le même cycle a rendu les mesures de mise en page, et elles ont **corrigé une
erreur de lecture d'écran** de ma part :

```
viewport 402x874 dpr=3
safe-area haut=62px bas=34px
scrollWidth html=402 body=402
debordent=0
```

J'avais annoncé des cartes « rognées à droite ». **Il n'y a aucun débordement** :
`scrollWidth == innerWidth`, zéro élément dépassant. Ce que je prenais pour un
rognage était la marge `p-8`. La leçon de § 6 se complète donc d'une seconde,
symétrique : *ce qui se voit ne se prouve pas non plus — une capture se
sur-interprète. Mesurer reste au-dessus de regarder.*

### 14.4 ⚠️ Le vrai défaut que cet épisode a révélé, et qui reste ouvert

```ts
const refresh = useCallback(async () => {
  setData(await fetchAll(addDays(todayStr(), -400)));
}, []);
```

**Aucun `.catch`.** Si `fetchAll` rejette, la promesse part en rejet non traité
et `data` reste `null` **pour toujours** : « Chargement… », sans message, sans
bouton, sans fin. Sur le bureau c'est déjà mauvais. Sur un appareil, où § 14.1
montre qu'il n'y a **aucune console à consulter**, c'est indiagnosticable.

Non traité ici — ça demande un état d'erreur et ses clés d'i18n, et je ne
l'invente pas sans que ce soit demandé. Mais c'est le premier candidat de la
prochaine session.

---

## 15. La nuit du 2026-08-27 — ce qu'elle a produit

*Section d'archive. Le point de reprise est le § 17.*

| | |
|---|---|
| Réconciliation Windows | `4ca4080` |
| Audit iOS | `c6b5867` |
| Rust sous `cfg(desktop)` + `keyring` iOS | `042f750` |
| L'app tourne sur iPhone, `crypto.subtle` disponible | `5ebc08b` |
| Barre d'onglets mobile | `360bd19` — **VUE**, et utilisée |
| Contrat de planification mesuré | `069806f` — § 13 |
| Mur franchi · base · 19 migrations · zone sûre haute | `5f0e016` |
| Journal : § 12, § 14 débogage | `7254b8f` |
| Rappels iOS : projection + dépôt | `9fd2993` |
| Icône Tauri → icône Shale · formateur du futur · registre d'identifiants | `6bea21e` |
| `inactivity` projetée à l'ouverture de la plage | `7f7b5ed` |

### ✅ Le rappel local est ARMÉ dans iOS — prouvé, pas déduit

C'était LE jalon du produit. Lu dans le magasin d'iOS lui-même :

```
identifiants : ['737976655']            ← id_systeme, tel que nous le calculons
titre        : "2 habitudes t'attendent"
corps        : "Il te reste 2 habitudes à cocher aujourd'hui (Rffds, Diss)."
intervalle   : 59875 s                  ← déposé à 03:22:05 → 20:00:00 pile
```

Une seule échéance après cinq cycles de dépôt : la purge par registre
fonctionne. Et l'arithmétique confirme le contournement de fuseau du § 13.3 —
un instant UTC aurait donné 7 200 secondes de moins.

⚠️ **Il reste à VOIR la bannière tomber à 20 h, app fermée.** C'est de
l'attente, pas du travail. Attention : le simulateur doit être resté allumé,
et tout `simctl install` entre-temps redéposera l'échéance (sans doublon).

---

## 16. La matinée du 2026-08-27 — la file d'attente du § 15 est vide

**Les quatre éléments sont faits, et chacun a été mesuré sur l'appareil.**
Quatre commits, tous sur `mobile-ios`, **rien n'est poussé sur GitHub**.

| | Commit |
|---|---|
| `refresh()` ne fige plus l'app · les deux « Chargement… » se distinguent | `55e1c8e` |
| Aujourd'hui en vraie pile · poignée de resize masquée au doigt | `15074de` |
| Briefing de marché 8 h / 14 h, armé dans iOS | `fa4afb3` |
| `AppIntent` : un geste physique ouvre une note | `dddb4c9` |

### 16.1 Ce qui a été corrigé, et ce que ça a coûté de le prouver

**1. `refresh()` sans `.catch` (§ 14.4).** Un rejet de `fetchAll` partait en
rejet non traité et `data` restait `null` pour toujours. Deux issues
maintenant : écran d'échec avec le message technique AFFICHÉ (sur appareil,
c'est le seul endroit où il se lit) et bouton « Réessayer » quand rien n'a
jamais été lu ; bandeau discret et écran conservé quand des données existaient
déjà — vider l'app pour une lecture ratée serait pire que le défaut.
Les deux « Chargement… » disent enfin de quoi ils parlent : « Ouverture du
module… » et « Chargement des données… ».

⚠️ **Pas de test de rendu.** Le dépôt n'a AUCUNE infrastructure de test React —
29 fichiers de test, tous de logique pure. En introduire une pour ce correctif
aurait été un chantier, pas un correctif. C'est une dette assumée, pas un oubli.

**2. Aujourd'hui en pile verticale (§ 5.3).** `MIN_PANEL_PX = 248` se
traduisait, sur les 338 px de grille d'un iPhone 17, en un plancher de
**9 colonnes sur 12**. Deux panneaux de 9 ne tiennent pas côte à côte : la
grille était déjà une pile, mais chaque carte s'arrêtait 88 px avant le bord.
La règle ajoutée est arithmétique et non un breakpoint — dès que le plancher
dépasse la moitié des colonnes, plus rien ne peut partager la rangée, donc le
plancher devient la rangée. **Mesuré à l'écran : 336 px sur 338, bords
alignés.** Aucune donnée touchée, conformément à la décision 6 du § 10.

La poignée de redimensionnement passe en `hidden` sous `(pointer: coarse)`,
comme le demandait le § 5.2.

⚠️ **Non tranché** : la barre ⠿ / ✕ / ⟲ du coin haut-droit reste révélée au
survol. Le survol collant d'iOS la fait probablement apparaître au premier tap,
mais **ça n'a pas été vérifié** — aucune saisie tactile n'est scriptable.

**3. Le briefing de marché.** `Schedule::Interval`, comme le § 13.4 l'exigeait.
Les créneaux sont calculés par le FRONT (`src/lib/market/rappels.ts`) et
repoussés à chaque projection : Market Brain raisonne en heure de **Paris**,
`Schedule::Interval` en heure de l'**appareil**, et seul le front a la base de
fuseaux nommés. Deux refus contre une bannière mensongère : sans l'offre Trade,
sans clé IA.

⚠️ **UN BOGUE TROUVÉ EN MESURANT.** Le premier dépôt a atterri à **8 h 01**.
Lu dans le magasin d'iOS : `NS.minute = 1`. Le décalage Paris → local était
calculé contre un « maintenant » qui portait encore ses secondes ; à
10 h 46 min 42 s l'écart valait −0,7 minute et `Math.round` le rendait à −1.
Le test de round-trip ne le voyait pas non plus : il n'assertait que l'HEURE.
Les deux sont corrigés.

Après correctif, lu dans le magasin :

```
1. type=Calendar      repeats=True   8:00
2. type=Calendar      repeats=True   14:00
3. type=TimeInterval  dans 33010 s   ← habitudes, 10:49:50 + 33010 s = 20:00:00
```

puis, la clé IA n'existant pas sur le simulateur, le build final n'a laissé
qu'**une** échéance : la règle des habitudes. Le refus fonctionne, et la purge
a emporté les créneaux du build précédent.

**4. L'`AppIntent` (§ 4.1).** Le seul morceau non-React. Il OUVRE, il n'écrit
pas : faire écrire le Swift dans `shale.db` casserait l'invariant « le front
est seul écrivain ». Le pont est un fichier posé dans le conteneur, relevé par
`note_rapide.rs`.

⚠️ **La fraîcheur (2 min) n'est pas une précaution.** Une demande faite app
DÉJÀ à l'écran ne provoque aucun retour au premier plan : sans borne, elle
serait consommée des heures plus tard et une note s'ouvrirait toute seule.

Mesuré : demande fraîche → l'app s'ouvre sur Notes, une note du jour est créée
et ouverte, drapeau consommé. Demande vieille de dix minutes → **10 notes
avant, 10 après**, drapeau jeté.

### 16.2 ▶️ Ce qui reste à Antonin, et à lui seul

- **Associer l'intent au bouton Action** : Réglages → Bouton Action →
  Raccourci → « Nouvelle note Shale ». Puis maintenir le bouton.
  ⚠️ iPhone 15 Pro et plus. Sinon : Réglages → Accessibilité → Toucher →
  Toucher au dos.
- **Voir tomber une bannière.** Tout est armé ; personne ne peut le regarder
  à notre place.
- ⚠️ **Ce qu'une session Claude ne peut PAS faire** : aucune saisie
  d'identifiants ; ne JAMAIS lancer `simctl uninstall` ni `simctl erase`, qui
  reperdraient la session ouverte à la main. La saisie tactile, elle, n'est
  bloquée que tant que le panneau interactif l'est — voir la correction du
  § 8 bis, qui dit comment le débloquer sans Terminal. Le canal du § 14
  (`localStorage` lu sur disque) et la lecture directe du magasin d'iOS
  couvrent le reste.

---

## 17. Le tour des quatorze écrans — 2026-08-27, midi

*La saisie tactile a été débloquée (§ 8 bis, correction du 11 h 40). Les douze
vues que personne n'avait jamais regardées sur 402 pt l'ont enfin été.*

### 17.1 Ce que le tour a trouvé

| Vue | Verdict |
|---|---|
| **Aujourd'hui** | ✅ pile pleine largeur (corrigée le matin) |
| **Tâches** | ✅ filtres, tags, liste — sauf le filtre de DATE, voir § 17.3 |
| **Timer** | ✅ **impeccable** : presets en 3+1, stepper, bascule, gros bouton |
| **Objectifs** | ✅ en-tête et carte tiennent |
| **Performance** | ✅ **très bien** : tuiles 2×2, graphique et axes lisibles |
| **Finance** | ⚠️ étape 1 de la mise en route écrasée par son bouton (§ 17.3) |
| **Notes** | ✅ maître-détail (corrigé le matin), vérifié dans les deux sens |
| **Journal** | ⚠️ titre et bouton « Générer la revue » collés (§ 17.3) |
| **Savoir** | ⭐ **débordait hors de l'écran** — corrigé |
| **Trading** | ⚠️ « + Nouveau trade » gonflé en pastille ronde (§ 17.3) |
| **Market-Brain** | ✅ en-tête empilé proprement |
| **Position** | ✅ **très bien** : formulaire à deux colonnes, tout tient |
| **Réglages / Personnaliser** | ✅ après correction du libellé (§ 17.2) |
| **Tiroir « Plus »** | ✅ feuille du bas, poignée, intertitres par catégorie |

### 17.2 Les trois défauts structurels, corrigés (`1f5e673`)

**1. ⭐ Le contenu passait SOUS la Dynamic Island, dans les quatorze vues.**
`paddingTop: env(safe-area-inset-top)` était posé À L'INTÉRIEUR du défilant. Un
padding dans un défilant défile avec lui : au repos l'en-tête tombait bien sous
l'horloge — ce qui a fait croire l'affaire réglée par `5f0e016` — mais dès
qu'on faisait défiler, le contenu remontait sous l'îlot.

⚠️ **La leçon.** Le matin même, j'avais envisagé ce déplacement et j'y avais
renoncé « pour ne pas toucher à une mise en page validée ». Elle n'était
validée **qu'au repos**. Une capture au repos ne prouve rien d'une zone qui
défile.

**2. ⭐ Savoir débordait hors de l'écran.** `grid-cols-[232px_1fr]` : 232 px en
dur, sans `minmax`. Le balayage statique du matin l'avait localisé sans le
corriger, au motif que `savoir-themes` réécrit ce fichier. La capture a changé
la donne — ce n'était pas « à l'étroit » comme Notes, c'était inutilisable.

**3. ⭐ Le tiroir affichait « admin », sans icône, au lieu de
« Personnaliser ».** Les trois entrées du pied portaient libellé et icône au
POINT D'APPEL de `navButton` : nulle part où `MobileNav` puisse les lire. Même
absence de source commune, même conséquence côté droits — le téléphone gatait
Personnaliser sur `isAdmin` et omettait la Console. `ITEMS_PIED` est désormais
la source unique. ⚠️ **Hors de `ITEMS`**, qui fait autorité sur le nombre
« douze ».

### 17.3 ▶️ CE QUI RESTE — la file d'attente

**1. ✅ FAIT — l'en-tête de vue se replie** (`6268d3f`). `.view-head` porte la
règle une fois : `flex-wrap` + gouttières, et le groupe d'actions passe SOUS le
titre au lieu de se tasser. Six en-têtes l'adoptent. Finance demandait un
second geste (ligne de liste et non en-tête) : un plancher de 12 rem sur la
colonne de texte, sans quoi `flex-wrap` seul ne déclenche rien — une colonne en
`flex-1 min-w-0` a une largeur de base nulle et se tasse.

**2. ✅ FAIT — le filtre de date de Tâches** (`bce159b`). Un libellé
« échéance » devant : un `<input type="date">` VIDE n'affiche RIEN sur iOS, pas
même le gabarit `jj/mm/aaaa` du bureau, et le contrôle était un rectangle muet.

⚠️ **Ce n'était pas le `color-scheme`**, et c'est mesuré : le `<select>` de
Position ouvert sur le build d'avant correction montre qu'iOS rend son panneau
natif EN CLAIR malgré un `color-scheme: dark` figé. Le retrait de ce
`color-scheme` (quatre contrôles) reste juste pour macOS ; il n'a jamais rien
réparé sur iPhone.

**3. ❌ N'ÉTAIT PAS UN DÉFAUT.** La zone « Accueil — texte » de Personnaliser
semblait tronquer son contenu. C'est un `<textarea rows={2}>` : le texte DÉFILE
dedans, rien n'est perdu ni inatteignable. Inconfortable au doigt, oui ;
défectueux, non.

**4. ✅ FAIT — `import_screenshot`** (`3db427a`), et **l'audit se trompait sur
les deux moitiés**. Le § 5.3 disait « à refaire via le sélecteur de photos » :
le sélecteur de photos, on l'avait déjà — `tauri-plugin-dialog` ouvre la
photothèque sur iOS, pas un navigateur de fichiers. Mais l'import échouait
quand même, EN SILENCE : iOS rend un `file:///…`, `FilePath` étant `untagged`
ça arrive comme une chaîne, le garde `typeof` passe, et `fs::copy` échoue tout
au fond. Corrigé des deux côtés — décodage de l'URL en Rust, et un `catch`
côté front, qui n'existait pas.

**4 bis. ✅ `SketchPad` n'a rien à porter.** Le § 5.3 le signalait comme « du
pointeur, à porter au tactile ». Lu dans le fichier : il utilise déjà les
Pointer Events, avec `touch-action: none` et `setPointerCapture`. Rien à faire.
⚠️ Non vérifié à l'écran — il faut créer une fiche du Savoir pour l'atteindre.

**5. ❌ ÉCARTÉ — la parité BUREAU du briefing.** Antonin, le 2026-08-27 :
*« les notifications sont plus importantes sur le téléphone, alors le mieux est
de mettre la priorité sur le mobile et de minimiser les coûts »*.

Le rappel de 8 h / 14 h reste donc **mobile uniquement**, et ce n'est pas une
dette : c'est là qu'il sert. Sur le bureau, l'app est le plus souvent ouverte
et la pastille de la barre latérale annonce déjà le briefing — le rappel
système n'ajouterait qu'une redite, en consommant une des deux notifications
quotidiennes autorisées. Il aurait pu faire taire « habitudes non cochées »
pour dire ce qui était déjà à l'écran.

⚠️ **Ne pas rouvrir sans une raison neuve.** Si elle vient, la vraie question
n'est pas « comment » mais « avec quel plafond » : sur le bureau le briefing
passerait par le moteur de règles, donc par le compte quotidien.

**6. ⏸️ EN ATTENTE — le push silencieux** (§ 10, décision 2, seconde moitié).
Il demande le **programme développeur Apple payant** (99 €/an) : la capacité
push n'existe pas sur un identifiant Apple gratuit.

⚠️ Ce que le compte gratuit permet quand même, et qui n'est pas rien : installer
Shale sur l'iPhone RÉEL d'Antonin, avec un profil qui expire au bout de 7 jours
et se renouvelle en rebranchant le téléphone. De quoi vivre avec l'app avant de
payer quoi que ce soit.

Le compte payant reste nécessaire de toute façon pour publier sur l'App Store —
donc la question n'est pas « si » mais « quand ». Compte tenu de la consigne
« minimiser les coûts », **pas maintenant**.

**7. Réconcilier `savoir-themes`** (`a1fc76f`) — 922 insertions sur
`KnowledgeView`. Une branche laissée vivante EST le mécanisme de la divergence
(§ 11). Le correctif du § 17.2 y entrera en conflit, sur six lignes.

### 17.3 bis ⚠️ Un échec de test que je n'ai pas expliqué

`npm test` a échoué **une fois** le 2026-08-27 après-midi : « 1 failed | 391
passed ». Le détail avait défilé avant capture — **je ne sais pas quel test**.
Il tournait en concurrence d'un `cargo check`, d'où l'hypothèse d'une
sensibilité au temps sous charge.

Huit exécutions depuis, dont une sous contention CPU délibérée (quatre `yes` +
un `cargo check`) : 392/392 à chaque fois. Ni reproduit, ni expliqué, ni écarté.

▶️ **Si ça revient : capturer le nom du test AVANT de relancer.** Ce dépôt a
déjà connu ce genre d'intermittence — commit `749b981`, « Les tests ne mentent
plus par intermittence ».

### 17.4 Ce qu'une session Claude peut et ne peut pas faire

✅ **Depuis le 2026-08-27 à midi : tout piloter.** Le panneau du simulateur
répond — tap, swipe, capture. Naviguer dans les quatorze vues ne demande plus
personne.

❌ Toujours hors de portée : **saisir des identifiants**, et **`sudo`** (mot de
passe). Pour un `sudo`, poser un `.command` sur le Bureau et le lancer avec
`open` — Antonin n'a que son mot de passe à taper (précédent : Homebrew, et
`xcode-select` ce matin).

⚠️ **Ne JAMAIS lancer `simctl uninstall` ni `simctl erase`** : la session du
simulateur a été ouverte à la main une seule fois, et ces deux commandes la
reperdraient.

⚠️ **Ne pas connecter le clavier matériel du Simulateur** pour contourner quoi
que ce soit : la base du simulateur est synchronisée avec le Mac d'Antonin, et
une frappe tombée dans un champ de saisie écrirait dans ses vraies données.

### 17.5 Décisions déjà prises — ne pas les rouvrir

§ 10 fait foi : local + push, briefing en repli gratuit, `AppIntent` pour la
note rapide, barre à 4 onglets + « Plus », grille d'Aujourd'hui inchangée,
Performance et Market Brain en consultation. Aucun module absent.

### 17.6 État du dépôt

**Branche `mobile-ios`**, poussée (`origin/mobile-ios`). Destinée à rejoindre
le tronc, pas à vivre.

`cargo check --all-targets` ✅ · `cargo check --target aarch64-apple-ios-sim` ✅ ·
`cargo test --lib` **112** ✅ · `tsc` ✅ · `vite build` ✅ · `test:types` ✅ ·
`npm test` **392** (voir § 17.3 bis) · `i18n:check` 1068 entrées, 0 manquante ✅

**App macOS reconstruite et réinstallée** le 2026-08-27 à midi
(`/Applications/Shale.app`), lancée et vérifiée : données intactes, indicateur
de synchronisation au vert. ⚠️ Une réinstallation REDEMANDE l'accès au
trousseau — l'app est signée ad hoc, sa signature change à chaque
reconstruction. Détail dans `CLAUDE.md`.
