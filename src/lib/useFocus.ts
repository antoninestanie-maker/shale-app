// Session de focus (Pomodoro) : compte à rebours robuste (basé sur l'horloge,
// survit à la mise en veille), persistée en base, reprise au redémarrage,
// pause/reprise, et enchaînement automatique travail → pause.
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "./i18n";
import { delaiAvantProchaineSeconde } from "./timerFenetre";
import { pleinEcranApresDemarrage } from "./seance/focusTache";
import { finEnregistree, horodatageLocal, lirePause, retenirPause } from "./seance/duree";
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
  /** Le départ du compte à rebours — décalé de chaque pause. */
  startedAtMs: number;
  /**
   * L'heure VRAIE du début (`started_at` en base). Absente = `startedAtMs`.
   * ⚠️ C'est elle, plus le temps travaillé, qui donne `ended_at` (`seance/duree.ts`).
   */
  debutReelMs?: number;
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
  /**
   * `true` : ouvrir le plein écran avec la séance. ⚠️ Absent, on ne l'ouvre PAS
   * (2026-10-12) — avant, c'était l'inverse, et « Focus 25 min » depuis une
   * tâche recouvrait toute l'app. Voir `pleinEcranApresDemarrage`.
   */
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

/** L'instant à écrire dans `ended_at` : début vrai + temps travaillé (`seance/duree.ts`). */
function finDe(s: ActiveFocus, pausedAt: number | null, maintenantMs = Date.now()): number {
  return finEnregistree({
    debutReelMs: s.debutReelMs ?? s.startedAtMs,
    departMs: s.startedAtMs,
    plannedMin: s.plannedMin,
    pauseeA: pausedAt,
    maintenantMs,
  });
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
  /**
   * La séance OUVERTE EN BASE, vue par `start` sans attendre un rendu.
   *
   * ⚠️ Lancer une séance par-dessus une autre (« Focus 25 min » pendant une
   * pause, 2026-10-12) doit clore la première : sinon sa ligne reste sans
   * `ended_at`, et c'est elle que `fetchActiveFocus` peut reprendre au prochain
   * démarrage. Remise à `null` dès que la séance est close (arrêt, fin
   * naturelle) pour ne jamais la clore deux fois.
   */
  const ouverte = useRef<number | null>(null);
  /**
   * La séance et sa pause, vues par `start` (qui n'a pas de dépendances) : pour
   * clore une séance par-dessus laquelle on en lance une autre avec SA durée
   * travaillée, pas l'heure du clic.
   */
  const etat = useRef<{ session: ActiveFocus | null; pausedAt: number | null }>({ session: null, pausedAt: null });
  etat.current = { session, pausedAt };
  /** Un démarrage est en route : un second clic ne lance pas une seconde séance. */
  const demarrage = useRef(false);

  // reprise d'une session ouverte au démarrage
  useEffect(() => {
    fetchActiveFocus().then(async (row) => {
      if (!row) return;
      const debutReelMs = parseLocal(row.started_at);
      // ⭐ Les pauses déjà prises, et celle en cours, survivent au redémarrage
      // (A07b-20) : sans elles, le temps de pause était compté comme travaillé.
      const pause = lirePause(row.id);
      const startedAtMs = debutReelMs + (pause?.decalageMs ?? 0);
      const pauseeA = pause?.pauseeA ?? null;
      if (pauseeA !== null || Date.now() < endOf(startedAtMs, row.planned_min)) {
        ouverte.current = row.id;
        setSession({
          id: row.id,
          label: row.label ?? "Focus",
          taskId: row.task_id,
          plannedMin: row.planned_min,
          startedAtMs,
          debutReelMs,
          kind: (row.kind as "focus" | "break") ?? "focus",
        });
        if (pauseeA !== null) setPausedAt(pauseeA);
      } else {
        // La séance s'est finie pendant que l'app était fermée : elle a duré ce
        // qui était prévu, pas jusqu'à maintenant.
        retenirPause(null);
        await endFocus(row.id, horodatageLocal(debutReelMs + row.planned_min * 60_000));
      }
    });
  }, []);

  // Battement pendant une session active (pas en pause), CALÉ sur l'instant où
  // le chiffre change — pas un `setInterval(1000)` au hasard du démarrage, qui
  // sautait une seconde puis en montrait une deux fois : sur l'horloge à volets
  // (2026-09-29), deux bascules collées puis un trou. Voir
  // `delaiAvantProchaineSeconde`.
  useEffect(() => {
    if (!session || pausedAt !== null) return;
    const fin = endOf(session.startedAtMs, session.plannedMin);
    let id = 0;
    const battre = () => {
      const maintenant = Date.now();
      setNowMs(maintenant);
      id = window.setTimeout(battre, delaiAvantProchaineSeconde(fin, maintenant));
    };
    id = window.setTimeout(battre, delaiAvantProchaineSeconde(fin, Date.now()));
    return () => window.clearTimeout(id);
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
    if (demarrage.current) return;
    demarrage.current = true;
    try {
      // Une séance encore ouverte (une pause qu'on coupe pour se remettre au
      // travail) est close AVANT d'écrire la suivante.
      const precedente = ouverte.current;
      if (precedente !== null) {
        ouverte.current = null;
        const enCours = etat.current.session;
        await endFocus(
          precedente,
          enCours && enCours.id === precedente
            ? horodatageLocal(finDe(enCours, etat.current.pausedAt))
            : localNow(),
        );
      }
      const input: FocusInput = {
        task_id: opts.taskId ?? null,
        label: opts.taskId ? null : opts.label,
        planned_min: opts.minutes,
        kind: opts.kind ?? "focus",
      };
      const id = await startFocus(input);
      ouverte.current = id;
      retenirPause(null);
      const depart = Date.now();
      setSession({
        id,
        label: opts.label,
        taskId: opts.taskId ?? null,
        plannedMin: opts.minutes,
        startedAtMs: depart,
        debutReelMs: depart,
        kind: opts.kind ?? "focus",
        breakMin: opts.breakMin,
      });
      setNowMs(Date.now());
      setPausedAt(null);
      finishing.current = false;

      // ⭐ Lancer une séance N'OUVRE PAS le plein écran (2026-10-12, Antonin :
      // « ça, c'est seulement si l'utilisateur le décide »). Il ne s'ouvre que
      // sur demande ; sinon il reste comme il était — c'est ce qui fait qu'une
      // pause enchaînée garde l'état de la séance qui finit.
      setOverlayOpen((ouvert) => pleinEcranApresDemarrage(ouvert, opts.openOverlay));
    } finally {
      demarrage.current = false;
    }
    // ⭐ Relire (temps-6, 2026-10-20) : « Sessions du jour » lit `data.focusSessions`.
    // Sans relecture, la séance lancée n'y paraissait pas, et la pause qu'elle
    // venait de clore restait affichée « en cours ».
    await refresh();
  }, [refresh]);

  const stop = useCallback(async () => {
    if (!session) return;
    ouverte.current = null;
    // Le temps TRAVAILLÉ, pas l'heure du clic : les pauses n'y sont pas.
    await endFocus(session.id, horodatageLocal(finDe(session, pausedAt)));
    retenirPause(null);
    setSession(null);
    setPausedAt(null);
    setOverlayOpen(false);
    await refresh();
  }, [session, pausedAt, refresh]);

  const pause = useCallback(() => {
    if (!session || pausedAt !== null) return;
    const maintenant = Date.now();
    setPausedAt(maintenant);
    retenirPause({ id: session.id, decalageMs: session.startedAtMs - (session.debutReelMs ?? session.startedAtMs), pauseeA: maintenant });
  }, [session, pausedAt]);

  const resume = useCallback(() => {
    if (!session || pausedAt === null) return;
    // on décale le départ du temps passé en pause : le chrono reprend où il était
    const shift = Date.now() - pausedAt;
    const reprise = { ...session, startedAtMs: session.startedAtMs + shift };
    setSession(reprise);
    setPausedAt(null);
    setNowMs(Date.now());
    retenirPause({ id: reprise.id, decalageMs: reprise.startedAtMs - (reprise.debutReelMs ?? reprise.startedAtMs), pauseeA: null });
  }, [session, pausedAt]);

  // fin naturelle du compte à rebours
  useEffect(() => {
    if (!session || pausedAt !== null || remainingSec > 0 || finishing.current)
      return;
    finishing.current = true;
    (async () => {
      ouverte.current = null;
      // ⭐ Arrivée au bout : elle a duré ce qui était prévu, même si le minuteur
      // ne s'est réveillé qu'au retour de veille ou du premier plan (temps-2).
      await endFocus(session.id, horodatageLocal(finDe(session, null, Infinity)));
      retenirPause(null);
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
        // Sans `openOverlay` : la pause garde le plein écran ouvert ou fermé,
        // comme la séance qui finit l'avait. `start` relit la base.
        await start({ minutes: session.breakMin, label: "Pause", kind: "break" });
        return;
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
  }, [session, pausedAt, remainingSec, refresh, start]);

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
