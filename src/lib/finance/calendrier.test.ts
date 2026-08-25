import { describe, expect, it } from "vitest";

import { ajouterMois, debutDeMois, joursDuMois, joursEntre, moisEntre } from "./calendrier";

describe("ajouterMois", () => {
  it("cale sur la fin de mois plutôt que de déborder", () => {
    // `new Date(2026, 0, 31 + 31)` déborderait silencieusement sur mars.
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2028-01-31", 1)).toBe("2028-02-29");
    expect(ajouterMois("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("franchit les années", () => {
    expect(ajouterMois("2026-11-15", 3)).toBe("2027-02-15");
    expect(ajouterMois("2026-02-15", -3)).toBe("2025-11-15");
  });

  it("zéro mois ne bouge rien", () => {
    expect(ajouterMois("2026-08-25", 0)).toBe("2026-08-25");
  });
});

describe("joursEntre", () => {
  it("compte les jours, y compris à travers un changement d'heure", () => {
    expect(joursEntre("2026-01-01", "2026-01-31")).toBe(30);
    // Le passage à l'heure d'été tombe dans cette plage : un calcul en heure
    // locale rendrait 30,96 jours, arrondi à 31.
    expect(joursEntre("2026-03-01", "2026-04-01")).toBe(31);
  });

  it("rend un nombre négatif si les dates sont inversées", () => {
    expect(joursEntre("2026-04-01", "2026-03-01")).toBe(-31);
  });
});

describe("moisEntre", () => {
  it("exprime une durée en mois fractionnaires", () => {
    expect(moisEntre("2026-01-01", "2027-01-01")).toBeCloseTo(12, 1);
    expect(moisEntre("2026-01-01", "2026-01-16")).toBeCloseTo(0.5, 1);
  });
});

describe("joursDuMois et debutDeMois", () => {
  it("connaît la longueur des mois, bissextiles compris", () => {
    expect(joursDuMois("2026-02-10")).toBe(28);
    expect(joursDuMois("2028-02-10")).toBe(29);
    expect(joursDuMois("2026-07-01")).toBe(31);
  });

  it("ramène au premier du mois", () => {
    expect(debutDeMois("2026-08-25")).toBe("2026-08-01");
  });
});
