import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import BootScreen from "./components/BootScreen";
import Onboarding, { needsOnboarding } from "./components/auth/Onboarding";
import { useSession } from "./components/auth/AuthGate";
import CommandPalette from "./components/CommandPalette";
import FocusOverlay from "./components/FocusOverlay";
import { noteRapideDemandee, planNotifications } from "./lib/notifications";
import { IS_IOS, useIsPhone } from "./lib/platform";
import MobileNav from "./components/MobileNav";
import Sidebar, { MODULE_LABELS, type View } from "./components/Sidebar";
import { SyncProvider } from "./components/SyncProvider";
import TooltipLayer from "./components/Tooltip";
import UpgradeModal from "./components/UpgradeModal";
import { useEntitlements } from "./lib/entitlements";
import { isTradingView } from "./lib/features";
import { useFocus } from "./lib/useFocus";
import { useMarketBrain } from "./lib/market/useMarketBrain";
import { useScreenTime } from "./lib/mentalLoad";
import { sauvegardeQuotidienne } from "./lib/sauvegardes";
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
const FinanceView = lazy(() => import("./views/FinanceView"));
const NotesView = lazy(() => import("./views/NotesView"));
const JournalView = lazy(() => import("./views/JournalView"));
const KnowledgeView = lazy(() => import("./views/KnowledgeView"));
const TradingView = lazy(() => import("./views/TradingView"));
const MarketBrainView = lazy(() => import("./views/MarketBrainView"));
const SizingView = lazy(() => import("./views/SizingView"));
const AdminView = lazy(() => import("./views/AdminView"));
const ConsoleView = lazy(() => import("./views/ConsoleView"));
const SettingsView = lazy(() => import("./views/SettingsView"));

/**
 * Délai du second relevé de la demande de note rapide, en millisecondes.
 *
 * L'`AppIntent` et le premier rendu de la webview courent en parallèle et rien
 * ne garantit lequel arrive d'abord. 1,5 s laisse largement le temps au second
 * sans faire attendre qui que ce soit : le relevé est une lecture de fichier.
 */
const RELEVE_DIFFERE = 1500;

/**
 * Échec du PREMIER chargement : aucune donnée n'a jamais été lue.
 *
 * Il remplace « Chargement des données… », qui autrement ne s'achèverait
 * jamais. Le message technique est AFFICHÉ, pas seulement journalisé : sur
 * appareil, c'est le seul endroit où il pourra être lu (MOBILE.md §14.1).
 */
function EcranDonneesIllisibles({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
      <p className="text-sm text-text">{t("Les données n'ont pas pu être chargées.")}</p>
      <p className="max-w-md break-words font-mono text-xs text-text-dim">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="pill border border-blue/40 bg-blue/10 px-4 py-1.5 text-xs font-semibold text-blue transition-colors hover:bg-blue/20"
      >
        {t("Réessayer")}
      </button>
    </div>
  );
}

/**
 * Un rafraîchissement a échoué, mais des données avaient déjà été lues.
 *
 * L'écran reste peuplé : vider l'app entière pour une lecture ratée serait pire
 * que le défaut qu'on corrige. L'échec doit malgré tout se VOIR — sans ce
 * bandeau, une tâche cochée qui ne remonte pas ressemble à un clic perdu.
 *
 * `fixed` sous l'encoche plutôt que dans le flux : la réserve de zone sûre des
 * quatorze vues est mesurée (MOBILE.md §12), on ne la déplace pas pour un cas
 * d'erreur.
 */
function BandeauLecturePerimee({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="fixed inset-x-0 z-[80] flex justify-center px-4"
      style={{ top: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      <div className="card flex items-center gap-3 bg-surface px-4 py-2 text-[12px] text-text-dim">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-yellow" />
        {t("Les données affichées datent de la dernière lecture réussie.")}
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
        >
          {t("Réessayer")}
        </button>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<View>("today");
  const [data, setData] = useState<AppData | null>(null);
  const [erreurDonnees, setErreurDonnees] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState(needsOnboarding);
  const snapshotDone = useRef(false);

  // ⚠️ Le `catch` n'est pas décoratif — il répare un défaut mesuré.
  // Sans lui, un rejet de `fetchAll` partait en rejet NON TRAITÉ et `data`
  // restait `null` pour toujours : « Chargement… » sans message, sans bouton,
  // sans fin. Sur iPhone, où il n'y a aucune console à consulter
  // (MOBILE.md §14.1), le défaut était indiagnosticable.
  //
  // `refresh` est appelé depuis une douzaine d'endroits (les vues après chaque
  // écriture, la palette ⌘K, `useFocus`, l'événement `sb:data-changed`, le
  // snapshot d'objectifs) et plusieurs font `await refresh()` : il ne doit
  // JAMAIS rejeter. L'échec se lit à l'écran, il ne remonte pas aux appelants.
  const refresh = useCallback(async () => {
    try {
      setData(await fetchAll(addDays(todayStr(), -400)));
      setErreurDonnees(null);
    } catch (e) {
      setErreurDonnees(e instanceof Error ? e.message : String(e));
    }
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
  const isPhone = useIsPhone();
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

  // ── Rappels : (re)programmation à chaque passage en arrière-plan ─────────
  // Sur le bureau, `scheduler.rs` tourne et cet appel ne fait que rendre un
  // diagnostic. Sur iOS il est ESSENTIEL : le système suspend le processus dès
  // que l'app quitte l'écran, la boucle Rust s'arrête, et plus rien ne peut
  // décider quoi que ce soit. Ce qui n'a pas été déposé AVANT ne partira pas.
  //
  // `visibilitychange` plutôt que `pagehide` : WKWebView le déclenche au
  // passage en arrière-plan, alors que `pagehide` ne vient qu'à la destruction
  // de la page — trop tard, et pas garanti si le système tue l'app.
  // On garde quand même `pagehide` en second filet, il ne coûte rien.
  //
  // `hasTrading` en dépendance : le rappel de briefing de marché n'a de sens
  // qu'avec l'offre Trade, et un compte rétrogradé doit voir ses échéances
  // partir au dépôt suivant plutôt qu'au prochain lancement.
  useEffect(() => {
    const replanifier = () => void planNotifications(hasTrading).catch(() => null);
    replanifier(); // au démarrage : purge les échéances devenues fausses
    const surVisibilite = () => {
      if (document.visibilityState === "hidden") replanifier();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    window.addEventListener("pagehide", replanifier);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      window.removeEventListener("pagehide", replanifier);
    };
  }, [hasTrading]);

  useEffect(() => {
    refresh();
    loadTheme();
    // Copie datée de la base, au plus une par jour. AU LANCEMENT et non à la
    // fermeture : une app qu'on force à quitter ne sauvegarderait jamais.
    void sauvegardeQuotidienne();
  }, [refresh]);

  // Densité (zoom global) pilotée par la page Personnaliser, composée avec la
  // taille de texte demandée par le système (Dynamic Type, iOS).
  //
  // ⚠️ iOS n'émet AUCUN événement quand on change la taille du texte dans ses
  // Réglages — l'utilisateur quitte Shale, règle, et revient. Le seul signal
  // exploitable est donc le retour au premier plan, d'où `visibilitychange` ;
  // `resize` couvre la rotation et le redimensionnement d'une fenêtre de
  // bureau. `applyZoom()` remesure à chaque appel et n'écrit que deux
  // propriétés : le rappeler ne coûte rien.
  useEffect(() => {
    const appliquer = () => applyZoom(ui.config.zoom);
    appliquer();
    const auRetour = () => {
      if (document.visibilityState === "visible") appliquer();
    };
    document.addEventListener("visibilitychange", auRetour);
    window.addEventListener("resize", appliquer);
    return () => {
      document.removeEventListener("visibilitychange", auRetour);
      window.removeEventListener("resize", appliquer);
    };
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

  // Le geste « nouvelle note », partagé par ⌘⇧N (bureau) et par l'`AppIntent`
  // du bouton Action (iPhone) : deux déclencheurs, un seul comportement, sinon
  // les deux surfaces divergeraient à la première retouche.
  const ouvrirNoteRapide = useCallback(async () => {
    const id = await createNote(t("Nouvelle note"), "");
    setView("notes");
    await refresh();
    // laisse NotesView se monter avant de demander l'ouverture
    setTimeout(
      () => window.dispatchEvent(new CustomEvent("sb:open-note", { detail: id })),
      60,
    );
  }, [refresh]);

  // Raccourci note : ⌘⇧N (Ctrl+⇧N) → crée une note et l'ouvre dans Notes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        void ouvrirNoteRapide();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvrirNoteRapide]);

  // ── Le bouton Action (et Siri, et Spotlight) ────────────────────────────
  // L'`AppIntent` Swift n'a aucun moyen d'appeler la webview : il pose un
  // fichier dans le conteneur de l'app, qu'on relève ici.
  //
  // Trois relevés, et chacun couvre un cas que les autres ratent :
  //   • au montage — le cas normal, app lancée PAR le geste ;
  //   • à `RELEVE_DIFFERE` — l'intent peut poser sa demande APRÈS le premier
  //     rendu de la webview, l'ordre entre les deux n'étant garanti nulle part ;
  //   • au retour au premier plan — geste fait alors que Shale dormait.
  //
  // Aucune scrutation : le Rust jette toute demande de plus de deux minutes,
  // donc une demande faite app déjà à l'écran est PERDUE plutôt que rejouée des
  // heures plus tard. C'est le bon sens du compromis — une note qui s'ouvre
  // toute seule serait pire qu'un geste à refaire.
  useEffect(() => {
    if (!isTauri || !IS_IOS) return;
    const relever = async () => {
      if (await noteRapideDemandee()) await ouvrirNoteRapide();
    };
    const tenter = () => void relever().catch(() => null);
    tenter();
    const differe = window.setTimeout(tenter, RELEVE_DIFFERE);
    const surVisibilite = () => {
      if (document.visibilityState === "visible") tenter();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    return () => {
      window.clearTimeout(differe);
      document.removeEventListener("visibilitychange", surVisibilite);
    };
  }, [ouvrirNoteRapide]);

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
      {data && erreurDonnees && <BandeauLecturePerimee onRetry={refresh} />}
      <CommandPalette ctx={{ navigate, refresh, data, focus }} hasTrading={hasTrading} />
      {/* Barre latérale sur bureau et tablette, barre d'onglets sur téléphone.
          L'une OU l'autre, jamais les deux : `useIsPhone()` exige un écran
          étroit ET un pointeur grossier, donc un Mac en Split View garde sa
          barre latérale (déjà repliée en icônes par le chantier responsive). */}
      {isPhone ? (
        <MobileNav
          view={view}
          onNavigate={navigate}
          isAdmin={isAdmin}
          badges={{ market: hasTrading && market.badge, trading: hasTrading && liveOpenCount > 0 }}
          config={ui.config}
          hasTrading={hasTrading}
          onLocked={setPaywallFor}
        />
      ) : (
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
      )}
      {paywallFor && (
        <UpgradeModal
          moduleLabel={MODULE_LABELS[paywallFor]}
          onClose={() => setPaywallFor(null)}
        />
      )}
      {/* ⚠️ LA RÉSERVE DU HAUT EST SUR CE CONTENEUR-CI, PAS SUR LE DÉFILANT.
          C'est la correction du 2026-08-27 à midi, et elle vient d'une capture,
          pas d'un raisonnement.

          Un `padding-top` posé À L'INTÉRIEUR d'une zone défilante DÉFILE avec
          elle. Au repos l'en-tête tombait bien sous l'horloge — c'est ce qu'on
          avait vérifié le matin, et c'est ce qui a fait croire l'affaire
          réglée. Mais dès qu'on faisait défiler, le contenu remontait SOUS la
          Dynamic Island : dans Personnaliser, le titre « MODULES DE LA BARRE »
          disparaissait derrière l'îlot et l'heure système se superposait au
          texte.

          Sur ce conteneur, qui ne défile pas, la réserve devient le BORD HAUT
          de la fenêtre de défilement : plus rien ne peut passer dessous.

          La réserve du BAS reste en revanche sur le défilant : la barre
          d'onglets est en `fixed` par-dessus, et c'est de l'espace qu'on veut
          pouvoir atteindre en défilant, pas une bordure.

          ⚠️ LES CÔTÉS COMPTENT AUSSI, et ils manquaient. En PAYSAGE, l'encoche
          et la Dynamic Island ne sont plus en haut : elles sont sur un côté, et
          `safe-area-inset-top` y vaut ~0 pendant que `-left` ou `-right` vaut
          ~59 pt. Sans ces deux réserves, le bord de l'écran mangeait le contenu
          — constaté à l'écran le 2026-08-28. Elles vont sur le MÊME conteneur
          non défilant que la réserve du haut, pour la même raison. */}
      <div
        className="relative z-10 flex min-w-0 flex-1 flex-col"
        style={
          isPhone
            ? {
                paddingTop: "env(safe-area-inset-top)",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
              }
            : undefined
        }
      >
        <div
          key={view}
          className="animate-fade-up flex-1 overflow-y-auto"
          // Sur téléphone, la barre d'onglets est en `fixed` : sans cette
          // réserve, le bas de chaque vue passerait DESSOUS et deviendrait
          // inatteignable — la dernière tâche d'une liste, le dernier bouton
          // d'un formulaire. `env(safe-area-inset-bottom)` couvre en plus la
          // barre d'accueil des iPhone sans bouton.
          style={
            isPhone
              ? { paddingBottom: "calc(env(safe-area-inset-bottom) + 4.25rem)" }
              : undefined
          }
        >
          {/* ⚠️ Ces deux attentes portaient le MÊME texte, « Chargement… », et
              les distinguer sur une capture d'iPhone a coûté un cycle de
              reconstruction complet (MOBILE.md §14.3). Elles ne disent plus la
              même chose : le repli de `Suspense` parle du MODULE (un chunk
              `lazy()` en vol), l'autre parle des DONNÉES (`fetchAll`). */}
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-dim">{t("Ouverture du module…")}</p>
              </div>
            }
          >
          {!data ? (
            erreurDonnees ? (
              <EcranDonneesIllisibles message={erreurDonnees} onRetry={refresh} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-text-dim">{t("Chargement des données…")}</p>
              </div>
            )
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
          ) : view === "finance" ? (
            <FinanceView data={data} />
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
