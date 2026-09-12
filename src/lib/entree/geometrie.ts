import type { RectMarque } from "./signal";

/**
 * Les repères géométriques de la traversée, en pixels.
 *
 * Sortis du composant et rendus PURS exprès : c'est la partie la plus facile à
 * se tromper (le rayon final, notamment) et la plus difficile à voir de l'œil —
 * une erreur y laisse un liseré du mur dans un angle pendant trois images.
 */
export interface ReperesEntree {
  /** Coin haut-gauche et côté de la copie animée, posés au pixel de l'originale. */
  readonly x: number;
  readonly y: number;
  readonly taille: number;
  /** Centre de la marque : c'est de là qu'on traverse. */
  readonly cx: number;
  readonly cy: number;
  /** Rayon de départ de l'ouverture : l'intérieur de la plaque, une fois grossie. */
  readonly r0: number;
  /** Rayon d'arrivée : de quoi dépasser l'écran, quel que soit le coin. */
  readonly r1: number;
  readonly echelle: number;
}

export function reperesEntree(
  rect: RectMarque,
  largeur: number,
  hauteur: number,
  echelle: number,
): ReperesEntree {
  const cx = rect.x + rect.taille / 2;
  const cy = rect.y + rect.taille / 2;

  /**
   * ⚠️ LE RAYON FINAL SE MESURE DEPUIS LE CENTRE DE LA MARQUE, PAS DE L'ÉCRAN.
   *
   * La marque est au-dessus du formulaire, donc au-dessus du milieu : le coin
   * le plus éloigné est un coin du BAS. Prendre la demi-diagonale de l'écran
   * laisserait le mur intact dans cet angle-là jusqu'à la dernière image.
   * On prend donc le maximum sur les quatre coins, et on ajoute 2 % de marge
   * pour l'arrondi au pixel.
   */
  const r1 =
    Math.max(
      Math.hypot(cx, cy),
      Math.hypot(largeur - cx, cy),
      Math.hypot(cx, hauteur - cy),
      Math.hypot(largeur - cx, hauteur - cy),
    ) * 1.02;

  return {
    x: rect.x,
    y: rect.y,
    taille: rect.taille,
    cx,
    cy,
    // L'ouverture démarre à l'intérieur de la plaque grossie, pas à zéro :
    // c'est ce qui donne « on passe AU TRAVERS » plutôt que « un cercle
    // apparaît quelque part ».
    r0: (rect.taille * echelle) / 2.9,
    r1,
    echelle,
  };
}

/** Les repères, prêts à être posés comme variables CSS. */
export function variablesEntree(r: ReperesEntree): Record<string, string> {
  return {
    "--entree-x": `${r.x}px`,
    "--entree-y": `${r.y}px`,
    "--entree-taille": `${r.taille}px`,
    "--entree-cx": `${r.cx}px`,
    "--entree-cy": `${r.cy}px`,
    "--entree-r0": `${r.r0}px`,
    "--entree-r1": `${r.r1}px`,
    "--entree-echelle": String(r.echelle),
  };
}
