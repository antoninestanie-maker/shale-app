import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { aTraiter, nombreEnAttente, regrouper, type EntreeOutbox } from "./outbox";
import { estTableSync, settingSynchronisable, TABLES_HORS_SYNC, TABLES_SYNC } from "./scope";
import { baseNeuve } from "./schema.testutil";

/** Étape 2 — journal de changements local (migration 016). */

let db: DatabaseSync;
beforeEach(() => {
  db = baseNeuve();
});
afterEach(() => {
  db.close();
});

function outbox(): EntreeOutbox[] {
  return db
    .prepare("SELECT id, table_name, row_id, uid, op, ts FROM sync_outbox ORDER BY id")
    .all() as unknown as EntreeOutbox[];
}

function creerTache(label = "écrire"): number {
  return Number(
    db.prepare("INSERT INTO tasks (label, priority, recurrence) VALUES (?, 'medium', 'none')").run(label)
      .lastInsertRowid,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe("capture des écritures par les triggers", () => {
  it("journalise une création", () => {
    creerTache();
    const entrees = outbox();
    expect(entrees.length).toBeGreaterThanOrEqual(1);
    expect(entrees.every((e) => e.table_name === "tasks" && e.op === "upsert")).toBe(true);
    expect(nombreEnAttente(entrees)).toBe(1);
  });

  it("journalise une modification", () => {
    const id = creerTache();
    db.prepare("DELETE FROM sync_outbox").run();
    db.prepare("UPDATE tasks SET label = 'relire' WHERE id = ?").run(id);
    expect(nombreEnAttente(outbox())).toBe(1);
  });

  it("journalise une suppression comme pierre tombale, avec son uid", () => {
    const id = creerTache();
    const uid = db.prepare("SELECT uid FROM tasks WHERE id = ?").get(id)?.uid;
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

    const tombales = outbox().filter((e) => e.op === "delete");
    expect(tombales).toHaveLength(1);
    expect(tombales[0].uid).toBe(uid);
    // La pierre tombale ne porte plus de rowid : la ligne n'existe plus.
    expect(tombales[0].row_id).toBeNull();
  });

  it("une ligne créée PUIS supprimée hors ligne ne part jamais dans le cloud", () => {
    const id = creerTache("erreur de frappe");
    db.prepare("DELETE FROM tasks WHERE id = ?").run(id);

    const entrees = outbox();
    // Les 'upsert' en attente de cette ligne ont été effacés par le trigger de
    // suppression : il ne reste que la pierre tombale.
    expect(entrees.filter((e) => e.op === "upsert")).toHaveLength(0);
    expect(entrees.filter((e) => e.op === "delete")).toHaveLength(1);
  });

  it("l'uid peut manquer sur l'entrée de CRÉATION — et c'est prévu", () => {
    // SQLite ne garantit pas l'ordre entre deux triggers AFTER INSERT : celui
    // qui pose l'uid peut passer après celui qui journalise. Le `row_id` suffit
    // alors à relire la ligne, et l'écriture de l'uid produit une seconde
    // entrée, cette fois complète. Les deux se regroupent en UNE entité.
    creerTache();
    const entrees = outbox();
    const regroupe = regrouper(entrees);

    expect(regroupe).toHaveLength(1);
    expect(regroupe[0].uid).not.toBeNull();
    expect(regroupe[0].rowId).not.toBeNull();
  });

  it("couvre TOUTES les tables de données, pas seulement les notes", () => {
    const ecritures: [string, string][] = [
      ["goals", "INSERT INTO goals (title, scope) VALUES ('objectif', 'short')"],
      ["habits", "INSERT INTO habits (name) VALUES ('sport')"],
      ["trades", "INSERT INTO trades (date, instrument, direction, result_r) VALUES ('2026-08-02', 'NQ', 'long', 2)"],
      ["journal_entries", "INSERT INTO journal_entries (date, body) VALUES ('2026-08-02', 'jour')"],
      ["tags", "INSERT INTO tags (name, color) VALUES ('trading', '#fff')"],
      ["quick_links", "INSERT INTO quick_links (label, url) VALUES ('l', 'https://x')"],
      ["focus_sessions", "INSERT INTO focus_sessions (started_at, planned_min) VALUES ('2026-08-02 10:00:00', 25)"],
      ["finance_accounts", "INSERT INTO finance_accounts (label, kind) VALUES ('Courant', 'courant')"],
      ["knowledge_topics", "INSERT INTO knowledge_topics (name, created_at) VALUES ('k', '2026-08-02 10:00:00')"],
      ["custom_metrics", "INSERT INTO custom_metrics (name) VALUES ('poids')"],
      ["notes", "INSERT INTO notes (title, body) VALUES ('n', 'b')"],
      ["settings", "INSERT INTO settings (key, value) VALUES ('sizing.capital', '5000')"],
      ["live_positions", "INSERT INTO live_positions (opened_at, pair, direction, entry_price, stop_loss_price) VALUES ('2026-08-02 10:00:00', 'EURUSD', 'long', 1.1, 1.09)"],
      ["position_size_calculations", "INSERT INTO position_size_calculations (capital, risk_percent, pair, entry_price, stop_loss_price, include_spread, direction, sl_distance_pips, position_size_lots, risk_amount_usd) VALUES (5000, 1, 'EURUSD', 1.1, 1.09, 1, 'long', 100, 0.5, 50)"],
    ];
    for (const [, sql] of ecritures) db.prepare(sql).run();

    const touchees = new Set(outbox().map((e) => e.table_name));
    for (const [table] of ecritures) expect([...touchees]).toContain(table);
  });

  it("ne journalise PAS les tables hors périmètre", () => {
    // `goal_progress_log` référence `goals` : node:sqlite applique les clés
    // étrangères par défaut, il faut donc un vrai objectif.
    const objectifId = Number(
      db.prepare("INSERT INTO goals (title, scope) VALUES ('objectif', 'short')").run().lastInsertRowid,
    );
    db.prepare("DELETE FROM sync_outbox").run();

    db.prepare("INSERT INTO notes (title, body) VALUES ('cherchable', 'corps')").run();
    db.prepare("INSERT INTO goal_progress_log (goal_id, date, pct) VALUES (?, '2026-08-02', 50)").run(objectifId);
    db.prepare(
      "INSERT INTO market_briefings (session, day, generated_at, payload_in, output_json) VALUES ('pre_ny', '2026-08-02', 'x', '{}', '{}')",
    ).run();

    const tables = new Set(outbox().map((e) => e.table_name));
    expect(tables).toEqual(new Set(["notes"]));
  });
});

describe("drapeau anti-boucle", () => {
  it("les écritures venues du cloud ne repartent pas dans le cloud", () => {
    // Sans ce drapeau, appliquer un changement distant le renverrait au serveur,
    // qui le renverrait à l'autre appareil : une synchronisation en déclenche
    // une autre, indéfiniment.
    db.prepare("UPDATE sync_meta SET v = '1' WHERE k = 'applying'").run();
    db.prepare("INSERT INTO notes (title, body, uid) VALUES ('venue d''ailleurs', 'x', 'uid-distant')").run();
    db.prepare("UPDATE notes SET body = 'modifiée ailleurs' WHERE uid = 'uid-distant'").run();
    db.prepare("DELETE FROM notes WHERE uid = 'uid-distant'").run();
    expect(outbox()).toHaveLength(0);

    db.prepare("UPDATE sync_meta SET v = '0' WHERE k = 'applying'").run();
    db.prepare("INSERT INTO notes (title, body) VALUES ('locale', 'x')").run();
    expect(outbox().length).toBeGreaterThan(0);
  });

  it("chaque installation a son propre identifiant d'appareil", () => {
    const idDe = (base: DatabaseSync) =>
      base.prepare("SELECT v FROM sync_meta WHERE k = 'device_id'").get()?.v as string;
    const autre = baseNeuve();
    try {
      expect(idDe(db)).toMatch(/^[0-9a-f-]{36}$/);
      expect(idDe(db)).not.toBe(idDe(autre));
    } finally {
      autre.close();
    }
  });
});

describe("regroupement", () => {
  const e = (
    id: number,
    table: string,
    row_id: number | null,
    uid: string | null,
    op: "upsert" | "delete",
    ts: string,
  ): EntreeOutbox => ({ id, table_name: table, row_id, uid, op, ts });

  it("vingt modifications d'une même note ne font qu'un envoi", () => {
    const entrees = Array.from({ length: 20 }, (_, i) =>
      e(i + 1, "notes", 7, "uid-n", "upsert", `2026-08-02T10:00:${String(i).padStart(2, "0")}.000Z`),
    );
    const [seul] = regrouper(entrees);
    expect(regrouper(entrees)).toHaveLength(1);
    expect(seul.ts).toBe("2026-08-02T10:00:19.000Z"); // la plus récente
    expect(seul.jusquA).toBe(20); // borne de purge
  });

  it("la suppression l'emporte sur une modification antérieure", () => {
    const regroupe = regrouper([
      e(1, "notes", 7, "uid-n", "upsert", "2026-08-02T10:00:00.000Z"),
      e(2, "notes", null, "uid-n", "delete", "2026-08-02T10:00:05.000Z"),
    ]);
    expect(regroupe.map((c) => c.op)).toEqual(["upsert", "delete"]);
  });

  it("n'oublie pas un uid déjà connu au profit d'un null plus ancien", () => {
    const regroupe = regrouper([
      e(1, "tasks", 3, null, "upsert", "2026-08-02T10:00:00.000Z"),
      e(2, "tasks", 3, "uid-t", "upsert", "2026-08-02T10:00:00.000Z"),
    ]);
    expect(regroupe).toHaveLength(1);
    expect(regroupe[0].uid).toBe("uid-t");
  });

  it("ordonne les parents avant les enfants", () => {
    const regroupe = regrouper([
      e(1, "habit_checks", 1, "hc:x:2026-08-02", "upsert", "2026-08-02T10:00:00.000Z"),
      e(2, "habits", 1, "uid-h", "upsert", "2026-08-02T10:00:01.000Z"),
      e(3, "task_completions", 1, "tc:y:2026-08-02", "upsert", "2026-08-02T10:00:02.000Z"),
      e(4, "tasks", 1, "uid-t", "upsert", "2026-08-02T10:00:03.000Z"),
    ]);
    const rang = (t: string) => regroupe.findIndex((c) => c.table === t);
    expect(rang("habits")).toBeLessThan(rang("habit_checks"));
    expect(rang("tasks")).toBeLessThan(rang("task_completions"));
  });
});

describe("portée : ce qui part et ce qui reste", () => {
  it("un réglage métier part, un réglage de géométrie reste", () => {
    for (const cle of ["sizing.capital", "tracker.fastTrack", "ui.theme", "ui.lang", "energy_start"]) {
      expect(settingSynchronisable(cle)).toBe(true);
    }
    for (const cle of ["layout.today", "hidden.trading", "sidebar.collapsed", "ui.config", "screen_min_2026-08-02"]) {
      expect(settingSynchronisable(cle)).toBe(false);
    }
  });

  it("aucun secret ne part, même non listé", () => {
    // Filet contre l'oubli : la liste d'exclusion fonctionne par refus
    // explicite, donc son mode d'échec par défaut est silencieux.
    for (const cle of ["market.gemini_key", "market.groq_key", "broker.api_token", "x.secret", "un.password"]) {
      expect(settingSynchronisable(cle)).toBe(false);
    }
    // La clé de données elle-même, quand le trousseau ne répond pas et qu'elle
    // retombe dans `settings`. « dek » n'est ni key, ni token, ni secret : le
    // filtre générique ne l'attrape PAS, seule l'exclusion `sync.` la retient.
    // Sans elle, la clé partait dans le cloud, chiffrée avec elle-même.
    expect(settingSynchronisable("sync.dek")).toBe(false);
    expect(settingSynchronisable("sync.device_id")).toBe(false);
  });

  it("les réglages écartés sont purgés, pas gardés en attente pour toujours", () => {
    const entrees: EntreeOutbox[] = [
      { id: 1, table_name: "settings", row_id: 1, uid: "st:sizing.capital", op: "upsert", ts: "2026-08-02T10:00:00.000Z" },
      { id: 2, table_name: "settings", row_id: 2, uid: "st:layout.today", op: "upsert", ts: "2026-08-02T10:00:01.000Z" },
    ];
    const { aPousser, aPurger } = aTraiter(entrees);
    expect(aPousser.map((c) => c.uid)).toEqual(["st:sizing.capital"]);
    expect(aPurger.map((c) => c.uid)).toEqual(["st:layout.today"]);
    // L'indicateur d'état ne doit pas annoncer un retard qui ne se résorbera jamais.
    expect(nombreEnAttente(entrees)).toBe(1);
  });

  it("TOUTE table de la base est soit synchronisée, soit explicitement écartée", () => {
    // Garde-fou : une table ajoutée plus tard sans décision explicite fait
    // échouer ce test, au lieu de disparaître en silence de la sauvegarde.
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map((r) => r.name as string);

    const orphelines = tables.filter((t) => !estTableSync(t) && !(t in TABLES_HORS_SYNC));
    expect(orphelines).toEqual([]);
  });

  it("chaque table synchronisée porte bien ses trois triggers", () => {
    const triggers = new Set(
      db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'")
        .all()
        .map((r) => r.name as string),
    );
    const manquants = TABLES_SYNC.flatMap((t) =>
      ["ins", "upd", "del"].map((op) => `${t}_out_${op}`).filter((nom) => !triggers.has(nom)),
    );
    expect(manquants).toEqual([]);
  });
});
