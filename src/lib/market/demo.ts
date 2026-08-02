// Payload démo — sert de fallback hors Tauri (preview navigateur, CORS bloqué)
// pour visualiser l'onglet sans réseau natif.
import type { BriefingOutput, MarketPayload } from "./types";

import { t } from "../i18n";
export function demoBriefing(session: "pre_london" | "pre_ny"): BriefingOutput {
  return {
    session,
    daily_theme: t("Dollar fort — thème baissier aligné sur EUR/USD, GBP/USD et Or."),
    regime: t("Risk-off modéré : DXY et taux US en hausse, VIX qui se détend légèrement."),
    instruments: [
      {
        symbol: "EUR/USD",
        bias: "baissier",
        conviction: "moyenne",
        scenario:
          t("Sous 1.0889 (haut de nuit), vente sur pullback vers 1.0920 avec objectif 1.0850. CPI US 14:30 = catalyseur."),
        key_levels: { watch: [1.089, 1.085], invalidation: 1.0921 },
        no_trade: ["14:30 CPI USD"],
      },
      {
        symbol: "GBP/USD",
        bias: "baissier",
        conviction: "faible",
        scenario:
          t("Corrélé EUR/USD : range 1.2698–1.2781, biais vendeur tant que sous 1.2735. Attendre l'impulsion post-CPI."),
        key_levels: { watch: [1.2731, 1.269], invalidation: 1.2781 },
        no_trade: ["14:30 CPI USD"],
      },
      {
        symbol: "XAU/USD",
        bias: "baissier",
        conviction: "moyenne",
        scenario:
          t("Taux réels en hausse : pression sur l'Or. Vente sous 2329, cible 2310. Refuge si le VIX repart."),
        key_levels: { watch: [2329, 2310], invalidation: 2342 },
        no_trade: ["14:30 CPI USD"],
      },
      {
        symbol: "NAS100",
        bias: "baissier",
        conviction: "faible",
        scenario:
          t("La tech déteste les taux hauts : biais court sous 20260. Support 20090 clé. D1 reste haussier — prudence contre-tendance."),
        key_levels: { watch: [20260, 20090], invalidation: 20410 },
        no_trade: ["14:30 CPI USD"],
      },
      {
        symbol: "BTC/USD",
        bias: "baissier",
        conviction: "faible",
        scenario:
          t("Suit le NAS100 en risk-off. Sous 61800, test possible de 60800. Range large, taille réduite."),
        key_levels: { watch: [61800, 60800], invalidation: 63100 },
        no_trade: [],
      },
    ],
    landmines: [{ time: "14:30", currency: "USD", event: "CPI m/m" }],
    summary:
      t("Thème Dollar-fort du jour : privilégier les setups vendeurs sur les paires vs USD et l'Or. Ne rien initier autour de 14:30 (CPI). NAS100 en contre-tendance D1, taille prudente."),
  };
}

export function demoPayload(session: "pre_london" | "pre_ny"): MarketPayload {
  const now = new Date().toISOString();
  return {
    mode: "morning_briefing",
    session,
    now,
    macro_context: {
      dxy: { last: 104.82, change_pct: 0.31, trend: "up", ts: now },
      us02y: { last: 4.62, change_pct: 0.55, trend: "up", ts: now },
      us10y: { last: 4.28, change_pct: 0.42, trend: "up", ts: now },
      vix: { last: 17.9, change_pct: -1.2, trend: "down", ts: now },
      es_futures: { last: 5612.5, change_pct: -0.35, trend: "down", ts: now },
      fed_bias: "n/a",
    },
    daily_theme: {
      label: "Dollar fort",
      bias_usd: "fort",
      aligned: [
        { instrument: "EUR/USD", bias: "baissier" },
        { instrument: "GBP/USD", bias: "baissier" },
        { instrument: "XAU/USD", bias: "baissier" },
        { instrument: "NAS100", bias: "baissier" },
      ],
      rationale:
        t("DXY en hausse (taux US soutenus) : pression baissière alignée sur EUR/USD, GBP/USD et Or."),
    },
    instruments: [
      {
        symbol: "EUR/USD",
        yahoo: "EURUSD=X",
        price: { last: 1.0871, change_pct: -0.24, prev_close: 1.0897, ts: now },
        technical: {
          trend_d1: "bearish",
          trend_h4: "bearish",
          bias_m15: "range",
          rsi_h1: 43.5,
          atr_m15: 0.0011,
          atr_d1: 0.0068,
          adr_used_pct: 62,
          pivots: { p: 1.0888, r1: 1.093, s1: 1.0856 },
          session_levels: {
            prev_day_high: 1.0921,
            prev_day_low: 1.0847,
            asia_range: [1.0862, 1.0889],
          },
          key_levels: { support: [1.085], resistance: [1.092] },
        },
        correlations: [
          { with: "GBP/USD", sign: "+" },
          { with: "DXY", sign: "-" },
        ],
      },
      {
        symbol: "GBP/USD",
        yahoo: "GBPUSD=X",
        price: { last: 1.2712, change_pct: -0.18, prev_close: 1.2735, ts: now },
        technical: {
          trend_d1: "bearish",
          trend_h4: "range",
          bias_m15: "range",
          rsi_h1: 46.1,
          atr_m15: 0.0014,
          atr_d1: 0.0091,
          adr_used_pct: 58,
          pivots: { p: 1.2738, r1: 1.2779, s1: 1.2696 },
          session_levels: {
            prev_day_high: 1.2781,
            prev_day_low: 1.2698,
            asia_range: [1.2705, 1.2731],
          },
          key_levels: { support: [1.269], resistance: [1.278] },
        },
        correlations: [
          { with: "EUR/USD", sign: "+" },
          { with: "DXY", sign: "-" },
        ],
      },
      {
        symbol: "XAU/USD",
        yahoo: "GC=F",
        price: { last: 2318.4, change_pct: -0.52, prev_close: 2330.5, ts: now },
        technical: {
          trend_d1: "bearish",
          trend_h4: "bearish",
          bias_m15: "bearish",
          rsi_h1: 39.8,
          atr_m15: 3.2,
          atr_d1: 28.4,
          adr_used_pct: 74,
          pivots: { p: 2328.1, r1: 2344.5, s1: 2314.1 },
          session_levels: {
            prev_day_high: 2342.1,
            prev_day_low: 2311.7,
            asia_range: [2315.0, 2329.4],
          },
          key_levels: { support: [2310], resistance: [2342] },
        },
        correlations: [
          { with: "DXY", sign: "-" },
          { with: "US10Y", sign: "-" },
        ],
      },
      {
        symbol: "NAS100",
        yahoo: "NQ=F",
        price: { last: 20180.5, change_pct: -0.61, prev_close: 20304.7, ts: now },
        technical: {
          trend_d1: "bullish",
          trend_h4: "range",
          bias_m15: "bearish",
          rsi_h1: 41.2,
          atr_m15: 42.5,
          atr_d1: 265.0,
          adr_used_pct: 81,
          pivots: { p: 20268.2, r1: 20446.5, s1: 20126.5 },
          session_levels: {
            prev_day_high: 20410.0,
            prev_day_low: 20090.0,
            asia_range: [20120.0, 20260.0],
          },
          key_levels: { support: [20090], resistance: [20410] },
        },
        correlations: [
          { with: "US10Y", sign: "-" },
          { with: "VIX", sign: "-" },
          { with: "BTC/USD", sign: "+" },
        ],
      },
      {
        symbol: "BTC/USD",
        yahoo: "BTC-USD",
        price: { last: 61250.0, change_pct: -1.4, prev_close: 62120.0, ts: now },
        technical: {
          trend_d1: "range",
          trend_h4: "bearish",
          bias_m15: "bearish",
          rsi_h1: 38.4,
          atr_m15: 180.0,
          atr_d1: 1950.0,
          adr_used_pct: 67,
          pivots: { p: 62006.7, r1: 63213.3, s1: 60913.3 },
          session_levels: {
            prev_day_high: 63100.0,
            prev_day_low: 60800.0,
            asia_range: [60950.0, 61800.0],
          },
          key_levels: { support: [60800], resistance: [63100] },
        },
        correlations: [
          { with: "NAS100", sign: "+" },
          { with: "VIX", sign: "-" },
        ],
      },
    ],
    crypto: {
      symbol: "BTCUSDT",
      funding_rate_pct: 0.012,
      next_funding: now,
      open_interest_btc: 78500,
      open_interest_usd: 4808125000,
      signal: "neutre",
      long_short_ratio: 1.41,
      fear_greed: { value: 26, label: "Fear" },
      ts: now,
    },
    calendar: [
      {
        id: "USD-cpi",
        impact: "high",
        time: "14:30",
        date: now.slice(0, 10),
        currency: "USD",
        title: "CPI m/m",
        forecast: "0.2%",
        previous: "0.3%",
      },
      {
        id: "EUR-zew",
        impact: "medium",
        time: "11:00",
        date: now.slice(0, 10),
        currency: "EUR",
        title: "ZEW Economic Sentiment",
        forecast: "42.1",
        previous: "47.5",
      },
    ],
    news: [
      {
        id: "demo-1",
        source: "ForexLive",
        title: "Dollar firm as traders await US CPI print",
        link: "https://www.forexlive.com",
        published: now,
        instruments: ["USD"],
      },
      {
        id: "demo-2",
        source: "CoinDesk",
        title: "Bitcoin slips below $62K amid risk-off mood",
        link: "https://www.coindesk.com",
        published: now,
        instruments: ["BTC/USD"],
      },
    ],
    sentiment: [],
    memory: { last_briefing: null },
    _errors: [],
    _demo: true,
  };
}
