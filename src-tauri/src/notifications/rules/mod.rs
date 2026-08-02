//! Registre des règles.
//!
//! Ajouter une règle = créer un fichier ici, implémenter `NotificationRule`,
//! et ajouter une ligne à `REGISTRY`. Rien d'autre : les préférences par défaut
//! sont fournies par la règle elle-même et fusionnées dans le fichier de
//! configuration existant au démarrage (voir `store::hydrate`).

use super::model::{Candidate, EvalContext, RulePrefs};

pub mod habits;
pub mod inactivity;
pub mod streak;

pub trait NotificationRule: Send + Sync {
    /// Identifiant stable : sert de clé de préférences ET de marqueur au journal.
    /// Le renommer ferait repartir cooldown et idempotence de zéro.
    fn id(&self) -> &'static str;

    /// Libellé humain, affiché dans l'écran de préférences.
    fn label(&self) -> &'static str;

    fn default_prefs(&self) -> RulePrefs;

    /// `None` = rien à signaler. La règle n'a PAS à vérifier le cooldown, le
    /// plafond quotidien, la fenêtre horaire ni les doublons : le moteur s'en
    /// charge pour toutes les règles de la même façon.
    fn evaluate(&self, ctx: &EvalContext) -> Option<Candidate>;
}

static INACTIVITY: inactivity::Inactivity = inactivity::Inactivity;
static HABITS_PENDING: habits::HabitsPending = habits::HabitsPending;
static STREAK_AT_RISK: streak::StreakAtRisk = streak::StreakAtRisk;

/// Toutes les règles connues, dans l'ordre d'évaluation. C'est la SEULE ligne
/// à modifier pour brancher une nouvelle règle.
static REGISTRY: &[&dyn NotificationRule] =
    &[&STREAK_AT_RISK, &HABITS_PENDING, &INACTIVITY];

pub fn registry() -> &'static [&'static dyn NotificationRule] {
    REGISTRY
}
