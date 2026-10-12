/**
 * La barre latérale : étendue (libellés, largeur réglable) ou réduite (64 px,
 * icônes).
 *
 * ⭐ LE CHOIX EST RETENU PAR RÉGIME, pas en un seul booléen (2026-10-11).
 * Avant, seule la largeur de la fenêtre décidait (`lg:` de Tailwind, donc
 * 1024 px de FENÊTRE) : impossible de réduire la barre sur un grand écran, ni
 * de la garder étendue dans une fenêtre étroite. Un booléen unique aurait
 * réparé le premier cas en cassant l'autre — quelqu'un qui étend la barre en
 * grand la retrouverait à 232 px dans une fenêtre de 800, soit 29 % de
 * l'écran. D'où deux réponses, une par régime : en fenêtre large elle est
 * étendue par défaut, en fenêtre étroite réduite par défaut, et le bouton
 * retourne la réponse du régime où l'on se trouve.
 *
 * ⚠️ Ce choix vit en `localStorage`, PAS dans la table `settings` : celle-ci
 * part en synchronisation par défaut (`sync/scope.ts`), et la largeur d'une
 * barre dépend de l'écran, pas du compte. Même parti que `shale.lang` — et il
 * se lit SYNCHRONEMENT au premier rendu, donc sans clignotement.
 *
 * Ce fichier est pur (aucun `window`), pour être testé sous `node`.
 */

export type Regime = "large" | "etroit";

/** Largeurs, en pixels LOCAUX. */
export const LARGEUR_RAIL = 64;
export const LARGEUR_DEFAUT = 232;
/** En dessous, « Supprimés récemment » ne tient plus sur sa ligne. */
export const LARGEUR_MIN = 184;
export const LARGEUR_MAX = 400;
/** La barre ne prend jamais plus que cette part de la fenêtre. */
export const PART_MAX = 0.45;
/**
 * En glissant le bord : sous ce point la barre se réduit en icônes, au-dessus
 * elle s'étend. À mi-chemin du rail et de la largeur minimale — entre les deux
 * il n'existe pas de largeur utile (des libellés coupés à trois lettres), donc
 * le bord « saute » d'un état à l'autre, comme dans un éditeur de code.
 */
export const SEUIL_RAIL = (LARGEUR_RAIL + LARGEUR_MIN) / 2;

/**
 * Pour chaque régime : la barre est-elle RÉDUITE ? Et, étendue, de quelle
 * largeur (2026-10-11, demande d'Antonin : « faire glisser la barre, pas
 * seulement avoir deux positions »). UNE largeur pour les deux régimes : c'est
 * un goût, pas une réponse à la taille de la fenêtre — le plafond
 * (`bornerLargeur`) s'occupe des fenêtres étroites.
 */
export interface PrefBarre {
  large: boolean;
  etroit: boolean;
  largeur: number;
}

export const PREF_DEFAUT: PrefBarre = { large: false, etroit: true, largeur: LARGEUR_DEFAUT };

/**
 * Sous cette largeur — en pixels LOCAUX, c'est-à-dire densité déduite — la
 * fenêtre est « étroite ». ⚠️ Locaux et non de fenêtre : à 120 % de densité la
 * barre étendue pèse 278 px d'écran ; une fenêtre de 1100 px n'a alors que
 * 917 px utiles, et c'est cette place réelle qui compte. Même unité que
 * `ResizableGrid`, qui mesure aussi sa largeur locale.
 *
 * 1000 et non 1024 (l'ancien `lg:`) : la fenêtre par défaut fait 1120 px, soit
 * 1018 px locaux à 110 % de densité. À 1024, quelqu'un qui a seulement choisi
 * « 110 % » aurait vu sa barre se réduire toute seule à la mise à jour.
 */
export const SEUIL_ETROIT = 1000;

export const CLE_BARRE = "shale.barre";
export const CLE_CATEGORIES = "shale.barre.categories";

export function regimeDe(largeurLocale: number): Regime {
  return largeurLocale < SEUIL_ETROIT ? "etroit" : "large";
}

/** Lecture tolérante : tout ce qui n'est pas lisible rend le défaut. */
export function lirePref(brut: string | null | undefined): PrefBarre {
  if (!brut) return { ...PREF_DEFAUT };
  try {
    const v = JSON.parse(brut) as Partial<PrefBarre> | null;
    if (!v || typeof v !== "object") return { ...PREF_DEFAUT };
    return {
      large: typeof v.large === "boolean" ? v.large : PREF_DEFAUT.large,
      etroit: typeof v.etroit === "boolean" ? v.etroit : PREF_DEFAUT.etroit,
      // Un choix d'avant la largeur réglable n'en porte pas : 232, comme avant.
      largeur: typeof v.largeur === "number" && Number.isFinite(v.largeur) ? bornerLargeur(v.largeur) : LARGEUR_DEFAUT,
    };
  } catch {
    return { ...PREF_DEFAUT };
  }
}

export function estReduite(pref: PrefBarre, regime: Regime): boolean {
  return pref[regime];
}

/**
 * La largeur étendue, ramenée dans ses bornes. `largeurFenetre` (locale) pose
 * en plus le plafond « pas plus de 45 % de la fenêtre » ; sans elle, seules les
 * bornes fixes jouent. Le plancher l'emporte toujours : une fenêtre minuscule
 * ne fabrique pas une barre illisible, c'est le régime étroit qui la réduit.
 */
export function bornerLargeur(largeur: number, largeurFenetre?: number): number {
  const plafond =
    largeurFenetre && largeurFenetre > 0 ? Math.min(LARGEUR_MAX, Math.floor(largeurFenetre * PART_MAX)) : LARGEUR_MAX;
  return Math.round(Math.max(LARGEUR_MIN, Math.min(plafond, largeur)));
}

/**
 * Le bord est tiré jusqu'à `x` (pixels locaux depuis le bord gauche de la
 * barre). Sous le seuil : réduite, et la largeur étendue est GARDÉE pour le
 * jour où on la rouvre. Au-dessus : étendue, à cette largeur bornée.
 * Rend le même objet si rien ne change (le glisser peut alors ne rien rendre).
 */
export function auGlisser(pref: PrefBarre, regime: Regime, x: number, largeurFenetre?: number): PrefBarre {
  if (x < SEUIL_RAIL) return pref[regime] ? pref : { ...pref, [regime]: true };
  const largeur = bornerLargeur(x, largeurFenetre);
  if (!pref[regime] && pref.largeur === largeur) return pref;
  return { ...pref, [regime]: false, largeur };
}

/** Retourne la réponse du régime courant, et de lui seul. */
export function basculer(pref: PrefBarre, regime: Regime): PrefBarre {
  return { ...pref, [regime]: !pref[regime] };
}

/**
 * Le miroir des catégories repliées (`sidebar.collapsed` en base). Il ne fait
 * pas foi : il évite seulement que la barre s'ouvre toutes catégories dépliées
 * puis se referme une fois la base lue — à chaque remontage, donc à chaque
 * changement de langue. `null` = pas de miroir lisible, on attend la base.
 */
export function lireCategories(brut: string | null | undefined): Record<string, boolean> | null {
  if (!brut) return null;
  try {
    const v = JSON.parse(brut) as unknown;
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const propre: Record<string, boolean> = {};
    for (const [cle, val] of Object.entries(v)) if (typeof val === "boolean") propre[cle] = val;
    return propre;
  } catch {
    return null;
  }
}

/** Deux états de catégories disent-ils la même chose ? (ordre des clés ignoré) */
export function memesCategories(a: Record<string, boolean> | null, b: Record<string, boolean> | null): boolean {
  if (!a || !b) return a === b;
  const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const c of cles) if ((a[c] ?? false) !== (b[c] ?? false)) return false;
  return true;
}
