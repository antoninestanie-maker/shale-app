// ─────────────────────────────────────────────────────────────────────────────
// Le revenu DÉCLARÉ face au revenu ENCAISSÉ.
//
// ⚠️⚠️ CE FICHIER NE TOUCHE PAS AU BURN. `burn.ts` reste piloté par
// `finance_recurring`, et par lui seul. Les factures ne le modifient pas, ne le
// corrigent pas, ne le complètent pas.
//
// CE QU'IL FAIT À LA PLACE : il met deux chiffres côte à côte.
//
//   • déclaré  — ce que l'utilisateur a inscrit une fois pour toutes dans ses
//                flux récurrents, ramené au mois ;
//   • encaissé — ce qui est réellement entré en banque, sur 3, 6 ou 12 mois.
//
// ⭐ UN ÉCART DURABLE EST UNE INFORMATION, PAS UNE ERREUR À CORRIGER.
//
// C'est la décision qui gouverne tout le fichier, et elle mérite d'être dite :
// l'app n'a pas le droit de « réparer » le burn parce que les encaissements ne
// suivent pas. Un indépendant qui déclare 4 000 € de revenus récurrents et n'en
// encaisse que 2 800 depuis six mois n'a pas fait une faute de saisie — il a un
// problème d'activité, et c'est précisément ce que le chiffre doit lui montrer.
// Réécrire son burn à sa place effacerait le signal en prétendant l'aider.
//
// L'inverse existe aussi, et il est tout aussi utile : quelqu'un qui encaisse
// bien plus qu'il n'a déclaré tient un runway prudent trop pessimiste, et se
// prive peut-être d'un investissement qu'il pourrait faire.
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceAccount, FinanceRecurring, Invoice, InvoicePayment } from "../../types";
import { estActif, mensualiser } from "../burn";
import { ajouterMois } from "../calendrier";
import { enDeviseReference, tauxManquant } from "./change";

/** Les fenêtres proposées à l'écran. */
export const FENETRES_MOIS = [3, 6, 12] as const;
export type FenetreMois = (typeof FENETRES_MOIS)[number];

export interface ComparaisonRevenus {
  fenetreMois: FenetreMois;
  /** Revenus récurrents déclarés, mensualisés, en centimes. */
  declareMensuelCents: number;
  /** Moyenne mensuelle réellement encaissée sur la fenêtre. */
  encaisseMensuelCents: number;
  /** Total encaissé sur la fenêtre — le chiffre brut, sans lissage. */
  encaisseTotalCents: number;
  /**
   * Écart mensuel : encaissé − déclaré. Positif = on encaisse plus qu'on ne
   * l'avait dit.
   */
  ecartMensuelCents: number;
  /**
   * Écart en proportion du déclaré. `null` quand rien n'est déclaré — diviser
   * par zéro donnerait `Infinity`, qu'aucun écran ne sait afficher honnêtement.
   */
  ecartRatio: number | null;
  /**
   * Nombre de paiements écartés faute de taux de change. S'ils sont nombreux,
   * la comparaison est partielle et l'interface doit le dire.
   */
  ignoresSansTaux: number;
}

/**
 * Compare le revenu déclaré au revenu encaissé sur une fenêtre glissante.
 *
 * ⚠️ SEULES LES VENTES COMPTENT. Un décaissement fournisseur n'est pas un
 * revenu négatif : il appartient aux charges, que `burn.ts` gère déjà. Les
 * mélanger produirait un chiffre qui n'est ni l'un ni l'autre.
 *
 * ⚠️ Le déclaré est pris À LA DATE DU JOUR, pas moyenné sur la fenêtre. Un flux
 * résilié il y a huit mois ne doit pas gonfler le « déclaré » d'aujourd'hui —
 * c'est le revenu sur lequel l'utilisateur compte MAINTENANT qu'on compare.
 *
 * ⚠️ Les montants sont convertis vers `deviseReference` avec le taux FIGÉ de
 * chaque paiement ; ceux qui n'en ont pas sont écartés et COMPTÉS, jamais
 * convertis au petit bonheur.
 */
export function comparerRevenus(
  recurrents: readonly FinanceRecurring[],
  factures: readonly Invoice[],
  paiements: readonly InvoicePayment[],
  fenetreMois: FenetreMois,
  aujourdhui: string,
  deviseReference = "EUR",
): ComparaisonRevenus {
  // ── Le déclaré ────────────────────────────────────────────────────────────
  let declareMensuelCents = 0;
  for (const r of recurrents) {
    if (r.direction !== "entree") continue;
    if (!estActif(r, aujourdhui)) continue;
    declareMensuelCents += mensualiser(r.amount_cents, r.frequency);
  }

  // ── L'encaissé ────────────────────────────────────────────────────────────
  const debut = ajouterMois(aujourdhui, -fenetreMois);
  const ventes = new Set(
    factures.filter((f) => f.sens === "vente" && f.type !== "devis").map((f) => f.id),
  );

  let encaisseTotalCents = 0;
  let ignoresSansTaux = 0;
  for (const p of paiements) {
    if (!ventes.has(p.invoice_id)) continue;
    if (p.date <= debut || p.date > aujourdhui) continue;

    const operation = {
      montantCents: p.montant_cents,
      devise: p.devise,
      tauxChangeE8: p.taux_change_e8,
    };
    if (tauxManquant(operation, deviseReference)) {
      ignoresSansTaux++;
      continue;
    }
    encaisseTotalCents += enDeviseReference(operation, deviseReference);
  }

  // La fenêtre vaut exactement `fenetreMois` mois par construction ; on divise
  // donc par elle, pas par une longueur mesurée qui varierait de quelques
  // dixièmes selon les mois traversés.
  const encaisseMensuelCents = Math.round(encaisseTotalCents / fenetreMois);
  const ecartMensuelCents = encaisseMensuelCents - declareMensuelCents;

  return {
    fenetreMois,
    declareMensuelCents,
    encaisseMensuelCents,
    encaisseTotalCents,
    ecartMensuelCents,
    ecartRatio: declareMensuelCents === 0 ? null : ecartMensuelCents / declareMensuelCents,
    ignoresSansTaux,
  };
}

/**
 * L'écart est-il assez marqué et assez durable pour mériter d'être signalé ?
 *
 * ⭐ DEUX CONDITIONS, ET IL FAUT LES DEUX. Un écart de 30 % sur trois mois peut
 * n'être qu'une facture payée en retard ; le même écart sur douze mois décrit
 * une activité. Signaler le premier apprendrait à ignorer le second.
 *
 * ⚠️ Ce n'est PAS une alerte d'erreur : c'est une observation. Le libellé de
 * l'interface doit le dire ainsi, et ne jamais proposer de « corriger » le burn.
 */
export const SEUIL_ECART = 0.2;

export function ecartNotable(c: ComparaisonRevenus): boolean {
  return c.fenetreMois >= 6 && c.ecartRatio !== null && Math.abs(c.ecartRatio) >= SEUIL_ECART;
}

/**
 * Les comptes crédités par la facturation sur la fenêtre, pour que l'interface
 * puisse renvoyer vers eux.
 *
 * Sert au rapprochement à l'œil : « 3 200 € encaissés, sur le compte courant ».
 * Aucun rapprochement AUTOMATIQUE n'est fait — ce chantier n'en fait pas, et
 * c'est écrit dans la migration.
 */
export function comptesCredites(
  paiements: readonly InvoicePayment[],
  comptes: readonly FinanceAccount[],
  fenetreMois: FenetreMois,
  aujourdhui: string,
): FinanceAccount[] {
  const debut = ajouterMois(aujourdhui, -fenetreMois);
  const vus = new Set<number>();
  for (const p of paiements) {
    if (p.account_id === null) continue;
    if (p.date <= debut || p.date > aujourdhui) continue;
    vus.add(p.account_id);
  }
  return comptes.filter((c) => vus.has(c.id));
}
