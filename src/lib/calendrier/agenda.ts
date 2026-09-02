import { occurrenceLe, toDateStr, weekdayOf } from "../logic";
import { estDatee, estRecurrente } from "../taches";
import type { CalendarEvent, Completion, Goal, Task } from "../types";

/**
 * Ce qui occupe une journée — logique pure.
 *
 * Le calendrier ne possède aucune donnée en propre : il RASSEMBLE ce que
 * quatre modules savent déjà, et c'est tout son intérêt. Personne ne croisait
 * ces quatre sources avant lui.
 *
 * ⚠️ Aucune horloge implicite, aucune base : le jour s'injecte. C'est ce qui
 * rend « la semaine prochaine » testable sans attendre lundi.
 */

/**
 * Les quatre familles, dans l'ORDRE DE PRIORITÉ décidé par Antonin. L'ordre
 * n'est pas cosmétique : c'est celui dans lequel une journée se lit.
 */
export type EntreeKind = "event" | "task" | "recurrence" | "deadline";

const RANG: Record<EntreeKind, number> = { event: 0, task: 1, recurrence: 2, deadline: 3 };

export interface EntreeAgenda {
  kind: EntreeKind;
  /** `id` de la ligne d'origine, dans SA table. Deux familles peuvent partager un id. */
  id: number;
  titre: string;
  date: string;
  start_at: string | null;
  end_at: string | null;
  allDay: boolean;
  color: string | null;
  /** Durée en minutes, `null` si aucun créneau n'est connu. */
  dureeMin: number | null;
  /** Vrai pour une tâche datée d'hier ou avant, et non faite. */
  enRetard: boolean;
  /** Combien de fois elle a glissé. 0 partout ailleurs. */
  reports: number;
  /** Faite ce jour-là ? `null` quand la question n'a pas de sens (événement). */
  faite: boolean | null;
}

export interface SourcesAgenda {
  events: readonly CalendarEvent[];
  tasks: readonly Task[];
  completions: readonly Completion[];
  goals: readonly Goal[];
}

// ─── Heures et durées ────────────────────────────────────────────────────────

/** 'HH:MM' → minutes depuis minuit. `null` si la chaîne n'est pas une heure. */
export function minutesDe(hhmm: string | null | undefined): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** minutes depuis minuit → 'HH:MM'. */
export function heureDe(minutes: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/**
 * Durée d'un créneau, en minutes.
 *
 * ⚠️ Une fin ANTÉRIEURE au début rend `null`, pas une durée négative : c'est
 * une saisie incohérente, et une durée négative se propagerait dans le calcul
 * de charge en le faisant DIMINUER — une journée surchargée passerait alors
 * pour légère.
 */
export function dureeMinutes(start: string | null, end: string | null): number | null {
  const d = minutesDe(start);
  const f = minutesDe(end);
  if (d == null || f == null) return null;
  return f > d ? f - d : null;
}

// ─── Construction d'une journée ──────────────────────────────────────────────

function completionsIndex(completions: readonly Completion[]): Map<string, boolean> {
  return new Map(completions.map((c) => [`${c.task_id}:${c.date}`, !!c.done]));
}

/**
 * Tout ce qui occupe `jour`, dans l'ordre de lecture.
 *
 * `aujourdhui` sert uniquement à décider du RETARD : une tâche du 3 n'est pas
 * en retard quand on consulte le 2, elle l'est quand on consulte le 5.
 */
export function entreesDuJour(
  src: SourcesAgenda,
  jour: string,
  aujourdhui: string,
): EntreeAgenda[] {
  const faites = completionsIndex(src.completions);
  const entrees: EntreeAgenda[] = [];

  // 1) Les événements — ceux du jour, plus les occurrences des récurrents.
  for (const e of src.events) {
    const ponctuel = e.date === jour && !estRecurrenteSerie(e.recurrence);
    const occurrence = estRecurrenteSerie(e.recurrence) && occurrenceLe(e.recurrence, e.date, jour);
    if (!ponctuel && !occurrence) continue;
    entrees.push({
      kind: "event",
      id: e.id,
      titre: e.title,
      date: jour,
      start_at: e.all_day ? null : e.start_at,
      end_at: e.all_day ? null : e.end_at,
      allDay: !!e.all_day,
      color: e.color,
      dureeMin: e.all_day ? null : dureeMinutes(e.start_at, e.end_at),
      enRetard: false,
      reports: 0,
      faite: null,
    });
  }

  // 2) Les tâches DATÉES, à leur créneau quand elles en ont un.
  for (const t of src.tasks) {
    if (!estDatee(t) || t.due_date !== jour) continue;
    entrees.push({
      kind: "task",
      id: t.id,
      titre: t.label,
      date: jour,
      start_at: t.start_at,
      end_at: t.end_at,
      allDay: false,
      color: null,
      dureeMin: dureeMinutes(t.start_at, t.end_at),
      enRetard: jour < aujourdhui && !faites.get(`${t.id}:${jour}`),
      reports: t.postponed_count,
      faite: !!faites.get(`${t.id}:${jour}`),
    });
  }

  // 3) Les tâches RÉCURRENTES, projetées à leurs occurrences.
  // ⚠️ Jamais « en retard » : une occurrence manquée est manquée, pas en
  // retard (voir `lib/taches.ts`). Elle ne se reporte pas non plus.
  for (const t of src.tasks) {
    if (!estRecurrente(t) || !occurrenceLe(t.recurrence, t.created_at, jour)) continue;
    entrees.push({
      kind: "recurrence",
      id: t.id,
      titre: t.label,
      date: jour,
      start_at: t.start_at,
      end_at: t.end_at,
      allDay: false,
      color: null,
      dureeMin: dureeMinutes(t.start_at, t.end_at),
      enRetard: false,
      reports: 0,
      faite: !!faites.get(`${t.id}:${jour}`),
    });
  }

  // 4) Les échéances d'objectifs — y compris les sous-objectifs, qui sont les
  // jalons. `goals.deadline` existait déjà, et n'était visible QUE dans le
  // module Objectifs : personne ne la croisait avec un calendrier.
  for (const g of src.goals) {
    if (g.deadline !== jour) continue;
    entrees.push({
      kind: "deadline",
      id: g.id,
      titre: g.title,
      date: jour,
      start_at: null,
      end_at: null,
      allDay: true,
      color: null,
      dureeMin: null,
      enRetard: false,
      reports: 0,
      faite: null,
    });
  }

  return trierEntrees(entrees);
}

function estRecurrenteSerie(recurrence: string | null): boolean {
  return !!recurrence && recurrence !== "none";
}

/**
 * L'ordre de lecture d'une journée : d'abord ce qui a une heure, dans l'ordre
 * des heures ; puis ce qui n'occupe que le jour, par famille.
 *
 * Trier d'abord par famille aurait dispersé les heures — on aurait lu « 9 h,
 * 14 h, puis 10 h », ce qui ne se lit pas.
 */
export function trierEntrees(entrees: EntreeAgenda[]): EntreeAgenda[] {
  return [...entrees].sort((a, b) => {
    const ha = minutesDe(a.start_at);
    const hb = minutesDe(b.start_at);
    if (ha != null && hb != null) return ha - hb || RANG[a.kind] - RANG[b.kind];
    if (ha != null) return -1;
    if (hb != null) return 1;
    return RANG[a.kind] - RANG[b.kind] || a.titre.localeCompare(b.titre);
  });
}

/** Les journées d'une plage, bornes comprises, indexées par date. */
export function entreesDeLaPlage(
  src: SourcesAgenda,
  du: string,
  au: string,
  aujourdhui: string,
): Map<string, EntreeAgenda[]> {
  const parJour = new Map<string, EntreeAgenda[]>();
  for (const jour of joursEntre(du, au)) {
    parJour.set(jour, entreesDuJour(src, jour, aujourdhui));
  }
  return parJour;
}

// ─── Calendriers ─────────────────────────────────────────────────────────────

/** Les dates de `du` à `au`, bornes comprises. */
export function joursEntre(du: string, au: string): string[] {
  const jours: string[] = [];
  const fin = new Date(`${au}T12:00:00`);
  const curseur = new Date(`${du}T12:00:00`);
  // Midi, et pas minuit : un pas de 24 h à partir de minuit tombe à 23 h le
  // jour du passage à l'heure d'été, donc sur la VEILLE. Midi met huit heures
  // de marge de chaque côté du décalage.
  while (curseur <= fin) {
    jours.push(toDateStr(curseur));
    curseur.setDate(curseur.getDate() + 1);
  }
  return jours;
}

/**
 * Le lundi de la semaine de `jour`.
 *
 * ⚠️ La semaine commence le LUNDI, alors que `getDay()` compte à partir du
 * dimanche. Confondre les deux décale toute la grille d'un jour, ce qui se voit
 * mais s'explique mal.
 */
export function lundiDe(jour: string): string {
  const wd = weekdayOf(jour); // 0 = dimanche
  const recul = wd === 0 ? 6 : wd - 1;
  const d = new Date(`${jour}T12:00:00`);
  d.setDate(d.getDate() - recul);
  return toDateStr(d);
}

/** Les sept jours de la semaine de `jour`, du lundi au dimanche. */
export function semaineDe(jour: string): string[] {
  const lundi = lundiDe(jour);
  const fin = new Date(`${lundi}T12:00:00`);
  fin.setDate(fin.getDate() + 6);
  return joursEntre(lundi, toDateStr(fin));
}

/**
 * La grille d'un mois : six semaines pleines, du lundi au dimanche.
 *
 * ⚠️ TOUJOURS six semaines, même quand cinq suffiraient. Une grille dont la
 * hauteur change d'un mois à l'autre fait sauter toute la page en naviguant, et
 * le mois de février commençant un lundi en offre l'exemple le plus brutal.
 */
export function grilleDuMois(jour: string): string[] {
  const d = new Date(`${jour}T12:00:00`);
  const premier = toDateStr(new Date(d.getFullYear(), d.getMonth(), 1, 12));
  const debut = lundiDe(premier);
  const fin = new Date(`${debut}T12:00:00`);
  fin.setDate(fin.getDate() + 41); // 6 × 7 − 1
  return joursEntre(debut, toDateStr(fin));
}

/** Le mois de `jour` au format 'YYYY-MM' — pour savoir ce qui déborde de la grille. */
export function moisDe(jour: string): string {
  return jour.slice(0, 7);
}
