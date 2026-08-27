//! Le geste physique qui ouvre une note — côté Rust.
//!
//! ─── LE PROBLÈME ────────────────────────────────────────────────────────────
//! Sur le bureau, ⌘⇧N est un `keydown` : le front l'entend lui-même. Sur
//! iPhone, le geste équivalent (bouton Action, Toucher au dos, Siri, icône
//! d'écran d'accueil) passe par un `AppIntent`, c'est-à-dire du **Swift**, qui
//! n'a aucun moyen de parler à la webview : Tauri n'expose pas sa `WKWebView`
//! aux sources du projet Xcode.
//!
//! ─── LE PONT, ET POURQUOI C'EST UN FICHIER ──────────────────────────────────
//! L'intent tourne dans le processus de l'app, donc dans le même bac à sable.
//! Il pose un fichier vide ; ce module le relève et le consomme. Un fichier
//! plutôt qu'un `UserDefaults` parce que le Rust le lit sans une ligne d'interop
//! Objective-C, et plutôt qu'un schéma d'URL parce que celui-ci demanderait le
//! greffon `deep-link`, ses capacités et son `Info.plist` — beaucoup d'appareil
//! pour transporter un booléen.
//!
//! ⚠️ **La fraîcheur n'est pas une précaution, elle répare un vrai défaut.**
//! Sans elle, une demande posée alors que l'app est DÉJÀ au premier plan ne
//! serait consommée qu'au retour d'arrière-plan suivant : une note s'ouvrirait
//! toute seule, des heures plus tard, sans que rien ne l'ait demandée. Passé
//! `FRAICHEUR`, la demande est jetée au lieu d'être honorée.
//!
//! ⚠️ **Le Swift n'écrit RIEN dans `shale.db`**, et c'est structurel : le front
//! est seul écrivain, invariant sur lequel reposent le moteur de notifications
//! (`notifications/README.md`) et la synchronisation. L'intent ouvre, il ne
//! saisit pas — c'est la limite écrite au § 4.1 de `MOBILE.md`.

use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use tauri::{AppHandle, Manager};

/// Nom du fichier-drapeau. **Le Swift écrit littéralement ce nom** : le changer
/// ici sans le changer dans `QuickNoteIntent.swift` casse le pont en silence.
pub const FICHIER: &str = "note-rapide.demande";

/// Au-delà, la demande est considérée comme périmée et jetée.
///
/// Deux minutes : largement de quoi couvrir un démarrage à froid sur un vieil
/// appareil, et bien trop court pour qu'une demande oubliée resurgisse plus
/// tard sous les yeux de quelqu'un qui n'a rien demandé.
const FRAICHEUR: Duration = Duration::from_secs(120);

fn chemin(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(FICHIER))
        .map_err(|e| format!("dossier de données introuvable : {e}"))
}

/// Vrai si une demande FRAÎCHE attendait. Elle est consommée dans tous les cas
/// — fraîche ou périmée — pour qu'une seule pression n'ouvre qu'une seule note.
///
/// N'échoue jamais côté appelant : une demande qu'on ne sait pas lire vaut
/// « pas de demande ». Ouvrir une note à tort est plus gênant que de rater un
/// geste, qui se refait en une seconde.
#[tauri::command]
pub fn note_rapide_demandee(app: AppHandle) -> bool {
    let Ok(p) = chemin(&app) else { return false };
    let Ok(meta) = std::fs::metadata(&p) else { return false };
    let fraiche = est_fraiche(meta.modified().ok(), SystemTime::now());
    let _ = std::fs::remove_file(&p);
    fraiche
}

/// La règle de fraîcheur, isolée du disque pour être testable.
///
/// `None` (horloge du système de fichiers indisponible) vaut « périmée » : sans
/// date, on ne peut pas affirmer que le geste vient d'être fait, et le doute
/// doit pencher du côté qui n'ouvre RIEN.
///
/// ⚠️ `duration_since` échoue quand la date est dans le FUTUR — ça arrive après
/// un changement d'heure système ou une restauration de sauvegarde. Le futur
/// est traité comme périmé pour la même raison.
fn est_fraiche(modifiee: Option<SystemTime>, maintenant: SystemTime) -> bool {
    modifiee
        .and_then(|t| maintenant.duration_since(t).ok())
        .is_some_and(|age| age <= FRAICHEUR)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_demande_de_l_instant_est_fraiche() {
        let now = SystemTime::now();
        assert!(est_fraiche(Some(now), now));
        assert!(est_fraiche(Some(now - Duration::from_secs(30)), now));
    }

    /// La borne exacte, parce que c'est elle qui décidera un jour d'un cas réel.
    #[test]
    fn la_borne_est_inclusive() {
        let now = SystemTime::now();
        assert!(est_fraiche(Some(now - FRAICHEUR), now));
        assert!(!est_fraiche(Some(now - FRAICHEUR - Duration::from_secs(1)), now));
    }

    /// Le cas qui justifie tout le mécanisme : un geste fait alors que l'app
    /// était DÉJÀ à l'écran ne doit pas rouvrir une note des heures plus tard.
    #[test]
    fn une_vieille_demande_est_jetee() {
        let now = SystemTime::now();
        assert!(!est_fraiche(Some(now - Duration::from_secs(3 * 3600)), now));
    }

    /// Horloge reculée, sauvegarde restaurée : une date dans le futur n'est pas
    /// une demande fraîche, c'est une date dont on ne sait rien.
    #[test]
    fn une_date_future_ne_passe_pas_pour_fraiche() {
        let now = SystemTime::now();
        assert!(!est_fraiche(Some(now + Duration::from_secs(60)), now));
    }

    #[test]
    fn sans_date_on_n_ouvre_rien() {
        assert!(!est_fraiche(None, SystemTime::now()));
    }
}
