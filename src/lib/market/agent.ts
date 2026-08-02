// Orchestrateur de génération du briefing : payload → LLM → mémoire.
import { isTauri } from "../repo";
import { demoBriefing, demoPayload } from "./demo";
import { runLlm } from "./llm";
import { getBriefing, parisDay, saveBriefing } from "./memory";
import { buildPayload, currentSession } from "./payload";
import type { BriefingOutput, MarketPayload } from "./types";

import { t } from "../i18n";
export const TRIGGER_HOUR = { pre_london: 8, pre_ny: 14 } as const;

export function parisHour(d = new Date()): number {
  return parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Paris",
      hour: "2-digit",
      hour12: false,
    }).format(d),
    10,
  );
}

/** Le déclenchement de la session courante est-il atteint (8h Londres / 14h NY) ? */
export function isPastTrigger(session: "pre_london" | "pre_ny"): boolean {
  return parisHour() >= TRIGGER_HOUR[session];
}

export interface Briefing {
  session: "pre_london" | "pre_ny";
  payload: MarketPayload;
  output: BriefingOutput;
  generated_at: string;
}

/** Génère un briefing frais (fetch + LLM) et le stocke. Force = ignore la trigger. */
export async function generateBriefing(
  session = currentSession(),
): Promise<Briefing> {
  if (!isTauri) {
    // Preview navigateur : pas de réseau natif ni de clé → démo.
    return {
      session,
      payload: demoPayload(session),
      output: demoBriefing(session),
      generated_at: new Date().toISOString(),
    };
  }
  const payload = await buildPayload();
  assertRealData(payload);
  const { output } = await runLlm(payload);
  await saveBriefing(session, payload, output);
  return { session, payload, output, generated_at: new Date().toISOString() };
}

/**
 * En natif, si tous les fetchers ont échoué le payload retombe sur la démo :
 * on refuse d'analyser (et de stocker pour la journée) des données factices.
 */
function assertRealData(payload: MarketPayload): void {
  if (!payload._demo) return;
  const detail = payload._errors.length
    ? ` Erreurs : ${payload._errors.join(" · ")}`
    : "";
  throw new Error(
    t("Données de marché indisponibles (réseau ?) — briefing annulé pour ne pas analyser des données de démo.") +
      detail,
  );
}

/**
 * Génère un briefing FLASH (news intra-séance). Non persisté : c'est une lecture
 * ponctuelle qui n'écrase pas le briefing du matin.
 */
export async function generateFlash(session = currentSession()): Promise<Briefing> {
  if (!isTauri) {
    return {
      session,
      payload: { ...demoPayload(session), mode: "flash" },
      output: { ...demoBriefing(session), daily_theme: t("FLASH — lecture express (démo)") },
      generated_at: new Date().toISOString(),
    };
  }
  const payload = await buildPayload("flash");
  assertRealData(payload);
  const { output } = await runLlm(payload);
  return { session, payload, output, generated_at: new Date().toISOString() };
}

/** Charge le briefing stocké de la session courante (ou null). */
export async function loadStoredBriefing(
  session = currentSession(),
): Promise<Briefing | null> {
  const stored = await getBriefing(session, parisDay());
  if (!stored) return null;
  try {
    return {
      session: stored.session,
      payload: JSON.parse(stored.payload_in) as MarketPayload,
      output: JSON.parse(stored.output_json) as BriefingOutput,
      generated_at: stored.generated_at,
    };
  } catch {
    return null;
  }
}
