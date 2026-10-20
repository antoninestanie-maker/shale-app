/**
 * @vitest-environment happy-dom
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./corbeille/repo.testutil";

/**
 * savoir-8 (audit du 2026-10-20) : en natif, la liste du Savoir ne lisait pas
 * `is_example`, et le badge « Exemple » n'apparaissait jamais. Éprouvé sur le
 * vrai `repo.ts` et le vrai schéma.
 */
let courante: BaseCommeTauri;
vi.mock("./db", () => ({ getDb: async () => courante }));
let sqlite: DatabaseSync;
let repo: typeof import("./repo");

beforeAll(async () => {
  ({ sqlite, db: courante } = baseDeTest());
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  vi.resetModules();
  repo = await import("./repo");
});

describe("la liste du Savoir, en natif", () => {
  it("rend `is_example` : la fiche d'exemple porte son badge", async () => {
    sqlite.prepare("INSERT INTO knowledge_entries (kind, title, text, created_at, updated_at, is_example) VALUES ('note', 'Exemple', '', 'x', 'x', 1)").run();
    sqlite.prepare("INSERT INTO knowledge_entries (kind, title, text, created_at, updated_at) VALUES ('note', 'Mienne', '', 'x', 'x')").run();
    const { entries } = await repo.fetchKnowledge();
    const parTitre = new Map(entries.map((e) => [e.title, e]));
    expect(parTitre.get("Exemple")?.is_example).toBe(1);
    expect(parTitre.get("Mienne")?.is_example).toBe(0);
  });
});
