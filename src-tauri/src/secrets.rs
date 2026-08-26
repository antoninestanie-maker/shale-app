//! Stockage chiffré des secrets (clés d'API LLM) dans le **trousseau système** :
//! Keychain sur macOS, **Credential Manager** sur Windows. Le code ci-dessous est
//! le même partout — seule la feature `keyring` change, dans `Cargo.toml`.
//!
//! Motif : la base `shale.db` vit en clair dans le dossier de données de l'app
//! (`~/Library/Application Support/…` sur macOS, `%APPDATA%\…` sur Windows).
//! N'importe quel processus lancé sous le même compte peut la lire. Le trousseau,
//! lui, est chiffré au repos et son déverrouillage est géré par le système.
//!
//! ⚠️ Windows : le blob d'un identifiant est **plafonné à 2560 octets** par
//! l'API `CredWrite`, et la valeur y est stockée en UTF-16 — soit ~1280
//! caractères utiles. Largement au-dessus d'une clé d'API LLM (~100 caractères),
//! mais c'est une limite dure : ce module ne doit jamais servir à ranger autre
//! chose que des secrets courts. Un dépassement remonte en `Err`, que le front
//! traite déjà comme « trousseau indisponible » et rabat sur `settings`.
//!
//! ⚠️ Ce n'est PAS une protection contre un utilisateur malveillant sur sa propre
//! machine — l'app peut lire ses propres entrées, donc un binaire qui se fait
//! passer pour elle le peut aussi. C'est une protection contre la fuite passive :
//! sauvegarde Time Machine, sync iCloud du dossier, exfiltration d'un fichier.
//!
//! Le front NE DOIT PAS supposer que ces commandes réussissent : sur une machine
//! au trousseau verrouillé ou non standard, `keyring` échoue. `lib/llm/secrets.ts`
//! retombe alors sur la table `settings` — le comportement d'avant ce module.

use keyring::Entry;

/// Espace de nommage des entrées du trousseau. Une entrée par clé logique.
const SERVICE: &str = "com.atnfx.shale";

fn entry(key: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, key).map_err(|e| e.to_string())
}

/// Lit un secret. `Ok(None)` = absent (ce n'est pas une erreur).
#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Écrit un secret. Une valeur vide SUPPRIME l'entrée : `set("")` depuis un champ
/// vidé par l'utilisateur doit effacer la clé, pas stocker une chaîne vide.
#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    let e = entry(&key)?;
    if value.is_empty() {
        return match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(err) => Err(err.to_string()),
        };
    }
    e.set_password(&value).map_err(|err| err.to_string())
}

/// Supprime un secret. Absent = succès (idempotent).
#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Vrai si le trousseau est utilisable sur cette machine. Le front s'en sert pour
/// afficher honnêtement où la clé est rangée, plutôt que de promettre un
/// chiffrement qui n'a pas eu lieu.
#[tauri::command]
pub fn secret_available() -> bool {
    // Un aller-retour sur une entrée jetable : c'est le seul test fiable, la
    // simple construction d'une `Entry` n'ouvre pas le trousseau.
    let probe = "__shale_probe__";
    match entry(probe) {
        Ok(e) => {
            let ok = e.set_password("1").is_ok();
            if ok {
                let _ = e.delete_credential();
            }
            ok
        }
        Err(_) => false,
    }
}
