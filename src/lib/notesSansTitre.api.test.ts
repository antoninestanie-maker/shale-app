/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./corbeille/repo.testutil";
import { estSansTitre, libelleDeLigne, notesSansTitre, TITRE_SI_VIDE } from "./notesSansTitre";
import { plainText } from "./richtext";

/**
 * ⭐ L'ONGLET « SANS TITRE » — sur une vraie base, puis en démo (2026-10-12).
 *
 * Par l'API publique de `repo.ts` seulement, comme `corbeille/api.test.ts` :
 * l'onglet n'a été VU qu'en démo, et une démo plus indulgente que l'app ferait
 * « prouver » à l'écran ce que l'app ne fait pas (PIEGES § 6.2 quater). Ce
 * fichier rejoue donc, des deux côtés, ce que fait `NotesView` : créer la note
 * rapide, la relire, lui écrire un texte, puis un titre.
 */

let courante: BaseCommeTauri;
vi.mock("./db", () => ({ getDb: async () => courante }));

type Repo = typeof import("./repo");

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("« Sans titre » — $mode", ({ natif }) => {
  let repo: Repo;
  let sqlite: DatabaseSync | undefined;

  beforeEach(async () => {
    const w = window as unknown as Record<string, unknown>;
    if (natif) {
      ({ sqlite, db: courante } = baseDeTest());
      w.__TAURI_INTERNALS__ = {};
    } else {
      delete w.__TAURI_INTERNALS__;
    }
    vi.resetModules();
    repo = await import("./repo");
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  /** Ce que la vue lit : les notes vivantes, puis le filtre de l'onglet. */
  const notes = async () => (await repo.fetchAll("2000-01-01")).notes;
  const onglet = async () => notesSansTitre(await notes()).map((n) => n.id);
  const lue = async (id: number) => (await notes()).find((n) => n.id === id)!;
  /** La première ligne de la liste, calculée comme la vue la calcule. */
  const ligne = async (id: number) => {
    const n = await lue(id);
    return libelleDeLigne(n.title, plainText(n.body ?? ""), n.body);
  };

  it("⭐ la note rapide — française ou anglaise — est relue avec le titre écrit, et elle est dans l'onglet", async () => {
    const fr = await repo.createNote("Nouvelle note", "");
    const en = await repo.createNote("New note", "");
    expect((await lue(fr)).title).toBe("Nouvelle note");
    expect((await lue(en)).title).toBe("New note");
    expect((await onglet()).sort()).toEqual([fr, en].sort());
    expect(await ligne(fr)).toEqual({ genre: "vide" });
  });

  it("⭐ on lui écrit un texte : elle reste dans l'onglet, et sa ligne montre le début du texte", async () => {
    const id = await repo.createNote("Nouvelle note", "");
    await repo.updateNote(id, "Nouvelle note", "<p>Appeler le garagiste</p><p>avant jeudi</p>");
    expect(await onglet()).toEqual([id]);
    expect(await ligne(id)).toEqual({ genre: "extrait", texte: "Appeler le garagiste avant jeudi" });
  });

  it("⭐ on lui donne un titre : elle sort de l'onglet, son texte intact", async () => {
    const id = await repo.createNote("Nouvelle note", "");
    await repo.updateNote(id, "Nouvelle note", "<p>Appeler le garagiste</p>");
    await repo.updateNote(id, "Garagiste", "<p>Appeler le garagiste</p>");
    expect(await onglet()).toEqual([]);
    const n = await lue(id);
    expect(n.body).toBe("<p>Appeler le garagiste</p>");
    expect(await ligne(id)).toEqual({ genre: "titre", texte: "Garagiste" });
  });

  it("le titre effacé — enregistré « Sans titre » — l'y ramène", async () => {
    const id = await repo.createNote("Garagiste", "<p>jeudi</p>");
    expect(await onglet()).toEqual([]);
    await repo.updateNote(id, TITRE_SI_VIDE, "<p>jeudi</p>");
    expect(await onglet()).toEqual([id]);
  });

  it("un titre vide est stocké tel quel des deux côtés, et il est sans titre", async () => {
    // Le raccourci IA (`ia/capture.ts`) peut créer une note au titre vide.
    const id = await repo.createNote("", "<p>du texte</p>");
    expect((await lue(id)).title).toBe("");
    expect(await onglet()).toEqual([id]);
  });

  it("une note titrée et vide n'y est pas", async () => {
    await repo.createNote("Idées", "");
    expect(await onglet()).toEqual([]);
  });

  it("une note mise en corbeille n'est plus dans l'onglet ; restaurée, elle y revient", async () => {
    const id = await repo.createNote("Nouvelle note", "<p>à jeter</p>");
    await repo.mettreEnCorbeille("note", id);
    expect(await onglet()).toEqual([]);
    await repo.restaurer("note", id);
    expect(await onglet()).toEqual([id]);
  });

  it("la recherche rend des notes que le critère lit pareil", async () => {
    // La vue filtre aussi les RÉSULTATS de recherche par le titre.
    const id = await repo.createNote("Nouvelle note", "<p>garagiste jeudi</p>");
    await repo.createNote("Garagiste", "<p>garagiste vendredi</p>");
    const trouvees = await repo.searchNotes("garagiste");
    expect(trouvees).toHaveLength(2);
    expect(trouvees.filter((n) => estSansTitre(n.title)).map((n) => n.id)).toEqual([id]);
  });
});
