import { describe, expect, it } from "vitest";
import { citantsDe } from "./liens";
import type { ObjectLink } from "./types";

/**
 * Constat 5 de l'audit du 2026-10-20 : un lien posé depuis une note ne se
 * voyait que d'un côté. `citantsDe` est ce que la tâche, le rendez-vous et la
 * fiche montrent désormais de l'autre côté.
 */
let n = 0;
const arete = (from_kind: ObjectLink["from_kind"], from_uid: string, to_kind: ObjectLink["to_kind"], to_uid: string, origin: ObjectLink["origin"] = "mention"): ObjectLink =>
  ({ id: ++n, uid: `l${n}`, from_kind, from_uid, to_kind, to_uid, origin, created_at: "2026-10-20" }) as ObjectLink;

describe("citantsDe", () => {
  const titres = new Map([
    ["note:n1", "Réunion Garnier"],
    ["event:e1", "Point hebdo"],
    ["note:n2", "Idées"],
  ]);

  it("⭐ la tâche citée par une note montre la note", () => {
    expect(citantsDe([arete("note", "n1", "task", "t1")], titres, { kind: "task", uid: "t1" })).toEqual([
      { kind: "note", uid: "n1", titre: "Réunion Garnier" },
    ]);
  });

  it("une note qui cite par « @ » ET à la main n'apparaît qu'une fois", () => {
    const r = citantsDe([arete("note", "n1", "task", "t1"), arete("note", "n1", "task", "t1", "manual")], titres, { kind: "task", uid: "t1" });
    expect(r).toHaveLength(1);
  });

  it("une source qui n'existe plus ici est écartée ; les familles suivent l'ordre habituel", () => {
    const r = citantsDe(
      [arete("event", "e1", "task", "t1"), arete("note", "fantome", "task", "t1"), arete("note", "n2", "task", "t1")],
      titres,
      { kind: "task", uid: "t1" },
    );
    expect(r.map((c) => c.titre)).toEqual(["Idées", "Point hebdo"]);
  });

  it("ne garde que ce qui vise CET objet", () => {
    expect(citantsDe([arete("note", "n1", "task", "t2")], titres, { kind: "task", uid: "t1" })).toEqual([]);
  });
});
