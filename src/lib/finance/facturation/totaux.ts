// ─────────────────────────────────────────────────────────────────────────────
// Les totaux d'une facture — et la seule règle d'arrondi qui compte.
//
// ⚠️⚠️ LA TVA S'ARRONDIT PAR TAUX, JAMAIS PAR LIGNE.
//
// C'est la règle fiscale française, et ce n'est pas une subtilité de comptable :
// une facture de dix lignes à 20 % arrondies chacune de son côté peut s'écarter
// de plusieurs centimes du calcul correct — dix arrondis au lieu d'un. Le client
// paye alors un montant que sa propre comptabilité ne retrouve pas, et personne
// ne sait dire lequel des deux a raison.
//
// D'où la forme de ce fichier : on regroupe les bases HT PAR TAUX, on applique
// le taux UNE FOIS à chaque base, on arrondit UNE FOIS. Le total ligne HT, lui,
// est exact — il est calculé et stocké ; sa TVA ne l'est pas et n'existe nulle
// part (voir `types.ts`, `InvoiceLine`).
//
// FRANCHISE EN BASE. Le cas NOMINAL de cette app, pas le cas limite. Tous les
// taux valent zéro, la TVA vaut zéro, et la mention « TVA non applicable,
// art. 293 B du CGI » est OBLIGATOIRE sur le document. Une facture en franchise
// qui porterait une ventilation de TVA serait fausse ; une qui oublierait la
// mention serait irrégulière.
//
// ⚠️ Arithmétique en `bigint` de bout en bout (`montants.ts`). Une quantité à
// l'échelle 10⁻⁸ multipliée par un prix en centimes dépasse `2^53` bien avant
// d'atteindre des montants déraisonnables : 10 000 heures × 100 € suffisent.
// ─────────────────────────────────────────────────────────────────────────────
import type { InvoiceLine } from "../../types";
import { E8, divArrondi } from "../montants";

/** Échelle des taux de TVA : 10⁻⁴. 2000 = 20,00 %. */
export const E4 = 10_000n;

/** Les taux français usuels, pour l'interface. La saisie reste libre. */
export const TAUX_TVA_USUELS = [0, 550, 1000, 2000] as const;

/**
 * Total HT d'une ligne, en centimes.
 *
 *   (quantité / 10⁸) × prix_unitaire_cents − remise_cents
 *
 * Ce chiffre-là est EXACT au niveau de la ligne : il ne dépend d'aucun taux, et
 * l'additionner ne fait donc perdre aucun centime. C'est le seul total de ligne
 * qui soit stocké.
 *
 * La remise est soustraite APRÈS le produit, en centimes : c'est une remise en
 * valeur, pas en pourcentage. Un pourcentage se traduit en valeur à la saisie —
 * sans quoi il faudrait décider si « 10 % » porte sur la ligne ou sur la
 * facture, et les deux réponses se défendent.
 */
export function totalLigneHtCents(ligne: Pick<
  InvoiceLine,
  "quantite_e8" | "prix_unitaire_cents" | "remise_cents"
>): number {
  const brut = divArrondi(BigInt(ligne.quantite_e8) * BigInt(ligne.prix_unitaire_cents), E8);
  return Number(brut) - ligne.remise_cents;
}

/** Un taux de TVA et ce qu'il porte. */
export interface VentilationTaux {
  /** Taux à l'échelle 10⁻⁴ : 2000 = 20,00 %. */
  tauxE4: number;
  /** Base hors taxe soumise à ce taux, en centimes. */
  baseHtCents: number;
  /** TVA due sur cette base, arrondie UNE FOIS. */
  tvaCents: number;
}

export interface TotauxFacture {
  totalHtCents: number;
  totalTvaCents: number;
  totalTtcCents: number;
  /**
   * Une entrée par taux effectivement présent, triée par taux croissant.
   * C'est elle que le PDF imprime — la loi exige la ventilation, pas un total.
   */
  ventilation: VentilationTaux[];
}

export const TOTAUX_VIDES: TotauxFacture = {
  totalHtCents: 0,
  totalTvaCents: 0,
  totalTtcCents: 0,
  ventilation: [],
};

export interface OptionsTotaux {
  /**
   * Franchise en base : la TVA vaut zéro quoi qu'annoncent les lignes.
   *
   * ⚠️ On ne se contente pas d'ignorer les taux saisis, on les ÉCRASE à zéro
   * dans la ventilation. Une facture en franchise ne doit pas laisser croire
   * qu'un taux s'appliquait mais qu'il a été neutralisé : il ne s'applique pas.
   */
  franchiseEnBase?: boolean;
}

/**
 * Les totaux d'une facture, à partir de ses lignes.
 *
 * L'ordre des opérations EST le sujet de ce fichier :
 *   1. total HT de chaque ligne (exact) ;
 *   2. regroupement des bases HT par taux ;
 *   3. UN arrondi par taux, pas un par ligne ;
 *   4. somme.
 *
 * Inverser 2 et 3 est l'erreur classique, et elle ne se voit pas sur une facture
 * d'une ligne — c'est-à-dire pas pendant qu'on développe.
 */
export function totauxFacture(
  lignes: readonly InvoiceLine[],
  options: OptionsTotaux = {},
): TotauxFacture {
  const franchise = options.franchiseEnBase === true;

  // Regroupement par taux. `Map` plutôt qu'un objet : la clé est un nombre, et
  // l'ordre d'insertion ne doit pas décider de l'ordre d'affichage — on trie.
  const bases = new Map<number, bigint>();
  for (const ligne of lignes) {
    const taux = franchise ? 0 : ligne.taux_tva_e4;
    const ht = BigInt(totalLigneHtCents(ligne));
    bases.set(taux, (bases.get(taux) ?? 0n) + ht);
  }

  const ventilation: VentilationTaux[] = [];
  let totalHt = 0n;
  let totalTva = 0n;

  for (const [tauxE4, baseHt] of [...bases.entries()].sort((a, b) => a[0] - b[0])) {
    // ⭐ L'arrondi unique. `divArrondi` arrondit les moitiés à l'écart de zéro,
    // donc un avoir (montants négatifs) est arrondi symétriquement à la facture
    // qu'il annule — sans quoi annuler une facture laisserait un centime.
    const tva = tauxE4 === 0 ? 0n : divArrondi(baseHt * BigInt(tauxE4), E4);
    ventilation.push({
      tauxE4,
      baseHtCents: Number(baseHt),
      tvaCents: Number(tva),
    });
    totalHt += baseHt;
    totalTva += tva;
  }

  return {
    totalHtCents: Number(totalHt),
    totalTvaCents: Number(totalTva),
    totalTtcCents: Number(totalHt + totalTva),
    ventilation,
  };
}

/** Formatage d'un taux pour l'affichage : 2000 → « 20 % », 550 → « 5,5 % ». */
export function formaterTaux(tauxE4: number, locale = "fr-FR"): string {
  return new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(tauxE4 / 10_000);
}

/**
 * La mention légale obligatoire en franchise en base.
 *
 * Elle n'est pas configurable : c'est un texte de loi, pas une préférence. Ce
 * qui est configurable, ce sont les mentions qui s'AJOUTENT à celle-ci.
 */
export const MENTION_FRANCHISE = "TVA non applicable, art. 293 B du CGI";
