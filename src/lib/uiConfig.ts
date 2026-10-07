// Configuration UI personnalisable (page Personnaliser) : ordre/visibilité/libellés
// des modules de la sidebar, widgets du dashboard, identité, fenêtre, densité.
// Persistée en un seul JSON (clé settings "ui.config"). Les défauts sont fusionnés
// au chargement pour rester compatibles quand de nouveaux modules apparaissent.
import { useCallback, useEffect, useState } from "react";
import type { View } from "../components/Sidebar";
import { TRADING_ACTIF } from "./features";
import { IS_IOS } from "./platform";
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
  "calendar",
  "timer",
  "goals",
  "performance",
  "finance",
  "notes",
  "journal",
  "knowledge",
  "trading",
  "market",
  "sizing",
];

export const WIDGET_LABELS: Record<string, string> = {
  // Le trading sorti (2026-09-30), le bandeau n'en montre plus : le libellé suit.
  perf: TRADING_ACTIF ? "Bandeau performance (streak, focus, trading)" : "Bandeau performance (streak, focus)",
  discipline: "Anneau discipline",
  energy: "Énergie restante (charge mentale)",
  timer: "Timer rapide",
  habitudes: "Habitudes à tenir (Journal)",
  position: "Calculateur de position (widget)",
  quicklinks: "Liens rapides",
  tasks: "Tâches du jour",
  goals: "Objectifs en cours",
  calendar: "Calendrier du jour",
  "brief-ia": "Brief du jour (IA, Shale Pro)",
};

const DEFAULTS: UiConfig = {
  modules: MODULE_IDS.map((id) => ({ id, visible: true })),
  dashTop: [
    { id: "perf", visible: true },
    // L'IA de Shale Pro (chantier `ia-pro`). Visible par défaut, mais TodayView
    // ne la rend que si le compte a Pro ET que l'IA et sa famille « brief »
    // sont allumées : pour tous les autres, elle n'occupe aucune place.
    { id: "brief-ia", visible: true },
  ],
  dashLeft: [
    { id: "discipline", visible: true },
    { id: "energy", visible: true },
    { id: "timer", visible: true },
    { id: "habitudes", visible: true },
    { id: "position", visible: true },
    { id: "quicklinks", visible: true },
  ],
  dashRight: [
    { id: "tasks", visible: true },
    { id: "calendar", visible: true },
    { id: "goals", visible: true },
  ],
  window: null,
  zoom: 100,
  brandTitle: "Shale",
  // ⚠️ Vide depuis le 2026-09-30 (trading mis de côté). C'était « trading os » :
  // sous le nom, c'était la première chose qui disait ce que vend Shale — et ça
  // disait « trading ». Le site n'affiche que « Shale », l'app fait pareil.
  brandSubtitle: "",
};

/** L'ancien sous-titre par défaut, recopié dans les réglages de quiconque avait
 *  enregistré Personnaliser avant le 2026-09-30 : `mergeConfig` le remplace par
 *  le défaut du moment, comme s'il n'avait jamais été sauvegardé. */
const ANCIEN_SOUS_TITRE = "trading os";

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

/**
 * ⭐ 2026-10-07 — le graphique « 7 derniers jours » (`week`) a laissé sa place
 * aux habitudes à tenir. Une disposition enregistrée avant cette date porte
 * encore `week` : on le RENOMME à sa place plutôt que de laisser `mergeList`
 * le jeter et rajouter le nouveau widget tout en bas. Et on le rallume — avoir
 * masqué le graphique ne dit rien de ce qu'on veut faire des habitudes.
 */
function sansGraphiqueSemaine(liste: WidgetConfig[] | undefined): WidgetConfig[] | undefined {
  if (!Array.isArray(liste)) return liste;
  const dejaLa = liste.some((w) => w?.id === "habitudes");
  return liste.map((w) => (w?.id === "week" && !dejaLa ? { id: "habitudes", visible: true } : w));
}

export function mergeConfig(raw: unknown): UiConfig {
  const d = defaultUiConfig();
  if (!raw || typeof raw !== "object") return d;
  const c = raw as Partial<UiConfig>;
  return {
    modules: mergeList(c.modules as ModuleConfig[], d.modules),
    dashTop: mergeList(sansGraphiqueSemaine(c.dashTop), d.dashTop),
    dashLeft: mergeList(sansGraphiqueSemaine(c.dashLeft), d.dashLeft),
    dashRight: mergeList(sansGraphiqueSemaine(c.dashRight), d.dashRight),
    window:
      c.window && typeof c.window.width === "number" && typeof c.window.height === "number"
        ? { width: c.window.width, height: c.window.height }
        : null,
    zoom: typeof c.zoom === "number" && c.zoom >= 80 && c.zoom <= 130 ? c.zoom : 100,
    brandTitle: typeof c.brandTitle === "string" && c.brandTitle.trim() ? c.brandTitle : d.brandTitle,
    brandSubtitle:
      typeof c.brandSubtitle === "string" && c.brandSubtitle !== ANCIEN_SOUS_TITRE
        ? c.brandSubtitle
        : d.brandSubtitle,
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

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic Type — le réglage « taille du texte » d'iOS, replié dans la densité.
//
// ⚠️ Un `rem` NE SUIT PAS Dynamic Type dans une WKWebView. Mesuré le
// 2026-08-28 sur le simulateur, taille système poussée à accessibility-XXXL :
// la racine reste à 16 px, donc `11px` et `0.6875rem` rendent tous deux 14 px,
// exactement comme au réglage par défaut. Seul `font: -apple-system-body`
// réagit — 17 px au défaut, 53 px au maximum. C'est pourquoi la migration
// px → rem, à elle seule, n'apportait RIEN ici (`AMELIORATIONS-UI.md` § 1 bis).
//
// D'où ce chemin : on LIT la taille demandée par le système sur un élément
// sonde, et on la traduit en facteur de zoom, qui lui agrandit tout — texte,
// pixels durs compris. Aucune unité à migrer.
// ─────────────────────────────────────────────────────────────────────────────

/** Taille de `-apple-system-body` au réglage iOS par défaut (« large »). */
const DT_REFERENCE = 17;

/**
 * Amortissement. Au maximum d'accessibilité iOS demande ×3,1 — un facteur
 * qu'une interface aussi dense que Shale ne peut pas encaisser telle quelle.
 * On suit la direction du réglage sans en suivre l'amplitude.
 */
const DT_AMORTI = 0.5;

/**
 * Bornes du facteur.
 *
 * ⚠️ Le plafond n'est pas prudent par principe, il est MESURÉ : le `zoom` CSS
 * agrandit aussi les unités de viewport (`100vw` rendu 1170 px dans une fenêtre
 * de 900 — sonde WKWebView du 2026-08-28). Les cinq usages de `vh`/`vw` de
 * l'app sont corrigés par `--zoom-inv`, mais au-delà de +25 % ce sont les
 * mises en page denses elles-mêmes qui cessent d'être lisibles.
 */
const DT_MIN = 0.9;
const DT_MAX = 1.25;

/**
 * Taille de la police « corps » demandée par le système, en pixels — ou `null`
 * quand la question n'a pas de sens ici.
 *
 * ⚠️ Réservé à iOS. Sur macOS `-apple-system-body` vaut 13 px et ne bouge
 * jamais : le mesurer n'apporterait rien et ferait dépendre le bureau d'une
 * référence (17) qui n'est pas la sienne.
 */
export function tailleTexteSysteme(): number | null {
  if (!IS_IOS || typeof document === "undefined" || !document.body) return null;
  if (typeof CSS === "undefined" || !CSS.supports("font", "-apple-system-body")) return null;

  const sonde = document.createElement("span");
  // Hors flux et invisible : la sonde ne doit rien déplacer ni rien peindre.
  sonde.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;font:-apple-system-body";
  document.body.appendChild(sonde);
  const px = parseFloat(getComputedStyle(sonde).fontSize);
  sonde.remove();

  return Number.isFinite(px) && px > 0 ? px : null;
}

/**
 * Facteur de zoom correspondant à une taille système. **Fonction pure.**
 *
 * `null` (bureau, mesure impossible) rend 1 : le réglage de densité reste seul
 * maître, exactement comme avant.
 */
export function facteurDynamicType(taille: number | null): number {
  if (taille === null) return 1;
  const brut = taille / DT_REFERENCE;
  const amorti = 1 + (brut - 1) * DT_AMORTI;
  return Math.min(DT_MAX, Math.max(DT_MIN, amorti));
}

/**
 * Densité : zoom global du document (supporté par WebKit), composé avec la
 * taille de texte demandée par le système.
 *
 * ⚠️ `--zoom-inv` n'est pas décoratif : le `zoom` CSS multiplie AUSSI les
 * unités de viewport, donc un `max-h-[88vh]` déborderait de l'écran. Les rares
 * endroits qui en emploient se multiplient par cette variable pour retrouver
 * la fraction d'écran qu'ils demandaient. Elle vaut 1 par défaut dans
 * `index.css`, pour que ces règles tiennent avant le premier appel ici.
 */
export function applyZoom(zoom: number): void {
  const facteur = (zoom / 100) * facteurDynamicType(tailleTexteSysteme());
  const racine = document.documentElement;
  racine.style.setProperty("zoom", String(facteur));
  racine.style.setProperty("--zoom-inv", String(1 / facteur));
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
