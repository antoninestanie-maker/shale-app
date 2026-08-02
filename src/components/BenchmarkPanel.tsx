import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  benchMeta,
  BENCH_ORDER,
  benchStat,
  dailyForm,
  dailyTrend,
  reactionCheck,
  type DailyForm,
} from "../lib/benchmark";
import type { AppData, BenchTest } from "../lib/types";
import { t, tp } from "../lib/i18n";
import {
  NumberMemoryTest,
  ReactionTest,
  SequenceMemoryTest,
} from "./BenchmarkTests";

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

const tooltipStyle = {
  backgroundColor: "var(--color-surface-2)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
  color: "var(--color-text)",
};

/**
 * Forme du jour : meilleur score d'aujourd'hui vs baseline personnelle.
 * `deltaPct` est déjà orienté « performance » (positif = mieux que d'habitude),
 * quel que soit le sens du test — pas de piège pour la réaction (plus bas = mieux).
 */
function FormChip({ form }: { form: DailyForm }) {
  const meta = benchMeta()[form.test];

  if (form.today === null) {
    return (
      <span
        className="pill shrink-0 border border-border px-2 py-0.5 text-[10px] font-medium text-text-dim"
        data-tip={t("Pas encore testé aujourd'hui")}
        data-tip-sub={t("Lance le test pour situer ta forme du jour.")}
      >
        {t("non testé")}
      </span>
    );
  }

  // Testé, mais pas assez d'historique pour comparer : on montre la valeur brute.
  if (!form.hasBaseline || form.deltaPct === null) {
    return (
      <span
        className="pill shrink-0 border border-border px-2 py-0.5 text-[10px] font-medium text-text-dim"
        data-tip={t("Aujourd'hui : {v}", { v: meta.format(form.today) })}
        data-tip-sub={t("Il faut au moins 3 jours de tests pour établir ta référence.")}
      >
        {meta.format(form.today)}
      </span>
    );
  }

  const better = form.deltaPct >= 0;
  return (
    <span
      className={`pill shrink-0 border px-2 py-0.5 text-[10px] font-semibold ${
        better
          ? "border-green/40 bg-green/10 text-green"
          : "border-red/40 bg-red/10 text-red"
      }`}
      data-tip={t("Aujourd'hui : {v}", { v: meta.format(form.today) })}
      data-tip-sub={t("Ta référence est {ref} — {dir} de {pct} %.", {
        ref: meta.format(form.baseline ?? 0),
        dir: better ? t("tu es au-dessus") : t("tu es en dessous"),
        pct: Math.abs(form.deltaPct),
      })}
    >
      {better ? "+" : "−"}
      {Math.abs(form.deltaPct)} %
    </span>
  );
}

export default function BenchmarkPanel({ data, refresh }: Props) {
  const [active, setActive] = useState<BenchTest | null>(null);
  const [trendTest, setTrendTest] = useState<BenchTest>("reaction");

  const stats = useMemo(
    () => BENCH_ORDER.map((t) => benchStat(data.benchmarks, t)),
    [data.benchmarks],
  );

  const forms = useMemo(() => {
    const out = {} as Record<BenchTest, DailyForm>;
    for (const t of BENCH_ORDER) out[t] = dailyForm(data.benchmarks, t);
    return out;
  }, [data.benchmarks]);

  const check = useMemo(() => reactionCheck(data.benchmarks), [data.benchmarks]);

  // Tendance « meilleur par jour » — disponible pour les TROIS tests
  // (auparavant la réaction seule avait droit à sa courbe).
  const trend = useMemo(
    () => dailyTrend(data.benchmarks, trendTest),
    [data.benchmarks, trendTest],
  );

  const trendMeta = benchMeta()[trendTest];
  const close = () => setActive(null);
  const afterSave = async () => {
    await refresh();
  };

  return (
    <section className="card p-5">
      <div className="rgrid-head flex items-center justify-between gap-3">
        <h2 className="hud-label min-w-0 truncate">{t("human benchmark — réflexes &amp; mémoire")}</h2>
        {check.hasBaseline && check.baseline !== null && (
          <span className="shrink-0 font-mono text-[11px] text-text-dim">
            {t("baseline réaction :")} {check.baseline} ms
          </span>
        )}
      </div>

      <div className="auto-tiles-lg mt-4 gap-3">
        {stats.map((s) => {
          const meta = benchMeta()[s.test];
          return (
            <div key={s.test} className="card flex flex-col bg-surface-2/40 p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <p className="truncate text-sm font-medium text-text">{t(meta.short)}</p>
                </div>
                <FormChip form={forms[s.test]} />
              </div>

              <div className="mt-3 flex items-baseline gap-1.5">
                {s.best !== null ? (
                  <>
                    <span
                      className="font-display text-3xl font-extrabold"
                      style={{ color: meta.color }}
                    >
                      {meta.lowerIsBetter ? Math.round(s.best) : s.best}
                    </span>
                    <span className="text-xs text-text-dim">{meta.unit} ({t("record")})</span>
                  </>
                ) : (
                  <span className="text-sm text-text-dim">{t("Pas encore testé")}</span>
                )}
              </div>

              {s.count > 0 && (
                <p className="mt-0.5 text-[11px] text-text-dim">
                  {t("moy.")} {meta.format(s.avg ?? 0)} · {t("dernier")}{" "}
                  {meta.format(s.last ?? 0)} · {tp(s.count, "{n} essai", "{n} essais")}
                </p>
              )}
              <p
                className="mt-0.5 text-[11px] text-text-dim opacity-70"
                data-tip={t("Repère indicatif")}
                data-tip-sub={t("Ordre de grandeur adulte courant — pour situer un score, pas pour le juger.")}
              >
                {t("repère")} ≈ {meta.format(meta.reference)}
              </p>

              <button
                type="button"
                onClick={() => setActive(s.test)}
                data-tip={t(meta.label)}
                data-tip-sub={t(meta.hint)}
                className="pill mt-auto w-full border border-border py-1.5 text-xs font-semibold text-text transition-colors hover:bg-surface-2"
              >
                {s.count > 0 ? t("Refaire le test") : t("Lancer le test")}
              </button>
            </div>
          );
        })}
      </div>

      <div className="panel-col panel-grow mt-4 min-h-[150px]">
        <div className="mb-2 flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="hud-label min-w-0 truncate">{t("tendance — meilleur par jour")}</p>
          <div className="flex min-w-0 flex-wrap gap-1">
            {BENCH_ORDER.map((test) => (
              <button
                key={test}
                type="button"
                onClick={() => setTrendTest(test)}
                data-tip={t("Tendance {test}", { test: t(benchMeta()[test].short).toLowerCase() })}
                className={`pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  trendTest === test
                    ? "border-text/30 bg-surface-2 text-text"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {t(benchMeta()[test].short)}
              </button>
            ))}
          </div>
        </div>

        {trend.length >= 2 ? (
          <div className="panel-chart min-h-[120px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={120}>
              <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <defs>
                  {/* id dérivé du test : deux dégradés ne peuvent pas se marcher dessus */}
                  <linearGradient id={`benchTrend-${trendTest}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendMeta.color} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={trendMeta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
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
                  allowDecimals={false}
                  domain={
                    trendMeta.lowerIsBetter
                      ? ["dataMin - 20", "dataMax + 20"]
                      : ["dataMin - 1", "dataMax + 1"]
                  }
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [trendMeta.format(Number(v)), trendMeta.short]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trendMeta.color}
                  strokeWidth={2.5}
                  fill={`url(#benchTrend-${trendTest})`}
                  activeDot={{ r: 4, fill: trendMeta.color }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="panel-grow flex items-center justify-center rounded-[var(--radius-field)] border border-dashed border-border px-4 py-6 text-center">
            <p className="text-xs text-text-dim">
              {trend.length === 0
                ? t("Aucun résultat en {test} — lance le test pour démarrer la courbe.", { test: t(trendMeta.short).toLowerCase() })
                : t("Encore un jour de test et la tendance apparaît.")}
            </p>
          </div>
        )}
      </div>

      {active === "reaction" && (
        <ReactionTest onClose={close} onSaved={afterSave} />
      )}
      {active === "memory" && (
        <NumberMemoryTest onClose={close} onSaved={afterSave} />
      )}
      {active === "sequence" && (
        <SequenceMemoryTest onClose={close} onSaved={afterSave} />
      )}
    </section>
  );
}
