//! La séance du minuteur dans la BARRE DES MENUS (bureau seulement).
//!
//! Demande d'Antonin, 2026-10-12 : « la barre style Apple […] quand une tâche
//! tourne avec du focus c'est sympa, mais est-ce qu'on peut l'intégrer au vrai
//! truc Apple ? ». Sur un Mac, le « vrai truc » est la barre des menus : l'app y
//! a déjà son icône (`lib.rs`, `TrayIconBuilder`). Pendant une séance, on écrit
//! le temps restant à côté d'elle (« 24:31 », ou « 24:31 · pause »), et son
//! menu gagne « Pause » / « Reprendre » et « Terminer la session ». Hors
//! séance : rien, ni titre ni entrée.
//!
//! ⭐ AUCUN NOUVEL APPEL DU FRONT, AUCUNE NOUVELLE PERMISSION. La fenêtre
//! principale diffuse déjà l'état de la séance pour la fenêtre séparée du Timer
//! (`shale:timer-etat`, `src/lib/timerFenetre.ts`), et elle exécute déjà les
//! commandes qu'on lui renvoie (`shale:timer-commande`). La barre des menus est
//! une télécommande de plus sur ce canal : ce module ÉCOUTE l'un et ÉMET
//! l'autre. Les gestes sont donc ceux de l'app (`pause`, `resume`, `stop` de
//! `useFocus`) — règle 18 — et la séance n'a toujours qu'une source de vérité.
//!
//! ⭐ POURQUOI LE COMPTE EST TENU ICI, PAS DANS LA PAGE. Ce qui voyage est
//! l'INSTANT DE FIN, pas « il reste N secondes ». Une page dont la fenêtre est
//! cachée ou recouverte voit ses minuteurs ralentis par WebKit : un titre
//! réécrit depuis le JavaScript avancerait par à-coups, précisément quand on
//! regarde la barre des menus — c'est-à-dire quand Shale n'est pas devant. Un
//! fil Rust se réveille juste après chaque changement de chiffre et s'arrête
//! avec la séance.
//!
//! ⚠️ PORTAGE : `restant_sec` et `delai_avant_prochaine_seconde` recopient
//! `restantDepuisEtat` et `delaiAvantProchaineSeconde` de
//! `src/lib/timerFenetre.ts` (même arrondi, même marge). À tenir d'accord :
//! sinon la barre des menus et la pastille n'affichent pas le même chiffre.
//!
//! ⚠️ Tout ce qui touche le tray ou le menu passe par le FIL PRINCIPAL, dans
//! une tâche qui relit le numéro de génération : un battement parti avant la
//! fin de la séance ne peut pas réécrire « 00:03 » après qu'elle est finie.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Emitter, Listener, Manager, Wry};

/// L'identifiant de l'icône de la barre des menus (`TrayIconBuilder::with_id`).
pub const TRAY_ID: &str = "shale";

/// Les deux événements du canal du Timer — les mêmes chaînes que dans
/// `src/lib/timerFenetre.ts` (`EVT_ETAT`, `EVT_COMMANDE`).
const EVT_ETAT: &str = "shale:timer-etat";
const EVT_COMMANDE: &str = "shale:timer-commande";

const ID_PAUSE: &str = "seance-pause";
const ID_TERMINER: &str = "seance-terminer";

/// Ce que la barre des menus a besoin de savoir de la séance.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Seance {
    Aucune,
    /// Le décompte tourne : l'instant de fin, en millisecondes depuis l'époque.
    EnCours { fin_ms: i64 },
    /// En pause : le reste figé, en secondes.
    EnPause { restant_sec: i64 },
}

/// Lit l'état diffusé par la fenêtre principale (`EtatTimerPartage`) :
/// `{"session": {...} | null, "finMs": n | null, "restantFigeSec": n | null}`.
///
/// Tout ce qui ne se lit pas vaut « aucune séance » : un titre faux dans la
/// barre des menus serait pire qu'un titre absent.
pub fn lire_etat(json: &str) -> Seance {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(json) else {
        return Seance::Aucune;
    };
    if !v.get("session").is_some_and(|s| s.is_object()) {
        return Seance::Aucune;
    }
    let nombre = |cle: &str| v.get(cle).and_then(|n| n.as_f64()).filter(|n| n.is_finite());
    if let Some(fige) = nombre("restantFigeSec") {
        return Seance::EnPause { restant_sec: (fige.round() as i64).max(0) };
    }
    match nombre("finMs") {
        Some(fin) => Seance::EnCours { fin_ms: fin.round() as i64 },
        None => Seance::Aucune,
    }
}

/// Les secondes restantes — même arrondi que `useFocus` (au plus proche,
/// plancher à 0).
pub fn restant_sec(seance: Seance, maintenant_ms: i64) -> Option<i64> {
    match seance {
        Seance::Aucune => None,
        Seance::EnPause { restant_sec } => Some(restant_sec.max(0)),
        Seance::EnCours { fin_ms } => {
            let reste = fin_ms - maintenant_ms;
            // `Math.round` : la demi-seconde monte.
            Some(((reste + 500).div_euclid(1000)).max(0))
        }
    }
}

/// « 24:31 », comme la pastille (les minutes peuvent dépasser 59).
fn mm_ss(sec: i64) -> String {
    format!("{:02}:{:02}", sec / 60, sec % 60)
}

/// Ce qu'on écrit à côté de l'icône. `None` : aucun titre.
///
/// ⚠️ « pause » s'écrit pareil en français et en anglais, et sans emoji : le
/// menu du tray n'est pas traduit, ce mot-là n'a pas besoin de l'être.
pub fn titre(seance: Seance, maintenant_ms: i64) -> Option<String> {
    let reste = restant_sec(seance, maintenant_ms)?;
    Some(match seance {
        Seance::EnPause { .. } => format!("{} · pause", mm_ss(reste)),
        _ => mm_ss(reste),
    })
}

/// Millisecondes jusqu'au prochain changement du chiffre, plus une marge : on
/// se réveille juste APRÈS la frontière, jamais juste avant.
pub fn delai_avant_prochaine_seconde(fin_ms: i64, maintenant_ms: i64) -> u64 {
    let reste = fin_ms - maintenant_ms;
    ((reste - 500).rem_euclid(1000) + 12) as u64
}

/// La commande que « Pause » / « Reprendre » renvoie à l'app.
pub fn commande_pause(seance: Seance) -> Option<&'static str> {
    match seance {
        Seance::Aucune => None,
        Seance::EnCours { .. } => Some("pause"),
        Seance::EnPause { .. } => Some("reprendre"),
    }
}

/// Le libellé de la première entrée. En français, comme le reste de ce menu
/// (« Ouvrir Shale », « Quitter »), qui n'est pas traduit.
pub fn libelle_pause(seance: Seance) -> &'static str {
    match seance {
        Seance::EnPause { .. } => "Reprendre",
        _ => "Pause",
    }
}

fn maintenant_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// L'état gardé par l'app (`app.manage`).
pub struct BarreSeance {
    seance: Mutex<Seance>,
    /// Monte à chaque changement d'état : un battement d'une séance passée se
    /// reconnaît à son numéro, et se tait.
    generation: AtomicU64,
    /// Le dernier titre écrit — on ne réécrit pas le même.
    dernier_titre: Mutex<Option<String>>,
    menu: Menu<Wry>,
    pause: MenuItem<Wry>,
    terminer: MenuItem<Wry>,
    filet: PredefinedMenuItem<Wry>,
    /// Les entrées de séance sont-elles dans le menu ?
    entrees_montrees: Mutex<bool>,
}

/// À appeler une fois, après la construction du tray : crée les entrées de
/// séance (hors du menu pour l'instant) et écoute l'état diffusé par l'app.
pub fn installer(app: &AppHandle, menu: &Menu<Wry>) -> tauri::Result<()> {
    let pause = MenuItem::with_id(app, ID_PAUSE, "Pause", true, None::<&str>)?;
    let terminer = MenuItem::with_id(app, ID_TERMINER, "Terminer la session", true, None::<&str>)?;
    let filet = PredefinedMenuItem::separator(app)?;
    app.manage(BarreSeance {
        seance: Mutex::new(Seance::Aucune),
        generation: AtomicU64::new(0),
        dernier_titre: Mutex::new(None),
        menu: menu.clone(),
        pause,
        terminer,
        filet,
        entrees_montrees: Mutex::new(false),
    });

    let poignee = app.clone();
    // `listen_any` : l'état est émis par la page (`emit`), vers toutes les cibles.
    app.listen_any(EVT_ETAT, move |evenement| {
        recevoir(&poignee, lire_etat(evenement.payload()));
    });
    Ok(())
}

/// Un clic dans le menu du tray. Rend `true` si l'entrée était l'une des nôtres.
pub fn sur_menu(app: &AppHandle, id: &str) -> bool {
    let commande = match id {
        ID_PAUSE => {
            let Some(barre) = app.try_state::<BarreSeance>() else {
                return true;
            };
            let seance = *barre.seance.lock().unwrap_or_else(|e| e.into_inner());
            commande_pause(seance)
        }
        ID_TERMINER => Some("terminer"),
        _ => return false,
    };
    if let Some(commande) = commande {
        // La fenêtre principale l'exécute (`usePontFenetreTimer`), avec les
        // fonctions du minuteur de l'app.
        let _ = app.emit(EVT_COMMANDE, commande);
    }
    true
}

fn recevoir(app: &AppHandle, seance: Seance) {
    let Some(barre) = app.try_state::<BarreSeance>() else {
        return;
    };
    {
        let mut courante = barre.seance.lock().unwrap_or_else(|e| e.into_inner());
        if *courante == seance {
            return;
        }
        *courante = seance;
    }
    let generation = barre.generation.fetch_add(1, Ordering::SeqCst) + 1;

    // Sans attendre : cet écouteur ne doit pas rester bloqué sur le fil principal.
    let poignee = app.clone();
    let _ = app.run_on_main_thread(move || {
        appliquer_menu(&poignee, seance);
        ecrire_titre(&poignee, seance, generation);
    });

    if let Seance::EnCours { fin_ms } = seance {
        let poignee = app.clone();
        std::thread::spawn(move || battre(poignee, fin_ms, generation));
    }
}

/// Le battement d'UNE séance en cours : un réveil par seconde, calé sur le
/// changement du chiffre. S'arrête dès que l'état a changé (pause, fin, autre
/// séance) ou une fois le zéro affiché.
fn battre(app: AppHandle, fin_ms: i64, generation: u64) {
    loop {
        let maintenant = maintenant_ms();
        if maintenant > fin_ms {
            // « 00:00 » est écrit ; c'est l'app qui annoncera la fin.
            return;
        }
        std::thread::sleep(Duration::from_millis(delai_avant_prochaine_seconde(fin_ms, maintenant)));
        let Some(barre) = app.try_state::<BarreSeance>() else {
            return;
        };
        if barre.generation.load(Ordering::SeqCst) != generation {
            return;
        }
        let poignee = app.clone();
        let _ = app.run_on_main_thread(move || {
            ecrire_titre(&poignee, Seance::EnCours { fin_ms }, generation);
        });
    }
}

/// ⚠️ Fil principal seulement. Écrit le titre s'il a changé — et seulement si
/// cette séance est toujours celle en cours.
fn ecrire_titre(app: &AppHandle, seance: Seance, generation: u64) {
    let Some(barre) = app.try_state::<BarreSeance>() else {
        return;
    };
    if barre.generation.load(Ordering::SeqCst) != generation {
        return;
    }
    let nouveau = titre(seance, maintenant_ms());
    {
        let mut dernier = barre.dernier_titre.lock().unwrap_or_else(|e| e.into_inner());
        if *dernier == nouveau {
            return;
        }
        *dernier = nouveau.clone();
    }
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_title(nouveau.as_deref());
    }
}

/// ⚠️ Fil principal seulement. Les entrées de séance entrent en tête du menu
/// quand une séance existe, et en sortent avec elle.
fn appliquer_menu(app: &AppHandle, seance: Seance) {
    let Some(barre) = app.try_state::<BarreSeance>() else {
        return;
    };
    let mut montrees = barre.entrees_montrees.lock().unwrap_or_else(|e| e.into_inner());
    if seance == Seance::Aucune {
        if *montrees {
            let _ = barre.menu.remove(&barre.pause);
            let _ = barre.menu.remove(&barre.terminer);
            let _ = barre.menu.remove(&barre.filet);
            *montrees = false;
        }
        return;
    }
    let _ = barre.pause.set_text(libelle_pause(seance));
    if !*montrees {
        *montrees = barre
            .menu
            .prepend_items(&[&barre.pause, &barre.terminer, &barre.filet])
            .is_ok();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIN: i64 = 1_800_000_000_000;

    #[test]
    fn l_etat_diffuse_par_l_app_se_lit() {
        let en_cours = format!(
            r#"{{"session":{{"label":"Écrire","kind":"focus","plannedMin":25}},"finMs":{FIN},"restantFigeSec":null}}"#
        );
        assert_eq!(lire_etat(&en_cours), Seance::EnCours { fin_ms: FIN });
        let en_pause = r#"{"session":{"label":"Écrire","kind":"focus","plannedMin":25},"finMs":null,"restantFigeSec":731}"#;
        assert_eq!(lire_etat(en_pause), Seance::EnPause { restant_sec: 731 });
        let aucune = r#"{"session":null,"finMs":null,"restantFigeSec":null}"#;
        assert_eq!(lire_etat(aucune), Seance::Aucune);
    }

    #[test]
    fn ce_qui_ne_se_lit_pas_vaut_aucune_seance() {
        assert_eq!(lire_etat(""), Seance::Aucune);
        assert_eq!(lire_etat("\"pause\""), Seance::Aucune);
        assert_eq!(lire_etat(r#"{"finMs":12}"#), Seance::Aucune);
        // Une séance sans instant de fin ni reste figé : on n'invente pas un compte.
        assert_eq!(lire_etat(r#"{"session":{"label":"x"},"finMs":null,"restantFigeSec":null}"#), Seance::Aucune);
    }

    #[test]
    fn le_titre_d_une_seance_qui_tourne_est_le_temps_restant() {
        let seance = Seance::EnCours { fin_ms: FIN };
        assert_eq!(titre(seance, FIN - 1_471_000).as_deref(), Some("24:31"));
        assert_eq!(titre(seance, FIN - 25 * 60_000).as_deref(), Some("25:00"));
        // Une séance de 90 minutes : les minutes dépassent 59, comme sur la pastille.
        assert_eq!(titre(seance, FIN - 90 * 60_000).as_deref(), Some("90:00"));
        // Passé la fin, le zéro reste : jamais de temps négatif.
        assert_eq!(titre(seance, FIN + 4_000).as_deref(), Some("00:00"));
    }

    #[test]
    fn le_meme_arrondi_que_l_app() {
        // `Math.round((fin - maintenant) / 1000)` : la demi-seconde monte.
        let seance = Seance::EnCours { fin_ms: FIN };
        assert_eq!(restant_sec(seance, FIN - 1_500), Some(2));
        assert_eq!(restant_sec(seance, FIN - 1_499), Some(1));
        assert_eq!(restant_sec(seance, FIN - 500), Some(1));
        assert_eq!(restant_sec(seance, FIN - 499), Some(0));
    }

    #[test]
    fn en_pause_le_titre_le_dit_sans_emoji() {
        assert_eq!(titre(Seance::EnPause { restant_sec: 731 }, 0).as_deref(), Some("12:11 · pause"));
    }

    #[test]
    fn sans_seance_aucun_titre() {
        assert_eq!(titre(Seance::Aucune, FIN), None);
    }

    #[test]
    fn le_reveil_tombe_juste_apres_le_changement_de_chiffre() {
        // À 24,9 s de la fin, le chiffre (25) passe à 24 quand il reste 24,5 s :
        // dans 400 ms, plus la marge.
        assert_eq!(delai_avant_prochaine_seconde(FIN, FIN - 24_900), 412);
        // Juste après une frontière : presque une seconde entière.
        assert_eq!(delai_avant_prochaine_seconde(FIN, FIN - 24_499), 1011);
        // Après la fin, le calcul reste positif (pas de sommeil négatif).
        assert!(delai_avant_prochaine_seconde(FIN, FIN + 300) <= 1012);
    }

    #[test]
    fn l_entree_du_menu_suit_l_etat() {
        let en_cours = Seance::EnCours { fin_ms: FIN };
        let en_pause = Seance::EnPause { restant_sec: 60 };
        assert_eq!((libelle_pause(en_cours), commande_pause(en_cours)), ("Pause", Some("pause")));
        assert_eq!((libelle_pause(en_pause), commande_pause(en_pause)), ("Reprendre", Some("reprendre")));
        assert_eq!(commande_pause(Seance::Aucune), None);
    }
}
