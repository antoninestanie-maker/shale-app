// Appel LLM avec deux fournisseurs gratuits : Gemini Flash (Google AI Studio) et
// Groq (Llama, OpenAI-compatible). Fallback auto sur Groq si le quota Gemini est
// atteint (HTTP 429). Température basse (0.2) + sortie JSON + validation.
import {
  hasAnyCredentials,
  resolveCredentials,
  type LlmCredentials,
  type LlmVendor,
} from "../llm/provider";
import { HttpError, postJson } from "./http";
import { buildUserMessage, compactForLlm, systemPrompt } from "./prompt";
import type { BriefingOutput, MarketPayload } from "./types";

import { t } from "../i18n";
// gemini-2.0-flash a été retiré par Google le 2026-06-01 → 404. Successeur : 2.5.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GROQ_MODEL = "llama-3.3-70b-versatile";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

// L'accès au modèle (clés, ordre d'essai, source d'autorisation) est résolu par
// `lib/llm/provider.ts`. Ce module ne sait plus D'OÙ vient le droit d'appeler —
// c'est ce qui permettra de brancher l'add-on « clé Shale incluse » sans y toucher.
export type Provider = LlmVendor;

export class MissingKeyError extends Error {
  constructor() {
    super(t("Aucune clé LLM. Ajoute une clé Gemini ou Groq dans Réglages → market-brain."));
    this.name = "MissingKeyError";
  }
}

/** Vrai si au moins un accès au modèle est configuré. */
export async function hasAnyKey(): Promise<boolean> {
  return hasAnyCredentials();
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

function validate(obj: unknown): BriefingOutput {
  const o = obj as Partial<BriefingOutput>;
  if (!o || !Array.isArray(o.instruments)) {
    throw new Error(t("Réponse LLM invalide : 'instruments' manquant."));
  }
  return {
    session: o.session === "pre_ny" ? "pre_ny" : "pre_london",
    daily_theme: String(o.daily_theme ?? ""),
    regime: String(o.regime ?? ""),
    instruments: o.instruments.map((raw) => {
      const iv = (raw ?? {}) as Partial<BriefingOutput["instruments"][number]>;
      return {
      symbol: String(iv.symbol ?? ""),
      bias: iv.bias === "haussier" || iv.bias === "baissier" ? iv.bias : "neutre",
      conviction:
        iv.conviction === "forte" || iv.conviction === "moyenne" ? iv.conviction : "faible",
      scenario: String(iv.scenario ?? ""),
      key_levels: {
        watch: Array.isArray(iv.key_levels?.watch)
          ? iv.key_levels!.watch.filter((n) => typeof n === "number")
          : [],
        invalidation:
          typeof iv.key_levels?.invalidation === "number" ? iv.key_levels!.invalidation : null,
      },
      no_trade: Array.isArray(iv.no_trade) ? iv.no_trade.map(String) : [],
      };
    }),
    landmines: Array.isArray(o.landmines)
      ? o.landmines.map((l) => ({
          time: String(l.time ?? ""),
          currency: String(l.currency ?? ""),
          event: String(l.event ?? ""),
        }))
      : [],
    summary: String(o.summary ?? ""),
  };
}

// ---- Fournisseurs ----

async function callGemini(key: string, payload: MarketPayload): Promise<BriefingOutput> {
  interface Resp {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    promptFeedback?: { blockReason?: string };
  }
  const body = {
    system_instruction: { parts: [{ text: systemPrompt(payload.mode) }] },
    contents: [
      { role: "user", parts: [{ text: buildUserMessage(JSON.stringify(compactForLlm(payload))) }] },
    ],
    generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
  };
  const res = await postJson<Resp>(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, body);
  if (res.promptFeedback?.blockReason) {
    throw new Error(t("Requête bloquée par Gemini : {reason}", { reason: res.promptFeedback.blockReason }));
  }
  const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(t("Réponse Gemini vide."));
  return validate(JSON.parse(extractJson(text)));
}

async function callGroq(key: string, payload: MarketPayload): Promise<BriefingOutput> {
  interface Resp {
    choices?: { message?: { content?: string } }[];
  }
  const body = {
    model: GROQ_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt(payload.mode) },
      { role: "user", content: buildUserMessage(JSON.stringify(compactForLlm(payload))) },
    ],
  };
  const res = await postJson<Resp>(GROQ_ENDPOINT, body, { Authorization: `Bearer ${key}` });
  const text = res.choices?.[0]?.message?.content;
  if (!text) throw new Error(t("Réponse Groq vide."));
  return validate(JSON.parse(extractJson(text)));
}

const RUNNERS: Record<Provider, (key: string, p: MarketPayload) => Promise<BriefingOutput>> = {
  gemini: callGemini,
  groq: callGroq,
};

/** Erreurs qui justifient de basculer sur l'autre fournisseur en mode auto :
 * quota (429/402), modèle introuvable/retiré (404), service indisponible (500/503). */
function isSwitchable(e: unknown): boolean {
  return (
    e instanceof HttpError &&
    [429, 402, 404, 500, 503].includes(e.status)
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Délai de retry suggéré par un 429 de rate-limit ("Please try again in 4.32s",
 * format Groq/OpenAI). Null si absent ou trop long (> 60 s = quota journalier).
 */
function retryAfterMs(e: unknown): number | null {
  if (!(e instanceof HttpError) || e.status !== 429) return null;
  const m = e.body.match(/try again in (?:(\d+)m)?(\d+(?:\.\d+)?)s/i);
  if (!m) return null;
  const ms = (parseInt(m[1] ?? "0", 10) * 60 + parseFloat(m[2])) * 1000 + 500;
  return ms <= 60_000 ? Math.ceil(ms) : null;
}

export interface LlmResult {
  output: BriefingOutput;
  provider: Provider;
}

export async function runLlm(payload: MarketPayload): Promise<LlmResult> {
  // Candidats déjà ORDONNÉS par la préférence utilisateur (et, plus tard, par
  // la présence de l'add-on géré). Liste vide = rien de configuré.
  const candidates: LlmCredentials[] = await resolveCredentials();
  if (candidates.length === 0) throw new MissingKeyError();

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const cred of candidates) {
      const provider = cred.vendor;
      try {
        return { output: await RUNNERS[provider](cred.key, payload), provider };
      } catch (e) {
        lastErr = e;
        // Erreur transitoire (quota/modèle retiré/service down) : on tente le
        // fournisseur suivant. Sur une vraie erreur (JSON, blocage, clé…), on
        // remonte tout de suite.
        if (!isSwitchable(e)) throw e;
      }
    }
    // Tous les fournisseurs en échec. Si le dernier 429 est un rate-limit
    // par minute qui annonce un délai court, on attend puis on refait un tour.
    const wait = attempt === 0 ? retryAfterMs(lastErr) : null;
    if (wait == null) break;
    await sleep(wait);
  }
  throw lastErr ?? new MissingKeyError();
}
