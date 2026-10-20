/**
 * @vitest-environment happy-dom
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./repo.testutil";

/**
 * Lot 1 de l'audit du 2026-10-20 — « les données qui s'abîment », ce qui se
 * prouve sur le VRAI `repo.ts` et les vraies migrations.
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

let repo: typeof import("../repo");
let sqlite: DatabaseSync;

const run = (sql: string, ...p: unknown[]) => Number(sqlite.prepare(sql).run(...(p as never[])).lastInsertRowid);
const uid = (table: string, id: number) =>
  (sqlite.prepare(`SELECT uid FROM ${table} WHERE id = ?`).get(id) as { uid: string }).uid;

beforeAll(async () => {
  ({ sqlite, db: courante } = baseDeTest());
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  vi.resetModules();
  repo = await import("../repo");
});
afterAll(() => sqlite.close());

describe("fetchAll — la fenêtre de 400 jours ne vaut que pour l'historique (objectifs-2)", () => {
  // L'app lit `fetchAll(aujourd'hui - 400 j)`. On se place à « aujourd'hui = 2027-12-01 ».
  const DEPUIS = "2026-10-27";
  let ponctuelle: number;
  let recurrente: number;
  let source: number;
  let habitudeSource: number;
  let habitudeLibre: number;

  beforeAll(() => {
    const objectif = run("INSERT INTO goals (title, scope, created_at) VALUES ('Long terme', 'long', '2026-11-01')");
    ponctuelle = run(
      "INSERT INTO tasks (label, priority, recurrence, created_at, goal_id) VALUES ('Faite en 2026', 'low', 'none', 'x', ?)",
      objectif,
    );
    recurrente = run("INSERT INTO tasks (label, priority, recurrence, created_at) VALUES ('Chaque jour', 'low', 'daily', 'x')");
    source = run("INSERT INTO tasks (label, priority, recurrence, created_at) VALUES ('Courir', 'low', 'daily', 'x')");
    habitudeSource = run("INSERT INTO habits (name, color) VALUES ('Lire', 'blue')");
    habitudeLibre = run("INSERT INTO habits (name, color) VALUES ('Boire', 'blue')");
    run(
      "INSERT INTO goals (title, scope, created_at, parent_goal_id, count_source, count_ref_uid, target_count) VALUES ('100 sorties', 'long', '2026-01-01', ?, 'task', ?, 100)",
      objectif,
      uid("tasks", source),
    );
    run(
      "INSERT INTO goals (title, scope, created_at, parent_goal_id, count_source, count_ref_uid, target_count) VALUES ('500 lectures', 'long', '2026-01-01', ?, 'habit', ?, 500)",
      objectif,
      uid("habits", habitudeSource),
    );
    for (const id of [ponctuelle, recurrente, source]) {
      run("INSERT INTO task_completions (task_id, date, done) VALUES (?, '2026-02-01', 1)", id);
    }
    for (const id of [habitudeSource, habitudeLibre]) run("INSERT INTO habit_checks (habit_id, date) VALUES (?, '2026-02-01')", id);
  });

  it("⭐ une tâche PONCTUELLE cochée il y a plus de 400 jours reste faite", async () => {
    const d = await repo.fetchAll(DEPUIS);
    expect(d.completions.some((c) => c.task_id === ponctuelle && c.done)).toBe(true);
  });

  it("⭐ une tâche qui sert de SOURCE au compte d'un objectif garde tout son historique", async () => {
    const d = await repo.fetchAll(DEPUIS);
    expect(d.completions.some((c) => c.task_id === source)).toBe(true);
  });

  it("⭐ une habitude qui sert de SOURCE aussi", async () => {
    const d = await repo.fetchAll(DEPUIS);
    expect(d.habitChecks.some((c) => c.habit_id === habitudeSource)).toBe(true);
  });

  it("les coches anciennes d'une récurrente ordinaire, elles, restent bornées", async () => {
    const d = await repo.fetchAll(DEPUIS);
    expect(d.completions.some((c) => c.task_id === recurrente)).toBe(false);
    expect(d.habitChecks.some((c) => c.habit_id === habitudeLibre)).toBe(false);
  });
});

describe("updateKnowledgeEntry — une fiche en corbeille ne reçoit plus d'écriture (savoir-6)", () => {
  it("le contenu d'une autre fiche ne peut pas atterrir dans une fiche jetée", async () => {
    const id = run(
      "INSERT INTO knowledge_entries (kind, title, body, text, created_at, updated_at) VALUES ('note', 'Jetée', '<p>à moi</p>', 'à moi', 'x', 'x')",
    );
    run("UPDATE knowledge_entries SET deleted_at = '2026-10-20T10:00:00.000Z' WHERE id = ?", id);
    await repo.updateKnowledgeEntry(id, { title: "Autre", body: "<p>étranger</p>" });
    const ligne = sqlite.prepare("SELECT title, body FROM knowledge_entries WHERE id = ?").get(id) as { title: string; body: string };
    expect(ligne).toEqual({ title: "Jetée", body: "<p>à moi</p>" });
  });

  it("une fiche vivante s'écrit toujours", async () => {
    const id = run(
      "INSERT INTO knowledge_entries (kind, title, body, text, created_at, updated_at) VALUES ('note', 'Vivante', '', '', 'x', 'x')",
    );
    await repo.updateKnowledgeEntry(id, { title: "Renommée" });
    expect((sqlite.prepare("SELECT title FROM knowledge_entries WHERE id = ?").get(id) as { title: string }).title).toBe("Renommée");
  });
});

describe("corpsAvecCartes — où d'autre une carte vit (savoir-5)", () => {
  it("rend les corps à carte des AUTRES pages vivantes — ni la page elle-même, ni une jetée, ni une page sans carte", async () => {
    const carte = '<figure data-mindmap="{}"></figure>';
    const original = run("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Plan', ?, 'x', 'x')", `<p>o</p>${carte}`);
    const copie = run("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Plan (copie)', ?, 'x', 'x')", `<p>c</p>${carte}`);
    const jetee = run("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Jetée', ?, 'x', 'x')", `<p>j</p>${carte}`);
    run("UPDATE notes SET deleted_at = 'x' WHERE id = ?", jetee);
    run("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Sans carte', '<p>rien</p>', 'x', 'x')");
    run("INSERT INTO knowledge_entries (kind, title, body, text, created_at, updated_at) VALUES ('note', 'Fiche', ?, '', 'x', 'x')", `<p>f</p>${carte}`);

    const corps = await repo.corpsAvecCartes({ kind: "note", id: copie });
    expect(corps).toContain(`<p>o</p>${carte}`);
    expect(corps).toContain(`<p>f</p>${carte}`);
    expect(corps).not.toContain(`<p>c</p>${carte}`);
    expect(corps).not.toContain(`<p>j</p>${carte}`);
    expect(corps.some((c) => c.includes("rien"))).toBe(false);
    // Une fiche du MÊME numéro n'est pas la note : seule la famille ET le numéro excluent.
    expect(await repo.corpsAvecCartes({ kind: "knowledge", id: original })).toContain(`<p>o</p>${carte}`);
  });
});
