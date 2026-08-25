// ─────────────────────────────────────────────────────────────────────────────
// Le burn — ce que la vie coûte par mois, déduit des seuls flux récurrents.
//
// C'est le pari du module : on ne saisit pas de tickets de caisse, on déclare
// une fois pour toutes ce qui revient (loyer, abonnements, impôts, revenus
// réguliers) et on relève ses soldes une fois par mois. La différence entre les
// deux sources est ce qui reste — les dépenses ponctuelles — et elle se lit dans
// la courbe du patrimoine, pas dans une catégorie de budget.
//
// Le burn est donc une PRÉVISION, jamais une mesure. C'est assumé : il répond à
// « qu'est-ce qui va sortir le mois prochain », qui est la question du runway.
// ─────────────────────────────────────────────────────────────────────────────
import type { FinanceFrequency, FinanceRecurring } from "../types";
import { divArrondi } from "./montants";

/**
 * Ramène un montant à son équivalent MENSUEL, en centimes.
 *
 * L'hebdomadaire compte 52 semaines par an, pas 4 par mois : 4 × 12 = 48, et
 * quatre semaines manquantes sur un abonnement de 30 € font 120 € d'erreur
 * annuelle, soit un demi-mois de runway pour quelqu'un qui en a trois.
 *
 * Le calcul se fait en `bigint` et n'arrondit qu'une fois, à la fin.
 */
export function mensualiser(amountCents: number, frequency: FinanceFrequency): number {
  const a = BigInt(amountCents);
  switch (frequency) {
    case "hebdo":
      return Number(divArrondi(a * 52n, 12n));
    case "mensuel":
      return amountCents;
    case "trimestriel":
      return Number(divArrondi(a, 3n));
    case "annuel":
      return Number(divArrondi(a, 12n));
  }
}

/** Un flux est-il actif à cette date ? (`active_to` nul = toujours actif) */
export function estActif(r: FinanceRecurring, date: string): boolean {
  if (r.active_from > date) return false;
  return r.active_to === null || r.active_to >= date;
}

export interface Burn {
  /** Revenus récurrents mensualisés, en centimes (toujours ≥ 0). */
  entreesCents: number;
  /** Charges récurrentes mensualisées, en centimes (toujours ≥ 0). */
  sortiesCents: number;
  /**
   * Ce qui part réellement chaque mois : sorties − entrées.
   * POSITIF = on brûle. NÉGATIF = on épargne. C'est ce chiffre, et lui seul,
   * qui alimente le runway.
   */
  netCents: number;
  /** Nombre de flux pris en compte. Zéro ⇒ on ne sait rien, on ne devine pas. */
  actifs: number;
}

export const BURN_VIDE: Burn = {
  entreesCents: 0,
  sortiesCents: 0,
  netCents: 0,
  actifs: 0,
};

/**
 * Burn mensuel à une date donnée.
 *
 * `actifs` est renseigné pour que l'appelant puisse distinguer « je dépense
 * autant que je gagne » (burn net nul, mais des flux déclarés) de « je n'ai
 * rien déclaré » (burn net nul parce qu'il n'y a rien). Les deux donnent zéro
 * et ne veulent pas dire la même chose ; le runway les traite différemment.
 */
export function burnMensuel(recurrents: FinanceRecurring[], date: string): Burn {
  let entreesCents = 0;
  let sortiesCents = 0;
  let actifs = 0;

  for (const r of recurrents) {
    if (!estActif(r, date)) continue;
    actifs++;
    const mensuel = mensualiser(r.amount_cents, r.frequency);
    if (r.direction === "entree") entreesCents += mensuel;
    else sortiesCents += mensuel;
  }

  return {
    entreesCents,
    sortiesCents,
    netCents: sortiesCents - entreesCents,
    actifs,
  };
}

/**
 * Flux dont la période d'activité s'est terminée il y a plus de `seuilJours`.
 *
 * Ils ne pèsent plus sur le burn — `estActif` les écarte déjà — mais ils
 * encombrent le tableau et, surtout, ils font douter : voir « Netflix » dans une
 * liste de charges sans savoir s'il compte ou non est pire que de ne pas le voir.
 * L'interface les regroupe à part plutôt que de les supprimer : un flux résilié
 * garde sa valeur d'historique.
 */
export function recurrentsPerimes(
  recurrents: FinanceRecurring[],
  date: string,
  seuilJours = 90,
): FinanceRecurring[] {
  const limite = new Date(
    Date.UTC(
      Number(date.slice(0, 4)),
      Number(date.slice(5, 7)) - 1,
      Number(date.slice(8, 10)) - seuilJours,
    ),
  )
    .toISOString()
    .slice(0, 10);
  return recurrents.filter((r) => r.active_to !== null && r.active_to < limite);
}
