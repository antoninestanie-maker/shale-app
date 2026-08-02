// Indicateur de charge mentale (« énergie restante ») : une jauge qui baisse au fil de
// la journée pour rappeler au trader que sa capacité de décision s'épuise. L'énergie part
// de `startEnergy` le matin et diminue selon deux facteurs, aux coefficients réglables :
//   • le nombre de trades pris aujourd'hui (mode live) ;
//   • le temps passé devant l'écran aujourd'hui (accumulé par useScreenTime).
import { useEffect } from "react";
import { getSetting, setSetting } from "./repo";
import { todayStr } from "./logic";
import type { AppData } from "./types";

export interface MentalLoadConfig {
  /** Énergie de départ le matin (référence 100 % de la jauge). */
  startEnergy: number;
  /** Énergie consommée par trade pris. */
  costPerTrade: number;
  /** Énergie consommée par heure passée devant l'écran. */
  costPerHour: number;
}

export const MENTAL_LOAD_DEFAULTS: MentalLoadConfig = {
  startEnergy: 100,
  costPerTrade: 8,
  costPerHour: 10,
};

const KEYS = {
  start: "energy_start",
  trade: "energy_cost_trade",
  hour: "energy_cost_hour",
};

function num(raw: string | null, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export async function loadMentalLoadConfig(): Promise<MentalLoadConfig> {
  const [s, t, h] = await Promise.all([
    getSetting(KEYS.start),
    getSetting(KEYS.trade),
    getSetting(KEYS.hour),
  ]);
  return {
    startEnergy: Math.max(1, num(s, MENTAL_LOAD_DEFAULTS.startEnergy)),
    costPerTrade: num(t, MENTAL_LOAD_DEFAULTS.costPerTrade),
    costPerHour: num(h, MENTAL_LOAD_DEFAULTS.costPerHour),
  };
}

export async function saveMentalLoadConfig(c: MentalLoadConfig): Promise<void> {
  await Promise.all([
    setSetting(KEYS.start, String(c.startEnergy)),
    setSetting(KEYS.trade, String(c.costPerTrade)),
    setSetting(KEYS.hour, String(c.costPerHour)),
  ]);
}

/** Clé du compteur de minutes d'écran pour un jour donné. */
export function screenMinKey(date: string = todayStr()): string {
  return `screen_min_${date}`;
}

export const SCREEN_TIME_EVENT = "sb:screen-time";

export async function getScreenMinutes(date: string = todayStr()): Promise<number> {
  return num(await getSetting(screenMinKey(date)), 0);
}

export interface MentalLoad {
  /** Énergie restante en % (0–100). */
  energy: number;
  trades: number;
  screenMin: number;
  drainTrades: number; // % d'énergie consommé par les trades
  drainTime: number; // % d'énergie consommé par le temps d'écran
}

export function computeMentalLoad(
  data: AppData,
  screenMin: number,
  cfg: MentalLoadConfig,
): MentalLoad {
  const today = todayStr();
  const trades = data.trades.filter((t) => t.mode === "live" && t.date === today).length;
  const drainTradesAbs = trades * cfg.costPerTrade;
  const drainTimeAbs = (screenMin / 60) * cfg.costPerHour;
  const remainingAbs = cfg.startEnergy - drainTradesAbs - drainTimeAbs;
  const toPct = (v: number) => (v / cfg.startEnergy) * 100;
  return {
    energy: Math.max(0, Math.min(100, toPct(remainingAbs))),
    trades,
    screenMin,
    drainTrades: Math.max(0, toPct(drainTradesAbs)),
    drainTime: Math.max(0, toPct(drainTimeAbs)),
  };
}

/**
 * Accumule le temps passé devant l'écran : +1 min chaque minute où la fenêtre est visible.
 * Monté une fois au niveau de l'App (fenêtre principale uniquement). Émet SCREEN_TIME_EVENT.
 */
export function useScreenTime(): void {
  useEffect(() => {
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const key = screenMinKey();
      const cur = num(await getSetting(key), 0);
      await setSetting(key, String(cur + 1));
      window.dispatchEvent(new CustomEvent(SCREEN_TIME_EVENT));
    };
    const id = window.setInterval(tick, 60_000);
    return () => window.clearInterval(id);
  }, []);
}
