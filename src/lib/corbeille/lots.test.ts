import { describe, expect, it } from "vitest";
import { bilanDeDepart } from "./lots";

/**
 * Ce qu'un menu ANNONCE avant de jeter un objectif (2026-09-30) : ses étapes
 * et ses tâches — la règle même de `mettreEnCorbeilleDans`, lue en mémoire.
 *
 *   1 racine ── 2 phase ── 3 sous-objectif
 *            └─ 4 phase
 *   tâches : 10 → 1, 11 → 3, 12 → 4, 13 sans objectif, 14 → 99 (ailleurs)
 */
const goals = [
  { id: 1, parent_goal_id: null },
  { id: 2, parent_goal_id: 1 },
  { id: 3, parent_goal_id: 2 },
  { id: 4, parent_goal_id: 1 },
  { id: 99, parent_goal_id: null },
];
const taches = [
  { id: 10, goal_id: 1 },
  { id: 11, goal_id: 3 },
  { id: 12, goal_id: 4 },
  { id: 13, goal_id: null },
  { id: 14, goal_id: 99 },
];

describe("bilanDeDepart", () => {
  it("un objectif annonce toutes ses étapes et les tâches de tout son arbre", () => {
    expect(bilanDeDepart(goals, taches, 1)).toEqual({ etapes: 3, taches: 3 });
  });

  it("une phase n'annonce que son sous-arbre", () => {
    expect(bilanDeDepart(goals, taches, 2)).toEqual({ etapes: 1, taches: 1 });
  });

  it("une étape sans enfant ni tâche n'annonce rien — elle part d'un clic", () => {
    expect(bilanDeDepart([...goals, { id: 5, parent_goal_id: 1 }], taches, 5)).toEqual({ etapes: 0, taches: 0 });
  });

  it("un objectif absent n'annonce rien", () => {
    expect(bilanDeDepart(goals, taches, 404)).toEqual({ etapes: 0, taches: 0 });
  });
});
