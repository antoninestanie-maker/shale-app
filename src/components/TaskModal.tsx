import { useEffect, useState } from "react";
import { DAY_SHORT } from "../lib/logic";
import { createTask, updateTask, type TaskInput } from "../lib/repo";
import type { Goal, Priority, Tag, Task } from "../lib/types";

import { t } from "../lib/i18n";
interface Props {
  task: Task | null; // null = création
  tags: Tag[];
  goals: Goal[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

type RecMode = "none" | "daily" | "weekdays" | "custom";

// Ordre d'affichage : lundi d'abord (valeurs JS getDay)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function parseRecurrence(rec: string | null): { mode: RecMode; days: number[] } {
  if (!rec || rec === "none") return { mode: "none", days: [] };
  if (rec === "daily") return { mode: "daily", days: [] };
  if (rec === "weekdays") return { mode: "weekdays", days: [] };
  try {
    const days = JSON.parse(rec);
    if (Array.isArray(days)) return { mode: "custom", days };
  } catch {
    // illisible → ponctuelle
  }
  return { mode: "none", days: [] };
}

const priorities = (): { value: Priority; label: string; color: string }[] => [
  { value: "high", label: t("Haute"), color: "var(--color-red)" },
  { value: "medium", label: t("Moyenne"), color: "var(--color-yellow)" },
  { value: "low", label: t("Basse"), color: "var(--color-text-dim)" },
];

const recModes = (): { value: RecMode; label: string }[] => [
  { value: "none", label: t("Une fois") },
  { value: "daily", label: t("Quotidien") },
  { value: "weekdays", label: t("Lun–ven") },
  { value: "custom", label: t("Jours précis") },
];

export default function TaskModal({ task, tags, goals, onClose, onSaved }: Props) {
  const parsed = parseRecurrence(task?.recurrence ?? null);
  const [label, setLabel] = useState(task?.label ?? "");
  const [tag, setTag] = useState<string | null>(task?.tag ?? null);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [recMode, setRecMode] = useState<RecMode>(parsed.mode);
  const [days, setDays] = useState<number[]>(parsed.days);
  const [goalId, setGoalId] = useState<number | null>(task?.goal_id ?? null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ Une couche AU-DESSUS a déjà traité la touche : elle l'a marquée.
      // Sans ce garde, un seul Échap ferme DEUX étages d'un coup — et si
      // l'étage du dessous est un formulaire, la saisie part avec.
      // Convention posée par KnowledgeView le 2026-08-26, généralisée ici
      // le 2026-08-28 après l'avoir reproduite : ⌘K par-dessus une tâche.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const toggleDay = (d: number) =>
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );

  const canSave =
    label.trim().length > 0 &&
    !saving &&
    (recMode !== "custom" || days.length > 0);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input: TaskInput = {
      label: label.trim(),
      tag,
      priority,
      recurrence:
        recMode === "custom"
          ? JSON.stringify(days.slice().sort((a, b) => a - b))
          : recMode,
      goal_id: goalId,
    };
    if (task) await updateTask(task.id, input);
    else await createTask(input);
    await onSaved();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg text-text">
          {task ? t("Modifier la tâche") : t("Nouvelle tâche")}
        </h2>

        <form
          className="mt-4 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t("Nom de la tâche")}
            className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Priorité")}</p>
            <div className="flex gap-1.5">
              {priorities().map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`pill flex items-center gap-1.5 border px-3 py-1.5 text-xs font-medium transition-colors ${
                    priority === p.value
                      ? "border-text/30 bg-surface-2 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">
              {t("Récurrence")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recModes().map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setRecMode(m.value)}
                  className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                    recMode === m.value
                      ? "border-text/30 bg-surface-2 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {recMode === "custom" && (
              <div className="mt-2 flex gap-1.5">
                {WEEK_ORDER.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`h-8 w-9 rounded-[8px] border text-xs font-medium transition-colors ${
                      days.includes(d)
                        ? "border-blue bg-blue/20 text-text"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {DAY_SHORT[d]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Tag")}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setTag(null)}
                className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                  tag === null
                    ? "border-text/30 bg-surface-2 text-text"
                    : "border-border text-text-dim hover:text-text"
                }`}
              >
                {t("Aucun")}
              </button>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTag(t.name)}
                  className="pill border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={
                    tag === t.name
                      ? {
                          borderColor: t.color,
                          backgroundColor: `color-mix(in srgb, ${t.color} 16%, transparent)`,
                          color: t.color,
                        }
                      : { borderColor: "var(--color-border)", color: "var(--color-text-dim)" }
                  }
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          {goals.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                {t("Objectif lié")}
              </p>
              <select
                value={goalId ?? ""}
                onChange={(e) =>
                  setGoalId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
              >
                <option value="">{t("Aucun")}</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
            >
              {t("Annuler")}
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="pill bg-blue px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
            >
              {task ? t("Enregistrer") : t("Créer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
