// @vitest-environment happy-dom
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLangPref } from "../lib/i18n";
import TaskModal from "./TaskModal";

/**
 * Rang 13 du contrôle du 12/10, toujours présent le 2026-10-20 : Échap dans
 * « Nouvelle tâche » fermait la fenêtre et effaçait la saisie, sans question.
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

const ouvrir = (onClose: () => void) =>
  act(() => racine.render(createElement(TaskModal, { task: null, tags: [], goals: [], onClose, onSaved: async () => {} })));
const echap = () => act(() => void window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
const taper = (texte: string) => {
  const champ = conteneur.querySelector<HTMLInputElement>("input")!;
  act(() => {
    const poser = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    poser.call(champ, texte);
    champ.dispatchEvent(new Event("input", { bubbles: true }));
  });
};

describe("Nouvelle tâche — fermer sans perdre la saisie", () => {
  it("intacte, Échap ferme tout de suite", () => {
    const onClose = vi.fn();
    ouvrir(onClose);
    echap();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("⭐ saisie commencée : Échap demande, « Garder » la rend, « Abandonner » ferme", () => {
    const onClose = vi.fn();
    ouvrir(onClose);
    taper("Appeler le comptable");
    echap();
    expect(onClose).not.toHaveBeenCalled();
    expect(conteneur.textContent).toContain("Fermer sans enregistrer");
    const bouton = (txt: string) => [...conteneur.querySelectorAll("button")].find((b) => b.textContent === txt)!;
    act(() => bouton("Garder").click());
    expect(conteneur.textContent).not.toContain("Fermer sans enregistrer");
    expect(conteneur.querySelector<HTMLInputElement>("input")!.value).toBe("Appeler le comptable");
    echap();
    act(() => bouton("Abandonner la saisie").click());
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
