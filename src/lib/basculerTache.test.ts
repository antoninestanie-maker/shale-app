// ⭐ Décocher une tâche PONCTUELLE doit la rendre « à faire » partout
// (2026-09-22). Avant, la vue Tâches la montrait faite dès qu'UN jour
// quelconque la disait faite, et le clic n'écrivait « pas faite » que pour
// aujourd'hui : la coche d'hier restait, la case ne se décochait jamais.
import { describe, expect, it } from "vitest";
import { basculerTache, createTask, fetchAll } from "./repo";

const faiteUnJour = (completions: { task_id: number; done: number }[], id: number) =>
  completions.some((c) => c.task_id === id && !!c.done);

describe("basculerTache", () => {
  it("décoche une ponctuelle cochée un AUTRE jour", async () => {
    const id = await createTask({ label: "Ponctuelle", tag: null, priority: "medium", recurrence: "none", goal_id: null });
    await basculerTache({ id, recurrence: "none" }, "2020-01-01", true);
    let data = await fetchAll("2000-01-01");
    expect(faiteUnJour(data.completions, id)).toBe(true);

    await basculerTache({ id, recurrence: "none" }, "2020-01-02", false);
    data = await fetchAll("2000-01-01");
    expect(faiteUnJour(data.completions, id)).toBe(false);
  });

  it("une récurrente ne se décoche que pour le jour visé", async () => {
    const id = await createTask({ label: "Récurrente", tag: null, priority: "medium", recurrence: "daily", goal_id: null });
    const tache = { id, recurrence: "daily" as const };
    await basculerTache(tache, "2020-01-01", true);
    await basculerTache(tache, "2020-01-02", true);
    await basculerTache(tache, "2020-01-02", false);
    const data = await fetchAll("2000-01-01");
    const faites = data.completions.filter((c) => c.task_id === id && c.done).map((c) => c.date);
    expect(faites).toEqual(["2020-01-01"]);
  });
});
