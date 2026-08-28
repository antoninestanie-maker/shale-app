import { useEffect, useRef, useState } from "react";
import GoalModal from "../components/GoalModal";
import { effectiveProgress, todayStr } from "../lib/logic";
import { deleteGoal } from "../lib/repo";
import type { AppData, Goal } from "../lib/types";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { pick, t, tp } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

/**
 * Clés FRANÇAISES : la table est construite à l'import, donc `t()` y serait
 * figé sur la langue du démarrage. On traduit à l'AFFICHAGE — même idiome que
 * `t(iv.bias)` dans Market-Brain.
 */
const SCOPE_LABEL: Record<Goal["scope"], string> = {
  short: "court terme",
  medium: "moyen terme",
  long: "long terme",
};

const SCOPE_ORDER: Record<Goal["scope"], number> = {
  long: 0,
  medium: 1,
  short: 2,
};

function deadlineInfo(deadline: string | null): {
  label: string;
  urgent: boolean;
} | null {
  if (!deadline) return null;
  const today = todayStr();
  const days = Math.round(
    (new Date(deadline).getTime() - new Date(today).getTime()) / 86_400_000,
  );
  if (days < 0) return { label: t("en retard de {n} j", { n: -days }), urgent: true };
  if (days === 0) return { label: t("aujourd'hui"), urgent: true };
  // « J−3 » en français, « D−3 » en anglais : l'initiale suit la langue.
  return { label: `${pick("J", "D")}−${days}`, urgent: days <= 7 };
}

export default function GoalsView({ data, refresh }: Props) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [parentForNew, setParentForNew] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  // action palette "Nouvel objectif" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-goal", onNew);
    return () => window.removeEventListener("sb:new-goal", onNew);
  }, []);

  const { goals, tasks, completions } = data;
  const roots = goals
    .filter((g) => g.parent_goal_id === null)
    .sort(
      (a, b) =>
        SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope] ||
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
    );

  // Regroupe les objectifs racines par catégorie (« Sans catégorie » en dernier).
  const NONE = "__none__";
  const groups = new Map<string, Goal[]>();
  for (const g of roots) {
    const key = g.category?.trim() || NONE;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(g);
  }
  const orderedCategories = Array.from(groups.keys()).sort((a, b) => {
    if (a === NONE) return 1;
    if (b === NONE) return -1;
    return a.localeCompare(b);
  });

  const childrenOf = (id: number) =>
    goals
      .filter((g) => g.parent_goal_id === id)
      .sort((a, b) =>
        (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"),
      );

  const handleDelete = async (goal: Goal) => {
    if (deletingId !== goal.id) {
      setDeletingId(goal.id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    window.clearTimeout(deleteTimer.current);
    setDeletingId(null);
    await deleteGoal(goal);
    await refresh();
  };

  const renderGoal = (goal: Goal, depth: number) => {
    const pct = effectiveProgress(goal, goals, tasks, completions);
    const auto = !goal.manual_progress;
    const linkedCount = tasks.filter((t) => t.goal_id === goal.id).length;
    const dl = deadlineInfo(goal.deadline);
    const kids = childrenOf(goal.id);

    return (
      <div key={goal.id}>
        <div
          className="group flex flex-wrap items-center gap-3 rounded-[10px] px-3 py-3 hover:bg-surface-2"
          style={{ marginLeft: depth * 28 }}
        >
          {depth > 0 && (
            <span className="h-6 w-px shrink-0 bg-border" aria-hidden />
          )}

          {/* basis-[14rem] : base flex qui déclenche le repli. En fenêtre
              étroite la barre de progression et les actions passent à la ligne
              au lieu de sortir du panneau (clippées = incliquables). En plein
              écran tout tient sur une ligne : rendu inchangé. */}
          <div className="min-w-0 flex-1 basis-[14rem]">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`truncate text-sm ${pct >= 100 ? "text-text-dim line-through" : "text-text"}`}
              >
                {goal.title}
              </span>
              <span className="pill shrink-0 bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
                {t(SCOPE_LABEL[goal.scope])}
              </span>
              {dl && (
                <span
                  className={`pill shrink-0 px-2 py-0.5 text-[10px] font-medium ${
                    dl.urgent ? "bg-red/15 text-red" : "bg-surface-2 text-text-dim"
                  }`}
                >
                  {dl.label}
                </span>
              )}
              {linkedCount > 0 && (
                <span className="shrink-0 text-[10px] text-text-dim">
                  {tp(linkedCount, "{n} tâche", "{n} tâches")}
                </span>
              )}
            </div>
            {goal.description && (
              <p className="mt-0.5 truncate text-xs text-text-dim">
                {goal.description}
              </p>
            )}
          </div>

          <div className="flex w-44 shrink-0 items-center gap-2">
            <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
              <div
                className={`pill h-full transition-[width] duration-500 ${pct >= 100 ? "bg-green" : "bg-blue"}`}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className="w-12 text-right font-display text-sm font-bold text-text">
              {pct}%
            </span>
            {auto && (
              <span
                className="pill shrink-0 bg-blue/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-blue"
                data-tip={t("Progression calculée (sous-objectifs + tâches liées)")}
              >
                auto
              </span>
            )}
          </div>

          <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={() => setParentForNew(goal.id)}
              className="rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
              aria-label={t("Ajouter un sous-objectif à {title}", { title: goal.title })}
              data-tip={t("Ajouter un sous-objectif")}
              data-tip-sub={t("La progression du parent se calcule à partir de ses enfants.")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setEditing(goal)}
              className="rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
              aria-label={t("Modifier {title}", { title: goal.title })}
              data-tip={t("Modifier l’objectif")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => handleDelete(goal)}
              className={`rounded-md p-1.5 transition-colors ${
                deletingId === goal.id
                  ? "bg-red/20 text-red"
                  : "text-text-dim hover:bg-surface hover:text-red"
              }`}
              aria-label={
                deletingId === goal.id
                  ? t("Confirmer la suppression")
                  : t("Supprimer {title}", { title: goal.title })
              }
              data-tip={deletingId === goal.id ? t("Confirmer la suppression") : t("Supprimer l’objectif")}
              data-tip-sub={t("Les sous-objectifs remontent d’un niveau, les tâches liées sont déliées.")}
            >
              {deletingId === goal.id ? (
                <span className="px-0.5 text-[11px] font-semibold">{t("sûr ?")}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                </svg>
              )}
            </button>
          </span>
        </div>

        {kids.map((k) => renderGoal(k, depth + 1))}
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Objectifs")}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvel objectif")}
          data-tip-sub={t("Horizon, catégorie, deadline et progression manuelle ou calculée.")}
          className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("+ Nouvel objectif")}
        </button>
      </header>

      {roots.length === 0 ? (
        <ResizableGrid gridId="goals" className="mt-6">
        <ResizablePanel id="goals-list" defaultW={12}>
        <section className="card p-3">
          <p className="py-10 text-center text-sm text-text-dim">
            {t(
              "Aucun objectif. Commence par le long terme, puis découpe en sous-objectifs. Range-les par catégorie (Trading, Formation…).",
            )}
          </p>
        </section>
        </ResizablePanel>
        </ResizableGrid>
      ) : (
        <ResizableGrid gridId="goals" className="mt-6">
          {orderedCategories.map((cat) => {
            const list = groups.get(cat)!;
            const label = cat === NONE ? t("Sans catégorie") : cat;
            return (
              <ResizablePanel
                key={cat}
                id={`goals-cat-${cat}`}
                title={label}
                defaultW={12}
              >
                <section className="card p-3">
                  <div className="mb-1 flex items-center gap-2 px-2 pt-1">
                    <h2 className="hud-label">{label}</h2>
                    <span className="pill bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
                      {list.length}
                    </span>
                  </div>
                  {list.map((g) => renderGoal(g, 0))}
                </section>
              </ResizablePanel>
            );
          })}
        </ResizableGrid>
      )}

      {(creating || editing || parentForNew !== null) && (
        <GoalModal
          goal={editing}
          goals={goals}
          defaultParentId={parentForNew}
          onClose={() => {
            setCreating(false);
            setEditing(null);
            setParentForNew(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
            setParentForNew(null);
          }}
        />
      )}
    </div>
  );
}
