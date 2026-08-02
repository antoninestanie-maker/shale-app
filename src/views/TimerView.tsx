import { useEffect, useMemo, useState } from "react";
import TimerPanel from "../components/TimerPanel";
import { addDays, todayStr } from "../lib/logic";
import { getSetting, setSetting } from "../lib/repo";
import type { FocusController } from "../lib/useFocus";
import type { AppData, FocusSession } from "../lib/types";
import { IconExpand, IconPause, IconPlay, IconStop } from "../components/icons";
import { ResizableGrid, ResizablePanel } from "../components/grid/ResizableGrid";

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

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

function sessionMinutes(s: FocusSession): number {
  if (!s.ended_at) return 0;
  const ms =
    new Date(s.ended_at.replace(" ", "T")).getTime() -
    new Date(s.started_at.replace(" ", "T")).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

const R = 110;
const CIRC = 2 * Math.PI * R;

export default function TimerView({ data, focus }: Props) {
  const today = todayStr();
  const { session, remainingSec, paused } = focus;
  const [goalMin, setGoalMin] = useState(120);

  useEffect(() => {
    getSetting("focus_goal_min").then((v) => {
      if (v) setGoalMin(parseInt(v, 10));
    });
  }, []);

  const bumpGoal = async (delta: number) => {
    const next = Math.min(480, Math.max(30, goalMin + delta));
    setGoalMin(next);
    await setSetting("focus_goal_min", String(next));
    window.dispatchEvent(new CustomEvent("sb:settings-changed"));
  };

  const stats = useMemo(() => {
    const done = data.focusSessions.filter((s) => s.kind === "focus" && s.ended_at);
    const todayMin = done
      .filter((s) => s.started_at.startsWith(today))
      .reduce((a, s) => a + sessionMinutes(s), 0);
    const weekMin = done
      .filter((s) => s.started_at.slice(0, 10) >= addDays(today, -6))
      .reduce((a, s) => a + sessionMinutes(s), 0);
    const cycles = done.filter((s) => s.started_at.startsWith(today)).length;
    return { todayMin, weekMin, cycles, avg7: Math.round(weekMin / 7) };
  }, [data.focusSessions, today]);

  const todaySessions = useMemo(
    () =>
      data.focusSessions
        .filter((s) => s.started_at.startsWith(today))
        .sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [data.focusSessions, today],
  );

  const taskLabel = (s: FocusSession): string =>
    s.label ??
    data.tasks.find((t) => t.id === s.task_id)?.label ??
    "Focus";

  const totalSec = session ? session.plannedMin * 60 : 0;
  const progress = session && totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  const accent = session?.kind === "break" ? "var(--color-green)" : "var(--color-blue)";

  return (
    <div className="mx-auto max-w-5xl p-8">
      <h1 className="text-3xl text-text">{t("Timer")}</h1>

      <ResizableGrid gridId="timer" className="mt-6">
        {/* Session en cours (grand anneau) ou lanceur */}
        <ResizablePanel id="timer-main" title="Session" defaultW={8}>
          {session ? (
            <section className="card flex flex-col items-center p-8">
              <p className="hud-label">
                {session.kind === "break" ? "pause" : "focus session"}
                {paused ? " — en pause" : ""}
              </p>
              <h2 className="mt-1 max-w-md truncate text-xl text-text">
                {session.label}
              </h2>
              <div className="relative mt-6 h-64 w-64">
                <svg viewBox="0 0 260 260" className="h-full w-full -rotate-90">
                  <circle
                    cx="130"
                    cy="130"
                    r={R}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth="10"
                  />
                  <circle
                    cx="130"
                    cy="130"
                    r={R}
                    fill="none"
                    stroke={accent}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                    style={{
                      transition: "stroke-dashoffset 1s linear",
                      opacity: paused ? 0.4 : 1,
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className={`font-mono text-6xl font-semibold text-text ${paused ? "opacity-50" : ""}`}
                  >
                    {fmt(remainingSec)}
                  </span>
                  <span className="mt-1 font-mono text-xs text-text-dim">
                    / {session.plannedMin} min
                    {session.breakMin ? ` · pause ${session.breakMin} min ensuite` : ""}
                  </span>
                </div>
              </div>
              <div className="mt-6 flex gap-2">
                <button
                  type="button"
                  onClick={paused ? focus.resume : focus.pause}
                  data-tip={paused ? t("Reprendre la session") : "Mettre en pause"}
                  data-tip-sub={
                    paused
                      ? t("Le décompte repart où il s’était arrêté.")
                      : t("Le temps déjà effectué reste acquis.")
                  }
                  className={`pill inline-flex items-center gap-1.5 border px-5 py-2 text-sm font-semibold ${
                    paused
                      ? "border-green/40 bg-green/10 text-green"
                      : "border-yellow/40 bg-yellow/10 text-yellow"
                  }`}
                >
                  {paused ? <><IconPlay className="h-3.5 w-3.5" /> Reprendre</> : <><IconPause className="h-3.5 w-3.5" /> Pause</>}
                </button>
                <button
                  type="button"
                  onClick={focus.stop}
                  data-tip={t("Terminer la session")}
                  data-tip-sub={t("Clôt et enregistre le temps concentré effectué.")}
                  className="pill inline-flex items-center gap-1.5 border border-red/40 bg-red/10 px-5 py-2 text-sm font-semibold text-red"
                >
                  <IconStop className="h-3.5 w-3.5" /> Terminer
                </button>
                <button
                  type="button"
                  onClick={() => focus.setOverlayOpen(true)}
                  data-tip={t("Plein écran")}
                  data-tip-sub={t("Ne laisse que le compte à rebours à l’écran.")}
                  className="pill inline-flex items-center gap-1.5 border border-border px-5 py-2 text-sm text-text-dim hover:text-text"
                >
                  <IconExpand className="h-3.5 w-3.5" /> {t("Plein écran")}
                </button>
              </div>
            </section>
          ) : (
            <section className="card p-6">
              <h2 className="hud-label mb-4">{t("nouvelle session")}</h2>
              <TimerPanel data={data} focus={focus} />
            </section>
          )}
        </ResizablePanel>

        {/* Sessions du jour */}
        <ResizablePanel id="timer-sessions" title={t("Sessions du jour")} defaultW={8} minH={200}>
          <section className="card p-5">
            <h2 className="hud-label">{t("sessions du jour")}</h2>
            {todaySessions.length === 0 ? (
              <p className="py-6 text-center text-sm text-text-dim">
                {t("Aucune session aujourd'hui — lance la première.")}
              </p>
            ) : (
              <ul className="panel-scroll mt-3 flex flex-col gap-1">
                {todaySessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-[10px] px-2 py-2 hover:bg-surface-2"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs text-text-dim">
                      {s.started_at.slice(11, 16)}
                    </span>
                    <span
                      className={`pill w-14 shrink-0 border px-2 py-0.5 text-center text-[10px] font-semibold uppercase ${
                        s.kind === "break"
                          ? "border-green/40 text-green"
                          : "border-blue/40 text-blue"
                      }`}
                    >
                      {s.kind === "break" ? "pause" : "focus"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-text">
                      {taskLabel(s)}
                    </span>
                    <span className="shrink-0 font-mono text-xs font-semibold text-text">
                      {s.ended_at ? fmtMin(sessionMinutes(s)) : "en cours"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ResizablePanel>

        {/* Objectif quotidien */}
        <ResizablePanel id="timer-goal" title={t("Objectif quotidien")} defaultW={4}>
          <div className="card p-4">
            <div className="rgrid-head flex items-center justify-between">
              <p className="hud-label">{t("objectif quotidien")}</p>
              <span className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bumpGoal(-30)}
                  className="pill h-6 w-6 border border-border text-xs text-text-dim hover:text-text"
                  aria-label="Moins 30 minutes d'objectif"
                  data-tip="−30 minutes"
                  data-tip-sub={t("Objectif de temps concentré pour la journée.")}
                >
                  −
                </button>
                <span className="w-14 text-center font-mono text-xs font-semibold text-text">
                  {fmtMin(goalMin)}
                </span>
                <button
                  type="button"
                  onClick={() => bumpGoal(30)}
                  className="pill h-6 w-6 border border-border text-xs text-text-dim hover:text-text"
                  aria-label={t("Plus 30 minutes d'objectif")}
                  data-tip="+30 minutes"
                  data-tip-sub={t("Objectif de temps concentré pour la journée.")}
                >
                  +
                </button>
              </span>
            </div>
            <p className="mt-2 font-display text-2xl font-extrabold text-blue">
              {fmtMin(stats.todayMin)}
              <span className="text-sm font-normal text-text-dim">
                {" "}
                / {fmtMin(goalMin)}
              </span>
            </p>
            <div className="pill mt-2 h-2 overflow-hidden bg-surface-2">
              <div
                className={`pill h-full transition-[width] duration-500 ${
                  stats.todayMin >= goalMin ? "bg-green" : "bg-blue"
                }`}
                style={{
                  width: `${Math.min((stats.todayMin / goalMin) * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </ResizablePanel>

        {/* Statistiques */}
        <ResizablePanel id="timer-tiles" title="Statistiques" defaultW={4}>
          <div className="auto-tiles panel-stretch gap-3">
            {[
              { label: t("cette semaine"), value: fmtMin(stats.weekMin), accent: "text-text" },
              { label: t("cycles du jour"), value: String(stats.cycles), accent: "text-green" },
              { label: t("moyenne / jour"), value: fmtMin(stats.avg7), accent: "text-text" },
              {
                label: t("objectif atteint"),
                value: stats.todayMin >= goalMin ? "oui" : `${Math.round((stats.todayMin / goalMin) * 100)}%`,
                accent: stats.todayMin >= goalMin ? "text-green" : "text-text-dim",
              },
            ].map((tile) => (
              <div key={tile.label} className="card p-4">
                <p className="hud-label">{tile.label}</p>
                <p className={`mt-1 font-display text-xl font-extrabold ${tile.accent}`}>
                  {tile.value}
                </p>
              </div>
            ))}
          </div>
        </ResizablePanel>

        {/* Méthode */}
        <ResizablePanel id="timer-method" title={t("Méthode")} defaultW={4}>
          <section className="card p-5">
            <h2 className="hud-label">{t("méthode")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-xs leading-relaxed text-text-dim">
              <li>
                <span className="font-semibold text-text">25·5 pomodoro</span> — tâches
                courtes, démarrage difficile : la friction minimale.
              </li>
              <li>
                <span className="font-semibold text-text">50·10 deep work</span> —
                backtesting, montage : assez long pour entrer dans le flow.
              </li>
              <li>
                <span className="font-semibold text-text">90·15 ultradien</span> — aligné
                sur les cycles d'énergie naturels, pour les gros blocs du soir.
              </li>
            </ul>
            <p className="mt-3 text-[11px] text-text-dim">
              Le mode « sur mesure » laisse fixer librement les durées travail et
              pause (1–240 min), mémorisées pour la prochaine session.
            </p>
          </section>
        </ResizablePanel>
      </ResizableGrid>
    </div>
  );
}
