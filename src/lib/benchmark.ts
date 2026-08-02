// Human Benchmark : métadonnées des tests + statistiques + logique de
// l'"alcootest" pré-session (détection d'une baisse de réflexes vs baseline).
import { todayStr } from "./logic";
import type { BenchmarkResult, BenchTest } from "./types";

import { t } from "./i18n";
export interface BenchMeta {
  id: BenchTest;
  label: string;
  short: string;
  unit: string;
  lowerIsBetter: boolean;
  color: string;
  hint: string;
  format: (score: number) => string;
  /** Repère INDICATIF (ordre de grandeur adulte courant) — sert à situer un
      score, jamais à juger. Affiché préfixé « ≈ ». */
  reference: number;
}

export const benchMeta = (): Record<BenchTest, BenchMeta> => ({
  reaction: {
    id: "reaction",
    label: t("Temps de réaction"),
    short: t("Réaction"),
    unit: "ms",
    lowerIsBetter: true,
    color: "var(--color-blue)",
    hint: t("Attends que le panneau passe au vert, puis clique le plus vite possible."),
    format: (s) => `${Math.round(s)} ms`,
    reference: 273,
  },
  memory: {
    id: "memory",
    label: t("Mémoire des chiffres"),
    short: t("Mémoire"),
    unit: "chiffres",
    lowerIsBetter: false,
    color: "var(--color-green)",
    hint: t("Mémorise la suite de chiffres, puis saisis-la."),
    format: (s) => `${s} chiffres`,
    reference: 7,
  },
  sequence: {
    id: "sequence",
    label: t("Mémoire visuelle"),
    short: t("Séquence"),
    unit: "niveau",
    lowerIsBetter: false,
    color: "var(--color-yellow)",
    hint: t("Reproduis la séquence de cases allumées."),
    format: (s) => `niveau ${s}`,
    reference: 9,
  },
});

export const BENCH_ORDER: BenchTest[] = ["reaction", "memory", "sequence"];

export interface BenchStat {
  test: BenchTest;
  best: number | null;
  avg: number | null; // moyenne sur les 20 derniers essais
  last: number | null;
  count: number;
}

function bestOf(test: BenchTest, values: number[]): number | null {
  if (values.length === 0) return null;
  return benchMeta()[test].lowerIsBetter
    ? Math.min(...values)
    : Math.max(...values);
}

export function benchStat(results: BenchmarkResult[], test: BenchTest): BenchStat {
  const rows = results
    .filter((r) => r.test === test)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const values = rows.map((r) => r.score);
  const recent = values.slice(-20);
  return {
    test,
    best: bestOf(test, values),
    avg: recent.length
      ? Math.round((recent.reduce((a, v) => a + v, 0) / recent.length) * 10) / 10
      : null,
    last: values.length ? values[values.length - 1] : null,
    count: values.length,
  };
}

/** Meilleur score d'un test pour une date donnée (min ou max selon le test). */
export function dailyBest(
  results: BenchmarkResult[],
  test: BenchTest,
  date: string,
): number | null {
  const vals = results
    .filter((r) => r.test === test && r.created_at.startsWith(date))
    .map((r) => r.score);
  return vals.length ? bestOf(test, vals) : null;
}

/** Meilleurs quotidiens antérieurs à `today`, du plus récent au plus ancien. */
function priorDailyBests(
  results: BenchmarkResult[],
  test: BenchTest,
  today: string,
  days = 30,
): number[] {
  const lower = benchMeta()[test].lowerIsBetter;
  const byDay = new Map<string, number>();
  for (const r of results) {
    if (r.test !== test) continue;
    const day = r.created_at.slice(0, 10);
    if (day >= today) continue;
    const cur = byDay.get(day);
    if (cur === undefined || (lower ? r.score < cur : r.score > cur)) {
      byDay.set(day, r.score);
    }
  }
  return [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, days)
    .map(([, v]) => v);
}

export interface DailyForm {
  test: BenchTest;
  today: number | null; // meilleur score du jour
  baseline: number | null; // moyenne des meilleurs quotidiens (~30 j)
  /** Écart de PERFORMANCE vs baseline, en % — **positif = meilleur que
      d'habitude**, quel que soit le sens du test (déjà orienté). */
  deltaPct: number | null;
  hasBaseline: boolean;
}

/**
 * « Forme du jour » d'un test : meilleur score du jour vs moyenne des meilleurs
 * quotidiens précédents. Généralise `reactionCheck` aux trois tests — ce dernier
 * reste la source de vérité de l'alerte « alcootest » (seuil + sémantique).
 */
export function dailyForm(
  results: BenchmarkResult[],
  test: BenchTest,
  today = todayStr(),
): DailyForm {
  const prior = priorDailyBests(results, test, today);
  const baseline = prior.length
    ? Math.round((prior.reduce((a, v) => a + v, 0) / prior.length) * 10) / 10
    : null;
  const todayBest = dailyBest(results, test, today);

  let deltaPct: number | null = null;
  if (baseline !== null && baseline !== 0 && todayBest !== null) {
    const raw = ((todayBest - baseline) / baseline) * 100;
    deltaPct = Math.round(benchMeta()[test].lowerIsBetter ? -raw : raw);
  }

  return {
    test,
    today: todayBest,
    baseline,
    deltaPct,
    hasBaseline: prior.length >= 3,
  };
}

/** Série « meilleur par jour » sur les N derniers jours enregistrés. */
export function dailyTrend(
  results: BenchmarkResult[],
  test: BenchTest,
  days = 14,
): { label: string; value: number }[] {
  const lower = benchMeta()[test].lowerIsBetter;
  const byDay = new Map<string, number>();
  for (const r of results) {
    if (r.test !== test) continue;
    const day = r.created_at.slice(0, 10);
    const cur = byDay.get(day);
    if (cur === undefined || (lower ? r.score < cur : r.score > cur)) {
      byDay.set(day, r.score);
    }
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-days)
    .map(([day, value]) => ({ label: day.slice(5), value }));
}

/** Meilleur (= plus bas) temps de réaction pour une date donnée (YYYY-MM-DD). */
function dailyBestReaction(
  results: BenchmarkResult[],
  date: string,
): number | null {
  const vals = results
    .filter((r) => r.test === "reaction" && r.created_at.startsWith(date))
    .map((r) => r.score);
  return vals.length ? Math.min(...vals) : null;
}

export interface ReactionCheck {
  today: number | null; // meilleur temps de réaction du jour (ms)
  baseline: number | null; // baseline des jours précédents (ms)
  slowPct: number | null; // % plus lent que le baseline (positif = plus lent)
  slow: boolean; // true si ≥ SLOW_THRESHOLD plus lent (et assez d'historique)
  testedToday: boolean;
  hasBaseline: boolean;
}

export const SLOW_THRESHOLD = 20; // %

/** Baseline = moyenne du meilleur temps quotidien sur ~30 j (hors aujourd'hui). */
export function reactionCheck(
  results: BenchmarkResult[],
  today = todayStr(),
): ReactionCheck {
  const byDay = new Map<string, number>();
  for (const r of results) {
    if (r.test !== "reaction") continue;
    const day = r.created_at.slice(0, 10);
    if (day >= today) continue;
    const cur = byDay.get(day);
    if (cur === undefined || r.score < cur) byDay.set(day, r.score);
  }
  const prior = [...byDay.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 30)
    .map(([, v]) => v);

  const baseline = prior.length
    ? Math.round(prior.reduce((a, v) => a + v, 0) / prior.length)
    : null;
  const today_ = dailyBestReaction(results, today);
  const hasBaseline = prior.length >= 3;

  let slowPct: number | null = null;
  if (baseline && today_) {
    slowPct = Math.round(((today_ - baseline) / baseline) * 100);
  }

  return {
    today: today_,
    baseline,
    slowPct,
    slow: hasBaseline && slowPct !== null && slowPct >= SLOW_THRESHOLD,
    testedToday: today_ !== null,
    hasBaseline,
  };
}
