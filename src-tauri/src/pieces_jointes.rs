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

/// Sous-dossier des VUES d'ouverture : `ouvertes/<uid>/<nom d'origine>`.
const OUVERTES: &str = "ouvertes";

/// Le nom sous lequel le système verra la pièce jointe à l'ouverture.
///
/// ⚠️ Le nom vient de la base (`files.name`), donc du pont JS : on n'en garde
/// que le DERNIER segment, sans séparateur ni caractère de contrôle, et on
/// refuse `.`/`..`. Il ne choisit qu'un nom de fichier dans un dossier que
/// nous avons calculé — jamais un chemin.
fn nom_d_ouverture(nom: &str) -> Option<String> {
    let dernier = nom.rsplit(['/', '\\']).next().unwrap_or("");
    let net: String = dernier.chars().filter(|c| !c.is_control()).collect();
    let net = net.trim();
    if net.is_empty() || net == "." || net == ".." {
        return None;
    }
    // Les noms très longs sont refusés par certains systèmes de fichiers :
    // on coupe sur une frontière de caractère, l'extension en dernier ressort.
    if net.len() <= 200 {
        return Some(net.to_string());
    }
    let ext = std::path::Path::new(net)
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .filter(|e| e.len() <= 16);
    let mut base: String = net.chars().take(150).collect();
    if let Some(e) = ext {
        base.push('.');
        base.push_str(&e);
    }
    Some(base)
}

/// Ouvre la pièce jointe dans le logiciel du système.
///
/// Rend `false` quand les octets ne sont pas là — cf. `piece_jointe_presente`.
///
/// ⭐ OUVERTE SOUS SON NOM D'ORIGINE (audit du 2026-10-20, donnees-5 ; A01-01).
/// Les octets sont rangés sous leur `uid`, SANS extension : macOS ne
/// reconnaissait pas le type (`public.data`) et ouvrait un PDF dans TextEdit,
/// en caractères illisibles. On ouvre donc un LIEN DUR posé à
/// `ouvertes/<uid>/<nom d'origine>` — même fichier, aucune copie, et le
/// logiciel affiche « Contrat.pdf ». Le rangement par `uid` ne change pas :
/// la présence, l'effacement et la synchronisation n'en savent rien. Si le
/// lien dur échoue (volume qui n'en veut pas), on copie.
#[tauri::command]
pub fn ouvrir_piece_jointe(app: AppHandle, uid: String, nom: Option<String>) -> Result<bool, String> {
    let p = chemin_de(&app, &uid)?;
    if !p.is_file() {
        return Ok(false);
    }
    let a_ouvrir = match nom.as_deref().and_then(nom_d_ouverture) {
        Some(nom) => vue_d_ouverture(&dossier(&app)?, &uid, &nom, &p)?,
        None => p.clone(),
    };
    tauri_plugin_opener::open_path(a_ouvrir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| format!("ouverture de {} : {e}", a_ouvrir.display()))?;
    Ok(true)
}

/// Pose (ou repose) `ouvertes/<uid>/<nom>` sur les octets de `source`.
///
/// ⚠️ Le dossier de l'uid est VIDÉ d'abord : un fichier renommé entre deux
/// ouvertures laisserait sinon l'ancien nom à côté du nouveau, et un lien
/// resté d'une version précédente des octets montrerait un contenu périmé.
fn vue_d_ouverture(
    racine: &std::path::Path,
    uid: &str,
    nom: &str,
    source: &std::path::Path,
) -> Result<PathBuf, String> {
    let dossier_uid = racine.join(OUVERTES).join(uid);
    let _ = std::fs::remove_dir_all(&dossier_uid);
    std::fs::create_dir_all(&dossier_uid)
        .map_err(|e| format!("création de {} : {e}", dossier_uid.display()))?;
    let vue = dossier_uid.join(nom);
    if std::fs::hard_link(source, &vue).is_err() {
        std::fs::copy(source, &vue).map_err(|e| format!("copie de {} : {e}", source.display()))?;
    }
    Ok(vue)
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
    // La vue d'ouverture part avec les octets (un lien dur les garderait sinon
    // sur le disque). `chemin_de` a validé l'uid : ce dossier est le sien.
    let _ = std::fs::remove_dir_all(dossier(&app)?.join(OUVERTES).join(&uid));
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

    use super::{nom_d_ouverture, vue_d_ouverture};

    #[test]
    fn le_nom_d_ouverture_garde_le_nom_et_son_extension() {
        assert_eq!(nom_d_ouverture("Contrat.pdf").as_deref(), Some("Contrat.pdf"));
        assert_eq!(nom_d_ouverture("  Facture mars.PDF ").as_deref(), Some("Facture mars.PDF"));
    }

    #[test]
    fn le_nom_d_ouverture_ne_sort_jamais_du_dossier() {
        assert_eq!(nom_d_ouverture("../../shale.db").as_deref(), Some("shale.db"));
        assert_eq!(nom_d_ouverture("a\\b\\c.txt").as_deref(), Some("c.txt"));
        assert_eq!(nom_d_ouverture(".."), None);
        assert_eq!(nom_d_ouverture(""), None);
        assert_eq!(nom_d_ouverture("dossier/"), None);
    }

    #[test]
    fn un_nom_demesure_est_coupe_en_gardant_l_extension() {
        let long = format!("{}.pdf", "é".repeat(300));
        let n = nom_d_ouverture(&long).unwrap();
        assert!(n.ends_with(".pdf"));
        assert!(n.chars().count() <= 160);
    }

    #[test]
    fn la_vue_d_ouverture_porte_l_extension_et_les_memes_octets() {
        let racine = std::env::temp_dir().join(format!("shale-pj-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&racine);
        std::fs::create_dir_all(&racine).unwrap();
        let octets = racine.join("3f2a1b4c");
        std::fs::write(&octets, b"%PDF-1.7 test").unwrap();

        let vue = vue_d_ouverture(&racine, "3f2a1b4c", "Contrat.pdf", &octets).unwrap();
        assert_eq!(vue.extension().unwrap(), "pdf");
        assert_eq!(std::fs::read(&vue).unwrap(), b"%PDF-1.7 test");

        // Renommée entre deux ouvertures : l'ancien nom ne reste pas à côté.
        let vue2 = vue_d_ouverture(&racine, "3f2a1b4c", "Contrat signé.pdf", &octets).unwrap();
        assert!(vue2.is_file());
        assert!(!vue.exists());
        let _ = std::fs::remove_dir_all(&racine);
    }

    #[test]
    fn refuse_le_vide_et_le_demesure() {
        assert!(!uid_acceptable(""));
        assert!(!uid_acceptable(&"a".repeat(65)));
    }
}
