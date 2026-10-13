// ─────────────────────────────────────────────────────────────────────────────
// Les onglets de la barre du bas (téléphone) — la règle, hors du JSX.
//
// 2026-10-13, demande d'Antonin : « j'aimerais […] dans le personnalisé
// personnaliser la barre en bas. Donc le plus n'est pas changeable. » Jusque-là
// les quatre onglets étaient écrits en dur dans `MobileNav.tsx`.
//
// Ce fichier ne connaît ni React ni la liste des modules : `uiConfig.ts` (qui
// LIT un réglage enregistré), `MobileNav.tsx` (qui AFFICHE la barre) et
// `AdminView.tsx` (qui la RÈGLE) lui passent ce qu'ils savent. « Plus » n'est
// pas un onglet de cette liste : il est posé après elle, toujours.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quatre onglets au plus, « Plus » en cinquième : aucune barre d'onglets iOS
 * n'en porte davantage (`MOBILE.md` § 5.4), et à 375 pt de large un sixième
 * libellé serait coupé à quatre lettres.
 */
export const MAX_ONGLETS = 4;

/**
 * La barre d'origine (2026-08-27) : les quatre modules où l'on ÉCRIT. Reste le
 * défaut, et ce que « Par défaut » rétablit.
 */
export const ONGLETS_DEFAUT = ["today", "tasks", "notes", "journal"] as const;

/**
 * Lit la liste enregistrée dans `ui.config`.
 *
 * - absente ou illisible (tout réglage d'avant le 2026-10-13) → le défaut :
 *   personne ne voit sa barre changer parce que ce réglage est arrivé ;
 * - un identifiant inconnu (module retiré depuis) est jeté, un doublon aussi ;
 * - une liste vidée de tout ce qu'elle portait retombe sur le défaut. Une barre
 *   réduite à « Plus » ne s'obtient pas par accident.
 */
export function lireOnglets<T extends string>(
  brut: unknown,
  connus: readonly T[],
  defaut: readonly T[] = ONGLETS_DEFAUT as unknown as readonly T[],
): T[] {
  if (!Array.isArray(brut)) return [...defaut];
  const permis = new Set<string>(connus);
  const lus: T[] = [];
  for (const id of brut) {
    if (typeof id !== "string" || !permis.has(id) || lus.includes(id as T)) continue;
    lus.push(id as T);
    if (lus.length === MAX_ONGLETS) break;
  }
  return lus.length ? lus : [...defaut];
}

/**
 * Les onglets réellement affichés : ceux qu'on a choisis, moins ceux qui
 * n'existent pas pour ce compte (module absent, masqué par la licence).
 * L'ordre choisi est gardé ; rien ne vient combler un onglet retiré.
 */
export function ongletsAffiches<T>(onglets: readonly T[], propose: (id: T) => boolean): T[] {
  return onglets.filter(propose).slice(0, MAX_ONGLETS);
}

/** Ce qu'on peut encore ajouter : les modules proposés qui ne sont pas dans la barre. */
export function ongletsDisponibles<T>(
  onglets: readonly T[],
  modules: readonly T[],
  propose: (id: T) => boolean,
): T[] {
  return modules.filter((id) => propose(id) && !onglets.includes(id));
}

export const barrePleine = (onglets: readonly unknown[]) => onglets.length >= MAX_ONGLETS;

/** Ajoute en dernière place (juste avant « Plus »). Sans effet si la barre est pleine. */
export function ajouterOnglet<T>(onglets: readonly T[], id: T): T[] {
  if (barrePleine(onglets) || onglets.includes(id)) return [...onglets];
  return [...onglets, id];
}

/**
 * Retire un onglet. Le dernier ne se retire pas : il resterait « Plus » seul,
 * étiré sur toute la largeur de l'écran.
 */
export function retirerOnglet<T>(onglets: readonly T[], id: T): T[] {
  if (onglets.length <= 1) return [...onglets];
  return onglets.filter((x) => x !== id);
}

/** Avance (-1, vers la gauche de la barre) ou recule (+1) un onglet d'une place. */
export function deplacerOnglet<T>(onglets: readonly T[], id: T, delta: -1 | 1): T[] {
  const i = onglets.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= onglets.length) return [...onglets];
  const suite = [...onglets];
  [suite[i], suite[j]] = [suite[j], suite[i]];
  return suite;
}

/** La barre est-elle celle d'origine ? (« Par défaut » ne s'affiche que sinon.) */
export function estBarreParDefaut(
  onglets: readonly string[],
  defaut: readonly string[] = ONGLETS_DEFAUT,
): boolean {
  return onglets.length === defaut.length && onglets.every((id, i) => id === defaut[i]);
}
