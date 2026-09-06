import { useEffect, useState } from "react";
import {
  ORDRE_SEMAINE,
  nomCourtDuJour,
  parseRecurrence,
  serialiserRecurrence,
  type ModeRecurrence,
} from "../lib/logic";
import { createTask, updateTask, type TaskInput } from "../lib/repo";
import { DUREE_DEFAUT_MIN, finApres, minutesDe } from "../lib/calendrier/agenda";
import { planificationDeSaisie } from "../lib/taches";
import type { Goal, Priority, Tag, Task } from "../lib/types";

import { t } from "../lib/i18n";
interface Props {
  task: Task | null; // null = création
  tags: Tag[];
  goals: Goal[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

const priorities = (): { value: Priority; label: string; color: string }[] => [
  { value: "high", label: t("Haute"), color: "var(--color-red)" },
  { value: "medium", label: t("Moyenne"), color: "var(--color-yellow)" },
  { value: "low", label: t("Basse"), color: "var(--color-text-dim)" },
];

const recModes = (): { value: ModeRecurrence; label: string }[] => [
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
  const [recMode, setRecMode] = useState<ModeRecurrence>(parsed.mode);
  const [days, setDays] = useState<number[]>(parsed.jours);
  const [goalId, setGoalId] = useState<number | null>(task?.goal_id ?? null);
  /**
   * ⭐ LA DATE D'UNE TÂCHE, ENFIN SAISISSABLE ICI.
   *
   * `tasks` porte `due_date`, `start_at` et `end_at` depuis la migration 020,
   * mais AUCUNE interface ne les renseignait : le seul chemin était de glisser
   * la tâche sur le calendrier. Antonin : « pour les tâches on ne peut pas
   * saisir de date ».
   *
   * ⚠️ ET LEUR ABSENCE ICI LES EFFAÇAIT. `updateTask` écrit `due_date = $6`
   * sans condition ; ce formulaire ne les envoyait pas, donc renommer une tâche
   * qu'on avait posée sur le calendrier lui retirait sa date et son créneau,
   * en silence. Le mode démo ne pouvait pas le montrer — son `updateTask` fait
   * un `Object.assign`, qui ignore une clé absente au lieu de la vider.
   */
  const [dueDate, setDueDate] = useState(task?.due_date ?? "");
  const [debut, setDebut] = useState(task?.start_at ?? "");
  const [fin, setFin] = useState(task?.end_at ?? "");
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

  /** Même règle que le formulaire d'événement : la fin TRANSLATE avec le début. */
  function changerDebut(nouveau: string) {
    const ancien = minutesDe(debut);
    const duree = minutesDe(fin) != null && ancien != null ? minutesDe(fin)! - ancien : null;
    setDebut(nouveau);
    if (minutesDe(nouveau) == null) return;
    setFin(finApres(nouveau, duree != null && duree > 0 ? duree : DUREE_DEFAUT_MIN));
  }

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
    const recurrence = serialiserRecurrence(recMode, days);
    const input: TaskInput = {
      label: label.trim(),
      tag,
      priority,
      recurrence,
      goal_id: goalId,
      // ⚠️ La frontière datée / récurrente est tenue par `lib/taches.ts`, pas
      // par ce formulaire : l'interface retire déjà le champ, mais une règle
      // recopiée dans chaque formulaire finit par diverger.
      ...planificationDeSaisie(recurrence, dueDate, debut, fin),
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
                {ORDRE_SEMAINE.map((d) => (
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
                    {nomCourtDuJour(d)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ⭐ DATE ET RÉCURRENCE S'EXCLUENT — l'interface rend le mélange
              IMPOSSIBLE, elle ne le décourage pas. C'est la règle structurante
              de `lib/taches.ts` : une tâche datée arrive une fois et se
              reporte ; une tâche récurrente n'a pas de date, ses occurrences
              se calculent, et une occurrence manquée n'est PAS en retard —
              elle est manquée. Reporter une habitude quotidienne en ferait
              deux le lendemain, puis trois : l'app transformerait un jour de
              repos en dette.

              On ANNONCE le retrait plutôt que de faire disparaître un bloc en
              silence — un contrôle qui s'évapore se lit comme un bogue. */}
          {recMode === "none" ? (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Échéance")}</p>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
              />
              {/* Le créneau n'a de sens qu'une fois la journée choisie : une
                  heure sans date ne se pose nulle part dans le calendrier. */}
              {dueDate && (
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Début")}</p>
                    <input
                      type="time"
                      value={debut}
                      onChange={(e) => changerDebut(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
                    />
                  </div>
                  <div className="flex-1">
                    <p className="mb-1.5 text-xs font-medium text-text-dim">{t("Fin")}</p>
                    <input
                      type="time"
                      value={fin}
                      onChange={(e) => setFin(e.target.value)}
                      className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-sm text-text focus:border-blue focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="rounded-[10px] border border-border bg-surface-2 px-3 py-2 text-xs text-text-dim">
              {t("Une tâche qui se répète n'a pas d'échéance : ses occurrences se calculent.")}
            </p>
          )}

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
