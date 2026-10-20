import { describe, expect, it } from "vitest";
import { objectif } from "../objectifs/objectif.testutil";
import type { CalendarEvent, ObjectLink } from "../types";
import { calculerActions } from "./contexte";

/**
 * ⭐ Le point d'action mesure les objectifs comme leur page (lot 3 de l'audit du
 * 2026-10-20 : objectifs-1 = rythme-4, constat 27).
 */

const JOUR = "2026-10-20";

const evenement = (id: number, date: string): CalendarEvent & { uid: string } => ({
  id,
  uid: `ev-${id}`,
  title: `rendez-vous ${id}`,
  body: null,
  date,
  end_date: null,
  start_at: "10:00",
  end_at: "11:00",
  all_day: 0,
  color: null,
  recurrence: "none",
  created_at: "2026-10-01 09:00:00",
  updated_at: "2026-10-01 09:00:00",
});
const lien = (goalUid: string, evUid: string): ObjectLink => ({
  id: 1,
  uid: `ol:goal:${goalUid}:event:${evUid}`,
  from_kind: "goal",
  from_uid: goalUid,
  to_kind: "event",
  to_uid: evUid,
  origin: "manual",
  created_at: "2026-10-01 09:00:00",
});

const base = { tasks: [], completions: [], habits: [], habitChecks: [] };

describe("calculerActions — le point d'action lit les événements rattachés", () => {
  // « Salon pro » : échéance au 18/10, trois rendez-vous rattachés, tous passés.
  const salon = objectif({ id: 1, uid: "g-salon", title: "Salon pro", deadline: "2026-10-18", manual_progress: 0, created_at: "2026-10-01 09:00:00" });
  const evenements = [evenement(1, "2026-10-10"), evenement(2, "2026-10-14"), evenement(3, "2026-10-17")];
  const liens = evenements.map((e) => lien("g-salon", e.uid));

  it("un objectif atteint par ses rendez-vous ne demande aucune action", () => {
    const e = calculerActions({ ...base, goals: [salon] }, { liens, evenements }, JOUR, `${JOUR} 09:00`);
    expect(e.liste).toEqual([]);
    expect(e.parModule.goals).toBeUndefined();
  });

  it("(le défaut d'avant : sans les rendez-vous, il passait « dépassé » à 0 %)", () => {
    const e = calculerActions({ ...base, goals: [salon] }, { liens: [], evenements: [] }, JOUR, `${JOUR} 09:00`);
    expect(e.liste.map((a) => a.genre)).toEqual(["objectif-depasse"]);
  });
});

describe("le badge Objectifs compte des lignes de la liste (constat 27)", () => {
  it("un objectif dépassé et deux de ses étapes dépassées : 1, et chaque étape nomme son objectif", () => {
    const racine = objectif({ id: 1, title: "Lancer l'offre", deadline: "2026-10-10", manual_progress: 1, progress_pct: 20 });
    const e1 = objectif({ id: 2, parent_goal_id: 1, title: "Valider la certification UX", deadline: "2026-10-12", manual_progress: 1, progress_pct: 0 });
    const e2 = objectif({ id: 3, parent_goal_id: 1, title: "Signer deux clients", deadline: "2026-10-15", manual_progress: 1, progress_pct: 0 });
    const e = calculerActions({ ...base, goals: [racine, e1, e2] }, { liens: [], evenements: [] }, JOUR, `${JOUR} 09:00`);
    expect(e.liste).toHaveLength(3);
    expect(e.parModule.goals).toBe(1);
    expect(e.liste.find((a) => a.id === 2)?.racine).toEqual({ id: 1, titre: "Lancer l'offre" });
    expect(e.liste.find((a) => a.id === 1)?.racine).toBeUndefined();
  });

  it("deux objectifs distincts comptent deux", () => {
    const a = objectif({ id: 1, title: "A", deadline: "2026-10-10", manual_progress: 1, progress_pct: 20 });
    const b = objectif({ id: 5, title: "B", deadline: "2026-10-11", manual_progress: 1, progress_pct: 20 });
    expect(calculerActions({ ...base, goals: [a, b] }, { liens: [], evenements: [] }, JOUR, `${JOUR} 09:00`).parModule.goals).toBe(2);
  });
});
