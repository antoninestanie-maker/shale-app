// Stats du journal de trading + création centralisée (UI, palette, voix).
import { norm } from "./actions";
import { createTrade, setMetricValue, type TradeInput } from "./repo";
import type { AppData, Trade } from "./types";

export type Outcome = "win" | "loss" | "be";

export function outcomeOf(t: Trade): Outcome {
  if (t.result_r > 0) return "win";
  if (t.result_r < 0) return "loss";
  return "be";
}

export interface TradeStats {
  count: number;
  wins: number;
  losses: number;
  be: number;
  /** null si aucun trade décisif (BE exclus du calcul) */
  winrate: number | null;
  totalR: number;
  avgR: number | null;
  /** Somme des R gagnés ÷ somme des R perdus. null si aucune perte (ou aucun gain). */
  profitFactor: number | null;
  /** Pire creux de la courbe de R cumulé (≤ 0), trades ordonnés par date. */
  maxDrawdownR: number;
}

export function tradeStats(trades: Trade[]): TradeStats {
  let wins = 0;
  let losses = 0;
  let be = 0;
  let totalR = 0;
  let grossWin = 0;
  let grossLoss = 0; // valeur absolue
  for (const t of trades) {
    totalR += t.result_r;
    const o = outcomeOf(t);
    if (o === "win") {
      wins++;
      grossWin += t.result_r;
    } else if (o === "loss") {
      losses++;
      grossLoss += -t.result_r;
    } else be++;
  }
  const decisive = wins + losses;
  return {
    count: trades.length,
    wins,
    losses,
    be,
    winrate: decisive > 0 ? Math.round((wins / decisive) * 100) : null,
    totalR: Math.round(totalR * 100) / 100,
    avgR:
      trades.length > 0
        ? Math.round((totalR / trades.length) * 100) / 100
        : null,
    profitFactor:
      grossLoss > 0 && grossWin > 0
        ? Math.round((grossWin / grossLoss) * 100) / 100
        : null,
    maxDrawdownR: maxDrawdownR(trades),
  };
}

/**
 * Drawdown maximum en R : plus grand écart pic → creux de la courbe de R
 * cumulé, trades rejoués en ordre chronologique. 0 si aucune baisse.
 */
export function maxDrawdownR(trades: Trade[]): number {
  const ordered = [...trades].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id - b.id,
  );
  let cum = 0;
  let peak = 0;
  let maxDd = 0;
  for (const t of ordered) {
    cum += t.result_r;
    if (cum > peak) peak = cum;
    else maxDd = Math.max(maxDd, peak - cum);
  }
  return -Math.round(maxDd * 100) / 100;
}

export function statsBySetup(
  trades: Trade[],
): { setup: string; stats: TradeStats }[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.setup?.trim() || "(sans setup)";
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }
  return [...groups.entries()]
    .map(([setup, list]) => ({ setup, stats: tradeStats(list) }))
    .sort((a, b) => b.stats.count - a.stats.count);
}

export function fmtR(r: number): string {
  const v = Math.round(r * 100) / 100;
  return v > 0 ? `+${v}R` : `${v}R`;
}

/**
 * Enregistre un trade et incrémente la métrique "trades" du jour si elle
 * existe (trades live uniquement) — point d'entrée unique pour le
 * formulaire, la palette et le tracker. Renvoie l'id du trade créé.
 */
export async function logTrade(
  input: TradeInput,
  data: AppData | null,
): Promise<number> {
  const id = await createTrade(input);
  if (input.mode !== "live") return id;
  const metric = data?.metrics.find((m) => norm(m.name).includes("trade"));
  if (metric) {
    const current =
      data?.metricEntries.find(
        (e) => e.metric_id === metric.id && e.date === input.date,
      )?.value ?? 0;
    await setMetricValue(metric.id, input.date, current + 1);
  }
  return id;
}
