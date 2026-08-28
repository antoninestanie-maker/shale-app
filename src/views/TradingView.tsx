import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { IconImage } from "../components/icons";
import LiveTracker from "../components/LiveTracker";
import Toast, { type ToastState } from "../components/Toast";
import TradeModal from "../components/TradeModal";
import { addDays, todayStr } from "../lib/logic";
import { deleteTrade, isTauri } from "../lib/repo";
import {
  fmtR,
  outcomeOf,
  statsBySetup,
  tradeStats,
  type TradeStats,
} from "../lib/trades";
import type { AppData, Trade } from "../lib/types";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { localeTag, t } from "../lib/i18n";
/** Jauge radiale de winrate (référence : dashboards de trading pro). */
function WinrateGauge({ stats }: { stats: TradeStats }) {
  const pct = stats.winrate ?? 0;
  const R = 22;
  const CIRC = 2 * Math.PI * R;
  const color =
    stats.winrate === null ? "var(--color-text-dim)" : pct >= 50 ? "var(--color-green)" : "var(--color-red)";
  return (
    <div className="relative h-14 w-14 shrink-0">
      <svg viewBox="0 0 56 56" className="h-full w-full -rotate-90">
        <circle cx="28" cy="28" r={R} fill="none" stroke="var(--color-border)" strokeWidth="5" />
        <circle
          cx="28"
          cy="28"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-text">
        {stats.winrate === null ? "—" : `${pct}%`}
      </span>
    </div>
  );
}

/** Compteurs W / BE / L colorés. */
function CountPills({ stats }: { stats: TradeStats }) {
  const items = [
    { n: stats.count, color: "var(--color-blue)", title: "trades" },
    { n: stats.wins, color: "var(--color-green)", title: "gagnants" },
    { n: stats.be, color: "var(--color-yellow)", title: "break-even" },
    { n: stats.losses, color: "var(--color-red)", title: "perdants" },
  ];
  return (
    <div className="flex gap-1.5">
      {items.map((it, i) => (
        <span
          key={i}
          title={it.title}
          className="flex h-6 min-w-6 items-center justify-center rounded-full border px-1 font-mono text-[10px] font-semibold"
          style={{
            borderColor: `color-mix(in srgb, ${it.color} 45%, transparent)`,
            color: it.color,
          }}
        >
          {it.n}
        </span>
      ))}
    </div>
  );
}

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/** Abréviations des 12 mois dans la langue courante (janv./jan. → Jan/Feb…). */
function monthNames(): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag(), { month: "short" });
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(2000, i, 1)));
}

function frDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(localeTag(), {
    day: "2-digit",
    month: "short",
  });
}

export default function TradingView({ data, refresh }: Props) {
  const [tab, setTab] = useState<"live" | "backtest">("live");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Trade | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null); // screenshot agrandi
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  const today = todayStr();

  // action palette / vocal "nouveau trade"
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-trade", onNew);
    return () => window.removeEventListener("sb:new-trade", onNew);
  }, []);

  // conversion asset:// pour afficher le screenshot agrandi
  useEffect(() => {
    if (!zoom) {
      setZoomSrc(null);
      return;
    }
    if (isTauri) {
      import("@tauri-apps/api/core").then(({ convertFileSrc }) =>
        setZoomSrc(convertFileSrc(zoom)),
      );
    } else {
      setZoomSrc(zoom);
    }
  }, [zoom]);

  const shown = useMemo(
    () => data.trades.filter((t) => (t.mode ?? "live") === tab),
    [data.trades, tab],
  );

  // Cartes de période : semaine / mois / année / total
  const periods = useMemo(() => {
    const monthStart = today.slice(0, 8) + "01";
    const yearStart = today.slice(0, 5) + "01-01";
    return [
      { label: t("Cette semaine"), stats: tradeStats(shown.filter((t) => t.date >= addDays(today, -6))) },
      { label: t("Ce mois"), stats: tradeStats(shown.filter((t) => t.date >= monthStart)) },
      { label: t("Cette année"), stats: tradeStats(shown.filter((t) => t.date >= yearStart)) },
      { label: "Total", stats: tradeStats(shown) },
    ];
  }, [shown, today]);

  // Équity : R cumulé sur 30 jours (aire dégradée)
  const equity = useMemo(() => {
    let cum = 0;
    const points = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      for (const t of shown.filter((t) => t.date === d)) cum += t.result_r;
      points.push({
        label: d.slice(8) + "/" + d.slice(5, 7),
        r: Math.round(cum * 100) / 100,
      });
    }
    return points;
  }, [shown, today]);

  // Stats mensuelles par année (tableau façon journal pro)
  const monthly = useMemo(() => {
    const years = [...new Set(shown.map((t) => t.date.slice(0, 4)))].sort().reverse();
    return years.map((year) => ({
      year,
      months: Array.from({ length: 12 }, (_, m) => {
        const prefix = `${year}-${String(m + 1).padStart(2, "0")}`;
        return tradeStats(shown.filter((t) => t.date.startsWith(prefix)));
      }),
      total: tradeStats(shown.filter((t) => t.date.startsWith(year))),
    }));
  }, [shown]);

  const bySetup = useMemo(() => statsBySetup(shown), [shown]);

  const handleDelete = async (id: number) => {
    if (deletingId !== id) {
      setDeletingId(id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    window.clearTimeout(deleteTimer.current);
    setDeletingId(null);
    await deleteTrade(id);
    await refresh();
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl text-text">{t("Trading")}</h1>
          <div className="flex gap-1">
            {(["live", "backtest"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setTab(m)}
                data-tip={m === "live" ? t("Trades en réel") : t("Trades de backtest")}
                data-tip-sub={
                  m === "live"
                    ? t("Journal du compte réel : statistiques, équity et tracker de positions.")
                    : t("Trades testés sur historique — comptés séparément du réel.")
                }
                className={`pill border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                  tab === m
                    ? m === "live"
                      ? "border-blue/50 bg-blue/15 text-blue"
                      : "border-yellow/50 bg-yellow/15 text-yellow"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {m === "live" ? "Live" : "Backtest"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouveau trade")}
          data-tip-sub={t("Saisie manuelle dans le journal (instrument, sens, résultat en R).")}
          className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("+ Nouveau trade")}
        </button>
      </header>

      <ResizableGrid gridId={"trading"} className="mt-6">
      {/* Tracker live : positions en attente de dénouement (envoyées via "Trader") */}
      {tab === "live" && (
        <ResizablePanel
          id="trading-tracker"
          title="Tracker live"
          defaultW={12}
          minW={5}
          minH={180}
        >
          <LiveTracker data={data} refresh={refresh} onToast={setToast} />
        </ResizablePanel>
      )}

      {/* Cartes de période : R, jauge winrate, compteurs, PF & drawdown */}
      <ResizablePanel id="trading-tiles" title="Stats R" defaultW={12} minW={4} minH={130}>
      <div className="auto-tiles-lg panel-stretch gap-4">
        {periods.map(({ label, stats }) => (
          <div key={label} className="card min-w-0 p-4">
            <p className="hud-label">{label}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p
                  className={`font-display text-2xl font-extrabold leading-none ${
                    stats.count === 0
                      ? "text-text-dim"
                      : stats.totalR >= 0
                        ? "text-green"
                        : "text-red"
                  }`}
                >
                  {stats.count === 0 ? "—" : fmtR(stats.totalR)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-text-dim">
                  {stats.avgR === null ? "" : t("{r} / trade", { r: fmtR(stats.avgR) })}
                </p>
              </div>
              <WinrateGauge stats={stats} />
            </div>
            <div className="mt-2">
              <CountPills stats={stats} />
            </div>
            {stats.count > 0 && (
              <p className="mt-2 font-mono text-[10px] text-text-dim">
                PF{" "}
                <span
                  className={
                    stats.profitFactor == null
                      ? ""
                      : stats.profitFactor >= 1
                        ? "font-semibold text-green"
                        : "font-semibold text-red"
                  }
                >
                  {stats.profitFactor ?? "—"}
                </span>
                {" · "}DD max{" "}
                <span
                  className={
                    stats.maxDrawdownR < 0 ? "font-semibold text-red" : ""
                  }
                >
                  {fmtR(stats.maxDrawdownR)}
                </span>
              </p>
            )}
          </div>
        ))}
      </div>
      </ResizablePanel>

      {/* Équity — R cumulé 30 jours */}
      <ResizablePanel
        id="trading-equity"
        title={t("Équity 30 jours")}
        defaultW={12}
        minW={4}
        minH={220}
      >
      <section className="card flex flex-col p-5">
        <h2 className="hud-label">{t("équity — r cumulé 30 jours")}</h2>
        {/* `panel-chart` : hauteur DÉFINIE et extensible — le graphique grandit
            avec le widget au lieu de laisser du vide sous une hauteur figée.
            Pas de prop `debounce` sur le ResponsiveContainer : elle retarde la
            mise à l'échelle finale du SVG alors que la fluidité est déjà
            assurée en amont — la grille ne commet qu'un rendu par cran de
            24 px. On reste ainsi aligné sur les autres graphiques de l'app. */}
        <div className="panel-chart mt-3 min-h-[150px]">
          <ResponsiveContainer width="100%" height="100%" minHeight={130}>
            <ComposedChart data={equity} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tab === "live" ? "var(--color-blue)" : "var(--color-yellow)"} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tab === "live" ? "var(--color-blue)" : "var(--color-yellow)"} stopOpacity={0} />
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
              <YAxis tick={{ fill: "var(--color-text-dim)", fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--color-surface-2)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 10,
                  fontSize: 12,
                  color: "var(--color-text)",
                }}
                formatter={(v) => [`${v ?? 0}R`, t("cumulé")]}
              />
              <Area
                type="monotone"
                dataKey="r"
                stroke={tab === "live" ? "var(--color-blue)" : "var(--color-yellow)"}
                strokeWidth={2.5}
                fill="url(#equityFill)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>
      </ResizablePanel>

      {/* Stats mensuelles */}
      {monthly.length > 0 && monthly[0].total.count > 0 && (
        <ResizablePanel
          id="trading-monthly"
          title="Stats mensuelles"
          defaultW={12}
          minW={5}
          minH={190}
        >
        <section className="card flex flex-col p-5">
          <h2 className="hud-label">stats mensuelles</h2>
          {/* `panel-scroll` autorise le moteur de grille à descendre sous la
              hauteur du contenu (le tableau défile alors dans la carte) ;
              `table-scroll` garde le défilement horizontal DANS le cadre. */}
          <div className="panel-scroll table-scroll mt-3">
            <table className="w-full min-w-[760px] border-collapse">
              <thead>
                <tr>
                  <th className="hud-label pb-2 text-left">{t("année")}</th>
                  {monthNames().map((m, i) => (
                    <th key={i} className="hud-label pb-2 text-right">{m}</th>
                  ))}
                  <th className="hud-label pb-2 pl-3 text-right">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map(({ year, months, total }) => (
                  <tr key={year} className="border-t border-border">
                    <td className="py-2 font-mono text-xs font-semibold text-text">{year}</td>
                    {months.map((s, m) => (
                      <td key={m} className="py-2 text-right align-top">
                        {s.count === 0 ? (
                          <span className="text-xs text-text-dim">·</span>
                        ) : (
                          <>
                            <span
                              className={`block font-mono text-xs font-semibold ${
                                s.totalR >= 0 ? "text-green" : "text-red"
                              }`}
                            >
                              {fmtR(s.totalR)}
                            </span>
                            <span className="block font-mono text-[10px] text-text-dim">
                              {s.winrate === null ? "—" : `${s.winrate}%`} · {s.count}
                            </span>
                          </>
                        )}
                      </td>
                    ))}
                    <td className="border-l border-border py-2 pl-3 text-right">
                      <span
                        className={`block font-mono text-xs font-bold ${
                          total.totalR >= 0 ? "text-green" : "text-red"
                        }`}
                      >
                        {fmtR(total.totalR)}
                      </span>
                      <span className="block font-mono text-[10px] text-text-dim">
                        {total.winrate === null ? "—" : `${total.winrate}%`} · {total.count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </ResizablePanel>
      )}

      {/* Stats par setup */}
      <ResizablePanel id="trading-setup" title={t("Par setup")} defaultW={12} minW={4} minH={170}>
      <section className="card p-5">
        <h2 className="hud-label">{t("par setup")}</h2>
        {bySetup.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-dim">
            Loggue ton premier trade avec « + Nouveau trade » pour voir tes
            statistiques par setup.
          </p>
        ) : (
          // Deux lignes plutôt qu'une rangée de colonnes fixes : le nom se
          // tronque, les chiffres gardent leur place et la jauge occupe la
          // largeur restante. Aucune largeur ne peut plus entrer en collision,
          // quelle que soit la taille donnée au widget.
          <ul className="panel-scroll mt-3 flex flex-col gap-3">
            {bySetup.map(({ setup, stats }) => (
              <li key={setup} className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-text" title={setup}>
                    {setup}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-text-dim">
                    {stats.count} tr.
                  </span>
                  <span className="shrink-0 font-mono text-xs font-semibold text-text">
                    {stats.winrate === null ? "—" : `${stats.winrate}%`}
                  </span>
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-xs font-semibold ${
                      stats.totalR >= 0 ? "text-green" : "text-red"
                    }`}
                  >
                    {fmtR(stats.totalR)}
                  </span>
                </div>
                <div className="pill mt-1.5 h-1.5 overflow-hidden bg-surface-2">
                  <div
                    className="pill h-full bg-green transition-[width] duration-500"
                    style={{ width: `${stats.winrate ?? 0}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </ResizablePanel>

      {/* Liste des trades */}
      <ResizablePanel
        id="trading-list"
        title={t("Liste des trades")}
        defaultW={12}
        minW={5}
        minH={200}
      >
      <section className="card">
        <ul className="panel-scroll flex flex-col p-2">
          {shown.length === 0 && (
            <li className="py-10 text-center text-sm text-text-dim">
              {t("Aucun trade enregistré.")}
            </li>
          )}
          {shown.map((trade) => {
            const outcome = outcomeOf(trade);
            return (
              // `flex-wrap` : sous une certaine largeur, notes et actions
              // passent à la ligne au lieu d'être rognées par l'`overflow` du
              // panneau. Le bloc identité (date, sens, instrument, R) reste
              // toujours groupé et lisible.
              <li
                key={trade.id}
                className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[10px] px-3 py-2.5 hover:bg-surface-2"
              >
                {/* `whitespace-nowrap` : « 20 juil. » tient sur une ligne, sinon
                    chaque rangée de la liste doublerait de hauteur. */}
                <span className="w-[58px] shrink-0 whitespace-nowrap font-mono text-xs text-text-dim">
                  {frDate(trade.date)}
                </span>
                <span
                  className={`pill w-14 shrink-0 border px-2 py-0.5 text-center text-[10px] font-bold uppercase ${
                    trade.direction === "long"
                      ? "border-green/40 text-green"
                      : "border-red/40 text-red"
                  }`}
                >
                  {trade.direction}
                </span>
                <span className="w-20 shrink-0 font-mono text-sm font-semibold text-text">
                  {trade.instrument}
                </span>
                {trade.setup && (
                  <span
                    className="pill max-w-[40%] shrink-0 truncate bg-surface-2 px-2 py-0.5 text-[11px] text-text-dim"
                    title={trade.setup}
                  >
                    {trade.setup}
                  </span>
                )}
                <span
                  className={`w-16 shrink-0 font-mono text-sm font-bold ${
                    outcome === "win"
                      ? "text-green"
                      : outcome === "loss"
                        ? "text-red"
                        : "text-text-dim"
                  }`}
                >
                  {fmtR(trade.result_r)}
                </span>
                {trade.screenshot_path && (
                  <button
                    type="button"
                    onClick={() => setZoom(trade.screenshot_path)}
                    className="shrink-0 text-text-dim transition-colors hover:text-text"
                    data-tip={t("Voir la capture")}
                    data-tip-sub={t("Agrandit le screenshot joint à ce trade.")}
                    aria-label={t("Voir le screenshot")}
                  >
                    <IconImage className="h-4 w-4" />
                  </button>
                )}
                <span className="min-w-0 flex-1 basis-40 truncate text-xs text-text-dim">
                  {trade.notes}
                </span>

                <span className="ml-auto flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => setEditing(trade)}
                    data-tip={t("Modifier le trade")}
                    className="rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
                    aria-label={t("Modifier")}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(trade.id)}
                    className={`rounded-md p-1.5 transition-colors ${
                      deletingId === trade.id
                        ? "bg-red/20 text-red"
                        : "text-text-dim hover:bg-surface hover:text-red"
                    }`}
                    aria-label={
                      deletingId === trade.id
                        ? t("Confirmer la suppression")
                        : t("Supprimer")
                    }
                    data-tip={
                      deletingId === trade.id ? t("Confirmer la suppression") : t("Supprimer le trade")
                    }
                    data-tip-sub={t("Un second clic le retire définitivement du journal.")}
                  >
                    {deletingId === trade.id ? (
                      <span className="px-0.5 text-[11px] font-semibold">
                        {t("sûr ?")}
                      </span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      </svg>
                    )}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      </ResizablePanel>
      </ResizableGrid>

      {(creating || editing) && (
        <TradeModal
          trade={editing}
          data={data}
          defaultMode={tab}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {zoom && zoomSrc && (
        // ⚠️ `/85` et non le `/60` de doctrine, DÉLIBÉRÉMENT : ce n'est pas un
        // backdrop de modale, c'est une visionneuse d'image. Un voile clair y
        // laisserait l'interface concurrencer le screenshot qu'on vient
        // d'agrandir pour le regarder.
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-8"
          onClick={() => setZoom(null)}
        >
          <img
            src={zoomSrc}
            alt={t("Screenshot du trade")}
            className="max-h-full max-w-full rounded-[12px] border border-border"
          />
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
