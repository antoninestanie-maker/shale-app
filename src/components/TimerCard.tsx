// Case Timer du dashboard : version COMPACTE, pensée coup d'œil.
// Session en cours → temps restant + pause/stop. Sinon → 3 presets + Lancer.
// Tous les réglages détaillés (sur mesure, tâche liée…) vivent dans
// la vue Timer, accessible via le lien en pied de carte.
import { useMemo, useState } from "react";
import { todayStr } from "../lib/logic";
import type { FocusController } from "../lib/useFocus";
import type { AppData } from "../lib/types";
import { IconPause, IconPlay, IconStop } from "./icons";
import { TIMER_PRESETS } from "./TimerPanel";

import { t } from "../lib/i18n";
interface Props {
  data: AppData;
  focus: FocusController;
}

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimerCard({ data, focus }: Props) {
  const [presetIdx, setPresetIdx] = useState(0);
  const { session, remainingSec, paused } = focus;
  const today = todayStr();

  const cyclesToday = useMemo(
    () =>
      data.focusSessions.filter(
        (s) => s.kind === "focus" && s.ended_at && s.started_at.startsWith(today),
      ).length,
    [data.focusSessions, today],
  );

  const preset = TIMER_PRESETS[presetIdx];

  const launch = () =>
    focus.start({
      minutes: preset.work,
      taskId: null,
      label: "Focus",
      breakMin: preset.brk,
      openOverlay: false,
    });

  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="hud-label">timer</h2>
        <span className="flex items-center gap-1" data-tip="cycles aujourd'hui">
          {Array.from({ length: Math.min(cyclesToday, 8) }).map((_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-green" />
          ))}
        </span>
      </div>

      {session ? (
        <div className="panel-grow mt-3 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={() => focus.setOverlayOpen(true)}
            data-tip={t("Plein écran")}
            data-tip-sub={t("Ne laisse que le compte à rebours à l’écran.")}
            className={`font-mono text-5xl font-semibold text-text ${paused ? "opacity-50" : ""}`}
          >
            {fmt(remainingSec)}
          </button>
          <p className="mt-1 max-w-full truncate text-xs text-text-dim">
            {session.kind === "break" ? "pause" : session.label}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={paused ? focus.resume : focus.pause}
              aria-label={paused ? "Reprendre" : "Pause"}
              data-tip={paused ? "Reprendre" : "Mettre en pause"}
              className={`pill inline-flex h-9 w-9 items-center justify-center border ${
                paused
                  ? "border-green/40 bg-green/10 text-green"
                  : "border-yellow/40 bg-yellow/10 text-yellow"
              }`}
            >
              {paused ? <IconPlay className="h-3.5 w-3.5" /> : <IconPause className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={focus.stop}
              aria-label="Terminer"
              data-tip={t("Terminer la session")}
              data-tip-sub={t("Enregistre le temps concentré déjà effectué.")}
              className="pill inline-flex h-9 w-9 items-center justify-center border border-red/40 bg-red/10 text-red"
            >
              <IconStop className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* auto-tiles : les presets se réorganisent selon la largeur réelle du
              widget — jamais de chevauchement, même au plancher de largeur. */}
          <div className="auto-tiles-sm mt-3 gap-1.5">
            {TIMER_PRESETS.map((p, i) => {
              const on = presetIdx === i;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPresetIdx(i)}
                  data-tip={`${p.label} minutes`}
                  data-tip-sub={p.hint}
                  className={`min-w-0 overflow-hidden rounded-[10px] border px-1 py-2 text-center font-mono text-sm font-semibold transition-colors ${
                    on
                      ? "border-blue/50 bg-blue/15 text-blue"
                      : "border-border text-text hover:border-text-dim/40"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="panel-grow" aria-hidden />
          <button
            type="button"
            onClick={launch}
            data-tip={t("Lancer la session")}
            data-tip-sub={t("Démarre le compte à rebours de concentration.")}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-[var(--radius-field)] bg-green py-2.5 font-display text-sm font-bold uppercase tracking-wide text-on-green transition-opacity hover:opacity-90"
          >
            <IconPlay className="h-4 w-4" /> Lancer {preset.work} min
          </button>
        </>
      )}

    </section>
  );
}
