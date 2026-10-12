import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { FocusController } from "../lib/useFocus";
import { useIsPhone } from "../lib/platform";
import { themeAuDemarrage, FONDS } from "../lib/theme";
import { afficherToast } from "../lib/toast";
import {
  ouvrirFenetreTimer,
  usePleinEcranNatif,
  usePontFenetreTimer,
} from "../lib/timerFenetre";
import EcranTimer from "./timer/EcranTimer";
import { IconPause } from "./icons";

import { t } from "../lib/i18n";
function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** La place que la pastille de séance réserve en bas d'un téléphone : ses 44 pt et leur marge. */
const RESERVE_SEANCE = "3.25rem";

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
 * Mode session : plein écran (l'horloge à volets, SEULE) + pastille compacte
 * quand réduit. Héberge aussi le pont vers la fenêtre séparée du Timer : c'est
 * ici que vit l'affichage de la séance, et ce composant est monté une seule
 * fois, au niveau d'`App`.
 *
 * Le plein écran n'a plus aucun bouton (demande d'Antonin, 2026-09-29) : Échap
 * le referme, et les boutons se retrouvent dans la vue Timer. La fenêtre
 * séparée s'ouvre depuis la vue Timer.
 */
export default function FocusOverlay({ focus }: { focus: FocusController }) {
  // ⚠️ Avant tout `return` : un crochet ne se saute pas.
  usePontFenetreTimer(focus);
  usePleinEcranNatif(focus.overlayOpen && focus.session !== null);

  const { session, remainingSec, paused, overlayOpen, setOverlayOpen, stop, pause, resume } =
    focus;

  /**
   * ⭐ AU TÉLÉPHONE, LA PASTILLE VIT EN BAS, au-dessus de la barre d'onglets
   * (2026-10-12, crible du labo, constat 36).
   *
   * En haut au centre, elle recouvrait le titre de chaque écran (« Timer »
   * devenait « Ti… ») — et, sur un iPhone, elle se serait posée SOUS l'encoche :
   * `top-4` ne connaît pas la zone sûre. En bas, elle est sous le pouce.
   *
   * Elle RÉSERVE sa place, par une variable lue à trois endroits : le bas de
   * chaque vue (`App.tsx`), le toast (`Toast.tsx`) et le voile des fenêtres
   * (`.fenetre-voile`, `index.css`). Sans cela elle recouvrirait la dernière
   * ligne d'une liste, le « Annuler » d'une suppression ou le « Créer » d'une
   * fenêtre. La réserve disparaît avec elle.
   */
  const isPhone = useIsPhone();
  const pastilleEnBas = isPhone && session !== null && !overlayOpen;
  useEffect(() => {
    const racine = document.documentElement;
    if (pastilleEnBas) racine.style.setProperty("--reserve-seance", RESERVE_SEANCE);
    else racine.style.removeProperty("--reserve-seance");
    return () => {
      racine.style.removeProperty("--reserve-seance");
    };
  }, [pastilleEnBas]);

  if (!session) return null;

  const isBreak = session.kind === "break";
  const accent = isBreak ? "var(--color-success)" : "var(--color-blue)";

  if (!overlayOpen) {
    return (
      <button
        type="button"
        onClick={() => setOverlayOpen(true)}
        className={`card cible-tactile-ligne fixed left-1/2 z-40 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 px-4 py-2 ${
          isPhone ? "" : "top-4"
        }`}
        style={isPhone ? { bottom: "calc(env(safe-area-inset-bottom) + 4.75rem)" } : undefined}
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
        <span className="max-w-44 min-w-0 truncate text-xs text-text-dim">
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
        epure
        seance={session}
        restantSec={remainingSec}
        enPause={paused}
        onBasculerPause={paused ? resume : pause}
        onTerminer={() => void stop()}
        onEchap={() => setOverlayOpen(false)}
        actions={null}
      />
    </div>,
    document.body,
  );
}
