import { useCallback, useMemo, type ReactNode } from "react";
import DisciplineRing from "../components/DisciplineRing";
import GoalsPreview from "../components/GoalsPreview";
import HabitudesDuJour from "../components/HabitudesDuJour";
import PerfStrip from "../components/PerfStrip";
import PositionSizeWidget from "../components/PositionSizeWidget";
import QuickLinks from "../components/QuickLinks";
import TimerCard from "../components/TimerCard";
import TodayTasks from "../components/TodayTasks";
import CalendarCard from "../components/CalendarCard";
import {
  computeStreak,
  statDeListe,
  todayStr,
  todayTasks,
  weekStats,
} from "../lib/logic";
import { basculerTache, createTask } from "../lib/repo";
import { planificationDeSaisie } from "../lib/taches";
import { afficherToast } from "../lib/toast";
import { titreCourt } from "../components/corbeille/geste";
import EnRetard from "../components/EnRetard";
import { useSourcesProgression } from "../lib/objectifs/useProgression";
import { useCochesOptimistes } from "../components/CaseACocher";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";
import type { FocusController } from "../lib/useFocus";
import type { AppData, TodayTask } from "../lib/types";
import type { View } from "../components/Sidebar";
import { WIDGET_LABELS, type UiConfig, type WidgetConfig } from "../lib/uiConfig";
import { useEntitlements } from "../lib/entitlements";
import { isTradingWidget } from "../lib/features";
import { MODULE_DU_WIDGET } from "../lib/licence/catalogue";
import { ordreAujourdhuiAuTelephone, type Ancre } from "../lib/grille";
import { useIsPhone } from "../lib/platform";

import { formatDate, localeTag, t } from "../lib/i18n";
import BarreExemples from "../components/onboarding/BarreExemples";
import { CarteBrief } from "../components/ia/CarteBrief";
import { useIa } from "../lib/ia/useIa";
import { iaAutorisee } from "../lib/ia/reglages";

/** Largeur par défaut (en colonnes /12) de chaque widget du dashboard. */
const WIDGET_DEFAULT_W: Record<string, number> = {
  perf: 12,
  discipline: 4,
  timer: 4,
  habitudes: 4,
  position: 4,
  quicklinks: 4,
  tasks: 8,
  goals: 8,
  calendar: 8,
  "brief-ia": 12,
};
/** Largeur MINIMALE (colonnes /12) : sous ce seuil le contenu se chevaucherait.
    Calé sur ce que chaque widget peut afficher lisiblement. Le moteur de grille
    peut la REMONTER automatiquement si la fenêtre est étroite (plancher en px). */
const WIDGET_MIN_W: Record<string, number> = {
  perf: 4,
  discipline: 3,
  timer: 3,
  habitudes: 3,
  position: 4,
  quicklinks: 3,
  tasks: 4,
  goals: 4,
  calendar: 4,
  "brief-ia": 4,
};

/** Hauteur MINIMALE (px) des widgets dont le contenu sait défiler : sous cette
    valeur la carte n'aurait plus rien de lisible (en-tête + une ligne). */
const WIDGET_MIN_H: Record<string, number> = {
  calendar: 176,
  tasks: 200,
  goals: 176,
  habitudes: 136,
  // `quicklinks` n'est plus ici (2026-10-11) : ses pastilles ne défilent plus,
  // son plancher est la hauteur de son contenu (voir `QuickLinks.tsx`).
};

/** Vue complète associée à chaque widget (poignée ↗ discrète du panneau). */
const WIDGET_TARGET: Record<string, View> = {
  perf: "performance",
  discipline: "tasks",
  timer: "timer",
  habitudes: "journal",
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
  const isPhone = useIsPhone();
  const { hasTrading, afficheModule } = useEntitlements();
  // L'IA de Shale Pro : la carte du brief n'existe que pour un compte Pro dont
  // l'IA et la famille « brief » sont allumées (et jamais sur iOS, V1).
  const ia = useIa();
  const briefIa = ia.visible && ia.aLeDroit && !!ia.prefs && iaAutorisee(ia.prefs, "brief");

  // La case bascule AU CLIC ; l'anneau de discipline suit la même liste, donc
  // il bouge avec elle au lieu d'attendre la relecture de la base.
  const { etat, basculer } = useCochesOptimistes();

  const derived = useMemo(() => {
    const list = todayTasks(data.tasks, data.completions, today).map((x) => ({
      ...x,
      done: etat(`t${x.id}`, x.done),
    }));
    // ⭐ La fraction et le pourcentage sortent du MÊME compte (`statDeListe`) :
    // l'anneau écrivait « 25 % » sur « 1/6 » (crible du labo, constat 1).
    const stat = statDeListe(list);
    return {
      list,
      stat,
      streak: computeStreak(data.tasks, data.completions, today, stat.pct),
      week: weekStats(data.tasks, data.completions, today, list),
    };
  }, [data, today, etat]);

  const handleToggle = useCallback(
    (task: TodayTask) =>
      basculer(`t${task.id}`, task.done, async (fait) => {
        await basculerTache(task, todayStr(), fait);
        await refresh();
      }),
    [basculer, refresh],
  );

  /**
   * ⭐ L'ajout depuis la carte du jour. `jour` vient de la ligne de saisie : la
   * date lue dans la phrase, celle du calendrier, ou — à défaut — AUJOURD'HUI.
   * Sans elle, la tâche n'entrerait pas dans la liste du jour (`todayTasks`).
   */
  const handleAdd = useCallback(
    async (label: string, jour: string | null) => {
      await createTask({
        label,
        tag: null,
        priority: "medium",
        recurrence: "none",
        goal_id: null,
        // Jamais d'écriture directe de `due_date` : la règle datée / récurrente
        // est tenue par `planificationDeSaisie` (`lib/taches.ts`).
        ...planificationDeSaisie("none", jour ?? "", "", ""),
      });
      await refresh();
      // Datée d'un autre jour, elle n'apparaît PAS dans la liste : le dire,
      // sinon l'ajout a l'air d'avoir échoué.
      if (jour && jour !== todayStr()) {
        afficherToast({
          msg: t("« {titre} » est prévue le {date}", {
            titre: titreCourt(label),
            date: formatDate(new Date(`${jour}T12:00:00`), { weekday: "long", day: "numeric", month: "long" }),
          }),
        });
      }
    },
    [refresh],
  );

  // Les sources de la mesure d'un objectif — lues UNE fois pour la ligne
  // « En retard » et la carte « Objectifs en cours ».
  const progression = useSourcesProgression(data);
  const lancerFocus =
    focus && !focus.session
      ? (task: { id: number; label: string }) => focus.start({ minutes: 25, taskId: task.id, label: task.label })
      : undefined;

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
            pct={derived.stat.pct}
            streak={derived.streak}
            done={derived.stat.done}
            total={derived.stat.total}
          />
        </div>
      </section>
    ),
    timer: () => (focus ? <TimerCard key="timer" data={data} focus={focus} /> : null),
    habitudes: () => {
      const faites = data.habits.filter((h) =>
        etat(`h${h.id}:${today}`, data.habitChecks.some((c) => c.habit_id === h.id && c.date === today)),
      ).length;
      return (
        <section key="habitudes" className="card p-5">
          {/* `.rgrid-head` : le compteur s'écarte de la barre de poignées au survol. */}
          <div className="rgrid-head mb-3 flex items-baseline justify-between gap-2">
            <h2 className="hud-label">{t("Habitudes à tenir")}</h2>
            {data.habits.length > 0 && (
              <span className="font-mono text-[10px] text-text-dim">
                {faites}/{data.habits.length}
              </span>
            )}
          </div>
          <HabitudesDuJour
            data={data}
            refresh={refresh}
            ouvrirJournal={navigate ? () => navigate("journal") : undefined}
          />
        </section>
      );
    },
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
          refresh={refresh}
          onFocus={lancerFocus}
        />
      </section>
    ),
    goals: () => (
      <section key="goals" className="card p-5">
        <h2 className="mb-3 hud-label">{t("Objectifs en cours")}</h2>
        <GoalsPreview data={data} sources={progression} />
      </section>
    ),
    calendar: () => <CalendarCard key="calendar" data={data} />,
    "brief-ia": () => (briefIa ? <CarteBrief key="brief-ia" data={data} refresh={refresh} /> : null),
  };

  // Ordre d'affichage dans la grille : bannières pleine largeur, puis les widgets des
  // deux colonnes entrelacés (le placement dense reconstitue l'empilage gauche/droite).
  // Sans l'offre Trade, les widgets trading sortent de la GRILLE, pas seulement
  // de l'écran : un panneau simplement masqué réapparaîtrait dans les chips
  // « + <titre> » sous la grille, avec un bouton pour le restaurer.
  const visible = (list: WidgetConfig[]) =>
    list.filter(
      (w) =>
        w.visible &&
        (hasTrading || !isTradingWidget(w.id)) &&
        // Profil de licence : le widget suit le module dont il montre le contenu.
        (!MODULE_DU_WIDGET[w.id] || afficheModule(MODULE_DU_WIDGET[w.id])),
    );
  const ordered: WidgetConfig[] = [
    ...visible(config.dashTop),
    ...interleave(visible(config.dashLeft), visible(config.dashRight)),
  ];
  // Deux VRAIES colonnes tant que la disposition est intacte : la « colonne
  // gauche » de Personnaliser s'accroche au bord gauche de la grille, la droite
  // au bord droit. Sans cela, une carte étroite se glisse sous « Tâches du
  // jour » dès qu'elle est plus courte que « Discipline », et il reste un trou
  // sous l'anneau (`lib/grille.ts`, 2026-10-11).
  const ancreDe = (id: string): Ancre | undefined =>
    config.dashLeft.some((w) => w.id === id)
      ? "debut"
      : config.dashRight.some((w) => w.id === id)
        ? "fin"
        : undefined;

  return (
    <div className="mx-auto max-w-5xl p-8 telephone:p-4">
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

      {/* ⭐ Ce qui est en retard — absent quand il n'y a rien (`EnRetard`). */}
      <EnRetard
        data={data}
        sources={progression}
        refresh={refresh}
        onToggle={handleToggle}
        cochee={(task) => etat(`t${task.id}`, false)}
        onFocus={lancerFocus}
      />

      {/* ⭐ Le bouton unique « supprimer les exemples ». Il s'efface de lui-même
          quand il n'y a plus rien à supprimer — voir `BarreExemples`. */}
      <div className="mt-4">
        <BarreExemples signal={data} onChange={refresh} />
      </div>

      {/* Au téléphone, les habitudes remontent juste sous les tâches (crible
          du labo, constat 14) ; l'ordre du bureau ne change pas. */}
      <ResizableGrid
        gridId="today"
        className="mt-4"
        ajusterOrdre={isPhone ? ordreAujourdhuiAuTelephone : undefined}
      >
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
              ancre={ancreDe(w.id)}
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
