import { describe, expect, it } from "vitest";
import { jourDeCocheAffiche, jourDeCocheTache } from "./jourDeCoche";
import { tache } from "./objectifs/objectif.testutil";

describe("jourDeCocheTache — le menu « Cocher » du Calendrier (temps-3)", () => {
  it("une ponctuelle affichée à son 15 et cochée le 20 se coche le 20", () => {
    expect(jourDeCocheTache(tache({ due_date: "2026-10-15" }), "2026-10-15", "2026-10-20")).toBe("2026-10-20");
  });
  it("une ponctuelle de vendredi cochée lundi depuis la vue Semaine se coche lundi", () => {
    expect(jourDeCocheTache(tache({ due_date: "2026-10-23" }), "2026-10-23", "2026-10-19")).toBe("2026-10-19");
  });
  it("une récurrente se coche à l'occurrence du bloc", () => {
    expect(jourDeCocheTache(tache({ recurrence: "daily" }), "2026-10-15", "2026-10-20")).toBe("2026-10-15");
  });
});

describe("jourDeCocheAffiche — la date relue au clic (rythme-3)", () => {
  it("minuit passé sans nouveau rendu : la coche part sur le nouveau jour, pas sur la veille", () => {
    expect(jourDeCocheAffiche("2026-10-20", "2026-10-20", "2026-10-21")).toBe("2026-10-21");
  });
  it("un autre jour choisi (Habitudes) garde ce jour-là", () => {
    expect(jourDeCocheAffiche("2026-10-05", "2026-10-20", "2026-10-21")).toBe("2026-10-05");
  });
});
