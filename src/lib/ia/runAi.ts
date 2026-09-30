// ─────────────────────────────────────────────────────────────────────────────
// `runAi(feature, payload)` — la SEULE entrée de l'app vers l'IA de Shale Pro.
//
// Elle appelle la fonction `ai` (Supabase Edge Function, `MANAGED_ENDPOINT`)
// avec le jeton de la session, et rend un résultat typé par fonction. L'app
// n'envoie jamais de prompt : seulement `{feature, payload}`.
//
// Ce qu'elle garantit :
//   · la réponse est REVALIDÉE ici contre le schéma de sortie, même si le
//     serveur l'a déjà fait (`bad_output` sinon) ;
//   · aucune erreur ne lève : tout échec devient un `code` que les composants
//     communs traduisent (`components/ia/EtatIa.tsx`) ;
//   · un 401 est retenté UNE fois avec un jeton renouvelé (même règle que la
//     synchronisation : un jeton Supabase vit une heure) ;
//   · en mode démo (hors Tauri), aucune requête : une réponse factice après un
//     délai réaliste.
//
// Elle NE décide PAS si l'utilisateur a le droit ni s'il a activé l'IA : c'est
// `useIa` qui le fait avant d'appeler — et le serveur, qui fait foi.
//
// ⚠️ Pas de rapport avec `lib/llm/provider.ts::resolveCredentials` : ce dernier
// sert Market Brain avec les clés Gemini/Groq de l'utilisateur, et le chantier
// n'y touche pas. Brancher la clé Shale DANS cette liste ferait passer Market
// Brain par la clé Shale.
// ─────────────────────────────────────────────────────────────────────────────

import { QUOTA_PRO, reinitialisationIa, SORTIES, type FonctionIa, type PayloadDe, type SortieDe } from "./contrats";
import { DELAI_DEMO_MS, reponseDemo } from "./demo";
import { valider } from "./schema";

/** Les codes que l'app peut recevoir : ceux du serveur, plus trois locaux. */
export type CodeIa =
  | "unauthorized"
  | "not_pro"
  | "bad_request"
  | "unknown_feature"
  | "bad_payload"
  | "too_large"
  | "quota_exhausted"
  | "rate_limited"
  | "ai_paused"
  | "ai_busy"
  | "ai_unavailable"
  | "bad_output"
  | "refused"
  | "already_done"
  // Locaux :
  | "network" //  pas de réponse du serveur
  | "disabled"; // l'IA, ou sa famille, est éteinte dans les Réglages

const CODES_SERVEUR: ReadonlySet<string> = new Set([
  "unauthorized",
  "not_pro",
  "bad_request",
  "unknown_feature",
  "bad_payload",
  "too_large",
  "quota_exhausted",
  "rate_limited",
  "ai_paused",
  "ai_busy",
  "ai_unavailable",
  "bad_output",
  "refused",
  "already_done",
]);

export interface UsageIa {
  actionsLeft: number;
  resetsAt: string | null;
}

export type ResultatIa<S> =
  | { ok: true; data: S; usage: UsageIa | null }
  | { ok: false; code: CodeIa; resetsAt?: string | null; actionsLeft?: number };

export interface DepsRunAi {
  /** Vrai hors Tauri : réponse factice, aucun réseau. */
  demo: boolean;
  endpoint: string;
  cleAnon: string;
  /** Un jeton valable ; `forcer` en exige un neuf. */
  jeton(forcer?: boolean): Promise<string>;
  fetch?: typeof fetch;
  attendre?: (ms: number) => Promise<void>;
  maintenant?: () => Date;
}

/** Délai au-delà duquel on abandonne : la fonction coupe elle-même à 60 s. */
const DELAI_MS = 90_000;

let utiliseesDemo = 0;

function attendreParDefaut(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function usageDe(v: unknown): UsageIa | null {
  if (!estObjet(v) || typeof v.actionsLeft !== "number") return null;
  return { actionsLeft: v.actionsLeft, resetsAt: typeof v.resetsAt === "string" ? v.resetsAt : null };
}

export async function runAi<F extends FonctionIa>(
  feature: F,
  payload: PayloadDe<F>,
  deps: DepsRunAi,
): Promise<ResultatIa<SortieDe<F>>> {
  const schema = SORTIES[feature];

  // ── Démo ────────────────────────────────────────────────────────────────────
  if (deps.demo) {
    await (deps.attendre ?? attendreParDefaut)(DELAI_DEMO_MS);
    const data = reponseDemo(feature, payload);
    if (valider(schema, data).length > 0) return { ok: false, code: "bad_output" };
    utiliseesDemo += 1;
    const maintenant = (deps.maintenant ?? (() => new Date()))();
    return {
      ok: true,
      data,
      usage: { actionsLeft: Math.max(0, QUOTA_PRO - utiliseesDemo), resetsAt: reinitialisationIa(false, null, maintenant) },
    };
  }

  // ── Réseau ──────────────────────────────────────────────────────────────────
  const f = deps.fetch ?? fetch;
  const envoyer = async (jeton: string): Promise<Response | null> => {
    try {
      return await f(deps.endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", apikey: deps.cleAnon, authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ feature, payload }),
        signal: AbortSignal.timeout(DELAI_MS),
      });
    } catch {
      return null;
    }
  };

  let reponse: Response | null;
  try {
    reponse = await envoyer(await deps.jeton(false));
    if (reponse?.status === 401) reponse = await envoyer(await deps.jeton(true));
  } catch {
    // `jeton()` a levé : la session n'est plus renouvelable.
    return { ok: false, code: "unauthorized" };
  }
  if (!reponse) return { ok: false, code: "network" };

  let corps: unknown;
  try {
    corps = await reponse.json();
  } catch {
    return { ok: false, code: reponse.ok ? "bad_output" : "ai_unavailable" };
  }
  if (!estObjet(corps)) return { ok: false, code: "ai_unavailable" };

  if (corps.ok !== true) {
    const code = typeof corps.code === "string" && CODES_SERVEUR.has(corps.code) ? (corps.code as CodeIa) : "ai_unavailable";
    return {
      ok: false,
      code,
      resetsAt: typeof corps.resetsAt === "string" ? corps.resetsAt : null,
      ...(typeof corps.actionsLeft === "number" ? { actionsLeft: corps.actionsLeft } : {}),
    };
  }

  if (valider(schema, corps.data).length > 0) return { ok: false, code: "bad_output" };
  return { ok: true, data: corps.data as SortieDe<F>, usage: usageDe(corps.usage) };
}
