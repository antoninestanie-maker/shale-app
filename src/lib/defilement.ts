/**
 * Amener un élément dans la zone visible — en glissant, sauf si le système
 * demande moins de mouvement.
 *
 * ⚠️ Ce fichier existe parce que la règle globale `prefers-reduced-motion`
 * (`index.css`) n'atteint PAS un défilement lissé : elle écrase la durée des
 * animations et des transitions CSS, et `scrollIntoView({ behavior: "smooth" })`
 * n'est ni l'une ni l'autre. Trois appels le faisaient sans garde (barre
 * latérale, Tâches, Market-Brain) : quelqu'un qui a coupé les animations dans
 * macOS voyait encore l'écran glisser. Tout défilement lissé passe par ici.
 */
export function mouvementReduit(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export function defilerVers(
  el: Element | null | undefined,
  options: { block?: ScrollLogicalPosition; inline?: ScrollLogicalPosition } = {},
): void {
  if (!el) return;
  el.scrollIntoView({
    block: options.block ?? "nearest",
    inline: options.inline ?? "nearest",
    behavior: mouvementReduit() ? "auto" : "smooth",
  });
}

/** Un rectangle en coordonnées de fenêtre — ce que rend `getBoundingClientRect`. */
export interface Cadre {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Les deux points qu'on sonde pour savoir si une ligne est ENTIÈREMENT à
 * l'écran : au milieu de sa largeur, juste sous son bord haut et juste
 * au-dessus de son bord bas. `null` : la ligne n'a pas de surface.
 */
export function pointsDeControle(cadre: Cadre): [{ x: number; y: number }, { x: number; y: number }] | null {
  const hauteur = cadre.bottom - cadre.top;
  if (!(hauteur > 0) || !(cadre.right - cadre.left > 0)) return null;
  const x = (cadre.left + cadre.right) / 2;
  // Deux pixels en dedans : le bord lui-même appartient parfois au voisin.
  const retrait = Math.min(2, hauteur / 4);
  return [
    { x, y: cadre.top + retrait },
    { x, y: cadre.bottom - retrait },
  ];
}

/**
 * ⭐ Cet élément est-il ENTIÈREMENT VISIBLE, là, maintenant (2026-10-12) ?
 *
 * Sert à ne pas faire défiler l'écran pour rien, et à ne pas annoncer « ajoutée
 * plus bas » quand la ligne est sous les yeux (ajout rapide de Tâches).
 *
 * ⚠️ ON DEMANDE AU NAVIGATEUR CE QU'IL Y A À CET ENDROIT (`elementFromPoint`),
 * on ne compare pas des rectangles. Comparer la ligne à sa zone de défilement
 * oublierait tout ce qui la RECOUVRE : au téléphone la barre d'onglets est en
 * `fixed` par-dessus le bas de la vue (une réserve en `padding`, `App.tsx`), et
 * la pastille du minuteur s'y ajoute pendant une séance. Une ligne « dans la
 * zone » y est à moitié cachée — vu à 390 px le 2026-10-12. Et les deux mesures
 * (le rectangle, le point sondé) sont dans le MÊME repère, celui de la fenêtre :
 * le `zoom` de la densité ne les sépare pas.
 *
 * Hors d'un navigateur (les tests), la réponse est « non ».
 */
export function estEnVue(el: Element | null | undefined): boolean {
  if (!el || typeof document === "undefined" || typeof document.elementFromPoint !== "function") return false;
  const points = pointsDeControle(el.getBoundingClientRect());
  if (!points) return false;
  return points.every(({ x, y }) => {
    const dessus = document.elementFromPoint(x, y);
    return !!dessus && el.contains(dessus);
  });
}
