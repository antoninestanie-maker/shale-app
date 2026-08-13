//! Sauvegardes locales datées de `shale.db`.
//!
//! ─── POURQUOI C'EST LA PROTECTION QUI COMPTE ───────────────────────────────
//! La base locale est en CLAIR et n'a besoin d'AUCUNE clé pour être relue. Une
//! copie datée est donc une sauvegarde complète et immédiatement exploitable,
//! quoi qu'il arrive au mot de passe, au trousseau ou au cloud.
//!
//! Le cloud, lui, ne protège pas de tout : il PROPAGE les suppressions. Effacer
//! une note par erreur l'efface partout, et la synchronisation fait exactement
//! ce qu'on lui demande. Seule une copie antérieure permet de revenir en
//! arrière.
//!
//! ─── DEUX PRÉCAUTIONS QUI NE SONT PAS DÉCORATIVES ──────────────────────────
//! 1. `VACUUM INTO` plutôt qu'une copie de fichier. La base est en mode WAL :
//!    une partie des données récentes vit dans `shale.db-wal`, pas dans
//!    `shale.db`. Copier le seul fichier principal produirait une sauvegarde
//!    silencieusement AMPUTÉE des dernières écritures. `VACUUM INTO` écrit une
//!    base complète et cohérente, sans verrouiller l'app.
//!
//! 2. La restauration n'écrase JAMAIS une base ouverte. Elle est déposée à côté
//!    et appliquée au démarrage suivant, avant que quoi que ce soit n'ouvre la
//!    base. Remplacer un fichier SQLite sous une connexion vivante est le genre
//!    d'opération qui marche neuf fois sur dix.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::{Connection, SqliteConnection};
use tauri::{AppHandle, Manager};

/// Sous-dossier des sauvegardes, à côté de la base.
const DOSSIER: &str = "backups";

/// Fichier témoin d'une restauration demandée, appliquée au prochain démarrage.
const EN_ATTENTE: &str = "restauration-en-attente.db";

/// Combien de sauvegardes automatiques conserver.
///
/// Assez pour couvrir une erreur remarquée tardivement — une suppression passe
/// facilement inaperçue plusieurs jours. Une base Shale pèse quelques centaines
/// de kilo-octets à quelques mégaoctets : trente copies restent négligeables.
const A_CONSERVER: usize = 30;

#[derive(Serialize)]
pub struct Sauvegarde {
    /// Nom du fichier, qui sert aussi d'identifiant.
    pub nom: String,
    pub octets: u64,
    /// Horodatage local, `YYYY-MM-DD HH:MM`.
    pub quand: String,
    /// Ce qui l'a déclenchée : `auto`, `avant-republication`, `manuelle`…
    pub motif: String,
}

fn dossier_base(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

fn chemin_base(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(dossier_base(app)?.join("shale.db"))
}

fn dossier_sauvegardes(app: &AppHandle) -> Result<PathBuf, String> {
    let d = dossier_base(app)?.join(DOSSIER);
    fs::create_dir_all(&d).map_err(|e| format!("création du dossier de sauvegardes : {e}"))?;
    Ok(d)
}

/// `2026-08-10T18-42-03_auto.db` — triable par nom, lisible par un humain.
fn nom_pour(motif: &str) -> String {
    let horodatage = chrono::Local::now().format("%Y-%m-%dT%H-%M-%S");
    // Le motif entre dans un nom de fichier : on n'y laisse rien d'exotique.
    let motif: String = motif
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '-' })
        .collect();
    format!("{horodatage}_{motif}.db")
}

fn lire_motif(nom: &str) -> String {
    nom.rsplit_once('_')
        .map(|(_, fin)| fin.trim_end_matches(".db").to_string())
        .unwrap_or_else(|| "inconnu".into())
}

fn lire_quand(nom: &str) -> String {
    // `2026-08-10T18-42-03` → `2026-08-10 18:42`
    let brut = nom.split('_').next().unwrap_or(nom);
    match brut.split_once('T') {
        Some((jour, heure)) => {
            let hm: Vec<&str> = heure.split('-').collect();
            if hm.len() >= 2 {
                format!("{jour} {}:{}", hm[0], hm[1])
            } else {
                jour.to_string()
            }
        }
        None => brut.to_string(),
    }
}

/// Crée une sauvegarde et fait le ménage. Renvoie son nom de fichier.
#[tauri::command]
pub async fn sauvegarde_creer(app: AppHandle, motif: String) -> Result<String, String> {
    let source = chemin_base(&app)?;
    if !source.exists() {
        return Err("base introuvable".into());
    }

    let dossier = dossier_sauvegardes(&app)?;
    let nom = nom_pour(&motif);
    let destination = dossier.join(&nom);

    let options = SqliteConnectOptions::new()
        .filename(&source)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Wal)
        .read_only(false); // cf. le README des notifications : en WAL, la
                           // lecture seule échoue tant que le `-shm` n'existe pas.

    let mut conn = SqliteConnection::connect_with(&options)
        .await
        .map_err(|e| format!("ouverture de la base : {e}"))?;

    // ⚠️ `VACUUM INTO` et non une copie de fichier : la base est en WAL, une
    // copie du seul `shale.db` manquerait les écritures encore dans le `-wal`.
    // Le chemin est injecté dans le SQL (VACUUM n'accepte pas de paramètre lié),
    // d'où le doublement des apostrophes.
    let cible = destination.to_string_lossy().replace('\'', "''");
    sqlx::query(&format!("VACUUM INTO '{cible}'"))
        .execute(&mut conn)
        .await
        .map_err(|e| format!("écriture de la sauvegarde : {e}"))?;

    let _ = conn.close().await;

    faire_le_menage(&dossier)?;
    Ok(nom)
}

/// Ne garde que les `A_CONSERVER` plus récentes. Les noms étant horodatés, le
/// tri alphabétique EST le tri chronologique.
fn faire_le_menage(dossier: &Path) -> Result<(), String> {
    let mut noms: Vec<String> = fs::read_dir(dossier)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.file_name().to_string_lossy().to_string())
        .filter(|n| n.ends_with(".db"))
        .collect();

    if noms.len() <= A_CONSERVER {
        return Ok(());
    }
    noms.sort();
    for vieux in &noms[..noms.len() - A_CONSERVER] {
        let _ = fs::remove_file(dossier.join(vieux));
    }
    Ok(())
}

#[tauri::command]
pub fn sauvegarde_lister(app: AppHandle) -> Result<Vec<Sauvegarde>, String> {
    let dossier = dossier_sauvegardes(&app)?;
    let mut liste: Vec<Sauvegarde> = fs::read_dir(&dossier)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let nom = e.file_name().to_string_lossy().to_string();
            if !nom.ends_with(".db") {
                return None;
            }
            let octets = e.metadata().ok()?.len();
            Some(Sauvegarde {
                quand: lire_quand(&nom),
                motif: lire_motif(&nom),
                octets,
                nom,
            })
        })
        .collect();

    // La plus récente en tête : c'est celle qu'on veut voir en premier.
    liste.sort_by(|a, b| b.nom.cmp(&a.nom));
    Ok(liste)
}

/// Chemin du dossier, pour l'ouvrir dans le Finder.
#[tauri::command]
pub fn sauvegarde_dossier(app: AppHandle) -> Result<String, String> {
    Ok(dossier_sauvegardes(&app)?.to_string_lossy().to_string())
}

/// Demande une restauration. Elle N'EST PAS appliquée ici.
///
/// ⚠️ La base est ouverte par l'application au moment de l'appel. L'écraser
/// sous une connexion vivante corromprait le WAL. La sauvegarde choisie est
/// donc recopiée à côté sous un nom convenu, et `appliquer_restauration()` la
/// mettra en place au prochain démarrage, avant que rien ne l'ouvre.
#[tauri::command]
pub fn sauvegarde_programmer_restauration(app: AppHandle, nom: String) -> Result<(), String> {
    // Le nom vient du front : on refuse tout ce qui pourrait sortir du dossier.
    if nom.contains('/') || nom.contains('\\') || nom.contains("..") || !nom.ends_with(".db") {
        return Err("nom de sauvegarde invalide".into());
    }
    let source = dossier_sauvegardes(&app)?.join(&nom);
    if !source.exists() {
        return Err(format!("sauvegarde introuvable : {nom}"));
    }
    let attente = dossier_base(&app)?.join(EN_ATTENTE);
    fs::copy(&source, &attente).map_err(|e| format!("préparation de la restauration : {e}"))?;
    Ok(())
}

/// À appeler au démarrage, AVANT toute ouverture de la base.
///
/// Ne renvoie rien : un échec ici ne doit pas empêcher l'app de démarrer. Au
/// pire la restauration n'a pas lieu et le fichier en attente reste — il sera
/// retenté au lancement suivant, ce qui est le comportement voulu.
pub fn appliquer_restauration(app: &AppHandle) {
    let Ok(dossier) = dossier_base(app) else { return };
    let attente = dossier.join(EN_ATTENTE);
    if !attente.exists() {
        return;
    }
    let base = dossier.join("shale.db");

    // Filet : on met de côté l'état actuel avant de l'écraser. Restaurer par
    // erreur ne doit pas être le dernier mot — sans ça, une restauration
    // malencontreuse détruirait justement ce qu'on cherche à protéger.
    if base.exists() {
        let secours = dossier
            .join(DOSSIER)
            .join(nom_pour("avant-restauration"));
        let _ = fs::create_dir_all(dossier.join(DOSSIER));
        let _ = fs::copy(&base, &secours);
    }

    if fs::copy(&attente, &base).is_ok() {
        // Les journaux WAL décrivent l'ANCIENNE base : les laisser reviendrait à
        // rejouer des écritures qui n'ont plus de sens sur le fichier restauré.
        let _ = fs::remove_file(dossier.join("shale.db-wal"));
        let _ = fs::remove_file(dossier.join("shale.db-shm"));
        let _ = fs::remove_file(&attente);
    }
}
