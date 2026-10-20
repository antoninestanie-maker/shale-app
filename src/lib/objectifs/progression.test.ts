import { describe, expect, it } from "vitest";

import { effectiveProgress } from "../logic";
import type { CalendarEvent, Completion, Goal, Habit, HabitCheck, ObjectLink, Task } from "../types";
import { objectif } from "./objectif.testutil";
import { enfantsDe, estAcheve, estCochee, evenementPasse, mesurer, pourcentDe, uidDeLigne, type SourcesProgression } from "./progression";
import { niveauDe, peutAjouterEtape } from "./structure";

// ─── Fabriques ──────────────────────────────────────────────────────────────

const MAINTENANT = "2026-09-15 10:00";

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1,
  label: "t",
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
  is_example: 0,
  ...p,
});

const fait = (task_id: number, date = "2026-09-10", done = 1): Completion => ({
  id: task_id * 1000 + Number(date.slice(-2)),
  task_id,
  date,
  done,
});

const habitude = (p: Partial<Habit> = {}): Habit => ({
  id: 1,
  name: "backtest",
  color: "#3cd9b0",
  archived: 0,
  is_example: 0,
  ...p,
});

const coche = (habit_id: number, date: string): HabitCheck => ({ id: Number(date.replace(/-/g, "")), habit_id, date });

const evenement = (p: Partial<CalendarEvent & { uid: string }> = {}): CalendarEvent & { uid: string } => ({
  id: 1,
  uid: "ev-1",
  title: "rendez-vous banque",
  body: null,
  date: "2026-09-10",
  end_date: null,
  start_at: "14:00",
  end_at: "15:00",
  all_day: 0,
  color: null,
  recurrence: "none",
  created_at: "2026-09-01 09:00:00",
  updated_at: "2026-09-01 09:00:00",
  ...p,
});

const lien = (from: [ObjectLink["from_kind"], string], to: [ObjectLink["to_kind"], string]): ObjectLink => ({
  id: 1,
  uid: `ol:${from.join(":")}:${to.join(":")}`,
  from_kind: from[0],
  from_uid: from[1],
  to_kind: to[0],
  to_uid: to[1],
  origin: "manual",
  created_at: "2026-09-01 09:00:00",
});

const sources = (p: Partial<SourcesProgression> = {}): SourcesProgression => ({
  goals: [],
  tasks: [],
  completions: [],
  maintenant: MAINTENANT,
  ...p,
});

/** Un objectif mesuré, racine, uid stable. */
const racine = (p: Partial<Goal> = {}) => objectif({ id: 1, uid: "g-1", ...p });
const etape = (id: number, parent: number, p: Partial<Goal> = {}) =>
  objectif({ id, uid: `g-${id}`, parent_goal_id: parent, ...p });

// ─── Le calcul ──────────────────────────────────────────────────────────────

describe("sous-objectif : part des éléments faits", () => {
  it("3 tâches faites sur 7 valent 43 %, et la ligne sait le dire", () => {
    const g = racine();
    const taches = Array.from({ length: 7 }, (_, i) => tache({ id: i + 1, goal_id: 1 }));
    const m = mesurer(g, sources({ goals: [g], tasks: taches, completions: [fait(1), fait(2), fait(3)] }));
    expect(m.pct).toBe(43);
    // 2026-10-11 : l'origine dit aussi combien d'étapes il y a, et combien de faites
    // (elle disait `etapesComptees`, qui taisait les étapes vides).
    expect(m.origine).toEqual({
      type: "feuille",
      elementsFaits: 3,
      elementsTotal: 7,
      elementsSontDesTaches: true,
      etapesFaites: 0,
      etapesTotal: 0,
    });
  });

  it("une complétion décochée ne compte pas", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], tasks: [tache({ goal_id: 1 })], completions: [fait(1, "2026-09-10", 0)] }));
    expect(m.pct).toBe(0);
  });
});

describe("pondération", () => {
  it("un jalon de poids 3 pèse trois fois un jalon de poids 1", () => {
    const g = racine();
    const lourd = etape(2, 1, { is_milestone: 1, weight: 3, manual_progress: 1, progress_pct: 100 });
    const leger = etape(3, 1, { is_milestone: 1, weight: 1, manual_progress: 1, progress_pct: 0 });
    expect(mesurer(g, sources({ goals: [g, lourd, leger] })).pct).toBe(75);
  });

  it("un poids ≤ 0 se lit comme 1 : aucune étape ne disparaît du calcul", () => {
    const g = racine();
    const nul = etape(2, 1, { weight: 0, manual_progress: 1, progress_pct: 100 });
    const negatif = etape(3, 1, { weight: -4, manual_progress: 1, progress_pct: 0 });
    expect(mesurer(g, sources({ goals: [g, nul, negatif] })).pct).toBe(50);
  });

  it("tous les poids à 1 rendent EXACTEMENT l'ancienne règle : enfants et tâches à parts égales", () => {
    // Avant la 026 : moyenne de (enfants) ∪ (tâches ponctuelles), chacun une part.
    const g = racine();
    const enfant = etape(2, 1, { manual_progress: 1, progress_pct: 40 });
    const taches = [tache({ id: 1, goal_id: 1 }), tache({ id: 2, goal_id: 1 })];
    // (40 + 100 + 0) / 3 = 46,67 → 47
    expect(mesurer(g, sources({ goals: [g, enfant], tasks: taches, completions: [fait(1)] })).pct).toBe(47);
  });

  it("trois niveaux : racine → jalons → sous-objectifs", () => {
    const g = racine();
    const j1 = etape(2, 1, { is_milestone: 1 });
    const j2 = etape(3, 1, { is_milestone: 1 });
    const s1 = etape(4, 2, { target_count: 10, manual_count: 10 }); // 100 %
    const s2 = etape(5, 2, { target_count: 10, manual_count: 0 }); // 0 %
    const s3 = etape(6, 3, { target_count: 4, manual_count: 1 }); // 25 %
    // j1 = 50 %, j2 = 25 % → racine 37,5 → 38
    expect(mesurer(g, sources({ goals: [g, j1, j2, s1, s2, s3] })).pct).toBe(38);
  });
});

describe("cible chiffrée", () => {
  it("12/50 backtests = 24 %, et le compte reste lisible", () => {
    const g = racine({ target_count: 50, target_unit: "backtests", manual_count: 12 });
    const m = mesurer(g, sources({ goals: [g] }));
    expect(m.pct).toBe(24);
    expect(m.origine).toEqual({ type: "cible", compte: 12, cible: 50, unite: "backtests", source: "manual" });
  });

  it("⭐ 299 sur 300 n'est pas atteint : 99 %, pas 100 (objectifs-7)", () => {
    const g = racine({ target_count: 300, target_unit: "séances", manual_count: 299 });
    const m = mesurer(g, sources({ goals: [g] }));
    expect(m.pct).toBe(99);
    expect(estAcheve(m)).toBe(false);
  });

  it("atteinte : 100 %", () => {
    const g = racine({ target_count: 50, manual_count: 50 });
    expect(mesurer(g, sources({ goals: [g] })).pct).toBe(100);
  });

  it("dépassée : le % plafonne à 100, le compte ne ment pas", () => {
    const g = racine({ target_count: 10_000, target_unit: "€", manual_count: 12_500 });
    const m = mesurer(g, sources({ goals: [g] }));
    expect(m.pct).toBe(100);
    expect(m.fraction).toBe(1);
    expect(m.origine).toMatchObject({ compte: 12_500, cible: 10_000 });
  });

  it("à 0 : « atteindre zéro » ne se mesure pas — une PANNE, pas une étape vide (2026-10-11)", () => {
    const g = racine({ target_count: 0, manual_count: 3 });
    const m = mesurer(g, sources({ goals: [g] }));
    expect(m.pct).toBeNull();
    // S'appelait `{ type: "vide" }` : le mot désigne maintenant ce qui se coche.
    expect(m.origine).toEqual({ type: "panne", raison: "cible-nulle" });
  });

  it("un compteur manuel négatif se lit 0", () => {
    const g = racine({ target_count: 5, manual_count: -3 });
    expect(mesurer(g, sources({ goals: [g] })).pct).toBe(0);
  });

  it("une source inconnue (version future) se lit comme un compteur manuel", () => {
    const g = racine({ target_count: 4, manual_count: 2, count_source: "trades" });
    expect(mesurer(g, sources({ goals: [g] })).origine).toMatchObject({ type: "cible", source: "manual", compte: 2 });
  });

  it("cibles et éléments coexistent dans le même objectif", () => {
    const g = racine();
    const chiffre = etape(2, 1, { target_count: 4, manual_count: 2 }); // 50 %
    const elements = etape(3, 1); // 1/1 tâche faite = 100 %
    const m = mesurer(g, sources({ goals: [g, chiffre, elements], tasks: [tache({ goal_id: 3 })], completions: [fait(1)] }));
    expect(m.pct).toBe(75);
  });
});

describe("« depuis le rattachement, jamais depuis toujours »", () => {
  const hab = habitude({ id: 9, uid: "hab-9" });
  const checks = ["2026-08-30", "2026-09-01", "2026-09-05", "2026-09-06", "2026-09-14"].map((d) => coche(9, d));

  it("une habitude tenue depuis longtemps ne remplit pas la cible le jour du rattachement", () => {
    const g = racine({ target_count: 10, count_source: "habit", count_ref_uid: "hab-9", count_since: "2026-09-05" });
    const m = mesurer(g, sources({ goals: [g], habits: [hab], habitChecks: checks }));
    expect(m.origine).toMatchObject({ type: "cible", compte: 3, source: "habit" });
    expect(m.pct).toBe(30);
  });

  it("sans `count_since`, la borne est le jour de création — jamais « depuis toujours »", () => {
    const g = racine({ target_count: 10, count_source: "habit", count_ref_uid: "hab-9", created_at: "2026-09-01 08:00:00" });
    expect(mesurer(g, sources({ goals: [g], habits: [hab], habitChecks: checks })).origine).toMatchObject({ compte: 4 });
  });

  it("une tâche récurrente compte ses jours cochés depuis la borne, et pas un jour futur", () => {
    const recurrente = tache({ id: 4, uid: "t-4", recurrence: "daily" });
    const g = racine({ target_count: 20, count_source: "task", count_ref_uid: "t-4", count_since: "2026-09-10" });
    const completions = [fait(4, "2026-09-09"), fait(4, "2026-09-10"), fait(4, "2026-09-11"), fait(4, "2026-09-12", 0), fait(4, "2026-09-20")];
    expect(mesurer(g, sources({ goals: [g], tasks: [recurrente], completions })).origine).toMatchObject({ compte: 2 });
  });

  it("une source disparue est une PANNE : pas de mesure, pas un 0 % trompeur sur sa ligne", () => {
    const g = racine({ target_count: 10, count_source: "habit", count_ref_uid: "hab-supprimee" });
    const m = mesurer(g, sources({ goals: [g], habits: [hab] }));
    expect(m.pct).toBeNull();
    expect(m.origine).toEqual({ type: "panne", raison: "source-introuvable" });
  });

  it("une habitude d'exemple ne compte pas, même citée comme source", () => {
    const exemple = habitude({ id: 9, uid: "hab-9", is_example: 1 });
    const g = racine({ target_count: 10, count_source: "habit", count_ref_uid: "hab-9" });
    expect(mesurer(g, sources({ goals: [g], habits: [exemple], habitChecks: checks })).pct).toBeNull();
  });

  it("en démo, l'uid se reconstitue comme `uidDemo()` l'écrit", () => {
    expect(uidDeLigne("task", { id: 6 })).toBe("demo:task:6");
    const g = racine({ target_count: 2, count_source: "task", count_ref_uid: "demo:task:6", count_since: "2026-09-01" });
    const t = tache({ id: 6, recurrence: "daily" });
    expect(mesurer(g, sources({ goals: [g], tasks: [t], completions: [fait(6, "2026-09-03")] })).pct).toBe(50);
  });
});

describe("écrire n'est pas avancer", () => {
  it("une tâche récurrente rattachée ne compte JAMAIS en binaire — elle est listée, non comptée", () => {
    const g = racine();
    const recurrente = tache({ id: 1, uid: "t-1", goal_id: 1, recurrence: "daily" });
    const ponctuelle = tache({ id: 2, goal_id: 1 });
    const m = mesurer(g, sources({ goals: [g], tasks: [recurrente, ponctuelle], completions: [fait(1), fait(2)] }));
    expect(m.pct).toBe(100);
    expect(m.origine).toMatchObject({ elementsFaits: 1, elementsTotal: 1 });
    expect(m.nonComptes).toEqual([{ kind: "task", uid: "t-1" }]);
  });

  // ⚠️ RÈGLE RETOURNÉE le 2026-10-11. Ce test disait « … il est vide » et
  // attendait `pct: null`. Une récurrente ne compte toujours pas en binaire ;
  // mais l'objectif qui n'a qu'elle est désormais une unité À COCHER — il n'est
  // pas bloqué à 0 %, puisqu'on peut le cocher.
  it("un objectif qui n'a qu'une récurrente n'est pas bloqué à 0 % : il se coche", () => {
    const g = racine();
    const taches = [tache({ goal_id: 1, recurrence: "weekdays" })];
    expect(mesurer(g, sources({ goals: [g], tasks: taches }))).toMatchObject({ pct: 0, origine: { type: "unite", faite: false } });
    const coche = { ...g, progress_pct: 100 };
    expect(mesurer(coche, sources({ goals: [coche], tasks: taches })).pct).toBe(100);
  });

  it("une note et une fiche du Savoir s'affichent comme ressources et ne comptent pas", () => {
    const g = racine();
    const liens = [lien(["note", "n-1"], ["goal", "g-1"]), lien(["goal", "g-1"], ["knowledge", "k-1"])];
    const m = mesurer(g, sources({ goals: [g], tasks: [tache({ goal_id: 1 })], liens }));
    expect(m.pct).toBe(0); // la seule unité comptable est la tâche, non faite
    expect(m.origine).toMatchObject({ elementsTotal: 1 });
    expect(m.ressources).toEqual([
      { kind: "note", uid: "n-1" },
      { kind: "knowledge", uid: "k-1" },
    ]);
  });

  // 2026-10-11 : il était « vide » (`pct: null`) ; il est une unité à 0 %. Ce
  // que le test garde n'a pas bougé : la note ne le fait pas avancer.
  it("un objectif qui n'a QUE des notes reste à 0 % : écrire dessus ne le fait pas avancer", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], liens: [lien(["note", "n-1"], ["goal", "g-1"])] }));
    expect(m).toMatchObject({ pct: 0, origine: { type: "unite", faite: false } });
    expect(m.ressources).toEqual([{ kind: "note", uid: "n-1" }]);
  });
});

describe("événements", () => {
  it("un rendez-vous compte une unité une fois PASSÉ, pas avant", () => {
    const g = racine();
    const liens = [lien(["goal", "g-1"], ["event", "ev-1"]), lien(["goal", "g-1"], ["event", "ev-2"])];
    const evenements = [evenement(), evenement({ id: 2, uid: "ev-2", date: "2026-09-20" })];
    expect(mesurer(g, sources({ goals: [g], liens, evenements })).origine).toMatchObject({ elementsFaits: 1, elementsTotal: 2 });
  });

  it("passé = sa FIN : un séjour de trois jours n'est pas tenu le premier matin", () => {
    const sejour = evenement({ date: "2026-09-14", end_date: "2026-09-16", start_at: null, end_at: null });
    expect(evenementPasse(sejour, "2026-09-15 10:00")).toBe(false);
    expect(evenementPasse(sejour, "2026-09-17 00:00")).toBe(true);
    expect(evenementPasse(evenement({ date: "2026-09-15", end_at: "09:30" }), "2026-09-15 10:00")).toBe(true);
    expect(evenementPasse(evenement({ date: "2026-09-15", start_at: null, end_at: null }), "2026-09-15 23:59")).toBe(false);
  });

  it("un événement récurrent ne compte pas en binaire", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], liens: [lien(["event", "ev-1"], ["goal", "g-1"])], evenements: [evenement({ recurrence: "daily" })] }));
    // 2026-10-11 : `pct` valait `null` (objectif « vide ») ; c'est une unité à 0 %.
    expect(m.origine).toEqual({ type: "unite", faite: false });
    expect(m.nonComptes).toEqual([{ kind: "event", uid: "ev-1" }]);
  });

  it("une arête vers un événement absent ne fabrique pas d'unité fantôme", () => {
    const g = racine();
    // 2026-10-11 : attendait `pct: null`. Toujours aucune unité fabriquée —
    // l'objectif reste l'unité vide qu'il était, à 0 %.
    expect(mesurer(g, sources({ goals: [g], liens: [lien(["goal", "g-1"], ["event", "disparu"])] })).origine).toEqual({ type: "unite", faite: false });
  });
});

describe("dédoublonnage", () => {
  it("une tâche liée par `goal_id` ET par une arête compte une fois", () => {
    const g = racine();
    const t = tache({ id: 1, uid: "t-1", goal_id: 1 });
    const liens = [lien(["goal", "g-1"], ["task", "t-1"]), lien(["task", "t-1"], ["goal", "g-1"])];
    expect(mesurer(g, sources({ goals: [g], tasks: [t], liens, completions: [fait(1)] })).origine).toMatchObject({ elementsTotal: 1 });
  });

  it("une tâche d'exemple rattachée ne compte pas", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], tasks: [tache({ id: 1, goal_id: 1 }), tache({ id: 2, goal_id: 1, is_example: 1 })], completions: [fait(1)] }));
    expect(m.pct).toBe(100);
  });
});

/**
 * ⚠️⚠️ RÈGLE RETOURNÉE LE 2026-10-11 — ce bloc s'appelait « les vides sortent
 * du dénominateur, et se signalent » (règle du 2026-09-16).
 *
 * Antonin, le 2026-10-11 : « Pour les étapes vides, donne la possibilité de
 * cocher une étape pour que ce soit compté. » Le labo du même jour (constat 3,
 * les cinq utilisateurs) : trois étapes dont une seule garnie, et l'objectif
 * affichait 50 % ou 100 % à côté de deux « — ». Une étape vide est maintenant
 * UNE UNITÉ : 0 non cochée, 100 % cochée, et elle pèse chez son parent.
 *
 * Chaque test de l'ancienne règle est resté À SA PLACE, avec le chiffre qu'il
 * attendait AVANT écrit en commentaire : ce sont les mêmes feuilles de route,
 * et c'est exactement ce qui change sur une vraie base.
 */
describe("⭐ une étape vide se coche, et elle compte (2026-10-11)", () => {
  it("non cochée, elle vaut 0 ; cochée, 100 % — et la mesure dit que c'est une unité", () => {
    const g = racine();
    const vide = etape(2, 1);
    expect(mesurer(vide, sources({ goals: [g, vide] }))).toMatchObject({ pct: 0, fraction: 0, origine: { type: "unite", faite: false } });
    const cochee = etape(2, 1, { progress_pct: 100 });
    expect(mesurer(cochee, sources({ goals: [g, cochee] }))).toMatchObject({ pct: 100, fraction: 1, origine: { type: "unite", faite: true } });
  });

  it("⭐ trois étapes dont une cochée : 33 %, « 1 étape sur 3 »", () => {
    const g = racine();
    const etapes = [etape(2, 1, { progress_pct: 100 }), etape(3, 1), etape(4, 1)];
    const m = mesurer(g, sources({ goals: [g, ...etapes] }));
    expect(m.pct).toBe(33);
    expect(m.origine).toMatchObject({ type: "feuille", etapesFaites: 1, etapesTotal: 3, elementsTotal: 0 });
    expect(effectiveProgress(g, [g, ...etapes], [], [], { maintenant: MAINTENANT })).toBe(33);
  });

  it("⭐ le constat du labo : une étape garnie (1 tâche sur 2) et deux vides font 17 %, plus 50 %", () => {
    const g = racine();
    const etapes = [etape(2, 1), etape(3, 1), etape(4, 1)];
    const taches = [tache({ id: 1, goal_id: 2 }), tache({ id: 2, goal_id: 2 })];
    const m = mesurer(g, sources({ goals: [g, ...etapes], tasks: taches, completions: [fait(1)] }));
    expect(m.pct).toBe(17); // (50 + 0 + 0) / 3 — AVANT le 2026-10-11 : 50
    expect(m.origine).toMatchObject({ etapesFaites: 0, etapesTotal: 3 });
  });

  it("une phase vide se coche comme un sous-objectif", () => {
    const g = racine();
    const phase = etape(2, 1, { is_milestone: 1, progress_pct: 100 });
    expect(mesurer(phase, sources({ goals: [g, phase] })).origine).toEqual({ type: "unite", faite: true });
  });

  it("⭐ un objectif RACINE sans rien se coche « Atteint » au lieu de rester à « — »", () => {
    const g = racine();
    expect(mesurer(g, sources({ goals: [g] }))).toMatchObject({ pct: 0, origine: { type: "unite", faite: false } });
    const atteint = racine({ progress_pct: 100 });
    const m = mesurer(atteint, sources({ goals: [atteint] }));
    expect(m.pct).toBe(100);
    expect(estAcheve(m)).toBe(true);
  });

  it("la coche est `progress_pct = 100`, rien d'autre : un ancien 45 % mesuré n'est pas une coche", () => {
    expect(estCochee({ progress_pct: 100 })).toBe(true);
    expect(estCochee({ progress_pct: 140 })).toBe(true); // borné, comme le % manuel
    expect(estCochee({ progress_pct: 99 })).toBe(false);
    expect(estCochee({ progress_pct: 45 })).toBe(false);
    expect(estCochee({ progress_pct: 0 })).toBe(false);
  });

  describe("⭐ la bascule : dès qu'elle contient quelque chose, ce qu'elle contient la mesure", () => {
    const g = racine();
    const cochee = etape(2, 1, { progress_pct: 100 });

    it("une tâche donnée à une étape cochée : 0/1, donc 0 % — la coche ne compte plus", () => {
      const t = tache({ id: 1, goal_id: 2 });
      const m = mesurer(cochee, sources({ goals: [g, cochee], tasks: [t] }));
      expect(m).toMatchObject({ pct: 0, origine: { type: "feuille", elementsFaits: 0, elementsTotal: 1 } });
      // … et la tâche cochée la remet à 100 %, par la tâche cette fois.
      expect(mesurer(cochee, sources({ goals: [g, cochee], tasks: [t], completions: [fait(1)] })).pct).toBe(100);
    });

    it("⭐ SANS PERTE : la coche dort dans la ligne, et revient si l'étape redevient vide", () => {
      const avecTache = sources({ goals: [g, cochee], tasks: [tache({ id: 1, goal_id: 2 })] });
      expect(mesurer(cochee, avecTache).pct).toBe(0);
      const tacheDetachee = sources({ goals: [g, cochee], tasks: [tache({ id: 1, goal_id: null })] });
      expect(mesurer(cochee, tacheDetachee)).toMatchObject({ pct: 100, origine: { type: "unite", faite: true } });
    });

    it("une sous-étape donnée à une phase cochée : la phase vaut ce que vaut la sous-étape", () => {
      const phase = etape(2, 1, { is_milestone: 1, progress_pct: 100 });
      const sous = etape(3, 2);
      expect(mesurer(phase, sources({ goals: [g, phase, sous] }))).toMatchObject({ pct: 0, origine: { type: "feuille", etapesFaites: 0, etapesTotal: 1 } });
    });

    it("une cible donnée à une étape cochée : c'est le compte qui parle", () => {
      const cible = etape(2, 1, { progress_pct: 100, target_count: 4, manual_count: 1 });
      expect(mesurer(cible, sources({ goals: [g, cible] }))).toMatchObject({ pct: 25, origine: { type: "cible" } });
    });

    it("une récurrente ou une note ne suffisent pas : rien ne se compte, l'étape reste à cocher", () => {
      const s = sources({
        goals: [g, cochee],
        tasks: [tache({ id: 1, goal_id: 2, recurrence: "daily" })],
        liens: [lien(["note", "n-1"], ["goal", "g-2"])],
      });
      expect(mesurer(cochee, s).origine).toEqual({ type: "unite", faite: true });
    });
  });

  describe("⭐ le suivi à la main reste SOUVERAIN (décision du 2026-09-14, gardée)", () => {
    it("une étape suivie à la main garde son chiffre, vide ou pas — elle n'est pas une unité", () => {
      const g = racine();
      const manuelle = etape(2, 1, { manual_progress: 1, progress_pct: 40 });
      expect(mesurer(manuelle, sources({ goals: [g, manuelle] }))).toMatchObject({ pct: 40, origine: { type: "manuel" } });
      // 100 % saisi à la main n'est pas une coche : l'origine reste « manuel ».
      const pleine = etape(2, 1, { manual_progress: 1, progress_pct: 100 });
      expect(mesurer(pleine, sources({ goals: [g, pleine] })).origine).toEqual({ type: "manuel" });
    });

    it("un objectif suivi à la main ne bouge pas, quelles que soient ses étapes vides", () => {
      const g = racine({ manual_progress: 1, progress_pct: 60 });
      const etapes = [etape(2, 1), etape(3, 1), etape(4, 1)];
      expect(mesurer(g, sources({ goals: [g, ...etapes] })).pct).toBe(60);
    });
  });

  // ── Les tests de l'ancienne règle, mis à jour EXPRÈS le 2026-10-11 ─────────

  it("[ancienne règle : « un jalon vide est exclu »] il tire désormais la moyenne : 20 %, plus 60 %", () => {
    const g = racine();
    const plein = etape(2, 1, { is_milestone: 1, target_count: 10, manual_count: 6 });
    const vide1 = etape(3, 1, { is_milestone: 1 });
    const vide2 = etape(4, 1, { is_milestone: 1 });
    const m = mesurer(g, sources({ goals: [g, plein, vide1, vide2] }));
    expect(m.pct).toBe(20); // (60 + 0 + 0) / 3 — AVANT : 60, `vides: 2`, `etapesComptees: 1`
    expect(m.origine).toMatchObject({ etapesFaites: 0, etapesTotal: 3 });
  });

  it("[ancienne règle : « un jalon aux sous-objectifs vides est vide lui-même »] il vaut 0 %, et se mesure", () => {
    const g = racine();
    const jalon = etape(2, 1, { is_milestone: 1 });
    const s = etape(3, 2);
    // AVANT : `{ type: "vide", raison: "etapes-vides" }`, exclu chez la racine.
    expect(mesurer(jalon, sources({ goals: [g, jalon, s] }))).toMatchObject({ pct: 0, origine: { type: "feuille", etapesFaites: 0, etapesTotal: 1 } });
    expect(mesurer(g, sources({ goals: [g, jalon, s] })).pct).toBe(0);
    // Cocher le sous-objectif finit la phase, et l'objectif.
    const fait = etape(3, 2, { progress_pct: 100 });
    expect(mesurer(g, sources({ goals: [g, jalon, fait] })).pct).toBe(100);
  });

  it("[ancienne règle : « `effectiveProgress` rend le % stocké »] un objectif vide vaut 0, pas son ancien 35 %", () => {
    // Un objectif MESURÉ qui gardait un vieux % saisi affichait « — » dans la
    // liste et « 35 % » sur Aujourd'hui : deux chiffres. Il vaut 0 partout, et
    // son 35 % revient s'il repasse en « suivi à la main » (rien n'est effacé).
    const g = racine({ progress_pct: 35 });
    expect(mesurer(g, sources({ goals: [g] })).origine).toEqual({ type: "unite", faite: false });
    expect(effectiveProgress(g, [g], [], [], { maintenant: MAINTENANT })).toBe(0); // AVANT : 35
    const manuel = { ...g, manual_progress: 1 };
    expect(effectiveProgress(manuel, [manuel], [], [], { maintenant: MAINTENANT })).toBe(35);
  });

  it("[ancienne règle : « 4 jalons finis et 2 vides font 100 %, pas achevé »] ils font 67 %", () => {
    const g = racine();
    const finis = [2, 3, 4, 5].map((id) => etape(id, 1, { is_milestone: 1, target_count: 1, manual_count: 1 }));
    const vides = [6, 7].map((id) => etape(id, 1, { is_milestone: 1 }));
    const m = mesurer(g, sources({ goals: [g, ...finis, ...vides] }));
    expect(m.pct).toBe(67); // AVANT : 100, `videsProfonds: 2`, et `estAcheve` rattrapait
    expect(m.origine).toMatchObject({ etapesFaites: 4, etapesTotal: 6 });
    expect(estAcheve(m)).toBe(false);
    // Les deux vides cochées : 100 %, et achevé — sans réserve.
    const cochees = vides.map((v) => ({ ...v, progress_pct: 100 }));
    expect(estAcheve(mesurer(g, sources({ goals: [g, ...finis, ...cochees] })))).toBe(true);
  });

  it("[ancienne règle : « une étape vide ENFOUIE empêche l'achèvement »] elle le fait par le chiffre : 50 %", () => {
    const g = racine();
    const jalon = etape(2, 1, { is_milestone: 1 });
    const fini = etape(3, 2, { target_count: 1, manual_count: 1 });
    const vide = etape(4, 2);
    const m = mesurer(g, sources({ goals: [g, jalon, fini, vide] }));
    expect(m.pct).toBe(50); // AVANT : 100, `videsProfonds: 1`
    expect(estAcheve(m)).toBe(false);
    expect(estAcheve(mesurer(g, sources({ goals: [g, jalon, fini] })))).toBe(true);
  });

  it("⭐ « 100 % » veut dire « terminé » : `estAcheve` ne lit plus que le pourcentage", () => {
    expect(estAcheve({ pct: 100 })).toBe(true);
    expect(estAcheve({ pct: 99 })).toBe(false);
    expect(estAcheve({ pct: null })).toBe(false);
  });

  describe("un réglage cassé n'est pas une étape vide", () => {
    const g = racine();
    const finie = etape(2, 1, { target_count: 1, manual_count: 1 });
    const cassee = etape(3, 1, { target_count: 10, count_source: "habit", count_ref_uid: "hab-supprimee" });

    it("il n'a pas de mesure, ne se coche pas, et pèse 0 chez son parent tant qu'il n'est pas réparé", () => {
      const s = sources({ goals: [g, finie, cassee] });
      expect(mesurer(cassee, s)).toMatchObject({ pct: null, origine: { type: "panne", raison: "source-introuvable" } });
      const m = mesurer(g, s);
      expect(m.pct).toBe(50); // AVANT : 100 (la panne sortait du dénominateur)
      expect(m.origine).toMatchObject({ etapesFaites: 1, etapesTotal: 2 });
      expect(estAcheve(m)).toBe(false);
    });

    it("`pourcentDe` rend 0 pour lui — le nombre d'Aujourd'hui, du péril et de la revue", () => {
      expect(pourcentDe(mesurer(cassee, sources({ goals: [g, cassee] })))).toBe(0);
      // … même si une coche dormait dans la ligne : elle n'est pas un repli.
      const cocheeAvant = { ...cassee, progress_pct: 100 };
      expect(effectiveProgress(cocheeAvant, [g, cocheeAvant], [], [], { maintenant: MAINTENANT })).toBe(0);
    });
  });

  it("une étape d'exemple n'entre pas dans le calcul d'un objectif RÉEL", () => {
    const g = racine();
    const vraie = etape(2, 1, { manual_progress: 1, progress_pct: 80 });
    const suggeree = etape(3, 1, { manual_progress: 1, progress_pct: 0, is_example: 1 });
    expect(mesurer(g, sources({ goals: [g, vraie, suggeree] })).pct).toBe(80);
  });

  it("⚠️ un objectif réel qui ne porte QUE des étapes d'exemple n'est pas une case à cocher au-dessus d'elles", () => {
    const g = racine({ progress_pct: 100 });
    const suggeree = etape(2, 1, { is_example: 1 });
    expect(mesurer(g, sources({ goals: [g, suggeree] }))).toMatchObject({ pct: 0, origine: { type: "feuille", etapesTotal: 0 } });
  });
});

/**
 * ⭐ Audit A06a-02 (2026-10-11) — l'objectif d'exemple du premier lancement
 * promet que « l'avancement se calcule tout seul quand tu coches les tâches »,
 * et restait à « — » quoi qu'on coche : le filtre des exemples écartait ses
 * propres étapes. Un exemple ne nourrit jamais un objectif RÉEL ; un objectif
 * d'exemple se mesure sur ses exemples.
 */
describe("⭐ l'objectif d'exemple se mesure sur ses propres exemples (A06a-02)", () => {
  const exemple = racine({ is_example: 1 });
  const e1 = etape(2, 1, { is_example: 1, position: 0 });
  const e2 = etape(3, 1, { is_example: 1, position: 1 });
  const tacheExemple = tache({ id: 1, goal_id: 2, is_example: 1 });

  it("au premier lancement : 0 %, deux étapes, aucune faite — plus « — »", () => {
    const s = sources({ goals: [exemple, e1, e2], tasks: [tacheExemple] });
    expect(enfantsDe(exemple, s.goals).map((g) => g.id)).toEqual([2, 3]);
    expect(mesurer(exemple, s)).toMatchObject({ pct: 0, origine: { type: "feuille", etapesFaites: 0, etapesTotal: 2 } });
    expect(mesurer(e1, s)).toMatchObject({ pct: 0, origine: { type: "feuille", elementsTotal: 1 } });
    expect(mesurer(e2, s).origine).toEqual({ type: "unite", faite: false });
  });

  it("cocher la tâche d'exemple (elle est adoptée) : l'étape à 100 %, l'objectif à 50 %", () => {
    const adoptee = { ...tacheExemple, is_example: 0 };
    const s = sources({ goals: [exemple, e1, e2], tasks: [adoptee], completions: [fait(1)] });
    expect(mesurer(e1, s).pct).toBe(100);
    expect(mesurer(exemple, s).pct).toBe(50); // AVANT : « — », pour toujours
  });

  it("puis cocher l'autre étape, vide : l'objectif d'exemple est atteint", () => {
    const adoptee = { ...tacheExemple, is_example: 0 };
    const e2Cochee = { ...e2, progress_pct: 100 };
    const s = sources({ goals: [exemple, e1, e2Cochee], tasks: [adoptee], completions: [fait(1)] });
    expect(estAcheve(mesurer(exemple, s))).toBe(true);
  });
});

describe("repli manuel — le manuel reste souverain (décision du 2026-09-14)", () => {
  it("un objectif manuel sans étape rend son % saisi", () => {
    const g = racine({ manual_progress: 1, progress_pct: 45 });
    expect(mesurer(g, sources({ goals: [g] }))).toMatchObject({ pct: 45, origine: { type: "manuel" } });
  });

  it("ajouter un jalon à un objectif MANUEL ne change pas son chiffre sans un geste", () => {
    const g = racine({ manual_progress: 1, progress_pct: 45 });
    const jalon = etape(2, 1, { is_milestone: 1, target_count: 10, manual_count: 10 });
    expect(mesurer(g, sources({ goals: [g, jalon] })).pct).toBe(45);
  });

  it("passer en mesuré lit la feuille de route ; repasser en manuel rend le % d'avant, jamais effacé", () => {
    const manuel = racine({ manual_progress: 1, progress_pct: 45 });
    const jalon = etape(2, 1, { is_milestone: 1, target_count: 10, manual_count: 2 });
    const mesure = { ...manuel, manual_progress: 0 };
    expect(effectiveProgress(mesure, [mesure, jalon], [], [], { maintenant: MAINTENANT })).toBe(20);
    expect(effectiveProgress(manuel, [manuel, jalon], [], [], { maintenant: MAINTENANT })).toBe(45);
  });

  // ⚠️ RÈGLE RETOURNÉE le 2026-10-11. Ce test s'appelait « un objectif mesuré
  // sans étape affiche son repli » et attendait 30 : le % stocké d'un objectif
  // MESURÉ servait de repli quand il était vide. Il est maintenant une unité à
  // cocher (0, ou 100) ; son 30 % n'est lu que s'il est suivi à la main.
  it("un objectif mesuré sans étape vaut 0 tant qu'il n'est pas coché ; un jalon non vide le remplace", () => {
    const g = racine({ progress_pct: 30 });
    expect(effectiveProgress(g, [g], [], [], { maintenant: MAINTENANT })).toBe(0); // AVANT : 30
    const jalon = etape(2, 1, { is_milestone: 1, target_count: 4, manual_count: 1 });
    expect(effectiveProgress(g, [g, jalon], [], [], { maintenant: MAINTENANT })).toBe(25);
  });

  it("le % manuel est borné à 0–100", () => {
    expect(mesurer(racine({ manual_progress: 1, progress_pct: 140 }), sources()).pct).toBe(100);
    expect(mesurer(racine({ manual_progress: 1, progress_pct: -5 }), sources()).pct).toBe(0);
  });

  it("l'objectif de l'accueil (manuel, sans échéance) reste intelligible", () => {
    const accueil = racine({ title: "Récupérer 5 h par semaine", manual_progress: 1, progress_pct: 0, deadline: null });
    expect(mesurer(accueil, sources({ goals: [accueil] }))).toMatchObject({ pct: 0, origine: { type: "manuel" } });
  });
});

describe("profondeur", () => {
  const g = racine();
  const jalon = etape(2, 1, { is_milestone: 1 });
  const sousDuJalon = etape(3, 2);
  const sousDirect = etape(4, 1);

  it("les niveaux se lisent depuis la racine", () => {
    const tous = [g, jalon, sousDuJalon, sousDirect];
    expect([g, jalon, sousDuJalon, sousDirect].map((x) => niveauDe(x, tous))).toEqual([0, 1, 2, 1]);
  });

  it("trois niveaux au maximum à la création", () => {
    // ⚠️ MIS À JOUR EXPRÈS le 2026-10-12 : la question n'a plus de GENRE. Avant,
    // « une phase ne naît que sous une racine, un sous-objectif sous une racine
    // ou une phase » : `peutAjouterEtape(sousDirect, "sous-objectif")` rendait
    // `false`. Une étape de premier niveau reçoit maintenant une étape — elle
    // devient une phase par son contenu.
    const tous = [g, jalon, sousDuJalon, sousDirect];
    expect(peutAjouterEtape(g, tous)).toBe(true);
    expect(peutAjouterEtape(jalon, tous)).toBe(true);
    expect(peutAjouterEtape(sousDirect, tous)).toBe(true);
    expect(peutAjouterEtape(sousDuJalon, tous)).toBe(false);
  });

  it("une arborescence plus profonde, d'avant la 026, se lit sans erreur", () => {
    const chaine = [racine(), ...[2, 3, 4, 5, 6].map((id) => etape(id, id - 1))];
    chaine[5] = etape(6, 5, { target_count: 2, manual_count: 1 });
    expect(mesurer(chaine[0], sources({ goals: chaine })).pct).toBe(50);
    expect(niveauDe(chaine[5], chaine)).toBe(5);
  });

  it("un cycle écrit par une ligne distante ne boucle pas", () => {
    const a = etape(1, 2, { uid: "g-1" });
    const b = etape(2, 1, { target_count: 2, manual_count: 2 });
    expect(() => mesurer(a, sources({ goals: [a, b] }))).not.toThrow();
    expect(niveauDe(a, [a, b])).toBe(1);
  });

  // « promouvoir » et « rétrograder » (deux tests, `peutPromouvoir` et
  // `peutRetrograder`) sont partis le 2026-10-12 avec les deux entrées de menu
  // qu'ils gardaient : une étape EST une phase dès qu'elle en contient
  // d'autres. La règle qui les remplace est dans `structure.test.ts`.
});
