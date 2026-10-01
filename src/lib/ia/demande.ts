// Ouvrir une action d'IA sur une tâche ou un objectif, depuis n'importe quel
// écran (menu contextuel d'une tâche, « ⋯ » d'un objectif ou d'une étape,
// bandeau « objectif en péril » du Calendrier).
//
// ⭐ Un ÉVÉNEMENT et pas une prop : le menu d'une tâche vit dans quatre vues
// (Tâches, Aujourd'hui, Calendrier, feuille de route) et celui d'une étape cinq
// niveaux sous la vue Objectifs. Une seule fenêtre, montée dans `App`
// (`components/ia/ActionsIa.tsx`), les écoute toutes — même patron que
// « sb:capture-ia ».

export type DemandeIa =
  | { action: "decouper" | "estimer"; taskId: number }
  | { action: "decomposer" | "taches" | "peril"; goalId: number };

export const EVENEMENT_DEMANDE_IA = "sb:ia-action";

export function demanderIa(d: DemandeIa): void {
  window.dispatchEvent(new CustomEvent<DemandeIa>(EVENEMENT_DEMANDE_IA, { detail: d }));
}
