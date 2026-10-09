import { describe, expect, it } from "vitest";
import { addDays } from "../logic";
import type { Completion, FocusSession, Habit, HabitCheck, Task } from "../types";
import {
  bornes,
  comparer,
  debutsDesHabitudes,
  estPlage,
  focusDansLeTemps,
  lisser,
  minutesDeFocus,
  moyenne,
  parJourDeSemaine,
  pointsDAttention,
  serieHabitudes,
  serieTaches,
  tenueParHabitude,
  SEUILS,
  type PointJour,
} from "./analyse";

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
const seance = (date: string, minutes: number, kind = "focus"): FocusSession => {
  const fin = new Date(new Date(`${date}T09:00:00`).getTime() + minutes * 60000);
  const hh = String(fin.getHours()).padStart(2, "0"), mm = String(fin.getMinutes()).padStart(2, "0");
  return { id: n++, task_id: null, label: null, started_at: `${date} 09:00:00`, ended_at: `${date} ${hh}:${mm}:00`, planned_min: minutes, kind };
};
const serie = (...pcts: (number | null)[]): PointJour[] => pcts.map((pct, i) => ({ date: j(-pcts.length + i), pct }));

describe("les périodes", () => {
  it("une période s'arrête à HIER, et celle d'avant la précède sans trou ni recouvrement", () => {
    const b = bornes(AUJ, 7);
    expect(b).toEqual({ debut: j(-7), fin: j(-1), debutAvant: j(-14), finAvant: j(-8) });
  });
  it("seules les quatre plages proposées sont acceptées (réglage relu de la base)", () => {
    expect([7, 30, 90, 180].every(estPlage)).toBe(true);
    expect(estPlage(14)).toBe(false);
    expect(estPlage("30")).toBe(false);
    expect(estPlage(null)).toBe(false);
  });
});

describe("serieTaches — la règle de dayStat, jour par jour", () => {
  const tasks = [tache(1), tache(2)];
  it("la part des tâches dues faites ; un jour sans coche vaut 0, pas « neutre »", () => {
    const s = serieTaches(tasks, [coche(1, j(-2)), coche(2, j(-2)), coche(1, j(-1))], j(-3), j(-1));
    expect(s.map((p) => p.pct)).toEqual([0, 100, 50]);
  });
  it("un jour sans tâche due est NEUTRE (null)", () => {
    const ponctuelle = [tache(1, { recurrence: "none", due_date: j(-1) })];
    const s = serieTaches(ponctuelle, [], j(-3), j(-1));
    expect(s[0].pct).toBeNull();
  });
  it("aujourd'hui prend le pourcentage de la liste vivante, fourni par l'appelant", () => {
    const s = serieTaches(tasks, [], j(-1), AUJ, { date: AUJ, pct: 75 });
    expect(s[1]).toEqual({ date: AUJ, pct: 75 });
  });
  it("le contenu de départ ne compte pas", () => {
    const s = serieTaches([tache(1, { is_example: 1 })], [], j(-1), j(-1));
    expect(s[0].pct).toBeNull();
  });
});

describe("serieHabitudes — une habitude compte depuis sa première coche", () => {
  const habits = [habitude(1), habitude(2)];
  it("avant la première coche de toute habitude, le jour est neutre", () => {
    const s = serieHabitudes(habits, [check(1, j(-2))], j(-4), j(-1), AUJ);
    expect(s.map((p) => p.pct)).toEqual([null, null, 100, 0]);
  });
  it("ajouter une habitude ne réécrit pas le passé", () => {
    const checks = [check(1, j(-3)), check(1, j(-2)), check(1, j(-1)), check(2, j(-1))];
    const s = serieHabitudes(habits, checks, j(-3), j(-1), AUJ);
    // H2 n'existe que depuis hier : les deux jours d'avant restent à 100 %.
    expect(s.map((p) => p.pct)).toEqual([100, 100, 100]);
  });
  it("une habitude jamais cochée ne compte qu'à partir d'aujourd'hui", () => {
    expect(debutsDesHabitudes(habits, [check(1, j(-5))], AUJ)).toEqual(new Map([[1, j(-5)], [2, AUJ]]));
  });
  it("une habitude d'exemple ne compte ni en haut ni en bas", () => {
    const s = serieHabitudes([habitude(1), habitude(9, { is_example: 1 })], [check(1, j(-1)), check(9, j(-1))], j(-1), j(-1), AUJ);
    expect(s[0].pct).toBe(100);
  });
});

describe("lire une série", () => {
  it("la moyenne ignore les jours neutres ; rien à moyenner rend null", () => {
    expect(moyenne(serie(100, null, 50))).toBe(75);
    expect(moyenne(serie(null, null))).toBeNull();
    expect(moyenne([])).toBeNull();
  });
  it("la moyenne glissante porte sur les jours qui comptent de la fenêtre", () => {
    expect(lisser(serie(null, 100, 0, null, 50), 3)).toEqual([null, 100, 50, 50, 25]);
  });
  it("pas d'écart inventé quand une des deux périodes est vide", () => {
    expect(comparer(70, 62).ecart).toBe(8);
    expect(comparer(70, null).ecart).toBeNull();
    expect(comparer(null, 62).ecart).toBeNull();
  });
  it("par jour de la semaine : du lundi au dimanche, avec le nombre de mesures", () => {
    // 14 jours finis avant un jeudi : deux de chaque jour.
    const s = Array.from({ length: 14 }, (_, i) => ({ date: j(-14 + i), pct: new Date(`${j(-14 + i)}T12:00:00`).getDay() === 4 ? 20 : 80 }));
    const sem = parJourDeSemaine(s);
    expect(sem.map((x) => x.jour)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(sem.find((x) => x.jour === 4)).toEqual({ jour: 4, pct: 20, mesures: 2 });
    expect(sem.find((x) => x.jour === 1)?.pct).toBe(80);
  });
});

describe("tenueParHabitude", () => {
  it("jours tenus sur jours COMPTÉS, et le taux de la période d'avant", () => {
    const checks = [
      ...[-14, -13, -12, -11, -10, -9, -8].map((d) => check(1, j(d))), // 7/7 avant
      ...[-7, -5, -3].map((d) => check(1, j(d))), // 3/7 ici
    ];
    const [h] = tenueParHabitude([habitude(1)], checks, AUJ, 7);
    expect(h).toMatchObject({ tenus: 3, comptes: 7, pct: 43, avant: 100 });
  });
  it("une habitude commencée en cours de période n'est comptée que depuis sa première coche", () => {
    const [h] = tenueParHabitude([habitude(1)], [check(1, j(-2)), check(1, j(-1))], AUJ, 30);
    expect(h).toMatchObject({ tenus: 2, comptes: 2, pct: 100, avant: null });
  });
});

describe("le focus", () => {
  const sessions = [seance(j(-1), 50), seance(j(-1), 25), seance(j(-3), 30), seance(j(-2), 40, "break"), seance(j(-20), 60)];
  it("ne compte que les séances de FOCUS terminées de la période", () => {
    expect(minutesDeFocus(sessions, j(-7), j(-1))).toBe(105);
    expect(minutesDeFocus([{ ...seance(j(-1), 30), ended_at: null }], j(-7), j(-1))).toBe(0);
  });
  it("par jour jusqu'à 30 jours — les jours vides restent, à zéro", () => {
    const f = focusDansLeTemps(sessions, j(-7), j(-1));
    expect(f.pas).toBe("jour");
    expect(f.tranches.map((x) => x.minutes)).toEqual([0, 0, 0, 0, 30, 0, 75]);
  });
  it("par semaine au-delà", () => {
    const f = focusDansLeTemps(sessions, j(-90), j(-1));
    expect(f.pas).toBe("semaine");
    expect(f.tranches.length).toBe(13);
    expect(f.tranches.reduce((a, x) => a + x.minutes, 0)).toBe(165);
  });
});

describe("pointsDAttention — ce qui décroche, en chiffres", () => {
  const base = { tasks: [] as Task[], completions: [] as Completion[], habits: [] as Habit[], habitChecks: [] as HabitCheck[], focusSessions: [] as FocusSession[], today: AUJ, plage: 30 };

  it("rien à signaler : une liste vide, pas un reproche par défaut", () => {
    expect(pointsDAttention(base)).toEqual([]);
  });

  it("les tâches reportées deux fois et pas faites attendent une décision", () => {
    const tasks = [
      tache(1, { recurrence: "none", due_date: AUJ, postponed_count: 2 }),
      tache(2, { recurrence: "none", due_date: AUJ, postponed_count: 1 }),
      tache(3, { recurrence: "none", due_date: AUJ, postponed_count: 4 }), // faite
    ];
    expect(pointsDAttention({ ...base, tasks, completions: [coche(3, j(-1))] })).toContainEqual({ genre: "reports", n: 1 });
  });

  it("l'habitude tenue moins d'un jour sur deux est nommée, avec son taux", () => {
    const habitChecks = [check(1, j(-30)), check(1, j(-20)), check(1, j(-10))];
    const pts = pointsDAttention({ ...base, habits: [habitude(1, { name: "Sport" })], habitChecks });
    expect(pts).toContainEqual({ genre: "habitude", habitId: 1, nom: "Sport", pct: 10, avant: null });
  });

  it("une habitude trop récente n'est pas jugée", () => {
    const pts = pointsDAttention({ ...base, habits: [habitude(1)], habitChecks: [check(1, j(-3))] });
    expect(pts.find((x) => x.genre === "habitude")).toBeUndefined();
  });

  it("le jour de la semaine nettement sous la moyenne est signalé — un seul", () => {
    const tasks = [tache(1)];
    // Tout fait, sauf les jeudis.
    const completions = Array.from({ length: 30 }, (_, i) => j(-30 + i))
      .filter((d) => new Date(`${d}T12:00:00`).getDay() !== 4)
      .map((d) => coche(1, d));
    const pts = pointsDAttention({ ...base, tasks, completions }).filter((x) => x.genre === "jour-faible");
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ quoi: "taches", jour: 4, pct: 0 });
  });

  it("une moyenne qui perd dix points d'une période à l'autre", () => {
    const tasks = [tache(1)];
    const completions = [
      ...Array.from({ length: 30 }, (_, i) => coche(1, j(-60 + i))), // 100 % avant
      ...Array.from({ length: 15 }, (_, i) => coche(1, j(-30 + i * 2))), // 50 % ici
    ];
    const baisse = pointsDAttention({ ...base, tasks, completions }).find((x) => x.genre === "baisse");
    expect(baisse).toEqual({ genre: "baisse", quoi: "taches", ecart: -50, valeur: 50 });
  });

  it("le focus qui s'effondre — sur une base d'au moins une heure", () => {
    const fort = [seance(j(-40), 120)];
    expect(pointsDAttention({ ...base, focusSessions: [...fort, seance(j(-3), 30)] })).toContainEqual({ genre: "focus", minutes: 30, avant: 120 });
    expect(pointsDAttention({ ...base, focusSessions: [seance(j(-40), 30)] })).toEqual([]);
  });

  it("jamais plus de trois points, les plus actionnables d'abord", () => {
    const tasks = [tache(1), tache(2, { recurrence: "none", due_date: AUJ, postponed_count: 3 })];
    const completions = Array.from({ length: 30 }, (_, i) => coche(1, j(-60 + i)));
    const pts = pointsDAttention({
      ...base, tasks, completions,
      habits: [habitude(1)], habitChecks: [check(1, j(-30))],
      focusSessions: [seance(j(-40), 120)],
    });
    expect(pts).toHaveLength(SEUILS.max);
    expect(pts[0].genre).toBe("reports");
    expect(pts[1].genre).toBe("habitude");
  });
});
