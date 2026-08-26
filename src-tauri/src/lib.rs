
pub mod crypto;
pub mod notifications;
pub mod sauvegardes;
pub mod secrets;

// ⚠️ Menu, tray et raccourci global sont des concepts de BUREAU. `TrayIcon` est
// déclaré `#[cfg(all(desktop, feature = "tray-icon"))]` dans Tauri, et
// `tauri-plugin-global-shortcut` annonce lui-même `level = "none"` sur iOS.
// Sans ces gardes, la compilation mobile échoue sur des symboles inexistants.
#[cfg(desktop)]
use tauri::menu::{Menu, MenuItem};
#[cfg(desktop)]
use tauri::tray::TrayIconBuilder;
use tauri::Manager;
#[cfg(desktop)]
use tauri_plugin_global_shortcut::ShortcutState;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Raccourci global de la quick capture.
///
/// ⚠️ **Alt+Espace est réservé par Windows** : c'est le raccourci du menu
/// système de la fenêtre active (Déplacer / Dimensionner / Fermer). L'y laisser
/// donnerait au mieux un conflit, au pire un raccourci silencieusement inerte.
/// D'où un raccourci distinct par plateforme — et la constante `CAPTURE_LABEL`
/// juste en dessous, pour que le menu du tray n'annonce jamais autre chose que
/// ce qui est réellement enregistré.
#[cfg(all(desktop, target_os = "macos"))]
const CAPTURE_SHORTCUT: &str = "alt+space";
// ⚠️ `all(desktop, ...)` et NON `not(target_os = "macos")` seul : iOS n'est pas
// macOS, donc l'ancienne garde lui aurait donné le raccourci WINDOWS — pour un
// appareil qui n'a ni clavier permanent ni raccourci global. Sur mobile, ces
// deux constantes n'existent tout simplement pas.
#[cfg(all(desktop, not(target_os = "macos")))]
const CAPTURE_SHORTCUT: &str = "ctrl+alt+space";

/// Libellé affiché du raccourci ci-dessus (les glyphes ⌥⌘ n'existent pas sur
/// Windows — un utilisateur Windows lit « Ctrl+Alt », pas « ⌥ »).
#[cfg(all(desktop, target_os = "macos"))]
const CAPTURE_LABEL: &str = "Capture rapide\t⌥Espace";
#[cfg(all(desktop, not(target_os = "macos")))]
const CAPTURE_LABEL: &str = "Capture rapide\tCtrl+Alt+Espace";

/// Affiche/masque la fenêtre de quick capture (raccourci global, tray).
///
/// Bureau uniquement : la fenêtre `capture` n'existe pas sur mobile, où Tauri
/// ne gère qu'une seule webview. L'équivalent iOS est un App Shortcut (cf.
/// `MOBILE.md` § 4.1), qui ouvre l'app sur le composeur de note.
#[cfg(desktop)]
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

#[cfg(desktop)]
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
        Migration {
            version: 17,
            description: "sync_state_device",
            sql: include_str!("../migrations/017_sync_state_device.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 18,
            description: "finance_module",
            sql: include_str!("../migrations/018_finance.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 19,
            description: "drop_benchmark",
            sql: include_str!("../migrations/019_drop_benchmark.sql"),
            kind: MigrationKind::Up,
        },
    ];

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:shale.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            import_screenshot,
            secrets::secret_get,
            secrets::secret_set,
            secrets::secret_delete,
            secrets::secret_available,
            crypto::kdf_argon2id,
            sauvegardes::sauvegarde_creer,
            sauvegardes::sauvegarde_lister,
            sauvegardes::sauvegarde_dossier,
            sauvegardes::sauvegarde_programmer_restauration,
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
            // ⚠️ EN TOUT PREMIER : une restauration demandée s'applique avant que
            // quoi que ce soit n'ouvre la base. Écraser un fichier SQLite sous une
            // connexion vivante corromprait le WAL.
            sauvegardes::appliquer_restauration(app.handle());

            // Journal + préférences de notification (n'échoue jamais, cf. son doc).
            notifications::init(app.handle());
            notifications::scheduler::start(app.handle().clone());

            // Tray + menu : bureau uniquement. Sur iOS il n'y a pas de barre
            // de menus ni de zone de notification — l'app EST son icône.
            #[cfg(desktop)]
            {
                let open = MenuItem::with_id(app, "open", "Ouvrir Shale", true, None::<&str>)?;
                let capture = MenuItem::with_id(app, "capture", CAPTURE_LABEL, true, None::<&str>)?;
                let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &capture, &quit])?;

                let tray = TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    // Conventions opposées, d'où le `cfg` plutôt qu'un réglage unique :
                    //   - macOS, barre de menus : un clic (gauche) déroule le menu ;
                    //   - Windows, zone de notification : le clic GAUCHE ouvre
                    //     l'application, c'est le clic DROIT qui déroule le menu.
                    // Garder `true` sur Windows donnerait une icône qui n'ouvre jamais
                    // l'app — le geste que 100 % des utilisateurs essaient en premier.
                    .show_menu_on_left_click(cfg!(target_os = "macos"))
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => show_main(app),
                        "capture" => toggle_capture(app),
                        "quit" => app.exit(0),
                        _ => {}
                    });

                #[cfg(not(target_os = "macos"))]
                let tray = tray.on_tray_icon_event(|tray, event| {
                    // Sur le relâchement, pas l'appui : c'est ce que fait le reste du
                    // système, et ça évite d'ouvrir la fenêtre sur un début de glisser.
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main(tray.app_handle());
                    }
                });

                tray.build(app)?;
            }

            Ok(())
        })
        ;

    // ─────────────────────────────────────────────────────────────────────
    // BUREAU UNIQUEMENT.
    //
    // Ces deux morceaux n'ont pas d'équivalent sur téléphone, et ce n'est pas
    // une limite de Tauri : un raccourci clavier global suppose un clavier
    // toujours présent et un gestionnaire de fenêtres, et `on_window_event`
    // suppose qu'une fenêtre puisse être FERMÉE par l'utilisateur. Sur iOS,
    // l'app n'est jamais fermée — elle est SUSPENDUE par le système, sans
    // prévenir et sans qu'on puisse s'y opposer.
    //
    // ⚠️ Conséquence à ne pas perdre de vue : tout ce que ce bloc fait pour
    // garder le moteur de rappels vivant (résidence en arrière-plan, reprise
    // au retour au premier plan) n'a AUCUN équivalent mobile. Sur iOS, les
    // rappels devront être PROGRAMMÉS à l'avance auprès du système plutôt
    // qu'évalués par une boucle. Voir `MOBILE.md` § 3.
    // ─────────────────────────────────────────────────────────────────────
    #[cfg(desktop)]
    let builder = builder
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcuts([CAPTURE_SHORTCUT])
                .expect("raccourci global invalide")
                .with_handler(|app, _shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    toggle_capture(app);
                })
                .build(),
        )
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
                //
                // ⚠️ La condition « hors plein écran » est un CONTOURNEMENT DE BUG
                // macOS, pas une règle d'ergonomie : elle n'a aucune raison d'être
                // sur Windows, où cacher une fenêtre plein écran ne laisse aucun
                // espace fantôme derrière elle. L'y recopier ferait quitter l'app
                // à la fermeture d'une fenêtre maximisée — donc plus de rappels,
                // alors même que l'utilisateur a demandé à les garder.
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    let app = window.app_handle();
                    #[cfg(target_os = "macos")]
                    let resident = !window.is_fullscreen().unwrap_or(false);
                    #[cfg(not(target_os = "macos"))]
                    let resident = true;

                    if resident && notifications::keep_running(app) {
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
        ;

    builder
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|_app, _event| {
            // Fenêtre cachée + clic sur l'icône du Dock : macOS envoie `Reopen`.
            // Sans ce branchement, l'app semblerait morte alors qu'elle tourne.
            //
            // ⚠️ `RunEvent::Reopen` est déclaré `#[cfg(target_os = "macos")]` DANS
            // TAURI : sans ce `cfg`, la compilation Windows échoue sur un variant
            // qui n'existe pas. Windows n'a pas de Dock ; l'équivalent est le clic
            // gauche sur l'icône de la zone de notification, câblé au `setup`.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = _event {
                show_main(_app);
            }
        });
}
