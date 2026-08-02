// Mémoire des briefings (SQLite via tauri-plugin-sql). Stockage 2×/jour,
// purge 7 jours, et rétroaction (biais de la veille réinjecté dans le prompt).
import { getDb } from "../db";
import { isTauri } from "../repo";
import type {
  BriefingOutput,
  MarketPayload,
  MemoryBlock,
  StoredBriefing,
} from "./types";

/** Jour courant au fuseau Europe/Paris ("YYYY-MM-DD"). */
export function parisDay(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Datetime local ISO-ish "YYYY-MM-DD HH:MM:SS" au fuseau Paris. */
function parisNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")} ${g("hour")}:${g("minute")}:${g("second")}`;
}

export async function getBriefing(
  session: "pre_london" | "pre_ny",
  day = parisDay(),
): Promise<StoredBriefing | null> {
  if (!isTauri) return null;
  const db = await getDb();
  const rows = await db.select<StoredBriefing[]>(
    "SELECT * FROM market_briefings WHERE session = $1 AND day = $2",
    [session, day],
  );
  return rows[0] ?? null;
}

export async function saveBriefing(
  session: "pre_london" | "pre_ny",
  payloadIn: MarketPayload,
  output: BriefingOutput,
): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    `INSERT INTO market_briefings (session, day, generated_at, payload_in, output_json, dismissed)
     VALUES ($1, $2, $3, $4, $5, 0)
     ON CONFLICT(session, day) DO UPDATE SET
       generated_at = $3, payload_in = $4, output_json = $5, dismissed = 0`,
    [session, parisDay(), parisNow(), JSON.stringify(payloadIn), JSON.stringify(output)],
  );
}

export async function dismissBriefing(
  session: "pre_london" | "pre_ny",
  day = parisDay(),
): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  await db.execute(
    "UPDATE market_briefings SET dismissed = 1 WHERE session = $1 AND day = $2",
    [session, day],
  );
}

/** Purge des briefings de plus de 7 jours (appelée au lancement). */
export async function purgeOldBriefings(): Promise<void> {
  if (!isTauri) return;
  const db = await getDb();
  const cutoff = parisDay(new Date(Date.now() - 7 * 24 * 3600 * 1000));
  await db.execute("DELETE FROM market_briefings WHERE day < $1", [cutoff]);
}

/**
 * Rétroaction : reprend le dernier briefing (hors aujourd'hui) et extrait, par
 * instrument, le biais donné et le niveau clé surveillé, pour continuité.
 */
export async function buildMemoryBlock(): Promise<MemoryBlock> {
  if (!isTauri) return { last_briefing: null };
  const db = await getDb();
  const today = parisDay();
  const rows = await db.select<StoredBriefing[]>(
    "SELECT * FROM market_briefings WHERE day < $1 ORDER BY generated_at DESC LIMIT 1",
    [today],
  );
  const prev = rows[0];
  if (!prev) return { last_briefing: null };
  try {
    const out = JSON.parse(prev.output_json) as BriefingOutput;
    const perInstrument: Record<string, unknown> = {};
    for (const iv of out.instruments) {
      perInstrument[iv.symbol] = {
        bias: iv.bias,
        conviction: iv.conviction,
        level_watched: iv.key_levels.watch[0] ?? null,
      };
    }
    return {
      last_briefing: {
        date: prev.day,
        session: prev.session,
        daily_theme: out.daily_theme,
        instruments: perInstrument,
      },
    };
  } catch {
    return { last_briefing: null };
  }
}
