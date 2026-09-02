import { Suspense, lazy, useCallback, useMemo, type ReactNode } from "react";
import DisciplineRing from "../components/DisciplineRing";
import GoalsPreview from "../components/GoalsPreview";
import PerfStrip from "../components/PerfStrip";
import PositionSizeWidget from "../components/PositionSizeWidget";
import QuickLinks from "../components/QuickLinks";
import TimerCard from "../components/TimerCard";
import TodayTasks from "../components/TodayTasks";
import CalendarCard from "../components/CalendarCard";
import MentalLoadGauge from "../components/MentalLoadGauge";
// recharts sorti du bundle de démarrage : chargé quand le widget "7 derniers jours" s'affiche.
const WeekChart = lazy(() => import("../components/WeekChart"));
import {
  computeStreak,
  pctOfList,
  todayStr,
  todayTasks,
  weekStats,
} from "../lib/logic";
import { createTask, setTaskDone } from "../lib/repo";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import type { FocusController } from "../lib/useFocus";
import type { AppData, TodayTask } from "../lib/types";
import type { View } from "../components/Sidebar";
import { WIDGET_LABELS, type UiConfig, type WidgetConfig } from "../lib/uiConfig";
import { useEntitlements } from "../lib/entitlements";
import { isTradingWidget } from "../lib/features";

import { localeTag, t } from "../lib/i18n";
/** Largeur par défaut (en colonnes /12) de chaque widget du dashboard. */
const WIDGET_DEFAULT_W: Record<string, number> = {
  perf: 12,
  discipline: 4,
  energy: 4,
  timer: 4,
  week: 4,
  position: 4,
  quicklinks: 4,
  tasks: 8,
  goals: 8,
  calendar: 8,
};
/** Largeur MINIMALE (colonnes /12) : sous ce seuil le contenu se chevaucherait.
    Calé sur ce que chaque widget peut afficher lisiblement. Le moteur de grille
    peut la REMONTER automatiquement si la fenêtre est étroite (plancher en px). */
const WIDGET_MIN_W: Record<string, number> = {
  perf: 4,
  discipline: 3,
  energy: 3,
  timer: 3,
  week: 3,
  position: 4,
  quicklinks: 3,
  tasks: 4,
  goals: 4,
  calendar: 4,
};

/** Hauteur MINIMALE (px) des widgets dont le contenu sait défiler : sous cette
    valeur la carte n'aurait plus rien de lisible (en-tête + une ligne). */
const WIDGET_MIN_H: Record<string, number> = {
  calendar: 176,
  tasks: 200,
  goals: 176,
  quicklinks: 136,
};

/** Vue complète associée à chaque widget (poignée ↗ discrète du panneau). */
const WIDGET_TARGET: Record<string, View> = {
  perf: "performance",
  discipline: "tasks",
  energy: "settings",
  timer: "timer",
  week: "performance",
  position: "sizing",
  tasks: "tasks",
  goals: "goals",
  calendar: "calendar",
};

/** Entrelace deux listes (col. gauche / droite) pour un empilage dense équilibré. */
function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== undefined) out.push(a[i]);
    if (b[i] !== undefined) out.push(b[i]);
  }
  return out;
}

interface Props {
  data: AppData;
  refresh: () => Promise<void>;
  focus?: FocusController;
  navigate?: (view: View) => void;
  config: UiConfig;
}

export default function TodayView({ data, refresh, focus, navigate, config }: Props) {
  const today = todayStr();
  const { hasTrading } = useEntitlements();

  const derived = useMemo(() => {
    const list = todayTasks(data.tasks, data.completions, today);
    const pct = pctOfList(list);
    return {
      list,
      pct,
      streak: computeStreak(data.tasks, data.completions, today, pct),
      week: weekStats(data.tasks, data.completions, today, list),
    };
  }, [data, today]);

  const handleToggle = useCallback(
    async (task: TodayTask) => {
      await setTaskDone(task.id, todayStr(), !task.done);
      await refresh();
    },
    [refresh],
  );

  const handleAdd = useCallback(
    async (label: string) => {
      await createTask({
        label,
        tag: null,
        priority: "medium",
        recurrence: "none",
        goal_id: null,
      });
      await refresh();
    },
    [refresh],
  );

  // Registre des widgets : la page Personnaliser pilote ordre et visibilité.
  const widgets: Record<string, () => ReactNode> = {
    perf: () => (
      <PerfStrip key="perf" data={data} week={derived.week} streak={derived.streak} />
    ),
    discipline: () => (
      <section key="discipline" className="card p-5">
        <h2 className="mb-3 hud-label text-center">{t("Discipline")}</h2>
        {/* L'anneau est CENTRÉ dans l'espace disponible : agrandir la carte le
            recentre au lieu de laisser un vide sous lui. */}
        <div className="panel-grow flex items-center justify-center">
          <DisciplineRing
            pct={derived.pct}
            streak={derived.streak}
            done={derived.list.filter((t) => t.done).length}
            total={derived.list.length}
          />
        </div>
      </section>
    ),
    energy: () => (
      <section key="energy" className="card p-5">
        <h2 className="mb-3 hud-label">{t("Énergie restante")}</h2>
        <MentalLoadGauge data={data} />
      </section>
    ),
    timer: () => (focus ? <TimerCard key="timer" data={data} focus={focus} /> : null),
    week: () => (
      <section key="week" className="card p-5">
        <h2 className="mb-3 hud-label">{t("7 derniers jours")}</h2>
        {/* panel-chart : hauteur définie ET extensible → le graphique grandit
            réellement avec le widget (au lieu d'un vide de 130px de haut). */}
        <div className="panel-chart">
          <Suspense fallback={<div className="h-full" />}>
            <WeekChart stats={derived.week} />
          </Suspense>
        </div>
      </section>
    ),
    position: () => <PositionSizeWidget key="position" />,
    quicklinks: () => (
      <section key="quicklinks" className="card p-5">
        <h2 className="mb-3 hud-label">{t("Liens rapides")}</h2>
        <QuickLinks links={data.quickLinks} refresh={refresh} />
      </section>
    ),
    tasks: () => (
      <section key="tasks" className="card p-5">
        <h2 className="mb-3 hud-label">{t("Tâches du jour")}</h2>
        <TodayTasks
          tasks={derived.list}
          tags={data.tags}
          goals={data.goals}
          onToggle={handleToggle}
          onAdd={handleAdd}
          onFocus={
            focus && !focus.session
              ? (task) =>
                  focus.start({ minutes: 25, taskId: task.id, label: task.label })
              : undefined
          }
        />
      </section>
    ),
    goals: () => (
      <section key="goals" className="card p-5">
        <h2 className="mb-3 hud-label">{t("Objectifs en cours")}</h2>
        <GoalsPreview data={data} />
      </section>
    ),
    calendar: () => <CalendarCard key="calendar" data={data} />,
  };

  // Ordre d'affichage dans la grille : bannières pleine largeur, puis les widgets des
  // deux colonnes entrelacés (le placement dense reconstitue l'empilage gauche/droite).
  // Sans l'offre Trade, les widgets trading sortent de la GRILLE, pas seulement
  // de l'écran : un panneau simplement masqué réapparaîtrait dans les chips
  // « + <titre> » sous la grille, avec un bouton pour le restaurer.
  const visible = (list: WidgetConfig[]) =>
    list.filter((w) => w.visible && (hasTrading || !isTradingWidget(w.id)));
  const ordered: WidgetConfig[] = [
    ...visible(config.dashTop),
    ...interleave(visible(config.dashLeft), visible(config.dashRight)),
  ];

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header>
        <p className="hud-label">
          {new Date().toLocaleDateString(localeTag(), {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </p>
        <h1 className="mt-2 text-[32px] text-text">{t("Aujourd'hui")}</h1>
      </header>

      <ResizableGrid gridId="today" className="mt-4">
        {ordered.map((w) => {
          const node = widgets[w.id]?.();
          if (!node) return null;
          return (
            <ResizablePanel
              key={w.id}
              id={w.id}
              title={t(WIDGET_LABELS[w.id] ?? w.id)}
              defaultW={WIDGET_DEFAULT_W[w.id] ?? 6}
              minW={WIDGET_MIN_W[w.id] ?? 2}
              minH={WIDGET_MIN_H[w.id]}
              onOpen={
                navigate && WIDGET_TARGET[w.id]
                  ? () => navigate(WIDGET_TARGET[w.id])
                  : undefined
              }
            >
              {node}
            </ResizablePanel>
          );
        })}
      </ResizableGrid>
    </div>
  );
}
