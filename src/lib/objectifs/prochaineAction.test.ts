import { describe, expect, it } from "vitest";

import type { Completion, Goal, ObjectLink, Task } from "../types";
import { coche, objectif, tache } from "./objectif.testutil";
import { estAcheve, mesurer, type SourcesProgression } from "./progression";
import { prochaineAction } from "./prochaineAction";

/**
 * La prochaine action d'un objectif — règle d'AFFICHAGE annoncée à l'arrêt 3
 * (2026-09-29) : la tâche non faite la plus en retard, sinon la plus proche,
 * sinon la première de la feuille de route qui ne soit pas dans une étape achevée.
 */

const AUJOURDHUI = "2026-09-29";

function sources(goals: Goal[], tasks: Task[], completions: Completion[] = [], liens: ObjectLink[] = []): SourcesProgression {
  return { goals, tasks, completions, liens, maintenant: `${AUJOURDHUI} 10:00` };
}

function prochaine(racine: Goal, s: SourcesProgression) {
  const acheve = (id: number) => estAcheve(mesurer(s.goals.find((g) => g.id === id)!, s));
  return prochaineAction(racine, s, acheve);
}

const racine = objectif({ id: 1, title: "Passer trader full-time" });
const phase1 = objectif({ id: 2, parent_goal_id: 1, is_milestone: 1, position: 0, title: "Apprendre" });
const phase2 = objectif({ id: 3, parent_goal_id: 1, is_milestone: 1, position: 1, title: "Préparer" });

describe("prochaineAction", () => {
  it("la tâche la plus en retard passe avant tout le reste", () => {
    const s = sources(
      [racine, phase1, phase2],
      [
        tache({ id: 10, goal_id: 2, label: "sans date" }),
        tache({ id: 11, goal_id: 3, label: "dans un mois", due_date: "2026-10-29" }),
        tache({ id: 12, goal_id: 3, label: "hier", due_date: "2026-09-28" }),
        tache({ id: 13, goal_id: 2, label: "il y a une semaine", due_date: "2026-09-22" }),
      ],
    );
    const p = prochaine(racine, s)!;
    expect(p.tache.label).toBe("il y a une semaine");
    expect(p.enRetard).toBe(true);
    expect(p.etape?.id).toBe(2);
  });

  it("sans retard, l'échéance la plus proche passe avant les tâches sans date", () => {
    const s = sources(
      [racine, phase1, phase2],
      [
        tache({ id: 10, goal_id: 2, label: "sans date" }),
        tache({ id: 11, goal_id: 3, label: "dans un mois", due_date: "2026-10-29" }),
        tache({ id: 12, goal_id: 3, label: "demain", due_date: "2026-09-30" }),
      ],
    );
    const p = prochaine(racine, s)!;
    expect(p.tache.label).toBe("demain");
    expect(p.enRetard).toBe(false);
  });

  it("une tâche due aujourd'hui n'est pas en retard", () => {
    const s = sources([racine], [tache({ id: 10, goal_id: 1, due_date: AUJOURDHUI })]);
    expect(prochaine(racine, s)!.enRetard).toBe(false);
  });

  it("sans date nulle part : l'objectif lui-même, puis les étapes dans l'ordre de la feuille de route", () => {
    // `position` et non l'id : la phase 3 est affichée AVANT la phase 2.
    const avant = objectif({ ...phase2, position: -1 });
    const s = sources(
      [racine, phase1, avant],
      [tache({ id: 10, goal_id: 2, label: "phase 1" }), tache({ id: 11, goal_id: 3, label: "phase d'avant" })],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("phase d'avant");

    const s2 = sources([racine, phase1, avant], [...s.tasks, tache({ id: 12, goal_id: 1, label: "directe" })]);
    const p = prochaine(racine, s2)!;
    expect(p.tache.label).toBe("directe");
    expect(p.etape).toBeNull();
  });

  it("une étape achevée ne propose pas ses tâches sans date", () => {
    // Suivie à la main à 100 % : achevée, même s'il lui reste une tâche.
    const finie = objectif({ ...phase1, manual_progress: 1, progress_pct: 100 });
    const s = sources(
      [racine, finie, phase2],
      [tache({ id: 10, goal_id: 2, label: "reste de la phase finie" }), tache({ id: 11, goal_id: 3, label: "phase en cours" })],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("phase en cours");
  });

  it("…mais une tâche EN RETARD reste en retard, même dans une étape achevée", () => {
    const finie = objectif({ ...phase1, manual_progress: 1, progress_pct: 100 });
    const s = sources(
      [racine, finie, phase2],
      [tache({ id: 10, goal_id: 2, label: "oubliée", due_date: "2026-09-01" }), tache({ id: 11, goal_id: 3 })],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("oubliée");
  });

  it("les tâches faites et les récurrentes ne sont jamais proposées", () => {
    const s = sources(
      [racine, phase1],
      [
        tache({ id: 10, goal_id: 2, label: "faite", due_date: "2026-09-01" }),
        tache({ id: 11, goal_id: 2, label: "récurrente", recurrence: "daily", due_date: "2026-09-02" }),
        tache({ id: 12, goal_id: 2, label: "à faire" }),
      ],
      [coche(10)],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("à faire");
  });

  it("une tâche rattachée par une arête compte comme une tâche de l'étape", () => {
    const lien: ObjectLink = {
      id: 1,
      uid: "ol:1",
      from_kind: "goal",
      from_uid: "demo:goal:3",
      to_kind: "task",
      to_uid: "demo:task:20",
      origin: "manual",
      created_at: "2026-09-15 10:00:00",
    };
    const s = sources([racine, phase1, phase2], [tache({ id: 20, label: "par arête", due_date: "2026-10-01" })], [], [lien]);
    const p = prochaine(racine, s)!;
    expect(p.tache.label).toBe("par arête");
    expect(p.etape?.id).toBe(3);
  });

  it("rien à faire, ou un objectif atteint : pas de prochaine action", () => {
    expect(prochaine(racine, sources([racine, phase1], []))).toBeNull();
    const atteint = objectif({ ...racine, manual_progress: 1, progress_pct: 100 });
    expect(prochaine(atteint, sources([atteint], [tache({ id: 10, goal_id: 1, due_date: "2026-09-01" })]))).toBeNull();
  });
});

describe("⭐ prochaineAction — la priorité départage (2026-09-30)", () => {
  it("sans date : la tâche ÉLEVÉE passe avant la première de la feuille de route", () => {
    const s = sources(
      [racine, phase1, phase2],
      [
        tache({ id: 10, goal_id: 2, label: "première, moyenne" }),
        tache({ id: 11, goal_id: 3, label: "plus loin, élevée", priority: "high" }),
      ],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("plus loin, élevée");
  });

  it("une tâche FAIBLE cède sa place, même première", () => {
    const s = sources(
      [racine, phase1],
      [tache({ id: 10, goal_id: 2, label: "faible", priority: "low" }), tache({ id: 11, goal_id: 2, label: "moyenne" })],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("moyenne");
  });

  it("à priorité de tâche égale, l'étape la plus prioritaire l'emporte", () => {
    const urgente = objectif({ ...phase2, priority: "high" });
    const s = sources(
      [racine, phase1, urgente],
      [tache({ id: 10, goal_id: 2, label: "phase moyenne" }), tache({ id: 11, goal_id: 3, label: "phase élevée" })],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("phase élevée");
  });

  it("⚠️ la date reste reine : une tâche en retard passe avant une élevée sans date", () => {
    const s = sources(
      [racine, phase1],
      [
        tache({ id: 10, goal_id: 2, label: "élevée", priority: "high" }),
        tache({ id: 11, goal_id: 2, label: "en retard, faible", priority: "low", due_date: "2026-09-20" }),
      ],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("en retard, faible");
  });

  it("le même jour, la priorité départage deux échéances", () => {
    const s = sources(
      [racine, phase1],
      [
        tache({ id: 10, goal_id: 2, label: "demain, moyenne", due_date: "2026-09-30" }),
        tache({ id: 11, goal_id: 2, label: "demain, élevée", due_date: "2026-09-30", priority: "high" }),
      ],
    );
    expect(prochaine(racine, s)!.tache.label).toBe("demain, élevée");
  });
});
