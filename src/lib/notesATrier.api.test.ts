/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./corbeille/repo.testutil";
import { basculerRangee, CLE_NOTES_RANGEES, ecrireRangees, etatsDeTri, lireRangees } from "./notesATrier";
import { uidDeLigne } from "./objectifs/progression";
import type { GoalInput } from "./repo";

/**
 * ⭐ L'ONGLET « À TRIER » — sur une vraie base, puis en démo (2026-10-11).
 *
 * Par l'API publique de `repo.ts` seulement, comme `corbeille/api.test.ts` :
 * l'onglet n'a été VU qu'en démo, et une démo plus indulgente que l'app ferait
 * « prouver » à l'écran ce que l'app ne fait pas (PIEGES § 6.2 quater). Ce
 * fichier rejoue donc, des deux côtés, ce que fait `NotesView` : lire les notes,
 * les arêtes qui les touchent et le réglage, puis demander l'état de chacune.
 */

let courante: BaseCommeTauri;
vi.mock("./db", () => ({ getDb: async () => courante }));

type Repo = typeof import("./repo");

const objectif = (title: string): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: null,
  parent_goal_id: null,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
});

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("« À trier » — $mode", ({ natif }) => {
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

  /** Ce que la vue calcule, par les mêmes lectures qu'elle. */
  const etats = async () => {
    const { notes } = await repo.fetchAll("2000-01-01");
    const liens = await repo.fetchLiensDesNotes();
    const rangees = lireRangees(await repo.getSetting(CLE_NOTES_RANGEES));
    return etatsDeTri(notes, liens, rangees);
  };
  const uidNote = async (id: number) => (await repo.uidDe("note", id))!;
  const uidObjectif = async (id: number) => (await repo.uidDe("goal", id))!;

  it("⭐ une note neuve — celle du raccourci — est à trier", async () => {
    const id = await repo.createNote("Nouvelle note", "");
    expect((await etats()).get(id)).toBe("a-trier");
  });

  it("⚠️ les notes lues par `fetchAll` portent l'identité que les arêtes désignent", async () => {
    // Tout le critère repose là-dessus : sans cet accord, aucune arête ne
    // retrouverait sa note, et tout resterait « à trier » pour toujours.
    const id = await repo.createNote("Identité", "");
    const lue = (await repo.fetchAll("2000-01-01")).notes.find((n) => n.id === id)!;
    expect(uidDeLigne("note", lue)).toBe(await uidNote(id));
  });

  it("⭐ rattachée à la main à un objectif, elle en sort ; le rattachement retiré, elle y revient", async () => {
    const note = await repo.createNote("À rattacher", "");
    const but = await repo.createGoal(objectif("Tri-objectif"));
    // L'arête exacte qu'écrivent le panneau « Lier » et `RattacherElement`.
    await repo.createLink({
      from_kind: "goal",
      from_uid: await uidObjectif(but),
      to_kind: "note",
      to_uid: await uidNote(note),
      origin: "manual",
    });
    expect((await etats()).get(note)).toBe("reliee");

    const [arete] = await repo.fetchLinksTo("note", await uidNote(note));
    await repo.deleteLink(arete.id);
    expect((await etats()).get(note)).toBe("a-trier");
  });

  it("⭐ une mention écrite dans son texte la range, et l'effacer la ramène", async () => {
    const note = await repo.createNote("Qui cite", "");
    const but = await repo.createGoal(objectif("Tri-cité"));
    const source = await uidNote(note);
    const voulue = {
      from_kind: "note" as const,
      from_uid: source,
      to_kind: "goal" as const,
      to_uid: await uidObjectif(but),
      origin: "mention" as const,
    };
    await repo.synchroniserMentions("note", source, [voulue]);
    expect((await etats()).get(note)).toBe("reliee");

    await repo.synchroniserMentions("note", source, []);
    expect((await etats()).get(note)).toBe("a-trier");
  });

  it("une note citée par une autre : les deux sont rangées", async () => {
    const a = await repo.createNote("A", "");
    const b = await repo.createNote("B", "");
    await repo.createLink({
      from_kind: "note",
      from_uid: await uidNote(a),
      to_kind: "note",
      to_uid: await uidNote(b),
      origin: "mention",
    });
    const e = await etats();
    expect([e.get(a), e.get(b)]).toEqual(["reliee", "reliee"]);
  });

  it("⭐ gardée telle quelle, elle en sort sans être reliée — et le réglage se défait", async () => {
    const note = await repo.createNote("À garder", "");
    const autre = await repo.createNote("Toujours à trier", "");
    const uid = await uidNote(note);

    const gardees = basculerRangee(lireRangees(await repo.getSetting(CLE_NOTES_RANGEES)), uid, true);
    await repo.setSetting(CLE_NOTES_RANGEES, ecrireRangees(gardees));
    let e = await etats();
    expect([e.get(note), e.get(autre)]).toEqual(["gardee", "a-trier"]);

    const remises = basculerRangee(lireRangees(await repo.getSetting(CLE_NOTES_RANGEES)), uid, false);
    await repo.setSetting(CLE_NOTES_RANGEES, ecrireRangees(remises));
    e = await etats();
    expect(e.get(note)).toBe("a-trier");
  });

  it("une note mise en corbeille n'est plus dans l'onglet ; restaurée, elle y revient", async () => {
    const note = await repo.createNote("À jeter", "");
    await repo.mettreEnCorbeille("note", note);
    expect((await etats()).has(note)).toBe(false);
    await repo.restaurer("note", note);
    expect((await etats()).get(note)).toBe("a-trier");
  });

  it("⚠️ LIMITE CONNUE : rattachée à un objectif mis en corbeille, elle reste rangée", async () => {
    // La corbeille garde les arêtes (migration 027) : c'est ce qui permet de
    // restaurer l'objectif avec ses liens. L'onglet lit ces arêtes brutes — la
    // note n'y revient donc qu'à la purge de l'objectif, trente jours plus tard.
    const note = await repo.createNote("Reliée à un disparu", "");
    const but = await repo.createGoal(objectif("Tri-jeté"));
    await repo.createLink({
      from_kind: "goal",
      from_uid: await uidObjectif(but),
      to_kind: "note",
      to_uid: await uidNote(note),
      origin: "manual",
    });
    await repo.mettreEnCorbeille("goal", but);
    expect((await etats()).get(note)).toBe("reliee");
  });

  it("une note supprimée pour de bon emporte ses arêtes : l'objet qu'elle citait n'en garde rien", async () => {
    const note = await repo.createNote("À purger", "");
    const but = await repo.createGoal(objectif("Tri-survivant"));
    await repo.createLink({
      from_kind: "goal",
      from_uid: await uidObjectif(but),
      to_kind: "note",
      to_uid: await uidNote(note),
      origin: "manual",
    });
    expect((await repo.fetchLiensDesNotes()).length).toBeGreaterThan(0);
    const avant = (await repo.fetchLiensDesNotes()).length;
    await repo.deleteNote(note);
    expect((await repo.fetchLiensDesNotes()).length).toBe(avant - 1);
    expect((await etats()).has(note)).toBe(false);
  });
});
