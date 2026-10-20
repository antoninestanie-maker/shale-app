// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, Completion, Goal, Task } from "../../lib/types";
import { objectif, tache } from "../../lib/objectifs/objectif.testutil";
import type { Mesure, SourcesProgression } from "../../lib/objectifs/progression";
import type { Replis } from "../../lib/objectifs/libelles";

// L'IA de Shale Pro lit la session (AuthGate) : hors sujet ici.
vi.mock("../../lib/ia/useIa", () => ({ useIaPossible: () => false, useIa: () => ({}) }));
// L'écriture d'une étape : on compte les appels, et elle prend un peu de temps,
// comme l'aller-retour vers SQLite.
const ajouts = vi.hoisted(() => [] as string[]);
vi.mock("../../lib/objectifs/ajouter", () => ({
  ajouterEtape: async (_parent: unknown, titre: string) => {
    ajouts.push(titre);
    await new Promise((r) => setTimeout(r, 30));
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let FeuilleDeRoute: typeof import("./FeuilleDeRoute").default;
let mesurer: typeof import("../../lib/objectifs/progression").mesurer;
let CONTEXTE_VIDE: typeof import("../../lib/objectifs/contexte").CONTEXTE_VIDE;
let todayStr: () => string;
let addDays: (d: string, n: number) => string;

beforeAll(async () => {
  const i18n = await import("../../lib/i18n");
  i18n.setLangPref("fr");
  FeuilleDeRoute = (await import("./FeuilleDeRoute")).default;
  ({ mesurer } = await import("../../lib/objectifs/progression"));
  ({ CONTEXTE_VIDE } = await import("../../lib/objectifs/contexte"));
  ({ todayStr, addDays } = await import("../../lib/logic"));
});

let conteneur: HTMLElement;
let racine: Root;

beforeEach(() => {
  ajouts.length = 0;
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  document.body.innerHTML = "";
});

function donnees(goals: Goal[], tasks: Task[] = [], completions: Completion[] = []): AppData {
  return {
    tasks,
    completions,
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

const attendre = (ms = 20) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

async function monter(data: AppData, options: { replis?: Replis; ajout?: "tache" | "etape" | null } = {}) {
  const sources: SourcesProgression = {
    goals: data.goals,
    tasks: data.tasks,
    completions: data.completions,
    habits: data.habits,
    habitChecks: data.habitChecks,
    liens: [],
    evenements: [],
    maintenant: `${todayStr()} 12:00`,
  };
  const mesures = new Map<number, Mesure>();
  for (const g of data.goals) mesures.set(g.id, mesurer(g, sources));
  const racineGoal = data.goals.find((g) => g.parent_goal_id === null)!;
  await act(async () =>
    racine.render(
      createElement(FeuilleDeRoute, {
        racine: racineGoal,
        data,
        contexte: CONTEXTE_VIDE,
        sources,
        mesures,
        replis: options.replis ?? {},
        onReplier: () => {},
        ajoutOuvert: options.ajout ?? null,
        onFermerAjout: () => {},
        onModifier: () => {},
        refresh: async () => {},
      }),
    ),
  );
  await attendre();
}

function cliquer(el: Element | null | undefined) {
  if (!el) throw new Error("élément introuvable");
  act(() => {
    (el as HTMLElement).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function touche(el: Element, key: string, options: KeyboardEventInit = {}) {
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  });
}

const ligneDe = (libelle: string) =>
  [...conteneur.querySelectorAll("li")].find((li) => li.textContent?.includes(libelle)) ?? null;

describe("FeuilleDeRoute — une tâche de l'objectif", () => {
  it("objectifs-6 : la ligne d'une tâche porte un « ⋯ » qui ouvre le menu de la tâche (au doigt, il n'y a pas de clic droit)", async () => {
    await monter(donnees([objectif({ id: 1, title: "Marathon" })], [tache({ id: 7, label: "Acheter des chaussures", goal_id: 1 })]));
    const ligne = ligneDe("Acheter des chaussures");
    expect(ligne).not.toBeNull();
    const bouton = ligne!.querySelector('button[aria-haspopup="menu"]');
    expect(bouton).not.toBeNull();
    cliquer(bouton);
    await attendre();
    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.textContent).toContain("Supprimer");
  });

  it("objectifs-6 : au clavier, Maj+F10 sur la ligne ouvre le même menu", async () => {
    await monter(donnees([objectif({ id: 1, title: "Marathon" })], [tache({ id: 7, label: "Acheter des chaussures", goal_id: 1 })]));
    const ligne = ligneDe("Acheter des chaussures")!;
    const caseACocher = ligne.querySelector("button")!;
    touche(caseACocher, "F10", { shiftKey: true });
    await attendre();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();
  });
});

describe("FeuilleDeRoute — une étape", () => {
  it("objectifs-12 : une étape TERMINÉE dont l'échéance est passée n'est pas « En retard »", async () => {
    const hier = addDays(todayStr(), -1);
    await monter(
      donnees([
        objectif({ id: 1, title: "Marathon" }),
        // Une étape vide, cochée : elle est à 100 %.
        objectif({ id: 2, title: "Inscription", parent_goal_id: 1, deadline: hier, progress_pct: 100 }),
        objectif({ id: 3, title: "Plan", parent_goal_id: 1, deadline: hier }),
      ]),
      { replis: { g2: true, g3: true } },
    );
    const blocDe = (id: number) => conteneur.querySelector(`[data-etape="${id}"]`)!;
    expect(blocDe(2).textContent).not.toContain("En retard");
    // La contre-épreuve : l'étape à faire, elle, est bien en retard.
    expect(blocDe(3).textContent).toContain("En retard");
  });

  it("objectifs-13 : deux Entrée rapprochées dans « ＋ Étape » ne créent qu'UNE étape", async () => {
    await monter(donnees([objectif({ id: 1, title: "Marathon" })]), { ajout: "etape" });
    const champ = conteneur.querySelector<HTMLInputElement>('input[placeholder^="Nom de l’étape"]');
    expect(champ).not.toBeNull();
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, "Préparation");
      champ!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    touche(champ!, "Enter");
    touche(champ!, "Enter");
    await attendre(80);
    expect(ajouts).toEqual(["Préparation"]);
  });
});

describe("FeuilleDeRoute — « Atteindre un nombre » (constat d'usage 29)", () => {
  it("les tâches de l'étape restent à l'écran, et la cible peut se compter par elles", async () => {
    await monter(
      donnees(
        [
          objectif({ id: 1, title: "Trouver un stage" }),
          objectif({ id: 2, title: "Candidatures", parent_goal_id: 1, target_count: 12, count_source: "elements" }),
        ],
        [tache({ id: 7, label: "Envoyer la candidature Ubisoft", goal_id: 2 })],
        [{ id: 1, task_id: 7, date: todayStr(), done: 1 }],
      ),
      { replis: { g2: true } },
    );
    const bloc = conteneur.querySelector('[data-etape="2"]')!;
    // Le mode « nombre » est choisi…
    expect(bloc.querySelector('[role="radio"][aria-checked="true"]')?.textContent).toBe("Atteindre un nombre");
    // … et la tâche est toujours là, cochable.
    expect(bloc.textContent).toContain("Envoyer la candidature Ubisoft");
    // La source « par ses tâches » existe, et compte la tâche cochée.
    const select = [...bloc.querySelectorAll("select")].find((x) => [...x.options].some((o) => o.value === "elements"));
    expect(select?.value).toBe("elements");
    expect(bloc.textContent).toContain("1 tâche faite sur 12");
  });
});
