import { useMemo, useRef, useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  addDays,
  aggregateStats,
  computeStreak,
  dayStat,
  pctOfList,
  streakHistory,
  todayStr,
  todayTasks,
  type Period,
} from "../lib/logic";
import { addMetric, deleteMetric, setMetricValue } from "../lib/repo";
import { fmtR, tradeStats } from "../lib/trades";
import type { AppData, CustomMetric } from "../lib/types";
import { IconX } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import { useEntitlements } from "../lib/entitlements";

import { localeTag, t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

const PERIODS: { value: Period; label: string }[] = [
  // Clés FRANÇAISES : table de module, donc traduite à l'affichage.
  { value: "day", label: "Jour" },
  { value: "week", label: "Semaine" },
  { value: "month", label: "Mois" },
];

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeTag(), {
    day: "numeric",
    month: "short",
  });
}

const tooltipStyle = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-text)",
};

function sessionMinutes(s: { started_at: string; ended_at: string | null }): number {
  if (!s.ended_at) return 0;
  const ms =
    new Date(s.ended_at.replace(" ", "T")).getTime() -
    new Date(s.started_at.replace(" ", "T")).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

function fmtMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export default function PerformanceView({ data, refresh }: Props) {
  const { hasTrading } = useEntitlements();
  const today = todayStr();
  const { tasks, completions, goals, metrics, metricEntries, goalLog } = data;

  const [period, setPeriod] = useState<Period>("day");
  const [selGoalId, setSelGoalId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("");
  const [deletingMetric, setDeletingMetric] = useState<number | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  const derived = useMemo(() => {
    const list = todayTasks(tasks, completions, today);
    const todayPct = pctOfList(list);
    const runs = streakHistory(tasks, completions, today, todayPct);
    const bars = aggregateStats(tasks, completions, today, todayPct, period);
    const last30 = aggregateStats(tasks, completions, today, todayPct, "day");
    const nonZero = last30.filter((d) => d.pct > 0);
    return {
      todayPct,
      current: computeStreak(tasks, completions, today, todayPct),
      best: runs.reduce((m, r) => Math.max(m, r.length), 0),
      avg30: nonZero.length
        ? Math.round(nonZero.reduce((a, d) => a + d.pct, 0) / nonZero.length)
        : 0,
      runs: runs.slice(0, 6),
      bars,
    };
  }, [tasks, completions, today, period]);

  const focusStats = useMemo(() => {
    const done = data.focusSessions.filter(
      (s) => s.kind === "focus" && s.ended_at,
    );
    const todayMin = done
      .filter((s) => s.started_at.startsWith(today))
      .reduce((a, s) => a + sessionMinutes(s), 0);
    const byTag = new Map<string, number>();
    for (const s of done) {
      const task = tasks.find((t) => t.id === s.task_id);
      const tag = task?.tag ?? (s.label ? "(libre)" : t("(sans tag)"));
      byTag.set(tag, (byTag.get(tag) ?? 0) + sessionMinutes(s));
    }
    const rows = [...byTag.entries()]
      .map(([tag, min]) => ({ tag, min }))
      .sort((a, b) => b.min - a.min);
    return { todayMin, rows, max: rows[0]?.min ?? 1 };
  }, [data.focusSessions, tasks, today]);

  const tagColor = (name: string) =>
    data.tags.find((t) => t.name === name)?.color ?? "var(--color-text-dim)";

  // Courbe de R cumulé (30 j) live vs backtest
  const equity = useMemo(() => {
    const from = addDays(today, -29);
    const recent = data.trades.filter((t) => t.date >= from);
    const dates: string[] = [];
    for (let i = 29; i >= 0; i--) dates.push(addDays(today, -i));
    let live = 0;
    let backtest = 0;
    const points = dates.map((d) => {
      for (const t of recent.filter((t) => t.date === d)) {
        if ((t.mode ?? "live") === "live") live += t.result_r;
        else backtest += t.result_r;
      }
      return {
        label: d.slice(8) + "/" + d.slice(5, 7),
        live: Math.round(live * 100) / 100,
        backtest: Math.round(backtest * 100) / 100,
      };
    });
    const liveStats = tradeStats(
      recent.filter((t) => (t.mode ?? "live") === "live"),
    );
    const btStats = tradeStats(recent.filter((t) => t.mode === "backtest"));
    return { points, liveStats, btStats };
  }, [data.trades, today]);

  // Heatmap de complétion (26 semaines, style contributions GitHub)
  const heatmap = useMemo(() => {
    const weeks: { date: string; pct: number | null }[][] = [];
    // aligne sur le lundi de la semaine courante, 26 colonnes
    const wd = new Date().getDay();
    const monday = addDays(today, wd === 0 ? -6 : 1 - wd);
    for (let w = 25; w >= 0; w--) {
      const col: { date: string; pct: number | null }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = addDays(monday, -7 * w + d);
        if (date > today) {
          col.push({ date, pct: null });
          continue;
        }
        const stat =
          date === today
            ? { pct: pctOfList(todayTasks(tasks, completions, today)) }
            : dayStat(tasks, completions, date);
        col.push({ date, pct: stat.pct });
      }
      weeks.push(col);
    }
    return weeks;
  }, [tasks, completions, today]);

  const heatColor = (pct: number | null): string => {
    if (pct === null) return "var(--color-overlay)";
    if (pct >= 100) return "var(--color-green)";
    if (pct >= 80) return "color-mix(in srgb, var(--color-green) 65%, transparent)";
    if (pct >= 50) return "color-mix(in srgb, var(--color-green) 35%, transparent)";
    if (pct > 0) return "color-mix(in srgb, var(--color-green) 15%, transparent)";
    return "color-mix(in srgb, var(--color-red) 18%, transparent)";
  };

  const goalId = selGoalId ?? goals[0]?.id ?? null;
  const goalSeries = useMemo(() => {
    if (goalId === null) return [];
    return goalLog
      .filter((p) => p.goal_id === goalId)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((p) => ({ label: frDate(p.date), pct: p.pct }));
  }, [goalLog, goalId]);

  const handleAddMetric = async () => {
    const name = newName.trim();
    if (!name) return;
    await addMetric(name, newUnit.trim() || null);
    setNewName("");
    setNewUnit("");
    await refresh();
  };

  const handleDeleteMetric = async (id: number) => {
    if (deletingMetric !== id) {
      setDeletingMetric(id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingMetric(null), 3000);
      return;
    }
    window.clearTimeout(deleteTimer.current);
    setDeletingMetric(null);
    await deleteMetric(id);
    await refresh();
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl text-text">{t("Performance")}</h1>

      <ResizableGrid gridId="performance" className="mt-6">
      {/* Tuiles stats */}
      <ResizablePanel id="perf-tiles" defaultW={12}>
      <div className="auto-tiles panel-stretch gap-4">
        {[
          { label: t("Streak actuel"), value: `${derived.current} j`, accent: "text-green" },
          { label: t("Record"), value: `${derived.best} j`, accent: "text-blue" },
          { label: t("Moyenne 30 jours"), value: `${derived.avg30}%`, accent: "text-text" },
          { label: t("Focus aujourd'hui"), value: fmtMinutes(focusStats.todayMin), accent: "text-blue" },
        ].map((tile) => (
          <div key={tile.label} className="card min-w-0 p-5">
            <p className="hud-label" title={tile.label}>
              {tile.label}
            </p>
            <p
              className={`mt-1 truncate font-display text-3xl font-extrabold ${tile.accent}`}
              title={tile.value}
            >
              {tile.value}
            </p>
          </div>
        ))}
      </div>
      </ResizablePanel>

      {/* Complétion des tâches */}
      <ResizablePanel id="perf-completion" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">
            {t("Complétion des tâches")}
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                data-tip={t(p.label)}
                data-tip-sub={t("Granularité du graphique de complétion.")}
                className={`pill border px-3 py-1 text-xs font-medium transition-colors ${
                  period === p.value
                    ? "border-text/30 bg-surface-2 text-text"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {t(p.label)}
              </button>
            ))}
          </div>
        </div>
        <div className="panel-chart mt-4 min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={180}>
            <BarChart data={derived.bars} margin={{ top: 4, right: 0, bottom: 0, left: -24 }}>
              <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "var(--color-overlay)" }}
                contentStyle={tooltipStyle}
                formatter={(v) => [`${v ?? 0}%`, t("complétion")]}
              />
              <Bar dataKey="pct" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {derived.bars.map((d, i) => (
                  <Cell key={i} fill={d.isCurrent ? "var(--color-blue)" : "var(--color-green)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      </ResizablePanel>

      {/* Historique des streaks */}
      <ResizablePanel id="perf-streaks" defaultW={6} minH={200}>
        <section className="card p-5">
          <h2 className="hud-label">
            {t("Historique des streaks")}
          </h2>
          {derived.runs.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-dim">
              {t("Pas encore de streak — vise ≥80% de tes tâches un jour donné.")}
            </p>
          ) : (
            <ul className="panel-scroll mt-3 flex flex-col gap-2.5">
              {derived.runs.map((run) => (
                <li key={run.start} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-text-dim">
                    {frDate(run.start)} → {frDate(run.end)}
                  </span>
                  <div className="pill h-2 flex-1 overflow-hidden bg-surface-2">
                    <div
                      className="pill h-full bg-green"
                      style={{
                        width: `${Math.min((run.length / Math.max(derived.best, 1)) * 100, 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-display text-sm font-bold text-text">
                    {run.length} j
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </ResizablePanel>

      {/* Progression des objectifs */}
      <ResizablePanel id="perf-goals" defaultW={6}>
        <section className="card p-5">
          <div className="rgrid-head flex items-center justify-between gap-2">
            <h2 className="shrink-0 hud-label">
              {t("Objectifs")}
            </h2>
            {goals.length > 0 && (
              <select
                value={goalId ?? ""}
                onChange={(e) => setSelGoalId(Number(e.target.value))}
                className="min-w-0 flex-1 truncate rounded-[10px] border border-border bg-surface-2 px-2.5 py-1.5 text-xs text-text focus:border-blue focus:outline-none"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          {goalSeries.length < 2 ? (
            <p className="py-6 text-center text-sm text-text-dim">
              {t("L'historique se construit au fil des jours — reviens demain.")}
            </p>
          ) : (
            <div className="panel-chart mt-3 min-h-[150px]">
              <ResponsiveContainer width="100%" height="100%" minHeight={150}>
                <ComposedChart data={goalSeries} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                  <defs>
                    <linearGradient id="goalFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-blue)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--color-blue)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${v ?? 0}%`, "progression"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="pct"
                    stroke="var(--color-blue)"
                    strokeWidth={2.5}
                    fill="url(#goalFill)"
                    activeDot={{ r: 4, fill: "var(--color-blue)" }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </ResizablePanel>

      {/* Heatmap de complétion */}
      <ResizablePanel id="perf-heatmap" defaultW={12}>
      <section className="card p-5">
        <h2 className="hud-label">{t("discipline — 6 derniers mois")}</h2>
        <div className="mt-3 flex gap-[3px] overflow-x-auto pb-1">
          {heatmap.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <span
                  key={cell.date}
                  title={`${cell.date}${cell.pct !== null ? ` — ${cell.pct}%` : ""}`}
                  className="h-[11px] w-[11px] rounded-[3px]"
                  style={{ backgroundColor: heatColor(cell.pct) }}
                />
              ))}
            </div>
          ))}
        </div>
        {/* shrink-0 sur les deux libellés : `.hud-label` tronque en ellipse, et
            en fenêtre étroite « moins »/« plus » se faisaient rogner de 4-5px
            (rendus « moin… »/« plu… »). Ils ne doivent jamais être comprimés —
            ce sont les bornes de lecture de la légende. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="hud-label mr-1 shrink-0">{t("moins")}</span>
          {[null, 20, 60, 85, 100].map((p, i) => (
            <span
              key={i}
              className="h-[11px] w-[11px] shrink-0 rounded-[3px]"
              style={{ backgroundColor: heatColor(p) }}
            />
          ))}
          <span className="hud-label ml-1 shrink-0">{t("plus")}</span>
        </div>
      </section>
      </ResizablePanel>

      {/* Trading : R cumulé live vs backtest — réservé à Shale Trade.
          Rendu conditionnel (et non `display:none`) : la grille masonry ne doit
          pas se voir réserver une empreinte pour un panneau sans droit. */}
      {hasTrading && (
      <ResizablePanel id="perf-trading" defaultW={12}>
      <section className="card p-5">
        <div className="rgrid-head flex items-center justify-between">
          <h2 className="hud-label">{t("trading — r cumulé 30 jours")}</h2>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="h-2 w-2 rounded-full bg-blue" /> live{" "}
              <span className="font-mono font-semibold text-text">
                {fmtR(equity.liveStats.totalR)}
              </span>
            </span>
            <span className="flex items-center gap-1.5 text-xs text-text-dim">
              <span className="h-2 w-2 rounded-full bg-yellow" /> backtest{" "}
              <span className="font-mono font-semibold text-text">
                {fmtR(equity.btStats.totalR)}
              </span>
            </span>
          </div>
        </div>
        {equity.liveStats.count + equity.btStats.count === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">
            {t("Aucun trade sur 30 jours — la courbe apparaîtra ici.")}
          </p>
        ) : (
          <div className="panel-chart mt-3 min-h-[150px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={150}>
              <ComposedChart
                data={equity.points}
                margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
              >
                <defs>
                  <linearGradient id="perfLiveFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-blue)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-blue)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--color-overlay)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, name) => [
                    `${v ?? 0}R`,
                    name === "live" ? "live" : "backtest",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="live"
                  stroke="var(--color-blue)"
                  strokeWidth={2.5}
                  fill="url(#perfLiveFill)"
                />
                <Line
                  type="monotone"
                  dataKey="backtest"
                  stroke="var(--color-yellow)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
      </ResizablePanel>
      )}

      {/* Temps de focus par tag */}
      <ResizablePanel id="perf-focus" defaultW={12} minH={200}>
      <section className="card p-5">
        <h2 className="hud-label">{t("focus par tag — 30 jours")}</h2>
        {focusStats.rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">
            {t("Lance ta première session depuis le Timer ou le bouton lecture d'une tâche pour voir ton focus par tag.")}
          </p>
        ) : (
          <ul className="panel-scroll mt-3 flex flex-col gap-2.5">
            {focusStats.rows.map((row) => (
              <li key={row.tag} className="flex items-center gap-3">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: tagColor(row.tag) }}
                />
                <span className="w-28 shrink-0 truncate text-xs text-text">
                  {row.tag}
                </span>
                <div className="pill h-2 flex-1 overflow-hidden bg-surface-2">
                  <div
                    className="pill h-full"
                    style={{
                      width: `${(row.min / focusStats.max) * 100}%`,
                      backgroundColor: tagColor(row.tag),
                    }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right font-mono text-xs font-semibold text-text">
                  {fmtMinutes(row.min)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      </ResizablePanel>

      {/* Métriques custom */}
      <ResizablePanel id="perf-metrics" defaultW={12}>
      <section>
        {/* flex-wrap + min-w-0 : en fenêtre étroite le formulaire passe sous le
            titre et les champs rétrécissent au lieu de déborder du panneau (où
            l'`overflow-x: clip` du wrap les rendait invisibles/incliquables).
            En plein écran il y a la place : aucun rétrécissement, rendu inchangé. */}
        <div className="rgrid-head flex flex-wrap items-center justify-between gap-2">
          <h2 className="hud-label">
            {t("Métriques")}
          </h2>
          <form
            className="flex min-w-0 flex-wrap items-center justify-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddMetric();
            }}
          >
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t("Nouvelle métrique…")}
              className="w-44 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <input
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              placeholder={t("unité")}
              className="w-20 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <button
              type="submit"
              disabled={!newName.trim()}
              className="pill shrink-0 bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>

        {metrics.length === 0 ? (
          <div className="card mt-3 p-8 text-center text-sm text-text-dim">
            {t("Suis ce qui compte pour toi : heures de backtesting, trades pris, reels publiés…")}
          </div>
        ) : (
          <div className="auto-tiles-lg mt-3 gap-4">
            {metrics.map((m) => (
              <MetricCard
                key={m.id}
                metric={m}
                entries={metricEntries.filter((e) => e.metric_id === m.id)}
                today={today}
                deleting={deletingMetric === m.id}
                onDelete={() => handleDeleteMetric(m.id)}
                onSave={async (value) => {
                  await setMetricValue(m.id, today, value);
                  await refresh();
                }}
              />
            ))}
          </div>
        )}
      </section>
      </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}

function MetricCard({
  metric,
  entries,
  today,
  deleting,
  onDelete,
  onSave,
}: {
  metric: CustomMetric;
  entries: { date: string; value: number }[];
  today: string;
  deleting: boolean;
  onDelete: () => void;
  onSave: (value: number) => Promise<void>;
}) {
  const todayValue = entries.find((e) => e.date === today)?.value ?? 0;
  const [draft, setDraft] = useState<string>(String(todayValue));

  const last14 = useMemo(() => {
    const byDate = new Map(entries.map((e) => [e.date, e.value]));
    const out: { label: string; value: number }[] = [];
    const [y, m, d] = today.split("-").map(Number);
    for (let i = 13; i >= 0; i--) {
      const date = new Date(y, m - 1, d - i);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      out.push({ label: key.slice(8), value: byDate.get(key) ?? 0 });
    }
    return out;
  }, [entries, today]);

  const total7 = last14.slice(7).reduce((a, e) => a + e.value, 0);

  const save = () => {
    const v = parseFloat(draft.replace(",", "."));
    if (!Number.isNaN(v)) onSave(v);
  };

  return (
    <div className="card group p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-text-dim">{metric.name}</p>
        <button
          type="button"
          onClick={onDelete}
          className={`shrink-0 rounded-md px-1 text-xs transition-colors ${
            deleting
              ? "bg-red/20 font-semibold text-red"
              : "text-text-dim opacity-0 hover:text-red group-hover:opacity-100"
          }`}
          aria-label={deleting ? t("Confirmer la suppression de {name}", { name: metric.name }) : t("Supprimer {name}", { name: metric.name })}
          data-tip={deleting ? t("Confirmer la suppression") : t("Supprimer la métrique")}
          data-tip-sub={t("Un second clic supprime la métrique et tout son historique.")}
        >
          {deleting ? t("sûr ?") : <IconX className="h-3 w-3" />}
        </button>
      </div>

      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-extrabold text-text">
          {todayValue}
        </span>
        {metric.unit && (
          <span className="text-xs text-text-dim">{t("{unite} aujourd'hui", { unite: metric.unit })}</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] text-text-dim">
        {Math.round(total7 * 10) / 10}
        {metric.unit ? ` ${metric.unit}` : ""} {t("sur 7 jours")}
      </p>

      <div className="mt-2 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={last14} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <Bar dataKey="value" radius={[2, 2, 2, 2]} fill="var(--color-green)" maxBarSize={10} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          inputMode="decimal"
          className="w-full min-w-0 flex-1 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-sm text-text focus:border-blue focus:outline-none"
          aria-label={t("Valeur du jour pour {name}", { name: metric.name })}
        />
        <button
          type="button"
          onClick={() => {
            const v = (parseFloat(draft.replace(",", ".")) || 0) + 1;
            setDraft(String(v));
            onSave(v);
          }}
          className="pill shrink-0 bg-surface-2 px-3 py-1.5 text-sm font-semibold text-text hover:bg-border"
          aria-label={`+1 ${metric.unit ?? ""}`}
          data-tip={t("Incrémenter")}
          data-tip-sub={t("Ajoute 1 à la valeur du jour et l’enregistre.")}
        >
          +1
        </button>
        <button
          type="submit"
          className="pill shrink-0 bg-blue px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          OK
        </button>
      </form>
    </div>
  );
}
