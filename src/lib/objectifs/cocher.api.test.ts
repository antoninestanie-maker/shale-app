/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐ COCHER UNE ÉTAPE VIDE — sur une vraie base, puis en démo (2026-10-11).
 *
 * Demande d'Antonin : « Pour les étapes vides, donne la possibilité de cocher
 * une étape pour que ce soit compté. » La coche s'écrit dans une colonne qui
 * existait (`progress_pct`), sans migration ; la règle qui la lit est dans
 * `progression.ts`.
 *
 * Par l'API publique de `repo.ts` seulement, et DEUX FOIS : le mode démo est le
 * seul qu'on voie à l'écran, et une démo plus indulgente que l'app ferait
 * « prouver » ce que l'app ne fait pas (PIEGES § 6.2 quater).
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
])("cocher une étape vide — $mode", ({ natif }) => {
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
  /** Le pourcentage d'un objectif, par la règle unique, sur ce que la base rend. */
  const pct = async (id: number) => {
    const d = await tout();
    return progression.mesurer(d.goals.find((g) => g.id === id)!, {
      goals: d.goals,
      tasks: d.tasks,
      completions: d.completions,
      maintenant: "2099-01-01 00:00",
    }).pct;
  };

  it("⭐ trois étapes vides, une cochée : l'objectif passe de 0 à 33 %, puis revient à 0 en décochant", async () => {
    const racine = await repo.createGoal(objectif("Coche-racine"));
    const [a] = await Promise.all(["A", "B", "C"].map((x, i) => repo.createGoal(objectif(`Coche-${x}`, racine, { position: i }))));
    expect(await pct(racine)).toBe(0);
    await repo.cocherEtape(a, true);
    expect(await pct(a)).toBe(100);
    expect(await pct(racine)).toBe(33);
    await repo.cocherEtape(a, false);
    expect(await pct(racine)).toBe(0);
  });

  it("⭐ un objectif sans rien se coche « Atteint »", async () => {
    const seul = await repo.createGoal(objectif("Coche-seul"));
    expect(await pct(seul)).toBe(0);
    await repo.cocherEtape(seul, true);
    expect(await pct(seul)).toBe(100);
  });

  it("⭐ une tâche donnée à une étape cochée : ses tâches la mesurent ; la coche revient si on la détache", async () => {
    const racine = await repo.createGoal(objectif("Coche-racine"));
    const etape = await repo.createGoal(objectif("Coche-étape", racine));
    await repo.cocherEtape(etape, true);
    const tache = await repo.createTask({ label: "Coche-tâche", tag: null, priority: "medium", recurrence: "none", goal_id: etape });
    expect(await pct(etape)).toBe(0);
    await repo.rattacherTache(tache, null);
    expect(await pct(etape)).toBe(100);
  });

  it("⚠️ n'écrit QUE la coche : titre, échéance, parent, priorité et place ne bougent pas (règle 16)", async () => {
    const racine = await repo.createGoal(objectif("Coche-racine"));
    const etape = await repo.createGoal(objectif("Coche-étape", racine, { deadline: "2026-12-01", priority: "high", position: 3, is_milestone: 1 }));
    await repo.cocherEtape(etape, true);
    const lue = (await tout()).goals.find((g) => g.id === etape)!;
    expect([lue.title, lue.deadline, lue.parent_goal_id, lue.priority, lue.position, lue.is_milestone, lue.manual_progress]).toEqual([
      "Coche-étape",
      "2026-12-01",
      racine,
      "high",
      3,
      1,
      0,
    ]);
    expect(lue.progress_pct).toBe(100);
  });

  it("⚠️ le suivi à la main est SOUVERAIN : cocher ne touche pas un % saisi", async () => {
    const manuel = await repo.createGoal(objectif("Coche-manuel", null, { manual_progress: 1, progress_pct: 45 }));
    await repo.cocherEtape(manuel, true);
    expect((await tout()).goals.find((g) => g.id === manuel)!.progress_pct).toBe(45);
    await repo.cocherEtape(manuel, false);
    expect(await pct(manuel)).toBe(45);
  });

  it("cocher n'adopte pas une étape d'exemple (comme `majFeuilleDeRoute`) : « supprimer les exemples » l'emporte encore", async () => {
    const exemple = await repo.createGoal(objectif("Coche-exemple", null, { is_example: 1 }));
    const etape = await repo.createGoal(objectif("Coche-exemple-étape", exemple, { is_example: 1 }));
    await repo.cocherEtape(etape, true);
    expect((await tout()).goals.find((g) => g.id === etape)!.is_example).toBe(1);
    // … et l'objectif d'exemple en tient compte : il se mesure sur ses exemples.
    expect(await pct(exemple)).toBe(100);
  });
});
