import { describe, expect, it } from "vitest";

import type { Invoice, InvoicePayment } from "../../types";
import { delaiPaiementMoyen, encours, trancheDe } from "./creances";

function facture(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: `F-${p.id}`,
    serie_id: 1,
    party_id: 1,
    date_emission: "2026-08-01",
    date_echeance: "2026-08-31",
    conditions_paiement: null,
    devise: "EUR",
    taux_change_e8: null,
    total_ht_cents: 100_000,
    total_tva_cents: 0,
    total_ttc_cents: 100_000,
    mentions: null,
    emetteur_fige: null,
    objet: null,
    note: null,
    avoir_de_id: null,
    devis_origine_id: null,
    created_at: "2026-08-01T09:00:00",
    updated_at: "2026-08-01T09:00:00",
    ...p,
  };
}

function paiement(invoiceId: number, montantCents: number, date: string): InvoicePayment {
  return {
    id: invoiceId * 100 + montantCents,
    invoice_id: invoiceId,
    date,
    montant_cents: montantCents,
    devise: "EUR",
    taux_change_e8: null,
    account_id: 1,
    moyen: null,
    note: null,
    created_at: `${date}T10:00:00`,
  };
}

describe("les tranches d'ancienneté", () => {
  it("classe par jours de retard, bornes comprises", () => {
    expect(trancheDe(0, false)).toBe("a-echoir");
    expect(trancheDe(1, true)).toBe("1-30");
    expect(trancheDe(30, true)).toBe("1-30");
    expect(trancheDe(31, true)).toBe("31-60");
    expect(trancheDe(60, true)).toBe("31-60");
    expect(trancheDe(61, true)).toBe("60-plus");
  });
});

describe("l'encours client", () => {
  it("somme les restes dus et les ventile", () => {
    const factures = [
      facture({ id: 1, date_echeance: "2026-09-30" }), // à échoir
      facture({ id: 2, date_echeance: "2026-08-25" }), // 15 j de retard
      facture({ id: 3, date_echeance: "2026-06-01" }), // 100 j de retard
    ];
    const e = encours(factures, [], "vente", "2026-09-09");

    expect(e.totalCents).toBe(300_000);
    expect(e.parTranche["a-echoir"]).toBe(100_000);
    expect(e.parTranche["1-30"]).toBe(100_000);
    expect(e.parTranche["60-plus"]).toBe(100_000);
    expect(e.nbEnRetard).toBe(2);
  });

  it("ne compte que le RESTE dû, pas le total", () => {
    const e = encours(
      [facture({ id: 1 })],
      [paiement(1, 70_000, "2026-08-10")],
      "vente",
      "2026-09-09",
    );
    expect(e.totalCents).toBe(30_000);
  });

  it("écarte ce qui est soldé, en brouillon ou annulé", () => {
    const e = encours(
      [
        facture({ id: 1 }),
        facture({ id: 2, statut: "brouillon" }),
        facture({ id: 3, statut: "annulee" }),
      ],
      [paiement(1, 100_000, "2026-08-10")],
      "vente",
      "2026-09-09",
    );
    expect(e.totalCents).toBe(0);
    expect(e.lignes).toEqual([]);
  });

  it("⚠️ un DEVIS n'entre JAMAIS dans un encours", () => {
    const e = encours([facture({ id: 1, type: "devis" })], [], "vente", "2026-09-09");
    expect(e.totalCents).toBe(0);
  });

  it("sépare les ventes des achats", () => {
    const factures = [
      facture({ id: 1, sens: "vente" }),
      facture({ id: 2, sens: "achat", total_ttc_cents: 40_000 }),
    ];
    expect(encours(factures, [], "vente", "2026-09-09").totalCents).toBe(100_000);
    expect(encours(factures, [], "achat", "2026-09-09").totalCents).toBe(40_000);
  });

  it("⭐ un AVOIR réduit l'encours — c'est son rôle", () => {
    const e = encours(
      [
        facture({ id: 1 }),
        facture({ id: 2, type: "avoir", total_ttc_cents: -30_000, avoir_de_id: 1 }),
      ],
      [],
      "vente",
      "2026-09-09",
    );
    expect(e.totalCents).toBe(70_000);
  });

  it("trie les lignes du plus en retard au moins", () => {
    const e = encours(
      [
        facture({ id: 1, date_echeance: "2026-09-30" }),
        facture({ id: 2, date_echeance: "2026-06-01" }),
        facture({ id: 3, date_echeance: "2026-08-25" }),
      ],
      [],
      "vente",
      "2026-09-09",
    );
    expect(e.lignes.map((l) => l.facture.id)).toEqual([2, 3, 1]);
  });

  it("un encours vide reste lisible : toutes les tranches présentes, à zéro", () => {
    const e = encours([], [], "vente", "2026-09-09");
    expect(e.parTranche).toEqual({ "a-echoir": 0, "1-30": 0, "31-60": 0, "60-plus": 0 });
  });
});

describe("délai de paiement moyen constaté", () => {
  it("mesure de l'émission au DERNIER paiement", () => {
    const d = delaiPaiementMoyen(
      [facture({ id: 1, date_emission: "2026-08-01" })],
      [paiement(1, 40_000, "2026-08-10"), paiement(1, 60_000, "2026-08-21")],
      1,
    );
    expect(d).toBe(20);
  });

  it("moyenne sur plusieurs factures soldées", () => {
    const d = delaiPaiementMoyen(
      [
        facture({ id: 1, date_emission: "2026-08-01" }),
        facture({ id: 2, date_emission: "2026-08-01" }),
      ],
      [paiement(1, 100_000, "2026-08-11"), paiement(2, 100_000, "2026-08-31")],
      1,
    );
    expect(d).toBe(20); // (10 + 30) / 2
  });

  it("⭐ IGNORE les impayées — sinon la moyenne s'améliore quand ça se dégrade", () => {
    const d = delaiPaiementMoyen(
      [
        facture({ id: 1, date_emission: "2026-08-01" }),
        facture({ id: 2, date_emission: "2026-01-01" }), // jamais payée
      ],
      [paiement(1, 100_000, "2026-08-11")],
      1,
    );
    expect(d).toBe(10);
  });

  it("ignore un règlement partiel : la facture n'est pas soldée", () => {
    const d = delaiPaiementMoyen(
      [facture({ id: 1 })],
      [paiement(1, 40_000, "2026-08-10")],
      1,
    );
    expect(d).toBeNull();
  });

  it("⭐ rend `null` — jamais 0, qui se lirait « il paye le jour même »", () => {
    expect(delaiPaiementMoyen([facture({ id: 1 })], [], 1)).toBeNull();
    expect(delaiPaiementMoyen([], [], 1)).toBeNull();
  });

  it("ne mélange pas les clients", () => {
    const d = delaiPaiementMoyen(
      [
        facture({ id: 1, party_id: 1, date_emission: "2026-08-01" }),
        facture({ id: 2, party_id: 2, date_emission: "2026-08-01" }),
      ],
      [paiement(1, 100_000, "2026-08-11"), paiement(2, 100_000, "2026-08-31")],
      2,
    );
    expect(d).toBe(30);
  });

  it("borne à zéro un paiement antidaté plutôt que de compter un délai négatif", () => {
    const d = delaiPaiementMoyen(
      [facture({ id: 1, date_emission: "2026-08-10" })],
      [paiement(1, 100_000, "2026-08-01")],
      1,
    );
    expect(d).toBe(0);
  });

  it("écarte les devis", () => {
    expect(
      delaiPaiementMoyen(
        [facture({ id: 1, type: "devis" })],
        [paiement(1, 100_000, "2026-08-11")],
        1,
      ),
    ).toBeNull();
  });
});
