// Configuration UI personnalisable (page Personnaliser) : ordre/visibilité/libellés
// des modules de la sidebar, widgets du dashboard, identité, fenêtre, densité.
// Persistée en un seul JSON (clé settings "ui.config"). Les défauts sont fusionnés
// au chargement pour rester compatibles quand de nouveaux modules apparaissent.
import { useCallback, useEffect, useState } from "react";
import type { View } from "../components/Sidebar";
import { getSetting, setSetting } from "./repo";

export interface ModuleConfig {
  id: View;
  visible: boolean;
  /** Libellé personnalisé (sinon libellé par défaut du module). */
  label?: string;
}

export interface WidgetConfig {
  id: string;
  visible: boolean;
}

export interface UiConfig {
  /** Modules de la sidebar, dans l'ordre d'affichage (hors Personnaliser/Réglages). */
  modules: ModuleConfig[];
  /** Dashboard t("Aujourd'hui") : bandeaux pleine largeur, colonne gauche, colonne droite. */
  dashTop: WidgetConfig[];
  dashLeft: WidgetConfig[];
  dashRight: WidgetConfig[];
  /** Taille de fenêtre appliquée au lancement (null = ne pas toucher). */
  window: { width: number; height: number } | null;
  /** Densité de l'interface en % (zoom global). */
  zoom: number;
  brandTitle: string;
  brandSubtitle: string;
}

/** Modules configurables (Personnaliser et Réglages restent fixes en bas). */
export const MODULE_IDS: View[] = [
  "today",
  "tasks",
  "timer",
  "goals",
  "performance",
  "benchmark",
  "notes",
  "journal",
  "knowledge",
  "trading",
  "market",
  "sizing",
];

export const WIDGET_LABELS: Record<string, string> = {
  presession: "Test de réaction pré-session",
  perf: "Bandeau performance (streak, focus, trading)",
  discipline: "Anneau discipline",
  energy: "Énergie restante (charge mentale)",
  timer: "Timer rapide",
  week: "Graphique 7 jours",
  position: "Calculateur de position (widget)",
  quicklinks: "Liens rapides",
  tasks: "Tâches du jour",
  goals: "Objectifs en cours",
};

const DEFAULTS: UiConfig = {
  modules: MODULE_IDS.map((id) => ({ id, visible: true })),
  dashTop: [
    { id: "presession", visible: true },
    { id: "perf", visible: true },
  ],
  dashLeft: [
    { id: "discipline", visible: true },
    { id: "energy", visible: true },
    { id: "timer", visible: true },
    { id: "week", visible: true },
    { id: "position", visible: true },
    { id: "quicklinks", visible: true },
  ],
  dashRight: [
    { id: "tasks", visible: true },
    { id: "goals", visible: true },
  ],
  window: null,
  zoom: 100,
  brandTitle: "Shale",
  brandSubtitle: "trading os",
};

export function defaultUiConfig(): UiConfig {
  return JSON.parse(JSON.stringify(DEFAULTS)) as UiConfig;
}

/** Fusionne une liste sauvegardée avec les défauts : garde l'ordre/les réglages
 * connus, ignore les ids disparus, ajoute les nouveaux à la fin. */
function mergeList<T extends { id: string }>(saved: T[] | undefined, defs: T[]): T[] {
  if (!Array.isArray(saved)) return defs;
  const known = new Set(defs.map((d) => d.id));
  const kept = saved.filter((s) => s && known.has(s.id));
  const seen = new Set(kept.map((s) => s.id));
  return [...kept, ...defs.filter((d) => !seen.has(d.id))];
}

function mergeConfig(raw: unknown): UiConfig {
  const d = defaultUiConfig();
  if (!raw || typeof raw !== "object") return d;
  const c = raw as Partial<UiConfig>;
  return {
    modules: mergeList(c.modules as ModuleConfig[], d.modules),
    dashTop: mergeList(c.dashTop, d.dashTop),
    dashLeft: mergeList(c.dashLeft, d.dashLeft),
    dashRight: mergeList(c.dashRight, d.dashRight),
    window:
      c.window && typeof c.window.width === "number" && typeof c.window.height === "number"
        ? { width: c.window.width, height: c.window.height }
        : null,
    zoom: typeof c.zoom === "number" && c.zoom >= 80 && c.zoom <= 130 ? c.zoom : 100,
    brandTitle: typeof c.brandTitle === "string" && c.brandTitle.trim() ? c.brandTitle : d.brandTitle,
    brandSubtitle: typeof c.brandSubtitle === "string" ? c.brandSubtitle : d.brandSubtitle,
  };
}

export async function loadUiConfig(): Promise<UiConfig> {
  try {
    const raw = await getSetting("ui.config");
    return mergeConfig(raw ? JSON.parse(raw) : null);
  } catch {
    return defaultUiConfig();
  }
}

const EVENT = "sb:ui-config";

export async function saveUiConfig(config: UiConfig): Promise<void> {
  await setSetting("ui.config", JSON.stringify(config)).catch(() => {});
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Densité : zoom global du document (supporté par WebKit). */
export function applyZoom(zoom: number): void {
  document.documentElement.style.setProperty("zoom", String(zoom / 100));
}

/**
 * Facteur de zoom courant. Indispensable à tout élément flottant positionné à
 * partir d'un `getBoundingClientRect` : celui-ci renvoie des pixels ÉCRAN,
 * alors qu'un `position: fixed` sous un `<html>` zoomé raisonne en pixels
 * LOCAUX. On calcule en écran, puis on divise au moment d'écrire la position.
 */
export function zoomFactor(): number {
  const z = parseFloat(document.documentElement.style.zoom || "1");
  return Number.isFinite(z) && z > 0 ? z : 1;
}

/** Hook partagé : chargement + resynchronisation quand la page admin sauvegarde. */
export function useUiConfig() {
  const [config, setConfig] = useState<UiConfig>(defaultUiConfig);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      loadUiConfig().then((c) => {
        if (!alive) return;
        setConfig(c);
        setReady(true);
      });
    load();
    window.addEventListener(EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(EVENT, load);
    };
  }, []);

  const save = useCallback(async (c: UiConfig) => {
    setConfig(c);
    await saveUiConfig(c);
  }, []);

  return { config, ready, save };
}
