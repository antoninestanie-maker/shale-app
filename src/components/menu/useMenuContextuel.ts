/**
 * L'ouverture d'un menu contextuel : qui, où, et par quel geste.
 *
 * ⭐ UN SEUL MENU PAR LISTE, PAS UN PAR LIGNE. Le hook garde la CIBLE, et la
 * liste lui passe l'objet de la ligne au moment du geste. Une liste de trois
 * cents notes n'instancie donc ni trois cents portails ni trois cents
 * écouteurs de clavier — et il n'y a qu'un seul menu ouvert à la fois, ce qui
 * est de toute façon la seule chose qui ait un sens.
 *
 * ⚠️ LA CIBLE EST CAPTURÉE À L'OUVERTURE, jamais relue à l'exécution. C'est la
 * leçon du chantier H (contenu d'une note écrit dans une autre, 2026-09-06) :
 * une action différée qui va chercher « l'objet courant » au moment de partir
 * trouve celui d'après. Ici, `cible` est figée tant que le menu est ouvert.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { Alignement, Ancre } from "../../lib/menu/placement";
import { pointeurGrossier } from "../../lib/menu/tactile";

export interface EtatMenu<C> {
  /** L'objet sur lequel le menu est ouvert. `null` quand il est fermé. */
  cible: C | null;
  ouvert: boolean;
  ancre: Ancre | null;
  alignement: Alignement;
  /**
   * L'ancre est-elle un ÉLÉMENT (le bouton « ⋯ ») ou un POINT (le curseur) ?
   * Un élément se re-mesure au défilement ; un point, non — voir `MenuContextuel`.
   */
  elementAncre: HTMLElement | null;
  /** Ouvert au clavier ⇒ la première entrée prend le focus d'emblée. */
  auClavier: boolean;
  /** À poser sur la ligne : clic droit, Ctrl+clic, tap à deux doigts, Maj+F10. */
  ouvrirAuPoint: (e: ReactMouseEvent, cible: C) => void;
  /** À poser sur le bouton « ⋯ ». */
  ouvrirSousLeBouton: (e: ReactMouseEvent<HTMLElement>, cible: C) => void;
  /**
   * À poser en `onKeyDown` sur la ligne. Ouvre le menu sur Maj+F10 ou la touche
   * Menu, et rend VRAI si la touche lui revenait — pour que l'appelant puisse
   * enchaîner ses propres raccourcis (F2…) sans les faire passer deux fois.
   */
  ouvrirAuClavier: (e: ReactKeyboardEvent<HTMLElement>, cible: C) => boolean;
  /**
   * Ouvre sous un ÉLÉMENT qu'on désigne soi-même — pour ce qui n'a pas de
   * bouton « ⋯ » à soi : un bloc DANS une note (carte, croquis), touché au
   * doigt. Au doigt, `ouvrirAuPoint` ne fait rien (l'appui long appartient au
   * glisser du calendrier) : c'est ce chemin-ci qui porte la règle 17 là.
   */
  ouvrirSurElement: (el: HTMLElement, cible: C) => void;
  fermer: () => void;
}

interface Etat<C> {
  cible: C;
  ancre: Ancre;
  alignement: Alignement;
  elementAncre: HTMLElement | null;
  auClavier: boolean;
}

/**
 * ⚠️⚠️ DEUX QUESTIONS DISTINCTES, DEUX RÉPONSES — ne jamais les confondre.
 *
 * LE DÉFAUT PAYÉ ICI (2026-09-21, vu en pilotant le navigateur). La première
 * version demandait « est-ce venu du clavier ? » avec `e.detail === 0`, et s'en
 * servait POUR LES DEUX : où poser le menu, et faut-il surligner la première
 * entrée. Or un vrai clic droit de souris, dans Chromium, arrive avec
 * `detail: 0` — mesuré, `isTrusted: true`, `button: 2`, `clientX: 404`.
 * Conséquence : TOUS les clics droits s'ancraient sur la LIGNE au lieu du
 * curseur. Le menu s'ouvrait, il était joli, il était au mauvais endroit — et
 * aucune capture d'écran ne l'aurait dit, puisqu'un menu sous sa ligne a l'air
 * parfaitement normal.
 *
 * D'où la séparation :
 */

/** Le sous-ensemble d'un événement dont ces deux règles ont besoin. */
export interface GesteMenu {
  clientX: number;
  clientY: number;
  button: number;
  detail: number;
}

/**
 * ① OÙ poser le menu. On se fie aux COORDONNÉES, et à rien d'autre.
 *
 * Des coordonnées nulles = pas de point (c'est ainsi que Firefox annonce
 * Maj+F10). Chromium, lui, place le point sur l'élément focalisé : on le suit
 * alors, et le résultat est visuellement identique à un ancrage sur l'élément.
 * Cette règle est donc juste quel que soit le geste, sans avoir à le deviner.
 */
export function sansPoint(e: GesteMenu): boolean {
  return e.clientX === 0 && e.clientY === 0;
}

/**
 * ② FAUT-IL surligner la première entrée d'emblée. Là, on veut savoir si une
 * SOURIS est en jeu, et `button === 2` le dit sans ambiguïté.
 *
 * Se tromper ici ne coûte qu'une ligne surlignée de trop ou de trop peu ;
 * se tromper sur ① coûtait un menu au mauvais endroit. Les deux erreurs
 * n'ont pas le même prix, elles n'ont pas à partager le même test.
 */
export function sansSouris(e: GesteMenu): boolean {
  return e.button !== 2 && e.detail === 0;
}

/**
 * ⚠️⚠️ La touche qui ouvre le menu — ÉCOUTÉE PAR NOUS, pas laissée au navigateur.
 *
 * LE DÉFAUT PAYÉ ICI (2026-09-21, mesuré). Le cahier des charges demande
 * « Maj+F10 / touche Menu ». La première version comptait sur le navigateur
 * pour traduire ces touches en `contextmenu`, comme il le fait sous Windows.
 * Mesuré dans le moteur de l'app : `keydown:F10+shift`, `keyup:F10+shift`… et
 * AUCUN `contextmenu`. Maj+F10 est une convention WINDOWS : macOS ne la
 * connaît pas, et un Mac n'a pas de touche Menu. L'ouverture au clavier ne
 * marchait donc JAMAIS sur la machine d'Antonin.
 *
 * On écoute la touche nous-mêmes, et on `preventDefault()` : sous Windows,
 * cela empêche aussi le navigateur d'envoyer son propre `contextmenu` par
 * derrière — sans quoi le menu s'ouvrirait deux fois.
 */
export function toucheDuMenu(e: { key: string; shiftKey: boolean }): boolean {
  return e.key === "ContextMenu" || (e.key === "F10" && e.shiftKey);
}

function pointEnAncre(x: number, y: number): Ancre {
  return { top: y, bottom: y, left: x, right: x };
}

function rectEnAncre(el: HTMLElement): Ancre {
  const r = el.getBoundingClientRect();
  return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
}

export function useMenuContextuel<C>(): EtatMenu<C> {
  const [etat, setEtat] = useState<Etat<C> | null>(null);

  /**
   * L'élément qui avait le focus avant l'ouverture, pour le lui RENDRE.
   *
   * ⚠️ Sans cela, fermer le menu au clavier laisse le focus sur `<body>` : la
   * touche suivante ne va nulle part, et il faut re-tabuler depuis le début de
   * la page pour retrouver sa ligne. Le défaut ne se voit pas à la souris.
   */
  const focusAvant = useRef<HTMLElement | null>(null);

  const fermer = useCallback(() => {
    setEtat(null);
    const cible = focusAvant.current;
    focusAvant.current = null;
    // Après la peinture : rendre le focus pendant que le portail est encore
    // dans le document le ferait reprendre par le menu qu'on vient de fermer.
    if (cible?.isConnected) requestAnimationFrame(() => cible.focus());
  }, []);

  const ouvrirAuPoint = useCallback((e: ReactMouseEvent, cible: C) => {
    // Au doigt, le clic droit n'existe pas : ce `contextmenu` est un appui
    // long, et l'appui long appartient au glisser du calendrier. On ne le
    // consomme pas — on ne l'empêche pas non plus.
    if (pointeurGrossier()) return;

    e.preventDefault();
    // ⚠️ Nécessaire pour les listes imbriquées (une tâche dans un objectif) :
    // sans lui, le menu du parent s'ouvrirait par-dessus celui de l'enfant.
    e.stopPropagation();

    const el = e.currentTarget as HTMLElement;
    const surLElement = sansPoint(e);
    focusAvant.current = document.activeElement as HTMLElement | null;
    setEtat({
      cible,
      ancre: surLElement ? rectEnAncre(el) : pointEnAncre(e.clientX, e.clientY),
      alignement: "debut",
      // Une ancre-POINT ne se re-mesure pas au défilement : un point du curseur
      // est déjà en coordonnées de fenêtre. Seule une ancre-ÉLÉMENT suit.
      elementAncre: surLElement ? el : null,
      auClavier: sansSouris(e),
    });
  }, []);

  const ouvrirSousLeBouton = useCallback((e: ReactMouseEvent<HTMLElement>, cible: C) => {
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    focusAvant.current = el;
    setEtat({
      cible,
      ancre: rectEnAncre(el),
      // Le « ⋯ » vit à DROITE de sa ligne : aligné par la gauche, le menu
      // déborderait de la carte à chaque fois.
      alignement: "fin",
      elementAncre: el,
      auClavier: sansSouris(e),
    });
  }, []);

  const ouvrirAuClavier = useCallback((e: ReactKeyboardEvent<HTMLElement>, cible: C) => {
    if (e.defaultPrevented || !toucheDuMenu(e)) return false;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget;
    focusAvant.current = document.activeElement as HTMLElement | null;
    setEtat({
      cible,
      ancre: rectEnAncre(el),
      alignement: "debut",
      elementAncre: el,
      // Ouvert au clavier : la première entrée prend le focus d'emblée.
      auClavier: true,
    });
    return true;
  }, []);

  const ouvrirSurElement = useCallback((el: HTMLElement, cible: C) => {
    focusAvant.current = document.activeElement as HTMLElement | null;
    setEtat({ cible, ancre: rectEnAncre(el), alignement: "debut", elementAncre: el, auClavier: false });
  }, []);

  // Le bouton d'ancre a disparu du document (la ligne a été retirée par la
  // synchronisation pendant que le menu était ouvert) : on ferme, sans bruit.
  useEffect(() => {
    if (!etat?.elementAncre) return;
    if (!etat.elementAncre.isConnected) fermer();
  });

  return {
    cible: etat?.cible ?? null,
    ouvert: etat !== null,
    ancre: etat?.ancre ?? null,
    alignement: etat?.alignement ?? "debut",
    elementAncre: etat?.elementAncre ?? null,
    auClavier: etat?.auClavier ?? false,
    ouvrirAuPoint,
    ouvrirSousLeBouton,
    ouvrirAuClavier,
    ouvrirSurElement,
    fermer,
  };
}
