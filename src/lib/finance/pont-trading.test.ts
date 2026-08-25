import { describe, expect, it } from "vitest";

import { trade } from "./finance.testutil";
import { pontTrading, risqueParRSuggere } from "./pont-trading";

const R_EN_CENTIMES = 20_000; // 1 R = 200 €

describe("pontTrading", () => {
  it("convertit la somme des R en euros", () => {
    const t = [
      trade({ date: "2026-08-01", result_r: 2.5 }),
      trade({ date: "2026-08-10", result_r: -1 }),
      trade({ date: "2026-08-20", result_r: 1.5 }),
    ];
    const p = pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 150_000);
    expect(p.nbTrades).toBe(3);
    expect(p.sommeR).toBe(3);
    expect(p.contributionCents).toBe(60_000); // 3 R × 200 €
  });

  it("EXCLUT les backtests — un backtest ne paye pas de loyer", () => {
    const t = [
      trade({ date: "2026-08-01", result_r: 1, mode: "live" }),
      trade({ date: "2026-08-02", result_r: 50, mode: "backtest" }),
    ];
    const p = pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 150_000);
    expect(p.nbTrades).toBe(1);
    expect(p.contributionCents).toBe(20_000);
  });

  it("ignore ce qui tombe hors de la période, bornes comprises", () => {
    const t = [
      trade({ date: "2026-07-31", result_r: 10 }),
      trade({ date: "2026-08-01", result_r: 1 }),
      trade({ date: "2026-08-31", result_r: 1 }),
      trade({ date: "2026-09-01", result_r: 10 }),
    ];
    expect(pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 150_000).sommeR).toBe(2);
  });

  it("dit quelle part du burn le trading couvre", () => {
    // 5 R × 200 € = 1 000 € sur un mois, pour 2 000 € de burn = 50 %
    const t = [trade({ date: "2026-08-10", result_r: 5 })];
    const p = pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 200_000);
    expect(p.partDuBurnPct).toBe(50);
    expect(p.moisCouverts).toBe(0.5);
  });

  it("n'extrapole PAS une période plus courte qu'un mois", () => {
    // Trois jours de bon trading ne font pas « 340 % du burn couvert ».
    const t = [trade({ date: "2026-08-02", result_r: 5 })];
    const p = pontTrading(t, "2026-08-01", "2026-08-03", R_EN_CENTIMES, 200_000);
    expect(p.contributionMensuelleCents).toBe(100_000);
    expect(p.partDuBurnPct).toBe(50);
  });

  it("ramène au mois une période plus longue", () => {
    // 12 R sur un an = 2 400 € = 200 €/mois
    const t = [trade({ date: "2026-03-01", result_r: 12 })];
    const p = pontTrading(t, "2026-01-01", "2026-12-31", R_EN_CENTIMES, 200_000);
    expect(p.contributionMensuelleCents).toBeGreaterThan(19_000);
    expect(p.contributionMensuelleCents).toBeLessThan(21_000);
  });

  it("ne divise pas par un burn nul ou négatif", () => {
    const t = [trade({ result_r: 3 })];
    expect(pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 0).partDuBurnPct).toBeNull();
    expect(
      pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, -50_000).moisCouverts,
    ).toBeNull();
  });

  it("assume un mois perdant", () => {
    const t = [trade({ date: "2026-08-05", result_r: -3.5 })];
    const p = pontTrading(t, "2026-08-01", "2026-08-31", R_EN_CENTIMES, 200_000);
    expect(p.contributionCents).toBe(-70_000);
    expect(p.partDuBurnPct).toBe(-35);
  });

  it("sur un journal vide, rend zéro sans se plaindre", () => {
    const p = pontTrading([], "2026-08-01", "2026-08-31", R_EN_CENTIMES, 200_000);
    expect(p).toMatchObject({ nbTrades: 0, sommeR: 0, contributionCents: 0, partDuBurnPct: 0 });
  });
});

describe("risqueParRSuggere", () => {
  it("déduit 1 R des réglages du calculateur", () => {
    expect(risqueParRSuggere(20_000, 1)).toBe(20_000); // 20 000 € × 1 % = 200 €
    expect(risqueParRSuggere(50_000, 0.5)).toBe(25_000);
  });

  it("ne suggère rien plutôt que de suggérer zéro", () => {
    expect(risqueParRSuggere(null, 1)).toBeNull();
    expect(risqueParRSuggere(20_000, null)).toBeNull();
    expect(risqueParRSuggere(0, 1)).toBeNull();
    expect(risqueParRSuggere(20_000, 0)).toBeNull();
    expect(risqueParRSuggere(Number.NaN, 1)).toBeNull();
  });
});
