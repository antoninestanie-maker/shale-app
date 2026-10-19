/**
 * « On entre dans le logo » — la géométrie du trou (2026-10-20).
 *
 * Inspirée de l'entrée de l'app X sur téléphone : l'icône se contracte un
 * instant, puis grossit jusqu'à sortir de l'écran, et l'app apparaît À
 * TRAVERS sa forme. Ici, la forme est la plaque de l'icône (un carré arrondi,
 * `rx` = 22,5 % du côté) : c'est une fenêtre qui s'ouvre sur l'app.
 *
 * ⭐ Pourquoi un trou fait de pièces, et pas un masque CSS. Un `mask` ou un
 * `clip-path` animé se recalcule sur le fil principal à chaque image — or
 * l'app se monte derrière pendant ce temps (tâches de ~100 ms mesurées le
 * 2026-10-06), et c'est exactement ce qui saccadait. Ici, la nuit autour du
 * trou est faite de huit éléments qui ne bougent QUE par `transform` :
 *   - quatre pans unis, de la taille de la fenêtre, TRANSLATÉS (jamais
 *     agrandis : leur bord reste net à toute taille) ;
 *   - quatre coins arrondis, dessinés à leur taille FINALE et RÉDUITS (une
 *     image réduite reste nette ; agrandie, elle serait floue).
 * Chaque pièce a deux images clés, la même durée et la même courbe : comme sa
 * position et son échelle sont des fonctions AFFINES de l'échelle du trou, les
 * huit restent jointives à chaque image, sans rien calculer pendant l'animation.
 *
 * Tout est en pixels d'ÉCRAN : le conteneur annule la densité
 * (`zoom: var(--zoom-inv)`), comme la copie de l'icône le fait par ses calculs.
 */

/** Le rayon de la plaque, en fraction de son côté (`rx="22.5"` sur 100). */
export const RAYON_PLAQUE = 0.225;
/** L'inspiration avant d'entrer : l'icône se contracte à 86 %. */
export const CONTRACTION = 0.86;
/** Recouvrement des coins sur les pans, en pixels à l'échelle 1 (pas de fente). */
const RECOUVREMENT = 2;

export interface Trou {
  /** Centre de l'icône, en pixels d'écran. */
  readonly cx: number;
  readonly cy: number;
  /** Côté de l'icône à l'échelle 1. */
  readonly cote: number;
  /** Taille de la fenêtre. */
  readonly largeur: number;
  readonly hauteur: number;
  /** L'échelle à laquelle le trou contient toute la fenêtre. */
  readonly echelleFinale: number;
}

/**
 * L'échelle finale : le carré arrondi contient son cercle inscrit, donc il
 * suffit que ce cercle atteigne le coin de la fenêtre le plus éloigné.
 */
export function trou(
  cx: number,
  cy: number,
  cote: number,
  largeur: number,
  hauteur: number,
): Trou {
  const dx = Math.max(cx, largeur - cx);
  const dy = Math.max(cy, hauteur - cy);
  const demi = Math.hypot(dx, dy) * 1.04;
  const echelleFinale = Math.max(2, demi / (cote / 2));
  return { cx, cy, cote, largeur, hauteur, echelleFinale };
}

export type Piece = "haut" | "bas" | "gauche" | "droite" | "hg" | "hd" | "bg" | "bd";
export const PIECES: readonly Piece[] = ["haut", "bas", "gauche", "droite", "hg", "hd", "bg", "bd"];

/** Le côté d'un coin dessiné à sa taille finale (rayon + recouvrement). */
export function coteCoin(t: Trou): number {
  return (RAYON_PLAQUE * t.cote + RECOUVREMENT) * t.echelleFinale;
}

/** Le rayon du coin à sa taille finale. */
export function rayonCoin(t: Trou): number {
  return RAYON_PLAQUE * t.cote * t.echelleFinale;
}

/**
 * La transformation d'une pièce quand le trou est à l'échelle `s`
 * (`s = 1` : le trou a exactement la taille de l'icône).
 * Pans : origine en haut à gauche, taille de la fenêtre.
 * Coins : origine en haut à gauche, taille `coteCoin`.
 */
export function transformation(t: Trou, piece: Piece, s: number): string {
  const h = (t.cote / 2) * s; // demi-côté du trou
  const r = RAYON_PLAQUE * t.cote * s; // rayon du coin
  const o = RECOUVREMENT * s; // recouvrement
  const k = s / t.echelleFinale; // réduction d'un coin dessiné à sa taille finale
  const px = (n: number) => `${round(n)}px`;
  switch (piece) {
    case "haut":
      return `translate3d(0, ${px(t.cy - h - t.hauteur)}, 0)`;
    case "bas":
      return `translate3d(0, ${px(t.cy + h)}, 0)`;
    case "gauche":
      return `translate3d(${px(t.cx - h - t.largeur)}, 0, 0)`;
    case "droite":
      return `translate3d(${px(t.cx + h)}, 0, 0)`;
    case "hg":
      return `translate3d(${px(t.cx - h - o)}, ${px(t.cy - h - o)}, 0) scale(${round(k)})`;
    case "hd":
      return `translate3d(${px(t.cx + h - r)}, ${px(t.cy - h - o)}, 0) scale(${round(k)})`;
    case "bg":
      return `translate3d(${px(t.cx - h - o)}, ${px(t.cy + h - r)}, 0) scale(${round(k)})`;
    case "bd":
      return `translate3d(${px(t.cx + h - r)}, ${px(t.cy + h - r)}, 0) scale(${round(k)})`;
  }
}

/** D'où part le cercle du coin, dans la pièce (vers l'intérieur du trou). */
export const ANCRE_COIN: Record<"hg" | "hd" | "bg" | "bd", string> = {
  hg: "100% 100%",
  hd: "0% 100%",
  bg: "100% 0%",
  bd: "0% 0%",
};

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
