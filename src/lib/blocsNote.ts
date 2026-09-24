/**
 * Les BLOCS d'une note — carte mentale, croquis, image, pièce jointe — vus par
 * le menu contextuel : lequel est sous le pointeur, et comment le retirer en
 * gardant de quoi le remettre.
 *
 * ⭐ POURQUOI CE FICHIER EXISTE (2026-09-24, signalé par Antonin : « je ne peux
 * pas supprimer une carte mentale dans une note avec un clic droit »). Dans un
 * `contenteditable`, le clic droit rendait le menu du SYSTÈME (Copier, Coller) :
 * c'est voulu pour le texte, et c'est une impasse pour un bloc. Le seul moyen de
 * retirer une carte était de la sélectionner puis Retour arrière — un geste que
 * rien n'indique.
 *
 * ⚠️ LE RETRAIT EST RÉVERSIBLE PAR NOUS, PAS PAR ⌘Z. Un nœud retiré par le DOM
 * n'entre pas dans la pile d'annulation du navigateur. `retirerBloc` rend donc
 * une fonction qui le REMET à sa place exacte (même parent, même voisin) : c'est
 * elle que le toast « Annuler » appelle.
 */

import { CLASSE_PIECE_JOINTE } from "./piecesJointes";

export type TypeBloc = "carte" | "croquis" | "image" | "piece";

export interface BlocNote {
  type: TypeBloc;
  /** L'élément À RETIRER — la `<figure>` entière, pas l'`<img>` qu'elle porte. */
  element: HTMLElement;
}

/**
 * Le bloc sous ce point, s'il y en a un DANS cette racine.
 *
 * L'ordre compte : une pièce jointe peut vivre dans un paragraphe, une image
 * dans une figure ; on cherche du plus précis au plus large.
 */
export function blocSous(cible: EventTarget | null, racine: HTMLElement | null): BlocNote | null {
  if (!racine || !(cible instanceof Element) || !racine.contains(cible)) return null;

  const jeton = cible.closest<HTMLElement>(`.${CLASSE_PIECE_JOINTE}`);
  if (jeton && racine.contains(jeton)) return { type: "piece", element: jeton };

  const carte = cible.closest<HTMLElement>("figure[data-mindmap]");
  if (carte && racine.contains(carte)) return { type: "carte", element: carte };

  const img = cible.closest<HTMLImageElement>("img");
  if (img && racine.contains(img)) {
    // La figure qui l'enveloppe part avec elle : laisser une `<figure>` vide
    // dans la note serait un bloc fantôme, cliquable et invisible.
    const figure = img.closest<HTMLElement>("figure");
    const element = figure && racine.contains(figure) && figure !== racine ? figure : img;
    return { type: img.dataset.sketch !== undefined ? "croquis" : "image", element };
  }
  return null;
}

/**
 * Retire le bloc, et rend de quoi le remettre.
 *
 * ⚠️ La fonction rendue rend `false` quand la remise est IMPOSSIBLE — la note a
 * changé entre-temps (autre note ouverte, lecteur fermé) : son parent n'est plus
 * dans le document. Remettre un bloc dans un arbre détaché ne ferait rien de
 * visible, et le dire vaut mieux que de faire semblant (règle 15 : la cible est
 * capturée au retrait, jamais relue au moment du clic).
 */
export function retirerBloc(bloc: BlocNote): () => boolean {
  const { element } = bloc;
  const parent = element.parentNode;
  const suivant = element.nextSibling;
  element.remove();
  return () => {
    if (!parent || !parent.isConnected) return false;
    const voisin = suivant && suivant.parentNode === parent ? suivant : null;
    parent.insertBefore(element, voisin);
    return true;
  };
}

/** Le nom d'une pièce jointe, tel que le jeton le porte. */
export function nomDePiece(element: HTMLElement): string {
  return element.dataset.nom ?? element.textContent?.trim() ?? "";
}
