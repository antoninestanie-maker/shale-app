// Market-Brain — contrat d'entrée (payload) assemblé côté client.
// Phase « squelette data » : on assemble macro_context + instruments + calendar
// + news. Les blocs `sentiment` et `memory` existent déjà dans le type mais
// restent vides jusqu'à la phase 2 (voir doc Market-Brain).

export type Trend = "up" | "down" | "flat";
export type Bias = "bullish" | "bearish" | "range";
export type Impact = "high" | "medium" | "low";

export interface MacroSensor {
  last: number | null;
  trend: Trend;
  /** Variation % sur la fenêtre observée (jour). */
  change_pct: number | null;
  ts: string | null;
}

export interface MacroContext {
  dxy: MacroSensor;
  /** Rendement US 2 ans (2YY=F) : anticipations Fed court terme. */
  us02y: MacroSensor;
  us10y: MacroSensor;
  vix: MacroSensor;
  /** Futures S&P 500 (ES=F) : ton risk-on/off overnight, coté ~24h. */
  es_futures: MacroSensor;
  /** Renseigné par le LLM / manuellement en phase 2. */
  fed_bias: "hawkish" | "dovish" | "neutral" | "n/a";
}

export interface PriceSnapshot {
  last: number | null;
  change_pct: number | null;
  prev_close: number | null;
  ts: string | null;
}

export interface SessionLevels {
  prev_day_high: number | null;
  prev_day_low: number | null;
  /** Range de nuit (~00:00–07:00 Europe/Paris) approximé sur le M15. */
  asia_range: [number, number] | null;
}

export interface KeyLevels {
  support: number[];
  resistance: number[];
}

/** Pivots classiques calculés sur la bougie de la veille. */
export interface Pivots {
  p: number;
  r1: number;
  s1: number;
}

export interface Technical {
  trend_d1: Bias;
  trend_h4: Bias;
  bias_m15: Bias;
  rsi_h1: number | null;
  atr_m15: number | null;
  /** ATR quotidien (14) : ordre de grandeur du mouvement journalier. */
  atr_d1: number | null;
  /** % du range quotidien moyen (ADR 14 j) déjà parcouru aujourd'hui.
   * > ~85 % = extension improbable, privilégier mean-reversion / no-trade. */
  adr_used_pct: number | null;
  pivots: Pivots | null;
  session_levels: SessionLevels;
  key_levels: KeyLevels;
}

export interface InstrumentBlock {
  symbol: string; // clé lisible : "EUR/USD"
  yahoo: string; // ticker Yahoo utilisé
  price: PriceSnapshot;
  technical: Technical;
  /** Corrélations pré-câblées (phase 2 = croisement dynamique). */
  correlations: { with: string; sign: "+" | "-" }[];
}

export interface CalendarEvent {
  id: string;
  impact: Impact;
  time: string; // "HH:MM" Europe/Paris
  date: string; // "YYYY-MM-DD"
  currency: string; // "USD" | "EUR" | "GBP" | ...
  title: string;
  forecast: string | null;
  previous: string | null;
}

export interface NewsItem {
  id: string;
  source: string;
  title: string;
  link: string;
  published: string | null; // ISO
  instruments: string[]; // devises/actifs déduits par mots-clés
}

export interface SentimentItem {
  instrument: string;
  retail_long_pct: number;
}

/** Dérivés crypto (Binance futures) — signaux de volatilité imminente pour le scalp. */
export interface CryptoDerivs {
  symbol: string; // "BTCUSDT"
  funding_rate_pct: number; // taux de financement courant, en % (par 8h)
  next_funding: string; // ISO
  open_interest_btc: number;
  open_interest_usd: number;
  /** Lecture contrarienne : funding très positif = excès de longs = risque de purge. */
  signal: "longs_surchauffe" | "shorts_surchauffe" | "neutre";
  /** Ratio comptes long/short des top traders Binance (> 1 = majorité long). */
  long_short_ratio: number | null;
  /** Fear & Greed crypto (alternative.me) : extrêmes contrariens (<20 / >80). */
  fear_greed: { value: number; label: string } | null;
  ts: string;
}

export interface MemoryBlock {
  last_briefing: Record<string, unknown> | null;
}

/** Thème du jour dérivé du macro_context (correlations.ts). */
export interface DailyTheme {
  label: string; // ex. "Dollar fort"
  bias_usd: "fort" | "faible" | "neutre";
  aligned: { instrument: string; bias: "haussier" | "baissier" }[];
  rationale: string;
}

export type BriefMode = "morning_briefing" | "flash";

export interface MarketPayload {
  mode: BriefMode;
  session: "pre_london" | "pre_ny";
  now: string; // ISO Europe/Paris
  macro_context: MacroContext;
  daily_theme: DailyTheme | null;
  instruments: InstrumentBlock[];
  crypto: CryptoDerivs | null;
  calendar: CalendarEvent[];
  news: NewsItem[];
  sentiment: SentimentItem[];
  memory: MemoryBlock;
  /** Diagnostic : fetchers en échec (affiché dans l'onglet). */
  _errors: string[];
  /** Vrai quand les données viennent du fallback démo (hors Tauri). */
  _demo: boolean;
}

// ---- Sortie de l'agent (briefing interprété par le LLM) ----

export type OutBias = "haussier" | "baissier" | "neutre";
export type Conviction = "faible" | "moyenne" | "forte";

export interface InstrumentView {
  symbol: string;
  bias: OutBias;
  conviction: Conviction;
  scenario: string; // 1-3 phrases : le plan
  key_levels: { watch: number[]; invalidation: number | null };
  no_trade: string[]; // fenêtres à éviter ("14:30 CPI USD")
}

export interface Landmine {
  time: string; // "HH:MM"
  currency: string;
  event: string;
}

export interface BriefingOutput {
  session: "pre_london" | "pre_ny";
  daily_theme: string; // phrase de synthèse du régime
  regime: string; // risk-on / risk-off + moteur macro
  instruments: InstrumentView[];
  landmines: Landmine[];
  summary: string; // 2-3 phrases globales
}

/** Enregistrement mémoire (table market_briefings). */
export interface StoredBriefing {
  id: number;
  session: "pre_london" | "pre_ny";
  day: string;
  generated_at: string;
  payload_in: string;
  output_json: string;
  dismissed: number;
}
