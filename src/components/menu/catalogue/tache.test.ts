import { describe, expect, it, vi } from "vitest";
import { entreesTache, type GestesTache } from "./tache";
import { ordonner } from "../../../lib/menu/entrees";
import type { Task } from "../../../lib/types";

const tache = { id: 7, label: "Session trading", done: false, goal_id: null } as unknown as Task;

function gestes(focus?: GestesTache["focus"]): GestesTache {
  const rien = vi.fn(async () => {});
  return {
    basculer: vi.fn(),
    renommer: vi.fn(),
    modifier: vi.fn(),
    dater: rien,
    rattacher: rien,
    dupliquer: rien,
    supprimer: rien,
    prioriser: rien,
    focus,
  };
}

const ids = (g: GestesTache, faite = false) =>
  ordonner(entreesTache(tache, g, { faite, objectifs: [] })).map((e) => e.id);

describe("« Focus 25 min » dans le menu d'une tâche", () => {
  it("vient juste après Terminer, et appelle EXACTEMENT le ▶ du widget (règle 18)", () => {
    const focus = vi.fn();
    const g = gestes(focus);
    expect(ids(g).slice(0, 2)).toEqual(["basculer", "focus"]);
    const entree = ordonner(entreesTache(tache, g, { faite: false, objectifs: [] })).find((e) => e.id === "focus")!;
    entree.executer!();
    expect(focus).toHaveBeenCalledWith(tache);
  });

  it("absent d'une tâche faite — le ▶ n'y est pas non plus", () => {
    expect(ids(gestes(vi.fn()), true)).not.toContain("focus");
  });

  it("absent des vues qui n'ont pas de ▶ (Tâches, Calendrier)", () => {
    expect(ids(gestes())).not.toContain("focus");
  });
});

describe("⭐ « Priorité ▸ » dans le menu d'une tâche (2026-09-30)", () => {
  const sousMenu = (task: Task, g: GestesTache) =>
    ordonner(entreesTache(task, g, { faite: false, objectifs: [] })).find((e) => e.id === "priorite")?.sousMenu ?? [];

  it("trois choix, de la plus faible à la plus élevée, juste après « Dater »", () => {
    const g = gestes();
    const liste = ids(g);
    expect(liste.indexOf("priorite")).toBe(liste.indexOf("dater") + 1);
    expect(sousMenu({ ...tache, priority: "medium" }, g).map((e) => e.id)).toEqual([
      "priorite-low",
      "priorite-medium",
      "priorite-high",
    ]);
  });

  it("choisir appelle `prioriser` avec la valeur ; la priorité actuelle ne réécrit rien", () => {
    const g = gestes();
    const task = { ...tache, priority: "medium" } as Task;
    const entrees = sousMenu(task, g);
    entrees.find((e) => e.id === "priorite-high")!.executer!();
    expect(g.prioriser).toHaveBeenCalledWith(task, "high");
    entrees.find((e) => e.id === "priorite-medium")!.executer!();
    expect(g.prioriser).toHaveBeenCalledTimes(1);
  });
});
