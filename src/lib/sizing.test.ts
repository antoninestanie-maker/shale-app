import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Les alertes du calculateur de position suivent la langue de l'interface.
 *
 * Deux d'entre elles (risque au-dessus du seuil, taille au-dessus de la limite
 * de lots) étaient écrites en dur en français : interface en anglais, alertes
 * en français. `lib/i18n` fige la langue À L'IMPORT (PIEGES § 14.2), d'où la
 * langue posée sur `navigator` puis l'import dynamique.
 */
async function chargerEn(langue: string) {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "", languages: [langue], language: langue });
  const sizing = await import("./sizing");
  const { DEFAULT_PAIRS } = await import("./pairs");
  return { ...sizing, eurusd: DEFAULT_PAIRS.find((p) => p.symbol === "EUR/USD")! };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("alertes du calculateur", () => {
  it("risque 3 % au-dessus d'un seuil à 2 % : alerte en anglais", async () => {
    const { computeSizing, eurusd } = await chargerEn("en-US");
    const r = computeSizing(
      {
        capital: 10000,
        riskPercent: 3,
        pair: eurusd,
        entryPrice: 1.1,
        stopLossPrice: 1.099,
        spreadPips: 0,
        includeSpread: false,
        direction: "long",
      },
      { maxRiskPercent: 2, maxLots: 1, minLot: 0.01 },
    );
    expect(r.highRisk).toBe(true);
    expect(r.exceedsMaxLots).toBe(true);
    expect(r.warnings).toContain(
      "High risk (3%) — above your 2% threshold. Reconsider the size or the stop-loss.",
    );
    expect(r.warnings).toContain("Size (3.00 lots) is above your 1.00-lot limit.");
    // Aucune alerte ne doit rester en français.
    for (const w of r.warnings) expect(w).not.toMatch(/Risque|Taille|seuil|limite/);
  });

  it("en français, les paramètres sont substitués", async () => {
    const { computeSizing, eurusd } = await chargerEn("fr-FR");
    const r = computeSizing(
      {
        capital: 10000,
        riskPercent: 3,
        pair: eurusd,
        entryPrice: 1.1,
        stopLossPrice: 1.099,
        spreadPips: 0,
        includeSpread: false,
        direction: "long",
      },
      { maxRiskPercent: 2, maxLots: 1, minLot: 0.01 },
    );
    expect(r.warnings).toContain(
      "Risque élevé (3%) — au-dessus de ton seuil de 2%. Reconsidère la taille ou le stop-loss.",
    );
    expect(r.warnings).toContain("Taille (3.00 lots) au-dessus de ta limite de 1.00 lots.");
  });
});
