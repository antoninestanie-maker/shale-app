import { describe, expect, it } from "vitest";

import type { Burn } from "../burn";
import { BURN_VIDE } from "../burn";
import { runway } from "../runway";
import type { Invoice, InvoicePayment } from "../../types";
import {
  comparerRunways,
  echeancesAttendues,
  runwayAvecCreances,
} from "./runway-creances";

/** Un burn de 1 000 €/mois net, deux flux déclarés. */
const BURN: Burn = { entreesCents: 200_000, sortiesCents: 300_000, netCents: 100_000, actifs: 2 };

function facture(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: `F-${p.id}`,
    serie_id: 1,
    party_id: 1,
    date_emission: "2026-08-01",
    date_echeance: "2026-10-01",
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
    created_at: "2026-08-01T09:00:00",
    updated_at: "2026-08-01T09:00:00",
    ...p,
  };
}

function paiement(invoiceId: number, cents: number): InvoicePayment {
  return {
    id: invoiceId * 10,
    invoice_id: invoiceId,
    date: "2026-08-20",
    montant_cents: cents,
    devise: "EUR",
    taux_change_e8: null,
    account_id: 1,
    moyen: null,
    note: null,
    created_at: "2026-08-20T10:00:00",
  };
}

describe("les échéances attendues", () => {
  it("prend le RESTE dû, à sa date d'échéance", () => {
    const e = echeancesAttendues(
      [facture({ id: 1 })],
      [paiement(1, 100_000)],
      "2026-09-09",
    );
    expect(e).toEqual([{ date: "2026-10-01", cents: 200_000, invoiceId: 1 }]);
  });

  it("⚠️ un DEVIS n'entre JAMAIS — un devis n'est pas dû", () => {
    expect(
      echeancesAttendues([facture({ id: 1, type: "devis" })], [], "2026-09-09"),
    ).toEqual([]);
  });

  it("⚠️ une facture SANS ÉCHÉANCE n'entre pas — on ne lui invente pas de date", () => {
    expect(
      echeancesAttendues([facture({ id: 1, date_echeance: null })], [], "2026-09-09"),
    ).toEqual([]);
  });

  it("écarte les brouillons, les annulées et les soldées", () => {
    expect(
      echeancesAttendues(
        [
          facture({ id: 1, statut: "brouillon" }),
          facture({ id: 2, statut: "annulee" }),
          facture({ id: 3 }),
        ],
        [paiement(3, 300_000)],
        "2026-09-09",
      ),
    ).toEqual([]);
  });

  it("⭐ une échéance DÉJÀ PASSÉE entre AUJOURD'HUI, pas dans le passé", () => {
    // La dater dans le passé la ferait entrer avant le départ de la simulation,
    // donc disparaître — alors que ce sont justement les créances en retard qui
    // pèsent le plus.
    const e = echeancesAttendues(
      [facture({ id: 1, date_echeance: "2026-06-01" })],
      [],
      "2026-09-09",
    );
    expect(e[0].date).toBe("2026-09-09");
  });

  it("une dette fournisseur entre en NÉGATIF", () => {
    const e = echeancesAttendues([facture({ id: 1, sens: "achat" })], [], "2026-09-09");
    expect(e[0].cents).toBe(-300_000);
  });

  it("trie par date", () => {
    const e = echeancesAttendues(
      [
        facture({ id: 1, date_echeance: "2026-12-01" }),
        facture({ id: 2, date_echeance: "2026-10-01" }),
      ],
      [],
      "2026-09-09",
    );
    expect(e.map((x) => x.invoiceId)).toEqual([2, 1]);
  });
});

describe("⚠️ les quatre états d'impossibilité sont respectés", () => {
  it("sans-donnees quand aucun compte n'est relevé", () => {
    expect(runwayAvecCreances(null, BURN, [], "2026-09-09").etat).toBe("sans-donnees");
  });

  it("sans-burn quand rien n'est déclaré", () => {
    expect(runwayAvecCreances(500_000, BURN_VIDE, [], "2026-09-09").etat).toBe("sans-burn");
  });

  it("infini quand les revenus récurrents couvrent les charges", () => {
    const couvert: Burn = { ...BURN, netCents: -50_000 };
    expect(runwayAvecCreances(500_000, couvert, [], "2026-09-09").etat).toBe("infini");
  });

  it("epuise à zéro sans la moindre créance à venir", () => {
    const r = runwayAvecCreances(0, BURN, [], "2026-09-09");
    expect(r.etat).toBe("epuise");
    expect(r.mois).toBe(0);
  });

  it("⭐ à zéro AVEC une créance à venir, ce n'est PAS « epuise »", () => {
    // C'est toute la différence entre les deux chiffres : le prudent dit
    // « épuisé », celui-ci sait qu'il rentre 3 000 € dans trois semaines.
    const r = runwayAvecCreances(
      0,
      BURN,
      [{ date: "2026-09-30", cents: 300_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(r.etat).not.toBe("epuise");
  });

  it("⚠️ des DETTES qui dépassent la trésorerie battent le « infini »", () => {
    // Un burn couvert ne suffit pas si on doit 10 000 € à un fournisseur la
    // semaine prochaine et qu'on en a 5 000.
    const couvert: Burn = { ...BURN, netCents: -50_000 };
    const r = runwayAvecCreances(
      500_000,
      couvert,
      [{ date: "2026-09-16", cents: -1_000_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(r.etat).toBe("ok");
    expect(r.mois).toBeGreaterThan(0);
  });
});

describe("⭐ la simulation jour par jour, et pourquoi ce n'est pas une division", () => {
  it("sans créance, il donne le même ordre de grandeur que le prudent", () => {
    // 500 000 centimes ÷ 100 000 par mois = 5 mois.
    const r = runwayAvecCreances(500_000, BURN, [], "2026-09-09");
    expect(r.mois).toBeGreaterThan(4.9);
    expect(r.mois).toBeLessThan(5.1);
  });

  it("une créance à échoir REPOUSSE la date d'épuisement", () => {
    const sans = runwayAvecCreances(500_000, BURN, [], "2026-09-09");
    const avec = runwayAvecCreances(
      500_000,
      BURN,
      [{ date: "2026-10-01", cents: 300_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(avec.mois as number).toBeGreaterThan(sans.mois as number);
    expect(avec.mois).toBeGreaterThan(7.9);
  });

  it("⭐⭐ voit le TROU qu'une division masquerait", () => {
    // 100 000 centimes en banque, 1 000 €/mois de burn : on tombe à zéro vers
    // le 9 octobre. Le client paye 500 000 le 1er décembre.
    //
    // Une division (100 000 + 500 000) ÷ 100 000 dirait « 6 mois » — c'est-à-dire
    // qu'on tient jusqu'en mars. C'est FAUX : on est en défaut dès octobre, et
    // c'est ce mois-là qui décide s'il faut appeler sa banque.
    const r = runwayAvecCreances(
      100_000,
      BURN,
      [{ date: "2026-12-01", cents: 500_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(r.mois).toBeLessThan(1.2);
    expect(r.dateEpuisement?.slice(0, 7)).toBe("2026-10");
  });

  it("une dette fournisseur RAPPROCHE la date d'épuisement", () => {
    const sans = runwayAvecCreances(500_000, BURN, [], "2026-09-09");
    const avec = runwayAvecCreances(
      500_000,
      BURN,
      [{ date: "2026-10-01", cents: -200_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(avec.mois as number).toBeLessThan(sans.mois as number);
  });

  it("⚠️ tenir jusqu'au bout de l'horizon ne se dit PAS « infini »", () => {
    // « Infini » a un sens précis ici — les revenus couvrent les charges. Tenir
    // trois ans parce qu'on a beaucoup d'argent est autre chose : on a cessé de
    // regarder, et le dire autrement serait un mensonge confortable.
    const r = runwayAvecCreances(1_000_000_000, BURN, [], "2026-09-09");
    expect(r.etat).toBe("ok");
    expect(r.dateEpuisement).toBeNull();
    expect(r.mois).toBeGreaterThan(35);
  });

  it("ignore une échéance au-delà de l'horizon", () => {
    const r = runwayAvecCreances(
      500_000,
      BURN,
      [{ date: "2040-01-01", cents: 900_000_000, invoiceId: 1 }],
      "2026-09-09",
    );
    expect(r.mois).toBeLessThan(6);
  });
});

describe("⚠️ le runway PRUDENT ne change pas de définition", () => {
  it("`runway()` rend exactement ce qu'il rendait avant ce chantier", () => {
    // Contre-épreuve : la fonction historique n'a pas été touchée, et elle
    // ignore complètement les créances.
    const r = runway(500_000, BURN, "2026-09-09");
    expect(r.etat).toBe("ok");
    expect(r.mois).toBe(5);
    expect(r.liquideCents).toBe(500_000);
  });

  it("les deux chiffres cohabitent et diffèrent", () => {
    const prudent = runway(500_000, BURN, "2026-09-09");
    const avec = runwayAvecCreances(
      500_000,
      BURN,
      [{ date: "2026-10-01", cents: 300_000, invoiceId: 1 }],
      "2026-09-09",
    );
    const d = comparerRunways(prudent, avec);

    expect(d.prudent.mois).toBe(5);
    expect(d.ecartMois).toBeGreaterThan(2.5);
  });

  it("⭐ aucun écart affiché quand la comparaison n'a pas de sens", () => {
    const d = comparerRunways(
      runway(null, BURN, "2026-09-09"),
      runwayAvecCreances(null, BURN, [], "2026-09-09"),
    );
    expect(d.ecartMois).toBeNull();
  });

  it("aucun écart entre deux « infini »", () => {
    const couvert: Burn = { ...BURN, netCents: -50_000 };
    const d = comparerRunways(
      runway(500_000, couvert, "2026-09-09"),
      runwayAvecCreances(500_000, couvert, [], "2026-09-09"),
    );
    expect(d.ecartMois).toBeNull();
  });
});
