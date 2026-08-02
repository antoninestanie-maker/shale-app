//! Série de tâches — **portage Rust de `src/lib/logic.ts`**.
//!
//! ⚠️ Code dupliqué, en connaissance de cause. La série affichée dans le bandeau
//! de performance est calculée en TypeScript ; pour qu'une notification puisse
//! dire « ta série est en danger » sans fenêtre ouverte, le Rust doit refaire le
//! même calcul. Deux implémentations d'une même règle métier finissent par
//! diverger : la **source de vérité reste `logic.ts`**, et toute évolution de
//! `isDueOn`, `dayStat`, `todayTasks` ou `computeStreak` doit être répercutée ici.
//!
//! Correspondances :
//!   `isDueOn`      → [`is_due_on`]
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

/// Une tâche récurrente est-elle due ce jour-là ?
/// Port de `isDueOn` — même convention de jour que `Date.getDay()` : 0 = dimanche.
pub fn is_due_on(task: &Task, date: NaiveDate) -> bool {
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

/// Pourcentage de complétion d'un jour PASSÉ. `None` = aucune tâche due,
/// journée neutre qui ne casse pas la série. Port de `dayStat().pct`.
pub fn day_pct(tasks: &[Task], completions: &[Completion], date: NaiveDate) -> Option<i64> {
    let day = day_str(date);
    let comps: Vec<&Completion> = completions.iter().filter(|c| c.date == day).collect();

    let mut due: Vec<i64> = tasks
        .iter()
        .filter(|t| is_due_on(t, date))
        .map(|t| t.id)
        .collect();
    // Les tâches ponctuelles comptent pour un jour passé si elles y ont une
    // ligne de complétion — c'est ce que fait `dayStat`.
    for c in &comps {
        if let Some(t) = tasks.iter().find(|t| t.id == c.task_id) {
            if !is_recurring(t) && !due.contains(&t.id) {
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

/// Pourcentage du JOUR EN COURS, calculé sur la liste réellement affichée
/// (`pctOfList(todayTasks(...))`) et non sur `dayStat` : c'est ce que voient
/// `TodayView` et `PerformanceView`, donc ce que l'utilisateur appelle « sa
/// journée ». `None` = rien à faire aujourd'hui.
pub fn today_pct(tasks: &[Task], completions: &[Completion], today: NaiveDate) -> Option<i64> {
    let day = day_str(today);
    let list: Vec<&Task> = tasks
        .iter()
        .filter(|t| {
            if is_due_on(t, today) {
                return true;
            }
            if is_recurring(t) {
                return false;
            }
            if let Some(created) = &t.created_at {
                if created.len() >= 10 && &created[..10] > day.as_str() {
                    return false;
                }
            }
            // Une tâche ponctuelle déjà faite un autre jour a quitté la liste.
            match completions.iter().find(|c| c.task_id == t.id && c.done) {
                Some(c) => c.date == day,
                None => true,
            }
        })
        .collect();

    if list.is_empty() {
        return None;
    }
    let done = list
        .iter()
        .filter(|t| {
            completions
                .iter()
                .any(|c| c.task_id == t.id && c.date == day && c.done)
        })
        .count() as i64;
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
        Task { id, recurrence: Some(recurrence.into()), created_at: None }
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
        assert!(!is_due_on(&Task { id: 1, recurrence: None, created_at: None }, d("2026-07-27")));
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
    fn une_ponctuelle_compte_le_jour_ou_elle_a_une_ligne() {
        let tasks = vec![task(1, "none")];
        let comps = vec![undone(1, "2026-07-27")];
        assert_eq!(day_pct(&tasks, &comps, d("2026-07-27")), Some(0));
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

    // — Jour en cours —

    #[test]
    fn le_jour_en_cours_suit_la_liste_affichee() {
        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(1, "2026-07-27")];
        // La ponctuelle non faite reste dans la liste du jour : 1/2 = 50 %.
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(50));
    }

    #[test]
    fn une_ponctuelle_faite_un_autre_jour_quitte_la_liste() {
        let tasks = vec![task(1, "daily"), task(2, "none")];
        let comps = vec![done(2, "2026-07-20")];
        assert_eq!(today_pct(&tasks, &comps, d("2026-07-27")), Some(0));
    }

    #[test]
    fn journee_vide_vaut_none() {
        assert_eq!(today_pct(&[], &[], d("2026-07-27")), None);
    }
}
