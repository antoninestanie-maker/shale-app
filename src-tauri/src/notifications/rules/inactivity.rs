//! Règle 1 — ré-engagement : N jours sans ouvrir une fiche du Savoir.
//!
//! La date de référence est `knowledge.last_viewed_at` (table `settings`),
//! écrite par le front à l'ouverture d'une fiche. Si la clé est absente
//! (installation antérieure à cette fonctionnalité), `data.rs` retombe sur
//! `max(knowledge_entries.updated_at)` ; si le Savoir est vide, la règle reste
//! inerte plutôt que de relancer quelqu'un qui n'a jamais rien écrit.

use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

pub struct Inactivity;

pub const ID: &str = "inactivity";

impl NotificationRule for Inactivity {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        "Savoir délaissé"
    }

    fn default_prefs(&self) -> RulePrefs {
        // 48 h de cooldown, pas 24 : la clé d'idempotence étant journalière, un
        // cooldown de 24 h autoriserait un rappel CHAQUE jour tant que le Savoir
        // reste fermé. 48 h espace la relance sans jamais l'éteindre.
        RulePrefs::new(48, &[("days", 3)])
    }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        let prefs = ctx.rule_prefs(ID)?;
        let threshold = prefs.param_i64("days", 3).max(1);
        let last = ctx.snapshot.knowledge_last_viewed?;
        let days = (ctx.today() - last.date()).num_days();
        if days < threshold {
            return None;
        }

        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:{}", ctx.today()),
            title: ctx.pick("Ton savoir t'attend", "Your knowledge is waiting").into(),
            body: match ctx.lang() {
                "en" => format!(
                    "{days} days without opening a note. Two minutes are enough to pick the thread back up."
                ),
                _ => format!(
                    "{days} jours sans ouvrir une fiche. Deux minutes suffisent pour reprendre le fil."
                ),
            },
            summary: match ctx.lang() {
                "en" => format!("Knowledge: {days} days untouched"),
                _ => format!("Savoir : {days} jours sans passage"),
            },
            target: Some("knowledge"),
            priority: 10,
            supersedes: &[],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Prefs, Snapshot};
    use crate::notifications::test_support::{at, ctx_at, naive};

    /// Préférences minimales : la seule règle inactivité, seuil paramétrable.
    fn prefs(days: i64, enabled: bool) -> Prefs {
        let mut p = Prefs::default();
        let mut rp = Inactivity.default_prefs();
        rp.enabled = enabled;
        rp.params.insert("days".into(), serde_json::json!(days));
        p.rules.insert(ID.into(), rp);
        p
    }

    fn snapshot(last_viewed: Option<&str>) -> Snapshot {
        Snapshot {
            knowledge_last_viewed: last_viewed.map(naive),
            ..Default::default()
        }
    }

    #[test]
    fn se_tait_sous_le_seuil() {
        let snap = snapshot(Some("2026-07-25 09:00:00"));
        let p = prefs(3, true);
        // 2 jours écoulés seulement.
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        assert!(Inactivity.evaluate(&ctx).is_none());
    }

    #[test]
    fn se_declenche_au_seuil_exact() {
        let snap = snapshot(Some("2026-07-24 09:00:00"));
        let p = prefs(3, true);
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        let c = Inactivity.evaluate(&ctx).expect("candidat attendu");
        assert_eq!(c.rule, ID);
        assert_eq!(c.dedupe_key, "inactivity:2026-07-27");
        assert!(c.body.contains('3'), "le corps annonce le nombre de jours");
    }

    #[test]
    fn compte_en_jours_calendaires_pas_en_24h() {
        // Consulté hier à 23 h, on est ce matin à 8 h : 9 heures se sont
        // écoulées mais c'est bien 1 jour calendaire, comme côté front.
        let snap = snapshot(Some("2026-07-26 23:00:00"));
        let p = prefs(1, true);
        let ctx = ctx_at(at("2026-07-27 08:00:00"), &snap, &p, &[]);
        assert!(Inactivity.evaluate(&ctx).is_some());
    }

    #[test]
    fn inerte_si_le_savoir_n_a_jamais_ete_ouvert() {
        let snap = snapshot(None);
        let p = prefs(3, true);
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        assert!(Inactivity.evaluate(&ctx).is_none());
    }

    #[test]
    fn seuil_absurde_ramene_a_un_jour_minimum() {
        let snap = snapshot(Some("2026-07-27 08:00:00"));
        let p = prefs(0, true);
        // Même jour : 0 jour écoulé, le plancher de 1 empêche l'auto-déclenchement.
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        assert!(Inactivity.evaluate(&ctx).is_none());
    }

    #[test]
    fn sans_prefs_enregistrees_la_regle_ne_dit_rien() {
        let snap = snapshot(Some("2026-01-01 08:00:00"));
        let p = Prefs::default(); // aucune entrée `rules`
        let ctx = ctx_at(at("2026-07-27 20:00:00"), &snap, &p, &[]);
        assert!(Inactivity.evaluate(&ctx).is_none());
    }
}
