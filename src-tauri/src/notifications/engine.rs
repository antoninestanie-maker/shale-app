//! Moteur : transforme les propositions des règles en (au plus) UNE notification.
//!
//! Toutes les contraintes transverses sont ici, pas dans les règles — fenêtre
//! horaire, plafond quotidien, cooldown par règle, idempotence, regroupement.
//! Une règle n'a donc qu'un seul travail : dire si son constat est vrai.
//!
//! Fonction pure : mêmes entrées, même sortie. Aucun accès disque, aucune
//! horloge système (le `now` vient de `EvalContext`).

use chrono::{Duration, Timelike};

use super::model::{Candidate, EvalContext, LogEntry};
use super::rules::NotificationRule;

/// Ce que le moteur a décidé. Les variantes « négatives » sont distinctes pour
/// que le planificateur et l'écran de diagnostic puissent dire POURQUOI rien
/// n'est parti — un « rien » opaque serait indébogable.
#[derive(Debug, Clone, PartialEq)]
pub enum Outcome {
    /// Notifications coupées globalement.
    Disabled,
    /// Hors de la plage horaire autorisée.
    OutsideWindow,
    /// Plafond quotidien déjà atteint.
    CapReached,
    /// Aucune règle n'avait quelque chose à dire (ou tout a été filtré).
    Nothing,
    Emit(LogEntry),
}

/// Évalue toutes les règles et décide de l'unique notification à émettre.
pub fn evaluate(ctx: &EvalContext, rules: &[&dyn NotificationRule]) -> Outcome {
    if !ctx.prefs.enabled {
        return Outcome::Disabled;
    }
    if !ctx.prefs.quiet_hours.allows(ctx.now.hour()) {
        return Outcome::OutsideWindow;
    }
    if ctx.sent_today() >= ctx.prefs.daily_cap {
        return Outcome::CapReached;
    }

    let mut candidates: Vec<Candidate> = rules
        .iter()
        .filter(|r| ctx.rule_prefs(r.id()).is_some_and(|p| p.enabled))
        .filter_map(|r| r.evaluate(ctx))
        .filter(|c| !ctx.already_sent(&c.dedupe_key))
        .filter(|c| !in_cooldown(ctx, c))
        .collect();

    // Priorité décroissante : le premier candidat donne le titre et la cible.
    // Tri stable, donc l'ordre du registre départage les égalités.
    candidates.sort_by(|a, b| b.priority.cmp(&a.priority));

    // Une règle prioritaire peut écarter des règles qui rediraient la même chose
    // autrement. On applique après filtrage : une règle écartée pour cooldown ou
    // doublon ne fait taire personne.
    let muted: Vec<&'static str> = candidates
        .iter()
        .flat_map(|c| c.supersedes.iter().copied())
        .collect();
    candidates.retain(|c| !muted.contains(&c.rule));

    match candidates.len() {
        0 => Outcome::Nothing,
        _ => Outcome::Emit(merge(ctx, &candidates)),
    }
}

/// Vrai si la règle a déjà notifié il y a moins de `cooldown_h`.
fn in_cooldown(ctx: &EvalContext, c: &Candidate) -> bool {
    let Some(prefs) = ctx.rule_prefs(c.rule) else {
        return false;
    };
    if prefs.cooldown_h <= 0 {
        return false;
    }
    match ctx.last_fired(c.rule) {
        Some(last) => ctx.now - last < Duration::hours(prefs.cooldown_h),
        None => false,
    }
}

/// Un candidat → tel quel. Plusieurs → une seule notification de synthèse qui
/// porte les clés d'idempotence de TOUTES les règles absorbées.
fn merge(ctx: &EvalContext, candidates: &[Candidate]) -> LogEntry {
    let head = &candidates[0];
    let (title, body) = if candidates.len() == 1 {
        (head.title.clone(), head.body.clone())
    } else {
        (
            // ⚠️ La synthèse groupée était le SEUL texte du moteur à ne pas
            // suivre la langue : les trois règles la respectent depuis
            // toujours, elle non. `ctx` la porte déjà, il suffisait de la lire.
            if ctx.lang() == "en" {
                format!("{} reminders today", candidates.len())
            } else {
                format!("{} rappels du jour", candidates.len())
            },
            candidates
                .iter()
                .map(|c| c.summary.as_str())
                .collect::<Vec<_>>()
                .join("\n"),
        )
    };

    LogEntry {
        id: format!("n_{}", ctx.now.timestamp_millis()),
        rules: candidates.iter().map(|c| c.rule.to_string()).collect(),
        dedupe_keys: candidates.iter().map(|c| c.dedupe_key.clone()).collect(),
        title,
        body,
        target: head.target.map(str::to_string),
        created_at: ctx.now,
        read: false,
        handed_to_system: false, // renseigné par l'émetteur
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{LogEntry, Prefs, RulePrefs, Snapshot};
    use crate::notifications::test_support::{at, ctx_at, entry};

    /// Règle de test qui propose toujours quelque chose : le moteur est ainsi
    /// éprouvé indépendamment des règles réelles.
    struct Always {
        id: &'static str,
        priority: u8,
        supersedes: &'static [&'static str],
    }

    impl NotificationRule for Always {
        fn id(&self) -> &'static str {
            self.id
        }
        fn label(&self) -> &'static str {
            "test"
        }
        fn default_prefs(&self) -> RulePrefs {
            RulePrefs::new(24, &[])
        }
        fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate> {
            Some(Candidate {
                rule: self.id,
                dedupe_key: format!("{}:{}", self.id, ctx.today()),
                title: format!("titre {}", self.id),
                body: format!("corps {}", self.id),
                summary: format!("résumé {}", self.id),
                target: Some("today"),
                priority: self.priority,
                supersedes: self.supersedes,
            })
        }
    }

    static A: Always = Always { id: "a", priority: 10, supersedes: &[] };
    static B: Always = Always { id: "b", priority: 20, supersedes: &[] };
    static C: Always = Always { id: "c", priority: 30, supersedes: &["a"] };

    fn prefs_with(ids: &[&str]) -> Prefs {
        let mut p = Prefs::default();
        for id in ids {
            p.rules.insert((*id).to_string(), RulePrefs::new(24, &[]));
        }
        p
    }

    fn run(now: &str, p: &Prefs, log: &[LogEntry], rules: &[&dyn NotificationRule]) -> Outcome {
        let snap = Snapshot::default();
        let ctx = ctx_at(at(now), &snap, p, log);
        evaluate(&ctx, rules)
    }

    #[test]
    fn rien_quand_tout_est_coupe() {
        let mut p = prefs_with(&["a"]);
        p.enabled = false;
        assert_eq!(run("2026-07-27 20:00:00", &p, &[], &[&A]), Outcome::Disabled);
    }

    #[test]
    fn rien_avant_8h_ni_apres_22h() {
        let p = prefs_with(&["a"]);
        assert_eq!(run("2026-07-27 07:59:00", &p, &[], &[&A]), Outcome::OutsideWindow);
        assert_eq!(run("2026-07-27 22:00:00", &p, &[], &[&A]), Outcome::OutsideWindow);
        assert_eq!(run("2026-07-27 03:00:00", &p, &[], &[&A]), Outcome::OutsideWindow);
        // Les bornes utiles restent ouvertes.
        assert!(matches!(run("2026-07-27 08:00:00", &p, &[], &[&A]), Outcome::Emit(_)));
        assert!(matches!(run("2026-07-27 21:59:00", &p, &[], &[&A]), Outcome::Emit(_)));
    }

    #[test]
    fn fenetre_a_cheval_sur_minuit() {
        let mut p = prefs_with(&["a"]);
        p.quiet_hours.start = 22;
        p.quiet_hours.end = 6;
        assert!(matches!(run("2026-07-27 23:00:00", &p, &[], &[&A]), Outcome::Emit(_)));
        assert!(matches!(run("2026-07-27 02:00:00", &p, &[], &[&A]), Outcome::Emit(_)));
        assert_eq!(run("2026-07-27 12:00:00", &p, &[], &[&A]), Outcome::OutsideWindow);
    }

    #[test]
    fn plafond_quotidien_respecte() {
        let p = prefs_with(&["a"]); // daily_cap = 2 par défaut
        let log = vec![
            entry("2026-07-27 09:00:00", &["x"], &["x:1"]),
            entry("2026-07-27 12:00:00", &["y"], &["y:1"]),
        ];
        assert_eq!(run("2026-07-27 20:00:00", &p, &log, &[&A]), Outcome::CapReached);

        // Les notifications d'hier ne comptent pas dans le plafond du jour.
        let vieux = vec![
            entry("2026-07-26 09:00:00", &["x"], &["x:0"]),
            entry("2026-07-26 12:00:00", &["y"], &["y:0"]),
        ];
        assert!(matches!(run("2026-07-27 20:00:00", &p, &vieux, &[&A]), Outcome::Emit(_)));
    }

    /// Le bouton « Envoyer un test » ne doit pas consommer le quota du jour :
    /// deux vérifications d'affilée rendraient sinon les vrais rappels muets.
    #[test]
    fn les_tests_manuels_ne_comptent_pas_dans_le_plafond() {
        let p = prefs_with(&["a"]); // plafond 2
        let log = vec![
            entry("2026-07-27 09:00:00", &["test"], &["test:1"]),
            entry("2026-07-27 09:01:00", &["test"], &["test:2"]),
            entry("2026-07-27 10:00:00", &["test"], &["test:3"]),
        ];
        assert!(matches!(
            run("2026-07-27 20:00:00", &p, &log, &[&A]),
            Outcome::Emit(_)
        ));

        // Une seule vraie notification laisse encore de la place ; deux, non.
        let mixte = vec![
            entry("2026-07-27 09:00:00", &["test"], &["test:1"]),
            entry("2026-07-27 11:00:00", &["x"], &["x:1"]),
            entry("2026-07-27 12:00:00", &["y"], &["y:1"]),
        ];
        assert_eq!(run("2026-07-27 20:00:00", &p, &mixte, &[&A]), Outcome::CapReached);
    }

    #[test]
    fn pas_deux_fois_le_meme_evenement() {
        let p = prefs_with(&["a"]);
        let log = vec![entry("2026-07-27 09:00:00", &["a"], &["a:2026-07-27"])];
        assert_eq!(run("2026-07-27 20:00:00", &p, &log, &[&A]), Outcome::Nothing);
    }

    #[test]
    fn cooldown_par_regle() {
        let p = prefs_with(&["a"]); // cooldown 24 h
        // Même règle il y a 3 h, sur un ÉVÉNEMENT différent (clé d'hier) :
        // seul le cooldown peut encore l'arrêter.
        let log = vec![entry("2026-07-27 17:00:00", &["a"], &["a:2026-07-26"])];
        assert_eq!(run("2026-07-27 20:00:00", &p, &log, &[&A]), Outcome::Nothing);

        // Passé le cooldown, la règle reparle.
        let vieux = vec![entry("2026-07-26 10:00:00", &["a"], &["a:2026-07-26"])];
        assert!(matches!(run("2026-07-27 20:00:00", &p, &vieux, &[&A]), Outcome::Emit(_)));
    }

    #[test]
    fn une_regle_desactivee_est_ignoree() {
        let mut p = prefs_with(&["a"]);
        p.rules.get_mut("a").unwrap().enabled = false;
        assert_eq!(run("2026-07-27 20:00:00", &p, &[], &[&A]), Outcome::Nothing);
    }

    #[test]
    fn deux_regles_donnent_une_seule_notif_de_synthese() {
        let p = prefs_with(&["a", "b"]);
        let Outcome::Emit(e) = run("2026-07-27 20:00:00", &p, &[], &[&A, &B]) else {
            panic!("émission attendue");
        };
        assert_eq!(e.title, "2 rappels du jour");
        assert_eq!(e.body, "résumé b\nrésumé a", "la plus prioritaire en tête");
        assert_eq!(e.rules, vec!["b", "a"]);
        // L'idempotence couvre CHACUNE des règles regroupées.
        assert_eq!(e.dedupe_keys, vec!["b:2026-07-27", "a:2026-07-27"]);
    }

    /// La synthèse groupée suit la langue des préférences. Elle était le SEUL
    /// texte du moteur à rester français quoi qu'il arrive — et aucun test ne
    /// s'en apercevait, parce qu'ils tournent tous sur le défaut français.
    #[test]
    fn la_synthese_groupee_suit_la_langue() {
        let mut p = prefs_with(&["a", "b"]);
        p.lang = "en".into();
        let Outcome::Emit(e) = run("2026-07-27 20:00:00", &p, &[], &[&A, &B]) else {
            panic!("émission attendue");
        };
        assert_eq!(e.title, "2 reminders today");
    }

    #[test]
    fn le_regroupement_compte_pour_une_seule_notif_du_plafond() {
        let p = prefs_with(&["a", "b"]);
        let log = vec![entry("2026-07-27 09:00:00", &["x"], &["x:1"])];
        // 1 déjà envoyée + ce lot = 2 = le plafond, donc le lot passe.
        assert!(matches!(
            run("2026-07-27 20:00:00", &p, &log, &[&A, &B]),
            Outcome::Emit(_)
        ));
    }

    #[test]
    fn une_regle_prioritaire_en_fait_taire_une_autre() {
        let p = prefs_with(&["a", "b", "c"]);
        let Outcome::Emit(e) = run("2026-07-27 20:00:00", &p, &[], &[&A, &B, &C]) else {
            panic!("émission attendue");
        };
        assert_eq!(e.rules, vec!["c", "b"], "« a » est écartée par « c »");
    }

    #[test]
    fn une_regle_ecartee_ne_fait_taire_personne() {
        // « c » écarterait « a », mais « c » est en cooldown : « a » doit survivre.
        let p = prefs_with(&["a", "c"]);
        let log = vec![entry("2026-07-27 18:00:00", &["c"], &["c:2026-07-26"])];
        let Outcome::Emit(e) = run("2026-07-27 20:00:00", &p, &log, &[&A, &C]) else {
            panic!("émission attendue");
        };
        assert_eq!(e.rules, vec!["a"]);
    }

    /// Les tests ci-dessus éprouvent le moteur avec des règles factices. Celui-ci
    /// le fait avec le REGISTRE RÉEL, seul moyen de vérifier que les deux règles
    /// livrées se regroupent bien pour de vrai.
    mod avec_les_vraies_regles {
        use super::*;
        use crate::notifications::model::{Habit, Snapshot};
        use crate::notifications::rules::{habits, inactivity, registry, streak};
        use crate::notifications::test_support::naive;

        /// Préférences telles que le store les hydrate au premier lancement.
        fn defauts() -> Prefs {
            let mut p = Prefs::default();
            for r in registry() {
                p.rules.insert(r.id().to_string(), r.default_prefs());
            }
            p
        }

        /// Savoir délaissé depuis 5 jours ET deux habitudes non cochées.
        fn tout_va_mal() -> Snapshot {
            Snapshot {
                habits: vec![
                    Habit { id: 1, name: "Sport".into() },
                    Habit { id: 2, name: "Lecture".into() },
                ],
                habit_checks: vec![],
                knowledge_last_viewed: Some(naive("2026-07-22 10:00:00")),
                ..Default::default()
            }
        }

        #[test]
        fn deux_vraies_regles_donnent_une_seule_notification() {
            let p = defauts();
            let snap = tout_va_mal();
            let ctx = ctx_at(at("2026-07-27 20:05:00"), &snap, &p, &[]);
            let Outcome::Emit(e) = evaluate(&ctx, registry()) else {
                panic!("émission attendue");
            };
            assert_eq!(e.title, "2 rappels du jour");
            assert_eq!(e.rules, vec![habits::ID, inactivity::ID], "habitudes prioritaires");
            assert_eq!(e.target.as_deref(), Some("journal"));
            assert!(e.body.contains("2 habitudes non cochées"));
            assert!(e.body.contains("5 jours sans passage"));
        }

        #[test]
        fn le_lot_regroupe_rend_chaque_regle_idempotente() {
            let p = defauts();
            let snap = tout_va_mal();
            let ctx = ctx_at(at("2026-07-27 20:05:00"), &snap, &p, &[]);
            let Outcome::Emit(e) = evaluate(&ctx, registry()) else {
                panic!("émission attendue");
            };

            // Le même jour, plus tard : le journal contient le lot précédent.
            let log = vec![e];
            let plus_tard = ctx_at(at("2026-07-27 21:30:00"), &snap, &p, &log);
            assert_eq!(
                evaluate(&plus_tard, registry()),
                Outcome::Nothing,
                "aucune des deux règles ne repasse"
            );
        }

        #[test]
        fn le_matin_seule_la_regle_d_inactivite_parle() {
            let p = defauts();
            let snap = tout_va_mal();
            // 9 h : avant l'heure du rappel d'habitudes (20 h).
            let ctx = ctx_at(at("2026-07-27 09:00:00"), &snap, &p, &[]);
            let Outcome::Emit(e) = evaluate(&ctx, registry()) else {
                panic!("émission attendue");
            };
            assert_eq!(e.rules, vec![inactivity::ID]);
            assert_eq!(e.title, "Ton savoir t'attend", "texte propre, pas de synthèse");
            assert_eq!(e.target.as_deref(), Some("knowledge"));
        }

        /// Le cas concret que la mise en sourdine existe pour éviter : à 21 h,
        /// « série en danger » dit déjà qu'il reste des habitudes à cocher.
        /// Répéter le rappel d'habitudes serait le même constat en plus faible.
        #[test]
        fn la_serie_en_danger_fait_taire_le_rappel_d_habitudes() {
            let p = defauts();
            let snap = Snapshot {
                habits: vec![Habit { id: 1, name: "Sport".into() }],
                habit_checks: (24..=26)
                    .map(|d| crate::notifications::model::HabitCheck {
                        habit_id: 1,
                        date: format!("2026-07-{d}"),
                    })
                    .collect(),
                knowledge_last_viewed: Some(naive("2026-07-27 08:00:00")),
                ..Default::default()
            };
            let ctx = ctx_at(at("2026-07-27 21:10:00"), &snap, &p, &[]);
            let Outcome::Emit(e) = evaluate(&ctx, registry()) else {
                panic!("émission attendue");
            };
            assert_eq!(e.rules, vec![streak::ID], "une seule voix, la plus urgente");
            assert!(!e.title.contains("rappels"), "pas de synthèse : {}", e.title);
        }

        /// Mais si la série est trop courte pour alerter, le rappel d'habitudes
        /// reprend la parole : la mise en sourdine ne doit rien avaler à vide.
        #[test]
        fn sans_serie_a_defendre_le_rappel_d_habitudes_parle() {
            let p = defauts();
            let snap = Snapshot {
                habits: vec![Habit { id: 1, name: "Sport".into() }],
                habit_checks: vec![],
                knowledge_last_viewed: Some(naive("2026-07-27 08:00:00")),
                ..Default::default()
            };
            let ctx = ctx_at(at("2026-07-27 21:10:00"), &snap, &p, &[]);
            let Outcome::Emit(e) = evaluate(&ctx, registry()) else {
                panic!("émission attendue");
            };
            assert_eq!(e.rules, vec![habits::ID]);
        }

        #[test]
        fn journee_sereine_ne_produit_rien() {
            let p = defauts();
            let snap = Snapshot {
                habits: vec![Habit { id: 1, name: "Sport".into() }],
                habit_checks: vec![crate::notifications::model::HabitCheck {
                    habit_id: 1,
                    date: "2026-07-27".into(),
                }],
                knowledge_last_viewed: Some(naive("2026-07-27 08:00:00")),
                ..Default::default()
            };
            let ctx = ctx_at(at("2026-07-27 21:00:00"), &snap, &p, &[]);
            assert_eq!(evaluate(&ctx, registry()), Outcome::Nothing);
        }
    }

    #[test]
    fn une_seule_regle_garde_son_propre_texte() {
        let p = prefs_with(&["a"]);
        let Outcome::Emit(e) = run("2026-07-27 20:00:00", &p, &[], &[&A]) else {
            panic!("émission attendue");
        };
        assert_eq!(e.title, "titre a");
        assert_eq!(e.body, "corps a");
        assert_eq!(e.target.as_deref(), Some("today"));
        assert!(!e.read);
    }
}
