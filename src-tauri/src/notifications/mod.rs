//! Notifications intelligentes — moteur de règles local, journal et préférences.
//!
//! Voir `README.md` (même dossier) pour les règles disponibles, la façon d'en
//! ajouter une et les options de configuration.
//!
//! Découpage :
//! - `model`   — types (préférences, journal, image des données, candidat)
//! - `store`   — `notifications.json` (seul fichier écrit par le Rust)
//! - `data`    — lecture SEULE de `shale.db`
//! - `engine`  — contraintes transverses + regroupement
//! - `planner` — projection dans le futur, pour les plateformes qui suspendent
//! - `rules`   — une règle = un fichier + une ligne au registre

pub mod data;
pub mod emitter;
pub mod engine;
pub mod model;
pub mod planner;
pub mod rules;
pub mod scheduler;
pub mod store;
pub mod task_streak;

#[cfg(test)]
mod test_support;

use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use model::{LogEntry, Prefs};
use store::NotifStore;

/// Prépare le dossier de données et met le journal à disposition des commandes.
///
/// N'échoue jamais, et c'est une garantie nécessaire : les commandes réclament
/// `State<NotifStore>`, or Tauri PANIQUE si un state réclamé n'est pas enregistré.
/// Un dossier de données inaccessible dégraderait donc en crash au premier clic
/// sur la cloche. En dernier recours on se rabat sur le dossier temporaire :
/// les notifications ne survivront pas au redémarrage, mais l'app, si.
pub fn init(app: &AppHandle) {
    let path = data_dir(app)
        .and_then(|dir| {
            std::fs::create_dir_all(&dir)
                .map(|()| dir.join("notifications.json"))
                .map_err(|e| format!("création du dossier de données : {e}"))
        })
        .unwrap_or_else(|e| {
            eprintln!("notifications : {e} — repli sur le dossier temporaire");
            std::env::temp_dir().join("shale-notifications.json")
        });
    app.manage(NotifStore::load(path));
}

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map_err(|e| format!("dossier de données introuvable : {e}"))
}

/// Shale doit-il rester résident quand on ferme la fenêtre ? Sans notifications
/// actives, la résidence n'apporte rien : on quitte comme avant.
pub fn keep_running(app: &AppHandle) -> bool {
    let prefs = app.state::<NotifStore>().read().preferences;
    prefs.enabled && prefs.keep_running_in_background
}

/// Chemin de la base lue par le moteur — la même que celle de `tauri-plugin-sql`.
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    data_dir(app).map(|dir| dir.join("shale.db"))
}

// — Commandes exposées au front —

#[tauri::command]
pub fn notif_list(store: State<NotifStore>) -> Vec<LogEntry> {
    store.read().log
}

#[tauri::command]
pub fn notif_mark_read(id: String, store: State<NotifStore>) -> Vec<LogEntry> {
    store.update(|f| {
        if let Some(e) = f.log.iter_mut().find(|e| e.id == id) {
            e.read = true;
        }
        f.log.clone()
    })
}

#[tauri::command]
pub fn notif_mark_all_read(store: State<NotifStore>) -> Vec<LogEntry> {
    store.update(|f| {
        for e in f.log.iter_mut() {
            e.read = true;
        }
        f.log.clone()
    })
}

#[tauri::command]
pub fn notif_delete(id: String, store: State<NotifStore>) -> Vec<LogEntry> {
    store.update(|f| {
        f.log.retain(|e| e.id != id);
        f.log.clone()
    })
}

/// Vide le journal. Les clés d'idempotence partent avec : une règle déjà
/// déclenchée aujourd'hui pourra donc se redéclencher. C'est le comportement
/// attendu d'un « effacer l'historique », mais il vaut la peine d'être su.
#[tauri::command]
pub fn notif_clear(store: State<NotifStore>) -> Vec<LogEntry> {
    store.update(|f| {
        f.log.clear();
        f.log.clone()
    })
}

#[tauri::command]
pub fn notif_get_prefs(store: State<NotifStore>) -> Prefs {
    store.read().preferences
}

/// Enregistre les préférences et renvoie ce qui a réellement été stocké
/// (valeurs bornées, règles inconnues du front complétées).
#[tauri::command]
pub fn notif_set_prefs(prefs: Prefs, store: State<NotifStore>) -> Prefs {
    store.update(|f| {
        f.preferences = sanitize(prefs);
        // Une règle absente du payload garde ses défauts plutôt que de disparaître.
        for rule in rules::registry() {
            f.preferences
                .rules
                .entry(rule.id().to_string())
                .or_insert_with(|| rule.default_prefs());
        }
        f.preferences.clone()
    })
}

/// État du moteur pour l'écran de préférences. Sans ça, une fonctionnalité dont
/// tout le travail est invisible ne donnerait à l'utilisateur aucun moyen de
/// savoir si le planificateur tourne réellement.
#[derive(serde::Serialize)]
pub struct Status {
    pub last_run_at: Option<chrono::DateTime<chrono::Local>>,
    pub log_count: usize,
}

#[tauri::command]
pub fn notif_status(store: State<NotifStore>) -> Status {
    let f = store.read();
    Status { last_run_at: f.state.last_run_at, log_count: f.log.len() }
}

/// Force une évaluation immédiate (bouton « évaluer maintenant » des réglages).
#[tauri::command]
pub fn notif_run_now(app: AppHandle) {
    scheduler::spawn_run(&app, scheduler::Trigger::Manual);
}

/// Ce que la projection a décidé, rendu au front — pour l'écran de diagnostic
/// et, sur iOS, pour savoir si le système a bien retenu les échéances.
#[derive(serde::Serialize)]
pub struct PlanReport {
    /// `"granted"`, `"denied"`, `"prompt"` — ou `"sans-objet"` sur le bureau,
    /// où le greffon ne connaît pas l'autorisation (cf. en-tête d'`emitter.rs`).
    pub permission: String,
    /// Les échéances calculées, même quand rien n'est déposé : sur le bureau
    /// c'est un diagnostic utile, et sur iOS ça distingue « rien à dire » de
    /// « refusé par le système ».
    pub planned: Vec<PlannedInfo>,
    pub deposited: usize,
    /// Ce que le système DIT avoir en attente. Vide sur le bureau.
    pub pending: Vec<i32>,
}

#[derive(serde::Serialize)]
pub struct PlannedInfo {
    pub at: chrono::DateTime<chrono::Local>,
    pub title: String,
    pub rules: Vec<String>,
}

/// Projette les règles dans le futur et, sur mobile, dépose les échéances
/// auprès du système.
///
/// ⚠️ Ne demande JAMAIS l'autorisation. Sur iOS le dialogue système ne s'ouvre
/// qu'une fois dans la vie de l'app et un refus y est définitif : le demander
/// ici reviendrait à le demander au premier lancement, ce que `MOBILE.md` § 3.6
/// interdit. Sans autorisation, on calcule le plan et on ne dépose rien.
#[tauri::command]
pub async fn notif_plan(app: AppHandle) -> Result<PlanReport, String> {
    // Copies possédées : le verrou du store ne doit pas traverser un `await`.
    let (prefs, log) = {
        let f = app.state::<NotifStore>().read();
        (f.preferences.clone(), f.log.clone())
    };
    let now = chrono::Local::now();

    let db = db_path(&app)?;
    let snapshot = data::read_snapshot(&db, now.date_naive())
        .await
        .map_err(|e| format!("base illisible : {e}"))?;

    let planned = planner::plan(now, &snapshot, &prefs, &log);
    let info: Vec<PlannedInfo> = planned
        .iter()
        .map(|p| PlannedInfo {
            at: p.at,
            title: p.entry.title.clone(),
            rules: p.entry.rules.clone(),
        })
        .collect();

    #[cfg(mobile)]
    {
        let permission = planner::depot::autorisation(&app)?;
        // `PermissionState` ne sait pas se rendre en chaîne : on passe par
        // serde, qui est justement le format que le front attend.
        let permission = serde_json::to_value(permission)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "inconnue".into());
        if permission != "granted" {
            return Ok(PlanReport { permission, planned: info, deposited: 0, pending: vec![] });
        }
        let deposited = planner::depot::deposer(&app, &planned)?;
        let pending = planner::depot::en_attente(&app).unwrap_or_default();
        Ok(PlanReport { permission, planned: info, deposited, pending })
    }
    #[cfg(not(mobile))]
    Ok(PlanReport {
        permission: "sans-objet".into(),
        planned: info,
        deposited: 0,
        pending: vec![],
    })
}

/// Ouvre le dialogue d'autorisation système. À n'appeler QUE depuis un geste
/// explicite de l'utilisateur — l'activation d'un rappel dans les préférences.
///
/// Sur le bureau, sans objet : le greffon y renvoie toujours `Granted` sans
/// rien demander, et le centre in-app reste alimenté de toute façon.
#[tauri::command]
pub fn notif_request_permission(app: AppHandle) -> Result<String, String> {
    #[cfg(mobile)]
    {
        let etat = planner::depot::demander(&app)?;
        Ok(serde_json::to_value(etat)
            .ok()
            .and_then(|v| v.as_str().map(str::to_string))
            .unwrap_or_else(|| "inconnue".into()))
    }
    #[cfg(not(mobile))]
    {
        let _ = &app;
        Ok("sans-objet".into())
    }
}

/// Envoie une notification de test par le chemin complet. C'est le seul moyen
/// fiable de vérifier l'autorisation macOS : le plugin ne la connaît pas
/// (voir l'avertissement en tête de `emitter.rs`).
#[tauri::command]
pub fn notif_test(app: AppHandle) -> LogEntry {
    emitter::deliver_test(&app)
}

/// Garde-fous sur les valeurs venues de l'UI : un plafond à 0 couperait les
/// notifications sans que le réglage « activé » le dise, et un intervalle trop
/// court transformerait le planificateur en boucle de polling.
fn sanitize(mut prefs: Prefs) -> Prefs {
    prefs.daily_cap = prefs.daily_cap.clamp(1, 20);
    prefs.check_interval_min = prefs.check_interval_min.clamp(5, 240);
    prefs.quiet_hours.start = prefs.quiet_hours.start.min(23);
    prefs.quiet_hours.end = prefs.quiet_hours.end.min(24);
    for rule in prefs.rules.values_mut() {
        rule.cooldown_h = rule.cooldown_h.clamp(0, 24 * 30);
    }
    prefs
}

#[cfg(test)]
mod tests {
    use super::*;
    use model::QuietHours;

    /// Contrat front ↔ Rust : l'écran de préférences envoie les seuils propres à
    /// chaque règle À PLAT (`{"enabled":…,"cooldown_h":…,"hour":20}`), pas dans
    /// un sous-objet. C'est ce que produit `#[serde(flatten)]` — et rien côté
    /// TypeScript ne peut le vérifier, d'où ce test.
    #[test]
    fn les_seuils_de_regle_font_l_aller_retour_a_plat() {
        let json = r#"{
            "enabled": true,
            "quiet_hours": { "start": 9, "end": 21 },
            "daily_cap": 3,
            "check_interval_min": 15,
            "keep_running_in_background": false,
            "rules": {
              "habits_pending": { "enabled": true, "cooldown_h": 20, "hour": 19 },
              "inactivity": { "enabled": false, "cooldown_h": 48, "days": 5 }
            }
        }"#;

        let prefs: Prefs = serde_json::from_str(json).expect("payload de l'UI lisible");
        assert_eq!(prefs.rules["habits_pending"].param_hour("hour", 20), 19);
        assert_eq!(prefs.rules["inactivity"].param_i64("days", 3), 5);
        assert!(!prefs.rules["inactivity"].enabled);
        assert!(!prefs.keep_running_in_background);

        // Et ce qu'on renvoie à l'écran garde la même forme.
        let out = serde_json::to_value(sanitize(prefs)).unwrap();
        assert_eq!(out["rules"]["habits_pending"]["hour"], 19);
        assert_eq!(out["rules"]["inactivity"]["days"], 5);
        assert!(out["rules"]["habits_pending"].get("params").is_none());
    }

    /// Une règle envoyée sans ses seuils ne doit pas les perdre : le repli
    /// `param_*` reprend la main plutôt que de laisser la règle sans valeur.
    #[test]
    fn un_seuil_absent_retombe_sur_son_defaut() {
        let prefs: Prefs = serde_json::from_str(
            r#"{"rules":{"habits_pending":{"enabled":true,"cooldown_h":20}}}"#,
        )
        .unwrap();
        assert_eq!(prefs.rules["habits_pending"].param_hour("hour", 20), 20);
    }

    #[test]
    fn les_valeurs_absurdes_sont_bornees() {
        let mut p = Prefs { daily_cap: 0, check_interval_min: 1, ..Default::default() };
        p.quiet_hours = QuietHours { start: 99, end: 99 };
        let p = sanitize(p);
        assert_eq!(p.daily_cap, 1);
        assert_eq!(p.check_interval_min, 5);
        assert_eq!(p.quiet_hours.start, 23);
        assert_eq!(p.quiet_hours.end, 24);
    }
}
