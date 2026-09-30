/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐ LA PRIORITÉ D'UNE ÉTAPE ET D'UNE TÂCHE — sur une vraie base, puis en démo
 * (migration 030, 2026-09-30).
 *
 * Par l'API publique de `repo.ts` seulement, comme `corbeille/api.test.ts` :
 * une démo qui divergerait de l'app ferait « prouver » à l'écran ce que l'app
 * ne fait pas (PIEGES § 6.2 quater).
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

type Repo = typeof import("../repo");

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
])("la priorité — $mode", ({ natif }) => {
  let repo: Repo;
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
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  const objectifLu = async (id: number) => (await repo.fetchAll("2000-01-01")).goals.find((g) => g.id === id)!;
  const tacheLue = async (id: number) => (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === id)!;

  it("⭐ une étape naît avec la priorité choisie à sa création", async () => {
    const racine = await repo.createGoal(objectif("Prio-racine"));
    const etape = await repo.createGoal(objectif("Prio-étape", racine, { priority: "high" }));
    expect((await objectifLu(etape)).priority).toBe("high");
  });

  it("sans choix, elle naît « moyenne » — comme une tâche", async () => {
    const id = await repo.createGoal(objectif("Prio-défaut"));
    expect((await objectifLu(id)).priority).toBe("medium");
  });

  it("⭐ la priorité se change après coup, et seule elle", async () => {
    const racine = await repo.createGoal(objectif("Prio-racine"));
    const etape = await repo.createGoal(objectif("Prio-étape", racine, { deadline: "2026-10-12" }));
    await repo.majFeuilleDeRoute(etape, { priority: "low" });
    const lu = await objectifLu(etape);
    expect(lu.priority).toBe("low");
    expect(lu.deadline).toBe("2026-10-12");
    expect(lu.parent_goal_id).toBe(racine);
  });

  it("⚠️ la fiche (`updateGoal`) ne touche PAS la priorité, qu'elle ne connaît pas", async () => {
    const id = await repo.createGoal(objectif("Prio-fiche", null, { priority: "high" }));
    await repo.updateGoal(id, objectif("Prio-fiche renommée"));
    expect((await objectifLu(id)).priority).toBe("high");
  });

  it("⭐ `prioriserTache` change la priorité d'une tâche, et RIEN d'autre (règle 16)", async () => {
    const goal = await repo.createGoal(objectif("Prio-racine"));
    const id = await repo.createTask({
      label: "Prio-tâche",
      tag: "Travail",
      priority: "medium",
      recurrence: "none",
      goal_id: goal,
      due_date: "2026-10-02",
      start_at: "09:00",
      end_at: "10:00",
    });
    await repo.prioriserTache(id, "high");
    const lue = await tacheLue(id);
    expect(lue.priority).toBe("high");
    expect([lue.label, lue.tag, lue.goal_id, lue.due_date, lue.start_at, lue.end_at]).toEqual([
      "Prio-tâche",
      "Travail",
      goal,
      "2026-10-02",
      "09:00",
      "10:00",
    ]);
  });
});
