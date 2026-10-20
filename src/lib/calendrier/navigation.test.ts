import { describe, expect, it } from "vitest";
import { addDays } from "../logic";
import { AGENDA_JOURS, curseurApres } from "./navigation";

/** Lot 3 de l'audit du 2026-10-20, temps-5 (A07a-04, A07a-05). */
describe("curseurApres — Précédent / Suivant", () => {
  it("l'agenda avance d'une page de 30 jours : aucun jour n'est sauté", () => {
    const page1 = "2026-10-06";
    const page2 = curseurApres("agenda", page1, 1);
    // La première page va du 6/10 au 4/11 ; la seconde doit commencer le 5/11.
    expect(addDays(page1, AGENDA_JOURS - 1)).toBe("2026-11-04");
    expect(page2).toBe("2026-11-05");
    expect(curseurApres("agenda", page2, -1)).toBe(page1);
  });

  it("en février non plus, aucun jour n'est répété", () => {
    expect(curseurApres("agenda", "2027-02-01", 1)).toBe("2027-03-03");
  });

  it("le mois depuis un 31 ne saute pas novembre, et « Précédent » change bien de mois", () => {
    expect(curseurApres("mois", "2026-10-31", 1)).toBe("2026-11-30");
    expect(curseurApres("mois", "2026-10-31", -1)).toBe("2026-09-30");
    expect(curseurApres("mois", "2026-01-31", 1)).toBe("2026-02-28");
  });

  it("jour et semaine : inchangés", () => {
    expect(curseurApres("jour", "2026-10-31", 1)).toBe("2026-11-01");
    expect(curseurApres("semaine", "2026-10-31", -1)).toBe("2026-10-24");
  });
});
