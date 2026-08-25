import { describe, expect, it } from "vitest";

import { deviseBinance, estFraiche, prixVersE8 } from "./quotes";

/**
 * Seul le parsing est testé ici : ce fichier ne fait rien d'autre que traduire
 * une réponse d'API, et c'est très exactement là que se glissent les erreurs de
 * précision qu'on ne voit qu'à la troisième décimale d'un portefeuille.
 */

describe("prixVersE8", () => {
  it("lit la chaîne que Binance renvoie, sans passer par un flottant", () => {
    expect(prixVersE8("104238.12000000")).toBe(10_423_812_000_000);
    expect(prixVersE8("0.00000001")).toBe(1);
  });

  it("lit le nombre que Yahoo renvoie", () => {
    expect(prixVersE8(50)).toBe(5_000_000_000);
    expect(prixVersE8(203.45)).toBe(20_345_000_000);
  });

  it("garde exactement les prix que `parseFloat` × 1e8 arrondirait de travers", () => {
    // 1,1 × 1e8 vaut 110000000.00000001 en flottant : la chaîne, elle, est juste.
    expect(prixVersE8("1.1")).toBe(110_000_000);
    expect(prixVersE8("0.07")).toBe(7_000_000);
  });

  it("arrondit au-delà de huit décimales", () => {
    expect(prixVersE8("1.123456789")).toBe(112_345_679);
  });

  it("refuse ce qui n'est pas un prix", () => {
    expect(prixVersE8("")).toBeNull();
    expect(prixVersE8("abc")).toBeNull();
    expect(prixVersE8("1.2e5")).toBeNull();
  });
});

describe("deviseBinance", () => {
  it("déduit la devise du suffixe, stablecoins compris", () => {
    expect(deviseBinance("BTCUSDT")).toBe("USD");
    expect(deviseBinance("ETHUSDC")).toBe("USD");
    expect(deviseBinance("BTCEUR")).toBe("EUR");
  });

  it("rend `null` sur une paire dont on ne sait pas dire la devise", () => {
    // Mieux vaut une ligne non valorisée et signalée qu'une ligne valorisée
    // dans une devise devinée.
    expect(deviseBinance("ETHBTC")).toBeNull();
  });
});

describe("estFraiche", () => {
  it("compare à la fenêtre demandée", () => {
    const t0 = "2026-08-25T10:00:00.000Z";
    expect(estFraiche("2026-08-25T09:50:00.000Z", t0, 15)).toBe(true);
    expect(estFraiche("2026-08-25T09:40:00.000Z", t0, 15)).toBe(false);
  });
});
