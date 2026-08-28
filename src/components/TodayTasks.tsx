import { useState } from "react";
import type { Goal, Tag, TodayTask } from "../lib/types";

import { t } from "../lib/i18n";
interface Props {
  tasks: TodayTask[];
  tags: Tag[];
  goals?: Goal[];
  onToggle: (task: TodayTask) => void;
  onAdd: (label: string) => void;
  onFocus?: (task: TodayTask) => void;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--color-red)",
  medium: "var(--color-yellow)",
  low: "var(--color-text-dim)",
};

export default function TodayTasks({ tasks, tags, goals, onToggle, onAdd, onFocus }: Props) {
  const [draft, setDraft] = useState("");
  const tagColor = (name: string | null) =>
    tags.find((t) => t.name === name)?.color ?? "var(--color-blue)";
  const goalTitle = (goalId: number | null) =>
    goalId == null ? null : (goals?.find((g) => g.id === goalId)?.title ?? null);

  const sorted = [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.priority] - order[b.priority];
  });

  return (
    // panel-col + panel-grow : la carte grandit → c'est la LISTE qui prend la
    // hauteur (et défile si on rétrécit), pas un vide sous le contenu.
    <div className="panel-col panel-grow">
      <form
        className="shrink-0"
        onSubmit={(e) => {
          e.preventDefault();
          const label = draft.trim();
          if (!label) return;
          onAdd(label);
          setDraft("");
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("Ajouter une tâche…  (Entrée)")}
          className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
        />
      </form>

      <ul className="panel-scroll mt-3 flex flex-col gap-1 pr-0.5">
        {sorted.length === 0 && (
          <li className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
            <p className="text-sm text-text-dim">{t("Rien pour aujourd'hui.")}</p>
            <p className="text-xs text-text-dim/70">{t("Ajoute une première tâche ↑")}</p>
          </li>
        )}
        {sorted.map((task) => (
          <li key={task.id} className="group relative shrink-0">
            <button
              type="button"
              onClick={() => onToggle(task)}
              data-tip={task.done ? t("Marquer à faire") : t("Marquer faite")}
              data-tip-sub={t("Compte dans la discipline et le streak du jour.")}
              className="flex w-full min-w-0 items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-overlay"
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  task.done
                    ? "border-green bg-green"
                    : "border-text-dim/40 group-hover:border-text-dim"
                }`}
              >
                {task.done && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none">
                    <path
                      d="M2 6.5 4.5 9 10 3.5"
                      stroke="var(--color-surface)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>

              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
                title={t("Priorité {p}", { p: task.priority })}
              />

              {/* min-w-0 + clamp : un libellé très long ne pousse jamais les
                  chips hors de la carte, il se coupe proprement sur 2 lignes. */}
              <span
                className={`clamp-2 min-w-0 flex-1 text-sm ${
                  task.done ? "text-text-dim line-through" : "text-text"
                }`}
                title={task.label}
              >
                {task.label}
              </span>

              {goalTitle(task.goal_id) && (
                <span
                  className="shrink-0 text-blue"
                  title={t("Rattachée à l'objectif « {title} »", { title: goalTitle(task.goal_id) ?? "" })}
                  aria-label={t("Objectif : {title}", { title: goalTitle(task.goal_id) ?? "" })}
                >
                  ◎
                </span>
              )}

              {task.tag && (
                <span
                  className="pill max-w-[35%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    backgroundColor: `color-mix(in srgb, ${tagColor(task.tag)} 16%, transparent)`,
                    color: tagColor(task.tag),
                  }}
                  title={task.tag}
                >
                  {task.tag}
                </span>
              )}
              {onFocus && !task.done && <span className="w-6 shrink-0" />}
            </button>
            {onFocus && !task.done && (
              <button
                type="button"
                onClick={() => onFocus(task)}
                data-tip={t("Focus 25 min")}
                data-tip-sub={t("Démarre un pomodoro dédié à cette tâche.")}
                aria-label={t("Focus sur {label}", { label: task.label })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-text-dim opacity-0 transition-opacity hover:text-blue group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <path d="M8 5.14v13.72c0 .86.95 1.38 1.68.92l10.9-6.86a1.09 1.09 0 0 0 0-1.84L9.68 4.22A1.09 1.09 0 0 0 8 5.14Z" />
                </svg>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
