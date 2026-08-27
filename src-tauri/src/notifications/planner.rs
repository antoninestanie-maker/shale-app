//! Programmation À L'AVANCE — la traduction du moteur de règles vers le
//! planificateur d'une plateforme qui suspend l'app (iOS).
//!
//! ─── POURQUOI CE MODULE EXISTE ──────────────────────────────────────────────
//! `scheduler.rs` est une boucle de scrutation : il se réveille toutes les
//! minutes et décide sur l'horloge murale. Ça marche tant que le processus vit.
//! iOS le suspend dès que l'app quitte l'écran — la boucle s'arrête, et rien ne
//! la réveille. Le rappel de 20 h ne partirait jamais.
//!
//! Sur iOS, une notification locale se **dépose à l'avance** auprès du système,
//! qui l'affichera même app tuée. Encore faut-il savoir CE QU'ON DÉPOSE.
//!
//! ─── LA DIFFICULTÉ, ET SA SORTIE ────────────────────────────────────────────
//! Les règles de Shale ne sont pas des horaires, ce sont des CONDITIONS
//! évaluées sur l'état de la base. `habits.rs` refuse même d'émettre avant son
//! heure (`if ctx.now.hour() < hour { return None }`) : à 14 h, elle ne dit
//! rien de ce qu'elle dira à 20 h.
//!
//! On ne réécrit rien pour autant. `engine::evaluate` est PUR et lit son
//! « maintenant » dans `EvalContext.now` : on l'appelle avec un `now` PROJETÉ,
//! sur l'image de la base lue à l'instant présent. Ce qu'il rend est,
//! littéralement, la notification qui partirait à cette heure-là.
//!
//! Le bénéfice n'est pas la brièveté : c'est que plage horaire silencieuse,
//! plafond quotidien, cooldown, idempotence et fusion des candidats
//! s'appliquent AU MÊME CODE. Aucune règle n'est réimplémentée, donc aucune ne
//! peut diverger entre le bureau et le téléphone.
//!
//! ─── CE QUI RESTE FAUX, ET QUI EST ASSUMÉ ───────────────────────────────────
//! La projection suppose que l'état ne bougera plus. C'est vrai parce que le
//! front est SEUL ÉCRIVAIN de la base (`README.md` du module) : app fermée,
//! rien ne change. Une seule fuite, et elle est connue : si Antonin coche ses
//! habitudes sur le Mac, l'iPhone endormi n'en sait rien et notifiera à tort.
//! C'est le cas que la voie push résout (`MOBILE.md` § 3.2/3.3), et lui seul.
//! Jusque-là, la fausse notification cesse à la première ouverture de l'app.

use chrono::{DateTime, Datelike, Duration, Local, Timelike};

use super::engine::{self, Outcome};
use super::model::{EvalContext, LogEntry, Prefs, Snapshot};
use super::rules::registry;

/// Clé de réglage portant l'heure de déclenchement d'une règle. Convention du
/// module (`habits`, `streak`) ; une règle sans cette clé n'est pas projetable
/// à heure fixe et n'est donc pas sondée ici.
const CLE_HEURE: &str = "hour";

/// Plafond de dépôt. iOS n'accepte que **64 notifications en attente** par app
/// (limite Apple, susceptible d'avoir bougé — à revérifier) et, au-delà, ne
/// garde que les 64 plus proches. On reste très en dessous : au-delà de
/// quelques rappels déposés d'un coup, ce n'est plus un rappel, c'est du bruit.
pub const MAX_DEPOSEES: usize = 8;

/// Une notification à déposer auprès du système, et l'instant où elle doit
/// tomber. `entry` est le journal EXACT qu'aurait produit le moteur.
#[derive(Debug, Clone, PartialEq)]
pub struct Planned {
    pub at: DateTime<Local>,
    pub entry: LogEntry,
}

/// Les instants à SONDER : pour chaque règle active portant une heure, la
/// prochaine occurrence de cette heure.
///
/// « Prochaine » au sens strict : si l'heure du jour est déjà passée, on vise
/// demain. Déposer une échéance passée n'est pas neutre — le greffon iOS lève
/// `pastScheduledTime` et l'appel échoue (`MOBILE.md` § 13.2).
pub fn instants_a_sonder(now: DateTime<Local>, prefs: &Prefs) -> Vec<DateTime<Local>> {
    let mut heures: Vec<u32> = registry()
        .iter()
        .filter_map(|r| prefs.rules.get(r.id()))
        .filter(|p| p.enabled)
        .filter(|p| p.params.contains_key(CLE_HEURE))
        .map(|p| p.param_hour(CLE_HEURE, 20))
        .collect();
    heures.sort_unstable();
    heures.dedup();

    heures
        .into_iter()
        .filter_map(|h| prochaine_occurrence(now, h))
        .collect()
}

/// Aujourd'hui à `heure`, ou demain si c'est déjà passé.
///
/// `None` si l'heure locale n'existe pas — le saut d'heure d'été fait
/// disparaître 2 h à 3 h une nuit par an. Sauter le sondage vaut mieux que
/// déposer une date que le système refusera.
fn prochaine_occurrence(now: DateTime<Local>, heure: u32) -> Option<DateTime<Local>> {
    let vise = |jour: DateTime<Local>| {
        jour.with_hour(heure)
            .and_then(|d| d.with_minute(0))
            .and_then(|d| d.with_second(0))
            .and_then(|d| d.with_nanosecond(0))
    };
    match vise(now) {
        Some(t) if t > now => Some(t),
        _ => vise(now + Duration::days(1)).filter(|t| *t > now),
    }
}

/// Ce qu'il faut déposer auprès du système, dans l'ordre chronologique.
///
/// ⚠️ Le journal grandit AU FIL des projections : une notification planifiée à
/// 20 h doit compter dans le plafond quotidien vu par la projection de 21 h,
/// sans quoi on déposerait plus de rappels que l'utilisateur n'en a autorisés.
/// C'est aussi ce qui fait jouer l'idempotence entre deux projections du même
/// jour.
pub fn plan(
    now: DateTime<Local>,
    snapshot: &Snapshot,
    prefs: &Prefs,
    log: &[LogEntry],
) -> Vec<Planned> {
    let mut journal: Vec<LogEntry> = log.to_vec();
    let mut sortie = Vec::new();

    for t in instants_a_sonder(now, prefs) {
        let ctx = EvalContext { now: t, snapshot, prefs, log: &journal };
        if let Outcome::Emit(entry) = engine::evaluate(&ctx, registry()) {
            journal.insert(0, entry.clone());
            sortie.push(Planned { at: t, entry });
            if sortie.len() >= MAX_DEPOSEES {
                break;
            }
        }
    }
    sortie
}

/// Traduit une heure LOCALE vers ce que le greffon `Schedule::At` attend.
///
/// ⚠️ Contre-intuitif, et c'est mesuré, pas déduit (`MOBILE.md` § 13.3). Le
/// Swift du greffon relit la date avec le format FIXE
/// `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'` : le `Z` y est entre apostrophes, donc un
/// CARACTÈRE, pas un indicateur de fuseau. Le formateur n'en ayant aucun,
/// il retombe sur celui du système et lit la chaîne comme une heure LOCALE.
///
/// On lui donne donc les composantes murales locales étiquetées UTC — il les
/// relira comme locales, et le tour est juste. Passer un vrai instant UTC
/// ferait tomber le rappel deux heures trop tôt en été ; passer un décalage
/// réel (`+02:00`) produirait une chaîne que ce format ne sait pas lire.
///
/// `None` sur une date que le calendrier de `time` refuse — impossible depuis
/// un `DateTime<Local>` valide, mais on ne panique pas pour autant.
pub fn date_greffon(local: DateTime<Local>) -> Option<time::OffsetDateTime> {
    let mur = local.naive_local();
    let mois = time::Month::try_from(mur.month() as u8).ok()?;
    let date = time::Date::from_calendar_date(mur.year(), mois, mur.day() as u8).ok()?;
    let heure =
        time::Time::from_hms(mur.hour() as u8, mur.minute() as u8, mur.second() as u8).ok()?;
    Some(date.with_time(heure).assume_utc())
}

/// Identifiant système d'une notification déposée.
///
/// iOS l'attend en `i32` et s'en sert pour ANNULER. On le veut donc stable
/// d'un dépôt à l'autre, sans quoi une reprogrammation laisserait des doublons
/// derrière elle : deux bannières pour un seul rappel. Dérivé de la clé
/// d'idempotence, qui porte déjà « la règle, ce jour-là ».
pub fn id_systeme(entry: &LogEntry) -> i32 {
    let cle = entry.dedupe_keys.first().map(String::as_str).unwrap_or(&entry.id);
    // FNV-1a 32 bits, écrit ici pour ne pas dépendre de `DefaultHasher`, dont
    // la valeur n'est stable ni entre versions de Rust ni entre exécutions.
    let mut h: u32 = 0x811c_9dc5;
    for b in cle.as_bytes() {
        h ^= u32::from(*b);
        h = h.wrapping_mul(0x0100_0193);
    }
    // Positif : un identifiant négatif n'a pas de sens côté système.
    (h & 0x7fff_ffff) as i32
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{Habit, QuietHours, RulePrefs};
    use crate::notifications::test_support::{at, entry};

    /// Prefs minimales : les deux règles à heure fixe, actives.
    fn prefs() -> Prefs {
        let mut p = Prefs { daily_cap: 5, ..Default::default() };
        p.quiet_hours = QuietHours { start: 0, end: 24 };
        for r in registry() {
            p.rules.insert(r.id().to_string(), r.default_prefs());
        }
        p
    }

    fn snapshot_deux_habitudes_non_cochees() -> Snapshot {
        Snapshot {
            habits: vec![
                Habit { id: 1, name: "Lire".into() },
                Habit { id: 2, name: "Sport".into() },
            ],
            habit_checks: vec![],
            tasks: vec![],
            completions: vec![],
            knowledge_last_viewed: None,
        }
    }

    #[test]
    fn l_heure_du_jour_deja_passee_vise_demain() {
        let now = at("2026-08-27 21:30:00");
        let t = prochaine_occurrence(now, 20).unwrap();
        assert_eq!(t, at("2026-08-28 20:00:00"));
    }

    #[test]
    fn l_heure_encore_a_venir_vise_aujourd_hui() {
        let now = at("2026-08-27 14:00:00");
        assert_eq!(prochaine_occurrence(now, 20).unwrap(), at("2026-08-27 20:00:00"));
    }

    /// Le cas limite : on est PILE à l'heure. Viser « aujourd'hui » déposerait
    /// une échéance à l'instant même, que le greffon iOS refuse
    /// (`pastScheduledTime`). On vise donc demain.
    #[test]
    fn pile_a_l_heure_vise_demain() {
        let now = at("2026-08-27 20:00:00");
        assert_eq!(prochaine_occurrence(now, 20).unwrap(), at("2026-08-28 20:00:00"));
    }

    /// Le cœur du module : à 14 h, la règle des habitudes ne dit RIEN — elle
    /// refuse d'émettre avant 20 h. La projection, elle, doit la faire parler.
    #[test]
    fn la_projection_fait_parler_une_regle_muette_maintenant() {
        let now = at("2026-08-27 14:00:00");
        let snap = snapshot_deux_habitudes_non_cochees();
        let prefs = prefs();

        // Contrôle : à l'instant présent, le moteur n'a rien à dire.
        let ctx = EvalContext { now, snapshot: &snap, prefs: &prefs, log: &[] };
        assert!(matches!(engine::evaluate(&ctx, registry()), Outcome::Nothing));

        // Projeté à 20 h, il a quelque chose à dire.
        let plan = plan(now, &snap, &prefs, &[]);
        assert_eq!(plan.len(), 1, "une seule échéance attendue, eue : {plan:?}");
        assert_eq!(plan[0].at, at("2026-08-27 20:00:00"));
        assert!(plan[0].entry.title.contains("habitudes"));
    }

    /// Rien à cocher : rien à déposer. Une notification fausse est pire que pas
    /// de notification — c'est celle qu'on désactive.
    #[test]
    fn rien_a_signaler_ne_depose_rien() {
        let snap = Snapshot {
            habits: vec![],
            habit_checks: vec![],
            tasks: vec![],
            completions: vec![],
            knowledge_last_viewed: None,
        };
        assert!(plan(at("2026-08-27 14:00:00"), &snap, &prefs(), &[]).is_empty());
    }

    /// Une règle déjà notifiée aujourd'hui ne doit pas être redéposée : c'est
    /// l'idempotence du moteur, et elle doit survivre à la projection.
    #[test]
    fn l_idempotence_du_journal_vaut_pour_la_projection() {
        let now = at("2026-08-27 14:00:00");
        let snap = snapshot_deux_habitudes_non_cochees();
        let journal = vec![entry(
            "2026-08-27 09:00:00",
            &["habits_pending"],
            &["habits_pending:2026-08-27"],
        )];
        let plan = plan(now, &snap, &prefs(), &journal);
        assert!(plan.is_empty(), "déjà notifié aujourd'hui, eu : {plan:?}");
    }

    /// Le plafond quotidien doit compter les échéances DÉPOSÉES, pas seulement
    /// celles déjà émises — sinon on déposerait plus que l'utilisateur n'a
    /// autorisé.
    #[test]
    fn le_plafond_quotidien_compte_les_depots() {
        let now = at("2026-08-27 14:00:00");
        let snap = snapshot_deux_habitudes_non_cochees();
        let mut p = prefs();
        p.daily_cap = 1;
        // Deux règles à des heures différentes pour avoir deux sondages.
        p.rules.insert("streak_at_risk".into(), RulePrefs::new(20, &[("hour", 21), ("min_streak", 1)]));
        assert!(plan(now, &snap, &p, &[]).len() <= 1);
    }

    /// Le contrat de sérialisation avec le greffon, épinglé. Si une mise à jour
    /// de `tauri-plugin-notification` change ce format, ce test tombe — et
    /// c'est exactement ce qu'on veut, parce que le Swift qui le relit ne sait
    /// lire QUE cette forme (`MOBILE.md` § 13.3).
    #[test]
    fn la_date_deposee_garde_l_heure_murale_locale() {
        let d = date_greffon(at("2026-08-17 21:00:00")).unwrap();
        let json = serde_json::to_string(&tauri_plugin_notification::Schedule::At {
            date: d,
            repeating: false,
            allow_while_idle: false,
        })
        .unwrap();
        assert_eq!(
            json,
            r#"{"at":{"date":"2026-08-17T21:00:00.000000000Z","repeating":false,"allowWhileIdle":false}}"#,
            "le greffon relira ces composantes comme une heure LOCALE"
        );
    }

    /// L'identifiant doit être stable : sans ça, reprogrammer laisserait des
    /// doublons — deux bannières pour un seul rappel.
    #[test]
    fn l_identifiant_systeme_est_stable_et_positif() {
        let e = entry("2026-08-27 20:00:00", &["habits_pending"], &["habits_pending:2026-08-27"]);
        let a = id_systeme(&e);
        assert_eq!(a, id_systeme(&e));
        assert!(a > 0);
        let autre =
            entry("2026-08-27 21:00:00", &["streak_at_risk"], &["streak_at_risk:2026-08-27"]);
        assert_ne!(a, id_systeme(&autre));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Le dépôt auprès du système. MOBILE UNIQUEMENT, et c'est le compilateur qui
// l'impose, pas le style : `pending`, `cancel_all` et l'effet de `schedule()`
// n'existent que dans le `mobile.rs` du greffon. Sur le bureau, `desktop.rs`
// ne les déclare pas — et n'en a pas besoin : `scheduler.rs` y tourne.
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(mobile)]
pub mod depot {
    use tauri::AppHandle;
    use tauri_plugin_notification::{NotificationExt, PermissionState, Schedule};

    use super::{date_greffon, id_systeme, Planned};

    /// L'autorisation, TELLE QUE LE SYSTÈME LA CONNAÎT.
    ///
    /// ⚠️ Contrairement à macOS, ce n'est pas un stub. L'en-tête d'`emitter.rs`
    /// explique que sur le bureau le greffon renvoie toujours `Granted` : ici la
    /// réponse est réelle, et un refus est définitif dans l'app (il faut passer
    /// par Réglages). D'où la règle du § 3.6 de `MOBILE.md` : ne JAMAIS demander
    /// au premier lancement.
    pub fn autorisation(app: &AppHandle) -> Result<PermissionState, String> {
        app.notification().permission_state().map_err(|e| e.to_string())
    }

    /// Ouvre le dialogue système. Une seule fois dans la vie de l'app : appelé
    /// depuis l'écran de préférences, au moment où l'utilisateur ACTIVE un
    /// rappel — là où la valeur est comprise.
    pub fn demander(app: &AppHandle) -> Result<PermissionState, String> {
        app.notification().request_permission().map_err(|e| e.to_string())
    }

    /// Remplace intégralement ce qui est en attente par `planned`.
    ///
    /// ⚠️ On annule TOUT avant de redéposer, et ce n'est pas de la prudence :
    /// les conditions ont pu cesser d'être vraies depuis le dernier dépôt
    /// (habitudes cochées entre-temps). Ne déposer que les nouvelles laisserait
    /// vivre des rappels devenus faux — précisément ce que le § 3.2 cherche à
    /// éviter. `id_systeme` est stable, mais l'annulation globale couvre aussi
    /// les échéances qui n'ont plus de plan du tout.
    pub fn deposer(app: &AppHandle, planned: &[Planned]) -> Result<usize, String> {
        let n = app.notification();
        n.cancel_all().map_err(|e| format!("annulation impossible : {e}"))?;

        let mut deposees = 0;
        for p in planned {
            let Some(date) = date_greffon(p.at) else {
                eprintln!("notifications : échéance illisible ({}), ignorée", p.at);
                continue;
            };
            let r = n
                .builder()
                .id(id_systeme(&p.entry))
                .title(&p.entry.title)
                .body(&p.entry.body)
                .schedule(Schedule::At { date, repeating: false, allow_while_idle: false })
                .show();
            match r {
                Ok(()) => deposees += 1,
                // On continue : une échéance refusée ne doit pas emporter les
                // autres. Le cas attendu est `pastScheduledTime`, si l'heure
                // visée est passée entre le calcul et le dépôt.
                Err(e) => eprintln!("notifications : dépôt refusé pour {} ({e})", p.at),
            }
        }
        Ok(deposees)
    }

    /// Ce que le système dit AVOIR en attente. C'est le seul contrôle honnête
    /// du dépôt : `show()` peut réussir sans que l'échéance soit retenue.
    pub fn en_attente(app: &AppHandle) -> Result<Vec<i32>, String> {
        app.notification()
            .pending()
            .map(|v| v.into_iter().map(|n| n.id()).collect())
            .map_err(|e| e.to_string())
    }
}
