// ─────────────────────────────────────────────────────────────────────────────
// Le brief du matin et la clôture du soir, côté app (fonctions #1, #2, #3).
//
// Principe 1 du chantier : LE LOCAL CALCULE. Les événements du jour, les trois
// priorités, la surcharge, ce qui est fait et ce qui reste : tout est calculé
// ici, avec les fonctions du Calendrier et des Tâches, et part comme DONNÉES.
// Le modèle ne rédige que deux ou trois phrases autour.
//
// Principe 2 : la clôture PROPOSE des reports ; `appliquerProposition` n'est
// appelée que sur ce que l'utilisateur a coché dans les brouillons. Une
// suppression passe par la corbeille (30 jours), jamais en dur.
// ─────────────────────────────────────────────────────────────────────────────

import { chargeDuJour } from "../calendrier/charge";
import { profilDisponibilite } from "../calendrier/disponibilite";
import { entreesDuJour } from "../calendrier/agenda";
import { todayTasks } from "../logic";
import { appliquerReport, getSetting, mettreEnCorbeille, setSetting, setTaskSchedule } from "../repo";
import { estRecurrente } from "../taches";
import type { AppData, CalendarEvent, Priority, Task } from "../types";
import type { ActionCloture, ContratsIa, JourneeBrief, LangIa } from "./contrats";

// ── Réglages du brief ────────────────────────────────────────────────────────

export interface SujetBrief {
  nom: string;
  flux: string[];
}

export const SUJETS_MAX = 5;
export const FLUX_PAR_SUJET_MAX = 5;

const CLE_SUJETS = "ia.brief.sujets";
const CLE_HEURE_BRIEF = "ia.brief.heure";
const CLE_HEURE_CLOTURE = "ia.cloture.heure";
export const HEURE_BRIEF_DEFAUT = "07:00";
export const HEURE_CLOTURE_DEFAUT = "20:00";

/** Une URL de flux acceptable CÔTÉ APP : https, bien formée. Le serveur refait
 *  un contrôle bien plus strict (adresses publiques, redirections). */
export function urlFluxValide(u: string): boolean {
  try {
    const x = new URL(u.trim());
    return x.protocol === "https:" && !!x.hostname;
  } catch {
    return false;
  }
}

/** Lecture pure : ce qui est illisible ou hors bornes est écarté. */
export function sujetsDepuis(brut: string | null): SujetBrief[] {
  if (!brut) return [];
  try {
    const v: unknown = JSON.parse(brut);
    if (!Array.isArray(v)) return [];
    return v
      .filter((s): s is { nom: unknown; flux: unknown } => typeof s === "object" && s !== null)
      .map((s) => ({
        nom: typeof s.nom === "string" ? s.nom.trim().slice(0, 60) : "",
        flux: Array.isArray(s.flux) ? s.flux.filter((u): u is string => typeof u === "string" && urlFluxValide(u)).slice(0, FLUX_PAR_SUJET_MAX) : [],
      }))
      .filter((s) => s.nom)
      .slice(0, SUJETS_MAX);
  } catch {
    return [];
  }
}

export async function lireSujets(): Promise<SujetBrief[]> {
  return sujetsDepuis(await getSetting(CLE_SUJETS));
}

export async function ecrireSujets(sujets: SujetBrief[]): Promise<void> {
  await setSetting(CLE_SUJETS, JSON.stringify(sujetsDepuis(JSON.stringify(sujets))));
}

function heureValide(h: string | null, defaut: string): string {
  return h && /^([01]\d|2[0-3]):[0-5]\d$/.test(h) ? h : defaut;
}

export async function lireHeures(): Promise<{ brief: string; cloture: string }> {
  const [b, c] = await Promise.all([getSetting(CLE_HEURE_BRIEF), getSetting(CLE_HEURE_CLOTURE)]);
  return { brief: heureValide(b, HEURE_BRIEF_DEFAUT), cloture: heureValide(c, HEURE_CLOTURE_DEFAUT) };
}

export async function ecrireHeure(quoi: "brief" | "cloture", hhmm: string): Promise<void> {
  await setSetting(quoi === "brief" ? CLE_HEURE_BRIEF : CLE_HEURE_CLOTURE, heureValide(hhmm, quoi === "brief" ? HEURE_BRIEF_DEFAUT : HEURE_CLOTURE_DEFAUT));
}

/** « HH:MM » locale de `maintenant`. */
export function heureDe(maintenant: Date): string {
  return `${String(maintenant.getHours()).padStart(2, "0")}:${String(maintenant.getMinutes()).padStart(2, "0")}`;
}

// ── Les faits de la journée (#2) ─────────────────────────────────────────────

const RANG: Readonly<Record<Priority, number>> = { high: 0, medium: 1, low: 2 };

/** Les faits que le brief envoie pour « ta journée » — tous calculés ici. */
export function faitsDeLaJournee(data: AppData, events: readonly CalendarEvent[], jour: string): JourneeBrief {
  const entrees = entreesDuJour(
    { events: [...events], tasks: data.tasks, completions: data.completions, goals: data.goals },
    jour,
    jour,
  );
  const charge = chargeDuJour(entrees, profilDisponibilite(data.focusSessions), jour);
  const aFaire = todayTasks(data.tasks, data.completions, jour).filter((t) => !t.done);
  const priorites = [...aFaire]
    .sort(
      (a, b) =>
        RANG[a.priority] - RANG[b.priority] ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
        a.label.localeCompare(b.label),
    )
    .slice(0, 3)
    .map((t) => ({ titre: t.label.slice(0, 200) }));
  const evenements = entrees
    .filter((e) => e.kind === "event")
    .sort((a, b) => (a.start_at ?? "").localeCompare(b.start_at ?? ""))
    .slice(0, 30)
    .map((e) => ({ titre: e.titre.slice(0, 200), heure: e.allDay ? null : e.start_at }));
  return { evenements, priorites, tachesPrevues: aFaire.length, surcharge: charge.surchargee };
}

export function payloadBrief(
  lang: LangIa,
  jour: string,
  sujets: readonly SujetBrief[],
  journee: JourneeBrief,
  regenerer: boolean,
): ContratsIa["brief"]["payload"] {
  return {
    lang,
    jour,
    regenerer,
    sujets: sujets.slice(0, SUJETS_MAX).map((s) => ({ nom: s.nom.slice(0, 60), flux: s.flux.slice(0, FLUX_PAR_SUJET_MAX) })),
    journee,
  };
}

// ── La clôture (#3) ──────────────────────────────────────────────────────────

/** Les tâches qu'une clôture peut reporter : ponctuelles, datées au plus tard
 *  aujourd'hui, pas faites. Une récurrente ne se reporte pas (ses occurrences
 *  se calculent), une tâche sans date n'a rien à reporter. */
export function tachesAReporter(data: AppData, jour: string): Task[] {
  return todayTasks(data.tasks, data.completions, jour)
    .filter((t) => !t.done && !estRecurrente(t) && t.due_date !== null && t.due_date <= jour)
    .slice(0, 30);
}

export function payloadCloture(lang: LangIa, jour: string, data: AppData): ContratsIa["cloture"]["payload"] {
  const faitesIds = new Set(data.completions.filter((c) => c.date === jour && c.done).map((c) => c.task_id));
  return {
    lang,
    jour,
    faites: data.tasks
      .filter((t) => faitesIds.has(t.id))
      .slice(0, 50)
      .map((t) => ({ titre: t.label.slice(0, 200) })),
    restantes: tachesAReporter(data, jour).map((t) => ({
      id: String(t.id),
      titre: t.label.slice(0, 200),
      priorite: t.priority,
      echeance: t.due_date,
      reports: t.postponed_count ?? 0,
    })),
  };
}

export function lendemain(jour: string): string {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export interface PropositionCloture {
  tache: Task;
  action: ActionCloture;
  date: string | null;
  raison: string;
}

/** Les propositions du modèle, rattachées à leurs tâches. Une proposition dont
 *  la tâche a disparu entre-temps est écartée. */
export function propositionsDe(
  sortie: ContratsIa["cloture"]["sortie"],
  data: AppData,
): PropositionCloture[] {
  const parId = new Map(data.tasks.map((t) => [String(t.id), t]));
  return sortie.propositions.flatMap((p) => {
    const tache = parId.get(p.id);
    return tache ? [{ tache, action: p.action, date: p.date, raison: p.raison }] : [];
  });
}

/** Applique UNE proposition validée par l'utilisateur. */
export async function appliquerProposition(p: PropositionCloture, jour: string): Promise<void> {
  const t = p.tache;
  const vers = (d: string) =>
    appliquerReport(t.id, {
      due_date: d,
      postponed_count: (t.postponed_count ?? 0) + 1,
      postponed_from: t.postponed_from ?? t.due_date ?? jour,
    });
  switch (p.action) {
    case "demain":
      return vers(lendemain(jour));
    case "date":
      // Une date absente ou passée (l'utilisateur a pu la corriger) retombe sur demain.
      return vers(p.date && p.date > jour ? p.date : lendemain(jour));
    case "plus_tard":
      return setTaskSchedule(t.id, null, null, null);
    case "supprimer":
      await mettreEnCorbeille("task", t.id);
      return;
  }
}
