import { useEffect, useMemo, useRef, useState } from "react";
import TaskModal from "../components/TaskModal";
import { recurrenceLabel, todayStr, todayTasks } from "../lib/logic";
import {
  addTag,
  deleteTag,
  deleteTask,
  setTaskDone,
} from "../lib/repo";
import type { AppData, Tag, Task } from "../lib/types";
import { IconCalendar, IconX } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

import { t } from "../lib/i18n";
interface Props {
  data: AppData;
  refresh: () => Promise<void>;
}

type StatusFilter = "all" | "todo" | "done";

const PRIORITY_COLOR: Record<string, string> = {
  high: "var(--color-red)",
  medium: "var(--color-yellow)",
  low: "var(--color-text-dim)",
};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const TAG_COLORS = [
  "var(--color-blue)",
  "var(--color-green)",
  "var(--color-yellow)",
  "var(--color-red)",
  "var(--color-violet)",
  "#fb8b4e",
  "#ef6ba8",
  "#3cc4de",
];

export default function TasksView({ data, refresh }: Props) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const deleteTimer = useRef<number | undefined>(undefined);

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const today = todayStr();

  // action palette "Nouvelle tâche" → ouvre le formulaire
  useEffect(() => {
    const onNew = () => setCreating(true);
    window.addEventListener("sb:new-task", onNew);
    return () => window.removeEventListener("sb:new-task", onNew);
  }, []);

  // done affiché : récurrente → faite aujourd'hui ; ponctuelle → déjà faite un jour
  const rows = useMemo(() => {
    const base = dateFilter
      ? todayTasks(data.tasks, data.completions, dateFilter)
      : data.tasks.map((t) => {
          const isRec = !!t.recurrence && t.recurrence !== "none";
          const done = isRec
            ? data.completions.some(
                (c) => c.task_id === t.id && c.date === today && c.done,
              )
            : data.completions.some((c) => c.task_id === t.id && c.done);
          return { ...t, done };
        });

    return base
      .filter((t) => {
        if (status === "todo" && t.done) return false;
        if (status === "done" && !t.done) return false;
        if (tagFilter && t.tag !== tagFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority])
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        return b.id - a.id;
      });
  }, [data, status, tagFilter, dateFilter, today]);

  const tagColor = (name: string | null) =>
    data.tags.find((t) => t.name === name)?.color ?? "var(--color-blue)";

  const goalTitle = (goalId: number | null) =>
    goalId == null ? null : (data.goals.find((g) => g.id === goalId)?.title ?? null);

  const handleToggle = async (task: Task & { done: boolean }) => {
    // avec filtre date, on coche pour ce jour-là ; sinon pour aujourd'hui
    await setTaskDone(task.id, dateFilter || today, !task.done);
    await refresh();
  };

  const handleDelete = async (id: number) => {
    if (deletingId !== id) {
      setDeletingId(id);
      window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setDeletingId(null), 3000);
      return;
    }
    window.clearTimeout(deleteTimer.current);
    setDeletingId(null);
    await deleteTask(id);
    await refresh();
  };

  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    await addTag(name, newTagColor);
    setNewTagName("");
    await refresh();
  };

  const handleDeleteTag = async (tag: Tag) => {
    await deleteTag(tag);
    if (tagFilter === tag.name) setTagFilter(null);
    await refresh();
  };

  const chip = (active: boolean) =>
    `pill border px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "border-text/30 bg-surface-2 text-text"
        : "border-border text-text-dim hover:text-text"
    }`;

  return (
    <div className="mx-auto max-w-5xl p-8">
      <header className="view-head">
        <h1 className="text-3xl text-text">{t("Tâches")}</h1>
        <button
          type="button"
          onClick={() => setCreating(true)}
          data-tip={t("Nouvelle tâche")}
          data-tip-sub={t("Libellé, tag, priorité, récurrence et objectif lié.")}
          className="pill bg-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("+ Nouvelle tâche")}
        </button>
      </header>

      {/* Filtres */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", "Toutes", t("Toutes les tâches du jour, faites ou non.")],
              ["todo", t("À faire"), t("Uniquement celles qui restent à faire.")],
              ["done", "Faites", t("Uniquement celles déjà cochées.")],
            ] as [StatusFilter, string, string][]
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatus(value)}
              data-tip={label}
              data-tip-sub={hint}
              className={chip(status === value)}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setTagFilter(null)}
            data-tip={t("Tous les tags")}
            data-tip-sub={t("Retire le filtre par tag.")}
            className={chip(tagFilter === null)}
          >
            {t("Tous les tags")}
          </button>
          {data.tags.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => setTagFilter(tagFilter === tag.name ? null : tag.name)}
              data-tip={tag.name}
              data-tip-sub={
                tagFilter === tag.name ? t("Retirer ce filtre.") : t("N’afficher que les tâches de ce tag.")
              }
              className="pill border px-3 py-1.5 text-xs font-medium transition-colors"
              style={
                tagFilter === tag.name
                  ? {
                      borderColor: tag.color,
                      backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`,
                      color: tag.color,
                    }
                  : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
              }
            >
              {tag.name}
            </button>
          ))}
        </div>

        <span className="mx-1 h-4 w-px bg-border" />

        {/* ⚠️ Le libellé « échéance » n'est pas décoratif, il rend le contrôle
            IDENTIFIABLE. Un `<input type="date">` VIDE n'affiche rien du tout
            sur iOS — pas même le gabarit `jj/mm/aaaa` que rend le bureau. Vu à
            l'écran sur iPhone 17 le 2026-08-27 : un rectangle gris muet au
            milieu des filtres, dont rien ne disait ce qu'il était.

            ⚠️ Et ce n'était PAS une affaire de `color-scheme`, contrairement à
            ce que la première hypothèse disait : vérifié en ouvrant un
            `<select>` voisin, iOS rend son panneau natif en clair même sous un
            `color-scheme: dark` figé. */}
        <label className="inline-flex items-center gap-1.5 rounded-[10px] border border-border bg-surface-2 px-2 py-1 focus-within:border-blue">
          {/* L'icône complète le libellé : elle dit que ça s'OUVRE. Le libellé
              seul nommait le contrôle sans annoncer qu'on peut le toucher —
              au doigt, un rectangle vide et muet ne se tente pas. */}
          <IconCalendar className="h-3.5 w-3.5 shrink-0 text-text-dim" />
          <span className="hud-label shrink-0">{t("échéance")}</span>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            data-tip={t("Tâches dues à cette date")}
            className="min-w-[6.5rem] bg-transparent text-xs text-text outline-none"
          />
        </label>
        {dateFilter && (
          <button
            type="button"
            onClick={() => setDateFilter("")}
            data-tip={t("Effacer le filtre de date")}
            className="inline-flex items-center gap-1 text-xs text-text-dim hover:text-text"
          >
            <IconX className="h-3 w-3" /> effacer
          </button>
        )}
      </div>

      <ResizableGrid gridId="tasks" className="mt-4">
      {/* Liste */}
      <ResizablePanel id="tasks-list" defaultW={12} minH={240}>
      <section className="card">
        <ul className="panel-scroll flex flex-col p-2">
          {rows.length === 0 && (
            <li className="py-10 text-center text-sm text-text-dim">
              {t("Aucune tâche ne correspond à ces filtres.")}
            </li>
          )}
          {rows.map((task) => (
            <li
              key={task.id}
              className="group flex items-center gap-3 rounded-[10px] px-3 py-2.5 hover:bg-surface-2"
            >
              <button
                type="button"
                onClick={() => handleToggle(task)}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                  task.done
                    ? "border-green bg-green"
                    : "border-text-dim/40 hover:border-text-dim"
                }`}
                aria-label={task.done ? t("Marquer à faire") : "Marquer faite"}
                data-tip={task.done ? t("Marquer à faire") : "Marquer faite"}
                data-tip-sub={t("Compte dans la discipline du jour.")}
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
              </button>

              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: PRIORITY_COLOR[task.priority] }}
                title={t("Priorité {p}", { p: task.priority })}
              />

              {/* min-w-0 + clamp : un libellé long se coupe proprement au lieu
                  de pousser les chips hors de la carte. */}
              <span
                className={`clamp-2 min-w-0 flex-1 text-sm ${task.done ? "text-text-dim line-through" : "text-text"}`}
                title={task.label}
              >
                {task.label}
              </span>

              {recurrenceLabel(task.recurrence) && (
                <span className="pill shrink-0 bg-surface-2 px-2 py-0.5 text-[11px] text-text-dim">
                  ↻ {recurrenceLabel(task.recurrence)}
                </span>
              )}

              {goalTitle(task.goal_id) && (
                <span
                  className="pill max-w-[28%] shrink-0 truncate border border-blue/30 bg-blue/10 px-2 py-0.5 text-[11px] font-medium text-blue"
                  title={t("Rattachée à l'objectif « {title} »", { title: goalTitle(task.goal_id) ?? "" })}
                >
                  ◎ {goalTitle(task.goal_id)}
                </span>
              )}

              {task.tag && (
                <span
                  className="pill max-w-[28%] shrink-0 truncate px-2 py-0.5 text-[11px] font-medium"
                  style={{
                    // color-mix : marche aussi quand la couleur est un token
                    // `var(--color-x)` (l'ancien `+ "22"` produisait une valeur
                    // invalide → fond transparent).
                    backgroundColor: `color-mix(in srgb, ${tagColor(task.tag)} 16%, transparent)`,
                    color: tagColor(task.tag),
                  }}
                  title={task.tag}
                >
                  {task.tag}
                </span>
              )}

              <span className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => setEditing(task)}
                  data-tip={t("Modifier la tâche")}
                  className="rounded-md p-1.5 text-text-dim hover:bg-surface hover:text-text"
                  aria-label={t("Modifier")}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(task.id)}
                  className={`rounded-md p-1.5 transition-colors ${
                    deletingId === task.id
                      ? "bg-red/20 text-red"
                      : "text-text-dim hover:bg-surface hover:text-red"
                  }`}
                  aria-label={deletingId === task.id ? t("Confirmer la suppression") : t("Supprimer")}
                  data-tip={deletingId === task.id ? t("Confirmer la suppression") : t("Supprimer la tâche")}
                  data-tip-sub={t("Un second clic supprime la tâche et son historique.")}
                >
                  {deletingId === task.id ? (
                    <span className="px-0.5 text-[11px] font-semibold">{t("sûr ?")}</span>
                  ) : (
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                    </svg>
                  )}
                </button>
              </span>
            </li>
          ))}
        </ul>
      </section>
      </ResizablePanel>

      {/* Tags */}
      <ResizablePanel id="tasks-tags" defaultW={12}>
      <section className="card p-5">
        <h2 className="mb-3 hud-label">
          Tags
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {data.tags.map((tag) => (
            <span
              key={tag.id}
              className="pill flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium"
              style={{ backgroundColor: `color-mix(in srgb, ${tag.color} 16%, transparent)`, color: tag.color }}
            >
              {tag.name}
              <button
                type="button"
                onClick={() => handleDeleteTag(tag)}
                className="opacity-60 hover:opacity-100"
                aria-label={t("Supprimer le tag {name}", { name: tag.name })}
                data-tip={t("Supprimer le tag « {name} »", { name: tag.name })}
                data-tip-sub={t("Les tâches concernées sont conservées, simplement sans tag.")}
              >
                <IconX className="h-3 w-3" />
              </button>
            </span>
          ))}

          <form
            className="flex min-w-0 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleAddTag();
            }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("Nouveau tag…")}
              className="w-36 min-w-0 rounded-[10px] border border-border bg-surface-2 px-3 py-1.5 text-xs text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <span className="flex flex-wrap gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  className={`h-5 w-5 rounded-full transition-transform ${
                    newTagColor === c ? "scale-110 ring-2 ring-blue" : ""
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Couleur ${c}`}
                  data-tip={t("Couleur du tag")}
                />
              ))}
            </span>
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className="pill bg-surface-2 px-3 py-1.5 text-xs font-medium text-text disabled:opacity-40"
            >
              {t("Ajouter")}
            </button>
          </form>
        </div>
      </section>
      </ResizablePanel>
      </ResizableGrid>

      {(creating || editing) && (
        <TaskModal
          task={editing}
          tags={data.tags}
          goals={data.goals}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={async () => {
            await refresh();
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
