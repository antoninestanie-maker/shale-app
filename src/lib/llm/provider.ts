// ─────────────────────────────────────────────────────────────────────────────
// Accès au LLM — interface unique.
//
// Tout ce qui a besoin d'un modèle passe par `resolveCredentials()`. Aucun
// appelant ne lit une clé d'API directement : c'est ce qui rend l'ajout d'un
// mode « clé Shale incluse » possible sans refonte.
//
//   source = 'user_key'       l'utilisateur fournit SA clé (Gemini ou Groq)
//   source = 'shale_managed'  add-on payant (+3-5 €/mois) : la requête part vers
//                             un relais Shale qui porte la clé côté serveur.
//
// ⚠️ `shale_managed` N'EST PAS IMPLÉMENTÉ (2026-08-02). Le point d'extension est
// posé et documenté ci-dessous ; `resolveCredentials()` ne renvoie aujourd'hui
// que des candidats `user_key`. Voir `MANAGED_ENDPOINT` pour ce qu'il restera à
// écrire le jour venu.
// ─────────────────────────────────────────────────────────────────────────────
import { getSetting } from "../repo";
import { getSecret, setSecret } from "./secrets";

/** Fournisseurs de modèle supportés. */
export type LlmVendor = "gemini" | "groq";

/** Préférence utilisateur (Réglages → market-brain). */
export type LlmVendorPref = "auto" | LlmVendor;

/** D'où vient l'autorisation d'appeler le modèle. */
export type LlmSource = "user_key" | "shale_managed";

/** Clés `settings` / trousseau. Un seul endroit qui les nomme. */
export const SECRET_KEYS = {
  gemini: "market.gemini_key",
  groq: "market.groq_key",
} as const;

const VENDOR_PREF_KEY = "market.llm_provider";

/**
 * De quoi émettre UN appel : le fournisseur, et le porteur d'autorisation.
 *
 * `key` est vide quand `source === 'shale_managed'` — dans ce cas c'est le
 * relais qui authentifie, l'app n'a aucun secret à porter.
 */
export interface LlmCredentials {
  vendor: LlmVendor;
  source: LlmSource;
  key: string;
}

/**
 * Point d'extension « clé Shale incluse ».
 *
 * Le jour où l'add-on existe, il faudra :
 *   1. lire le droit (`useEntitlements()` gagnera un `hasManagedLlm`, alimenté
 *      par une colonne `addon_llm` de `subscriptions`) ;
 *   2. renvoyer ici un candidat `{ source: 'shale_managed', key: '' }` EN TÊTE
 *      de la liste, la clé personnelle restant en repli ;
 *   3. router l'appel HTTP vers `MANAGED_ENDPOINT` avec le JWT Supabase en
 *      `Authorization`, au lieu de l'endpoint public du fournisseur.
 *
 * Rien d'autre ne bouge : `market/llm.ts` consomme déjà une liste de candidats
 * et ne sait pas d'où vient l'autorisation.
 */
export const MANAGED_ENDPOINT = null as string | null;

/** Préférence de fournisseur enregistrée. */
export async function getVendorPref(): Promise<LlmVendorPref> {
  const v = await getSetting(VENDOR_PREF_KEY);
  return v === "gemini" || v === "groq" ? v : "auto";
}

export async function getApiKey(vendor: LlmVendor): Promise<string | null> {
  return getSecret(SECRET_KEYS[vendor]);
}

export async function setApiKey(vendor: LlmVendor, key: string): Promise<void> {
  await setSecret(SECRET_KEYS[vendor], key);
}

/** Vrai si au moins un accès au modèle est configuré. */
export async function hasAnyCredentials(): Promise<boolean> {
  return (await resolveCredentials()).length > 0;
}

/**
 * Candidats d'appel, DANS L'ORDRE d'essai.
 *
 * En `auto`, Gemini d'abord (analyse plus fine) et Groq en repli — c'est
 * `market/llm.ts` qui décide sur quels codes HTTP il bascule.
 */
export async function resolveCredentials(
  pref?: LlmVendorPref,
): Promise<LlmCredentials[]> {
  const preference = pref ?? (await getVendorPref());

  // ── Extension future ──────────────────────────────────────────────────────
  // if (await hasManagedLlmAddon()) {
  //   return [{ vendor: "gemini", source: "shale_managed", key: "" }, ...userKeys];
  // }

  const [gemini, groq] = await Promise.all([getApiKey("gemini"), getApiKey("groq")]);
  const order: LlmVendor[] =
    preference === "gemini" ? ["gemini"] : preference === "groq" ? ["groq"] : ["gemini", "groq"];

  const keys: Record<LlmVendor, string | null> = { gemini, groq };
  return order
    .filter((v) => !!keys[v])
    .map((v) => ({ vendor: v, source: "user_key" as const, key: keys[v]! }));
}
