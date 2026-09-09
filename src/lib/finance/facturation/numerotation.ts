// ─────────────────────────────────────────────────────────────────────────────
// L'attribution d'un numéro de facture.
//
// TROIS RÈGLES, ET ELLES SONT LÉGALES AVANT D'ÊTRE TECHNIQUES :
//
//   1. UN BROUILLON N'A PAS DE NUMÉRO. Le numéro s'attribue au moment de
//      l'ÉMISSION, une seule fois. Numéroter à la création réserverait des
//      numéros à des documents qui n'existeront jamais.
//
//   2. UN NUMÉRO ATTRIBUÉ N'EST JAMAIS RENDU. Une série doit être continue et
//      sans trou. Annuler une facture émise se fait par un AVOIR, pas en
//      récupérant son numéro — sans quoi deux documents différents porteraient
//      la même référence, et le second effacerait la trace du premier.
//
//   3. UN NUMÉRO NE SE RÉÉCRIT PAS. Une fois envoyé au client, il est la
//      référence commune des deux comptabilités. Voir `collisions.ts` : quand
//      deux appareils produisent le même numéro, on ALERTE, on ne renumérote
//      pas dans le dos de l'utilisateur.
//
// ⚠️ CE FICHIER NE SAIT PAS ÉCRIRE EN BASE, et c'est volontaire. Il calcule le
// prochain numéro et l'état suivant du compteur ; c'est l'appelant qui écrit les
// deux dans la même transaction. Une fonction pure se teste sans base.
// ─────────────────────────────────────────────────────────────────────────────
import type { InvoiceSeries } from "../../types";

/**
 * Le gabarit d'un numéro.
 *
 *   {code}  le code de la série  — 'F'
 *   {AAAA}  l'année sur 4 chiffres
 *   {AA}    l'année sur 2 chiffres
 *   {MM}    le mois sur 2 chiffres
 *   {NNNN}  le compteur, complété de zéros à gauche selon le nombre de N
 *
 * Un jeton inconnu est laissé TEL QUEL plutôt que remplacé par du vide : un
 * numéro qui contient `{XX}` se voit et se corrige ; un numéro amputé en
 * silence ne se voit pas.
 */
export const FORMAT_DEFAUT = "{code}-{AAAA}-{NNNN}";

export interface NumeroAttribue {
  /** Le numéro à écrire sur la facture. */
  numero: string;
  /** L'état suivant du compteur, à écrire sur la série DANS LA MÊME TRANSACTION. */
  serie: Pick<InvoiceSeries, "prochain" | "annee_courante">;
}

/**
 * Le numéro suivant d'une série, à une date donnée.
 *
 * ⭐ LA REMISE À ZÉRO ANNUELLE se décide en comparant l'année de `date` à
 * `annee_courante`, pas en regardant l'horloge. C'est ce qui rend le premier
 * janvier testable un 9 septembre.
 *
 * ⚠️ Elle est aussi ce qui rend le compteur SENSIBLE À L'ORDRE DE SAISIE : une
 * facture antidatée sur l'année précédente, émise après une facture de l'année
 * en cours, reprendrait le compteur à 1. C'est le comportement correct
 * (chaque année a sa propre suite), mais il produit un numéro déjà utilisé si
 * l'année précédente en comptait déjà. `collisions.ts` le verra. On n'essaie pas
 * de deviner : antidater est un geste rare, et l'interface prévient.
 */
export function numeroSuivant(serie: InvoiceSeries, date: string): NumeroAttribue {
  const annee = Number(date.slice(0, 4));
  const mois = date.slice(5, 7);

  const remiseAZero =
    serie.remise_a_zero_annuelle === 1 &&
    serie.annee_courante !== null &&
    serie.annee_courante !== annee;

  const compteur = remiseAZero ? 1 : serie.prochain;

  const numero = (serie.format || FORMAT_DEFAUT)
    .replace(/\{code\}/g, serie.code)
    .replace(/\{AAAA\}/g, String(annee))
    .replace(/\{AA\}/g, String(annee).slice(-2))
    .replace(/\{MM\}/g, mois)
    // ⚠️ La longueur du padding vient du NOMBRE DE N écrit dans le gabarit :
    // `{NN}` donne « 07 », `{NNNN}` donne « 0007 ». C'est la seule façon de
    // laisser l'utilisateur choisir sans ajouter un second réglage.
    .replace(/\{(N+)\}/g, (_, n: string) => String(compteur).padStart(n.length, "0"));

  return {
    numero,
    serie: { prochain: compteur + 1, annee_courante: annee },
  };
}

/**
 * Peut-on émettre ce document ? La réponse et sa raison.
 *
 * Ce n'est pas de la validation de formulaire — c'est la liste des conditions
 * sans lesquelles le document ne serait pas une facture au sens de la loi.
 * L'interface s'en sert pour désactiver le bouton ET pour dire pourquoi.
 */
export interface Empechement {
  code:
    | "deja-emise"
    | "sans-serie"
    | "sans-client"
    | "sans-lignes"
    | "sans-date"
    | "total-nul";
  /** Clé de traduction, passée telle quelle à `t()`. */
  message: string;
}

export function empechementsEmission(entree: {
  statut: string;
  serieId: number | null;
  partyId: number | null;
  nbLignes: number;
  dateEmission: string | null;
  totalTtcCents: number;
  /** Un avoir porte des montants négatifs : son total nul est un vrai vide. */
  type: string;
}): Empechement[] {
  const out: Empechement[] = [];
  if (entree.statut !== "brouillon")
    out.push({ code: "deja-emise", message: "Ce document a déjà été émis." });
  if (entree.serieId === null)
    out.push({ code: "sans-serie", message: "Choisis une série de numérotation." });
  if (entree.partyId === null)
    out.push({ code: "sans-client", message: "Choisis un client." });
  if (entree.nbLignes === 0)
    out.push({ code: "sans-lignes", message: "Ajoute au moins une ligne." });
  if (!entree.dateEmission)
    out.push({ code: "sans-date", message: "Donne une date d'émission." });
  // Un devis à zéro se défend (offre gracieuse) ; une facture à zéro n'a rien à
  // réclamer et n'a donc pas lieu d'être émise.
  if (entree.totalTtcCents === 0 && entree.type === "facture")
    out.push({ code: "total-nul", message: "Le total est nul : rien à facturer." });
  return out;
}
