/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoalInput } from "../../lib/repo";

/**
 * ⭐ SUPPRIMER UNE NOTE QUI PORTE UNE CARTE EMPORTE CE QUE SES NŒUDS ONT CRÉÉ
 * (demande d'Antonin, 2026-09-30 : « si une carte mentale liée à un objectif
 * est supprimée, les tâches liées le soient aussi »).
 *
 * En mode DÉMO, par les vraies fonctions : la note, le corps HTML avec son bloc
 * de carte, la corbeille, et le toast dont on presse « Annuler ».
 */

const toasts: { msg: string; onAction?: () => void }[] = [];
vi.mock("../../lib/toast", () => ({ afficherToast: (x: { msg: string; onAction?: () => void }) => toasts.push(x) }));

type Repo = typeof import("../../lib/repo");
type Geste = typeof import("./geste");
type CarteLib = typeof import("../../lib/carte");
let repo: Repo;
let geste: Geste;
let carteLib: CarteLib;

const objectif = (title: string, parent: number | null = null): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: null,
  parent_goal_id: parent,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
});

beforeEach(async () => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
  toasts.length = 0;
  repo = await import("../../lib/repo");
  geste = await import("./geste");
  carteLib = await import("../../lib/carte");
});

/**
 * Un objectif « Carte-racine », sa phase « Carte-phase » avec une tâche, et une
 * tâche libre. La carte de la note : racine « Plan » (idée), qui cite la tâche
 * libre (nœud tâche), la phase (nœud phase) et l'objectif racine (jamais emporté).
 */
async function monde() {
  const racine = await repo.createGoal(objectif("Carte-racine"));
  const phase = await repo.createGoal(objectif("Carte-phase", racine));
  const tPhase = await repo.createTask({ label: "Carte-tâche de phase", tag: null, priority: "low", recurrence: "none", goal_id: phase });
  const tLibre = await repo.createTask({ label: "Carte-tâche libre", tag: null, priority: "low", recurrence: "none", goal_id: null });
  const { ajouterEnfant, blocCarte, carteVide, poserReference } = carteLib;
  let c = carteVide("Plan");
  for (let i = 0; i < 3; i++) c = ajouterEnfant(c, "r").carte; // n1, n2, n3
  c = poserReference(c, "n1", { kind: "task", uid: `demo:task:${tLibre}` }, "Carte-tâche libre");
  c = poserReference(c, "n2", { kind: "goal", uid: `demo:goal:${phase}` }, "Carte-phase", "phase");
  c = poserReference(c, "n3", { kind: "goal", uid: `demo:goal:${racine}` }, "Carte-racine", "objectif");
  const corps = `<p>Mon plan</p>${blocCarte(c)}`;
  const note = await repo.createNote("Carte-note", corps);
  return { racine, phase, tPhase, tLibre, note, corps };
}

const vivants = async () => {
  const d = await repo.fetchAll("2000-01-01");
  return {
    notes: d.notes.filter((n) => n.title.startsWith("Carte")).map((n) => n.title),
    taches: d.tasks.filter((t) => t.label.startsWith("Carte")).map((t) => t.label).sort(),
    objectifs: d.goals.filter((g) => g.title.startsWith("Carte")).map((g) => g.title).sort(),
  };
};

describe("jeterAvecSesCartes", () => {
  it("⭐ la note part avec la tâche et la phase de sa carte — et la tâche de la phase suit", async () => {
    const m = await monde();
    expect(await geste.jeterAvecSesCartes("note", m.note, "Carte-note", m.corps, () => undefined)).toBe(true);
    expect(await vivants()).toEqual({ notes: [], taches: [], objectifs: ["Carte-racine"] });
    // Un seul toast, qui compte tout : la note, la tâche libre, la phase et sa tâche.
    expect(toasts).toHaveLength(1);
    expect(toasts[0].msg).toContain("3");
  });

  it("⭐ « Annuler » rend la note ET tout ce qu'elle avait emporté", async () => {
    const m = await monde();
    await geste.jeterAvecSesCartes("note", m.note, "Carte-note", m.corps, () => undefined);
    toasts[0].onAction?.();
    await new Promise((r) => setTimeout(r, 20));
    expect(await vivants()).toEqual({
      notes: ["Carte-note"],
      taches: ["Carte-tâche de phase", "Carte-tâche libre"],
      objectifs: ["Carte-phase", "Carte-racine"],
    });
  });

  it("une note sans carte part seule, comme avant", async () => {
    const m = await monde();
    const autre = await repo.createNote("Carte-note sans carte", "<p>rien</p>");
    await geste.jeterAvecSesCartes("note", autre, "Carte-note sans carte", "<p>rien</p>", () => undefined);
    expect((await vivants()).taches).toEqual(["Carte-tâche de phase", "Carte-tâche libre"]);
    expect((await vivants()).notes).toEqual(["Carte-note"]);
    void m;
  });
});
