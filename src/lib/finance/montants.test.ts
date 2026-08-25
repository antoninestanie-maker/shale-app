import { describe, expect, it } from "vitest";

import {
  convertirCents,
  divArrondi,
  formaterCents,
  formaterQuantite,
  multiplierParRatio,
  parseMontantEnCents,
  parseQuantiteE8,
  valeurPositionCents,
} from "./montants";

describe("divArrondi", () => {
  it("arrondit au plus proche", () => {
    expect(divArrondi(7n, 2n)).toBe(4n); // 3,5 → 4
    expect(divArrondi(6n, 4n)).toBe(2n); // 1,5 → 2
    expect(divArrondi(5n, 4n)).toBe(1n); // 1,25 → 1
  });

  it("traite les moitiés À L'ÉCART de zéro, donc symétriquement", () => {
    // Un arrondi vers l'infini positif ferait dériver un solde débiteur dans le
    // sens opposé à un solde créditeur : visible au bout de quelques mois.
    expect(divArrondi(-7n, 2n)).toBe(-4n);
    expect(divArrondi(7n, -2n)).toBe(-4n);
    expect(divArrondi(-7n, -2n)).toBe(4n);
  });

  it("refuse la division par zéro plutôt que de rendre l'infini", () => {
    expect(() => divArrondi(1n, 0n)).toThrow();
  });
});

describe("valeurPositionCents", () => {
  it("multiplie deux échelles 10⁻⁸ et rend des centimes", () => {
    // 1 part à 50,00 € = 5 000 centimes
    expect(valeurPositionCents(100_000_000, 5_000_000_000)).toBe(5_000);
  });

  it("survit à un bitcoin à 100 000 $ — le cas qui déborde en flottant", () => {
    // 1e8 × 1e13 = 1e21, très au-delà des 2⁵³ où un `number` cesse de compter
    // juste. Sans bigint, ce test rend un chiffre faux sans rien signaler.
    expect(valeurPositionCents(100_000_000, 10_000_000_000_000)).toBe(10_000_000);
  });

  it("compte une fraction de satoshi sans la perdre", () => {
    // 0,00000001 BTC à 100 000 $ = 0,001 $ → 0 centime après arrondi
    expect(valeurPositionCents(1, 10_000_000_000_000)).toBe(0);
    // 0,0001 BTC à 100 000 $ = 10 $ = 1 000 centimes
    expect(valeurPositionCents(10_000, 10_000_000_000_000)).toBe(1_000);
  });
});

describe("convertirCents", () => {
  it("applique un taux à l'échelle 10⁻⁸", () => {
    expect(convertirCents(10_000, 92_000_000)).toBe(9_200); // 100 $ × 0,92
  });

  it("laisse le montant intact à taux 1", () => {
    expect(convertirCents(123_456, 100_000_000)).toBe(123_456);
  });
});

describe("multiplierParRatio", () => {
  it("arrondit une fois et rend un entier", () => {
    expect(multiplierParRatio(20_000, 3.5)).toBe(70_000);
    expect(multiplierParRatio(20_000, -1)).toBe(-20_000);
    expect(multiplierParRatio(3_333, 0.333)).toBe(1_110);
  });
});

describe("parseMontantEnCents", () => {
  it("lit les formes courantes", () => {
    expect(parseMontantEnCents("1234,56")).toBe(123_456);
    expect(parseMontantEnCents("1234.56")).toBe(123_456);
    expect(parseMontantEnCents("1 234,56 €")).toBe(123_456);
    expect(parseMontantEnCents("-950")).toBe(-95_000);
    expect(parseMontantEnCents("0,05")).toBe(5);
    expect(parseMontantEnCents(",5")).toBe(50);
  });

  it("tolère l'espace insécable, que le presse-papier ramène tout le temps", () => {
    expect(parseMontantEnCents("12 345,67")).toBe(1_234_567);
    expect(parseMontantEnCents("12 345,67")).toBe(1_234_567);
  });

  it("comprend que le DERNIER séparateur est le décimal", () => {
    expect(parseMontantEnCents("1.234,56")).toBe(123_456);
    expect(parseMontantEnCents("1,234.56")).toBe(123_456);
  });

  it("arrondit au-delà de deux décimales, sans passer par un flottant", () => {
    expect(parseMontantEnCents("12,999")).toBe(1_300);
    expect(parseMontantEnCents("0,005")).toBe(1);
    expect(parseMontantEnCents("0,004")).toBe(0);
  });

  it("rend `null` sur une saisie qui n'est pas un nombre — jamais zéro", () => {
    // Zéro serait une réponse plausible et fausse : le champ resterait vide à
    // l'écran, et un solde nul entrerait en base.
    expect(parseMontantEnCents("")).toBeNull();
    expect(parseMontantEnCents("   ")).toBeNull();
    expect(parseMontantEnCents("abc")).toBeNull();
    expect(parseMontantEnCents("12,34,56")).toBeNull();
    expect(parseMontantEnCents("€")).toBeNull();
  });
});

describe("parseQuantiteE8", () => {
  it("garde les huit décimales que la crypto utilise vraiment", () => {
    expect(parseQuantiteE8("0,00000001")).toBe(1);
    expect(parseQuantiteE8("1,5")).toBe(150_000_000);
    expect(parseQuantiteE8("12")).toBe(1_200_000_000);
  });

  it("ne rabote pas à deux décimales comme le ferait un montant", () => {
    expect(parseMontantEnCents("0,00000001")).toBe(0);
    expect(parseQuantiteE8("0,00000001")).toBe(1);
  });

  it("rend `null` sur une saisie vide ou invalide", () => {
    expect(parseQuantiteE8("")).toBeNull();
    expect(parseQuantiteE8("x")).toBeNull();
  });
});

describe("formatage", () => {
  it("rend un montant lisible dans la locale demandée", () => {
    expect(formaterCents(123_456, "EUR", "fr-FR")).toMatch(/1\s?234,56/);
    expect(formaterCents(-9_500, "EUR", "fr-FR")).toMatch(/-95,00/);
  });

  it("sait masquer les centimes pour les grands chiffres", () => {
    expect(formaterCents(250_000_00, "EUR", "fr-FR", { sansDecimales: true })).not.toMatch(/,/);
  });

  it("préfixe un signe quand on le demande, sur les positifs seulement", () => {
    expect(formaterCents(1_000, "EUR", "fr-FR", { signeExplicite: true })).toMatch(/^\+/);
    expect(formaterCents(-1_000, "EUR", "fr-FR", { signeExplicite: true })).not.toMatch(/^\+/);
    expect(formaterCents(0, "EUR", "fr-FR", { signeExplicite: true })).not.toMatch(/^\+/);
  });

  it("retire les zéros de fin d'une quantité", () => {
    expect(formaterQuantite(150_000_000, "fr-FR")).toBe("1,5");
    expect(formaterQuantite(100_000_000, "fr-FR")).toBe("1");
    expect(formaterQuantite(1, "fr-FR")).toBe("0,00000001");
    expect(formaterQuantite(-150_000_000, "fr-FR")).toBe("-1,5");
  });
});
