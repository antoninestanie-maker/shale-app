import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import BootScreen from "./components/BootScreen";
import Onboarding, { needsOnboarding } from "./components/auth/Onboarding";
import { useSession } from "./components/auth/AuthGate";
import CommandPalette from "./components/CommandPalette";
import FocusOverlay from "./components/FocusOverlay";
import Sidebar, { MODULE_LABELS, type View } from "./components/Sidebar";
import { SyncProvider } from "./components/SyncProvider";
import TooltipLayer from "./components/Tooltip";
import UpgradeModal from "./components/UpgradeModal";
import { useEntitlements } from "./lib/entitlements";
import { isTradingView } from "./lib/features";
import { useFocus } from "./lib/useFocus";
import { useMarketBrain } from "./lib/market/useMarketBrain";
import { useScreenTime } from "./lib/mentalLoad";
import { loadTheme } from "./lib/theme";
import { applyZoom, useUiConfig } from "./lib/uiConfig";
import { addDays, effectiveProgress, todayStr } from "./lib/logic";
import {
  createNote,
  fetchAll,
  fetchLivePositions,
  isTauri,
  snapshotGoals,
} from "./lib/repo";
import type { AppData } from "./lib/types";

import { t } from "./lib/i18n";
// Vues chargées à la demande (code-splitting) : sortent recharts et le code de chaque
// vue du bundle de démarrage. Chaque vue devient son propre chunk, chargé au 1er affichage.
const TodayView = lazy(() => import("./views/TodayView"));
const TasksView = lazy(() => import("./views/TasksView"));
const TimerView = lazy(() => import("./views/TimerView"));
const GoalsView = lazy(() => import("./views/GoalsView"));
const PerformanceView = lazy(() => import("./views/PerformanceView"));
const BenchmarkView = lazy(() => import("./views/BenchmarkView"));
const NotesView = lazy(() => import("./views/NotesView"));
const JournalView = lazy(() => import("./views/JournalView"));
const KnowledgeView = lazy(() => import("./views/KnowledgeView"));
const TradingView = lazy(() => import("./views/TradingView"));
const MarketBrainView = lazy(() => import("./views/MarketBrainView"));
const SizingView = lazy(() => import("./views/SizingView"));
const AdminView = lazy(() => import("./views/AdminView"));
const ConsoleView = lazy(() => import("./views/ConsoleView"));
const SettingsView = lazy(() => import("./views/SettingsView"));

function App() {
  const [view, setView] = useState<View>("today");
  const [data, setData] = useState<AppData | null>(null);
  const [onboarding, setOnboarding] = useState(needsOnboarding);
  const snapshotDone = useRef(false);

  const refresh = useCallback(async () => {
    setData(await fetchAll(addDays(todayStr(), -400)));
  }, []);

  const { isAdmin } = useSession();
  const { hasTrading } = useEntitlements();

  // ── Garde de navigation ───────────────────────────────────────────────────
  // Le gating N'EST PAS qu'un masquage de la sidebar : `navigate` est le seul
  // chemin vers un changement de vue (sidebar, palette ⌘K, poignées ↗ des
  // widgets, boutons « Trader » de la vue Position, actions du journal). Toute
  // tentative d'aller sur un module trading sans l'offre ouvre le paywall.
  // `setView` reste privé au composant : ne jamais le passer à un enfant.
  const [paywallFor, setPaywallFor] = useState<View | null>(null);

  const navigate = useCallback(
    (v: View) => {
      if (!hasTrading && isTradingView(v)) {
        setPaywallFor(v);
        return;
      }
      setView(v);
    },
    [hasTrading],
  );

  // Filet : l'offre peut changer PENDANT la session (fin d'essai détectée par
  // `recheck`, rétrogradation). Si la vue courante devient verrouillée, on
  // retombe sur l'accueil au lieu de laisser un module ouvert sans droit.
  useEffect(() => {
    if (!hasTrading && isTradingView(view)) setView("today");
  }, [hasTrading, view]);

  const focus = useFocus(refresh);
  const market = useMarketBrain();
  const ui = useUiConfig();
  useScreenTime(); // accumule le temps d'écran du jour (jauge de charge mentale)
  const windowSized = useRef(false);

  // Badge sidebar "Trading" : des positions attendent leur dénouement dans le tracker
  const [liveOpenCount, setLiveOpenCount] = useState(0);
  useEffect(() => {
    const sync = () =>
      fetchLivePositions()
        .then((l) => setLiveOpenCount(l.length))
        .catch(() => {});
    sync();
    window.addEventListener("sb:live-positions", sync);
    return () => window.removeEventListener("sb:live-positions", sync);
  }, []);

  useEffect(() => {
    refresh();
    loadTheme();
  }, [refresh]);

  // Densité (zoom global) pilotée par la page Personnaliser.
  useEffect(() => {
    applyZoom(ui.config.zoom);
  }, [ui.config.zoom]);

  // Taille de fenêtre par défaut : appliquée une fois, au premier chargement de la config.
  useEffect(() => {
    if (!ui.ready || windowSized.current || !isTauri || !ui.config.window) return;
    windowSized.current = true;
    const { width, height } = ui.config.window;
    import("@tauri-apps/api/window").then(({ getCurrentWindow, LogicalSize }) =>
      getCurrentWindow().setSize(new LogicalSize(width, height)).catch(() => {}),
    );
  }, [ui.ready, ui.config.window]);

  // Raccourci note : ⌘⇧N (Ctrl+⇧N) → crée une note et l'ouvre dans Notes
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        const id = await createNote(t("Nouvelle note"), "");
        setView("notes");
        await refresh();
        // laisse NotesView se monter avant de demander l'ouverture
        setTimeout(
          () => window.dispatchEvent(new CustomEvent("sb:open-note", { detail: id })),
          60,
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [refresh]);

  // La quick capture (fenêtre séparée) signale ses ajouts via un événement Tauri
  useEffect(() => {
    if (!isTauri) return;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen("sb:data-changed", () => refresh()).then((u) => {
        unlisten = u;
      }),
    );
    return () => unlisten?.();
  }, [refresh]);

  // Snapshot quotidien de la progression des objectifs (alimente le graphique Performance)
  useEffect(() => {
    if (!data || snapshotDone.current) return;
    snapshotDone.current = true;
    const { goals, tasks, completions } = data;
    if (goals.length === 0) return;
    snapshotGoals(
      todayStr(),
      goals.map((g) => ({
        goal_id: g.id,
        pct: effectiveProgress(g, goals, tasks, completions),
      })),
    ).then(refresh);
  }, [data, refresh]);

  return (
    /* La synchronisation est montée ICI, sous `AuthGate` (elle a besoin de la
       session) et au-dessus de tout le reste : l'indicateur vit dans la sidebar,
       les commandes dans Réglages — une vue chargée en `lazy`. */
    <SyncProvider>
    <div className="relative flex h-screen bg-bg">
      <BootScreen />
      {onboarding && <Onboarding onDone={() => setOnboarding(false)} />}
      <div className="hud-bg" aria-hidden />
      <FocusOverlay focus={focus} />
      {/* Info-bulles : une seule instance pour toute l'app (déclenchée par
          l'attribut `data-tip` posé sur n'importe quel bouton/onglet). */}
      <TooltipLayer />
      <CommandPalette ctx={{ navigate, refresh, data, focus }} hasTrading={hasTrading} />
      <Sidebar
        view={view}
        onNavigate={navigate}
        demoMode={!isTauri}
        isAdmin={isAdmin}
        badges={{ market: hasTrading && market.badge, trading: hasTrading && liveOpenCount > 0 }}
        config={ui.config}
        hasTrading={hasTrading}
        onLocked={setPaywallFor}
      />
      {paywallFor && (
        <UpgradeModal
          moduleLabel={MODULE_LABELS[paywallFor]}
          onClose={() => setPaywallFor(null)}
        />
      )}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <div key={view} className="animate-fade-up flex-1 overflow-y-auto">
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-dim">Chargement…</p>
              </div>
            }
          >
          {!data ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-text-dim">Chargement…</p>
            </div>
          ) : view === "today" ? (
            <TodayView
              data={data}
              refresh={refresh}
              focus={focus}
              navigate={navigate}
              config={ui.config}
            />
          ) : view === "tasks" ? (
            <TasksView data={data} refresh={refresh} />
          ) : view === "timer" ? (
            <TimerView data={data} focus={focus} />
          ) : view === "goals" ? (
            <GoalsView data={data} refresh={refresh} />
          ) : view === "performance" ? (
            <PerformanceView data={data} refresh={refresh} />
          ) : view === "benchmark" ? (
            <BenchmarkView data={data} refresh={refresh} />
          ) : view === "notes" ? (
            <NotesView data={data} refresh={refresh} />
          ) : view === "journal" ? (
            <JournalView data={data} refresh={refresh} navigate={navigate} />
          ) : view === "knowledge" ? (
            <KnowledgeView />
          ) : view === "trading" ? (
            <TradingView data={data} refresh={refresh} />
          ) : view === "market" ? (
            <MarketBrainView market={market} />
          ) : view === "sizing" ? (
            <SizingView navigate={navigate} />
          ) : view === "admin" ? (
            <AdminView config={ui.config} save={ui.save} />
          ) : view === "console" ? (
            <ConsoleView />
          ) : (
            <SettingsView />
          )}
          </Suspense>
        </div>
      </div>
    </div>
    </SyncProvider>
  );
}

export default App;
