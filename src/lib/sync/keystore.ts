import { depuisBase64, versBase64 } from "./crypto";
import type { DepotEnveloppes, Enveloppes } from "./keys";
import { depuisHex, versHex, type ConfigSupabase } from "./transport";

/**
 * Branchement système : où la clé de données est rangée sur la machine, et où
 * les enveloppes sont rangées chez Supabase.
 *
 * Aucune logique ici — elle vit dans `keys.ts`, qui se teste. Ce fichier n'est
 * que de la plomberie, et sa petitesse est délibérée : c'est la partie qu'on ne
 * peut pas éprouver hors de l'app native.
 */

/** Entrée du trousseau macOS. Le même service que les clés d'API LLM. */
const CLE_TROUSSEAU = "sync.dek";

/**
 * Repli en MÉMOIRE quand le trousseau ne répond pas.
 *
 * ⚠️ On ne retombe PAS sur la table `settings`, contrairement aux clés d'API
 * LLM. La différence est réelle : une clé d'API en clair dans `shale.db` ne
 * donne accès qu'à un service tiers, alors que la clé de données en clair à
 * côté de la base qu'elle protège annulerait tout l'intérêt du chiffrement de
 * la copie CLOUD. Sans trousseau, la clé vit donc le temps de la session et le
 * mot de passe est redemandé au lancement suivant. C'est un peu de friction,
 * assumée, plutôt qu'une promesse de confidentialité qui n'aurait pas lieu.
 */
let dekEnMemoire: Uint8Array | null = null;

async function invoquer<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Range la clé. Renvoie `true` si elle survivra à la fermeture de l'app. */
export async function rangerDek(dek: Uint8Array): Promise<boolean> {
  dekEnMemoire = dek;
  try {
    await invoquer("secret_set", { key: CLE_TROUSSEAU, value: versBase64(dek) });
    return true;
  } catch {
    return false;
  }
}

/** Relit la clé. `null` = il faudra redemander le mot de passe. */
export async function lireDek(): Promise<Uint8Array | null> {
  if (dekEnMemoire) return dekEnMemoire;
  try {
    const brut = await invoquer<string | null>("secret_get", { key: CLE_TROUSSEAU });
    if (!brut) return null;
    dekEnMemoire = depuisBase64(brut);
    return dekEnMemoire;
  } catch {
    return null;
  }
}

/** Oublie la clé — déconnexion, ou désactivation de la synchronisation. */
export async function oublierDek(): Promise<void> {
  dekEnMemoire = null;
  try {
    await invoquer("secret_delete", { key: CLE_TROUSSEAU });
  } catch {
    /* trousseau indisponible : il n'y avait rien d'écrit de toute façon */
  }
}

// ─── Enveloppes chez Supabase ────────────────────────────────────────────────

/** Ce que PostgREST renvoie : les `bytea` en hexadécimal préfixé. */
interface EnveloppesBrutes {
  key_version: number;
  kdf: string;
  kdf_memory_kib: number;
  kdf_passes: number;
  kdf_parallelism: number;
  salt_password: string;
  wrapped_password: string;
  salt_recovery: string | null;
  wrapped_recovery: string | null;
}

const CHAMPS =
  "key_version,kdf,kdf_memory_kib,kdf_passes,kdf_parallelism,salt_password,wrapped_password,salt_recovery,wrapped_recovery";

export class DepotSupabase implements DepotEnveloppes {
  constructor(private readonly config: ConfigSupabase) {}

  private entetes(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.accessToken}`,
      ...extra,
    };
  }

  async lire(): Promise<Enveloppes | null> {
    const url = new URL(`${this.config.url}/rest/v1/sync_keys`);
    url.searchParams.set("select", CHAMPS);
    url.searchParams.set("user_id", `eq.${this.config.userId}`);
    url.searchParams.set("limit", "1");

    const res = await fetch(url.toString(), { headers: this.entetes() });
    if (!res.ok) throw new Error(`lecture des clés refusée (${res.status}) : ${await res.text()}`);

    const lignes = (await res.json()) as EnveloppesBrutes[];
    const e = lignes[0];
    if (!e) return null;

    return {
      ...e,
      salt_password: depuisHex(e.salt_password),
      wrapped_password: depuisHex(e.wrapped_password),
      salt_recovery: e.salt_recovery ? depuisHex(e.salt_recovery) : null,
      wrapped_recovery: e.wrapped_recovery ? depuisHex(e.wrapped_recovery) : null,
    };
  }

  async ecrire(e: Enveloppes): Promise<void> {
    const corps = {
      user_id: this.config.userId,
      key_version: e.key_version,
      kdf: e.kdf,
      kdf_memory_kib: e.kdf_memory_kib,
      kdf_passes: e.kdf_passes,
      kdf_parallelism: e.kdf_parallelism,
      salt_password: versHex(e.salt_password),
      wrapped_password: versHex(e.wrapped_password),
      salt_recovery: e.salt_recovery ? versHex(e.salt_recovery) : null,
      wrapped_recovery: e.wrapped_recovery ? versHex(e.wrapped_recovery) : null,
    };

    const res = await fetch(`${this.config.url}/rest/v1/sync_keys`, {
      method: "POST",
      headers: this.entetes({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify(corps),
    });
    if (!res.ok) throw new Error(`écriture des clés refusée (${res.status}) : ${await res.text()}`);
  }
}
