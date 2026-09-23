/**
 * @vitest-environment happy-dom
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./repo.testutil";

/**
 * ⭐⭐ LE FILTRE AU FOND, ÉPROUVÉ SUR LE VRAI `repo.ts`.
 *
 * Chaque fonction de LECTURE de `repo.ts` est appelée ici sur une base qui
 * contient, pour chaque famille d'objets, un VIVANT et un JETÉ. Aucune ne doit
 * rendre le jeté — ni en liste, ni par son id, ni par la recherche, ni par ses
 * feuilles (coches, relevés, lignes de facture), ni par une arête.
 *
 * ⚠️ POURQUOI CE TEST PLUTÔT QU'UNE LISTE DE `grep`. Pendant l'audit, deux
 * lectures ont échappé à la recherche de `FROM notes` : elles construisent le
 * nom de table à la volée (`FROM ${table}`). Une liste écrite à la main a le
 * trou exact de ce qu'elle oublie. Ici, c'est le RÉSULTAT qui est vérifié.
 *
 * Écrit AVANT les filtres (règle 10 du chantier) : il a d'abord échoué partout.
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

let repo: typeof import("../repo");
let sqlite: DatabaseSync;

const AUJ = "2026-09-22";
const DEMAIN = "2026-09-23";
const HIER = "2026-09-21";
const JETE = "2026-09-22T09:00:00.000Z";

/** Les `id` des objets semés, pour les assertions. */
const ids: Record<string, number> = {};
const uids: Record<string, string> = {};

function ins(nom: string, sql: string, ...p: unknown[]): number {
  const id = Number(sqlite.prepare(sql).run(...(p as never[])).lastInsertRowid);
  ids[nom] = id;
  return id;
}
function uidDe(nom: string, table: string): string {
  const u = (sqlite.prepare(`SELECT uid FROM ${table} WHERE id = ?`).get(ids[nom]) as { uid: string }).uid;
  uids[nom] = u;
  return u;
}
function jeter(table: string, nom: string) {
  sqlite.prepare(`UPDATE ${table} SET deleted_at = ? WHERE id = ?`).run(JETE, ids[nom]);
}

/** Vrai si le mot « jeté » apparaît N'IMPORTE OÙ dans ce qu'une lecture a rendu. */
const contientJete = (x: unknown) => JSON.stringify(x).includes("jeté");

beforeAll(async () => {
  ({ sqlite, db: courante } = baseDeTest());
  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {};
  vi.resetModules();
  repo = await import("../repo");

  // ── Objectifs ──
  ins("objVivant", "INSERT INTO goals (title, scope, created_at, deadline) VALUES ('vivant-objectif', 'long', 'x', ?)", DEMAIN);
  ins("objJete", "INSERT INTO goals (title, scope, created_at, deadline) VALUES ('jeté-objectif', 'long', 'x', ?)", DEMAIN);
  // Un sous-objectif VIVANT sous un parent jeté (ce qu'une synchronisation
  // interrompue peut produire) : il doit apparaître, sans parent fantôme.
  ins("sousVivant", "INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('vivant-sous-objectif', 'long', 'x', ?)", ids.objJete);

  // ── Tâches, et leurs coches ──
  ins("tacheVivante", "INSERT INTO tasks (label, priority, recurrence, created_at, due_date, goal_id) VALUES ('vivant-tâche', 'low', 'none', 'x', ?, ?)", AUJ, ids.objJete);
  ins("tacheJetee", "INSERT INTO tasks (label, priority, recurrence, created_at, due_date) VALUES ('jeté-tâche', 'low', 'none', 'x', ?)", AUJ);
  ins("cocheVivante", "INSERT INTO task_completions (task_id, date, done) VALUES (?, ?, 1)", ids.tacheVivante, AUJ);
  ins("cocheJetee", "INSERT INTO task_completions (task_id, date, done) VALUES (?, ?, 1)", ids.tacheJetee, AUJ);

  // ── Notes ──
  ins("noteVivante", "INSERT INTO notes (title, body, created_at, updated_at) VALUES ('vivant-note', '<p>vivant corps commun</p>', 'x', 'x')");
  ins("noteJetee", "INSERT INTO notes (title, body, created_at, updated_at, is_example) VALUES ('jeté-note', '<p>jeté corps commun</p>', 'x', 'x', 1)");
  ins("exempleVivant", "INSERT INTO notes (title, body, created_at, updated_at, is_example) VALUES ('vivant-exemple', '', 'x', 'x', 1)");

  // ── Événements, ponctuels et récurrents ──
  ins("evtVivant", "INSERT INTO calendar_events (title, date, recurrence) VALUES ('vivant-évt', ?, 'none')", AUJ);
  ins("evtJete", "INSERT INTO calendar_events (title, date, recurrence) VALUES ('jeté-évt', ?, 'none')", AUJ);
  ins("recVivant", "INSERT INTO calendar_events (title, date, recurrence) VALUES ('vivant-récurrent', ?, 'daily')", HIER);
  ins("recJete", "INSERT INTO calendar_events (title, date, recurrence) VALUES ('jeté-récurrent', ?, 'daily')", HIER);

  // ── Savoir : sujets et fiches ──
  ins("sujetVivant", "INSERT INTO knowledge_topics (name, color, created_at, position) VALUES ('vivant-sujet', 'blue', 'x', 1)");
  ins("sujetJete", "INSERT INTO knowledge_topics (name, color, created_at, position) VALUES ('jeté-sujet', 'blue', 'x', 2)");
  // Une fiche VIVANTE dont le sujet est jeté : elle reste, « Sans thème ».
  ins("ficheVivante", "INSERT INTO knowledge_entries (topic_id, kind, title, text, created_at, updated_at) VALUES (?, 'note', 'vivant-fiche', 'vivant texte', 'x', 'x')", ids.sujetJete);
  ins("ficheJetee", "INSERT INTO knowledge_entries (kind, title, text, created_at, updated_at) VALUES ('note', 'jeté-fiche', 'jeté texte', 'x', 'x')");

  // ── Factures brouillon, leurs lignes et paiements ──
  ins("factVivante", "INSERT INTO invoices (statut, objet) VALUES ('brouillon', 'vivant-facture')");
  ins("factJetee", "INSERT INTO invoices (statut, objet) VALUES ('brouillon', 'jeté-facture')");
  ins("ligneVivante", "INSERT INTO invoice_lines (invoice_id, description) VALUES (?, 'vivant-ligne')", ids.factVivante);
  ins("ligneJetee", "INSERT INTO invoice_lines (invoice_id, description) VALUES (?, 'jeté-ligne')", ids.factJetee);
  ins("paiementJete", "INSERT INTO invoice_payments (invoice_id, date, montant_cents) VALUES (?, ?, 100)", ids.factJetee, AUJ);

  // ── Journal ──
  ins("journalVivant", "INSERT INTO journal_entries (date, body) VALUES (?, 'vivant-journal')", AUJ);
  ins("journalJete", "INSERT INTO journal_entries (date, body) VALUES (?, 'jeté-journal')", HIER);

  // ── Performance : métriques et habitudes, avec leurs relevés ──
  ins("metVivante", "INSERT INTO custom_metrics (name) VALUES ('vivant-métrique')");
  ins("metJetee", "INSERT INTO custom_metrics (name) VALUES ('jeté-métrique')");
  ins("releveVivant", "INSERT INTO metric_entries (metric_id, date, value) VALUES (?, ?, 1)", ids.metVivante, AUJ);
  ins("releveJete", "INSERT INTO metric_entries (metric_id, date, value) VALUES (?, ?, 1)", ids.metJetee, AUJ);
  ins("habVivante", "INSERT INTO habits (name, color) VALUES ('vivant-habitude', 'blue')");
  ins("habJetee", "INSERT INTO habits (name, color) VALUES ('jeté-habitude', 'blue')");
  ins("checkVivant", "INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)", ids.habVivante, AUJ);
  ins("checkJete", "INSERT INTO habit_checks (habit_id, date) VALUES (?, ?)", ids.habJetee, AUJ);

  // ── Arêtes : un objectif vivant rattaché à une note vivante et à une jetée ──
  const uObj = uidDe("objVivant", "goals");
  for (const [nom, table, kind] of [
    ["noteVivante", "notes", "note"],
    ["noteJetee", "notes", "note"],
    ["ficheJetee", "knowledge_entries", "knowledge"],
    ["evtJete", "calendar_events", "event"],
  ] as const) {
    sqlite
      .prepare("INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin, created_at) VALUES ('goal', ?, ?, ?, 'manual', 'x')")
      .run(uObj, kind, uidDe(nom, table));
  }
  for (const [nom, table] of [
    ["tacheJetee", "tasks"], ["objJete", "goals"], ["sujetJete", "knowledge_topics"],
  ] as const) uidDe(nom, table);

  // ── Et on jette ──
  jeter("goals", "objJete");
  jeter("tasks", "tacheJetee");
  jeter("notes", "noteJetee");
  jeter("calendar_events", "evtJete");
  jeter("calendar_events", "recJete");
  jeter("knowledge_topics", "sujetJete");
  jeter("knowledge_entries", "ficheJetee");
  jeter("invoices", "factJetee");
  jeter("journal_entries", "journalJete");
  jeter("custom_metrics", "metJetee");
  jeter("habits", "habJetee");
});

afterAll(() => sqlite.close());

describe("fetchAll — le tableau de bord, les stats, les séries, tout ce qui en découle", () => {
  it("ne rend AUCUN objet jeté, dans aucune de ses listes", async () => {
    const d = await repo.fetchAll("2000-01-01");
    expect(d.tasks.map((t) => t.label)).toEqual(["vivant-tâche"]);
    expect(d.goals.map((g) => g.title).sort()).toEqual(["vivant-objectif", "vivant-sous-objectif"]);
    expect(d.notes.map((n) => n.title).sort()).toEqual(["vivant-exemple", "vivant-note"]);
    expect(d.journal.map((j) => j.body)).toEqual(["vivant-journal"]);
    expect(d.metrics.map((m) => m.name)).toEqual(["vivant-métrique"]);
    expect(d.habits.map((h) => h.name)).toEqual(["vivant-habitude"]);
    expect(contientJete(d)).toBe(false);
  });

  it("⭐ ne rend aucune FEUILLE d'un objet jeté — coches, relevés, cases d'habitude", async () => {
    // Sinon `dayStat`, `computeStreak`, `weekStats` compteraient une tâche,
    // une métrique ou une habitude que l'utilisateur ne voit plus nulle part.
    const d = await repo.fetchAll("2000-01-01");
    expect(d.completions.map((c) => c.task_id)).toEqual([ids.tacheVivante]);
    expect(d.metricEntries.map((e) => e.metric_id)).toEqual([ids.metVivante]);
    expect(d.habitChecks.map((c) => c.habit_id)).toEqual([ids.habVivante]);
  });

  it("⭐ une tâche vivante rattachée à un objectif JETÉ GARDE son rattachement — il dort", async () => {
    // Changement du 2026-09-23 : on ne le masque plus en mémoire. La fenêtre
    // d'une tâche réécrit la ligne ENTIÈRE (`updateTask`) ; un `null` lu en
    // mémoire y aurait été réécrit en base, et la restauration de l'objectif
    // n'aurait plus rendu sa tâche. Aucun lecteur n'a besoin du masquage : un
    // objectif absent de `goals` n'affiche simplement rien.
    const d = await repo.fetchAll("2000-01-01");
    expect(d.tasks.find((t) => t.id === ids.tacheVivante)?.goal_id).toBe(ids.objJete);
    expect(d.goals.some((g) => g.id === ids.objJete)).toBe(false);
  });

  it("⭐ un sous-objectif vivant sous un parent jeté se lit à la racine", async () => {
    const d = await repo.fetchAll("2000-01-01");
    expect(d.goals.find((g) => g.id === ids.sousVivant)?.parent_goal_id).toBeNull();
  });
});

describe("la recherche — Notes, ⌘K et le sélecteur @", () => {
  it("searchNotes sans requête", async () => {
    expect(contientJete(await repo.searchNotes(""))).toBe(false);
  });

  it("⭐ searchNotes PAR LE PLEIN TEXTE (FTS5) — l'index garde les notes jetées", async () => {
    // L'index FTS n'est pas touché par une mise en corbeille (son trigger
    // n'écoute que `title` et `body`) : c'est la JOINTURE qui doit filtrer.
    const r = await repo.searchNotes("commun");
    expect(r.map((n) => n.title)).toEqual(["vivant-note"]);
  });

  it("rechercherPartout sans requête — toutes familles", async () => {
    expect(contientJete(await repo.rechercherPartout("", { limite: 500 }))).toBe(false);
  });

  it("⭐ rechercherPartout sur le mot même des objets jetés", async () => {
    const r = await repo.rechercherPartout("jeté", { limite: 500 });
    expect(r).toEqual([]);
  });

  it("titresDesMentions : un objet jeté n'a plus de titre à afficher", async () => {
    const t = await repo.titresDesMentions([
      { kind: "note", uid: uids.noteJetee },
      { kind: "task", uid: uids.tacheJetee },
      { kind: "goal", uid: uids.objJete },
      { kind: "object", uid: uids.sujetJete },
    ]);
    expect([...t.values()]).toEqual([]);
  });
});

describe("le Savoir", () => {
  it("fetchKnowledge ne rend ni sujet ni fiche jetés", async () => {
    const k = await repo.fetchKnowledge();
    expect(k.topics.map((s) => s.name)).toEqual(["vivant-sujet"]);
    expect(k.entries.map((e) => e.title)).toEqual(["vivant-fiche"]);
  });

  it("⭐ une fiche dont le sujet est jeté se lit « Sans thème » — sans perdre son sujet en base", async () => {
    const k = await repo.fetchKnowledge();
    expect(k.entries.find((e) => e.id === ids.ficheVivante)?.topic_id).toBeNull();
    const enBase = sqlite.prepare("SELECT topic_id FROM knowledge_entries WHERE id = ?").get(ids.ficheVivante) as { topic_id: number };
    expect(enBase.topic_id).toBe(ids.sujetJete);
  });

  it("une fiche ou un sujet jeté ne s'ouvre plus par son id", async () => {
    expect(await repo.fetchKnowledgeEntry(ids.ficheJetee)).toBeNull();
    expect(await repo.fetchSujet(ids.sujetJete)).toBeNull();
  });
});

describe("le Calendrier", () => {
  it("fetchCalendarEvents ne rend pas un événement jeté", async () => {
    const e = await repo.fetchCalendarEvents(AUJ, AUJ);
    expect(e.map((x) => x.title)).toEqual(["vivant-évt"]);
  });

  it("fetchRecurringEvents ne rend pas une série jetée", async () => {
    const e = await repo.fetchRecurringEvents();
    expect(e.map((x) => x.title)).toEqual(["vivant-récurrent"]);
  });

  it("fetchDatedTasks ne rend pas une tâche datée jetée", async () => {
    const t = await repo.fetchDatedTasks(AUJ, AUJ);
    expect(t.map((x) => x.label)).toEqual(["vivant-tâche"]);
  });
});

describe("les Objectifs — ce que la feuille de route lit hors d'AppData", () => {
  it("⭐ fetchContexteObjectifs ne rattache pas une note, une fiche ou un événement jetés", async () => {
    // Cette lecture construit le nom de table À LA VOLÉE (`FROM ${table}`) :
    // c'est l'une des deux qu'une recherche de `FROM notes` avait ratées.
    const c = await repo.fetchContexteObjectifs();
    expect(contientJete(c)).toBe(false);
    expect(JSON.stringify(c)).toContain("vivant-note");
  });
});

describe("la Facturation", () => {
  it("ne rend ni la facture jetée, ni ses lignes, ni ses paiements", async () => {
    const f = await repo.fetchFacturation();
    expect(f.factures.map((x) => x.id)).toEqual([ids.factVivante]);
    expect(f.lignes.map((l) => l.invoice_id)).toEqual([ids.factVivante]);
    expect(f.paiements).toEqual([]);
  });
});

describe("le contenu de départ", () => {
  it("⭐ le bouton « supprimer les N exemples » ne compte pas un exemple déjà jeté", async () => {
    expect(await repo.compterExemples()).toBe(1);
  });
});
