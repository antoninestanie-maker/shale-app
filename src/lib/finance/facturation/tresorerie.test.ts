import { describe, expect, it } from "vitest";

import type {
  FinanceAccount,
  FinanceBalance,
  Invoice,
  InvoicePayment,
} from "../../types";
import { patrimoineAu, soldeCompose } from "../patrimoine";
import { mouvementsDansFenetre, mouvementsDeTresorerie } from "./tresorerie";

function compte(p: Partial<FinanceAccount> & { id: number }): FinanceAccount {
  return {
    label: "Courant",
    kind: "courant",
    currency: "EUR",
    institution: null,
    is_liquid: 1,
    archived: 0,
    position: 1,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...p,
  };
}

function releve(accountId: number, date: string, cents: number): FinanceBalance {
  return {
    id: Number(date.replace(/-/g, "")),
    account_id: accountId,
    date,
    amount_cents: cents,
    created_at: `${date}T09:00:00`,
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
    date_emission: "2026-02-01",
    date_echeance: "2026-03-01",
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
    created_at: "2026-02-01T09:00:00",
    updated_at: "2026-02-01T09:00:00",
    ...p,
  };
}

function paiement(p: Partial<InvoicePayment> & { id: number }): InvoicePayment {
  return {
    invoice_id: 1,
    date: "2026-02-15",
    montant_cents: 300_000,
    devise: "EUR",
    taux_change_e8: null,
    account_id: 1,
    moyen: "virement",
    note: null,
    created_at: "2026-02-15T10:00:00",
    ...p,
  };
}

describe("⭐⭐ LE TEST DE RUPTURE — relevé, encaissement, nouveau relevé", () => {
  // C'est LA séquence que la migration 023 décrit en tête, et le défaut qu'elle
  // existe pour empêcher : sans fenêtre temporelle, l'utilisateur compte deux
  // fois le même euro et RIEN ne le lui signale.
  const c = compte({ id: 1 });
  const f = facture({ id: 1 });
  const p = paiement({ id: 1, date: "2026-02-15", montant_cents: 300_000 });

  it("① après le relevé du 1er février, l'encaissement du 15 s'AJOUTE", () => {
    const balances = [releve(1, "2026-02-01", 500_000)];
    const { mouvements } = mouvementsDeTresorerie([f], [p], [c]);

    expect(soldeCompose(balances, mouvements, 1, "2026-02-20")).toBe(800_000);
  });

  it("② après le relevé du 1er mars, le MÊME encaissement est ABSORBÉ", () => {
    // La banque affichait 800 000 le 1er mars : l'encaissement est dedans.
    // Continuer à l'ajouter donnerait 1 100 000 — un faux chiffre, silencieux.
    const balances = [releve(1, "2026-02-01", 500_000), releve(1, "2026-03-01", 800_000)];
    const { mouvements } = mouvementsDeTresorerie([f], [p], [c]);

    expect(soldeCompose(balances, mouvements, 1, "2026-03-05")).toBe(800_000);
  });

  it("③ et un encaissement POSTÉRIEUR au nouveau relevé s'ajoute à son tour", () => {
    const balances = [releve(1, "2026-02-01", 500_000), releve(1, "2026-03-01", 800_000)];
    const p2 = paiement({ id: 2, invoice_id: 2, date: "2026-03-10", montant_cents: 120_000 });
    const { mouvements } = mouvementsDeTresorerie([f, facture({ id: 2 })], [p, p2], [c]);

    expect(soldeCompose(balances, mouvements, 1, "2026-03-15")).toBe(920_000);
  });

  it("④ la séquence entière ne compte JAMAIS deux fois le même euro", () => {
    // Contre-épreuve globale : on rejoue la vie du compte point par point et on
    // vérifie qu'aucune date ne surcompte.
    const balances = [releve(1, "2026-02-01", 500_000), releve(1, "2026-03-01", 800_000)];
    const { mouvements } = mouvementsDeTresorerie([f], [p], [c]);

    expect(soldeCompose(balances, mouvements, 1, "2026-02-01")).toBe(500_000); // le jour du relevé
    expect(soldeCompose(balances, mouvements, 1, "2026-03-01")).toBe(800_000); // le nouveau relevé
    expect(soldeCompose(balances, mouvements, 1, "2026-06-01")).toBe(800_000); // bien plus tard

    // Le 14 février est INTERPOLÉ : 500 000 + 300 000 × 13/28 = 639 286. Ce qui
    // compte n'est pas ce chiffre exact — c'est qu'il ne porte PAS le paiement
    // une seconde fois. La borne haute est le repère qui a du sens.
    const interpole = soldeCompose(balances, mouvements, 1, "2026-02-14") as number;
    expect(interpole).toBe(639_286);
    expect(interpole).toBeLessThan(800_000);
  });
});

describe("⭐ la composition ne mord QUE dans la zone d'extrapolation", () => {
  it("entre deux relevés, ce sont les RELEVÉS qui font foi", () => {
    // `soldeInterpole` trace une droite qui contient déjà, au prorata, tout ce
    // qui s'est passé entre les deux. Ajouter le mouvement par-dessus le
    // compterait une seconde fois sur chaque point passé de la courbe.
    const balances = [releve(1, "2026-02-01", 500_000), releve(1, "2026-03-01", 800_000)];
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-02-15" })],
      [compte({ id: 1 })],
    );

    // Le 15 février tombe pile au milieu : la droite donne ~650 000, et surtout
    // PAS 650 000 + 300 000.
    const v = soldeCompose(balances, mouvements, 1, "2026-02-15") as number;
    expect(v).toBeGreaterThan(600_000);
    expect(v).toBeLessThan(700_000);
  });

  it("un mouvement daté LE JOUR MÊME du dernier relevé est absorbé", () => {
    // Borne basse stricte : ce jour-là, c'est le chiffre de la banque qui fait
    // foi, et il contient déjà le virement.
    const balances = [releve(1, "2026-03-01", 800_000)];
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-03-01" })],
      [compte({ id: 1 })],
    );
    expect(soldeCompose(balances, mouvements, 1, "2026-03-10")).toBe(800_000);
  });

  it("un mouvement postérieur à la date ÉVALUÉE n'est pas encore arrivé", () => {
    const balances = [releve(1, "2026-02-01", 500_000)];
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, date: "2026-02-20" })],
      [compte({ id: 1 })],
    );
    expect(soldeCompose(balances, mouvements, 1, "2026-02-10")).toBe(500_000);
  });

  it("⚠️ un compte JAMAIS relevé reste `null`, encaissement ou pas", () => {
    // `null + 300 €` n'est pas « 300 € » : c'est toujours « on ne sait pas ».
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1 })],
      [compte({ id: 1 })],
    );
    expect(soldeCompose([], mouvements, 1, "2026-03-01")).toBeNull();
  });

  it("sans mouvement, le résultat est celui d'avant ce chantier", () => {
    const balances = [releve(1, "2026-02-01", 500_000)];
    expect(soldeCompose(balances, [], 1, "2026-03-01")).toBe(500_000);
  });
});

describe("des paiements aux mouvements", () => {
  it("une VENTE fait monter le solde, un ACHAT le fait descendre", () => {
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1, sens: "vente" }), facture({ id: 2, sens: "achat" })],
      [
        paiement({ id: 1, invoice_id: 1, montant_cents: 300_000 }),
        paiement({ id: 2, invoice_id: 2, montant_cents: 80_000 }),
      ],
      [compte({ id: 1 })],
    );
    expect(mouvements.map((m) => m.cents)).toEqual([300_000, -80_000]);
  });

  it("⚠️ un paiement SANS COMPTE n'entre nulle part, et se compte à part", () => {
    // L'utilisateur n'a pas dit où l'argent est arrivé : l'affecter au premier
    // compte liquide produirait un patrimoine faux.
    const r = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, account_id: null })],
      [compte({ id: 1 })],
    );
    expect(r.mouvements).toEqual([]);
    expect(r.sansCompte).toBe(1);
  });

  it("⭐ un paiement en devise SANS TAUX est écarté et SIGNALÉ", () => {
    // Un montant dont on ignore la valeur ne doit pas se fondre dans un total :
    // il doit se voir.
    const r = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, devise: "USD", taux_change_e8: null })],
      [compte({ id: 1, currency: "EUR" })],
    );
    expect(r.mouvements).toEqual([]);
    expect(r.sansTaux).toEqual([{ invoiceId: 1, paymentId: 1 }]);
  });

  it("convertit avec le taux FIGÉ du paiement, vers la devise du compte", () => {
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 })],
      [paiement({ id: 1, montant_cents: 100_000, devise: "USD", taux_change_e8: 92_000_000 })],
      [compte({ id: 1, currency: "EUR" })],
    );
    expect(mouvements[0].cents).toBe(92_000);
  });

  it("ignore un paiement dont la facture n'est pas encore arrivée", () => {
    // Se tromper de signe ferait bouger le solde du double, dans le mauvais sens.
    const r = mouvementsDeTresorerie([], [paiement({ id: 1 })], [compte({ id: 1 })]);
    expect(r.mouvements).toEqual([]);
  });

  it("ignore un paiement porté par un DEVIS", () => {
    const r = mouvementsDeTresorerie(
      [facture({ id: 1, type: "devis" })],
      [paiement({ id: 1 })],
      [compte({ id: 1 })],
    );
    expect(r.mouvements).toEqual([]);
  });

  it("⚠️ un paiement sur une facture ANNULÉE compte quand même", () => {
    // L'argent a bougé. L'annulation dit que la créance n'est plus due, pas que
    // le virement n'a pas eu lieu.
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1, statut: "annulee" })],
      [paiement({ id: 1 })],
      [compte({ id: 1 })],
    );
    expect(mouvements).toHaveLength(1);
  });
});

describe("la fenêtre, isolément", () => {
  const m = [
    { accountId: 1, date: "2026-02-10", cents: 100, invoiceId: 1 },
    { accountId: 1, date: "2026-02-20", cents: 200, invoiceId: 2 },
    { accountId: 2, date: "2026-02-20", cents: 900, invoiceId: 3 },
  ];

  it("exclut la borne basse, inclut la haute, et ne mélange pas les comptes", () => {
    expect(mouvementsDansFenetre(m, 1, "2026-02-10", "2026-02-20")).toBe(200);
    expect(mouvementsDansFenetre(m, 1, "2026-02-01", "2026-02-20")).toBe(300);
    expect(mouvementsDansFenetre(m, 2, "2026-02-01", "2026-02-28")).toBe(900);
  });

  it("rend 0 quand aucun relevé n'existe", () => {
    expect(mouvementsDansFenetre(m, 1, null, "2026-12-31")).toBe(0);
  });
});

describe("le patrimoine complet compose par COMPTE", () => {
  it("chaque compte reçoit ses propres mouvements", () => {
    const comptes = [compte({ id: 1 }), compte({ id: 2, label: "Épargne", is_liquid: 0 })];
    const balances = [releve(1, "2026-02-01", 500_000), releve(2, "2026-02-01", 1_000_000)];
    const { mouvements } = mouvementsDeTresorerie(
      [facture({ id: 1 }), facture({ id: 2 })],
      [
        paiement({ id: 1, invoice_id: 1, account_id: 1, montant_cents: 300_000 }),
        paiement({ id: 2, invoice_id: 2, account_id: 2, montant_cents: 50_000 }),
      ],
      comptes,
    );

    const p = patrimoineAu(comptes, balances, "2026-02-20", undefined, mouvements);
    expect(p.totalCents).toBe(1_850_000);
    // Seul le compte liquide alimente le runway : 500 000 + 300 000.
    expect(p.liquideCents).toBe(800_000);
  });

  it("sans mouvement, `patrimoineAu` rend exactement ce qu'il rendait avant", () => {
    const comptes = [compte({ id: 1 })];
    const balances = [releve(1, "2026-02-01", 500_000)];
    expect(patrimoineAu(comptes, balances, "2026-03-01")).toEqual(
      patrimoineAu(comptes, balances, "2026-03-01", undefined, []),
    );
  });
});
