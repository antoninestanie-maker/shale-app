// ─────────────────────────────────────────────────────────────────────────────
// Stockage des secrets (clés d'API LLM).
//
// Ordre de préférence :
//   1. Trousseau macOS (`src-tauri/src/secrets.rs`) — chiffré au repos.
//   2. Table `settings` de shale.db — clair, mais fonctionnel partout.
//
// Le repli n'est pas décoratif : en preview navigateur il n'y a pas de Tauri du
// tout, et sur une machine au trousseau verrouillé `keyring` échoue. Une clé
// doit rester saisissable dans les deux cas.
//
// Migration : une clé déjà enregistrée en clair (avant ce module) est déplacée
// vers le trousseau à la PREMIÈRE lecture, puis effacée de `settings`. C'est
// silencieux et sans perte — l'utilisateur n'a rien à ressaisir.
// ─────────────────────────────────────────────────────────────────────────────
import { getSetting, isTauri, setSetting } from "../repo";

/** Le trousseau ne répond-il pas ? Constaté une fois, mémorisé pour la session. */
let keychainOk: boolean | null = null;

async function invokeTauri<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Trousseau disponible ? Faux hors Tauri, ou si la sonde Rust échoue. */
export async function keychainAvailable(): Promise<boolean> {
  if (!isTauri) return false;
  if (keychainOk !== null) return keychainOk;
  try {
    keychainOk = await invokeTauri<boolean>("secret_available");
  } catch {
    keychainOk = false;
  }
  return keychainOk;
}

/**
 * Lit un secret.
 * `key` est la MÊME que l'ancienne clé `settings` (ex. `market.gemini_key`) :
 * c'est ce qui rend la migration transparente.
 */
export async function getSecret(key: string): Promise<string | null> {
  if (await keychainAvailable()) {
    try {
      const fromKeychain = await invokeTauri<string | null>("secret_get", { key });
      if (fromKeychain) return fromKeychain;
      // Absent du trousseau : reste-t-il une valeur en clair d'avant ? On la
      // déplace maintenant plutôt que d'attendre une prochaine sauvegarde.
      const legacy = (await getSetting(key))?.trim();
      if (legacy) {
        try {
          await invokeTauri("secret_set", { key, value: legacy });
          await setSetting(key, ""); // la table `settings` n'a pas de DELETE exposé
        } catch {
          /* migration ratée : la valeur en clair reste, elle sert de repli */
        }
        return legacy;
      }
      return null;
    } catch {
      keychainOk = false; // le trousseau vient de lâcher : repli pour la suite
    }
  }
  const v = (await getSetting(key))?.trim();
  return v ? v : null;
}

/** Écrit un secret. Une chaîne vide efface la clé des DEUX emplacements. */
export async function setSecret(key: string, value: string): Promise<void> {
  const v = value.trim();
  if (await keychainAvailable()) {
    try {
      await invokeTauri("secret_set", { key, value: v });
      // Toujours purger l'ancien emplacement : sinon une clé effacée du
      // trousseau resterait lisible en clair dans la base.
      await setSetting(key, "");
      return;
    } catch {
      keychainOk = false;
    }
  }
  await setSetting(key, v);
}
