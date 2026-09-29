//! Ce que chaque fenêtre a le DROIT de demander au natif.
//!
//! ⚠️ Pourquoi ce test existe (PIEGES § 26.1) : une commande que la capacité de
//! la fenêtre n'autorise pas est refusée par l'ACL de Tauri SANS AUCUN BRUIT —
//! la promesse JS est rejetée, et le `catch` qui l'entoure l'avale. Rien à
//! l'écran, rien dans un journal : l'app a vécu ainsi des semaines.
//!
//! On interroge ici l'autorité RÉELLE : celle que `generate_context!` compile à
//! partir de `capabilities/*.json`, la même qui part dans le binaire. Rien n'est
//! réimplémenté — si Tauri change sa façon de résoudre, le test suit.
//!
//! ▶️ Règle : tout nouvel appel natif du front (fenêtre, webview, greffon) entre
//! dans `APPELS`, avec la fenêtre QUI L'APPELLE — c'est elle que l'ACL regarde,
//! pas la fenêtre visée. Le nom exact de la commande se lit dans
//! `node_modules/@tauri-apps/*` (`invoke('plugin:…|…')`).

use tauri::ipc::Origin;
use tauri::{Context, Wry};

/// (fenêtre qui appelle, commande IPC, où c'est dans le front)
const APPELS: &[(&str, &str, &str)] = &[
    // ── Fenêtre principale ───────────────────────────────────────────────────
    ("main", "plugin:window|set_background_color", "lib/theme.ts — peindreLaFenetre"),
    ("main", "plugin:window|start_dragging", "Sidebar.tsx — data-tauri-drag-region (drag.js de Tauri)"),
    ("main", "plugin:window|internal_toggle_maximize", "Sidebar.tsx — double-clic sur la poignée"),
    ("main", "plugin:window|set_size", "App.tsx, AdminView.tsx — taille de fenêtre"),
    ("main", "plugin:window|scale_factor", "AdminView.tsx — mémoriser la taille"),
    ("main", "plugin:window|inner_size", "AdminView.tsx — mémoriser la taille"),
    ("main", "plugin:window|get_all_windows", "lib/timerFenetre.ts — WebviewWindow.getByLabel"),
    ("main", "plugin:webview|create_webview_window", "lib/timerFenetre.ts — ouvrirFenetreTimer"),
    ("main", "plugin:window|unminimize", "lib/timerFenetre.ts — ramener une fenêtre"),
    ("main", "plugin:window|show", "lib/timerFenetre.ts — ramener une fenêtre"),
    ("main", "plugin:window|set_focus", "lib/timerFenetre.ts — ramener une fenêtre"),
    ("main", "plugin:event|listen", "App.tsx, notifications.ts, timerFenetre.ts"),
    ("main", "plugin:event|unlisten", "App.tsx, notifications.ts, timerFenetre.ts"),
    ("main", "plugin:event|emit", "lib/timerFenetre.ts — diffuserEtat"),
    ("main", "plugin:sql|load", "lib/db.ts"),
    ("main", "plugin:sql|select", "lib/db.ts"),
    ("main", "plugin:sql|execute", "lib/db.ts"),
    ("main", "plugin:dialog|open", "TradeModal.tsx, useDepotPieceJointe.ts"),
    ("main", "plugin:dialog|save", "lib/fichiers.ts, SettingsView.tsx"),
    ("main", "plugin:opener|open_url", "QuickLinks.tsx, knowledge.ts, auth/external.ts"),
    ("main", "plugin:notification|is_permission_granted", "lib/useFocus.ts"),
    ("main", "plugin:notification|request_permission", "lib/useFocus.ts (window.Notification)"),
    ("main", "plugin:notification|notify", "lib/useFocus.ts (window.Notification)"),
    ("main", "plugin:http|fetch", "lib/market/http.ts"),
    ("main", "plugin:http|fetch_send", "lib/market/http.ts"),
    ("main", "plugin:http|fetch_read_body", "lib/market/http.ts"),
    ("main", "plugin:http|fetch_cancel", "lib/market/http.ts (abandon)"),
    // ── Barre de capture (transparente) ──────────────────────────────────────
    ("capture", "plugin:window|hide", "CapturePane.tsx — Échap, après ajout"),
    ("capture", "plugin:sql|load", "CapturePane.tsx — createTask"),
    ("capture", "plugin:sql|execute", "CapturePane.tsx — createTask"),
    ("capture", "plugin:event|emit", "CapturePane.tsx — sb:data-changed"),
    // ── Fenêtre séparée du Timer ─────────────────────────────────────────────
    ("timer", "plugin:window|is_fullscreen", "TimerPane.tsx"),
    ("timer", "plugin:window|is_always_on_top", "TimerPane.tsx"),
    ("timer", "plugin:window|set_fullscreen", "TimerPane.tsx — plein écran"),
    ("timer", "plugin:window|set_always_on_top", "TimerPane.tsx — garder au premier plan"),
    ("timer", "plugin:window|close", "lib/timerFenetre.ts — fermerCetteFenetre"),
    ("timer", "plugin:window|start_dragging", "TimerPane.tsx, EcranTimer.tsx — data-tauri-drag-region"),
    ("timer", "plugin:window|internal_toggle_maximize", "TimerPane.tsx — double-clic sur la poignée"),
    ("timer", "plugin:event|listen", "lib/timerFenetre.ts — ecouterEtat, onResized"),
    ("timer", "plugin:event|unlisten", "lib/timerFenetre.ts"),
    ("timer", "plugin:event|emit", "lib/timerFenetre.ts — envoyerCommande"),
];

/// Ce qu'une fenêtre ne doit PAS pouvoir faire, et pourquoi.
const INTERDITS: &[(&str, &str, &str)] = &[
    (
        "capture",
        "plugin:window|set_background_color",
        "fenêtre TRANSPARENTE : un fond peint en ferait un rectangle opaque",
    ),
    (
        "timer",
        "plugin:window|set_background_color",
        "reçoit sa couleur à la création (ouvrirFenetreTimer), pas après",
    ),
    ("timer", "plugin:sql|load", "la fenêtre du Timer n'ouvre jamais la base (timer.json)"),
    ("timer", "plugin:sql|execute", "la fenêtre du Timer n'ouvre jamais la base (timer.json)"),
];

fn contexte() -> Context<Wry> {
    tauri::generate_context!()
}

/// Une fenêtre créée avec sa webview porte la même étiquette que celle-ci ;
/// l'origine est locale (l'app sert ses propres pages).
fn permis(ctx: &mut Context<Wry>, fenetre: &str, commande: &str) -> bool {
    ctx.runtime_authority_mut()
        .resolve_access(commande, fenetre, fenetre, &Origin::Local)
        .is_some()
}

#[test]
fn chaque_appel_natif_du_front_est_permis_dans_sa_fenetre() {
    let mut ctx = contexte();
    let refuses: Vec<String> = APPELS
        .iter()
        .filter(|(fenetre, commande, _)| !permis(&mut ctx, fenetre, commande))
        .map(|(fenetre, commande, ou)| format!("  [{fenetre}] {commande}   ← {ou}"))
        .collect();
    assert!(
        refuses.is_empty(),
        "L'ACL REFUSE ces appels (et le front ne le voit pas) :\n{}",
        refuses.join("\n")
    );
}

#[test]
fn ce_qu_une_fenetre_ne_doit_pas_faire_lui_reste_interdit() {
    let mut ctx = contexte();
    let permis_a_tort: Vec<String> = INTERDITS
        .iter()
        .filter(|(fenetre, commande, _)| permis(&mut ctx, fenetre, commande))
        .map(|(fenetre, commande, pourquoi)| format!("  [{fenetre}] {commande}   ← {pourquoi}"))
        .collect();
    assert!(
        permis_a_tort.is_empty(),
        "Ces appels devraient être REFUSÉS :\n{}",
        permis_a_tort.join("\n")
    );
}

/// Témoin que la question posée a un sens : une commande qu'aucune capacité
/// n'accorde est bien refusée. Sans lui, un `resolve_access` qui dirait « oui »
/// à tout ferait passer les deux tests ci-dessus.
#[test]
fn une_commande_jamais_accordee_est_refusee() {
    let mut ctx = contexte();
    assert!(!permis(&mut ctx, "main", "plugin:window|set_ignore_cursor_events"));
    assert!(!permis(&mut ctx, "fenetre-inconnue", "plugin:window|hide"));
}
