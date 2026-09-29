// L'écran de séance, en grand : le plein écran de l'app (`FocusOverlay`) et la
// fenêtre séparée (`TimerPane`) sont le MÊME écran. Disposition reprise de la
// vidéo d'Antonin : le genre de séance en haut à gauche, les volets au centre,
// une pastille « Pause » dessous — et les gestes de fenêtre, discrets, en haut
// à droite (toujours visibles : rien n'apparaît au seul survol, AMELIORATIONS-UI § B).
import { useEffect, type ReactNode } from "react";
import { t } from "../../lib/i18n";
import { afficheLesHeures } from "../../lib/timerFenetre";
import { IconPause, IconPlay, IconStop } from "../icons";
import HorlogeVolets from "./HorlogeVolets";

export interface SeanceAffichee {
  label: string;
  kind: "focus" | "break";
  plannedMin: number;
}

interface Props {
  seance: SeanceAffichee;
  restantSec: number;
  enPause: boolean;
  onBasculerPause: () => void;
  onTerminer: () => void;
  /** Les gestes de fenêtre (plein écran, fenêtre séparée, réduire…), en haut à droite. */
  actions: ReactNode;
  /** Marge à gauche de l'en-tête : les pastilles de macOS occupent le coin. */
  retraitPastilles?: boolean;
  /** Échap : ce que la fenêtre fait de mieux pour « sortir » (réduire, quitter le plein écran). */
  onEchap?: () => void;
  /** Un fond qui sert de poignée pour déplacer la fenêtre (fenêtre séparée). */
  poignee?: boolean;
}

/** Espace ne doit pas basculer deux fois quand un bouton a le focus. */
function cibleInteractive(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest("button, a, input, textarea, select, [contenteditable='true']");
}

export default function EcranTimer({
  seance,
  restantSec,
  enPause,
  onBasculerPause,
  onTerminer,
  actions,
  retraitPastilles = false,
  onEchap,
  poignee = false,
}: Props) {
  const estPause = seance.kind === "break";
  const totalSec = seance.plannedMin * 60;
  const progression = totalSec > 0 ? Math.min(1, Math.max(0, 1 - restantSec / totalSec)) : 0;

  // Clavier : Espace met en pause / reprend, Échap sort.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === " " && !cibleInteractive(e.target)) {
        e.preventDefault();
        onBasculerPause();
      } else if (e.key === "Escape" && onEchap) {
        e.preventDefault();
        onEchap();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [onBasculerPause, onEchap]);

  return (
    <div
      className="flex h-full w-full flex-col"
      {...(poignee ? { "data-tauri-drag-region": "deep" } : {})}
    >
      <header
        className={`flex items-start justify-between gap-4 px-6 pt-[max(1.25rem,env(safe-area-inset-top))] ${retraitPastilles ? "pl-[88px]" : ""}`}
      >
        <div className="min-w-0">
          <p className="hud-label">
            {estPause ? t("pause") : t("focus session")}
            {enPause ? ` — ${t("en pause")}` : ""}
          </p>
          {!estPause && (
            <p className="mt-1 max-w-[42ch] truncate text-sm text-text-dim">{seance.label}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8">
        <HorlogeVolets
          restantSec={restantSec}
          avecHeures={afficheLesHeures(seance.plannedMin)}
          enPause={enPause}
          // La hauteur de fenêtre MOINS l'en-tête, la jauge et les boutons
          // (≈ 15rem) : dans une petite fenêtre séparée (560 × 360), 56vh
          // laissait passer les boutons sous le bord. Plancher à 4rem.
          hauteurMax="max(4rem, min(calc(100vh - 15rem), 36rem))"
          className="max-w-[1100px]"
        />

        {/* Progression de la séance : une jauge linéaire, donc le dégradé de
            marque (DESIGN.md, l'un de ses cinq emplois) ; la pause est à l'encre. */}
        <div
          className="pill mt-[clamp(1rem,4vh,2.25rem)] h-1 w-[min(22rem,60%)] overflow-hidden bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progression * 100)}
          aria-label={t("Progression de la séance")}
        >
          <div
            className={`pill h-full transition-[width] duration-1000 ease-linear ${
              estPause ? "bg-[var(--color-success-fill)]" : "bg-[image:var(--gradient-brand)]"
            }`}
            style={{ width: `${progression * 100}%` }}
          />
        </div>

        <div className="mt-[clamp(1rem,3.5vh,2rem)] flex items-center gap-2.5">
          <button
            type="button"
            onClick={onBasculerPause}
            data-tip={enPause ? t("Reprendre la session") : t("Mettre en pause")}
            data-tip-sub={t("Raccourci : Espace")}
            className={`pill inline-flex min-w-[8.5rem] items-center justify-center gap-2 px-7 py-2.5 text-sm font-semibold ${
              enPause ? "fill-primary" : "border border-border-strong text-text hover:bg-overlay"
            }`}
          >
            {enPause ? (
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
            onClick={onTerminer}
            aria-label={t("Terminer la session")}
            data-tip={t("Terminer la session")}
            data-tip-sub={t("Clôt et enregistre le temps concentré effectué.")}
            className="pill inline-flex h-10 w-10 items-center justify-center border border-border text-text-dim hover:border-red/40 hover:text-red"
          >
            <IconStop className="h-3.5 w-3.5" />
          </button>
        </div>
      </main>
    </div>
  );
}

/** Un geste de fenêtre, en haut à droite : discret, mais toujours là. */
export function ActionFenetre({
  onClick,
  label,
  tipSub,
  children,
  actif = false,
}: {
  onClick: () => void;
  label: string;
  tipSub?: string;
  children: ReactNode;
  actif?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={actif || undefined}
      data-tip={label}
      data-tip-sub={tipSub}
      className={`pill inline-flex h-9 items-center gap-1.5 border px-3 text-xs font-medium transition-colors ${
        actif
          ? "border-blue/40 bg-blue/10 text-blue"
          : "border-border text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
