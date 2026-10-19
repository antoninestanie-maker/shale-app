import { useId } from "react";

// La marque Shale — décidée par Antonin le 2026-10-19.
//
// Un S fait de deux traits blancs, coupés net, penchés de 14° vers l'avant, sur
// une plaque cramoisie (#dc2626 → #7f1d1d), avec une lueur blanche derrière les
// traits. Elle remplace la marque « Strates » (quatre barres, bleu).
//
// ⭐ LA RÉFÉRENCE, CE SONT LES SVG de `src-tauri/icons/marque/` (copies exactes
// de `~/Desktop/Shale-projet/marque/`, qui fait foi ; voir son MARQUE.md).
// Ce composant les redessine à l'identique — grille 100 × 100, mêmes chemins,
// même dégradé, même flou — et `src/lib/icone-ios.test.ts` échoue si un chemin
// dérive.
//
// ⚠️ Des HEX ici, contre la règle « jamais d'hex » du design system : ce sont
// les couleurs de la MARQUE, pas de l'interface. Elles ne changent ni avec le
// thème ni avec les accents (`--color-*`), exactement comme l'icône du Dock.

/** Les deux traits du S, dans la grille 100 × 100, avant l'inclinaison. */
export const TRAITS = ["M86 38 H54 Q42 38 42 53", "M14 62 H46 Q58 62 58 47"] as const;
/** L'inclinaison de 14° vers l'avant, recentrée. */
export const INCLINAISON = "translate(12.47 0) skewX(-14)";
export const PLAQUE_HAUT = "#dc2626";
export const PLAQUE_BAS = "#7f1d1d";

export default function ShaleMark({
  size = 40,
  variante = "plaque",
  lueur = true,
  pro = false,
  className,
}: {
  /** Nombre de pixels, ou une longueur CSS (« 100% » pour la copie animée). */
  size?: number | string;
  /**
   * `plaque` : l'icône (plaque cramoisie, S blanc).
   * `trait` : le S seul, à la couleur du texte (`currentColor`).
   * `lueur-seule` : uniquement le halo flouté, SANS plaque ni traits nets —
   * c'est la couche que la transition d'entrée fait s'allumer par-dessus la
   * plaque (une opacité, rien d'autre).
   * `plaque-seule` : la plaque et son filet, sans les traits — l'entrée « dans
   * le logo » efface la plaque avant les traits (2026-10-20).
   */
  variante?: "plaque" | "plaque-seule" | "trait" | "lueur-seule";
  /** La lueur blanche derrière les traits. Éteinte : la première image de l'entrée. */
  lueur?: boolean;
  /** Shale Pro : « PRO » blanc à 70 %, en bas à droite (icone-shale-pro.svg). */
  pro?: boolean;
  className?: string;
}) {
  // Plusieurs marques peuvent vivre sur la même page : des identifiants
  // propres à chaque instance, sans caractère qu'`url(#…)` refuserait.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const plaque = `shale-plaque-${id}`;
  const flou = `shale-lueur-${id}`;
  const flouPro = `shale-lueur-pro-${id}`;

  const trait = variante === "trait";
  const encre = trait ? "currentColor" : "#ffffff";
  const avecLueur = !trait && (lueur || variante === "lueur-seule");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={className}
      style={{ display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id={plaque} x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={PLAQUE_HAUT} />
          <stop offset="1" stopColor={PLAQUE_BAS} />
        </linearGradient>
        <filter id={flou} x="-90%" y="-150%" width="280%" height="400%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
        <filter id={flouPro} x="-50%" y="-100%" width="200%" height="300%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>
      </defs>
      {(variante === "plaque" || variante === "plaque-seule") && (
        <>
          <rect width="100" height="100" rx="22.5" fill={`url(#${plaque})`} />
          {/* Le filet blanc à 20 % : la plaque reste détachée sur un fond sombre. */}
          <rect
            x="0.6"
            y="0.6"
            width="98.8"
            height="98.8"
            rx="22"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.2"
            strokeWidth="1.2"
          />
        </>
      )}
      {variante !== "plaque-seule" && (
      <g transform={INCLINAISON}>
        {avecLueur &&
          TRAITS.map((d) => (
            <path
              key={`l${d}`}
              d={d}
              stroke="#ffffff"
              strokeWidth="10"
              strokeLinecap="butt"
              filter={`url(#${flou})`}
            />
          ))}
        {variante !== "lueur-seule" &&
          TRAITS.map((d) => (
            <path key={d} d={d} stroke={encre} strokeWidth="10" strokeLinecap="butt" />
          ))}
      </g>
      )}
      {pro && variante === "plaque" && (
        <g
          opacity="0.7"
          fontFamily="Instrument Sans, Helvetica Neue, sans-serif"
          fontWeight="700"
          fontSize="10"
          letterSpacing="1.6"
          textAnchor="end"
          fill="#ffffff"
        >
          <text x="86" y="87" filter={`url(#${flouPro})`}>
            PRO
          </text>
          <text x="86" y="87">
            PRO
          </text>
        </g>
      )}
    </svg>
  );
}
