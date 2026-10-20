// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Carte } from "../../lib/carte";
import type { GestesObjectif } from "./EditeurCarte";

/**
 * ⭐ LA CARTE MENTALE AU CLAVIER, RENDUE POUR DE BON (happy-dom).
 *
 * Trois constats de l'audit du 2026-10-20, tous des enchaînements de gestes
 * que seule la carte montée peut rejouer :
 *   • rang 19 du contrôle du 12/10 — ⌘Z ne faisait rien dans la carte d'un
 *     objectif, et le premier ⌘Z vidait le nom d'un nœud neuf dans celle d'une
 *     note ;
 *   • constat d'usage 30 — « Citer un objet » remplaçait le texte du nœud ;
 *   • constat d'usage 37 — la première lettre tapée après « Sous-nœud » (carte
 *     d'objectif) partait dans le menu des types.
 */

vi.mock("../../lib/ia/useIa", () => ({ useIaPossible: () => false, useIa: () => ({}) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let EditeurCarte: typeof import("./EditeurCarte").default;
let carteVide: typeof import("../../lib/carte").carteVide;

beforeAll(async () => {
  (await import("../../lib/i18n")).setLangPref("fr");
  ({ carteVide } = await import("../../lib/carte"));
  EditeurCarte = (await import("./EditeurCarte")).default;
});

let conteneur: HTMLElement;
let racine: Root;
beforeEach(() => {
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
  document.body.innerHTML = "";
});

const attendre = (ms = 30) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

async function monter(carte: Carte, objectif?: GestesObjectif) {
  await act(async () =>
    racine.render(createElement(EditeurCarte, { titre: "Carte", carte, onEnregistrer: () => {}, onFermer: () => {}, objectif })),
  );
  await attendre();
}

/** Une touche, partie de l'élément qui a le focus — là où le clavier la pose. */
function touche(key: string, options: KeyboardEventInit = {}) {
  const cible = (document.activeElement as HTMLElement | null) ?? document.body;
  act(() => {
    cible.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...options }));
  });
}

function saisir(texte: string) {
  const champ = document.querySelector<HTMLInputElement>("input")!;
  expect(champ).not.toBeNull();
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, texte);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function cliquerOutil(libelle: string) {
  const bouton = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === libelle || b.textContent?.trim() === libelle);
  if (!bouton) throw new Error(`outil introuvable : ${libelle}`);
  act(() => void bouton.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })));
}

/** Les textes des nœuds DESSINÉS (le SVG), dans l'ordre. */
const noeuds = () => [...document.querySelectorAll("[data-noeud]")].map((n) => n.textContent?.trim() ?? "");

describe("carte d'une note", () => {
  it("rang 19 : un nœud créé puis nommé part en UN ⌘Z — il ne reste pas vide à l'écran", async () => {
    await monter(carteVide("Projet"));
    touche("Tab");
    await attendre();
    saisir("Plan");
    touche("Enter");
    await attendre();
    expect(noeuds()).toEqual(["Projet", "Plan"]);

    touche("z", { metaKey: true });
    await attendre();
    expect(noeuds()).toEqual(["Projet"]);
  });

  it("constat 30 : « Citer un objet » ajoute un nœud sous celui qu'on regarde, sans effacer son texte", async () => {
    await monter(carteVide("Projet"));
    cliquerOutil("Citer un objet");
    await attendre();
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe("@");
    // Le champ est celui d'un nœud NEUF : la racine garde son texte.
    expect(noeuds()).toEqual(["Projet", ""]);

    // Renoncer à la citation retire le nœud qu'elle avait créé.
    touche("Escape");
    touche("Escape");
    await attendre();
    expect(noeuds()).toEqual(["Projet"]);
  });
});

describe("carte d'un objectif", () => {
  const carteObjectif = (): Carte => ({
    v: 1,
    noeuds: [
      { id: "r", parent: null, texte: "Marathon", ref: { kind: "goal", uid: "g1" } },
      { id: "t1", parent: "r", texte: "Acheter des chaussures", ref: { kind: "task", uid: "t1" } },
    ],
  });

  function gestes() {
    const journal: string[] = [];
    const objectif: GestesObjectif = {
      enfantsPossibles: (ref) => (ref.kind === "goal" ? ["tache", "etape"] : []),
      creer: async (_parent, type, titre) => void journal.push(`créer ${type} ${titre}`),
      renommer: async (ref, titre) => void journal.push(`renommer ${ref.uid} ${titre}`),
      supprimer: async (ref) => {
        journal.push(`supprimer ${ref.uid}`);
        return async () => void journal.push(`restaurer ${ref.uid}`);
      },
    };
    return { journal, objectif };
  }

  it("rang 19 : ⌘Z rend le nœud qu'on vient de supprimer", async () => {
    const { journal, objectif } = gestes();
    await monter(carteObjectif(), objectif);
    touche("ArrowRight");
    await attendre();
    touche("Backspace");
    await attendre();
    touche("Backspace");
    await attendre();
    expect(journal).toEqual(["supprimer t1"]);

    touche("z", { metaKey: true });
    await attendre();
    expect(journal).toEqual(["supprimer t1", "restaurer t1"]);
  });

  it("rang 19 : ⌘Z rend l'ancien nom d'un nœud renommé", async () => {
    const { journal, objectif } = gestes();
    await monter(carteObjectif(), objectif);
    touche("ArrowRight");
    await attendre();
    touche("F2");
    await attendre();
    saisir("Chaussures de trail");
    touche("Enter");
    await attendre();
    touche("z", { metaKey: true });
    await attendre();
    expect(journal).toEqual(["renommer t1 Chaussures de trail", "renommer t1 Acheter des chaussures"]);
  });

  it("constat 37 : la première lettre tapée après « Sous-nœud » commence le nom d'une tâche", async () => {
    const { journal, objectif } = gestes();
    await monter(carteObjectif(), objectif);
    cliquerOutil("Sous-nœud");
    await attendre();
    expect(document.querySelector('[role="menu"]')).not.toBeNull();

    touche("R");
    await attendre();
    expect(document.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector<HTMLInputElement>("input")?.value).toBe("R");

    saisir("Réserver le dossard");
    touche("Enter");
    await attendre();
    expect(journal).toEqual(["créer tache Réserver le dossard"]);
  });
});
