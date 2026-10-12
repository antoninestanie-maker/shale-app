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
