// Orchestrateur du pipeline « squelette data » : assemble le contrat d'entrée
// Market-Brain (macro_context + instruments + calendar + news). Pas d'appel LLM
// ni de mémoire à ce stade (phase 2).
import { isTauri } from "../repo";
import { fetchCalendar } from "./calendar";
import { computeDailyTheme } from "./correlations";
import { fetchCryptoDerivs } from "./crypto-derivs";
import { demoPayload } from "./demo";
import { buildMemoryBlock } from "./memory";
import { fetchNews } from "./news";
import { fetchInstruments, fetchMacroContext } from "./prices";
import type { BriefMode, MarketPayload } from "./types";

/** Session courante d'après l'heure de Paris (pré-Londres avant 14h, sinon pré-NY). */
export function currentSession(d = new Date()): "pre_london" | "pre_ny" {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(d),
    10,
  );
  return hour < 14 ? "pre_london" : "pre_ny";
}

export async function buildPayload(mode: BriefMode = "morning_briefing"): Promise<MarketPayload> {
  const session = currentSession();

  // Hors app native : pas de tauri-plugin-http → CORS bloque tout. On sert la démo.
  if (!isTauri) return { ...demoPayload(session), mode };

  const errors: string[] = [];
  const [macro_context, instruments, crypto, calendar, news, memory] = await Promise.all([
    fetchMacroContext(errors),
    fetchInstruments(errors),
    fetchCryptoDerivs(errors),
    fetchCalendar(errors),
    fetchNews(errors),
    buildMemoryBlock(),
  ]);

  // Si absolument rien n'est remonté, on bascule sur la démo (avec les erreurs).
  if (instruments.length === 0 && macro_context.dxy.last == null) {
    const fallback = { ...demoPayload(session), mode };
    fallback._errors = errors;
    return fallback;
  }

  return {
    mode,
    session,
    now: new Date().toISOString(),
    macro_context,
    daily_theme: computeDailyTheme(macro_context),
    instruments,
    crypto,
    calendar,
    news,
    sentiment: [], // phase 3+ (SSI retail forex : source login/payante)
    memory,
    _errors: errors,
    _demo: false,
  };
}
