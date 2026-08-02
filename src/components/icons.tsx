// Icônes SVG maison — style ligne unifié (24×24, trait 1.8, bouts ronds),
// couleur héritée du texte (currentColor). Remplacent les emojis pour un rendu
// professionnel et cohérent dans les deux thèmes. Dimensionner via className
// (ex. "h-4 w-4") ; par défaut 1em pour suivre la taille du texte.
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

/** Flamme — streaks. */
export const IconFlame = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
  </Icon>
);

/** Éclair — flash, énergie. */
export const IconBolt = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </Icon>
);

/** Interdit — zones no-trade. */
export const IconBan = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m5.6 5.6 12.8 12.8" />
  </Icon>
);

/** Cible — tests / objectifs de session. */
export const IconTarget = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1" />
  </Icon>
);

/** Triangle d'alerte — avertissements. */
export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </Icon>
);

export const IconCheck = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

export const IconCheckCircle = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.5 2.5 5-5.5" />
  </Icon>
);

export const IconX = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </Icon>
);

export const IconPlus = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Icon>
);

/** Avion papier — envoi au tracker. */
export const IconSend = (p: IconProps) => (
  <Icon {...p}>
    <path d="m21.4 2.6-9.7 9.7" />
    <path d="M21.4 2.6 15 21.3l-3.3-9-9-3.3L21.4 2.6z" />
  </Icon>
);

/* Transport (lecture) : pleins, comme les standards système. */
export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path
      fill="currentColor"
      stroke="none"
      d="M7.5 5.3v13.4a1 1 0 0 0 1.53.85l10.76-6.7a1 1 0 0 0 0-1.7L9.03 4.45A1 1 0 0 0 7.5 5.3Z"
    />
  </Icon>
);

export const IconPause = (p: IconProps) => (
  <Icon {...p}>
    <rect fill="currentColor" stroke="none" x="6" y="5" width="4.2" height="14" rx="1.4" />
    <rect fill="currentColor" stroke="none" x="13.8" y="5" width="4.2" height="14" rx="1.4" />
  </Icon>
);

export const IconStop = (p: IconProps) => (
  <Icon {...p}>
    <rect fill="currentColor" stroke="none" x="6" y="6" width="12" height="12" rx="2" />
  </Icon>
);

/** Plein écran. */
export const IconExpand = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8 3H5a2 2 0 0 0-2 2v3" />
    <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
    <path d="M3 16v3a2 2 0 0 0 2 2h3" />
    <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
  </Icon>
);

/* Tendances — biais haussier / baissier / neutre. */
export const IconTrendUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="m2 17 6.5-6.5 4 4L21 6" />
    <path d="M15 6h6v6" />
  </Icon>
);

export const IconTrendDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m2 7 6.5 6.5 4-4L21 18" />
    <path d="M15 18h6v-6" />
  </Icon>
);

export const IconDash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 12h12" />
  </Icon>
);

/** Curseurs — personnalisation. */
export const IconSliders = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 21v-7" />
    <path d="M4 10V3" />
    <path d="M12 21v-9" />
    <path d="M12 8V3" />
    <path d="M20 21v-5" />
    <path d="M20 12V3" />
    <path d="M2 14h4" />
    <path d="M10 8h4" />
    <path d="M18 16h4" />
  </Icon>
);

export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);

export const IconEyeOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.7 5.8A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17.4 17.4 0 0 1-2.4 3.2" />
    <path d="M6.6 6.6C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m3 3 18 18" />
  </Icon>
);

export const IconChevronUp = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 14.5 6-6 6 6" />
  </Icon>
);

export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Icon>
);

/** Écran — réglages de fenêtre. */
export const IconMonitor = (p: IconProps) => (
  <Icon {...p}>
    <rect x="2.5" y="4" width="19" height="13" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
  </Icon>
);

/** Réinitialiser. */
export const IconReset = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 12a9 9 0 1 0 3-6.7" />
    <path d="M3 4v5h5" />
  </Icon>
);

/** Image / capture d'écran. */
export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m4 17 4.5-4.5a2 2 0 0 1 2.8 0L15 16" />
    <path d="m14 15 1.8-1.8a2 2 0 0 1 2.8 0L20 14.5" />
  </Icon>
);

/** Disquette — sauvegarde / export. */
export const IconSave = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
    <path d="M8 3v6h7V3" />
    <rect x="7" y="13" width="10" height="8" rx="1" />
  </Icon>
);

/* — Savoir (base de connaissances) — */

/** Note / document texte. */
export const IconNote = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 3v5h5M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-5Z" />
    <path d="M9 13h6M9 17h4" />
  </Icon>
);

/** Maillon — lien hypertexte. */
export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 13.5a4 4 0 0 0 5.7.3l3-3a4 4 0 0 0-5.7-5.7l-1.7 1.7" />
    <path d="M14 10.5a4 4 0 0 0-5.7-.3l-3 3a4 4 0 0 0 5.7 5.7l1.7-1.7" />
  </Icon>
);

/** Pinceau — croquis. */
export const IconBrush = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 8.5 17 5a2.1 2.1 0 0 1 3 3l-3.5 3.5" />
    <path d="M16.5 11.5 12 7l-6.5 6.5a3 3 0 0 0-.8 1.5L4 20l5-.7a3 3 0 0 0 1.5-.8Z" />
  </Icon>
);

/** Punaise — fiche épinglée. */
export const IconPin = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 17v5" />
    <path d="M9 3h6l-.8 5.2 3 3.3V14H6.8v-2.5l3-3.3L9 3Z" />
  </Icon>
);

/** Crayon — modifier. */
export const IconPencil = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
  </Icon>
);

/** Loupe — recherche. */
export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.6-3.6" />
  </Icon>
);

/** Dossier — thème de classement. */
export const IconFolder = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </Icon>
);

/** Corbeille — supprimer. */
export const IconTrash = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </Icon>
);

/** Cloche — centre de notifications. */
export const IconBell = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 8a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
  </Icon>
);

/** Cloche barrée — notifications coupées. */
export const IconBellOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M18 8a6 6 0 0 0-9.3-5" />
    <path d="M6.3 6.3A6 6 0 0 0 6 8c0 5-2 6-2 6h13" />
    <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    <path d="M3 3l18 18" />
  </Icon>
);

/** Cadenas fermé — module réservé à l'offre Shale Trade. */
export const IconLock = (p: IconProps) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2.5" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Icon>
);

/** Flèche sortante — ouvrir à l'extérieur. */
export const IconExternal = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 17 17 7" />
    <path d="M9 7h8v8" />
  </Icon>
);

/** Haut-parleur — son actif (tonalités du test de mémoire visuelle). */
export const IconSound = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" />
    <path d="M15 9.5a3.5 3.5 0 0 1 0 5" />
    <path d="M17.8 6.8a7 7 0 0 1 0 10.4" />
  </Icon>
);

/** Haut-parleur barré — son coupé. */
export const IconSoundOff = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 5 6.5 9H3v6h3.5L11 19V5z" />
    <path d="M16 10l5 4M21 10l-5 4" />
  </Icon>
);

/* Humeurs du journal : 5 visages, du pire au meilleur. */
const MOUTHS = [
  "M16 16.6s-1.3-1.9-4-1.9-4 1.9-4 1.9", // très mauvais
  "M15.2 15.8s-1.1-1.1-3.2-1.1-3.2 1.1-3.2 1.1", // mauvais
  "M9 15.3h6", // neutre
  "M8.8 14.7s1.1 1.2 3.2 1.2 3.2-1.2 3.2-1.2", // bien
  "M8 14.2s1.4 2.3 4 2.3 4-2.3 4-2.3", // très bien
];

export function IconMood({
  level,
  ...p
}: IconProps & { level: 0 | 1 | 2 | 3 | 4 }) {
  return (
    <Icon {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9.4h.01" strokeWidth={2.4} />
      <path d="M15 9.4h.01" strokeWidth={2.4} />
      <path d={MOUTHS[level]} />
    </Icon>
  );
}
