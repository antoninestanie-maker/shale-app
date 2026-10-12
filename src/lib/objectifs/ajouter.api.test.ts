/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐ AJOUTER UNE ÉTAPE SOUS UNE ÉTAPE EN FAIT UNE PHASE — sur une vraie base,
 * puis en démo (2026-10-12). Le plan est testé dans `structure.test.ts` ; ici,
 * ce qui s'écrit vraiment, par l'accès que la feuille de route, la carte et
 * l'IA appellent toutes (`ajouterEtape`).
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

const objectif = (title: string, parent: number | null = null, extra: Partial<GoalInput> = {}): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: "Activité",
  parent_goal_id: parent,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
  ...extra,
});

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("ajouter une étape — $mode", ({ natif }) => {
  let repo: typeof import("../repo");
  let ajouter: typeof import("./ajouter");
  let structure: typeof import("./structure");
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
    ajouter = await import("./ajouter");
    structure = await import("./structure");
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  const objectifs = async () => (await repo.fetchAll("2000-01-01")).goals;

  it("⭐ sous l'objectif : une étape ; sous cette étape : elle devient une phase, et la nouvelle est une étape", async () => {
    const racineId = await repo.createGoal(objectif("Ajout-racine"));
    let goals = await objectifs();
    const racine = goals.find((g) => g.id === racineId)!;

    const etapeId = (await ajouter.ajouterEtape(racine, "Ajout-préparer", goals, { priorite: "high" }))!;
    goals = await objectifs();
    const etape = goals.find((g) => g.id === etapeId)!;
    expect(structure.natureDe(etape, goals)).toBe("etape");
    expect([etape.parent_goal_id, etape.priority, etape.category, etape.is_milestone, etape.manual_progress]).toEqual([racineId, "high", "Activité", 0, 0]);
    // L'objectif, lui, n'est jamais « promu ».
    expect(goals.find((g) => g.id === racineId)!.is_milestone).toBe(0);

    const dessousId = (await ajouter.ajouterEtape(etape, "Ajout-photos", goals))!;
    goals = await objectifs();
    expect(structure.natureDe(goals.find((g) => g.id === etapeId)!, goals)).toBe("phase");
    expect(structure.natureDe(goals.find((g) => g.id === dessousId)!, goals)).toBe("etape");
    // La colonne suit, pour un appareil resté sur une version d'avant.
    expect(goals.find((g) => g.id === etapeId)!.is_milestone).toBe(1);
    expect(goals.find((g) => g.id === dessousId)!.is_milestone).toBe(0);
  });

  it("⚠️ trois niveaux : au fond, rien ne s'écrit", async () => {
    const racineId = await repo.createGoal(objectif("Ajout-racine"));
    const phaseId = await repo.createGoal(objectif("Ajout-phase", racineId));
    const fondId = await repo.createGoal(objectif("Ajout-fond", phaseId));
    const goals = await objectifs();
    expect(await ajouter.ajouterEtape(goals.find((g) => g.id === fondId)!, "Ajout-trop profond", goals)).toBeNull();
    expect((await objectifs()).map((g) => g.id)).toEqual(goals.map((g) => g.id));
  });

  it("une phase qui perd sa dernière étape redevient une étape — sans rien réécrire", async () => {
    const racineId = await repo.createGoal(objectif("Ajout-racine"));
    let goals = await objectifs();
    const etapeId = (await ajouter.ajouterEtape(goals.find((g) => g.id === racineId)!, "Ajout-phase", goals))!;
    goals = await objectifs();
    const dessousId = (await ajouter.ajouterEtape(goals.find((g) => g.id === etapeId)!, "Ajout-seule", goals))!;
    await repo.mettreEnCorbeille("goal", dessousId);
    goals = await objectifs();
    expect(structure.natureDe(goals.find((g) => g.id === etapeId)!, goals)).toBe("etape");
  });
});
