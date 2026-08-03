/**
 * Transport vers Supabase.
 *
 * Isolé derrière une interface pour deux raisons : le moteur se teste alors
 * contre un serveur simulé (qui applique les mêmes règles), et le jour où le
 * stockage changerait, rien d'autre ne bougerait.
 */

/** Une ligne telle qu'elle vit chez Supabase. Rien n'y est lisible. */
export interface LigneDistante {
  table_tag: string;
  row_tag: string;
  /** Horloge du SERVEUR — curseur de pagination. Jamais un arbitre de conflit. */
  server_seq: number;
  /** Horloge de l'APPAREIL auteur — arbitre du last-write-wins. */
  client_ts: string;
  device_id: string;
  deleted: boolean;
  payload: Uint8Array | null;
}

/** Ce qu'on envoie : identique, moins `server_seq` que le serveur pose lui-même. */
export type LigneAEnvoyer = Omit<LigneDistante, "server_seq">;

export interface Transport {
  pousser(lignes: LigneAEnvoyer[]): Promise<void>;
  /** Lignes de `server_seq` strictement supérieur au curseur, dans l'ordre. */
  tirer(curseur: number, limite: number): Promise<LigneDistante[]>;
}

// ─── Encodage des octets pour PostgREST ──────────────────────────────────────

/**
 * ⚠️ PostgREST transporte un `bytea` en HEXADÉCIMAL PRÉFIXÉ (`"\\x48656c6c6f"`),
 * pas en base64. Envoyer du base64 ne provoquerait aucune erreur : Postgres le
 * prendrait pour du texte et le stockerait tel quel, illisible à la relecture —
 * une corruption silencieuse, découverte des semaines plus tard.
 */
export function versHex(octets: Uint8Array): string {
  let hex = "";
  for (const o of octets) hex += o.toString(16).padStart(2, "0");
  return `\\x${hex}`;
}

export function depuisHex(texte: string): Uint8Array {
  const hex = texte.startsWith("\\x") ? texte.slice(2) : texte;
  const octets = new Uint8Array(hex.length / 2);
  for (let i = 0; i < octets.length; i++) octets[i] = parseInt(hex.substr(i * 2, 2), 16);
  return octets;
}

// ─── Implémentation Supabase ─────────────────────────────────────────────────

export interface ConfigSupabase {
  url: string;
  anonKey: string;
  /** Jeton de la session en cours. Doit être frais : PostgREST le vérifie. */
  accessToken: string;
  userId: string;
}

/**
 * ⚠️ Cette classe est la seule pièce du chantier qui ne PEUT PAS être testée
 * ici : elle n'existe que pour parler à un vrai Supabase. Le moteur, lui, est
 * testé contre un serveur simulé qui applique les mêmes règles. Ce qui reste à
 * vérifier sur le projet réel tient donc dans ce fichier — d'où sa petitesse
 * délibérée : aucune logique, uniquement de la mise en forme.
 */
export class TransportSupabase implements Transport {
  constructor(private readonly config: ConfigSupabase) {}

  private entetes(extra: Record<string, string> = {}): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.accessToken}`,
      ...extra,
    };
  }

  async pousser(lignes: LigneAEnvoyer[]): Promise<void> {
    if (lignes.length === 0) return;
    const corps = lignes.map((l) => ({
      user_id: this.config.userId,
      table_tag: l.table_tag,
      row_tag: l.row_tag,
      client_ts: l.client_ts,
      device_id: l.device_id,
      deleted: l.deleted,
      payload: l.payload ? versHex(l.payload) : null,
    }));

    const res = await fetch(`${this.config.url}/rest/v1/sync_rows`, {
      method: "POST",
      headers: this.entetes({
        // Sans `merge-duplicates`, un renvoi échouerait sur la clé primaire au
        // lieu de mettre à jour. `return=minimal` évite de rapatrier ce qu'on
        // vient d'envoyer.
        Prefer: "resolution=merge-duplicates,return=minimal",
      }),
      body: JSON.stringify(corps),
    });
    if (!res.ok) throw new Error(`envoi refusé (${res.status}) : ${await res.text()}`);
  }

  async tirer(curseur: number, limite: number): Promise<LigneDistante[]> {
    const url = new URL(`${this.config.url}/rest/v1/sync_rows`);
    url.searchParams.set("select", "table_tag,row_tag,server_seq,client_ts,device_id,deleted,payload");
    url.searchParams.set("server_seq", `gt.${curseur}`);
    url.searchParams.set("order", "server_seq.asc");
    url.searchParams.set("limit", String(limite));

    const res = await fetch(url.toString(), { headers: this.entetes() });
    if (!res.ok) throw new Error(`lecture refusée (${res.status}) : ${await res.text()}`);

    const brut = (await res.json()) as (Omit<LigneDistante, "payload"> & { payload: string | null })[];
    return brut.map((l) => ({ ...l, payload: l.payload ? depuisHex(l.payload) : null }));
  }
}
