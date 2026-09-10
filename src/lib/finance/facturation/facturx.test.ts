import { describe, expect, it } from "vitest";

import type { Invoice, InvoiceIssuer, InvoiceLine, InvoiceParty } from "../../types";
import { documentImprimable, manquesLegaux } from "./document";
import {
  categorieTva,
  codeTypeDocument,
  dateXml,
  echapperXml,
  facturxXml,
  montantXml,
  quantiteXml,
  tauxXml,
} from "./facturx";

const EMETTEUR: InvoiceIssuer = {
  id: 1,
  denomination: "Studio Meridian",
  forme_juridique: "Entreprise individuelle",
  capital_cents: null,
  adresse: "14 rue des Ateliers",
  code_postal: "75011",
  ville: "Paris",
  pays: "France",
  siren: "109198879",
  siret: "10919887900012",
  rcs: null,
  ape: "6201Z",
  tva_intra: null,
  iban: "FR76 0000",
  bic: null,
  logo: null,
  regime: "franchise_en_base",
  mentions_defaut: null,
  penalites_retard: "Pénalités : 3 fois le taux légal.",
  indemnite_forfaitaire_cents: 4000,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
};

const CLIENT: InvoiceParty = {
  id: 1,
  nom: "Groupe Vallée & Fils",
  role: "client",
  adresse: "12 avenue Carnot",
  code_postal: "69003",
  ville: "Lyon",
  pays: "France",
  siren: "812345678",
  siret: "81234567800012",
  tva_intra: "FR12812345678",
  email: null,
  telephone: null,
  devise: "EUR",
  notes: null,
  archived: 0,
  created_at: "2026-01-01T00:00:00",
  updated_at: "2026-01-01T00:00:00",
};

function facture(p: Partial<Invoice> = {}): Invoice {
  return {
    id: 1,
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: "F-2026-0001",
    serie_id: 1,
    party_id: 1,
    date_emission: "2026-09-01",
    date_echeance: "2026-10-01",
    conditions_paiement: "30 jours",
    devise: "EUR",
    taux_change_e8: null,
    total_ht_cents: 420_000,
    total_tva_cents: 0,
    total_ttc_cents: 420_000,
    mentions: null,
    emetteur_fige: null,
    objet: "Refonte",
    note: null,
    avoir_de_id: null,
    devis_origine_id: null,
    created_at: "2026-09-01T09:00:00",
    updated_at: "2026-09-01T09:00:00",
    ...p,
  };
}

function ligne(p: Partial<InvoiceLine> = {}): InvoiceLine {
  return {
    id: 1,
    invoice_id: 1,
    position: 0,
    description: "Conception",
    unite: null,
    quantite_e8: 100_000_000,
    prix_unitaire_cents: 420_000,
    taux_tva_e4: 0,
    remise_cents: 0,
    total_ht_cents: 420_000,
    created_at: "",
    ...p,
  };
}

describe("les conversions vers XML", () => {
  it("écrit les montants sans jamais passer par un flottant", () => {
    expect(montantXml(420_000)).toBe("4200.00");
    expect(montantXml(5)).toBe("0.05");
    expect(montantXml(-150_000)).toBe("-1500.00");
    expect(montantXml(0)).toBe("0.00");
  });

  it("écrit les quantités sans zéros parasites", () => {
    expect(quantiteXml(100_000_000)).toBe("1");
    expect(quantiteXml(750_000_000)).toBe("7.5");
    expect(quantiteXml(33_333_333)).toBe("0.3333");
  });

  it("écrit les taux et les dates au format de la norme", () => {
    expect(tauxXml(2000)).toBe("20.00");
    expect(tauxXml(550)).toBe("5.50");
    expect(dateXml("2026-09-01")).toBe("20260901");
  });

  it("⚠️ échappe les caractères qui casseraient le document", () => {
    // « Dupont & Fils » suffit à produire un XML invalide.
    expect(echapperXml("Dupont & Fils")).toBe("Dupont &amp; Fils");
    expect(echapperXml('<a href="x">')).toBe("&lt;a href=&quot;x&quot;&gt;");
  });
});

describe("⚠️ le code de type — 380 n'est PAS 381", () => {
  it("distingue une facture d'un avoir", () => {
    // Se tromper fait entrer un avoir comme une facture dans la comptabilité
    // du client. Une machine ne rattrape pas ça.
    expect(codeTypeDocument("facture")).toBe("380");
    expect(codeTypeDocument("avoir")).toBe("381");
  });

  it("un devis n'a pas de code — il ne s'exporte pas", () => {
    expect(codeTypeDocument("devis")).toBeNull();
  });
});

describe("⭐ la catégorie de TVA en franchise en base", () => {
  it("la franchise est une EXONÉRATION, pas un taux à zéro", () => {
    expect(categorieTva(true, 0)).toBe("E");
    expect(categorieTva(true, 2000)).toBe("E");
  });

  it("hors franchise, un taux positif est « S » et zéro est « Z »", () => {
    expect(categorieTva(false, 2000)).toBe("S");
    expect(categorieTva(false, 0)).toBe("Z");
  });
});

describe("le XML produit", () => {
  const xml = facturxXml(facture(), [ligne()], CLIENT, EMETTEUR) as string;

  it("est produit et déclare le profil BASIC", () => {
    expect(xml).toContain("urn:factur-x.eu:1p0:basic");
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("porte le numéro, le type et la date", () => {
    expect(xml).toContain("<ram:ID>F-2026-0001</ram:ID>");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
    expect(xml).toContain('format="102">20260901<');
  });

  it("⭐ porte la RAISON D'EXONÉRATION — sans elle, un validateur rejette", () => {
    expect(xml).toContain("<ram:ExemptionReason>TVA non applicable, art. 293 B du CGI");
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
  });

  it("porte les deux parties et leurs identifiants", () => {
    expect(xml).toContain("Studio Meridian");
    expect(xml).toContain('schemeID="0009">10919887900012');
    expect(xml).toContain('schemeID="VA">FR12812345678');
  });

  it("⚠️ échappe la raison sociale du client", () => {
    expect(xml).toContain("Groupe Vallée &amp; Fils");
    expect(xml).not.toContain("Vallée & Fils<");
  });

  it("porte des totaux cohérents avec les lignes", () => {
    expect(xml).toContain("<ram:GrandTotalAmount>4200.00</ram:GrandTotalAmount>");
    expect(xml).toContain("<ram:LineTotalAmount>4200.00</ram:LineTotalAmount>");
    expect(xml).toContain("<ram:TaxTotalAmount currencyID=\"EUR\">0.00</ram:TaxTotalAmount>");
  });

  it("⭐ ventile PAR TAUX, comme le PDF — les deux sortent de `totauxFacture`", () => {
    const avecTva = facturxXml(
      facture(),
      [
        ligne({ id: 1, taux_tva_e4: 2000, prix_unitaire_cents: 10_000, total_ht_cents: 10_000 }),
        ligne({ id: 2, taux_tva_e4: 550, prix_unitaire_cents: 5000, total_ht_cents: 5000 }),
      ],
      CLIENT,
      { ...EMETTEUR, regime: "assujetti" },
    ) as string;

    expect(avecTva).toContain("<ram:RateApplicablePercent>20.00");
    expect(avecTva).toContain("<ram:RateApplicablePercent>5.50");
    // 10 000 × 20 % = 2 000 ; 5 000 × 5,5 % = 275 ; total 2 275.
    expect(avecTva).toContain("<ram:TaxTotalAmount currencyID=\"EUR\">22.75");
  });

  it("un AVOIR sort en 381 avec des montants négatifs", () => {
    const x = facturxXml(
      facture({ type: "avoir", numero: "AV-2026-0001" }),
      [ligne({ prix_unitaire_cents: -150_000, total_ht_cents: -150_000 })],
      CLIENT,
      EMETTEUR,
    ) as string;
    expect(x).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(x).toContain("<ram:GrandTotalAmount>-1500.00</ram:GrandTotalAmount>");
  });

  it("⚠️ un DEVIS, un ACHAT et un brouillon ne s'exportent PAS", () => {
    expect(facturxXml(facture({ type: "devis" }), [ligne()], CLIENT, EMETTEUR)).toBeNull();
    expect(facturxXml(facture({ sens: "achat" }), [ligne()], CLIENT, EMETTEUR)).toBeNull();
    expect(facturxXml(facture({ numero: null }), [ligne()], CLIENT, EMETTEUR)).toBeNull();
  });

  it("⭐ utilise l'émetteur FIGÉ, pas l'émetteur courant", () => {
    // Un document émis en 2026 doit se réimprimer avec l'adresse de 2026.
    const fige = JSON.stringify({ ...EMETTEUR, denomination: "Ancien nom" });
    const x = facturxXml(
      facture({ emetteur_fige: fige }),
      [ligne()],
      CLIENT,
      { ...EMETTEUR, denomination: "Nouveau nom" },
    ) as string;
    expect(x).toContain("Ancien nom");
    expect(x).not.toContain("Nouveau nom");
  });
});

describe("le document imprimable", () => {
  it("porte la mention de franchise EN PREMIER", () => {
    const d = documentImprimable(facture(), [ligne()], CLIENT, EMETTEUR);
    expect(d.mentions[0]).toBe("TVA non applicable, art. 293 B du CGI");
    expect(d.franchise).toBe(true);
  });

  it("porte l'indemnité forfaitaire de 40 € sur une facture de vente", () => {
    const d = documentImprimable(facture(), [ligne()], CLIENT, EMETTEUR);
    expect(d.mentions.some((m) => m.includes("Indemnité forfaitaire"))).toBe(true);
    expect(d.mentions.some((m) => m.includes("40,00"))).toBe(true);
  });

  it("⚠️ pas d'indemnité sur un DEVIS — rien n'est dû", () => {
    const d = documentImprimable(facture({ type: "devis" }), [ligne()], CLIENT, EMETTEUR);
    expect(d.mentions.some((m) => m.includes("Indemnité"))).toBe(false);
    expect(d.titre).toBe("Devis");
  });

  it("n'affiche aucun taux en franchise", () => {
    const d = documentImprimable(facture(), [ligne()], CLIENT, EMETTEUR);
    expect(d.lignes[0].taux).toBe("");
  });

  it("⭐ retombe sur l'émetteur courant si l'instantané est ABÎMÉ", () => {
    // Perdre la facture entière pour un JSON corrompu serait disproportionné.
    const d = documentImprimable(
      facture({ emetteur_fige: "{ceci n'est pas du JSON" }),
      [ligne()],
      CLIENT,
      EMETTEUR,
    );
    expect(d.emetteur.nom).toBe("Studio Meridian");
  });
});

describe("⭐ ce qui rend un document IRRÉGULIER", () => {
  it("ne dit rien quand tout est là", () => {
    expect(manquesLegaux(facture(), [ligne()], CLIENT, EMETTEUR)).toEqual([]);
  });

  it("signale un émetteur sans SIRET ni SIREN", () => {
    const m = manquesLegaux(facture(), [ligne()], CLIENT, {
      ...EMETTEUR,
      siret: null,
      siren: null,
    });
    expect(m.some((x) => x.includes("SIRET"))).toBe(true);
  });

  it("signale l'absence de client, d'adresse, de numéro", () => {
    expect(manquesLegaux(facture(), [ligne()], null, EMETTEUR).length).toBeGreaterThan(0);
    expect(
      manquesLegaux(facture({ numero: null }), [ligne()], CLIENT, EMETTEUR).some((x) =>
        x.includes("numéro"),
      ),
    ).toBe(true);
  });

  it("⚠️ un DEVIS n'a pas d'obligation de numéro", () => {
    expect(
      manquesLegaux(facture({ type: "devis", numero: null }), [ligne()], CLIENT, EMETTEUR),
    ).toEqual([]);
  });

  it("⚠️ un ACHAT n'est pas MON document : rien à garantir", () => {
    expect(manquesLegaux(facture({ sens: "achat", numero: null }), [], null, null)).toEqual([]);
  });
});
