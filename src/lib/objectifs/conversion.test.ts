import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Completion, Goal, ObjectLink, Task } from "../types";
import { aAnnoncer, planConversion, type PlanConversion } from "./conversion";
import { objectif, tache } from "./objectif.testutil";
import { mesurer, type SourcesProgression } from "./progression";
import { natureDe } from "./structure";

/**
 * ⭐ UNE ÉTAPE VIDE DEVIENT UNE TÂCHE (2026-10-12) — ce que le plan décide, et
 * ce que ça fait aux chiffres.
 *
 * Antonin : « cocher une étape sans tâche n'a pas tellement de sens. Dans ce
 * cas, l'étape est une tâche. »
 *
 * Les tests d'avancement appliquent le plan EN MÉMOIRE (`appliquer`, ci-dessous)
 * et remesurent par la règle unique. La même conversion, écrite pour de bon en
 * base et en démo, est dans `conversion.api.test.ts`.
 */

/**
 * La langue se fixe À L'IMPORT du module d'i18n, depuis `navigator.language` :
 * même montage que `libelles.test.ts`. Sans lui, « 0 étape sur 3 » passe ou
 * casse selon la langue de la machine.
 */
let origineEnClair: (typeof import("./libelles"))["origineEnClair"];
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ origineEnClair } = await import("./libelles"));
});

const MAINTENANT = "2099-01-01 10:00";
const racine = objectif({ id: 1, uid: "g-1", title: "Lancer la boutique" });
const etape = (id: number, parent: number, p: Partial<Goal> = {}) =>
  objectif({ id, uid: `g-${id}`, parent_goal_id: parent, title: `étape ${id}`, ...p });
const faite = (task_id: number): Completion => ({ id: task_id, task_id, date: "2099-01-01", done: 1 });

const sources = (p: Partial<SourcesProgression>): SourcesProgression => ({
  goals: [racine],
  tasks: [],
  completions: [],
  maintenant: MAINTENANT,
  ...p,
});

const plan = (id: number, s: SourcesProgression): PlanConversion => {
  const p = planConversion(id, s);
  if ("refus" in p) throw new Error(`refus inattendu : ${p.refus}`);
  return p;
};

/** Ce que l'accès écrit, rejoué en mémoire : la tâche naît, ce qui suit passe au parent, l'étape s'en va. */
function appliquer(p: PlanConversion, s: SourcesProgression): SourcesProgression {
  const id = 9000 + p.etape.id;
  const neuve: Task = tache({ id, ...p.tache, is_example: p.exemple ? 1 : 0 });
  const suivent = new Set(p.tachesQuiSuivent.map((t) => t.id));
  return {
    ...s,
    goals: s.goals.filter((g) => g.id !== p.etape.id),
    tasks: [...s.tasks.map((t) => (suivent.has(t.id) ? { ...t, goal_id: p.parent.id } : t)), neuve],
    completions: p.faite ? [...s.completions, faite(id)] : [...s.completions],
  };
}

const lire = (g: Goal, s: SourcesProgression) => {
  const m = mesurer(g, s);
  return { pct: m.pct, ligne: origineEnClair(m) };
};

describe("le plan : ce qui suit l'étape", () => {
  it("⭐ le titre, l'échéance, la priorité et la place : la tâche se rattache au PARENT de l'étape", () => {
    const e = etape(2, 1, { title: "Réserver la salle", deadline: "2099-03-04", priority: "high" });
    const p = plan(2, sources({ goals: [racine, e] }));
    expect(p.tache).toEqual({
      label: "Réserver la salle",
      tag: null,
      priority: "high",
      recurrence: "none",
      goal_id: 1,
      due_date: "2099-03-04",
      start_at: null,
      end_at: null,
    });
    expect([p.faite, p.exemple, p.description, p.citations]).toEqual([false, false, null, 0]);
  });

  it("sous une étape : la tâche se rattache à l'étape au-dessus, pas à l'objectif", () => {
    const s = sources({ goals: [racine, etape(2, 1), etape(3, 2)] });
    expect(plan(3, s).tache.goal_id).toBe(2);
  });

  it("sans échéance, la tâche naît sans date ; une priorité inconnue se lit « moyenne »", () => {
    const p = plan(2, sources({ goals: [racine, etape(2, 1, { priority: "urgent" })] }));
    expect([p.tache.due_date, p.tache.priority]).toEqual([null, "medium"]);
  });

  it("une étape COCHÉE donne une tâche faite ; un exemple reste un exemple", () => {
    const s = sources({ goals: [racine, etape(2, 1, { progress_pct: 100 }), etape(3, 1, { is_example: 1 })] });
    expect(plan(2, s).faite).toBe(true);
    expect(plan(3, s).exemple).toBe(true);
  });

  it("⭐ ce qui était rattaché sans compter passe au parent : la tâche récurrente, la note", () => {
    const e = etape(2, 1);
    const lien: ObjectLink = {
      id: 1,
      uid: "l-1",
      from_kind: "goal",
      from_uid: "g-2",
      to_kind: "note",
      to_uid: "n-1",
      origin: "manual",
      created_at: "2099-01-01 00:00:00",
    };
    const s = sources({
      goals: [racine, e],
      tasks: [tache({ id: 5, goal_id: 2, recurrence: "daily" })],
      liens: [lien],
    });
    const p = plan(2, s);
    expect(p.tachesQuiSuivent.map((t) => t.id)).toEqual([5]);
    expect(p.rattachesQuiSuivent).toEqual([{ kind: "note", uid: "n-1" }]);
  });

  it("⚠️ la DESCRIPTION ne suit pas (une tâche n'en a pas) : le plan la rend, pour qu'on le dise avant", () => {
    const p = plan(2, sources({ goals: [racine, etape(2, 1, { description: "  Demander trois devis.  " })] }));
    expect(p.description).toBe("Demander trois devis.");
    expect(plan(2, sources({ goals: [racine, etape(2, 1, { description: "   " })] })).description).toBeNull();
  });

  it("⚠️ une note qui CITE l'étape dans son texte : la note passe au parent, la citation ne suit pas — le plan la compte", () => {
    const cite: ObjectLink = {
      id: 2,
      uid: "l-2",
      from_kind: "note",
      from_uid: "n-7",
      to_kind: "goal",
      to_uid: "g-2",
      origin: "mention",
      created_at: "2099-01-01 00:00:00",
    };
    const p = plan(2, sources({ goals: [racine, etape(2, 1)], liens: [cite] }));
    expect(p.citations).toBe(1);
    expect(p.rattachesQuiSuivent).toEqual([{ kind: "note", uid: "n-7" }]);
    expect(aAnnoncer(p)).toBe(true);
    // Un rattachement fait à la main n'est pas une citation : rien à annoncer.
    const manuel = plan(2, sources({ goals: [racine, etape(2, 1)], liens: [{ ...cite, origin: "manual" }] }));
    expect([manuel.citations, aAnnoncer(manuel)]).toEqual([0, false]);
  });
});

describe("le plan : ce qui ne se convertit pas", () => {
  it("un objectif racine (il n'a pas de parent où ranger la tâche), une étape introuvable", () => {
    expect(planConversion(1, sources({}))).toEqual({ refus: "objectif" });
    expect(planConversion(42, sources({}))).toEqual({ refus: "introuvable" });
  });

  it("⭐ la MÊME question que la case à cocher : une étape qui se mesure autrement reste une étape", () => {
    const refus = (s: SourcesProgression) => planConversion(2, s);
    // une tâche qui compte
    expect(refus(sources({ goals: [racine, etape(2, 1)], tasks: [tache({ id: 5, goal_id: 2 })] }))).toEqual({ refus: "pas-vide" });
    // une sous-étape
    expect(refus(sources({ goals: [racine, etape(2, 1), etape(3, 2)] }))).toEqual({ refus: "pas-vide" });
    // une cible chiffrée
    expect(refus(sources({ goals: [racine, etape(2, 1, { target_count: 10 })] }))).toEqual({ refus: "pas-vide" });
    // suivie à la main
    expect(refus(sources({ goals: [racine, etape(2, 1, { manual_progress: 1, progress_pct: 40 })] }))).toEqual({ refus: "pas-vide" });
  });
});

describe("⭐ l'avancement ne bouge pas à la conversion — et les deux compteurs, si", () => {
  it("trois étapes vides, on en convertit une : 0 % avant, 0 % après ; « 0 étape sur 3 » devient « 0 étape sur 2 · 0 tâche directe sur 1 »", () => {
    // ⚠️ MIS À JOUR EXPRÈS le 2026-10-20 (constat 33) : à côté d'étapes, « tâche directe ».
    const s = sources({ goals: [racine, etape(2, 1), etape(3, 1), etape(4, 1)] });
    expect(lire(racine, s)).toEqual({ pct: 0, ligne: "0 étape sur 3" });
    expect(lire(racine, appliquer(plan(2, s), s))).toEqual({ pct: 0, ligne: "0 étape sur 2 · 0 tâche directe sur 1" });
  });

  it("l'étape convertie était COCHÉE : 33 % avant, 33 % après ; elle quitte les étapes faites pour les tâches faites", () => {
    const s = sources({ goals: [racine, etape(2, 1, { progress_pct: 100 }), etape(3, 1), etape(4, 1)] });
    expect(lire(racine, s)).toEqual({ pct: 33, ligne: "1 étape sur 3" });
    expect(lire(racine, appliquer(plan(2, s), s))).toEqual({ pct: 33, ligne: "0 étape sur 2 · 1 tâche directe sur 1" });
  });

  it("⭐ elle était la SEULE étape de son parent : le parent garde son chiffre, et redevient une étape (il n'en contient plus)", () => {
    const phase = etape(2, 1);
    const s = sources({ goals: [racine, phase, etape(3, 2), etape(4, 1)] });
    expect(natureDe(phase, s.goals)).toBe("phase");
    expect(lire(phase, s)).toEqual({ pct: 0, ligne: "0 étape sur 1" });
    expect(lire(racine, s).pct).toBe(0);

    const apres = appliquer(plan(3, s), s);
    expect(natureDe(phase, apres.goals)).toBe("etape");
    expect(lire(phase, apres)).toEqual({ pct: 0, ligne: "0 tâche sur 1" });
    expect(lire(racine, apres)).toEqual(lire(racine, s));
  });

  it("⭐ le parent MÉLANGE étapes et tâches : une étape vide pesait une unité, la tâche pèse une unité — 44 % avant, 44 % après", () => {
    // A (vide), B (trois tâches dont une faite), et une tâche directe faite.
    const s = sources({
      goals: [racine, etape(2, 1), etape(3, 1)],
      tasks: [tache({ id: 10, goal_id: 3 }), tache({ id: 11, goal_id: 3 }), tache({ id: 12, goal_id: 3 }), tache({ id: 13, goal_id: 1 })],
      completions: [faite(10), faite(13)],
    });
    // (0 + 1/3 + 1) / 3
    expect(lire(racine, s)).toEqual({ pct: 44, ligne: "0 étape sur 2 · 1 tâche directe sur 1" });
    // (1/3 + 1 + 0) / 3 : le même total, la même somme.
    expect(lire(racine, appliquer(plan(2, s), s))).toEqual({ pct: 44, ligne: "0 étape sur 1 · 1 tâche directe sur 2" });
  });

  it("⚠️ LE SEUL CAS OÙ LE CHIFFRE BOUGE : une étape qui porte un vieux POIDS différent de 1 (plus rien ne l'écrit depuis le 2026-09-30)", () => {
    // Une étape vide de poids 3 à côté d'une étape finie de poids 1.
    const lourde = etape(2, 1, { weight: 3 });
    const finie = etape(3, 1, { progress_pct: 100 });
    const s = sources({ goals: [racine, lourde, finie] });
    // (0 × 3 + 1 × 1) / 4
    expect(lire(racine, s).pct).toBe(25);
    // Une tâche pèse toujours 1 : (1 + 0) / 2.
    expect(lire(racine, appliquer(plan(2, s), s)).pct).toBe(50);
  });

  it("une tâche récurrente qui suit au parent ne change rien : elle ne comptait pas, elle ne compte toujours pas", () => {
    const s = sources({
      goals: [racine, etape(2, 1), etape(3, 1, { progress_pct: 100 })],
      tasks: [tache({ id: 5, goal_id: 2, recurrence: "daily" })],
    });
    const apres = appliquer(plan(2, s), s);
    expect(lire(racine, apres).pct).toBe(lire(racine, s).pct);
    expect(apres.tasks.find((t) => t.id === 5)?.goal_id).toBe(1);
  });
});
