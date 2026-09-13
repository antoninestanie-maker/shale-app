// ─────────────────────────────────────────────────────────────────────────────
// Le profil vient du serveur ; la base locale n'en garde qu'un CACHE.
//
// Table `public.license_profiles` (`shale-site/supabase/migrations/
// 005_licence_profils.sql`), une ligne par compte, lisible par son seul
// propriétaire (RLS), écrite par personne d'autre que l'administration.
//
// Trois réponses possibles, et une seule efface le cache :
//   • « voici ton profil »       → on le garde, s'il est bien signé et pour ce compte ;
//   • « tu n'as pas de profil »  → on efface : le contrat a pris fin ou a été retiré ;
//   • « je ne sais pas »         → réseau coupé, session expirée, table absente,
//                                  réponse mal formée : on NE TOUCHE À RIEN. Le
//                                  cache vit jusqu'à sa propre expiration.
//
// ⚠️ La confusion à ne jamais faire est « échec = pas de profil ». Elle
// effacerait la licence d'un client à chaque coupure Wi-Fi.
// ─────────────────────────────────────────────────────────────────────────────
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../auth/config";
import type { LigneProfil } from "./signature";

export type ReponseProfil =
  | { type: "profil"; ligne: LigneProfil }
  | { type: "aucun" }
  | { type: "inconnu" };

/** Forme stricte d'une ligne serveur. Tout écart rend `null`. */
export function ligneDepuisServeur(brut: unknown): LigneProfil | null {
  if (typeof brut !== "object" || brut === null) return null;
  const r = brut as Record<string, unknown>;
  const chaines = ["user_id", "tier", "issued_at", "expires_at", "payload", "signature"];
  if (chaines.some((c) => typeof r[c] !== "string")) return null;
  if (typeof r.profile_version !== "number" || !Number.isInteger(r.profile_version)) return null;
  return {
    uid: r.user_id as string,
    tier: r.tier as string,
    profile_version: r.profile_version,
    issued_at: r.issued_at as string,
    expires_at: r.expires_at as string,
    payload: r.payload as string,
    signature: r.signature as string,
  };
}

export async function telechargerProfil(
  jeton: string,
  userId: string,
  f: typeof fetch = fetch,
): Promise<ReponseProfil> {
  if (!jeton || !userId || !SUPABASE_URL) return { type: "inconnu" };
  const url = new URL(`${SUPABASE_URL}/rest/v1/license_profiles`);
  url.searchParams.set("user_id", `eq.${userId}`);
  url.searchParams.set(
    "select",
    "user_id,tier,profile_version,issued_at,expires_at,payload,signature",
  );
  url.searchParams.set("limit", "1");
  try {
    const res = await f(url.toString(), {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${jeton}` },
    });
    if (!res.ok) return { type: "inconnu" };
    const lignes = (await res.json()) as unknown;
    if (!Array.isArray(lignes)) return { type: "inconnu" };
    if (lignes.length === 0) return { type: "aucun" };
    const ligne = ligneDepuisServeur(lignes[0]);
    return ligne ? { type: "profil", ligne } : { type: "inconnu" };
  } catch {
    return { type: "inconnu" };
  }
}

export type DecisionCache =
  | { action: "garder" }
  | { action: "remplacer"; ligne: LigneProfil }
  | { action: "effacer" };

/**
 * Que faire du cache après un téléchargement.
 *
 * Un profil reçu mais MAL SIGNÉ ne remplace pas un cache valide : ce serait
 * laisser n'importe quelle réponse — une rotation de clé ratée, un proxy qui
 * réécrit — défaire une licence en cours. Le cache vit jusqu'à sa propre
 * expiration, puis la règle 3 du résolveur prend le relais.
 */
export function decisionApresTelechargement(
  r: ReponseProfil,
  signatureOk: boolean,
  userId: string,
): DecisionCache {
  if (r.type === "aucun") return { action: "effacer" };
  if (r.type === "profil" && signatureOk && r.ligne.uid === userId)
    return { action: "remplacer", ligne: r.ligne };
  return { action: "garder" };
}
