import { addDays } from "../logic";
import { moisDecale } from "./champDate";

export type ModeCalendrier = "agenda" | "mois" | "semaine" | "jour";

/** Sur combien de jours la vue agenda déroule. Un mois : au-delà, on planifie. */
export const AGENDA_JOURS = 30;

/**
 * Où mènent « Précédent » et « Suivant » (lot 3 de l'audit du 2026-10-20,
 * temps-5 ; A07a-04 et A07a-05).
 *
 * ⚠️ L'agenda déroule `AGENDA_JOURS` jours à partir du curseur : il avance de
 * `AGENDA_JOURS` jours, pas d'un mois. Avancer d'un mois sautait le 31ᵉ jour
 * (du 6/10 au 4/11, puis la page suivante partait du 6/11 : le 5/11 n'était
 * jamais montré) et en février répétait des jours.
 *
 * ⚠️ Le mois passe par `moisDecale` : un `setMonth` brut depuis un 31 débordait
 * (31/10 + 1 mois = 1/12, novembre sauté ; − 1 mois = « 31/09 » = 1/10, le même
 * mois).
 */
export function curseurApres(mode: ModeCalendrier, curseur: string, sens: number): string {
  switch (mode) {
    case "jour":
      return addDays(curseur, sens);
    case "semaine":
      return addDays(curseur, 7 * sens);
    case "agenda":
      return addDays(curseur, AGENDA_JOURS * sens);
    case "mois":
      return moisDecale(curseur, sens);
  }
}
