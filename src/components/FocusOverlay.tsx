import { createPortal } from "react-dom";
import type { FocusController } from "../lib/useFocus";
import { IS_IOS } from "../lib/platform";
import { themeAuDemarrage, FONDS } from "../lib/theme";
import { afficherToast } from "../lib/toast";
import {
  fenetreSepareeDisponible,
  ouvrirFenetreTimer,
  usePontFenetreTimer,
} from "../lib/timerFenetre";
import EcranTimer, { ActionFenetre } from "./timer/EcranTimer";
import { IconExternal, IconPause } from "./icons";

import { t } from "../lib/i18n";
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Ouvre la séance dans sa propre fenêtre — et le dit si ça échoue, plutôt que
 * de laisser un bouton qui ne fait rien.
 */
export async function detacherLeTimer(focus: FocusController): Promise<void> {
  const ok = await ouvrirFenetreTimer(FONDS[themeAuDemarrage()]);
  if (ok) focus.setOverlayOpen(false);
  else afficherToast({ msg: t("La fenêtre séparée n'a pas pu s'ouvrir."), tone: "loss" });
}

/**
 * Mode session : plein écran (l'horloge à volets) + pastille compacte quand
 * réduit. Héberge aussi le pont vers la fenêtre séparée du Timer : c'est ici
 * que vit l'affichage de la séance, et ce composant est monté une seule fois,
 * au niveau d'`App`.
 */
export default function FocusOverlay({ focus }: { focus: FocusController }) {
  // ⚠️ Avant tout `return` : un crochet ne se saute pas.
  usePontFenetreTimer(focus);

  const { session, remainingSec, paused, overlayOpen, setOverlayOpen, stop, pause, resume } =
    focus;
  if (!session) return null;

  const isBreak = session.kind === "break";
  const accent = isBreak ? "var(--color-success)" : "var(--color-blue)";

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

  // Portail sur `document.body` : un ancêtre animé ferait de `inset-0` « cet
  // ancêtre » et laisserait la barre latérale allumée (PIEGES § 9.5).
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-bg">
      <EcranTimer
        seance={session}
        restantSec={remainingSec}
        enPause={paused}
        onBasculerPause={paused ? resume : pause}
        onTerminer={() => void stop()}
        onEchap={() => setOverlayOpen(false)}
        // La barre de titre de la fenêtre principale est transparente : les
        // pastilles de macOS sont posées sur ce coin (pas sur iPhone/iPad).
        retraitPastilles={!IS_IOS}
        actions={
          <>
            {fenetreSepareeDisponible() && (
              <ActionFenetre
                onClick={() => void detacherLeTimer(focus)}
                label={t("Fenêtre séparée")}
                tipSub={t("Ouvre le chrono dans sa propre fenêtre, à poser sur un autre écran.")}
              >
                <IconExternal className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t("Fenêtre séparée")}</span>
              </ActionFenetre>
            )}
            <ActionFenetre
              onClick={() => setOverlayOpen(false)}
              label={t("Réduire")}
              tipSub={t("Le chrono continue. Raccourci : Échap")}
            >
              {t("Réduire")}
            </ActionFenetre>
          </>
        }
      />
    </div>,
    document.body,
  );
}
