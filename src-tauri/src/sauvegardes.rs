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
    copier_coherente(&source, &dossier.join(&nom)).await?;

    faire_le_menage(&dossier)?;
    Ok(nom)
}

/// Une copie COMPLÈTE et cohérente d'une base en WAL, par `VACUUM INTO`.
///
/// ⚠️ Jamais une copie de fichier : une partie des données récentes vit dans
/// le `-wal`, et copier le seul fichier principal produirait une copie
/// silencieusement amputée des dernières écritures.
async fn copier_coherente(source: &Path, destination: &Path) -> Result<(), String> {
    let options = SqliteConnectOptions::new()
        .filename(source)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Wal)
        .read_only(false); // cf. le README des notifications : en WAL, la
                           // lecture seule échoue tant que le `-shm` n'existe pas.

    let mut conn = SqliteConnection::connect_with(&options)
        .await
        .map_err(|e| format!("ouverture de la base : {e}"))?;

    // Le chemin est injecté dans le SQL (VACUUM n'accepte pas de paramètre lié),
    // d'où le doublement des apostrophes.
    let cible = destination.to_string_lossy().replace('\'', "''");
    let resultat = sqlx::query(&format!("VACUUM INTO '{cible}'"))
        .execute(&mut conn)
        .await
        .map(|_| ())
        .map_err(|e| format!("écriture de la sauvegarde : {e}"));

    let _ = conn.close().await;
    resultat
}

/// Marque une base À RESTAURER pour que le front la republie au démarrage.
///
/// ⭐ POURQUOI (audit du 2026-10-20, donnees-3). Une sauvegarde emporte le
/// curseur et l'état de synchronisation de SON jour. Restaurée telle quelle,
/// elle repartait de ce vieux curseur au premier cycle, tirait la pierre
/// tombale de la note qu'on voulait récupérer, et l'effaçait de nouveau. Le
/// drapeau `restauree` dit au front d'oublier ce qu'il croit savoir du serveur
/// et de tout remettre en file (`remettreEnOrdre`, `sync/local.ts`).
///
/// Le drapeau `applying` est baissé au passage : une copie prise pendant une
/// application distante le porte levé, et toutes les écritures suivantes
/// échapperaient à la file d'envoi.
///
/// ⚠️ Ouverte en journal `DELETE`, pas en WAL : c'est un fichier qu'on va
/// copier tel quel. En WAL, l'écriture resterait dans un `-wal` qui ne
/// voyagerait pas avec lui.
async fn marquer_restauree(base: &Path) -> Result<(), String> {
    let options = SqliteConnectOptions::new()
        .filename(base)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Delete);
    let mut conn = SqliteConnection::connect_with(&options)
        .await
        .map_err(|e| format!("ouverture de la sauvegarde : {e}"))?;

    let resultat = async {
        // Une base d'avant la synchronisation (migration 016) n'a pas de
        // `sync_meta` : rien à marquer, rien ne la ferait revenir en arrière.
        let a_la_table: Option<(String,)> =
            sqlx::query_as("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sync_meta'")
                .fetch_optional(&mut conn)
                .await?;
        if a_la_table.is_some() {
            sqlx::query("INSERT INTO sync_meta (k, v) VALUES ('restauree', '1') ON CONFLICT(k) DO UPDATE SET v = '1'")
                .execute(&mut conn)
                .await?;
            sqlx::query("UPDATE sync_meta SET v = '0' WHERE k = 'applying'")
                .execute(&mut conn)
                .await?;
        }
        Ok::<(), sqlx::Error>(())
    }
    .await
    .map_err(|e| format!("préparation de la restauration : {e}"));

    let _ = conn.close().await;
    resultat
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
pub async fn sauvegarde_programmer_restauration(app: AppHandle, nom: String) -> Result<(), String> {
    // Le nom vient du front : on refuse tout ce qui pourrait sortir du dossier.
    if nom.contains('/') || nom.contains('\\') || nom.contains("..") || !nom.ends_with(".db") {
        return Err("nom de sauvegarde invalide".into());
    }
    let source = dossier_sauvegardes(&app)?.join(&nom);
    if !source.exists() {
        return Err(format!("sauvegarde introuvable : {nom}"));
    }
    preparer_restauration(&source, &dossier_base(&app)?.join(EN_ATTENTE)).await
}

/// Copie la sauvegarde choisie à côté de la base, et la marque restaurée.
/// La sauvegarde elle-même n'est pas touchée : elle reste restaurable telle quelle.
async fn preparer_restauration(source: &Path, attente: &Path) -> Result<(), String> {
    fs::copy(source, attente).map_err(|e| format!("préparation de la restauration : {e}"))?;
    if let Err(e) = marquer_restauree(attente).await {
        // Une copie non marquée serait défaite par la synchronisation suivante :
        // mieux vaut ne pas restaurer, et le dire.
        let _ = fs::remove_file(attente);
        return Err(e);
    }
    Ok(())
}

/// À appeler au démarrage, AVANT toute ouverture de la base.
///
/// Ne renvoie rien : un échec ici ne doit pas empêcher l'app de démarrer. Au
/// pire la restauration n'a pas lieu et le fichier en attente reste — il sera
/// retenté au lancement suivant, ce qui est le comportement voulu.
pub fn appliquer_restauration(app: &AppHandle) {
    let Ok(dossier) = dossier_base(app) else { return };
    tauri::async_runtime::block_on(appliquer_restauration_dans(&dossier));
}

async fn appliquer_restauration_dans(dossier: &Path) {
    let attente = dossier.join(EN_ATTENTE);
    if !attente.exists() {
        return;
    }
    let base = dossier.join("shale.db");

    // Filet : on met de côté l'état actuel avant de l'écraser. Restaurer par
    // erreur ne doit pas être le dernier mot — sans ça, une restauration
    // malencontreuse détruirait justement ce qu'on cherche à protéger.
    //
    // ⚠️ PAR `VACUUM INTO`, PAS PAR UNE COPIE DU FICHIER (audit du 2026-10-20,
    // donnees-4). Les dernières écritures peuvent vivre dans `shale.db-wal` —
    // c'est le cas après un plantage, ou sur iOS quand l'app est balayée sans
    // événement de sortie. La copie du seul `shale.db` les perdait, et le
    // `-wal` est supprimé quelques lignes plus bas : c'était définitif, alors
    // que l'écran promet qu'on pourra revenir à cet état.
    if base.exists() {
        let secours_dossier = dossier.join(DOSSIER);
        let _ = fs::create_dir_all(&secours_dossier);
        let secours = secours_dossier.join(nom_pour("avant-restauration"));
        if copier_coherente(&base, &secours).await.is_err() {
            // Repli, si la base ne s'ouvre même plus : le fichier ET son journal,
            // sous le même nom — SQLite relit un `-wal` posé à côté de sa base.
            let _ = fs::copy(&base, &secours);
            let wal = dossier.join("shale.db-wal");
            if wal.exists() {
                let mut nom_wal = secours.clone().into_os_string();
                nom_wal.push("-wal");
                let _ = fs::copy(&wal, PathBuf::from(nom_wal));
            }
        }
    }

    if fs::copy(&attente, &base).is_ok() {
        // Les journaux WAL décrivent l'ANCIENNE base : les laisser reviendrait à
        // rejouer des écritures qui n'ont plus de sens sur le fichier restauré.
        let _ = fs::remove_file(dossier.join("shale.db-wal"));
        let _ = fs::remove_file(dossier.join("shale.db-shm"));
        let _ = fs::remove_file(&attente);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::Row;

    async fn ouvrir(chemin: &Path, wal: bool) -> SqliteConnection {
        let options = SqliteConnectOptions::new()
            .filename(chemin)
            .create_if_missing(true)
            .journal_mode(if wal { SqliteJournalMode::Wal } else { SqliteJournalMode::Delete });
        SqliteConnection::connect_with(&options).await.unwrap()
    }

    async fn base_avec_notes(chemin: &Path, notes: &[&str], wal: bool) -> SqliteConnection {
        let mut c = ouvrir(chemin, wal).await;
        sqlx::query("CREATE TABLE IF NOT EXISTS notes (title TEXT)").execute(&mut c).await.unwrap();
        sqlx::query("CREATE TABLE IF NOT EXISTS sync_meta (k TEXT PRIMARY KEY, v TEXT)").execute(&mut c).await.unwrap();
        sqlx::query("INSERT OR IGNORE INTO sync_meta (k, v) VALUES ('applying', '0'), ('cursor', '42')")
            .execute(&mut c)
            .await
            .unwrap();
        for n in notes {
            sqlx::query("INSERT INTO notes (title) VALUES (?)").bind(*n).execute(&mut c).await.unwrap();
        }
        c
    }

    async fn titres(chemin: &Path) -> Vec<String> {
        let mut c = ouvrir(chemin, false).await;
        let lignes = sqlx::query("SELECT title FROM notes ORDER BY rowid").fetch_all(&mut c).await.unwrap();
        lignes.iter().map(|l| l.get::<String, _>(0)).collect()
    }

    async fn meta(chemin: &Path, cle: &str) -> Option<String> {
        let mut c = ouvrir(chemin, false).await;
        sqlx::query("SELECT v FROM sync_meta WHERE k = ?")
            .bind(cle)
            .fetch_optional(&mut c)
            .await
            .unwrap()
            .map(|l| l.get::<String, _>(0))
    }

    /// donnees-4 : la copie « avant restauration » garde ce qui n'est encore que dans le `-wal`.
    #[tokio::test]
    async fn la_copie_de_secours_garde_les_ecritures_du_wal() {
        let ici = tempfile::tempdir().unwrap();
        let dossier = tempfile::tempdir().unwrap();

        // L'état laissé par un plantage : la dernière note n'est que dans le
        // `-wal`. On photographie les deux fichiers PENDANT que la connexion
        // vit — fermée, elle reporterait le journal dans la base.
        let vivante_chemin = ici.path().join("shale.db");
        let mut vivante = base_avec_notes(&vivante_chemin, &["a"], true).await;
        sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)").execute(&mut vivante).await.unwrap();
        sqlx::query("PRAGMA wal_autocheckpoint = 0").execute(&mut vivante).await.unwrap();
        sqlx::query("INSERT INTO notes (title) VALUES ('récente')").execute(&mut vivante).await.unwrap();
        fs::copy(&vivante_chemin, dossier.path().join("shale.db")).unwrap();
        fs::copy(ici.path().join("shale.db-wal"), dossier.path().join("shale.db-wal")).unwrap();
        vivante.close().await.unwrap();
        let base = dossier.path().join("shale.db");

        // La sauvegarde qu'on restaure : une seule note.
        let ancienne = ici.path().join("ancienne.db");
        base_avec_notes(&ancienne, &["ancienne"], false).await.close().await.unwrap();

        preparer_restauration(&ancienne, &dossier.path().join(EN_ATTENTE)).await.unwrap();
        appliquer_restauration_dans(dossier.path()).await;

        let secours: Vec<PathBuf> = fs::read_dir(dossier.path().join(DOSSIER))
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| p.to_string_lossy().ends_with("avant-restauration.db"))
            .collect();
        assert_eq!(secours.len(), 1);
        assert_eq!(titres(&secours[0]).await, vec!["a", "récente"]);
        assert_eq!(titres(&base).await, vec!["ancienne"]);
        assert!(!dossier.path().join("shale.db-wal").exists());
    }

    /// donnees-3 : la base restaurée est marquée pour être republiée, drapeau `applying` baissé.
    #[tokio::test]
    async fn la_base_restauree_est_marquee_pour_etre_republiee() {
        let dossier = tempfile::tempdir().unwrap();
        let sauvegarde = dossier.path().join("sauvegarde.db");
        let mut c = base_avec_notes(&sauvegarde, &["x"], false).await;
        // Une copie prise PENDANT une application distante.
        sqlx::query("UPDATE sync_meta SET v = '1' WHERE k = 'applying'").execute(&mut c).await.unwrap();
        c.close().await.unwrap();
        let attente = dossier.path().join(EN_ATTENTE);

        preparer_restauration(&sauvegarde, &attente).await.unwrap();

        assert_eq!(meta(&attente, "restauree").await.as_deref(), Some("1"));
        assert_eq!(meta(&attente, "applying").await.as_deref(), Some("0"));
        assert_eq!(meta(&attente, "cursor").await.as_deref(), Some("42"), "le reste est intact : le front s'en charge");
        assert!(!dossier.path().join(format!("{EN_ATTENTE}-wal")).exists(), "rien ne doit rester dans un -wal");
        // La sauvegarde elle-même n'est pas touchée.
        assert_eq!(meta(&sauvegarde, "restauree").await, None);
    }

    /// Une base d'avant la synchronisation se restaure sans rien marquer.
    #[tokio::test]
    async fn une_base_sans_synchronisation_se_restaure_quand_meme() {
        let dossier = tempfile::tempdir().unwrap();
        let sauvegarde = dossier.path().join("vieille.db");
        let mut c = ouvrir(&sauvegarde, false).await;
        sqlx::query("CREATE TABLE notes (title TEXT)").execute(&mut c).await.unwrap();
        c.close().await.unwrap();
        preparer_restauration(&sauvegarde, &dossier.path().join(EN_ATTENTE)).await.unwrap();
        assert!(dossier.path().join(EN_ATTENTE).exists());
    }
}
