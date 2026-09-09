import { describe, expect, it } from "vitest";

import type { Invoice } from "../../types";
import { collisionsNumeros, compteursEnRetard } from "./collisions";

function facture(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: null,
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

describe("détection des numéros en double", () => {
  it("ne dit rien quand tout est unique", () => {
    expect(
      collisionsNumeros([
        facture({ id: 1, numero: "F-2026-0001" }),
        facture({ id: 2, numero: "F-2026-0002" }),
      ]),
    ).toEqual([]);
  });

  it("⭐ trouve le doublon né de deux appareils hors ligne", () => {
    const c = collisionsNumeros([
      facture({ id: 1, numero: "F-2026-0007", date_emission: "2026-08-03" }),
      facture({ id: 2, numero: "F-2026-0007", date_emission: "2026-08-05" }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].numero).toBe("F-2026-0007");
    expect(c[0].factures.map((f) => f.id)).toEqual([1, 2]);
  });

  it("suggère de garder la PLUS ANCIENNE — la plus susceptible d'être partie", () => {
    const c = collisionsNumeros([
      facture({ id: 2, numero: "F-2026-0007", date_emission: "2026-08-05" }),
      facture({ id: 1, numero: "F-2026-0007", date_emission: "2026-08-03" }),
    ]);
    expect(c[0].gardeeSuggeree.id).toBe(1);
  });

  it("départage à date d'émission égale par la date de création", () => {
    const c = collisionsNumeros([
      facture({
        id: 2,
        numero: "F-2026-0007",
        date_emission: "2026-08-03",
        created_at: "2026-08-03T14:00:00",
      }),
      facture({
        id: 1,
        numero: "F-2026-0007",
        date_emission: "2026-08-03",
        created_at: "2026-08-03T09:00:00",
      }),
    ]);
    expect(c[0].gardeeSuggeree.id).toBe(1);
  });

  it("⚠️ deux BROUILLONS ne sont pas un doublon — ils n'ont pas de numéro", () => {
    expect(
      collisionsNumeros([
        facture({ id: 1, numero: null, statut: "brouillon" }),
        facture({ id: 2, numero: null, statut: "brouillon" }),
        facture({ id: 3, numero: "", statut: "brouillon" }),
      ]),
    ).toEqual([]);
  });

  it("⚠️ deux SÉRIES différentes ont le droit au même numéro", () => {
    // Le cas nominal d'un devis et d'une facture la première année.
    expect(
      collisionsNumeros([
        facture({ id: 1, numero: "0001", serie_id: 1 }),
        facture({ id: 2, numero: "0001", serie_id: 2 }),
      ]),
    ).toEqual([]);
  });

  it("compare par numéro seul les factures sans série", () => {
    const c = collisionsNumeros([
      facture({ id: 1, numero: "0001", serie_id: null }),
      facture({ id: 2, numero: "0001", serie_id: null }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].serieId).toBeNull();
  });

  it("retombe sur created_at quand la date d'émission manque", () => {
    const c = collisionsNumeros([
      facture({
        id: 2,
        numero: "F-1",
        date_emission: null,
        created_at: "2026-08-09T09:00:00",
      }),
      facture({
        id: 1,
        numero: "F-1",
        date_emission: null,
        created_at: "2026-08-02T09:00:00",
      }),
    ]);
    expect(c[0].gardeeSuggeree.id).toBe(1);
  });

  it("trois factures sur le même numéro forment UNE collision de trois", () => {
    const c = collisionsNumeros([
      facture({ id: 1, numero: "F-9", date_emission: "2026-08-01" }),
      facture({ id: 2, numero: "F-9", date_emission: "2026-08-02" }),
      facture({ id: 3, numero: "F-9", date_emission: "2026-08-03" }),
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].factures).toHaveLength(3);
  });
});

describe("compteur de série en retard sur ce qu'elle a produit", () => {
  it("ne dit rien quand le compteur est devant", () => {
    expect(
      compteursEnRetard(
        [{ id: 1, prochain: 8 }],
        [facture({ id: 1, numero: "F-2026-0007", serie_id: 1 })],
      ),
    ).toEqual([]);
  });

  it("⭐ signale un compteur écrasé par le LWW", () => {
    const r = compteursEnRetard(
      [{ id: 1, prochain: 4 }],
      [
        facture({ id: 1, numero: "F-2026-0007", serie_id: 1 }),
        facture({ id: 2, numero: "F-2026-0003", serie_id: 1 }),
      ],
    );
    expect(r).toEqual([{ serieId: 1, prochain: 4, observe: 7 }]);
  });

  it("⚠️ lit le DERNIER groupe de chiffres, pas l'année", () => {
    // « F-2026-0007 » → 7. Prendre le premier donnerait 2026, tous les
    // compteurs paraîtraient en retard pour toujours.
    const r = compteursEnRetard(
      [{ id: 1, prochain: 8 }],
      [facture({ id: 1, numero: "F-2026-0007", serie_id: 1 })],
    );
    expect(r).toEqual([]);
  });

  it("signale l'égalité — émettre maintenant produirait un numéro déjà utilisé", () => {
    const r = compteursEnRetard(
      [{ id: 1, prochain: 7 }],
      [facture({ id: 1, numero: "F-2026-0007", serie_id: 1 })],
    );
    expect(r).toHaveLength(1);
  });

  it("ignore un numéro sans chiffre et les brouillons", () => {
    expect(
      compteursEnRetard(
        [{ id: 1, prochain: 1 }],
        [
          facture({ id: 1, numero: "PROFORMA", serie_id: 1 }),
          facture({ id: 2, numero: null, serie_id: 1 }),
        ],
      ),
    ).toEqual([]);
  });
});
