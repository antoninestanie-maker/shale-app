// Phase G : la revue hebdomadaire. Les faits de la semaine (calculés ici), le
// Journal (rien par défaut, des notes chiffrées seulement sur accord), la revue
// stockée, et les contrôles de sortie du serveur.
import { describe, expect, it } from "vitest";

import migration008 from "../../../../shale-site/supabase/migrations/008_ia.sql?raw";
import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { valider as validerServeur } from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts";
import { ecrireContenuIa, fetchAll, lireContenuIa, listerContenusIa } from "../repo";
import type { AppData, Completion, FocusSession, Goal, JournalEntry, Task } from "../types";
import type { PayloadDe } from "./contrats";
import { reponseDemo } from "./demo";
import { appliquerAjustement, payloadRevue, POIDS_REVUE, revueLisible, semaineDeRevue } from "./revue";

// Le 2026-10-04 est un dimanche ; sa semaine va du lundi 28/09 au dimanche 04/10.
const DIMANCHE = "2026-10-04";
const SEMAINE = { debut: "2026-09-28", fin: "2026-10-04" };

function tache(id: number, sur: Partial<Task> = {}): Task {
  return {
    id,
    label: `Tâche ${id}`,
    tag: null,
    priority: "medium",
    recurrence: "none",
    goal_id: null,
    created_at: "2026-09-01 09:00:00",
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

let cid = 1;
const coche = (task_id: number, date: string): Completion => ({ id: cid++, task_id, date, done: 1 });
const focus = (id: number, debut: string, fin: string | null, kind = "focus"): FocusSession => ({ id, task_id: null, label: null, started_at: debut, ended_at: fin, planned_min: 25, kind });

function donnees(sur: Partial<AppData>): AppData {
  return {
    tasks: [],
    completions: [],
    goals: [],
    tags: [],
    metrics: [],
    metricEntries: [],
    goalLog: [],
    quickLinks: [],
    focusSessions: [],
    notes: [],
    journal: [],
    habits: [],
    habitChecks: [],
    trades: [],
    ...sur,
  };
}

describe("la semaine dont on fait la revue", () => {
  it("le dimanche : la semaine qui s'achève ; les autres jours : la dernière semaine complète", () => {
    expect(semaineDeRevue(DIMANCHE)).toEqual(SEMAINE);
    expect(semaineDeRevue("2026-10-05")).toEqual(SEMAINE); // lundi
    expect(semaineDeRevue("2026-10-10")).toEqual(SEMAINE); // samedi
    expect(semaineDeRevue("2026-10-11")).toEqual({ debut: "2026-10-05", fin: "2026-10-11" });
  });
});

describe("les faits de la semaine", () => {
  const data = donnees({
    tasks: [
      tache(1, { recurrence: "daily" }), // prévue 7 fois
      tache(2, { due_date: "2026-09-30" }), // prévue, faite
      tache(3, { due_date: "2026-10-01", postponed_count: 4 }), // prévue, pas faite, a glissé
      tache(4), // sans date, faite dans la semaine : « hors prévu »
      tache(5, { goal_id: 11, due_date: "2026-10-02" }), // sur une étape de l'objectif 10
      tache(6, { due_date: "2026-09-20", postponed_count: 2 }), // a glissé, hors semaine
      tache(7, { due_date: "2026-09-21", postponed_count: 9 }), // a glissé… mais FAITE depuis
    ],
    completions: [
      coche(1, "2026-09-28"),
      coche(1, "2026-09-29"),
      coche(1, "2026-09-27"), // la veille de la semaine : ne compte pas
      coche(2, "2026-09-30"),
      coche(4, "2026-10-01"),
      coche(5, "2026-10-02"),
      coche(7, "2026-09-25"),
    ],
    goals: [objectif(10, { title: "Lancer le site" }), objectif(11, { parent_goal_id: 10, title: "Maquette" }), objectif(12, { title: "Exemple", is_example: 1 })],
    focusSessions: [
      focus(1, "2026-09-28 09:00:00", "2026-09-28 09:50:00"),
      focus(2, "2026-09-30 14:00:00", "2026-09-30 14:25:00"),
      focus(3, "2026-09-30 15:00:00", "2026-09-30 15:05:00", "break"), // une pause n'est pas du focus
      focus(4, "2026-10-01 10:00:00", null), // pas terminée
      focus(5, "2026-09-22 09:00:00", "2026-09-22 10:00:00"), // semaine précédente
    ],
    journal: [
      { id: 1, date: "2026-09-28", mood: 4, energy: 3, body: "TEXTE PRIVÉ du lundi" },
      { id: 2, date: "2026-09-30", mood: 2, energy: null, body: "autre TEXTE PRIVÉ" },
      { id: 3, date: "2026-09-20", mood: 5, energy: 5, body: "hors semaine" },
    ] as JournalEntry[],
  });

  const p = payloadRevue("fr", DIMANCHE, SEMAINE, data, false);

  it("complétion : prévu et fait par jour, et ce qui a été fait hors de ce qui était prévu", () => {
    // 7 routines + 3 datées de la semaine (tâches 2, 3, 5).
    expect(p.completion).toMatchObject({ prevues: 10, faites: 4, faitesHorsPrevu: 1 });
    expect(p.completion.parJour).toHaveLength(7);
    expect(p.completion.parJour[0]).toEqual({ jour: "2026-09-28", prevues: 1, faites: 1 });
    expect(p.completion.parJour[2]).toEqual({ jour: "2026-09-30", prevues: 2, faites: 1 });
  });

  it("focus : minutes des séances de FOCUS terminées, et celles de la semaine d'avant", () => {
    expect(p.focus).toEqual({ minutes: 75, sessions: 2, joursActifs: 2, minutesSemainePrecedente: 60 });
  });

  it("objectifs : les racines seulement (pas les exemples), avec les tâches faites sur tout leur arbre", () => {
    expect(p.objectifs).toHaveLength(1);
    expect(p.objectifs[0]).toMatchObject({ titre: "Lancer le site", tachesFaites: 1, enPeril: false });
  });

  it("reports : les tâches qui ont glissé et ne sont PAS faites, la plus reportée d'abord", () => {
    expect(p.reports).toEqual({ taches: 2, plusReportees: [{ titre: "Tâche 3", reports: 4 }, { titre: "Tâche 6", reports: 2 }] });
  });

  it("⭐ le Journal ne part PAS par défaut ; sur accord, des notes chiffrées seulement — jamais le texte", () => {
    expect(p.journal).toBeNull();
    expect(JSON.stringify(p)).not.toContain("PRIVÉ");

    const avec = payloadRevue("fr", DIMANCHE, SEMAINE, data, true);
    expect(avec.journal).toMatchObject({ humeurMoyenne: 3, energieMoyenne: 3 });
    expect(avec.journal!.parJour[0]).toEqual({ jour: "2026-09-28", humeur: 4, energie: 3 });
    expect(avec.journal!.parJour[2]).toEqual({ jour: "2026-09-30", humeur: 2, energie: null });
    expect(avec.journal!.parJour[1]).toEqual({ jour: "2026-09-29", humeur: null, energie: null });
    expect(JSON.stringify(avec)).not.toContain("PRIVÉ");
    expect(JSON.stringify(avec)).not.toContain("body");
  });

  it("les deux payloads passent le schéma du serveur", () => {
    expect(validerServeur(FONCTIONS.revue.payload, p)).toEqual([]);
    expect(validerServeur(FONCTIONS.revue.payload, payloadRevue("fr", DIMANCHE, SEMAINE, data, true))).toEqual([]);
    // Un Journal qui porterait du texte est hors schéma : le serveur le refuserait.
    const triche = { ...p, journal: { humeurMoyenne: 3, energieMoyenne: 3, parJour: [{ jour: DIMANCHE, humeur: 3, energie: 3, texte: "x" }] } };
    expect(validerServeur(FONCTIONS.revue.payload, triche)).not.toEqual([]);
  });

  it("la démo réelle (repo hors Tauri) donne un payload valide", async () => {
    const reel = await fetchAll("2000-01-01");
    const payload = payloadRevue("fr", "2026-10-04", SEMAINE, reel, true);
    expect(validerServeur(FONCTIONS.revue.payload, payload)).toEqual([]);
  });
});

describe("la revue stockée", () => {
  const sortie = {
    tenu: "Trois jours pleins.",
    glisse: "Deux tâches reportées.",
    ajustements: [
      { titre: "Bloquer deux matinées", pourquoi: "Le focus tient le matin.", date: "2026-10-05" },
      { titre: "Trancher la tâche 3", pourquoi: "Reportée quatre fois.", date: null },
      { titre: "Choisir un objectif", pourquoi: "Aucun n'a avancé.", date: null },
    ],
  };

  it("fait l'aller-retour par `ia_contenus`, rangée au lundi ; une revue abîmée est ignorée", async () => {
    await ecrireContenuIa("revue", SEMAINE.debut, { ...sortie, genereLe: "2026-10-04T18:05:00.000Z", semaine: SEMAINE, crees: [1, 1, 7] });
    const lue = revueLisible((await lireContenuIa("revue", SEMAINE.debut))?.contenu);
    expect(lue).toMatchObject({ tenu: "Trois jours pleins.", semaine: SEMAINE, crees: [1] });
    expect(await listerContenusIa("revue")).toContain(SEMAINE.debut);
    expect(revueLisible({ ...sortie, semaine: SEMAINE })).toBeNull(); // sans date de génération
    expect(revueLisible({ ...sortie, ajustements: "non", genereLe: "x", semaine: SEMAINE })).toBeNull();
    expect(revueLisible({ ...sortie, genereLe: "x" })).toBeNull(); // sans semaine
  });

  it("un ajustement validé devient une tâche, datée s'il portait une date", async () => {
    await appliquerAjustement(sortie.ajustements[0]);
    await appliquerAjustement(sortie.ajustements[1]);
    const tasks = (await fetchAll("2000-01-01")).tasks;
    expect(tasks.find((t) => t.label === "Bloquer deux matinées")).toMatchObject({ due_date: "2026-10-05", recurrence: "none" });
    expect(tasks.find((t) => t.label === "Trancher la tâche 3")).toMatchObject({ due_date: null });
  });
});

describe("contrôles de sortie du serveur", () => {
  const verifier = FONCTIONS.revue.verifier as (s: unknown, p: PayloadDe<"revue">, prep: undefined) => string | null;
  const p = payloadRevue("fr", DIMANCHE, SEMAINE, donnees({}), false);
  const aj = (date: string | null) => ({ titre: "Faire x", pourquoi: "parce que", date });

  it("exactement trois ajustements, datés d'aujourd'hui au plus tôt, bilan non vide", () => {
    expect(verifier({ tenu: "a", glisse: "b", ajustements: [aj(null), aj(null)] }, p, undefined)).toBeTruthy();
    expect(verifier({ tenu: "a", glisse: "b", ajustements: [aj(null), aj("2026-10-03"), aj(null)] }, p, undefined)).toBeTruthy();
    expect(verifier({ tenu: " ", glisse: "b", ajustements: [aj(null), aj(null), aj(null)] }, p, undefined)).toBeTruthy();
    expect(verifier({ tenu: "a", glisse: "b", ajustements: [aj(null), aj(DIMANCHE), aj("2026-10-07")] }, p, undefined)).toBeNull();
    // Quatre ajustements : hors schéma avant même le contrôle.
    expect(validerServeur(FONCTIONS.revue.sortie, { tenu: "a", glisse: "b", ajustements: [aj(null), aj(null), aj(null), aj(null)] })).not.toEqual([]);
  });

  it("la réponse de la démo passe le MÊME contrôle, un dimanche comme en semaine", () => {
    expect(verifier(reponseDemo("revue", p), p, undefined)).toBeNull();
    const mercredi = payloadRevue("fr", "2026-10-07", SEMAINE, donnees({}), false);
    expect(verifier(reponseDemo("revue", mercredi), mercredi, undefined)).toBeNull();
  });

  it("le poids affiché (« compte pour 5 actions ») est celui que le serveur applique", () => {
    const m = /\('revue',\s*'[^']+',\s*\d+,\s*(\d+),/.exec(migration008);
    expect(m, "ligne `revue` de ai_config introuvable dans la migration 008").not.toBeNull();
    expect(Number(m![1])).toBe(POIDS_REVUE);
  });
});
