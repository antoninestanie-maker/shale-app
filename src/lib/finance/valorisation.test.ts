import { describe, expect, it } from "vitest";

import { cotation, position, taux } from "./finance.testutil";
import { tauxVers, valoriser } from "./valorisation";

const MAINTENANT = "2026-08-25T10:00:00.000Z";

describe("tauxVers", () => {
  it("rend 1 pour une devise vers elle-même", () => {
    expect(tauxVers([], "EUR", "EUR")).toBe(100_000_000);
  });

  it("trouve le couple direct", () => {
    expect(tauxVers([taux({ base: "USD", quote: "EUR", rate_e8: 92_000_000 })], "USD", "EUR")).toBe(
      92_000_000,
    );
  });

  it("inverse le couple en bigint quand seul l'inverse existe", () => {
    // 1 / 0,92 = 1,08695652…
    const t = tauxVers([taux({ base: "EUR", quote: "USD", rate_e8: 92_000_000 })], "USD", "EUR");
    expect(t).toBe(108_695_652);
  });

  it("rend `null` quand rien ne relie les deux devises", () => {
    expect(tauxVers([taux({ base: "USD", quote: "EUR" })], "JPY", "EUR")).toBeNull();
  });
});

describe("valoriser", () => {
  it("valorise une ligne dans sa propre devise", () => {
    const v = valoriser(
      [position({ symbol: "CW8.PA", quantity_e8: 1_200_000_000 })], // 12 parts
      [cotation({ symbol: "CW8.PA", price_e8: 5_000_000_000, currency: "EUR" })], // 50,00 €
      [],
      "EUR",
      MAINTENANT,
    );
    expect(v.totalCents).toBe(60_000); // 600,00 €
    expect(v.incomplets).toBe(0);
    expect(v.lignes[0].manque).toBeNull();
  });

  it("convertit une cotation en dollars", () => {
    const v = valoriser(
      [position({ symbol: "AAPL", quantity_e8: 1_000_000_000 })], // 10 titres
      [cotation({ symbol: "AAPL", price_e8: 20_000_000_000, currency: "USD" })], // 200 $
      [taux({ base: "USD", quote: "EUR", rate_e8: 92_000_000 })],
      "EUR",
      MAINTENANT,
    );
    expect(v.totalCents).toBe(184_000); // 2 000 $ × 0,92 = 1 840 €
  });

  it("laisse une ligne à `null` plutôt que de la compter zéro", () => {
    // Faute de cotation, la valeur est INCONNUE. L'ajouter comme zéro
    // annoncerait une perte totale à quelqu'un dont la connexion est coupée.
    const v = valoriser([position({ symbol: "INCONNU" })], [], [], "EUR", MAINTENANT);
    expect(v.totalCents).toBe(0);
    expect(v.incomplets).toBe(1);
    expect(v.lignes[0].valeurCents).toBeNull();
    expect(v.lignes[0].manque).toBe("cotation");
  });

  it("distingue une cotation manquante d'un taux manquant", () => {
    const v = valoriser(
      [position({ symbol: "TSE", quantity_e8: 100_000_000 })],
      [cotation({ symbol: "TSE", currency: "JPY" })],
      [],
      "EUR",
      MAINTENANT,
    );
    expect(v.lignes[0].manque).toBe("taux");
  });

  it("marque une cotation datée sans la refuser", () => {
    const v = valoriser(
      [position()],
      [cotation({ fetched_at: "2026-08-20T10:00:00.000Z" })],
      [],
      "EUR",
      MAINTENANT,
      24,
    );
    expect(v.lignes[0].perimee).toBe(true);
    expect(v.lignes[0].valeurCents).not.toBeNull();
    expect(v.totalCents).toBeGreaterThan(0);
  });

  it("calcule la plus-value quand le prix de revient est connu, sinon `null`", () => {
    const avec = valoriser(
      [position({ quantity_e8: 200_000_000, cost_basis_cents: 8_000 })], // 2 parts, 80 € payés
      [cotation({ price_e8: 5_000_000_000 })], // 50 € l'une → 100 €
      [],
      "EUR",
      MAINTENANT,
    );
    expect(avec.lignes[0].plusValueCents).toBe(2_000);

    const sans = valoriser([position({ cost_basis_cents: null })], [cotation()], [], "EUR", MAINTENANT);
    expect(sans.lignes[0].plusValueCents).toBeNull();
  });

  it("tient un portefeuille crypto sans déborder", () => {
    const v = valoriser(
      [position({ symbol: "BTCUSDT", quantity_e8: 250_000_000, source: "binance" })], // 2,5 BTC
      [
        cotation({
          symbol: "BTCUSDT",
          price_e8: 10_000_000_000_000, // 100 000 $
          currency: "USD",
          source: "binance",
        }),
      ],
      [taux({ base: "USD", quote: "EUR", rate_e8: 100_000_000 })],
      "EUR",
      MAINTENANT,
    );
    expect(v.totalCents).toBe(25_000_000); // 250 000,00
  });

  it("sur un portefeuille vide, rend zéro sans rien signaler", () => {
    expect(valoriser([], [], [], "EUR", MAINTENANT)).toEqual({
      lignes: [],
      totalCents: 0,
      incomplets: 0,
    });
  });
});
