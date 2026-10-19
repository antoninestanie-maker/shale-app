import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { objectif as objectifDeBase } from "../objectifs/objectif.testutil";
import type { Completion, Goal, Task } from "../types";
import { actionsRequises, cleObjectif, cleTache, compterParModule, nombreAffiche } from "./regle";

const JOUR = "2026-10-20";

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1, label: "t", tag: null, priority: "medium", recurrence: "none",
  goal_id: null, created_at: "2026-08-01 09:00:00", due_date: null, start_at: null,
  end_at: null, postponed_count: 0, postponed_from: null, is_example: 0, ...p,
});
const objectif = (p: Partial<Goal> = {}): Goal =>
  objectifDeBase({ title: "objectif", scope: "short", manual_progress: 1, created_at: "2026-08-01 09:00:00", ...p });
const fait = (task_id: number): Completion => ({ task_id, date: JOUR, done: 1 }) as Completion;

describe("action requise — la règle unique du point d'action", () => {
  it("une tâche en retard, pas faite, demande une action — dans le module Tâches", () => {
    const a = actionsRequises({ tasks: [tache({ id: 3, due_date: "2026-10-18" })], completions: [], goals: [] }, JOUR);
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ cle: cleTache(3), genre: "tache-en-retard", module: "tasks", kind: "task", id: 3 });
  });

  it("⭐ agir éteint le point : la même tâche, cochée, ne demande plus rien", () => {
    const t = tache({ id: 3, due_date: "2026-10-18" });
    expect(actionsRequises({ tasks: [t], completions: [fait(3)], goals: [] }, JOUR)).toEqual([]);
  });

  it("aujourd'hui, à venir, sans date, routine : aucune action", () => {
    const tasks = [
      tache({ id: 1, due_date: JOUR }),
      tache({ id: 2, due_date: "2026-10-25" }),
      tache({ id: 3 }),
      tache({ id: 4, recurrence: "daily" }),
    ];
    expect(actionsRequises({ tasks, completions: [], goals: [] }, JOUR)).toEqual([]);
  });

  it("une tâche à décider (reportée au seuil) compte UNE fois, en décision", () => {
    const t = tache({ id: 5, due_date: JOUR, postponed_count: 2 });
    const a = actionsRequises({ tasks: [t], completions: [], goals: [] }, JOUR);
    expect(a.map((x) => [x.cle, x.genre])).toEqual([[cleTache(5), "tache-a-decider"]]);
  });

  it("un exemple de l'app ne demande jamais d'action", () => {
    const t = tache({ id: 6, due_date: "2026-10-01", is_example: 1 });
    expect(actionsRequises({ tasks: [t], completions: [], goals: [] }, JOUR)).toEqual([]);
  });

  it("un objectif dépassé ou en péril demande une action — dans le module Objectifs", () => {
    const goals = [
      objectif({ id: 1, deadline: "2026-10-10", progress_pct: 40 }),
      objectif({ id: 2, deadline: "2026-10-22", progress_pct: 10 }),
      objectif({ id: 3, deadline: "2026-12-31", progress_pct: 10 }),
    ];
    const a = actionsRequises({ tasks: [], completions: [], goals }, JOUR);
    expect(a.map((x) => [x.cle, x.genre])).toEqual([
      [cleObjectif(1), "objectif-depasse"],
      [cleObjectif(2), "objectif-en-peril"],
    ]);
    expect(compterParModule(a)).toEqual({ goals: 2 });
  });

  it("le compte par module additionne, et s'écrit « 9+ » au-delà de neuf", () => {
    const tasks = Array.from({ length: 12 }, (_, i) => tache({ id: i + 1, due_date: "2026-10-01" }));
    const a = actionsRequises({ tasks, completions: [], goals: [] }, JOUR);
    expect(compterParModule(a)).toEqual({ tasks: 12 });
    expect(nombreAffiche(12)).toBe("9+");
    expect(nombreAffiche(3)).toBe("3");
  });
});

/**
 * ⭐ Aucun écran ne recalcule : seul le contexte appelle la règle, et il n'y a
 * plus de second système de pastilles dans les barres.
 */
const sources = import.meta.glob(["../../**/*.tsx", "../../**/*.ts", "!../../**/*.test.*"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

describe("le point d'action n'a qu'un calcul", () => {
  it("`actionsRequises` n'est appelée que par le contexte", () => {
    const appelants = Object.entries(sources)
      .filter(([chemin, code]) => /actionsRequises\(/.test(code) && !/regle\.ts$/.test(chemin))
      .map(([chemin]) => chemin.split("/").pop());
    expect(appelants).toEqual(["contexte.tsx"]);
  });

  it("les barres n'ont plus de pastille d'accent à elles", () => {
    const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../../components");
    for (const f of ["Sidebar.tsx", "MobileNav.tsx"]) {
      const code = readFileSync(resolve(racine, f), "utf-8");
      expect(code, f).not.toMatch(/badges\?*\.|rounded-full bg-accent|bg-accent absolute/);
    }
  });
});
