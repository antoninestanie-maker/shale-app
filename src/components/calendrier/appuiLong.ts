import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * L'appui long AU DOIGT sur un bloc du Calendrier qui ne se glisse pas (une
 * ligne de l'agenda, une journée entière, une occurrence d'une série) : il
 * ouvre le menu du bloc — « Supprimer » compris (2026-10-13, Antonin : « un
 * événement doit se supprimer d'un clic droit, sur le téléphone avec un
 * maintien »).
 *
 * ⚠️ Les blocs qui SE GLISSENT ne passent pas par ici : leur appui long arme
 * déjà le glissement (`GrilleHoraire.saisir`), et c'est le relâché SUR PLACE
 * qui ouvre le menu. Deux minuteries sur le même doigt se marcheraient dessus.
 *
 * ⚠️ Posé dans le `pointerdown`, pas dans un effet (la leçon de `saisir`) : le
 * geste existe dès la première milliseconde.
 */

/** Même durée que l'armement du glissement : un seul « maintien » dans le module. */
export const APPUI_LONG_MS = 400;
/** Au-delà, le doigt défile : ce n'est plus un maintien. */
const TOLERANCE_PX = 6;

/**
 * Avale le clic qui suit un appui long : sans cela, relâcher le doigt après
 * l'ouverture du menu ouvrirait AUSSI la fenêtre de l'événement — le défaut
 * que le clic droit avait à la souris.
 */
export function avalerLeClicSuivant(el: HTMLElement): void {
  const avaler = (ev: Event) => {
    ev.stopPropagation();
    ev.preventDefault();
  };
  el.addEventListener("click", avaler, { capture: true, once: true });
  // Pas de clic à venir (le doigt a glissé hors du bloc) : on ne laisse pas un
  // écouteur armé qui mangerait le prochain vrai toucher.
  window.setTimeout(() => el.removeEventListener("click", avaler, { capture: true }), 700);
}

export function surAppuiLong(e: ReactPointerEvent<HTMLElement>, quand: (el: HTMLElement) => void): void {
  if (e.pointerType !== "touch") return;
  const el = e.currentTarget;
  const depart = { x: e.clientX, y: e.clientY };

  const detacher = () => {
    window.clearTimeout(minuterie);
    window.removeEventListener("pointermove", bouger);
    window.removeEventListener("pointerup", detacher);
    window.removeEventListener("pointercancel", detacher);
  };
  const bouger = (ev: PointerEvent) => {
    if (Math.hypot(ev.clientX - depart.x, ev.clientY - depart.y) > TOLERANCE_PX) detacher();
  };
  const minuterie = window.setTimeout(() => {
    detacher();
    if (!el.isConnected) return;
    avalerLeClicSuivant(el);
    try {
      navigator.vibrate?.(12);
    } catch {
      /* pas de vibreur : pas une erreur */
    }
    quand(el);
  }, APPUI_LONG_MS);

  window.addEventListener("pointermove", bouger);
  window.addEventListener("pointerup", detacher);
  window.addEventListener("pointercancel", detacher);
}
