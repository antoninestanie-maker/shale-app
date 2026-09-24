/**
 * « Est-on au doigt ? »
 *
 * ⚠️ POURQUOI CETTE QUESTION DÉCIDE DE QUELQUE CHOSE ICI. Sur un écran tactile,
 * l'appui long émet un `contextmenu`. Or l'appui long de 400 ms appartient DÉJÀ
 * au glisser-déposer du calendrier (`MOBILE.md`, chantier iOS du 2026-09-02) :
 * ouvrir un menu dessus, ce serait arracher la tâche qu'on voulait déplacer, ou
 * l'inverse, une fois sur deux.
 *
 * Donc : au doigt, le menu ne s'ouvre QUE par le bouton « ⋯ ». Le clic droit
 * est un accélérateur de souris, et il le reste.
 *
 * ⚠️ `pointer: coarse` et pas une largeur de fenêtre : une tablette au stylet
 * et un portable à écran tactile ne se reconnaissent pas à leur taille. C'est
 * la règle que `src/index.css` applique déjà pour `.cible-tactile`.
 */

const REQUETE = "(pointer: coarse)";

export function pointeurGrossier(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(REQUETE).matches;
}

/**
 * Un menu contextuel est-il ouvert, en ce moment, n'importe où dans l'app ?
 *
 * ⚠️ POUR LES ÉCOUTEURS CLAVIER EN PHASE DE CAPTURE (`window`, `true`). Ils
 * passent AVANT le menu : sans ce test, Échap fermait le menu ET l'éditeur de
 * carte dessous d'un seul coup (vu le 2026-09-24, en pilotant Chrome) — le
 * menu n'avait pas encore reçu la touche qu'il aurait marquée. Tant qu'un menu
 * est ouvert, le clavier est à lui. Le panneau porte `data-menu-contextuel`.
 */
export function menuContextuelOuvert(): boolean {
  return typeof document !== "undefined" && !!document.querySelector("[data-menu-contextuel]");
}
