import { describe, expect, it } from "vitest";

import { chargeDuJour, joursSurcharges, SEUIL_SURCHARGE } from "./charge";
import { profilDisponibilite, REPLI_DEBUT, REPLI_FIN, SESSIONS_MINIMUM } from "./disponibilite";
import { objectifsEnPeril, ecartEnJours, HORIZON_JOURS } from "./peril";
import type { EntreeAgenda } from "./agenda";
import type { Completion, FocusSession, Goal, Task } from "../types";

/** Chantier B — la journée surchargée, et l'objectif en péril. */

const MARDI = "2026-09-01";
const SAMEDI = "2026-09-05";

const entree = (p: Partial<EntreeAgenda> = {}): EntreeAgenda => ({
  kind: "task", id: 1, titre: "x", date: MARDI, start_at: "09:00", end_at: null,
  allDay: false, color: null, dureeMin: 60, enRetard: false, reports: 0, faite: false, ...p,
});

const profilVide = profilDisponibilite([]); // repli 9 h – 18 h, soit 540 min

// ─────────────────────────────────────────────────────────────────────────────

describe("la charge d'une journée", () => {
  it("compte les minutes réellement posées", () => {
    const c = chargeDuJour([entree({ dureeMin: 120 }), entree({ dureeMin: 60 })], profilVide, MARDI);
    expect(c.posees).toBe(180);
    expect(c.capacite).toBe((REPLI_FIN - REPLI_DEBUT) * 60);
    expect(c.surchargee).toBe(false);
  });

  it("⭐ ne SUPPOSE aucune durée pour ce qui n'a pas de créneau", () => {
    // Prêter « trente minutes, disons » à chaque tâche fabriquerait une charge
    // qui a l'air mesurée. L'app compterait des heures qui n'existent nulle
    // part, et l'avertissement perdrait tout droit d'être cru.
    const c = chargeDuJour(
      [entree({ dureeMin: null, start_at: null }), entree({ dureeMin: null, start_at: null })],
      profilVide,
      MARDI,
    );
    expect(c.posees).toBe(0);
    expect(c.sansCreneau).toBe(2);
  });

  it("une échéance d'objectif n'occupe pas de temps", () => {
    // C'est une date, pas un travail : la compter ferait grossir la charge sans
    // qu'aucune minute ne soit engagée.
    const c = chargeDuJour([entree({ kind: "deadline", dureeMin: null })], profilVide, MARDI);
    expect(c.posees).toBe(0);
    expect(c.sansCreneau).toBe(0);
  });

  it("ce qui est fait ne pèse plus sur la suite", () => {
    const c = chargeDuJour([entree({ dureeMin: 300, faite: true })], profilVide, MARDI);
    expect(c.posees).toBe(0);
  });

  it("⭐ annonce la surcharge quand le compte ne tombe plus juste", () => {
    // 10 h posées sur une journée qui en compte 9.
    const c = chargeDuJour([entree({ dureeMin: 600 })], profilVide, MARDI);
    expect(c.surchargee).toBe(true);
    expect(c.ratio).toBeGreaterThan(SEUIL_SURCHARGE);
  });

  it("une journée bien remplie mais tenable n'alerte PAS", () => {
    // Avertir à 80 % ferait crier l'app trop souvent, et un avertissement trop
    // fréquent finit par ne plus rien vouloir dire.
    const c = chargeDuJour([entree({ dureeMin: 500 })], profilVide, MARDI);
    expect(c.surchargee).toBe(false);
  });

  it("un jour sans capacité ne peut pas être surchargé", () => {
    // Le samedi, le repli ne donne aucune capacité : annoncer une surcharge un
    // jour de repos serait absurde.
    const c = chargeDuJour([entree({ date: SAMEDI, dureeMin: 600 })], profilVide, SAMEDI);
    expect(c.capacite).toBe(0);
    expect(c.ratio).toBeNull();
    expect(c.surchargee).toBe(false);
  });

  it("compte les tâches remontées d'un jour précédent", () => {
    const c = chargeDuJour([entree({ enRetard: true }), entree()], profilVide, MARDI);
    expect(c.enRetard).toBe(1);
  });

  it("repère les journées surchargées d'une plage", () => {
    const parJour = new Map<string, EntreeAgenda[]>([
      [MARDI, [entree({ dureeMin: 600 })]],
      ["2026-09-02", [entree({ dureeMin: 60 })]],
    ]);
    expect([...joursSurcharges(parJour, profilVide)]).toEqual([MARDI]);
  });

  it("la capacité APPRISE remplace le repli, et change le verdict", () => {
    // Quelqu'un dont les mardis font deux heures est surchargé à trois heures,
    // là où le repli l'aurait laissé passer.
    const mardis: FocusSession[] = Array.from({ length: SESSIONS_MINIMUM }, (_, i) => {
      const d = new Date("2026-09-01T12:00:00");
      d.setDate(d.getDate() - 7 * (i + 1));
      return {
        id: i, task_id: null, label: null,
        started_at: `${d.toISOString().slice(0, 10)} 14:00:00`,
        ended_at: `${d.toISOString().slice(0, 10)} 16:00:00`,
        planned_min: 25, kind: "focus",
      };
    });
    const appris = profilDisponibilite(mardis);
    expect(appris.appris).toBe(true);
    const c = chargeDuJour([entree({ dureeMin: 180 })], appris, MARDI);
    expect(c.capacite).toBe(120);
    expect(c.surchargee).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

const objectif = (p: Partial<Goal> = {}): Goal => ({
  id: 1, title: "objectif", description: null, scope: "short", category: null,
  parent_goal_id: null, deadline: null, progress_pct: 0, manual_progress: 1,
  created_at: "2026-08-01 09:00:00", ...p,
});

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1, label: "t", tag: null, priority: "medium", recurrence: "none",
  goal_id: null, created_at: "2026-08-01 09:00:00", due_date: null, start_at: null,
  end_at: null, postponed_count: 0, postponed_from: null, ...p,
});

describe("l'écart entre deux dates", () => {
  it("compte les jours dans les deux sens", () => {
    expect(ecartEnJours("2026-09-01", "2026-09-05")).toBe(4);
    expect(ecartEnJours("2026-09-05", "2026-09-01")).toBe(-4);
    expect(ecartEnJours("2026-09-01", "2026-09-01")).toBe(0);
  });

  it("traverse le changement d'heure sans se décaler", () => {
    expect(ecartEnJours("2026-03-27", "2026-03-31")).toBe(4);
  });
});

describe("les objectifs en péril", () => {
  it("ignore ce qui est loin de l'échéance", () => {
    const g = objectif({ deadline: "2026-12-31", progress_pct: 10 });
    expect(objectifsEnPeril([g], [], [], MARDI)).toEqual([]);
  });

  it("ignore ce qui est terminé", () => {
    const g = objectif({ deadline: "2026-09-02", progress_pct: 100 });
    expect(objectifsEnPeril([g], [], [], MARDI)).toEqual([]);
  });

  it("signale une échéance dépassée", () => {
    const g = objectif({ deadline: "2026-08-25", progress_pct: 40 });
    const [p] = objectifsEnPeril([g], [], [], MARDI);
    expect(p.raison).toBe("depassee");
    expect(p.joursRestants).toBeLessThan(0);
  });

  it("⭐ signale ce qui ne tient plus dans les jours restants", () => {
    // Trois jalons, deux jours : même à un par jour, le compte ne tombe pas.
    const parent = objectif({ id: 1, deadline: "2026-09-03", progress_pct: 20 });
    const jalons = [2, 3, 4].map((id) => objectif({ id, parent_goal_id: 1, progress_pct: 0 }));
    const [p] = objectifsEnPeril([parent, ...jalons], [], [], "2026-09-01");
    expect(p.raison).toBe("trop-peu-de-jours");
    expect(p.jalonsRestants).toBe(3);
  });

  it("⚠️ DIT quand la progression est déclarée et non mesurée", () => {
    // Une alerte fondée sur du déclaratif ne mesure rien : elle répète ce que
    // l'utilisateur a bien voulu se dire. L'écran doit le signaler.
    const declare = objectif({ deadline: "2026-09-03", progress_pct: 30, manual_progress: 1 });
    expect(objectifsEnPeril([declare], [], [], MARDI)[0].declaratif).toBe(true);
  });

  it("mesure sur ce qui est FAIT quand l'objectif n'est pas déclaratif", () => {
    const g = objectif({ id: 1, deadline: "2026-09-03", manual_progress: 0 });
    const taches = [
      tache({ id: 10, goal_id: 1 }),
      tache({ id: 11, goal_id: 1 }),
    ];
    const faites: Completion[] = [{ id: 1, task_id: 10, date: "2026-08-30", done: 1 }];
    const [p] = objectifsEnPeril([g], taches, faites, MARDI);
    expect(p.declaratif).toBe(false);
    expect(p.progression).toBe(50);
    expect(p.tachesRestantes).toBe(1);
  });

  it("classe le plus urgent en premier", () => {
    const tard = objectif({ id: 1, deadline: "2026-09-06", progress_pct: 10 });
    const depassee = objectif({ id: 2, deadline: "2026-08-28", progress_pct: 10 });
    const ordre = objectifsEnPeril([tard, depassee], [], [], MARDI).map((p) => p.goal.id);
    expect(ordre).toEqual([2, 1]);
  });

  it("l'horizon vaut sept jours", () => {
    // Alerter à trente jours ferait de l'alerte un décor permanent ; alerter à
    // deux jours ne laisserait rien faire de la nouvelle.
    expect(HORIZON_JOURS).toBe(7);
  });
});
