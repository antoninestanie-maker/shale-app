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
