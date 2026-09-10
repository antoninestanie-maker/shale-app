import { describe, expect, it } from "vitest";

import { demo } from "../../demo";
import { todayStr } from "../../logic";
import { burnMensuel } from "../burn";
import { patrimoineAu } from "../patrimoine";
import { runway } from "../runway";
import { collisionsNumeros, compteursEnRetard } from "./collisions";
import { encours } from "./creances";
import { runwayAvecCreances, echeancesAttendues } from "./runway-creances";
import { etatFacture } from "./statuts";
import { totalLigneHtCents, totauxFacture } from "./totaux";
import { mouvementsDeTresorerie } from "./tresorerie";

/**
 * Le jeu de démonstration de la facturation doit être COHÉRENT, pas décoratif.
 *
 * Sans ce test, la démo pourrit en silence : on ne la regarde qu'en preview
 * navigateur, et une facture dont les totaux ne correspondent pas à ses lignes
 * y passerait inaperçue pendant des mois — pendant qu'on s'en sert pour vérifier
 * l'interface.
 *
 * ⚠️ Les assertions portent sur des FOURCHETTES et des propriétés, jamais sur
 * des montants figés : le jeu est construit à partir de la date du jour.
 */

describe("le jeu de démonstration Facturation", () => {
  it("porte les six situations exigées par le chantier", async () => {
    const f = await demo.fetchFacturation();
    const auj = todayStr();
    const etat = (id: number) =>
      etatFacture(
        f.factures.find((x) => x.id === id) as never,
        f.paiements.filter((p) => p.invoice_id === id),
        auj,
      );

    expect(f.factures.some((x) => etat(x.id).statut === "encaissee")).toBe(true);
    expect(f.factures.some((x) => etat(x.id).statut === "partiellement_encaissee")).toBe(true);
    expect(f.factures.some((x) => etat(x.id).enRetard)).toBe(true);
    expect(f.factures.some((x) => x.statut === "brouillon")).toBe(true);
    expect(f.factures.some((x) => x.type === "devis")).toBe(true);
    expect(f.factures.some((x) => x.type === "avoir")).toBe(true);
    expect(f.factures.some((x) => x.sens === "achat")).toBe(true);
  });

  it("a un émetteur plausible, trois clients et un fournisseur", async () => {
    const f = await demo.fetchFacturation();

    expect(f.emetteur?.denomination).toBeTruthy();
    // ⚠️ Le cas NOMINAL de cette app.
    expect(f.emetteur?.regime).toBe("franchise_en_base");
    expect(f.emetteur?.indemnite_forfaitaire_cents).toBe(4000);

    expect(f.tiers.filter((t) => t.role === "client")).toHaveLength(3);
    expect(f.tiers.filter((t) => t.role === "fournisseur")).toHaveLength(1);
  });

  it("⭐ les totaux de chaque facture correspondent à ses lignes", async () => {
    const f = await demo.fetchFacturation();

    for (const facture of f.factures) {
      const lignes = f.lignes.filter((l) => l.invoice_id === facture.id);
      expect(lignes.length).toBeGreaterThan(0);
      const t = totauxFacture(lignes, { franchiseEnBase: true });
      expect(t.totalHtCents).toBe(facture.total_ht_cents);
      expect(t.totalTtcCents).toBe(facture.total_ttc_cents);
    }
  });

  it("chaque ligne porte un total HT cohérent avec sa quantité et son prix", async () => {
    const f = await demo.fetchFacturation();
    for (const l of f.lignes) expect(totalLigneHtCents(l)).toBe(l.total_ht_cents);
  });

  it("⚠️ en franchise en base, aucune TVA nulle part", async () => {
    const f = await demo.fetchFacturation();
    expect(f.lignes.every((l) => l.taux_tva_e4 === 0)).toBe(true);
    expect(f.factures.every((x) => x.total_tva_cents === 0)).toBe(true);
    // Et la mention obligatoire est portée par les documents émis.
    const emises = f.factures.filter((x) => x.statut !== "brouillon" && x.sens === "vente");
    expect(emises.every((x) => (x.mentions ?? "").includes("293 B"))).toBe(true);
  });

  it("aucun brouillon ne porte de numéro, aucune émise n'en manque", async () => {
    const f = await demo.fetchFacturation();
    for (const x of f.factures) {
      if (x.statut === "brouillon") expect(x.numero).toBeNull();
      else expect(x.numero).toBeTruthy();
    }
  });

  it("aucune collision de numéro dans le jeu livré", async () => {
    const f = await demo.fetchFacturation();
    expect(collisionsNumeros(f.factures)).toEqual([]);
  });

  it("⭐ aucun compteur de série n'est en retard sur ce qu'il a produit", async () => {
    // Sans ce test, la démo proposait à l'émission un numéro DÉJÀ PRIS
    // (F-2026-0005). Trouvé en cliquant « Émettre » à l'écran : le compteur de
    // la série F valait 5 alors qu'elle avait produit 0001 à 0005.
    const f = await demo.fetchFacturation();
    expect(compteursEnRetard(f.series, f.factures)).toEqual([]);
  });

  it("l'avoir annule bien la facture qu'il cite", async () => {
    const f = await demo.fetchFacturation();
    const avoir = f.factures.find((x) => x.type === "avoir");
    expect(avoir?.avoir_de_id).not.toBeNull();

    const annulee = f.factures.find((x) => x.id === avoir?.avoir_de_id);
    expect(annulee?.statut).toBe("annulee");
    expect(avoir?.total_ttc_cents).toBe(-(annulee?.total_ttc_cents as number));
  });

  it("le devis accepté est CONSERVÉ, et sa facture le cite", async () => {
    const f = await demo.fetchFacturation();
    const devis = f.factures.find((x) => x.type === "devis");
    const issue = f.factures.find((x) => x.devis_origine_id === devis?.id);

    expect(devis).toBeDefined();
    expect(issue).toBeDefined();
    expect(issue?.type).toBe("facture");
  });

  it("aucun encaissement ne dépasse le total de sa facture", async () => {
    const f = await demo.fetchFacturation();
    for (const x of f.factures) {
      const e = etatFacture(x, f.paiements.filter((p) => p.invoice_id === x.id), todayStr());
      if (x.total_ttc_cents >= 0) expect(e.resteDuCents).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("⭐ la démo de facturation est COHÉRENTE avec les soldes de démo", () => {
  it("les encaissements tombent sur un compte qui existe et qui est relevé", async () => {
    const fin = await demo.fetchFinance();
    const fac = await demo.fetchFacturation();

    const comptes = new Set(fin.comptes.map((c) => c.id));
    for (const p of fac.paiements) {
      expect(p.account_id).not.toBeNull();
      expect(comptes.has(p.account_id as number)).toBe(true);
    }
  });

  it("⭐ le solde composé MONTE par rapport au solde nu — la démo le montre", async () => {
    // Si les encaissements tombaient avant le dernier relevé, ils seraient
    // absorbés et la section « Facturation » ne démontrerait rien à l'écran.
    const fin = await demo.fetchFinance();
    const fac = await demo.fetchFacturation();
    const auj = todayStr();

    const { mouvements } = mouvementsDeTresorerie(fac.factures, fac.paiements, fin.comptes);
    expect(mouvements.length).toBeGreaterThan(0);

    const nu = patrimoineAu(fin.comptes, fin.balances, auj);
    const compose = patrimoineAu(fin.comptes, fin.balances, auj, undefined, mouvements);

    expect(compose.liquideCents).toBeGreaterThan(nu.liquideCents);
  });

  it("⭐ le runway « avec créances » a quelque chose à raconter", async () => {
    const fin = await demo.fetchFinance();
    const fac = await demo.fetchFacturation();
    const auj = todayStr();

    const { mouvements } = mouvementsDeTresorerie(fac.factures, fac.paiements, fin.comptes);
    const p = patrimoineAu(fin.comptes, fin.balances, auj, undefined, mouvements);
    const burn = burnMensuel(fin.recurrents, auj);

    const prudent = runway(p.liquideCents, burn, auj);
    const avec = runwayAvecCreances(
      p.liquideCents,
      burn,
      echeancesAttendues(fac.factures, fac.paiements, auj),
      auj,
    );

    // Les deux doivent être CALCULABLES — sinon l'écran montre deux tirets.
    expect(prudent.etat).toBe("ok");
    expect(avec.etat).toBe("ok");
    // Et le second doit être meilleur : il y a des créances à venir.
    expect(avec.mois as number).toBeGreaterThan(prudent.mois as number);
  });

  it("l'encours client est non nul, et le fournisseur aussi", async () => {
    const fac = await demo.fetchFacturation();
    const auj = todayStr();

    const clients = encours(fac.factures, fac.paiements, "vente", auj);
    const fournisseurs = encours(fac.factures, fac.paiements, "achat", auj);

    expect(clients.totalCents).toBeGreaterThan(0);
    expect(clients.nbEnRetard).toBeGreaterThan(0);
    expect(fournisseurs.totalCents).toBeGreaterThan(0);
  });
});

describe("les écritures de démo ont la MÊME SÉMANTIQUE que le natif", () => {
  it("une facture naît en brouillon, sans numéro", async () => {
    const id = await demo.createInvoice(
      {
        type: "facture",
        sens: "vente",
        serie_id: 1,
        party_id: 1,
        date_emission: null,
        date_echeance: null,
        conditions_paiement: null,
        devise: "EUR",
        taux_change_e8: null,
        mentions: null,
        objet: "Test",
        note: null,
        avoir_de_id: null,
        devis_origine_id: null,
      },
      todayStr(),
    );
    const f = await demo.fetchFacturation();
    const creee = f.factures.find((x) => x.id === id);
    expect(creee?.statut).toBe("brouillon");
    expect(creee?.numero).toBeNull();

    // Et elle se supprime, puisque c'est un brouillon.
    expect(await demo.deleteInvoice(id)).toBe(true);
  });

  it("⚠️ une facture ÉMISE refuse d'être supprimée", async () => {
    const f = await demo.fetchFacturation();
    const emise = f.factures.find((x) => x.statut === "emise") as { id: number };
    expect(await demo.deleteInvoice(emise.id)).toBe(false);
  });

  it("⚠️ `updateInvoiceIssuer` est un PATCH : une clé absente ne vide rien", async () => {
    // C'est le défaut « renommer une tâche effaçait sa date » (PIEGES § 6.2),
    // et le mode démo doit se comporter comme le SQL, pas plus indulgent.
    const avant = (await demo.fetchFacturation()).emetteur;
    await demo.updateInvoiceIssuer({ denomination: "Autre nom" }, todayStr());
    const apres = (await demo.fetchFacturation()).emetteur;

    expect(apres?.denomination).toBe("Autre nom");
    expect(apres?.iban).toBe(avant?.iban);
    expect(apres?.regime).toBe(avant?.regime);

    await demo.updateInvoiceIssuer({ denomination: avant?.denomination }, todayStr());
  });

  it("un tiers qui porte des factures ne se supprime pas — il s'archive", async () => {
    const f = await demo.fetchFacturation();
    const facture = f.factures.find((x) => x.party_id !== null) as { party_id: number };
    expect(await demo.deleteInvoiceParty(facture.party_id)).toBe(false);
  });
});
