/**
 * Ce que la grille redimensionnable (`components/grid/ResizableGrid.tsx`) fait
 * d'un identifiant de panneau ENREGISTRÉ qui n'existe plus à l'écran.
 *
 * Une grille garde trois réglages par vue : `order.<vue>` (l'ordre choisi),
 * `hidden.<vue>` (les panneaux masqués) et `layout.<vue>` (les tailles
 * épinglées). Ils survivent aux versions : le jour où un panneau est retiré de
 * l'app, son identifiant y traîne encore.
 *
 * ⭐ 2026-10-11 — la jauge « Énergie restante » (`energy` sur Aujourd'hui,
 * `settings-energy` dans les Réglages) est retirée pour tout le monde. Ces deux
 * règles vivaient en ligne dans le composant ; elles sortent ici pour qu'un
 * test les tienne (`grille.test.ts`) : un identifiant orphelin ne doit laisser
 * NI TROU dans la grille, NI PASTILLE « + … » pour rallumer une carte qui
 * n'existe plus.
 *
 * ⚠️ On ne nettoie PAS les réglages : l'identifiant orphelin reste dans la
 * base, inerte. Un appareil resté en ancienne version le lit encore
 * (`order.<vue>` est synchronisé), et une taille épinglée orpheline n'est
 * jamais lue — la grille n'interroge `layout.<vue>` que par l'identifiant d'un
 * panneau présent.
 */

/**
 * L'ordre réellement rendu : l'ordre enregistré, réduit aux panneaux présents,
 * puis les panneaux présents qu'il ne connaît pas encore, dans l'ordre du code.
 */
export function ordreEffectif(enregistre: readonly string[], presents: readonly string[]): string[] {
  const connus = new Set(presents);
  const gardes = enregistre.filter((id) => connus.has(id));
  const vus = new Set(gardes);
  return [...gardes, ...presents.filter((id) => !vus.has(id))];
}

/**
 * Les panneaux masqués qu'on peut PROPOSER de rallumer : ceux qui existent
 * encore. Un masqué orphelin n'a ni titre ni contenu à remettre.
 */
export function masquesConnus(masques: readonly string[], presents: readonly string[]): string[] {
  const connus = new Set(presents);
  return masques.filter((id) => connus.has(id));
}
