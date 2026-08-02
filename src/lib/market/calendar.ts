// Calendrier économique — ForexFactory (JSON hebdo, keyless).
import { getJson } from "./http";
import type { CalendarEvent, Impact } from "./types";

const FF_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

// Devises qui pilotent les 5 instruments suivis.
const RELEVANT = new Set(["USD", "EUR", "GBP"]);

interface FFItem {
  title: string;
  country: string; // code devise ("USD"…)
  date: string; // ISO avec fuseau
  impact: string; // "High" | "Medium" | "Low" | "Holiday"
  forecast: string;
  previous: string;
}

function mapImpact(s: string): Impact | null {
  const v = s.toLowerCase();
  if (v === "high") return "high";
  if (v === "medium") return "medium";
  if (v === "low") return "low";
  return null; // Holiday/Non-Economic → ignoré
}

function parisDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export async function fetchCalendar(errors: string[]): Promise<CalendarEvent[]> {
  try {
    const items = await getJson<FFItem[]>(FF_URL);
    const out: CalendarEvent[] = [];
    for (const it of items) {
      const impact = mapImpact(it.impact);
      if (!impact || impact === "low") continue;
      if (!RELEVANT.has(it.country)) continue;
      const { date, time } = parisDateTime(it.date);
      out.push({
        id: `${it.country}-${date}-${time}-${it.title}`.slice(0, 120),
        impact,
        time,
        date,
        currency: it.country,
        title: it.title,
        forecast: it.forecast || null,
        previous: it.previous || null,
      });
    }
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return out;
  } catch (e) {
    errors.push(`calendar: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}
