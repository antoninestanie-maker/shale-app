import { describe, expect, it } from "vitest";
import { addDays, dayStat, estPrevueLe, estRattrapage, statDeListe, todayTasks } from "./logic";
import { coche, tache } from "./objectifs/objectif.testutil";
import { tachesHorsCompte } from "./performance/analyse";
import { actionsRequises } from "./pointAction/regle";
import { estGlisseeJusquA, reportsAAppliquer, tachesEnRetard } from "./taches";
import { sectionDe } from "./tachesVue";
import type { Completion, Task } from "./types";

/**
 * ⭐ OUVRIR LE CALENDRIER NE CHANGE AUCUN COMPTE (lot 3 de l'audit du 2026-10-20,
 * temps-1 = taches-5).
 *
 * Le Calendrier reporte les tâches en retard à son ouverture (`reportsAAppliquer`,
 * 2026-09-02) : leur date devient aujourd'hui. Avant ce correctif, elles
 * entraient alors dans la liste du jour : « En retard » se vidait, l'anneau des
 * tâches passait de 1/2 à 1/4, et les cocher faisait monter le compte du jour —
 * le contraire de la règle du rattrapage (2026-10-20). Deux personnes avec les
 * mêmes tâches avaient deux Disciplines selon l'écran visité.
 */

const AUJ = "2026-10-20";

/** Le report tel que l'écrit `appliquerReport`, sur une copie. */
function ouvrirLeCalendrier(tasks: Task[], completions: Completion[]): Task[] {
  const reports = new Map(reportsAAppliquer(tasks, completions, AUJ).map((r) => [r.id, r.report]));
  return tasks.map((t) => (reports.has(t.id) ? { ...t, ...reports.get(t.id)! } : t));
}

const avant: Task[] = [
  tache({ id: 1, label: "A", due_date: "2026-10-18" }),
  tache({ id: 2, label: "B", due_date: "2026-10-19" }),
  tache({ id: 3, label: "C", due_date: AUJ }),
  tache({ id: 4, label: "D", due_date: AUJ }),
];
const coches: Completion[] = [coche(3, AUJ)];

function etat(tasks: Task[], completions: Completion[]) {
  return {
    jour: statDeListe(todayTasks(tasks, completions, AUJ)),
    enRetard: tachesEnRetard(tasks, completions, AUJ).map((t) => t.label),
    horsCompte: tachesHorsCompte(tasks, completions, AUJ).map((t) => t.label),
    sections: tasks.map((t) => sectionDe(t, completions.some((c) => c.task_id === t.id && c.done), AUJ)),
  };
}

describe("le report du Calendrier et le compte du jour", () => {
  it("le scénario de l'audit : le Calendrier reporte bien A et B à aujourd'hui", () => {
    const apres = ouvrirLeCalendrier(avant, coches);
    expect(apres.filter((t) => t.due_date === AUJ).map((t) => t.label)).toEqual(["A", "B", "C", "D"]);
    expect(apres.find((t) => t.id === 1)!.postponed_count).toBe(1);
  });

  it("la liste du jour, « En retard » et les sections de Tâches sont les mêmes avant et après", () => {
    const sans = etat(avant, coches);
    const apres = etat(ouvrirLeCalendrier(avant, coches), coches);
    expect(sans.jour).toEqual({ total: 2, done: 1, pct: 50 });
    expect(apres).toEqual(sans);
    expect(apres.enRetard).toEqual(["A", "B"]);
    expect(apres.sections).toEqual(["retard", "retard", "faites", "aujourdhui"]);
  });

  it("cocher A ensuite est un rattrapage : il ne fait pas monter le jour", () => {
    const apres = ouvrirLeCalendrier(avant, coches);
    const cochees = [...coches, coche(1, AUJ)];
    expect(estRattrapage(apres[0], AUJ)).toBe(true);
    expect(statDeListe(todayTasks(apres, cochees, AUJ))).toEqual({ total: 2, done: 1, pct: 50 });
    // La relecture du jour (demain) ne compte pas A non plus — comme sans être
    // passé par le Calendrier. (Un jour passé ne compte que les tâches cochées :
    // D, pas faite, en sort ; c'est la limite connue de `dayStat`.)
    expect(dayStat(apres, cochees, AUJ)).toEqual(dayStat(avant, cochees, AUJ));
    expect(dayStat(apres, cochees, AUJ)).toMatchObject({ total: 1, done: 1 });
  });

  it("le report reste idempotent : rouvrir le Calendrier ne fait plus rien", () => {
    const une = ouvrirLeCalendrier(avant, coches);
    expect(reportsAAppliquer(une, coches, AUJ)).toEqual([]);
  });

  it("le lendemain, la tâche reportée repart en retard et se reporte une seconde fois", () => {
    const une = ouvrirLeCalendrier(avant, coches);
    const demain = addDays(AUJ, 1);
    const r = reportsAAppliquer(une, coches, demain).find((x) => x.id === 1);
    expect(r?.report).toEqual({ due_date: demain, postponed_count: 2, postponed_from: "2026-10-18" });
  });

  it("une tâche replanifiée à la main (compteur à zéro) est une tâche de son jour", () => {
    const t = tache({ id: 9, due_date: AUJ, postponed_count: 0, postponed_from: AUJ });
    expect(estGlisseeJusquA(t, AUJ)).toBe(false);
    expect(estPrevueLe(t, AUJ)).toBe(true);
  });

  it("le point d'action la garde en retard, depuis sa date d'origine (pas « 0 j »)", () => {
    const apres = ouvrirLeCalendrier(avant, coches);
    const a = actionsRequises({ tasks: apres, completions: coches, goals: [] }, AUJ);
    expect(a.map((x) => [x.titre, x.genre, x.echeance])).toEqual([
      ["A", "tache-en-retard", "2026-10-18"],
      ["B", "tache-en-retard", "2026-10-19"],
    ]);
  });

  it("« En retard » range une tâche reportée à sa date d'origine", () => {
    const apres = ouvrirLeCalendrier(
      [tache({ id: 1, label: "récente", due_date: "2026-10-19" }), tache({ id: 2, label: "ancienne", due_date: "2026-10-10" })],
      [],
    );
    expect(tachesEnRetard(apres, [], AUJ).map((t) => t.label)).toEqual(["ancienne", "récente"]);
  });
});
