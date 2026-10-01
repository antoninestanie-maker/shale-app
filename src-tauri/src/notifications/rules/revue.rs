//! Règle 5 — « ta revue de la semaine est prête à être générée », le dimanche soir.
//!
//! L'IA de Shale Pro (chantier `ia-pro`, phase G). La revue hebdomadaire ne se
//! génère JAMAIS toute seule : cette règle se contente de le proposer, une fois
//! par semaine, à qui a allumé l'IA et sa famille « revue ».
//!
//! Elle se tait :
//!   • avant dimanche, et le dimanche avant son heure (18 h par défaut) ;
//!   • si l'IA est éteinte, non consentie, ou la famille « revue » décochée ;
//!   • si la revue de CETTE semaine existe déjà (`ia_contenus`, `kind = 'revue'`,
//!     rangée au lundi de la semaine) — générée ici ou sur un autre appareil ;
//!   • sur iOS : les écrans d'IA n'y existent pas (V1), la notification
//!     mènerait à un écran vide.
//!
//! ⚠️ Le Rust ne connaît pas l'ABONNEMENT. Un compte qui a allumé l'IA puis
//! quitté Shale Pro recevrait encore ce rappel ; l'écran dit alors pourquoi la
//! revue n'est pas disponible. Assumé : le droit ne se décide que côté serveur.

use chrono::{Datelike, Duration, Timelike, Weekday};

use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

pub struct WeeklyReview;

pub const ID: &str = "weekly_review";

impl NotificationRule for WeeklyReview {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        "Revue de la semaine"
    }

    fn default_prefs(&self) -> RulePrefs {
        // 20 h de cooldown : la clé d'idempotence est déjà hebdomadaire (le
        // lundi de la semaine), le cooldown ne sert qu'à ne pas dériver.
        RulePrefs::new(20, &[("hour", 18)])
    }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        if cfg!(target_os = "ios") {
            return None;
        }
        let prefs = ctx.rule_prefs(ID)?;
        let hour = prefs.param_hour("hour", 18);
        if ctx.now.weekday() != Weekday::Sun || ctx.now.hour() < hour {
            return None;
        }
        let revue = &ctx.snapshot.revue_ia;
        if !revue.active {
            return None;
        }
        // La semaine va du lundi au dimanche : le lundi est six jours plus tôt.
        let lundi = (ctx.today() - Duration::days(6)).format("%Y-%m-%d").to_string();
        if revue.semaines.iter().any(|s| s == &lundi) {
            return None;
        }

        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{lundi}"),
            title: ctx
                .pick("Ta revue de la semaine est prête", "Your weekly review is ready")
                .into(),
            body: ctx
                .pick(
                    "Ce qui a tenu, ce qui a glissé, trois ajustements : ouvre Performance pour la générer.",
                    "What held, what slipped, three adjustments: open Performance to generate it.",
                )
                .into(),
            summary: ctx.pick("Revue de la semaine à générer", "Weekly review to generate").into(),
            target: Some("performance"),
            priority: 10,
            supersedes: &[],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Prefs, RevueIa, Snapshot};
    use crate::notifications::test_support::{at, ctx_at};

    fn prefs(hour: i64) -> Prefs {
        let mut p = Prefs::default();
        let mut rp = WeeklyReview.default_prefs();
        rp.params.insert("hour".into(), serde_json::json!(hour));
        p.rules.insert(ID.into(), rp);
        p
    }

    fn snapshot(active: bool, semaines: &[&str]) -> Snapshot {
        Snapshot {
            revue_ia: RevueIa { active, semaines: semaines.iter().map(|s| (*s).to_string()).collect() },
            ..Default::default()
        }
    }

    // Le 2026-10-04 est un dimanche ; sa semaine commence le lundi 2026-09-28.

    #[test]
    fn se_declenche_le_dimanche_a_son_heure() {
        let snap = snapshot(true, &[]);
        let p = prefs(18);
        let ctx = ctx_at(at("2026-10-04 18:00:00"), &snap, &p, &[]);
        let c = WeeklyReview.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.dedupe_key, "weekly_review:2026-09-28", "une clé par SEMAINE, au lundi");
        assert_eq!(c.target, Some("performance"));
    }

    #[test]
    fn se_tait_avant_l_heure_et_les_autres_jours() {
        let snap = snapshot(true, &[]);
        let p = prefs(18);
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 17:59:00"), &snap, &p, &[])).is_none());
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-03 20:00:00"), &snap, &p, &[])).is_none());
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-05 20:00:00"), &snap, &p, &[])).is_none());
    }

    #[test]
    fn se_tait_si_l_ia_est_eteinte() {
        let snap = snapshot(false, &[]);
        let p = prefs(18);
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 20:00:00"), &snap, &p, &[])).is_none());
    }

    #[test]
    fn se_tait_si_la_revue_de_la_semaine_existe_deja() {
        let p = prefs(18);
        let deja = snapshot(true, &["2026-09-28"]);
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 20:00:00"), &deja, &p, &[])).is_none());
        // La revue de la semaine PRÉCÉDENTE ne compte pas pour celle-ci.
        let ancienne = snapshot(true, &["2026-09-21"]);
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 20:00:00"), &ancienne, &p, &[])).is_some());
    }

    #[test]
    fn l_heure_se_regle() {
        let snap = snapshot(true, &[]);
        let p = prefs(21);
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 20:00:00"), &snap, &p, &[])).is_none());
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 21:00:00"), &snap, &p, &[])).is_some());
    }

    #[test]
    fn sans_prefs_enregistrees_la_regle_ne_dit_rien() {
        let snap = snapshot(true, &[]);
        let p = Prefs::default();
        assert!(WeeklyReview.evaluate(&ctx_at(at("2026-10-04 20:00:00"), &snap, &p, &[])).is_none());
    }
}
