//! Types du système de notifications — aucun accès disque, aucun appel Tauri.
//!
//! Tout ce qui est persisté vit dans `notifications.json` (préférences + journal) :
//! le Rust en est le SEUL écrivain, ce qui évite toute contention avec le front
//! qui, lui, écrit dans `shale.db`. Le `Snapshot` est l'image en lecture seule des
//! données de l'app dont les règles ont besoin ; il est fabriqué à la main dans les
//! tests, ce qui rend le moteur testable sans base ni application.

use chrono::{DateTime, Local, NaiveDate, NaiveDateTime};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Nombre de notifications conservées au journal (les plus anciennes sont purgées).
pub const LOG_MAX: usize = 200;

/// Marqueur des notifications de test (bouton « Envoyer un test »). Elles vont
/// bien au journal, mais ne comptent PAS dans le plafond quotidien : sans quoi
/// deux tests d'affilée rendraient les vrais rappels muets pour la journée.
pub const TEST_RULE: &str = "test";

// — Préférences —

/// Plage horaire pendant laquelle on s'autorise à notifier (heures locales).
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct QuietHours {
    /// Première heure autorisée (incluse).
    pub start: u32,
    /// Première heure interdite (exclue).
    pub end: u32,
}

impl Default for QuietHours {
    fn default() -> Self {
        Self { start: 8, end: 22 }
    }
}

impl QuietHours {
    /// `start < end` = fenêtre de jour ; `start > end` = fenêtre à cheval sur minuit.
    /// `start == end` = fenêtre vide (aucune notification), volontairement strict :
    /// c'est le seul moyen de couper les notifs système par les seules heures.
    pub fn allows(&self, hour: u32) -> bool {
        if self.start == self.end {
            false
        } else if self.start < self.end {
            hour >= self.start && hour < self.end
        } else {
            hour >= self.start || hour < self.end
        }
    }
}

/// Réglages d'une règle. `enabled` et `cooldown_h` sont communs à toutes ;
/// les seuils propres à chaque règle (jours, heure de rappel…) vivent à plat
/// dans `params`, ce qui permet d'ajouter une règle sans toucher à ce type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RulePrefs {
    #[serde(default = "yes")]
    pub enabled: bool,
    /// Délai minimal entre deux notifications de la MÊME règle, en heures.
    #[serde(default = "default_cooldown")]
    pub cooldown_h: i64,
    #[serde(flatten, default)]
    pub params: serde_json::Map<String, serde_json::Value>,
}

fn yes() -> bool {
    true
}

fn default_cooldown() -> i64 {
    24
}

impl RulePrefs {
    /// Construit les réglages par défaut d'une règle : `params` est fourni sous
    /// forme de paires, ce qui garde la déclaration lisible côté règle.
    pub fn new(cooldown_h: i64, params: &[(&str, i64)]) -> Self {
        Self {
            enabled: true,
            cooldown_h,
            params: params
                .iter()
                .map(|(k, v)| ((*k).to_string(), serde_json::json!(*v)))
                .collect(),
        }
    }

    /// Lit un seuil entier, en retombant sur `fallback` si la clé est absente
    /// ou d'un type inattendu (fichier édité à la main, ancienne version…).
    pub fn param_i64(&self, key: &str, fallback: i64) -> i64 {
        self.params.get(key).and_then(|v| v.as_i64()).unwrap_or(fallback)
    }

    /// Variante bornée à 0-23 pour les heures de déclenchement.
    pub fn param_hour(&self, key: &str, fallback: u32) -> u32 {
        match self.params.get(key).and_then(|v| v.as_i64()) {
            Some(h) if (0..=23).contains(&h) => h as u32,
            _ => fallback,
        }
    }
}

/// Préférences globales. Sérialisées telles quelles dans `notifications.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct Prefs {
    /// Coupe tout : ni évaluation, ni notification système, ni entrée au journal.
    pub enabled: bool,
    pub quiet_hours: QuietHours,
    /// Plafond de notifications émises par jour local (le regroupement compte pour 1).
    pub daily_cap: usize,
    /// Période du planificateur, en minutes.
    pub check_interval_min: u64,
    /// Fermer la fenêtre laisse Shale vivre dans la barre de menus.
    pub keep_running_in_background: bool,
    /// Langue des notifications ("fr" ou "en"), recopiée depuis le front à
    /// chaque changement de langue. Le Rust n'a aucun autre moyen de la
    /// connaître : il tourne fenêtre fermée, sans accès au localStorage.
    #[serde(default = "default_lang")]
    pub lang: String,
    /// Le rappel de briefing de marché — 8 h pré-Londres, 14 h pré-New York.
    ///
    /// ⚠️ **Ce n'est PAS une règle**, et c'est délibéré : il n'a aucune
    /// condition. « Ton briefing t'attend » est vrai tous les jours, ce qui en
    /// fait le seul rappel de Shale qui ait droit au vrai rendez-vous quotidien
    /// du système (`Schedule::Interval`) plutôt qu'à une échéance ponctuelle
    /// reprogrammée. Il ne passe donc ni par `registry()`, ni par
    /// `engine::evaluate`, ni par le plafond quotidien. Voir `MOBILE.md`
    /// § 13.4, qui contient le raisonnement inverse — séduisant et faux — et
    /// dit pourquoi il l'est.
    ///
    /// L'interrupteur vit ici, avec les autres réglages de notification. Les
    /// CRÉNEAUX, eux, sont poussés par le front à chaque projection : lui seul
    /// sait traduire « 8 h à Paris » en heure murale de l'appareil, connaît la
    /// langue courante, et sait si le compte a l'offre Trade.
    #[serde(default = "yes")]
    pub market_briefing: bool,
    /// Réglages par règle, indexés par `NotificationRule::id`.
    pub rules: BTreeMap<String, RulePrefs>,
}

impl Default for Prefs {
    fn default() -> Self {
        Self {
            enabled: true,
            quiet_hours: QuietHours::default(),
            daily_cap: 2,
            check_interval_min: 15,
            keep_running_in_background: true,
            lang: default_lang(),
            market_briefing: true,
            rules: BTreeMap::new(),
        }
    }
}

// — Journal —

/// Une notification émise. `dedupe_keys` porte AUTANT de clés que de règles
/// regroupées : une notification de synthèse rend donc idempotente chacune des
/// règles qu'elle a absorbées.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LogEntry {
    pub id: String,
    pub rules: Vec<String>,
    pub dedupe_keys: Vec<String>,
    pub title: String,
    pub body: String,
    /// Vue à ouvrir au clic dans le centre in-app (`journal`, `knowledge`…).
    pub target: Option<String>,
    pub created_at: DateTime<Local>,
    pub read: bool,
    /// La notification a été REMISE au système — pas la preuve qu'elle a été
    /// affichée. Sur macOS, `tauri-plugin-notification` délègue l'envoi à une
    /// tâche de fond et en jette le résultat : si l'utilisateur a refusé les
    /// notifications dans les Réglages, rien ne remonte jusqu'ici. Le centre
    /// in-app reste donc la seule source de vérité (cf. README du module).
    pub handed_to_system: bool,
}

/// État du moteur, utile au planificateur et au diagnostic.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(default)]
pub struct EngineState {
    pub last_run_at: Option<DateTime<Local>>,
    /// Identifiants des notifications DÉPOSÉES auprès du système (iOS).
    ///
    /// ⚠️ On tient ce registre nous-mêmes parce que le greffon ne sait pas
    /// répondre à la question. Dans `tauri-plugin-notification` 2.3.3, les DEUX
    /// chemins qui le permettraient sont cassés sur iOS, et c'est mesuré :
    ///   - `cancel_all()` envoie `()` — donc `null` — à une commande Swift qui
    ///     fait `parseArgs(CancelArgs.self)` sans condition. Elle exige
    ///     `{"notifications": [...]}` et échoue sur `DecodingError`. Aucun
    ///     `removeAllPendingNotificationRequests()` n'existe côté iOS ;
    ///   - `pending()` échoue à la désérialisation : le `PendingNotification`
    ///     Rust réclame un champ `schedule` NON optionnel, que le
    ///     `PendingNotification` Swift n'encode pas.
    ///
    /// Sans ce registre, une échéance devenue fausse resterait armée pour
    /// toujours — exactement la notification mensongère que tout le module
    /// cherche à éviter. `cancel(ids)`, lui, marche : il porte ses arguments.
    #[serde(default)]
    pub scheduled_ids: Vec<i32>,
}

/// Contenu intégral de `notifications.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(default)]
pub struct NotifFile {
    pub version: u32,
    pub preferences: Prefs,
    /// Plus récentes en tête.
    pub log: Vec<LogEntry>,
    pub state: EngineState,
}

impl Default for NotifFile {
    fn default() -> Self {
        Self {
            version: 1,
            preferences: Prefs::default(),
            log: Vec::new(),
            state: EngineState::default(),
        }
    }
}

impl NotifFile {
    /// Insère une notification en tête et borne la taille du journal.
    pub fn push(&mut self, entry: LogEntry) {
        self.log.insert(0, entry);
        self.log.truncate(LOG_MAX);
    }

    pub fn unread(&self) -> usize {
        self.log.iter().filter(|e| !e.read).count()
    }
}

// — Image des données de l'app (lecture seule) —

#[derive(Debug, Clone)]
pub struct Habit {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone)]
pub struct HabitCheck {
    pub habit_id: i64,
    /// `YYYY-MM-DD`, jour local — même convention que le front.
    pub date: String,
}

#[derive(Debug, Clone)]
pub struct Task {
    pub id: i64,
    /// `none` | `daily` | `weekdays` | JSON de jours (`[1,3,5]`). Voir `task_streak`.
    pub recurrence: Option<String>,
    /// `YYYY-MM-DD HH:MM:SS` (UTC, `datetime('now')` côté SQLite).
    pub created_at: Option<String>,
}

#[derive(Debug, Clone)]
pub struct Completion {
    pub task_id: i64,
    pub date: String,
    pub done: bool,
}

/// Ce que les règles savent de l'app à un instant donné. Fabriqué par `data.rs`
/// en natif, à la main dans les tests.
#[derive(Debug, Clone, Default)]
pub struct Snapshot {
    pub habits: Vec<Habit>,
    pub habit_checks: Vec<HabitCheck>,
    pub tasks: Vec<Task>,
    pub completions: Vec<Completion>,
    /// Dernière ouverture d'une fiche du Savoir. `None` = jamais consulté
    /// (ou base absente) : les règles qui en dépendent restent alors inertes.
    pub knowledge_last_viewed: Option<NaiveDateTime>,
}

impl Snapshot {
    /// Habitudes non cochées pour le jour donné.
    pub fn habits_pending_on(&self, date: NaiveDate) -> Vec<&Habit> {
        let day = date.format("%Y-%m-%d").to_string();
        self.habits
            .iter()
            .filter(|h| {
                !self
                    .habit_checks
                    .iter()
                    .any(|c| c.habit_id == h.id && c.date == day)
            })
            .collect()
    }

    /// Jours consécutifs, **strictement avant** `date`, où TOUTES les habitudes
    /// actives étaient cochées. C'est la série « en cours » : on exclut le jour
    /// même, qui n'est pas fini — c'est justement lui qui peut la rompre.
    ///
    /// Borné par la profondeur d'historique chargée (`data::HISTORY_DAYS`) ;
    /// sans importance ici, une série plus longue reste « en danger ».
    pub fn habit_streak_before(&self, date: NaiveDate) -> i64 {
        if self.habits.is_empty() {
            return 0;
        }
        let mut streak = 0;
        let mut d = date.pred_opt();
        while let Some(day) = d {
            if !self.habits_pending_on(day).is_empty() {
                break;
            }
            streak += 1;
            d = day.pred_opt();
            if streak >= 365 {
                break;
            }
        }
        streak
    }
}

// — Sortie d'une règle —

/// Ce qu'une règle propose d'envoyer. Le moteur décide ensuite s'il l'émet
/// seule, la regroupe, ou l'écarte (fenêtre horaire, plafond, cooldown, doublon).
#[derive(Debug, Clone)]
pub struct Candidate {
    pub rule: &'static str,
    /// Identité de l'ÉVÉNEMENT (typiquement `regle:AAAA-MM-JJ`) : deux candidats
    /// de même clé ne peuvent pas être notifiés deux fois.
    pub dedupe_key: String,
    pub title: String,
    pub body: String,
    /// Ligne courte utilisée quand plusieurs règles sont regroupées.
    pub summary: String,
    pub target: Option<&'static str>,
    /// Départage le regroupement : la plus haute donne son titre et sa cible.
    pub priority: u8,
    /// Règles à écarter du même lot quand celle-ci se déclenche — pour éviter
    /// deux formulations du même constat (ex. série en danger vs habitudes dues).
    pub supersedes: &'static [&'static str],
}

// — Contexte d'évaluation —

/// Tout ce dont une règle a besoin. `now` est un PARAMÈTRE, jamais un appel
/// système : c'est ce qui rend le moteur testable avec une fausse horloge.
pub fn default_lang() -> String {
    "fr".to_string()
}

/// Choisit entre deux formulations selon la langue des préférences.
/// Volontairement minimal : trois règles, quelques phrases — un vrai moteur de
/// traduction côté Rust serait disproportionné.
pub fn pick<'a>(lang: &str, fr: &'a str, en: &'a str) -> &'a str {
    if lang == "en" { en } else { fr }
}

pub struct EvalContext<'a> {
    pub now: DateTime<Local>,
    pub snapshot: &'a Snapshot,
    pub prefs: &'a Prefs,
    pub log: &'a [LogEntry],
}

impl EvalContext<'_> {
    pub fn today(&self) -> NaiveDate {
        self.now.date_naive()
    }

    /// Langue courante des notifications.
    pub fn lang(&self) -> &str {
        &self.prefs.lang
    }

    /// Raccourci : `ctx.pick("Série en danger", "Streak at risk")`.
    pub fn pick<'b>(&self, fr: &'b str, en: &'b str) -> &'b str {
        pick(&self.prefs.lang, fr, en)
    }

    pub fn rule_prefs(&self, rule: &str) -> Option<&RulePrefs> {
        self.prefs.rules.get(rule)
    }

    /// Dernière émission d'une règle donnée (une notif de synthèse compte pour
    /// chacune des règles qu'elle porte).
    pub fn last_fired(&self, rule: &str) -> Option<DateTime<Local>> {
        self.log
            .iter()
            .filter(|e| e.rules.iter().any(|r| r == rule))
            .map(|e| e.created_at)
            .max()
    }

    pub fn already_sent(&self, dedupe_key: &str) -> bool {
        self.log
            .iter()
            .any(|e| e.dedupe_keys.iter().any(|k| k == dedupe_key))
    }

    /// Notifications déjà émises aujourd'hui (jour local), hors tests manuels :
    /// une vérification demandée par l'utilisateur ne doit pas consommer son
    /// quota de rappels.
    pub fn sent_today(&self) -> usize {
        let today = self.today();
        self.log
            .iter()
            .filter(|e| e.created_at.date_naive() == today)
            .filter(|e| !e.rules.iter().all(|r| r == TEST_RULE))
            .count()
    }
}
