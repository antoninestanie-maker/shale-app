// L'horloge à ANNEAU — « l'ancien timer », celui d'avant les volets, rendu au
// choix le 2026-10-13 (`lib/timerStyle.ts`). Un cercle qui se remplit à mesure
// que la séance avance, et le temps restant au centre.
//
// Tout est dans le SVG, chiffres compris : l'anneau et son temps grandissent
// ensemble, du panneau de la page Timer au plein écran, sans table de tailles.
import type { CSSProperties } from "react";
import { decouperTemps } from "../../lib/timerFenetre";
import { t } from "../../lib/i18n";

interface Props {
  restantSec: number;
  /** La durée prévue : c'est elle que l'anneau mesure. */
  plannedMin: number;
  /** Heures affichées (séance d'une heure ou plus), comme les volets. */
  avecHeures: boolean;
  /** Une pause se dessine à l'encre, le travail en bleu — comme la jauge. */
  estPause?: boolean;
  enPause?: boolean;
  /** Diamètre maximal, en unité CSS. */
  hauteurMax?: string;
  className?: string;
}

const R = 120;
const CIRC = 2 * Math.PI * R;

export default function HorlogeAnneau({
  restantSec,
  plannedMin,
  avecHeures,
  estPause = false,
  enPause = false,
  hauteurMax = "18rem",
  className = "",
}: Props) {
  const totalSec = plannedMin * 60;
  const progression = totalSec > 0 ? Math.min(1, Math.max(0, 1 - restantSec / totalSec)) : 0;
  const temps = decouperTemps(restantSec, avecHeures).join(":");
  // Le diamètre suit la place : jamais plus haut que `hauteurMax`, jamais plus
  // large que son conteneur.
  const style: CSSProperties = { width: `min(100%, ${hauteurMax})` };

  return (
    <div className={`mx-auto aspect-square ${className}`} style={style}>
      <svg viewBox="0 0 280 280" className="h-full w-full" role="timer" aria-label={temps}>
        <g transform="rotate(-90 140 140)">
          <circle cx="140" cy="140" r={R} fill="none" stroke="var(--color-border)" strokeWidth="10" />
          <circle
            cx="140"
            cy="140"
            r={R}
            fill="none"
            stroke={estPause ? "var(--color-success-fill)" : "var(--color-blue)"}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - progression)}
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </g>
        <text
          x="140"
          y="140"
          textAnchor="middle"
          dominantBaseline="central"
          className="font-mono font-semibold"
          fill="var(--color-text)"
          fontSize={avecHeures ? 44 : 58}
          style={{ fontVariantNumeric: "tabular-nums", opacity: enPause ? 0.45 : 1, transition: "opacity 200ms" }}
          aria-hidden
        >
          {temps}
        </text>
        <text
          x="140"
          y="188"
          textAnchor="middle"
          className="font-mono"
          fill="var(--color-text-dim)"
          fontSize="13"
          aria-hidden
        >
          {enPause ? t("en pause") : `/ ${plannedMin} min`}
        </text>
      </svg>
    </div>
  );
}
