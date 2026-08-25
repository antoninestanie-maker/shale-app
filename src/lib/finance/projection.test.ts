import { describe, expect, it } from "vitest";

import { BURN_VIDE, type Burn } from "./burn";
import { HORIZONS, projection, projectionAuxHorizons } from "./projection";

const burnDe = (netCents: number): Burn => ({
  entreesCents: 0,
  sortiesCents: netCents,
  netCents,
  actifs: 1,
});

describe("projection", () => {
  it("part du patrimoine d'aujourd'hui et retranche le burn chaque mois", () => {
    const p = projection("2026-08-25", 1_000_000, burnDe(100_000), 3);
    expect(p.map((x) => x.valeurCents)).toEqual([1_000_000, 900_000, 800_000, 700_000]);
    expect(p.map((x) => x.date)).toEqual([
      "2026-08-25",
      "2026-09-25",
      "2026-10-25",
      "2026-11-25",
    ]);
  });

  it("monte quand le burn net est négatif, sans cas particulier", () => {
    const p = projection("2026-08-25", 1_000_000, burnDe(-50_000), 2);
    expect(p.map((x) => x.valeurCents)).toEqual([1_000_000, 1_050_000, 1_100_000]);
  });

  it("passe sous zéro sans s'arrêter — c'est l'information", () => {
    const p = projection("2026-08-25", 150_000, burnDe(100_000), 3);
    expect(p[3].valeurCents).toBe(-150_000);
  });

  it("reste plate sans burn déclaré", () => {
    const p = projection("2026-08-25", 500_000, BURN_VIDE, 12);
    expect(new Set(p.map((x) => x.valeurCents))).toEqual(new Set([500_000]));
  });

  it("cale sur les fins de mois", () => {
    expect(projection("2026-01-31", 0, BURN_VIDE, 1)[1].date).toBe("2026-02-28");
  });
});

describe("projectionAuxHorizons", () => {
  it("rend les trois horizons annoncés", () => {
    expect(HORIZONS).toEqual([3, 6, 12]);
    const h = projectionAuxHorizons("2026-08-25", 1_200_000, burnDe(100_000));
    expect(h[3].valeurCents).toBe(900_000);
    expect(h[6].valeurCents).toBe(600_000);
    expect(h[12].valeurCents).toBe(0);
    expect(h[12].date).toBe("2027-08-25");
  });
});
