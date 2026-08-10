# Prompt Claude Code — Shale, Étape 2 : build Windows

> À coller dans Claude Code, dans le dossier `~/Desktop/Shale`.
> Peut être mené en parallèle de l'étape 1 (sync) — dépendance faible, mais le scénario de test final PC ↔ PC croise les deux chantiers si un poste Windows est disponible pour tester la sync desktop↔desktop réelle.

---

Tu travailles sur Shale (Tauri v2 + React 19 + TypeScript, fork commercial de Second Brain). Lis `CLAUDE.md` à la racine avant toute chose.

## Objectif de cette session

Faire tourner Shale nativement sur Windows : build, packaging, et validation fonctionnelle — pas de nouvelle fonctionnalité, du portage/durcissement multi-plateforme. Tauri v2 supporte Windows nativement ; le travail est donc surtout de la configuration, de la vérification de compatibilité (API OS-spécifiques utilisées côté Rust), et du packaging/signature, pas de réécriture.

## Contexte technique à vérifier en premier

Avant de toucher au packaging, auditer le code Rust et les capabilities pour tout ce qui pourrait être macOS-spécifique et casserait silencieusement sur Windows :

- `src-tauri/src/lib.rs` et tout module `notifications/` : le moteur de notifications a des pièges déjà documentés côté macOS (permission_state toujours "Granted", sleep qui ne compte pas la veille). Vérifier le comportement de `tauri-plugin-notification` sur Windows — les notifications toast Windows ont un modèle de permission différent.
- `src-tauri/src/secrets.rs` (trousseau via crate `keyring`) : la crate `keyring` supporte Windows Credential Manager, mais vérifier le comportement exact (nom de service, erreurs si absent) — ne pas supposer une parité totale avec Keychain macOS.
- `src-tauri/src/crypto.rs` (Argon2id) : pur Rust, devrait être portable sans changement, mais à confirmer par un `cargo check` sur cible Windows.
- Tout usage de `NSPanel`, `NSWindow`, ou API Cocoa-spécifiques dans le code (vérifier absence — le projet ne devrait pas en avoir d'après CLAUDE.md, mais à confirmer par grep).
- `tauri.conf.json` et `capabilities/*.json` : les permissions/capabilities déclarées doivent être vérifiées sur leur disponibilité Windows (ex. certaines API de fenêtre, tray, fichiers).
- Le comportement de fermeture de fenêtre documenté dans CLAUDE.md (`on_window_event`, cacher en fenêtré / quitter en plein écran, tray) : le comportement de tray et de icône système diffère entre macOS et Windows (clic droit vs clic simple, zone de notification) — à adapter si besoin, pas juste copier le comportement mac.

## Étapes

### 1. Setup de la toolchain Windows
- Si le build se fait depuis une VM/machine Windows : installer Rust (rustup), Visual Studio Build Tools (MSVC), WebView2 (déjà présent sur Windows 10/11 récents, sinon bundlé par Tauri).
- Si le build se fait en cross-compilation depuis macOS : évaluer la faisabilité réelle (Tauri v2 supporte mal la cross-compilation vers Windows depuis macOS pour les parties natives — probable qu'une vraie machine/VM Windows ou un runner CI soit nécessaire). Trancher explicitement cette question avant d'avancer, et documenter le choix.

### 2. Premier build
- `npm run tauri build` sur la cible Windows.
- Résoudre les erreurs de compilation Rust liées à la plateforme une par une (dépendances conditionnelles `#[cfg(target_os = "windows")]` à ajouter si besoin, jamais de solution qui casse macOS).
- Vérifier que les migrations SQL et le chemin de la base (`%APPDATA%\com.atnfx.shale\shale.db` sur Windows, équivalent du chemin macOS documenté) sont corrects.

### 3. Packaging & signature
- Format de sortie Windows : `.msi` (WiX) et/ou `.exe` (NSIS) selon la config Tauri.
- Signature de code Windows (Authenticode) : nécessite un certificat de signature de code. Si Antonin n'en a pas encore, documenter clairement que le binaire sera non signé (SmartScreen affichera un avertissement à l'installation) et laisser la décision de payer pour un certificat comme point ouvert — ne pas bloquer le build là-dessus.
- Icône Windows : vérifier que `npm run tauri icon` a bien généré le `.ico` a taille appropriée (le rebranding du 2026-07-27 a régénéré les icônes — confirmer que Windows en fait partie).

### 4. Validation fonctionnelle sur Windows
Checklist minimale à exécuter sur une vraie installation Windows (pas juste "ça compile") :
- Lancement, écran de login/auth gate, mode démo si `config.ts` non renseigné.
- Base SQLite locale : création, lecture, migrations appliquées au premier lancement.
- Toutes les 15 vues s'ouvrent sans erreur console (le portage front ne devrait rien casser puisque c'est la même webview Chromium via WebView2, mais à vérifier — WebView2 a ses propres quirks CSS/JS par rapport à WKWebView macOS).
- Notifications système (toast Windows) : tester réellement l'envoi, pas supposer que ça marche comme sur mac.
- Tray icon + comportement de fermeture de fenêtre (cacher vs quitter) adapté aux conventions Windows.
- Raccourcis clavier (`⌘` n'existe pas sur Windows → vérifier que la palette ⌘K et les raccourcis affichés utilisent `Ctrl` sur Windows, pas juste le symbole mac codé en dur quelque part dans l'UI).
- Si l'étape 1 (sync) est déjà avancée : tester une sync réelle entre ce poste Windows et un Mac sur le même compte — c'est le test multi-plateforme le plus révélateur.

### 5. CI (si pertinent)
- Si un pipeline CI existe déjà (GitHub Actions ou autre) pour le build macOS, évaluer l'ajout d'un job Windows au même pipeline plutôt que de garder le build Windows comme geste manuel ponctuel. Ne pas construire un CI from scratch si aucun n'existe déjà — poser la question à Antonin plutôt que de décider seul d'investir ce temps.

## Contraintes non négociables

- Aucun changement de comportement macOS pour accommoder Windows : tout code spécifique à une plateforme doit être conditionnel (`#[cfg(target_os = "...")]` côté Rust, détection `navigator.platform` ou équivalent côté front si strictement nécessaire — mais préférer des raccourcis/labels déjà abstraits).
- Respecter le design system V6 tel quel — pas d'adaptation visuelle Windows sauf si un composant est objectivement cassé (ex. rendu de police très différent).
- Toute modification de `capabilities/*.json` ou `tauri.conf.json` implique un rebuild des DEUX plateformes avant de considérer la tâche terminée.

## Definition of done

- Build Windows réussi (`.msi` ou `.exe` généré) depuis une machine/VM Windows réelle.
- Checklist de validation fonctionnelle de la section 4 exécutée et documentée (succès/échecs).
- Question de la signature de code tranchée ou explicitement posée à Antonin comme décision en attente.
- `cargo check --lib --tests --bins` vert sur les deux cibles (macOS et Windows) si testable en local.
- CLAUDE.md mis à jour : nouvelle section datée décrivant l'état du support Windows, les pièges rencontrés, et ce qui reste en dette (signature, CI, etc.), dans le même style factuel que les entrées existantes.

## Ce que je veux en retour

Si la cross-compilation depuis macOS s'avère impraticable et qu'aucune machine Windows n'est disponible, dis-le clairement plutôt que de produire un build non testé — un `.msi` qui n'a jamais tourné sur une vraie machine Windows n'est pas un livrable, c'est un pari. Pose la question à Antonin sur l'accès à une machine/VM Windows si ce n'est pas déjà réglé.
