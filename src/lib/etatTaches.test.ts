import { describe, expect, it } from "vitest";

import { dayStat, estPrevueLe, isDueOn, tachesAFaire, todayTasks } from "./logic";
import { coche, objectif, tache } from "./objectifs/objectif.testutil";
import { prochaineAction, prochainesActions } from "./objectifs/prochaineAction";
import { mesurer, type SourcesProgression } from "./objectifs/progression";
import {
  aRelancer,
  changerEtat,
  estEnRetard,
  estRapide,
  estSuspendue,
  etatDe,
  reporter,
  tachesADecider,
  tachesARelancer,
  tachesEnRetard,
} from "./taches";
import { ranger, rangerParObjectif } from "./tachesVue";
import type { Goal, Task } from "./types";

/**
 * ⭐ L'ÉTAT D'UNE TÂCHE (migration 031, 2026-10-20) — en cours, en attente,
 * abandonnée. Ce que chaque état change, et surtout ce qu'il NE change PAS.
 */

const AUJ = "2026-10-20";

describe("lire l'état", () => {
  it("une valeur absente ou inconnue vaut « à faire »", () => {
    expect(etatDe(tache())).toBe("todo");
    expect(etatDe(tache({ state: "doing" }))).toBe("doing");
    // Un appareil plus récent pourrait écrire un état que celui-ci ne connaît pas.
    expect(etatDe(tache({ state: "bloquee" }))).toBe("todo");
  });
});

describe("suspendue : en attente ou abandonnée, à partir de son jour", () => {
  it("en cours et à faire ne suspendent rien", () => {
    expect(estSuspendue(tache({ state: "doing", state_since: "2026-10-01" }), AUJ)).toBe(false);
    expect(estSuspendue(tache(), AUJ)).toBe(false);
  });

  it("⭐ l'historique ne se réécrit pas : les jours d'avant restent comptés", () => {
    const t = tache({ state: "waiting", state_since: AUJ });
    expect(estSuspendue(t, "2026-10-19")).toBe(false);
    expect(estSuspendue(t, AUJ)).toBe(true);
    expect(estSuspendue(t, "2026-10-21")).toBe(true);
  });

  it("sans jour d'état (ligne venue d'ailleurs) : suspendue depuis toujours", () => {
    expect(estSuspendue(tache({ state: "dropped", state_since: null }), "2020-01-01")).toBe(true);
  });
});

describe("la liste du jour, la Discipline et le retard", () => {
  const routine = tache({ id: 1, recurrence: "daily", created_at: "2026-10-01 08:00:00" });

  it("⭐ une routine en attente est en PAUSE à partir du jour où on l'a dit", () => {
    const enPause = { ...routine, state: "waiting", state_since: AUJ };
    expect(isDueOn(enPause, "2026-10-19")).toBe(true);
    expect(isDueOn(enPause, AUJ)).toBe(false);
    expect(estPrevueLe(enPause, AUJ)).toBe(false);
  });

  it("⭐ le pourcentage d'un jour passé ne bouge pas quand on abandonne aujourd'hui", () => {
    const avant = dayStat([routine], [], "2026-10-19");
    const apres = dayStat([{ ...routine, state: "dropped", state_since: AUJ }], [], "2026-10-19");
    expect(apres).toEqual(avant);
    expect(avant.total).toBe(1);
    // Et le jour même, elle ne compte plus.
    expect(dayStat([{ ...routine, state: "dropped", state_since: AUJ }], [], AUJ).total).toBe(0);
  });

  it("une ponctuelle du jour en attente sort de la liste du jour, et du choix du minuteur", () => {
    const t = tache({ id: 2, due_date: AUJ, state: "waiting", state_since: AUJ });
    expect(todayTasks([t], [], AUJ)).toEqual([]);
    expect(tachesAFaire([t], [], AUJ)).toEqual([]);
  });

  it("en cours ne change rien au compte", () => {
    const t = tache({ id: 2, due_date: AUJ, state: "doing", state_since: AUJ });
    expect(todayTasks([t], [], AUJ)).toHaveLength(1);
  });

  it("⭐ une tâche en attente n'est jamais en retard, donc jamais reportée", () => {
    const t = tache({ id: 3, due_date: "2026-10-15", state: "waiting", state_since: "2026-10-16" });
    expect(estEnRetard(t, AUJ, false)).toBe(false);
    expect(tachesEnRetard([t], [], AUJ)).toEqual([]);
    expect(reporter(t, AUJ, false)).toBeNull();
    // Ni « à décider » (bandeau du calendrier, point d'action), même au seuil de reports.
    expect(tachesADecider([{ ...t, postponed_count: 3 }], [], AUJ)).toEqual([]);
    // Reprise : elle est de nouveau en retard.
    expect(estEnRetard({ ...t, ...changerEtat(t, "todo", AUJ) }, AUJ, false)).toBe(true);
  });
});

describe("la relance", () => {
  it("revient le jour venu, et les jours d'après", () => {
    const t = tache({ state: "waiting", follow_up_on: AUJ });
    expect(aRelancer(t, "2026-10-19")).toBe(false);
    expect(aRelancer(t, AUJ)).toBe(true);
    expect(aRelancer(t, "2026-10-25")).toBe(true);
    expect(aRelancer({ ...t, follow_up_on: null }, AUJ)).toBe(false);
    expect(aRelancer({ ...t, state: "doing" }, AUJ)).toBe(false);
  });

  it("une tâche faite n'est plus à relancer ; la plus ancienne relance d'abord", () => {
    const a = tache({ id: 1, state: "waiting", follow_up_on: "2026-10-18" });
    const b = tache({ id: 2, state: "waiting", follow_up_on: "2026-10-10" });
    const c = tache({ id: 3, state: "waiting", follow_up_on: "2026-10-12" });
    expect(tachesARelancer([a, b, c], [coche(3, "2026-10-19")], AUJ).map((x) => x.id)).toEqual([2, 1]);
  });
});

describe("changer d'état", () => {
  it("l'attente garde de quoi elle attend et sa relance", () => {
    expect(changerEtat(tache(), "waiting", AUJ, { waiting_for: "  le comptable ", follow_up_on: "2026-10-23" })).toEqual({
      state: "waiting",
      state_since: AUJ,
      waiting_for: "le comptable",
      follow_up_on: "2026-10-23",
      pauses: null,
    });
  });

  it("⭐ sortir de l'attente vide ses champs — une relance oubliée la ferait reparaître", () => {
    const enAttente = tache({ state: "waiting", state_since: AUJ, waiting_for: "x", follow_up_on: "2026-10-23" });
    expect(changerEtat(enAttente, "doing", AUJ, { waiting_for: "x", follow_up_on: "2026-10-23" })).toEqual({
      state: "doing",
      state_since: AUJ,
      waiting_for: null,
      follow_up_on: null,
      // Posée et levée le même jour : aucune pause à garder.
      pauses: null,
    });
    // « À faire » n'a pas de date : c'est l'état par défaut.
    expect(changerEtat(enAttente, "todo", AUJ).state_since).toBeNull();
  });
});

describe("le badge « Rapide »", () => {
  it("un créneau de quinze minutes ou moins", () => {
    expect(estRapide(tache({ start_at: "09:00", end_at: "09:15" }))).toBe(true);
    expect(estRapide(tache({ start_at: "09:00", end_at: "09:16" }))).toBe(false);
    expect(estRapide(tache({ start_at: "09:00", end_at: null }))).toBe(false);
    expect(estRapide(tache({ start_at: "09:10", end_at: "09:00" }))).toBe(false);
  });
});

describe("la vue Tâches", () => {
  it("⭐ « En attente » et « Abandonnées » ont leur section ; la relance remonte dans « Aujourd'hui »", () => {
    const attente = tache({ id: 1, state: "waiting", state_since: "2026-10-18" });
    const aRelancerAuj = tache({ id: 2, state: "waiting", state_since: "2026-10-18", follow_up_on: AUJ });
    const abandonnee = tache({ id: 3, due_date: "2026-10-01", state: "dropped", state_since: "2026-10-05" });
    const enCours = tache({ id: 4, due_date: AUJ, state: "doing", state_since: AUJ });
    const s = ranger([attente, aRelancerAuj, abandonnee, enCours], [], AUJ);
    expect(s.get("attente")!.map((x) => x.id)).toEqual([1]);
    expect(s.get("aujourdhui")!.map((x) => x.id).sort()).toEqual([2, 4]);
    expect(s.get("abandonnees")!.map((x) => x.id)).toEqual([3]);
    // Une abandonnée en retard n'est PAS dans « En retard ».
    expect(s.get("retard")).toEqual([]);
  });

  it("à priorité égale, ce qui est en cours passe en tête d'« Aujourd'hui »", () => {
    const a = tache({ id: 1, label: "a", due_date: AUJ });
    const b = tache({ id: 2, label: "b", due_date: AUJ, state: "doing", state_since: AUJ });
    expect(ranger([a, b], [], AUJ).get("aujourdhui")!.map((x) => x.id)).toEqual([2, 1]);
  });

  it("une tâche cochée est faite, quel que soit son état", () => {
    const t = tache({ id: 1, state: "dropped", state_since: AUJ });
    expect(ranger([t], [coche(1, AUJ)], AUJ).get("faites")!.map((x) => x.id)).toEqual([1]);
  });

  it("rangée par objectif, les abandonnées ont leur section en dernier", () => {
    const g = objectif({ id: 10, title: "Lancer" });
    const t1 = tache({ id: 1, goal_id: 10 });
    const t2 = tache({ id: 2, goal_id: 10, state: "dropped", state_since: AUJ });
    const groupes = rangerParObjectif([t1, t2], [], [g], AUJ);
    expect(groupes.map((x) => x.genre)).toEqual(["objectif", "abandonnees"]);
  });
});

describe("les objectifs", () => {
  const racine = objectif({ id: 10, title: "Lancer" });
  const sources = (tasks: Task[], goals: Goal[] = [racine]): SourcesProgression => ({
    goals,
    tasks,
    completions: [],
    maintenant: `${AUJ} 10:00`,
  });

  it("⭐ une tâche abandonnée sort de l'avancement — l'objectif ne l'attend plus", () => {
    const faite = tache({ id: 1, goal_id: 10 });
    const lachee = tache({ id: 2, goal_id: 10, state: "dropped", state_since: AUJ });
    const s = { ...sources([faite, lachee]), completions: [coche(1, AUJ)] };
    expect(mesurer(racine, s).pct).toBe(100);
  });

  it("une tâche en attente compte toujours, mais n'est pas « la prochaine action »", () => {
    const attente = tache({ id: 1, goal_id: 10, due_date: "2026-10-21", state: "waiting", state_since: AUJ });
    const ensuite = tache({ id: 2, goal_id: 10 });
    const s = sources([attente, ensuite]);
    expect(mesurer(racine, s).pct).toBe(0);
    expect(prochaineAction(racine, s, () => false)?.tache.id).toBe(2);
    expect([...prochainesActions(s).keys()]).toEqual([2]);
  });
});
