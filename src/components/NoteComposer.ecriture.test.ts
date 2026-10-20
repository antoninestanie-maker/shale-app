// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * ⭐ Audit du 2026-10-20, savoir-1 (critique). Dans le lecteur du Savoir,
 * l'éditeur reste monté quand on feuillette : une image collée APRÈS ← / →
 * passait par les fonctions du PREMIER rendu, et son enregistrement partait
 * vers la fiche d'avant, avec le corps de celle qu'on regarde.
 */

let finirEncodage: (() => void) | null = null;
vi.mock("../lib/knowledge", async (importer) => ({
  ...(await importer<typeof import("../lib/knowledge")>()),
  encodeImage: vi.fn(
    () =>
      new Promise((r) => {
        finirEncodage = () => r({ media: "data:image/png;base64,AAAA" });
      }),
  ),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;
let NoteComposer: typeof import("./NoteComposer").default;

beforeEach(async () => {
  NoteComposer = (await import("./NoteComposer")).default;
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  finirEncodage = null;
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

function afficher(noteId: number, corps: string, onChange: (html: string, id: number) => void) {
  act(() => racine.render(createElement(NoteComposer, { noteId, initialHtml: corps, onChange })));
}

function collerUneImage() {
  const editeur = conteneur.querySelector<HTMLElement>("[contenteditable]")!;
  const ev = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "clipboardData", {
    value: { files: [new File(["x"], "capture.png", { type: "image/png" })], getData: () => "" },
  });
  act(() => {
    editeur.dispatchEvent(ev);
  });
}

describe("NoteComposer — l'enregistrement suit la fiche AFFICHÉE", () => {
  it("⭐ une image collée après avoir feuilleté de A vers B s'enregistre dans B, jamais dans A", async () => {
    const versA = vi.fn();
    const versB = vi.fn();
    afficher(1, "<p>corps de A</p>", versA);
    afficher(2, "<p>corps de B</p>", versB);

    collerUneImage();
    await act(async () => finirEncodage?.());

    expect(versA).not.toHaveBeenCalled();
    expect(versB).toHaveBeenCalled();
    const [html, id] = versB.mock.calls[versB.mock.calls.length - 1];
    expect(id).toBe(2);
    expect(html).toContain("corps de B");
    expect(html).toContain("<img");
  });

  it("changer de fiche PENDANT la recompression : l'image n'atterrit nulle part", async () => {
    const versA = vi.fn();
    const versB = vi.fn();
    afficher(1, "<p>corps de A</p>", versA);
    collerUneImage();
    afficher(2, "<p>corps de B</p>", versB);
    await act(async () => finirEncodage?.());

    expect(versA).not.toHaveBeenCalled();
    expect(versB).not.toHaveBeenCalled();
    expect(conteneur.querySelector("[contenteditable] img")).toBeNull();
  });
});
