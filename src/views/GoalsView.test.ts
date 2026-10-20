// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, Goal, Task } from "../lib/types";
import { objectif } from "../lib/objectifs/objectif.testutil";

// L'IA de Shale Pro lit la session (AuthGate) : hors sujet ici.
vi.mock("../lib/ia/useIa", () => ({ useIaPossible: () => false, useIa: () => ({}) }));
// Le film d'ouverture : on COMPTE ses départs. Sans animation réelle, il finit
// tout de suite (aucune promesse à attendre).
const films = vi.hoisted(() => [] as string[]);
vi.mock("../lib/objectifs/transition", () => ({
  jouerTransition: (o: { sens: string }) => {
    films.push(o.sens);
    return [];
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let GoalsView: typeof import("./GoalsView").default;
let naviguer: typeof import("../lib/naviguer");

beforeAll(async () => {
  const i18n = await import("../lib/i18n");
  i18n.setLangPref("fr");
  GoalsView = (await import("./GoalsView")).default;
  naviguer = await import("../lib/naviguer");
});

let conteneur: HTMLElement;
let racine: Root;

beforeEach(() => {
  films.length = 0;
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  document.body.innerHTML = "";
});

function donnees(goals: Goal[], tasks: Task[] = []): AppData {
  return {
    tasks,
    completions: [],
    goals,
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

const attendre = () => act(async () => void (await new Promise((r) => setTimeout(r, 20))));

async function monter(data: AppData) {
  await act(async () => racine.render(createElement(GoalsView, { data, refresh: async () => {} })));
  await attendre();
}

function cliquer(el: Element | null | undefined) {
  if (!el) throw new Error("élément introuvable");
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

const DEUX = () => donnees([objectif({ id: 1, title: "Courir un marathon" }), objectif({ id: 2, title: "Lancer le site" })]);

describe("GoalsView — la page d'un objectif", () => {
  it("objectifs-8 : « Ajouter une tâche » depuis le « ⋯ » d'une page DÉJÀ ouverte ne rejoue pas le film", async () => {
    await monter(DEUX());
    cliquer(conteneur.querySelector('[data-objectif="1"]'));
    await attendre();
    expect(films).toEqual(["ouvre"]);

    // Le « ⋯ » de la page, puis « Ajouter une tâche ».
    cliquer(conteneur.querySelector('[aria-label="Actions sur « Courir un marathon »"]'));
    await attendre();
    const entree = [...document.querySelectorAll('[role="menuitem"]')].find((b) => b.textContent?.includes("Ajouter une tâche"));
    cliquer(entree);
    await attendre();

    // Pas de second film : la page reste, et son champ « Tâche » est ouvert.
    expect(films).toEqual(["ouvre"]);
    expect(conteneur.querySelector('[aria-label="Nouvelle tâche pour « Courir un marathon »"]')).not.toBeNull();
  });

  it("objectifs-10 : une demande d'ouverture servie par l'événement ne se rejoue pas au montage suivant", async () => {
    await monter(DEUX());
    // Ce que fait `App.tsx` : la demande est déposée, PUIS l'événement part.
    act(() => {
      naviguer.deposerDemande({ kind: "goal", id: 2 });
      window.dispatchEvent(new CustomEvent("sb:open-goal", { detail: 2 }));
    });
    await attendre();
    expect(conteneur.querySelector("h1")?.textContent).toBe("Lancer le site");

    // On quitte le module, on y revient : la LISTE, pas la page d'avant.
    act(() => racine.unmount());
    racine = createRoot(conteneur);
    await monter(DEUX());
    expect(conteneur.querySelector('[data-objectif="1"]')).not.toBeNull();
    expect(conteneur.querySelector('[aria-label="Actions sur « Lancer le site »"]')).toBeNull();
  });

  it("objectifs-10 : un objectif créé SOUS un parent ne laisse pas la vue armée pour le prochain objectif racine venu", async () => {
    const avant = donnees([objectif({ id: 1, title: "Courir un marathon" })]);
    await monter(avant);

    // « + Nouvel objectif », un titre, un parent, Enregistrer.
    cliquer([...conteneur.querySelectorAll("button")].find((b) => b.textContent?.includes("Nouvel objectif")));
    await attendre();
    const champ = document.querySelector<HTMLInputElement>("form input");
    expect(champ).not.toBeNull();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, "Fractionné");
      champ!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const parent = [...document.querySelectorAll<HTMLSelectElement>("form select")].find((s) =>
      [...s.options].some((o) => o.value === "1"),
    );
    expect(parent).toBeDefined();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!.call(parent, "1");
      parent!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await act(async () => {
      document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      await new Promise((r) => setTimeout(r, 50));
    });
    await attendre();

    // La vue relit les données : l'étape créée est là (elle n'est pas une
    // racine). Puis un objectif RACINE arrive d'ailleurs (import, synchro) : la
    // vue ne saute pas sur sa page.
    const rendre = (goals: Goal[]) =>
      act(async () => racine.render(createElement(GoalsView, { data: donnees(goals), refresh: async () => {} })));
    const marathon = objectif({ id: 1, title: "Courir un marathon" });
    const etape = objectif({ id: 50, title: "Fractionné", parent_goal_id: 1 });
    await rendre([marathon, etape]);
    await attendre();
    await rendre([marathon, etape, objectif({ id: 99, title: "Importé" })]);
    await attendre();
    expect(conteneur.querySelector('[aria-label="Actions sur « Importé »"]')).toBeNull();
  });
});

