/**
 * La navigation au clavier d'un menu — calcul PUR, sans DOM.
 *
 * Le motif WAI-ARIA d'un menu : ↑ ↓ pour circuler, Début/Fin pour les bouts,
 * → pour entrer dans un sous-menu, ← pour en ressortir, Entrée pour exécuter,
 * Échap pour fermer.
 *
 * ⚠️ UNE ENTRÉE GRISÉE SE SAUTE, elle ne se sélectionne pas. Une entrée grisée
 * qui prend le focus donne un menu où Entrée ne fait rien : l'utilisateur au
 * clavier croit que le menu est cassé, alors qu'il lui manque seulement le mot
 * qui dit pourquoi — mot que le survol, lui, montrerait.
 *
 * ⚠️ ET LA CIRCULATION BOUCLE. Un menu de trois entrées où ↓ s'arrête au bout
 * oblige à compter ses appuis. Boucler coûte une ligne et se remarque à l'usage.
 */

import { activable, type EntreeMenu } from "./entrees";

export type ToucheMenu = "bas" | "haut" | "debut" | "fin";

/**
 * Le rang suivant, en sautant les entrées grisées.
 *
 * `-1` signifie « aucun focus » : c'est l'état à l'ouverture à la souris, où
 * rien ne doit être surligné tant que le clavier n'a pas servi. Le premier ↓
 * tombe alors sur la première entrée activable, et le premier ↑ sur la dernière.
 *
 * Rend `-1` si AUCUNE entrée n'est activable — un menu entièrement grisé existe
 * (un objet verrouillé), et il ne doit pas boucler à l'infini.
 */
export function rangSuivant(
  entrees: readonly EntreeMenu[],
  actuel: number,
  touche: ToucheMenu,
): number {
  const n = entrees.length;
  if (n === 0) return -1;
  if (!entrees.some(activable)) return -1;

  if (touche === "debut") return cherche(entrees, 0, +1);
  if (touche === "fin") return cherche(entrees, n - 1, -1);

  const pas = touche === "bas" ? +1 : -1;
  const depart = actuel < 0 ? (pas > 0 ? 0 : n - 1) : (actuel + pas + n) % n;
  return cherche(entrees, depart, pas);
}

/** Le premier rang activable à partir de `depuis`, en tournant. */
function cherche(entrees: readonly EntreeMenu[], depuis: number, pas: number): number {
  const n = entrees.length;
  for (let k = 0; k < n; k++) {
    const i = (((depuis + k * pas) % n) + n) % n;
    if (activable(entrees[i])) return i;
  }
  return -1;
}

/**
 * La première lettre tapée mène à l'entrée qui commence par elle.
 *
 * Reprend le comportement des menus natifs. Cherche APRÈS le rang courant puis
 * boucle, pour que deux appuis sur « d » passent de « Dater » à « Dupliquer ».
 */
export function rangParLettre(
  entrees: readonly EntreeMenu[],
  actuel: number,
  lettre: string,
): number {
  const l = lettre.toLowerCase();
  const n = entrees.length;
  for (let k = 1; k <= n; k++) {
    const i = (actuel + k + n) % n;
    const e = entrees[i];
    if (activable(e) && e.libelle.toLowerCase().startsWith(l)) return i;
  }
  return -1;
}

/**
 * Ce que le menu doit faire d'une touche.
 *
 * Rendu séparé de l'exécution pour que le composant reste court et que la
 * règle, elle, se teste.
 */
export type ActionClavier =
  | { quoi: "deplacer"; touche: ToucheMenu }
  | { quoi: "executer" }
  | { quoi: "ouvrirSousMenu" }
  | { quoi: "fermerSousMenu" }
  | { quoi: "fermer" }
  | { quoi: "lettre"; lettre: string }
  | null;

export function actionDe(touche: string, dansUnSousMenu: boolean): ActionClavier {
  switch (touche) {
    case "ArrowDown":
      return { quoi: "deplacer", touche: "bas" };
    case "ArrowUp":
      return { quoi: "deplacer", touche: "haut" };
    case "Home":
      return { quoi: "deplacer", touche: "debut" };
    case "End":
      return { quoi: "deplacer", touche: "fin" };
    case "Enter":
    case " ":
      return { quoi: "executer" };
    case "ArrowRight":
      return { quoi: "ouvrirSousMenu" };
    case "ArrowLeft":
      // ⚠️ Dans le menu principal, ← ne ferme RIEN. Un menu contextuel n'a pas
      // de barre de menus à gauche où aller, et fermer sur ← surprendrait
      // quelqu'un qui corrige sa frappe.
      return dansUnSousMenu ? { quoi: "fermerSousMenu" } : null;
    case "Escape":
      return { quoi: "fermer" };
    default:
      return touche.length === 1 && /\p{L}|\p{N}/u.test(touche)
        ? { quoi: "lettre", lettre: touche }
        : null;
  }
}
