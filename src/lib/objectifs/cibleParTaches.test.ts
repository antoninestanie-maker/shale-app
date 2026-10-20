import { describe, expect, it } from "vitest";
import { compterSource, mesurer, sourceDe, type SourcesProgression } from "./progression";
import { coche, objectif, tache } from "./objectif.testutil";

/**
 * ⭐ « ATTEINDRE UN NOMBRE » COMPTÉ PAR LES TÂCHES DE L'ÉTAPE (audit du
 * 2026-10-20, constat d'usage 29 ; A06a-13). « Envoyer 12 candidatures » réglé
 * sur un nombre : la liste des tâches disparaissait, et cocher l'une d'elles
 * ne faisait pas bouger le compteur — seul « + » le faisait. La source
 * `elements` compte les tâches FAITES de l'étape, une unité chacune, comme
 * « Compter des éléments » ; la cible fixe seulement le nombre à atteindre.
 */
const sources = (p: Partial<SourcesProgression>): SourcesProgression => ({
  goals: [],
  tasks: [],
  completions: [],
  habits: [],
  habitChecks: [],
  liens: [],
  evenements: [],
  maintenant: "2026-10-20 12:00",
  ...p,
});

describe("une cible comptée par les tâches de l'étape", () => {
  const racine = objectif({ id: 1 });
  const etape = objectif({ id: 2, parent_goal_id: 1, target_count: 12, target_unit: "candidatures", count_source: "elements" });
  const taches = [
    tache({ id: 10, goal_id: 2 }),
    tache({ id: 11, goal_id: 2 }),
    tache({ id: 12, goal_id: 2 }),
    // Une récurrente n'est jamais « faite » : elle ne compte pas comme une unité.
    tache({ id: 13, goal_id: 2, recurrence: "daily" }),
  ];

  it("se lit comme une source à part entière", () => {
    expect(sourceDe(etape)).toBe("elements");
  });

  it("chaque tâche cochée avance le compteur d'une unité", () => {
    const s = sources({ goals: [racine, etape], tasks: taches, completions: [coche(10, "2026-10-01"), coche(11, "2026-10-19"), coche(13, "2026-10-19")] });
    expect(compterSource(etape, "elements", s)).toBe(2);
    const m = mesurer(etape, s);
    expect(m.origine).toMatchObject({ type: "cible", compte: 2, cible: 12, source: "elements" });
    expect(m.pct).toBe(17);
  });

  it("le manuel garde son sens : cocher une tâche ne change pas un compte tenu à la main", () => {
    const manuel = { ...etape, count_source: "manual", manual_count: 5 };
    const s = sources({ goals: [racine, manuel], tasks: taches, completions: [coche(10)] });
    expect(compterSource(manuel, "manual", s)).toBe(5);
  });
});
