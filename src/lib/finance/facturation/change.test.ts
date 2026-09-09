import { describe, expect, it } from "vitest";

import type { FinanceFxRate } from "../../types";
import {
  TAUX_IDENTITE,
  convertirAuTaux,
  enDeviseReference,
  formaterTaux,
  tauxManquant,
  tauxPropose,
} from "./change";

const cache: FinanceFxRate[] = [
  { base: "USD", quote: "EUR", rate_e8: 92_000_000, fetched_at: "2026-09-09T08:00:00Z" },
];

describe("conversion au taux figé", () => {
  it("applique le taux à l'échelle 10⁻⁸", () => {
    // 1 000,00 $ × 0,92 = 920,00 €
    expect(convertirAuTaux(100_000, 92_000_000)).toBe(92_000);
  });

  it("⚠️ `null` rend le montant TEL QUEL — il ne vaut pas 1 par hasard", () => {
    // `null` veut dire « aucun taux figé », ce qui n'est légitime que si la
    // devise est déjà celle de référence. L'appelant lève le doute avant.
    expect(convertirAuTaux(100_000, null)).toBe(100_000);
  });

  it("⭐ reste juste au-delà de 2^53", () => {
    // 90 000 000,00 € × 1,085 : le produit brut dépasse 2^53. Sans bigint le
    // résultat serait faux, et rien ne le signalerait.
    expect(convertirAuTaux(9_000_000_000, 108_500_000)).toBe(9_765_000_000);
  });

  it("arrondit symétriquement les montants négatifs", () => {
    expect(convertirAuTaux(-1005, 50_000_000)).toBe(-503);
    expect(convertirAuTaux(1005, 50_000_000)).toBe(503);
  });
});

describe("montant dans la devise de référence", () => {
  it("ne convertit pas quand la devise est déjà la bonne", () => {
    expect(
      enDeviseReference({ montantCents: 100_000, devise: "EUR", tauxChangeE8: null }, "EUR"),
    ).toBe(100_000);
  });

  it("ignore un taux parasite posé sur une opération déjà en devise de référence", () => {
    expect(
      enDeviseReference(
        { montantCents: 100_000, devise: "EUR", tauxChangeE8: 50_000_000 },
        "EUR",
      ),
    ).toBe(100_000);
  });

  it("convertit avec le taux figé de l'opération", () => {
    expect(
      enDeviseReference(
        { montantCents: 100_000, devise: "USD", tauxChangeE8: 92_000_000 },
        "EUR",
      ),
    ).toBe(92_000);
  });

  it("⭐ le taux de l'OPÉRATION prime : deux paiements du même jour peuvent différer", () => {
    // C'est tout l'intérêt de figer : un acompte de février et un solde de
    // septembre ne se convertissent pas au même taux, et aucun des deux ne
    // change plus jamais.
    const acompte = { montantCents: 50_000, devise: "USD", tauxChangeE8: 92_000_000 };
    const solde = { montantCents: 50_000, devise: "USD", tauxChangeE8: 85_000_000 };
    expect(enDeviseReference(acompte, "EUR")).toBe(46_000);
    expect(enDeviseReference(solde, "EUR")).toBe(42_500);
  });
});

describe("taux manquant", () => {
  it("signale une devise étrangère sans taux figé", () => {
    expect(tauxManquant({ devise: "USD", tauxChangeE8: null }, "EUR")).toBe(true);
  });

  it("ne signale rien quand la devise est celle de référence", () => {
    expect(tauxManquant({ devise: "EUR", tauxChangeE8: null }, "EUR")).toBe(false);
  });

  it("ne signale rien quand le taux est figé", () => {
    expect(tauxManquant({ devise: "USD", tauxChangeE8: 92_000_000 }, "EUR")).toBe(false);
  });
});

describe("taux PROPOSÉ à la saisie (jamais celui d'une opération enregistrée)", () => {
  it("rend le taux neutre pour une paire identique", () => {
    expect(tauxPropose(cache, "EUR", "EUR")).toBe(TAUX_IDENTITE);
    expect(TAUX_IDENTITE).toBe(100_000_000);
  });

  it("lit le cache dans le bon sens", () => {
    expect(tauxPropose(cache, "USD", "EUR")).toBe(92_000_000);
  });

  it("calcule l'inverse quand le cache ne connaît que l'autre sens", () => {
    const inverse = tauxPropose(cache, "EUR", "USD");
    expect(inverse).not.toBeNull();
    // 1 / 0,92 ≈ 1,0869…
    expect(inverse).toBe(108_695_652);
  });

  it("⭐ rend `null` sur une paire inconnue — la saisie manuelle prend le relais", () => {
    // Un indépendant qui facture en francs suisses depuis un avion doit
    // pouvoir le faire.
    expect(tauxPropose(cache, "CHF", "EUR")).toBeNull();
    expect(tauxPropose([], "USD", "EUR")).toBeNull();
  });

  it("ne divise pas par un taux nul", () => {
    const casse: FinanceFxRate[] = [
      { base: "USD", quote: "EUR", rate_e8: 0, fetched_at: "2026-09-09T08:00:00Z" },
    ];
    expect(tauxPropose(casse, "EUR", "USD")).toBeNull();
  });
});

describe("affichage d'un taux", () => {
  it("rend quatre décimales au plus", () => {
    expect(formaterTaux(108_500_000, "fr-FR")).toBe("1,085");
    expect(formaterTaux(100_000_000, "fr-FR")).toBe("1,00");
  });
});
