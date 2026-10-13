// L'horloge du Timer, sous le visage choisi (`lib/timerStyle.ts`) : les volets
// ou l'anneau. Les trois endroits qui montrent la séance en grand — la page
// Timer, le plein écran, la fenêtre séparée — passent par ici, pour qu'aucun ne
// reste sur l'autre visage.
import type { StyleHorloge } from "../../lib/timerStyle";
import { afficheLesHeures } from "../../lib/timerFenetre";
import HorlogeAnneau from "./HorlogeAnneau";
import HorlogeVolets from "./HorlogeVolets";

interface Props {
  style: StyleHorloge;
  restantSec: number;
  plannedMin: number;
  estPause?: boolean;
  enPause?: boolean;
  /** Hauteur maximale d'une carte de volet. */
  hauteurVolets?: string;
  /** Diamètre maximal de l'anneau. */
  diametreAnneau?: string;
  classeVolets?: string;
}

export default function Horloge({
  style,
  restantSec,
  plannedMin,
  estPause,
  enPause,
  hauteurVolets,
  diametreAnneau,
  classeVolets,
}: Props) {
  const avecHeures = afficheLesHeures(plannedMin);
  if (style === "anneau") {
    return (
      <HorlogeAnneau
        restantSec={restantSec}
        plannedMin={plannedMin}
        avecHeures={avecHeures}
        estPause={estPause}
        enPause={enPause}
        hauteurMax={diametreAnneau}
      />
    );
  }
  return (
    <HorlogeVolets
      restantSec={restantSec}
      avecHeures={avecHeures}
      enPause={enPause}
      hauteurMax={hauteurVolets}
      className={classeVolets}
    />
  );
}
