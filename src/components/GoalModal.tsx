import { useEffect, useState } from "react";
import { descendantIds } from "../lib/logic";
import { createGoal, updateGoal, type GoalInput } from "../lib/repo";
import type { Goal } from "../lib/types";

import { t } from "../lib/i18n";
interface Props {
  goal: Goal | null; // null = création
  goals: Goal[];
  defaultParentId?: number | null; // pré-rempli via t("+ sous-objectif")
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const SCOPES: { value: Goal["scope"]; label: string }[] = [
  { value: "short", label: "Court terme" },
  { value: "medium", label: "Moyen terme" },
  { value: "long", label: "Long terme" },
];

export default function GoalModal({
  goal,
  goals,
  defaultParentId = null,
  onClose,
  onSaved,
}: Props) {
  const [title, setTitle] = useState(goal?.title ?? "");
  const [description, setDescription] = useState(goal?.description ?? "");
  const [scope, setScope] = useState<Goal["scope"]>(goal?.scope ?? "short");
  const [category, setCategory] = useState(goal?.category ?? "");
  const [parentId, setParentId] = useState<number | null>(
    goal?.parent_goal_id ?? defaultParentId,
  );

  // Catégories déjà utilisées → suggestions (datalist), sans doublon.
  const knownCategories = Array.from(
    new Set(
      goals
        .map((g) => g.category?.trim())
        .filter((c): c is string => !!c),
    ),
  ).sort((a, b) => a.localeCompare(b));
  const [deadline, setDeadline] = useState(goal?.deadline ?? "");
  const [manual, setManual] = useState((goal?.manual_progress ?? 1) === 1);
  const [progress, setProgress] = useState(goal?.progress_pct ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // parents interdits : soi-même et ses descendants (cycles)
  const forbidden = goal ? descendantIds(goal.id, goals) : new Set<number>();
  if (goal) forbidden.add(goal.id);
  const parentOptions = goals.filter((g) => !forbidden.has(g.id));

  const canSave = title.trim().length > 0 && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const input: GoalInput = {
      title: title.trim(),
      description: description.trim() || null,
      scope,
      category: category.trim() || null,
      parent_goal_id: parentId,
      deadline: deadline || null,
      progress_pct: progress,
      manual_progress: manual ? 1 : 0,
    };
    if (goal) await updateGoal(goal.id, input);
    else await createGoal(input);
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
          {goal ? t("Modifier l'objectif") : t("Nouvel objectif")}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("Titre de l'objectif")}
            className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optionnel)"
            rows={2}
            className="w-full resize-none rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
          />

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">Horizon</p>
            <div className="flex gap-1.5">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setScope(s.value)}
                  className={`pill border px-3 py-1.5 text-xs font-medium transition-colors ${
                    scope === s.value
                      ? "border-text/30 bg-surface-2 text-text"
                      : "border-border text-text-dim hover:text-text"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Catégorie")}</p>
            <input
              list="goal-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder={t("ex. Trading, Formation, Santé… (optionnel)")}
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3.5 py-2.5 text-sm text-text placeholder:text-text-dim focus:border-blue focus:outline-none"
            />
            <datalist id="goal-categories">
              {knownCategories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {knownCategories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {knownCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(category === c ? "" : c)}
                    className={`pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      category.trim() === c
                        ? "border-blue bg-blue/15 text-blue"
                        : "border-border text-text-dim hover:text-text"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="auto-tiles gap-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                {t("Objectif parent")}
              </p>
              <select
                value={parentId ?? ""}
                onChange={(e) =>
                  setParentId(e.target.value ? Number(e.target.value) : null)
                }
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
              >
                <option value="">{t("Aucun")}</option>
                {parentOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">
                Deadline
              </p>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-sm text-text focus:border-blue focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-medium text-text-dim">Progression</p>
              <button
                type="button"
                onClick={() => setManual(!manual)}
                className={`pill border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  manual
                    ? "border-border text-text-dim"
                    : "border-blue bg-blue/15 text-blue"
                }`}
              >
                {manual ? "manuelle" : t("auto (sous-objectifs + tâches)")}
              </button>
            </div>
            {manual ? (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="flex-1 accent-[var(--color-blue)]"
                />
                <span className="w-12 text-right font-display text-sm font-bold text-text">
                  {progress}%
                </span>
              </div>
            ) : (
              <p className="text-xs text-text-dim">
                Calculée depuis les sous-objectifs et les tâches ponctuelles
                liées.
              </p>
            )}
          </div>

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
              {goal ? t("Enregistrer") : t("Créer")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
