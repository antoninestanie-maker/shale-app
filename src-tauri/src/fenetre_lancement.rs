//! La taille de la fenêtre principale, posée AVANT la première image.
//!
//! ⭐ 2026-10-20. Personnaliser → « taille de fenêtre au lancement » enregistre
//! une taille dans `ui.config` (`window: { width, height }`, en points). Jusqu'ici
//! c'est le front qui l'appliquait (`App.tsx`), donc une fois l'app chargée —
//! c'est-à-dire PENDANT la transition d'entrée : la fenêtre s'ouvrait en
//! 1120 × 780 (`tauri.conf.json`), l'icône s'allumait au centre, puis la fenêtre
//! grandissait et l'icône sautait vers le nouveau centre. Vu au vrai lancement le
//! 2026-10-20 (taille d'Antonin : 1470 × 923).
//!
//! Le Rust lit le réglage dans `setup`, avant que la page ne soit chargée, et
//! redimensionne la fenêtre à ce moment-là : la première image peinte (le fond
//! nuit et l'icône de `index.html`) l'est déjà à la taille finale. Le front
//! garde son propre `setSize`, qui ne fait plus rien (même taille), en filet si
//! la lecture d'ici a échoué.
//!
//! ⚠️ La règle de lecture recopie `mergeConfig` (`src/lib/uiConfig.ts`) : deux
//! nombres, sinon rien. Si elle changeait là-bas, la changer ici.

use std::path::Path;

use sqlx::sqlite::{SqliteConnectOptions, SqliteJournalMode};
use sqlx::{Connection, Row, SqliteConnection};

/// La taille mémorisée, lue dans le JSON de `ui.config`. `None` = rien à faire.
pub fn taille_memorisee(json: &str) -> Option<(f64, f64)> {
    let v: serde_json::Value = serde_json::from_str(json).ok()?;
    let w = v.get("window")?;
    let largeur = w.get("width")?.as_f64()?;
    let hauteur = w.get("height")?.as_f64()?;
    (largeur.is_finite() && hauteur.is_finite() && largeur > 0.0 && hauteur > 0.0)
        .then_some((largeur, hauteur))
}

/// Lit `ui.config` dans la base. Toute erreur rend `None` : sans réglage lisible,
/// la fenêtre garde la taille de `tauri.conf.json`, comme avant.
pub async fn lire(db: &Path) -> Option<(f64, f64)> {
    if !db.exists() {
        return None;
    }
    // Ouverture en lecture-écriture, SELECT seulement : une connexion
    // `read_only` échoue sur une base en WAL dont le `-shm` n'existe pas encore
    // (cf. notifications/README).
    let options = SqliteConnectOptions::new()
        .filename(db)
        .create_if_missing(false)
        .journal_mode(SqliteJournalMode::Wal);
    let mut conn = SqliteConnection::connect_with(&options).await.ok()?;
    let ligne = sqlx::query("SELECT value FROM settings WHERE key = 'ui.config'")
        .fetch_optional(&mut conn)
        .await
        .ok()??;
    let json: String = ligne.try_get("value").ok()?;
    let _ = conn.close().await;
    taille_memorisee(&json)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lit_la_taille_enregistree() {
        let json = r#"{"modules":[],"window":{"width":1470,"height":923},"zoom":110}"#;
        assert_eq!(taille_memorisee(json), Some((1470.0, 923.0)));
    }

    #[test]
    fn sans_taille_ne_fait_rien() {
        assert_eq!(taille_memorisee(r#"{"window":null}"#), None);
        assert_eq!(taille_memorisee(r#"{"zoom":100}"#), None);
        assert_eq!(taille_memorisee(r#"{"window":{"width":"1470","height":923}}"#), None);
        assert_eq!(taille_memorisee(r#"{"window":{"width":0,"height":923}}"#), None);
        assert_eq!(taille_memorisee("pas du json"), None);
    }
}
