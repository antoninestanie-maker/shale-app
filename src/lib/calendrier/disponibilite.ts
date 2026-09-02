import { activeSessions } from "../market/clock";
import { weekdayOf } from "../logic";
import type { FocusSession } from "../types";
import { dureeMinutes, heureDe, minutesDe, type EntreeAgenda } from "./agenda";

/**
 * ⭐ Quand Antonin travaille VRAIMENT — appris de ses données, pas supposé.
 *
 * LA THÈSE. Un calendrier qui propose « demain 8 h » à quelqu'un qui n'a jamais
 * ouvert l'app avant 10 h ne rend pas service : il fait du bruit. Les créneaux
 * proposés ici sortent des heures réellement tenues, pas d'une idée de ce que
 * serait une journée de travail.
 *
 * LE MATÉRIAU. `focus_sessions.started_at` / `ended_at` sont la seule mesure
 * DIRECTE d'heures productives dans tout le dépôt : une session de
 * concentration a été lancée, et elle a duré.
 *
 * ⚠️ CE QU'ON NE PEUT PAS UTILISER, vérifié dans le schéma : `task_completions`
 * ne stocke que `(task_id, date, done)`. **Cocher une tâche ne dit pas QUAND.**
 * Fabriquer une heure à partir d'une date produirait un profil inventé qui
 * ressemblerait à un profil mesuré — le pire des deux mondes.
 *
 * ⚠️ `screen_min_<jour>` donne un VOLUME, jamais une répartition : il sait
 * qu'on a passé 240 minutes devant l'écran, pas lesquelles. Il ne sert donc pas
 * ici, et c'est délibéré.
 */

/** Repli quand il n'y a rien à apprendre. Décidé par Antonin : 9 h – 18 h, réglable. */
export const REPLI_DEBUT = 9;
export const REPLI_FIN = 18;

/**
 * En dessous de ce nombre de sessions terminées, on ne prétend RIEN avoir
 * appris.
 *
 * Dix, parce que moins que cela décrit une semaine, pas une habitude : l'app
 * présenterait un accident comme une règle, et proposerait le mardi 14 h à
 * quelqu'un qui s'y est concentré une seule fois. Un profil honnêtement vide
 * vaut mieux qu'un profil faux, puisque l'utilisateur peut corriger le premier
 * et pas le second.
 */
export const SESSIONS_MINIMUM = 10;

export interface ProfilDisponibilite {
  /**
   * Minutes de concentration observées, par jour de semaine (0 = dimanche,
   * comme `getDay()`) et par heure. `scores[jour][heure]`.
   */
  minutes: number[][];
  /**
   * Pour chaque jour de semaine, la liste des TOTAUX QUOTIDIENS de
   * concentration observés, un par date. `[lundi: [120, 95, 140], …]`.
   *
   * C'est ce qui permet de dire « un mardi, tu tiens 95 minutes » sans avoir à
   * deviner combien de semaines l'historique couvre.
   */
  totauxParJour: number[][];
  /** Nombre de sessions terminées prises en compte. */
  sessions: number;
  /**
   * Vrai quand le profil vient des données. Faux = c'est le repli, et
   * ⚠️ l'interface DOIT le dire : « heures par défaut », pas « tes heures ».
   * Laisser croire qu'un repli est un apprentissage est le seul vrai mensonge
   * que cette fonctionnalité puisse commettre.
   */
  appris: boolean;
  /** Bornes du repli, telles qu'appliquées (réglables). */
  repli: { debut: number; fin: number };
}

export interface OptionsProfil {
  debut?: number;
  fin?: number;
}

const grilleVide = (): number[][] => Array.from({ length: 7 }, () => new Array<number>(24).fill(0));

/**
 * Le profil, construit à partir des sessions de concentration TERMINÉES.
 *
 * Une session à cheval sur plusieurs heures est répartie sur chacune, au
 * prorata : une session de 10 h 40 à 12 h 10 compte 20 minutes sur 10 h, 60 sur
 * 11 h et 10 sur 12 h. La compter entièrement sur son heure de début aurait
 * fait croire que personne ne travaille jamais à midi.
 */
export function profilDisponibilite(
  sessions: readonly FocusSession[],
  options: OptionsProfil = {},
): ProfilDisponibilite {
  const debut = options.debut ?? REPLI_DEBUT;
  const fin = options.fin ?? REPLI_FIN;
  const minutes = grilleVide();
  // Total de concentration par DATE : c'est de là que sort la capacité.
  const parDate = new Map<string, number>();
  let comptees = 0;

  for (const s of sessions) {
    // Les pauses ne sont pas du travail, et une session en cours n'a pas encore
    // de durée : les compter fausserait la mesure dans deux sens opposés.
    if (s.kind !== "focus" || !s.ended_at) continue;
    const jour = s.started_at.slice(0, 10);
    const debutMin = minutesDe(s.started_at.slice(11, 16));
    const finMin = minutesDe(s.ended_at.slice(11, 16));
    if (debutMin == null || finMin == null || finMin <= debutMin) continue;

    const wd = weekdayOf(jour);
    for (let m = debutMin; m < finMin; m++) {
      const h = Math.floor(m / 60);
      if (h < 24) minutes[wd][h] += 1;
    }
    parDate.set(jour, (parDate.get(jour) ?? 0) + (finMin - debutMin));
    comptees++;
  }

  const totauxParJour: number[][] = Array.from({ length: 7 }, () => []);
  for (const [date, total] of parDate) totauxParJour[weekdayOf(date)].push(total);

  return {
    minutes,
    totauxParJour,
    sessions: comptees,
    appris: comptees >= SESSIONS_MINIMUM,
    repli: { debut, fin },
  };
}

/**
 * Cette heure-là, ce jour-là, est-elle une heure où l'on travaille ?
 *
 * Profil appris → l'heure a été tenue au moins une fois ce jour de semaine.
 * Profil non appris → on retombe sur les bornes réglables, en jours ouvrés.
 */
export function heureOuvrable(profil: ProfilDisponibilite, jour: string, heure: number): boolean {
  const wd = weekdayOf(jour);
  if (profil.appris) return profil.minutes[wd][heure] > 0;
  const ouvre = wd >= 1 && wd <= 5;
  return ouvre && heure >= profil.repli.debut && heure < profil.repli.fin;
}

/**
 * ⭐ La capacité d'une journée, en minutes — DÉRIVÉE de ce qui est mesuré.
 *
 * ⚠️ On ne réinvente pas une capacité journalière : « une journée fait huit
 * heures » est une croyance, pas une donnée. Ce qu'on sait, c'est combien de
 * minutes de concentration cette personne a réellement tenues ce jour de
 * semaine. C'est cela, sa capacité — et elle diffère du lundi au samedi.
 *
 * Sans profil appris, la capacité est celle du repli (les bornes réglables),
 * et l'appelant doit dire à l'écran que c'est un défaut.
 */
export function capaciteDuJour(profil: ProfilDisponibilite, jour: string): number {
  const wd = weekdayOf(jour);
  if (profil.appris) {
    const totaux = profil.totauxParJour[wd];
    if (totaux.length === 0) return 0; // ce jour-là, rien n'a jamais été tenu
    // MÉDIANE, et non moyenne : une seule journée exceptionnelle de six heures
    // relèverait la moyenne de tous les mardis, et l'app cesserait d'avertir
    // une personne dont les mardis font en réalité une heure et demie.
    return mediane(totaux);
  }
  const ouvre = wd >= 1 && wd <= 5;
  return ouvre ? (profil.repli.fin - profil.repli.debut) * 60 : 0;
}

/** Médiane d'une liste non vide, arrondie à la minute. */
export function mediane(valeurs: readonly number[]): number {
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 === 1
    ? tri[milieu]
    : Math.round((tri[milieu - 1] + tri[milieu]) / 2);
}

// ─── Ce qui est déjà pris, et ce qui reste ───────────────────────────────────

export interface Creneau {
  debut: string; // 'HH:MM'
  fin: string; // 'HH:MM'
  dureeMin: number;
}

/** Les intervalles réellement occupés ce jour-là, fusionnés et triés. */
export function creneauxOccupes(entrees: readonly EntreeAgenda[]): Creneau[] {
  const bruts: { d: number; f: number }[] = [];
  for (const e of entrees) {
    const d = minutesDe(e.start_at);
    const duree = e.dureeMin ?? dureeMinutes(e.start_at, e.end_at);
    if (d == null || duree == null) continue; // sans heure, n'occupe pas un créneau
    bruts.push({ d, f: d + duree });
  }
  bruts.sort((a, b) => a.d - b.d);

  const fusionnes: { d: number; f: number }[] = [];
  for (const b of bruts) {
    const dernier = fusionnes[fusionnes.length - 1];
    // Deux réunions qui se chevauchent n'occupent pas deux fois la journée :
    // sans fusion, la charge dépasserait 24 h sur un agenda pourtant tenable.
    if (dernier && b.d <= dernier.f) dernier.f = Math.max(dernier.f, b.f);
    else fusionnes.push({ ...b });
  }
  return fusionnes.map((c) => ({ debut: heureDe(c.d), fin: heureDe(c.f), dureeMin: c.f - c.d }));
}

export interface OptionsCreneaux {
  /** Durée voulue, en minutes. */
  dureeMin: number;
  /** Ne rien proposer pendant une session de marché ouverte. */
  eviterMarche?: boolean;
  /** Nombre maximum de propositions. */
  limite?: number;
  /** Heure à partir de laquelle chercher, pour le jour même ('HH:MM'). */
  pasAvant?: string;
}

const PAS_MIN = 15;

/**
 * ⭐ Les créneaux libres qu'on PROPOSE — jamais qu'on impose.
 *
 * ⚠️ L'app ne place jamais rien toute seule. Elle rend une liste ; c'est
 * Antonin qui dépose. Un calendrier qui range à votre place se fait fermer.
 *
 * Les propositions sont classées par ce que le profil sait : l'heure la plus
 * souvent tenue passe devant. À égalité, la plus tôt.
 */
export function creneauxLibres(
  profil: ProfilDisponibilite,
  entrees: readonly EntreeAgenda[],
  jour: string,
  options: OptionsCreneaux,
): Creneau[] {
  const duree = Math.max(PAS_MIN, options.dureeMin);
  const limite = options.limite ?? 3;
  const plancher = minutesDe(options.pasAvant ?? null) ?? 0;
  const occupes = creneauxOccupes(entrees).map((c) => ({
    d: minutesDe(c.debut)!,
    f: minutesDe(c.fin)!,
  }));
  const wd = weekdayOf(jour);

  const candidats: { debut: number; score: number }[] = [];
  for (let d = 0; d + duree <= 24 * 60; d += PAS_MIN) {
    if (d < plancher) continue;
    const f = d + duree;

    // Toutes les heures traversées doivent être des heures ouvrables.
    let ouvrable = true;
    for (let h = Math.floor(d / 60); h <= Math.floor((f - 1) / 60); h++) {
      if (!heureOuvrable(profil, jour, h)) {
        ouvrable = false;
        break;
      }
    }
    if (!ouvrable) continue;

    if (occupes.some((o) => d < o.f && f > o.d)) continue;
    if (options.eviterMarche && marcheOuvertPendant(jour, d, f)) continue;

    const score = profil.appris
      ? profil.minutes[wd].slice(Math.floor(d / 60), Math.floor((f - 1) / 60) + 1).reduce((a, b) => a + b, 0)
      : 0;
    candidats.push({ debut: d, score });
  }

  candidats.sort((a, b) => b.score - a.score || a.debut - b.debut);

  // Deux propositions qui se chevauchent sont une seule proposition présentée
  // deux fois : « 10:00 » et « 10:15 » n'offrent pas de choix réel.
  const gardes: { debut: number }[] = [];
  for (const c of candidats) {
    if (gardes.some((g) => Math.abs(g.debut - c.debut) < duree)) continue;
    gardes.push(c);
    if (gardes.length >= limite) break;
  }

  return gardes.map((g) => ({
    debut: heureDe(g.debut),
    fin: heureDe(g.debut + duree),
    dureeMin: duree,
  }));
}

/**
 * Une session de marché est-elle ouverte pendant ce créneau ?
 *
 * ⚠️ Un trader ne planifie pas de l'administratif à l'ouverture de Londres.
 * L'horloge de marché du dépôt le sait déjà — la réinterroger vaut mieux que de
 * recopier des horaires qui bougeront un jour.
 */
export function marcheOuvertPendant(jour: string, debutMin: number, finMin: number): boolean {
  for (let m = debutMin; m < finMin; m += 30) {
    const d = new Date(`${jour}T${heureDe(m)}:00`);
    if (activeSessions(d).length > 0) return true;
  }
  return false;
}
