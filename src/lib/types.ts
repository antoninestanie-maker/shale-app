export type Priority = "low" | "medium" | "high";

// 'daily' | 'weekdays' | 'none' | JSON de jours JS getDay(), ex. '[1,3,5]'
export type Recurrence = string | null;

export interface Task {
  id: number;
  label: string;
  tag: string | null;
  priority: Priority;
  recurrence: Recurrence;
  goal_id: number | null;
  created_at: string;
}

export interface TodayTask extends Task {
  done: boolean;
}

export interface Completion {
  id: number;
  task_id: number;
  date: string; // YYYY-MM-DD
  done: number; // SQLite: 0 | 1
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  scope: "short" | "medium" | "long";
  /** Catégorie libre (thème) pour regrouper les objectifs ; null = « Sans catégorie ». */
  category: string | null;
  parent_goal_id: number | null;
  deadline: string | null;
  progress_pct: number;
  manual_progress: number;
  created_at: string;
}

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export interface DayStat {
  date: string;
  total: number;
  done: number;
  pct: number | null; // null si aucune tâche due ce jour-là
}

export interface CustomMetric {
  id: number;
  name: string;
  unit: string | null;
}

export interface MetricEntry {
  id: number;
  metric_id: number;
  date: string; // YYYY-MM-DD
  value: number;
}

export interface GoalProgressPoint {
  id: number;
  goal_id: number;
  date: string; // YYYY-MM-DD
  pct: number;
}

export interface QuickLink {
  id: number;
  label: string;
  url: string;
  position: number;
}

export interface FocusSession {
  id: number;
  task_id: number | null;
  label: string | null;
  started_at: string; // YYYY-MM-DD HH:MM:SS (local)
  ended_at: string | null;
  planned_min: number;
  kind: string; // 'focus' | 'break'
}

export interface Note {
  id: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: number;
  date: string; // YYYY-MM-DD
  mood: number | null; // 1-5
  energy: number | null; // 1-5
  body: string;
}

export interface Habit {
  id: number;
  name: string;
  color: string;
  archived: number;
}

export interface HabitCheck {
  id: number;
  habit_id: number;
  date: string; // YYYY-MM-DD
}

export type TradeMode = "live" | "backtest";

export interface Trade {
  id: number;
  date: string; // YYYY-MM-DD
  instrument: string;
  direction: "long" | "short";
  setup: string | null;
  risk_r: number;
  result_r: number; // en R : +2.5, -1, 0 = break-even
  screenshot_path: string | null;
  notes: string | null;
  created_at: string;
  mode: TradeMode;
}

export interface PositionSizeCalc {
  id: number;
  created_at: string;
  capital: number;
  risk_percent: number;
  pair: string;
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number | null; // TP initial optionnel (→ R:R théorique)
  spread_pips: number | null;
  include_spread: number; // SQLite: 0 | 1
  direction: "long" | "short";
  sl_distance_pips: number;
  position_size_lots: number;
  risk_amount_usd: number;
  pip_value_per_lot: number | null;
  used_for_trade: number; // SQLite: 0 | 1
  notes: string | null;
}

// — Tracker live trading —

export type LiveOutcome = "win" | "loss" | "be";
export type LivePositionStatus = "open" | LiveOutcome;

/** Sortie partielle : `pct` % de la position fermés à `price`, soit `r` R. */
export interface LivePartial {
  at: string; // YYYY-MM-DD HH:MM:SS (local)
  pct: number; // part de la position fermée (0–100)
  price: number;
  r: number; // R au prix de sortie (signé)
}

export interface LivePosition {
  id: number;
  opened_at: string; // heure exacte d'entrée, capturée au clic "Trader"
  pair: string;
  direction: "long" | "short";
  entry_price: number;
  stop_loss_price: number;
  take_profit_price: number | null;
  lots: number | null;
  risk_percent: number | null;
  risk_amount: number | null;
  rr_theoretical: number | null;
  sizing_calc_id: number | null;
  status: LivePositionStatus;
  closed_at: string | null;
  result_r: number | null;
  partials: string; // JSON LivePartial[]
  trade_id: number | null;
  notes: string | null;
}

// — Savoir (base de connaissances) —

/** Nature d'une fiche : détermine son rendu (carte, aperçu, lecteur). */
export type KnowledgeKind = "note" | "link" | "image" | "sketch";

export interface KnowledgeTopic {
  id: number;
  name: string;
  color: string; // hex de données (teinte du thème)
  position: number;
  created_at: string;
}

export interface KnowledgeEntry {
  id: number;
  topic_id: number | null; // null = non classée
  /** Toujours 'note' depuis l'éditeur de blocs ; les autres valeurs sont
   *  historiques (fiches créées avant l'unification) et converties au vol. */
  kind: KnowledgeKind;
  title: string;
  /** HTML riche : texte, liens, images et croquis en data URL. */
  body: string;
  /** Texte brut du corps — recherche et extraits SANS charger le HTML complet
   *  (une note pleine d'images pèse lourd ; la liste n'en charge jamais le corps). */
  text: string;
  url: string | null;
  /** Data URL pleine résolution — chargée à l'ouverture de la fiche, pas dans la liste. */
  media: string | null;
  /** Data URL d'aperçu (~480px) : c'est elle qu'affichent les cartes. */
  thumb: string | null;
  /** JSON annexe : traits du croquis, pour pouvoir le rouvrir et le modifier. */
  data: string | null;
  tags: string; // tags libres séparés par des virgules
  pinned: number; // SQLite: 0 | 1
  created_at: string;
  updated_at: string;
}

/**
 * Fiche telle que listée : ni le corps HTML (potentiellement des méga-octets
 * d'images) ni le média pleine résolution. La liste vit sur `text` + `thumb`.
 */
export type KnowledgeEntryLite = Omit<KnowledgeEntry, "media" | "body"> & {
  /** Taille du corps en base : sert à repérer les fiches à ré-indexer. */
  body_len: number;
};

export type BenchTest = "reaction" | "memory" | "sequence";

export interface BenchmarkResult {
  id: number;
  test: BenchTest;
  score: number; // réaction: ms (plus bas = mieux) ; mémoire/séquence: niveau (plus haut = mieux)
  detail: string | null; // JSON optionnel
  pre_session: number; // SQLite: 0 | 1
  created_at: string; // YYYY-MM-DD HH:MM:SS (local)
}

export interface AppData {
  tasks: Task[];
  completions: Completion[];
  goals: Goal[];
  tags: Tag[];
  metrics: CustomMetric[];
  metricEntries: MetricEntry[];
  goalLog: GoalProgressPoint[];
  quickLinks: QuickLink[];
  focusSessions: FocusSession[];
  notes: Note[];
  journal: JournalEntry[];
  habits: Habit[];
  habitChecks: HabitCheck[];
  trades: Trade[];
  benchmarks: BenchmarkResult[];
}
