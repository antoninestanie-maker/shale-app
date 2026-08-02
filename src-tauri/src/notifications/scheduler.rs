//! Planificateur : évalue les règles périodiquement, au lancement et au retour
//! au premier plan.
//!
//! ⚠️ Pourquoi un tick d'une MINUTE alors que l'intervalle d'évaluation est de
//! 15 min : sur macOS, `Instant` (donc `tokio::time::sleep`) **ne compte pas le
//! temps passé en veille**. Un `sleep(15 min)` posé avant que le Mac ne dorme
//! trois heures se réveille trois heures en retard, et le rappel de 20 h saute.
//! On dort donc par tranches courtes et on décide sur l'HORLOGE MURALE
//! (`Local::now()` vs `last_run_at`), ce qui rattrape le réveil machine sans
//! rien de spécifique à la veille. Le coût d'un tick sans échéance est une
//! comparaison de dates : l'accès à SQLite n'a lieu qu'à l'évaluation réelle.

use std::time::Duration;

use chrono::{DateTime, Local};
use tauri::{AppHandle, Manager};

use super::engine::{self, Outcome};
use super::model::EvalContext;
use super::rules::registry;
use super::store::NotifStore;
use super::{data, emitter};

/// Période du réveil du planificateur (≠ période d'évaluation).
const TICK: Duration = Duration::from_secs(60);

/// Laisse l'app finir de démarrer avant la première évaluation.
const STARTUP_DELAY: Duration = Duration::from_secs(5);

/// Plancher entre deux évaluations quelle qu'en soit l'origine : sans lui, une
/// alternance rapide de focus déclencherait une rafale de lectures SQLite.
const MIN_GAP_SECS: i64 = 30;

/// Ce qui a demandé l'évaluation. Seul l'intervalle exigé change.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Trigger {
    /// Tick du planificateur : respecte `check_interval_min`.
    Scheduled,
    /// Lancement de l'app ou retour au premier plan : réactif, mais pas plus
    /// souvent que `MIN_GAP_SECS`.
    Foreground,
    /// Demande explicite de l'utilisateur (bouton « évaluer maintenant ») :
    /// aucune temporisation, c'est lui qui décide.
    Manual,
}

/// Démarre la boucle. Un seul appel, au `setup`.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(STARTUP_DELAY).await;
        run(&app, Trigger::Foreground).await;
        loop {
            tokio::time::sleep(TICK).await;
            run(&app, Trigger::Scheduled).await;
        }
    });
}

/// Évalue depuis un contexte synchrone (événement de fenêtre, commande).
pub fn spawn_run(app: &AppHandle, trigger: Trigger) {
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        run(&app, trigger).await;
    });
}

/// Un passage complet : lit l'état, lit la base, évalue, émet.
pub async fn run(app: &AppHandle, trigger: Trigger) -> Option<Outcome> {
    let store = app.state::<NotifStore>();
    let file = store.read();
    let now = Local::now();

    if !is_due(now, file.state.last_run_at, trigger, file.preferences.check_interval_min) {
        return None;
    }
    // Marqué AVANT l'évaluation : si la lecture de la base traîne, deux ticks
    // ne peuvent pas se chevaucher sur la même échéance.
    store.update(|f| f.state.last_run_at = Some(now));

    if !file.preferences.enabled {
        return Some(Outcome::Disabled);
    }

    let db = match super::db_path(app) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("notifications : {e}");
            return None;
        }
    };
    let snapshot = match data::read_snapshot(&db, now.date_naive()).await {
        Ok(s) => s,
        Err(e) => {
            // Base absente ou illisible : on se tait, l'app continue.
            eprintln!("notifications : évaluation ignorée ({e})");
            return None;
        }
    };

    let outcome = engine::evaluate(
        &EvalContext {
            now,
            snapshot: &snapshot,
            prefs: &file.preferences,
            log: &file.log,
        },
        registry(),
    );

    if let Outcome::Emit(entry) = &outcome {
        emitter::deliver(app, entry.clone());
    }
    Some(outcome)
}

/// Faut-il évaluer maintenant ? Pure, donc testable sans app ni horloge système.
fn is_due(
    now: DateTime<Local>,
    last_run: Option<DateTime<Local>>,
    trigger: Trigger,
    interval_min: u64,
) -> bool {
    if trigger == Trigger::Manual {
        return true;
    }
    let Some(last) = last_run else {
        return true; // jamais évalué
    };
    let elapsed = (now - last).num_seconds();
    // Horloge reculée (changement d'heure, réglage manuel) : on ne reste pas
    // bloqué jusqu'à ce que le temps ait rattrapé son retard.
    if elapsed < 0 {
        return true;
    }
    match trigger {
        Trigger::Manual => true,
        Trigger::Foreground => elapsed >= MIN_GAP_SECS,
        Trigger::Scheduled => elapsed >= interval_min as i64 * 60,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::test_support::at;

    #[test]
    fn premiere_evaluation_toujours_autorisee() {
        assert!(is_due(at("2026-07-27 20:00:00"), None, Trigger::Scheduled, 15));
    }

    #[test]
    fn le_tick_respecte_l_intervalle() {
        let last = at("2026-07-27 20:00:00");
        assert!(!is_due(at("2026-07-27 20:14:00"), Some(last), Trigger::Scheduled, 15));
        assert!(is_due(at("2026-07-27 20:15:00"), Some(last), Trigger::Scheduled, 15));
    }

    #[test]
    fn le_retour_au_premier_plan_est_reactif_mais_borne() {
        let last = at("2026-07-27 20:00:00");
        assert!(!is_due(at("2026-07-27 20:00:20"), Some(last), Trigger::Foreground, 15));
        assert!(is_due(at("2026-07-27 20:00:30"), Some(last), Trigger::Foreground, 15));
    }

    #[test]
    fn la_demande_explicite_ne_se_temporise_pas() {
        let last = at("2026-07-27 20:00:00");
        assert!(is_due(at("2026-07-27 20:00:01"), Some(last), Trigger::Manual, 15));
    }

    #[test]
    fn rattrape_un_reveil_de_machine() {
        // Le Mac a dormi 3 h : le tick arrive très en retard, il doit évaluer
        // immédiatement plutôt qu'attendre 15 min de plus.
        let last = at("2026-07-27 17:00:00");
        assert!(is_due(at("2026-07-27 20:00:00"), Some(last), Trigger::Scheduled, 15));
    }

    #[test]
    fn horloge_reculee_ne_bloque_pas_le_planificateur() {
        let last = at("2026-07-27 21:00:00");
        assert!(is_due(at("2026-07-27 20:00:00"), Some(last), Trigger::Scheduled, 15));
    }
}
