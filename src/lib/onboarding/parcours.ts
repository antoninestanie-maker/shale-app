import { minutesDeHeure, type BlocContraint } from "./reglages";

/**
 * ⭐ LE PARCOURS DE L'ACCUEIL, sans DOM (2026-10-20, audit, constats 6 et 7).
 *
 * Six écrans : trois questions sur la semaine (lever et coucher, travail, blocs
 * fixes), la grille avec la question des heures à récupérer, l'objectif, la
 * première tâche.
 */
export type Etape = "heures" | "travail" | "contraints" | "grille" | "objectif" | "action";
export const ETAPES: readonly Etape[] = ["heures", "travail", "contraints", "grille", "objectif", "action"];

/**
 * Les écrans qu'on peut PASSER un par un. Les deux premiers ont des valeurs
 * par défaut à l'écran : « Suivant » les garde, il n'y a rien à passer.
 *
 * ⚠️ Avant le 2026-10-20, « Passer » fermait TOUT l'accueil, à n'importe quel
 * écran : Monique, perdue sur « Combien d'heures veux-tu récupérer ? », a
 * cliqué « Passer » et s'est retrouvée dans l'app sans qu'on lui ait demandé
 * son objectif ni sa première tâche. « Passer » saute maintenant la question ;
 * « Tout passer » garde la sortie immédiate promise au premier écran.
 */
export const ETAPES_FACULTATIVES: readonly Etape[] = ["contraints", "grille", "objectif", "action"];

/** L'écran d'avant (le premier reste le premier). */
export function etapePrecedente(etape: Etape): Etape {
  return ETAPES[Math.max(0, ETAPES.indexOf(etape) - 1)];
}

/** Un bloc fixe vierge : les jours de travail proposés, 08:00 – 09:00. */
export function brouillonVide(jours: readonly number[]): BlocContraint {
  return { label: "", jours: [...jours], debut: "08:00", fin: "09:00" };
}

/**
 * ⭐ CE QUE « SUIVANT » FAIT D'UN BLOC TAPÉ SANS « + » (constat 7).
 *
 * Yanis a tapé « Cours à l'école », jeudi et vendredi, 09:00 – 17:00, puis
 * « Suivant » : le bloc était JETÉ, sans un mot, et la grille montrait une
 * légende « Trajets » sans aucune case.
 *
 *   • `vide` — rien de nommé : rien à garder (les jours et heures proposés
 *     d'office ne sont pas une réponse) ;
 *   • `pret` — un nom, au moins un jour, une durée : le bloc est ajouté ;
 *   • `incomplet` — un nom sans jour, ou sans durée : on le DIT et on reste.
 *     Le jeter serait refaire le défaut ; l'inventer, deviner.
 *
 * `place` : reste-t-il de la place (trois blocs au plus) ? Sans place, le champ
 * n'est pas affiché, donc rien n'est en attente.
 */
export function blocEnAttente(
  brouillon: BlocContraint,
  place: boolean,
): { etat: "vide" } | { etat: "pret"; bloc: BlocContraint } | { etat: "incomplet" } {
  const label = brouillon.label.trim();
  if (!place || !label) return { etat: "vide" };
  const d = minutesDeHeure(brouillon.debut);
  const f = minutesDeHeure(brouillon.fin);
  if (brouillon.jours.length === 0 || d == null || f == null || d === f) return { etat: "incomplet" };
  return { etat: "pret", bloc: { ...brouillon, label, jours: [...brouillon.jours] } };
}
