import { describe, expect, it } from "vitest";

import { effectiveProgress } from "../logic";
import type { CalendarEvent, Completion, Goal, Habit, HabitCheck, ObjectLink, Task } from "../types";
import { objectif } from "./objectif.testutil";
import { estAcheve, evenementPasse, mesurer, uidDeLigne, type SourcesProgression } from "./progression";
import { niveauDe, peutAjouterEtape, peutPromouvoir, peutRetrograder } from "./structure";

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
    expect(m.origine).toEqual({ type: "feuille", elementsFaits: 3, elementsTotal: 7, etapesComptees: 0 });
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

  it("à 0 : « atteindre zéro » ne se mesure pas, l'étape est vide et le dit", () => {
    const g = racine({ target_count: 0, manual_count: 3 });
    const m = mesurer(g, sources({ goals: [g] }));
    expect(m.pct).toBeNull();
    expect(m.origine).toEqual({ type: "vide", raison: "cible-nulle" });
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

  it("une source disparue rend l'étape vide, pas un 0 % trompeur", () => {
    const g = racine({ target_count: 10, count_source: "habit", count_ref_uid: "hab-supprimee" });
    expect(mesurer(g, sources({ goals: [g], habits: [hab] })).origine).toEqual({ type: "vide", raison: "source-introuvable" });
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

  it("un objectif qui n'a qu'une récurrente n'est pas bloqué à 0 % : il est vide", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], tasks: [tache({ goal_id: 1, recurrence: "weekdays" })] }));
    expect(m.pct).toBeNull();
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

  it("un objectif qui n'a QUE des notes est vide : écrire dessus ne le fait pas avancer", () => {
    const g = racine();
    const m = mesurer(g, sources({ goals: [g], liens: [lien(["note", "n-1"], ["goal", "g-1"])] }));
    expect(m.origine).toEqual({ type: "vide", raison: "rien-a-mesurer" });
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
    expect(m.pct).toBeNull();
    expect(m.nonComptes).toEqual([{ kind: "event", uid: "ev-1" }]);
  });

  it("une arête vers un événement absent ne fabrique pas d'unité fantôme", () => {
    const g = racine();
    expect(mesurer(g, sources({ goals: [g], liens: [lien(["goal", "g-1"], ["event", "disparu"])] })).pct).toBeNull();
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

describe("les vides sortent du dénominateur, et se signalent", () => {
  it("un jalon vide est exclu : il ne tire pas la moyenne vers 0", () => {
    const g = racine();
    const plein = etape(2, 1, { is_milestone: 1, target_count: 10, manual_count: 6 });
    const vide1 = etape(3, 1, { is_milestone: 1 });
    const vide2 = etape(4, 1, { is_milestone: 1 });
    const m = mesurer(g, sources({ goals: [g, plein, vide1, vide2] }));
    expect(m.pct).toBe(60);
    expect(m.vides).toBe(2);
    expect(m.origine).toMatchObject({ etapesComptees: 1 });
  });

  it("un jalon dont tous les sous-objectifs sont vides est vide lui-même, et le parent le compte", () => {
    const g = racine();
    const jalon = etape(2, 1, { is_milestone: 1 });
    const s = etape(3, 2);
    expect(mesurer(jalon, sources({ goals: [g, jalon, s] })).origine).toEqual({ type: "vide", raison: "etapes-vides" });
    expect(mesurer(g, sources({ goals: [g, jalon, s] })).vides).toBe(1);
  });

  it("objectif entièrement vide : `mesurer` le dit, `effectiveProgress` rend le % stocké", () => {
    const g = racine({ progress_pct: 35 });
    expect(mesurer(g, sources({ goals: [g] })).origine).toEqual({ type: "vide", raison: "rien-a-mesurer" });
    expect(effectiveProgress(g, [g], [], [], { maintenant: MAINTENANT })).toBe(35);
  });

  it("4 jalons finis et 2 vides font 100 %, mais l'objectif n'est PAS achevé", () => {
    const g = racine();
    const finis = [2, 3, 4, 5].map((id) => etape(id, 1, { is_milestone: 1, target_count: 1, manual_count: 1 }));
    const vides = [6, 7].map((id) => etape(id, 1, { is_milestone: 1 }));
    const m = mesurer(g, sources({ goals: [g, ...finis, ...vides] }));
    expect(m.pct).toBe(100);
    expect(m.videsProfonds).toBe(2);
    expect(estAcheve(m)).toBe(false);
  });

  it("une étape vide ENFOUIE sous un jalon empêche aussi l'achèvement de la racine", () => {
    const g = racine();
    const jalon = etape(2, 1, { is_milestone: 1 });
    const fini = etape(3, 2, { target_count: 1, manual_count: 1 });
    const vide = etape(4, 2);
    const m = mesurer(g, sources({ goals: [g, jalon, fini, vide] }));
    expect(m.pct).toBe(100);
    expect(m.vides).toBe(0);
    expect(m.videsProfonds).toBe(1);
    expect(estAcheve(m)).toBe(false);
    expect(estAcheve(mesurer(g, sources({ goals: [g, jalon, fini] })))).toBe(true);
  });

  it("une étape d'exemple n'entre pas dans le calcul", () => {
    const g = racine();
    const vraie = etape(2, 1, { manual_progress: 1, progress_pct: 80 });
    const suggeree = etape(3, 1, { manual_progress: 1, progress_pct: 0, is_example: 1 });
    expect(mesurer(g, sources({ goals: [g, vraie, suggeree] })).pct).toBe(80);
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

  it("un objectif mesuré sans étape affiche son repli ; l'ajout d'un jalon non vide le remplace", () => {
    const g = racine({ progress_pct: 30 });
    expect(effectiveProgress(g, [g], [], [], { maintenant: MAINTENANT })).toBe(30);
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
    const tous = [g, jalon, sousDuJalon, sousDirect];
    expect(peutAjouterEtape(g, "jalon", tous)).toBe(true);
    expect(peutAjouterEtape(g, "sous-objectif", tous)).toBe(true);
    expect(peutAjouterEtape(jalon, "sous-objectif", tous)).toBe(true);
    expect(peutAjouterEtape(jalon, "jalon", tous)).toBe(false);
    expect(peutAjouterEtape(sousDuJalon, "sous-objectif", tous)).toBe(false);
    expect(peutAjouterEtape(sousDirect, "sous-objectif", tous)).toBe(false);
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

  it("promouvoir : un sous-objectif direct devient jalon s'il ne fait rien descendre au niveau 3", () => {
    const petitEnfant = etape(5, 4);
    expect(peutPromouvoir(sousDirect, [g, sousDirect])).toBe(true);
    expect(peutPromouvoir(sousDirect, [g, sousDirect, petitEnfant])).toBe(true);
    expect(peutPromouvoir(sousDirect, [g, sousDirect, petitEnfant, etape(6, 5)])).toBe(false);
    expect(peutPromouvoir(sousDuJalon, [g, jalon, sousDuJalon])).toBe(false);
    expect(peutPromouvoir(jalon, [g, jalon])).toBe(false);
  });

  it("rétrograder un jalon n'est possible que s'il est vide d'étapes", () => {
    expect(peutRetrograder(jalon, [g, jalon])).toBe(true);
    expect(peutRetrograder(jalon, [g, jalon, sousDuJalon])).toBe(false);
  });
});
