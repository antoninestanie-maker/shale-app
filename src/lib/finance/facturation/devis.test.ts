import { describe, expect, it } from "vitest";

import type { Invoice, InvoiceLine } from "../../types";
import { devisDeLaFacture, factureDepuisDevis, factureDuDevis } from "./devis";

function doc(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "devis",
    sens: "vente",
    statut: "emise",
    numero: "D-2026-0001",
    serie_id: 3,
    party_id: 7,
    date_emission: "2026-07-01",
    date_echeance: null,
    conditions_paiement: "30 jours",
    devise: "EUR",
    taux_change_e8: null,
    total_ht_cents: 540_000,
    total_tva_cents: 0,
    total_ttc_cents: 540_000,
    mentions: "TVA non applicable, art. 293 B du CGI",
    emetteur_fige: null,
    objet: "Refonte de l'identité",
    note: "Négocié à la baisse",
    avoir_de_id: null,
    devis_origine_id: null,
    created_at: "2026-07-01T09:00:00",
    updated_at: "2026-07-01T09:00:00",
    ...p,
  };
}

function ligne(p: Partial<InvoiceLine> & { id: number }): InvoiceLine {
  return {
    invoice_id: 1,
    position: 0,
    description: "Refonte",
    unite: null,
    quantite_e8: 100_000_000,
    prix_unitaire_cents: 540_000,
    taux_tva_e4: 0,
    remise_cents: 0,
    total_ht_cents: 540_000,
    created_at: "",
    ...p,
  };
}

describe("⭐ un devis accepté CRÉE une facture, il ne se transforme pas", () => {
  const devis = doc({ id: 1 });
  const lignes = [ligne({ id: 1 })];

  it("produit une facture de vente qui CITE le devis", () => {
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10");
    expect(r?.entree.type).toBe("facture");
    expect(r?.entree.sens).toBe("vente");
    expect(r?.entree.devis_origine_id).toBe(1);
  });

  it("⚠️ prend la série des FACTURES, pas celle du devis", () => {
    // Le devis a sa propre suite ; mélanger les deux casserait les deux.
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10");
    expect(r?.entree.serie_id).toBe(1);
    expect(devis.serie_id).toBe(3);
  });

  it("⚠️ la date d'émission est CELLE DU JOUR, jamais celle du devis", () => {
    // Une facture datée du jour du devis serait antidatée de plusieurs
    // semaines, avec un numéro attribué aujourd'hui.
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10");
    expect(r?.entree.date_emission).toBe("2026-09-10");
  });

  it("⚠️ ne reprend PAS le taux de change du devis", () => {
    // Il était figé à la date du devis : le reprendre ferait facturer à un
    // cours périmé de plusieurs semaines.
    const enDevise = doc({ id: 1, devise: "USD", taux_change_e8: 92_000_000 });
    const r = factureDepuisDevis(enDevise, lignes, 1, "2026-09-10");
    expect(r?.entree.devise).toBe("USD");
    expect(r?.entree.taux_change_e8).toBeNull();
  });

  it("⭐ RECOPIE les lignes — modifier la facture ne réécrit pas le devis", () => {
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10");
    expect(r?.lignes).toHaveLength(1);
    expect(r?.lignes[0].total_ht_cents).toBe(540_000);
    // Ce sont de NOUVELLES lignes : elles ne portent ni id ni invoice_id.
    expect(r?.lignes[0]).not.toHaveProperty("id");
    expect(r?.lignes[0]).not.toHaveProperty("invoice_id");
  });

  it("renumérote les positions à partir de zéro", () => {
    const r = factureDepuisDevis(
      devis,
      [ligne({ id: 2, position: 5 }), ligne({ id: 1, position: 2 })],
      1,
      "2026-09-10",
    );
    expect(r?.lignes.map((l) => l.position)).toEqual([0, 1]);
  });

  it("reprend l'objet, les mentions, les conditions et la note", () => {
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10");
    expect(r?.entree.objet).toBe("Refonte de l'identité");
    expect(r?.entree.conditions_paiement).toBe("30 jours");
    expect(r?.entree.note).toBe("Négocié à la baisse");
    expect(r?.entree.mentions).toContain("293 B");
  });

  it("accepte une échéance donnée à la facturation", () => {
    const r = factureDepuisDevis(devis, lignes, 1, "2026-09-10", "2026-10-10");
    expect(r?.entree.date_echeance).toBe("2026-10-10");
  });

  it("⚠️ refuse ce qui n'est pas un devis émis", () => {
    expect(factureDepuisDevis(doc({ id: 1, type: "facture" }), lignes, 1, "2026-09-10")).toBeNull();
    expect(factureDepuisDevis(doc({ id: 1, statut: "brouillon" }), lignes, 1, "2026-09-10")).toBeNull();
    expect(factureDepuisDevis(doc({ id: 1, statut: "annulee" }), lignes, 1, "2026-09-10")).toBeNull();
  });
});

describe("le lien se lit dans les deux sens", () => {
  const devis = doc({ id: 1 });
  const facture = doc({ id: 2, type: "facture", devis_origine_id: 1 });

  it("⭐ dit si un devis a DÉJÀ produit une facture", () => {
    // Facturer deux fois le même devis est une erreur discrète : les deux
    // factures sont valides séparément, et le client reçoit deux demandes.
    expect(factureDuDevis(1, [devis, facture])?.id).toBe(2);
    expect(factureDuDevis(99, [devis, facture])).toBeNull();
  });

  it("retrouve le devis d'origine d'une facture", () => {
    expect(devisDeLaFacture(facture, [devis, facture])?.id).toBe(1);
    expect(devisDeLaFacture(devis, [devis, facture])).toBeNull();
  });

  it("un devis supprimé ne casse pas la lecture", () => {
    expect(devisDeLaFacture(facture, [facture])).toBeNull();
  });
});
