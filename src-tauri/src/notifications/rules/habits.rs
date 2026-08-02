//! Règle 2 — habitudes du jour non cochées, à partir d'une heure donnée.
//!
//! Lit `habits` (non archivées) et `habit_checks` du jour, tels que les écrit
//! la vue Journal. Reste muette si aucune habitude n'est définie : relancer
//! quelqu'un qui n'en a pas serait du bruit pur.

use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

pub struct HabitsPending;

pub const ID: &str = "habits_pending";

/// Au-delà, on annonce le nombre sans énumérer — un corps de notification
/// à rallonge est tronqué par macOS de toute façon.
const MAX_NAMES: usize = 3;

impl NotificationRule for HabitsPending {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        "Habitudes non cochées"
    }

    fn default_prefs(&self) -> RulePrefs {
        // 20 h de cooldown, pas 24 : la clé d'idempotence étant déjà journalière,
        // un cooldown de 24 h ferait DÉRIVER le rappel d'un jour sur l'autre
        // (déclenché à 20 h 05, il ne redeviendrait éligible qu'après 20 h 05
        // le lendemain, donc au tick de 20 h 15, et ainsi de suite).
        RulePrefs::new(20, &[("hour", 20)])
    }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        let prefs = ctx.rule_prefs(ID)?;
        let hour = prefs.param_hour("hour", 20);
        if (ctx.now.hour() as u32) < hour {
            return None;
        }

        let pending = ctx.snapshot.habits_pending_on(ctx.today());
        let n = pending.len();
        if n == 0 {
            return None;
        }

        let names: Vec<&str> = pending.iter().take(MAX_NAMES).map(|h| h.name.as_str()).collect();
        let detail = if n <= MAX_NAMES {
            format!(" ({})", names.join(", "))
        } else {
            String::new()
        };

        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{}", ctx.today()),
            title: match (ctx.lang(), n) {
                ("en", 1) => "One habit is waiting".into(),
                ("en", _) => format!("{n} habits are waiting"),
                (_, 1) => "Une habitude t'attend".into(),
                (_, _) => format!("{n} habitudes t'attendent"),
            },
            body: match ctx.lang() {
                "en" => format!(
                    "You still have {n} {} to check off today{detail}.",
                    if n == 1 { "habit" } else { "habits" }
                ),
                _ => format!(
                    "Il te reste {n} {} à cocher aujourd'hui{detail}.",
                    if n == 1 { "habitude" } else { "habitudes" }
                ),
            },
            summary: match ctx.lang() {
                "en" => format!(
                    "{n} {} unchecked",
                    if n == 1 { "habit" } else { "habits" }
                ),
                _ => format!(
                    "{n} {} non cochée{}",
                    if n == 1 { "habitude" } else { "habitudes" },
                    if n == 1 { "" } else { "s" }
                ),
            },
            target: Some("journal"),
            priority: 20,
            supersedes: &[],
        })
    }
}

// `hour()` vient de ce trait ; importé ici pour rester au plus près de l'usage.
use chrono::Timelike;

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Habit, HabitCheck, Prefs, Snapshot};
    use crate::notifications::test_support::{at, ctx_at};

    fn prefs(hour: i64) -> Prefs {
        let mut p = Prefs::default();
        let mut rp = HabitsPending.default_prefs();
        rp.params.insert("hour".into(), serde_json::json!(hour));
        p.rules.insert(ID.into(), rp);
        p
    }

    /// `checked` = ids des habitudes cochées le 27/07/2026.
    fn snapshot(names: &[&str], checked: &[i64]) -> Snapshot {
        Snapshot {
            habits: names
                .iter()
                .enumerate()
                .map(|(i, n)| Habit { id: i as i64 + 1, name: (*n).to_string() })
                .collect(),
            habit_checks: checked
                .iter()
                .map(|id| HabitCheck { habit_id: *id, date: "2026-07-27".into() })
                .collect(),
            knowledge_last_viewed: None,
            ..Default::default()
        }
    }

    #[test]
    fn muette_avant_l_heure_de_rappel() {
        let snap = snapshot(&["Sport", "Lecture"], &[]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 19:59:00"), &snap, &p, &[]);
        assert!(HabitsPending.evaluate(&ctx).is_none());
    }

    #[test]
    fn se_declenche_a_l_heure_pile_et_compte_les_restantes() {
        let snap = snapshot(&["Sport", "Lecture", "Méditation"], &[1]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        let c = HabitsPending.evaluate(&ctx).expect("candidat attendu");
        assert!(c.body.contains("2 habitudes"), "corps : {}", c.body);
        assert!(c.body.contains("Lecture") && c.body.contains("Méditation"));
        assert!(!c.body.contains("Sport"), "l'habitude cochée n'est pas citée");
        assert_eq!(c.dedupe_key, "habits_pending:2026-07-27");
        assert_eq!(c.target, Some("journal"));
    }

    #[test]
    fn silence_quand_tout_est_coche() {
        let snap = snapshot(&["Sport", "Lecture"], &[1, 2]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(HabitsPending.evaluate(&ctx).is_none());
    }

    #[test]
    fn silence_si_aucune_habitude_definie() {
        let snap = snapshot(&[], &[]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
        assert!(HabitsPending.evaluate(&ctx).is_none());
    }

    #[test]
    fn une_coche_de_la_veille_ne_compte_pas_pour_aujourd_hui() {
        let mut snap = snapshot(&["Sport"], &[]);
        snap.habit_checks.push(HabitCheck { habit_id: 1, date: "2026-07-26".into() });
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 20:30:00"), &snap, &p, &[]);
        assert!(HabitsPending.evaluate(&ctx).is_some());
    }

    #[test]
    fn singulier_correct() {
        let snap = snapshot(&["Sport"], &[]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        let c = HabitsPending.evaluate(&ctx).unwrap();
        assert_eq!(c.title, "Une habitude t'attend");
        assert!(c.body.contains("1 habitude à cocher"), "corps : {}", c.body);
        assert_eq!(c.summary, "1 habitude non cochée");
    }

    #[test]
    fn au_dela_de_trois_on_annonce_le_nombre_sans_enumerer() {
        let snap = snapshot(&["a", "b", "c", "d"], &[]);
        let p = prefs(20);
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        let c = HabitsPending.evaluate(&ctx).unwrap();
        assert!(c.body.contains("4 habitudes"));
        assert!(!c.body.contains('('), "pas d'énumération : {}", c.body);
    }

    #[test]
    fn heure_de_rappel_configurable() {
        let snap = snapshot(&["Sport"], &[]);
        let p = prefs(9);
        assert!(HabitsPending
            .evaluate(&ctx_at(at("2026-07-27 09:00:00"), &snap, &p, &[]))
            .is_some());
        assert!(HabitsPending
            .evaluate(&ctx_at(at("2026-07-27 08:30:00"), &snap, &p, &[]))
            .is_none());
    }
}
