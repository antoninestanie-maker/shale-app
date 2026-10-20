//! Série de tâches — **portage Rust de `src/lib/logic.ts`**.
//!
//! ⚠️ **Depuis le 2026-10-20, AUCUNE règle ne lit ce fichier.** La notification
//! « série en danger » suit la série d'habitudes (`discipline_habitudes.rs`),
//! celle que l'écran affiche. Le portage est gardé, avec ses tests, pour le jour
//! où une règle parlerait de nouveau des tâches ; tant qu'aucune ne le lit, il
//! n'est plus nécessaire de le tenir d'accord avec `logic.ts` — mais il faudra
//! le remettre à jour AVANT de le rebrancher.
//!
//! ⚠️ Code dupliqué, en connaissance de cause. La série affichée dans le bandeau
//! de performance est calculée en TypeScript ; pour qu'une notification puisse
//! dire « ta série est en danger » sans fenêtre ouverte, le Rust doit refaire le
//! même calcul. Deux implémentations d'une même règle métier finissent par
//! diverger : la **source de vérité reste `logic.ts`**, et toute évolution de
//! `isDueOn`, `estPrevueLe`, `dayStat`, `todayTasks` ou `computeStreak` doit être
//! répercutée ici. Les cas de `src/lib/logic.jour.test.ts` sont rejoués en bas.
//!
//! Correspondances :
//!   `isDueOn`      → [`is_due_on`]
//!   `estPrevueLe`  → [`est_prevue_le`] (la définition de « la tâche du jour »)
//!   `dayStat().pct`→ [`day_pct`]
//!   `pctOfList(todayTasks())` → [`today_pct`]
//!   `computeStreak`→ [`streak_before`] (à une différence près, documentée)

use chrono::{Datelike, NaiveDate};

use super::model::{Completion, Task};

/// Seuil de complétion d'une journée « réussie » (`STREAK_THRESHOLD` en TS).
pub const STREAK_THRESHOLD: i64 = 80;

fn day_str(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

fn is_recurring(task: &Task) -> bool {
    !matches!(task.recurrence.as_deref(), None | Some("") | Some("none"))
}

/// En attente ou abandonnée À PARTIR d'un jour qui n'est pas après `date` ?
/// Port de `estSuspendue` (`lib/taches.ts`, migration 031) : une tâche suspendue
/// n'est plus prévue, et une routine est en pause — sans toucher aux jours d'avant
/// `state_since`. Sans date, la suspension vaut depuis toujours.
pub fn est_suspendue(task: &Task, date: NaiveDate) -> bool {
    let day = day_str(date);
    if matches!(task.state.as_deref(), Some("waiting") | Some("dropped")) {
        let en_cours = match &task.state_since {
            Some(depuis) if depuis.len() >= 10 => &depuis[..10] <= day.as_str(),
            _ => true,
        };
        if en_cours {
            return true;
        }
    }
    // Les suspensions TERMINÉES (migration 032) : une routine reprise garde ses
    // jours de pause neutres. Port de la fin d'`estSuspendue` — sans elles,
    // « À faire » rendait chaque jour de pause dû et manqué (audit 2026-10-20).
    lire_pauses(task.pauses.as_deref())
        .iter()
        .any(|(du, au)| du.as_deref().is_none_or(|du| du <= day.as_str()) && day.as_str() < au.as_str())
}

/// Port de `lirePauses` : un JSON illisible vaut « aucune pause ».
fn lire_pauses(brut: Option<&str>) -> Vec<(Option<String>, String)> {
    brut.and_then(|b| serde_json::from_str::<Vec<(Option<String>, String)>>(b).ok()).unwrap_or_default()
}

/// Une coche qui dit la ponctuelle faite : pas d'avant le jour où la routine
/// est devenue ponctuelle (migration 032). Port de `ponctuellesFaites`.
fn coche_compte(task: &Task, c: &Completion) -> bool {
    c.done
        && match task.ponctuelle_depuis.as_deref() {
            Some(depuis) if depuis.len() >= 10 => c.date.as_str() >= &depuis[..10],
            _ => true,
        }
}

/// Une tâche récurrente est-elle due ce jour-là ?
/// Port de `isDueOn` — même convention de jour que `Date.getDay()` : 0 = dimanche.
pub fn is_due_on(task: &Task, date: NaiveDate) -> bool {
    if est_suspendue(task, date) {
        return false;
    }
    let day = day_str(date);
    if let Some(created) = &task.created_at {
        if created.len() >= 10 && &created[..10] > day.as_str() {
            return false;
        }
    }
    if !is_recurring(task) {
        return false;
    }
    let rec = task.recurrence.as_deref().unwrap_or("none");
    if rec == "daily" {
        return true;
    }
    let wd = date.weekday().num_days_from_sunday() as i64;
    if rec == "weekdays" {
        return (1..=5).contains(&wd);
    }
    // JSON de jours ; une valeur illisible = non due (même repli qu'en TS).
    serde_json::from_str::<Vec<i64>>(rec)
        .map(|days| days.contains(&wd))
        .unwrap_or(false)
}

/// Une tâche est-elle PRÉVUE ce jour-là ? Port de `estPrevueLe` — LA définition
/// de « la tâche du jour » (2026-10-11) : une routine due ce jour-là, ou une
/// ponctuelle DATÉE de ce jour-là. Ni les « sans date », ni les « à venir », ni
/// les « en retard ».
pub fn est_prevue_le(task: &Task, date: NaiveDate) -> bool {
    if is_recurring(task) {
        return is_due_on(task, date);
    }
    if est_suspendue(task, date) {
        return false;
    }
    task.due_date.as_deref() == Some(day_str(date).as_str())
}

/// Une ponctuelle datée d'AVANT `date`, cochée ce jour-là : un rattrapage, pas
/// une tâche du jour. Port de `estRattrapage` (2026-10-20) — elle ne compte ni
/// dans la liste du jour ni dans le compte d'un jour.
pub fn est_rattrapage(task: &Task, date: NaiveDate) -> bool {
    !is_recurring(task)
        && task
            .due_date
            .as_deref()
            .is_some_and(|d| !d.is_empty() && d < day_str(date).as_str())
}

/// Pourcentage de complétion d'un jour PASSÉ. `None` = aucune tâche due,
/// journée neutre qui ne casse pas la série. Port de `dayStat().pct`.
///
/// Un jour passé compte les routines dues ce jour-là et les ponctuelles
/// COCHÉES ce jour-là. ⚠️ Une ponctuelle cochée puis décochée (ligne
/// `done = 0`) ne compte plus comme un manqué depuis le 2026-10-11 : elle
/// n'était ni prévue, ni faite. Un pourcentage passé ne peut que monter.
pub fn day_pct(tasks: &[Task], completions: &[Completion], date: NaiveDate) -> Option<i64> {
    let day = day_str(date);
    let comps: Vec<&Completion> = completions.iter().filter(|c| c.date == day).collect();

    let mut due: Vec<i64> = tasks
        .iter()
        .filter(|t| is_due_on(t, date))
        .map(|t| t.id)
        .collect();
    for c in comps.iter().filter(|c| c.done) {
        if let Some(t) = tasks.iter().find(|t| t.id == c.task_id) {
            if !is_recurring(t) && !est_rattrapage(t, date) && !due.contains(&t.id) {
                due.push(t.id);
            }
        }
    }
    if due.is_empty() {
        return None;
    }
    let done = due
        .iter()
        .filter(|id| comps.iter().any(|c| c.task_id == **id && c.done))
        .count() as i64;
    Some(((done as f64 / due.len() as f64) * 100.0).round() as i64)
}

/// Pourcentage du JOUR EN COURS, calculé sur la liste du jour
/// (`pctOfList(todayTasks(...))`) : c'est ce que voient `TodayView` et
/// `PerformanceView`, donc ce que l'utilisateur appelle « sa journée ».
/// `None` = rien de prévu aujourd'hui.
///
/// La liste du jour, comme `todayTasks` :
///   • une routine due aujourd'hui ;
///   • une ponctuelle datée d'aujourd'hui, tant qu'elle n'a pas été faite un
///     AUTRE jour (faite en avance, elle a compté ce jour-là) ;
///   • une ponctuelle COCHÉE aujourd'hui, sauf un rattrapage (datée d'avant
///     aujourd'hui — `est_rattrapage`, depuis le 2026-10-20).
///
/// ⚠️ Avant le 2026-10-11, toute ponctuelle non faite y entrait, datée ou non :
/// noter une tâche pour jeudi faisait baisser le pourcentage du jour, et la
/// notification « série en danger » sonnait pour des tâches qui n'étaient pas
/// prévues aujourd'hui.
pub fn today_pct(tasks: &[Task], completions: &[Completion], today: NaiveDate) -> Option<i64> {
    let day = day_str(today);
    let cochee_aujourdhui =
        |t: &Task| completions.iter().any(|c| c.task_id == t.id && c.date == day && c.done);
    let faite_un_jour = |t: &Task| completions.iter().any(|c| c.task_id == t.id && coche_compte(t, c));

    let list: Vec<&Task> = tasks
        .iter()
        .filter(|t| {
            if is_recurring(t) {
                return is_due_on(t, today);
            }
            if cochee_aujourdhui(t) {
                return !est_rattrapage(t, today);
            }
            est_prevue_le(t, today) && !faite_un_jour(t)
        })
        .collect();

    if list.is_empty() {
        return None;
    }
    let done = list.iter().filter(|t| cochee_aujourdhui(t)).count() as i64;
    Some(((done as f64 / list.len() as f64) * 100.0).round() as i64)
}

/// Série en cours **strictement avant** `today`.
///
/// Différence assumée avec `computeStreak` : celui-ci ajoute le jour même s'il
/// est déjà à ≥ 80 %. Ici on veut la série QUE LA JOURNÉE PEUT ROMPRE, donc on
/// s'arrête à hier. Les jours sans tâche due restent neutres, comme en TS.
pub fn streak_before(tasks: &[Task], completions: &[Completion], today: NaiveDate) -> i64 {
    let mut streak = 0;
    let mut d = today.pred_opt();
    for _ in 0..365 {
        let Some(day) = d else { break };
        if let Some(pct) = day_pct(tasks, completions, day) {
            if pct >= STREAK_THRESHOLD {
                streak += 1;
            } else {
                break;
            }
        }
        d = day.pred_opt();
    }
    streak
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn task(id: i64, recurrence: &str) -> Task {
        Task { id, recurrence: Some(recurrence.into()), created_at: None, due_date: None, state: None, state_since: None, pauses: None, ponctuelle_depuis: None }
    }

    /// Une ponctuelle datée (`None` = sans date).
    fn datee(id: i64, due: Option<&str>) -> Task {
        Task {
            id,
            recurrence: Some("none".into()),
            created_at: None,
            due_date: due.map(Into::into),
            state: None,
            state_since: None,
            pauses: None,
            ponctuelle_depuis: None,
        }
    }

    fn done(task_id: i64, date: &str) -> Completion {
        Completion { task_id, date: date.into(), done: true }
    }

    fn undone(task_id: i64, date: &str) -> Completion {
        Completion { task_id, date: date.into(), done: false }
    }

    // — Portage de `isDueOn` —

    #[test]
    fn une_tache_non_recurrente_n_est_jamais_due() {
        assert!(!is_due_on(&task(1, "none"), d("2026-07-27")));
        assert!(!is_due_on(
            &Task { id: 1, recurrence: None, created_at: None, due_date: None, state: None, state_since: None, pauses: None, ponctuelle_depuis: None },
            d("2026-07-27")
        ));
    }

    #[test]
    fn quotidienne_hebdo_et_jours_choisis() {
        let lundi = d("2026-07-27");
        let samedi = d("2026-08-01");
        assert!(is_due_on(&task(1, "daily"), samedi));
        assert!(is_due_on(&task(1, "weekdays"), lundi));
        assert!(!is_due_on(&task(1, "weekdays"), samedi), "samedi hors semaine");
        // 1 = lundi, convention `Date.getDay()`.
        assert!(is_due_on(&task(1, "[1,3,5]"), lundi));
        assert!(!is_due_on(&task(1, "[2,4]"), lundi));
    }

    #[test]
    fn recurrence_illisible_vaut_non_due() {
        assert!(!is_due_on(&task(1, "{pas du json}"), d("2026-07-27")));
    }

    #[test]
    fn une_tache_creee_apres_la_date_n_est_pas_due() {
        let t = Task {
            id: 1,
            recurrence: Some("daily".into()),
            created_at: Some("2026-07-28 09:00:00".into()),
            due_date: None,
            state: None,
            state_since: None,
            pauses: None,
            ponctuelle_depuis: None,
        };
        assert!(!is_due_on(&t, d("2026-07-27")));
        assert!(is_due_on(&t, d("2026-07-28")));
    }

    // — Portage de `dayStat` —

    #[test]
    fn un_jour_sans_tache_due_est_neutre() {
        assert_eq!(day_pct(&[task(1, "none")], &[], d("2026-07-27")), None);
    }

    #[test]
    fn pourcentage_arrondi_comme_en_ts() {
        let tasks = vec![task(1, "daily"), task(2, "daily"), task(3, "daily")];
        let comps = vec![done(1, "2026-07-27"), done(2, "2026-07-27")];
        // 2/3 = 66,67 → 67
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), Some(67));
    }

    #[test]
    fn une_ponctuelle_compte_le_jour_ou_elle_est_cochee() {
        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(2, "2026-07-27")];
        // Routine manquée, ponctuelle faite : 1 sur 2.
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), Some(50));
    }

    /// Port de « une ponctuelle cochée PUIS décochée ne compte plus comme un
    /// manqué » : avant le 2026-10-11, sa ligne `done = 0` valait 0 %.
    #[test]
    fn une_ponctuelle_decochee_ne_compte_plus_comme_un_manque() {
        let tasks = vec![task(1, "none")];
        let comps = vec![undone(1, "2026-07-27")];
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), None, "ni prévue, ni faite : neutre");

        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(1, "2026-07-27"), undone(2, "2026-07-27")];
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), Some(100));
    }

    /// Port de `estRattrapage` (2026-10-20) : une tâche en retard cochée ne
    /// compte ni pour le jour où on la coche, ni dans la liste du jour.
    #[test]
    fn un_rattrapage_ne_compte_pas_pour_le_jour() {
        let tasks = vec![datee(1, Some("2026-07-26"))];
        let comps = vec![done(1, "2026-07-27")];
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), None);
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), None);
    }

    /// Une tâche sans date ou à venir, jamais cochée, n'a jamais pesé sur un
    /// jour passé — avant comme après la règle.
    #[test]
    fn une_ponctuelle_jamais_cochee_ne_pese_sur_aucun_jour_passe() {
        let tasks = vec![task(1, "daily"), datee(2, None), datee(3, Some("2026-07-30"))];
        let comps = vec![done(1, "2026-07-27")];
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), Some(100));
    }

    // — Série —

    #[test]
    fn la_serie_s_arrete_au_premier_jour_rate() {
        let tasks = vec![task(1, "daily")];
        let comps = vec![
            done(1, "2026-07-26"),
            done(1, "2026-07-25"),
            // 24 juillet manqué
            done(1, "2026-07-23"),
        ];
        assert_eq!(streak_before(&tasks, &comps, d("2026-07-27")), 2);
    }

    #[test]
    fn un_jour_neutre_ne_casse_pas_la_serie() {
        // Tâche du lundi au vendredi : le week-end est neutre, pas un échec.
        let tasks = vec![task(1, "weekdays")];
        let comps = vec![
            done(1, "2026-07-31"), // vendredi
            done(1, "2026-07-30"),
            done(1, "2026-07-29"),
        ];
        // On est samedi 1ᵉʳ août : la série d'avant vaut 3, week-end traversé.
        assert_eq!(streak_before(&tasks, &comps, d("2026-08-01")), 3);
    }

    #[test]
    fn la_serie_exclut_le_jour_en_cours() {
        let tasks = vec![task(1, "daily")];
        let comps = vec![done(1, "2026-07-27"), done(1, "2026-07-26")];
        // Aujourd'hui est déjà fait, mais la série « à risque » compte hier et avant.
        assert_eq!(streak_before(&tasks, &comps, d("2026-07-27")), 1);
    }

    // — Jour en cours : la définition de « la tâche du jour » (2026-10-11) —
    // Les mêmes cas que `src/lib/logic.jour.test.ts`.

    #[test]
    fn prevue_le_jour_de_sa_date_et_lui_seul() {
        let auj = d("2026-07-27");
        assert!(est_prevue_le(&datee(1, Some("2026-07-27")), auj));
        assert!(!est_prevue_le(&datee(1, Some("2026-07-26")), auj));
        assert!(!est_prevue_le(&datee(1, Some("2026-07-28")), auj));
        assert!(!est_prevue_le(&datee(1, None), auj));
        assert!(est_prevue_le(&task(1, "daily"), auj));
        // Une routine ne suit pas une date égarée dans sa ligne (samedi, lun–ven).
        let egaree = Task {
            id: 1,
            recurrence: Some("weekdays".into()),
            created_at: None,
            due_date: Some("2026-08-01".into()),
            state: None,
            state_since: None,
            pauses: None,
            ponctuelle_depuis: None,
        };
        assert!(!est_prevue_le(&egaree, d("2026-08-01")));
    }

    /// A17-19 : ajouter une tâche sans date, ou datée de jeudi, ne change pas
    /// le pourcentage du jour.
    #[test]
    fn ajouter_une_tache_sans_date_ne_change_pas_le_jour() {
        let auj = d("2026-07-27");
        let comps = vec![done(2, "2026-07-27")];
        let avant = vec![datee(1, Some("2026-07-27")), task(2, "daily"), task(3, "daily")];
        assert_eq!(today_pct(&avant, &comps, auj), Some(33));

        let mut sans_date = avant.clone();
        sans_date.push(datee(10, None));
        assert_eq!(today_pct(&sans_date, &comps, auj), Some(33));

        let mut a_venir = avant.clone();
        a_venir.push(datee(11, Some("2026-07-30")));
        assert_eq!(today_pct(&a_venir, &comps, auj), Some(33));

        let mut en_retard = avant.clone();
        en_retard.push(datee(12, Some("2026-07-20")));
        assert_eq!(today_pct(&en_retard, &comps, auj), Some(33));
    }

    #[test]
    fn une_tache_datee_d_aujourd_hui_compte() {
        let tasks = vec![task(1, "daily"), datee(2, Some("2026-07-27"))];
        let comps = vec![done(1, "2026-07-27")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(50));
    }

    /// Ce qu'on coche aujourd'hui compte pour aujourd'hui : sans date, faite en
    /// avance — mais pas une tâche en retard rattrapée (2026-10-20).
    #[test]
    fn ce_qu_on_coche_aujourd_hui_compte_pour_aujourd_hui() {
        let tasks = vec![
            task(1, "daily"),
            datee(2, None),
            datee(3, Some("2026-07-26")),
            datee(4, Some("2026-07-28")),
        ];
        let comps = vec![done(2, "2026-07-27"), done(3, "2026-07-27"), done(4, "2026-07-27")];
        // 2 faites sur 3 : la tâche n° 3 (en retard) n'est pas dans la liste.
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(67));
    }

    #[test]
    fn cochee_puis_decochee_une_tache_sans_date_ressort_de_la_liste() {
        let tasks = vec![datee(2, None)];
        let comps = vec![undone(2, "2026-07-27")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), None);
    }

    #[test]
    fn datee_d_aujourd_hui_mais_faite_hier_elle_a_compte_hier() {
        let tasks = vec![datee(1, Some("2026-07-27"))];
        let comps = vec![done(1, "2026-07-26")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), None);
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-26")), Some(100));
    }

    /// À minuit, le chiffre du jour ne peut que monter : seule la tâche datée
    /// d'aujourd'hui et pas faite sort du compte.
    #[test]
    fn a_minuit_le_chiffre_du_jour_ne_peut_que_monter() {
        let auj = d("2026-07-27");
        let tasks = vec![
            task(1, "daily"),
            task(2, "daily"),
            datee(3, Some("2026-07-27")),
            datee(4, Some("2026-07-27")),
            datee(5, None),
        ];
        let comps = vec![done(1, "2026-07-27"), done(3, "2026-07-27"), done(5, "2026-07-27")];
        assert_eq!(today_pct(&tasks, &comps, auj), Some(60));
        assert_eq!(day_pct(&tasks, &comps, auj), Some(75));
    }

    #[test]
    fn une_ponctuelle_sans_date_ne_met_plus_la_journee_a_zero() {
        // Avant : la ponctuelle non faite restait dans la liste du jour (1/2).
        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(1, "2026-07-27")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(100));
    }

    #[test]
    fn une_ponctuelle_faite_un_autre_jour_n_est_pas_dans_la_liste() {
        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(2, "2026-07-20")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(0));
    }

    #[test]
    fn journee_vide_vaut_none() {
        assert_eq!(today_pct(&[], &[], d("2026-07-27")), None);
        // Rien de prévu aujourd'hui : neutre, pas 0 %.
        let tasks = vec![datee(1, None), datee(2, Some("2026-07-20"))];
        assert_eq!(today_pct(&tasks, &[], d("2026-07-27")), None);
    }

    /// Migration 031 : une routine en attente ou abandonnée est en PAUSE à
    /// partir de `state_since`, pas avant — l'historique ne se réécrit pas.
    #[test]
    fn une_routine_suspendue_est_en_pause_depuis_son_etat() {
        let mut t = task(1, "daily");
        t.state = Some("waiting".into());
        t.state_since = Some("2026-07-28".into());
        assert!(is_due_on(&t, d("2026-07-27")), "la veille reste due");
        assert!(!is_due_on(&t, d("2026-07-28")));
        t.state = Some("dropped".into());
        assert!(!is_due_on(&t, d("2026-07-29")));
        t.state = Some("doing".into());
        assert!(is_due_on(&t, d("2026-07-29")), "en cours ne suspend rien");
    }

    /// ⭐ Migration 032 (audit 2026-10-20, taches-1) : une routine REPRISE garde
    /// ses jours de pause neutres. Avant, « À faire » effaçait `state_since` et
    /// chaque jour de pause redevenait dû et manqué — la série tombait après coup.
    #[test]
    fn une_routine_reprise_garde_ses_jours_de_pause() {
        let mut t = task(1, "daily");
        t.state = Some("todo".into());
        t.pauses = Some(r#"[["2026-07-20","2026-07-27"]]"#.into());
        assert!(is_due_on(&t, d("2026-07-19")), "la veille de la pause reste due");
        assert!(!is_due_on(&t, d("2026-07-20")));
        assert!(!is_due_on(&t, d("2026-07-26")));
        assert!(is_due_on(&t, d("2026-07-27")), "le jour de la reprise compte de nouveau");
        // Faite les jours d'avant la pause, rien pendant : la série traverse la pause.
        let comps = vec![done(1, "2026-07-18"), done(1, "2026-07-19")];
        assert_eq!(day_pct(&[t.clone()], &comps, d("2026-07-23")), None, "un jour de pause est neutre");
        assert_eq!(streak_before(&[t], &comps, d("2026-07-27")), 2);
    }

    #[test]
    fn une_pause_depuis_toujours_et_un_json_illisible() {
        let mut t = task(1, "daily");
        t.pauses = Some(r#"[[null,"2026-07-20"]]"#.into());
        assert!(!is_due_on(&t, d("2026-07-01")));
        assert!(is_due_on(&t, d("2026-07-20")));
        t.pauses = Some("{pas du json}".into());
        assert!(is_due_on(&t, d("2026-07-01")), "illisible : aucune pause, jamais une panne");
    }

    /// ⭐ Migration 032 (audit 2026-10-20, taches-6) : une routine devenue
    /// ponctuelle n'est pas « faite » par ses anciennes coches.
    #[test]
    fn une_routine_devenue_ponctuelle_n_est_pas_faite_par_ses_anciennes_coches() {
        let mut t = datee(1, Some("2026-07-27"));
        t.ponctuelle_depuis = Some("2026-07-25".into());
        let comps = vec![done(1, "2026-07-20")];
        assert_eq!(today_pct(&[t.clone()], &comps, d("2026-07-27")), Some(0), "prévue aujourd'hui, pas faite");
        let comps = vec![done(1, "2026-07-26")];
        assert_eq!(today_pct(&[t], &comps, d("2026-07-27")), None, "faite après la conversion : elle a compté ce jour-là");
    }

    #[test]
    fn une_ponctuelle_suspendue_n_est_plus_prevue() {
        let mut t = datee(1, Some("2026-07-28"));
        assert!(est_prevue_le(&t, d("2026-07-28")));
        t.state = Some("waiting".into());
        assert!(!est_prevue_le(&t, d("2026-07-28")), "sans date d'état : depuis toujours");
        t.state = Some("inconnu".into());
        assert!(est_prevue_le(&t, d("2026-07-28")), "un état inconnu vaut « à faire »");
    }
}
