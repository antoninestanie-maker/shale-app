//! Fabriques partagées par les tests du module — la « fausse horloge » et les
//! entrées de journal factices. Compilé uniquement en test.

use chrono::{DateTime, Local, NaiveDateTime, TimeZone};

use super::model::{EvalContext, LogEntry, Prefs, Snapshot};

const FMT: &str = "%Y-%m-%d %H:%M:%S";

/// `"2026-07-27 20:00:00"` → date/heure naïve. Panique sur une entrée mal formée :
/// c'est une erreur de test, pas un cas d'exécution.
pub fn naive(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, FMT).expect("date de test invalide")
}

/// Même chose, ancrée dans le fuseau local — c'est le « maintenant » injecté.
/// `earliest()` tranche le saut d'heure d'été, où une heure locale peut être
/// ambiguë ou inexistante.
pub fn at(s: &str) -> DateTime<Local> {
    Local
        .from_local_datetime(&naive(s))
        .earliest()
        .expect("heure locale de test inexistante")
}

pub fn ctx_at<'a>(
    now: DateTime<Local>,
    snapshot: &'a Snapshot,
    prefs: &'a Prefs,
    log: &'a [LogEntry],
) -> EvalContext<'a> {
    EvalContext { now, snapshot, prefs, log }
}

/// Entrée de journal minimale : seuls la date, les règles et les clés comptent
/// pour les filtres du moteur.
pub fn entry(created_at: &str, rules: &[&str], dedupe_keys: &[&str]) -> LogEntry {
    LogEntry {
        id: format!("test_{created_at}"),
        rules: rules.iter().map(|s| (*s).to_string()).collect(),
        dedupe_keys: dedupe_keys.iter().map(|s| (*s).to_string()).collect(),
        title: "t".into(),
        body: "b".into(),
        target: None,
        created_at: at(created_at),
        read: false,
        handed_to_system: true,
    }
}
