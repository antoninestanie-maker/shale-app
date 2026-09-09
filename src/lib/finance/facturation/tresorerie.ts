// ─────────────────────────────────────────────────────────────────────────────
// Le pont entre la facturation et la trésorerie.
//
// C'est le seul endroit où un encaissement devient un MOUVEMENT sur un compte.
// Tout ce qui suit sert à répondre à une question, et une seule : de combien le
// solde d'un compte a-t-il bougé depuis son dernier relevé ?
//
// ⚠️⚠️ RELIRE LA RÈGLE DU SOLDE COMPOSÉ (migration 023, en-tête) :
//
//     solde d'un compte = dernier relevé saisi
//                       + mouvements datés STRICTEMENT APRÈS ce relevé
//
// Passé le relevé suivant, un mouvement est ABSORBÉ : la banque l'a déjà compté
// dans le chiffre que l'utilisateur a recopié. Continuer à l'ajouter ferait
// compter deux fois le même euro, et RIEN NE LE SIGNALERAIT.
//
// ⚠️ La composition se fait AU CALCUL. `finance_balances` n'est jamais écrite
// par la facturation — aucun encaissement ne crée, ne modifie ni ne supprime
// une ligne de relevé.
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceAccount, Invoice, InvoicePayment } from "../../types";
import { enDeviseReference, tauxManquant } from "./change";

/**
 * Un encaissement ou un décaissement ramené à ce dont la trésorerie a besoin :
 * un compte, une date, un montant signé.
 */
export interface Mouvement {
  accountId: number;
  /** 'YYYY-MM-DD', local. */
  date: string;
  /**
   * SIGNÉ dans la devise du COMPTE. Positif = le solde monte.
   *
   * C'est ici que le `sens` de la facture est consommé : encaisser une vente
   * fait monter le solde, régler un achat le fait descendre. Après cette
   * fonction, plus personne n'a besoin de savoir d'où vient le mouvement.
   */
  cents: number;
  /** La facture d'origine, pour que l'interface puisse expliquer le chiffre. */
  invoiceId: number;
}

export interface MouvementsTresorerie {
  mouvements: Mouvement[];
  /**
   * Paiements écartés faute de taux de change, avec leur facture.
   *
   * ⭐ Ils ne se fondent PAS dans le total : un montant dont on ne connaît pas
   * la valeur ne doit pas se glisser dans un solde. L'interface le dit.
   */
  sansTaux: { invoiceId: number; paymentId: number }[];
  /**
   * Nombre de paiements sans compte. Ils n'entrent nulle part — l'utilisateur
   * n'a pas dit où l'argent est arrivé — mais l'interface peut le signaler.
   */
  sansCompte: number;
}

/**
 * Traduit les paiements en mouvements de trésorerie.
 *
 * ⚠️ `account_id` NULL n'est pas une approximation à combler : le répartir « au
 * hasard » ou l'affecter au premier compte liquide produirait un patrimoine
 * faux. Le paiement compte pour le suivi de sa facture (reste dû, statut), pas
 * pour la trésorerie.
 *
 * ⚠️ Un paiement sur une facture ANNULÉE compte quand même. L'argent a bougé :
 * l'annulation dit que la créance n'est plus due, pas que le virement n'a pas
 * eu lieu. C'est l'avoir qui porte la contrepartie comptable.
 */
export function mouvementsDeTresorerie(
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  comptes: readonly FinanceAccount[],
): MouvementsTresorerie {
  const parFacture = new Map(factures.map((f) => [f.id, f]));
  const deviseDeCompte = new Map(comptes.map((c) => [c.id, c.currency]));

  const mouvements: Mouvement[] = [];
  const sansTaux: { invoiceId: number; paymentId: number }[] = [];
  let sansCompte = 0;

  for (const p of paiements) {
    if (p.account_id === null) {
      sansCompte++;
      continue;
    }

    const facture = parFacture.get(p.invoice_id);
    // Un paiement dont la facture n'est pas (encore) là : il arrivera par la
    // synchronisation. On l'ignore plutôt que de deviner son sens — se tromper
    // de signe ferait bouger le solde du double, dans le mauvais sens.
    if (!facture) continue;

    // Un DEVIS ne s'encaisse pas : s'il porte un paiement, c'est une donnée
    // incohérente, pas une avance à compter.
    if (facture.type === "devis") continue;

    const devise = deviseDeCompte.get(p.account_id);
    // Compte inconnu (supprimé entre-temps, pas encore synchronisé) : rien à
    // créditer.
    if (devise === undefined) continue;

    const operation = {
      montantCents: p.montant_cents,
      devise: p.devise,
      tauxChangeE8: p.taux_change_e8,
    };
    if (tauxManquant(operation, devise)) {
      sansTaux.push({ invoiceId: facture.id, paymentId: p.id });
      continue;
    }

    const cents = enDeviseReference(operation, devise);
    mouvements.push({
      accountId: p.account_id,
      date: p.date,
      // ⭐ Le sens de la facture décide du signe, une fois pour toutes.
      cents: facture.sens === "achat" ? -cents : cents,
      invoiceId: facture.id,
    });
  }

  return { mouvements, sansTaux, sansCompte };
}

/**
 * Somme des mouvements d'un compte dans la fenêtre `]apres, jusqua]`.
 *
 * ⚠️ LA BORNE BASSE EST STRICTE, la haute est inclusive. Un mouvement daté du
 * jour même du relevé est réputé DÉJÀ CONTENU dans ce relevé : c'est le chiffre
 * que la banque affichait ce jour-là. L'inclure le compterait deux fois — le
 * défaut exact que ce fichier existe pour empêcher.
 *
 * `apres` à `null` : aucun relevé n'a jamais été saisi pour ce compte. Aucun
 * mouvement n'est ajouté, parce qu'il n'y a rien à quoi les ajouter.
 * `soldeInterpole` rend déjà `null` dans ce cas, et `null + 300 €` n'est pas
 * « 300 € » : c'est toujours « on ne sait pas ».
 */
export function mouvementsDansFenetre(
  mouvements: readonly Mouvement[],
  accountId: number,
  apres: string | null,
  jusqua: string,
): number {
  if (apres === null) return 0;
  let total = 0;
  for (const m of mouvements) {
    if (m.accountId !== accountId) continue;
    if (m.date <= apres) continue; // absorbé par le relevé
    if (m.date > jusqua) continue; // pas encore arrivé à la date évaluée
    total += m.cents;
  }
  return total;
}
