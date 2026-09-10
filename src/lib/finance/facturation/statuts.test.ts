import { describe, expect, it } from "vitest";

import type { Invoice, InvoicePayment } from "../../types";
import { etatFacture, refusPaiement, resteDuCents, statutCalcule } from "./statuts";

function facture(p: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: "F-2026-0001",
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

function paiement(montantCents: number, date = "2026-08-15"): InvoicePayment {
  return {
    id: 1,
    invoice_id: 1,
    date,
    montant_cents: montantCents,
    devise: "EUR",
    taux_change_e8: null,
    account_id: 1,
    moyen: "virement",
    note: null,
    created_at: `${date}T10:00:00`,
  };
}

describe("reste dû", () => {
  it("retranche les encaissements du total", () => {
    expect(resteDuCents(facture(), [paiement(30_000), paiement(20_000)])).toBe(50_000);
  });

  it("⭐ reste SIGNÉ sur un trop-perçu — le ramener à zéro cacherait une dette", () => {
    expect(resteDuCents(facture(), [paiement(110_000)])).toBe(-10_000);
  });

  it("un montant négatif (impayé, remboursement) rouvre le reste dû", () => {
    expect(resteDuCents(facture(), [paiement(100_000), paiement(-100_000)])).toBe(100_000);
  });
});

describe("le statut se recalcule d'après les paiements", () => {
  it("émise sans paiement reste émise", () => {
    expect(statutCalcule(facture(), [])).toBe("emise");
  });

  it("un paiement partiel fait passer en partiellement encaissée", () => {
    expect(statutCalcule(facture(), [paiement(40_000)])).toBe("partiellement_encaissee");
  });

  it("le solde fait passer en encaissée", () => {
    expect(statutCalcule(facture(), [paiement(40_000), paiement(60_000)])).toBe("encaissee");
  });

  it("⭐ un TROP-PERÇU solde la facture (reste <= 0, pas === 0)", () => {
    // Avec une égalité stricte, une facture surpayée serait restée
    // « partiellement encaissée » pour toujours.
    expect(statutCalcule(facture(), [paiement(110_000)])).toBe("encaissee");
  });

  it("⭐⭐ un AVOIR non remboursé n'est PAS « encaissé » — trouvé à l'écran", () => {
    // Un avoir porte un total NÉGATIF. Avec un seuil fixe `reste <= 0`, il
    // passait « encaissé » d'emblée, alors que personne n'avait rien versé.
    // Un document est soldé quand son reste a atteint zéro EN VENANT DU CÔTÉ
    // de son total.
    const avoir = facture({ type: "avoir", total_ttc_cents: -150_000 });
    expect(statutCalcule(avoir, [])).toBe("emise");

    // Remboursé pour moitié : partiellement.
    expect(statutCalcule(avoir, [paiement(-70_000)])).toBe("partiellement_encaissee");

    // Remboursé en entier : là, il est soldé.
    expect(statutCalcule(avoir, [paiement(-150_000)])).toBe("encaissee");
  });

  it("⭐ un avoir n'est JAMAIS « en retard » — on ne relance pas pour un avoir", () => {
    // Il garde son reste dû signé (il réduit l'encours, c'est son rôle), mais
    // le retard sert à décider s'il faut relancer un client, et un avoir est de
    // l'argent qui part. Vu à l'écran : « En retard de 58 jours » sur un avoir.
    const avoir = facture({ type: "avoir", total_ttc_cents: -150_000 });
    const e = etatFacture(avoir, [], "2026-09-09");
    expect(e.resteDuCents).toBe(-150_000);
    expect(e.enRetard).toBe(false);
    expect(e.aEchoir).toBe(false);
  });

  it("un document à total NUL reste émis, il n'est pas « encaissé »", () => {
    expect(statutCalcule(facture({ total_ttc_cents: 0 }), [])).toBe("emise");
  });

  it("⚠️ un brouillon reste un brouillon, même payé", () => {
    expect(statutCalcule(facture({ statut: "brouillon" }), [paiement(100_000)])).toBe(
      "brouillon",
    );
  });

  it("⚠️ une facture ANNULÉE reste annulée, même payée", () => {
    // C'est une décision, pas une conséquence. L'app ne réécrit pas l'histoire
    // de l'utilisateur pour la rendre cohérente.
    expect(statutCalcule(facture({ statut: "annulee" }), [paiement(100_000)])).toBe("annulee");
  });
});

describe("⭐ `en_retard` se CALCULE, il n'est jamais stocké", () => {
  it("émise + échéance dépassée + reste dû ⇒ en retard, avec ses jours", () => {
    const e = etatFacture(facture(), [], "2026-09-09");
    expect(e.enRetard).toBe(true);
    expect(e.joursRetard).toBe(9); // du 31 août au 9 septembre
    expect(e.aEchoir).toBe(false);
  });

  it("le MÊME objet n'est pas en retard la veille de l'échéance", () => {
    // La preuve que rien n'est stocké : seule la date injectée change.
    const e = etatFacture(facture(), [], "2026-08-30");
    expect(e.enRetard).toBe(false);
    expect(e.aEchoir).toBe(true);
    expect(e.joursRetard).toBe(0);
  });

  it("le jour même de l'échéance n'est PAS en retard", () => {
    expect(etatFacture(facture(), [], "2026-08-31").enRetard).toBe(false);
  });

  it("une facture soldée n'est jamais en retard, même échue", () => {
    const e = etatFacture(facture(), [paiement(100_000)], "2026-09-09");
    expect(e.enRetard).toBe(false);
    expect(e.statut).toBe("encaissee");
  });

  it("partiellement encaissée et échue EST en retard", () => {
    const e = etatFacture(facture(), [paiement(40_000)], "2026-09-09");
    expect(e.enRetard).toBe(true);
    expect(e.resteDuCents).toBe(60_000);
  });

  it("⚠️ un DEVIS n'est JAMAIS en retard — un devis n'est pas dû", () => {
    const e = etatFacture(facture({ type: "devis" }), [], "2026-09-09");
    expect(e.enRetard).toBe(false);
    expect(e.aEchoir).toBe(false);
  });

  it("un brouillon échu n'est pas en retard", () => {
    expect(etatFacture(facture({ statut: "brouillon" }), [], "2026-09-09").enRetard).toBe(false);
  });

  it("une facture sans échéance n'est pas en retard", () => {
    expect(etatFacture(facture({ date_echeance: null }), [], "2026-09-09").enRetard).toBe(false);
  });
});

describe("ce qui fait refuser un encaissement", () => {
  it("laisse passer un paiement normal", () => {
    expect(
      refusPaiement(facture(), [], { montantCents: 40_000, date: "2026-09-09" }),
    ).toBeNull();
  });

  it("laisse passer le solde exact", () => {
    expect(
      refusPaiement(facture(), [paiement(40_000)], {
        montantCents: 60_000,
        date: "2026-09-09",
      }),
    ).toBeNull();
  });

  it("⭐ REFUSE un montant supérieur au reste dû, et dit combien il restait", () => {
    // Dans neuf cas sur dix c'est un zéro de trop. L'accepter en silence
    // ferait apparaître un trop-perçu dans les créances, donc dans le runway.
    const r = refusPaiement(facture(), [paiement(40_000)], {
      montantCents: 600_000,
      date: "2026-09-09",
    });
    expect(r?.code).toBe("trop-percu");
    expect(r?.resteDuCents).toBe(60_000);
  });

  it("⭐ accepte TOUJOURS un montant négatif — un impayé doit pouvoir se saisir", () => {
    expect(
      refusPaiement(facture(), [paiement(100_000)], {
        montantCents: -100_000,
        date: "2026-09-20",
      }),
    ).toBeNull();
  });

  it("refuse d'encaisser un brouillon", () => {
    expect(
      refusPaiement(facture({ statut: "brouillon" }), [], {
        montantCents: 1000,
        date: "2026-09-09",
      })?.code,
    ).toBe("sur-brouillon");
  });

  it("refuse un montant nul et une date manquante", () => {
    expect(
      refusPaiement(facture(), [], { montantCents: 0, date: "2026-09-09" })?.code,
    ).toBe("montant-nul");
    expect(refusPaiement(facture(), [], { montantCents: 100, date: "" })?.code).toBe(
      "date-manquante",
    );
  });
});
