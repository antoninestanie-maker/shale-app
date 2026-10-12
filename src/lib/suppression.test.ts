import { describe, expect, it } from "vitest";
import type { SQLInputValue } from "node:sqlite";

import { baseNeuve } from "./sync/schema.testutil";
import { DEPENDANTS, GARDES_PAR_REFUS, effacerLigne, type BaseSuppression } from "./suppression";

/**
 * ⭐ LA TABLE DES DÉPENDANTS CONTRE LE SCHÉMA RÉEL.
 *
 * La base applique les clés étrangères, et aucun `ON DELETE` n'est déclaré :
 * une clé étrangère que `DEPENDANTS` ne connaît pas, c'est une ligne qu'on ne
 * pourra plus effacer — sans erreur visible ailleurs que dans la corbeille, des
 * semaines plus tard. Ce test lit donc TOUTES les clés du schéma monté par les
 * vraies migrations.
 */

interface Fk {
  enfant: string;
  colonne: string;
  parent: string;
  /** `NO ACTION` partout aujourd'hui ; un `CASCADE` ou `SET NULL` se suffirait. */
  on_delete: string;
}

function clesDuSchema(): Fk[] {
  const db = baseNeuve();
  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as unknown as { name: string }[]
  ).map((t) => t.name);
  const out: Fk[] = [];
  for (const enfant of tables) {
    const cles = db.prepare(`PRAGMA foreign_key_list(${enfant})`).all() as unknown as {
      table: string;
      from: string;
      on_delete: string;
    }[];
    for (const c of cles) out.push({ enfant, colonne: c.from, parent: c.table, on_delete: c.on_delete });
  }
  db.close();
  return out;
}

const connue = (f: Fk) =>
  (DEPENDANTS[f.parent] ?? []).some((d) => d.table === f.enfant && d.colonne === f.colonne) ||
  GARDES_PAR_REFUS.some((g) => g.table === f.enfant && g.colonne === f.colonne && g.vers === f.parent);

describe("les dépendants d'une suppression suivent le schéma", () => {
  const cles = clesDuSchema();

  it("le schéma déclare bien des clés étrangères (sinon ce test ne prouve rien)", () => {
    expect(cles.length).toBeGreaterThan(15);
    expect(cles).toContainEqual(expect.objectContaining({ enfant: "goal_progress_log", parent: "goals" }));
    expect(cles).toContainEqual(expect.objectContaining({ enfant: "focus_sessions", parent: "tasks" }));
  });

  it("⭐⭐ TOUTE clé étrangère sans `ON DELETE` est défaite par `DEPENDANTS`, ou gardée par un refus", () => {
    const oubliees = cles.filter((f) => f.on_delete === "NO ACTION" && !connue(f));
    expect(oubliees).toEqual([]);
  });

  it("`DEPENDANTS` ne cite que des clés qui existent", () => {
    for (const [parent, liste] of Object.entries(DEPENDANTS)) {
      for (const d of liste) {
        expect(cles, `${d.table}.${d.colonne} → ${parent}`).toContainEqual(
          expect.objectContaining({ enfant: d.table, colonne: d.colonne, parent }),
        );
      }
    }
  });
});

describe("effacer une ligne citée", () => {
  function base() {
    const sqlite = baseNeuve();
    const db: BaseSuppression = {
      async execute(sql, params = []) {
        const ordre: number[] = [];
        const converti = sql.replace(/\$(\d+)/g, (_, n: string) => {
          ordre.push(Number(n) - 1);
          return "?";
        });
        return sqlite.prepare(converti).run(...ordre.map((i) => params[i] as SQLInputValue));
      },
    };
    const id = (sql: string, ...p: SQLInputValue[]) => Number(sqlite.prepare(sql).run(...p).lastInsertRowid);
    const lire = <T,>(sql: string, ...p: SQLInputValue[]) => sqlite.prepare(sql).all(...p) as unknown as T[];
    return { sqlite, db, id, lire };
  }

  it("la base de test applique les clés étrangères, comme sqlx dans l'app", () => {
    const { sqlite, id } = base();
    expect(sqlite.prepare("PRAGMA foreign_keys").get()).toEqual({ foreign_keys: 1 });
    const g = id("INSERT INTO goals (title, scope) VALUES ('suivi', 'long')");
    id("INSERT INTO goal_progress_log (goal_id, date, pct) VALUES (?, '2026-10-01', 10)", g);
    // Le défaut, tel quel : un DELETE nu est refusé.
    expect(() => sqlite.prepare("DELETE FROM goals WHERE id = ?").run(g)).toThrow(/FOREIGN KEY/);
    sqlite.close();
  });

  it("⭐ un objectif : enfants remontés AU GRAND-PARENT lu en base, tâches déliées, historique effacé", async () => {
    const { sqlite, db, id, lire } = base();
    const racine = id("INSERT INTO goals (title, scope) VALUES ('racine', 'long')");
    const milieu = id("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('milieu', 'long', ?)", racine);
    const feuille = id("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('feuille', 'long', ?)", milieu);
    const tache = id("INSERT INTO tasks (label, priority, goal_id) VALUES ('t', 'low', ?)", milieu);
    id("INSERT INTO goal_progress_log (goal_id, date, pct) VALUES (?, '2026-10-01', 10)", milieu);

    await effacerLigne(db, "goals", milieu);
    expect(lire("SELECT id FROM goals WHERE id = ?", milieu)).toEqual([]);
    expect(lire("SELECT parent_goal_id FROM goals WHERE id = ?", feuille)).toEqual([{ parent_goal_id: racine }]);
    expect(lire("SELECT goal_id FROM tasks WHERE id = ?", tache)).toEqual([{ goal_id: null }]);
    expect(lire("SELECT id FROM goal_progress_log")).toEqual([]);
    sqlite.close();
  });

  it("⭐ une tâche : coches effacées, séances gardées — une séance déjà nommée garde SON nom", async () => {
    const { sqlite, db, id, lire } = base();
    const t = id("INSERT INTO tasks (label, priority) VALUES ('Écrire le devis', 'low')");
    id("INSERT INTO task_completions (task_id, date, done) VALUES (?, '2026-10-01', 1)", t);
    const anonyme = id(
      "INSERT INTO focus_sessions (task_id, label, started_at, planned_min) VALUES (?, NULL, '2026-10-01 10:00:00', 25)",
      t,
    );
    const nommee = id(
      "INSERT INTO focus_sessions (task_id, label, started_at, planned_min) VALUES (?, 'Mon intitulé', '2026-10-01 11:00:00', 25)",
      t,
    );
    await effacerLigne(db, "tasks", t);
    expect(lire("SELECT id FROM tasks")).toEqual([]);
    expect(lire("SELECT id FROM task_completions")).toEqual([]);
    expect(lire("SELECT id, task_id, label FROM focus_sessions ORDER BY id")).toEqual([
      { id: anonyme, task_id: null, label: "Écrire le devis" },
      { id: nommee, task_id: null, label: "Mon intitulé" },
    ]);
    sqlite.close();
  });

  it("une table sans dépendants s'efface telle quelle", async () => {
    const { sqlite, db, id, lire } = base();
    const n = id("INSERT INTO notes (title, body) VALUES ('seule', '')");
    await effacerLigne(db, "notes", n);
    expect(lire("SELECT id FROM notes")).toEqual([]);
    sqlite.close();
  });
});
