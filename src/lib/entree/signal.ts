/**
 * Les deux fils qui relient la transition d'entrée au reste de l'app.
 *
 * Ils sont ici, hors de React, pour une raison précise à chaque fois.
 */

/** Position et taille de la marque au moment où on quitte l'écran de connexion. */
export interface RectMarque {
  readonly x: number;
  readonly y: number;
  readonly taille: number;
}

let rect: RectMarque | null = null;

/**
 * Relève la position RÉELLE de la marque, juste avant de quitter l'écran.
 *
 * ⭐ POURQUOI CE N'EST PAS DANS UN ÉTAT REACT.
 *
 * `AuthGate` remplace le mur par l'app EN UN SEUL RENDU. La marque du
 * `LoginScreen` est donc démontée à l'instant précis où l'app apparaît : au
 * moment où la transition voudrait la mesurer, elle n'est plus là. La mesure
 * doit être prise AVANT, dans `LoginScreen.submit()`, avant d'attendre
 * `onSignIn` — et survivre au démontage. Un module l'y aide, un état non.
 *
 * ⚠️ On relève un CARRÉ : la marque est un SVG carré, et la copie animée doit
 * l'être aussi. Prendre `width` et `height` séparément laisserait passer un
 * demi-pixel de différence, qui se voit une fois multiplié par le facteur
 * d'échelle du temps 2.
 */
export function mesurerMarque(el: Element | null): void {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return; // masquée : rien à mesurer
  rect = { x: r.left, y: r.top, taille: Math.min(r.width, r.height) };
}

export function rectMarque(): RectMarque | null {
  return rect;
}

/**
 * Repli quand personne n'a mesuré : l'ouverture à froid (phase D), où il n'y a
 * pas d'écran de connexion. La marque part alors du centre de l'écran.
 */
export function rectParDefaut(taille: number, largeur: number, hauteur: number): RectMarque {
  return { x: (largeur - taille) / 2, y: (hauteur - taille) / 2, taille };
}

// ── « L'app est prête » ──────────────────────────────────────────────────────

let prete = false;
const abonnes = new Set<() => void>();

/**
 * Appelé par `App` quand ses données sont chargées.
 *
 * ⭐ La transition habille du TRAVAIL RÉEL : elle ne se termine qu'une fois ce
 * signal reçu. Sans lui, on aurait une jolie animation qui découvre un écran
 * vide, puis un ressaut quand les données arrivent — soit deux entrées au lieu
 * d'une.
 *
 * Un module et non un contexte : `App` est montée SOUS `AuthGate`, donc elle ne
 * peut pas remonter l'information par un contexte qu'`AuthGate` fournirait.
 */
export function signalerAppPrete(): void {
  if (prete) return;
  prete = true;
  for (const cb of [...abonnes]) cb();
}

export function appEstPrete(): boolean {
  return prete;
}

export function surAppPrete(cb: () => void): () => void {
  abonnes.add(cb);
  return () => abonnes.delete(cb);
}

/** Remise à zéro — déconnexion, et tests. */
export function reinitialiserEntree(): void {
  prete = false;
  rect = null;
  abonnes.clear();
}
