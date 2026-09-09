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

// ─────────────────────────────────────────────────────────────────────────────
// Les échéances de facturation (migration 023)
// ─────────────────────────────────────────────────────────────────────────────
describe("projection avec les échéances de facturation", () => {
  const burn: Burn = {
    entreesCents: 0,
    sortiesCents: 100_000,
    netCents: 100_000,
    actifs: 1,
  };

  it("sans échéance, la courbe est EXACTEMENT la droite d'avant", () => {
    expect(projection("2026-09-01", 500_000, burn, 3, [])).toEqual(
      projection("2026-09-01", 500_000, burn, 3),
    );
  });

  it("⭐ une créance est un PALIER, pas un changement de pente", () => {
    // Elle rentre le mois où elle est due, puis plus jamais. Lui faire
    // infléchir la droite reviendrait à extrapoler un revenu depuis une facture.
    const p = projection("2026-09-01", 500_000, burn, 4, [
      { date: "2026-11-01", cents: 300_000, invoiceId: 1 },
    ]);
    expect(p.map((x) => x.valeurCents)).toEqual([
      500_000, // mois 0
      400_000, // mois 1
      600_000, // mois 2 — la créance entre : 300 000 − 200 000 de burn
      500_000, // mois 3 — la pente reprend, inchangée
      400_000, // mois 4
    ]);
  });

  it("une dette fournisseur creuse la courbe à sa date", () => {
    const p = projection("2026-09-01", 500_000, burn, 2, [
      { date: "2026-10-01", cents: -150_000, invoiceId: 1 },
    ]);
    expect(p[2].valeurCents).toBe(150_000);
  });

  it("plusieurs échéances au même mois se cumulent", () => {
    const p = projection("2026-09-01", 0, burn, 1, [
      { date: "2026-10-01", cents: 100_000, invoiceId: 1 },
      { date: "2026-10-15", cents: 50_000, invoiceId: 2 },
    ]);
    // Le 15 octobre est postérieur au point du 1er octobre : il n'entre qu'au
    // mois suivant. Seule la première est comptée ici.
    expect(p[1].valeurCents).toBe(0);
  });

  it("une échéance déjà arrivée au départ est comptée dès le mois 0", () => {
    const p = projection("2026-09-01", 100_000, burn, 1, [
      { date: "2026-09-01", cents: 200_000, invoiceId: 1 },
    ]);
    expect(p[0].valeurCents).toBe(300_000);
  });

  it("les horizons reçoivent les échéances eux aussi", () => {
    const h = projectionAuxHorizons("2026-09-01", 500_000, burn, [
      { date: "2026-11-01", cents: 300_000, invoiceId: 1 },
    ]);
    expect(h[3].valeurCents).toBe(500_000);
    expect(h[12].valeurCents).toBe(-400_000);
  });
});
