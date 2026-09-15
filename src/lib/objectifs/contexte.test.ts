import { describe, expect, it } from "vitest";

import type { CalendarEvent, ObjectLink } from "../types";
import { assemblerContexte, rattachementsDe } from "./contexte";

let n = 0;
const lien = (from: [ObjectLink["from_kind"], string], to: [ObjectLink["to_kind"], string]): ObjectLink => ({
  id: ++n,
  uid: `ol:${from.join(":")}:${to.join(":")}`,
  from_kind: from[0],
  from_uid: from[1],
  to_kind: to[0],
  to_uid: to[1],
  origin: "manual",
  created_at: "2026-09-15 10:00:00",
});

const evenement = (uid: string, title: string): CalendarEvent & { uid: string } => ({
  id: 1,
  uid,
  title,
  body: null,
  date: "2026-09-20",
  end_date: null,
  start_at: null,
  end_at: null,
  all_day: 1,
  color: null,
  recurrence: "none",
  created_at: "2026-09-01 09:00:00",
  updated_at: "2026-09-01 09:00:00",
});

describe("le contexte des objectifs", () => {
  it("écarte une arête dont la cible n'existe pas — pas de ligne fantôme", () => {
    const c = assemblerContexte(
      [lien(["goal", "g1"], ["note", "n1"]), lien(["goal", "g1"], ["note", "disparue"])],
      [{ uid: "n1", title: "Plan" }],
      [],
      [],
    );
    expect(c.liens.map((l) => l.to_uid)).toEqual(["n1"]);
  });

  it("n'embarque que les notes, fiches et événements : les tâches passent par `goal_id`", () => {
    const c = assemblerContexte(
      [lien(["goal", "g1"], ["task", "t1"]), lien(["goal", "g1"], ["trade", "tr1"]), lien(["goal", "g1"], ["knowledge", "k1"])],
      [],
      [{ uid: "k1", title: "Méthode" }],
      [],
    );
    expect(c.liens.map((l) => l.to_kind)).toEqual(["knowledge"]);
  });
});

describe("les rattachements d'un objectif", () => {
  const contexte = assemblerContexte(
    [
      lien(["goal", "g1"], ["note", "n1"]),
      lien(["note", "n1"], ["goal", "g1"]), // la même, dans l'autre sens (une mention)
      lien(["goal", "g1"], ["event", "e1"]),
      lien(["goal", "g2"], ["knowledge", "k1"]),
    ],
    [{ uid: "n1", title: "Plan de risque" }],
    [{ uid: "k1", title: "Méthode" }],
    [evenement("e1", "Rendez-vous banque")],
  );

  it("lit les deux sens, dédoublonne, et met les événements (qui comptent) en tête", () => {
    expect(rattachementsDe("g1", contexte).map((r) => [r.kind, r.titre])).toEqual([
      ["event", "Rendez-vous banque"],
      ["note", "Plan de risque"],
    ]);
  });

  it("ne mélange pas les objectifs", () => {
    expect(rattachementsDe("g2", contexte).map((r) => r.uid)).toEqual(["k1"]);
    expect(rattachementsDe("g3", contexte)).toEqual([]);
  });
});
