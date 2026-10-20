//! Règle 3 — série en danger, avant la fin de la journée.
//!
//! ⭐ DEPUIS LE 2026-10-20, ELLE NE SURVEILLE QUE LA SÉRIE D'HABITUDES — celle
//! de l'anneau et de la tuile « série en cours » d'Aujourd'hui
//! (`discipline_habitudes.rs`, portage de `disciplineHabitudes.ts`). Antonin :
//! « on passe sur les habitudes ». Avant, elle surveillait aussi la série de
//! TÂCHES (≥ 80 % des tâches prévues) : l'écran ne l'affichant plus, la
//! notification parlait d'une série que personne ne voyait.
//!
//! On regarde la série ARRÊTÉE À HIER : c'est elle que la journée en cours peut
//! rompre. Elle est en danger si la journée n'est pas encore tenue (75 %). Une
//! série de 0 ou 1 jour ne mérite pas qu'on dérange (seuil `min_streak`).

use chrono::Timelike;

use super::NotificationRule;
use crate::notifications::discipline_habitudes::{self, SEUIL_JOUR_TENU};
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

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
        let etat = discipline_habitudes::etat(ctx.snapshot, today);
        let serie = etat.serie_avant;
        // `pct` absent : aucune habitude ne compte, rien à rompre.
        let pct = etat.pct?;
        if serie < min_streak || pct >= SEUIL_JOUR_TENU {
            return None;
        }
        let reste = etat.a_cocher_pour_tenir();

        let en = ctx.lang() == "en";
        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{today}"),
            title: if en {
                format!("Your {serie}-day streak is on the line")
            } else {
                format!("Ta série de {serie} jours est en jeu")
            },
            body: if en {
                format!(
                    "{serie} days of habits kept in a row. Check {reste} more {} to keep today too.",
                    if reste == 1 { "habit" } else { "habits" }
                )
            } else {
                format!(
                    "{serie} jours d'habitudes tenus d'affilée. Coche encore {reste} {} pour tenir aujourd'hui aussi.",
                    if reste == 1 { "habitude" } else { "habitudes" }
                )
            },
            summary: if en {
                format!("{serie}-day streak at risk")
            } else {
                format!("Série de {serie} jours en danger")
            },
            // La vue Habitudes (identifiant de vue `journal`).
            target: Some("journal"),
            priority: 30,
            // Cette règle dit déjà ce qu'il reste à cocher : laisser en plus le
            // rappel d'habitudes reviendrait à répéter le même constat en moins
            // urgent.
            supersedes: &[super::habits::ID],
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

    /// Une habitude par entrée de `coches`, cochée les jours donnés.
    fn habitudes(coches: &[&[&str]]) -> Snapshot {
        Snapshot {
            habits: (0..coches.len())
                .map(|i| Habit { id: i as i64 + 1, name: format!("h{i}"), is_example: false })
                .collect(),
            habit_checks: coches
                .iter()
                .enumerate()
                .flat_map(|(i, jours)| {
                    jours.iter().map(move |d| HabitCheck { habit_id: i as i64 + 1, date: (*d).into() })
                })
                .collect(),
            ..Default::default()
        }
    }

    const TROIS_JOURS: &[&str] = &["2026-07-26", "2026-07-25", "2026-07-24"];

    #[test]
    fn muette_avant_l_heure() {
        let snap = habitudes(&[TROIS_JOURS]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 20:30:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn serie_d_habitudes_en_danger() {
        let snap = habitudes(&[TROIS_JOURS]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.title, "Ta série de 3 jours est en jeu");
        assert!(c.body.contains("Coche encore 1 habitude "), "corps : {}", c.body);
        assert_eq!(c.target, Some("journal"));
        assert_eq!(c.supersedes, &["habits_pending"], "n'ajoute pas un doublon");
    }

    #[test]
    fn la_journee_deja_tenue_ne_declenche_rien() {
        // 3 habitudes sur 4 cochées aujourd'hui : 75 %, la journée est tenue.
        let mut avec_auj: Vec<&str> = TROIS_JOURS.to_vec();
        avec_auj.push("2026-07-27");
        let snap = habitudes(&[&avec_auj, &avec_auj, &avec_auj, TROIS_JOURS]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn la_serie_se_lit_a_75_pour_cent_comme_a_l_ecran() {
        // Hier et avant-hier, 3 habitudes sur 4 seulement : la série tient
        // quand même (une habitude manquée sur quatre est pardonnée). Avant le
        // 2026-10-20, il fallait TOUT cocher, et cette série valait 0.
        let snap = habitudes(&[TROIS_JOURS, TROIS_JOURS, TROIS_JOURS, &["2026-07-24"]]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.title, "Ta série de 3 jours est en jeu");
        assert!(c.body.contains("Coche encore 3 habitudes"), "3/4 pour tenir : {}", c.body);
    }

    #[test]
    fn une_serie_trop_courte_ne_derange_pas() {
        let snap = habitudes(&[&["2026-07-26"]]);
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn la_serie_de_taches_ne_declenche_plus_rien() {
        // Trois jours de tâches tenus, aucune habitude : plus de notification.
        let snap = Snapshot {
            tasks: vec![Task {
                id: 1,
                recurrence: Some("daily".into()),
                created_at: None,
                due_date: None,
                state: None,
                state_since: None,
                pauses: None,
                ponctuelle_depuis: None,
            }],
            completions: TROIS_JOURS
                .iter()
                .map(|d| Completion { task_id: 1, date: (*d).to_string(), done: true })
                .collect(),
            ..Default::default()
        };
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }

    #[test]
    fn un_exemple_ne_menace_aucune_serie() {
        let mut snap = habitudes(&[TROIS_JOURS]);
        snap.habits.push(Habit { id: 9, name: "Exemple".into(), is_example: true });
        snap.habit_checks.push(HabitCheck { habit_id: 9, date: "2026-07-27".into() });
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("l'exemple coché ne tient pas la journée");
        assert!(c.body.contains("Coche encore 1 habitude "));
    }

    #[test]
    fn en_anglais() {
        let snap = habitudes(&[TROIS_JOURS]);
        let mut p = prefs(21, 3);
        p.lang = "en".into();
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        let c = StreakAtRisk.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.title, "Your 3-day streak is on the line");
        assert!(c.body.contains("Check 1 more habit to keep today"), "{}", c.body);
    }

    #[test]
    fn sans_donnees_la_regle_reste_inerte() {
        let snap = Snapshot::default();
        let p = prefs(21, 3);
        let ctx = ctx_at(at("2026-07-27 23:00:00"), &snap, &p, &[]);
        assert!(StreakAtRisk.evaluate(&ctx).is_none());
    }
}
