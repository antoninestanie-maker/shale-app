import { describe, expect, it } from "vitest";

import type { InvoiceLine } from "../../types";
import {
  MENTION_FRANCHISE,
  formaterTaux,
  totalLigneHtCents,
  totauxFacture,
} from "./totaux";

/** Une ligne de facture, réduite à ce qui compte pour le calcul. */
function ligne(p: Partial<InvoiceLine>): InvoiceLine {
  return {
    id: 1,
    invoice_id: 1,
    position: 0,
    description: "",
    unite: null,
    quantite_e8: 100_000_000, // 1,00000000
    prix_unitaire_cents: 0,
    taux_tva_e4: 0,
    remise_cents: 0,
    total_ht_cents: 0,
    created_at: "2026-09-09T10:00:00",
    ...p,
  };
}

describe("total d'une ligne", () => {
  it("multiplie la quantité par le prix unitaire", () => {
    // 7,5 h × 80,00 € = 600,00 €
    expect(
      totalLigneHtCents(ligne({ quantite_e8: 750_000_000, prix_unitaire_cents: 8000 })),
    ).toBe(60_000);
  });

  it("soustrait la remise APRÈS le produit", () => {
    expect(
      totalLigneHtCents(
        ligne({ quantite_e8: 200_000_000, prix_unitaire_cents: 10_000, remise_cents: 2500 }),
      ),
    ).toBe(17_500);
  });

  it("gère une quantité fractionnaire sans flottant", () => {
    // 0,33333333 j × 900,00 € — le résultat doit être un entier de centimes,
    // pas un nombre à virgule qui traînerait jusqu'au total.
    const t = totalLigneHtCents(
      ligne({ quantite_e8: 33_333_333, prix_unitaire_cents: 90_000 }),
    );
    expect(Number.isInteger(t)).toBe(true);
    expect(t).toBe(30_000);
  });

  it("reste juste au-delà de 2^53 en produit intermédiaire", () => {
    // 100 000 unités × 1 000 000,00 € : le produit brut vaut 1e19, très
    // au-dessus de 2^53. Sans bigint, le chiffre serait faux SANS ERREUR.
    const t = totalLigneHtCents(
      ligne({ quantite_e8: 100_000 * 100_000_000, prix_unitaire_cents: 100_000_000 }),
    );
    expect(t).toBe(10_000_000_000_000);
  });

  it("accepte un montant négatif — un avoir en porte", () => {
    expect(totalLigneHtCents(ligne({ prix_unitaire_cents: -50_000 }))).toBe(-50_000);
  });
});

describe("⭐ la TVA s'arrondit PAR TAUX, jamais par ligne", () => {
  it("dix lignes à 20 % : un seul arrondi, pas dix", () => {
    // Chaque ligne vaut 10,01 € HT. Par ligne : 10,01 × 20 % = 2,002 € → 2,00 €
    // arrondi, × 10 = 20,00 €. Par TAUX : 100,10 € × 20 % = 20,02 €.
    // L'écart de 2 centimes est exactement le défaut que ce fichier interdit.
    const lignes = Array.from({ length: 10 }, () =>
      ligne({ prix_unitaire_cents: 1001, taux_tva_e4: 2000 }),
    );
    const t = totauxFacture(lignes);

    expect(t.totalHtCents).toBe(10_010);
    expect(t.totalTvaCents).toBe(2002); // et NON 2000
    expect(t.totalTtcCents).toBe(12_012);
  });

  it("ventile par taux, trié croissant, un arrondi chacun", () => {
    const t = totauxFacture([
      ligne({ prix_unitaire_cents: 10_000, taux_tva_e4: 2000 }),
      ligne({ prix_unitaire_cents: 5000, taux_tva_e4: 550 }),
      ligne({ prix_unitaire_cents: 3000, taux_tva_e4: 2000 }),
    ]);

    expect(t.ventilation.map((v) => v.tauxE4)).toEqual([550, 2000]);
    expect(t.ventilation[0]).toEqual({ tauxE4: 550, baseHtCents: 5000, tvaCents: 275 });
    expect(t.ventilation[1]).toEqual({ tauxE4: 2000, baseHtCents: 13_000, tvaCents: 2600 });
    expect(t.totalHtCents).toBe(18_000);
    expect(t.totalTvaCents).toBe(2875);
    expect(t.totalTtcCents).toBe(20_875);
  });

  it("un taux à zéro ne produit aucune TVA mais garde sa base", () => {
    const t = totauxFacture([
      ligne({ prix_unitaire_cents: 10_000, taux_tva_e4: 0 }),
      ligne({ prix_unitaire_cents: 10_000, taux_tva_e4: 2000 }),
    ]);
    expect(t.ventilation[0]).toEqual({ tauxE4: 0, baseHtCents: 10_000, tvaCents: 0 });
    expect(t.totalTvaCents).toBe(2000);
  });

  it("⭐ l'avoir s'arrondit symétriquement à la facture qu'il annule", () => {
    // Sans arrondi symétrique (moitiés à l'écart de zéro), annuler une facture
    // laisserait un centime derrière elle — indéfiniment.
    const facture = totauxFacture([ligne({ prix_unitaire_cents: 1005, taux_tva_e4: 2000 })]);
    const avoir = totauxFacture([ligne({ prix_unitaire_cents: -1005, taux_tva_e4: 2000 })]);

    expect(facture.totalTvaCents + avoir.totalTvaCents).toBe(0);
    expect(facture.totalTtcCents + avoir.totalTtcCents).toBe(0);
  });

  it("une facture sans ligne rend des totaux nuls et aucune ventilation", () => {
    const t = totauxFacture([]);
    expect(t).toEqual({
      totalHtCents: 0,
      totalTvaCents: 0,
      totalTtcCents: 0,
      ventilation: [],
    });
  });
});

describe("franchise en base", () => {
  it("écrase les taux saisis à zéro, au lieu de les ignorer", () => {
    // Le résultat ne doit pas laisser croire qu'un taux s'appliquait mais
    // qu'il a été neutralisé : il ne s'applique pas.
    const lignes = [
      ligne({ prix_unitaire_cents: 10_000, taux_tva_e4: 2000 }),
      ligne({ prix_unitaire_cents: 5000, taux_tva_e4: 550 }),
    ];
    const t = totauxFacture(lignes, { franchiseEnBase: true });

    expect(t.totalTvaCents).toBe(0);
    expect(t.totalTtcCents).toBe(t.totalHtCents);
    expect(t.ventilation).toEqual([{ tauxE4: 0, baseHtCents: 15_000, tvaCents: 0 }]);
  });

  it("porte la mention légale exacte de l'article 293 B", () => {
    expect(MENTION_FRANCHISE).toBe("TVA non applicable, art. 293 B du CGI");
  });
});

describe("affichage d'un taux", () => {
  it("rend 20 % sans décimale et 5,5 % avec la sienne", () => {
    expect(formaterTaux(2000, "fr-FR").replace(/ | /g, " ")).toBe("20 %");
    expect(formaterTaux(550, "fr-FR").replace(/ | /g, " ")).toBe("5,5 %");
    expect(formaterTaux(0, "fr-FR").replace(/ | /g, " ")).toBe("0 %");
  });
});
