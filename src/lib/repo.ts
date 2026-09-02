import { getDb } from "./db";
import { demo } from "./demo";
import { theoreticalRR } from "./liveTracker";
import { toDateStr } from "./logic";
import type { PairConfig } from "./pairs";
import { t } from "./i18n";
import { diffMentions, TABLE_DE_KIND, type AreteVoulue } from "./liens";
import { rechercher, type Document as DocumentRecherche, type Trouvaille } from "./recherche";
import { serialiserChamps, serialiserValeurs } from "./objets";
import type { Report } from "./taches";
import type {
  AppData,
  CalendarEvent,
  Completion,
  CustomMetric,
  CustomObject,
  FinanceAccount,
  FinanceAccountKind,
  FinanceBalance,
  FinanceCategory,
  FinanceDirection,
  FinanceFrequency,
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
  KnowledgeTopic,
  LinkKind,
  LiveOutcome,
  LivePartial,
  LivePosition,
  MetricEntry,
  Note,
  ObjectField,
  ObjectLink,
  ObjectType,
  PositionSizeCalc,
  Priority,
  QuickLink,
  Tag,
  Task,
  Trade,
} from "./types";

/** Hors Tauri (preview navigateur), on bascule sur des données démo en mémoire. */
export const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface TaskInput {
  label: string;
  tag: string | null;
  priority: Priority;
  recurrence: string; // 'none' | 'daily' | 'weekdays' | JSON de jours
  goal_id: number | null;
  /**
   * Champs de planification, OPTIONNELS : les écrans qui existaient avant le
   * calendrier continuent d'appeler `createTask` sans eux, et créent des tâches
   * sans date — exactement comme avant.
   *
   * ⚠️ Une tâche RÉCURRENTE ne prend pas de `due_date` (voir `lib/taches.ts`).
   */
  due_date?: string | null;
  start_at?: string | null;
  end_at?: string | null;
}

/** Datetime local "YYYY-MM-DD HH:MM:SS" : toute la logique "jour" compare du local. */
export function localNow(): string {
  const now = new Date();
  return `${toDateStr(now)} ${now.toTimeString().slice(0, 8)}`;
}

export async function fetchAll(sinceDate: string): Promise<AppData> {
  if (!isTauri) return demo.fetchAll();
  const db = await getDb();
  const tasks = await db.select<Task[]>("SELECT * FROM tasks");
  const completions = await db.select<Completion[]>(
    "SELECT * FROM task_completions WHERE date >= $1",
    [sinceDate],
  );
  const goals = await db.select<Goal[]>("SELECT * FROM goals");
  const tags = await db.select<Tag[]>("SELECT * FROM tags");
  const metrics = await db.select<CustomMetric[]>("SELECT * FROM custom_metrics");
  const metricEntries = await db.select<MetricEntry[]>(
    "SELECT * FROM metric_entries WHERE date >= $1",
    [sinceDate],
  );
  const goalLog = await db.select<GoalProgressPoint[]>(
    "SELECT * FROM goal_progress_log WHERE date >= $1",
    [sinceDate],
  );
  const quickLinks = await db.select<QuickLink[]>(
    "SELECT * FROM quick_links ORDER BY position, id",
  );
  const focusSessions = await db.select<FocusSession[]>(
    "SELECT * FROM focus_sessions WHERE started_at >= $1",
    [sinceDate],
  );
  const notes = await db.select<Note[]>(
    "SELECT * FROM notes ORDER BY updated_at DESC",
  );
  const journal = await db.select<JournalEntry[]>(
    "SELECT * FROM journal_entries WHERE date >= $1",
    [sinceDate],
  );
  const habits = await db.select<Habit[]>(
    "SELECT * FROM habits WHERE archived = 0",
  );
  const habitChecks = await db.select<HabitCheck[]>(
    "SELECT * FROM habit_checks WHERE date >= $1",
    [sinceDate],
  );
  const trades = await db.select<Trade[]>(
    "SELECT * FROM trades WHERE date >= $1 ORDER BY date DESC, id DESC",
    [sinceDate],
  );
  return {
    tasks,
    completions,
    goals,
    tags,
    metrics,
    metricEntries,
    goalLog,
    quickLinks,
    focusSessions,
    notes,
    journal,
    habits,
    habitChecks,
    trades,
  };
}

// — Trading —

export interface TradeInput {
  date: string;
  instrument: string;
  direction: "long" | "short";
  setup: string | null;
  result_r: number;
  screenshot_path: string | null;
  notes: string | null;
  mode: "live" | "backtest";
}

/** Crée un trade dans le journal et renvoie son id (lien tracker → journal). */
export async function createTrade(input: TradeInput): Promise<number> {
  if (!isTauri) return demo.createTrade(input, localNow());
  const db = await getDb();
  const res = await db.execute(
    "INSERT INTO trades (date, instrument, direction, setup, result_r, screenshot_path, notes, created_at, mode) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [
      input.date,
      input.instrument,
      input.direction,
      input.setup,
      input.result_r,
      input.screenshot_path,
      input.notes,
      localNow(),
      input.mode,
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function updateTrade(id: number, input: TradeInput): Promise<void> {
  if (!isTauri) return demo.updateTrade(id, input);
  const db = await getDb();
  await db.execute(
    "UPDATE trades SET date = $1, instrument = $2, direction = $3, setup = $4, result_r = $5, screenshot_path = $6, notes = $7, mode = $8 WHERE id = $9",
    [
      input.date,
      input.instrument,
      input.direction,
      input.setup,
      input.result_r,
      input.screenshot_path,
      input.notes,
      input.mode,
      id,
    ],
  );
}

/** Sauvegarde de la base (fichier unique, propre) via VACUUM INTO. */
export async function exportDb(destPath: string): Promise<void> {
  if (!isTauri) throw new Error(t("export disponible dans l'app native"));
  const db = await getDb();
  await db.execute(`VACUUM INTO '${destPath.replace(/'/g, "''")}'`);
}

export async function deleteTrade(id: number): Promise<void> {
  if (!isTauri) return demo.deleteTrade(id);
  const db = await getDb();
  await db.execute("DELETE FROM trades WHERE id = $1", [id]);
}

// — Calculateur de taille de position —

export interface SizingCalcInput {
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

// Le calcul est live (chaque frappe), mais l'historique ne doit pas se remplir
// de doublons : on ignore deux enregistrements identiques consécutifs.
let lastSizingSignature = "";
function sizingSignature(i: SizingCalcInput): string {
  return [
    i.capital,
    i.risk_percent,
    i.pair,
    i.entry_price,
    i.stop_loss_price,
    i.take_profit_price,
    i.spread_pips,
    i.include_spread,
    i.direction,
    i.position_size_lots,
  ].join("|");
}

/** Log automatique d'un calcul valide (débouncé côté UI). Dédoublonné. */
export async function logSizingCalc(input: SizingCalcInput): Promise<void> {
  const sig = sizingSignature(input);
  if (sig === lastSizingSignature) return;
  lastSizingSignature = sig;
  if (!isTauri) return demo.logSizingCalc(input, localNow());
  const db = await getDb();
  await db.execute(
    "INSERT INTO position_size_calculations (created_at, capital, risk_percent, pair, entry_price, stop_loss_price, take_profit_price, spread_pips, include_spread, direction, sl_distance_pips, position_size_lots, risk_amount_usd, pip_value_per_lot, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)",
    [
      localNow(),
      input.capital,
      input.risk_percent,
      input.pair,
      input.entry_price,
      input.stop_loss_price,
      input.take_profit_price,
      input.spread_pips,
      input.include_spread ? 1 : 0,
      input.direction,
      input.sl_distance_pips,
      input.position_size_lots,
      input.risk_amount_usd,
      input.pip_value_per_lot,
      input.notes,
    ],
  );
}

export async function fetchSizingHistory(
  limit = 50,
): Promise<PositionSizeCalc[]> {
  if (!isTauri) return demo.fetchSizingHistory(limit);
  const db = await getDb();
  return db.select<PositionSizeCalc[]>(
    "SELECT * FROM position_size_calculations ORDER BY created_at DESC, id DESC LIMIT $1",
    [limit],
  );
}

export async function markSizingUsed(
  id: number,
  used: boolean,
): Promise<void> {
  if (!isTauri) return demo.markSizingUsed(id, used);
  const db = await getDb();
  await db.execute(
    "UPDATE position_size_calculations SET used_for_trade = $1 WHERE id = $2",
    [used ? 1 : 0, id],
  );
}

export async function deleteSizingCalc(id: number): Promise<void> {
  if (!isTauri) return demo.deleteSizingCalc(id);
  const db = await getDb();
  await db.execute("DELETE FROM position_size_calculations WHERE id = $1", [id]);
}

// — Tracker live trading —
// Une position "envoyée" depuis le calculateur vit ici (status 'open') jusqu'au
// clic Gagnante/Perdante ; la clôture crée la ligne du journal (trades) et la
// position reste en archive. Événement `sb:live-positions` émis à chaque
// mutation pour resynchroniser les vues montées.

export interface OpenPositionInput {
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

function emitLiveChange(): void {
  window.dispatchEvent(new CustomEvent("sb:live-positions"));
}

/** Envoie une position au tracker (capture l'heure exacte + R:R théorique). */
export async function openLivePosition(
  input: OpenPositionInput,
): Promise<number> {
  const rr = theoreticalRR(
    input.entry_price,
    input.stop_loss_price,
    input.take_profit_price,
    input.direction,
  );
  let id: number;
  if (!isTauri) {
    id = await demo.openLivePosition(input, rr, localNow());
  } else {
    const db = await getDb();
    const res = await db.execute(
      "INSERT INTO live_positions (opened_at, pair, direction, entry_price, stop_loss_price, take_profit_price, lots, risk_percent, risk_amount, rr_theoretical, sizing_calc_id, status, partials, notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', '[]', $12)",
      [
        localNow(),
        input.pair,
        input.direction,
        input.entry_price,
        input.stop_loss_price,
        input.take_profit_price,
        input.lots,
        input.risk_percent,
        input.risk_amount,
        rr,
        input.sizing_calc_id,
        input.notes,
      ],
    );
    id = res.lastInsertId ?? 0;
  }
  emitLiveChange();
  return id;
}

/** Positions en attente de dénouement (les archivées vivent dans le journal). */
export async function fetchLivePositions(): Promise<LivePosition[]> {
  if (!isTauri) return demo.fetchLivePositions();
  const db = await getDb();
  return db.select<LivePosition[]>(
    "SELECT * FROM live_positions WHERE status = 'open' ORDER BY opened_at DESC, id DESC",
  );
}

/** Remplace la liste des sorties partielles (JSON) d'une position ouverte. */
export async function setLivePartials(
  id: number,
  partials: LivePartial[],
): Promise<void> {
  if (!isTauri) await demo.setLivePartials(id, partials);
  else {
    const db = await getDb();
    await db.execute("UPDATE live_positions SET partials = $1 WHERE id = $2", [
      JSON.stringify(partials),
      id,
    ]);
  }
  emitLiveChange();
}

/** Met à jour le TP (et le R:R théorique qui en découle). */
export async function setLiveTakeProfit(
  id: number,
  takeProfit: number | null,
): Promise<void> {
  if (!isTauri) await demo.setLiveTakeProfit(id, takeProfit);
  else {
    const db = await getDb();
    const rows = await db.select<LivePosition[]>(
      "SELECT * FROM live_positions WHERE id = $1",
      [id],
    );
    const pos = rows[0];
    if (!pos) return;
    const rr = theoreticalRR(
      pos.entry_price,
      pos.stop_loss_price,
      takeProfit,
      pos.direction,
    );
    await db.execute(
      "UPDATE live_positions SET take_profit_price = $1, rr_theoretical = $2 WHERE id = $3",
      [takeProfit, rr, id],
    );
  }
  emitLiveChange();
}

/** Archive la position dénouée (status, résultat, lien vers le journal). */
export async function closeLivePosition(
  id: number,
  outcome: LiveOutcome,
  resultR: number,
  tradeId: number | null,
): Promise<void> {
  if (!isTauri) await demo.closeLivePosition(id, outcome, resultR, tradeId, localNow());
  else {
    const db = await getDb();
    await db.execute(
      "UPDATE live_positions SET status = $1, result_r = $2, trade_id = $3, closed_at = $4 WHERE id = $5",
      [outcome, resultR, tradeId, localNow(), id],
    );
  }
  emitLiveChange();
}

/** Retire une position du tracker sans la logger (envoi par erreur). */
export async function deleteLivePosition(id: number): Promise<void> {
  if (!isTauri) await demo.deleteLivePosition(id);
  else {
    const db = await getDb();
    await db.execute("DELETE FROM live_positions WHERE id = $1", [id]);
  }
  emitLiveChange();
}

// — Réglages du tracker (clé/valeur, table settings partagée) —

export interface TrackerSettings {
  /** Envoi direct sans popup de confirmation au clic "Trader". */
  fastTrack: boolean;
  /** Ouvre la vue Trading (tracker) juste après l'envoi. */
  autoOpen: boolean;
  /** Affiche le bouton break-even dans le tracker. */
  allowBe: boolean;
}

export const TRACKER_DEFAULTS: TrackerSettings = {
  fastTrack: false,
  autoOpen: false,
  allowBe: true,
};

const TK = {
  fastTrack: "tracker.fastTrack",
  autoOpen: "tracker.autoOpen",
  allowBe: "tracker.allowBe",
} as const;

function bool(v: string | null, fallback: boolean): boolean {
  if (v == null || v === "") return fallback;
  return v === "1";
}

export async function fetchTrackerSettings(): Promise<TrackerSettings> {
  const [fastTrack, autoOpen, allowBe] = await Promise.all([
    getSetting(TK.fastTrack),
    getSetting(TK.autoOpen),
    getSetting(TK.allowBe),
  ]);
  return {
    fastTrack: bool(fastTrack, TRACKER_DEFAULTS.fastTrack),
    autoOpen: bool(autoOpen, TRACKER_DEFAULTS.autoOpen),
    allowBe: bool(allowBe, TRACKER_DEFAULTS.allowBe),
  };
}

export async function saveTrackerSettings(s: TrackerSettings): Promise<void> {
  await Promise.all([
    setSetting(TK.fastTrack, s.fastTrack ? "1" : "0"),
    setSetting(TK.autoOpen, s.autoOpen ? "1" : "0"),
    setSetting(TK.allowBe, s.allowBe ? "1" : "0"),
  ]);
}

// — Réglages du calculateur (clé/valeur, table settings partagée) —

export interface SizingSettings {
  capital: number;
  risk: number;
  maxRisk: number; // seuil d'alerte risque (%)
  maxLots: number | null; // limite de lots (prop firm), null = pas de limite
  currency: string;
  pipOverrides: Record<string, number>; // symbole → pip value custom
  customPairs: PairConfig[];
}

export const SIZING_DEFAULTS: SizingSettings = {
  capital: 5000,
  risk: 1,
  maxRisk: 2,
  maxLots: null,
  currency: "USD",
  pipOverrides: {},
  customPairs: [],
};

const SK = {
  capital: "sizing.capital",
  risk: "sizing.risk",
  maxRisk: "sizing.maxRisk",
  maxLots: "sizing.maxLots",
  currency: "sizing.currency",
  pipOverrides: "sizing.pipOverrides",
  customPairs: "sizing.customPairs",
} as const;

function num(v: string | null, fallback: number): number {
  if (v == null || v.trim() === "") return fallback;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function json<T>(v: string | null, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function fetchSizingSettings(): Promise<SizingSettings> {
  const [capital, risk, maxRisk, maxLots, currency, pipOverrides, customPairs] =
    await Promise.all([
      getSetting(SK.capital),
      getSetting(SK.risk),
      getSetting(SK.maxRisk),
      getSetting(SK.maxLots),
      getSetting(SK.currency),
      getSetting(SK.pipOverrides),
      getSetting(SK.customPairs),
    ]);
  return {
    capital: num(capital, SIZING_DEFAULTS.capital),
    risk: num(risk, SIZING_DEFAULTS.risk),
    maxRisk: num(maxRisk, SIZING_DEFAULTS.maxRisk),
    maxLots:
      maxLots == null || maxLots.trim() === "" ? null : num(maxLots, 0) || null,
    currency: currency || SIZING_DEFAULTS.currency,
    pipOverrides: json<Record<string, number>>(pipOverrides, {}),
    customPairs: json<PairConfig[]>(customPairs, []),
  };
}

export async function saveSizingSettings(
  s: SizingSettings,
): Promise<void> {
  await Promise.all([
    setSetting(SK.capital, String(s.capital)),
    setSetting(SK.risk, String(s.risk)),
    setSetting(SK.maxRisk, String(s.maxRisk)),
    setSetting(SK.maxLots, s.maxLots == null ? "" : String(s.maxLots)),
    setSetting(SK.currency, s.currency),
    setSetting(SK.pipOverrides, JSON.stringify(s.pipOverrides)),
    setSetting(SK.customPairs, JSON.stringify(s.customPairs)),
  ]);
}

// — Notes —

export async function createNote(title: string, body: string): Promise<number> {
  if (!isTauri) return demo.createNote(title, body, localNow());
  const db = await getDb();
  const now = localNow();
  const res = await db.execute(
    "INSERT INTO notes (title, body, created_at, updated_at) VALUES ($1, $2, $3, $3)",
    [title, body, now],
  );
  return res.lastInsertId ?? 0;
}

export async function updateNote(
  id: number,
  title: string,
  body: string,
): Promise<void> {
  if (!isTauri) return demo.updateNote(id, title, body, localNow());
  const db = await getDb();
  await db.execute(
    "UPDATE notes SET title = $1, body = $2, updated_at = $3 WHERE id = $4",
    [title, body, localNow(), id],
  );
}

export async function deleteNote(id: number): Promise<void> {
  if (!isTauri) return demo.deleteNote(id);
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

/** Recherche plein texte (FTS5) avec repli LIKE si indisponible. */
export async function searchNotes(query: string): Promise<Note[]> {
  if (!isTauri) return demo.searchNotes(query);
  const db = await getDb();
  const q = query.trim();
  if (!q) return db.select<Note[]>("SELECT * FROM notes ORDER BY updated_at DESC");
  try {
    return await db.select<Note[]>(
      "SELECT n.* FROM notes_fts f JOIN notes n ON n.id = f.rowid WHERE notes_fts MATCH $1 ORDER BY rank",
      [q.replace(/[^\p{L}\p{N} ]/gu, " ") + "*"],
    );
  } catch {
    return db.select<Note[]>(
      "SELECT * FROM notes WHERE title LIKE $1 OR body LIKE $1 ORDER BY updated_at DESC",
      [`%${q}%`],
    );
  }
}

// — Savoir (base de connaissances) —
// Deux niveaux de lecture pour ne jamais charger inutilement des images :
// `fetchKnowledge()` ramène les thèmes + les fiches SANS le média pleine
// résolution (les cartes n'affichent que `thumb`), et `fetchKnowledgeEntry()`
// ramène une fiche complète à l'ouverture du lecteur.

/** Colonnes modifiables d'une fiche (liste blanche : les patchs sont dynamiques). */
const KNOWLEDGE_FIELDS = [
  "topic_id",
  "kind",
  "title",
  "body",
  "text",
  "url",
  "media",
  "thumb",
  "data",
  "tags",
  "pinned",
] as const;

export type KnowledgeField = (typeof KNOWLEDGE_FIELDS)[number];
export type KnowledgeInput = Partial<Pick<KnowledgeEntry, KnowledgeField>>;

// Le CORPS est volontairement absent : il peut contenir plusieurs centaines de
// ko d'images. La liste vit sur `text` (recherche + extrait) et `thumb`
// (couverture) ; `body_len` sert seulement à repérer les fiches à ré-indexer.
const LITE_COLUMNS =
  "id, topic_id, kind, title, text, url, thumb, data, tags, pinned, created_at, updated_at, LENGTH(body) AS body_len";

export async function fetchKnowledge(): Promise<{
  topics: KnowledgeTopic[];
  entries: KnowledgeEntryLite[];
}> {
  if (!isTauri) return demo.fetchKnowledge();
  const db = await getDb();
  const topics = await db.select<KnowledgeTopic[]>(
    "SELECT * FROM knowledge_topics ORDER BY position, id",
  );
  const entries = await db.select<KnowledgeEntryLite[]>(
    `SELECT ${LITE_COLUMNS} FROM knowledge_entries ORDER BY pinned DESC, updated_at DESC, id DESC`,
  );
  return { topics, entries };
}

/** Fiche complète (média inclus) — pour le lecteur immersif. */
export async function fetchKnowledgeEntry(
  id: number,
): Promise<KnowledgeEntry | null> {
  if (!isTauri) return demo.fetchKnowledgeEntry(id);
  const db = await getDb();
  const rows = await db.select<KnowledgeEntry[]>(
    "SELECT * FROM knowledge_entries WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createKnowledgeTopic(
  name: string,
  color: string,
): Promise<number> {
  if (!isTauri) return demo.createKnowledgeTopic(name, color, localNow());
  const db = await getDb();
  const rows = await db.select<{ next: number | null }[]>(
    "SELECT MAX(position) + 1 AS next FROM knowledge_topics",
  );
  const res = await db.execute(
    "INSERT INTO knowledge_topics (name, color, position, created_at) VALUES ($1, $2, $3, $4)",
    [name, color, rows[0]?.next ?? 0, localNow()],
  );
  return res.lastInsertId ?? 0;
}

export async function updateKnowledgeTopic(
  id: number,
  name: string,
  color: string,
): Promise<void> {
  if (!isTauri) return demo.updateKnowledgeTopic(id, name, color);
  const db = await getDb();
  await db.execute(
    "UPDATE knowledge_topics SET name = $1, color = $2 WHERE id = $3",
    [name, color, id],
  );
}

/**
 * Réordonne les thèmes : la position de chaque identifiant devient son rang
 * dans le tableau reçu. Une seule écriture par thème DÉPLACÉ — les thèmes déjà
 * à leur rang ne sont pas réécrits, sinon un simple « monter d'un cran »
 * enverrait toute la liste dans la file de synchronisation.
 */
export async function reorderKnowledgeTopics(ids: number[]): Promise<void> {
  if (!isTauri) return demo.reorderKnowledgeTopics(ids);
  const db = await getDb();
  const rows = await db.select<{ id: number; position: number }[]>(
    "SELECT id, position FROM knowledge_topics",
  );
  const actuelle = new Map(rows.map((r) => [r.id, r.position]));
  for (const [rang, id] of ids.entries()) {
    if (actuelle.get(id) === rang) continue;
    await db.execute("UPDATE knowledge_topics SET position = $1 WHERE id = $2", [rang, id]);
  }
}

/** Supprime le thème ; ses fiches ne sont PAS perdues (elles passent « non classées »). */
export async function deleteKnowledgeTopic(id: number): Promise<void> {
  if (!isTauri) return demo.deleteKnowledgeTopic(id);
  const db = await getDb();
  await db.execute(
    "UPDATE knowledge_entries SET topic_id = NULL WHERE topic_id = $1",
    [id],
  );
  await db.execute("DELETE FROM knowledge_topics WHERE id = $1", [id]);
}

export async function createKnowledgeEntry(
  input: KnowledgeInput & { kind: KnowledgeEntry["kind"]; title: string },
): Promise<number> {
  const now = localNow();
  if (!isTauri) return demo.createKnowledgeEntry(input, now);
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO knowledge_entries
       (topic_id, kind, title, body, text, url, media, thumb, data, tags, pinned, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12)`,
    [
      input.topic_id ?? null,
      input.kind,
      input.title,
      input.body ?? "",
      input.text ?? "",
      input.url ?? null,
      input.media ?? null,
      input.thumb ?? null,
      input.data ?? null,
      input.tags ?? "",
      input.pinned ?? 0,
      now,
    ],
  );
  return res.lastInsertId ?? 0;
}

/**
 * Patch partiel : seules les colonnes fournies sont écrites.
 * `touch: false` préserve `updated_at` — indispensable pour une écriture
 * technique (ré-indexation du texte, conversion d'une fiche historique) qui
 * ne doit ni mentir sur la date de modification ni réordonner la liste.
 */
export async function updateKnowledgeEntry(
  id: number,
  patch: KnowledgeInput,
  opts: { touch?: boolean } = {},
): Promise<void> {
  const touch = opts.touch !== false;
  const fields = KNOWLEDGE_FIELDS.filter((f) => patch[f] !== undefined);
  if (fields.length === 0) return;
  if (!isTauri) return demo.updateKnowledgeEntry(id, patch, touch ? localNow() : null);
  const db = await getDb();
  const sets = fields.map((f, i) => `${f} = $${i + 1}`).join(", ");
  const values = fields.map((f) => patch[f] as string | number | null);
  await db.execute(
    touch
      ? `UPDATE knowledge_entries SET ${sets}, updated_at = $${fields.length + 1} WHERE id = $${fields.length + 2}`
      : `UPDATE knowledge_entries SET ${sets} WHERE id = $${fields.length + 1}`,
    touch ? [...values, localNow(), id] : [...values, id],
  );
}

export async function deleteKnowledgeEntry(id: number): Promise<void> {
  if (!isTauri) return demo.deleteKnowledgeEntry(id);
  const db = await getDb();
  await db.execute("DELETE FROM knowledge_entries WHERE id = $1", [id]);
}

// — Journal —

export async function upsertJournal(
  date: string,
  entry: { mood: number | null; energy: number | null; body: string },
): Promise<void> {
  if (!isTauri) return demo.upsertJournal(date, entry);
  const db = await getDb();
  await db.execute(
    "INSERT INTO journal_entries (date, mood, energy, body) VALUES ($1, $2, $3, $4) ON CONFLICT(date) DO UPDATE SET mood = $2, energy = $3, body = $4",
    [date, entry.mood, entry.energy, entry.body],
  );
}

// — Habitudes —

export async function addHabit(name: string, color: string): Promise<void> {
  if (!isTauri) return demo.addHabit(name, color);
  const db = await getDb();
  await db.execute("INSERT INTO habits (name, color) VALUES ($1, $2)", [
    name,
    color,
  ]);
}

export async function deleteHabit(id: number): Promise<void> {
  if (!isTauri) return demo.deleteHabit(id);
  const db = await getDb();
  await db.execute("DELETE FROM habit_checks WHERE habit_id = $1", [id]);
  await db.execute("DELETE FROM habits WHERE id = $1", [id]);
}

export async function setHabitCheck(
  habitId: number,
  date: string,
  checked: boolean,
): Promise<void> {
  if (!isTauri) return demo.setHabitCheck(habitId, date, checked);
  const db = await getDb();
  if (checked)
    await db.execute(
      "INSERT INTO habit_checks (habit_id, date) VALUES ($1, $2) ON CONFLICT(habit_id, date) DO NOTHING",
      [habitId, date],
    );
  else
    await db.execute(
      "DELETE FROM habit_checks WHERE habit_id = $1 AND date = $2",
      [habitId, date],
    );
}

export interface FocusInput {
  task_id: number | null;
  label: string | null;
  planned_min: number;
  kind: "focus" | "break";
}

export async function startFocus(input: FocusInput): Promise<number> {
  if (!isTauri) return demo.startFocus(input, localNow());
  const db = await getDb();
  const res = await db.execute(
    "INSERT INTO focus_sessions (task_id, label, started_at, planned_min, kind) VALUES ($1, $2, $3, $4, $5)",
    [input.task_id, input.label, localNow(), input.planned_min, input.kind],
  );
  return res.lastInsertId ?? 0;
}

export async function endFocus(id: number, endedAt: string): Promise<void> {
  if (!isTauri) return demo.endFocus(id, endedAt);
  const db = await getDb();
  await db.execute("UPDATE focus_sessions SET ended_at = $1 WHERE id = $2", [
    endedAt,
    id,
  ]);
}

/** Session encore ouverte (reprise après redémarrage de l'app). */
export async function fetchActiveFocus(): Promise<FocusSession | null> {
  if (!isTauri) return demo.fetchActiveFocus();
  const db = await getDb();
  const rows = await db.select<FocusSession[]>(
    "SELECT * FROM focus_sessions WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function addQuickLink(label: string, url: string): Promise<void> {
  if (!isTauri) return demo.addQuickLink(label, url);
  const db = await getDb();
  await db.execute("INSERT INTO quick_links (label, url) VALUES ($1, $2)", [
    label,
    url,
  ]);
}

export async function deleteQuickLink(id: number): Promise<void> {
  if (!isTauri) return demo.deleteQuickLink(id);
  const db = await getDb();
  await db.execute("DELETE FROM quick_links WHERE id = $1", [id]);
}

export async function getSetting(key: string): Promise<string | null> {
  if (!isTauri) return demo.getSetting(key);
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (!isTauri) return demo.setSetting(key, value);
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value],
  );
}

/**
 * Clé lue par le moteur de notifications (`src-tauri/src/notifications/data.rs`)
 * pour la règle « savoir délaissé ». Le format DOIT rester celui de `localNow()`
 * (`YYYY-MM-DD HH:MM:SS`, heure locale) : c'est ce que le Rust sait analyser.
 */
export const KNOWLEDGE_LAST_VIEWED_KEY = "knowledge.last_viewed_at";

/**
 * Marque le Savoir comme consulté — appelée à l'OUVERTURE d'une fiche, pas au
 * simple affichage de la liste : passer sur l'onglet sans rien lire ne doit pas
 * désamorcer le rappel d'inactivité.
 */
export async function markKnowledgeViewed(): Promise<void> {
  await setSetting(KNOWLEDGE_LAST_VIEWED_KEY, localNow());
}

/** Snapshot quotidien de la progression effective des objectifs (appelé au lancement). */
export async function snapshotGoals(
  date: string,
  entries: { goal_id: number; pct: number }[],
): Promise<void> {
  if (!isTauri) return; // en démo, l'historique est seedé
  const db = await getDb();
  for (const e of entries) {
    await db.execute(
      "INSERT INTO goal_progress_log (goal_id, date, pct) VALUES ($1, $2, $3) ON CONFLICT(goal_id, date) DO UPDATE SET pct = $3",
      [e.goal_id, date, e.pct],
    );
  }
}

export async function addMetric(name: string, unit: string | null): Promise<void> {
  if (!isTauri) return demo.addMetric(name, unit);
  const db = await getDb();
  await db.execute("INSERT INTO custom_metrics (name, unit) VALUES ($1, $2)", [
    name,
    unit,
  ]);
}

export async function deleteMetric(id: number): Promise<void> {
  if (!isTauri) return demo.deleteMetric(id);
  const db = await getDb();
  await db.execute("DELETE FROM metric_entries WHERE metric_id = $1", [id]);
  await db.execute("DELETE FROM custom_metrics WHERE id = $1", [id]);
}

export async function setMetricValue(
  metricId: number,
  date: string,
  value: number,
): Promise<void> {
  if (!isTauri) return demo.setMetricValue(metricId, date, value);
  const db = await getDb();
  await db.execute(
    "INSERT INTO metric_entries (metric_id, date, value) VALUES ($1, $2, $3) ON CONFLICT(metric_id, date) DO UPDATE SET value = $3",
    [metricId, date, value],
  );
}

export async function createTask(input: TaskInput): Promise<void> {
  if (!isTauri) return demo.createTask(input);
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (label, tag, priority, recurrence, goal_id, created_at, due_date, start_at, end_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.label,
      input.tag,
      input.priority,
      input.recurrence,
      input.goal_id,
      localNow(),
      input.due_date ?? null,
      input.start_at ?? null,
      input.end_at ?? null,
    ],
  );
}

export async function updateTask(id: number, input: TaskInput): Promise<void> {
  if (!isTauri) return demo.updateTask(id, input);
  const db = await getDb();
  await db.execute(
    `UPDATE tasks SET label = $1, tag = $2, priority = $3, recurrence = $4, goal_id = $5,
            due_date = $6, start_at = $7, end_at = $8
      WHERE id = $9`,
    [
      input.label,
      input.tag,
      input.priority,
      input.recurrence,
      input.goal_id,
      input.due_date ?? null,
      input.start_at ?? null,
      input.end_at ?? null,
      id,
    ],
  );
}

export async function deleteTask(id: number): Promise<void> {
  if (!isTauri) return demo.deleteTask(id);
  const db = await getDb();
  await db.execute("DELETE FROM task_completions WHERE task_id = $1", [id]);
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

export async function setTaskDone(
  taskId: number,
  date: string,
  done: boolean,
): Promise<void> {
  if (!isTauri) return demo.setTaskDone(taskId, date, done);
  const db = await getDb();
  await db.execute(
    "INSERT INTO task_completions (task_id, date, done) VALUES ($1, $2, $3) ON CONFLICT(task_id, date) DO UPDATE SET done = $3",
    [taskId, date, done ? 1 : 0],
  );
}

export interface GoalInput {
  title: string;
  description: string | null;
  scope: "short" | "medium" | "long";
  category: string | null;
  parent_goal_id: number | null;
  deadline: string | null;
  progress_pct: number;
  manual_progress: number; // 0 | 1
}

export async function createGoal(input: GoalInput): Promise<void> {
  if (!isTauri) return demo.createGoal(input);
  const db = await getDb();
  await db.execute(
    "INSERT INTO goals (title, description, scope, category, parent_goal_id, deadline, progress_pct, manual_progress, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)",
    [
      input.title,
      input.description,
      input.scope,
      input.category,
      input.parent_goal_id,
      input.deadline,
      input.progress_pct,
      input.manual_progress,
      localNow(),
    ],
  );
}

export async function updateGoal(id: number, input: GoalInput): Promise<void> {
  if (!isTauri) return demo.updateGoal(id, input);
  const db = await getDb();
  await db.execute(
    "UPDATE goals SET title = $1, description = $2, scope = $3, category = $4, parent_goal_id = $5, deadline = $6, progress_pct = $7, manual_progress = $8 WHERE id = $9",
    [
      input.title,
      input.description,
      input.scope,
      input.category,
      input.parent_goal_id,
      input.deadline,
      input.progress_pct,
      input.manual_progress,
      id,
    ],
  );
}

/** Supprime l'objectif ; ses enfants remontent vers son parent, ses tâches sont déliées. */
export async function deleteGoal(goal: Goal): Promise<void> {
  if (!isTauri) return demo.deleteGoal(goal);
  const db = await getDb();
  await db.execute("UPDATE goals SET parent_goal_id = $1 WHERE parent_goal_id = $2", [
    goal.parent_goal_id,
    goal.id,
  ]);
  await db.execute("UPDATE tasks SET goal_id = NULL WHERE goal_id = $1", [goal.id]);
  await db.execute("DELETE FROM goals WHERE id = $1", [goal.id]);
}

export async function addTag(name: string, color: string): Promise<void> {
  if (!isTauri) return demo.addTag(name, color);
  const db = await getDb();
  await db.execute(
    "INSERT INTO tags (name, color) VALUES ($1, $2) ON CONFLICT(name) DO UPDATE SET color = $2",
    [name, color],
  );
}

export async function deleteTag(tag: Tag): Promise<void> {
  if (!isTauri) return demo.deleteTag(tag);
  const db = await getDb();
  await db.execute("UPDATE tasks SET tag = NULL WHERE tag = $1", [tag.name]);
  await db.execute("DELETE FROM tags WHERE id = $1", [tag.id]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Finance
// ─────────────────────────────────────────────────────────────────────────────
// Le module charge ses données SEUL, à l'ouverture de sa vue, et pas via
// `fetchAll()`. C'est le patron du Savoir, choisi pour la même raison : ces
// tables n'ont rien à faire dans le rafraîchissement global que déclenche la
// moindre case cochée sur le tableau de bord.
//
// ⚠️ LES SUPPRESSIONS SONT EXPLICITES, ENFANTS D'ABORD. Les clés étrangères sont
// déclarées dans le schéma, mais `PRAGMA foreign_keys` n'est pas activé par
// tauri-plugin-sql : SQLite ne cascade donc rien. Supprimer un compte sans
// supprimer ses relevés laisserait des lignes orphelines — qui continueraient
// d'exister, et de se synchroniser, sans plus rien désigner. Chaque `DELETE`
// explicite déclenche en outre sa pierre tombale (migration 018), donc la
// suppression voyage jusqu'aux autres appareils.

export interface FinanceData {
  comptes: FinanceAccount[];
  balances: FinanceBalance[];
  recurrents: FinanceRecurring[];
  categories: FinanceCategory[];
  holdings: FinanceHolding[];
  quotes: FinanceQuote[];
  fx: FinanceFxRate[];
}

export async function fetchFinance(): Promise<FinanceData> {
  if (!isTauri) return demo.fetchFinance();
  const db = await getDb();
  const [comptes, balances, recurrents, categories, holdings, quotes, fx] = await Promise.all([
    db.select<FinanceAccount[]>("SELECT * FROM finance_accounts ORDER BY position, id"),
    db.select<FinanceBalance[]>("SELECT * FROM finance_balances ORDER BY date"),
    db.select<FinanceRecurring[]>("SELECT * FROM finance_recurring ORDER BY direction, label"),
    db.select<FinanceCategory[]>("SELECT * FROM finance_categories ORDER BY position, id"),
    db.select<FinanceHolding[]>("SELECT * FROM finance_holdings ORDER BY symbol"),
    db.select<FinanceQuote[]>("SELECT * FROM finance_quotes_cache"),
    db.select<FinanceFxRate[]>("SELECT * FROM finance_fx_cache"),
  ]);
  return { comptes, balances, recurrents, categories, holdings, quotes, fx };
}

export interface FinanceAccountInput {
  label: string;
  kind: FinanceAccountKind;
  currency: string;
  institution: string | null;
  is_liquid: boolean;
}

export async function createFinanceAccount(input: FinanceAccountInput): Promise<number> {
  if (!isTauri) return demo.createFinanceAccount(input, localNow());
  const db = await getDb();
  const rows = await db.select<{ next: number | null }[]>(
    "SELECT MAX(position) + 1 AS next FROM finance_accounts",
  );
  const res = await db.execute(
    `INSERT INTO finance_accounts (label, kind, currency, institution, is_liquid, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
    [
      input.label,
      input.kind,
      input.currency,
      input.institution,
      input.is_liquid ? 1 : 0,
      rows[0]?.next ?? 0,
      localNow(),
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function updateFinanceAccount(
  id: number,
  input: FinanceAccountInput,
): Promise<void> {
  if (!isTauri) return demo.updateFinanceAccount(id, input, localNow());
  const db = await getDb();
  await db.execute(
    `UPDATE finance_accounts
        SET label = $1, kind = $2, currency = $3, institution = $4, is_liquid = $5, updated_at = $6
      WHERE id = $7`,
    [
      input.label,
      input.kind,
      input.currency,
      input.institution,
      input.is_liquid ? 1 : 0,
      localNow(),
      id,
    ],
  );
}

/** Archive plutôt que supprimer : l'historique des relevés garde sa valeur. */
export async function archiveFinanceAccount(id: number, archive: boolean): Promise<void> {
  if (!isTauri) return demo.archiveFinanceAccount(id, archive, localNow());
  const db = await getDb();
  await db.execute("UPDATE finance_accounts SET archived = $1, updated_at = $2 WHERE id = $3", [
    archive ? 1 : 0,
    localNow(),
    id,
  ]);
}

/** Suppression définitive, relevés et positions compris. */
export async function deleteFinanceAccount(id: number): Promise<void> {
  if (!isTauri) return demo.deleteFinanceAccount(id);
  const db = await getDb();
  await db.execute("DELETE FROM finance_balances WHERE account_id = $1", [id]);
  await db.execute("DELETE FROM finance_holdings WHERE account_id = $1", [id]);
  await db.execute("UPDATE finance_recurring SET account_id = NULL WHERE account_id = $1", [id]);
  await db.execute("DELETE FROM finance_accounts WHERE id = $1", [id]);
}

/**
 * Enregistre un relevé. C'est LE geste fréquent du module — celui qui doit
 * tenir en deux clics — et il est idempotent : ressaisir le solde du même
 * compte au même jour corrige la valeur au lieu d'empiler une seconde ligne.
 */
export async function saveFinanceBalance(
  accountId: number,
  date: string,
  amountCents: number,
): Promise<void> {
  if (!isTauri) return demo.saveFinanceBalance(accountId, date, amountCents, localNow());
  const db = await getDb();
  await db.execute(
    `INSERT INTO finance_balances (account_id, date, amount_cents, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT(account_id, date) DO UPDATE SET amount_cents = $3`,
    [accountId, date, amountCents, localNow()],
  );
}

export async function deleteFinanceBalance(id: number): Promise<void> {
  if (!isTauri) return demo.deleteFinanceBalance(id);
  const db = await getDb();
  await db.execute("DELETE FROM finance_balances WHERE id = $1", [id]);
}

export interface FinanceRecurringInput {
  label: string;
  amount_cents: number;
  direction: FinanceDirection;
  frequency: FinanceFrequency;
  day_of_period: number | null;
  category_id: number | null;
  account_id: number | null;
  active_from: string;
  active_to: string | null;
}

export async function createFinanceRecurring(input: FinanceRecurringInput): Promise<number> {
  if (!isTauri) return demo.createFinanceRecurring(input, localNow());
  const db = await getDb();
  const res = await db.execute(
    `INSERT INTO finance_recurring
       (label, amount_cents, direction, frequency, day_of_period, category_id, account_id, active_from, active_to, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
    [
      input.label,
      input.amount_cents,
      input.direction,
      input.frequency,
      input.day_of_period,
      input.category_id,
      input.account_id,
      input.active_from,
      input.active_to,
      localNow(),
    ],
  );
  return res.lastInsertId ?? 0;
}

export async function updateFinanceRecurring(
  id: number,
  input: FinanceRecurringInput,
): Promise<void> {
  if (!isTauri) return demo.updateFinanceRecurring(id, input, localNow());
  const db = await getDb();
  await db.execute(
    `UPDATE finance_recurring
        SET label = $1, amount_cents = $2, direction = $3, frequency = $4, day_of_period = $5,
            category_id = $6, account_id = $7, active_from = $8, active_to = $9, updated_at = $10
      WHERE id = $11`,
    [
      input.label,
      input.amount_cents,
      input.direction,
      input.frequency,
      input.day_of_period,
      input.category_id,
      input.account_id,
      input.active_from,
      input.active_to,
      localNow(),
      id,
    ],
  );
}

export async function deleteFinanceRecurring(id: number): Promise<void> {
  if (!isTauri) return demo.deleteFinanceRecurring(id);
  const db = await getDb();
  await db.execute("DELETE FROM finance_recurring WHERE id = $1", [id]);
}

export async function createFinanceCategory(
  name: string,
  kind: FinanceDirection,
  color: string | null,
): Promise<number> {
  if (!isTauri) return demo.createFinanceCategory(name, kind, color, localNow());
  const db = await getDb();
  const rows = await db.select<{ next: number | null }[]>(
    "SELECT MAX(position) + 1 AS next FROM finance_categories",
  );
  const res = await db.execute(
    "INSERT INTO finance_categories (name, kind, color, position, created_at) VALUES ($1, $2, $3, $4, $5)",
    [name, kind, color, rows[0]?.next ?? 0, localNow()],
  );
  return res.lastInsertId ?? 0;
}

/** Les flux qui la portaient ne sont pas perdus : ils passent « sans catégorie ». */
export async function deleteFinanceCategory(id: number): Promise<void> {
  if (!isTauri) return demo.deleteFinanceCategory(id);
  const db = await getDb();
  await db.execute("UPDATE finance_recurring SET category_id = NULL WHERE category_id = $1", [id]);
  await db.execute("DELETE FROM finance_categories WHERE id = $1", [id]);
}

/**
 * Enregistre une position.
 *
 * ⚠️ Le SYMBOLE n'est pas modifiable : l'uid de la ligne en dérive (migration
 * 018), et le changer laisserait une identité qui ne correspond plus à rien sur
 * les autres appareils. Corriger un symbole se fait en supprimant la ligne et
 * en la recréant — ce que l'interface propose explicitement.
 */
export async function saveFinanceHolding(
  accountId: number,
  symbol: string,
  quantityE8: number,
  costBasisCents: number | null,
  source: FinanceSource,
): Promise<void> {
  if (!isTauri)
    return demo.saveFinanceHolding(accountId, symbol, quantityE8, costBasisCents, source, localNow());
  const db = await getDb();
  await db.execute(
    `INSERT INTO finance_holdings (account_id, symbol, quantity_e8, cost_basis_cents, source, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     ON CONFLICT(account_id, symbol)
     DO UPDATE SET quantity_e8 = $3, cost_basis_cents = $4, source = $5, updated_at = $6`,
    [accountId, symbol, quantityE8, costBasisCents, source, localNow()],
  );
}

export async function deleteFinanceHolding(id: number): Promise<void> {
  if (!isTauri) return demo.deleteFinanceHolding(id);
  const db = await getDb();
  await db.execute("DELETE FROM finance_holdings WHERE id = $1", [id]);
}

/** Écrit les cotations rafraîchies. Cache pur : hors synchronisation. */
export async function saveFinanceQuotes(quotes: FinanceQuote[]): Promise<void> {
  if (!isTauri) return demo.saveFinanceQuotes(quotes);
  if (quotes.length === 0) return;
  const db = await getDb();
  for (const q of quotes) {
    await db.execute(
      `INSERT INTO finance_quotes_cache (symbol, price_e8, currency, source, fetched_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(symbol) DO UPDATE SET price_e8 = $2, currency = $3, source = $4, fetched_at = $5`,
      [q.symbol, q.price_e8, q.currency, q.source, q.fetched_at],
    );
  }
}

export async function saveFinanceFx(rates: FinanceFxRate[]): Promise<void> {
  if (!isTauri) return demo.saveFinanceFx(rates);
  if (rates.length === 0) return;
  const db = await getDb();
  for (const r of rates) {
    await db.execute(
      `INSERT INTO finance_fx_cache (base, quote, rate_e8, fetched_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT(base, quote) DO UPDATE SET rate_e8 = $3, fetched_at = $4`,
      [r.base, r.quote, r.rate_e8, r.fetched_at],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendrier, liaisons et objets — socle du 2026-09-02 (migration 020)
//
// ⚠️ CHAQUE FONCTION EXISTE DES DEUX CÔTÉS : ici (natif) et dans `demo.ts`
// (mode démo navigateur). Un accès écrit d'un seul côté rend l'interface qui
// s'en sert INVISIBLE en preview — donc invérifiable, puisque c'est le seul
// mode où l'on peut auditer sans piloter la vraie base d'Antonin.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * L'`uid` d'une ligne, à partir de sa famille et de son numéro local.
 *
 * C'est le passage obligé pour créer une liaison depuis l'interface : les
 * écrans manipulent des `id`, les arêtes ne connaissent que des `uid`
 * (migration 020, § 5).
 *
 * ⚠️ En mode démo, il n'y a ni SQLite ni colonne `uid` : `demo.ts` rend un
 * identifiant synthétique STABLE (`demo:note:3`). Les arêtes y sont donc
 * cohérentes entre elles, ce qui suffit à vérifier une interface — mais elles
 * n'ont évidemment aucun rapport avec les uid réels, et rien de tout cela ne se
 * synchronise.
 */
export async function uidDe(kind: LinkKind, id: number): Promise<string | null> {
  if (!isTauri) return demo.uidDe(kind, id);
  const table = TABLE_DE_KIND[kind];
  const db = await getDb();
  const rows = await db.select<{ uid: string }[]>(`SELECT uid FROM ${table} WHERE id = $1`, [id]);
  return rows[0]?.uid ?? null;
}

// ─── Événements du calendrier ────────────────────────────────────────────────

export interface CalendarEventInput {
  title: string;
  body: string | null;
  date: string; // YYYY-MM-DD
  start_at: string | null; // HH:MM
  end_at: string | null; // HH:MM
  all_day: boolean;
  color: string | null;
  recurrence: string;
}

/** Les événements d'une fenêtre de dates, bornes comprises. */
export async function fetchCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (!isTauri) return demo.fetchCalendarEvents(from, to);
  const db = await getDb();
  return db.select<CalendarEvent[]>(
    "SELECT * FROM calendar_events WHERE date >= $1 AND date <= $2 ORDER BY date, start_at",
    [from, to],
  );
}

/**
 * Les événements RÉCURRENTS, qui n'ont pas de place dans une fenêtre de dates :
 * leur `date` est celle de la première occurrence, et les suivantes se
 * calculent. Les charger à part évite que la vue « semaine prochaine » ne les
 * rate simplement parce qu'ils ont commencé l'an dernier.
 */
export async function fetchRecurringEvents(): Promise<CalendarEvent[]> {
  if (!isTauri) return demo.fetchRecurringEvents();
  const db = await getDb();
  return db.select<CalendarEvent[]>(
    "SELECT * FROM calendar_events WHERE recurrence IS NOT NULL AND recurrence <> 'none' ORDER BY date",
  );
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<void> {
  if (!isTauri) return demo.createCalendarEvent(input, localNow());
  const db = await getDb();
  const now = localNow();
  await db.execute(
    `INSERT INTO calendar_events (title, body, date, start_at, end_at, all_day, color, recurrence, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
    [
      input.title,
      input.body,
      input.date,
      input.start_at,
      input.end_at,
      input.all_day ? 1 : 0,
      input.color,
      input.recurrence,
      now,
    ],
  );
}

export async function updateCalendarEvent(id: number, input: CalendarEventInput): Promise<void> {
  if (!isTauri) return demo.updateCalendarEvent(id, input, localNow());
  const db = await getDb();
  await db.execute(
    `UPDATE calendar_events
        SET title = $1, body = $2, date = $3, start_at = $4, end_at = $5,
            all_day = $6, color = $7, recurrence = $8, updated_at = $9
      WHERE id = $10`,
    [
      input.title,
      input.body,
      input.date,
      input.start_at,
      input.end_at,
      input.all_day ? 1 : 0,
      input.color,
      input.recurrence,
      localNow(),
      id,
    ],
  );
}

export async function deleteCalendarEvent(id: number): Promise<void> {
  if (!isTauri) return demo.deleteCalendarEvent(id);
  const db = await getDb();
  // Les arêtes qui citent cet événement partent avec lui, par trigger
  // (migration 020, § 8) — rien à faire ici.
  await db.execute("DELETE FROM calendar_events WHERE id = $1", [id]);
}

// ─── Tâches datées ───────────────────────────────────────────────────────────

/** Les tâches datées d'une fenêtre, bornes comprises. Les récurrentes en sont exclues. */
export async function fetchDatedTasks(from: string, to: string): Promise<Task[]> {
  if (!isTauri) return demo.fetchDatedTasks(from, to);
  const db = await getDb();
  return db.select<Task[]>(
    "SELECT * FROM tasks WHERE due_date >= $1 AND due_date <= $2 ORDER BY due_date, start_at",
    [from, to],
  );
}

/**
 * Poser ou déplacer une tâche dans le calendrier — c'est ce qu'écrit le
 * glisser-déposer.
 *
 * ⚠️ Ne touche NI au compteur de reports NI à `postponed_from` : déplacer une
 * tâche à la main n'est pas un glissement subi. La remise à zéro du compteur
 * passe par `replanifierTache`, qui dit explicitement ce qu'elle fait.
 */
export async function setTaskSchedule(
  id: number,
  dueDate: string | null,
  startAt: string | null,
  endAt: string | null,
): Promise<void> {
  if (!isTauri) return demo.setTaskSchedule(id, dueDate, startAt, endAt);
  const db = await getDb();
  await db.execute(
    "UPDATE tasks SET due_date = $1, start_at = $2, end_at = $3 WHERE id = $4",
    [dueDate, startAt, endAt, id],
  );
}

/** Applique un report calculé par `lib/taches.ts` — ou une replanification. */
export async function appliquerReport(id: number, report: Report): Promise<void> {
  if (!isTauri) return demo.appliquerReport(id, report);
  const db = await getDb();
  await db.execute(
    "UPDATE tasks SET due_date = $1, postponed_count = $2, postponed_from = $3 WHERE id = $4",
    [report.due_date, report.postponed_count, report.postponed_from, id],
  );
}

// ─── Types d'objets ──────────────────────────────────────────────────────────

export interface ObjectTypeInput {
  name: string;
  icon: string | null;
  color: string | null;
  fields: ObjectField[];
}

export async function fetchObjectTypes(): Promise<ObjectType[]> {
  if (!isTauri) return demo.fetchObjectTypes();
  const db = await getDb();
  return db.select<ObjectType[]>("SELECT * FROM object_types ORDER BY position, id");
}

export async function createObjectType(input: ObjectTypeInput): Promise<void> {
  if (!isTauri) return demo.createObjectType(input, localNow());
  const db = await getDb();
  const now = localNow();
  const rows = await db.select<{ next: number }[]>(
    "SELECT COALESCE(MAX(position), 0) + 1 AS next FROM object_types",
  );
  await db.execute(
    `INSERT INTO object_types (name, icon, color, fields, builtin, position, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 0, $5, $6, $6)`,
    [input.name, input.icon, input.color, serialiserChamps(input.fields), rows[0]?.next ?? 1, now],
  );
}

/**
 * ⚠️ Modifier un type livré est AUTORISÉ. `builtin` dit d'où vient le type, il
 * ne le verrouille pas — sans quoi ce serait la « liste fermée » qu'Antonin a
 * explicitement écartée, avec l'illusion du choix en plus.
 */
export async function updateObjectType(id: number, input: ObjectTypeInput): Promise<void> {
  if (!isTauri) return demo.updateObjectType(id, input, localNow());
  const db = await getDb();
  await db.execute(
    "UPDATE object_types SET name = $1, icon = $2, color = $3, fields = $4, updated_at = $5 WHERE id = $6",
    [input.name, input.icon, input.color, serialiserChamps(input.fields), localNow(), id],
  );
}

/**
 * ⚠️ Supprime AUSSI les objets de ce type, et leurs arêtes — par triggers
 * (migration 020, § 8). Des fiches sans type resteraient en base sans champs ni
 * écran pour les afficher : invisibles, mais toujours là.
 */
export async function deleteObjectType(id: number): Promise<void> {
  if (!isTauri) return demo.deleteObjectType(id);
  const db = await getDb();
  await db.execute("DELETE FROM object_types WHERE id = $1", [id]);
}

// ─── Objets ──────────────────────────────────────────────────────────────────

export interface ObjectInput {
  type_id: number;
  title: string;
  body: string | null;
  field_values: Record<string, unknown>;
}

export async function fetchObjects(typeId?: number): Promise<CustomObject[]> {
  if (!isTauri) return demo.fetchObjects(typeId);
  const db = await getDb();
  return typeId == null
    ? db.select<CustomObject[]>("SELECT * FROM objects ORDER BY updated_at DESC")
    : db.select<CustomObject[]>("SELECT * FROM objects WHERE type_id = $1 ORDER BY updated_at DESC", [typeId]);
}

export async function createObject(input: ObjectInput): Promise<void> {
  if (!isTauri) return demo.createObject(input, localNow());
  const db = await getDb();
  const now = localNow();
  await db.execute(
    `INSERT INTO objects (type_id, title, body, field_values, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $5)`,
    [input.type_id, input.title, input.body, serialiserValeurs(input.field_values), now],
  );
}

/**
 * ⚠️ `input.field_values` doit avoir été passé par `fusionnerValeurs()` :
 * écrire ici le seul contenu du formulaire effacerait les valeurs dont le champ
 * a été retiré du type, sans un mot. C'est la promesse du module (voir
 * `lib/objets.ts`).
 */
export async function updateObject(id: number, input: ObjectInput): Promise<void> {
  if (!isTauri) return demo.updateObject(id, input, localNow());
  const db = await getDb();
  await db.execute(
    "UPDATE objects SET type_id = $1, title = $2, body = $3, field_values = $4, updated_at = $5 WHERE id = $6",
    [input.type_id, input.title, input.body, serialiserValeurs(input.field_values), localNow(), id],
  );
}

export async function deleteObject(id: number): Promise<void> {
  if (!isTauri) return demo.deleteObject(id);
  const db = await getDb();
  await db.execute("DELETE FROM objects WHERE id = $1", [id]);
}

// ─── Liaisons ────────────────────────────────────────────────────────────────

/** Ce que CE texte mentionne. */
export async function fetchLinksFrom(kind: LinkKind, uid: string): Promise<ObjectLink[]> {
  if (!isTauri) return demo.fetchLinksFrom(kind, uid);
  const db = await getDb();
  return db.select<ObjectLink[]>(
    "SELECT * FROM object_links WHERE from_kind = $1 AND from_uid = $2 ORDER BY created_at",
    [kind, uid],
  );
}

/**
 * Les BACKLINKS : qui parle de cet objet.
 *
 * C'est la moitié qui donne sa valeur au système — une mention sans backlink
 * n'est qu'un lien hypertexte.
 */
export async function fetchLinksTo(kind: LinkKind, uid: string): Promise<ObjectLink[]> {
  if (!isTauri) return demo.fetchLinksTo(kind, uid);
  const db = await getDb();
  return db.select<ObjectLink[]>(
    "SELECT * FROM object_links WHERE to_kind = $1 AND to_uid = $2 ORDER BY created_at",
    [kind, uid],
  );
}

/**
 * Crée une arête, sans erreur si elle existe déjà.
 *
 * L'`ON CONFLICT DO NOTHING` porte sur l'index unique des quatre colonnes : une
 * mention déjà rattachée à la main, ou tapée deux fois, ne doit pas faire
 * échouer l'enregistrement d'une note. `origin` de la PREMIÈRE écriture est
 * conservée — une mention rattachée ensuite à la main reste une mention.
 */
export async function createLink(arete: AreteVoulue): Promise<void> {
  if (!isTauri) return demo.createLink(arete, localNow());
  const db = await getDb();
  await db.execute(
    `INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(from_kind, from_uid, to_kind, to_uid) DO NOTHING`,
    [arete.from_kind, arete.from_uid, arete.to_kind, arete.to_uid, arete.origin, localNow()],
  );
}

export async function deleteLink(id: number): Promise<void> {
  if (!isTauri) return demo.deleteLink(id);
  const db = await getDb();
  await db.execute("DELETE FROM object_links WHERE id = $1", [id]);
}

/**
 * Met les arêtes d'un texte en accord avec ce qu'il contient MAINTENANT.
 *
 * À appeler après l'enregistrement d'une note, d'une fiche ou d'un objet.
 * ⚠️ Ne retire que les arêtes d'origine `mention` : un rattachement fait à la
 * main survit à la réécriture du texte (voir `diffMentions`).
 */
export async function synchroniserMentions(
  source: LinkKind,
  sourceUid: string,
  voulues: readonly AreteVoulue[],
): Promise<void> {
  const existantes = await fetchLinksFrom(source, sourceUid);
  const { aCreer, aSupprimer } = diffMentions(existantes, voulues);
  for (const a of aCreer) await createLink(a);
  for (const l of aSupprimer) await deleteLink(l.id);
}

// ─────────────────────────────────────────────────────────────────────────────
// Recherche unifiée et mentions — chantier C (2026-09-02)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⭐ Chercher dans TOUTE l'app, sans dégrader la recherche de notes.
 *
 * Trois régimes coexistaient : FTS5 pour les notes (instantané, hors ligne), une
 * recherche en mémoire sur la colonne `text` du Savoir, et **rien du tout** pour
 * les autres modules. Les unifier ne veut pas dire les remplacer :
 *
 *   • les NOTES continuent de passer par `notes_fts` — le refondre en mémoire
 *     dégraderait une recherche déjà instantanée sur des milliers de notes ;
 *   • les autres tables sont interrogées par un `LIKE` borné, parce qu'elles
 *     tiennent en quelques centaines de lignes et qu'un index FTS par table
 *     serait cinq migrations pour un gain nul ;
 *   • **le classement, lui, est commun** (`lib/recherche.ts`) : c'est là qu'est
 *     l'unification, et c'est la seule qui se voie à l'écran.
 */
export async function rechercherPartout(
  requete: string,
  options: { limite?: number; familles?: readonly LinkKind[]; exclure?: { kind: LinkKind; uid: string } } = {},
): Promise<Trouvaille[]> {
  const corpus = await corpusPour(requete, options.familles);
  return rechercher(corpus, requete, { limite: options.limite ?? 12, ...options });
}

/** Le corpus candidat — volontairement borné, jamais « toute la base ». */
async function corpusPour(
  requete: string,
  familles?: readonly LinkKind[],
): Promise<DocumentRecherche[]> {
  if (!isTauri) return demo.corpusRecherche(requete, familles);
  const veut = (k: LinkKind) => !familles || familles.includes(k);
  const db = await getDb();
  const q = requete.trim();
  const like = `%${q}%`;
  const docs: DocumentRecherche[] = [];

  if (veut("note")) {
    // FTS5 quand il y a une requête, les plus récentes sinon.
    for (const n of await searchNotes(q)) {
      docs.push({ kind: "note", id: n.id, uid: "", titre: n.title, corps: n.body ?? "" });
    }
  }
  if (veut("knowledge")) {
    const rows = await db.select<{ id: number; uid: string; title: string; text: string }[]>(
      q
        ? "SELECT id, uid, title, text FROM knowledge_entries WHERE title LIKE $1 OR text LIKE $1 ORDER BY updated_at DESC LIMIT 40"
        : "SELECT id, uid, title, text FROM knowledge_entries ORDER BY updated_at DESC LIMIT 40",
      q ? [like] : [],
    );
    for (const r of rows) docs.push({ kind: "knowledge", id: r.id, uid: r.uid, titre: r.title, corps: r.text });
  }
  if (veut("object")) {
    const rows = await db.select<{ id: number; uid: string; title: string; nom: string }[]>(
      q
        ? "SELECT o.id, o.uid, o.title, t.name AS nom FROM objects o LEFT JOIN object_types t ON t.id = o.type_id WHERE o.title LIKE $1 ORDER BY o.updated_at DESC LIMIT 40"
        : "SELECT o.id, o.uid, o.title, t.name AS nom FROM objects o LEFT JOIN object_types t ON t.id = o.type_id ORDER BY o.updated_at DESC LIMIT 40",
      q ? [like] : [],
    );
    for (const r of rows) docs.push({ kind: "object", id: r.id, uid: r.uid, titre: r.title, contexte: r.nom });
  }
  if (veut("goal")) {
    const rows = await db.select<{ id: number; uid: string; title: string }[]>(
      q ? "SELECT id, uid, title FROM goals WHERE title LIKE $1 LIMIT 40" : "SELECT id, uid, title FROM goals LIMIT 40",
      q ? [like] : [],
    );
    for (const r of rows) docs.push({ kind: "goal", id: r.id, uid: r.uid, titre: r.title });
  }
  if (veut("task")) {
    const rows = await db.select<{ id: number; uid: string; label: string }[]>(
      q ? "SELECT id, uid, label FROM tasks WHERE label LIKE $1 LIMIT 40" : "SELECT id, uid, label FROM tasks LIMIT 40",
      q ? [like] : [],
    );
    for (const r of rows) docs.push({ kind: "task", id: r.id, uid: r.uid, titre: r.label });
  }
  if (veut("event")) {
    const rows = await db.select<{ id: number; uid: string; title: string; date: string }[]>(
      q
        ? "SELECT id, uid, title, date FROM calendar_events WHERE title LIKE $1 ORDER BY date DESC LIMIT 40"
        : "SELECT id, uid, title, date FROM calendar_events ORDER BY date DESC LIMIT 40",
      q ? [like] : [],
    );
    for (const r of rows) docs.push({ kind: "event", id: r.id, uid: r.uid, titre: r.title, contexte: r.date });
  }

  // ⚠️ Les notes n'ont pas d'`uid` dans le résultat de `searchNotes` (le SELECT
  // du FTS ne le ramène pas toujours). On les complète ici, en une requête :
  // sans `uid`, aucune mention ne peut pointer vers une note.
  const sansUid = docs.filter((d) => d.kind === "note" && !d.uid);
  if (sansUid.length) {
    const rows = await db.select<{ id: number; uid: string }[]>(
      `SELECT id, uid FROM notes WHERE id IN (${sansUid.map((_, i) => `$${i + 1}`).join(", ")})`,
      sansUid.map((d) => d.id),
    );
    const parId = new Map(rows.map((r) => [r.id, r.uid]));
    for (const d of sansUid) d.uid = parId.get(d.id) ?? "";
  }

  return docs.filter((d) => !!d.uid);
}

/**
 * Les titres ACTUELS des objets cités, par `kind:uid`.
 *
 * Sert à rafraîchir les jetons de mention au chargement d'un texte. Ciblé sur
 * les seuls uid présents : charger tout le corpus pour réécrire trois jetons
 * serait absurde, et lent sur une grosse base.
 *
 * Une clé ABSENTE de la réponse signifie « cet objet n'existe plus » — c'est ce
 * que `rafraichirMentions` traduit en jeton mort.
 */
export async function titresDesMentions(
  refs: readonly { kind: LinkKind; uid: string }[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (refs.length === 0) return out;
  if (!isTauri) return demo.titresDesMentions(refs);
  const db = await getDb();

  const parFamille = new Map<LinkKind, string[]>();
  for (const r of refs) {
    if (!parFamille.has(r.kind)) parFamille.set(r.kind, []);
    parFamille.get(r.kind)!.push(r.uid);
  }

  const COLONNE: Record<LinkKind, { table: string; titre: string }> = {
    note: { table: "notes", titre: "title" },
    knowledge: { table: "knowledge_entries", titre: "title" },
    task: { table: "tasks", titre: "label" },
    goal: { table: "goals", titre: "title" },
    event: { table: "calendar_events", titre: "title" },
    trade: { table: "trades", titre: "pair" },
    object: { table: "objects", titre: "title" },
  };

  for (const [kind, uids] of parFamille) {
    const { table, titre } = COLONNE[kind];
    const jokers = uids.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await db.select<{ uid: string; titre: string }[]>(
      `SELECT uid, ${titre} AS titre FROM ${table} WHERE uid IN (${jokers})`,
      uids,
    );
    for (const r of rows) out.set(`${kind}:${r.uid}`, r.titre ?? "");
  }
  return out;
}
