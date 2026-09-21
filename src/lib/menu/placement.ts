/**
 * Où poser un menu flottant — calcul PUR, sans DOM.
 *
 * ⭐ POURQUOI CE FICHIER EXISTE. Le dépôt a déjà payé deux fois ce calcul :
 *
 *   • `PIEGES.md` § 14.1 — un menu en `absolute` dans une carte de grille est
 *     RONGÉ sous la dernière ligne (`overflow: clip` du `ResizablePanel`). Le
 *     rectangle mesuré à 1 025 px dans une fenêtre de 1 000, hors d'atteinte
 *     même en défilant : le clic tombait dans le vide, sans une erreur.
 *     Parade : un PORTAIL en `position: fixed`, mesuré avant la peinture.
 *
 *   • `PIEGES.md` § 16.2 — un panneau qui SUIT le défilement sort de l'écran
 *     avec son ancre. `top: 1606px` dans une fenêtre de 900 : « visible,
 *     ouvert, et invisible ». Parade : ancre entièrement hors écran → on
 *     REFERME ; ancre à demi visible → on borne des deux côtés.
 *
 * Les deux parades vivent ici, en une seule fonction testable, plutôt que
 * réécrites dans chaque composant qui ouvre un panneau.
 */

/** Ce qu'on a besoin de savoir de l'ancre. Le sous-ensemble utile d'un DOMRect. */
export interface Ancre {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Taille {
  width: number;
  height: number;
}

export interface Fenetre {
  width: number;
  height: number;
}

/**
 * Comment le menu s'aligne horizontalement sur son ancre.
 *
 * `"debut"` — le bord GAUCHE du menu sur le bord gauche de l'ancre. C'est le
 * cas du clic droit : l'ancre est le point du curseur, et le menu se déploie
 * vers la droite et vers le bas, comme partout ailleurs sur macOS.
 *
 * `"fin"` — le bord DROIT du menu sur le bord droit de l'ancre. C'est le cas
 * du bouton « ⋯ », qui vit à droite de sa ligne : aligné par la gauche, le menu
 * déborderait de la carte.
 */
export type Alignement = "debut" | "fin";

export type Placement = { top: number; left: number } | "fermer";

/** Marge minimale entre le menu et le bord de la fenêtre. */
export const MARGE = 8;
/** Écart entre l'ancre et le menu. */
const ECART = 4;

/**
 * L'ancre est-elle entièrement sortie de l'écran ?
 *
 * ⚠️ Le test porte sur la VERTICALE seule, et c'est volontaire : c'est le
 * défilement qui fait sortir une ancre, et il est vertical dans toutes les
 * listes de l'app. Une ancre poussée hors du bord droit par un redimensionnement
 * reste, elle, rattrapable par le bornage.
 */
export function ancrePerdue(ancre: Ancre, fenetre: Fenetre): boolean {
  return ancre.bottom < 0 || ancre.top > fenetre.height;
}

/**
 * Le coin haut-gauche du menu, en pixels de la FENÊTRE divisés par le zoom.
 *
 * ⚠️ LA DIVISION PAR LE ZOOM N'EST PAS UN DÉTAIL. Le réglage « Densité »
 * applique un `zoom` CSS : les coordonnées rendues par `getBoundingClientRect()`
 * sont en pixels d'écran, mais un `position: fixed` posé dans un document zoomé
 * est interprété dans les pixels du document. Sans la division, le menu dérive
 * d'autant que la densité s'écarte de 100 % — et le défaut ne se voit PAS à la
 * densité par défaut, donc pas pendant qu'on écrit le code. `Tooltip` et
 * `MenuEtape` font déjà cette division ; c'est la même ici.
 */
export function placer(
  ancre: Ancre,
  menu: Taille,
  fenetre: Fenetre,
  zoom: number,
  alignement: Alignement = "debut",
): Placement {
  if (ancrePerdue(ancre, fenetre)) return "fermer";

  // ── Vertical : dessous d'abord, dessus sinon, borné des deux côtés ────────
  const basDisponible = fenetre.height - MARGE - (ancre.bottom + ECART);
  const hautDisponible = ancre.top - ECART - MARGE;
  const dessous = menu.height <= basDisponible || basDisponible >= hautDisponible;
  let top = dessous ? ancre.bottom + ECART : ancre.top - ECART - menu.height;

  // ⚠️ L'ordre des deux bornes compte : la marge HAUTE gagne quand la fenêtre
  // est trop courte pour le menu. Bornée dans l'autre sens, la première entrée
  // — la plus fréquente — sortirait par le haut, et c'est la seule qu'on ne
  // peut pas rattraper au défilement, puisqu'un menu ne défile pas.
  top = Math.min(top, fenetre.height - MARGE - menu.height);
  top = Math.max(MARGE, top);

  // ── Horizontal : l'alignement demandé, retourné s'il ne tient pas ─────────
  let left = alignement === "debut" ? ancre.left : ancre.right - menu.width;
  if (alignement === "debut" && left + menu.width > fenetre.width - MARGE) {
    left = ancre.right - menu.width;
  } else if (alignement === "fin" && left < MARGE) {
    left = ancre.left;
  }
  left = Math.min(left, fenetre.width - MARGE - menu.width);
  left = Math.max(MARGE, left);

  return { top: top / zoom, left: left / zoom };
}

/**
 * Où poser un SOUS-MENU, à côté de l'entrée qui l'ouvre.
 *
 * À droite par défaut, à gauche s'il n'y a plus la place — et il chevauche son
 * parent de quelques pixels, pour que la souris puisse passer de l'un à l'autre
 * sans traverser un vide qui refermerait le tout.
 */
export function placerSousMenu(
  entree: Ancre,
  parent: Ancre,
  menu: Taille,
  fenetre: Fenetre,
  zoom: number,
): Placement {
  if (ancrePerdue(entree, fenetre)) return "fermer";

  const CHEVAUCHEMENT = 4;
  let left = parent.right - CHEVAUCHEMENT;
  if (left + menu.width > fenetre.width - MARGE) left = parent.left - menu.width + CHEVAUCHEMENT;
  left = Math.max(MARGE, Math.min(left, fenetre.width - MARGE - menu.width));

  let top = entree.top - ECART;
  top = Math.min(top, fenetre.height - MARGE - menu.height);
  top = Math.max(MARGE, top);

  return { top: top / zoom, left: left / zoom };
}
