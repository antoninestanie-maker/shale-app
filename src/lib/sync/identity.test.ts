import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { baseNeuve, MIGRATION_IDENTITE, MIGRATIONS, uidDe, UUID_V4 } from "./schema.testutil";

/**
 * Étape 1 — identité globale des lignes (migration 015).
 *
 * Ces tests tournent sur une VRAIE base SQLite montée par les 15 migrations
 * réelles du projet, pas sur une maquette : c'est le seul moyen de prouver que
 * ce qui sera livré à l'app se comporte comme annoncé.
 */

let db: DatabaseSync;
beforeEach(() => {
  db = baseNeuve();
});
afterEach(() => {
  db.close();
});

/** Insère une tâche et renvoie son id local. */
function creerTache(label: string): number {
  return Number(
    db
      .prepare("INSERT INTO tasks (label, priority, recurrence) VALUES (?, 'medium', 'none')")
      .run(label).lastInsertRowid,
  );
}

describe("uid aléatoire (tables à identité arbitraire)", () => {
  const TABLES_ALEATOIRES: [string, string][] = [
    ["tasks", "INSERT INTO tasks (label) VALUES ('t')"],
    ["goals", "INSERT INTO goals (title, scope) VALUES ('g', 'short')"],
    ["habits", "INSERT INTO habits (name) VALUES ('h')"],
    ["custom_metrics", "INSERT INTO custom_metrics (name) VALUES ('m')"],
    ["quick_links", "INSERT INTO quick_links (label, url) VALUES ('l', 'https://x')"],
    ["focus_sessions", "INSERT INTO focus_sessions (started_at, planned_min) VALUES ('2026-08-02 10:00:00', 25)"],
    ["notes", "INSERT INTO notes (title, body) VALUES ('n', 'b')"],
    ["trades", "INSERT INTO trades (date, instrument, direction, result_r) VALUES ('2026-08-02', 'NQ', 'long', 2)"],
    ["knowledge_topics", "INSERT INTO knowledge_topics (name, created_at) VALUES ('k', '2026-08-02 10:00:00')"],
    ["knowledge_entries", "INSERT INTO knowledge_entries (title, created_at, updated_at) VALUES ('e', '2026-08-02 10:00:00', '2026-08-02 10:00:00')"],
    ["benchmark_results", "INSERT INTO benchmark_results (test, score, created_at) VALUES ('reaction', 250, '2026-08-02 10:00:00')"],
    ["live_positions", "INSERT INTO live_positions (opened_at, pair, direction, entry_price, stop_loss_price) VALUES ('2026-08-02 10:00:00', 'EURUSD', 'long', 1.1, 1.09)"],
    ["position_size_calculations", "INSERT INTO position_size_calculations (capital, risk_percent, pair, entry_price, stop_loss_price, include_spread, direction, sl_distance_pips, position_size_lots, risk_amount_usd) VALUES (5000, 1, 'EURUSD', 1.1, 1.09, 1, 'long', 100, 0.5, 50)"],
  ];

  it.each(TABLES_ALEATOIRES)("%s reçoit un UUID v4 à l'insertion", (table, sql) => {
    const id = Number(db.prepare(sql).run().lastInsertRowid);
    expect(uidDe(db, table, id)).toMatch(UUID_V4);
  });

  it("donne un uid DIFFÉRENT à chaque ligne", () => {
    const uids = new Set<string>();
    for (let i = 0; i < 200; i++) uids.add(uidDe(db, "tasks", creerTache(`t${i}`)));
    expect(uids.size).toBe(200);
  });
});

describe("uid dérivé (tables à clé naturelle)", () => {
  it("habit_checks référence le uid de l'habitude, pas son id local", () => {
    const habitId = Number(db.prepare("INSERT INTO habits (name) VALUES ('sport')").run().lastInsertRowid);
    const habitUid = uidDe(db, "habits", habitId);
    const checkId = Number(
      db.prepare("INSERT INTO habit_checks (habit_id, date) VALUES (?, '2026-08-02')").run(habitId).lastInsertRowid,
    );
    expect(uidDe(db, "habit_checks", checkId)).toBe(`hc:${habitUid}:2026-08-02`);
  });

  it("task_completions référence le uid de la tâche", () => {
    const tacheId = creerTache("écrire");
    const tacheUid = uidDe(db, "tasks", tacheId);
    const compId = Number(
      db.prepare("INSERT INTO task_completions (task_id, date, done) VALUES (?, '2026-08-02', 1)").run(tacheId)
        .lastInsertRowid,
    );
    expect(uidDe(db, "task_completions", compId)).toBe(`tc:${tacheUid}:2026-08-02`);
  });

  it("metric_entries référence le uid de la métrique", () => {
    const metId = Number(db.prepare("INSERT INTO custom_metrics (name) VALUES ('poids')").run().lastInsertRowid);
    const metUid = uidDe(db, "custom_metrics", metId);
    const entId = Number(
      db.prepare("INSERT INTO metric_entries (metric_id, date, value) VALUES (?, '2026-08-02', 72)").run(metId)
        .lastInsertRowid,
    );
    expect(uidDe(db, "metric_entries", entId)).toBe(`me:${metUid}:2026-08-02`);
  });

  it("journal_entries et tags dérivent de leur clé naturelle", () => {
    const jId = Number(
      db.prepare("INSERT INTO journal_entries (date, body) VALUES ('2026-08-02', 'x')").run().lastInsertRowid,
    );
    const tId = Number(db.prepare("INSERT INTO tags (name, color) VALUES ('trading', '#fff')").run().lastInsertRowid);
    expect(uidDe(db, "journal_entries", jId)).toBe("je:2026-08-02");
    expect(uidDe(db, "tags", tId)).toBe("tg:trading");
  });

  it("DEUX APPAREILS calculent le même uid pour le même fait", () => {
    // C'est la propriété qui fait tout tenir : sans elle, « l'habitude X cochée
    // le jour J » existerait en DEUX lignes sur le serveur, une par appareil,
    // qui s'écraseraient l'une l'autre sans jamais converger.
    const HABIT_UID = "c4663421-150a-41c3-8009-b30bac901873";

    const uidSurAppareil = (): string => {
      const appareil = baseNeuve();
      try {
        // L'habitude arrive par la sync avec SON uid d'origine ; les id locaux
        // diffèrent d'un appareil à l'autre, d'où les insertions de bourrage.
        for (let i = 0; i < Math.floor(Math.random() * 5); i++) {
          appareil.prepare("INSERT INTO habits (name) VALUES ('bourrage')").run();
        }
        const hId = Number(
          appareil.prepare("INSERT INTO habits (name, uid) VALUES ('sport', ?)").run(HABIT_UID).lastInsertRowid,
        );
        const cId = Number(
          appareil.prepare("INSERT INTO habit_checks (habit_id, date) VALUES (?, '2026-08-02')").run(hId)
            .lastInsertRowid,
        );
        return uidDe(appareil, "habit_checks", cId);
      } finally {
        appareil.close();
      }
    };

    expect(uidSurAppareil()).toBe(uidSurAppareil());
  });
});

describe("cohabitation avec l'index plein texte des notes", () => {
  // Régression : le trigger d'uid faisait un UPDATE sur `notes`, qui déclenchait
  // la réindexation FTS5 avant même que la note soit indexée — index corrompu,
  // « database disk image is malformed » à la moindre insertion.
  const chercher = (q: string): number =>
    db.prepare("SELECT COUNT(*) AS n FROM notes_fts WHERE notes_fts MATCH ?").get(q)?.n as number;

  it("indexe une note nouvellement créée", () => {
    db.prepare("INSERT INTO notes (title, body) VALUES ('Silver Bullet', 'plan de trading')").run();
    expect(chercher("Bullet")).toBe(1);
    expect(chercher("introuvable")).toBe(0);
  });

  it("réindexe une note dont le corps change", () => {
    const id = Number(db.prepare("INSERT INTO notes (title, body) VALUES ('titre', 'avant')").run().lastInsertRowid);
    db.prepare("UPDATE notes SET body = 'après' WHERE id = ?").run(id);
    expect(chercher("avant")).toBe(0);
    expect(chercher("après")).toBe(1);
  });

  it("retire une note supprimée de l'index", () => {
    const id = Number(db.prepare("INSERT INTO notes (title, body) VALUES ('éphémère', 'x')").run().lastInsertRowid);
    db.prepare("DELETE FROM notes WHERE id = ?").run(id);
    expect(chercher("éphémère")).toBe(0);
  });

  it("l'index survit à cent notes créées puis modifiées", () => {
    for (let i = 0; i < 100; i++) {
      const id = Number(
        db.prepare("INSERT INTO notes (title, body) VALUES (?, 'corps')").run(`note ${i}`).lastInsertRowid,
      );
      db.prepare("UPDATE notes SET body = ? WHERE id = ?").run(`corps révisé ${i}`, id);
    }
    expect(chercher("révisé")).toBe(100);
    // FTS5 signale un index corrompu en LEVANT sur cette commande (SQLITE_CORRUPT).
    expect(() => db.prepare("INSERT INTO notes_fts(notes_fts) VALUES ('integrity-check')").run()).not.toThrow();
  });
});

describe("garanties indispensables au moteur de sync", () => {
  it("un uid FOURNI à l'insertion est conservé tel quel", () => {
    // Sans cette garde (`WHEN NEW.uid IS NULL`), chaque appareil réinventerait
    // un uid en recevant une ligne distante : la même note se dupliquerait à
    // chaque synchronisation, indéfiniment.
    const venuDAilleurs = "0198f0aa-1111-4222-8333-444455556666";
    const id = Number(
      db.prepare("INSERT INTO notes (title, body, uid) VALUES ('distante', 'b', ?)").run(venuDAilleurs).lastInsertRowid,
    );
    expect(uidDe(db, "notes", id)).toBe(venuDAilleurs);
  });

  it("refuse deux lignes portant le même uid", () => {
    const uid = "0198f0aa-1111-4222-8333-444455556666";
    db.prepare("INSERT INTO notes (title, body, uid) VALUES ('a', '', ?)").run(uid);
    expect(() => db.prepare("INSERT INTO notes (title, body, uid) VALUES ('b', '', ?)").run(uid)).toThrow();
  });

  it("l'upsert d'une coche existante ne change pas son uid", () => {
    // `setTaskDone` fait `ON CONFLICT(task_id, date) DO UPDATE` : le chemin de
    // conflit est un UPDATE, donc le trigger AFTER INSERT ne rejoue pas et
    // l'identité de la ligne reste stable — condition d'un LWW cohérent.
    const tacheId = creerTache("relire");
    const sql =
      "INSERT INTO task_completions (task_id, date, done) VALUES (?, '2026-08-02', ?) ON CONFLICT(task_id, date) DO UPDATE SET done = excluded.done";
    db.prepare(sql).run(tacheId, 1);
    const avant = db.prepare("SELECT uid FROM task_completions WHERE task_id = ?").get(tacheId)?.uid;
    db.prepare(sql).run(tacheId, 0);
    const apres = db.prepare("SELECT uid, done FROM task_completions WHERE task_id = ?").get(tacheId);

    expect(apres?.uid).toBe(avant);
    expect(apres?.done).toBe(0);
  });

  it("aucune ligne synchronisable ne reste sans uid après migration", () => {
    // Simule une base ANTÉRIEURE à la sync (schéma 001→014, données dedans),
    // puis applique la 015 : c'est très exactement ce qui arrivera à la base
    // réelle d'Antonin au prochain lancement.
    const ancienne = baseNeuve(MIGRATION_IDENTITE - 1);
    try {
      const tacheId = Number(
        ancienne.prepare("INSERT INTO tasks (label, priority, recurrence) VALUES ('vieille', 'medium', 'none')").run()
          .lastInsertRowid,
      );
      ancienne.prepare("INSERT INTO task_completions (task_id, date, done) VALUES (?, '2026-07-01', 1)").run(tacheId);
      ancienne.prepare("INSERT INTO journal_entries (date, body) VALUES ('2026-07-01', 'hier')").run();
      ancienne.prepare("INSERT INTO notes (title, body) VALUES ('note ancienne', 'corps')").run();

      // Application de la migration d'identité sur cette base déjà peuplée.
      ancienne.exec(MIGRATIONS[MIGRATION_IDENTITE - 1]);

      const TABLES = [
        "tasks", "goals", "habits", "custom_metrics", "quick_links", "focus_sessions", "notes", "trades",
        "live_positions", "position_size_calculations", "benchmark_results", "knowledge_topics", "knowledge_entries",
        "tags", "task_completions", "habit_checks", "metric_entries", "journal_entries",
      ];
      for (const table of TABLES) {
        const manquants = ancienne.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE uid IS NULL`).get()?.n;
        expect(`${table}: ${manquants}`).toBe(`${table}: 0`);
      }

      // Et la ligne fille pointe bien vers le uid de son parent rétro-attribué.
      const tacheUid = uidDe(ancienne, "tasks", tacheId);
      const compUid = ancienne.prepare("SELECT uid FROM task_completions").get()?.uid;
      expect(compUid).toBe(`tc:${tacheUid}:2026-07-01`);
    } finally {
      ancienne.close();
    }
  });
});
