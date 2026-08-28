// Jauge « énergie restante » (charge mentale) pour le dashboard. Baisse au fil de la
// journée selon les trades pris et le temps d'écran ; couleur verte → jaune → rouge.
import { useEffect, useState } from "react";
import {
  computeMentalLoad,
  getScreenMinutes,
  loadMentalLoadConfig,
  MENTAL_LOAD_DEFAULTS,
  SCREEN_TIME_EVENT,
  type MentalLoad,
  type MentalLoadConfig,
} from "../lib/mentalLoad";
import { IconAlert } from "./icons";
import type { AppData } from "../lib/types";

import { t, tp } from "../lib/i18n";
/** Émis par les réglages quand les coefficients changent, pour rafraîchir la jauge. */
export const MENTAL_LOAD_CONFIG_EVENT = "sb:mental-load-config";

function colorFor(energy: number): string {
  if (energy <= 30) return "var(--color-red)";
  if (energy <= 60) return "var(--color-yellow)";
  return "var(--color-green)";
}

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m} min`;
}

export default function MentalLoadGauge({ data }: { data: AppData }) {
  const [cfg, setCfg] = useState<MentalLoadConfig>(MENTAL_LOAD_DEFAULTS);
  const [screenMin, setScreenMin] = useState(0);

  useEffect(() => {
    const refreshCfg = () => loadMentalLoadConfig().then(setCfg);
    const refreshTime = () => getScreenMinutes().then(setScreenMin);
    refreshCfg();
    refreshTime();
    const onVis = () => document.visibilityState === "visible" && refreshTime();
    window.addEventListener(SCREEN_TIME_EVENT, refreshTime);
    window.addEventListener(MENTAL_LOAD_CONFIG_EVENT, refreshCfg);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(SCREEN_TIME_EVENT, refreshTime);
      window.removeEventListener(MENTAL_LOAD_CONFIG_EVENT, refreshCfg);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const load: MentalLoad = computeMentalLoad(data, screenMin, cfg);
  const color = colorFor(load.energy);
  const pct = Math.round(load.energy);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span
          className="font-display text-4xl font-extrabold leading-none"
          style={{ color }}
        >
          {pct}%
        </span>
        <span className="hud-label">{t("énergie")}</span>
      </div>

      {/* Barre de jauge */}
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>

      {/* Décomposition */}
      <div className="mt-3 flex items-center justify-between text-[11px] text-text-dim">
        <span>
          {tp(load.trades, "{n} trade", "{n} trades")}
          <span className="ml-1 font-mono">−{Math.round(load.drainTrades)}%</span>
        </span>
        <span>
          {t("{duree} écran", { duree: fmtMin(load.screenMin) })}
          <span className="ml-1 font-mono">−{Math.round(load.drainTime)}%</span>
        </span>
      </div>

      {load.energy <= 30 && (
        <div className="mt-3 flex items-start gap-1.5 rounded-[10px] border border-red/25 bg-red/10 px-2.5 py-1.5 text-[11px] text-red">
          <IconAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{t("Énergie basse : tes décisions se dégradent. Lève le pied.")}</span>
        </div>
      )}
    </div>
  );
}
