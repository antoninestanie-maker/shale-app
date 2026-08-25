// ─────────────────────────────────────────────────────────────────────────────
// Projection du patrimoine — une droite, et rien d'autre.
//
// CE QUE ÇA N'EST PAS, VOLONTAIREMENT : ni Monte-Carlo, ni intervalle de
// confiance, ni rendement composé. Un module qui n'a pour données que douze
// relevés de solde et une liste de charges n'a pas de quoi nourrir un modèle
// stochastique ; en afficher un donnerait l'apparence de la rigueur à une
// extrapolation, ce qui est la façon la plus efficace de faire prendre une
// mauvaise décision. La droite, elle, dit exactement ce qu'elle sait :
// « au rythme actuel, voilà où ça va ».
//
// Elle ne prétend d'ailleurs pas prédire : elle rend visible la conséquence
// d'un burn qu'on connaît déjà.
// ─────────────────────────────────────────────────────────────────────────────
import type { Burn } from "./burn";
import { ajouterMois } from "./calendrier";

export interface PointProjection {
  date: string;
  moisEcoules: number;
  /** Patrimoine projeté à cette date, en centimes. */
  valeurCents: number;
}

/** Horizons proposés par l'interface. */
export const HORIZONS = [3, 6, 12] as const;
export type Horizon = (typeof HORIZONS)[number];

/**
 * Projection linéaire mois par mois, `depart` inclus (mois 0 = aujourd'hui).
 *
 * Le burn NET est retranché : quand les revenus récurrents dépassent les
 * charges, il est négatif et la courbe monte — c'est le même calcul, sans cas
 * particulier.
 */
export function projection(
  depart: string,
  patrimoineCents: number,
  burn: Burn,
  mois: number,
): PointProjection[] {
  const points: PointProjection[] = [];
  for (let k = 0; k <= mois; k++) {
    points.push({
      date: ajouterMois(depart, k),
      moisEcoules: k,
      valeurCents: patrimoineCents - k * burn.netCents,
    });
  }
  return points;
}

/** Les trois horizons d'un coup, pour l'en-tête de la section. */
export function projectionAuxHorizons(
  depart: string,
  patrimoineCents: number,
  burn: Burn,
): Record<Horizon, PointProjection> {
  const serie = projection(depart, patrimoineCents, burn, Math.max(...HORIZONS));
  return {
    3: serie[3],
    6: serie[6],
    12: serie[12],
  };
}
