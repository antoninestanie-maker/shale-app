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
 *
 * ⚠️ Ramené de 14 à 10 s le 2026-10-13. Antonin, à l'usage : le bandeau « doit
 * rester allumé un certain temps, pas jusqu'à ce qu'on le ferme nous-même » —
 * quatorze secondes en bas d'un téléphone se vivaient comme « pour toujours »,
 * et il le fermait à la main. Dix secondes restent au-dessus des huit que le
 * crible avait trouvées trop courtes, et le toast MONTRE désormais son compte
 * à rebours (le filet qui se vide, `Toast.tsx`) : on voit qu'il part seul.
 */
export const DUREE_GESTE_AU_DOIGT = 10_000;

/**
 * ⭐ UN TOAST PART TOUJOURS DE LUI-MÊME (2026-10-13).
 *
 * Le survol et le focus le RETIENNENT (on est en train d'y aller), mais jamais
 * sans fin : au plus le double de sa durée depuis qu'il est apparu. Sans ce
 * plafond, un pointeur resté par hasard là où le bandeau s'affiche — le bas
 * droit de la fenêtre, où tombe justement le « Supprimer » d'un menu ouvert en
 * bas de liste — le gardait à l'écran jusqu'à ce qu'on le ferme à la main.
 */
export function plafondAffichage(attente: number): number {
  return attente * 2;
}

/** Ce qu'un toast garde au minimum quand le pointeur le quitte : le temps de se raviser. */
export const SURSIS_APRES_SURVOL = 1500;

/**
 * Le temps qu'il reste à un toast après une suspension : là où il en était, PAS
 * sa durée entière. Avant le 2026-10-13 le minuteur repartait de zéro à chaque
 * sortie du pointeur — frôler le bandeau le prolongeait de huit secondes.
 */
export function resteApresSuspension(restant: number, ecoule: number): number {
  return Math.max(SURSIS_APRES_SURVOL, restant - ecoule);
}

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
