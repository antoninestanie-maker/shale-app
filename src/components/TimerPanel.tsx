// Panneau Timer : presets travail·pause, durée sur mesure, tâche liée,
// pause auto, contrôles de session. Minimaliste — ni mode concentration
// ni son (retirés le 2026-07-23).
import { useEffect, useMemo, useState } from "react";
import { todayStr, todayTasks } from "../lib/logic";
import { getSetting, setSetting } from "../lib/repo";
import type { FocusController } from "../lib/useFocus";
import type { AppData } from "../lib/types";
import { IconExpand, IconPause, IconPlay, IconStop } from "./icons";

import { t } from "../lib/i18n";
/** Interrupteur compact réutilisé pour les options. */
function Switch({
  checked,
  onToggle,
  label,
  hint,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-text-dim">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        data-tip={label}
        data-tip-sub={hint ?? (checked ? t("Activé") : t("Désactivé"))}
        className={`pill h-4 w-7 shrink-0 border transition-colors ${
          checked ? "border-green/50 bg-green/30" : "border-border bg-surface-2"
        }`}
      >
        <span
          className={`block h-3 w-3 rounded-full bg-text transition-transform ${
            checked ? "translate-x-3" : "translate-x-0.5"
          }`}
        />
      </button>
      <span>
        {label}
        {hint && <span className="ml-1 text-[10px] opacity-70">— {hint}</span>}
      </span>
    </label>
  );
}

export const TIMER_PRESETS = [
  { label: "25·5", work: 25, brk: 5, hint: "pomodoro" },
  { label: "50·10", work: 50, brk: 10, hint: "deep work" },
  { label: "90·15", work: 90, brk: 15, hint: "ultradien" },
];

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

interface Props {
  data: AppData;
  focus: FocusController;
}

export default function TimerPanel({ data, focus }: Props) {
  const [presetIdx, setPresetIdx] = useState(0);
  const [customWork, setCustomWork] = useState<number | null>(null);
  // Mode « sur mesure » : durées travail/pause saisies librement par l'utilisateur.
  const [customMode, setCustomMode] = useState(false);
  const [customWorkStr, setCustomWorkStr] = useState("45");
  const [customBreakStr, setCustomBreakStr] = useState("10");
  const [taskId, setTaskId] = useState<number | "">("");
  const [autoBreak, setAutoBreak] = useState(true);

  useEffect(() => {
    getSetting("timer_custom_work").then((v) => v && setCustomWorkStr(v));
    getSetting("timer_custom_break").then((v) => v && setCustomBreakStr(v));
  }, []);

  // Borne une saisie de minutes dans [1, 240].
  const clampMin = (s: string, fallback: number) => {
    const n = Math.round(Number(s));
    return Number.isFinite(n) ? Math.min(240, Math.max(1, n)) : fallback;
  };

  const today = todayStr();
  const preset = TIMER_PRESETS[presetIdx];
  const customWorkMin = clampMin(customWorkStr, 45);
  const customBreakMin = clampMin(customBreakStr, 10);
  const workMin = customMode ? customWorkMin : (customWork ?? preset.work);
  const breakMin = customMode ? customBreakMin : preset.brk;

  const undone = useMemo(
    () => todayTasks(data.tasks, data.completions, today).filter((t) => !t.done),
    [data.tasks, data.completions, today],
  );

  const cyclesToday = useMemo(
    () =>
      data.focusSessions.filter(
        (s) => s.kind === "focus" && s.ended_at && s.started_at.startsWith(today),
      ).length,
    [data.focusSessions, today],
  );

  const bump = (delta: number) => {
    const next = Math.min(240, Math.max(1, workMin + delta));
    if (customMode) {
      setCustomWorkStr(String(next));
      setSetting("timer_custom_work", String(next));
    } else {
      setCustomWork(next);
    }
  };

  const launch = async () => {
    const task = undone.find((t) => t.id === taskId);
    await focus.start({
      minutes: workMin,
      taskId: task?.id ?? null,
      label: task?.label ?? "Focus",
      breakMin: autoBreak ? breakMin : undefined,
      openOverlay: false, // depuis le panneau, on reste dans l'app
    });
  };

  const { session, remainingSec, paused } = focus;

  return (
    <div className="flex flex-col gap-4">
      {session ? (
        <div className="flex flex-col items-center py-2">
          <p className="hud-label">
            {session.kind === "break" ? "pause en cours" : "session en cours"}
          </p>
          <button
            type="button"
            onClick={() => focus.setOverlayOpen(true)}
            data-tip={t("Plein écran")}
            data-tip-sub={t("Ne laisse que le compte à rebours à l’écran.")}
            className={`mt-2 font-mono text-6xl font-semibold text-text ${
              paused ? "opacity-50" : ""
            }`}
          >
            {fmt(remainingSec)}
          </button>
          <p className="mt-1 max-w-full truncate text-xs text-text-dim">
            {session.label}
            {session.breakMin ? ` · pause ${session.breakMin} min ensuite` : ""}
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={paused ? focus.resume : focus.pause}
              className={`pill inline-flex items-center gap-1.5 border px-4 py-2 text-xs font-semibold ${
                paused
                  ? "border-green/40 bg-green/10 text-green"
                  : "border-yellow/40 bg-yellow/10 text-yellow"
              }`}
            >
              {paused ? <><IconPlay className="h-3 w-3" /> Reprendre</> : <><IconPause className="h-3 w-3" /> Pause</>}
            </button>
            <button
              type="button"
              onClick={focus.stop}
              className="pill inline-flex items-center gap-1.5 border border-red/40 bg-red/10 px-4 py-2 text-xs font-semibold text-red"
            >
              <IconStop className="h-3 w-3" /> Stop
            </button>
            <button
              type="button"
              onClick={() => focus.setOverlayOpen(true)}
              className="pill inline-flex items-center border border-border px-4 py-2 text-xs text-text-dim hover:text-text"
            >
              <IconExpand className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="hud-label mb-2">preset</p>
            {/* auto-tiles-sm : les presets se réorganisent selon la largeur
                réelle de la carte. En `flex`, le `min-width:auto` des items
                faisait déborder la rangée dès que la carte devenait étroite. */}
            <div className="auto-tiles-sm gap-1.5">
              {TIMER_PRESETS.map((p, i) => {
                const on = !customMode && presetIdx === i && customWork === null;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      setPresetIdx(i);
                      setCustomWork(null);
                      setCustomMode(false);
                    }}
                    data-tip={`${p.label} minutes`}
                    data-tip-sub={p.hint}
                    className={`min-w-0 rounded-[var(--radius-field)] border px-2 py-2 text-center transition-colors ${
                      on ? "border-blue/50 bg-blue/15" : "border-border hover:border-text-dim/40"
                    }`}
                  >
                    <span
                      className={`block font-mono text-sm font-semibold ${
                        on ? "text-blue" : "text-text"
                      }`}
                    >
                      {p.label}
                    </span>
                    <span className="hud-label mt-0.5 block" title={p.hint}>
                      {p.hint}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setCustomMode(true)}
                data-tip={t("Durées sur mesure")}
                data-tip-sub={t("Travail et pause libres (1 à 240 min), mémorisés pour les prochaines sessions.")}
                className={`min-w-0 rounded-[var(--radius-field)] border px-2 py-2 text-center transition-colors ${
                  customMode ? "border-blue/50 bg-blue/15" : "border-border hover:border-text-dim/40"
                }`}
              >
                <span
                  className={`block font-mono text-sm font-semibold ${
                    customMode ? "text-blue" : "text-text"
                  }`}
                >
                  {customWorkMin}·{customBreakMin}
                </span>
                <span className="hud-label mt-0.5 block" title={t("sur mesure")}>
                  {t("sur mesure")}
                </span>
              </button>
            </div>
          </div>

          {customMode && (
            <div className="auto-tiles gap-3">
              <label className="block">
                <span className="hud-label">travail (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={customWorkStr}
                  onChange={(e) => {
                    setCustomWorkStr(e.target.value);
                    setSetting("timer_custom_work", e.target.value);
                  }}
                  className="mt-1 w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text focus:border-blue focus:outline-none"
                />
              </label>
              <label className="block">
                <span className="hud-label">pause (min)</span>
                <input
                  type="number"
                  min={1}
                  max={240}
                  value={customBreakStr}
                  onChange={(e) => {
                    setCustomBreakStr(e.target.value);
                    setSetting("timer_custom_break", e.target.value);
                  }}
                  className="mt-1 w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2 font-mono text-sm text-text focus:border-blue focus:outline-none"
                />
              </label>
            </div>
          )}

          <div>
            <p className="hud-label mb-2">{t("durée de travail")}</p>
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => bump(-5)}
                className="pill h-9 w-9 border border-border text-lg text-text-dim hover:text-text"
                aria-label="Moins 5 minutes"
                data-tip="−5 minutes"
              >
                −
              </button>
              <span className="font-mono text-4xl font-semibold text-text">
                {workMin}
                <span className="text-sm text-text-dim"> min</span>
              </span>
              <button
                type="button"
                onClick={() => bump(5)}
                className="pill h-9 w-9 border border-border text-lg text-text-dim hover:text-text"
                aria-label={t("Plus 5 minutes")}
                data-tip="+5 minutes"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <p className="hud-label mb-2">{t("tâche liée")}</p>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-[10px] border border-border bg-surface-2 px-3 py-2.5 text-xs text-text focus:border-blue focus:outline-none"
            >
              <option value="">{t("Sans tâche liée")}</option>
              {undone.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <Switch
            checked={autoBreak}
            onToggle={() => setAutoBreak(!autoBreak)}
            label={t("pause auto ({n} min) après la session", { n: breakMin })}
          />

          <button
            type="button"
            onClick={launch}
            data-tip={t("Lancer la session")}
            data-tip-sub={t("Démarre le compte à rebours de concentration.")}
            className="flex w-full items-center justify-center gap-2 rounded-[12px] bg-green py-3 font-display text-sm font-bold uppercase tracking-wide text-on-green hover:opacity-90"
          >
            <IconPlay className="h-4 w-4" /> Lancer {workMin} min
          </button>
        </>
      )}

      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <span className="hud-label">cycles aujourd'hui</span>
          <span className="flex items-center gap-1">
            {cyclesToday === 0 ? (
              <span className="font-mono text-xs text-text-dim">0</span>
            ) : (
              Array.from({ length: Math.min(cyclesToday, 10) }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-green"
                />
              ))
            )}
          </span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-text-dim">
          Choisis un preset (ou « sur mesure »), lie une tâche, puis lance ta
          session.
        </p>
      </div>
    </div>
  );
}
