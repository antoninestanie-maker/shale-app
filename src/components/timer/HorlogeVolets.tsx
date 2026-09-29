// L'horloge à volets du Timer (2026-09-29) — l'interface de la vidéo d'Antonin :
// deux cartes, minutes et secondes, dont la moitié haute bascule à chaque
// changement de chiffre, comme un afficheur à palettes.
//
// Adaptée à Shale : les cartes sont les surfaces du thème (sombre OU clair),
// les chiffres sont à l'encre du texte, et la police est l'Instrument Sans de
// l'app, dans sa largeur ÉTROITE (axe `wdth` à 75) — la même famille, pas une
// police de plus.
//
// ⚠️ AUCUN `animationend` ici, exprès (PIEGES § 11.4 et 11.5). Chaque volet
// animé est MONTÉ avec la nouvelle valeur pour clé et tient sa position finale
// par `animation-fill-mode: both` : la bascule rejoue d'elle-même au changement
// suivant, et un mouvement réduit (durée ramenée à ~0 par la règle globale)
// tombe directement sur l'état final — rien n'attend un événement qui
// pourrait ne jamais venir.
import { useState, type CSSProperties } from "react";
import { decouperTemps } from "../../lib/timerFenetre";
import "./volets.css";

interface Props {
  restantSec: number;
  /** Trois volets (heures, minutes, secondes) au lieu de deux. */
  avecHeures: boolean;
  enPause?: boolean;
  /** Hauteur maximale d'une carte (`--volets-hmax`), en unité CSS. */
  hauteurMax?: string;
  className?: string;
}

export default function HorlogeVolets({
  restantSec,
  avecHeures,
  enPause = false,
  hauteurMax,
  className = "",
}: Props) {
  const groupes = decouperTemps(restantSec, avecHeures);
  const style = {
    "--n": groupes.length,
    ...(hauteurMax ? { "--volets-hmax": hauteurMax } : {}),
  } as CSSProperties;
  return (
    <div className={`volets ${className}`} data-pause={enPause || undefined}>
      <div className="volets-rangee" style={style} role="timer" aria-label={groupes.join(":")}>
        {groupes.map((g, i) => (
          <Volet key={i} valeur={g} />
        ))}
      </div>
    </div>
  );
}

/** Une carte : deux moitiés fixes, et deux volets qui basculent au changement. */
function Volet({ valeur }: { valeur: string }) {
  // L'état « valeur précédente » est dérivé PENDANT le rendu (le motif React
  // pour mémoriser le rendu d'avant) : pas d'effet, donc pas une image de retard
  // où l'ancienne valeur s'afficherait entière.
  const [paire, setPaire] = useState({ actuelle: valeur, precedente: valeur });
  if (paire.actuelle !== valeur) setPaire({ actuelle: valeur, precedente: paire.actuelle });
  const { actuelle, precedente } = paire;
  const bascule = actuelle !== precedente;

  return (
    <div className="volet" aria-hidden>
      {/* Fixe en haut : déjà la NOUVELLE valeur, que le volet qui tombe découvre. */}
      <div className="volet-moitie volet-haut">
        <span>{actuelle}</span>
      </div>
      {/* Fixe en bas : encore l'ANCIENNE, jusqu'à ce que le volet la recouvre. */}
      <div className="volet-moitie volet-bas">
        <span>{bascule ? precedente : actuelle}</span>
      </div>
      {bascule && (
        <>
          <div key={`tombe-${actuelle}`} className="volet-moitie volet-haut volet-tombe">
            <span>{precedente}</span>
          </div>
          <div key={`arrive-${actuelle}`} className="volet-moitie volet-bas volet-arrive">
            <span>{actuelle}</span>
          </div>
        </>
      )}
    </div>
  );
}
