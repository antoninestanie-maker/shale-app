import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/ia/useIa", () => ({ useIaPossible: () => false, useIa: () => ({}) }));

/** taches-7 (audit du 2026-10-20) : la fenêtre « Modifier » replanifie comme les autres gestes de date. */
describe("changer l'échéance dans « Modifier la tâche »", async () => {
  const { reportApresModification } = await import("./TaskModal");

  it("une tâche reportée deux fois, datée à nouveau : le compteur repart de zéro", () => {
    expect(reportApresModification({ due_date: "2026-10-18", postponed_count: 2 }, "2026-10-24")).toEqual({
      due_date: "2026-10-24",
      postponed_count: 0,
      postponed_from: "2026-10-24",
    });
  });

  it("rien à replanifier : date inchangée, retirée, ou tâche jamais reportée", () => {
    expect(reportApresModification({ due_date: "2026-10-18", postponed_count: 2 }, "2026-10-18")).toBeNull();
    expect(reportApresModification({ due_date: "2026-10-18", postponed_count: 2 }, null)).toBeNull();
    expect(reportApresModification({ due_date: "2026-10-18", postponed_count: 0 }, "2026-10-24")).toBeNull();
  });
});
