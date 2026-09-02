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
pub fn instants_a_sonder(
    now: DateTime<Local>,
    snapshot: &Snapshot,
    prefs: &Prefs,
) -> Vec<DateTime<Local>> {
    let actives = || {
        registry()
            .iter()
            .filter_map(|r| prefs.rules.get(r.id()))
            .filter(|p| p.enabled)
    };

    let mut heures: Vec<u32> = actives()
        .filter(|p| p.params.contains_key(CLE_HEURE))
        .map(|p| p.param_hour(CLE_HEURE, 20))
        .collect();

    // ⚠️ Les règles SANS heure — `inactivity` — seraient invisibles au
    // téléphone si on s'arrêtait là : aucun instant à sonder, donc jamais
    // déposées, donc muettes app fermée. On les projette à la PREMIÈRE heure
    // que la plage silencieuse autorise.
    //
    // Ce n'est pas un choix arbitraire, c'est la modélisation fidèle du
    // bureau : là-bas, `scheduler.rs` scrute toutes les minutes et le moteur
    // refuse d'émettre hors plage, donc une règle sans heure part de fait au
    // premier tick suivant `quiet_hours.start`. On demande exactement la même
    // chose. Aucune règle n'est modifiée, et le bureau n'est pas touché.
    if actives().any(|p| !p.params.contains_key(CLE_HEURE)) {
        heures.push(prefs.quiet_hours.start);
    }

    heures.sort_unstable();
    heures.dedup();

    let mut instants: Vec<DateTime<Local>> = heures
        .into_iter()
        .filter_map(|h| prochaine_occurrence(now, h))
        .collect();

    instants.extend(instants_du_calendrier(now, snapshot, prefs));

    // ⚠️ TRI CHRONOLOGIQUE, et il n'est pas décoratif. `plan()` s'arrête à
    // `MAX_DEPOSEES` : sans tri, un rendez-vous de la semaine prochaine pourrait
    // consommer une place avant le rappel d'habitudes de ce soir. Trié, le
    // plafond garde toujours les huit échéances les plus PROCHES, qui sont
    // aussi les seules dont l'état projeté a des chances d'être encore vrai.
    instants.sort_unstable();
    instants.dedup();
    instants
}

/// ⭐ Les instants où un élément du calendrier devient IMMINENT.
///
/// LE PROBLÈME QUE ÇA RÉSOUT, et il était écrit noir sur blanc dans la
/// passation du chantier B : la règle `calendar_soon` n'a pas de paramètre
/// `hour` — un rendez-vous peut tomber à n'importe quelle heure. Elle était donc
/// rangée parmi les règles « sans heure » et n'était sondée qu'à l'ouverture de
/// la plage autorisée. Sur le bureau, sans conséquence : le planificateur scrute
/// chaque minute. **Sur iOS, app fermée, seule l'échéance déposée à l'avance
/// existe** — le rappel « dans une heure » n'était donc jamais ponctuel.
///
/// La parade suit exactement le § 13.5 de `MOBILE.md` : on ne réécrit aucune
/// règle, on lui donne les bons INSTANTS à sonder. Évaluée à `début − avant`,
/// `calendar_soon` voit le rendez-vous imminent et rend son candidat, qui est
/// déposé pour cet instant précis.
///
/// ⚠️ On ne sonde QUE le futur : une date passée fait échouer le dépôt côté
/// greffon (`pastScheduledTime`, § 13.2).
fn instants_du_calendrier(
    now: DateTime<Local>,
    snapshot: &Snapshot,
    prefs: &Prefs,
) -> Vec<DateTime<Local>> {
    let Some(regle) = prefs.rules.get(super::rules::calendar::ID) else {
        return Vec::new();
    };
    if !regle.enabled {
        return Vec::new();
    }
    let avant = regle.param_i64("avant_min", 60).clamp(5, 24 * 60);

    let mut instants = Vec::new();
    for item in &snapshot.calendar {
        let Some(debut) = item.debut_local() else { continue };
        let cible = debut - Duration::minutes(avant);
        if cible > now {
            instants.push(cible);
        }
    }
    instants
}

/// Aujourd'hui à `heure`:`minute`, ou demain si c'est déjà passé.
///
/// `None` si l'heure locale n'existe pas — le saut d'heure d'été fait
/// disparaître 2 h à 3 h une nuit par an. Sauter le sondage vaut mieux que
/// déposer une date que le système refusera.
fn prochaine_occurrence_a(
    now: DateTime<Local>,
    heure: u32,
    minute: u32,
) -> Option<DateTime<Local>> {
    let vise = |jour: DateTime<Local>| {
        jour.with_hour(heure)
            .and_then(|d| d.with_minute(minute))
            .and_then(|d| d.with_second(0))
            .and_then(|d| d.with_nanosecond(0))
    };
    match vise(now) {
        Some(t) if t > now => Some(t),
        _ => vise(now + Duration::days(1)).filter(|t| *t > now),
    }
}

/// Variante à l'heure pile — le cas des règles, dont le seuil est un entier.
fn prochaine_occurrence(now: DateTime<Local>, heure: u32) -> Option<DateTime<Local>> {
    prochaine_occurrence_a(now, heure, 0)
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

    for t in instants_a_sonder(now, snapshot, prefs) {
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
    id_depuis_cle(cle)
}

/// FNV-1a 32 bits, écrit ici pour ne pas dépendre de `DefaultHasher`, dont la
/// valeur n'est stable ni entre versions de Rust ni entre exécutions — or cet
/// identifiant DOIT survivre à une mise à jour de l'app, sans quoi une
/// échéance déposée hier deviendrait inannulable aujourd'hui.
fn id_depuis_cle(cle: &str) -> i32 {
    let mut h: u32 = 0x811c_9dc5;
    for b in cle.as_bytes() {
        h ^= u32::from(*b);
        h = h.wrapping_mul(0x0100_0193);
    }
    // Positif : un identifiant négatif n'a pas de sens côté système.
    (h & 0x7fff_ffff) as i32
}

// ─── LE BRIEFING DE MARCHÉ ───────────────────────────────────────────────────

/// Étiquette portée par les échéances du briefing dans le rapport de plan.
/// Ce n'est PAS un identifiant de règle : `registry()` ne la connaît pas.
pub const BRIEFING_RULE: &str = "market_briefing";

/// Un créneau de briefing, tel que le FRONT le calcule.
///
/// ⚠️ Les heures viennent du front, et ce n'est pas de la paresse. Market
/// Brain raisonne en **heure de Paris** (`TRIGGER_HOUR` : 8 h pré-Londres,
/// 14 h pré-New York), alors que `Schedule::Interval` est un rendez-vous
/// exprimé dans le calendrier de l'APPAREIL. Traduire l'une en l'autre demande
/// la base de fuseaux nommés, que le front a gratuitement (`Intl`) et que le
/// Rust n'a pas sans nouvelle dépendance. Le front y ajoute la langue et
/// l'offre du compte, deux choses qu'il est également seul à connaître.
///
/// `key` est l'identité STABLE du créneau (`market_briefing:pre_london`) : elle
/// dérive l'identifiant système, donc redéposer remplace au lieu de doubler.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct BriefingSlot {
    pub key: String,
    pub hour: u32,
    pub minute: u32,
    pub title: String,
    pub body: String,
}

impl BriefingSlot {
    /// Créneau exploitable ? Une heure hors bornes viendrait d'un calcul de
    /// fuseau parti de travers ; on préfère l'ignorer que déposer n'importe
    /// quoi dans le système de l'utilisateur.
    fn valide(&self) -> bool {
        self.hour < 24 && self.minute < 60 && !self.key.is_empty()
    }

    /// Identifiant système, dérivé de `key` — donc STABLE d'un dépôt à l'autre.
    ///
    /// `allow(dead_code)` sur le bureau et nulle part ailleurs : seul le dépôt
    /// mobile s'en sert, et le dépôt mobile est sous `cfg`. Le silence est
    /// donc borné à la plateforme où la méthode n'a effectivement rien à faire.
    #[cfg_attr(not(mobile), allow(dead_code))]
    fn id(&self) -> i32 {
        id_depuis_cle(&self.key)
    }
}

/// Les créneaux retenus, avec la PROCHAINE occurrence de chacun.
///
/// L'instant rendu ne sert qu'à l'affichage (« demain à 8 h ») : le dépôt, lui,
/// est un rendez-vous récurrent qui n'a pas de date. Les rendre ensemble évite
/// à l'écran de recalculer une heure que ce module vient de valider.
pub fn briefing_a_deposer(
    now: DateTime<Local>,
    prefs: &Prefs,
    slots: &[BriefingSlot],
) -> Vec<(BriefingSlot, DateTime<Local>)> {
    if !prefs.enabled || !prefs.market_briefing {
        return Vec::new();
    }
    slots
        .iter()
        .filter(|s| s.valide())
        .filter_map(|s| {
            prochaine_occurrence_a(now, s.hour, s.minute).map(|t| (s.clone(), t))
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::model::{CalendarItem, Habit, QuietHours, RulePrefs};
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
            calendar: vec![],
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
            calendar: vec![],
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

    /// Une règle sans heure — `inactivity` — doit quand même être projetée,
    /// sinon elle serait purement absente du téléphone.
    #[test]
    fn une_regle_sans_heure_est_sondee_a_l_ouverture_de_la_plage() {
        let mut p = prefs();
        p.quiet_hours = QuietHours { start: 8, end: 22 };
        let instants = instants_a_sonder(at("2026-08-27 06:00:00"), &Snapshot::default(), &p);
        assert!(
            instants.contains(&at("2026-08-27 08:00:00")),
            "8 h — première heure autorisée — attendue, eu : {instants:?}"
        );
    }

    /// Et si plus aucune règle sans heure n'est active, on ne sonde pas cette
    /// heure-là pour rien.
    #[test]
    fn sans_regle_sans_heure_l_ouverture_de_plage_n_est_pas_sondee() {
        let mut p = prefs();
        p.quiet_hours = QuietHours { start: 8, end: 22 };
        // ⚠️ On désactive TOUTES les règles sans heure, par leurs paramètres et
        // non par leur nom. La version d'avant ne nommait qu'`inactivity` : elle
        // a cessé de dire la vérité le jour où une deuxième règle sans heure est
        // arrivée (`calendar_soon`, 2026-09-02), et le test a échoué sur un
        // comportement pourtant correct. Un test qui énumère à la main ce que le
        // registre contient se périme au prochain ajout.
        let sans_heure: Vec<String> = p
            .rules
            .iter()
            .filter(|(_, r)| !r.params.contains_key(CLE_HEURE))
            .map(|(id, _)| id.clone())
            .collect();
        for id in sans_heure {
            if let Some(r) = p.rules.get_mut(&id) {
                r.enabled = false;
            }
        }
        let instants = instants_a_sonder(at("2026-08-27 06:00:00"), &Snapshot::default(), &p);
        assert!(!instants.contains(&at("2026-08-27 08:00:00")), "eu : {instants:?}");
    }

    // ─── Le calendrier rend le rappel PONCTUEL sur iOS ──────────────────────

    fn snapshot_avec_rdv(date: &str, heure: &str) -> Snapshot {
        Snapshot {
            calendar: vec![CalendarItem {
                title: "Dentiste".into(),
                date: date.into(),
                start_at: Some(heure.into()),
                kind: "event",
            }],
            ..Default::default()
        }
    }

    /// ⭐ LE TEST DU CHANTIER iOS.
    ///
    /// Sans ces instants, `calendar_soon` n'était sondée qu'à l'ouverture de la
    /// plage autorisée : sur le bureau le scheduler rattrapait, mais **sur iOS,
    /// app fermée, le rappel « dans une heure » n'était jamais ponctuel**.
    #[test]
    fn un_rendez_vous_fait_sonder_l_instant_ou_il_devient_imminent() {
        let p = prefs();
        let snap = snapshot_avec_rdv("2026-08-27", "14:00");
        let instants = instants_a_sonder(at("2026-08-27 09:00:00"), &snap, &p);
        // 60 minutes avant, par défaut.
        assert!(
            instants.contains(&at("2026-08-27 13:00:00")),
            "13 h attendue, eu : {instants:?}"
        );
    }

    #[test]
    fn le_delai_de_prevenance_est_reglable() {
        let mut p = prefs();
        if let Some(r) = p.rules.get_mut(super::super::rules::calendar::ID) {
            r.params.insert("avant_min".into(), serde_json::json!(15));
        }
        let snap = snapshot_avec_rdv("2026-08-27", "14:00");
        let instants = instants_a_sonder(at("2026-08-27 09:00:00"), &snap, &p);
        assert!(instants.contains(&at("2026-08-27 13:45:00")), "eu : {instants:?}");
    }

    #[test]
    fn ne_sonde_jamais_un_instant_deja_passe() {
        // Une date passée fait ÉCHOUER le dépôt côté greffon
        // (`pastScheduledTime`, MOBILE.md § 13.2) : ce n'est pas une élégance.
        let p = prefs();
        let snap = snapshot_avec_rdv("2026-08-27", "14:00");
        let instants = instants_a_sonder(at("2026-08-27 13:30:00"), &snap, &p);
        assert!(!instants.contains(&at("2026-08-27 13:00:00")), "eu : {instants:?}");
    }

    #[test]
    fn un_element_sans_heure_ne_fait_rien_sonder() {
        // Une échéance d'objectif pèse sur la journée, pas sur une minute.
        let p = prefs();
        let snap = Snapshot {
            calendar: vec![CalendarItem {
                title: "Rendre le dossier".into(),
                date: "2026-08-28".into(),
                start_at: None,
                kind: "deadline",
            }],
            ..Default::default()
        };
        let avec = instants_a_sonder(at("2026-08-27 09:00:00"), &snap, &p);
        let sans = instants_a_sonder(at("2026-08-27 09:00:00"), &Snapshot::default(), &p);
        assert_eq!(avec, sans);
    }

    #[test]
    fn la_regle_desactivee_ne_fait_rien_sonder() {
        let mut p = prefs();
        if let Some(r) = p.rules.get_mut(super::super::rules::calendar::ID) {
            r.enabled = false;
        }
        let snap = snapshot_avec_rdv("2026-08-27", "14:00");
        let instants = instants_a_sonder(at("2026-08-27 09:00:00"), &snap, &p);
        assert!(!instants.contains(&at("2026-08-27 13:00:00")), "eu : {instants:?}");
    }

    #[test]
    fn les_instants_sont_rendus_dans_l_ordre_chronologique() {
        // `plan()` s'arrête à MAX_DEPOSEES : sans tri, un rendez-vous lointain
        // consommerait une place avant le rappel d'habitudes de ce soir.
        let p = prefs();
        let snap = Snapshot {
            calendar: vec![
                CalendarItem { title: "Tard".into(), date: "2026-08-28".into(), start_at: Some("18:00".into()), kind: "event" },
                CalendarItem { title: "Tôt".into(), date: "2026-08-27".into(), start_at: Some("11:00".into()), kind: "event" },
            ],
            ..Default::default()
        };
        let instants = instants_a_sonder(at("2026-08-27 09:00:00"), &snap, &p);
        let mut trie = instants.clone();
        trie.sort_unstable();
        assert_eq!(instants, trie);
    }

    #[test]
    fn le_rappel_depose_tombe_bien_a_l_heure_voulue() {
        // De bout en bout : le plan contient une échéance À 13 h pour un
        // rendez-vous de 14 h. C'est ce que le système recevra.
        let p = prefs();
        let snap = snapshot_avec_rdv("2026-08-27", "14:00");
        let plans = plan(at("2026-08-27 09:00:00"), &snap, &p, &[]);
        let rdv = plans.iter().find(|x| x.entry.rules.iter().any(|r| r == "calendar_soon"));
        let rdv = rdv.expect("un rappel de calendrier était attendu");
        assert_eq!(rdv.at, at("2026-08-27 13:00:00"));
        assert!(rdv.entry.body.contains("Dentiste"), "eu : {}", rdv.entry.body);
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

    // ── Le briefing de marché ────────────────────────────────────────────────

    fn creneaux() -> Vec<BriefingSlot> {
        vec![
            BriefingSlot {
                key: "market_briefing:pre_london".into(),
                hour: 8,
                minute: 0,
                title: "Briefing pré-Londres".into(),
                body: "b".into(),
            },
            BriefingSlot {
                key: "market_briefing:pre_ny".into(),
                hour: 14,
                minute: 0,
                title: "Briefing pré-New York".into(),
                body: "b".into(),
            },
        ]
    }

    /// À 10 h : celui de 8 h est passé (donc demain), celui de 14 h est à venir
    /// (donc aujourd'hui). L'instant ne sert qu'à l'affichage, mais s'il ment,
    /// l'écran de diagnostic ment avec lui.
    #[test]
    fn le_briefing_vise_la_prochaine_occurrence_de_chaque_creneau() {
        let p = prefs();
        let v = briefing_a_deposer(at("2026-08-27 10:00:00"), &p, &creneaux());
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].1, at("2026-08-28 08:00:00"));
        assert_eq!(v[1].1, at("2026-08-27 14:00:00"));
    }

    /// L'interrupteur propre au briefing, et l'interrupteur général : les deux
    /// doivent le taire. Le second est celui qu'on oublie — « coupe tout » doit
    /// vouloir dire tout, y compris ce qui ne passe pas par le moteur.
    #[test]
    fn les_deux_interrupteurs_taisent_le_briefing() {
        let now = at("2026-08-27 10:00:00");

        let mut p = prefs();
        p.market_briefing = false;
        assert!(briefing_a_deposer(now, &p, &creneaux()).is_empty());

        let mut p = prefs();
        p.enabled = false;
        assert!(briefing_a_deposer(now, &p, &creneaux()).is_empty());
    }

    /// Les heures viennent d'un calcul de fuseau côté front. S'il part de
    /// travers, on préfère ignorer le créneau que déposer n'importe quoi dans
    /// le système de l'utilisateur — un rappel à 25 h ne se supprime pas d'un
    /// geste, il faut désinstaller l'app.
    #[test]
    fn un_creneau_hors_bornes_est_ignore_sans_emporter_les_autres() {
        let mut c = creneaux();
        c[0].hour = 25;
        c.push(BriefingSlot { key: String::new(), hour: 9, minute: 0, title: "x".into(), body: "b".into() });
        let v = briefing_a_deposer(at("2026-08-27 10:00:00"), &prefs(), &c);
        assert_eq!(v.len(), 1);
        assert_eq!(v[0].0.key, "market_briefing:pre_ny");
    }

    /// L'identifiant système DOIT être stable d'un dépôt à l'autre : c'est lui
    /// qui fait qu'un redépôt REMPLACE l'échéance au lieu d'en ajouter une
    /// seconde. Et les deux créneaux doivent se distinguer, sans quoi celui de
    /// 14 h écraserait celui de 8 h.
    #[test]
    fn les_deux_creneaux_ont_des_identifiants_stables_et_distincts() {
        let c = creneaux();
        assert_eq!(c[0].id(), c[0].id());
        assert_ne!(c[0].id(), c[1].id());
        assert!(c[0].id() > 0 && c[1].id() > 0);
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
    use tauri_plugin_notification::{
        NotificationExt, PermissionState, Schedule, ScheduleInterval,
    };

    use super::{date_greffon, id_systeme, BriefingSlot, Planned};

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
    pub fn deposer(app: &AppHandle, planned: &[Planned], precedents: &[i32]) -> Vec<i32> {
        let n = app.notification();
        purger(app, precedents);

        let mut deposees = Vec::new();
        for p in planned {
            let Some(date) = date_greffon(p.at) else {
                eprintln!("notifications : échéance illisible ({}), ignorée", p.at);
                continue;
            };
            let id = id_systeme(&p.entry);
            let r = n
                .builder()
                .id(id)
                .title(&p.entry.title)
                .body(&p.entry.body)
                .schedule(Schedule::At { date, repeating: false, allow_while_idle: false })
                .show();
            match r {
                Ok(()) => deposees.push(id),
                // On continue : une échéance refusée ne doit pas emporter les
                // autres. Le cas attendu est `pastScheduledTime`, si l'heure
                // visée est passée entre le calcul et le dépôt.
                Err(e) => eprintln!("notifications : dépôt refusé pour {} ({e})", p.at),
            }
        }
        deposees
    }

    /// Dépose les créneaux du briefing de marché, et rend leurs identifiants.
    ///
    /// ⚠️ **Le seul endroit de Shale qui utilise `Schedule::Interval`**, et
    /// c'est mesuré, pas choisi par goût (`MOBILE.md` § 13.2/13.4) :
    ///
    ///   - `At` est traduit par le greffon en `UNTimeIntervalNotificationTrigger`
    ///     de durée « cible − maintenant ». Avec `repeating: true`, il ne répète
    ///     donc PAS « tous les jours à la même heure » mais « toutes les N
    ///     secondes ». Il ne convient qu'aux échéances ponctuelles ;
    ///   - `Interval` est le seul traduit en `UNCalendarNotificationTrigger`
    ///     (`dateMatching:, repeats: true`), c'est-à-dire le vrai rendez-vous
    ///     quotidien, évalué dans `Calendar.current` — donc à l'heure locale.
    ///
    /// Deux conséquences heureuses : le piège de fuseau du § 13.3 ne s'applique
    /// pas ici (aucune date n'est sérialisée, seulement des composantes), et le
    /// rappel continue de tomber même si l'app n'est pas rouverte de la semaine
    /// — ce qu'une échéance ponctuelle reprogrammée à chaque passage en
    /// arrière-plan ne sait pas faire.
    ///
    /// ⚠️ Ce que ça NE fait pas : générer le briefing. Il est rédigé à
    /// l'ouverture de l'app. La bannière annonce donc un briefing qui n'existe
    /// pas encore — c'est le compromis explicitement accepté (§ 10, décision 3),
    /// et c'est pourquoi son texte ne doit jamais dire qu'il est prêt.
    pub fn deposer_briefing(app: &AppHandle, slots: &[BriefingSlot]) -> Vec<i32> {
        let n = app.notification();
        let mut deposees = Vec::new();
        for slot in slots {
            let id = slot.id();
            let r = n
                .builder()
                .id(id)
                .title(&slot.title)
                .body(&slot.body)
                .schedule(Schedule::Interval {
                    interval: ScheduleInterval {
                        hour: Some(slot.hour as u8),
                        minute: Some(slot.minute as u8),
                        ..Default::default()
                    },
                    allow_while_idle: false,
                })
                .show();
            match r {
                Ok(()) => deposees.push(id),
                Err(e) => eprintln!("notifications : briefing {} refusé ({e})", slot.key),
            }
        }
        deposees
    }

    /// Retire les échéances déposées au tour précédent.
    ///
    /// ⚠️ On passe les identifiants EN ARGUMENT au lieu de les demander au
    /// système, et ce n'est pas un choix de style : dans le greffon 2.3.3, les
    /// deux façons de les obtenir sont cassées sur iOS. Le détail est écrit une
    /// fois pour toutes sur `EngineState::scheduled_ids` — c'est là qu'il faut
    /// aller relire pourquoi, avant de « simplifier » ce code en rappelant
    /// `cancel_all()`.
    ///
    /// ⚠️ **N'échoue jamais**, délibérément. Un dépôt vaut mieux qu'un dépôt
    /// manqué : `id_systeme` étant stable, redéposer REMPLACE l'échéance de même
    /// identifiant côté iOS. Ce qu'une purge ratée laisse derrière elle, c'est
    /// une échéance qui n'a plus de plan du tout — le cas rare, contre lequel on
    /// ne va pas sacrifier tous les autres rappels.
    fn purger(app: &AppHandle, ids: &[i32]) {
        if ids.is_empty() {
            return;
        }
        if let Err(e) = app.notification().cancel(ids.to_vec()) {
            eprintln!("notifications : purge impossible ({e})");
        }
    }
}
