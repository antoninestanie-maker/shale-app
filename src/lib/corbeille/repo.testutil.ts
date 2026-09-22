import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import { baseNeuve } from "../sync/schema.testutil";

/**
 * ⭐ `repo.ts` SUR UNE VRAIE BASE SQLITE — une première dans ce dépôt.
 *
 * Jusqu'au 2026-09-22, aucun test n'exécutait les fonctions de `repo.ts` :
 * elles passent par `getDb()`, qui charge le plugin Tauri, et `isTauri` se
 * décide à l'import. Les lectures n'étaient donc prouvées que par l'usage.
 *
 * Or la corbeille repose entièrement sur des FILTRES posés dans ces lectures,
 * et « le premier oubli est silencieux ». Il fallait les éprouver sur le SQL
 * réel, avec les vraies migrations — pas sur une copie écrite pour le test.
 *
 * Ce module fournit l'adaptateur ; le test, lui, remplace `getDb` par
 * `vi.mock("../db")` et pose `window.__TAURI_INTERNALS__` AVANT d'importer
 * `repo.ts` (voir `corbeille.repo.test.ts`).
 */

/** La forme de `Database` de `@tauri-apps/plugin-sql`, telle que `repo.ts` l'emploie. */
export interface BaseCommeTauri {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<{ lastInsertId: number; rowsAffected: number }>;
}

/**
 * Traduit les jokers `$n` du plugin Tauri en `?` positionnels.
 *
 * ⚠️ RÉORDONNE au lieu de recopier : une même valeur peut servir deux fois dans
 * une requête (les `ON CONFLICT … DO UPDATE SET x = $3`). C'est la leçon déjà
 * écrite dans `sync/engine.testutil.ts` — reprise ici mot pour mot, parce
 * qu'une conversion naïve décalerait toutes les valeurs sans une erreur.
 */
function preparer(sql: string, params: unknown[]): [string, SQLInputValue[]] {
  const ordre: number[] = [];
  const converti = sql.replace(/\$(\d+)/g, (_, n: string) => {
    ordre.push(Number(n) - 1);
    return "?";
  });
  const valeurs = ordre.map((i) => {
    const v = params[i];
    if (typeof v === "boolean") return v ? 1 : 0;
    if (v === undefined) return null;
    return v as SQLInputValue;
  });
  return [converti, valeurs];
}

export function adapter(sqlite: DatabaseSync): BaseCommeTauri {
  return {
    async select<T>(sql: string, params: unknown[] = []): Promise<T> {
      const [s, v] = preparer(sql, params);
      return sqlite.prepare(s).all(...v) as T;
    },
    async execute(sql: string, params: unknown[] = []) {
      const [s, v] = preparer(sql, params);
      const r = sqlite.prepare(s).run(...v);
      return { lastInsertId: Number(r.lastInsertRowid), rowsAffected: Number(r.changes) };
    },
  };
}

/** Une base neuve au schéma courant (027 comprise), et son adaptateur. */
export function baseDeTest(): { sqlite: DatabaseSync; db: BaseCommeTauri } {
  const sqlite = baseNeuve();
  return { sqlite, db: adapter(sqlite) };
}
