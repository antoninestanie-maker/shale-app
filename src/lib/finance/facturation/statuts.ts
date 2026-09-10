// ─────────────────────────────────────────────────────────────────────────────
// L'état réel d'une facture — dérivé, jamais stocké.
//
// ⚠️⚠️ `en_retard` N'EST PAS UN STATUT. C'est la décision structurante de ce
// fichier, et la raison en est bête : un statut stocké devient faux AU PASSAGE
// DE MINUIT, sans que personne n'écrive quoi que ce soit. Il faudrait un
// balayage quotidien pour le tenir à jour — donc une tâche de fond, donc un
// moment où l'app ne tourne pas et où le chiffre ment.
//
// Le retard se CALCULE, à chaque lecture, à partir de trois faits qui, eux, sont
// vrais : la facture est émise, son échéance est passée, il reste quelque chose
// à payer.
//
// CE QUI EST STOCKÉ, en revanche, c'est la progression de l'encaissement
// (`brouillon → emise → partiellement_encaissee → encaissee`), parce qu'elle
// résulte d'un GESTE de l'utilisateur — saisir un paiement — et pas de l'heure
// qu'il est.
// ─────────────────────────────────────────────────────────────────────────────
import type { Invoice, InvoicePayment, InvoiceStatut } from "../../types";
import { joursEntre } from "../calendrier";

/**
 * Ce qu'une facture doit encore rapporter (vente) ou coûter (achat).
 *
 * ⚠️ SIGNÉ, et il faut le laisser signé. Un trop-perçu (le client a payé
 * 1 100 € pour 1 000 €) donne un reste dû NÉGATIF, et c'est exactement ce qu'on
 * veut voir : le ramener à zéro effacerait de l'écran une somme qu'on doit à
 * quelqu'un.
 */
export function resteDuCents(
  facture: Pick<Invoice, "total_ttc_cents">,
  paiements: readonly Pick<InvoicePayment, "montant_cents">[],
): number {
  let encaisse = 0;
  for (const p of paiements) encaisse += p.montant_cents;
  return facture.total_ttc_cents - encaisse;
}

/** Total encaissé sur une facture. Signé : un impayé se saisit en négatif. */
export function encaisseCents(
  paiements: readonly Pick<InvoicePayment, "montant_cents">[],
): number {
  let total = 0;
  for (const p of paiements) total += p.montant_cents;
  return total;
}

export interface EtatFacture {
  /** Le statut STOCKÉ, recalculé à partir des paiements. */
  statut: InvoiceStatut;
  encaisseCents: number;
  resteDuCents: number;
  /** Émise, échue, et il reste à payer. Calculé, jamais stocké. */
  enRetard: boolean;
  /** Jours de retard, `0` si pas en retard. */
  joursRetard: number;
  /** Vrai tant que l'échéance n'est pas passée et que tout n'est pas payé. */
  aEchoir: boolean;
}

/**
 * Le statut que la facture DEVRAIT porter, vu ses paiements.
 *
 * ⚠️ `annulee` et `brouillon` ne se recalculent pas : ce sont des décisions,
 * pas des conséquences. Une facture annulée qui reçoit un paiement reste
 * annulée — et le paiement, lui, reste visible, parce qu'il a eu lieu. C'est à
 * l'utilisateur de comprendre ce qui s'est passé ; l'app ne réécrit pas son
 * histoire pour la rendre cohérente.
 *
 * ⚠️ Le seuil de « encaissée » est `reste <= 0` et non `reste === 0` : un
 * trop-perçu solde la facture. Avec l'égalité stricte, une facture surpayée
 * serait restée « partiellement encaissée » pour toujours.
 *
 * ⚠️⚠️ MAIS LE SENS DE LA COMPARAISON SUIT LE SIGNE DU TOTAL, et c'est un
 * AVOIR qui l'a montré — à l'écran, pas en test.
 *
 * Un avoir porte un total NÉGATIF (−1 500 €). Tant que rien n'a été remboursé,
 * son reste dû vaut −1 500, donc `reste <= 0` est vrai d'emblée : il
 * s'affichait « Encaissée » alors que personne n'avait rien versé. Un document
 * est soldé quand son reste dû a atteint zéro EN VENANT DU CÔTÉ de son total,
 * pas quand il est passé sous une borne fixe.
 */
export function statutCalcule(
  facture: Pick<Invoice, "statut" | "total_ttc_cents">,
  paiements: readonly Pick<InvoicePayment, "montant_cents">[],
): InvoiceStatut {
  if (facture.statut === "brouillon" || facture.statut === "annulee") return facture.statut;

  const reste = resteDuCents(facture, paiements);
  const encaisse = encaisseCents(paiements);

  if (facture.total_ttc_cents === 0) return "emise";
  const solde = facture.total_ttc_cents > 0 ? reste <= 0 : reste >= 0;
  if (solde) return "encaissee";
  if (encaisse !== 0) return "partiellement_encaissee";
  return "emise";
}

/**
 * L'état complet d'une facture à une date donnée.
 *
 * ⚠️ `aujourdhui` est INJECTÉ, jamais lu à l'horloge. C'est ce qui rend « en
 * retard de 45 jours » testable sans attendre quarante-cinq jours, et c'est la
 * même discipline que `lib/calendrier/agenda.ts`.
 *
 * ⚠️ Un DEVIS n'est jamais en retard : un devis n'est pas dû. Il a une date de
 * validité, ce qui n'est pas une échéance de paiement.
 */
export function etatFacture(
  facture: Pick<Invoice, "statut" | "type" | "total_ttc_cents" | "date_echeance">,
  paiements: readonly Pick<InvoicePayment, "montant_cents">[],
  aujourdhui: string,
): EtatFacture {
  const statut = statutCalcule(facture, paiements);
  const reste = resteDuCents(facture, paiements);
  const encaisse = encaisseCents(paiements);

  /**
   * ⚠️⚠️ `reste > 0`, et surtout PAS `reste !== 0`.
   *
   * J'ai tenté `!== 0` en corrigeant le statut des avoirs, et l'écran l'a
   * démenti tout de suite : l'avoir s'affichait « En retard de 58 jours » et
   * comptait dans « 2 documents en retard ». Or le retard sert à décider s'il
   * faut RELANCER quelqu'un — et on ne relance pas un client pour un avoir
   * qu'on lui doit. Un reste dû négatif est de l'argent qui part, pas une
   * créance à recouvrer.
   *
   * L'avoir garde bien son reste dû signé (il réduit l'encours, c'est son
   * rôle) ; il n'est simplement jamais « en retard ».
   */
  const exigible =
    facture.type !== "devis" &&
    (statut === "emise" || statut === "partiellement_encaissee") &&
    reste > 0;

  const echue =
    exigible && facture.date_echeance !== null && facture.date_echeance < aujourdhui;

  return {
    statut,
    encaisseCents: encaisse,
    resteDuCents: reste,
    enRetard: echue,
    joursRetard: echue ? joursEntre(facture.date_echeance as string, aujourdhui) : 0,
    aEchoir: exigible && !echue,
  };
}

/**
 * Un encaissement est-il recevable ? La réponse et sa raison.
 *
 * ⚠️ UN PAIEMENT SUPÉRIEUR AU RESTE DÛ EST REFUSÉ, avec un message clair. Ce
 * n'est pas de la rigidité : dans neuf cas sur dix c'est une faute de frappe
 * (un zéro de trop), et l'accepter en silence ferait apparaître un trop-perçu
 * dans les créances — donc un chiffre faux dans le runway.
 *
 * Le dixième cas — un vrai trop-perçu — se saisit quand même, en deux temps :
 * le montant dû, puis l'excédent en tant que ligne à part, avec sa note. C'est
 * plus long, et c'est voulu : ça oblige à dire ce qui s'est passé.
 *
 * ⚠️ Un montant NÉGATIF (remboursement, chèque impayé) est TOUJOURS accepté :
 * il ne peut pas être une faute de frappe qui gonfle un solde, et il doit
 * pouvoir corriger un encaissement saisi par erreur.
 */
export interface RefusPaiement {
  code: "montant-nul" | "trop-percu" | "sur-brouillon" | "date-manquante";
  message: string;
  /** Pour « trop-perçu » : ce qu'il restait réellement à payer. */
  resteDuCents?: number;
}

export function refusPaiement(
  facture: Pick<Invoice, "statut" | "total_ttc_cents">,
  paiementsExistants: readonly Pick<InvoicePayment, "montant_cents">[],
  nouveau: { montantCents: number; date: string },
): RefusPaiement | null {
  if (facture.statut === "brouillon")
    return {
      code: "sur-brouillon",
      message: "Émets d'abord la facture : un brouillon ne s'encaisse pas.",
    };

  if (!nouveau.date)
    return { code: "date-manquante", message: "Donne une date à cet encaissement." };

  if (nouveau.montantCents === 0)
    return { code: "montant-nul", message: "Un encaissement de zéro n'a rien à enregistrer." };

  const reste = resteDuCents(facture, paiementsExistants);
  if (nouveau.montantCents > 0 && nouveau.montantCents > reste)
    return {
      code: "trop-percu",
      message: "Ce montant dépasse ce qu'il reste à payer.",
      resteDuCents: reste,
    };

  return null;
}
