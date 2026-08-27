//! Émission : notification système + journal + événement pour le front.
//!
//! ⚠️ Ce qu'on ne peut PAS savoir sur macOS. `tauri-plugin-notification` :
//!   - `permission_state()` / `request_permission()` renvoient toujours
//!     `Granted` sur desktop (ce sont des stubs, cf. `desktop.rs` du plugin) ;
//!   - `show()` délègue l'envoi réel à une tâche de fond et **jette** son
//!     résultat (`let _ = notification.show()`), puis renvoie `Ok(())`.
//!
//! Autrement dit : si l'utilisateur a refusé les notifications dans les
//! Réglages macOS, RIEN ne remonte jusqu'ici. On ne prétend donc pas connaître
//! l'autorisation. Deux conséquences assumées :
//!   1. le centre in-app reçoit TOUJOURS la notification — il est la source de
//!      vérité, et l'app reste utile même bannières coupées ;
//!   2. `handed_to_system` dit « remise au système », pas « affichée ». Le seul
//!      moyen fiable de vérifier côté utilisateur est le bouton « envoyer une
//!      notification de test » (commande `notif_test`), d'où son existence.
//!
//! ⚠️ Windows : le même flou, pour une autre raison, et un piège en plus.
//! Un toast Windows est adressé à un **AppUserModelID**, que le système ne
//! connaît qu'à travers un raccourci du menu Démarrer. Conséquence pratique :
//! **les toasts ne s'affichent pas sous `tauri dev`** (le binaire de debug n'est
//! pas installé, donc pas de raccourci, donc pas d'AUMID enregistré) et
//! réapparaissent une fois l'app installée par le `.msi`/`.exe`. Un « ça ne
//! marche pas » constaté en dev sur Windows ne prouve donc rien — le test doit
//! se faire sur l'app installée. Le centre in-app, lui, reste alimenté dans les
//! deux cas, ce qui est exactement pourquoi il est la source de vérité.

use chrono::Local;
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use super::model::{LogEntry, TEST_RULE};
use super::store::NotifStore;

/// Événement écouté par le front pour rafraîchir cloche et panneau en direct.
pub const EVENT_NEW: &str = "shale:notification";

/// Envoie la notification, l'inscrit au journal et prévient le front.
pub fn deliver(app: &AppHandle, mut entry: LogEntry) {
    entry.handed_to_system = match app
        .notification()
        .builder()
        .title(&entry.title)
        .body(&entry.body)
        .show()
    {
        Ok(()) => true,
        Err(e) => {
            eprintln!("notifications : envoi système impossible ({e})");
            false
        }
    };

    app.state::<NotifStore>().update(|f| f.push(entry.clone()));
    let _ = app.emit(EVENT_NEW, &entry);
}

/// Notification de test déclenchée depuis l'écran de préférences : elle suit
/// exactement le même chemin qu'une vraie (système + journal + événement), ce
/// qui en fait le seul diagnostic honnête de la chaîne complète.
pub fn deliver_test(app: &AppHandle) -> LogEntry {
    let now = Local::now();
    let entry = LogEntry {
        id: format!("n_test_{}", now.timestamp_millis()),
        // `TEST_RULE` exclut aussi cette entrée du plafond quotidien.
        rules: vec![TEST_RULE.into()],
        // Clé unique : un test ne doit jamais bloquer une vraie règle par idempotence.
        dedupe_keys: vec![format!("{TEST_RULE}:{}", now.timestamp_millis())],
        title: "Shale — notification de test".into(),
        // ⚠️ Trois plateformes, pas deux. La première rédaction opposait macOS
        // à « sinon » ; iOS n'étant pas macOS, l'iPhone annonçait « Windows ».
        body: if cfg!(target_os = "macos") {
            "Si tu vois cette bannière, les notifications macOS fonctionnent.".into()
        } else if cfg!(target_os = "ios") {
            "Si tu vois cette bannière, les notifications iOS fonctionnent.".into()
        } else {
            "Si tu vois ce toast, les notifications Windows fonctionnent.".into()
        },
        target: None,
        created_at: now,
        read: false,
        handed_to_system: false,
    };
    deliver(app, entry.clone());
    // On relit le journal : `deliver` a renseigné `handed_to_system`.
    app.state::<NotifStore>()
        .read()
        .log
        .first()
        .cloned()
        .unwrap_or(entry)
}
