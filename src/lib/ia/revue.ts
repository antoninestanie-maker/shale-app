// ─────────────────────────────────────────────────────────────────────────────
// Phase G — la revue hebdomadaire (#18) : les FAITS de la semaine.
//
// Tout ce qui est chiffré est calculé ICI (complétion, focus, objectifs,
// reports) ; le modèle reçoit ces faits et rédige : ce qui a tenu, ce qui a
// glissé, trois ajustements — chacun transformable en tâche, à valider.
//
// ⭐ LE JOURNAL EST SENSIBLE. Rien n'en part par défaut. Si l'utilisateur coche
// « inclure l'humeur et l'énergie de mon Journal », seules les NOTES CHIFFRÉES
// (1 à 5) partent — jamais le texte d'une entrée. Réglage `ia.revue.journal`,
// éteint par défaut.
//
// Une revue par semaine, rangée au LUNDI de la semaine (`ia_contenus`,
// `kind = 'revue'`), synchronisée comme le brief. Le dimanche, la revue porte
// sur la semaine qui s'achève ; les autres jours, sur la dernière semaine
// complète.
// ─────────────────────────────────────────────────────────────────────────────

import { objectifsEnPeril } from "../calendrier/peril";
import { addDays, isDueOn, weekdayOf } from "../logic";
import { mesurer, type ContexteProgression } from "../objectifs/progression";
import { createTask, getSetting, setSetting } from "../repo";
import { estRecurrente, planificationDeSaisie } from "../taches";
import type { AppData, Goal } from "../types";
import { SORTIES, type LangIa, type PayloadDe, type SortieDe } from "./contrats";
import { descendants } from "./planifier";
import { valider } from "./schema";

const CLE_JOURNAL = "ia.revue.journal";

export async function lireInclureJournal(): Promise<boolean> {
  return (await getSetting(CLE_JOURNAL).catch(() => null)) === "1";
}

export async function ecrireInclureJournal(oui: boolean): Promise<void> {
  await setSetting(CLE_JOURNAL, oui ? "1" : "0");
}

export interface Semaine {
  /** Le lundi, 'YYYY-MM-DD' — c'est aussi la clé de stockage de la revue. */
  debut: string;
  /** Le dimanche. */
  fin: string;
}

/**
 * La semaine dont on fait la revue : celle qui s'achève si l'on est dimanche,
 * sinon la dernière semaine complète (lundi → dimanche).
 */
export function semaineDeRevue(jour: string): Semaine {
  const wd = weekdayOf(jour); // 0 = dimanche
  const fin = wd === 0 ? jour : addDays(jour, -wd);
  return { debut: addDays(fin, -6), fin };
}

function joursDe(s: Semaine): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(s.debut, i));
}

function moyenne(xs: number[]): number | null {
  return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null;
}

function minutesFocus(data: AppData, debut: string, fin: string): { minutes: number; sessions: number; jours: number } {
  let minutes = 0;
  let sessions = 0;
  const jours = new Set<string>();
  for (const f of data.focusSessions) {
    if (f.kind !== "focus" || !f.ended_at) continue;
    const jour = f.started_at.slice(0, 10);
    if (jour < debut || jour > fin) continue;
    const m = (Date.parse(f.ended_at.replace(" ", "T")) - Date.parse(f.started_at.replace(" ", "T"))) / 60_000;
    if (!(m > 0)) continue;
    minutes += m;
    sessions++;
    jours.add(jour);
  }
  return { minutes: Math.round(minutes), sessions, jours: jours.size };
}

/**
 * Les faits de la semaine, tels qu'ils partent au modèle.
 *
 *   • complétion — par jour : ce qui était prévu (routines dues ce jour-là,
 *     tâches datées de ce jour) et ce qui en a été fait ; plus les tâches faites
 *     hors de ce qui était prévu ;
 *   • focus — minutes et séances du Timer, et les minutes de la semaine d'avant ;
 *   • objectifs — les objectifs racines : avancement mesuré, tâches faites dans
 *     la semaine sur l'objectif et ses étapes, en péril ou non ;
 *   • reports — les tâches pas faites qui ont glissé, les plus reportées d'abord ;
 *   • journal — `null` sauf accord explicite ; sinon les notes chiffrées seules.
 */
export function payloadRevue(
  lang: LangIa,
  jour: string,
  semaine: Semaine,
  data: AppData,
  inclureJournal: boolean,
  contexte: Partial<ContexteProgression> = {},
): PayloadDe<"revue"> {
  const jours = joursDe(semaine);
  const dansLaSemaine = (d: string) => d >= semaine.debut && d <= semaine.fin;
  const faitesLe = new Map<string, Set<number>>();
  for (const c of data.completions) {
    if (!c.done || !dansLaSemaine(c.date)) continue;
    if (!faitesLe.has(c.date)) faitesLe.set(c.date, new Set());
    faitesLe.get(c.date)!.add(c.task_id);
  }

  let horsPrevu = 0;
  const parJour = jours.map((j) => {
    const prevues = data.tasks.filter((t) => (estRecurrente(t) ? isDueOn(t, j) : t.due_date === j));
    const faites = faitesLe.get(j) ?? new Set<number>();
    const ids = new Set(prevues.map((t) => t.id));
    const faitesPrevues = prevues.filter((t) => faites.has(t.id)).length;
    horsPrevu += [...faites].filter((id) => !ids.has(id)).length;
    return { jour: j, prevues: prevues.length, faites: faitesPrevues };
  });
  const prevues = parJour.reduce((a, d) => a + d.prevues, 0);
  const faites = parJour.reduce((a, d) => a + d.faites, 0);

  const focus = minutesFocus(data, semaine.debut, semaine.fin);
  const avant = minutesFocus(data, addDays(semaine.debut, -7), addDays(semaine.fin, -7));

  const sources = { goals: data.goals, tasks: data.tasks, completions: data.completions, ...contexte, maintenant: contexte.maintenant ?? `${jour} 00:00` };
  const enPeril = new Set(objectifsEnPeril(data.goals, data.tasks, data.completions, jour, contexte).map((p) => p.goal.id));
  const racines = data.goals.filter((g) => g.parent_goal_id == null && !g.is_example);
  const objectifs = racines.slice(0, 12).map((g: Goal) => {
    const arbre = [g, ...descendants(g, data.goals)];
    const ids = new Set(arbre.map((x) => x.id));
    const siennes = new Set(data.tasks.filter((t) => t.goal_id != null && ids.has(t.goal_id)).map((t) => t.id));
    const tachesFaites = data.completions.filter((c) => c.done && dansLaSemaine(c.date) && siennes.has(c.task_id)).length;
    const m = mesurer(g, sources);
    return {
      titre: g.title.slice(0, 200),
      progression: Math.max(0, Math.min(100, Math.round(m.pct ?? g.progress_pct ?? 0))),
      tachesFaites,
      enPeril: arbre.some((x) => enPeril.has(x.id)),
    };
  });

  const faitesUnJour = new Set(data.completions.filter((c) => c.done).map((c) => c.task_id));
  const glissees = data.tasks
    .filter((t) => !estRecurrente(t) && (t.postponed_count ?? 0) > 0 && !faitesUnJour.has(t.id))
    .sort((a, b) => b.postponed_count - a.postponed_count || a.id - b.id);

  let journal: PayloadDe<"revue">["journal"] = null;
  if (inclureJournal) {
    const entrees = data.journal.filter((e) => dansLaSemaine(e.date));
    const note = (x: number | null) => (typeof x === "number" && x >= 1 && x <= 5 ? Math.round(x) : null);
    // ⚠️ Jamais `e.body` : seules les deux notes chiffrées quittent l'appareil.
    const lignes = jours.map((j) => {
      const e = entrees.find((x) => x.date === j);
      return { jour: j, humeur: note(e?.mood ?? null), energie: note(e?.energy ?? null) };
    });
    journal = {
      humeurMoyenne: moyenne(lignes.map((l) => l.humeur).filter((x): x is number => x !== null)),
      energieMoyenne: moyenne(lignes.map((l) => l.energie).filter((x): x is number => x !== null)),
      parJour: lignes,
    };
  }

  return {
    lang,
    jour,
    semaine: { debut: semaine.debut, fin: semaine.fin },
    completion: { prevues, faites, faitesHorsPrevu: horsPrevu, parJour },
    focus: { minutes: focus.minutes, sessions: focus.sessions, joursActifs: focus.jours, minutesSemainePrecedente: avant.minutes },
    objectifs,
    reports: {
      taches: glissees.length,
      plusReportees: glissees.slice(0, 5).map((t) => ({ titre: t.label.slice(0, 200), reports: Math.min(1000, t.postponed_count) })),
    },
    journal,
  };
}

// ── La revue stockée ────────────────────────────────────────────────────────

/**
 * Ce que pèse une revue dans le quota (copie de `ai_config.weight`, migration
 * 008 du site — gardée par `contrat.test.ts`). L'écran le dit AVANT l'appel.
 */
export const POIDS_REVUE = 5;

export type RevueStockee = SortieDe<"revue"> & {
  genereLe: string;
  semaine: Semaine;
  /** Les ajustements (par leur rang, 0 à 2) déjà transformés en tâche. */
  crees: number[];
};

/** Une revue relue de la base (ou venue d'un autre appareil) est revalidée. */
export function revueLisible(contenu: unknown): RevueStockee | null {
  if (typeof contenu !== "object" || contenu === null) return null;
  const { genereLe, semaine, crees, ...sortie } = contenu as Record<string, unknown>;
  if (typeof genereLe !== "string") return null;
  const s = semaine as Partial<Semaine> | undefined;
  if (!s || typeof s.debut !== "string" || typeof s.fin !== "string") return null;
  if (valider(SORTIES.revue, sortie).length > 0) return null;
  const faits = Array.isArray(crees) ? crees.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < 3) : [];
  return { ...(sortie as SortieDe<"revue">), genereLe, semaine: { debut: s.debut, fin: s.fin }, crees: [...new Set(faits)] };
}

/** Un ajustement validé devient une tâche — datée s'il portait une date. */
export async function appliquerAjustement(a: SortieDe<"revue">["ajustements"][number]): Promise<number> {
  return createTask({
    label: a.titre.trim(),
    tag: null,
    priority: "medium",
    recurrence: "none",
    goal_id: null,
    ...planificationDeSaisie("none", a.date ?? "", "", ""),
  });
}
