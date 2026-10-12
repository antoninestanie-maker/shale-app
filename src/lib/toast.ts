/**
 * Le canal des toasts GLOBAUX — un seul hôte, dans `App.tsx`.
 *
 * ⭐ POURQUOI UN CANAL, ET PAS UN TOAST PAR VUE. Jusqu'ici, deux vues (Trading
 * et Position) montaient chacune leur `<Toast>`. La corbeille a besoin d'un
 * « Supprimé · Annuler » depuis DIX vues, et depuis le menu contextuel qui vit
 * dans un portail. Un toast par vue aurait fait dix copies du même état, et un
 * message perdu quand la vue qui l'affiche se démonte — précisément ce qui
 * arrive quand on supprime l'objet qu'on regardait.
 *
 * ⚠️ PAS UN ÉVÉNEMENT DU DOM : un écouteur de module. `PIEGES.md` § 6.2 ter —
 * un événement envoyé à un module chargé en `lazy` tombe dans le vide. L'hôte
 * vit dans `App.tsx`, toujours monté ; tant qu'il n'est pas là (les tests), un
 * appel ne fait simplement rien.
 *
 * Même composant `Toast.tsx`, même apparence : aucun second système de toasts.
 */

import type { ToastState } from "../components/Toast";

export interface ToastGlobal extends ToastState {
  /** Durée d'affichage, en ms. Un « Annuler » mérite plus que 4,5 s. */
  duree?: number;
}

/**
 * ⭐ AU DOIGT, un toast qui porte un geste reste au moins quatorze secondes
 * (2026-10-12, crible du labo, constat 34).
 *
 * Le « Annuler » d'une suppression dure huit secondes (`DUREE_ANNULER`), et
 * s'arrête de compter tant que la souris est dessus : c'est le survol qui
 * donne le temps de viser. Au doigt il n'y a pas de survol — le compte à
 * rebours court pendant qu'on lit, qu'on décide et qu'on amène le pouce. Trois
 * utilisateurs du crible ont vu le bandeau partir avant de l'avoir touché.
 *
 * Seuls les toasts À GESTE sont allongés (« Annuler », « Voir ») : une simple
 * confirmation ne doit pas occuper le bas d'un téléphone quatorze secondes. La
 * croix du toast le referme à tout moment.
 */
export const DUREE_GESTE_AU_DOIGT = 14_000;

/** Combien de temps un toast reste affiché, en ms — la règle, hors du composant. */
export function dureeAffichage(o: { duree: number; aUnGeste: boolean; auDoigt: boolean }): number {
  if (!o.auDoigt || !o.aUnGeste) return o.duree;
  return Math.max(o.duree, DUREE_GESTE_AU_DOIGT);
}

let hote: ((t: ToastGlobal) => void) | null = null;

/** Réservé à `App.tsx`. Rend la fonction qui débranche l'hôte. */
export function brancherHoteToast(f: (t: ToastGlobal) => void): () => void {
  hote = f;
  return () => {
    if (hote === f) hote = null;
  };
}

/** Affiche un toast — remplace celui en cours, s'il y en a un. */
export function afficherToast(t: ToastGlobal): void {
  hote?.(t);
}
