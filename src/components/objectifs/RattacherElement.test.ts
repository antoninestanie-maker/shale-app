// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData } from "../../lib/types";
import { objectif, tache } from "../../lib/objectifs/objectif.testutil";

/**
 * ⭐ Le moteur de recherche répond EN RETARD, comme le vrai (`LIKE` en base,
 * puis le classement) : c'est l'écart entre la frappe et la réponse qui
 * faisait rattacher la mauvaise tâche (audit du 2026-10-20, objectifs-11).
 */
const appels = vi.hoisted(() => ({ rattacher: [] as [number, number | null][], creer: [] as string[] }));
vi.mock("../../lib/repo", async (original) => ({
  ...(await original<typeof import("../../lib/repo")>()),
  rechercherPartout: async (q: string) => {
    await new Promise((r) => setTimeout(r, 40));
    // Un `LIKE %q%` : « Réviser chapitre 2 » ne trouve pas « Réviser chapitre 1 ».
    return "réviser chapitre 1".includes(q.toLowerCase())
      ? [{ kind: "task", id: 1, uid: "t1", titre: "Réviser chapitre 1", score: 1 }]
      : [];
  },
  rattacherTache: async (id: number, goalId: number | null) => void appels.rattacher.push([id, goalId]),
  createTask: async (input: { label: string }) => {
    appels.creer.push(input.label);
    return 99;
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let RattacherElement: typeof import("./RattacherElement").default;
let CONTEXTE_VIDE: typeof import("../../lib/objectifs/contexte").CONTEXTE_VIDE;

beforeAll(async () => {
  (await import("../../lib/i18n")).setLangPref("fr");
  RattacherElement = (await import("./RattacherElement")).default;
  ({ CONTEXTE_VIDE } = await import("../../lib/objectifs/contexte"));
});

let conteneur: HTMLElement;
let racine: Root;
beforeEach(() => {
  appels.rattacher.length = 0;
  appels.creer.length = 0;
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

const attendre = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

function taper(champ: HTMLInputElement, texte: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, texte);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const entree = (champ: HTMLInputElement) =>
  act(() => void champ.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));

describe("Rattacher — taper vite puis Entrée", () => {
  const A = objectif({ id: 1, title: "Partiel" });
  const B = objectif({ id: 2, title: "Rattrapage" });
  const data = {
    goals: [A, B],
    tasks: [tache({ id: 1, label: "Réviser chapitre 1", goal_id: 1 })],
    completions: [],
  } as unknown as AppData;

  async function monter() {
    await act(async () =>
      racine.render(createElement(RattacherElement, { goal: B, data, contexte: CONTEXTE_VIDE, refresh: async () => {} })),
    );
    return conteneur.querySelector<HTMLInputElement>("input")!;
  }

  it("objectifs-11 : Entrée juste après la dernière frappe crée la tâche tapée, sans arracher l'ancien premier résultat", async () => {
    const champ = await monter();
    taper(champ, "Réviser chapitre");
    await attendre(250);
    // La liste montre la tâche de l'objectif A, en tête.
    expect(conteneur.textContent).toContain("Réviser chapitre 1");

    taper(champ, "Réviser chapitre 2");
    await entree(champ);
    await attendre(250);

    expect(appels.rattacher).toEqual([]);
    expect(appels.creer).toEqual(["Réviser chapitre 2"]);
  });

  it("une réponse à jour garde son sens : Entrée rattache la tête de la liste", async () => {
    const champ = await monter();
    taper(champ, "Réviser chapitre 1");
    await attendre(250);
    await entree(champ);
    await attendre(100);
    expect(appels.rattacher).toEqual([[1, 2]]);
    expect(appels.creer).toEqual([]);
  });

  it("deux Entrée du même instant ne font qu'un geste", async () => {
    const champ = await monter();
    taper(champ, "Courir");
    await attendre(250);
    await entree(champ);
    await entree(champ);
    await attendre(150);
    expect(appels.creer).toEqual(["Courir"]);
  });
});
