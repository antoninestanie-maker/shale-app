// ─────────────────────────────────────────────────────────────────────────────
// Le devis accepté — il CRÉE une facture, il ne se transforme pas.
//
// ⚠️⚠️ LE DEVIS EST CONSERVÉ. C'est la décision structurante de ce fichier, et
// elle est écrite dans le cadrage du chantier : « accepté crée une facture liée
// par `devis_origine_uid` — le devis n'est pas transformé, il est conservé ».
//
// Pourquoi : un devis est un document qu'on a ENVOYÉ. Le client en a une copie,
// il l'a peut-être signé, et c'est la pièce qui prouve ce sur quoi les deux
// parties se sont mises d'accord. Le muter en facture effacerait cette preuve —
// et si le montant facturé diffère ensuite de ce qui avait été proposé, plus
// personne ne pourrait dire ce qui avait été promis.
//
// Le lien vit dans `invoices.devis_origine_id`, et il se lit dans les deux
// sens : depuis le devis (« a produit »), depuis la facture (« vient de »).
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoiceLine } from "../../types";

/** Ce qu'il faut créer pour facturer un devis. */
export interface FactureDepuisDevis {
  /** L'en-tête de la facture à créer, prêt pour `createInvoice`. */
  entree: {
    type: "facture";
    sens: "vente";
    serie_id: number | null;
    party_id: number | null;
    date_emission: string | null;
    date_echeance: string | null;
    conditions_paiement: string | null;
    devise: string;
    taux_change_e8: number | null;
    mentions: string | null;
    objet: string | null;
    note: string | null;
    avoir_de_id: null;
    devis_origine_id: number;
  };
  /** Les lignes, recopiées à l'identique. */
  lignes: Omit<InvoiceLine, "id" | "invoice_id" | "created_at">[];
}

/**
 * Prépare la facture d'un devis accepté.
 *
 * ⚠️ LES LIGNES SONT RECOPIÉES, pas partagées. Deux documents distincts ont
 * deux jeux de lignes : modifier la facture ne doit jamais réécrire le devis
 * qu'on a envoyé au client.
 *
 * ⚠️ LA DATE D'ÉMISSION EST CELLE DU JOUR, jamais celle du devis. Une facture
 * datée du jour du devis serait antidatée de plusieurs semaines — avec un
 * numéro attribué aujourd'hui, ce qui produit exactement le désordre de série
 * que `numerotation.ts` décrit.
 *
 * ⚠️ `serieId` est celle des FACTURES, pas celle du devis : le devis a sa
 * propre suite, et mélanger les deux casserait les deux.
 *
 * `null` si le document n'est pas un devis facturable.
 */
export function factureDepuisDevis(
  devis: Invoice,
  lignes: readonly InvoiceLine[],
  serieFactures: number | null,
  aujourdhui: string,
  echeance: string | null = null,
): FactureDepuisDevis | null {
  if (devis.type !== "devis") return null;
  if (devis.statut === "brouillon" || devis.statut === "annulee") return null;

  return {
    entree: {
      type: "facture",
      sens: "vente",
      serie_id: serieFactures,
      party_id: devis.party_id,
      date_emission: aujourdhui,
      date_echeance: echeance,
      conditions_paiement: devis.conditions_paiement,
      devise: devis.devise,
      // ⚠️ Le taux de change du devis N'EST PAS repris : il était figé à la date
      // du devis, et la facture est émise aujourd'hui. Le reprendre ferait
      // facturer à un cours périmé de plusieurs semaines.
      taux_change_e8: null,
      mentions: devis.mentions,
      objet: devis.objet,
      note: devis.note,
      avoir_de_id: null,
      devis_origine_id: devis.id,
    },
    lignes: [...lignes]
      .sort((a, b) => a.position - b.position)
      .map((l, i) => ({
        position: i,
        description: l.description,
        unite: l.unite,
        quantite_e8: l.quantite_e8,
        prix_unitaire_cents: l.prix_unitaire_cents,
        taux_tva_e4: l.taux_tva_e4,
        remise_cents: l.remise_cents,
        total_ht_cents: l.total_ht_cents,
      })),
  };
}

/**
 * Ce devis a-t-il DÉJÀ produit une facture ?
 *
 * ⭐ Sert à ne pas proposer deux fois le geste. Facturer deux fois le même
 * devis est une erreur discrète : les deux factures sont valides prises
 * séparément, et le client reçoit deux fois la même demande de paiement.
 */
export function factureDuDevis(
  devisId: number,
  factures: readonly Invoice[],
): Invoice | null {
  return factures.find((f) => f.devis_origine_id === devisId) ?? null;
}

/** Le devis dont vient cette facture, s'il existe encore. */
export function devisDeLaFacture(
  facture: Pick<Invoice, "devis_origine_id">,
  factures: readonly Invoice[],
): Invoice | null {
  if (facture.devis_origine_id === null) return null;
  return factures.find((f) => f.id === facture.devis_origine_id) ?? null;
}
