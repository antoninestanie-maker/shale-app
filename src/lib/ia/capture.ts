// ─────────────────────────────────────────────────────────────────────────────
// La capture (#5 extraire, #6 vider sa tête), côté app.
//
// Le modèle LIT et CLASSE ; l'app VÉRIFIE et ÉCRIT — et seulement ce que
// l'utilisateur a coché dans les brouillons.
//
//   · Les montants d'un achat sont affichés tels qu'extraits, « à vérifier », et
//     RECONTRÔLÉS ici : HT + TVA doit donner le TTC, au centime près ; sinon un
//     avertissement sur la ligne (`ecartTotaux`).
//   · Un achat devient une FACTURE D'ACHAT EN BROUILLON (Finance → Facturation) :
//     fournisseur retrouvé par son nom ou créé, une ligne, et des totaux
//     RECALCULÉS par `totauxFacture` à partir de cette ligne — jamais repris du
//     modèle. Le numéro du fournisseur va dans l'objet (le champ `numero` d'une
//     facture est celui que Shale attribue à l'émission).
//   · ⚠️ Le fichier d'origine n'est PAS joint à l'objet créé : les pièces jointes
//     (migration 028) ne s'attachent qu'aux notes, et le cahier des charges
//     interdit d'inventer ce rattachement.
// ─────────────────────────────────────────────────────────────────────────────

import { totalLigneHtCents, totauxFacture, TAUX_TVA_USUELS } from "../finance/facturation/totaux";
import { t } from "../i18n";
import {
  createCalendarEvent,
  createInvoice,
  createInvoiceParty,
  createNote,
  createTask,
  fetchFacturation,
  replaceInvoiceLines,
  setInvoiceTotaux,
} from "../repo";
import type { AppData, InvoiceParty } from "../types";
import type { ContratsIa, ElementExtrait, LangIa } from "./contrats";

/** Les étiquettes existantes, envoyées comme liste de choix. */
export function etiquettesDe(data: AppData): string[] {
  return [...new Set(data.tags.map((x) => x.name).filter(Boolean))].slice(0, 50).map((n) => n.slice(0, 60));
}

export function payloadExtraire(lang: LangIa, jour: string, texte: string, etiquettes: string[]): ContratsIa["extraire"]["payload"] {
  return { lang, jour, texte: texte.slice(0, 30_000), etiquettes };
}

export function payloadViderTete(lang: LangIa, jour: string, texte: string, etiquettes: string[]): ContratsIa["vider_tete"]["payload"] {
  return { lang, jour, texte: texte.slice(0, 10_000), etiquettes };
}

// ── Montants ─────────────────────────────────────────────────────────────────

/** Un montant extrait (en unités) → centimes entiers. */
export function centimes(x: number | null | undefined): number | null {
  return typeof x === "number" && Number.isFinite(x) ? Math.round(x * 100) : null;
}

/**
 * L'écart, en centimes, entre HT + TVA et le TTC extraits — `null` s'il manque
 * un des trois montants (rien à contrôler) ou si tout concorde (écart ≤ 1 ct).
 */
export function ecartTotaux(achat: ElementExtrait["achat"]): number | null {
  if (!achat) return null;
  const ht = centimes(achat.ht);
  const tva = centimes(achat.tva);
  const ttc = centimes(achat.ttc);
  if (ht === null || tva === null || ttc === null) return null;
  const ecart = ht + tva - ttc;
  return Math.abs(ecart) <= 1 ? null : ecart;
}

/** Le taux de TVA d'une ligne (échelle 10⁻⁴), recalé sur un taux usuel s'il en
 *  est à moins de 0,2 point : 4,00 € sur 20,00 € → 2000 (20 %). */
export function tauxTvaE4(htCents: number | null, tvaCents: number | null): number {
  if (!htCents || htCents <= 0 || tvaCents === null || tvaCents <= 0) return 0;
  const brut = (tvaCents / htCents) * 10_000;
  const usuel = TAUX_TVA_USUELS.find((u) => Math.abs(u - brut) <= 20);
  return usuel ?? Math.round(brut);
}

// ── Écriture de ce qui a été validé ─────────────────────────────────────────

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Le texte d'une note, en HTML de l'éditeur — ÉCHAPPÉ : rien de ce que rend le
 *  modèle n'entre dans le DOM comme balise (`csp: null`). */
export function corpsDeNote(texte: string | null): string {
  const lignes = (texte ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  return lignes.length ? lignes.map((l) => `<p>${echapper(l)}</p>`).join("") : "<p><br></p>";
}

async function fournisseurDe(nom: string, devise: string, tiers: readonly InvoiceParty[]): Promise<number> {
  const cle = nom.trim().toLocaleLowerCase();
  const connu = tiers.find((p) => p.nom.trim().toLocaleLowerCase() === cle && (p.role === "fournisseur" || p.role === "les_deux"));
  if (connu) return connu.id;
  return createInvoiceParty({
    nom: nom.trim(),
    role: "fournisseur",
    adresse: null,
    code_postal: null,
    ville: null,
    pays: null,
    siren: null,
    siret: null,
    tva_intra: null,
    email: null,
    telephone: null,
    devise,
    notes: null,
  });
}

async function creerAchat(e: ElementExtrait, jour: string): Promise<void> {
  const a = e.achat;
  if (!a) return;
  const { tiers } = await fetchFacturation();
  const partyId = await fournisseurDe(a.fournisseur || e.titre, a.devise, tiers);
  const ht = centimes(a.ht);
  const tva = centimes(a.tva);
  const ttc = centimes(a.ttc);
  // Sans HT imprimé, la ligne porte le TTC à 0 % : rien n'est inventé.
  const prix = ht ?? ttc ?? 0;
  const taux = ht !== null ? tauxTvaE4(ht, tva) : 0;
  const id = await createInvoice({
    type: "facture",
    sens: "achat",
    serie_id: null,
    party_id: partyId,
    date_emission: a.date ?? e.date ?? jour,
    date_echeance: a.echeance,
    conditions_paiement: null,
    devise: a.devise,
    taux_change_e8: null,
    mentions: null,
    objet: a.numero ? t("{titre} — n° {numero}", { titre: e.titre, numero: a.numero }) : e.titre,
    note: t("Saisie par l'IA à partir d'un document : montants à vérifier."),
    avoir_de_id: null,
    devis_origine_id: null,
  });
  const ligne = {
    position: 0,
    description: e.titre,
    unite: null,
    quantite_e8: 100_000_000,
    prix_unitaire_cents: prix,
    taux_tva_e4: taux,
    remise_cents: 0,
    total_ht_cents: totalLigneHtCents({ quantite_e8: 100_000_000, prix_unitaire_cents: prix, remise_cents: 0 }),
  };
  await replaceInvoiceLines(id, [ligne]);
  // ⭐ Les totaux viennent de la ligne, par la fonction de Facturation — pas du modèle.
  const totaux = totauxFacture([{ ...ligne, id: 0, invoice_id: id, created_at: "" }]);
  await setInvoiceTotaux(id, {
    total_ht_cents: totaux.totalHtCents,
    total_tva_cents: totaux.totalTvaCents,
    total_ttc_cents: totaux.totalTtcCents,
  });
}

/** Écrit UN élément validé par l'utilisateur. */
export async function appliquerElement(e: ElementExtrait, jour: string): Promise<void> {
  switch (e.type) {
    case "tache":
      await createTask({
        label: e.titre,
        tag: e.etiquette,
        priority: e.priorite ?? "medium",
        recurrence: "none",
        goal_id: null,
        due_date: e.date,
      });
      return;
    case "evenement":
      await createCalendarEvent({
        title: e.titre,
        body: e.texte,
        date: e.date ?? jour,
        end_date: null,
        start_at: e.heure,
        end_at: null,
        all_day: !e.heure,
        color: null,
        recurrence: "none",
      });
      return;
    case "note":
      await createNote(e.titre, corpsDeNote(e.texte));
      return;
    case "achat":
      await creerAchat(e, jour);
      return;
  }
}

/** Une tâche de « vider sa tête » validée. */
export async function appliquerTache(x: ContratsIa["vider_tete"]["sortie"]["taches"][number]): Promise<void> {
  await createTask({
    label: x.titre,
    tag: x.etiquette,
    priority: x.priorite,
    recurrence: "none",
    goal_id: null,
    due_date: x.date,
  });
}
