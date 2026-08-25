// Registre d'actions central : consommé par la palette ⌘K et la quick capture.
// Une action = un id stable + un exécuteur.
import type { View } from "../components/Sidebar";
import { todayStr, todayTasks } from "./logic";
import { createNote, createTask, setMetricValue, setTaskDone } from "./repo";
import type { AppData } from "./types";
import type { FocusController } from "./useFocus";

import { t } from "./i18n";
export interface ActionContext {
  navigate: (view: View) => void;
  refresh: () => Promise<void>;
  data: AppData | null;
  focus?: FocusController;
}

export interface AppAction {
  id: string;
  title: string;
  category:
    | "navigation"
    | "tâches"
    | "objectifs"
    | "métriques"
    | "focus"
    | "notes"
    | "trading";
  keywords?: string[];
  /**
   * Droit requis pour que l'action apparaisse dans la palette. `"trading"` =
   * réservé à l'offre Shale Trade (cf. `lib/features.ts`).
   *
   * ⚠️ Déclaré ACTION PAR ACTION, et non déduit de `category`. Aujourd'hui les
   * deux coïncident : toutes les actions de catégorie « trading » portent le
   * droit. Ce ne fut pas toujours vrai — `trade.presession` était un test de
   * réflexes rangé là, mais ouvert à tous parce qu'il venait du module
   * Benchmark (retiré le 2026-08-25). Garder la déclaration explicite coûte une
   * ligne et évite qu'un futur cas du même genre soit verrouillé par accident.
   */
  requires?: "trading";
  /** Si présent, l'action attend un argument texte (2e étape dans la palette). */
  input?: { placeholder: string };
  run: (ctx: ActionContext, arg?: string) => Promise<string | void> | string | void;
}

/** Événements UI internes (ouvrir un modal depuis une action). */
export function emitUI(name: string) {
  window.dispatchEvent(new CustomEvent(name));
}

/** Normalisation pour la recherche : minuscules, sans accents. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export const ACTIONS: AppAction[] = [
  // — Navigation
  {
    id: "nav.today",
    title: "Aller à Aujourd'hui",
    category: "navigation",
    keywords: ["dashboard", "accueil", "home"],
    run: (ctx) => ctx.navigate("today"),
  },
  {
    id: "nav.tasks",
    title: "Aller aux Tâches",
    category: "navigation",
    keywords: ["taches", "todo"],
    run: (ctx) => ctx.navigate("tasks"),
  },
  {
    id: "nav.timer",
    title: "Aller au Timer",
    category: "navigation",
    keywords: ["chrono", "pomodoro", "focus", "minuteur"],
    run: (ctx) => ctx.navigate("timer"),
  },
  {
    id: "nav.goals",
    title: "Aller aux Objectifs",
    category: "navigation",
    keywords: ["goals"],
    run: (ctx) => ctx.navigate("goals"),
  },
  {
    id: "nav.performance",
    title: "Aller à Performance",
    category: "navigation",
    keywords: ["stats", "graphiques"],
    run: (ctx) => ctx.navigate("performance"),
  },
  {
    id: "nav.finance",
    title: "Aller à Finance",
    category: "navigation",
    keywords: ["finance", "runway", "tresorerie", "patrimoine", "burn", "argent"],
    run: (ctx) => ctx.navigate("finance"),
  },
  {
    id: "nav.notes",
    title: "Aller aux Notes",
    category: "navigation",
    keywords: ["note", "wiki"],
    run: (ctx) => ctx.navigate("notes"),
  },
  {
    id: "nav.knowledge",
    title: "Aller au Savoir",
    category: "navigation",
    keywords: ["savoir", "connaissances", "base", "croquis", "wiki"],
    run: (ctx) => ctx.navigate("knowledge"),
  },
  {
    id: "nav.journal",
    title: "Aller au Journal",
    category: "navigation",
    keywords: ["habitudes", "humeur", "revue"],
    run: (ctx) => ctx.navigate("journal"),
  },
  {
    id: "trade.new",
    title: "Logger un trade",
    category: "trading",
    requires: "trading",
    keywords: ["trade", "journal", "winrate"],
    run: (ctx) => {
      ctx.navigate("trading");
      setTimeout(() => emitUI("sb:new-trade"), 50);
    },
  },
  {
    id: "sizing.open",
    title: "Calculateur de taille de position",
    category: "trading",
    requires: "trading",
    keywords: ["position", "size", "sizing", "lot", "lots", "risque", "levier", "money management"],
    run: (ctx) => ctx.navigate("sizing"),
  },
  {
    id: "note.quick",
    title: "Note rapide",
    category: "notes",
    keywords: ["capture", "idee", "retenir"],
    input: { placeholder: "Contenu de la note…" },
    run: async (ctx, arg) => {
      const text = arg?.trim();
      if (!text) return t("Note vide");
      const title = text.length > 42 ? `${text.slice(0, 42)}…` : text;
      await createNote(title, text);
      await ctx.refresh();
      return t("C'est noté.");
    },
  },
  {
    id: "note.new",
    title: "Nouvelle note (éditeur)",
    category: "notes",
    keywords: ["creer", "rediger", "raccourci", "cmd shift n"],
    run: async (ctx) => {
      const id = await createNote(t("Nouvelle note"), "");
      ctx.navigate("notes");
      await ctx.refresh();
      setTimeout(
        () =>
          window.dispatchEvent(new CustomEvent("sb:open-note", { detail: id })),
        60,
      );
    },
  },
  // — Tâches
  {
    id: "task.quickadd",
    title: "Ajouter une tâche",
    category: "tâches",
    keywords: ["nouvelle", "creer", "add"],
    input: { placeholder: "Nom de la tâche…" },
    run: async (ctx, arg) => {
      const label = arg?.trim();
      if (!label) return t("Nom de tâche vide");
      await createTask({
        label,
        tag: null,
        priority: "medium",
        recurrence: "none",
        goal_id: null,
      });
      await ctx.refresh();
      return t("Tâche « {label} » ajoutée", { label });
    },
  },
  {
    id: "task.new",
    title: "Nouvelle tâche (formulaire complet)",
    category: "tâches",
    keywords: ["recurrence", "priorite", "tag"],
    run: (ctx) => {
      ctx.navigate("tasks");
      // laisser la vue se monter avant d'ouvrir le modal
      setTimeout(() => emitUI("sb:new-task"), 50);
    },
  },
  {
    id: "task.complete",
    title: "Cocher une tâche du jour",
    category: "tâches",
    keywords: ["terminer", "fait", "done", "check"],
    input: { placeholder: "Début du nom de la tâche…" },
    run: async (ctx, arg) => {
      if (!ctx.data) return t("Données non chargées");
      const q = norm(arg ?? "");
      if (!q) return t("Précise le nom de la tâche");
      const list = todayTasks(
        ctx.data.tasks,
        ctx.data.completions,
        todayStr(),
      ).filter((t) => !t.done);
      const match = list.find((t) => norm(t.label).includes(q));
      if (!match) return t("Aucune tâche du jour ne correspond à « {q} »", { q: arg ?? "" });
      await setTaskDone(match.id, todayStr(), true);
      await ctx.refresh();
      return t("« {label} » cochée ✓", { label: match.label });
    },
  },

  // — Focus
  {
    id: "focus.start",
    title: "Lancer un focus (25 min)",
    category: "focus",
    keywords: ["pomodoro", "session", "timer", "concentration"],
    input: { placeholder: "Tâche ou intitulé (optionnel)…" },
    run: async (ctx, arg) => {
      if (!ctx.focus) return "Focus indisponible";
      if (ctx.focus.session) return t("Un focus est déjà en cours");
      const q = norm(arg ?? "");
      let taskId: number | null = null;
      let label = arg?.trim() || "Focus";
      if (q && ctx.data) {
        const match = todayTasks(
          ctx.data.tasks,
          ctx.data.completions,
          todayStr(),
        ).find((t) => norm(t.label).includes(q));
        if (match) {
          taskId = match.id;
          label = match.label;
        }
      }
      await ctx.focus.start({ minutes: 25, taskId, label });
    },
  },
  {
    id: "focus.stop",
    title: "Arrêter le focus en cours",
    category: "focus",
    keywords: ["stop", "terminer", "session"],
    run: async (ctx) => {
      if (!ctx.focus?.session) return t("Aucun focus en cours");
      await ctx.focus.stop();
      return t("Focus arrêté");
    },
  },

  // — Objectifs
  {
    id: "goal.new",
    title: "Nouvel objectif",
    category: "objectifs",
    keywords: ["goal", "creer"],
    run: (ctx) => {
      ctx.navigate("goals");
      setTimeout(() => emitUI("sb:new-goal"), 50);
    },
  },

  // — Métriques
  {
    id: "metric.plus",
    title: "+1 sur une métrique",
    category: "métriques",
    keywords: ["compteur", "incrementer", "metrique"],
    input: { placeholder: "Nom de la métrique…" },
    run: async (ctx, arg) => {
      if (!ctx.data) return t("Données non chargées");
      const q = norm(arg ?? "");
      if (!q) return t("Précise le nom de la métrique");
      const metric = ctx.data.metrics.find((m) => norm(m.name).includes(q));
      if (!metric) return t("Aucune métrique ne correspond à « {q} »", { q: arg ?? "" });
      const today = todayStr();
      const current =
        ctx.data.metricEntries.find(
          (e) => e.metric_id === metric.id && e.date === today,
        )?.value ?? 0;
      await setMetricValue(metric.id, today, current + 1);
      await ctx.refresh();
      return `${metric.name} : ${current + 1}${metric.unit ? ` ${metric.unit}` : ""}`;
    },
  },
];

/**
 * Recherche d'actions pour la palette (titre + mots-clés, sans accents).
 * Le titre est cherché dans les DEUX langues : les libellés stockés restent en
 * français (ce sont les clés de traduction), mais l'utilisateur anglophone tape
 * ce qu'il voit à l'écran.
 */
/**
 * Recherche d'actions pour la palette ⌘K.
 *
 * `hasTrading` retire les actions réservées à Shale Trade : la garde de
 * navigation les intercepterait de toute façon (elle ouvrirait le paywall),
 * mais les lister ferait promettre à la palette ce qu'elle ne peut pas tenir.
 */
export function searchActions(query: string, hasTrading = true): AppAction[] {
  const pool = hasTrading ? ACTIONS : ACTIONS.filter((a) => a.requires !== "trading");
  const q = norm(query.trim());
  if (!q) return pool;
  return pool.map((a) => {
    const title = norm(t(a.title));
    const keywords = [...(a.keywords ?? []), a.title].map(norm).join(" ");
    let score = -1;
    if (title.startsWith(q)) score = 3;
    else if (title.includes(q)) score = 2;
    else if (keywords.includes(q)) score = 1;
    return { action: a, score };
  })
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.action);
}
