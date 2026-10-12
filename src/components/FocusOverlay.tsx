import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ouvrirCalque } from "../lib/calque";
import type { FocusController } from "../lib/useFocus";
import { useIsPhone } from "../lib/platform";
import { themeAuDemarrage, FONDS } from "../lib/theme";
import { afficherToast } from "../lib/toast";
import {
  ouvrirFenetreTimer,
  usePleinEcranNatif,
  usePontFenetreTimer,
} from "../lib/timerFenetre";
import EcranTimer, { ActionFenetre } from "./timer/EcranTimer";
import { IconPause, IconReduire } from "./icons";

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
 * Mode session : plein écran (l'horloge à volets ET ses commandes) + pastille
 * compacte quand réduit. Héberge aussi le pont vers la fenêtre séparée du
 * Timer : c'est ici que vit l'affichage de la séance, et ce composant est monté
 * une seule fois, au niveau d'`App`.
 *
 * ⭐ LE PLEIN ÉCRAN MONTRE SES COMMANDES (2026-10-12, seconde passe du labo,
 * constats 1 et 3). ⚠️ Cela RETOURNE une demande d'Antonin du 2026-09-30 (« en
 * plein écran, seul le timer affiché, pas de bouton pause, rien — on sort avec
 * Échap et c'est tout »). Depuis, « ⋯ › Focus 25 min » mène ici d'un geste,
 * depuis Tâches comme depuis Aujourd'hui : six utilisateurs simulés sur douze
 * s'y sont trouvés sans pause, sans arrêt, sans sortie et sans le nom de leur
 * tâche — au téléphone et sur tablette, il n'y a pas d'Échap. Cinq en ont fait
 * leur moment de fermer l'app.
 *
 * Ce que l'écran porte, visible AU REPOS : le nom de la tâche (ou « Session
 * libre »), « Pause » / « Reprendre », « Terminer », « Réduire ». Et le clavier
 * est à lui : voir `CalqueSeance`.
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

  return (
    <CalqueSeance>
      {/* ⚠️ `epure` : décision d'Antonin du 2026-09-30 (« en plein écran, seul le
          timer affiché, pas de bouton pause, rien — on sort avec Échap et c'est
          tout »). Le labo du 2026-10-12 a vu six utilisateurs simulés n'y trouver
          aucune sortie ; les commandes visibles sont écrites (retirer `epure`
          suffit), mais c'est à lui de retourner sa décision. Le clavier, lui, est
          à l'horloge dans les deux cas (`clavierExclusif`). */}
      <EcranTimer
        epure
        clavierExclusif
        seance={session}
        restantSec={remainingSec}
        enPause={paused}
        onBasculerPause={paused ? resume : pause}
        onTerminer={() => void stop()}
        onEchap={() => setOverlayOpen(false)}
        actions={
          <ActionFenetre
            onClick={() => setOverlayOpen(false)}
            label={t("Réduire|séance")}
            tipSub={t("La session continue, réduite en pastille. Raccourci : Échap")}
          >
            <IconReduire className="h-3.5 w-3.5" />
            {t("Réduire|séance")}
          </ActionFenetre>
        }
      />
    </CalqueSeance>
  );
}

/**
 * ⭐ LE CALQUE DU PLEIN ÉCRAN — il prend la main, et la rend (`lib/calque.ts`).
 *
 * LE DÉFAUT PAYÉ ICI (2026-10-12, constat 3). Le calque recouvrait l'app sans
 * lui retirer le clavier : le focus restait sur le « ⋯ » de la tâche, DESSOUS.
 * Espace rouvrait le menu de la tâche par-dessus l'horloge ; un second Espace
 * la marquait faite.
 *
 * Tant qu'il est monté : l'app est inerte, le focus est ici (Espace = pause,
 * Échap = réduire — `EcranTimer`, `clavierExclusif`), et à la fermeture le
 * focus retourne d'où l'on venait.
 *
 * Portail sur `document.body` : un ancêtre animé ferait de `inset-0` « cet
 * ancêtre » et laisserait la barre latérale allumée (PIEGES § 9.5) — et, rendu
 * dans `#root`, le calque s'éteindrait lui-même (§ 18.1).
 */
function CalqueSeance({ children }: { children: ReactNode }) {
  const calque = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = calque.current;
    if (!el) return;
    return ouvrirCalque(el);
  }, []);
  return createPortal(
    <div
      ref={calque}
      role="dialog"
      aria-modal="true"
      aria-label={t("Session en plein écran")}
      // Focalisable par programme seulement : c'est lui qui reçoit le clavier
      // à l'ouverture, sans surligner un bouton que personne n'a choisi.
      tabIndex={-1}
      data-calque-plein-ecran=""
      className="fixed inset-0 z-[80] bg-bg focus:outline-none"
    >
      {children}
    </div>,
    document.body,
  );
}
