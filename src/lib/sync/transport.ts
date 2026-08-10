/**
 * Transport vers Supabase.
 *
 * Isolé derrière une interface pour deux raisons : le moteur se teste alors
 * contre un serveur simulé (qui applique les mêmes règles), et le jour où le
 * stockage changerait, rien d'autre ne bougerait.
 */

import { requete, SessionExpiree } from "./http";

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
  const octets = new Uint8Array(hex.length >> 1);
  for (let i = 0; i < octets.length; i++) octets[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return octets;
}

// ─── Implémentation Supabase ─────────────────────────────────────────────────

export interface ConfigSupabase {
  url: string;
  anonKey: string;
  /**
   * Fournit un jeton VALABLE, et le renouvelle si besoin.
   *
   * ⚠️ C'était un `string` — c'est-à-dire une photographie prise au montage du
   * composant. Or un jeton Supabase vit UNE HEURE, et `useAuth` ne le
   * renouvelait qu'au démarrage de l'app : une app laissée ouverte cessait de
   * synchroniser au bout d'une heure, en silence, jusqu'au redémarrage. Un
   * défaut invisible en test (le serveur simulé n'a pas de jeton) et invisible
   * en session courte — donc invisible partout sauf en usage réel.
   *
   * `forcer` sert quand le serveur refuse un jeton que l'app croyait frais.
   */
  jeton: (forcer?: boolean) => Promise<string>;
  userId: string;
}

/** Le bucket privé des charges trop lourdes pour la table. Cf. `sync.sql`. */
const BUCKET = "sync-blobs";

/**
 * ⚠️ Cette classe est la seule pièce du chantier qui ne PEUT PAS être testée
 * contre un vrai serveur ici : elle n'existe que pour parler à Supabase. Le
 * moteur, lui, est testé contre un serveur simulé qui applique les mêmes
 * règles. Ce qui reste à vérifier sur le projet réel tient donc dans ce
 * fichier — d'où sa petitesse délibérée : aucune logique, uniquement de la
 * mise en forme et le nommage des échecs.
 */
export class TransportSupabase implements Transport {
  constructor(private readonly config: ConfigSupabase) {}

  private entetes(jeton: string, extra: Record<string, string> = {}): Record<string, string> {
    return {
      "Content-Type": "application/json",
      apikey: this.config.anonKey,
      Authorization: `Bearer ${jeton}`,
      ...extra,
    };
  }

  /**
   * Exécute avec un jeton frais, et REPREND UNE FOIS si le serveur le refuse
   * quand même. Une seule reprise : si le jeton renouvelé est refusé lui aussi,
   * l'expiration n'était pas la cause et insister ne ferait que multiplier les
   * appels à GoTrue.
   */
  private async avecJeton<T>(faire: (jeton: string) => Promise<T>): Promise<T> {
    try {
      return await faire(await this.config.jeton());
    } catch (e) {
      if (!(e instanceof SessionExpiree)) throw e;
      return faire(await this.config.jeton(true));
    }
  }

  async pousser(lignes: LigneAEnvoyer[]): Promise<void> {
    if (lignes.length === 0) return;
    const corps = JSON.stringify(
      lignes.map((l) => ({
        user_id: this.config.userId,
        table_tag: l.table_tag,
        row_tag: l.row_tag,
        client_ts: l.client_ts,
        device_id: l.device_id,
        deleted: l.deleted,
        payload: l.payload ? versHex(l.payload) : null,
      })),
    );

    await this.avecJeton((jeton) =>
      requete(`${this.config.url}/rest/v1/sync_rows`, {
        methode: "POST",
        // Sans `merge-duplicates`, un renvoi échouerait sur la clé primaire au
        // lieu de mettre à jour. `return=minimal` évite de rapatrier ce qu'on
        // vient d'envoyer.
        entetes: this.entetes(jeton, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        corps,
      }),
    );
  }

  async tirer(curseur: number, limite: number): Promise<LigneDistante[]> {
    const url = new URL(`${this.config.url}/rest/v1/sync_rows`);
    url.searchParams.set(
      "select",
      "table_tag,row_tag,server_seq,client_ts,device_id,deleted,payload,payload_ref",
    );
    url.searchParams.set("server_seq", `gt.${curseur}`);
    url.searchParams.set("order", "server_seq.asc");
    url.searchParams.set("limit", String(limite));

    const res = await this.avecJeton((jeton) =>
      requete(url.toString(), { entetes: this.entetes(jeton) }),
    );

    type Brute = Omit<LigneDistante, "payload"> & { payload: string | null; payload_ref: string | null };
    const brut = (await res.json()) as Brute[];

    const lignes: LigneDistante[] = [];
    for (const l of brut) {
      lignes.push({
        table_tag: l.table_tag,
        row_tag: l.row_tag,
        server_seq: l.server_seq,
        client_ts: l.client_ts,
        device_id: l.device_id,
        deleted: l.deleted,
        payload: await this.charge(l.payload, l.payload_ref),
      });
    }
    return lignes;
  }

  /**
   * Une charge vit soit dans la colonne, soit dans le bucket — jamais les deux.
   * Le bucket est résolu ICI plutôt que dans le moteur : le moteur ne doit
   * connaître qu'une seule forme de ligne, et le serveur simulé des tests reste
   * ainsi une représentation fidèle de ce qu'il reçoit.
   *
   * ⚠️ ASYMÉTRIE ASSUMÉE : la LECTURE du bucket est implémentée, l'ÉCRITURE ne
   * l'est pas — l'app n'émet aujourd'hui que des charges en colonne. Le sens
   * lecture est le seul qui doive exister en premier : c'est celui qui permet
   * à un appareil d'aujourd'hui de ne pas s'étrangler sur une ligne écrite par
   * une version ultérieure. L'inverse (écrire sans savoir relire) fabriquerait
   * des lignes que le parc installé ne saurait pas lire.
   */
  private async charge(payload: string | null, ref: string | null): Promise<Uint8Array | null> {
    if (payload) return depuisHex(payload);
    if (!ref) return null;

    // Le chemin est relatif au bucket (`<user_id>/<table_tag>/<row_tag>`) : la
    // politique de `sync.sql` compare son premier segment à `auth.uid()`.
    const chemin = ref.split("/").map(encodeURIComponent).join("/");
    const res = await this.avecJeton((jeton) =>
      requete(`${this.config.url}/storage/v1/object/${BUCKET}/${chemin}`, {
        entetes: { apikey: this.config.anonKey, Authorization: `Bearer ${jeton}` },
      }),
    );
    return new Uint8Array(await res.arrayBuffer());
  }
}
