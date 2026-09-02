import { jetonMention } from "./mentions";
import type { LinkKind } from "./types";

/**
 * Les gestes de curseur des mentions — la part qui touche au DOM.
 *
 * ⚠️ SÉPARÉ DE `lib/mentions.ts` À DESSEIN. Les tests de ce dépôt tournent en
 * `environment: "node"` : ce fichier-ci n'est pas testable, celui-là l'est
 * entièrement. Tout ce qui peut être décidé sans DOM vit là-bas ; il ne reste
 * ici que ce qui ne peut pas s'en passer — et c'est court exprès.
 */

/** Le texte qui précède le curseur dans le nœud courant. Vide si pas de curseur. */
export function texteAvantCurseur(racine: HTMLElement): string {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return "";
  const range = sel.getRangeAt(0);
  if (!racine.contains(range.startContainer)) return "";
  const avant = range.cloneRange();
  avant.selectNodeContents(racine);
  avant.setEnd(range.startContainer, range.startOffset);
  return avant.toString();
}

/** Où poser le sélecteur : le rectangle du curseur, en coordonnées de fenêtre. */
export function rectDuCurseur(): { x: number; y: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const rects = sel.getRangeAt(0).getClientRects();
  const r = rects.length ? rects[0] : sel.getRangeAt(0).getBoundingClientRect();
  // ⚠️ Un curseur en début de ligne vide rend un rectangle à zéro : on retombe
  // alors sur le bloc parent, sinon le sélecteur s'afficherait dans le coin
  // haut-gauche de l'écran, très loin de ce qu'on est en train d'écrire.
  if (r.x === 0 && r.y === 0) {
    const n = sel.getRangeAt(0).startContainer;
    const el = n.nodeType === 1 ? (n as HTMLElement) : n.parentElement;
    const p = el?.getBoundingClientRect();
    return p ? { x: p.left, y: p.bottom } : null;
  }
  return { x: r.left, y: r.bottom };
}

/**
 * Remplace le `@requête` en cours de frappe par un jeton de mention.
 *
 * ⚠️ On repart du texte, caractère par caractère, plutôt que d'un
 * `execCommand("insertHTML")` posé n'importe où : le `@` peut être à cheval sur
 * plusieurs nœuds si l'utilisateur a mis un mot en gras juste avant. Le seul
 * repère sûr est le contenu du nœud texte où se trouve le curseur.
 *
 * Rend `false` quand le `@` n'a pas été retrouvé — l'appelant n'insère alors
 * rien, plutôt que de coller un jeton à un endroit arbitraire.
 */
export function remplacerParMention(
  racine: HTMLElement,
  longueurRequete: number,
  kind: LinkKind,
  uid: string,
  titre: string,
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const range = sel.getRangeAt(0);
  const noeud = range.startContainer;
  if (noeud.nodeType !== Node.TEXT_NODE || !racine.contains(noeud)) return false;

  const fin = range.startOffset;
  const debut = fin - longueurRequete - 1; // −1 pour le `@` lui-même
  if (debut < 0 || (noeud.textContent ?? "").charAt(debut) !== "@") return false;

  const aRemplacer = document.createRange();
  aRemplacer.setStart(noeud, debut);
  aRemplacer.setEnd(noeud, fin);
  sel.removeAllRanges();
  sel.addRange(aRemplacer);

  // `insertHTML` fait le travail du navigateur : il gère la fusion des nœuds et
  // l'historique d'annulation, que reconstruire à la main ferait perdre.
  // L'espace insaisissable qui suit évite que le curseur reste PRISONNIER
  // derrière un jeton `contenteditable="false"` en fin de ligne.
  document.execCommand("insertHTML", false, jetonMention(kind, uid, titre) + "&nbsp;");
  return true;
}
