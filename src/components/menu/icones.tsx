// Les icônes que le catalogue des menus demande et que `components/icons.tsx`
// n'avait pas. Même style que lui — 24×24, trait 1.8, bouts ronds,
// `currentColor`, taille par 1em — pour qu'aucune entrée de menu ne détonne à
// côté d'une autre.
//
// ⚠️ ÉCRITES ICI, PAS AJOUTÉES À `icons.tsx` : le chantier vit dans des
// fichiers neufs (règle 2), et `icons.tsx` est un fichier partagé que plusieurs
// sessions ouvrent. Si ces icônes servent ailleurs un jour, elles
// déménageront — en un seul geste, et à ce moment-là seulement.
import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
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
      {children}
    </svg>
  );
}

/** Deux feuillets décalés — dupliquer. */
export const IconDupliquer = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M6 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5V6" />
  </Icon>
);

/** Flèche qui sort d'une boîte — exporter. */
export const IconExporter = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3v12" />
    <path d="m8 7 4-4 4 4" />
    <path d="M4 14v4.5A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5V14" />
  </Icon>
);

/** Trois points en ligne — le bouton « ⋯ », jumeau visible du clic droit. */
export const IconPoints = (p: IconProps) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden {...p}>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </svg>
);

/** Une planchette à pince — copier dans le presse-papier. */
export const IconCopier = (p: IconProps) => (
  <Icon {...p}>
    <rect x="8" y="3" width="8" height="4" rx="1.4" />
    <path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2" />
  </Icon>
);
