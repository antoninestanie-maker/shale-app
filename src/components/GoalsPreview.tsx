import { effectiveProgress } from "../lib/logic";
import type { AppData, Goal } from "../lib/types";

import { t } from "../lib/i18n";
/** Clés françaises, traduites à l'affichage — cf. `GoalsView`. */
const SCOPE_LABEL: Record<Goal["scope"], string> = {
  short: "court terme",
  medium: "moyen terme",
  long: "long terme",
};

export default function GoalsPreview({ data }: { data: AppData }) {
  const { goals, tasks, completions } = data;
  const withPct = goals.map((g) => ({
    goal: g,
    pct: effectiveProgress(g, goals, tasks, completions),
  }));

  // Plus de `.slice(0, 4)` : la liste défile dans la carte (`.panel-scroll`) —
  // agrandir le widget montre RÉELLEMENT plus d'objectifs.
  const active = withPct
    .filter(({ pct }) => pct < 100)
    .sort((a, b) =>
      (a.goal.deadline ?? "9999") < (b.goal.deadline ?? "9999") ? -1 : 1,
    );

  if (active.length === 0) {
    return (
      <div className="panel-grow flex flex-col items-center justify-center gap-1 py-4 text-center">
        <p className="text-sm text-text-dim">{t("Aucun objectif en cours.")}</p>
        <p className="text-xs text-text-dim/70">{t("Crée-en un dans l'onglet Objectifs.")}</p>
      </div>
    );
  }

  return (
    <ul className="panel-scroll flex flex-col gap-4 pr-0.5">
      {active.map(({ goal, pct }) => (
        <li key={goal.id} className="shrink-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-text" title={goal.title}>
              {goal.title}
            </span>
            <span className="shrink-0 font-display text-sm font-bold text-text">
              {pct}%
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="pill h-1.5 flex-1 overflow-hidden bg-surface-2">
              <div
                className="pill h-full bg-blue transition-[width] duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="pill shrink-0 bg-surface-2 px-2 py-0.5 text-[10px] text-text-dim">
              {t(SCOPE_LABEL[goal.scope])}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
