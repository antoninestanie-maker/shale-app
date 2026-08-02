
pub mod notifications;
pub mod secrets;

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Affiche/masque la fenêtre de quick capture (⌥Espace, tray).
fn toggle_capture(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("capture") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            let _ = win.show();
            let _ = win.set_focus();
        }
    }
}

fn show_main(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }
}

/// Copie un screenshot de trade dans le dossier de l'app, renvoie le chemin final.
#[tauri::command]
fn import_screenshot(app: tauri::AppHandle, src: String) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("screenshots");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let src_path = std::path::Path::new(&src);
    let fname = src_path
        .file_name()
        .ok_or("fichier invalide")?
        .to_string_lossy()
        .to_string();
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();
    let dest = dir.join(format!("{ts}_{fname}"));
    std::fs::copy(src_path, &dest).map_err(|e| format!("copie : {e}"))?;
    Ok(dest.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "performance_module",
            sql: include_str!("../migrations/002_performance.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "capture_module",
            sql: include_str!("../migrations/003_capture.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "focus_module",
            sql: include_str!("../migrations/004_focus.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "notes_journal_habits",
            sql: include_str!("../migrations/005_notes.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "trading_journal",
            sql: include_str!("../migrations/006_trading.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "trade_mode_backtest",
            sql: include_str!("../migrations/007_trade_mode.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "position_size_calculator",
            sql: include_str!("../migrations/008_position_sizing.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "human_benchmark",
            sql: include_str!("../migrations/009_benchmark.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "market_brain_briefings",
            sql: include_str!("../migrations/010_market.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "goal_category",
            sql: include_str!("../migrations/011_goal_category.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "live_tracker",
            sql: include_str!("../migrations/012_live_tracker.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "knowledge_base",
            sql: include_str!("../migrations/013_knowledge.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "knowledge_note_text",
            sql: include_str!("../migrations/014_knowledge_text.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "sync_identity",
            sql: include_str!("../migrations/015_sync_identity.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "sync_outbox",
            sql: include_str!("../migrations/016_sync_outbox.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:shale.db", migrations)
                .build(),
        )
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts(["alt+space"])
                .expect("raccourci global invalide")
                .with_handler(|app, _shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    toggle_capture(app);
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            import_screenshot,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_available,
            notifications::notif_list,
            notifications::notif_mark_read,
            notifications::notif_mark_all_read,
            notifications::notif_delete,
            notifications::notif_clear,
            notifications::notif_get_prefs,
            notifications::notif_set_prefs,
            notifications::notif_status,
            notifications::notif_run_now,
            notifications::notif_test,
        ])
        .setup(|app| {
            // Journal + préférences de notification (n'échoue jamais, cf. son doc).
            notifications::init(app.handle());
            notifications::scheduler::start(app.handle().clone());

            let open = MenuItem::with_id(app, "open", "Ouvrir Shale", true, None::<&str>)?;
            let capture =
                MenuItem::with_id(app, "capture", "Capture rapide\t⌥Espace", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &capture, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main(app),
                    "capture" => toggle_capture(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            match event {
                // Fermeture de la fenêtre principale.
                //
                // Historique : `prevent_close()` + `hide()` laissait un espace
                // plein écran macOS fantôme → écran noir. D'où l'`exit(0)`
                // systématique adopté ensuite. Mais l'app morte, plus aucun
                // rappel ne peut partir.
                //
                // Compromis retenu : on ne cache la fenêtre QU'EN MODE FENÊTRÉ,
                // c'est-à-dire hors du cas qui produisait le bug ; en plein
                // écran on quitte exactement comme avant. Et on ne reste
                // résident que si les notifications sont réellement actives
                // (réglage « garder Shale actif en arrière-plan »), sinon la
                // résidence ne servirait à rien.
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let app = window.app_handle();
                    let fullscreen = window.is_fullscreen().unwrap_or(false);
                    if !fullscreen && notifications::keep_running(app) {
                        api.prevent_close();
                        let _ = window.hide();
                    } else {
                        app.exit(0);
                    }
                }
                // Retour au premier plan : on rattrape une échéance manquée
                // pendant que l'app était en arrière-plan ou la machine en veille.
                tauri::WindowEvent::Focused(true) => {
                    notifications::scheduler::spawn_run(
                        window.app_handle(),
                        notifications::scheduler::Trigger::Foreground,
                    );
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            // Fenêtre cachée + clic sur l'icône du Dock : macOS envoie `Reopen`.
            // Sans ce branchement, l'app semblerait morte alors qu'elle tourne.
            if let tauri::RunEvent::Reopen { .. } = event {
                show_main(app);
            }
        });
}
