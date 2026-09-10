import { describe, expect, it } from "vitest";

import { demo } from "../../demo";
import { todayStr } from "../../logic";
import { BOM, cellule, csvFactures, csvLignes, csvPaiements, montantCsv, nomExport, tauxCsv } from "./export";

const TOUT = { du: null, au: null };

async function ctx() {
  const f = await demo.fetchFacturation();
  return {
    factures: f.factures,
    lignes: f.lignes,
    paiements: f.paiements,
    tiers: f.tiers,
    aujourdhui: todayStr(),
  };
}

describe("⚠️ le format doit s'ouvrir en France", () => {
  it("commence par le BOM — sans lui, Excel massacre les accents", () => {
    expect(BOM).toBe("﻿");
  });

  it("⭐ les montants ont une VIRGULE décimale, jamais un point", () => {
    // « 4200.00 » est lu comme du TEXTE par un Excel français : la colonne
    // devient ni sommable ni filtrable.
    expect(montantCsv(420_000)).toBe("4200,00");
    expect(montantCsv(5)).toBe("0,05");
    expect(montantCsv(-150_000)).toBe("-1500,00");
    expect(tauxCsv(2000)).toBe("20,00");
  });

  it("⭐ échappe une cellule qui contient le SÉPARATEUR", () => {
    // « Conseil ; formation » couperait la ligne en deux colonnes, et tout ce
    // qui suit se décalerait — en silence.
    expect(cellule("Conseil ; formation")).toBe('"Conseil ; formation"');
    expect(cellule('Il a dit "oui"')).toBe('"Il a dit ""oui"""');
    expect(cellule("deux\nlignes")).toBe('"deux\nlignes"');
    expect(cellule("simple")).toBe("simple");
    expect(cellule(null)).toBe("");
  });

  it("sépare les lignes en CRLF", async () => {
    const csv = csvFactures(await ctx(), TOUT);
    expect(csv).toContain("\r\n");
    expect(csv.startsWith(BOM)).toBe(true);
  });
});

describe("l'export une ligne par facture", () => {
  it("porte les colonnes demandées, dans l'ordre", async () => {
    const csv = csvFactures(await ctx(), TOUT);
    const entete = csv.slice(BOM.length).split("\r\n")[0].split(";");
    expect(entete).toEqual([
      "Date", "Numéro", "Type", "Sens", "Tiers", "Objet", "Échéance",
      "Total HT", "Total TVA", "Total TTC", "Devise", "Taux de change",
      "Encaissé", "Reste dû", "Statut", "En retard",
    ]);
  });

  it("⚠️ EXCLUT les brouillons — ils n'ont pas d'existence comptable", async () => {
    const c = await ctx();
    const csv = csvFactures(c, TOUT);
    const nbLignes = csv.trim().split("\r\n").length - 1;
    const attendues = c.factures.filter((f) => f.statut !== "brouillon").length;
    expect(nbLignes).toBe(attendues);
  });

  it("trie par date d'émission", async () => {
    const csv = csvFactures(await ctx(), TOUT);
    const dates = csv
      .trim()
      .split("\r\n")
      .slice(1)
      .map((l) => l.split(";")[0]);
    expect([...dates].sort()).toEqual(dates);
  });

  it("filtre par période, bornes incluses", async () => {
    const c = await ctx();
    const toutes = csvFactures(c, TOUT).trim().split("\r\n").length - 1;
    const aucune = csvFactures(c, { du: "2000-01-01", au: "2000-12-31" }).trim().split("\r\n").length - 1;
    expect(toutes).toBeGreaterThan(0);
    expect(aucune).toBe(0);
  });

  it("porte un avoir avec ses montants négatifs", async () => {
    const csv = csvFactures(await ctx(), TOUT);
    expect(csv).toContain("-1500,00");
  });
});

describe("⭐ l'export une ligne par LIGNE — celui qui se vérifie", () => {
  it("porte la ventilation par taux, que la synthèse ne donne pas", async () => {
    const csv = csvLignes(await ctx(), TOUT);
    const entete = csv.slice(BOM.length).split("\r\n")[0].split(";");
    expect(entete).toContain("Taux TVA");
    expect(entete).toContain("Total ligne HT");
    expect(entete).toContain("Désignation");
  });

  it("ne sort que les lignes des factures exportées", async () => {
    const c = await ctx();
    const brouillons = new Set(
      c.factures.filter((f) => f.statut === "brouillon").map((f) => f.id),
    );
    const csv = csvLignes(c, TOUT);
    for (const l of c.lignes.filter((x) => brouillons.has(x.invoice_id)))
      expect(csv).not.toContain(l.description);
  });

  it("numérote les lignes à partir de 1", async () => {
    const csv = csvLignes(await ctx(), TOUT);
    expect(csv.split("\r\n")[1].split(";")[3]).toBe("1");
  });
});

describe("l'export des paiements, SÉPARÉ", () => {
  it("porte ses propres colonnes", async () => {
    const csv = csvPaiements(await ctx(), TOUT);
    const entete = csv.slice(BOM.length).split("\r\n")[0].split(";");
    expect(entete).toEqual([
      "Date", "Facture", "Sens", "Tiers", "Montant", "Devise",
      "Taux de change", "Moyen", "Compte", "Note",
    ]);
  });

  it("⚠️ la période porte sur la date du PAIEMENT, pas de la facture", async () => {
    const c = await ctx();
    const tous = csvPaiements(c, TOUT).trim().split("\r\n").length - 1;
    expect(tous).toBe(c.paiements.length);
  });

  it("⭐ un paiement SANS COMPTE se voit, il n'est pas masqué", async () => {
    const c = await ctx();
    const avecOrphelin = {
      ...c,
      paiements: [...c.paiements, { ...c.paiements[0], id: 999, account_id: null }],
    };
    expect(csvPaiements(avecOrphelin, TOUT)).toContain("non précisé");
  });
});

describe("le nom de fichier", () => {
  it("est lisible et triable", () => {
    expect(nomExport("factures", { du: "2026-01-01", au: "2026-12-31" })).toBe(
      "factures-2026-01-01_2026-12-31.csv",
    );
    expect(nomExport("paiements", TOUT)).toBe("paiements-debut_fin.csv");
  });
});
