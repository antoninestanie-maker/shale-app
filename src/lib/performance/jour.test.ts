import { describe, expect, it } from "vitest";
import { addDays, todayTasks } from "../logic";
import type { Completion, FocusSession, Habit, HabitCheck, Task } from "../types";
import { bornes, comparer, minutesDeFocus, moyenne, serieHabitudes, serieTaches } from "./analyse";
import { jourEnCours, periodeSansMesure } from "./jour";

// `today` est un PARAMÈTRE de tout le module : une date fixe ne vieillit pas.
const AUJ = "2026-10-08"; // un jeudi
const j = (n: number) => addDays(AUJ, n);

const tache = (id: number, plus: Partial<Task> = {}): Task =>
  ({
    id, label: `T${id}`, tag: null, priority: "medium", recurrence: "daily", goal_id: null,
    created_at: "2025-01-01 08:00:00", due_date: null, start_at: null, end_at: null,
    postponed_count: 0, postponed_from: null, is_example: 0, ...plus,
  }) as Task;
const habitude = (id: number, plus: Partial<Habit> = {}): Habit => ({ id, name: `H${id}`, color: "x", archived: 0, is_example: 0, ...plus });
let n = 1;
const coche = (task_id: number, date: string, done = 1): Completion => ({ id: n++, task_id, date, done });
const check = (habit_id: number, date: string): HabitCheck => ({ id: n++, habit_id, date });
const seance = (date: string, minutes: number, plus: Partial<FocusSession> = {}): FocusSession => {
  const fin = new Date(new Date(`${date}T09:00:00`).getTime() + minutes * 60000);
  const hh = String(fin.getHours()).padStart(2, "0"), mm = String(fin.getMinutes()).padStart(2, "0");
  return { id: n++, task_id: null, label: null, started_at: `${date} 09:00:00`, ended_at: `${date} ${hh}:${mm}:00`, planned_min: minutes, kind: "focus", ...plus };
};

/** Le jour en cours, lu comme la vue le lit : la liste vient de `todayTasks`. */
const lire = (p: { tasks?: Task[]; completions?: Completion[]; habits?: Habit[]; habitChecks?: HabitCheck[]; focusSessions?: FocusSession[] }) =>
  jourEnCours({
    listeDuJour: todayTasks(p.tasks ?? [], p.completions ?? [], AUJ),
    habits: p.habits ?? [],
    habitChecks: p.habitChecks ?? [],
    focusSessions: p.focusSessions ?? [],
    today: AUJ,
  });

describe("⭐ le jour en cours se voit (constat 2 du labo)", () => {
  it("un compte dont l'histoire tient en un jour voit ce jour : tâche, habitude, séance", () => {
    // Le parcours rejoué par le labo : une tâche cochée, une habitude cochée,
    // une séance terminée — et Performance qui n'en montrait rien.
    const tasks = [tache(1, { created_at: `${AUJ} 08:00:00` }), tache(2, { created_at: `${AUJ} 08:00:00` })];
    const jour = lire({
      tasks,
      completions: [coche(1, AUJ)],
      habits: [habitude(1), habitude(2)],
      habitChecks: [check(1, AUJ)],
      focusSessions: [seance(AUJ, 1)],
    });
    expect(jour).toEqual({
      date: AUJ,
      taches: { faites: 1, dues: 2 },
      habitudes: { tenues: 1, actives: 2 },
      focus: { minutes: 1, seances: 1 },
    });
  });

  it("le focus du jour est celui du Timer : séances de focus TERMINÉES, commencées aujourd'hui", () => {
    const focusSessions = [
      seance(AUJ, 25),
      seance(AUJ, 10),
      seance(AUJ, 5, { kind: "break" }), // une pause ne compte pas
      { ...seance(AUJ, 30), ended_at: null }, // en cours : pas encore du temps passé
      seance(j(-1), 40), // hier
    ];
    const jour = lire({ focusSessions });
    expect(jour.focus).toEqual({ minutes: 35, seances: 2 });
    expect(jour.focus.minutes).toBe(minutesDeFocus(focusSessions, AUJ, AUJ));
  });

  it("le contenu de départ ne compte pas, comme dans l'anneau de discipline", () => {
    const tasks = [tache(1), tache(2, { is_example: 1 })];
    const jour = lire({ tasks, completions: [coche(2, AUJ)], habits: [habitude(1, { is_example: 1 })], habitChecks: [check(1, AUJ)] });
    expect(jour.taches).toEqual({ faites: 0, dues: 1 });
    expect(jour.habitudes).toEqual({ tenues: 0, actives: 0 });
  });

  it("ne décide pas ce qu'est une tâche du jour : il compte la liste qu'on lui donne", () => {
    // La définition appartient à `todayTasks` (elle change dans un chantier
    // voisin). Une liste arbitraire est comptée telle quelle.
    const liste = [
      { ...tache(1), done: true },
      { ...tache(2), done: false },
      { ...tache(3), done: true },
    ];
    const jour = jourEnCours({ listeDuJour: liste, habits: [], habitChecks: [], focusSessions: [], today: AUJ });
    expect(jour.taches).toEqual({ faites: 2, dues: 3 });
  });

  it("une habitude cochée deux fois le même jour ne compte qu'une fois ; une coche d'hier ne compte pas", () => {
    const jour = lire({ habits: [habitude(1), habitude(2)], habitChecks: [check(1, AUJ), check(1, AUJ), check(2, j(-1))] });
    expect(jour.habitudes).toEqual({ tenues: 1, actives: 2 });
  });
});

describe("⚠️ le jour en cours reste HORS des moyennes et des écarts (décision du 2026-10-09)", () => {
  const tasks = [tache(1), tache(2)];
  const habits = [habitude(1)];
  // Sept jours finis parfaits ; aujourd'hui, rien n'est fait.
  const completions = [-7, -6, -5, -4, -3, -2, -1].flatMap((d) => [coche(1, j(d)), coche(2, j(d))]);
  const habitChecks = [-7, -6, -5, -4, -3, -2, -1].map((d) => check(1, j(d)));
  const focusSessions = [seance(j(-1), 60)];

  it("une journée vide ce matin ne fait plonger aucun chiffre de la période", () => {
    const b = bornes(AUJ, 7);
    expect(b.fin).toBe(j(-1));
    expect(moyenne(serieTaches(tasks, completions, b.debut, b.fin))).toBe(100);
    expect(moyenne(serieHabitudes(habits, habitChecks, b.debut, b.fin, AUJ))).toBe(100);
    expect(minutesDeFocus(focusSessions, b.debut, b.fin)).toBe(60);
    // …alors que le jour, lui, est bien à zéro — et se voit.
    expect(lire({ tasks, completions, habits, habitChecks, focusSessions })).toMatchObject({
      taches: { faites: 0, dues: 2 },
      habitudes: { tenues: 0, actives: 1 },
      focus: { minutes: 0 },
    });
  });

  it("ce qu'on fait aujourd'hui ne change ni la moyenne ni l'écart de la période", () => {
    const b = bornes(AUJ, 7);
    const lecture = (c: Completion[], h: HabitCheck[], f: FocusSession[]) => ({
      taches: comparer(moyenne(serieTaches(tasks, c, b.debut, b.fin)), moyenne(serieTaches(tasks, c, b.debutAvant, b.finAvant))),
      habitudes: moyenne(serieHabitudes(habits, h, b.debut, b.fin, AUJ)),
      focus: minutesDeFocus(f, b.debut, b.fin),
    });
    const avant = lecture(completions, habitChecks, focusSessions);
    const apres = lecture([...completions, coche(1, AUJ), coche(2, AUJ)], [...habitChecks, check(1, AUJ)], [...focusSessions, seance(AUJ, 90)]);
    expect(apres).toEqual(avant);
  });
});

describe("une période qui n'a rien mesuré ne dit pas « rien ne décroche »", () => {
  it("aucun jour fini avec une tâche due, aucune habitude, aucune minute", () => {
    expect(periodeSansMesure({ taches: null, habitudes: null, focus: 0 })).toBe(true);
  });
  it("dès qu'une des trois mesures existe, la période a quelque chose à dire", () => {
    expect(periodeSansMesure({ taches: 0, habitudes: null, focus: 0 })).toBe(false);
    expect(periodeSansMesure({ taches: null, habitudes: 40, focus: 0 })).toBe(false);
    expect(periodeSansMesure({ taches: null, habitudes: null, focus: 1 })).toBe(false);
  });
  it("le matin d'un compte neuf : la période d'avant aujourd'hui est vide, le jour ne l'est pas", () => {
    const tasks = [tache(1, { created_at: `${AUJ} 08:00:00` })];
    const b = bornes(AUJ, 30);
    const focusSessions = [seance(AUJ, 1)];
    expect(
      periodeSansMesure({
        taches: moyenne(serieTaches(tasks, [coche(1, AUJ)], b.debut, b.fin)),
        habitudes: moyenne(serieHabitudes([], [], b.debut, b.fin, AUJ)),
        focus: minutesDeFocus(focusSessions, b.debut, b.fin),
      }),
    ).toBe(true);
    expect(lire({ tasks, completions: [coche(1, AUJ)], focusSessions }).focus.minutes).toBe(1);
  });
});
