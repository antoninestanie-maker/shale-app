//! Règle 3 — série en danger, avant la fin de la journée.
//!
//! Deux séries coexistent dans Shale et la règle surveille les DEUX :
//!   - la série de **tâches** (jours consécutifs à ≥ 80 % des tâches dues),
//!     celle du bandeau de performance — voir `task_streak.rs` ;
//!   - la série d'**habitudes** (jours consécutifs où toutes ont été cochées).
//!
//! Dans les deux cas on regarde la série ARRÊTÉE À HIER : c'est elle que la
//! journée en cours peut rompre. Une série de 0 ou 1 jour ne mérite pas qu'on
//! dérange (seuil `min_streak`).

use chrono::Timelike;

use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};
use crate::notifications::task_streak::{self, STREAK_THRESHOLD};

pub struct StreakAtRisk;

pub const ID: &str = "streak_at_risk";

impl NotificationRule for StreakAtRisk {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        "Série en danger"
    }

    fn default_prefs(&self) -> RulePrefs {
        // 21 h par défaut : après le rappel d'habitudes (20 h), pour que la
        // relance douce précède l'avertissement.
        RulePrefs::new(20, &[("hour", 21), ("min_streak", 3)])
    }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        let prefs = ctx.rule_prefs(ID)?;
        let hour = prefs.param_hour("hour", 21);
        let min_streak = prefs.param_i64("min_streak", 3).max(1);
        if (ctx.now.hour() as u32) < hour {
            return None;
        }

        let today = ctx.today();
        let snap = ctx.snapshot;

        // Habitudes : série menacée s'il reste quelque chose à cocher.
        let pending = snap.habits_pending_on(today).len();
        let habit_streak = snap.habit_streak_before(today);
        let habits_at_risk = pending > 0 && habit_streak >= min_streak;

        // Tâches : la journée doit avoir quelque chose à faire (sinon elle est
        // neutre et ne rompt rien) et être encore sous le seuil.
        let task_streak = task_streak::streak_before(&snap.tasks, &snap.completions, today);
        let pct = task_streak::today_pct(&snap.tasks, &snap.completions, today);
        let tasks_at_risk =
            task_streak >= min_streak && matches!(pct, Some(p) if p < STREAK_THRESHOLD);

        if !habits_at_risk && !tasks_at_risk {
            return None;
        }

        let mut parts: Vec<String> = Vec::new();
        let en = ctx.lang() == "en";
        if habits_at_risk {
            parts.push(if en {
                format!(
                    "{habit_streak} days of habits kept, and {pending} {} left to check",
                    if pending == 1 { "habit" } else { "habits" }
                )
            } else {
                format!(
                    "{habit_streak} jours d'habitudes tenues, et il reste {pending} {} à cocher",
                    if pending == 1 { "habitude" } else { "habitudes" }
                )
            });
        }
        if tasks_at_risk {
            parts.push(if en {
                format!(
                    "{task_streak} days at {STREAK_THRESHOLD}% of your tasks, and you're at {}% today",
                    pct.unwrap_or(0)
                )
            } else {
                format!(
                    "{task_streak} jours à {STREAK_THRESHOLD} % de tes tâches, et tu es à {} % aujourd'hui",
                    pct.unwrap_or(0)
                )
            });
        }

        let longest = habit_streak.max(task_streak);

        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{today}"),
            title: match (en, parts.len()) {
                (true, 2) => "Both your streaks are on the line".into(),
                (true, _) => format!("Your {longest}-day streak is on the line"),
                (false, 2) => "Tes deux séries sont en jeu".into(),
                (false, _) => format!("Ta série de {longest} jours est en jeu"),
            },
            body: if en {
                format!("{}. There's still a bit of time.", parts.join("; "))
            } else {
                format!("{}. Il reste un peu de temps.", parts.join(" ; "))
            },
            summary: if en {
                format!("{longest}-day streak at risk")
            } else {
                format!("Série de {longest} jours en danger")
            },
            // Le tableau de bord porte les deux séries ; le Journal ne porte que
            // les habitudes.
            target: Some(if tasks_at_risk { "today" } else { "journal" }),
            priority: 30,
            // Quand c'est la série d'habitudes qui est menacée, cette règle dit
            // déjà « il reste N habitudes à cocher » : laisser en plus le rappel
            // d'habitudes reviendrait à répéter le même constat en moins urgent.
            supersedes: if habits_at_risk {
                &[super::habits::ID]
            } else {
                &[]
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Completion, Habit, HabitCheck, Prefs, Snapshot, Task};
    use crate::notifications::test_support::{at, ctx_at};

    fn prefs(hour: i64, min_streak: i64) -> Prefs {
        let mut p = Prefs::default();
        let mut rp = StreakAtRisk.default_prefs();
        rp.params.insert("hour".into(), serde_json::json!(hour));
        rp.params.insert("min_streak".into(), serde_json::json!(min_streak));
        p.rules.insert(ID.into(), rp);
        p
    }

    /// Habitude unique, cochée les `days` jours donnés.
    fn with_habits(days: &[&str]) -> Snapshot {
        Snapshot {
            habits: vec![Habit { id: 1, name: "Sport".into() }],
            habit_checks: days
                .iter()
                .map(|d| HabitCheck { habit_id: 1, date: (*d).to_string() })
                .collect(),
            ..Default::default()
        }
    }

    /// Tâche quotidienne, faite les `days` jours donnés.
    fn with_tasks(days: &[&str]) -> Snapshot {
        Snapshot {
            tasks: vec![Task {
                id: 1,
                recurrence: Some("daily".into()),
                created_at: None,
            }],
            completions: days
                .iter()
                .map(|d| Completion { task_id: 1, date: (*d).to_string(), done: true })
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn muette_avant_l_heure() {
        let snap = with_habits(&["2026-07-26", "2026-07-25", "2026-07-24"]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 20:30:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn serie_d_habitudes_en_danger() {
        let snap = with_habits(&["2026-07-26", "2026-07-25", "2026-07-24"]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.title, "Ta série de 3 jours est en jeu");
        assert!(c.body.contains("1 habitude à cocher"), "corps : {}", c.body);
        assert_eq!(c.target, Some("journal"));
        assert_eq!(c.supersedes, &["habits_pending"], "n'ajoute pas un doublon");
    }

    #[test]
    fn rien_a_signaler_si_l_habitude_est_deja_cochee() {
        let snap = with_habits(&["2026-07-27", "2026-07-26", "2026-07-25", "2026-07-24"]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn une_serie_trop_courte_ne_derange_pas() {
        let snap = with_habits(&["2026-07-26"]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn serie_de_taches_en_danger() {
        let snap = with_tasks(&["2026-07-26", "2026-07-25", "2026-07-24"]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert!(c.body.contains("3 jours à 80 %"), "corps : {}", c.body);
        assert!(c.body.contains("0 % aujourd'hui"));
        assert_eq!(c.target, Some("today"));
        assert!(c.supersedes.is_empty(), "aucune habitude en cause ici");
    }

    #[test]
    fn les_deux_series_a_la_fois() {
        let mut snap = with_tasks(&["2026-07-26", "2026-07-25", "2026-07-24"]);
        let h = with_habits(&["2026-07-26", "2026-07-25", "2026-07-24", "2026-07-23"]);
        snap.habits = h.habits;
        snap.habit_checks = h.habit_checks;

        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.title, "Tes deux séries sont en jeu");
        assert!(c.body.contains("4 jours d'habitudes"));
        assert!(c.body.contains("3 jours à 80 %"));
        assert_eq!(c.summary, "Série de 4 jours en danger", "la plus longue");
        assert_eq!(c.target, Some("today"));
    }

    #[test]
    fn une_journee_sans_tache_due_ne_met_rien_en_danger() {
        // Tâche du lundi au vendredi ; on est samedi : journée neutre.
        let snap = Snapshot {
            tasks: vec![Task {
                id: 1,
                recurrence: Some("weekdays".into()),
                created_at: None,
            }],
            completions: vec![
                Completion { task_id: 1, date: "2026-07-31".into(), done: true },
                Completion { task_id: 1, date: "2026-07-30".into(), done: true },
                Completion { task_id: 1, date: "2026-07-29".into(), done: true },
            ],
            ..Default::default()
        };
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-08-01 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn sans_donnees_la_regle_reste_inerte() {
        let snap = Snapshot::default();
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 23:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }
}
