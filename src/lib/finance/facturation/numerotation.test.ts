import { describe, expect, it } from "vitest";

import type { InvoiceSeries } from "../../types";
import { empechementsEmission, numeroSuivant } from "./numerotation";

function serie(p: Partial<InvoiceSeries> = {}): InvoiceSeries {
  return {
    id: 1,
    code: "F",
    libelle: "Factures",
    format: "{code}-{AAAA}-{NNNN}",
    prochain: 1,
    annee_courante: null,
    remise_a_zero_annuelle: 1,
    created_at: "2026-01-01T00:00:00",
    updated_at: "2026-01-01T00:00:00",
    ...p,
  };
}

describe("le numéro suivant", () => {
  it("applique le gabarit par défaut", () => {
    const r = numeroSuivant(serie({ prochain: 7, annee_courante: 2026 }), "2026-09-09");
    expect(r.numero).toBe("F-2026-0007");
  });

  it("rend l'état SUIVANT du compteur, à écrire dans la même transaction", () => {
    const r = numeroSuivant(serie({ prochain: 7, annee_courante: 2026 }), "2026-09-09");
    expect(r.serie).toEqual({ prochain: 8, annee_courante: 2026 });
  });

  it("complète de zéros selon le NOMBRE de N du gabarit", () => {
    expect(numeroSuivant(serie({ format: "{code}{NN}", prochain: 7 }), "2026-09-09").numero).toBe(
      "F07",
    );
    expect(
      numeroSuivant(serie({ format: "{code}-{NNNNNN}", prochain: 7 }), "2026-09-09").numero,
    ).toBe("F-000007");
  });

  it("ne tronque JAMAIS un compteur plus large que son gabarit", () => {
    // 12 345 dans un {NNNN} : mieux vaut un numéro trop long qu'un numéro faux.
    expect(
      numeroSuivant(serie({ format: "{code}-{NNNN}", prochain: 12_345 }), "2026-09-09").numero,
    ).toBe("F-12345");
  });

  it("connaît l'année sur 4 et sur 2 chiffres, et le mois", () => {
    const r = numeroSuivant(
      serie({ format: "{AA}{MM}-{code}-{NNN}", prochain: 3 }),
      "2026-03-14",
    );
    expect(r.numero).toBe("2603-F-003");
  });

  it("laisse un jeton inconnu TEL QUEL — un numéro amputé ne se voit pas", () => {
    const r = numeroSuivant(serie({ format: "{code}-{XX}-{NNNN}" }), "2026-09-09");
    expect(r.numero).toBe("F-{XX}-0001");
  });
});

describe("la remise à zéro annuelle", () => {
  it("repart à 1 au changement d'année", () => {
    const r = numeroSuivant(serie({ prochain: 42, annee_courante: 2025 }), "2026-01-03");
    expect(r.numero).toBe("F-2026-0001");
    expect(r.serie).toEqual({ prochain: 2, annee_courante: 2026 });
  });

  it("ne repart pas dans la même année", () => {
    const r = numeroSuivant(serie({ prochain: 42, annee_courante: 2026 }), "2026-12-31");
    expect(r.numero).toBe("F-2026-0042");
  });

  it("ne repart pas quand la série ne le demande pas", () => {
    const r = numeroSuivant(
      serie({ prochain: 42, annee_courante: 2025, remise_a_zero_annuelle: 0 }),
      "2026-01-03",
    );
    expect(r.numero).toBe("F-2026-0042");
    expect(r.serie.prochain).toBe(43);
  });

  it("une série jamais utilisée (annee_courante nulle) ne se remet pas à zéro", () => {
    // Elle est déjà à 1 : la remise à zéro n'aurait rien à faire, et la
    // déclencher masquerait un compteur volontairement initialisé plus haut.
    const r = numeroSuivant(serie({ prochain: 5, annee_courante: null }), "2026-09-09");
    expect(r.numero).toBe("F-2026-0005");
  });

  it("⚠️ une facture ANTIDATÉE sur l'année précédente repart à 1", () => {
    // Comportement correct — chaque année a sa propre suite — mais il produit
    // un numéro déjà utilisé si l'année précédente en comptait. C'est
    // `collisions.ts` qui le verra ; on ne devine pas à la place de l'utilisateur.
    const r = numeroSuivant(serie({ prochain: 12, annee_courante: 2026 }), "2025-12-28");
    expect(r.numero).toBe("F-2025-0001");
    expect(r.serie).toEqual({ prochain: 2, annee_courante: 2025 });
  });
});

describe("ce qui empêche d'émettre", () => {
  const complet = {
    statut: "brouillon",
    serieId: 1,
    partyId: 2,
    nbLignes: 1,
    dateEmission: "2026-09-09",
    totalTtcCents: 12_000,
    type: "facture",
  };

  it("ne dit rien quand tout est là", () => {
    expect(empechementsEmission(complet)).toEqual([]);
  });

  it("refuse d'émettre deux fois", () => {
    const e = empechementsEmission({ ...complet, statut: "emise" });
    expect(e.map((x) => x.code)).toEqual(["deja-emise"]);
  });

  it("liste TOUS les manques d'un coup, pas le premier", () => {
    const e = empechementsEmission({
      ...complet,
      serieId: null,
      partyId: null,
      nbLignes: 0,
      dateEmission: null,
    });
    expect(e.map((x) => x.code)).toEqual([
      "sans-serie",
      "sans-client",
      "sans-lignes",
      "sans-date",
    ]);
  });

  it("refuse une facture à zéro", () => {
    const e = empechementsEmission({ ...complet, totalTtcCents: 0 });
    expect(e.map((x) => x.code)).toEqual(["total-nul"]);
  });

  it("accepte un DEVIS à zéro — une offre gracieuse se défend", () => {
    const e = empechementsEmission({ ...complet, totalTtcCents: 0, type: "devis" });
    expect(e).toEqual([]);
  });
});
