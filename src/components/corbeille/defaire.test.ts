/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⭐ ⌘Z REND LA DERNIÈRE SUPPRESSION (2026-10-20, audit complet, constat 23).
 * Avant, ⌘Z après la suppression d'une tâche, d'une étape ou d'un nœud de carte
 * d'objectif ne rendait rien : seul le bandeau « Annuler » de six secondes le
 * faisait. En mode démo, par les vraies fonctions.
 */

const toasts: { msg: string; onAction?: () => void }[] = [];
vi.mock("../../lib/toast", () => ({ afficherToast: (x: { msg: string; onAction?: () => void }) => toasts.push(x) }));

type Repo = typeof import("../../lib/repo");
type Geste = typeof import("./geste");
type Pile = typeof import("../../lib/annulerSuppression");
let repo: Repo;
let geste: Geste;
let pile: Pile;

beforeEach(async () => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.resetModules();
  toasts.length = 0;
  repo = await import("../../lib/repo");
  geste = await import("./geste");
  pile = await import("../../lib/annulerSuppression");
  pile.viderPileSuppressions();
});

const tache = (label: string) => repo.createTask({ label, tag: null, priority: "low", recurrence: "none", goal_id: null });
const labels = async () => (await repo.fetchAll("2000-01-01")).tasks.map((t) => t.label).filter((l) => l.startsWith("Défaire"));

describe("⌘Z après une suppression", () => {
  it("rend la tâche supprimée, et le dit", async () => {
    const id = await tache("Défaire — appeler Léa");
    await geste.jeter("task", id, "Défaire — appeler Léa", () => undefined);
    expect(await labels()).toEqual([]);
    expect(await geste.defaireDerniereSuppression()).toBe(true);
    expect(await labels()).toEqual(["Défaire — appeler Léa"]);
    expect(toasts.at(-1)?.msg).toMatch(/Défaire — appeler Léa/);
  });

  it("rend les suppressions dans l'ordre inverse, une par ⌘Z", async () => {
    const a = await tache("Défaire A");
    const b = await tache("Défaire B");
    await geste.jeter("task", a, "Défaire A", () => undefined);
    await geste.jeter("task", b, "Défaire B", () => undefined);
    await geste.defaireDerniereSuppression();
    expect(await labels()).toEqual(["Défaire B"]);
    await geste.defaireDerniereSuppression();
    expect((await labels()).sort()).toEqual(["Défaire A", "Défaire B"]);
    expect(await geste.defaireDerniereSuppression()).toBe(false);
  });

  it("un lot (nœud de carte d'objectif : tâche + étape) revient en entier", async () => {
    const a = await tache("Défaire — tâche du nœud");
    const b = await tache("Défaire — autre");
    await geste.jeterPlusieurs(
      [
        { kind: "task", id: a, titre: "Défaire — tâche du nœud" },
        { kind: "task", id: b, titre: "Défaire — autre" },
      ],
      () => undefined,
    );
    expect(await labels()).toEqual([]);
    await geste.defaireDerniereSuppression();
    expect((await labels()).sort()).toEqual(["Défaire — autre", "Défaire — tâche du nœud"]);
  });

  it("« Annuler » du bandeau retire la suppression de la pile : ⌘Z ne la rend pas deux fois", async () => {
    const a = await tache("Défaire A");
    const b = await tache("Défaire B");
    await geste.jeter("task", a, "Défaire A", () => undefined);
    await geste.jeter("task", b, "Défaire B", () => undefined);
    toasts.at(-1)!.onAction!(); // « Annuler » sur B
    await new Promise((r) => setTimeout(r, 0));
    expect(await labels()).toContain("Défaire B");
    // ⌘Z rend A, pas B une seconde fois.
    expect(await geste.defaireDerniereSuppression()).toBe(true);
    expect((await labels()).sort()).toEqual(["Défaire A", "Défaire B"]);
  });

  it("une suppression déjà rendue ailleurs (corbeille) est sautée", async () => {
    const a = await tache("Défaire A");
    const b = await tache("Défaire B");
    await geste.jeter("task", a, "Défaire A", () => undefined);
    await geste.jeter("task", b, "Défaire B", () => undefined);
    await repo.restaurer("task", b); // depuis « Supprimés récemment »
    expect(await geste.defaireDerniereSuppression()).toBe(true);
    expect((await labels()).sort()).toEqual(["Défaire A", "Défaire B"]);
  });
});

describe("la touche", () => {
  it("⌘Z et Ctrl+Z, sans Maj ni Option", () => {
    const k = (o: Partial<KeyboardEvent>) => pile.estToucheDefaire({ key: "z", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...o });
    expect(k({ metaKey: true })).toBe(true);
    expect(k({ ctrlKey: true })).toBe(true);
    expect(k({ metaKey: true, key: "Z" })).toBe(true);
    expect(k({ metaKey: true, shiftKey: true })).toBe(false);
    expect(k({})).toBe(false);
  });

  it("n'est jamais prise dans un champ : ⌘Z y défait la frappe", () => {
    document.body.innerHTML = `<input id="i"><textarea id="t"></textarea><div contenteditable="true"><p id="p">x</p></div><button id="b">ok</button>`;
    expect(pile.cibleDeSaisie(document.getElementById("i"))).toBe(true);
    expect(pile.cibleDeSaisie(document.getElementById("t"))).toBe(true);
    expect(pile.cibleDeSaisie(document.getElementById("p"))).toBe(true);
    expect(pile.cibleDeSaisie(document.getElementById("b"))).toBe(false);
    expect(pile.cibleDeSaisie(document.body)).toBe(false);
  });
});
