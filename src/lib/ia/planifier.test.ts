// Phase E : tâches et objectifs. Ce que l'app calcule (charge, comparables,
// fourchette, faits du péril), ce qu'elle écrit une fois validé (sur la démo,
// repo hors Tauri), et les contrôles de sortie du serveur.
import { describe, expect, it } from "vitest";

import { FONCTIONS, limitePeril as limitePerilServeur } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { valider as validerServeur } from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts";
import type { ObjectifEnPeril } from "../calendrier/peril";
import { createGoal, createTask, fetchAll, fetchLinksFrom, historiqueFocus, uidDe } from "../repo";
import type { CalendarEvent, Completion, Goal, Task } from "../types";
import type { PayloadDe } from "./contrats";
import { reponseDemo } from "./demo";
import {
  appliquerDecoupage,
  appliquerEtapes,
  appliquerTachesProposees,
  chargeJours,
  comparablesDe,
  descendants,
  fourchette,
  joursDeCharge,
  limitePeril,
  MAX_COMPARABLES,
  motsCles,
  payloadDecouper,
  payloadPeril,
  payloadTachesObjectif,
  peutDecomposer,
  retenusParmi,
  rythme14j,
} from "./planifier";

const JOUR = "2026-10-14";

function tache(id: number, sur: Partial<Task> = {}): Task {
  return {
    id,
    label: `Tâche ${id}`,
    tag: null,
    priority: "medium",
    recurrence: "none",
    goal_id: null,
    created_at: "2026-10-01 09:00:00",
    due_date: null,
    start_at: null,
    end_at: null,
    postponed_count: 0,
    postponed_from: null,
    ...sur,
  } as Task;
}

function objectif(id: number, sur: Partial<Goal> = {}): Goal {
  return {
    id,
    title: `Objectif ${id}`,
    description: null,
    scope: "medium",
    category: null,
    parent_goal_id: null,
    deadline: null,
    progress_pct: 0,
    manual_progress: 0,
    created_at: "2026-09-01 09:00:00",
    is_milestone: 0,
    position: 0,
    weight: 1,
    target_count: null,
    target_unit: null,
    count_source: "manual",
    manual_count: 0,
    count_ref_uid: null,
    count_since: null,
    is_example: 0,
    priority: "medium",
    ...sur,
  };
}

const coche = (task_id: number, date: string, id = task_id): Completion => ({ id, task_id, date, done: 1 });

describe("charge du calendrier", () => {
  it("compte les tâches datées pas faites et les événements qui couvrent le jour ; ni routines, ni tâches faites", () => {
    const tasks = [
      tache(1, { due_date: JOUR }),
      tache(2, { due_date: JOUR }), // faite
      tache(3, { recurrence: "daily" }),
      tache(4, { due_date: "2026-10-16" }),
    ];
    const evts = [{ date: "2026-10-15", end_date: "2026-10-16" }, { date: JOUR, end_date: null }] as CalendarEvent[];
    expect(chargeJours(tasks, [coche(2, JOUR)], evts, JOUR, 3)).toEqual([
      { jour: JOUR, elements: 2 },
      { jour: "2026-10-15", elements: 1 },
      { jour: "2026-10-16", elements: 2 },
    ]);
  });

  it("borne à deux mois, et va jusqu'à l'échéance — ou quatre semaines sans elle", () => {
    expect(chargeJours([], [], [], JOUR, 500)).toHaveLength(62);
    expect(joursDeCharge(JOUR, "2026-10-20")).toBe(7);
    expect(joursDeCharge(JOUR, null)).toBe(28);
    expect(joursDeCharge(JOUR, "2026-10-01")).toBe(28); // échéance passée
  });
});

describe("#8 estimer — comparables et fourchette, calculés ici", () => {
  const cible = tache(1, { label: "Rédiger le devis Hélice", tag: "Clients", goal_id: 4 });
  const tasks = [
    cible,
    tache(2, { label: "Rédiger le devis Atlas", tag: "Clients" }), // étiquette + 2 mots
    tache(3, { label: "Appeler la banque", tag: "Admin" }), // rien en commun
    tache(4, { label: "Relance devis", tag: null }), // un mot, mais PAS finie
    tache(5, { label: "Prospection", tag: "clients", recurrence: "daily" }), // routine, même étiquette
    tache(6, { label: "Portfolio", tag: null, goal_id: 4 }), // même objectif
  ];
  const historique = {
    sessions: [
      { task_id: 2, jour: "2026-09-01", minutes: 40 },
      { task_id: 2, jour: "2026-09-02", minutes: 35.4 },
      { task_id: 3, jour: "2026-09-03", minutes: 20 },
      { task_id: 4, jour: "2026-09-04", minutes: 15 },
      { task_id: 5, jour: "2026-09-05", minutes: 50 },
      { task_id: 5, jour: "2026-09-06", minutes: 60 },
      { task_id: 5, jour: "2026-09-07", minutes: 30 },
      { task_id: 6, jour: "2026-09-08", minutes: 90 },
      { task_id: 1, jour: "2026-09-09", minutes: 10 }, // la cible elle-même
    ],
    faites: [2, 3, 6],
  };

  it("ne garde que ce qui ressemble ET dont la durée est entière ; une routine compte par occurrence", () => {
    const c = comparablesDe(cible, tasks, historique);
    expect(c.map((x) => x.id)).toEqual(["2", "5", "6"]);
    expect(c[0]).toMatchObject({ minutes: 75, recurrente: false }); // total des deux jours
    expect(c[1]).toMatchObject({ minutes: 50, recurrente: true }); // médiane des occurrences
    expect(c[2]).toMatchObject({ minutes: 90 });
  });

  it("au plus trente", () => {
    const beaucoup = Array.from({ length: 40 }, (_, i) => tache(100 + i, { tag: "Clients" }));
    const h = { sessions: beaucoup.map((t) => ({ task_id: t.id, jour: "2026-09-01", minutes: 30 })), faites: beaucoup.map((t) => t.id) };
    expect(comparablesDe(cible, [cible, ...beaucoup], h)).toHaveLength(MAX_COMPARABLES);
  });

  it("les mots qui comptent : sans accent, quatre lettres, hors mots vides", () => {
    expect([...motsCles("Rédiger le devis pour Hélice avec soin")]).toEqual(["rediger", "devis", "helice", "soin"]);
  });

  it("la fourchette : du plus court au plus long jusqu'à trois, l'interquartile ensuite, arrondie à 5 minutes vers l'extérieur", () => {
    expect(fourchette([])).toBeNull();
    expect(fourchette([42])).toEqual({ basse: 40, haute: 45, mediane: 42, n: 1 });
    expect(fourchette([50, 75, 90])).toEqual({ basse: 50, haute: 90, mediane: 75, n: 3 });
    // 8 valeurs : le quart le plus court (10, 20) et le plus long (200, 400) sont écartés.
    expect(fourchette([10, 20, 31, 40, 50, 62, 200, 400])).toEqual({ basse: 20, haute: 65, mediane: 45, n: 8 });
    expect(fourchette([2, 3])).toMatchObject({ basse: 5, haute: 5 }); // jamais sous cinq minutes
  });

  it("seuls les identifiants ENVOYÉS comptent dans la fourchette", () => {
    const c = comparablesDe(cible, tasks, historique);
    expect(retenusParmi(c, ["6", "999", "2"]).map((x) => x.id)).toEqual(["2", "6"]);
  });

  it("la démo lit son historique Timer comme le natif : par tâche et par jour", async () => {
    const h = await historiqueFocus("2000-01-01");
    expect(h.sessions.length).toBeGreaterThan(0);
    expect(h.sessions.every((s) => s.minutes > 0 && /^\d{4}-\d\d-\d\d$/.test(s.jour))).toBe(true);
    expect(h.faites.length).toBeGreaterThan(0);
  });
});

describe("#7 découper", () => {
  it("une échéance passée ne borne rien ; l'objectif est donné par son titre", () => {
    const goals = [objectif(4, { title: "Signer deux clients" })];
    expect(payloadDecouper("fr", JOUR, tache(1, { due_date: "2026-10-01", goal_id: 4, tag: "Clients" }), goals).tache).toEqual({
      titre: "Tâche 1",
      priorite: "medium",
      echeance: null,
      etiquette: "Clients",
      objectif: "Signer deux clients",
    });
    expect(payloadDecouper("fr", JOUR, tache(1, { due_date: "2026-10-20" }), goals).tache.echeance).toBe("2026-10-20");
  });

  it("les étapes validées deviennent des tâches qui héritent de l'objectif et de l'étiquette, RELIÉES à l'origine", async () => {
    const parentId = await createTask({ label: "Refaire le site", tag: "Clients", priority: "high", recurrence: "none", goal_id: 4 });
    const parent = (await fetchAll("2000-01-01")).tasks.find((t) => t.id === parentId)!;
    const ids = await appliquerDecoupage(parent, [
      { titre: " Lister les pages ", priorite: "high", date: "2026-10-15" },
      { titre: "Écrire la page d'accueil", priorite: "medium", date: null },
    ]);
    const apres = (await fetchAll("2000-01-01")).tasks;
    expect(apres.find((t) => t.id === ids[0])).toMatchObject({ label: "Lister les pages", tag: "Clients", goal_id: 4, priority: "high", due_date: "2026-10-15" });
    expect(apres.find((t) => t.id === ids[1])).toMatchObject({ goal_id: 4, due_date: null });
    const liens = await fetchLinksFrom("task", (await uidDe("task", parentId))!);
    const uids = await Promise.all(ids.map((id) => uidDe("task", id)));
    expect(liens.filter((l) => l.to_kind === "task").map((l) => l.to_uid).sort()).toEqual([...uids].sort());
    expect(liens.every((l) => l.origin === "manual")).toBe(true);
  });
});

describe("#11, #12 objectifs", () => {
  it("décomposer n'est offert que là où une étape peut naître (règle de la feuille de route)", () => {
    const racine = objectif(1);
    const phase = objectif(2, { parent_goal_id: 1, is_milestone: 1 });
    const sous = objectif(3, { parent_goal_id: 1 });
    const feuille = objectif(4, { parent_goal_id: 2 });
    const goals = [racine, phase, sous, feuille];
    expect([racine, phase, sous, feuille].map((g) => peutDecomposer(g, goals))).toEqual([true, true, false, false]);
    expect(descendants(racine, goals).map((g) => g.id)).toEqual([2, 4, 3]);
  });

  it("les sous-objectifs validés s'ajoutent APRÈS les étapes existantes, avec horizon et catégorie hérités", async () => {
    const racineId = await createGoal({ title: "Lancer la boutique", description: null, scope: "long", category: "Activité", parent_goal_id: null, deadline: null, progress_pct: 0, manual_progress: 0 });
    await createGoal({ title: "Déjà là", description: null, scope: "long", category: "Activité", parent_goal_id: racineId, deadline: null, progress_pct: 0, manual_progress: 0, position: 3 });
    let goals = (await fetchAll("2000-01-01")).goals;
    const racine = goals.find((g) => g.id === racineId)!;
    await appliquerEtapes(racine, goals, [
      { titre: "Catalogue en ligne", priorite: "high", echeance: "2026-11-01" },
      { titre: "Paiement branché", priorite: "medium", echeance: null },
    ]);
    goals = (await fetchAll("2000-01-01")).goals;
    const enfants = goals.filter((g) => g.parent_goal_id === racineId).sort((a, b) => a.position - b.position);
    expect(enfants.map((g) => [g.title, g.position])).toEqual([["Déjà là", 3], ["Catalogue en ligne", 4], ["Paiement branché", 5]]);
    expect(enfants[1]).toMatchObject({ scope: "long", category: "Activité", deadline: "2026-11-01", priority: "high", is_milestone: 0, manual_progress: 0 });
  });

  it("une tâche proposée va à son étape ; une étape disparue retombe sur l'objectif", async () => {
    const racineId = await createGoal({ title: "Écrire le livre", description: null, scope: "long", category: null, parent_goal_id: null, deadline: null, progress_pct: 0, manual_progress: 0 });
    const etapeId = await createGoal({ title: "Plan", description: null, scope: "long", category: null, parent_goal_id: racineId, deadline: null, progress_pct: 0, manual_progress: 0 });
    const data = await fetchAll("2000-01-01");
    const racine = data.goals.find((g) => g.id === racineId)!;
    expect(payloadTachesObjectif("fr", JOUR, racine, data.goals, data.tasks, data.completions, []).etapes).toEqual([
      { id: String(etapeId), titre: "Plan", echeance: null },
    ]);
    await appliquerTachesProposees(racine, data.goals, [
      { titre: "Lister les chapitres", priorite: "high", date: "2026-10-15", etape: String(etapeId) },
      { titre: "Choisir un titre", priorite: "low", date: null, etape: null },
      { titre: "Tâche orpheline", priorite: "medium", date: null, etape: "999999" },
    ]);
    const tasks = (await fetchAll("2000-01-01")).tasks;
    expect(tasks.find((t) => t.label === "Lister les chapitres")).toMatchObject({ goal_id: etapeId, due_date: "2026-10-15", priority: "high" });
    expect(tasks.find((t) => t.label === "Choisir un titre")).toMatchObject({ goal_id: racineId, due_date: null });
    expect(tasks.find((t) => t.label === "Tâche orpheline")).toMatchObject({ goal_id: racineId });
  });
});

describe("#13 objectif en péril — les faits envoyés", () => {
  const racine = objectif(1, { title: "Lancer le site", deadline: "2026-10-18" });
  const etapeFaite = objectif(2, { parent_goal_id: 1, title: "Maquette" });
  const etapeReste = objectif(3, { parent_goal_id: 1, title: "Mise en ligne", deadline: "2026-10-17" });
  const goals = [racine, etapeFaite, etapeReste];
  const tasks = [
    tache(10, { goal_id: 2, label: "Dessiner" }),
    tache(11, { goal_id: 3, label: "Héberger" }),
    tache(12, { goal_id: 1, label: "Annoncer", due_date: "2026-10-18" }),
    tache(13, { goal_id: 1, label: "Routine", recurrence: "daily" }),
    tache(14, { label: "Sans rapport" }),
  ];
  const completions = [coche(10, "2026-10-10"), coche(13, "2026-10-12", 20), coche(13, "2026-10-13", 21), coche(14, "2026-10-13", 22), coche(13, "2026-09-01", 23)];
  const p: ObjectifEnPeril = {
    goal: racine,
    progression: 49.6,
    joursRestants: 4,
    etapesRestantes: 1,
    tachesRestantes: 1,
    racine: null,
    declaratif: false,
    raison: "rythme-insuffisant",
  };

  it("le rythme des 14 derniers jours porte sur l'objectif ET ses étapes, rien d'autre", () => {
    expect(rythme14j(racine, goals, tasks, completions, JOUR)).toEqual({ tachesFaites14j: 3, joursActifs14j: 3 });
  });

  it("étapes non achevées et tâches ponctuelles pas faites ; le payload passe le schéma du serveur", () => {
    const payload = payloadPeril("fr", JOUR, p, goals, tasks, completions, [{ jour: JOUR, elements: 2 }]);
    expect(payload.objectif).toEqual({ titre: "Lancer le site", echeance: "2026-10-18", joursRestants: 4, progression: 50, declaratif: false, raison: "rythme-insuffisant", racine: null });
    expect(payload.etapesRestantes).toEqual([{ id: "3", titre: "Mise en ligne", echeance: "2026-10-17" }]);
    expect(payload.tachesRestantes).toEqual([{ titre: "Annoncer", date: "2026-10-18" }]);
    expect(validerServeur(FONCTIONS.objectif_peril.payload, payload)).toEqual([]);
  });

  it("la fenêtre du rattrapage est la même des deux côtés", () => {
    for (const e of ["2026-10-18", JOUR, "2026-10-01"]) expect(limitePeril(JOUR, e)).toBe(limitePerilServeur(JOUR, e));
    expect(limitePeril(JOUR, "2026-10-01")).toBe("2026-11-13");
  });
});

describe("contrôles de sortie du serveur", () => {
  const verifier = <F extends "decouper" | "estimer" | "decomposer_objectif" | "etapes_objectif" | "objectif_peril">(f: F) =>
    FONCTIONS[f].verifier as (s: unknown, p: PayloadDe<F>, prep: undefined) => string | null;
  const obj = { titre: "Lancer le site", description: null, echeance: "2026-10-30", horizon: "medium" as const };
  const etapes = [{ id: "3", titre: "Mise en ligne", echeance: "2026-10-20" }];

  it("#7 : une date avant aujourd'hui ou après l'échéance de la tâche est rejetée", () => {
    const p = { lang: "fr" as const, jour: JOUR, tache: { titre: "x", priorite: "medium" as const, echeance: "2026-10-20", etiquette: null, objectif: null } };
    const v = verifier("decouper");
    expect(v({ etapes: [{ titre: "a", priorite: "medium", date: "2026-10-13" }] }, p, undefined)).toBeTruthy();
    expect(v({ etapes: [{ titre: "a", priorite: "medium", date: "2026-10-21" }] }, p, undefined)).toBeTruthy();
    expect(v({ etapes: [{ titre: "a", priorite: "medium", date: "2026-10-20" }, { titre: "b", priorite: "low", date: null }] }, p, undefined)).toBeNull();
  });

  it("#8 : un identifiant hors de la liste fournie, ou en double, est rejeté ; aucun chiffre n'est demandé au modèle", () => {
    const p = { lang: "fr" as const, tache: { titre: "x", etiquette: null }, comparables: [{ id: "2", titre: "a", etiquette: null, minutes: 40, recurrente: false }] };
    const v = verifier("estimer");
    expect(v({ retenus: ["9"], justification: "" }, p, undefined)).toBeTruthy();
    expect(v({ retenus: ["2", "2"], justification: "" }, p, undefined)).toBeTruthy();
    expect(v({ retenus: [], justification: "rien" }, p, undefined)).toBeNull();
    expect(validerServeur(FONCTIONS.estimer.sortie, { retenus: ["2"], justification: "ok", minutes: 45 })).not.toEqual([]);
  });

  it("#11 : une échéance de sous-objectif après celle de l'objectif est rejetée", () => {
    const p = { lang: "fr" as const, jour: JOUR, objectif: obj, existantes: [], charge: [] };
    const v = verifier("decomposer_objectif");
    expect(v({ etapes: [{ titre: "a", priorite: "high", echeance: "2026-11-01" }] }, p, undefined)).toBeTruthy();
    expect(v({ etapes: [{ titre: "a", priorite: "high", echeance: "2026-10-30" }] }, p, undefined)).toBeNull();
  });

  it("⭐ une échéance DÉJÀ PASSÉE ne borne plus rien : un objectif en retard reçoit des dates à venir (sinon aucune réponse ne passerait)", () => {
    const enRetard = { ...obj, echeance: "2026-09-01" };
    const p11 = { lang: "fr" as const, jour: JOUR, objectif: enRetard, existantes: [], charge: [] };
    expect(verifier("decomposer_objectif")({ etapes: [{ titre: "a", priorite: "high", echeance: "2026-10-20" }] }, p11, undefined)).toBeNull();
    expect(verifier("decomposer_objectif")({ etapes: [{ titre: "a", priorite: "high", echeance: "2026-09-01" }] }, p11, undefined)).toBeTruthy();
    expect(verifier("decomposer_objectif")(reponseDemo("decomposer_objectif", p11), p11, undefined)).toBeNull();
    const p12 = { lang: "fr" as const, jour: JOUR, objectif: enRetard, etapes: [{ id: "3", titre: "a", echeance: "2026-08-15" }], taches: [], charge: [] };
    expect(verifier("etapes_objectif")({ taches: [{ titre: "a", priorite: "medium", date: "2026-10-16", etape: "3" }] }, p12, undefined)).toBeNull();
    expect(verifier("etapes_objectif")(reponseDemo("etapes_objectif", p12), p12, undefined)).toBeNull();
  });

  it("#12 : une étape inventée est rejetée ; une tâche ne dépasse ni l'échéance de l'objectif ni celle de son étape", () => {
    const p = { lang: "fr" as const, jour: JOUR, objectif: obj, etapes, taches: [], charge: [] };
    const v = verifier("etapes_objectif");
    const t = (sur: object) => ({ taches: [{ titre: "a", priorite: "medium", date: "2026-10-16", etape: null, ...sur }] });
    expect(v(t({ etape: "42" }), p, undefined)).toBeTruthy();
    expect(v(t({ etape: "3", date: "2026-10-25" }), p, undefined)).toBeTruthy(); // après l'étape
    expect(v(t({ date: "2026-10-25" }), p, undefined)).toBeNull(); // sur l'objectif : avant le 30
    expect(v(t({ date: "2026-10-31" }), p, undefined)).toBeTruthy();
    expect(v(t({ etape: "3", date: null }), p, undefined)).toBeNull();
  });

  it("#13 : chaque tâche du plan est datée, dans la fenêtre — trente jours si l'échéance est passée", () => {
    const base = {
      lang: "fr" as const,
      jour: JOUR,
      etapesRestantes: etapes,
      tachesRestantes: [],
      rythme: { tachesFaites14j: 1, joursActifs14j: 1 },
      charge: [],
    };
    const o = (echeance: string, joursRestants: number) => ({ titre: "x", echeance, joursRestants, progression: 40, declaratif: false, raison: "depassee" as const, racine: null });
    const v = verifier("objectif_peril");
    const plan = (date: string | null) => ({ explication: "…", plan: [{ titre: "a", priorite: "high", date, etape: null }] });
    expect(v(plan(null), { ...base, objectif: o("2026-10-18", 4) }, undefined)).toBeTruthy();
    expect(v(plan("2026-10-19"), { ...base, objectif: o("2026-10-18", 4) }, undefined)).toBeTruthy();
    expect(v(plan("2026-10-18"), { ...base, objectif: o("2026-10-18", 4) }, undefined)).toBeNull();
    expect(v(plan("2026-11-13"), { ...base, objectif: o("2026-10-01", -13) }, undefined)).toBeNull();
    expect(v(plan("2026-11-14"), { ...base, objectif: o("2026-10-01", -13) }, undefined)).toBeTruthy();
  });

  it("les réponses de la démo passent les MÊMES contrôles que celles du modèle", () => {
    const pDecouper = { lang: "fr" as const, jour: JOUR, tache: { titre: "x", priorite: "medium" as const, echeance: "2026-10-15", etiquette: null, objectif: null } };
    expect(verifier("decouper")(reponseDemo("decouper", pDecouper), pDecouper, undefined)).toBeNull();
    const pDecomposer = { lang: "fr" as const, jour: JOUR, objectif: obj, existantes: [], charge: [] };
    expect(verifier("decomposer_objectif")(reponseDemo("decomposer_objectif", pDecomposer), pDecomposer, undefined)).toBeNull();
    const pTaches = { lang: "fr" as const, jour: JOUR, objectif: { ...obj, echeance: "2026-10-15" }, etapes: [{ id: "3", titre: "a", echeance: null }], taches: [], charge: [] };
    expect(verifier("etapes_objectif")(reponseDemo("etapes_objectif", pTaches), pTaches, undefined)).toBeNull();
    for (const [echeance, jr] of [["2026-10-15", 1], ["2026-10-01", -13]] as const) {
      const pPeril = {
        lang: "fr" as const,
        jour: JOUR,
        objectif: { titre: "x", echeance, joursRestants: jr, progression: 40, declaratif: false, raison: "depassee" as const, racine: null },
        etapesRestantes: [{ id: "3", titre: "a", echeance: null }],
        tachesRestantes: [],
        rythme: { tachesFaites14j: 1, joursActifs14j: 1 },
        charge: [],
      };
      expect(verifier("objectif_peril")(reponseDemo("objectif_peril", pPeril), pPeril, undefined)).toBeNull();
    }
  });
});
