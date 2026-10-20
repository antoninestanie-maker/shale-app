// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLangPref } from "../lib/i18n";
import GoalModal from "./GoalModal";
import EventModal from "./calendrier/EventModal";

/**
 * Rang 13 du contrôle du 12/10, toujours présent le 2026-10-20 : « Nouvel
 * objectif », « Modifier l'objectif » et la fiche d'un événement jetaient la
 * saisie par Échap, sans question. Même question que « Nouvelle tâche » (lot 5).
 */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;
beforeEach(() => {
  setLangPref("fr");
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

const echap = () => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
const taper = (texte: string) => {
  const champ = conteneur.querySelector<HTMLInputElement>("input")!;
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, texte);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe.each([
  ["Nouvel objectif", (onClose: () => void) => createElement(GoalModal, { goal: null, goals: [], onClose, onSaved: async () => {} })],
  ["Nouvel événement", (onClose: () => void) => createElement(EventModal, { event: null, jour: "2026-10-21", onClose, onSaved: async () => {} })],
])("%s", (_nom, fenetre) => {
  it("intacte, Échap ferme", () => {
    const onClose = vi.fn();
    act(() => racine.render(fenetre(onClose)));
    echap();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("⭐ un titre tapé : Échap demande d'abord", () => {
    const onClose = vi.fn();
    act(() => racine.render(fenetre(onClose)));
    taper("Courir un semi");
    echap();
    expect(onClose).not.toHaveBeenCalled();
    expect(conteneur.textContent).toContain("Abandonner la saisie ?");
    echap(); // un second Échap revient à la saisie
    expect(conteneur.textContent).not.toContain("Abandonner la saisie ?");
    expect(onClose).not.toHaveBeenCalled();
  });
});
