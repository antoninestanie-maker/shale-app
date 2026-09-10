import { describe, expect, it } from "vitest";

import { entreesDuJour } from "../../calendrier/agenda";
import { chargeDuJour } from "../../calendrier/charge";
import { profilDisponibilite } from "../../calendrier/disponibilite";
import type { Invoice, InvoiceParty, InvoicePayment } from "../../types";
import { echeancesDuCalendrier, relancesDuJour } from "./relances";

const AUJ = "2026-09-10";

function facture(p: Partial<Invoice> & { id: number }): Invoice {
  return {
    type: "facture",
    sens: "vente",
    statut: "emise",
    numero: `F-${p.id}`,
    serie_id: 1,
    party_id: 1,
    date_emission: "2026-08-01",
    date_echeance: AUJ,
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

const CLIENT: InvoiceParty = {
  id: 1,
  nom: "Cabinet Nord",
  role: "client",
  adresse: null,
  code_postal: null,
  ville: null,
  pays: null,
  siren: null,
  siret: null,
  tva_intra: null,
  email: null,
  telephone: null,
  devise: "EUR",
  notes: null,
  archived: 0,
  created_at: "",
  updated_at: "",
};

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
    created_at: "",
  };
}

describe("quelles échéances remontent au calendrier", () => {
  it("une facture émise et due entre, avec le nom du client", () => {
    const e = echeancesDuCalendrier([facture({ id: 1 })], [], [CLIENT], AUJ);
    expect(e).toEqual([{ id: 1, date: AUJ, titre: "F-1 · Cabinet Nord", enRetard: false }]);
  });

  it("⚠️ un DEVIS n'entre JAMAIS — il n'est pas dû", () => {
    expect(
      echeancesDuCalendrier([facture({ id: 1, type: "devis" })], [], [CLIENT], AUJ),
    ).toEqual([]);
  });

  it("écarte brouillon, annulée, soldée, et sans échéance", () => {
    expect(
      echeancesDuCalendrier(
        [
          facture({ id: 1, statut: "brouillon" }),
          facture({ id: 2, statut: "annulee" }),
          facture({ id: 3 }),
          facture({ id: 4, date_echeance: null }),
        ],
        [paiement(3, 100_000)],
        [CLIENT],
        AUJ,
      ),
    ).toEqual([]);
  });

  it("⭐ un ACHAT entre AUSSI — c'est un rendez-vous avec sa trésorerie", () => {
    const e = echeancesDuCalendrier(
      [facture({ id: 1, sens: "achat", numero: null, party_id: null })],
      [],
      [],
      AUJ,
    );
    expect(e).toHaveLength(1);
    expect(e[0].titre).toBe("Achat");
  });

  it("porte le retard calculé par `statuts.ts`, sans le recalculer", () => {
    const e = echeancesDuCalendrier(
      [facture({ id: 1, date_echeance: "2026-08-01" })],
      [],
      [CLIENT],
      AUJ,
    );
    expect(e[0].enRetard).toBe(true);
  });

  it("⚠️ un AVOIR n'entre pas : il n'est jamais exigible", () => {
    expect(
      echeancesDuCalendrier(
        [facture({ id: 1, type: "avoir", total_ttc_cents: -100_000 })],
        [],
        [CLIENT],
        AUJ,
      ),
    ).toEqual([]);
  });
});

describe("⭐ ce qui mérite d'être annoncé AUJOURD'HUI", () => {
  const toutes = echeancesDuCalendrier(
    [
      facture({ id: 1, date_echeance: AUJ }),
      facture({ id: 2, date_echeance: "2026-07-01" }),
      facture({ id: 3, date_echeance: "2026-09-30" }),
    ],
    [],
    [CLIENT],
    AUJ,
  );

  it("annonce ce qui échoit aujourd'hui et ce qui est en retard", () => {
    expect(relancesDuJour(toutes, AUJ).map((e) => e.id)).toEqual([2, 1]);
  });

  it("⚠️ n'annonce PAS une échéance lointaine", () => {
    // « Échéance dans 20 jours » chaque matin pendant vingt jours apprend à
    // ignorer l'annonce.
    expect(relancesDuJour(toutes, AUJ).some((e) => e.id === 3)).toBe(false);
  });
});

describe("⭐ le socle du calendrier est RÉUTILISÉ, pas dupliqué", () => {
  const sources = {
    events: [],
    tasks: [],
    completions: [],
    goals: [],
    echeances: echeancesDuCalendrier([facture({ id: 1 })], [], [CLIENT], AUJ),
  };

  it("l'échéance apparaît comme une entrée d'agenda du bon jour", () => {
    const entrees = entreesDuJour(sources, AUJ, AUJ);
    expect(entrees).toHaveLength(1);
    expect(entrees[0].kind).toBe("echeance");
    expect(entrees[0].titre).toBe("F-1 · Cabinet Nord");
    expect(entrees[0].allDay).toBe(true);
  });

  it("n'apparaît pas un autre jour", () => {
    expect(entreesDuJour(sources, "2026-09-11", AUJ)).toEqual([]);
  });

  it("⚠️ un appelant SANS échéances continue de marcher", () => {
    // La source est facultative : les trois consommateurs existants du
    // calendrier ne devaient pas avoir à changer pour compiler.
    expect(
      entreesDuJour({ events: [], tasks: [], completions: [], goals: [] }, AUJ, AUJ),
    ).toEqual([]);
  });

  it("⭐⭐ n'occupe AUCUNE minute et ne se compte pas en « tâche sans horaire »", () => {
    // Une facture n'est pas du travail : la compter ferait grossir la charge
    // sans qu'aucune minute ne soit engagée, et l'appeler « tâche » serait un
    // compte juste sous un mot faux.
    // ⚠️ Le profil se CONSTRUIT, il ne s'invente pas : sans session, c'est le
    // repli documenté (9 h – 18 h), et `appris` vaut faux.
    const profil = profilDisponibilite([]);
    const charge = chargeDuJour(entreesDuJour(sources, AUJ, AUJ), profil, AUJ);
    expect(charge.posees).toBe(0);
    expect(charge.sansCreneau).toBe(0);
    expect(charge.evenementsSansHeure).toBe(0);
  });

  it("une facture en retard ne gonfle pas le compteur des TÂCHES en retard", () => {
    const enRetard = {
      ...sources,
      echeances: echeancesDuCalendrier(
        [facture({ id: 1, date_echeance: "2026-07-01" })],
        [],
        [CLIENT],
        AUJ,
      ),
    };
    const charge = chargeDuJour(
      entreesDuJour(enRetard, AUJ, AUJ),
      profilDisponibilite([]),
      AUJ,
    );
    expect(charge.enRetard).toBe(0);
  });
});
