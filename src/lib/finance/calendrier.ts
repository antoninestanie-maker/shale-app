// Calendrier du module Finance — l'arithmétique des dates que `logic.ts` ne
// couvre pas. `logic.ts` sait ajouter des JOURS ; Finance raisonne en MOIS.

import { toDateStr } from "../logic";

/**
 * Longueur moyenne d'un mois, en jours (365,2425 / 12 — année grégorienne).
 *
 * ⚠️ Ne sert QU'À exprimer un rythme : « ce total, ramené au mois ». Jamais à
 * calculer un solde ni une date. Une date se calcule avec `ajouterMois`, qui
 * passe par le vrai calendrier.
 */
export const JOURS_PAR_MOIS = 365.2425 / 12;

/**
 * Ajoute `n` mois, en calant sur la fin de mois.
 *
 * 31 janvier + 1 mois = 28 (ou 29) février, et non le 3 mars. C'est ce que fait
 * un prélèvement bancaire, et c'est ce qu'attend quiconque regarde une date
 * d'épuisement : `new Date(2026, 0, 31 + 31)` déborderait silencieusement sur le
 * mois suivant.
 */
export function ajouterMois(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const cible = new Date(y, m - 1 + n, 1);
  const dernierJour = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  cible.setDate(Math.min(d, dernierJour));
  return toDateStr(cible);
}

/** Nombre de jours de `debut` à `fin` (négatif si `fin` précède `debut`). */
export function joursEntre(debut: string, fin: string): number {
  const [ay, am, ad] = debut.split("-").map(Number);
  const [by, bm, bd] = fin.split("-").map(Number);
  const a = Date.UTC(ay, am - 1, ad);
  const b = Date.UTC(by, bm - 1, bd);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Durée d'une période en mois, fractionnaire.
 * Sert à ramener un total au rythme mensuel — pas à dater quoi que ce soit.
 */
export function moisEntre(debut: string, fin: string): number {
  return joursEntre(debut, fin) / JOURS_PAR_MOIS;
}

/** Nombre de jours du mois auquel appartient `dateStr`. */
export function joursDuMois(dateStr: string): number {
  const [y, m] = dateStr.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** Premier jour du mois de `dateStr`. */
export function debutDeMois(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}
