// Fetch prix/OHLC via l'API chart Yahoo (keyless) + assemblage du bloc
// technique par instrument et du macro_context.
import { getJson } from "./http";
import { atr, rsi, trendDir, trendFrom, type Candle } from "./indicators";
import type {
  InstrumentBlock,
  MacroContext,
  MacroSensor,
  PriceSnapshot,
  SessionLevels,
  Technical,
} from "./types";

export interface InstrumentDef {
  key: string;
  yahoo: string;
  correlations: { with: string; sign: "+" | "-" }[];
}

// Corrélations pré-câblées (doc §3). L'agent les reçoit pour croiser les biais.
export const INSTRUMENTS: InstrumentDef[] = [
  {
    key: "EUR/USD",
    yahoo: "EURUSD=X",
    correlations: [
      { with: "GBP/USD", sign: "+" },
      { with: "DXY", sign: "-" },
    ],
  },
  {
    key: "GBP/USD",
    yahoo: "GBPUSD=X",
    correlations: [
      { with: "EUR/USD", sign: "+" },
      { with: "DXY", sign: "-" },
    ],
  },
  {
    key: "XAU/USD",
    yahoo: "GC=F",
    correlations: [
      { with: "DXY", sign: "-" },
      { with: "US10Y", sign: "-" },
    ],
  },
  {
    key: "NAS100",
    // NQ=F (futures CME, coté ~24h) plutôt que ^NDX (cash, figé hors séance US) :
    // indispensable pour un briefing pré-Londres à 8h Paris.
    yahoo: "NQ=F",
    correlations: [
      { with: "US10Y", sign: "-" },
      { with: "VIX", sign: "-" },
      { with: "BTC/USD", sign: "+" },
    ],
  },
  {
    key: "BTC/USD",
    yahoo: "BTC-USD",
    correlations: [
      { with: "NAS100", sign: "+" },
      { with: "VIX", sign: "-" },
    ],
  },
];

const MACRO_SYMBOLS = {
  dxy: "DX-Y.NYB",
  us02y: "2YY=F", // futures rendement 2 ans (CBOT) : anticipations Fed
  us10y: "^TNX",
  vix: "^VIX",
  es: "ES=F", // futures S&P 500 : ton risque overnight
} as const;

// ---- Yahoo chart ----

interface YahooChart {
  chart: {
    result:
      | [
          {
            meta: { regularMarketPrice?: number; previousClose?: number; chartPreviousClose?: number };
            timestamp?: number[];
            indicators: { quote: [{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }] };
          },
        ]
      | null;
    error: unknown;
  };
}

async function fetchCandles(
  yahoo: string,
  interval: string,
  range: string,
): Promise<{ candles: Candle[]; last: number | null; prevClose: number | null }> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}` +
    `?interval=${interval}&range=${range}`;
  const data = await getJson<YahooChart>(url);
  const res = data.chart.result?.[0];
  if (!res) throw new Error(`Yahoo: pas de données pour ${yahoo}`);
  const ts = res.timestamp ?? [];
  const q = res.indicators.quote[0];
  const candles: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = q.open?.[i];
    const h = q.high?.[i];
    const l = q.low?.[i];
    const c = q.close?.[i];
    if (o == null || h == null || l == null || c == null) continue;
    candles.push({ t: ts[i], o, h, l, c });
  }
  const last =
    res.meta.regularMarketPrice ?? candles[candles.length - 1]?.c ?? null;
  const prevClose = res.meta.chartPreviousClose ?? res.meta.previousClose ?? null;
  return { candles, last, prevClose };
}

function pct(last: number | null, base: number | null): number | null {
  if (last == null || base == null || base === 0) return null;
  return Math.round(((last - base) / base) * 10000) / 100;
}

// Heure/jour dans le fuseau Europe/Paris (pour le range de nuit).
function parisHour(t: number): { day: string; hour: number } {
  const d = new Date(t * 1000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
  return {
    day: `${get("year")}-${get("month")}-${get("day")}`,
    hour: parseInt(get("hour"), 10) % 24,
  };
}

function nightRange(m15: Candle[]): [number, number] | null {
  if (m15.length === 0) return null;
  const lastDay = parisHour(m15[m15.length - 1].t).day;
  const night = m15.filter((c) => {
    const { day, hour } = parisHour(c.t);
    return day === lastDay && hour >= 0 && hour < 7;
  });
  if (night.length === 0) return null;
  const hi = Math.max(...night.map((c) => c.h));
  const lo = Math.min(...night.map((c) => c.l));
  return [Math.round(lo * 1e5) / 1e5, Math.round(hi * 1e5) / 1e5];
}

function round(n: number | null): number | null {
  return n == null ? null : Math.round(n * 1e5) / 1e5;
}

function buildTechnical(
  daily: Candle[],
  h1: Candle[],
  m15: Candle[],
): Technical {
  const dCloses = daily.map((c) => c.c);
  const h1Closes = h1.map((c) => c.c);
  const m15Closes = m15.map((c) => c.c);

  const prevDay = daily[daily.length - 2];
  const session: SessionLevels = {
    prev_day_high: prevDay ? round(prevDay.h) : null,
    prev_day_low: prevDay ? round(prevDay.l) : null,
    asia_range: nightRange(m15),
  };

  const recent = daily.slice(-10);
  const key_levels = {
    support: recent.length ? [round(Math.min(...recent.map((c) => c.l)))!] : [],
    resistance: recent.length ? [round(Math.max(...recent.map((c) => c.h)))!] : [],
  };

  // Pivots classiques sur la bougie de la veille : niveaux de scalp standard.
  const pivots = prevDay
    ? (() => {
        const p = (prevDay.h + prevDay.l + prevDay.c) / 3;
        return {
          p: round(p)!,
          r1: round(2 * p - prevDay.l)!,
          s1: round(2 * p - prevDay.h)!,
        };
      })()
    : null;

  // ADR consommé : range du jour en cours vs moyenne des 14 ranges précédents.
  const today = daily[daily.length - 1];
  const prevRanges = daily.slice(-15, -1).map((c) => c.h - c.l);
  const adr =
    prevRanges.length >= 5
      ? prevRanges.reduce((a, b) => a + b, 0) / prevRanges.length
      : null;
  const adr_used_pct =
    adr && today ? Math.round(((today.h - today.l) / adr) * 100) : null;

  return {
    trend_d1: trendFrom(dCloses, 20, 50),
    trend_h4: trendFrom(h1Closes, 24, 96), // ~4h*6 vs ~4h*24 en base H1
    bias_m15: trendFrom(m15Closes, 20, 50),
    rsi_h1: rsi(h1Closes, 14),
    atr_m15: round(atr(m15, 14)),
    atr_d1: round(atr(daily, 14)),
    adr_used_pct,
    pivots,
    session_levels: session,
    key_levels,
  };
}

async function fetchInstrument(def: InstrumentDef): Promise<InstrumentBlock> {
  const [daily, h1, m15] = await Promise.all([
    fetchCandles(def.yahoo, "1d", "6mo"),
    fetchCandles(def.yahoo, "1h", "1mo"),
    fetchCandles(def.yahoo, "15m", "5d"),
  ]);
  const price: PriceSnapshot = {
    last: round(daily.last),
    change_pct: pct(daily.last, daily.prevClose),
    prev_close: round(daily.prevClose),
    ts: new Date().toISOString(),
  };
  return {
    symbol: def.key,
    yahoo: def.yahoo,
    price,
    technical: buildTechnical(daily.candles, h1.candles, m15.candles),
    correlations: def.correlations,
  };
}

async function fetchMacroSensor(yahoo: string, isYield: boolean): Promise<MacroSensor> {
  const { candles, last, prevClose } = await fetchCandles(yahoo, "1d", "1mo");
  // ^TNX renvoie parfois le rendement ×10 (42.5 => 4.25%).
  let value = last;
  if (isYield && value != null && value > 20) value = value / 10;
  const base = prevClose ?? candles[candles.length - 2]?.c ?? null;
  const change = pct(last, base);
  return {
    last: round(value),
    change_pct: change,
    trend: trendDir(change),
    ts: new Date().toISOString(),
  };
}

export async function fetchMacroContext(errors: string[]): Promise<MacroContext> {
  const load = async (sym: string, isYield: boolean): Promise<MacroSensor> => {
    try {
      return await fetchMacroSensor(sym, isYield);
    } catch (e) {
      errors.push(`macro ${sym}: ${e instanceof Error ? e.message : String(e)}`);
      return { last: null, change_pct: null, trend: "flat", ts: null };
    }
  };
  const [dxy, us02y, us10y, vix, es_futures] = await Promise.all([
    load(MACRO_SYMBOLS.dxy, false),
    load(MACRO_SYMBOLS.us02y, false), // 2YY=F cote déjà le rendement en %
    load(MACRO_SYMBOLS.us10y, true),
    load(MACRO_SYMBOLS.vix, false),
    load(MACRO_SYMBOLS.es, false),
  ]);
  return { dxy, us02y, us10y, vix, es_futures, fed_bias: "n/a" };
}

export async function fetchInstruments(errors: string[]): Promise<InstrumentBlock[]> {
  const out: InstrumentBlock[] = [];
  for (const def of INSTRUMENTS) {
    try {
      out.push(await fetchInstrument(def));
    } catch (e) {
      errors.push(`${def.key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return out;
}
