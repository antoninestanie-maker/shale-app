# Recette Windows — procédure d'acceptation du portage

Ce document est la **procédure d'acceptation du support Windows**. Il n'a pas
été exécuté : au 2026-08-05, aucune machine Windows n'était disponible et la
compilation croisée depuis macOS s'est révélée impraticable (voir
`CLAUDE.md`, section « Support Windows »). Tout ce qui suit est donc écrit pour
être **déroulé tel quel** le jour où un poste Windows existe.

⚠️ **Un `.msi` qui n'a jamais tourné sur une vraie machine Windows n'est pas un
livrable.** Le travail fait en amont — audit, `cfg` de plateforme, libellés de
raccourcis, config de bundle — supprime les erreurs de compilation *connues*.
Il ne dit rien du comportement à l'exécution, qui est précisément ce que cette
recette mesure.

---

## Prérequis

1. **Windows 10 (2004+) ou Windows 11**, 64 bits. WebView2 y est préinstallé ;
   sur une image plus ancienne, le bootstrapper configuré dans
   `tauri.conf.json` (`downloadBootstrapper`, silencieux) l'installe — ce qui
   suppose un accès réseau pendant l'installation.

2. **Chaîne de compilation**, sur la machine Windows elle-même :
   - **Visual Studio Build Tools** avec la charge de travail « Développement
     Desktop en C++ » (fournit MSVC, `link.exe` et le SDK Windows). C'est la
     dépendance lourde : ~6 Go.
   - **Rust** via `rustup` (cible `x86_64-pc-windows-msvc`, celle par défaut).
   - **Node 22** et `npm ci` dans le dépôt.

3. **Le dépôt, branche `windows-build`.** La branche contient tout le travail de
   portage ; `main` ne l'a pas encore.

4. **Pour l'étape 8 seulement** (sync multi-plateforme) : `src/lib/auth/config.ts`
   renseigné, schéma Supabase joué, et un Mac disposant du même compte.
   ⚠️ Ne jamais committer `config.ts` renseigné.

---

## Étape 1 — le build produit bien quelque chose

```bash
npm ci
npm run tauri build
```

Attendu : deux artefacts sous `src-tauri/target/release/bundle/` —
`msi/Shale_0.1.0_x64_fr-FR.msi` et `nsis/Shale_0.1.0_x64-setup.exe`.

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 1.1 | `cargo check --lib --tests --bins` | vert, 0 warning | ☐ |
| 1.2 | `cargo test` | 88 tests verts | ☐ |
| 1.3 | `npm test` | 191 tests verts | ☐ |
| 1.4 | `npm run tauri build` | `.msi` **et** `.exe` générés | ☐ |

⚠️ Si une erreur de compilation Rust apparaît, la corriger **sous
`#[cfg(target_os = "…")]`** et relancer `cargo check` sur macOS avant de
considérer le point réglé. Aucun correctif Windows ne doit changer le
comportement macOS.

---

## Étape 2 — installation

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 2.1 | Lancer le `.exe` (NSIS) | s'installe **pour l'utilisateur courant**, sans invite UAC | ☐ |
| 2.2 | Avertissement SmartScreen | **attendu et normal** tant que le binaire n'est pas signé (« Windows a protégé votre ordinateur » → Informations complémentaires → Exécuter quand même) | ☐ |
| 2.3 | Langue de l'installateur | français sur un Windows français, anglais sinon | ☐ |
| 2.4 | Icône | logo « Strates » dans le menu Démarrer, la barre des tâches et l'explorateur | ☐ |
| 2.5 | Raccourci menu Démarrer | présent — **c'est lui qui conditionne les notifications**, cf. étape 6 | ☐ |
| 2.6 | Installer aussi le `.msi` sur une machine propre | même résultat | ☐ |

---

## Étape 3 — premier lancement et base de données

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 3.1 | L'app démarre | fenêtre 1120×780, fond `#0c0c0c`, pas d'écran blanc | ☐ |
| 3.2 | `%APPDATA%\com.atnfx.shale\shale.db` | créé au premier lancement | ☐ |
| 3.3 | Migrations | les **17** migrations appliquées (`SELECT * FROM _sqlx_migrations` ou équivalent) | ☐ |
| 3.4 | Écran d'auth | login si `config.ts` renseigné, **mode démo** sinon | ☐ |
| 3.5 | Redémarrage | les données saisies au 1ᵉʳ lancement sont toujours là | ☐ |

---

## Étape 4 — les 15 vues

WebView2 est un Chromium, WKWebView un WebKit : les écarts attendus sont côté
CSS (rendu des polices, `backdrop-filter`, scrollbars) plus que côté JS.
Ouvrir chaque vue, **console ouverte** (F12), et noter toute erreur.

| # | Vue | 0 erreur console | Rendu correct |
|---|---|---|---|
| 4.1 | Aujourd'hui | ☐ | ☐ |
| 4.2 | Tâches | ☐ | ☐ |
| 4.3 | Objectifs | ☐ | ☐ |
| 4.4 | Journal | ☐ | ☐ |
| 4.5 | Notes | ☐ | ☐ |
| 4.6 | Savoir | ☐ | ☐ |
| 4.7 | Focus | ☐ | ☐ |
| 4.8 | Performance | ☐ | ☐ |
| 4.9 | Benchmark | ☐ | ☐ |
| 4.10 | Market Brain | ☐ | ☐ |
| 4.11 | Trading | ☐ | ☐ |
| 4.12 | Sizing | ☐ | ☐ |
| 4.13 | Tracker live | ☐ | ☐ |
| 4.14 | Personnaliser | ☐ | ☐ |
| 4.15 | Réglages | ☐ | ☐ |

Points à regarder en particulier :

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 4.16 | Zone haute de la barre latérale | ⚠️ `titleBarStyle: "Overlay"` est **ignoré sur Windows** : la fenêtre a une barre de titre native, et le `pt-10` qui dégage les trois pastilles macOS devient ~40 px de vide. **Défaut cosmétique connu, non corrigé** faute de pouvoir le regarder — décider ici s'il justifie un `pt` conditionnel | ☐ |
| 4.17 | Fenêtre étroite (500 px) et demi-écran | aucun contrôle clippé (cf. audit du 2026-07-26) | ☐ |
| 4.18 | Requêtes réseau (Market Brain, Yahoo, LLM) | passent — la capability `http` est indépendante de l'OS | ☐ |
| 4.19 | Screenshot de trade (Trading → agrandir) | l'image s'affiche : `convertFileSrc` et le scope `$APPDATA/screenshots/**` doivent tolérer les `\` de Windows. **Point le plus suspect de cette étape** | ☐ |

---

## Étape 5 — raccourcis clavier

Le *comportement* était déjà portable avant ce chantier (`e.metaKey \|\| e.ctrlKey`
partout) ; ce qui a changé, ce sont les **libellés**, via `src/lib/platform.ts`.

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 5.1 | `Ctrl+K` | ouvre la palette de commandes | ☐ |
| 5.2 | Glyphe dans la palette | affiche **`Ctrl`**, pas `⌘` | ☐ |
| 5.3 | `Ctrl+Maj+N` | crée une note et l'ouvre | ☐ |
| 5.4 | Réglages → raccourcis | lit `Ctrl+Alt+Espace`, `Ctrl+K`, `Ctrl+Maj+N` | ☐ |
| 5.5 | Bulles de la barre d'édition de note | `Ctrl+B` / `Ctrl+I` / `Ctrl+U` / `Ctrl+K` | ☐ |
| 5.6 | Croquis | bulle `Ctrl+Z`, et l'annulation marche | ☐ |
| 5.7 | Savoir, état vide | le texte dit `Ctrl+V`, pas `⌘V` | ☐ |
| 5.8 | En anglais (Réglages → langue) | `Ctrl+Shift+N`, pas `Ctrl+Maj+N` | ☐ |
| 5.9 | **`Ctrl+Alt+Espace`** | ouvre la capture rapide, y compris app en arrière-plan | ☐ |
| 5.10 | `Alt+Espace` | ouvre le **menu système de la fenêtre** (comportement Windows normal) et **ne** déclenche **pas** la capture | ☐ |

⚠️ 5.9 est un **choix fait sans validation** : `Alt+Espace` étant réservé par
Windows, il fallait un autre raccourci. `Ctrl+Alt+Espace` est proposé, pas
arbitré. S'il déplaît, changer `CAPTURE_SHORTCUT` **aux deux endroits** —
`src-tauri/src/lib.rs` et `src/lib/platform.ts`.

---

## Étape 6 — notifications (toasts)

⚠️ **À faire sur l'app installée, jamais sous `tauri dev`.** Un toast Windows
est adressé à un AppUserModelID que le système ne connaît qu'à travers un
raccourci du menu Démarrer : en dev, le binaire n'est pas installé, donc aucun
toast n'apparaît — et ça ne prouve rien.

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 6.1 | Réglages → « envoyer une notification de test » | un **toast Windows** s'affiche | ☐ |
| 6.2 | Texte du toast | « Si tu vois ce toast, les notifications Windows fonctionnent. » | ☐ |
| 6.3 | Cloche in-app | reçoit l'entrée **dans tous les cas**, toast ou pas | ☐ |
| 6.4 | Message d'aide sous le bouton | parle de « Paramètres Windows → Système → Notifications », pas de « Réglages macOS » | ☐ |
| 6.5 | Notifications coupées dans Windows | l'app ne casse pas ; la cloche continue de se remplir | ☐ |
| 6.6 | Assistant de concentration actif | noter le comportement (le toast est probablement mis en sourdine — **attendu**, pas un bug) | ☐ |
| 6.7 | Après mise en veille de la machine | une échéance manquée est rattrapée au réveil (le planificateur raisonne sur l'horloge murale, pas sur `Instant`) | ☐ |

---

## Étape 7 — tray et fermeture de fenêtre

Comportement **volontairement différent de macOS** : sur Windows, le clic
gauche sur l'icône de la zone de notification ouvre l'app, le clic droit ouvre
le menu.

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 7.1 | Icône dans la zone de notification | présente (éventuellement dans le débordement `^`) | ☐ |
| 7.2 | **Clic gauche** sur l'icône | ouvre / restaure la fenêtre principale | ☐ |
| 7.3 | **Clic droit** sur l'icône | ouvre le menu (Ouvrir / Capture rapide / Quitter) | ☐ |
| 7.4 | Libellé du menu | « Capture rapide  Ctrl+Alt+Espace » | ☐ |
| 7.5 | Fermer (✕), « garder actif » **activé** | la fenêtre se cache, l'app reste dans la zone de notification | ☐ |
| 7.6 | Idem depuis une fenêtre **maximisée** | se cache aussi (le garde-fou plein écran est macOS-only) | ☐ |
| 7.7 | Fermer (✕), « garder actif » **désactivé** | l'app quitte | ☐ |
| 7.8 | « Quitter » du menu du tray | l'app quitte, l'icône disparaît | ☐ |
| 7.9 | App cachée puis rappel dû | le toast part quand même | ☐ |

---

## Étape 8 — trousseau (Credential Manager)

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 8.1 | Réglages → saisir une clé d'API LLM | enregistrée sans erreur | ☐ |
| 8.2 | Gestionnaire d'identifiants Windows → Informations d'identification génériques | une entrée `com.atnfx.shale` | ☐ |
| 8.3 | Réglages rouverts | la clé est relue | ☐ |
| 8.4 | Vider le champ | l'entrée **disparaît** du Gestionnaire (pas une chaîne vide) | ☐ |
| 8.5 | Libellé « où est rangée la clé » | annonce le trousseau, pas la base | ☐ |
| 8.6 | `shale.db` inspecté à l'éditeur SQLite | la clé n'y est **pas** en clair | ☐ |

---

## Étape 9 — synchronisation Windows ↔ macOS

**Le test le plus révélateur du chantier**, et le seul qui croise les deux
étapes. À ne faire qu'une fois l'étape 1 (sync) livrée.

| # | Vérification | Attendu | Résultat |
|---|---|---|---|
| 9.1 | Activer la sync sur le Mac, puis ouvrir avec le même mot de passe sur Windows | la clé se dérive des deux côtés (Argon2id Rust, code identique) | ☐ |
| 9.2 | Créer une tâche sur le Mac | apparaît sur Windows | ☐ |
| 9.3 | Créer une note sur Windows | apparaît sur le Mac | ☐ |
| 9.4 | Modifier la même ligne des deux côtés | LWW tranche, aucune perte silencieuse | ☐ |
| 9.5 | Supprimer sur Windows | la pierre tombale se propage au Mac | ☐ |
| 9.6 | Code de récupération émis sur Mac | ouvre les données sur Windows | ☐ |
| 9.7 | Fuseaux / heure système décalés | pas de désordre d'ordonnancement | ☐ |
| 9.8 | Caractères accentués et emoji | intègres dans les deux sens (UTF-8 de bout en bout) | ☐ |

---

## Ce qui reste ouvert après cette recette

- **Signature Authenticode** — non tranchée. Sans certificat, SmartScreen
  avertit à chaque installation (point 2.2). Décision attendue d'Antonin.
- **CI** — aucun pipeline n'existe (ni `.github/`, ni remote git). Un job
  Windows n'a de sens qu'une fois le dépôt hébergé.
- **Point 4.16** — vide sous la barre de titre native, à arbitrer de visu.
- **Point 4.19** — scope d'asset et séparateurs Windows, le risque résiduel le
  plus probable.
