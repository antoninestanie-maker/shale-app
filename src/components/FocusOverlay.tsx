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
import { useStyleHorloge } from "../lib/timerStyle";
import EcranTimer, { ActionFenetre } from "./timer/EcranTimer";
import PastilleSeance from "./timer/PastilleSeance";
import { IconReduire } from "./icons";

import { t } from "../lib/i18n";

/**
 * La place que la pastille de séance réserve en bas d'un téléphone : sa hauteur
 * et sa marge de 8 px.
 *
 * ⚠️ 46 px, plus 44 (2026-10-12 au soir) : la pastille n'est plus un bouton de
 * 44 pt bordure comprise, mais un cadre qui CONTIENT trois cibles de 44 pt —
 * son filet d'1 px s'ajoute en haut et en bas. Mesuré à l'écran à 390 px ; si
 * la pastille change de hauteur, cette valeur change avec elle.
 */
const RESERVE_SEANCE = "3.375rem";

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
 * Mode session : la pastille compacte (`PastilleSeance`) tant qu'on travaille
 * dans l'app, et le plein écran quand on le DEMANDE. Héberge aussi le pont vers
 * la fenêtre séparée du Timer : c'est ici que vit l'affichage de la séance, et
 * ce composant est monté une seule fois, au niveau d'`App`.
 *
 * ⭐ LE PLEIN ÉCRAN EST L'HORLOGE SEULE (`epure`) — décision d'Antonin du
 * 2026-09-30 (« en plein écran, seul le timer affiché, pas de bouton pause,
 * rien — on sort avec Échap et c'est tout »), rétablie à la fusion du
 * 2026-10-12. ⚠️ Cet en-tête a dit le contraire pendant une journée (« le plein
 * écran montre ses commandes », chantier `retours-passe2`) : c'était faux dès
 * la fusion, corrigé le 2026-10-12 au soir. Les commandes visibles existent
 * toujours dans `EcranTimer` (retirer `epure` suffit) ; `lib/calque.test.ts`
 * tient la décision en place.
 *
 * ⭐ ON N'Y ENTRE PLUS SANS L'AVOIR VOULU (2026-10-12 au soir, Antonin : « le
 * focus qu'on lance depuis une tâche ne doit pas être le mode plein écran
 * complet. Ça, c'est seulement si l'utilisateur le décide. »). Lancer une
 * séance ne l'ouvre pas (`useFocus.start`), cliquer la pastille non plus (elle
 * ouvre la page Timer). Seul un geste nommé « Plein écran » y mène : celui de
 * la page Timer, de la carte Timer d'Aujourd'hui, du menu de la pastille.
 * C'est ce qui rend l'horloge seule tenable : on n'y arrive plus par surprise,
 * sans savoir en sortir (les six utilisateurs simulés du labo, seconde passe).
 *
 * Le clavier est à l'horloge tant qu'elle est ouverte : voir `CalqueSeance`.
 */
export default function FocusOverlay({ focus }: { focus: FocusController }) {
  // ⚠️ Avant tout `return` : un crochet ne se saute pas.
  // Volets ou anneau : le plein écran le montre, la fenêtre séparée le reçoit.
  const [styleHorloge] = useStyleHorloge();
  usePontFenetreTimer(focus, styleHorloge);
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

  if (!overlayOpen) return <PastilleSeance focus={focus} enBas={isPhone} />;

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
        style={styleHorloge}
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
