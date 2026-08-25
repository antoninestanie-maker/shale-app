// ─────────────────────────────────────────────────────────────────────────────
// Le runway — le chiffre roi du module.
//
//   « Combien de mois je tiens si mes revenus s'arrêtent demain ? »
//
// C'est la seule question à laquelle un trader ou un indépendant a besoin de
// répondre en ouvrant l'app, et c'est pour elle que Finance existe. Le journal
// de trading raisonne en R, qui est une abstraction ; le loyer, lui, se paye en
// euros. Ce fichier est le point où les deux se rejoignent.
//
// LES CAS LIMITES NE SONT PAS DES DÉTAILS. Un runway est un chiffre auquel on se
// fie pour décider de prendre un risque ou non. Afficher « 0 mois » parce qu'on
// n'a pas de données, ou « ∞ » parce qu'on n'a rien déclaré, serait pire que de
// n'afficher rien : chacun de ces cas a donc son état nommé, et l'interface est
// obligée de les traiter.
// ─────────────────────────────────────────────────────────────────────────────
import type { Burn } from "./burn";
import { ajouterMois, joursDuMois } from "./calendrier";

export type RunwayEtat =
  /** Un nombre de mois est calculable et signifiant. */
  | "ok"
  /** Aucun compte relevé : le numérateur est inconnu. */
  | "sans-donnees"
  /** Aucun flux récurrent déclaré : le dénominateur est inconnu. */
  | "sans-burn"
  /** Les revenus récurrents couvrent les charges : rien ne s'épuise. */
  | "infini"
  /** Les liquidités sont déjà à zéro ou négatives. */
  | "epuise";

export interface Runway {
  etat: RunwayEtat;
  /** Nombre de mois, fractionnaire. `null` hors de l'état « ok » et « epuise ». */
  mois: number | null;
  /** Date à laquelle les liquidités atteignent zéro. `null` si non calculable. */
  dateEpuisement: string | null;
  liquideCents: number | null;
  burnNetCents: number;
}

/**
 * Runway = liquidités ÷ burn net.
 *
 * `liquideCents` est délibérément `number | null` et non `number` : « je n'ai
 * relevé aucun compte » et « j'ai zéro euro » sont deux situations opposées que
 * le même `0` confondrait. L'appelant qui n'a pas de relevé passe `null`.
 *
 * L'ORDRE DES CAS COMPTE. Sans liquidités connues, rien n'est calculable, même
 * avec un burn parfaitement renseigné — c'est donc le premier test. Vient
 * ensuite l'absence de burn déclaré, qui n'est PAS un burn nul : ne rien avoir
 * saisi ne veut pas dire ne rien dépenser, et répondre « ∞ » à quelqu'un qui
 * n'a pas encore rempli le module serait un mensonge confortable.
 */
export function runway(
  liquideCents: number | null,
  burn: Burn,
  date: string,
): Runway {
  const base = { liquideCents, burnNetCents: burn.netCents };

  if (liquideCents === null)
    return { ...base, etat: "sans-donnees", mois: null, dateEpuisement: null };

  if (burn.actifs === 0)
    return { ...base, etat: "sans-burn", mois: null, dateEpuisement: null };

  // Burn net nul ou négatif : les revenus récurrents couvrent les charges, donc
  // les liquidités ne baissent pas. Le brief appelle ça « runway infini » — ce
  // qui est vrai TANT QUE ces revenus durent, et c'est bien pourquoi le chiffre
  // affiché doit rester une question de solidité des revenus, pas de solde.
  if (burn.netCents <= 0)
    return { ...base, etat: "infini", mois: null, dateEpuisement: null };

  if (liquideCents <= 0)
    return { ...base, etat: "epuise", mois: 0, dateEpuisement: date };

  const mois = liquideCents / burn.netCents;
  return { ...base, etat: "ok", mois, dateEpuisement: dateEpuisement(date, mois) };
}

/**
 * Date atteinte après `mois` mois fractionnaires.
 *
 * Les mois entiers passent par le vrai calendrier (`ajouterMois`, qui cale sur
 * les fins de mois) ; seule la fraction restante est convertie en jours, au
 * prorata du mois où elle tombe. Multiplier par une longueur de mois moyenne
 * ferait dériver la date de deux ou trois jours sur un runway d'un an — visible,
 * et sans raison de l'être.
 */
export function dateEpuisement(depart: string, mois: number): string {
  const entiers = Math.floor(mois);
  const socle = ajouterMois(depart, entiers);
  const fraction = mois - entiers;
  if (fraction <= 0) return socle;

  const jours = Math.round(fraction * joursDuMois(socle));
  const [y, m, d] = socle.split("-").map(Number);
  const cible = new Date(y, m - 1, d + jours);
  const mm = String(cible.getMonth() + 1).padStart(2, "0");
  const dd = String(cible.getDate()).padStart(2, "0");
  return `${cible.getFullYear()}-${mm}-${dd}`;
}

/**
 * Arrondi d'affichage : « 7,4 mois ».
 * Une décimale, pas deux — « 7,43 mois » suggère une précision que le modèle
 * n'a pas, puisque le burn est une prévision.
 */
export function moisAffiches(mois: number): number {
  return Math.round(mois * 10) / 10;
}
