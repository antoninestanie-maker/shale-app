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
 *
 * ⚠️ Et elles sont comptées SÉPARÉMENT des événements sans horaire (2026-09-07).
 * Les mettre dans le même seau donnait un compte juste sous un mot faux : une
 * « journée entière » s'annonçait comme « 1 tâche sans horaire ».
 */

export interface ChargeDuJour {
  /** Minutes réellement posées à un créneau. */
  posees: number;
  /** Capacité du jour, dérivée de ce qui a été mesuré (voir `disponibilite.ts`). */
  capacite: number;
  /** Part de la capacité occupée, 0..∞. `null` si la capacité est nulle (repos). */
  ratio: number | null;
  /**
   * Les TÂCHES datées ce jour-là sans créneau — non mesurables.
   *
   * ⚠️ NE COMPTE QUE DES TÂCHES, depuis le 2026-09-07. Ce champ comptait
   * auparavant tout ce qui n'avait pas de durée, événements « journée entière »
   * compris, et l'interface annonçait le total comme « n tâches sans horaire ».
   * Le compte était juste, le mot était faux : un séminaire de trois jours
   * s'annonçait comme une tâche. Vu à l'écran par Antonin, laissé en attente de
   * décision le 2026-09-06, tranché le 2026-09-07.
   */
  sansCreneau: number;
  /**
   * Les ÉVÉNEMENTS sans horaire de ce jour-là — « journée entière » ou heure
   * inconnue. Ils ne se mesurent pas davantage, mais ce ne sont pas des tâches :
   * ils ne se font pas, ils ont lieu.
   *
   * ⚠️ La distinction porte sur la PROPRIÉTÉ visée (« est-ce une tâche ? »), pas
   * sur une énumération de familles — c'est la leçon du § 7.2 ter de
   * `PIEGES.md`, où une règle écrite en listant des `kind` avait un trou de la
   * taille exacte de ce qu'elle prétendait tenir.
   */
  evenementsSansHeure: number;
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
  let evenementsSansHeure = 0;
  let enRetard = 0;

  for (const e of entrees) {
    // Une échéance d'objectif n'occupe pas de temps : c'est une date, pas un
    // travail. La compter ferait grossir la charge sans qu'aucune minute ne
    // soit réellement engagée.
    //
    // ⚠️ Une ÉCHÉANCE DE FACTURE non plus (migration 023), et pour la même
    // raison. Sans cette ligne elle tomberait dans `sansCreneau`, donc dans
    // « N tâches sans horaire » — un compte juste sous un mot faux, exactement
    // le défaut corrigé au checkup du 2026-09-07. Et son retard ne doit pas
    // gonfler le compteur des tâches en retard : une facture impayée n'est pas
    // du travail qui traîne.
    if (e.kind === "deadline" || e.kind === "echeance") continue;
    if (e.faite) continue; // ce qui est fait ne pèse plus sur la suite
    if (e.enRetard) enRetard++;
    if (e.dureeMin != null) {
      posees += e.dureeMin;
      continue;
    }
    // Ni l'un ni l'autre n'est mesurable — mais l'un est une tâche à faire, et
    // l'autre un événement qui a lieu. Les nommer pareil ferait mentir l'écran.
    if (e.kind === "event") evenementsSansHeure++;
    else sansCreneau++;
  }

  const capacite = capaciteDuJour(profil, jour);
  return {
    posees,
    capacite,
    ratio: capacite > 0 ? posees / capacite : null,
    sansCreneau,
    evenementsSansHeure,
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
