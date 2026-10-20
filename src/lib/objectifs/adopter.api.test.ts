/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐ ADOPTER L'OBJECTIF D'EXEMPLE ADOPTE SA FEUILLE DE ROUTE (lot 3 de l'audit
 * du 2026-10-20, objectifs-5) — sur une vraie base, puis en démo.
 *
 * Renommer « Exemple · ceci est un objectif » pour s'en servir n'adoptait que la
 * racine : ses étapes restaient des exemples, que la mesure d'un objectif RÉEL
 * écarte. L'objectif restait à 0 % quoi qu'on coche.
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

type Repo = typeof import("../repo");
type Progression = typeof import("./progression");

const objectif = (title: string, parent: number | null = null, extra: Partial<GoalInput> = {}): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: null,
  parent_goal_id: parent,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
  ...extra,
});

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("adopter l'objectif d'exemple — $mode", ({ natif }) => {
  let repo: Repo;
  let progression: Progression;
  let sqlite: DatabaseSync | undefined;

  beforeEach(async () => {
    const w = window as unknown as Record<string, unknown>;
    if (natif) {
      ({ sqlite, db: courante } = baseDeTest());
      w.__TAURI_INTERNALS__ = {};
    } else {
      delete w.__TAURI_INTERNALS__;
    }
    vi.resetModules();
    repo = await import("../repo");
    progression = await import("./progression");
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  const tout = () => repo.fetchAll("2000-01-01");
  const mesure = async (id: number) => {
    const d = await tout();
    return progression.mesurer(d.goals.find((g) => g.id === id)!, {
      goals: d.goals,
      tasks: d.tasks,
      completions: d.completions,
      maintenant: "2099-01-01 00:00",
    });
  };

  /** L'objectif d'exemple du premier lancement : deux étapes, une tâche sous la première. */
  async function semer() {
    const racine = await repo.createGoal(objectif("Exemple · ceci est un objectif", null, { is_example: 1 }));
    const e1 = await repo.createGoal(objectif("Adopte-étape-1", racine, { is_example: 1, position: 0 }));
    const e2 = await repo.createGoal(objectif("Adopte-étape-2", racine, { is_example: 1, position: 1 }));
    const tache = await repo.createTask({ label: "Adopte-tâche", tag: null, priority: "medium", recurrence: "none", goal_id: e1 });
    await repo.marquerExemple("tasks", tache, true);
    return { racine, e1, e2, tache };
  }

  it("⭐ renommé puis mené au bout : l'objectif atteint 100 %, plus figé à 0", async () => {
    const { racine, e2, tache } = await semer();
    await repo.renommerObjectif(racine, "Lancer mon offre");
    await repo.basculerTache({ id: tache, recurrence: "none" }, "2026-10-20", true);
    await repo.cocherEtape(e2, true);
    const m = await mesure(racine);
    expect(m.pct).toBe(100);
    expect(progression.estAcheve(m)).toBe(true);
  });

  it("toute la feuille de route devient réelle : « Supprimer les exemples » ne l'emporte plus", async () => {
    const { racine, e1, e2, tache } = await semer();
    await repo.renommerObjectif(racine, "Lancer mon offre");
    const d = await tout();
    expect([racine, e1, e2].map((id) => d.goals.find((g) => g.id === id)!.is_example)).toEqual([0, 0, 0]);
    expect(d.tasks.find((t) => t.id === tache)!.is_example).toBe(0);
    await repo.supprimerExemples();
    const apres = await tout();
    expect(apres.goals.filter((g) => [racine, e1, e2].includes(g.id))).toHaveLength(3);
    expect(apres.tasks.find((t) => t.id === tache)!.goal_id).toBe(e1);
  });

  it("modifier par la fenêtre (updateGoal) adopte de même", async () => {
    const { racine, e1 } = await semer();
    await repo.updateGoal(racine, objectif("Lancer mon offre"));
    expect((await tout()).goals.find((g) => g.id === e1)!.is_example).toBe(0);
  });

  it("un objectif déjà réel n'adopte pas une étape d'exemple posée sous lui", async () => {
    const reel = await repo.createGoal(objectif("Adopte-réel"));
    const etape = await repo.createGoal(objectif("Adopte-étape-exemple", reel, { is_example: 1 }));
    await repo.renommerObjectif(reel, "Adopte-réel renommé");
    expect((await tout()).goals.find((g) => g.id === etape)!.is_example).toBe(1);
  });
});
