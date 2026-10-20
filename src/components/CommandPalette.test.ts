// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/ia/useIa", () => ({ useIaPossible: () => false, useIa: () => ({ visible: false, aLeDroit: false }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let CommandPalette: typeof import("./CommandPalette").default;
beforeAll(async () => {
  (await import("../lib/i18n")).setLangPref("en");
  CommandPalette = (await import("./CommandPalette")).default;
});
afterEach(async () => {
  (await import("../lib/i18n")).setLangPref("fr");
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
});

describe("⌘K, en anglais", () => {
  it("savoir-12 : l'étape de saisie d'une commande porte son titre TRADUIT (« Quick note », pas « Note rapide »)", async () => {
    const ctx = { navigate: () => {}, refresh: async () => {}, data: null };
    await act(async () => racine.render(createElement(CommandPalette, { ctx })));
    act(() => void window.dispatchEvent(new Event("sb:open-palette")));
    const champ = conteneur.querySelector<HTMLInputElement>("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(champ, "quick note");
      champ.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const commande = [...conteneur.querySelectorAll("button")].find((b) => b.textContent?.includes("Quick note"));
    expect(commande).toBeDefined();
    act(() => void commande!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(conteneur.textContent).toContain("Quick note");
    expect(conteneur.textContent).not.toContain("Note rapide");
  });
});
