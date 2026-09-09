// ─────────────────────────────────────────────────────────────────────────────
// Les encours — ce qu'on me doit, ce que je dois.
//
// C'est la moitié du module qui manquait au runway. Le runway prudent ne
// regarde que l'argent réellement en banque, ce qui est juste et incomplet : un
// indépendant avec 3 000 € en banque et 12 000 € de factures échues dans quinze
// jours n'est pas dans la situation que ce chiffre décrit.
//
// ⚠️ CE FICHIER NE FAIT AUCUNE PROBABILITÉ. Pas de « taux de recouvrement
// estimé », pas de pondération par l'ancienneté du client. Une créance de
// 5 000 € à 90 jours de retard vaut 5 000 € ici, et c'est l'ANCIENNETÉ affichée
// à côté qui dit au lecteur ce qu'il doit en penser. Pondérer, ce serait
// inventer un chiffre qu'aucune donnée ne soutient — exactement ce que le
// module refuse depuis la migration 018.
//
// ⚠️ UN DEVIS N'ENTRE JAMAIS DANS UN ENCOURS. Un devis n'est pas dû : il n'a
// été ni accepté ni signé tant qu'il n'a pas produit sa facture.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoicePayment } from "../../types";
import { joursEntre } from "../calendrier";
import { etatFacture } from "./statuts";

/**
 * Les tranches d'ancienneté, dans l'ordre de lecture.
 *
 * `a-echoir` en premier parce que c'est la seule bonne nouvelle du tableau :
 * commencer par les retards ferait lire une colonne d'échecs avant de savoir
 * qu'il y a aussi de l'argent qui arrive normalement.
 */
export const TRANCHES = ["a-echoir", "1-30", "31-60", "60-plus"] as const;
export type Tranche = (typeof TRANCHES)[number];

export function trancheDe(joursRetard: number, enRetard: boolean): Tranche {
  if (!enRetard) return "a-echoir";
  if (joursRetard <= 30) return "1-30";
  if (joursRetard <= 60) return "31-60";
  return "60-plus";
}

export interface LigneEncours {
  facture: Invoice;
  resteDuCents: number;
  enRetard: boolean;
  joursRetard: number;
  tranche: Tranche;
}

export interface Encours {
  /** Somme des restes dus, en centimes. */
  totalCents: number;
  /** Détail par tranche d'ancienneté, toutes les tranches présentes (même à 0). */
  parTranche: Record<Tranche, number>;
  lignes: LigneEncours[];
  /** Nombre de factures en retard — un compte, pas un montant. */
  nbEnRetard: number;
}

export const ENCOURS_VIDE: Encours = {
  totalCents: 0,
  parTranche: { "a-echoir": 0, "1-30": 0, "31-60": 0, "60-plus": 0 },
  lignes: [],
  nbEnRetard: 0,
};

/** Index des paiements par facture — évite un balayage par facture. */
export function paiementsParFacture(
  paiements: readonly InvoicePayment[],
): Map<number, InvoicePayment[]> {
  const index = new Map<number, InvoicePayment[]>();
  for (const p of paiements) {
    const liste = index.get(p.invoice_id);
    if (liste) liste.push(p);
    else index.set(p.invoice_id, [p]);
  }
  return index;
}

/**
 * L'encours d'un sens donné.
 *
 *   `vente` → ce que mes clients me doivent (créances) ;
 *   `achat` → ce que je dois à mes fournisseurs (dettes).
 *
 * Une facture entre dans l'encours si, et seulement si, elle est EXIGIBLE :
 * émise (ou partiellement encaissée), pas un devis, pas annulée, et il reste
 * quelque chose à payer. Les avoirs entrent avec leurs montants négatifs — ils
 * réduisent l'encours, ce qui est précisément leur rôle.
 */
export function encours(
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  sens: "vente" | "achat",
  aujourdhui: string,
): Encours {
  const index = paiementsParFacture(paiements);
  const lignes: LigneEncours[] = [];
  const parTranche: Record<Tranche, number> = {
    "a-echoir": 0,
    "1-30": 0,
    "31-60": 0,
    "60-plus": 0,
  };
  let totalCents = 0;
  let nbEnRetard = 0;

  for (const f of factures) {
    if (f.sens !== sens) continue;
    if (f.type === "devis") continue;

    const etat = etatFacture(f, index.get(f.id) ?? [], aujourdhui);
    if (etat.statut === "brouillon" || etat.statut === "annulee") continue;
    if (etat.resteDuCents === 0) continue;

    const tranche = trancheDe(etat.joursRetard, etat.enRetard);
    lignes.push({
      facture: f,
      resteDuCents: etat.resteDuCents,
      enRetard: etat.enRetard,
      joursRetard: etat.joursRetard,
      tranche,
    });
    parTranche[tranche] += etat.resteDuCents;
    totalCents += etat.resteDuCents;
    if (etat.enRetard) nbEnRetard++;
  }

  // Les plus en retard d'abord — c'est l'ordre dans lequel on agit.
  lignes.sort((a, b) => b.joursRetard - a.joursRetard || a.facture.id - b.facture.id);

  return { totalCents, parTranche, lignes, nbEnRetard };
}

/**
 * Le délai de paiement moyen CONSTATÉ d'un client, en jours.
 *
 * ⚠️ Mesuré sur les factures RÉELLEMENT SOLDÉES, et sur elles seules. Inclure
 * les impayées ferait baisser la moyenne au fur et à mesure qu'un client cesse
 * de payer — le chiffre s'améliorerait à mesure que la situation se dégrade.
 *
 * ⚠️ `null` si ce client n'a jamais rien soldé. Jamais `0`, qui se lirait
 * « il paye le jour même ».
 *
 * Le délai d'une facture est celui de son DERNIER paiement : c'est la date à
 * laquelle elle a cessé d'être due.
 */
export function delaiPaiementMoyen(
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  partyId: number,
): number | null {
  const index = paiementsParFacture(paiements);
  let totalJours = 0;
  let nb = 0;

  for (const f of factures) {
    if (f.party_id !== partyId || f.type === "devis" || f.date_emission === null) continue;

    const liste = index.get(f.id) ?? [];
    if (liste.length === 0) continue;

    const etat = etatFacture(f, liste, f.date_emission);
    if (etat.statut !== "encaissee") continue;

    const dernier = liste.reduce((a, b) => (a.date >= b.date ? a : b));
    const jours = joursEntre(f.date_emission, dernier.date);
    // Un paiement daté AVANT l'émission est un acompte antidaté ou une faute de
    // saisie. Il compterait pour un délai négatif, qui tirerait la moyenne vers
    // le bas sans rien décrire. On le borne à zéro plutôt que de l'écarter :
    // la facture a bien été payée, et le dire « le jour même » est le plus
    // proche de la vérité.
    totalJours += Math.max(0, jours);
    nb++;
  }

  return nb === 0 ? null : Math.round(totalJours / nb);
}
