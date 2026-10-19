// L'écran de séance, en grand : le plein écran de l'app (`FocusOverlay`) et la
// fenêtre séparée (`TimerPane`) sont le MÊME écran. Disposition reprise de la
// vidéo d'Antonin : le genre de séance en haut à gauche, les volets au centre,
// une pastille « Pause » dessous — et les gestes de fenêtre, discrets, en haut
// à droite (toujours visibles : rien n'apparaît au seul survol, AMELIORATIONS-UI § B).
//
// ⭐ Mode ÉPURÉ (2026-09-29, demande d'Antonin après le premier essai) : « seul
// le timer est affiché — pas de bouton pause, rien ; on sort avec Échap et
// c'est tout, là on retrouve les boutons ». Donc ni en-tête, ni jauge, ni
// bouton, et le curseur s'efface quand la souris ne bouge plus. Espace reste
// une pause silencieuse (le chiffre s'efface à moitié). Sans clavier, un
// toucher fait office d'Échap ; à la souris, un double-clic aussi.
//
// ⚠️ Depuis le 2026-10-12, ce mode ne sert PLUS qu'au vrai plein écran de la
// FENÊTRE SÉPARÉE (`TimerPane`, bureau seulement : on y entre par un bouton
// nommé, dont l'info-bulle écrit « Échap pour en sortir »). Le plein écran de
// l'app, lui, montre ses commandes : la seconde passe du labo y a vu six
// utilisateurs sur douze enfermés, au bureau, au téléphone et sur tablette —
// les seules sorties (Échap, double toucher) n'étaient écrites nulle part.
import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../lib/i18n";
import { IS_IOS } from "../../lib/platform";
import { gesteAuClavier, nomDeLaSeance } from "../../lib/timerEcran";
import type { StyleHorloge } from "../../lib/timerStyle";
import { IconPause, IconPlay, IconStop } from "../icons";
import Horloge from "./Horloge";

export interface SeanceAffichee {
  label: string;
  kind: "focus" | "break";
  plannedMin: number;
}

interface Props {
  seance: SeanceAffichee;
  /** Volets ou anneau (`lib/timerStyle.ts`). Volets si rien n'est dit. */
  style?: StyleHorloge;
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
  /** Plein écran de la fenêtre séparée : l'horloge seule. */
  epure?: boolean;
  /**
   * ⭐ Le clavier APPARTIENT à cet écran tant qu'il est ouvert (le plein écran
   * de l'app) : aucune touche ne descend vers ce qui est derrière — ni ⌘K, ni
   * l'Échap d'une vue, ni un raccourci de page. Pas dans la fenêtre séparée,
   * qui a ses propres touches (F, ⌘W) au-dessus de cet écran.
   */
  clavierExclusif?: boolean;
}

/** Vrai quand la souris n'a pas bougé depuis `delaiMs` — pour effacer le curseur. */
function useSourisImmobile(actif: boolean, delaiMs = 2000): boolean {
  const [immobile, setImmobile] = useState(false);
  useEffect(() => {
    if (!actif) {
      setImmobile(false);
      return;
    }
    let id = window.setTimeout(() => setImmobile(true), delaiMs);
    const surMouvement = () => {
      setImmobile(false);
      window.clearTimeout(id);
      id = window.setTimeout(() => setImmobile(true), delaiMs);
    };
    window.addEventListener("mousemove", surMouvement);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("mousemove", surMouvement);
    };
  }, [actif, delaiMs]);
  return immobile;
}

/** Espace ne doit pas basculer deux fois quand un bouton a le focus. */
function cibleInteractive(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return !!el.closest("button, a, input, textarea, select, [contenteditable='true']");
}

export default function EcranTimer({
  seance,
  style = "volets",
  restantSec,
  enPause,
  onBasculerPause,
  onTerminer,
  actions,
  retraitPastilles = false,
  onEchap,
  poignee = false,
  epure = false,
  clavierExclusif = false,
}: Props) {
  const curseurCache = useSourisImmobile(epure);
  const estPause = seance.kind === "break";
  const totalSec = seance.plannedMin * 60;
  const progression = totalSec > 0 ? Math.min(1, Math.max(0, 1 - restantSec / totalSec)) : 0;

  // Clavier : Espace met en pause / reprend, Échap sort (`lib/timerEcran.ts`).
  //
  // ⚠️ En mode exclusif, l'écoute est posée sur `document` et ARRÊTE la touche
  // là : les raccourcis de l'app écoutent `window`, un cran plus haut, et ne la
  // voient donc jamais. Pas en capture sur `window` : l'info-bulle, qui se
  // referme à la frappe, écoute `document` en capture et serait coupée aussi.
  // L'effet natif de la touche (Tab, Espace sur un bouton) n'est pas touché.
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const geste = gesteAuClavier(e, cibleInteractive(e.target), !!onEchap);
      if (geste === "pause") {
        e.preventDefault();
        onBasculerPause();
      } else if (geste === "sortir") {
        e.preventDefault();
        onEchap?.();
      }
      if (clavierExclusif) e.stopPropagation();
    };
    const ou: Document | Window = clavierExclusif ? document : window;
    ou.addEventListener("keydown", surTouche as EventListener);
    return () => ou.removeEventListener("keydown", surTouche as EventListener);
  }, [onBasculerPause, onEchap, clavierExclusif]);

  const nom = nomDeLaSeance(seance, t("Session libre"));

  if (epure) {
    return (
      <div
        className="flex h-full w-full items-center justify-center px-[4vw]"
        style={{ cursor: curseurCache ? "none" : undefined }}
        onDoubleClick={onEchap}
        onClick={IS_IOS ? onEchap : undefined}
      >
        <Horloge
          style={style}
          restantSec={restantSec}
          plannedMin={seance.plannedMin}
          estPause={estPause}
          enPause={enPause}
          hauteurVolets="min(calc(100vh - 6rem), 46rem)"
          diametreAnneau="min(calc(100vh * var(--zoom-inv, 1) - 6rem), 46rem)"
        />
      </div>
    );
  }

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
          {/* Sur quoi on travaille : le nom de la tâche, ou « Session libre ». */}
          {nom && <p className="mt-1 max-w-[42ch] truncate text-sm text-text">{nom}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 pb-8">
        <Horloge
          style={style}
          restantSec={restantSec}
          plannedMin={seance.plannedMin}
          estPause={estPause}
          enPause={enPause}
          // La hauteur de fenêtre MOINS l'en-tête, la jauge et les boutons
          // (≈ 15rem) : dans une petite fenêtre séparée (560 × 360), 56vh
          // laissait passer les boutons sous le bord. Plancher à 4rem.
          hauteurVolets="max(4rem, min(calc(100vh * var(--zoom-inv) - 15rem), 36rem))"
          // L'anneau porte déjà la progression : il prend la place de la jauge.
          diametreAnneau="max(8rem, min(calc(100vh * var(--zoom-inv, 1) - 12rem), 30rem))"
          classeVolets="max-w-[1100px]"
        />

        {/* Progression de la séance : une jauge linéaire, donc le dégradé de
            marque (DESIGN.md, l'un de ses cinq emplois) ; la pause est à l'encre.
            Avec l'anneau, c'est lui qui la dessine : la jauge ferait doublon. */}
        <div
          hidden={style === "anneau"}
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
          {/* « Terminer » en toutes lettres (2026-10-12) : un carré seul ne
              disait pas ce qu'il arrêtait, et au doigt aucune info-bulle ne le
              nomme. Sobre : c'est « Pause » l'action principale de cet écran. */}
          <button
            type="button"
            onClick={onTerminer}
            data-tip={t("Terminer la session")}
            data-tip-sub={t("Clôt et enregistre le temps concentré effectué.")}
            className="pill inline-flex items-center justify-center gap-2 border border-border px-5 py-2.5 text-sm font-medium text-text-dim hover:border-border-strong hover:text-text"
          >
            <IconStop className="h-3.5 w-3.5" /> {t("Terminer")}
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
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-text-dim hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}
