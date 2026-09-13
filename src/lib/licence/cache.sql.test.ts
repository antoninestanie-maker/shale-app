// La table `license_profile` (migration 025), sur les vraies migrations.
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { baseNeuve } from "../sync/schema.testutil";
import { estTableSync, TABLES_HORS_SYNC } from "../sync/scope";

let db: DatabaseSync;
beforeEach(() => {
  db = baseNeuve();
});
afterEach(() => db.close());

const inserer = (uid: string, payload = '{ "a" : 1 }') =>
  db
    .prepare(
      `INSERT INTO license_profile (uid, tier, profile_version, issued_at, expires_at, payload, signature)
       VALUES (?, 'shale_trade', 1, '2026-09-13T08:00:00.123Z', '2027-09-13T23:59:59.000Z', ?, 'c2ln')`,
    )
    .run(uid, payload);

describe("migration 025 — cache du profil de licence", () => {
  it("est HORS synchronisation, avec son motif écrit", () => {
    expect(estTableSync("license_profile")).toBe(false);
    expect(TABLES_HORS_SYNC.license_profile).toMatch(/droit commercial/i);
  });

  it("n'écrit rien dans l'outbox — aucun trigger ne la surveille", () => {
    inserer("compte-a");
    db.prepare("UPDATE license_profile SET expires_at = '2099-01-01' WHERE uid = 'compte-a'").run();
    db.prepare("DELETE FROM license_profile WHERE uid = 'compte-a'").run();
    const n = db.prepare("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = 'license_profile'").get();
    expect(n?.n).toBe(0);
    const triggers = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'license_profile'")
      .all();
    expect(triggers).toEqual([]);
  });

  it("garde le texte signé tel quel, et un seul profil par compte", () => {
    inserer("compte-a", '{ "z": 1,  "a": "l\'accent é" }');
    const l = db.prepare("SELECT payload, issued_at FROM license_profile WHERE uid = 'compte-a'").get();
    expect(l).toEqual({ payload: '{ "z": 1,  "a": "l\'accent é" }', issued_at: "2026-09-13T08:00:00.123Z" });
    expect(() => inserer("compte-a")).toThrow();
    inserer("compte-b");
    expect(db.prepare("SELECT COUNT(*) AS n FROM license_profile").get()?.n).toBe(2);
  });
});
