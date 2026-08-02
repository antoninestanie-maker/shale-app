import { isTauri } from "../repo";
import { PARAMS_KDF, type ParamsKdf } from "./crypto";

/**
 * Pont vers Argon2id (`src-tauri/src/crypto.rs`).
 *
 * Fin par construction : tout ce qui peut être testé sans Tauri vit dans
 * `crypto.ts`, qui ne manipule que des clés déjà dérivées. Ici il ne reste que
 * l'appel IPC — donc rien à tester unitairement, mais quelques décisions à
 * expliquer.
 *
 * ─── PAS DE REPLI PBKDF2, ET C'EST VOLONTAIRE ──────────────────────────────
 * La tentation serait de retomber sur PBKDF2 (disponible dans WebCrypto) quand
 * le Rust ne répond pas. Ce serait un piège : PBKDF2 et Argon2id produisent des
 * clés DIFFÉRENTES pour le même mot de passe. Une enveloppe scellée par l'un ne
 * s'ouvre pas avec l'autre. Un repli silencieux fabriquerait donc des données
 * illisibles — le pire mode d'échec possible, puisqu'il ne se voit qu'après
 * coup, quand la sauvegarde est déjà censée exister.
 *
 * On échoue donc franchement. En preview navigateur, il n'y a de toute façon ni
 * SQLite ni synchronisation : le mode démo n'a rien à chiffrer.
 */

/**
 * Levée quand la dérivation n'est pas possible sur cette plateforme.
 *
 * L'erreur d'origine est portée par `origine` et non par le `cause` standard :
 * le projet compile en ES2020, où `Error.cause` n'existe pas encore. Relever la
 * cible pour ce seul champ serait un changement global disproportionné.
 */
export class KdfIndisponible extends Error {
  readonly origine?: unknown;

  constructor(origine?: unknown) {
    super(
      "La synchronisation chiffrée nécessite l'application native : " +
        "la dérivation de clé (Argon2id) n'est pas disponible ici.",
    );
    this.name = "KdfIndisponible";
    this.origine = origine;
  }
}

/**
 * Transforme un secret utilisateur (mot de passe, code de récupération) en clé
 * de 32 octets.
 *
 * ⚠️ Coûteux À DESSEIN : ~150 ms avec les paramètres de production. C'est ce qui
 * rend une attaque par dictionnaire ruineuse. À n'appeler qu'au déverrouillage,
 * JAMAIS sur le chemin d'une écriture — sans quoi tout le principe
 * offline-first tomberait.
 *
 * Les `params` viennent de l'enveloppe qu'on cherche à ouvrir, pas des valeurs
 * courantes : c'est ce qui permettra de durcir les réglages un jour sans rendre
 * les anciennes enveloppes illisibles.
 */
export async function deriverKek(
  secret: string,
  sel: Uint8Array,
  params: ParamsKdf = PARAMS_KDF,
): Promise<Uint8Array> {
  if (!isTauri) throw new KdfIndisponible();

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    // Tauri convertit les noms camelCase en snake_case côté Rust.
    const octets = await invoke<number[]>("kdf_argon2id", {
      secret,
      sel: Array.from(sel),
      memoireKio: params.memoireKio,
      passes: params.passes,
      parallelisme: params.parallelisme,
    });
    if (octets.length !== 32) throw new Error(`clé de ${octets.length} octets, 32 attendus`);
    return Uint8Array.from(octets);
  } catch (e) {
    if (e instanceof KdfIndisponible) throw e;
    throw new KdfIndisponible(e);
  }
}
