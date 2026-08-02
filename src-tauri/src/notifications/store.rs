//! Persistance de `notifications.json` — préférences, journal, état du moteur.
//!
//! Le Rust est le SEUL écrivain de ce fichier ; le front y accède uniquement par
//! les commandes Tauri. Conséquences voulues : le planificateur reste autonome
//! quand aucune fenêtre n'est ouverte, et aucune écriture concurrente n'est
//! possible sur `shale.db` (que ce module ne touche jamais).
//!
//! Robustesse : fichier absent → réglages par défaut ; fichier illisible ou
//! corrompu → il est MIS DE CÔTÉ (`.corrupt.json`) plutôt qu'écrasé, et on
//! repart sur les défauts. Une erreur d'écriture est signalée sur stderr sans
//! jamais faire tomber l'application.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::model::NotifFile;
use super::rules::registry;

pub struct NotifStore {
    path: PathBuf,
    file: Mutex<NotifFile>,
}

impl NotifStore {
    /// Charge le fichier (ou les défauts) et complète les réglages manquants.
    /// N'échoue jamais : sans notifications, l'app doit continuer de tourner.
    pub fn load(path: PathBuf) -> Self {
        let mut file = read_or_default(&path);
        if hydrate(&mut file) {
            // De nouvelles règles sont apparues depuis la dernière version :
            // on matérialise leurs défauts tout de suite.
            write(&path, &file);
        }
        Self { path, file: Mutex::new(file) }
    }

    /// Copie de l'état courant (lectures des commandes).
    pub fn read(&self) -> NotifFile {
        self.file.lock().expect("verrou notifications").clone()
    }

    /// Mutation + écriture atomique, sous un seul verrou.
    pub fn update<T>(&self, f: impl FnOnce(&mut NotifFile) -> T) -> T {
        let mut guard = self.file.lock().expect("verrou notifications");
        let out = f(&mut guard);
        write(&self.path, &guard);
        out
    }
}

/// Ajoute les réglages par défaut des règles absentes du fichier. Renvoie vrai
/// si quelque chose a été ajouté. Les réglages DÉJÀ présents ne sont jamais
/// touchés : une mise à jour de Shale ne réinitialise pas les choix de l'utilisateur.
fn hydrate(file: &mut NotifFile) -> bool {
    let mut changed = false;
    for rule in registry() {
        if !file.preferences.rules.contains_key(rule.id()) {
            file.preferences
                .rules
                .insert(rule.id().to_string(), rule.default_prefs());
            changed = true;
        }
    }
    changed
}

fn read_or_default(path: &Path) -> NotifFile {
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return NotifFile::default(),
        Err(e) => {
            eprintln!("notifications : lecture impossible ({e}), réglages par défaut");
            return NotifFile::default();
        }
    };

    match serde_json::from_str::<NotifFile>(&raw) {
        Ok(file) => file,
        Err(e) => {
            // On ne détruit pas des données qu'on ne sait pas relire.
            let backup = path.with_extension("corrupt.json");
            let _ = fs::rename(path, &backup);
            eprintln!(
                "notifications : fichier illisible ({e}), mis de côté dans {}",
                backup.display()
            );
            NotifFile::default()
        }
    }
}

/// Écriture atomique : un fichier temporaire puis un `rename`, pour qu'une
/// coupure ne laisse jamais un JSON tronqué en place.
fn write(path: &Path, file: &NotifFile) {
    let json = match serde_json::to_string_pretty(file) {
        Ok(json) => json,
        Err(e) => {
            eprintln!("notifications : sérialisation impossible ({e})");
            return;
        }
    };
    let tmp = path.with_extension("json.tmp");
    if let Err(e) = fs::write(&tmp, json).and_then(|()| fs::rename(&tmp, path)) {
        eprintln!("notifications : écriture impossible ({e})");
        let _ = fs::remove_file(&tmp);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::notifications::rules::inactivity;
    use crate::notifications::test_support::entry;

    fn tmp() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().expect("dossier temporaire");
        let path = dir.path().join("notifications.json");
        (dir, path)
    }

    #[test]
    fn fichier_absent_donne_les_defauts_et_les_regles_connues() {
        let (_dir, path) = tmp();
        let store = NotifStore::load(path.clone());
        let file = store.read();
        assert!(file.preferences.enabled);
        assert_eq!(file.preferences.daily_cap, 2);
        assert_eq!(file.preferences.quiet_hours.start, 8);
        assert!(file.preferences.rules.contains_key(inactivity::ID));
        assert!(file.log.is_empty());
        // Les défauts sont matérialisés sur le disque dès le premier chargement.
        assert!(path.exists());
    }

    #[test]
    fn aller_retour_sur_le_disque() {
        let (_dir, path) = tmp();
        let store = NotifStore::load(path.clone());
        store.update(|f| {
            f.preferences.daily_cap = 5;
            f.push(entry("2026-07-27 09:00:00", &["a"], &["a:1"]));
        });

        let relu = NotifStore::load(path).read();
        assert_eq!(relu.preferences.daily_cap, 5);
        assert_eq!(relu.log.len(), 1);
        assert_eq!(relu.log[0].dedupe_keys, vec!["a:1"]);
        assert_eq!(relu.unread(), 1);
    }

    #[test]
    fn fichier_corrompu_est_mis_de_cote_pas_ecrase() {
        let (_dir, path) = tmp();
        fs::write(&path, "{ ceci n'est pas du JSON").unwrap();

        let file = NotifStore::load(path.clone()).read();
        assert!(file.preferences.enabled, "on repart sur les défauts");

        let backup = path.with_extension("corrupt.json");
        assert!(backup.exists(), "l'original est conservé");
        assert!(fs::read_to_string(backup).unwrap().contains("ceci"));
    }

    #[test]
    fn reglages_partiels_completes_sans_perte() {
        // Fichier d'une version antérieure : pas de `state`, pas de `rules`,
        // un seul réglage global personnalisé.
        let (_dir, path) = tmp();
        fs::write(&path, r#"{"version":1,"preferences":{"daily_cap":7},"log":[]}"#).unwrap();

        let file = NotifStore::load(path).read();
        assert_eq!(file.preferences.daily_cap, 7, "le choix existant survit");
        assert!(file.preferences.enabled, "les champs absents prennent leur défaut");
        assert!(
            file.preferences.rules.contains_key(inactivity::ID),
            "les règles apparues depuis sont ajoutées"
        );
    }

    #[test]
    fn reglage_de_regle_existant_n_est_pas_reinitialise() {
        let (_dir, path) = tmp();
        fs::write(
            &path,
            r#"{"preferences":{"rules":{"inactivity":{"enabled":false,"cooldown_h":12,"days":9}}}}"#,
        )
        .unwrap();

        let file = NotifStore::load(path).read();
        let rp = &file.preferences.rules[inactivity::ID];
        assert!(!rp.enabled);
        assert_eq!(rp.cooldown_h, 12);
        assert_eq!(rp.param_i64("days", 3), 9);
    }

    #[test]
    fn le_journal_est_borne() {
        let (_dir, path) = tmp();
        let store = NotifStore::load(path);
        store.update(|f| {
            for _ in 0..(super::super::model::LOG_MAX + 20) {
                f.push(entry("2026-07-27 09:00:00", &["a"], &["a:1"]));
            }
        });
        assert_eq!(store.read().log.len(), super::super::model::LOG_MAX);
    }
}
