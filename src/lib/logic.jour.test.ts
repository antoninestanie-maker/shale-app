import { describe, expect, it } from "vitest";
import {
  addDays,
  computeStreak,
  dayStat,
  estPrevueLe,
  pctOfList,
  statDeListe,
  tachesAFaire,
  todayTasks,
  weekStats,
  weekdayOf,
} from "./logic";
import { coche, tache } from "./objectifs/objectif.testutil";

/**
 * ⭐ LA DÉFINITION DE « LA TÂCHE DU JOUR » (2026-10-11).
 *
 * Crible du labo, constat 1 (audit A17-19) : la carte « Tâches du jour » listait
 * toute tâche ponctuelle non faite, et noter une tâche sans date faisait baisser
 * la Discipline. Ces tests tiennent la règle unique que lisent Aujourd'hui,
 * l'anneau, la vue Tâches, Performance — et le portage Rust
 * (`src-tauri/src/notifications/task_streak.rs`), qui rejoue les mêmes cas.
 */

/** Un dimanche — vérifié ci-dessous. */
const AUJ = "2026-10-11";
const HIER = addDays(AUJ, -1);
const DEMAIN = addDays(AUJ, 1);
const NEE = "2026-09-01 09:00:00";

const routine = (id: number, recurrence = "daily") => tache({ id, recurrence, created_at: NEE });
const ids = (liste: { id: number }[]) => liste.map((t) => t.id);

describe("estPrevueLe — ce qui est prévu un jour donné", () => {
  it("le jour de référence est un dimanche", () => {
    expect(weekdayOf(AUJ)).toBe(0);
  });

  it("une ponctuelle : le jour de sa date, et lui seul", () => {
    const t = tache({ due_date: AUJ });
    expect(estPrevueLe(t, AUJ)).toBe(true);
    expect(estPrevueLe(t, HIER)).toBe(false);
    expect(estPrevueLe(t, DEMAIN)).toBe(false);
  });

  it("sans date : jamais", () => {
    expect(estPrevueLe(tache({ due_date: null }), AUJ)).toBe(false);
  });

  it("une routine : les jours de sa règle", () => {
    expect(estPrevueLe(routine(1), AUJ)).toBe(true);
    // Lundi à vendredi : pas un dimanche.
    expect(estPrevueLe(routine(1, "weekdays"), AUJ)).toBe(false);
    expect(estPrevueLe(routine(1, "weekdays"), DEMAIN)).toBe(true);
  });

  it("⚠️ une routine ne suit pas une date égarée dans sa ligne", () => {
    expect(estPrevueLe(tache({ recurrence: "weekdays", due_date: AUJ, created_at: NEE }), AUJ)).toBe(false);
  });
});

describe("todayTasks — la liste du jour", () => {
  it("⭐ ni les « sans date », ni les « à venir », ni les « en retard »", () => {
    const tasks = [
      tache({ id: 1, due_date: AUJ }),
      tache({ id: 2, due_date: null }),
      tache({ id: 3, due_date: DEMAIN }),
      tache({ id: 4, due_date: HIER }),
      routine(5),
      routine(6, "weekdays"), // pas un dimanche
    ];
    expect(ids(todayTasks(tasks, [], AUJ))).toEqual([1, 5]);
  });

  it("⭐ A17-19 : ajouter une tâche sans date ne change pas la Discipline", () => {
    const avant = [tache({ id: 1, due_date: AUJ }), routine(2), routine(3)];
    const coches = [coche(2, AUJ)];
    const reference = statDeListe(todayTasks(avant, coches, AUJ));
    expect(reference).toEqual({ total: 3, done: 1, pct: 33 });

    // « Relancer le devis jeudi », saisie un dimanche : sans date, ou datée de jeudi.
    const sansDate = [...avant, tache({ id: 10, due_date: null })];
    const aVenir = [...avant, tache({ id: 11, due_date: addDays(AUJ, 4) })];
    expect(statDeListe(todayTasks(sansDate, coches, AUJ))).toEqual(reference);
    expect(statDeListe(todayTasks(aVenir, coches, AUJ))).toEqual(reference);
  });

  it("une tâche ajoutée POUR aujourd'hui, elle, compte", () => {
    const tasks = [routine(1), tache({ id: 2, due_date: AUJ })];
    expect(statDeListe(todayTasks(tasks, [coche(1, AUJ)], AUJ))).toEqual({ total: 2, done: 1, pct: 50 });
  });

  it("une tâche du jour cochée reste dans la liste, faite", () => {
    const liste = todayTasks([tache({ id: 1, due_date: AUJ })], [coche(1, AUJ)], AUJ);
    expect(liste).toHaveLength(1);
    expect(liste[0].done).toBe(true);
  });

  it("⭐ ce qu'on coche aujourd'hui compte pour aujourd'hui, quelle que soit sa date", () => {
    const tasks = [
      routine(1),
      tache({ id: 2, due_date: null }), // sans date
      tache({ id: 3, due_date: HIER }), // en retard, rattrapée
      tache({ id: 4, due_date: DEMAIN }), // faite en avance
    ];
    const coches = [coche(2, AUJ), coche(3, AUJ), coche(4, AUJ)];
    const liste = todayTasks(tasks, coches, AUJ);
    expect(ids(liste)).toEqual([1, 2, 3, 4]);
    expect(statDeListe(liste)).toEqual({ total: 4, done: 3, pct: 75 });
  });

  it("cochée puis décochée aujourd'hui, une tâche sans date ressort de la liste", () => {
    expect(todayTasks([tache({ id: 2 })], [coche(2, AUJ, 0)], AUJ)).toEqual([]);
  });

  it("datée d'aujourd'hui mais faite HIER : elle a compté hier, pas deux fois", () => {
    const tasks = [tache({ id: 1, due_date: AUJ })];
    expect(todayTasks(tasks, [coche(1, HIER)], AUJ)).toEqual([]);
    expect(dayStat(tasks, [coche(1, HIER)], HIER)).toMatchObject({ total: 1, done: 1 });
  });

  it("une routine se coche jour par jour : la coche d'hier ne vaut pas aujourd'hui", () => {
    const liste = todayTasks([routine(1)], [coche(1, HIER)], AUJ);
    expect(liste[0].done).toBe(false);
  });

  it("une journée sans rien de prévu est NEUTRE (null), pas à 0 %", () => {
    const tasks = [tache({ id: 1, due_date: null }), tache({ id: 2, due_date: HIER })];
    expect(pctOfList(todayTasks(tasks, [], AUJ))).toBeNull();
  });
});

describe("statDeListe — la fraction et le pourcentage sortent du même tableau", () => {
  it("⭐ un exemple se voit dans la liste, mais ne compte ni dans la fraction ni dans le pourcentage", () => {
    const tasks = [tache({ id: 1, due_date: AUJ }), tache({ id: 2, due_date: AUJ, is_example: 1 })];
    const liste = todayTasks(tasks, [coche(1, AUJ)], AUJ);
    expect(liste).toHaveLength(2);
    // Avant : « 100 % » sur « 1/2 » — le pourcentage et la fraction ne se répondaient pas.
    expect(statDeListe(liste)).toEqual({ total: 1, done: 1, pct: 100 });
  });

  it("le jour courant de la semaine porte ce même compte", () => {
    const tasks = [tache({ id: 1, due_date: AUJ }), tache({ id: 2, due_date: AUJ, is_example: 1 })];
    const liste = todayTasks(tasks, [coche(1, AUJ)], AUJ);
    expect(weekStats(tasks, [coche(1, AUJ)], AUJ, liste)[6]).toEqual({ date: AUJ, total: 1, done: 1, pct: 100 });
  });
});

describe("dayStat — un jour PASSÉ garde son chiffre", () => {
  it("les routines dues ce jour-là, et les ponctuelles cochées ce jour-là", () => {
    const tasks = [routine(1), routine(2), tache({ id: 3 })];
    const coches = [coche(1, HIER), coche(3, HIER)];
    expect(dayStat(tasks, coches, HIER)).toEqual({ date: HIER, total: 3, done: 2, pct: 67 });
  });

  it("⭐ une tâche sans date ou à venir, jamais cochée, n'a jamais pesé sur un jour passé", () => {
    const tasks = [routine(1), tache({ id: 2, due_date: null }), tache({ id: 3, due_date: DEMAIN })];
    expect(dayStat(tasks, [coche(1, HIER)], HIER)).toEqual({ date: HIER, total: 1, done: 1, pct: 100 });
  });

  it("⚠️ la seule différence avec avant : une ponctuelle cochée PUIS décochée ne compte plus comme un manqué", () => {
    const tasks = [routine(1), tache({ id: 2 })];
    // `basculerTache` laisse une ligne `done = 0` le jour de la coche.
    const coches = [coche(1, HIER), coche(2, HIER, 0)];
    // Avant : 1 sur 2 = 50 %, sous le seuil d'une série. Maintenant : 1 sur 1.
    expect(dayStat(tasks, coches, HIER)).toEqual({ date: HIER, total: 1, done: 1, pct: 100 });
  });

  it("⭐ un pourcentage passé ne peut que monter : retirer un manqué ne fait jamais baisser", () => {
    // Routine manquée + ponctuelle décochée : 0 sur 2 avant, 0 sur 1 maintenant.
    const tasks = [routine(1), tache({ id: 2 })];
    expect(dayStat(tasks, [coche(2, HIER, 0)], HIER).pct).toBe(0);
    // Seule une ponctuelle décochée : 0 % avant, NEUTRE maintenant (ne casse rien).
    expect(dayStat([tache({ id: 2 })], [coche(2, HIER, 0)], HIER).pct).toBeNull();
  });

  it("une série tenue avant la règle l'est encore après", () => {
    const tasks = [routine(1), tache({ id: 2, due_date: null }), tache({ id: 3, due_date: addDays(AUJ, -3) })];
    const coches = [1, 2, 3, 4, 5].map((n) => coche(1, addDays(AUJ, -n)));
    // Cinq jours de routine tenue ; les ponctuelles ouvertes (sans date, en
    // retard) ne pèsent sur aucun de ces jours.
    expect(computeStreak(tasks, coches, AUJ, null)).toBe(5);
  });
});

describe("⚠️ à minuit, le chiffre du jour ne peut que monter", () => {
  it("ce qui était prévu aujourd'hui et pas fait sort du compte — rien d'autre ne change", () => {
    const tasks = [
      routine(1),
      routine(2),
      tache({ id: 3, due_date: AUJ }), // faite
      tache({ id: 4, due_date: AUJ }), // pas faite : demain, elle sera « en retard »
      tache({ id: 5, due_date: null }), // cochée aujourd'hui
    ];
    const coches = [coche(1, AUJ), coche(3, AUJ), coche(5, AUJ)];
    const ceSoir = statDeListe(todayTasks(tasks, coches, AUJ));
    const demainMatin = dayStat(tasks, coches, AUJ);
    expect(ceSoir).toEqual({ total: 5, done: 3, pct: 60 });
    expect(demainMatin).toMatchObject({ total: 4, done: 3, pct: 75 });
    expect(demainMatin.pct!).toBeGreaterThanOrEqual(ceSoir.pct!);
  });

  it("sans tâche datée laissée en plan, le chiffre du soir est celui du lendemain", () => {
    const tasks = [routine(1), routine(2), tache({ id: 3, due_date: AUJ }), tache({ id: 4, due_date: null })];
    const coches = [coche(1, AUJ), coche(3, AUJ), coche(4, AUJ), coche(4, AUJ, 1)];
    const ceSoir = statDeListe(todayTasks(tasks, coches, AUJ));
    expect(dayStat(tasks, coches, AUJ)).toMatchObject(ceSoir);
  });
});

describe("tachesAFaire — ce qu'on peut désigner au minuteur, hors de tout compte", () => {
  it("les routines du jour pas cochées, et TOUTES les ponctuelles pas faites, datées ou non", () => {
    const tasks = [
      routine(1),
      routine(2),
      routine(3, "weekdays"), // pas un dimanche
      tache({ id: 4, due_date: null }),
      tache({ id: 5, due_date: DEMAIN }),
      tache({ id: 6, due_date: HIER }),
      tache({ id: 7, due_date: AUJ }),
      tache({ id: 8, due_date: null }), // faite hier
    ];
    const coches = [coche(2, AUJ), coche(8, HIER)];
    // ⭐ Celles du jour en tête (la routine, la tâche datée d'aujourd'hui), puis les autres.
    expect(ids(tachesAFaire(tasks, coches, AUJ))).toEqual([1, 7, 4, 5, 6]);
  });
});
