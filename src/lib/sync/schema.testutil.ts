import { DatabaseSync } from "node:sqlite";

import m01 from "../../../src-tauri/migrations/001_initial.sql?raw";
import m02 from "../../../src-tauri/migrations/002_performance.sql?raw";
import m03 from "../../../src-tauri/migrations/003_capture.sql?raw";
import m04 from "../../../src-tauri/migrations/004_focus.sql?raw";
import m05 from "../../../src-tauri/migrations/005_notes.sql?raw";
import m06 from "../../../src-tauri/migrations/006_trading.sql?raw";
import m07 from "../../../src-tauri/migrations/007_trade_mode.sql?raw";
import m08 from "../../../src-tauri/migrations/008_position_sizing.sql?raw";
import m09 from "../../../src-tauri/migrations/009_benchmark.sql?raw";
import m10 from "../../../src-tauri/migrations/010_market.sql?raw";
import m11 from "../../../src-tauri/migrations/011_goal_category.sql?raw";
import m12 from "../../../src-tauri/migrations/012_live_tracker.sql?raw";
import m13 from "../../../src-tauri/migrations/013_knowledge.sql?raw";
import m14 from "../../../src-tauri/migrations/014_knowledge_text.sql?raw";
import m15 from "../../../src-tauri/migrations/015_sync_identity.sql?raw";
import m16 from "../../../src-tauri/migrations/016_sync_outbox.sql?raw";

/**
 * Les migrations telles que `src-tauri/src/lib.rs` les enregistre, dans l'ordre.
 *
 * Elles sont LUES DEPUIS LES VRAIS FICHIERS, pas recopiées : un test qui
 * passerait sur une copie du schéma ne prouverait rien sur le schéma livré.
 * Toute migration ajoutée dans `lib.rs` doit l'être ici aussi — sans quoi les
 * tests continueraient de valider un schéma périmé.
 */
export const MIGRATIONS: readonly string[] = [
  m01, m02, m03, m04, m05, m06, m07, m08, m09, m10, m11, m12, m13, m14, m15, m16,
];

/** Numéro de la migration qui installe l'identité globale (colonnes `uid`). */
export const MIGRATION_IDENTITE = 15;

/** Base en mémoire montée au schéma courant. À fermer par l'appelant. */
export function baseNeuve(jusquA = MIGRATIONS.length): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const sql of MIGRATIONS.slice(0, jusquA)) db.exec(sql);
  return db;
}

/** Colonne `uid` de la ligne fraîchement insérée dans `table`. */
export function uidDe(db: DatabaseSync, table: string, id: number): string {
  const ligne = db.prepare(`SELECT uid FROM ${table} WHERE id = ?`).get(id);
  return (ligne?.uid ?? "") as string;
}

/** Forme d'un UUID v4 : version `4` et variante `8|9|a|b` aux bonnes places. */
export const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
