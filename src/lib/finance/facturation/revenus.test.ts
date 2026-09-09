import { describe, expect, it } from "vitest";

import type { FinanceRecurring, Invoice, InvoicePayment } from "../../types";
import { burnMensuel } from "../burn";
import { comparerRevenus, ecartNotable } from "./revenus";

function recurrent(p: Partial<FinanceRecurring> & { id: number }): FinanceRecurring {
  return {
    label: "Prestation",
    amount_cents: 400_000,
    direction: "entree",
    frequency: "mensuel",
    day_of_period: 5,
    category_id: null,
    account_id: null,
    active_from: "2025-01-01",
    active_to: null,
    created_at: "2025-01-01T00:00:00",
    updated_at: "2025-01-01T00:00:00",
    ...p,
  };
}

function facture(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: `F-${p.id}`,
    serie_id: 1,
    party_id: 1,
    date_emission: "2026-06-01",
    date_echeance: "2026-07-01",
    conditions_paiement: null,
    devise: "EUR",
    taux_change_e8: null,
    total_ht_cents: 300_000,
    total_tva_cents: 0,
    total_ttc_cents: 300_000,
    mentions: null,
    emetteur_fige: null,
    objet: null,
    note: null,
    avoir_de_id: null,
    devis_origine_id: null,
    created_at: "2026-06-01T09:00:00",
    updated_at: "2026-06-01T09:00:00",
    ...p,
  };
}

function paiement(p: Partial<InvoicePayment> & { id: number }): InvoicePayment {
  return {
    invoice_id: 1,
    date: "2026-07-15",
    montant_cents: 300_000,
    devise: "EUR",
    taux_change_e8: null,
    account_id: 1,
    moyen: null,
    note: null,
    created_at: "2026-07-15T10:00:00",
    ...p,
  };
}

const AUJ = "2026-09-09";

describe("⚠️ le burn n'est PAS touché", () => {
  it("`burnMensuel` ignore complètement factures et paiements", () => {
    // Contre-épreuve : la seule source du burn reste `finance_recurring`.
    const recurrents = [
      recurrent({ id: 1, direction: "entree", amount_cents: 400_000 }),
      recurrent({ id: 2, direction: "sortie", amount_cents: 130_000 }),
    ];
    const b = burnMensuel(recurrents, AUJ);
    expect(b.entreesCents).toBe(400_000);
    expect(b.sortiesCents).toBe(130_000);
    expect(b.netCents).toBe(-270_000);
    expect(b.actifs).toBe(2);
  });
});

describe("déclaré face à encaissé", () => {
  it("mensualise le déclaré et moyenne l'encaissé sur la fenêtre", () => {
    const c = comparerRevenus(
      [recurrent({ id: 1, amount_cents: 400_000 })],
      [facture({ id: 1 })],
      [
        paiement({ id: 1, date: "2026-07-15", montant_cents: 300_000 }),
        paiement({ id: 2, date: "2026-08-15", montant_cents: 300_000 }),
        paiement({ id: 3, date: "2026-09-01", montant_cents: 300_000 }),
      ],
      3,
      AUJ,
    );
    expect(c.declareMensuelCents).toBe(400_000);
    expect(c.encaisseTotalCents).toBe(900_000);
    expect(c.encaisseMensuelCents).toBe(300_000);
    expect(c.ecartMensuelCents).toBe(-100_000);
    expect(c.ecartRatio).toBeCloseTo(-0.25, 5);
  });

  it("mensualise correctement un flux annuel", () => {
    const c = comparerRevenus(
      [recurrent({ id: 1, amount_cents: 1_200_000, frequency: "annuel" })],
      [],
      [],
      12,
      AUJ,
    );
    expect(c.declareMensuelCents).toBe(100_000);
  });

  it("⚠️ un flux RÉSILIÉ ne gonfle pas le déclaré d'aujourd'hui", () => {
    // C'est le revenu sur lequel l'utilisateur compte MAINTENANT qu'on compare.
    const c = comparerRevenus(
      [recurrent({ id: 1, amount_cents: 400_000, active_to: "2026-01-31" })],
      [],
      [],
      12,
      AUJ,
    );
    expect(c.declareMensuelCents).toBe(0);
  });

  it("⚠️ SEULES LES VENTES comptent — un achat n'est pas un revenu négatif", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1, sens: "vente" }), facture({ id: 2, sens: "achat" })],
      [
        paiement({ id: 1, invoice_id: 1, montant_cents: 300_000 }),
        paiement({ id: 2, invoice_id: 2, montant_cents: 500_000 }),
      ],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(300_000);
  });

  it("écarte les paiements hors de la fenêtre", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1 })],
      [
        paiement({ id: 1, date: "2026-01-15" }), // trop ancien pour 3 mois
        paiement({ id: 2, date: "2026-08-15" }),
      ],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(300_000);
  });

  it("écarte un paiement DANS LE FUTUR — il n'a pas encore eu lieu", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-12-01" })],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(0);
  });

  it("un remboursement (montant négatif) réduit l'encaissé", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1 })],
      [
        paiement({ id: 1, date: "2026-08-01", montant_cents: 300_000 }),
        paiement({ id: 2, date: "2026-08-20", montant_cents: -100_000 }),
      ],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(200_000);
  });

  it("⭐ compte les paiements SANS TAUX au lieu de les convertir au hasard", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1 })],
      [
        paiement({ id: 1, date: "2026-08-01", devise: "USD", taux_change_e8: null }),
        paiement({ id: 2, date: "2026-08-02", montant_cents: 100_000 }),
      ],
      3,
      AUJ,
    );
    expect(c.ignoresSansTaux).toBe(1);
    expect(c.encaisseTotalCents).toBe(100_000);
  });

  it("convertit avec le taux figé de chaque paiement", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1 })],
      [
        paiement({
          id: 1,
          date: "2026-08-01",
          montant_cents: 100_000,
          devise: "USD",
          taux_change_e8: 92_000_000,
        }),
      ],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(92_000);
  });

  it("⭐ `ecartRatio` reste `null` quand rien n'est déclaré", () => {
    // Diviser par zéro donnerait `Infinity`, qu'aucun écran ne sait afficher
    // honnêtement.
    const c = comparerRevenus([], [facture({ id: 1 })], [paiement({ id: 1 })], 3, AUJ);
    expect(c.declareMensuelCents).toBe(0);
    expect(c.ecartRatio).toBeNull();
  });

  it("les devis n'entrent pas", () => {
    const c = comparerRevenus(
      [],
      [facture({ id: 1, type: "devis" })],
      [paiement({ id: 1, invoice_id: 1 })],
      3,
      AUJ,
    );
    expect(c.encaisseTotalCents).toBe(0);
  });
});

describe("⭐ un écart durable est une INFORMATION, et il faut les deux conditions", () => {
  const gros = (fenetre: 3 | 6 | 12) =>
    comparerRevenus(
      [recurrent({ id: 1, amount_cents: 400_000 })],
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-08-15", montant_cents: 100_000 })],
      fenetre,
      AUJ,
    );

  it("un gros écart sur TROIS mois ne se signale pas — ce peut être un retard", () => {
    expect(ecartNotable(gros(3))).toBe(false);
  });

  it("le même écart sur SIX mois se signale — il décrit une activité", () => {
    expect(ecartNotable(gros(6))).toBe(true);
  });

  it("un petit écart ne se signale à aucune fenêtre", () => {
    const c = comparerRevenus(
      [recurrent({ id: 1, amount_cents: 100_000 })],
      [facture({ id: 1 })],
      [
        paiement({ id: 1, date: "2026-05-01", montant_cents: 95_000 }),
        paiement({ id: 2, date: "2026-06-01", montant_cents: 95_000 }),
        paiement({ id: 3, date: "2026-07-01", montant_cents: 95_000 }),
        paiement({ id: 4, date: "2026-08-01", montant_cents: 95_000 }),
        paiement({ id: 5, date: "2026-09-01", montant_cents: 95_000 }),
        paiement({ id: 6, date: "2026-04-15", montant_cents: 95_000 }),
      ],
      6,
      AUJ,
    );
    expect(ecartNotable(c)).toBe(false);
  });

  it("un écart POSITIF durable se signale aussi", () => {
    // Encaisser beaucoup plus que déclaré rend le runway prudent trop
    // pessimiste : c'est une information, pas une bonne nouvelle silencieuse.
    const c = comparerRevenus(
      [recurrent({ id: 1, amount_cents: 100_000 })],
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-08-15", montant_cents: 3_000_000 })],
      6,
      AUJ,
    );
    expect(c.ecartMensuelCents).toBeGreaterThan(0);
    expect(ecartNotable(c)).toBe(true);
  });

  it("rien de déclaré ⇒ rien à signaler", () => {
    const c = comparerRevenus([], [facture({ id: 1 })], [paiement({ id: 1 })], 12, AUJ);
    expect(ecartNotable(c)).toBe(false);
  });
});
