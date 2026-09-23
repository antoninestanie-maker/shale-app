//! Les octets des pièces jointes — dépôt, ouverture, effacement.
//!
//! ─── POURQUOI LES OCTETS NE SONT PAS DANS LA BASE ──────────────────────────
//! Le raisonnement complet est en tête de `migrations/028_pieces_jointes.sql`.
//! En un mot : `notes_fts` indexe le corps BRUT des notes, et la
//! synchronisation renvoie la ligne ENTIÈRE à chaque enregistrement. Un PDF
//! écrit dans le corps d'une note coûterait donc son poids en base, son poids
//! en index de recherche, et son poids sur le réseau à chaque frappe.
//!
//! Ici, un fichier est un fichier : `<app_data>/pieces-jointes/<uid>`.
//!
//! ─── ⚠️ AUCUN BASE64 SUR LE CHEMIN DU DÉPÔT, ET C'EST DÉLIBÉRÉ ─────────────
//! `ecrire_fichier` (dans `lib.rs`) fait passer son contenu en base64 parce
//! qu'il écrit ce que le FRONT vient de fabriquer — un SVG, un PNG de quelques
//! dizaines de ko. Ici c'est l'inverse : le fichier existe DÉJÀ sur le disque,
//! et il peut peser 100 Mo. Le lire dans la webview, l'encoder en base64 (+33 %)
//! et le repasser au Rust ferait transiter 133 Mo de texte par le pont JS↔Rust,
//! pour finir par écrire ce qu'on aurait pu simplement COPIER.
//!
//! Le front n'envoie donc qu'un CHEMIN, celui que le sélecteur système a rendu.
//! C'est exactement ce que fait déjà `import_screenshot`, et on réutilise son
//! `chemin_reel()` — qui porte le piège iOS (le sélecteur de photos rend un
//! `file:///…` percent-encodé, pas un chemin).

use std::path::PathBuf;

use serde::Serialize;
use tauri::{AppHandle, Manager};

/// Sous-dossier des pièces jointes, à côté de la base.
const DOSSIER: &str = "pieces-jointes";

/// Le dossier des pièces jointes, créé au besoin.
fn dossier(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(DOSSIER);
    std::fs::create_dir_all(&d).map_err(|e| format!("création de {} : {e}", d.display()))?;
    Ok(d)
}

/// Le chemin des octets d'une pièce jointe, d'après son `uid`.
///
/// ⚠️ L'`uid` VIENT DE LA BASE, mais il arrive ici par le pont JS, donc il est
/// traité comme une entrée non fiable. Un uid qui contiendrait `/` ou `..`
/// désignerait un fichier hors du dossier — et `supprimer_piece_jointe`
/// l'effacerait. En pratique c'est un UUID v4, mais « en pratique » n'est pas
/// une garantie : on le VÉRIFIE, et le coût est de trois lignes.
fn chemin_de(app: &AppHandle, uid: &str) -> Result<PathBuf, String> {
    if uid.is_empty() || uid.len() > 64 {
        return Err("identifiant invalide".into());
    }
    if !uid
        .bytes()
        .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    {
        return Err("identifiant invalide".into());
    }
    Ok(dossier(app)?.join(uid))
}

/// Ce qu'on rend au front après un dépôt réussi.
#[derive(Serialize)]
pub struct Depot {
    /// Nom d'origine, tel qu'il était sur le disque de l'utilisateur.
    pub nom: String,
    /// Taille réelle, MESURÉE après la copie.
    pub taille: u64,
}

/// Copie un fichier choisi par l'utilisateur dans le dossier des pièces jointes.
///
/// ⚠️ LA TAILLE EST RELUE APRÈS LA COPIE, jamais reprise de ce que le front
/// croyait savoir. C'est la seule valeur qui décrit ce qui est réellement sur le
/// disque — et c'est elle qui s'affichera sous le nom du fichier pendant des
/// mois. Une taille annoncée par l'appelant serait une copie d'affichage de plus
/// à garder d'accord avec la réalité.
///
/// ⚠️ Le chemin de DESTINATION ne vient jamais du front : il est calculé ici à
/// partir de l'uid, validé par `chemin_de`. Le front ne choisit que la SOURCE,
/// et il la tient du sélecteur système — donc d'un geste de l'utilisateur.
#[tauri::command]
pub fn deposer_piece_jointe(app: AppHandle, uid: String, src: String) -> Result<Depot, String> {
    let dest = chemin_de(&app, &uid)?;
    let source = crate::chemin_reel(&src);

    let nom = source
        .file_name()
        .ok_or("fichier invalide")?
        .to_string_lossy()
        .to_string();

    std::fs::copy(&source, &dest)
        .map_err(|e| format!("copie de {} : {e}", source.display()))?;

    let taille = std::fs::metadata(&dest)
        .map_err(|e| format!("lecture de {} : {e}", dest.display()))?
        .len();

    Ok(Depot { nom, taille })
}

/// Les octets de cette pièce jointe sont-ils sur CET appareil ?
///
/// ⚠️ Répondre « non » est un état NORMAL, pas une erreur : le signalement d'un
/// fichier se synchronise, ses octets non (migration 028 § « ce qui se
/// synchronise »). Sur le second appareil, la réponse est donc non, et
/// l'interface affiche « pas sur cet appareil » plutôt que de faire comme si le
/// paragraphe n'avait jamais rien porté.
#[tauri::command]
pub fn piece_jointe_presente(app: AppHandle, uid: String) -> Result<bool, String> {
    Ok(chemin_de(&app, &uid)?.is_file())
}

/// Ouvre la pièce jointe dans le logiciel du système.
///
/// Rend `false` quand les octets ne sont pas là — cf. `piece_jointe_presente`.
#[tauri::command]
pub fn ouvrir_piece_jointe(app: AppHandle, uid: String) -> Result<bool, String> {
    let p = chemin_de(&app, &uid)?;
    if !p.is_file() {
        return Ok(false);
    }
    tauri_plugin_opener::open_path(p.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("ouverture de {} : {e}", p.display()))?;
    Ok(true)
}

/// Efface les octets d'une pièce jointe.
///
/// ⚠️ Un fichier DÉJÀ absent n'est PAS une erreur, et c'est le cas courant : sur
/// le second appareil, la suppression de la ligne `files` arrive par la
/// synchronisation alors que les octets n'y ont jamais été. Lever ici ferait
/// échouer un ménage parfaitement réussi.
#[tauri::command]
pub fn supprimer_piece_jointe(app: AppHandle, uid: String) -> Result<(), String> {
    let p = chemin_de(&app, &uid)?;
    match std::fs::remove_file(&p) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("suppression de {} : {e}", p.display())),
    }
}

#[cfg(test)]
mod tests {
    //! ⚠️ Ces tests ne couvrent que la VALIDATION D'IDENTIFIANT, parce que c'est
    //! la seule partie qui n'a pas besoin d'un `AppHandle`. C'est aussi la seule
    //! qui décide si un chemin peut sortir du dossier — donc la seule dont un
    //! défaut effacerait un fichier qui n'appartient pas à l'app.

    /// La même règle que `chemin_de`, isolée pour être testable sans Tauri.
    fn uid_acceptable(uid: &str) -> bool {
        !uid.is_empty()
            && uid.len() <= 64
            && uid
                .bytes()
                .all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_')
    }

    #[test]
    fn accepte_un_uuid_v4() {
        assert!(uid_acceptable("3f2a1b4c-9d8e-4f7a-b6c5-1e2d3f4a5b6c"));
    }

    #[test]
    fn refuse_une_remontee_de_dossier() {
        assert!(!uid_acceptable(".."));
        assert!(!uid_acceptable("../../shale.db"));
    }

    #[test]
    fn refuse_un_separateur_de_chemin() {
        assert!(!uid_acceptable("a/b"));
        assert!(!uid_acceptable("a\\b"));
    }

    #[test]
    fn refuse_le_vide_et_le_demesure() {
        assert!(!uid_acceptable(""));
        assert!(!uid_acceptable(&"a".repeat(65)));
    }
}
