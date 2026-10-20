// @vitest-environment happy-dom
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, Note } from "../lib/types";

/**
 * ⭐ Audit du 2026-10-20, savoir-4. La file d'écriture des Notes ne tenait
 * qu'UNE note : taper dans A, passer à B et y écrire dans les 0,7 s
 * remplaçait l'écriture de A — ses derniers caractères ne partaient jamais.
 */

const ecrites: { id: number; corps: string }[] = [];
vi.mock("../lib/repo", async (importer) => {
  const vrai = await importer<typeof import("../lib/repo")>();
  return {
    ...vrai,
    updateNote: vi.fn(async (id: number, _titre: string, corps: string) => {
      ecrites.push({ id, corps });
    }),
  };
});

// La vue vit sous `AuthGate` dans l'app ; ici, une session absente suffit.
vi.mock("../components/auth/AuthGate", async (importer) => ({
  ...(await importer<typeof import("../components/auth/AuthGate")>()),
  useSession: () => ({ session: null, status: "deconnecte", jetonFrais: async () => null }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;
let NotesView: typeof import("./NotesView").default;
let fetchAll: typeof import("../lib/repo").fetchAll;

// L'import de la vue tire une bonne part de l'app : il se fait UNE fois, hors
// du délai du test (il dépassait 30 s sur une machine chargée).
beforeAll(async () => {
  NotesView = (await import("./NotesView")).default;
  ({ fetchAll } = await import("../lib/repo"));
}, 120_000);

const note = (id: number, title: string, body: string): Note =>
  ({ id, title, body, created_at: "2026-10-01", updated_at: "2026-10-01", is_example: 0 }) as Note;

beforeEach(() => {
  ecrites.length = 0;
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});
afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

const attendre = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));

function taper(html: string) {
  const editeur = conteneur.querySelector<HTMLElement>("[data-corps-note]")!;
  act(() => {
    editeur.innerHTML = html;
    editeur.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("NotesView — une note en attente n'en remplace pas une autre", () => {
  it("⭐ taper dans A, ouvrir B et y écrire aussitôt : la fin de A est enregistrée", async () => {
    const data: AppData = { ...(await fetchAll("2000-01-01")), notes: [note(901, "Note A", "<p>A</p>"), note(902, "Note B", "<p>B</p>")] };
    act(() => racine.render(createElement(NotesView, { data, refresh: async () => {} })));
    await attendre(30);

    taper("<p>A, et la fin de la phrase</p>");
    const versB = [...conteneur.querySelectorAll("button")].find((b) => b.textContent?.includes("Note B"))!;
    act(() => versB.click());
    await attendre(30);
    taper("<p>B modifiée</p>");
    await attendre(900);

    expect(ecrites).toContainEqual({ id: 901, corps: "<p>A, et la fin de la phrase</p>" });
    expect(ecrites).toContainEqual({ id: 902, corps: "<p>B modifiée</p>" });
  }, 60_000);
});
