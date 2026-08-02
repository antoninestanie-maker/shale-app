// Indicateurs techniques calculés en local (aucune lib externe requise).
import type { Bias, Trend } from "./types";

export interface Candle {
  t: number; // timestamp epoch (s)
  o: number;
  h: number;
  l: number;
  c: number;
}

/** Moyenne mobile simple sur les `period` dernières valeurs. */
export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/** RSI de Wilder sur `period` (défaut 14). */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

/** ATR de Wilder sur `period` (défaut 14). */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prev = candles[i - 1];
    trs.push(
      Math.max(
        c.h - c.l,
        Math.abs(c.h - prev.c),
        Math.abs(c.l - prev.c),
      ),
    );
  }
  let a = trs.slice(0, period).reduce((x, y) => x + y, 0) / period;
  for (let i = period; i < trs.length; i++) {
    a = (a * (period - 1) + trs[i]) / period;
  }
  return a;
}

/** Tendance haussière/baissière/plate à partir de SMA rapide vs lente. */
export function trendFrom(closes: number[], fast = 20, slow = 50): Bias {
  const f = sma(closes, fast);
  const s = sma(closes, slow);
  const last = closes[closes.length - 1];
  if (f == null || s == null || last == null) return "range";
  const spread = (f - s) / s;
  if (spread > 0.0008 && last > f) return "bullish";
  if (spread < -0.0008 && last < f) return "bearish";
  return "range";
}

/** Variation directionnelle simple (macro sensors). */
export function trendDir(change_pct: number | null): Trend {
  if (change_pct == null) return "flat";
  if (change_pct > 0.05) return "up";
  if (change_pct < -0.05) return "down";
  return "flat";
}
