//! Dérivation de clé pour la synchronisation chiffrée de bout en bout.
//!
//! Une seule responsabilité : transformer un secret que l'utilisateur connaît
//! (mot de passe, phrase de récupération) en une clé de 32 octets. Tout le
//! reste du chiffrement — enveloppes, chiffrement des lignes, aveuglement des
//! identifiants — vit côté TypeScript sur WebCrypto (`src/lib/sync/crypto.ts`).
//!
//! POURQUOI ICI ET PAS EN JAVASCRIPT. WebCrypto n'expose pas Argon2, seulement
//! PBKDF2. Or PBKDF2 ne coûte que du CPU : un attaquant qui met la main sur les
//! enveloppes (elles vivent chez Supabase) peut en tester des milliards par
//! seconde sur des GPU. Argon2id coûte de la MÉMOIRE, ce qui rend le
//! parallélisme massif bien plus cher. C'est la seule ligne de défense entre un
//! mot de passe faible et les données ; elle mérite la dépendance.
//!
//! CE QUE ÇA NE PROTÈGE PAS. Un attaquant déjà présent sur la machine, sous le
//! même compte utilisateur. La clé dérivée transite par l'IPC Tauri et vit en
//! mémoire du processus. Ce module protège les données STOCKÉES CHEZ SUPABASE,
//! pas la machine.

use argon2::{Algorithm, Argon2, Params, Version};

/// Longueur de la clé produite : 32 octets = AES-256.
const LONGUEUR_CLE: usize = 32;

/// Un sel plus court n'a pas de sens : il est là pour qu'un même mot de passe
/// ne donne pas la même clé chez deux utilisateurs, ce qui rendrait les tables
/// pré-calculées rentables.
const SEL_MINIMUM: usize = 16;

/// Garde-fou contre des paramètres qui feraient ramer la machine ou, pire, qui
/// affaibliraient silencieusement la dérivation. Les valeurs employées sont
/// fixées côté TypeScript et versionnées avec l'enveloppe ; ces bornes
/// n'existent que pour qu'un appel fautif échoue au lieu de passer.
const MEMOIRE_MIN_KIO: u32 = 8 * 1024; // 8 Mio
const MEMOIRE_MAX_KIO: u32 = 512 * 1024; // 512 Mio
const PASSES_MIN: u32 = 1;
const PASSES_MAX: u32 = 16;

/// Dérive une clé de 32 octets depuis un secret utilisateur.
///
/// `memoire_kio` / `passes` / `parallelisme` sont les paramètres Argon2id. Ils
/// sont fournis par l'appelant et stockés à côté de l'enveloppe : c'est ce qui
/// permettra de les durcir un jour sans rendre les anciennes enveloppes
/// illisibles.
#[tauri::command]
pub fn kdf_argon2id(
    secret: String,
    sel: Vec<u8>,
    memoire_kio: u32,
    passes: u32,
    parallelisme: u32,
) -> Result<Vec<u8>, String> {
    if secret.is_empty() {
        return Err("secret vide".into());
    }
    if sel.len() < SEL_MINIMUM {
        return Err(format!("sel trop court : {} octets, minimum {SEL_MINIMUM}", sel.len()));
    }
    if !(MEMOIRE_MIN_KIO..=MEMOIRE_MAX_KIO).contains(&memoire_kio) {
        return Err(format!("mémoire hors bornes : {memoire_kio} Kio"));
    }
    if !(PASSES_MIN..=PASSES_MAX).contains(&passes) {
        return Err(format!("nombre de passes hors bornes : {passes}"));
    }
    if parallelisme == 0 || parallelisme > 16 {
        return Err(format!("parallélisme hors bornes : {parallelisme}"));
    }

    let params = Params::new(memoire_kio, passes, parallelisme, Some(LONGUEUR_CLE))
        .map_err(|e| format!("paramètres Argon2 invalides : {e}"))?;
    let argon = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    let mut cle = vec![0u8; LONGUEUR_CLE];
    argon
        .hash_password_into(secret.as_bytes(), &sel, &mut cle)
        .map_err(|e| format!("dérivation impossible : {e}"))?;
    Ok(cle)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Paramètres volontairement FAIBLES : les tests vérifient le comportement de
    // la fonction, pas la solidité du réglage de production (qui, lui, est fixé
    // côté TypeScript et coûte ~150 ms par appel — inacceptable en boucle ici).
    const M: u32 = 8 * 1024;
    const T: u32 = 1;
    const P: u32 = 1;
    const SEL: &[u8] = b"0123456789abcdef";

    fn deriver(secret: &str, sel: &[u8]) -> Vec<u8> {
        kdf_argon2id(secret.into(), sel.to_vec(), M, T, P).expect("dérivation")
    }

    #[test]
    fn produit_une_cle_de_32_octets() {
        assert_eq!(deriver("mot de passe", SEL).len(), 32);
    }

    #[test]
    fn est_deterministe() {
        // Sans cette propriété, l'utilisateur ne pourrait jamais rouvrir ses
        // propres données : chaque déverrouillage produirait une autre clé.
        assert_eq!(deriver("mot de passe", SEL), deriver("mot de passe", SEL));
    }

    #[test]
    fn un_secret_different_donne_une_cle_differente() {
        assert_ne!(deriver("mot de passe", SEL), deriver("mot de passe ", SEL));
    }

    #[test]
    fn un_sel_different_donne_une_cle_differente() {
        // C'est ce qui empêche une table pré-calculée de servir contre tous les
        // utilisateurs à la fois.
        assert_ne!(deriver("mot de passe", SEL), deriver("mot de passe", b"fedcba9876543210"));
    }

    #[test]
    fn les_parametres_font_partie_de_la_derivation() {
        // Conséquence à connaître : durcir les paramètres change la clé. D'où
        // leur stockage à côté de l'enveloppe, et le `version` qui l'accompagne.
        let faible = kdf_argon2id("x".into(), SEL.to_vec(), M, 1, P).unwrap();
        let fort = kdf_argon2id("x".into(), SEL.to_vec(), M, 2, P).unwrap();
        assert_ne!(faible, fort);
    }

    #[test]
    fn gere_les_accents_et_les_emojis() {
        // Le secret est une chaîne UTF-8 arbitraire : un mot de passe accentué
        // ne doit pas se comporter autrement.
        assert_eq!(deriver("Épreuve—dé✓", SEL).len(), 32);
        assert_ne!(deriver("Épreuve", SEL), deriver("Epreuve", SEL));
    }

    #[test]
    fn refuse_un_sel_trop_court() {
        assert!(kdf_argon2id("x".into(), b"court".to_vec(), M, T, P).is_err());
    }

    #[test]
    fn refuse_un_secret_vide() {
        assert!(kdf_argon2id(String::new(), SEL.to_vec(), M, T, P).is_err());
    }

    #[test]
    fn refuse_des_parametres_hors_bornes() {
        assert!(kdf_argon2id("x".into(), SEL.to_vec(), 128, T, P).is_err(), "mémoire trop faible");
        assert!(kdf_argon2id("x".into(), SEL.to_vec(), M, 0, P).is_err(), "zéro passe");
        assert!(kdf_argon2id("x".into(), SEL.to_vec(), M, T, 0).is_err(), "zéro parallélisme");
    }
}
