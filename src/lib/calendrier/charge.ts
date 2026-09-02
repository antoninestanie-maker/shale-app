import { capaciteDuJour, type ProfilDisponibilite } from "./disponibilite";
import type { EntreeAgenda } from "./agenda";

/**
 * ⭐ « Tu poses 9 h sur une journée qui en compte 6 » — dit AVANT la journée.
 *
 * ⚠️ CE QUE CETTE MESURE NE FAIT PAS : supposer une durée. Une tâche sans
 * créneau n'a pas de durée connue, et lui en prêter une (« trente minutes,
 * disons ») fabriquerait une charge qui a l'air mesurée. L'app compterait alors
 * des heures qui n'existent nulle part, et l'avertissement perdrait tout droit
 * d'être cru.
 *
 * Les tâches sans créneau sont donc COMPTÉES À PART, et l'interface les annonce
 * comme telles : « 4 h 30 posées, plus 6 tâches sans horaire ». C'est moins
 * spectaculaire qu'un chiffre unique, et c'est la seule version honnête.
 */

export interface ChargeDuJour {
  /** Minutes réellement posées à un créneau. */
  posees: number;
  /** Capacité du jour, dérivée de ce qui a été mesuré (voir `disponibilite.ts`). */
  capacite: number;
  /** Part de la capacité occupée, 0..∞. `null` si la capacité est nulle (repos). */
  ratio: number | null;
  /** Ce qui est daté ce jour-là mais n'a pas d'horaire — non mesurable. */
  sansCreneau: number;
  /** Tâches en retard, remontées d'un jour précédent. */
  enRetard: number;
  /** La journée demande plus que ce qu'elle peut donner. */
  surchargee: boolean;
}

/**
 * Au-delà de cette part de la capacité, la journée est annoncée surchargée.
 *
 * 1,0 et pas 0,8 : avertir à 80 % ferait crier l'app sur une journée bien
 * remplie mais tenable, et un avertissement qui se déclenche trop souvent finit
 * par ne plus rien vouloir dire. On avertit quand le compte ne tombe
 * effectivement plus juste.
 */
export const SEUIL_SURCHARGE = 1;

export function chargeDuJour(
  entrees: readonly EntreeAgenda[],
  profil: ProfilDisponibilite,
  jour: string,
): ChargeDuJour {
  let posees = 0;
  let sansCreneau = 0;
  let enRetard = 0;

  for (const e of entrees) {
    // Une échéance d'objectif n'occupe pas de temps : c'est une date, pas un
    // travail. La compter ferait grossir la charge sans qu'aucune minute ne
    // soit réellement engagée.
    if (e.kind === "deadline") continue;
    if (e.faite) continue; // ce qui est fait ne pèse plus sur la suite
    if (e.enRetard) enRetard++;
    if (e.dureeMin != null) posees += e.dureeMin;
    else sansCreneau++;
  }

  const capacite = capaciteDuJour(profil, jour);
  return {
    posees,
    capacite,
    ratio: capacite > 0 ? posees / capacite : null,
    sansCreneau,
    enRetard,
    surchargee: capacite > 0 && posees > capacite * SEUIL_SURCHARGE,
  };
}

/** Les journées surchargées d'une plage — ce que la vue mois signale d'un coup d'œil. */
export function joursSurcharges(
  parJour: ReadonlyMap<string, EntreeAgenda[]>,
  profil: ProfilDisponibilite,
): Set<string> {
  const surcharges = new Set<string>();
  for (const [jour, entrees] of parJour) {
    if (chargeDuJour(entrees, profil, jour).surchargee) surcharges.add(jour);
  }
  return surcharges;
}
