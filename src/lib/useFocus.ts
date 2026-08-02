// Session de focus (Pomodoro) : compte à rebours robuste (basé sur l'horloge,
// survit à la mise en veille), persistée en base, reprise au redémarrage,
// pause/reprise, et enchaînement automatique travail → pause.
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import {
  endFocus,
  fetchActiveFocus,
  isTauri,
  localNow,
  startFocus,
  type FocusInput,
} from "./repo";

export interface ActiveFocus {
  id: number;
  label: string;
  taskId: number | null;
  plannedMin: number;
  startedAtMs: number;
  kind: "focus" | "break";
  /** pause auto lancée à la fin de la session de travail */
  breakMin?: number;
}

export interface StartOptions {
  minutes: number;
  taskId?: number | null;
  label: string;
  kind?: "focus" | "break";
  breakMin?: number;
  openOverlay?: boolean;
}

export interface FocusController {
  session: ActiveFocus | null;
  remainingSec: number;
  paused: boolean;
  overlayOpen: boolean;
  setOverlayOpen: (open: boolean) => void;
  start: (opts: StartOptions) => Promise<void>;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
}

function parseLocal(dt: string): number {
  return new Date(dt.replace(" ", "T")).getTime();
}

function endOf(startedAtMs: number, plannedMin: number): number {
  return startedAtMs + plannedMin * 60_000;
}

async function notify(title: string, body: string) {
  if (!isTauri) return;
  const { isPermissionGranted, requestPermission, sendNotification } =
    await import("@tauri-apps/plugin-notification");
  let ok = await isPermissionGranted();
  if (!ok) ok = (await requestPermission()) === "granted";
  if (ok) sendNotification({ title, body });
}

export function useFocus(refresh: () => Promise<void>): FocusController {
  const [session, setSession] = useState<ActiveFocus | null>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const finishing = useRef(false);

  // reprise d'une session ouverte au démarrage
  useEffect(() => {
    fetchActiveFocus().then(async (row) => {
      if (!row) return;
      const startedAtMs = parseLocal(row.started_at);
      if (Date.now() < endOf(startedAtMs, row.planned_min)) {
        setSession({
          id: row.id,
          label: row.label ?? "Focus",
          taskId: row.task_id,
          plannedMin: row.planned_min,
          startedAtMs,
          kind: (row.kind as "focus" | "break") ?? "focus",
        });
      } else {
        // la session s'est finie pendant que l'app était fermée
        const end = new Date(endOf(startedAtMs, row.planned_min));
        await endFocus(
          row.id,
          `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")} ${end.toTimeString().slice(0, 8)}`,
        );
      }
    });
  }, []);

  // tick 1 s pendant une session active (pas en pause)
  useEffect(() => {
    if (!session || pausedAt !== null) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [session, pausedAt]);

  const effectiveNow = pausedAt ?? nowMs;
  const remainingSec = session
    ? Math.max(
        0,
        Math.round(
          (endOf(session.startedAtMs, session.plannedMin) - effectiveNow) / 1000,
        ),
      )
    : 0;

  const start = useCallback(async (opts: StartOptions) => {
    const input: FocusInput = {
      task_id: opts.taskId ?? null,
      label: opts.taskId ? null : opts.label,
      planned_min: opts.minutes,
      kind: opts.kind ?? "focus",
    };
    const id = await startFocus(input);
    setSession({
      id,
      label: opts.label,
      taskId: opts.taskId ?? null,
      plannedMin: opts.minutes,
      startedAtMs: Date.now(),
      kind: opts.kind ?? "focus",
      breakMin: opts.breakMin,
    });
    setNowMs(Date.now());
    setPausedAt(null);
    finishing.current = false;

    // Plein écran facultatif (compte à rebours sans distraction) : ouvert à la
    // demande via le bouton « Plein écran ». Le mode concentration automatique
    // (et l'ambiance sonore) ont été retirés le 2026-07-23.
    if (opts.openOverlay !== false) setOverlayOpen(true);
  }, []);

  const stop = useCallback(async () => {
    if (!session) return;
    await endFocus(session.id, localNow());
    setSession(null);
    setPausedAt(null);
    setOverlayOpen(false);
    await refresh();
  }, [session, refresh]);

  const pause = useCallback(() => {
    if (session && pausedAt === null) setPausedAt(Date.now());
  }, [session, pausedAt]);

  const resume = useCallback(() => {
    if (!session || pausedAt === null) return;
    // on décale le départ du temps passé en pause : le chrono reprend où il était
    const shift = Date.now() - pausedAt;
    setSession({ ...session, startedAtMs: session.startedAtMs + shift });
    setPausedAt(null);
    setNowMs(Date.now());
  }, [session, pausedAt]);

  // fin naturelle du compte à rebours
  useEffect(() => {
    if (!session || pausedAt !== null || remainingSec > 0 || finishing.current)
      return;
    finishing.current = true;
    (async () => {
      await endFocus(session.id, localNow());
      const isBreak = session.kind === "break";
      if (isBreak) {
        await notify(t("Pause terminée"), t("On reprend le travail."));
        setSession(null);
        setOverlayOpen(false);
      } else if (session.breakMin) {
        // enchaînement automatique → pause
        await notify(
          t("Focus terminé"),
          t("{work} min sur « {label} ». Pause de {pause} min.", { work: session.plannedMin, label: session.label, pause: session.breakMin }),
        );
        const keepOverlay = overlayOpen;
        await start({
          minutes: session.breakMin,
          label: "Pause",
          kind: "break",
          openOverlay: keepOverlay,
        });
      } else {
        await notify(
          t("Focus terminé"),
          t("{work} minutes sur « {label} ». Bien joué.", { work: session.plannedMin, label: session.label }),
        );
        setSession(null);
        setOverlayOpen(false);
      }
      await refresh();
    })();
  }, [session, pausedAt, remainingSec, refresh, start, overlayOpen]);

  return {
    session,
    remainingSec,
    paused: pausedAt !== null,
    overlayOpen,
    setOverlayOpen,
    start,
    stop,
    pause,
    resume,
  };
}
