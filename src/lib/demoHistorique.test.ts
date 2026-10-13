import { describe, expect, it } from "vitest";
import { JOURS_BLANCS, SEMAINES_DEMO, debutHistoriqueDemo, debutRoutineDemo, historiqueDemo, lundiDemo } from "./demoHistorique";
import { addDays, computeStreak, dayStat, weekdayOf } from "./logic";
import { moyenne, pointsDAttention, serieHabitudes, serieTaches, tenueParHabitude } from "./performance/analyse";
import type { Completion, Habit, HabitCheck, Task } from "./types";

/**
 * L'historique de la démo doit avoir l'air VÉCU, et se tenir d'un écran à l'autre.
 *
 * Deux retours d'Antonin, le 2026-10-13 : le Journal affichait un damier (trois
 * règles fixes), puis — le damier parti — trois habitudes ne suffisaient pas,
 * aucun jour n'était manqué, et la discipline des tâches n'avait que douze jours
 * d'historique face à deux mois d'habitudes. Ce test ne juge pas l'esthétique :
 * il refuse le retour d'une règle, et tient l'accord entre tâches et habitudes.
 *
 * Tout est balayé sur sept jours consécutifs : l'historique est calé sur les
 * semaines, il ne doit dépendre du jour où l'on ouvre la démo que par sa fin.
 */

// `today` est un paramètre : une date fixe ne vieillit pas.
const MARDI = "2026-10-13";
const SEMAINE = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(MARDI, n));

const IDS_HABITUDES = [1, 2, 3, 4, 5, 6, 7, 8];
const habits: Habit[] = IDS_HABITUDES.map((id) => ({ id, name: id === 2 ? "Sport" : `H${id}`, color: "x", archived: 0, is_example: 0 }));

/** Les quatre routines de `demo.ts` : même récurrence, même naissance. */
const routines = (today: string): Task[] =>
  (["daily", "weekdays", "[1,3,5]", "weekdays"] as const).map(
    (recurrence, k) =>
      ({
        id: k + 1, label: `T${k + 1}`, tag: null, priority: "medium", recurrence, goal_id: null,
        created_at: debutRoutineDemo(k + 1, today), due_date: null, start_at: null, end_at: null,
        postponed_count: 0, postponed_from: null, is_example: 0,
      }) as Task,
  );

const coches = (today: string): HabitCheck[] =>
  historiqueDemo(today).flatMap((j) => j.habitudes.map((habit_id) => ({ id: 0, habit_id, date: j.date })));

const faites = (today: string): Completion[] =>
  historiqueDemo(today).flatMap((j) => j.routines.map((task_id) => ({ id: 0, task_id, date: j.date, done: 1 })));

const blancs = (today: string) => JOURS_BLANCS.map(([s, j]) => addDays(debutHistoriqueDemo(today), 7 * s + j));

describe("l'historique du jeu de démonstration", () => {
  it("va du lundi d'il y a huit semaines à hier, un jour après l'autre", () => {
    for (const today of SEMAINE) {
      const h = historiqueDemo(today);
      expect(weekdayOf(h[0].date)).toBe(1);
      expect(h[0].date).toBe(lundiDemo(today, SEMAINES_DEMO - 1));
      expect(h[h.length - 1].date).toBe(addDays(today, -1));
      expect(h.map((j) => j.date)).toEqual(h.map((_, k) => addDays(h[0].date, k)));
    }
  });

  it("⭐ tâches et habitudes racontent la même période : toutes deux commencent le premier jour", () => {
    for (const today of SEMAINE) {
      const [premier] = historiqueDemo(today);
      expect(premier.habitudes.length, today).toBeGreaterThan(0);
      expect(premier.routines.length, today).toBeGreaterThan(0);
      // …et la discipline des tâches se mesure dès ce jour-là : pas de plateau à 0 % en tête de courbe.
      const serie = serieTaches(routines(today), faites(today), premier.date, addDays(today, -1));
      expect(serie.every((p) => p.pct !== null), today).toBe(true);
      expect(serie[0].pct, today).toBe(100);
    }
  });

  it("huit habitudes, chacune tenue et manquée, aucune née après les autres de plus de quatre semaines", () => {
    for (const today of SEMAINE) {
      const h = historiqueDemo(today);
      for (const id of IDS_HABITUDES) {
        const premiere = h.findIndex((j) => j.habitudes.includes(id));
        expect(premiere, `habitude ${id}, ${today}`).toBeGreaterThanOrEqual(0);
        expect(premiere, `habitude ${id}, ${today}`).toBeLessThan(7 * 5);
        expect(h.slice(premiere).some((j) => !j.habitudes.includes(id)), `habitude ${id}, ${today}`).toBe(true);
      }
      expect(new Set(h.flatMap((j) => j.habitudes))).toEqual(new Set(IDS_HABITUDES));
    }
  });

  it("⭐ quelques jours BLANCS, et eux seuls : ni habitude tenue, ni routine faite", () => {
    expect(JOURS_BLANCS.length).toBeGreaterThanOrEqual(2);
    expect(JOURS_BLANCS.length).toBeLessThanOrEqual(5);
    for (const today of SEMAINE) {
      const h = historiqueDemo(today);
      const sansHabitude = h.filter((j) => j.habitudes.length === 0).map((j) => j.date);
      expect(sansHabitude, today).toEqual(blancs(today));
      for (const date of blancs(today)) {
        expect(h.find((j) => j.date === date)!.routines, `${date}, ${today}`).toEqual([]);
        expect(dayStat(routines(today), faites(today), date).pct, `${date}, ${today}`).toBe(0);
      }
    }
  });

  it("un mauvais jour l'est pour tout : la discipline des tâches suit celle des habitudes", () => {
    for (const today of SEMAINE) {
      const debut = debutHistoriqueDemo(today);
      const hier = addDays(today, -1);
      const taches = serieTaches(routines(today), faites(today), debut, hier);
      const habitudes = serieHabitudes(habits, coches(today), debut, hier, today);
      const tachesQuand = (garde: (pct: number) => boolean) =>
        moyenne(taches.filter((_, k) => habitudes[k].pct !== null && garde(habitudes[k].pct!)))!;
      expect(tachesQuand((p) => p >= 50), today).toBeGreaterThan(tachesQuand((p) => p < 30) + 20);
    }
  });

  it("aucune habitude ne suit une règle : ni un jour sur deux, ni la même semaine répétée", () => {
    // Les trois anciennes règles se recopiaient à l'identique deux ou sept jours plus loin.
    const recopie = (s: string, pas: number) => [...s.slice(pas)].filter((c, k) => c === s[k]).length / (s.length - pas);
    for (const today of SEMAINE) {
      const h = historiqueDemo(today);
      for (const id of IDS_HABITUDES) {
        const s = h.map((j) => (j.habitudes.includes(id) ? "1" : "0")).join("");
        const depuis = s.slice(s.indexOf("1"));
        expect(recopie(depuis, 2), `habitude ${id}, pas de 2, ${today}`).toBeLessThan(0.9);
        expect(recopie(depuis, 7), `habitude ${id}, pas de 7, ${today}`).toBeLessThan(0.9);
      }
    }
  });

  it("le week-end est plus faible que la semaine, quel que soit le jour où l'on ouvre la démo", () => {
    for (const today of SEMAINE) {
      const serie = serieHabitudes(habits, coches(today), debutHistoriqueDemo(today), addDays(today, -1), today);
      const part = (weekEnd: boolean) => moyenne(serie.filter((p) => (weekdayOf(p.date) === 0 || weekdayOf(p.date) === 6) === weekEnd))!;
      expect(part(true), today).toBeLessThan(part(false) - 10);
    }
  });

  it("la série en cours tient toute la semaine : sept jours un mardi, jamais moins de six", () => {
    for (const today of SEMAINE) {
      const serie = computeStreak(routines(today), faites(today), today, null);
      expect(serie, today).toBeGreaterThanOrEqual(6);
      expect(serie, today).toBeLessThanOrEqual(13);
    }
    expect(computeStreak(routines(MARDI), faites(MARDI), MARDI, null)).toBe(7);
  });

  it("Performance garde de quoi dire sur 30 jours : le sport reste l'habitude la plus faible, sous un jour sur deux", () => {
    for (const today of SEMAINE) {
      const tenues = tenueParHabitude(habits, coches(today), today, 30);
      const sport = tenues.find((x) => x.habit.id === 2)!;
      expect(sport.pct, today).toBeGreaterThanOrEqual(40);
      expect(sport.pct, today).toBeLessThan(50);
      expect(Math.min(...tenues.map((x) => x.pct!)), today).toBe(sport.pct);

      const points = pointsDAttention({ tasks: routines(today), completions: faites(today), habits, habitChecks: coches(today), focusSessions: [], today, plage: 30 });
      expect(points, today).toContainEqual(expect.objectContaining({ genre: "habitude", nom: "Sport" }));
    }
  });
});
