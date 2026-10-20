//! La discipline sur les HABITUDES, telle que l'anneau d'Aujourd'hui la lit.
//!
//! ⚠️ PORTAGE de `src/lib/disciplineHabitudes.ts` (et de `debutsDesHabitudes`
//! / `serieHabitudes` de `src/lib/performance/analyse.ts`). La source de vérité
//! reste le TypeScript : toute évolution là-bas se répercute ici, sinon la
//! notification « série en danger » ne parle plus de la série que l'écran
//! affiche. C'est exactement le défaut que ce fichier répare (2026-10-20) :
//! l'anneau était passé aux habitudes, la notification comptait encore les
//! tâches.
//!
//! La règle, mot pour mot :
//!   - une habitude compte à partir de sa PREMIÈRE coche (jamais cochée : à
//!     partir d'aujourd'hui) ; les exemples ne comptent pas ;
//!   - la part d'un jour = habitudes cochées ÷ habitudes qui comptaient ce
//!     jour-là, arrondie ; aucune ne comptait : jour neutre (ni tenu, ni rompu) ;
//!   - un jour est tenu à `SEUIL_JOUR_TENU` (75 %).
//!
//! Différence assumée : le Rust ne lit que `data::HISTORY_DAYS` (90 jours) de
//! coches, le TypeScript un an. Une série plus longue reste « en danger » ; seul
//! le nombre écrit dans la notification serait plafonné.

use std::collections::{BTreeSet, HashMap};

use chrono::NaiveDate;

use super::model::Snapshot;

/// Copie de `SEUIL_JOUR_TENU` (`disciplineHabitudes.ts`). À changer aux deux
/// endroits.
pub const SEUIL_JOUR_TENU: i64 = 75;

fn jour(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// `Math.round(tenues / actives * 100)`, en entiers (les deux sont positifs :
/// l'arrondi « au plus proche, moitié vers le haut » est celui de JavaScript).
pub fn pourcent(tenues: usize, actives: usize) -> i64 {
    ((200 * tenues + actives) / (2 * actives)) as i64
}

/// Le jour où chaque habitude qui compte a commencé à compter
/// (`debutsDesHabitudes`).
fn debuts(snap: &Snapshot, today: NaiveDate) -> HashMap<i64, String> {
    let mut debuts: HashMap<i64, String> =
        snap.habits.iter().filter(|h| !h.is_example).map(|h| (h.id, jour(today))).collect();
    for c in &snap.habit_checks {
        if let Some(d) = debuts.get_mut(&c.habit_id) {
            if c.date < *d {
                *d = c.date.clone();
            }
        }
    }
    debuts
}

/// Où en est la journée, et la série qui la précède.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EtatHabitudes {
    /// Habitudes cochées aujourd'hui, parmi celles qui comptent.
    pub tenues: usize,
    pub actives: usize,
    /// `None` tant qu'aucune habitude ne compte.
    pub pct: Option<i64>,
    /// Jours tenus d'affilée, ARRÊTÉE À HIER : c'est elle que la journée en
    /// cours peut rompre. (L'écran ajoute aujourd'hui dès qu'il est tenu.)
    pub serie_avant: i64,
}

impl EtatHabitudes {
    /// Combien d'habitudes cocher encore pour que la journée soit tenue
    /// (0 si elle l'est déjà, ou s'il n'y a rien à tenir).
    pub fn a_cocher_pour_tenir(&self) -> usize {
        if self.actives == 0 {
            return 0;
        }
        (self.tenues..=self.actives)
            .find(|&n| pourcent(n, self.actives) >= SEUIL_JOUR_TENU)
            .map_or(0, |n| n - self.tenues)
    }
}

pub fn etat(snap: &Snapshot, today: NaiveDate) -> EtatHabitudes {
    let debuts = debuts(snap, today);

    // Les coches de chaque jour, une fois par habitude (une case cochée deux
    // fois ne compte qu'une).
    let mut cochees: HashMap<&str, BTreeSet<i64>> = HashMap::new();
    for c in &snap.habit_checks {
        if debuts.contains_key(&c.habit_id) {
            cochees.entry(c.date.as_str()).or_default().insert(c.habit_id);
        }
    }
    let part = |date: &str| -> Option<i64> {
        let actives = debuts.values().filter(|d| d.as_str() <= date).count();
        if actives == 0 {
            return None;
        }
        Some(pourcent(cochees.get(date).map_or(0, |s| s.len()), actives))
    };

    let aujourdhui = jour(today);
    let actives = debuts.len();
    let tenues = cochees.get(aujourdhui.as_str()).map_or(0, |s| s.len());
    let pct = if actives > 0 { Some(pourcent(tenues, actives)) } else { None };

    // Avant le premier début, plus aucune habitude ne compte : inutile d'aller
    // plus loin (le TypeScript s'arrête à un an, ce qui revient au même).
    let premier = debuts.values().min().cloned();
    let mut serie_avant = 0;
    let mut d = today.pred_opt();
    while let (Some(day), Some(premier)) = (d, premier.as_deref()) {
        let date = jour(day);
        if date.as_str() < premier {
            break;
        }
        match part(&date) {
            None => {} // jour neutre
            Some(p) if p >= SEUIL_JOUR_TENU => serie_avant += 1,
            Some(_) => break,
        }
        d = day.pred_opt();
    }

    EtatHabitudes { tenues, actives, pct, serie_avant }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Habit, HabitCheck};

    fn d(s: &str) -> NaiveDate {
        NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
    }

    fn snap(habits: &[(i64, bool)], checks: &[(i64, &str)]) -> Snapshot {
        Snapshot {
            habits: habits
                .iter()
                .map(|&(id, is_example)| Habit { id, name: format!("h{id}"), is_example })
                .collect(),
            habit_checks: checks
                .iter()
                .map(|&(habit_id, date)| HabitCheck { habit_id, date: date.into() })
                .collect(),
            ..Default::default()
        }
    }

    #[test]
    fn l_arrondi_est_celui_de_javascript() {
        // Math.round : 66,67 → 67 ; 12,5 → 13 ; 75 → 75.
        assert_eq!(pourcent(2, 3), 67);
        assert_eq!(pourcent(1, 8), 13);
        assert_eq!(pourcent(3, 4), 75);
        assert_eq!(pourcent(0, 5), 0);
        assert_eq!(pourcent(5, 5), 100);
    }

    #[test]
    fn trois_sur_quatre_tient_deux_sur_trois_non() {
        // Les deux cas que le TypeScript teste aussi (`disciplineHabitudes.test.ts`).
        let s = snap(
            &[(1, false), (2, false), (3, false), (4, false)],
            &[(1, "2026-10-19"), (2, "2026-10-19"), (3, "2026-10-19"), (4, "2026-10-18"),
              (1, "2026-10-18"), (2, "2026-10-18"), (3, "2026-10-18")],
        );
        assert_eq!(etat(&s, d("2026-10-20")).serie_avant, 2, "3/4 = 75 % : tenu");

        let s = snap(
            &[(1, false), (2, false), (3, false)],
            &[(1, "2026-10-17"), (2, "2026-10-17"), (3, "2026-10-17"), (1, "2026-10-19"), (2, "2026-10-19")],
        );
        // Le 18 : 0/3 ; le 19 : 2/3 = 67 % < 75 → aucune série.
        assert_eq!(etat(&s, d("2026-10-20")).serie_avant, 0);
    }

    #[test]
    fn une_habitude_compte_depuis_sa_premiere_coche() {
        // L'habitude 2 n'a été cochée qu'hier : avant, la 1 seule comptait.
        let s = snap(
            &[(1, false), (2, false)],
            &[(1, "2026-10-17"), (1, "2026-10-18"), (1, "2026-10-19"), (2, "2026-10-19")],
        );
        assert_eq!(etat(&s, d("2026-10-20")).serie_avant, 3);
    }

    #[test]
    fn un_jour_sans_habitude_active_est_neutre() {
        // Aucune habitude avant le 18 : la série s'arrête au premier début, sans rompre.
        let s = snap(&[(1, false)], &[(1, "2026-10-18"), (1, "2026-10-19")]);
        assert_eq!(etat(&s, d("2026-10-20")).serie_avant, 2);
    }

    #[test]
    fn les_exemples_ne_comptent_pas() {
        let s = snap(&[(1, false), (2, true)], &[(1, "2026-10-18"), (1, "2026-10-19")]);
        let e = etat(&s, d("2026-10-20"));
        assert_eq!(e.actives, 1, "l'exemple n'est pas actif");
        assert_eq!(e.serie_avant, 2, "l'exemple jamais coché ne rompt rien");
    }

    #[test]
    fn la_journee_en_cours_et_ce_qu_il_reste_a_cocher() {
        let s = snap(
            &[(1, false), (2, false), (3, false), (4, false)],
            &[(1, "2026-10-19"), (2, "2026-10-19"), (3, "2026-10-19"), (1, "2026-10-20")],
        );
        let e = etat(&s, d("2026-10-20"));
        assert_eq!((e.tenues, e.actives, e.pct), (1, 4, Some(25)));
        assert_eq!(e.a_cocher_pour_tenir(), 2, "3/4 suffit");

        let s = snap(&[(1, false), (2, false), (3, false)], &[(1, "2026-10-20")]);
        assert_eq!(etat(&s, d("2026-10-20")).a_cocher_pour_tenir(), 2, "2/3 = 67 % ne tient pas : il faut 3/3");
    }

    #[test]
    fn sans_habitude_rien_ne_compte() {
        let e = etat(&Snapshot::default(), d("2026-10-20"));
        assert_eq!(e, EtatHabitudes { tenues: 0, actives: 0, pct: None, serie_avant: 0 });
        assert_eq!(e.a_cocher_pour_tenir(), 0);
    }
}
