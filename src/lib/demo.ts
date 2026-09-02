// Mode démo : données en mémoire pour le preview navigateur (hors Tauri).
// Même API que le repo SQL — la logique métier (logic.ts) est partagée.
import { theoreticalRR } from "./liveTracker";
import { addDays, isDueOn, todayStr, weekdayOf } from "./logic";
import { ajouterMois, debutDeMois } from "./finance/calendrier";
import { t } from "./i18n";
import type { AreteVoulue } from "./liens";
// ⚠️ `TaskInput` était RECOPIÉ ici, et la copie a divergé dès que `repo.ts` a
// reçu les champs de planification (migration 020). Deux définitions du même
// contrat ne restent d'accord que tant que personne ne touche à l'une des deux.
import type { CalendarEventInput, ObjectInput, ObjectTypeInput, TaskInput } from "./repo";
import type {
  Trade,
  AppData,
  CalendarEvent,
  Completion,
  CustomMetric,
  CustomObject,
  FinanceAccount,
  FinanceBalance,
  FinanceCategory,
  FinanceDirection,
  FinanceFxRate,
  FinanceHolding,
  FinanceQuote,
  FinanceRecurring,
  FinanceSource,
  FocusSession,
  Goal,
  GoalProgressPoint,
  Habit,
  HabitCheck,
  JournalEntry,
  KnowledgeEntry,
  KnowledgeEntryLite,
  KnowledgeKind,
  KnowledgeTopic,
  LinkKind,
  LiveOutcome,
  LivePartial,
  LivePosition,
  MetricEntry,
  Note,
  ObjectLink,
  ObjectType,
  PositionSizeCalc,
  QuickLink,
  Tag,
  Task,
} from "./types";

interface SizingCalcInput {
  capital: number;
  risk_percent: number;
  pair: string;
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number | null;
  spread_pips: number | null;
  include_spread: boolean;
  direction: "long" | "short";
  sl_distance_pips: number;
  position_size_lots: number;
  risk_amount_usd: number;
  pip_value_per_lot: number | null;
  notes: string | null;
}

/** Patch partiel d'une fiche Savoir (mêmes colonnes que le repo SQL). */
type KnowledgeInput = Partial<
  Pick<
    KnowledgeEntry,
    | "topic_id"
    | "kind"
    | "title"
    | "body"
    | "text"
    | "url"
    | "media"
    | "thumb"
    | "data"
    | "tags"
    | "pinned"
  >
>;

interface OpenPositionInput {
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number | null;
  lots: number | null;
  risk_percent: number | null;
  risk_amount: number | null;
  sizing_calc_id: number | null;
  notes: string | null;
}

const created = addDays(todayStr(), -30);

const tasks: Task[] = [
  { id: 1, label: "Backtesting 1h", tag: t("Trading"), priority: "high", recurrence: "daily", goal_id: 1, created_at: created, due_date: null, start_at: null, end_at: null, postponed_count: 0, postponed_from: null },
  { id: 2, label: t("Session trading (Londres)"), tag: t("Trading"), priority: "high", recurrence: "weekdays", goal_id: 1, created_at: created, due_date: null, start_at: null, end_at: null, postponed_count: 0, postponed_from: null },
  { id: 3, label: t("Publier un reel ChartCore"), tag: t("Contenu"), priority: "medium", recurrence: "[1,3,5]", goal_id: 2, created_at: created, due_date: null, start_at: null, end_at: null, postponed_count: 0, postponed_from: null },
  { id: 4, label: t("Réviser module BTS"), tag: "BTS", priority: "medium", recurrence: "weekdays", goal_id: 3, created_at: created, due_date: null, start_at: null, end_at: null, postponed_count: 0, postponed_from: null },
  { id: 5, label: t("Préparer script reel Moov"), tag: t("Contenu"), priority: "low", recurrence: "none", goal_id: null, created_at: created, due_date: todayStr(), start_at: "14:00", end_at: "15:30", postponed_count: 0, postponed_from: null },
  { id: 6, label: t("Ouvrir le compte prop firm"), tag: t("Trading"), priority: "high", recurrence: "none", goal_id: 4, created_at: created, due_date: addDays(todayStr(), 2), start_at: null, end_at: null, postponed_count: 0, postponed_from: null },
  { id: 7, label: t("Rédiger le plan de risque"), tag: t("Trading"), priority: "medium", recurrence: "none", goal_id: 4, created_at: created, due_date: addDays(todayStr(), -1), start_at: null, end_at: null, postponed_count: 2, postponed_from: addDays(todayStr(), -3) },
];

const goals: Goal[] = [
  { id: 1, title: t("Passer trader full-time"), description: t("Transition complète en septembre"), scope: "long", category: t("Trading"), parent_goal_id: null, deadline: "2026-09-01", progress_pct: 45, manual_progress: 1, created_at: created },
  { id: 2, title: t("10k abonnés ChartCore.fx"), description: null, scope: "medium", category: t("Contenu"), parent_goal_id: null, deadline: "2026-12-31", progress_pct: 62, manual_progress: 1, created_at: created },
  { id: 3, title: t("Valider le semestre BTS"), description: null, scope: "short", category: t("Formation"), parent_goal_id: 1, deadline: "2026-07-30", progress_pct: 80, manual_progress: 1, created_at: created },
  // progression auto : moyenne des tâches liées (id 6 faite, id 7 non → 50%)
  { id: 4, title: t("Préparer le passage full-time"), description: null, scope: "medium", category: t("Trading"), parent_goal_id: 1, deadline: "2026-08-15", progress_pct: 0, manual_progress: 0, created_at: created },
];

const tags: Tag[] = [
  { id: 1, name: t("Trading"), color: "#2e7ff2" },
  { id: 2, name: t("Contenu"), color: "#33d17a" },
  { id: 3, name: "BTS", color: "#f2b13d" },
];

// Historique : 12 derniers jours plutôt disciplinés (streak en cours),
// avec un trou à J-8 pour rendre le graphique réaliste.
const completions: Completion[] = [];
let compId = 1;
const today = todayStr();
for (let i = 12; i >= 1; i--) {
  const date = addDays(today, -i);
  for (const t of tasks) {
    if (!isDueOn(t, date)) continue;
    const done = i === 8 ? (t.id === 1 ? 1 : 0) : 1;
    completions.push({ id: compId++, task_id: t.id, date, done });
  }
}
// Aujourd'hui : une partie déjà faite
completions.push({ id: compId++, task_id: 1, date: today, done: 1 });
// One-off "compte prop firm" faite il y a 3 jours (progression auto du goal 4)
completions.push({ id: compId++, task_id: 6, date: addDays(today, -3), done: 1 });

const metrics: CustomMetric[] = [
  { id: 1, name: t("Heures de backtesting"), unit: "h" },
  { id: 2, name: t("Trades pris"), unit: "trades" },
  { id: 3, name: t("Reels publiés"), unit: "reels" },
];

// 14 derniers jours de valeurs, motif déterministe
const metricEntries: MetricEntry[] = [];
let entryId = 1;
for (let i = 14; i >= 0; i--) {
  const date = addDays(today, -i);
  const wd = weekdayOf(date);
  metricEntries.push(
    { id: entryId++, metric_id: 1, date, value: wd === 0 ? 0 : 1 + (i % 3) * 0.5 },
    { id: entryId++, metric_id: 2, date, value: wd >= 1 && wd <= 5 ? (i % 4) + 1 : 0 },
    { id: entryId++, metric_id: 3, date, value: [1, 3, 5].includes(wd) ? 1 : 0 },
  );
}

// Historique de progression des objectifs (30 jours, croissance régulière)
const goalLog: GoalProgressPoint[] = [];
let logId = 1;
const targets: Record<number, [number, number]> = {
  1: [30, 45],
  2: [40, 62],
  3: [50, 80],
  4: [0, 50],
};
for (let i = 30; i >= 0; i -= 3) {
  const date = addDays(today, -i);
  for (const g of goals) {
    const [from, to] = targets[g.id] ?? [0, 0];
    const pct = Math.round(from + ((to - from) * (30 - i)) / 30);
    goalLog.push({ id: logId++, goal_id: g.id, date, pct });
  }
}

let nextTaskId = tasks.length + 1;
let nextTagId = tags.length + 1;
let nextGoalId = goals.length + 1;

interface GoalInput {
  title: string;
  description: string | null;
  scope: Goal["scope"];
  category: string | null;
  parent_goal_id: number | null;
  deadline: string | null;
  progress_pct: number;
  manual_progress: number;
}

let nextMetricId = metrics.length + 1;

const quickLinks: QuickLink[] = [
  { id: 1, label: "TradingView", url: "https://tradingview.com", position: 0 },
  { id: 2, label: "CapCut", url: "https://capcut.com", position: 1 },
  { id: 3, label: "IG ChartCore", url: "https://instagram.com/chartcore.fx", position: 2 },
  { id: 4, label: "YouTube Studio", url: "https://studio.youtube.com", position: 3 },
];
let nextLinkId = quickLinks.length + 1;

const settings = new Map<string, string>();

// Sessions de focus des 7 derniers jours (motif régulier, trading le matin)
const focusSessions: FocusSession[] = [];
let fsId = 1;
for (let i = 7; i >= 1; i--) {
  const date = addDays(today, -i);
  const wd = weekdayOf(date);
  focusSessions.push({
    id: fsId++, task_id: 1, label: null, kind: "focus",
    started_at: `${date} 09:00:00`, ended_at: `${date} 09:50:00`, planned_min: 50,
  });
  if (wd >= 1 && wd <= 5)
    focusSessions.push({
      id: fsId++, task_id: 4, label: null, kind: "focus",
      started_at: `${date} 17:00:00`, ended_at: `${date} 17:30:00`, planned_min: 30,
    });
  if ([1, 3, 5].includes(wd))
    focusSessions.push({
      id: fsId++, task_id: 3, label: null, kind: "focus",
      started_at: `${date} 20:00:00`, ended_at: `${date} 20:25:00`, planned_min: 25,
    });
}
focusSessions.push({
  id: fsId++, task_id: 1, label: null, kind: "focus",
  started_at: `${today} 09:00:00`, ended_at: `${today} 09:25:00`, planned_min: 25,
});

const notes: Note[] = [
  {
    id: 1,
    title: t("Setup cassure H4"),
    body: t("Règles du setup :\n- attendre la cassure du range H4\n- retest + rejet\n- SL sous la mèche, TP 2R minimum\n\nVoir aussi [[Plan de risque]] pour le sizing."),
    created_at: `${addDays(today, -12)} 10:00:00`,
    updated_at: `${addDays(today, -2)} 21:30:00`,
  },
  {
    id: 2,
    title: t("Plan de risque"),
    body: t("Max 1% par trade. Max 3 trades/jour. Stop à -2R quotidien.\n\nRappel : la discipline > le setup. [[Setup cassure H4]]"),
    created_at: `${addDays(today, -12)} 10:05:00`,
    updated_at: `${addDays(today, -5)} 18:00:00`,
  },
  {
    id: 3,
    title: t("Idées de reels"),
    body: t("- 3 erreurs de débutant en trading\n- POV : ta première prop firm\n- Breakdown d'un trade perdant (transparence)"),
    created_at: `${addDays(today, -7)} 20:00:00`,
    updated_at: `${addDays(today, -1)} 22:10:00`,
  },
];
let nextNoteId = notes.length + 1;

// — Savoir : thèmes + fiches de démonstration —
// (l'aperçu du croquis est un SVG en data URL : aucun binaire à embarquer)
const SKETCH_DEMO =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200">
      <rect width="320" height="200" fill="#f7f8fa"/>
      <path d="M24 150 L80 150 L80 96 L136 96 L136 128 L200 128 L200 56 L288 56" fill="none" stroke="#1b2030" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M24 168 h264" stroke="#1b2030" stroke-width="1.5" opacity=".35"/>
      <path d="M200 40 l0 -14 m0 14 l-8 -8 m8 8 l8 -8" stroke="#1f7a5a" stroke-width="3" fill="none" stroke-linecap="round"/>
    </svg>`,
  );

const knowledgeTopics: KnowledgeTopic[] = [
  { id: 1, name: t("Trading"), color: "#4d8dff", position: 0, created_at: `${addDays(today, -30)} 09:00:00` },
  { id: 2, name: "Mindset", color: "#14c8a0", position: 1, created_at: `${addDays(today, -30)} 09:01:00` },
  { id: 3, name: "Ressources", color: "#8e8bff", position: 2, created_at: `${addDays(today, -30)} 09:02:00` },
];
let nextTopicId = knowledgeTopics.length + 1;

// Toutes les fiches sont des NOTES : le corps porte texte, liens, images et
// croquis (c'est l'unité unique de création depuis l'unification de l'éditeur).
const knowledgeEntries: KnowledgeEntry[] = [
  {
    id: 1,
    topic_id: 1,
    kind: "note",
    title: t("Anatomie d'une cassure propre"),
    body:
      `<h2>${t("Les 3 conditions")}</h2><ul><li>${t("Range H4 net, au moins 3 touches")}</li>` +
      `<li>${t("Cassure avec <b>volume</b> et clôture hors du range")}</li>` +
      `<li>${t("Retest qui tient, mèche de rejet")}</li></ul>` +
      `<p>${t("Si l'une manque : on passe. Le manque de patience coûte plus cher que le manque de setups.")}</p>`,
    text:
      `${t("Les 3 conditions")} ${t("Range H4 net, au moins 3 touches")} ${t("Cassure avec volume et clôture hors du range")} ` +
      `${t("Retest qui tient, mèche de rejet")} ${t("Si l'une manque : on passe. Le manque de patience coûte plus cher que le manque de setups.")}`,
    url: null, media: null, thumb: null, data: null,
    tags: "setup, price action",
    pinned: 1,
    created_at: `${addDays(today, -20)} 11:00:00`,
    updated_at: `${addDays(today, -3)} 19:20:00`,
  },
  {
    id: 2,
    topic_id: 1,
    kind: "note",
    title: t("Schéma : cassure + retest"),
    body:
      `<figure><img src="${SKETCH_DEMO}" alt="cassure + retest"></figure>` +
      "<p>Le croquis de référence à revoir avant chaque session de Londres.</p>",
    text: t("Le croquis de référence à revoir avant chaque session de Londres."),
    url: null, media: null, thumb: SKETCH_DEMO, data: null,
    tags: "setup",
    pinned: 0,
    created_at: `${addDays(today, -14)} 08:30:00`,
    updated_at: `${addDays(today, -14)} 08:45:00`,
  },
  {
    id: 3,
    topic_id: 2,
    kind: "note",
    title: t("Après une perte : le protocole"),
    body:
      `<p>${t("1. Fermer la plateforme 20 minutes.")}<br>${t("2. Noter le trade dans le journal, sans jugement.")}<br>` +
      `${t("3. Relire le plan de risque à voix haute.")}</p><blockquote>${t("Le revenge trading n'est pas un problème de marché, c'est un problème d'ego.")}</blockquote>`,
    text:
      `${t("1. Fermer la plateforme 20 minutes.")} ${t("2. Noter le trade dans le journal, sans jugement.")} ` +
      `${t("3. Relire le plan de risque à voix haute.")} ${t("Le revenge trading n'est pas un problème de marché, c'est un problème d'ego.")}`,
    url: null, media: null, thumb: null, data: null,
    tags: "discipline, psychologie",
    pinned: 0,
    created_at: `${addDays(today, -9)} 21:00:00`,
    updated_at: `${addDays(today, -9)} 21:15:00`,
  },
  {
    id: 4,
    topic_id: 3,
    kind: "note",
    title: t("Calendrier économique ForexFactory"),
    body:
      `<p>${t("La source du bloc « no-trade » du Market-Brain :")} ` +
      '<a href="https://www.forexfactory.com/calendar">forexfactory.com/calendar</a></p>' +
      `<p>${t("À ouvrir chaque dimanche soir pour repérer les annonces de la semaine.")}</p>`,
    text:
      `${t("La source du bloc « no-trade » du Market-Brain :")} forexfactory.com/calendar ` +
      t("À ouvrir chaque dimanche soir pour repérer les annonces de la semaine."),
    url: null, media: null, thumb: null, data: null,
    tags: "outil, macro",
    pinned: 0,
    created_at: `${addDays(today, -6)} 10:00:00`,
    updated_at: `${addDays(today, -6)} 10:00:00`,
  },
];
let nextKnowledgeId = knowledgeEntries.length + 1;

const journal: JournalEntry[] = [];
let jId = 1;
for (let i = 5; i >= 1; i--) {
  journal.push({
    id: jId++,
    date: addDays(today, -i),
    mood: 3 + ((i + 1) % 3),
    energy: 2 + (i % 3),
    body: i === 1 ? t("Bonne session de backtesting, le setup H4 se confirme.") : "",
  });
}

const habits: Habit[] = [
  { id: 1, name: t("Méditation"), color: "#33d17a", archived: 0 },
  { id: 2, name: t("Sport"), color: "#2e7ff2", archived: 0 },
  { id: 3, name: t("Lecture"), color: "#f2b13d", archived: 0 },
];
let nextHabitId = habits.length + 1;

const habitChecks: HabitCheck[] = [];
let hcId = 1;
for (let i = 60; i >= 1; i--) {
  const date = addDays(today, -i);
  const wd = weekdayOf(date);
  if (i % 7 !== 3) habitChecks.push({ id: hcId++, habit_id: 1, date });
  if ([1, 3, 5].includes(wd)) habitChecks.push({ id: hcId++, habit_id: 2, date });
  if (i % 2 === 0) habitChecks.push({ id: hcId++, habit_id: 3, date });
}
habitChecks.push({ id: hcId++, habit_id: 1, date: today });

// Journal de trades des 2 dernières semaines (motif déterministe, ~60% winrate)
const trades: Trade[] = [];
let trId = 1;
const SETUPS = ["Silver Bullet", "Order Block", "FVG"];
const RESULTS = [2, -1, 1.5, 3, -1, 2.5, -1, 2, 1, -1, 4, 2, -1, 1.5];
for (let i = 14; i >= 1; i--) {
  const date = addDays(today, -i);
  const wd = weekdayOf(date);
  if (wd === 0 || wd === 6) continue; // pas de trade le week-end
  const r = RESULTS[i % RESULTS.length];
  trades.push({
    id: trId++,
    date,
    instrument: i % 3 === 0 ? "EURUSD" : "NQ",
    direction: i % 2 === 0 ? "long" : "short",
    setup: SETUPS[i % 3],
    risk_r: 1,
    result_r: r,
    screenshot_path: null,
    notes: r > 0 ? t("Exécution propre") : t("Entré trop tôt"),
    created_at: `${date} 16:00:00`,
    mode: "live",
  });
}
// Backtests : sessions plus denses, winrate un peu meilleur (comme souvent)
const BT_RESULTS = [2, 2.5, -1, 3, 1.5, -1, 2, 4, -1, 2.5, 1, 2];
for (let i = 20; i >= 1; i--) {
  const date = addDays(today, -Math.ceil(i / 2));
  trades.push({
    id: trId++,
    date,
    instrument: "NQ",
    direction: i % 2 === 0 ? "long" : "short",
    setup: SETUPS[i % 3],
    risk_r: 1,
    result_r: BT_RESULTS[i % BT_RESULTS.length],
    screenshot_path: null,
    notes: null,
    created_at: `${date} 10:00:00`,
    mode: "backtest",
  });
}
let nextTradeId = trId;

// Historique de calculs de sizing (quelques exemples pour le preview navigateur)
const sizingCalcs: PositionSizeCalc[] = [
  {
    id: 1,
    created_at: `${addDays(today, -1)} 09:12:00`,
    capital: 5000,
    risk_percent: 1,
    pair: "EUR/USD",
    entry_price: 1.085,
    stop_loss_price: 1.082,
    take_profit_price: 1.091,
    spread_pips: 1.2,
    include_spread: 1,
    direction: "long",
    sl_distance_pips: 30,
    position_size_lots: 0.16,
    risk_amount_usd: 49.92,
    pip_value_per_lot: 10,
    used_for_trade: 1,
    notes: null,
  },
  {
    id: 2,
    created_at: `${today} 08:03:00`,
    capital: 5000,
    risk_percent: 0.5,
    pair: "XAU/USD",
    entry_price: 2400,
    stop_loss_price: 2397,
    take_profit_price: null,
    spread_pips: 0,
    include_spread: 1,
    direction: "short",
    sl_distance_pips: 300,
    position_size_lots: 0.08,
    risk_amount_usd: 24,
    pip_value_per_lot: 1,
    used_for_trade: 0,
    notes: null,
  },
];
let nextSizingId = sizingCalcs.length + 1;

// Tracker live : 2 positions ouvertes pour le preview (une avec TP + partielle
// déjà prise, une sans TP pour tester le dénouement avec prix de sortie).
const livePositions: LivePosition[] = [
  {
    id: 1,
    opened_at: `${today} 09:41:12`,
    pair: "EUR/USD",
    direction: "long",
    entry_price: 1.085,
    stop_loss_price: 1.082,
    take_profit_price: 1.091,
    lots: 0.16,
    risk_percent: 1,
    risk_amount: 49.92,
    rr_theoretical: 2,
    sizing_calc_id: 1,
    status: "open",
    closed_at: null,
    result_r: null,
    partials: JSON.stringify([
      { at: `${today} 10:15:00`, pct: 50, price: 1.088, r: 1 },
    ]),
    trade_id: null,
    notes: null,
  },
  {
    id: 2,
    opened_at: `${today} 08:07:45`,
    pair: "XAU/USD",
    direction: "short",
    entry_price: 2400,
    stop_loss_price: 2404,
    take_profit_price: null,
    lots: 0.08,
    risk_percent: 0.5,
    risk_amount: 24,
    rr_theoretical: null,
    sizing_calc_id: 2,
    status: "open",
    closed_at: null,
    result_r: null,
    partials: "[]",
    trade_id: null,
    notes: null,
  },
];
let nextLiveId = livePositions.length + 1;

// ── Finance ──────────────────────────────────────────────────────────────────
// Jeu de démonstration COHÉRENT, pas décoratif : les soldes, les flux et le
// runway se répondent. Quelqu'un qui ouvre la démo doit voir un cas crédible
// d'indépendant à revenu irrégulier — environ 7,4 mois devant lui — et pas trois
// chiffres ronds qui ne se déduisent pas les uns des autres.

let nextFinAccountId = 1;
let nextFinBalanceId = 1;
let nextFinRecurringId = 1;
let nextFinCategoryId = 1;
let nextFinHoldingId = 1;

const financeCategories: FinanceCategory[] = [
  ["Revenus", "entree"],
  ["Trading", "entree"],
  ["Logement", "sortie"],
  ["Charges", "sortie"],
  ["Abonnements", "sortie"],
  ["Vie courante", "sortie"],
  ["Impôts", "sortie"],
].map(([name, kind], i) => ({
  id: nextFinCategoryId++,
  name: name as string,
  kind: kind as FinanceDirection,
  color: null,
  position: i + 1,
  created_at: todayStr(),
}));

const catId = (name: string) => financeCategories.find((c) => c.name === name)?.id ?? null;

const financeAccounts: FinanceAccount[] = (
  [
    ["Compte courant", "courant", 1, "Boursorama"],
    ["Livret A", "epargne", 1, "Boursorama"],
    ["Compte de trading", "trading", 1, "IBKR"],
    ["Carte de crédit", "credit", 1, "Boursorama"],
    ["PEA", "investissement", 0, "Bourse Direct"],
  ] as const
).map(([label, kind, liquide, banque], i) => ({
  id: nextFinAccountId++,
  label,
  kind,
  currency: "EUR",
  institution: banque,
  is_liquid: liquide,
  archived: 0,
  position: i + 1,
  created_at: todayStr(),
  updated_at: todayStr(),
}));

/**
 * Treize relevés mensuels par compte, du plus ancien à ce mois-ci.
 * Le compte courant descend (on brûle), le livret s'entame doucement, le PEA
 * monte : c'est ce que la courbe du patrimoine doit raconter.
 */
const financeBalances: FinanceBalance[] = (() => {
  const debut = debutDeMois(todayStr());
  const trajectoires: Record<number, [number, number]> = {
    // id de compte → [solde il y a 12 mois, solde ce mois-ci], en centimes
    1: [1_020_000, 385_000],
    2: [780_000, 450_000],
    3: [190_000, 240_000],
    4: [-62_000, -80_000],
    5: [1_460_000, 1_840_000],
  };
  const lignes: FinanceBalance[] = [];
  for (const compte of financeAccounts) {
    const [depart, arrivee] = trajectoires[compte.id];
    for (let k = 12; k >= 0; k--) {
      const t = (12 - k) / 12;
      // Un peu de relief, sinon la courbe est une règle : l'ondulation est
      // déterministe (pas de Math.random) pour que deux ouvertures de la démo
      // montrent exactement la même chose.
      const relief = Math.round(Math.sin((12 - k) * 1.7) * (Math.abs(arrivee - depart) * 0.06));
      lignes.push({
        id: nextFinBalanceId++,
        account_id: compte.id,
        date: ajouterMois(debut, -k),
        amount_cents: Math.round(depart + (arrivee - depart) * t) + relief,
        created_at: todayStr(),
      });
    }
  }
  return lignes;
})();

const financeRecurring: FinanceRecurring[] = (
  [
    ["Loyer", 95_000, "sortie", "mensuel", 5, "Logement"],
    ["Électricité + eau", 14_500, "sortie", "mensuel", 10, "Charges"],
    ["Mutuelle", 6_800, "sortie", "mensuel", 8, "Charges"],
    ["Courses", 12_000, "sortie", "hebdo", 6, "Vie courante"],
    ["Abonnements (données, outils)", 4_500, "sortie", "mensuel", 15, "Abonnements"],
    ["Assurance habitation", 36_000, "sortie", "annuel", 20, "Charges"],
    ["Impôt sur le revenu", 420_000, "sortie", "annuel", 15, "Impôts"],
    ["Prestation récurrente", 80_000, "entree", "mensuel", 30, "Revenus"],
  ] as const
).map(([label, montant, direction, frequence, jour, categorie]) => ({
  id: nextFinRecurringId++,
  label,
  amount_cents: montant,
  direction,
  frequency: frequence,
  day_of_period: jour,
  category_id: catId(categorie),
  account_id: 1,
  active_from: ajouterMois(debutDeMois(todayStr()), -18),
  active_to: null,
  created_at: todayStr(),
  updated_at: todayStr(),
}));

// Une mission terminée : elle ne pèse plus sur le burn, et l'interface la range
// parmi les flux périmés plutôt que de la faire disparaître.
financeRecurring.push({
  id: nextFinRecurringId++,
  label: "Mission longue (terminée)",
  amount_cents: 350_000,
  direction: "entree",
  frequency: "mensuel",
  day_of_period: 30,
  category_id: catId("Revenus"),
  account_id: 1,
  active_from: ajouterMois(debutDeMois(todayStr()), -18),
  active_to: ajouterMois(debutDeMois(todayStr()), -7),
  created_at: todayStr(),
  updated_at: todayStr(),
});

const financeHoldings: FinanceHolding[] = [
  {
    id: nextFinHoldingId++,
    account_id: 5,
    symbol: "CW8.PA",
    quantity_e8: 32_000_000_000, // 320 parts
    cost_basis_cents: 1_408_000,
    source: "yahoo",
    created_at: todayStr(),
    updated_at: todayStr(),
  },
  {
    id: nextFinHoldingId++,
    account_id: 3,
    symbol: "BTCUSDT",
    quantity_e8: 1_200_000, // 0,012 BTC
    cost_basis_cents: 98_000,
    source: "binance",
    created_at: todayStr(),
    updated_at: todayStr(),
  },
];

const financeQuotes: FinanceQuote[] = [
  {
    symbol: "CW8.PA",
    price_e8: 5_230_000_000, // 52,30 €
    currency: "EUR",
    source: "yahoo",
    fetched_at: new Date().toISOString(),
  },
  {
    symbol: "BTCUSDT",
    price_e8: 10_423_812_000_000, // 104 238,12 $
    currency: "USD",
    source: "binance",
    fetched_at: new Date().toISOString(),
  },
];

const financeFx: FinanceFxRate[] = [
  { base: "USD", quote: "EUR", rate_e8: 92_400_000, fetched_at: new Date().toISOString() },
];


// ─────────────────────────────────────────────────────────────────────────────
// Calendrier, liaisons et objets — socle du 2026-09-02 (migration 020)
//
// ⚠️ En mode démo il n'y a ni SQLite ni colonne `uid`. Les arêtes ont pourtant
// besoin d'identités : on en fabrique de SYNTHÉTIQUES et STABLES
// (`demo:note:3`). Elles sont cohérentes entre elles — assez pour vérifier une
// interface —, elles n'ont aucun rapport avec les uid réels, et rien de tout
// cela ne se synchronise. C'est exactement le contrat du mode démo.
// ─────────────────────────────────────────────────────────────────────────────

const uidDemo = (kind: LinkKind, id: number) => `demo:${kind}:${id}`;

/** Ce que fait la cascade de triggers du natif (migration 020, § 8). */
function retirerLiens(kind: LinkKind, uid: string): void {
  for (let i = links.length - 1; i >= 0; i--) {
    const l = links[i];
    if ((l.from_kind === kind && l.from_uid === uid) || (l.to_kind === kind && l.to_uid === uid)) {
      links.splice(i, 1);
    }
  }
}

let calendarEventId = 100;
const calendarEvents: CalendarEvent[] = [
  {
    id: 1, title: t("Point hebdo prop firm"), body: null, date: todayStr(),
    start_at: "09:30", end_at: "10:00", all_day: 0, color: "blue",
    recurrence: "none", created_at: created, updated_at: created,
  },
  {
    id: 2, title: t("Clôture mensuelle du journal"), body: null,
    date: addDays(todayStr(), 3), start_at: null, end_at: null, all_day: 1,
    color: "violet", recurrence: "none", created_at: created, updated_at: created,
  },
  {
    id: 3, title: t("Revue de la semaine"), body: null, date: addDays(todayStr(), 1),
    start_at: "18:00", end_at: "19:00", all_day: 0, color: "green",
    recurrence: "weekdays", created_at: created, updated_at: created,
  },
];

// Les quatre types livrés par la migration, à l'identique — un écran de galerie
// vide ne prouverait rien.
let objectTypeId = 100;
const objectTypes: ObjectType[] = [
  {
    id: 1, name: t("Personne"), icon: "user", color: "blue", builtin: 1, position: 1,
    fields: JSON.stringify([
      { id: "f1", name: t("Rôle"), type: "text", required: 0 },
      { id: "f2", name: t("Rencontré le"), type: "date", required: 0 },
      { id: "f3", name: t("Contact"), type: "text", required: 0 },
    ]),
    created_at: created, updated_at: created,
  },
  {
    id: 2, name: t("Ressource"), icon: "book", color: "violet", builtin: 1, position: 2,
    fields: JSON.stringify([
      { id: "f1", name: t("Support"), type: "choice", required: 1, options: [t("Livre"), t("Vidéo"), t("Article"), t("Podcast")] },
      { id: "f2", name: t("Auteur"), type: "text", required: 0 },
      { id: "f3", name: t("Lien"), type: "link", required: 0 },
      { id: "f4", name: t("Terminé le"), type: "date", required: 0 },
    ]),
    created_at: created, updated_at: created,
  },
  {
    id: 3, name: t("Projet"), icon: "target", color: "green", builtin: 1, position: 3,
    fields: JSON.stringify([
      { id: "f1", name: t("Statut"), type: "choice", required: 1, options: [t("En cours"), t("En pause"), t("Terminé"), t("Abandonné")] },
      { id: "f2", name: t("Échéance"), type: "date", required: 0 },
      { id: "f3", name: t("Prochaine action"), type: "text", required: 0 },
    ]),
    created_at: created, updated_at: created,
  },
  {
    id: 4, name: t("Setup de trading"), icon: "chart", color: "yellow", builtin: 1, position: 4,
    fields: JSON.stringify([
      { id: "f1", name: t("Paire"), type: "text", required: 0 },
      { id: "f2", name: t("Biais"), type: "choice", required: 1, options: ["Long", "Short", t("Neutre")] },
      { id: "f3", name: t("Règle d'entrée"), type: "text", required: 0 },
      { id: "f4", name: t("R visé"), type: "number", required: 0 },
    ]),
    created_at: created, updated_at: created,
  },
];

let objectId = 100;
const objects: CustomObject[] = [
  {
    id: 1, uid: uidDemo("object", 1), type_id: 4, title: "Silver Bullet",
    body: null,
    field_values: JSON.stringify({ f1: "EURUSD", f2: "Long", f3: t("Balayage puis retour dans le range"), f4: 3 }),
    created_at: created, updated_at: created,
  },
  {
    id: 2, uid: uidDemo("object", 2), type_id: 2, title: "Trading in the Zone",
    body: null,
    field_values: JSON.stringify({ f1: t("Livre"), f2: "Mark Douglas", f4: addDays(todayStr(), -40) }),
    created_at: created, updated_at: created,
  },
];

let linkId = 100;
const links: ObjectLink[] = [
  {
    id: 1, uid: `ol:task:${uidDemo("task", 6)}:object:${uidDemo("object", 1)}`,
    from_kind: "task", from_uid: uidDemo("task", 6),
    to_kind: "object", to_uid: uidDemo("object", 1),
    origin: "manual", created_at: created,
  },
];

export const demo = {
  async fetchAll(): Promise<AppData> {
    return {
      tasks: [...tasks],
      completions: [...completions],
      goals: [...goals],
      tags: [...tags],
      metrics: [...metrics],
      metricEntries: [...metricEntries],
      goalLog: [...goalLog],
      quickLinks: [...quickLinks],
      focusSessions: [...focusSessions],
      notes: [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
      journal: [...journal],
      habits: [...habits],
      habitChecks: [...habitChecks],
      trades: [...trades].sort(
        (a, b) => b.date.localeCompare(a.date) || b.id - a.id,
      ),
    };
  },


  async createTrade(
    input: {
      date: string;
      instrument: string;
      direction: "long" | "short";
      setup: string | null;
      result_r: number;
      screenshot_path: string | null;
      notes: string | null;
      mode: "live" | "backtest";
    },
    now: string,
  ): Promise<number> {
    const id = nextTradeId++;
    trades.push({
      id,
      ...input,
      risk_r: 1,
      created_at: now,
    });
    return id;
  },

  async updateTrade(
    id: number,
    input: {
      date: string;
      instrument: string;
      direction: "long" | "short";
      setup: string | null;
      result_r: number;
      screenshot_path: string | null;
      notes: string | null;
      mode: "live" | "backtest";
    },
  ): Promise<void> {
    const t = trades.find((x) => x.id === id);
    if (t) Object.assign(t, input);
  },

  async deleteTrade(id: number): Promise<void> {
    const i = trades.findIndex((t) => t.id === id);
    if (i >= 0) trades.splice(i, 1);
  },

  async logSizingCalc(input: SizingCalcInput, now: string): Promise<void> {
    sizingCalcs.unshift({
      id: nextSizingId++,
      created_at: now,
      capital: input.capital,
      risk_percent: input.risk_percent,
      pair: input.pair,
      entry_price: input.entry_price,
      stop_loss_price: input.stop_loss_price,
      take_profit_price: input.take_profit_price,
      spread_pips: input.spread_pips,
      include_spread: input.include_spread ? 1 : 0,
      direction: input.direction,
      sl_distance_pips: input.sl_distance_pips,
      position_size_lots: input.position_size_lots,
      risk_amount_usd: input.risk_amount_usd,
      pip_value_per_lot: input.pip_value_per_lot,
      used_for_trade: 0,
      notes: input.notes,
    });
  },

  async fetchSizingHistory(limit: number): Promise<PositionSizeCalc[]> {
    return [...sizingCalcs]
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
      .slice(0, limit);
  },

  async markSizingUsed(id: number, used: boolean): Promise<void> {
    const c = sizingCalcs.find((x) => x.id === id);
    if (c) c.used_for_trade = used ? 1 : 0;
  },

  async deleteSizingCalc(id: number): Promise<void> {
    const i = sizingCalcs.findIndex((c) => c.id === id);
    if (i >= 0) sizingCalcs.splice(i, 1);
  },

  // — Tracker live trading —

  async openLivePosition(
    input: OpenPositionInput,
    rr: number | null,
    now: string,
  ): Promise<number> {
    const id = nextLiveId++;
    livePositions.unshift({
      id,
      opened_at: now,
      pair: input.pair,
      direction: input.direction,
      entry_price: input.entry_price,
      stop_loss_price: input.stop_loss_price,
      take_profit_price: input.take_profit_price,
      lots: input.lots,
      risk_percent: input.risk_percent,
      risk_amount: input.risk_amount,
      rr_theoretical: rr,
      sizing_calc_id: input.sizing_calc_id,
      status: "open",
      closed_at: null,
      result_r: null,
      partials: "[]",
      trade_id: null,
      notes: input.notes,
    });
    return id;
  },

  async fetchLivePositions(): Promise<LivePosition[]> {
    return livePositions
      .filter((p) => p.status === "open")
      .sort(
        (a, b) => b.opened_at.localeCompare(a.opened_at) || b.id - a.id,
      )
      .map((p) => ({ ...p }));
  },

  async setLivePartials(id: number, partials: LivePartial[]): Promise<void> {
    const p = livePositions.find((x) => x.id === id);
    if (p) p.partials = JSON.stringify(partials);
  },

  async setLiveTakeProfit(id: number, takeProfit: number | null): Promise<void> {
    const p = livePositions.find((x) => x.id === id);
    if (!p) return;
    p.take_profit_price = takeProfit;
    p.rr_theoretical = theoreticalRR(
      p.entry_price,
      p.stop_loss_price,
      takeProfit,
      p.direction,
    );
  },

  async closeLivePosition(
    id: number,
    outcome: LiveOutcome,
    resultR: number,
    tradeId: number | null,
    now: string,
  ): Promise<void> {
    const p = livePositions.find((x) => x.id === id);
    if (!p) return;
    p.status = outcome;
    p.result_r = resultR;
    p.trade_id = tradeId;
    p.closed_at = now;
  },

  async deleteLivePosition(id: number): Promise<void> {
    const i = livePositions.findIndex((p) => p.id === id);
    if (i >= 0) livePositions.splice(i, 1);
  },

  async createNote(title: string, body: string, now: string): Promise<number> {
    const id = nextNoteId++;
    notes.push({ id, title, body, created_at: now, updated_at: now });
    return id;
  },

  async updateNote(id: number, title: string, body: string, now: string): Promise<void> {
    const n = notes.find((x) => x.id === id);
    if (n) Object.assign(n, { title, body, updated_at: now });
  },

  async deleteNote(id: number): Promise<void> {
    const i = notes.findIndex((n) => n.id === id);
    if (i >= 0) notes.splice(i, 1);
  },

  async searchNotes(query: string): Promise<Note[]> {
    const q = query.trim().toLowerCase();
    const all = [...notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    if (!q) return all;
    return all.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  },

  // — Savoir —

  async fetchKnowledge(): Promise<{
    topics: KnowledgeTopic[];
    entries: KnowledgeEntryLite[];
  }> {
    const entries = [...knowledgeEntries]
      .sort(
        (a, b) =>
          b.pinned - a.pinned ||
          b.updated_at.localeCompare(a.updated_at) ||
          b.id - a.id,
      )
      // la liste ne transporte ni le corps ni le média (comme en SQL)
      .map(({ media: _media, body, ...lite }) => ({ ...lite, body_len: body.length }));
    // Même tri qu'en natif (`ORDER BY position, id`) : sans lui, le
    // réordonnancement des thèmes serait invisible en mode démo.
    const topics = [...knowledgeTopics].sort(
      (a, b) => a.position - b.position || a.id - b.id,
    );
    return { topics, entries };
  },

  async fetchKnowledgeEntry(id: number): Promise<KnowledgeEntry | null> {
    const e = knowledgeEntries.find((k) => k.id === id);
    return e ? { ...e } : null;
  },

  async createKnowledgeTopic(name: string, color: string, now: string): Promise<number> {
    const id = nextTopicId++;
    knowledgeTopics.push({
      id,
      name,
      color,
      position: knowledgeTopics.length,
      created_at: now,
    });
    return id;
  },

  async updateKnowledgeTopic(id: number, name: string, color: string): Promise<void> {
    const t = knowledgeTopics.find((k) => k.id === id);
    if (t) {
      t.name = name;
      t.color = color;
    }
  },

  async reorderKnowledgeTopics(ids: number[]): Promise<void> {
    for (const [rang, id] of ids.entries()) {
      const t = knowledgeTopics.find((k) => k.id === id);
      if (t) t.position = rang;
    }
  },

  async deleteKnowledgeTopic(id: number): Promise<void> {
    const i = knowledgeTopics.findIndex((t) => t.id === id);
    if (i >= 0) knowledgeTopics.splice(i, 1);
    for (const e of knowledgeEntries) if (e.topic_id === id) e.topic_id = null;
  },

  async createKnowledgeEntry(
    input: KnowledgeInput & { kind: KnowledgeKind; title: string },
    now: string,
  ): Promise<number> {
    const id = nextKnowledgeId++;
    knowledgeEntries.push({
      id,
      topic_id: input.topic_id ?? null,
      kind: input.kind,
      title: input.title,
      body: input.body ?? "",
      text: input.text ?? "",
      url: input.url ?? null,
      media: input.media ?? null,
      thumb: input.thumb ?? null,
      data: input.data ?? null,
      tags: input.tags ?? "",
      pinned: input.pinned ?? 0,
      created_at: now,
      updated_at: now,
    });
    return id;
  },

  async updateKnowledgeEntry(
    id: number,
    patch: KnowledgeInput,
    now: string | null,
  ): Promise<void> {
    const e = knowledgeEntries.find((k) => k.id === id);
    if (!e) return;
    Object.assign(e, patch, now ? { updated_at: now } : {});
  },

  async deleteKnowledgeEntry(id: number): Promise<void> {
    const i = knowledgeEntries.findIndex((e) => e.id === id);
    if (i >= 0) knowledgeEntries.splice(i, 1);
  },

  async upsertJournal(
    date: string,
    entry: { mood: number | null; energy: number | null; body: string },
  ): Promise<void> {
    const e = journal.find((x) => x.date === date);
    if (e) Object.assign(e, entry);
    else journal.push({ id: jId++, date, ...entry });
  },

  async addHabit(name: string, color: string): Promise<void> {
    habits.push({ id: nextHabitId++, name, color, archived: 0 });
  },

  async deleteHabit(id: number): Promise<void> {
    const i = habits.findIndex((h) => h.id === id);
    if (i >= 0) habits.splice(i, 1);
    for (let j = habitChecks.length - 1; j >= 0; j--) {
      if (habitChecks[j].habit_id === id) habitChecks.splice(j, 1);
    }
  },

  async setHabitCheck(habitId: number, date: string, checked: boolean): Promise<void> {
    const i = habitChecks.findIndex((c) => c.habit_id === habitId && c.date === date);
    if (checked && i < 0) habitChecks.push({ id: hcId++, habit_id: habitId, date });
    if (!checked && i >= 0) habitChecks.splice(i, 1);
  },

  async startFocus(
    input: {
      task_id: number | null;
      label: string | null;
      planned_min: number;
      kind: "focus" | "break";
    },
    startedAt: string,
  ): Promise<number> {
    const id = fsId++;
    focusSessions.push({
      id,
      task_id: input.task_id,
      label: input.label,
      started_at: startedAt,
      ended_at: null,
      planned_min: input.planned_min,
      kind: input.kind,
    });
    return id;
  },

  async endFocus(id: number, endedAt: string): Promise<void> {
    const s = focusSessions.find((f) => f.id === id);
    if (s) s.ended_at = endedAt;
  },

  async fetchActiveFocus(): Promise<FocusSession | null> {
    return focusSessions.find((f) => f.ended_at === null) ?? null;
  },

  async addQuickLink(label: string, url: string): Promise<void> {
    quickLinks.push({ id: nextLinkId++, label, url, position: quickLinks.length });
  },

  async deleteQuickLink(id: number): Promise<void> {
    const i = quickLinks.findIndex((l) => l.id === id);
    if (i >= 0) quickLinks.splice(i, 1);
  },

  async getSetting(key: string): Promise<string | null> {
    return settings.get(key) ?? null;
  },

  async setSetting(key: string, value: string): Promise<void> {
    settings.set(key, value);
  },

  async addMetric(name: string, unit: string | null): Promise<void> {
    metrics.push({ id: nextMetricId++, name, unit });
  },

  async deleteMetric(id: number): Promise<void> {
    const i = metrics.findIndex((m) => m.id === id);
    if (i >= 0) metrics.splice(i, 1);
    for (let j = metricEntries.length - 1; j >= 0; j--) {
      if (metricEntries[j].metric_id === id) metricEntries.splice(j, 1);
    }
  },

  async setMetricValue(
    metricId: number,
    date: string,
    value: number,
  ): Promise<void> {
    const existing = metricEntries.find(
      (e) => e.metric_id === metricId && e.date === date,
    );
    if (existing) existing.value = value;
    else metricEntries.push({ id: entryId++, metric_id: metricId, date, value });
  },

  async createTask(input: TaskInput): Promise<void> {
    tasks.push({
      id: nextTaskId++,
      ...input,
      // Les champs de planification sont optionnels côté `TaskInput` : les
      // écrans d'avant le calendrier appellent toujours sans eux.
      due_date: input.due_date ?? null,
      start_at: input.start_at ?? null,
      end_at: input.end_at ?? null,
      postponed_count: 0,
      postponed_from: null,
      created_at: todayStr(),
    });
  },

  async updateTask(id: number, input: TaskInput): Promise<void> {
    const task = tasks.find((t) => t.id === id);
    if (task) Object.assign(task, input);
  },

  async deleteTask(id: number): Promise<void> {
    const i = tasks.findIndex((t) => t.id === id);
    if (i >= 0) tasks.splice(i, 1);
    for (let j = completions.length - 1; j >= 0; j--) {
      if (completions[j].task_id === id) completions.splice(j, 1);
    }
  },

  async setTaskDone(taskId: number, date: string, done: boolean): Promise<void> {
    const existing = completions.find(
      (c) => c.task_id === taskId && c.date === date,
    );
    if (existing) existing.done = done ? 1 : 0;
    else
      completions.push({
        id: compId++,
        task_id: taskId,
        date,
        done: done ? 1 : 0,
      });
  },

  async createGoal(input: GoalInput): Promise<void> {
    goals.push({ id: nextGoalId++, ...input, created_at: todayStr() });
  },

  async updateGoal(id: number, input: GoalInput): Promise<void> {
    const goal = goals.find((g) => g.id === id);
    if (goal) Object.assign(goal, input);
  },

  async deleteGoal(goal: Goal): Promise<void> {
    const i = goals.findIndex((g) => g.id === goal.id);
    if (i >= 0) goals.splice(i, 1);
    for (const g of goals) {
      if (g.parent_goal_id === goal.id) g.parent_goal_id = goal.parent_goal_id;
    }
    for (const t of tasks) if (t.goal_id === goal.id) t.goal_id = null;
  },

  async addTag(name: string, color: string): Promise<void> {
    const existing = tags.find((t) => t.name === name);
    if (existing) existing.color = color;
    else tags.push({ id: nextTagId++, name, color });
  },

  async deleteTag(tag: Tag): Promise<void> {
    const i = tags.findIndex((t) => t.id === tag.id);
    if (i >= 0) tags.splice(i, 1);
    for (const t of tasks) if (t.tag === tag.name) t.tag = null;
  },

  // — Finance —

  async fetchFinance() {
    return {
      comptes: [...financeAccounts],
      balances: [...financeBalances],
      recurrents: [...financeRecurring],
      categories: [...financeCategories],
      holdings: [...financeHoldings],
      quotes: [...financeQuotes],
      fx: [...financeFx],
    };
  },

  async createFinanceAccount(
    input: {
      label: string;
      kind: FinanceAccount["kind"];
      currency: string;
      institution: string | null;
      is_liquid: boolean;
    },
    now: string,
  ): Promise<number> {
    const id = nextFinAccountId++;
    financeAccounts.push({
      id,
      label: input.label,
      kind: input.kind,
      currency: input.currency,
      institution: input.institution,
      is_liquid: input.is_liquid ? 1 : 0,
      archived: 0,
      position: financeAccounts.length + 1,
      created_at: now,
      updated_at: now,
    });
    return id;
  },

  async updateFinanceAccount(
    id: number,
    input: {
      label: string;
      kind: FinanceAccount["kind"];
      currency: string;
      institution: string | null;
      is_liquid: boolean;
    },
    now: string,
  ): Promise<void> {
    const c = financeAccounts.find((a) => a.id === id);
    if (!c) return;
    Object.assign(c, {
      label: input.label,
      kind: input.kind,
      currency: input.currency,
      institution: input.institution,
      is_liquid: input.is_liquid ? 1 : 0,
      updated_at: now,
    });
  },

  async archiveFinanceAccount(id: number, archive: boolean, now: string): Promise<void> {
    const c = financeAccounts.find((a) => a.id === id);
    if (c) Object.assign(c, { archived: archive ? 1 : 0, updated_at: now });
  },

  async deleteFinanceAccount(id: number): Promise<void> {
    for (let i = financeBalances.length - 1; i >= 0; i--)
      if (financeBalances[i].account_id === id) financeBalances.splice(i, 1);
    for (let i = financeHoldings.length - 1; i >= 0; i--)
      if (financeHoldings[i].account_id === id) financeHoldings.splice(i, 1);
    for (const r of financeRecurring) if (r.account_id === id) r.account_id = null;
    const j = financeAccounts.findIndex((a) => a.id === id);
    if (j >= 0) financeAccounts.splice(j, 1);
  },

  async saveFinanceBalance(
    accountId: number,
    date: string,
    amountCents: number,
    now: string,
  ): Promise<void> {
    const existant = financeBalances.find((b) => b.account_id === accountId && b.date === date);
    if (existant) existant.amount_cents = amountCents;
    else
      financeBalances.push({
        id: nextFinBalanceId++,
        account_id: accountId,
        date,
        amount_cents: amountCents,
        created_at: now,
      });
  },

  async deleteFinanceBalance(id: number): Promise<void> {
    const i = financeBalances.findIndex((b) => b.id === id);
    if (i >= 0) financeBalances.splice(i, 1);
  },

  async createFinanceRecurring(
    input: Omit<FinanceRecurring, "id" | "created_at" | "updated_at">,
    now: string,
  ): Promise<number> {
    const id = nextFinRecurringId++;
    financeRecurring.push({ id, ...input, created_at: now, updated_at: now });
    return id;
  },

  async updateFinanceRecurring(
    id: number,
    input: Omit<FinanceRecurring, "id" | "created_at" | "updated_at">,
    now: string,
  ): Promise<void> {
    const r = financeRecurring.find((x) => x.id === id);
    if (r) Object.assign(r, input, { updated_at: now });
  },

  async deleteFinanceRecurring(id: number): Promise<void> {
    const i = financeRecurring.findIndex((r) => r.id === id);
    if (i >= 0) financeRecurring.splice(i, 1);
  },

  async createFinanceCategory(
    name: string,
    kind: FinanceDirection,
    color: string | null,
    now: string,
  ): Promise<number> {
    const id = nextFinCategoryId++;
    financeCategories.push({
      id,
      name,
      kind,
      color,
      position: financeCategories.length + 1,
      created_at: now,
    });
    return id;
  },

  async deleteFinanceCategory(id: number): Promise<void> {
    for (const r of financeRecurring) if (r.category_id === id) r.category_id = null;
    const i = financeCategories.findIndex((c) => c.id === id);
    if (i >= 0) financeCategories.splice(i, 1);
  },

  async saveFinanceHolding(
    accountId: number,
    symbol: string,
    quantityE8: number,
    costBasisCents: number | null,
    source: FinanceSource,
    now: string,
  ): Promise<void> {
    const existant = financeHoldings.find(
      (h) => h.account_id === accountId && h.symbol === symbol,
    );
    if (existant)
      Object.assign(existant, {
        quantity_e8: quantityE8,
        cost_basis_cents: costBasisCents,
        source,
        updated_at: now,
      });
    else
      financeHoldings.push({
        id: nextFinHoldingId++,
        account_id: accountId,
        symbol,
        quantity_e8: quantityE8,
        cost_basis_cents: costBasisCents,
        source,
        created_at: now,
        updated_at: now,
      });
  },

  async deleteFinanceHolding(id: number): Promise<void> {
    const i = financeHoldings.findIndex((h) => h.id === id);
    if (i >= 0) financeHoldings.splice(i, 1);
  },

  async saveFinanceQuotes(quotes: FinanceQuote[]): Promise<void> {
    for (const q of quotes) {
      const i = financeQuotes.findIndex((x) => x.symbol === q.symbol);
      if (i >= 0) financeQuotes[i] = q;
      else financeQuotes.push(q);
    }
  },

  async saveFinanceFx(rates: FinanceFxRate[]): Promise<void> {
    for (const r of rates) {
      const i = financeFx.findIndex((x) => x.base === r.base && x.quote === r.quote);
      if (i >= 0) financeFx[i] = r;
      else financeFx.push(r);
    }
  },

  // ─── Calendrier, liaisons et objets (migration 020) ────────────────────────

  async uidDe(kind: LinkKind, id: number): Promise<string | null> {
    return uidDemo(kind, id);
  },

  async fetchCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
    return calendarEvents
      .filter((e) => e.date >= from && e.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.start_at ?? "").localeCompare(b.start_at ?? ""));
  },

  async fetchRecurringEvents(): Promise<CalendarEvent[]> {
    return calendarEvents.filter((e) => !!e.recurrence && e.recurrence !== "none");
  },

  async createCalendarEvent(input: CalendarEventInput, now: string): Promise<void> {
    calendarEvents.push({
      id: calendarEventId++,
      title: input.title,
      body: input.body,
      date: input.date,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ? 1 : 0,
      color: input.color,
      recurrence: input.recurrence,
      created_at: now,
      updated_at: now,
    });
  },

  async updateCalendarEvent(id: number, input: CalendarEventInput, now: string): Promise<void> {
    const e = calendarEvents.find((x) => x.id === id);
    if (!e) return;
    Object.assign(e, {
      title: input.title,
      body: input.body,
      date: input.date,
      start_at: input.start_at,
      end_at: input.end_at,
      all_day: input.all_day ? 1 : 0,
      color: input.color,
      recurrence: input.recurrence,
      updated_at: now,
    });
  },

  async deleteCalendarEvent(id: number): Promise<void> {
    const i = calendarEvents.findIndex((e) => e.id === id);
    if (i >= 0) calendarEvents.splice(i, 1);
    // Le natif fait ce ménage par trigger (migration 020, § 8) ; ici, à la main,
    // sinon le mode démo montrerait des backlinks fantômes que l'app n'a pas.
    retirerLiens("event", uidDemo("event", id));
  },

  async fetchDatedTasks(from: string, to: string): Promise<Task[]> {
    return tasks
      .filter((t) => !!t.due_date && t.due_date >= from && t.due_date <= to)
      .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  },

  async setTaskSchedule(
    id: number,
    dueDate: string | null,
    startAt: string | null,
    endAt: string | null,
  ): Promise<void> {
    const task = tasks.find((t) => t.id === id);
    if (task) Object.assign(task, { due_date: dueDate, start_at: startAt, end_at: endAt });
  },

  async appliquerReport(id: number, report: { due_date: string; postponed_count: number; postponed_from: string }): Promise<void> {
    const task = tasks.find((t) => t.id === id);
    if (task) Object.assign(task, report);
  },

  async fetchObjectTypes(): Promise<ObjectType[]> {
    return [...objectTypes].sort((a, b) => a.position - b.position || a.id - b.id);
  },

  async createObjectType(input: ObjectTypeInput, now: string): Promise<void> {
    objectTypes.push({
      id: objectTypeId++,
      name: input.name,
      icon: input.icon,
      color: input.color,
      fields: JSON.stringify(input.fields),
      builtin: 0,
      position: Math.max(0, ...objectTypes.map((t) => t.position)) + 1,
      created_at: now,
      updated_at: now,
    });
  },

  async updateObjectType(id: number, input: ObjectTypeInput, now: string): Promise<void> {
    const type = objectTypes.find((t) => t.id === id);
    if (!type) return;
    Object.assign(type, {
      name: input.name,
      icon: input.icon,
      color: input.color,
      fields: JSON.stringify(input.fields),
      updated_at: now,
    });
  },

  async deleteObjectType(id: number): Promise<void> {
    const i = objectTypes.findIndex((t) => t.id === id);
    if (i >= 0) objectTypes.splice(i, 1);
    // Cascade : le natif la fait par trigger, le mode démo doit la faire aussi,
    // sinon les deux ne racontent pas la même histoire.
    for (const o of objects.filter((o) => o.type_id === id)) await demo.deleteObject(o.id);
  },

  async fetchObjects(typeId?: number): Promise<CustomObject[]> {
    const liste = typeId == null ? objects : objects.filter((o) => o.type_id === typeId);
    return [...liste].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  },

  async createObject(input: ObjectInput, now: string): Promise<void> {
    const id = objectId++;
    objects.push({
      id,
      uid: uidDemo("object", id),
      type_id: input.type_id,
      title: input.title,
      body: input.body,
      field_values: JSON.stringify(input.field_values),
      created_at: now,
      updated_at: now,
    });
  },

  async updateObject(id: number, input: ObjectInput, now: string): Promise<void> {
    const o = objects.find((x) => x.id === id);
    if (!o) return;
    Object.assign(o, {
      type_id: input.type_id,
      title: input.title,
      body: input.body,
      field_values: JSON.stringify(input.field_values),
      updated_at: now,
    });
  },

  async deleteObject(id: number): Promise<void> {
    const i = objects.findIndex((o) => o.id === id);
    if (i >= 0) objects.splice(i, 1);
    retirerLiens("object", uidDemo("object", id));
  },

  async fetchLinksFrom(kind: LinkKind, uid: string): Promise<ObjectLink[]> {
    return links.filter((l) => l.from_kind === kind && l.from_uid === uid);
  },

  async fetchLinksTo(kind: LinkKind, uid: string): Promise<ObjectLink[]> {
    return links.filter((l) => l.to_kind === kind && l.to_uid === uid);
  },

  async createLink(arete: AreteVoulue, now: string): Promise<void> {
    // L'équivalent en mémoire de l'`ON CONFLICT DO NOTHING` du natif.
    const existe = links.some(
      (l) =>
        l.from_kind === arete.from_kind &&
        l.from_uid === arete.from_uid &&
        l.to_kind === arete.to_kind &&
        l.to_uid === arete.to_uid,
    );
    if (existe) return;
    links.push({
      id: linkId++,
      uid: `ol:${arete.from_kind}:${arete.from_uid}:${arete.to_kind}:${arete.to_uid}`,
      from_kind: arete.from_kind,
      from_uid: arete.from_uid,
      to_kind: arete.to_kind,
      to_uid: arete.to_uid,
      origin: arete.origin,
      created_at: now,
    });
  },

  async deleteLink(id: number): Promise<void> {
    const i = links.findIndex((l) => l.id === id);
    if (i >= 0) links.splice(i, 1);
  },

};
