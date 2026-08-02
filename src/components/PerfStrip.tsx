// Bandeau résumé de performance (accueil) : 4 tuiles, 4 formes différentes —
// chiffre, mini-barres, donut, tendance trading. La 4ᵉ (trading) n'apparaît
// qu'avec l'offre Shale Trade ; le bandeau tombe alors à 3 tuiles.
import { useEffect, useState } from "react";
import { IconFlame } from "./icons";
import { addDays, todayStr } from "../lib/logic";
import { getSetting } from "../lib/repo";
import { fmtR, tradeStats } from "../lib/trades";
import { useEntitlements } from "../lib/entitlements";
import type { AppData, DayStat } from "../lib/types";

import { t } from "../lib/i18n";
interface Props {
  data: AppData;
  week: DayStat[]; // 7 derniers jours (calculés par TodayView)
  streak: number;
}

function focusTodayMin(data: AppData, today: string): number {
  return data.focusSessions
    .filter((s) => s.kind === "focus" && s.ended_at && s.started_at.startsWith(today))
    .reduce((a, s) => {
      const ms =
        new Date(s.ended_at!.replace(" ", "T")).getTime() -
        new Date(s.started_at.replace(" ", "T")).getTime();
      return a + Math.max(0, Math.round(ms / 60_000));
    }, 0);
}

export default function PerfStrip({ data, week, streak }: Props) {
  const today = todayStr();
  const { hasTrading } = useEntitlements();
  const [goalMin, setGoalMin] = useState(120);

  useEffect(() => {
    const load = () =>
      getSetting("focus_goal_min").then((v) => {
        if (v) setGoalMin(parseInt(v, 10));
      });
    load();
    window.addEventListener("sb:settings-changed", load);
    return () => window.removeEventListener("sb:settings-changed", load);
  }, []);

  const focusMin = focusTodayMin(data, today);
  const focusPct = Math.min(focusMin / goalMin, 1);
  const weekTrades = data.trades.filter(
    (t) => (t.mode ?? "live") === "live" && t.date >= addDays(today, -6),
  );
  const ts = tradeStats(weekTrades);

  const R = 20;
  const CIRC = 2 * Math.PI * R;

  return (
    // perf-tiles : le nombre de colonnes suit la largeur RÉELLE du bandeau
    // (pas le viewport) → aucun chevauchement quelle que soit la taille donnée
    // au widget. Piste mini 190px (et non 120px comme `.auto-tiles`) : ces
    // tuiles portent un pictogramme/donut + 2 lignes de texte, elles ne sont
    // PAS lisibles sous ~180px (cf. index.css). panel-stretch : hauteur partagée.
    <div className="perf-tiles panel-stretch gap-3">
      {/* 1 — Streak : chiffre */}
      <div className="card flex min-w-0 items-center gap-3 p-4">
        <IconFlame className="h-6 w-6 shrink-0 text-yellow" />
        <div className="min-w-0">
          <p className="font-display text-2xl font-extrabold leading-none text-green">
            {streak} j
          </p>
          <p className="hud-label mt-1">streak</p>
        </div>
      </div>

      {/* 2 — 7 jours : mini-barres */}
      <div className="card flex min-w-0 flex-col justify-center p-4">
        <div className="flex h-8 items-end gap-1">
          {week.map((d, i) => (
            <span
              key={d.date}
              title={`${d.date} — ${d.pct ?? 0}%`}
              className="flex-1 rounded-sm"
              style={{
                height: `${Math.max(d.pct ?? 0, 6)}%`,
                backgroundColor:
                  i === week.length - 1
                    ? "var(--color-blue)"
                    : (d.pct ?? 0) >= 80
                      ? "var(--color-green)"
                      : "color-mix(in srgb, var(--color-green) 35%, transparent)",
              }}
            />
          ))}
        </div>
        <p className="hud-label mt-2">{t("7 jours")}</p>
      </div>

      {/* 3 — Focus : donut */}
      <div className="card flex min-w-0 items-center gap-3 p-4">
        <div className="relative h-12 w-12 shrink-0">
          <svg viewBox="0 0 48 48" className="h-full w-full -rotate-90">
            <circle cx="24" cy="24" r={R} fill="none" stroke="var(--color-border)" strokeWidth="5" />
            <circle
              cx="24"
              cy="24"
              r={R}
              fill="none"
              stroke="var(--color-blue)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - focusPct)}
            />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-extrabold leading-none text-text">
            {focusMin}
            <span className="text-xs font-normal text-text-dim"> min</span>
          </p>
          <p className="hud-label mt-1">
            focus / {goalMin >= 60 ? `${Math.round((goalMin / 60) * 10) / 10} h` : `${goalMin} min`}
          </p>
        </div>
      </div>

      {/* 4 — Trading semaine : R + winrate. Réservé à Shale Trade ; `perf-tiles`
          est une grille `auto-fit`, elle retombe seule à 3 colonnes. */}
      {hasTrading && (
      <div className="card flex min-w-0 flex-col justify-center p-4">
        <p
          className={`font-display text-2xl font-extrabold leading-none ${
            ts.totalR >= 0 ? "text-green" : "text-red"
          }`}
        >
          {ts.count === 0 ? "—" : fmtR(ts.totalR)}
        </p>
        <p className="hud-label mt-1">
          trading 7 j{" "}
          {ts.count > 0 && (
            <span className="normal-case tracking-normal">
              · {ts.winrate === null ? "—" : `${ts.winrate}% wr`} · {ts.count} tr.
            </span>
          )}
        </p>
      </div>
      )}
    </div>
  );
}
