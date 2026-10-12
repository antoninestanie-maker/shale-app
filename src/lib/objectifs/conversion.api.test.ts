/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐ CONVERTIR UNE ÉTAPE VIDE EN TÂCHE — sur une vraie base, puis en démo
 * (2026-10-12).
 *
 * Antonin : « cocher une étape sans tâche n'a pas tellement de sens. Dans ce
 * cas, l'étape est une tâche. […] on donne un titre à cette tâche. »
 *
 * Par l'API publique de `repo.ts` seulement, et DEUX FOIS — même montage que
 * `cocher.api.test.ts` : le mode démo est le seul qu'on voie à l'écran, et une
 * démo plus indulgente que l'app ferait « prouver » ce que l'app ne fait pas
 * (PIEGES § 6.2 quater). Ce que le plan décide est dans `conversion.test.ts`.
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

type Repo = typeof import("../repo");
type Progression = typeof import("./progression");
type Contexte = typeof import("./contexte");

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
])("convertir une étape vide en tâche — $mode", ({ natif }) => {
  let repo: Repo;
  let progression: Progression;
  let contexte: Contexte;
  let logic: typeof import("../logic");
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
    contexte = await import("./contexte");
    logic = await import("../logic");
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
  /** Les notes rattachées à un objectif, telles que la feuille de route les lit. */
  const notesDe = async (goalId: number) => {
    const uid = (await repo.uidDe("goal", goalId))!;
    return contexte.rattachementsDe(uid, await repo.fetchContexteObjectifs()).map((r) => r.titre);
  };
  const enCorbeille = async () => (await repo.lireCorbeille()).map((e) => `${e.kind}:${e.titre}`);

  it("⭐ l'étape devient une VRAIE tâche du parent : même titre, son échéance pour date, sa priorité ; l'étape part à la corbeille", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const etape = await repo.createGoal(objectif("Conv-réserver la salle", racine, { deadline: "2099-03-04", priority: "high" }));
    await repo.createGoal(objectif("Conv-autre", racine, { position: 1 }));
    const avant = await pct(racine);

    const recu = await repo.convertirEtapeEnTache(etape);
    expect(recu).not.toBeNull();

    const d = await tout();
    const tache = d.tasks.find((t) => t.id === recu!.tacheId)!;
    expect([tache.label, tache.goal_id, tache.due_date, tache.priority, tache.recurrence, tache.is_example]).toEqual([
      "Conv-réserver la salle",
      racine,
      "2099-03-04",
      "high",
      "none",
      0,
    ]);
    expect(d.completions.some((c) => c.task_id === tache.id && c.done)).toBe(false);
    // L'étape n'est plus dans la feuille de route : elle est dans Supprimés récemment.
    expect(d.goals.some((g) => g.id === etape)).toBe(false);
    expect(await enCorbeille()).toContain("goal:Conv-réserver la salle");
    // ⭐ L'avancement de l'objectif n'a pas bougé.
    expect(await pct(racine)).toBe(avant);
  });

  it("⭐ une étape COCHÉE donne une tâche faite, à la date du jour — et l'objectif garde ses 50 %", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const etape = await repo.createGoal(objectif("Conv-cochée", racine));
    await repo.createGoal(objectif("Conv-autre", racine, { position: 1 }));
    await repo.cocherEtape(etape, true);
    expect(await pct(racine)).toBe(50);

    const recu = (await repo.convertirEtapeEnTache(etape))!;
    const d = await tout();
    expect(d.completions.filter((c) => c.task_id === recu.tacheId).map((c) => [c.date, c.done])).toEqual([[logic.todayStr(), 1]]);
    expect(await pct(racine)).toBe(50);
  });

  it("⭐ « Annuler » rend l'étape telle qu'elle était, et retire la tâche pour de bon", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const etape = await repo.createGoal(
      objectif("Conv-annulée", racine, { deadline: "2099-03-04", priority: "low", position: 2, description: "Trois devis." }),
    );
    await repo.cocherEtape(etape, true);
    const avant = (await tout()).goals.find((g) => g.id === etape)!;
    const tachesAvant = (await tout()).tasks.length;

    const recu = (await repo.convertirEtapeEnTache(etape))!;
    await repo.annulerConversionEnTache(recu);

    const d = await tout();
    expect(d.goals.find((g) => g.id === etape)).toEqual(avant);
    expect(d.tasks.some((t) => t.id === recu.tacheId)).toBe(false);
    expect(d.tasks.length).toBe(tachesAvant);
    expect(d.completions.some((c) => c.task_id === recu.tacheId)).toBe(false);
    // Ni l'étape ni la tâche ne traînent dans Supprimés récemment.
    expect((await enCorbeille()).filter((x) => x.includes("Conv-annulée"))).toEqual([]);
    expect(await pct(racine)).toBe(100);
  });

  it("sous une étape : la tâche se rattache à l'étape AU-DESSUS, qui garde son chiffre", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const phase = await repo.createGoal(objectif("Conv-phase", racine));
    const fond = await repo.createGoal(objectif("Conv-fond", phase));
    const recu = (await repo.convertirEtapeEnTache(fond))!;
    const d = await tout();
    expect(d.tasks.find((t) => t.id === recu.tacheId)!.goal_id).toBe(phase);
    expect(await pct(phase)).toBe(0);
    expect(await pct(racine)).toBe(0);
  });

  it("⭐ rien n'est perdu en silence : la tâche récurrente et la note rattachées passent au parent, et « Annuler » les rend à l'étape", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const etape = await repo.createGoal(objectif("Conv-garnie", racine));
    const recurrente = await repo.createTask({ label: "Conv-chaque jour", tag: null, priority: "medium", recurrence: "daily", goal_id: etape });
    const note = await repo.createNote("Conv-note", "<p>à lire</p>");
    await repo.createLink({
      from_kind: "goal",
      from_uid: (await repo.uidDe("goal", etape))!,
      to_kind: "note",
      to_uid: (await repo.uidDe("note", note))!,
      origin: "manual",
    });
    expect(await notesDe(etape)).toEqual(["Conv-note"]);

    const recu = (await repo.convertirEtapeEnTache(etape))!;
    let d = await tout();
    // ⚠️ La récurrente est VIVANTE, chez le parent — pas partie à la corbeille avec l'étape.
    expect(d.tasks.find((t) => t.id === recurrente)!.goal_id).toBe(racine);
    expect(await enCorbeille()).not.toContain("task:Conv-chaque jour");
    expect(await notesDe(racine)).toEqual(["Conv-note"]);

    await repo.annulerConversionEnTache(recu);
    d = await tout();
    expect(d.tasks.find((t) => t.id === recurrente)!.goal_id).toBe(etape);
    expect(await notesDe(etape)).toEqual(["Conv-note"]);
    expect(await notesDe(racine)).toEqual([]);
  });

  it("⚠️ une note que le parent citait DÉJÀ ne part pas avec « Annuler »", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const etape = await repo.createGoal(objectif("Conv-étape", racine));
    const uidNote = (await repo.uidDe("note", await repo.createNote("Conv-commune", "<p>x</p>")))!;
    for (const id of [racine, etape]) {
      await repo.createLink({ from_kind: "goal", from_uid: (await repo.uidDe("goal", id))!, to_kind: "note", to_uid: uidNote, origin: "manual" });
    }
    const recu = (await repo.convertirEtapeEnTache(etape))!;
    expect(recu.liensCrees).toEqual([]);
    await repo.annulerConversionEnTache(recu);
    expect(await notesDe(racine)).toEqual(["Conv-commune"]);
  });

  it("⚠️ ce qui ne se convertit pas n'écrit RIEN : un objectif racine, une étape qui a une tâche, une sous-étape ou une cible", async () => {
    const racine = await repo.createGoal(objectif("Conv-racine"));
    const avecTache = await repo.createGoal(objectif("Conv-avec tâche", racine));
    await repo.createTask({ label: "Conv-à faire", tag: null, priority: "medium", recurrence: "none", goal_id: avecTache });
    const phase = await repo.createGoal(objectif("Conv-phase", racine, { position: 1 }));
    await repo.createGoal(objectif("Conv-dessous", phase));
    const cible = await repo.createGoal(objectif("Conv-cible", racine, { position: 2 }));
    await repo.majFeuilleDeRoute(cible, { target_count: 10 });

    const avant = await tout();
    for (const id of [racine, avecTache, phase, cible, 999_999]) expect(await repo.convertirEtapeEnTache(id)).toBeNull();
    const apres = await tout();
    expect(apres.tasks.map((t) => t.id)).toEqual(avant.tasks.map((t) => t.id));
    expect(apres.goals.map((g) => g.id)).toEqual(avant.goals.map((g) => g.id));
    expect((await enCorbeille()).filter((x) => x.includes("Conv-"))).toEqual([]);
  });

  it("une étape d'EXEMPLE donne une tâche d'exemple : « supprimer les exemples » l'emporte encore", async () => {
    const exemple = await repo.createGoal(objectif("Conv-exemple", null, { is_example: 1 }));
    const etape = await repo.createGoal(objectif("Conv-exemple-étape", exemple, { is_example: 1, progress_pct: 100 }));
    const recu = (await repo.convertirEtapeEnTache(etape))!;
    const tache = (await tout()).tasks.find((t) => t.id === recu.tacheId)!;
    expect(tache.is_example).toBe(1);
    // … et l'objectif d'exemple compte toujours sa (seule) chose faite.
    expect(await pct(exemple)).toBe(100);
  });
});
