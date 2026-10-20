/**
 * @vitest-environment happy-dom
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./corbeille/repo.testutil";

/**
 * ⭐ UNE ÉTAPE SE NOMME « ÉTAPE » DANS LA RECHERCHE (contrôle du 12/10, rang 22,
 * toujours présent à l'audit du 2026-10-20) : ⌘K la classait « OBJECTIF »,
 * avec l'icône d'un objectif. Le drapeau naît dans le corpus — natif ET démo.
 */

let courante: BaseCommeTauri;
vi.mock("./db", () => ({ getDb: async () => courante }));

let sqlite: DatabaseSync;

beforeAll(() => {
  ({ sqlite, db: courante } = baseDeTest());
});
afterAll(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
});

describe("la recherche distingue l'étape de l'objectif", () => {
  it("en natif (SQLite)", async () => {
    const racine = Number(sqlite.prepare("INSERT INTO goals (title, scope, created_at) VALUES ('Vivre de mon activité', 'long', 'x')").run().lastInsertRowid);
    sqlite.prepare("INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('Valider la certification', 'short', 'x', ?)").run(racine);
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
    vi.resetModules();
    const repo = await import("./repo");
    const r = await repo.rechercherPartout("", { familles: ["goal"] });
    const parTitre = new Map(r.map((x) => [x.titre, x]));
    expect(parTitre.get("Valider la certification")?.etape).toBe(true);
    expect(parTitre.get("Vivre de mon activité")?.etape).toBeUndefined();
  });

  it("en démo", async () => {
    delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
    vi.resetModules();
    const i18n = await import("./i18n");
    i18n.setLangPref("fr");
    const repo = await import("./repo");
    const r = await repo.rechercherPartout("certification", { familles: ["goal"] });
    expect(r[0]?.titre).toBe("Valider la certification UX");
    expect(r[0]?.etape).toBe(true);
  });

  it("la palette et le « @ » la nomment « Étape »", async () => {
    const { libelleDeTrouvaille } = await import("../components/liens/libelles");
    expect(libelleDeTrouvaille({ kind: "goal", etape: true })).toBe("Étape");
    expect(libelleDeTrouvaille({ kind: "goal" })).toBe("Objectif");
    expect(libelleDeTrouvaille({ kind: "task" })).toBe("Tâche");
  });
});
