import { useCallback, useEffect, useRef, useState } from "react";
import { benchMeta } from "../lib/benchmark";
import { addBenchmarkResult } from "../lib/repo";
import { playError, playLevelUp, playTile, unlockTones } from "../lib/tones";
import type { BenchTest } from "../lib/types";
import { IconSound, IconSoundOff, IconX } from "./icons";

import { t } from "../lib/i18n";
interface TestProps {
  preSession?: boolean;
  onClose: () => void;
  /** score enregistré (réaction: ms, mémoire/séquence: niveau) */
  onSaved?: (score: number) => void;
}

// — Coquille de modal partagée —

function Shell({
  test,
  onClose,
  children,
  wide,
}: {
  test: BenchTest;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const meta = benchMeta()[test];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className={`card w-full ${wide ? "max-w-2xl" : "max-w-lg"} bg-surface p-6`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg text-text">{meta.label}</h2>
            <p className="mt-0.5 text-xs text-text-dim">{meta.hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-text-dim hover:text-text"
            aria-label={t("Fermer")}
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ————————————————————————————————————————————————
//  Test de réaction (cibles mobiles) — cœur de l'alcootest pré-session
// ————————————————————————————————————————————————

const REACTION_ROUNDS = 5;

type RPhase = "intro" | "wait" | "go" | "early" | "done";

export function ReactionTest({ preSession, onClose, onSaved }: TestProps) {
  const [phase, setPhase] = useState<RPhase>("intro");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const [avg, setAvg] = useState<number | null>(null);
  const shownAt = useRef(0);
  const waitTimer = useRef<number | undefined>(undefined);

  const clearTimers = useCallback(
    () => window.clearTimeout(waitTimer.current),
    [],
  );
  useEffect(() => () => clearTimers(), [clearTimers]);

  const beginRound = useCallback(() => {
    setPhase("wait");
    clearTimers();
    // délai aléatoire avant le passage au vert
    waitTimer.current = window.setTimeout(
      () => {
        shownAt.current = performance.now();
        setPhase("go");
      },
      1100 + Math.random() * 2400,
    );
  }, [clearTimers]);

  const start = useCallback(() => {
    setTimes([]);
    setRound(0);
    setAvg(null);
    beginRound();
  }, [beginRound]);

  const finish = useCallback(
    async (all: number[]) => {
      clearTimers();
      const mean = Math.round(all.reduce((a, v) => a + v, 0) / all.length);
      setAvg(mean);
      setPhase("done");
      await addBenchmarkResult({
        test: "reaction",
        score: mean,
        detail: JSON.stringify(all),
        preSession,
      });
      onSaved?.(mean);
    },
    [clearTimers, onSaved, preSession],
  );

  // Clic sur le grand panneau : trop tôt en rouge, chrono en vert.
  const handlePanel = () => {
    if (phase === "wait") {
      clearTimers();
      setPhase("early");
      waitTimer.current = window.setTimeout(() => beginRound(), 1000);
      return;
    }
    if (phase === "go") {
      const dt = Math.round(performance.now() - shownAt.current);
      const all = [...times, dt];
      setTimes(all);
      if (all.length >= REACTION_ROUNDS) finish(all);
      else {
        setRound((r) => r + 1);
        beginRound();
      }
    }
  };

  const best = times.length ? Math.min(...times) : null;

  const panelStyle: Record<string, { bg: string; fg: string; title: string; sub: string }> = {
    wait: {
      bg: "var(--color-red)",
      fg: "#fff",
      title: "Attends…",
      sub: t("Clique dès que ça passe au vert"),
    },
    early: {
      bg: "color-mix(in srgb, var(--color-red) 72%, black)",
      fg: "#fff",
      title: t("Trop tôt !"),
      sub: t("On refait cette manche…"),
    },
    go: {
      bg: "var(--color-green)",
      fg: "var(--color-on-green)",
      title: "CLIQUE !",
      sub: "",
    },
  };

  return (
    <Shell test="reaction" onClose={onClose} wide>
      {phase === "intro" ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-8 text-center">
          <p className="max-w-sm text-sm text-text-dim">
            {t("Le panneau est")} <span className="font-semibold text-red">rouge</span>.
            Dès qu'il passe au{" "}
            <span className="font-semibold text-green">vert</span>, clique le plus
            vite possible. {REACTION_ROUNDS} manches, sans anticiper.
          </p>
          <button
            type="button"
            onClick={start}
            className="pill bg-blue px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {t("Démarrer")}
          </button>
        </div>
      ) : phase === "done" && avg !== null ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <p className="hud-label">temps moyen</p>
          <p className="font-display text-5xl font-extrabold text-blue">
            {avg}
            <span className="ml-1 text-lg text-text-dim">ms</span>
          </p>
          <p className="text-sm text-text-dim">
            Meilleure manche : {best} ms · {REACTION_ROUNDS} manches
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={start}
              className="pill border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
            >
              Recommencer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pill bg-blue px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Terminer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="hud-label">
              manche {Math.min(round + 1, REACTION_ROUNDS)}/{REACTION_ROUNDS}
            </span>
            {times.length > 0 && (
              <span className="font-mono text-xs text-text-dim">
                dernier : {times[times.length - 1]} ms
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handlePanel}
            aria-label="Panneau de réaction"
            className="flex h-[340px] w-full flex-col items-center justify-center rounded-[14px] text-center transition-colors duration-75"
            style={{ backgroundColor: panelStyle[phase]?.bg ?? "var(--color-red)" }}
          >
            <span
              className="font-display text-4xl font-extrabold"
              style={{ color: panelStyle[phase]?.fg ?? "#fff" }}
            >
              {panelStyle[phase]?.title}
            </span>
            {panelStyle[phase]?.sub && (
              <span
                className="mt-2 text-sm font-medium opacity-90"
                style={{ color: panelStyle[phase]?.fg ?? "#fff" }}
              >
                {panelStyle[phase]?.sub}
              </span>
            )}
          </button>
        </div>
      )}
    </Shell>
  );
}

// ————————————————————————————————————————————————
//  Mémoire des chiffres
// ————————————————————————————————————————————————

type MPhase = "intro" | "show" | "input" | "done";

export function NumberMemoryTest({ onClose, onSaved }: TestProps) {
  const [phase, setPhase] = useState<MPhase>("intro");
  const [digits, setDigits] = useState(3);
  const [current, setCurrent] = useState("");
  const [entry, setEntry] = useState("");
  const [passed, setPassed] = useState(0);
  const [failed, setFailed] = useState(false);
  const showTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(showTimer.current), []);

  const showNumber = useCallback((d: number) => {
    let n = "";
    for (let i = 0; i < d; i++)
      n += i === 0 ? 1 + Math.floor(Math.random() * 9) : Math.floor(Math.random() * 10);
    setCurrent(n);
    setEntry("");
    setPhase("show");
    window.clearTimeout(showTimer.current);
    showTimer.current = window.setTimeout(() => setPhase("input"), 1400 + d * 350);
  }, []);

  const start = () => {
    setDigits(3);
    setPassed(0);
    setFailed(false);
    showNumber(3);
  };

  const submit = async () => {
    const ok = entry.trim() === current;
    if (ok) {
      setPassed(current.length);
      const next = digits + 1;
      setDigits(next);
      showNumber(next);
    } else {
      setFailed(true);
      setPhase("done");
      await addBenchmarkResult({ test: "memory", score: passed });
      onSaved?.(passed);
    }
  };

  return (
    <Shell test="memory" onClose={onClose}>
      {phase === "intro" ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-8 text-center">
          <p className="max-w-sm text-sm text-text-dim">
            Un nombre s'affiche brièvement, de plus en plus long. Retiens-le puis
            saisis-le. Le test s'arrête à la première erreur.
          </p>
          <button
            type="button"
            onClick={start}
            className="pill bg-green px-6 py-2.5 text-sm font-semibold text-on-green hover:opacity-90"
          >
            {t("Démarrer")}
          </button>
        </div>
      ) : phase === "show" ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-10 text-center">
          <p className="hud-label">{t("mémorise")}</p>
          <p className="font-mono text-4xl font-bold tracking-[0.2em] text-text">
            {current}
          </p>
        </div>
      ) : phase === "input" ? (
        <form
          className="mt-6 flex flex-col items-center gap-4 py-8"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <p className="hud-label">saisis le nombre ({digits} chiffres)</p>
          <input
            autoFocus
            value={entry}
            onChange={(e) => setEntry(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            className="w-56 rounded-[10px] border border-border bg-surface-2 px-4 py-3 text-center font-mono text-2xl tracking-widest text-text focus:border-green focus:outline-none"
          />
          <button
            type="submit"
            className="pill bg-green px-6 py-2 text-sm font-semibold text-on-green hover:opacity-90"
          >
            Valider
          </button>
        </form>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <p className="hud-label">score</p>
          <p className="font-display text-5xl font-extrabold text-green">
            {passed}
            <span className="ml-1 text-lg text-text-dim">chiffres</span>
          </p>
          {failed && (
            <p className="text-sm text-text-dim">
              C'était {current}. Tu avais saisi {entry || "—"}.
            </p>
          )}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={start}
              className="pill border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
            >
              Recommencer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pill bg-green px-5 py-2 text-sm font-semibold text-on-green hover:opacity-90"
            >
              Terminer
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

// ————————————————————————————————————————————————
//  Mémoire visuelle (séquence de cases, style Simon)
// ————————————————————————————————————————————————

type SPhase = "intro" | "show" | "input" | "done";
const GRID = 9; // 3×3

export function SequenceMemoryTest({ onClose, onSaved }: TestProps) {
  const [phase, setPhase] = useState<SPhase>("intro");
  const [seq, setSeq] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null); // case rejouée par le test
  const [press, setPress] = useState<number | null>(null); // case enfoncée par le joueur
  const [step, setStep] = useState(0); // index dans la saisie utilisateur
  const [wrong, setWrong] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const timers = useRef<number[]>([]);
  // Les timeouts lisent le réglage au moment où ils tirent, pas à la création.
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }, []);
  useEffect(() => () => clearTimers(), [clearTimers]);

  /** Tout timeout passe par ici : sinon il survit au démontage du modal. */
  const push = useCallback((id: number) => {
    timers.current.push(id);
  }, []);

  const tile = useCallback((i: number, ms?: number) => {
    if (!mutedRef.current) playTile(i, ms);
  }, []);

  const playSequence = useCallback(
    (s: number[]) => {
      setPhase("show");
      setStep(0);
      setPress(null);
      setWrong(null);
      clearTimers();
      s.forEach((t, i) => {
        push(
          window.setTimeout(() => {
            setFlash(t);
            tile(t, 320); // la case CHANTE en s'allumant
          }, 600 * i + 250),
        );
        push(window.setTimeout(() => setFlash(null), 600 * i + 250 + 380));
      });
      push(window.setTimeout(() => setPhase("input"), 600 * s.length + 300));
    },
    [clearTimers, push, tile],
  );

  const nextLevel = useCallback(
    (prev: number[]) => {
      const s = [...prev, Math.floor(Math.random() * GRID)];
      setSeq(s);
      setLevel(s.length);
      playSequence(s);
    },
    [playSequence],
  );

  const start = () => {
    setWrong(null);
    unlockTones(); // WKWebView : l'audio ne démarre que sur un geste utilisateur
    nextLevel([]);
  };

  const finish = useCallback(
    async (score: number) => {
      clearTimers();
      setPhase("done");
      await addBenchmarkResult({ test: "sequence", score });
      onSaved?.(score);
    },
    [clearTimers, onSaved],
  );

  const clickTile = useCallback(
    (t: number) => {
      // `wrong` verrouille la grille le temps de montrer la case fautive.
      if (phase !== "input" || wrong !== null) return;

      // Retour immédiat — c'est ce qui manquait : la case s'allume ET sonne.
      setPress(t);
      push(window.setTimeout(() => setPress((p) => (p === t ? null : p)), 190));
      tile(t, 200);

      if (t !== seq[step]) {
        setWrong(t);
        if (!mutedRef.current) playError();
        // On LAISSE VOIR la case fautive avant de basculer sur le score.
        const completed = Math.max(seq.length - 1, 0);
        push(window.setTimeout(() => void finish(completed), 800));
        return;
      }

      const next = step + 1;
      if (next < seq.length) {
        setStep(next);
        return;
      }
      // Niveau réussi → arpège, puis séquence suivante. On repasse en "show"
      // TOUT DE SUITE : sinon la grille reste cliquable pendant l'arpège et un
      // clic parasite serait évalué contre l'ancienne séquence (échec injustifié).
      setStep(0);
      setPhase("show");
      if (!mutedRef.current) playLevelUp();
      push(window.setTimeout(() => nextLevel(seq), 460));
    },
    [phase, wrong, seq, step, push, tile, finish, nextLevel],
  );

  // Jouable au clavier : touches 1–9 = cases de haut en bas, de gauche à droite.
  useEffect(() => {
    if (phase !== "input") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > GRID) return;
      e.preventDefault();
      clickTile(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, clickTile]);

  return (
    <Shell test="sequence" onClose={onClose}>
      {phase === "intro" ? (
        <div className="mt-6 flex flex-col items-center gap-4 py-8 text-center">
          <p className="max-w-sm text-sm text-text-dim">
            Une séquence de cases s'allume, un pas plus longue à chaque niveau.
            Reproduis-la dans l'ordre — chaque case a sa note, à la souris ou au
            clavier (touches 1–9).
          </p>
          <button
            type="button"
            onClick={start}
            className="pill px-6 py-2.5 text-sm font-semibold text-black hover:opacity-90"
            style={{ backgroundColor: "var(--color-yellow)" }}
          >
            {t("Démarrer")}
          </button>
        </div>
      ) : phase === "done" ? (
        <div className="mt-6 flex flex-col items-center gap-3 py-8 text-center">
          <p className="hud-label">niveau atteint</p>
          <p className="font-display text-5xl font-extrabold text-yellow">
            {Math.max(seq.length - 1, 0)}
          </p>
          <p className="text-sm text-text-dim">
            Séquence de {seq.length} cases — une de trop.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={start}
              className="pill border border-border px-4 py-2 text-sm font-medium text-text hover:bg-surface-2"
            >
              Recommencer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="pill px-5 py-2 text-sm font-semibold text-black hover:opacity-90"
              style={{ backgroundColor: "var(--color-yellow)" }}
            >
              Terminer
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex flex-col items-center gap-4 py-4">
          <div className="flex w-full items-center justify-between">
            <span className="hud-label">
              niveau {level} · {phase === "show" ? "observe" : t("à toi")}
            </span>
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? t("Activer le son") : t("Couper le son")}
              aria-pressed={!muted}
              data-tip={muted ? t("Activer le son") : t("Couper le son")}
              data-tip-sub={t("Chaque case a sa note — utile pour mémoriser à l'oreille.")}
              className={`pill flex h-7 w-7 items-center justify-center border transition-colors ${
                muted
                  ? "border-border text-text-dim hover:text-text"
                  : "border-yellow/40 bg-yellow/10 text-yellow"
              }`}
            >
              {muted ? (
                <IconSoundOff className="h-3.5 w-3.5" />
              ) : (
                <IconSound className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {/* Grille de jeu : 3×3 STRICT (l'épreuve n'a de sens qu'en carré),
              d'où un grid-cols fixe et non `.auto-tiles*` — on est dans un
              modal, pas dans un widget redimensionnable. */}
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: GRID }).map((_, i) => {
              const lit = flash === i || press === i;
              const isWrong = wrong === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={phase !== "input" || wrong !== null}
                  onClick={() => clickTile(i)}
                  className="flex h-20 w-20 items-center justify-center rounded-[12px] border font-mono text-xs transition-colors duration-100"
                  style={{
                    backgroundColor: isWrong
                      ? "color-mix(in srgb, var(--color-red) 60%, transparent)"
                      : lit
                        ? "var(--color-yellow)"
                        : "var(--color-surface-2)",
                    borderColor: isWrong
                      ? "var(--color-red)"
                      : lit
                        ? "var(--color-yellow)"
                        : "var(--color-border)",
                    boxShadow: lit
                      ? "0 0 20px color-mix(in srgb, var(--color-yellow) 70%, transparent)"
                      : "none",
                    // Repère clavier discret, invisible quand la case s'allume.
                    color: lit || isWrong ? "transparent" : "var(--color-text-dim)",
                  }}
                  aria-label={`Case ${i + 1}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Shell>
  );
}
