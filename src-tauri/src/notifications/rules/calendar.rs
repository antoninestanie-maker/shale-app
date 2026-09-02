//! Règle 4 — ce qui arrive bientôt dans le calendrier.
//!
//! Arrivée avec le module Calendrier (2026-09-02). Elle couvre deux choses que
//! l'app savait déjà mais ne disait jamais à temps :
//!   - un **événement imminent** — un rendez-vous dans l'heure qui vient ;
//!   - une **échéance proche** — un objectif ou une tâche datée pour demain.
//!
//! ⚠️ POURQUOI DEUX FENÊTRES ET PAS UNE. Un rendez-vous à 14 h se rappelle
//! quinze minutes avant : plus tôt, on l'oublie de nouveau. Une échéance
//! d'objectif, elle, ne se rattrape pas en quinze minutes — la prévenir la
//! veille est la seule version utile. Une fenêtre unique aurait raté l'un des
//! deux usages.
//!
//! ⚠️⚠️ CE QUE CETTE RÈGLE NE FAIT PAS SUR IPHONE, ET IL FAUT LE SAVOIR.
//! Elle n'a pas de paramètre `hour`, donc le planificateur la range parmi les
//! règles « sans heure » et ne la projette qu'à l'OUVERTURE de la plage
//! autorisée (`planner.rs`, `instants_a_sonder`). Sur le bureau c'est sans
//! conséquence : `scheduler.rs` scrute toutes les minutes, et un rendez-vous de
//! 14 h est bien annoncé à 13 h. **Sur iOS, app fermée, seule l'échéance
//! déposée à l'avance existe** : le rappel « dans une heure » n'y sera donc pas
//! ponctuel. Le rappel « ce qui tombe demain », lui, fonctionne, puisqu'il est
//! déjà lié à une heure fixe.
//! Le rendre ponctuel sur iOS demanderait de déposer une échéance PAR
//! événement, donc un chemin de dépôt nouveau — c'est du ressort du chantier
//! iOS, et ce n'est pas fait. Ne pas écrire que c'est vérifié sur iPhone.
//!
//! ⚠️ Les récurrences sont écartées à la lecture (`data.rs`) : projeter une
//! récurrence en SQL demanderait de réécrire ici le moteur qui vit déjà dans
//! `lib/logic.ts`, et une habitude n'a pas besoin d'un rappel « imminent » —
//! c'est le travail de la règle des habitudes.

use chrono::{Duration, NaiveTime, Timelike};

use super::NotificationRule;
use crate::notifications::model::{Candidate, EvalContext, RulePrefs};

pub struct CalendarSoon;

pub const ID: &str = "calendar_soon";

impl NotificationRule for CalendarSoon {
    fn id(&self) -> &'static str {
        ID
    }

    fn label(&self) -> &'static str {
        "Événement imminent"
    }

    fn default_prefs(&self) -> RulePrefs {
        // 60 minutes : assez tôt pour se déplacer, assez tard pour que le
        // rappel porte sur maintenant. `deadline_hour` est l'heure à laquelle
        // on annonce ce qui tombe demain — 18 h, quand la journée se referme et
        // qu'on peut encore réorganiser la suivante.
        RulePrefs::new(40, &[("avant_min", 60), ("deadline_hour", 18)])
    }

    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
        let prefs = ctx.rule_prefs(ID)?;
        let avant = prefs.param_i64("avant_min", 60).clamp(5, 24 * 60);
        let heure_deadline = prefs.param_hour("deadline_hour", 18);

        let aujourdhui = ctx.today().format("%Y-%m-%d").to_string();
        let demain = (ctx.today() + Duration::days(1)).format("%Y-%m-%d").to_string();
        let maintenant = ctx.now.time();
        let en = ctx.lang() == "en";

        // ── 1) Ce qui commence dans la fenêtre, aujourd'hui ─────────────────
        let mut imminents: Vec<&str> = Vec::new();
        let mut heure_premier: Option<String> = None;
        for item in &ctx.snapshot.calendar {
            if item.date != aujourdhui {
                continue;
            }
            let Some(debut) = item.start_at.as_deref().and_then(parse_heure) else {
                continue;
            };
            // Strictement à venir : un rendez-vous commencé n'est plus imminent,
            // il est en cours, et le rappeler ne sert qu'à culpabiliser.
            if debut <= maintenant {
                continue;
            }
            let dans = (debut - maintenant).num_minutes();
            if dans > avant {
                continue;
            }
            if heure_premier.is_none() {
                heure_premier = Some(format!("{:02}:{:02}", debut.hour(), debut.minute()));
            }
            imminents.push(&item.title);
        }

        if let Some(premier) = imminents.first() {
            let heure = heure_premier.unwrap_or_default();
            let (title, body) = if imminents.len() == 1 {
                (
                    if en { "Coming up".to_string() } else { "Ça arrive".to_string() },
                    if en {
                        format!("{premier}, at {heure}.")
                    } else {
                        format!("{premier}, à {heure}.")
                    },
                )
            } else {
                let reste = imminents.len() - 1;
                (
                    if en { "Coming up".to_string() } else { "Ça arrive".to_string() },
                    if en {
                        format!("{premier} at {heure}, and {reste} more within the hour.")
                    } else {
                        format!("{premier} à {heure}, et {reste} autre(s) dans l'heure.")
                    },
                )
            };
            return Some(Candidate {
                rule: ID,
                // La clé porte l'HEURE, pas seulement le jour : deux rendez-vous
                // le même jour doivent pouvoir être annoncés tous les deux.
                dedupe_key: format!("{ID}:{aujourdhui}:{heure}"),
                title,
                body: body.clone(),
                summary: body,
                target: Some("calendar"),
                priority: 70,
                supersedes: &[],
            });
        }

        // ── 2) Ce qui tombe demain, annoncé en fin de journée ───────────────
        if (ctx.now.hour() as u32) < heure_deadline {
            return None;
        }
        let demain_items: Vec<&str> = ctx
            .snapshot
            .calendar
            .iter()
            .filter(|i| i.date == demain)
            .map(|i| i.title.as_str())
            .collect();
        let echeances = ctx
            .snapshot
            .calendar
            .iter()
            .filter(|i| i.date == demain && i.kind == "deadline")
            .count();
        if demain_items.is_empty() {
            return None;
        }

        let premier = demain_items[0];
        let body = if echeances > 0 {
            if en {
                format!("Tomorrow: {premier}. An objective falls due.")
            } else {
                format!("Demain : {premier}. Une échéance d'objectif tombe.")
            }
        } else if demain_items.len() == 1 {
            if en {
                format!("Tomorrow: {premier}.")
            } else {
                format!("Demain : {premier}.")
            }
        } else {
            let reste = demain_items.len() - 1;
            if en {
                format!("Tomorrow: {premier}, and {reste} more.")
            } else {
                format!("Demain : {premier}, et {reste} autre(s).")
            }
        };

        Some(Candidate {
            rule: ID,
            dedupe_key: format!("{ID}:demain:{demain}"),
            title: if en { "Tomorrow".to_string() } else { "Demain".to_string() },
            body: body.clone(),
            summary: body,
            target: Some("calendar"),
            priority: 50,
            supersedes: &[],
        })
    }
}

/// `HH:MM` → heure. Rend `None` sur tout le reste, plutôt que de deviner : une
/// heure inventée déclencherait un rappel à un moment que personne n'a choisi.
fn parse_heure(brut: &str) -> Option<NaiveTime> {
    NaiveTime::parse_from_str(brut, "%H:%M").ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{CalendarItem, Prefs, QuietHours, Snapshot};
    use crate::notifications::rules::registry;
    use crate::notifications::test_support::at;

    fn prefs() -> Prefs {
        let mut p = Prefs { daily_cap: 5, ..Default::default() };
        p.quiet_hours = QuietHours { start: 0, end: 24 };
        for r in registry() {
            p.rules.insert(r.id().to_string(), r.default_prefs());
        }
        p
    }

    fn item(kind: &'static str, date: &str, start: Option<&str>, titre: &str) -> CalendarItem {
        CalendarItem {
            title: titre.to_string(),
            date: date.to_string(),
            start_at: start.map(|s| s.to_string()),
            kind,
        }
    }

    fn evalue(now: &str, calendar: Vec<CalendarItem>) -> Option<Candidate> {
        let snap = Snapshot { calendar, ..Default::default() };
        let p = prefs();
        let ctx = EvalContext { now: at(now), snapshot: &snap, prefs: &p, log: &[] };
        CalendarSoon.evaluate(&ctx)
    }

    #[test]
    fn annonce_un_rendez_vous_dans_l_heure() {
        let c = evalue(
            "2026-09-02 13:30:00",
            vec![item("event", "2026-09-02", Some("14:00"), "Dentiste")],
        );
        let c = c.expect("un rappel était attendu");
        assert!(c.body.contains("Dentiste"));
        assert!(c.body.contains("14:00"));
    }

    #[test]
    fn se_tait_quand_c_est_encore_loin() {
        assert!(evalue(
            "2026-09-02 09:00:00",
            vec![item("event", "2026-09-02", Some("18:00"), "Dentiste")]
        )
        .is_none());
    }

    #[test]
    fn un_rendez_vous_deja_commence_n_est_plus_imminent() {
        // Le rappeler ne servirait qu'à culpabiliser.
        assert!(evalue(
            "2026-09-02 14:05:00",
            vec![item("event", "2026-09-02", Some("14:00"), "Dentiste")]
        )
        .is_none());
    }

    #[test]
    fn ignore_ce_qui_n_a_pas_d_heure() {
        assert!(evalue(
            "2026-09-02 13:30:00",
            vec![item("event", "2026-09-02", None, "Anniversaire")]
        )
        .is_none());
    }

    #[test]
    fn deux_rendez_vous_dans_l_heure_tiennent_dans_un_seul_rappel() {
        let c = evalue(
            "2026-09-02 13:30:00",
            vec![
                item("event", "2026-09-02", Some("14:00"), "Dentiste"),
                item("event", "2026-09-02", Some("14:30"), "Appel"),
            ],
        )
        .expect("un rappel était attendu");
        assert!(c.body.contains("Dentiste"));
        assert!(c.body.contains('1')); // « et 1 autre(s) »
    }

    #[test]
    fn annonce_l_echeance_de_demain_en_fin_de_journee() {
        let c = evalue(
            "2026-09-02 19:00:00",
            vec![item("deadline", "2026-09-03", None, "Rendre le dossier")],
        )
        .expect("un rappel était attendu");
        assert!(c.body.contains("Rendre le dossier"));
        assert!(c.body.contains("échéance"));
    }

    #[test]
    fn ne_parle_pas_de_demain_avant_l_heure_dite() {
        // À 14 h, la journée n'est pas finie : annoncer demain la ferait passer
        // pour terminée.
        assert!(evalue(
            "2026-09-02 14:00:00",
            vec![item("deadline", "2026-09-03", None, "Rendre le dossier")]
        )
        .is_none());
    }

    #[test]
    fn l_imminent_passe_avant_demain() {
        let c = evalue(
            "2026-09-02 19:30:00",
            vec![
                item("event", "2026-09-02", Some("20:00"), "Dîner"),
                item("deadline", "2026-09-03", None, "Rendre le dossier"),
            ],
        )
        .expect("un rappel était attendu");
        assert!(c.body.contains("Dîner"));
    }

    #[test]
    fn reste_inerte_sur_une_base_sans_calendrier() {
        // Migration 020 absente : `data.rs` rend une liste vide, la règle se tait
        // au lieu de faire tomber toutes les notifications de l'app.
        assert!(evalue("2026-09-02 13:30:00", vec![]).is_none());
    }
}
