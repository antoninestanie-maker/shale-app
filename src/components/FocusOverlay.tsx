import type { FocusController } from "../lib/useFocus";
import { IconPause, IconPlay, IconStop } from "./icons";

import { t } from "../lib/i18n";
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const R = 120;
const CIRC = 2 * Math.PI * R;

/** Mode session : overlay plein écran + chip compacte quand réduit. */
export default function FocusOverlay({ focus }: { focus: FocusController }) {
  const {
    session,
    remainingSec,
    paused,
    overlayOpen,
    setOverlayOpen,
    stop,
    pause,
    resume,
  } = focus;
  if (!session) return null;

  const totalSec = session.plannedMin * 60;
  const progress = totalSec > 0 ? 1 - remainingSec / totalSec : 0;
  const isBreak = session.kind === "break";
  const accent = isBreak ? "var(--color-green)" : "var(--color-blue)";

  if (!overlayOpen) {
    return (
      <button
        type="button"
        onClick={() => setOverlayOpen(true)}
        className="card fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-3 px-4 py-2"
        data-tip={t("Agrandir la session")}
      >
        <span
          className={paused ? "h-2 w-2 rounded-full" : "animate-pulse-dot h-2 w-2 rounded-full"}
          style={{ backgroundColor: paused ? "var(--color-yellow)" : accent }}
        />
        <span className="font-mono text-sm font-semibold text-text">
          {paused && <IconPause className="mr-1 inline h-3 w-3" />}
          {fmt(remainingSec)}
        </span>
        <span className="max-w-44 truncate text-xs text-text-dim">
          {session.label}
        </span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center justify-center bg-bg/95 backdrop-blur-md">
      <p className="hud-label">{isBreak ? t("pause") : t("focus session")}</p>
      <h2 className="mt-2 max-w-lg truncate px-6 text-2xl text-text">
        {session.label}
      </h2>

      <div className="relative mt-8 h-72 w-72">
        <svg viewBox="0 0 280 280" className="h-full w-full -rotate-90">
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
          />
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke={accent}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progress)}
            style={{
              transition: "stroke-dashoffset 1s linear",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-6xl font-semibold text-text">
            {fmt(remainingSec)}
          </span>
          <span className="mt-2 font-mono text-xs text-text-dim">
            / {session.plannedMin} min
          </span>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={paused ? resume : pause}
          className={`pill inline-flex items-center gap-1.5 border px-5 py-2 text-sm font-semibold ${
            paused
              ? "border-green/40 bg-green/10 text-green hover:bg-green/20"
              : "border-yellow/40 bg-yellow/10 text-yellow hover:bg-yellow/20"
          }`}
        >
          {paused ? (
            <>
              <IconPlay className="h-3.5 w-3.5" /> {t("Reprendre")}
            </>
          ) : (
            <>
              <IconPause className="h-3.5 w-3.5" /> {t("Pause")}
            </>
          )}
        </button>
        <button
          type="button"
          onClick={stop}
          className="pill inline-flex items-center gap-1.5 border border-red/40 bg-red/10 px-5 py-2 text-sm font-semibold text-red hover:bg-red/20"
        >
          <IconStop className="h-3.5 w-3.5" /> {t("Terminer")}
        </button>
        <button
          type="button"
          onClick={() => setOverlayOpen(false)}
          className="pill border border-border px-5 py-2 text-sm text-text-dim hover:text-text"
        >
          {t("Réduire")}
        </button>
      </div>

      <p className="hud-label mt-10">
        {t("la fenêtre peut être réduite — le chrono continue")}
      </p>
    </div>
  );
}
