import { formaterDansPhrase } from "../calendrier/champDate";
import { ecartEnJours, type ObjectifEnPeril } from "../calendrier/peril";
import { joursDeRetard } from "./retard";
import type { Goal } from "../types";

/**
 * ⭐ L'ÉCHÉANCE D'UN OBJECTIF — ce qu'on en écrit, partout (2026-10-12).
 *
 * Antonin, après essai de l'app installée : « Pour la date, la deadline de
 * l'objectif, c'est très important donc on le fait. » Le labo (seconde passe,
 * rang 8) : la date s'affichait SANS ANNÉE (« moyen terme · 12 février » pour
 * février 2027), elle ne disait pas si le rythme tient, et le temps restant
 * n'était écrit que dans Performance › « Par objectif », retiré le même soir.
 *
 * Ce fichier porte donc deux choses, et rien d'autre :
 *   • `dateDEcheance` — LA façon d'écrire la date d'une échéance au fil d'une
 *     ligne (la liste des objectifs, « Objectifs en cours » et « En retard »
 *     d'Aujourd'hui, la pastille d'une étape). L'année paraît dès que ce n'est
 *     pas l'année en cours. Une seule fonction : quatre écrans ne peuvent plus
 *     écrire la même date de quatre façons ;
 *   • `faitDEcheance` — ce que la page d'un objectif dit du temps qui reste.
 *
 * ⚠️ DES FAITS, JAMAIS UN PRONOSTIC. « Serai-je prêt à la date ? » : l'app ne
 * sait pas répondre, il lui faudrait une estimation du travail restant qu'elle
 * n'a pas. Elle rend :
 *   • le VERDICT DU CALENDRIER quand il y en a un (`calendrier/peril.ts`) —
 *     échéance dépassée, ou objectif encore loin du compte à sept jours de sa
 *     date. Rien n'est recalculé ici : `perils` est le résultat
 *     d'`objectifsEnPeril()`, et l'écran reprend ses mots ;
 *   • sinon les SEMAINES PLEINES qui restent (sept jours chacune, à partir
 *     d'aujourd'hui), ou les jours quand il en reste moins de sept. Un compte
 *     que chacun peut refaire de tête — pas un rythme extrapolé, pas un « à ce
 *     train, fini le… ».
 *
 * D'OÙ IL VIENT. Le calcul est celui de `faitDEcheance` dans
 * `lib/performance/parObjectif.ts` (essai du 2026-10-11), RECOPIÉ ici parce que
 * ce fichier-là part avec l'onglet « Par objectif ». La part « heures promises »
 * n'est pas reprise : la promesse part avec lui.
 *
 * Logique pure : ni base, ni horloge. Le jour s'injecte.
 */

// ─── Écrire la date ──────────────────────────────────────────────────────────

/**
 * La date d'une échéance, au fil d'une ligne : « 12 février », “February 12” —
 * et « 12 février 2027 » dès que ce n'est pas l'année en cours.
 *
 * ⚠️ `formaterDansPhrase`, pas une copie : la règle de l'année vit à un seul
 * endroit (`lib/calendrier/champDate.ts`, 2026-10-10).
 */
export function dateDEcheance(echeance: string, aujourdHui: string): string {
  return formaterDansPhrase(echeance.slice(0, 10), aujourdHui);
}

/** Ce qu'une ligne peut écrire d'une échéance — `null` quand il n'y en a pas. */
export interface MentionEcheance {
  /** La date écrite (`dateDEcheance`). */
  date: string;
  /** Jours écoulés depuis l'échéance — 0 tant qu'elle n'est pas dépassée. */
  retard: number;
  /** Jours qui restent — 0 le jour même, et 0 une fois dépassée. */
  joursRestants: number;
}

/**
 * Les trois faits d'une échéance pour une LIGNE (liste, cartes d'Aujourd'hui).
 * L'écran choisit ce qu'il a la place d'écrire ; la date, elle, est la même
 * partout.
 */
export function mentionEcheance(echeance: string | null | undefined, aujourdHui: string): MentionEcheance | null {
  if (!echeance) return null;
  const jour = echeance.slice(0, 10);
  const retard = joursDeRetard(jour, aujourdHui);
  return {
    date: dateDEcheance(jour, aujourdHui),
    retard,
    joursRestants: retard > 0 ? 0 : Math.max(0, ecartEnJours(aujourdHui, jour)),
  };
}

// ─── Le temps qui reste : des faits ──────────────────────────────────────────

export type FaitEcheance =
  /** Le verdict du Calendrier : dépassée (`joursRestants < 0`), ou en péril. */
  | { genre: "peril"; peril: ObjectifEnPeril }
  /** L'échéance est aujourd'hui, et le Calendrier n'a rien signalé. */
  | { genre: "aujourdhui" }
  | {
      genre: "a-venir";
      joursRestants: number;
      /** Semaines pleines d'ici l'échéance (`⌊jours / 7⌋`) — 0 sous sept jours. */
      semaines: number;
    }
  /** Pas d'échéance, ou objectif atteint : il n'y a rien à dire. */
  | null;

export function faitDEcheance(
  goal: Pick<Goal, "id" | "deadline">,
  perils: readonly ObjectifEnPeril[],
  acheve: boolean,
  aujourdHui: string,
): FaitEcheance {
  if (!goal.deadline || acheve) return null;
  const peril = perils.find((x) => x.goal.id === goal.id);
  if (peril) return { genre: "peril", peril };
  const joursRestants = ecartEnJours(aujourdHui, goal.deadline.slice(0, 10));
  // Dépassée et non signalée : la règle du péril signale TOUTE échéance
  // dépassée d'un objectif non atteint. Si elle n'a rien dit, nous non plus.
  if (joursRestants < 0) return null;
  if (joursRestants === 0) return { genre: "aujourdhui" };
  return { genre: "a-venir", joursRestants, semaines: Math.floor(joursRestants / 7) };
}
