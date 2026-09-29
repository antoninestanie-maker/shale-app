// L'icône des actions d'IA : une plume — « l'IA rédige, tu décides ».
//
// Volontairement SOBRE (cahier des charges, invariants) : même trait que le
// jeu d'icônes maison (24 × 24, trait 1,8, extrémités rondes, `currentColor`),
// ni étincelle, ni dégradé, ni lueur. Posée dans son propre fichier, comme les
// icônes des menus (`menu/icones.tsx`), pour ne pas rouvrir `icons.tsx`.
import type { SVGProps } from "react";

export function IconeIa(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <path d="M19 4c-6 1-10.5 5.5-12.5 12.5L5 20l3.5-1.5C15.5 16.5 20 12 21 6z" />
      <path d="M6.5 16.5 12 11" />
    </svg>
  );
}
