// ─────────────────────────────────────────────────────────────────────────────
// L'export comptable — trois CSV, pensés pour être ouverts en France.
//
// ⚠️⚠️ POINT-VIRGULE ET UTF-8 AVEC BOM, et ce n'est pas un détail de confort.
//
// Excel en configuration française lit un `.csv` en supposant le POINT-VIRGULE
// comme séparateur : une virgule y colle toute la ligne dans la première
// colonne. Et sans BOM, il décode le fichier en Windows-1252 — « Vallée »
// devient « VallÃ©e » sur chaque ligne. Les deux erreurs sont silencieuses,
// et c'est le comptable qui les découvre.
//
// ⚠️ LES MONTANTS SORTENT AVEC UNE VIRGULE DÉCIMALE, pour la même raison :
// « 4200.00 » est lu comme du TEXTE par un Excel français, donc ni sommable ni
// filtrable. Ce qui devrait être une colonne de chiffres devient une colonne
// morte.
//
// ⚠️ AUCUN PARAMÈTRE DE LOCALE, volontairement. Un export comptable ne doit pas
// changer de format selon la langue de l'interface : le fichier part chez un
// comptable français, quelle que soit la langue dans laquelle l'utilisateur a
// mis son app. Un CSV dont les décimales dépendent d'un réglage d'affichage est
// un CSV dont on ne peut rien dire.
//
// ⚠️ Ce fichier est PUR : il produit des chaînes. L'écriture sur disque passe
// par `lib/fichiers.ts`, qui sait déjà le faire des deux côtés (natif et démo).
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoiceLine, InvoiceParty, InvoicePayment } from "../../types";
import { etatFacture } from "./statuts";

/** ⚠️ Sans lui, Excel décode en Windows-1252 et massacre les accents. */
export const BOM = "﻿";
const SEP = ";";

/**
 * Une cellule CSV.
 *
 * ⚠️ On échappe dès qu'il y a un séparateur, un guillemet ou un saut de ligne.
 * Une désignation de ligne contenant « Conseil ; formation » couperait sinon la
 * ligne en deux colonnes, et tout ce qui suit se décalerait — en silence.
 */
export function cellule(valeur: string | number | null): string {
  if (valeur === null) return "";
  const s = String(valeur);
  if (!/[";\n\r]/.test(s)) return s;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Centimes → « 4200,00 ». Virgule décimale, jamais de séparateur de milliers. */
export function montantCsv(cents: number): string {
  const negatif = cents < 0;
  const abs = Math.abs(cents);
  const s = `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
  return negatif ? `-${s}` : s;
}

/** Taux à l'échelle 10⁻⁴ → « 20,00 ». */
export function tauxCsv(tauxE4: number): string {
  return (tauxE4 / 100).toFixed(2).replace(".", ",");
}

function lignesEnCsv(entetes: string[], lignes: (string | number | null)[][]): string {
  const corps = [entetes, ...lignes]
    .map((l) => l.map(cellule).join(SEP))
    // ⚠️ CRLF : c'est ce qu'attendent Excel et la plupart des logiciels
    // comptables. Un LF seul passe sur Mac et casse ailleurs.
    .join("\r\n");
  return BOM + corps + "\r\n";
}

interface Contexte {
  factures: readonly Invoice[];
  lignes: readonly InvoiceLine[];
  paiements: readonly InvoicePayment[];
  tiers: readonly InvoiceParty[];
  aujourdhui: string;
}

/** Filtre de période, bornes INCLUSES. `null` = pas de borne. */
export interface Periode {
  du: string | null;
  au: string | null;
}

function dansLaPeriode(date: string | null, p: Periode): boolean {
  if (date === null) return false;
  if (p.du && date < p.du) return false;
  if (p.au && date > p.au) return false;
  return true;
}

/**
 * ⚠️ Les BROUILLONS sont exclus de tous les exports. Ils n'ont pas de numéro,
 * donc pas d'existence comptable : les livrer à un comptable l'obligerait à
 * décider lui-même de ce qui compte.
 */
function facturesExportables(ctx: Contexte, periode: Periode): Invoice[] {
  return ctx.factures
    .filter((f) => f.statut !== "brouillon")
    .filter((f) => dansLaPeriode(f.date_emission, periode))
    .sort((a, b) => (a.date_emission ?? "").localeCompare(b.date_emission ?? ""));
}

/** UNE LIGNE PAR FACTURE — la vue de synthèse. */
export function csvFactures(ctx: Contexte, periode: Periode): string {
  const nomDe = new Map(ctx.tiers.map((t) => [t.id, t.nom]));
  const parFacture = new Map<number, InvoicePayment[]>();
  for (const p of ctx.paiements) {
    const l = parFacture.get(p.invoice_id);
    if (l) l.push(p);
    else parFacture.set(p.invoice_id, [p]);
  }

  const lignes = facturesExportables(ctx, periode).map((f) => {
    const etat = etatFacture(f, parFacture.get(f.id) ?? [], ctx.aujourdhui);
    return [
      f.date_emission,
      f.numero,
      f.type,
      f.sens,
      f.party_id === null ? "" : (nomDe.get(f.party_id) ?? ""),
      f.objet,
      f.date_echeance,
      montantCsv(f.total_ht_cents),
      montantCsv(f.total_tva_cents),
      montantCsv(f.total_ttc_cents),
      f.devise,
      // ⚠️ Le taux figé, pas un taux du jour : c'est celui auquel l'opération a
      // été enregistrée, et il ne se recalcule jamais.
      f.taux_change_e8 === null ? "" : (f.taux_change_e8 / 1e8).toFixed(6).replace(".", ","),
      montantCsv(etat.encaisseCents),
      montantCsv(etat.resteDuCents),
      etat.statut,
      etat.enRetard ? "oui" : "non",
    ];
  });

  return lignesEnCsv(
    [
      "Date",
      "Numéro",
      "Type",
      "Sens",
      "Tiers",
      "Objet",
      "Échéance",
      "Total HT",
      "Total TVA",
      "Total TTC",
      "Devise",
      "Taux de change",
      "Encaissé",
      "Reste dû",
      "Statut",
      "En retard",
    ],
    lignes,
  );
}

/**
 * UNE LIGNE PAR LIGNE DE FACTURE — la vue détaillée.
 *
 * ⭐ C'est celle qui porte la ventilation par taux, donc la seule qui permette
 * à un comptable de refaire le calcul de TVA. La vue de synthèse ne donne qu'un
 * total, et un total ne se vérifie pas.
 */
export function csvLignes(ctx: Contexte, periode: Periode): string {
  const nomDe = new Map(ctx.tiers.map((t) => [t.id, t.nom]));
  const gardees = facturesExportables(ctx, periode);
  const ids = new Set(gardees.map((f) => f.id));
  const parId = new Map(gardees.map((f) => [f.id, f]));

  const lignes = [...ctx.lignes]
    .filter((l) => ids.has(l.invoice_id))
    .sort(
      (a, b) =>
        (parId.get(a.invoice_id)?.date_emission ?? "").localeCompare(
          parId.get(b.invoice_id)?.date_emission ?? "",
        ) || a.invoice_id - b.invoice_id || a.position - b.position,
    )
    .map((l) => {
      const f = parId.get(l.invoice_id) as Invoice;
      return [
        f.date_emission,
        f.numero,
        f.party_id === null ? "" : (nomDe.get(f.party_id) ?? ""),
        l.position + 1,
        l.description,
        (l.quantite_e8 / 1e8).toString().replace(".", ","),
        l.unite,
        montantCsv(l.prix_unitaire_cents),
        montantCsv(l.remise_cents),
        tauxCsv(l.taux_tva_e4),
        montantCsv(l.total_ht_cents),
        f.devise,
      ];
    });

  return lignesEnCsv(
    [
      "Date",
      "Numéro",
      "Tiers",
      "Ligne",
      "Désignation",
      "Quantité",
      "Unité",
      "Prix unitaire HT",
      "Remise",
      "Taux TVA",
      "Total ligne HT",
      "Devise",
    ],
    lignes,
  );
}

/**
 * LES PAIEMENTS, à part.
 *
 * ⚠️ Export SÉPARÉ, et c'est demandé : un encaissement n'a pas la même date
 * qu'une facture, et les mélanger dans un seul fichier obligerait à choisir
 * laquelle des deux dates classe la ligne. Ici, la période porte sur la date du
 * PAIEMENT — c'est ce qu'un suivi de trésorerie regarde.
 */
export function csvPaiements(ctx: Contexte, periode: Periode): string {
  const parId = new Map(ctx.factures.map((f) => [f.id, f]));
  const nomDe = new Map(ctx.tiers.map((t) => [t.id, t.nom]));

  const lignes = [...ctx.paiements]
    .filter((p) => dansLaPeriode(p.date, periode))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)
    .map((p) => {
      const f = parId.get(p.invoice_id);
      return [
        p.date,
        f?.numero ?? "",
        f?.sens ?? "",
        f?.party_id == null ? "" : (nomDe.get(f.party_id) ?? ""),
        montantCsv(p.montant_cents),
        p.devise,
        p.taux_change_e8 === null ? "" : (p.taux_change_e8 / 1e8).toFixed(6).replace(".", ","),
        p.moyen,
        // ⚠️ Un paiement sans compte se voit dans l'export : c'est une donnée
        // incomplète que le comptable doit pouvoir repérer, pas masquer.
        p.account_id === null ? "non précisé" : String(p.account_id),
        p.note,
      ];
    });

  return lignesEnCsv(
    [
      "Date",
      "Facture",
      "Sens",
      "Tiers",
      "Montant",
      "Devise",
      "Taux de change",
      "Moyen",
      "Compte",
      "Note",
    ],
    lignes,
  );
}

/** Nom de fichier lisible et triable : `factures-2026-01-01_2026-12-31.csv`. */
export function nomExport(base: string, periode: Periode): string {
  const bornes = [periode.du ?? "debut", periode.au ?? "fin"].join("_");
  return `${base}-${bornes}.csv`;
}
