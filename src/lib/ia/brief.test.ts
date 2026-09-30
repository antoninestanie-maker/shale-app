// Phase C côté app : les faits calculés en local, la lecture des réglages, la
// clôture appliquée sur la démo (repo hors Tauri), la démo de chaque fonction.
import { describe, expect, it } from "vitest";

import { createTask, fetchAll, lireCorbeille, lireContenuIa, ecrireContenuIa } from "../repo";
import type { AppData, Task } from "../types";
import {
  appliquerProposition,
  faitsDeLaJournee,
  lendemain,
  payloadBrief,
  payloadCloture,
  propositionsDe,
  sujetsDepuis,
  tachesAReporter,
} from "./brief";
import { CATALOGUE_FLUX } from "./catalogueFlux";
import { SORTIES, type FonctionIa } from "./contrats";
import { reponseDemo } from "./demo";
import { valider } from "./schema";
import { briefLisible } from "./useBrief";

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
    due_date: JOUR,
    start_at: null,
    end_at: null,
    postponed_count: 0,
    postponed_from: null,
    ...sur,
  } as Task;
}

function donnees(tasks: Task[], completions: AppData["completions"] = []): AppData {
  return {
    tasks,
    completions,
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
  };
}

describe("réglages du brief", () => {
  it("écarte les sujets sans nom, les URL non https, et borne à 5 × 5", () => {
    const brut = JSON.stringify([
      { nom: "IA", flux: ["https://a.example/rss", "http://b.example/rss", "javascript:alert(1)"] },
      { nom: "", flux: ["https://c.example/rss"] },
      ...Array.from({ length: 6 }, (_, i) => ({ nom: `S${i}`, flux: Array.from({ length: 7 }, (_, j) => `https://f${j}.example/`) })),
    ]);
    const s = sujetsDepuis(brut);
    expect(s).toHaveLength(5);
    expect(s[0]).toEqual({ nom: "IA", flux: ["https://a.example/rss"] });
    expect(s[1].flux).toHaveLength(5);
    expect(sujetsDepuis("{pas du json")).toEqual([]);
  });

  it("le catalogue ne contient que des adresses https, sans doublon", () => {
    const urls = CATALOGUE_FLUX.flatMap((th) => th.flux.map((f) => f.url));
    expect(urls.every((u) => u.startsWith("https://"))).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
  });
});

describe("les faits de la journée — calculés en local", () => {
  it("trois priorités, haute d'abord ; les tâches faites ne comptent pas", () => {
    const data = donnees(
      [
        tache(1, { priority: "low", label: "Basse" }),
        tache(2, { priority: "high", label: "Haute" }),
        tache(3, { priority: "medium", label: "Moyenne" }),
        tache(4, { priority: "high", label: "Faite" }),
        tache(5, { priority: "medium", label: "Autre" }),
      ],
      [{ id: 1, task_id: 4, date: JOUR, done: 1 }],
    );
    const j = faitsDeLaJournee(data, [], JOUR);
    expect(j.priorites.map((p) => p.titre)).toEqual(["Haute", "Autre", "Moyenne"]);
    expect(j.tachesPrevues).toBe(4);
    expect(j.evenements).toEqual([]);
    expect(j.surcharge).toBe(false);
  });

  it("le payload du brief ne porte que des faits et des sujets bornés", () => {
    const p = payloadBrief("fr", JOUR, [{ nom: "IA", flux: ["https://a.example/rss"] }], {
      evenements: [],
      priorites: [],
      tachesPrevues: 0,
      surcharge: false,
    }, false);
    expect(Object.keys(p).sort()).toEqual(["jour", "journee", "lang", "regenerer", "sujets"]);
  });
});

describe("la clôture", () => {
  it("ne propose de reporter que les ponctuelles datées, pas faites", () => {
    const data = donnees(
      [
        tache(1),
        tache(2, { recurrence: "daily", due_date: null }),
        tache(3, { due_date: null }),
        tache(4, { due_date: "2026-10-20" }),
        tache(5),
      ],
      [{ id: 1, task_id: 5, date: JOUR, done: 1 }],
    );
    expect(tachesAReporter(data, JOUR).map((t) => t.id)).toEqual([1]);
    const p = payloadCloture("fr", JOUR, data);
    expect(p.restantes.map((r) => r.id)).toEqual(["1"]);
    expect(p.faites).toEqual([{ titre: "Tâche 5" }]);
  });

  it("une proposition dont la tâche a disparu est écartée", () => {
    const data = donnees([tache(1)]);
    const ps = propositionsDe(
      { bilan: "", propositions: [{ id: "1", action: "demain", date: null, raison: "" }, { id: "99", action: "demain", date: null, raison: "" }] },
      data,
    );
    expect(ps.map((p) => p.tache.id)).toEqual([1]);
  });

  it("appliquée (démo) : demain reporte ; supprimer passe par la corbeille, pas en dur", async () => {
    const id1 = await createTask({ label: "À reporter", tag: null, priority: "medium", recurrence: "none", goal_id: null, due_date: JOUR });
    const id2 = await createTask({ label: "À jeter", tag: null, priority: "low", recurrence: "none", goal_id: null, due_date: JOUR });
    let data = await fetchAll("2000-01-01");
    const t1 = data.tasks.find((t) => t.id === id1)!;
    const t2 = data.tasks.find((t) => t.id === id2)!;
    await appliquerProposition({ tache: t1, action: "demain", date: null, raison: "" }, JOUR);
    await appliquerProposition({ tache: t2, action: "supprimer", date: null, raison: "" }, JOUR);
    data = await fetchAll("2000-01-01");
    const apres = data.tasks.find((t) => t.id === id1)!;
    expect(apres.due_date).toBe(lendemain(JOUR));
    expect(apres.postponed_count).toBe(1);
    expect(data.tasks.some((t) => t.id === id2)).toBe(false);
    expect((await lireCorbeille()).some((e) => e.kind === "task" && e.id === id2)).toBe(true);
  });
});

describe("contenus stockés", () => {
  it("un brief relu est revalidé ; un contenu abîmé est ignoré", async () => {
    const bon = { sujets: [], journee: "Rien.", genereLe: "2026-10-14T07:00:00.000Z" };
    await ecrireContenuIa("brief", JOUR, bon);
    expect(briefLisible((await lireContenuIa("brief", JOUR))?.contenu)).toEqual(bon);
    expect(briefLisible({ sujets: "non", journee: 1 })).toBeNull();
    expect(briefLisible({ sujets: [], journee: "x" })).toBeNull(); // sans date de génération
  });
});

describe("démo", () => {
  it("chaque fonction a une réponse factice CONFORME à son schéma", () => {
    const payloads: { [F in FonctionIa]: Parameters<typeof reponseDemo<F>>[1] } = {
      resumer: { lang: "fr", titre: "Note", texte: "Du texte." },
      brief: payloadBrief("fr", JOUR, [{ nom: "IA", flux: ["https://a.example/rss"] }], {
        evenements: [{ titre: "Point", heure: "10:00" }],
        priorites: [{ titre: "Devis" }],
        tachesPrevues: 7,
        surcharge: true,
      }, false),
      cloture: payloadCloture("fr", JOUR, donnees([tache(1, { priority: "high" }), tache(2, { postponed_count: 4, priority: "low" }), tache(3)])),
      extraire: { lang: "fr", jour: JOUR, texte: "Un e-mail.", etiquettes: ["Admin"] },
      extraire_fichier: { lang: "fr", jour: JOUR, fichier: { media_type: "image/png", data: "AAAA" }, contexte: "", etiquettes: [] },
      vider_tete: { lang: "fr", jour: JOUR, texte: "plein de choses", etiquettes: ["Admin"] },
    };
    for (const f of Object.keys(payloads) as FonctionIa[]) {
      const r = reponseDemo(f, payloads[f] as never);
      expect(valider(SORTIES[f], r), f).toEqual([]);
    }
  });
});
