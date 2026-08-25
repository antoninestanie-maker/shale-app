import { describe, expect, it } from "vitest";

import { compte, releve } from "./finance.testutil";
import {
  datesMensuelles,
  patrimoineAu,
  relevesDe,
  seriePatrimoine,
  soldeInterpole,
} from "./patrimoine";

describe("soldeInterpole", () => {
  const releves = [
    releve({ account_id: 1, date: "2026-01-01", amount_cents: 1_000_000 }),
    releve({ account_id: 1, date: "2026-03-01", amount_cents: 1_600_000 }),
  ];

  it("rend le relevé exact quand il tombe dessus", () => {
    expect(soldeInterpole(releves, "2026-01-01")).toBe(1_000_000);
    expect(soldeInterpole(releves, "2026-03-01")).toBe(1_600_000);
  });

  it("interpole en ligne droite entre deux relevés", () => {
    // 59 jours entre les deux, 31 écoulés au 1er février.
    expect(soldeInterpole(releves, "2026-02-01")).toBe(1_000_000 + Math.round((600_000 * 31) / 59));
  });

  it("prolonge à l'horizontale après le dernier relevé, sans inventer de pente", () => {
    // Extrapoler la tendance ferait monter le patrimoine tout seul : c'est le
    // mensonge qu'un outil financier ne doit pas faire.
    expect(soldeInterpole(releves, "2027-12-31")).toBe(1_600_000);
  });

  it("ne remonte pas avant le premier relevé non plus", () => {
    expect(soldeInterpole(releves, "2020-01-01")).toBe(1_000_000);
  });

  it("rend `null` quand le compte n'a jamais été relevé", () => {
    expect(soldeInterpole([], "2026-08-25")).toBeNull();
  });

  it("gère un seul relevé", () => {
    const un = [releve({ date: "2026-05-01", amount_cents: 42_000 })];
    expect(soldeInterpole(un, "2026-01-01")).toBe(42_000);
    expect(soldeInterpole(un, "2026-09-01")).toBe(42_000);
  });
});

describe("relevesDe", () => {
  it("filtre par compte et trie par date", () => {
    const tous = [
      releve({ account_id: 2, date: "2026-02-01" }),
      releve({ account_id: 1, date: "2026-03-01" }),
      releve({ account_id: 1, date: "2026-01-01" }),
    ];
    expect(relevesDe(tous, 1).map((b) => b.date)).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("patrimoineAu", () => {
  const courant = compte({ id: 1, label: "Courant", is_liquid: 1 });
  const pea = compte({ id: 2, label: "PEA", kind: "investissement", is_liquid: 0 });
  const credit = compte({ id: 3, label: "Carte", kind: "credit", is_liquid: 1 });

  const balances = [
    releve({ account_id: 1, date: "2026-08-01", amount_cents: 800_000 }),
    releve({ account_id: 2, date: "2026-08-01", amount_cents: 1_500_000 }),
    releve({ account_id: 3, date: "2026-08-01", amount_cents: -45_000 }),
  ];

  it("additionne tout, soldes négatifs compris", () => {
    const p = patrimoineAu([courant, pea, credit], balances, "2026-08-25");
    expect(p.totalCents).toBe(800_000 + 1_500_000 - 45_000);
  });

  it("ne compte dans le liquide que ce qui est marqué liquide", () => {
    const p = patrimoineAu([courant, pea, credit], balances, "2026-08-25");
    expect(p.liquideCents).toBe(800_000 - 45_000);
  });

  it("écarte les comptes archivés", () => {
    // Les garder ferait remonter un solde figé pour l'éternité, puisque
    // l'interpolation prolonge le dernier relevé à l'horizontale.
    const archive = compte({ id: 4, archived: 1 });
    const p = patrimoineAu(
      [courant, archive],
      [...balances, releve({ account_id: 4, date: "2026-08-01", amount_cents: 999_999 })],
      "2026-08-25",
    );
    expect(p.totalCents).toBe(800_000);
    expect(p.lignes).toHaveLength(1);
  });

  it("compte les comptes jamais relevés au lieu de les traiter comme vides", () => {
    const vierge = compte({ id: 5, label: "Livret" });
    const p = patrimoineAu([courant, vierge], balances, "2026-08-25");
    expect(p.sansReleve).toBe(1);
    expect(p.totalCents).toBe(800_000);
    expect(p.lignes.find((l) => l.compte.id === 5)!.montantCents).toBeNull();
  });

  it("signale un relevé daté sans l'écarter du total", () => {
    const p = patrimoineAu([courant], balances, "2026-11-25", 45);
    expect(p.lignes[0].perime).toBe(true);
    expect(p.totalCents).toBe(800_000);
  });

  it("sur une base vide, rend zéro et zéro ligne", () => {
    expect(patrimoineAu([], [], "2026-08-25")).toEqual({
      totalCents: 0,
      liquideCents: 0,
      lignes: [],
      sansReleve: 0,
    });
  });
});

describe("datesMensuelles", () => {
  it("cale sur le premier de chaque mois, bornes comprises", () => {
    expect(datesMensuelles("2026-01-15", "2026-04-02")).toEqual([
      "2026-01-01",
      "2026-02-01",
      "2026-03-01",
      "2026-04-01",
    ]);
  });

  it("ne boucle pas sans fin sur une plage inversée", () => {
    expect(datesMensuelles("2026-06-01", "2026-01-01")).toEqual([]);
  });
});

describe("seriePatrimoine", () => {
  it("rend un point par date, total et liquide", () => {
    const c = compte({ id: 1 });
    const b = [
      releve({ account_id: 1, date: "2026-01-01", amount_cents: 100_000 }),
      releve({ account_id: 1, date: "2026-03-01", amount_cents: 300_000 }),
    ];
    const serie = seriePatrimoine([c], b, datesMensuelles("2026-01-01", "2026-03-01"));
    expect(serie).toHaveLength(3);
    expect(serie[0].totalCents).toBe(100_000);
    expect(serie[2].totalCents).toBe(300_000);
    expect(serie[1].totalCents).toBeGreaterThan(100_000);
    expect(serie[1].totalCents).toBeLessThan(300_000);
  });
});
