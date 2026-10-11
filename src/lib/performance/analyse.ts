import { addDays, dayStat, weekdayOf, ORDRE_SEMAINE } from "../logic";
import { sansExemples } from "../onboarding/exemples";
import { estRecurrente, SEUIL_REPORT } from "../taches";
import type { Completion, FocusSession, Habit, HabitCheck, Task } from "../types";

/**
 * ⭐ L'ANALYSE DE L'ONGLET PERFORMANCE (2026-10-09).
 *
 * Demande d'Antonin : « le système doit servir à analyser ses performances
 * pour s'améliorer ». L'onglet ne se contente donc plus d'afficher des
 * chiffres : il les COMPARE (à la période d'avant), il les DÉCOUPE (par jour
 * de la semaine, par habitude) et il dit ce qui décroche (`pointsDAttention`).
 *
 * Tout est calculé ici, en fonctions pures — la vue n'affiche que ce que ce
 * module rend, et aucun test de ce dépôt ne sait prouver un graphique.
 *
 * Trois conventions, tenues partout :
 *  • **un jour NEUTRE vaut `null`**, jamais 0 : un jour sans tâche due, ou
 *    avant la première habitude, ne fait ni monter ni descendre une moyenne
 *    (même règle que `computeStreak`) ;
 *  • **une période est faite de jours FINIS** : elle s'arrête à HIER.
 *    Aujourd'hui n'est pas terminé — le compter ferait baisser la moyenne
 *    chaque matin. Il reste dessiné, en dernier point de la courbe ;
 *  • **le contenu de départ ne compte pas** (`sansExemples`), comme partout.
 */

/** Les périodes proposées par l'onglet, en jours. */
export const PLAGES = [7, 30, 90, 180] as const;
export type Plage = (typeof PLAGES)[number];
export const PLAGE_PAR_DEFAUT: Plage = 30;

export function estPlage(n: unknown): n is Plage {
  return (PLAGES as readonly number[]).includes(n as number);
}

export interface PointJour {
  date: string;
  /** 0–100, ou `null` pour un jour neutre. */
  pct: number | null;
}

/** Les bornes d'une période de `plage` jours finis, et de celle d'avant. */
export function bornes(today: string, plage: number): { debut: string; fin: string; debutAvant: string; finAvant: string } {
  const fin = addDays(today, -1);
  const debut = addDays(today, -plage);
  return { debut, fin, debutAvant: addDays(debut, -plage), finAvant: addDays(debut, -1) };
}

function jours(debut: string, fin: string): string[] {
  const out: string[] = [];
  for (let d = debut; d <= fin; d = addDays(d, 1)) out.push(d);
  return out;
}

// ─── Les deux séries de discipline ──────────────────────────────────────────

/**
 * La part des tâches dues faites, jour par jour — la règle de `dayStat`, donc
 * celle de l'anneau de discipline et des séries. `aujourdHui` : le pourcentage
 * de la liste VIVANTE, que seul l'appelant connaît (`pctOfList(todayTasks())`).
 */
export function serieTaches(
  tasks: Task[],
  completions: Completion[],
  debut: string,
  fin: string,
  aujourdHui?: { date: string; pct: number | null },
): PointJour[] {
  return jours(debut, fin).map((date) => ({
    date,
    pct: aujourdHui && date === aujourdHui.date ? aujourdHui.pct : dayStat(tasks, completions, date).pct,
  }));
}

/**
 * Le jour à partir duquel chaque habitude COMPTE : celui de sa première coche.
 *
 * ⚠️ `habits` n'a pas de date de création. Compter une habitude sur tous les
 * jours passés ferait chuter la courbe de trois mois le jour où on en ajoute
 * une. Une habitude jamais cochée ne compte qu'à partir d'aujourd'hui : elle
 * apparaît dans le détail par habitude, à 0 %, sans réécrire le passé.
 */
export function debutsDesHabitudes(habits: readonly Habit[], checks: readonly HabitCheck[], today: string): Map<number, string> {
  const debuts = new Map<number, string>();
  for (const h of sansExemples(habits as Habit[])) debuts.set(h.id, today);
  for (const c of checks) {
    const d = debuts.get(c.habit_id);
    if (d !== undefined && c.date < d) debuts.set(c.habit_id, c.date);
  }
  return debuts;
}

/** La part des habitudes tenues, jour par jour. `null` tant qu'aucune habitude ne compte. */
export function serieHabitudes(
  habits: readonly Habit[],
  checks: readonly HabitCheck[],
  debut: string,
  fin: string,
  today: string,
): PointJour[] {
  const debuts = debutsDesHabitudes(habits, checks, today);
  const cochees = new Map<string, Set<number>>();
  for (const c of checks) {
    if (!debuts.has(c.habit_id)) continue;
    (cochees.get(c.date) ?? cochees.set(c.date, new Set()).get(c.date)!).add(c.habit_id);
  }
  return jours(debut, fin).map((date) => {
    let actives = 0;
    for (const d of debuts.values()) if (d <= date) actives++;
    if (actives === 0) return { date, pct: null };
    return { date, pct: Math.round(((cochees.get(date)?.size ?? 0) / actives) * 100) };
  });
}

// ─── Lire une série ─────────────────────────────────────────────────────────

/** La moyenne des jours qui comptent, arrondie. `null` si aucun ne compte. */
export function moyenne(serie: readonly PointJour[]): number | null {
  const v = serie.map((p) => p.pct).filter((x): x is number => x !== null);
  return v.length ? Math.round(v.reduce((a, x) => a + x, 0) / v.length) : null;
}

/**
 * La moyenne glissante : pour chaque jour, la moyenne des `fenetre` derniers
 * jours QUI COMPTENT (lui compris). C'est elle qui montre la tendance — la
 * série brute monte et descend trop pour qu'on y lise une pente.
 * `null` tant que la fenêtre ne contient aucun jour qui compte.
 */
export function lisser(serie: readonly PointJour[], fenetre = 7): (number | null)[] {
  return serie.map((_, i) => {
    let somme = 0;
    let n = 0;
    for (let k = Math.max(0, i - fenetre + 1); k <= i; k++) {
      const p = serie[k].pct;
      if (p !== null) {
        somme += p;
        n++;
      }
    }
    return n ? Math.round(somme / n) : null;
  });
}

export interface Comparaison {
  valeur: number | null;
  avant: number | null;
  /** `valeur − avant`, ou `null` si l'un des deux manque : pas d'écart inventé. */
  ecart: number | null;
}

export function comparer(valeur: number | null, avant: number | null): Comparaison {
  return { valeur, avant, ecart: valeur !== null && avant !== null ? valeur - avant : null };
}

export interface JourDeSemaine {
  /** 0 = dimanche … 6 = samedi (convention de `Date`). */
  jour: number;
  pct: number | null;
  /** Combien de jours ont compté : un seul lundi ne fait pas « les lundis ». */
  mesures: number;
}

/** La moyenne par jour de la semaine, du lundi au dimanche. */
export function parJourDeSemaine(serie: readonly PointJour[]): JourDeSemaine[] {
  const par = new Map<number, number[]>();
  for (const p of serie) {
    if (p.pct === null) continue;
    const wd = weekdayOf(p.date);
    (par.get(wd) ?? par.set(wd, []).get(wd)!).push(p.pct);
  }
  return ORDRE_SEMAINE.map((jour) => {
    const v = par.get(jour) ?? [];
    return { jour, pct: v.length ? Math.round(v.reduce((a, x) => a + x, 0) / v.length) : null, mesures: v.length };
  });
}

// ─── Par habitude ───────────────────────────────────────────────────────────

export interface TenueHabitude {
  habit: Habit;
  /** Jours tenus / jours comptés sur la période (depuis sa première coche). */
  tenus: number;
  comptes: number;
  pct: number | null;
  /** Le même taux sur la période d'avant, pour dire si elle monte ou décroche. */
  avant: number | null;
}

export function tenueParHabitude(
  habits: readonly Habit[],
  checks: readonly HabitCheck[],
  today: string,
  plage: number,
): TenueHabitude[] {
  const b = bornes(today, plage);
  const debuts = debutsDesHabitudes(habits, checks, today);
  const parHabitude = new Map<number, Set<string>>();
  for (const c of checks) (parHabitude.get(c.habit_id) ?? parHabitude.set(c.habit_id, new Set()).get(c.habit_id)!).add(c.date);

  const taux = (id: number, debut: string, fin: string) => {
    const depuis = debuts.get(id)!;
    const de = depuis > debut ? depuis : debut;
    if (de > fin) return { tenus: 0, comptes: 0, pct: null as number | null };
    const dates = parHabitude.get(id) ?? new Set<string>();
    const liste = jours(de, fin);
    const tenus = liste.filter((d) => dates.has(d)).length;
    return { tenus, comptes: liste.length, pct: Math.round((tenus / liste.length) * 100) };
  };

  return sansExemples(habits as Habit[]).map((habit) => {
    const ici = taux(habit.id, b.debut, b.fin);
    return { habit, ...ici, avant: taux(habit.id, b.debutAvant, b.finAvant).pct };
  });
}

// ─── Le focus ───────────────────────────────────────────────────────────────

/** Minutes d'une séance terminée (arrondies), 0 sinon. */
export function minutesDeSeance(s: Pick<FocusSession, "started_at" | "ended_at">): number {
  if (!s.ended_at) return 0;
  const ms = new Date(s.ended_at.replace(" ", "T")).getTime() - new Date(s.started_at.replace(" ", "T")).getTime();
  return Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0;
}

/** Les séances de FOCUS terminées dont le début tombe dans la période. */
export function seancesDeFocus(sessions: readonly FocusSession[], debut: string, fin: string): FocusSession[] {
  return sessions.filter((s) => {
    if (s.kind !== "focus" || !s.ended_at) return false;
    const jour = s.started_at.slice(0, 10);
    return jour >= debut && jour <= fin;
  });
}

export function minutesDeFocus(sessions: readonly FocusSession[], debut: string, fin: string): number {
  return seancesDeFocus(sessions, debut, fin).reduce((a, s) => a + minutesDeSeance(s), 0);
}

export interface TrancheFocus {
  /** Premier jour de la tranche. */
  debut: string;
  minutes: number;
}

/**
 * Le focus dans le temps : par JOUR jusqu'à 30 jours, par SEMAINE au-delà
 * (cent quatre-vingts barres d'un pixel ne se lisent pas). Les tranches vides
 * restent, à zéro : un trou dans le rythme est une information.
 */
export function focusDansLeTemps(sessions: readonly FocusSession[], debut: string, fin: string): { pas: "jour" | "semaine"; tranches: TrancheFocus[] } {
  const liste = jours(debut, fin);
  const parJour = new Map<string, number>();
  for (const s of seancesDeFocus(sessions, debut, fin)) {
    const j = s.started_at.slice(0, 10);
    parJour.set(j, (parJour.get(j) ?? 0) + minutesDeSeance(s));
  }
  if (liste.length <= 31) return { pas: "jour", tranches: liste.map((d) => ({ debut: d, minutes: parJour.get(d) ?? 0 })) };
  const tranches: TrancheFocus[] = [];
  for (let i = 0; i < liste.length; i += 7) {
    const semaine = liste.slice(i, i + 7);
    tranches.push({ debut: semaine[0], minutes: semaine.reduce((a, d) => a + (parJour.get(d) ?? 0), 0) });
  }
  return { pas: "semaine", tranches };
}

// ─── Ce qui décroche ────────────────────────────────────────────────────────

/**
 * Un point d'attention : UN fait, UN chiffre, et le module où agir.
 *
 * ⚠️ Ce ne sont pas des conseils. L'app dit ce qu'elle MESURE (« le jeudi,
 * 41 % ») ; ce qu'il faut en faire appartient à l'utilisateur. Aucune phrase
 * n'est rédigée ici : la vue traduit chaque genre (`t()`), ce module ne rend
 * que des nombres.
 */
export type PointDAttention =
  | { genre: "reports"; n: number }
  | { genre: "habitude"; habitId: number; nom: string; pct: number; avant: number | null }
  | { genre: "jour-faible"; quoi: "taches" | "habitudes"; jour: number; pct: number; moyenne: number }
  | { genre: "baisse"; quoi: "taches" | "habitudes"; ecart: number; valeur: number }
  | { genre: "focus"; minutes: number; avant: number };

/** Les seuils — écrits une fois, lus par les tests. */
export const SEUILS = {
  /** Une habitude tenue moins d'un jour sur deux… */
  habitudeFaible: 50,
  /** …ou qui a perdu au moins vingt points décroche. */
  habitudeChute: 20,
  /** Il faut une semaine de recul pour juger une habitude. */
  habitudeJours: 7,
  /** Un jour de la semaine se signale à quinze points sous la moyenne… */
  jourEcart: 15,
  /** …et seulement s'il a été mesuré deux fois (un seul lundi n'est pas « le lundi »). */
  jourMesures: 2,
  /** Une moyenne qui perd dix points d'une période à l'autre. */
  baisse: 10,
  /** Un focus qui perd 30 %, sur une base d'au moins une heure. */
  focusChute: 0.3,
  focusBase: 60,
  /** Jamais plus de trois : au-delà, on ne lit plus rien. */
  max: 3,
} as const;

export function pointsDAttention(p: {
  tasks: Task[];
  completions: Completion[];
  habits: readonly Habit[];
  habitChecks: readonly HabitCheck[];
  focusSessions: readonly FocusSession[];
  today: string;
  plage: number;
}): PointDAttention[] {
  const { today, plage } = p;
  const b = bornes(today, plage);
  const points: PointDAttention[] = [];

  // 1) Ce qui attend une décision : les tâches reportées trop de fois, pas faites.
  const faites = new Set(p.completions.filter((c) => c.done).map((c) => c.task_id));
  const reports = sansExemples(p.tasks).filter(
    (t) => !estRecurrente(t) && !faites.has(t.id) && (t.postponed_count ?? 0) >= SEUIL_REPORT,
  ).length;
  if (reports > 0) points.push({ genre: "reports", n: reports });

  // 2) L'habitude qui décroche le plus.
  const tenues = tenueParHabitude(p.habits, p.habitChecks, today, plage)
    .filter((h) => h.pct !== null && h.comptes >= Math.min(SEUILS.habitudeJours, plage))
    .filter((h) => h.pct! < SEUILS.habitudeFaible || (h.avant !== null && h.avant - h.pct! >= SEUILS.habitudeChute))
    .sort((a, c) => a.pct! - c.pct!);
  if (tenues[0]) {
    const h = tenues[0];
    points.push({ genre: "habitude", habitId: h.habit.id, nom: h.habit.name, pct: h.pct!, avant: h.avant });
  }

  // 3) Le jour de la semaine le plus faible — des tâches, sinon des habitudes.
  const sTaches = serieTaches(p.tasks, p.completions, b.debut, b.fin);
  const sHabitudes = serieHabitudes(p.habits, p.habitChecks, b.debut, b.fin, today);
  for (const [quoi, serie] of [["taches", sTaches], ["habitudes", sHabitudes]] as const) {
    const moy = moyenne(serie);
    if (moy === null) continue;
    const faible = parJourDeSemaine(serie)
      .filter((j) => j.pct !== null && j.mesures >= SEUILS.jourMesures && moy - j.pct >= SEUILS.jourEcart)
      .sort((a, c) => a.pct! - c.pct!)[0];
    if (faible) {
      points.push({ genre: "jour-faible", quoi, jour: faible.jour, pct: faible.pct!, moyenne: moy });
      break; // un seul jour faible : deux se liraient comme une liste de reproches
    }
  }

  // 4) Une moyenne qui baisse d'une période à l'autre.
  for (const [quoi, serie, avant] of [
    ["taches", sTaches, serieTaches(p.tasks, p.completions, b.debutAvant, b.finAvant)],
    ["habitudes", sHabitudes, serieHabitudes(p.habits, p.habitChecks, b.debutAvant, b.finAvant, today)],
  ] as const) {
    const c = comparer(moyenne(serie), moyenne(avant));
    if (c.ecart !== null && c.ecart <= -SEUILS.baisse) points.push({ genre: "baisse", quoi, ecart: c.ecart, valeur: c.valeur! });
  }

  // 5) Le focus qui s'effondre.
  const minutes = minutesDeFocus(p.focusSessions, b.debut, b.fin);
  const minutesAvant = minutesDeFocus(p.focusSessions, b.debutAvant, b.finAvant);
  if (minutesAvant >= SEUILS.focusBase && minutes <= minutesAvant * (1 - SEUILS.focusChute)) {
    points.push({ genre: "focus", minutes, avant: minutesAvant });
  }

  return points.slice(0, SEUILS.max);
}
