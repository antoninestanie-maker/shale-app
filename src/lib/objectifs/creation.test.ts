import { describe, expect, it } from "vitest";

import {
  etapesACreer,
  lignesAffichees,
  lignesUtiles,
  MAX_LIGNES,
  tachesACreer,
  tachesAffichees,
} from "./creation";

describe("les lignes du premier jet", () => {
  it("les vides et les espaces ne créent rien", () => {
    expect(lignesUtiles(["  Préparer ", "", "   ", "Tester"])).toEqual(["Préparer", "Tester"]);
  });

  it("le plafond est tenu même si l'appelant en passe plus", () => {
    const dix = Array.from({ length: 10 }, (_, i) => `étape ${i}`);
    expect(lignesUtiles(dix)).toHaveLength(MAX_LIGNES);
  });

  it("une ligne de plus s'ouvre dès que la dernière est remplie", () => {
    expect(lignesAffichees([""])).toEqual([""]);
    expect(lignesAffichees(["Préparer"])).toEqual(["Préparer", ""]);
    expect(lignesAffichees(["Préparer", ""])).toEqual(["Préparer", ""]);
  });

  it("aucune ligne ne s'ouvre au-delà du plafond", () => {
    const pleines = Array.from({ length: MAX_LIGNES }, (_, i) => `étape ${i}`);
    expect(lignesAffichees(pleines)).toHaveLength(MAX_LIGNES);
  });

  it("une liste vide affiche toujours UNE ligne : il faut bien où taper", () => {
    expect(lignesAffichees([])).toEqual([""]);
  });
});

describe("les premières étapes", () => {
  const base = { scope: "medium", category: "Trading" } as const;

  it("héritent de l'horizon et de la catégorie de l'objectif", () => {
    const [a] = etapesACreer(base, ["Préparer"], 7);
    expect(a.scope).toBe("medium");
    expect(a.category).toBe("Trading");
    expect(a.parent_goal_id).toBe(7);
  });

  it("sont numérotées dans l'ordre de saisie", () => {
    const etapes = etapesACreer(base, ["Préparer", "Tester", "Lancer"], 7);
    expect(etapes.map((e) => [e.title, e.position])).toEqual([
      ["Préparer", 0],
      ["Tester", 1],
      ["Lancer", 2],
    ]);
  });

  it("naissent sous-objectifs MESURÉS et sans échéance", () => {
    const [a] = etapesACreer(base, ["Préparer"], 7);
    expect(a.is_milestone).toBe(0);
    expect(a.manual_progress).toBe(0);
    expect(a.deadline).toBeNull();
    expect(a.progress_pct).toBe(0);
  });

  it("une catégorie absente ne devient pas une chaîne vide", () => {
    const [a] = etapesACreer({ scope: "long", category: null }, ["Préparer"], 7);
    expect(a.category).toBeNull();
  });
});

describe("les premières tâches", () => {
  it("naissent rattachées à l'objectif, avec leur échéance", () => {
    const [t] = tachesACreer([{ nom: " Backtester 1 h ", echeance: "2026-09-24" }], 7);
    expect(t.label).toBe("Backtester 1 h");
    expect(t.goal_id).toBe(7);
    expect(t.due_date).toBe("2026-09-24");
    expect(t.recurrence).toBe("none");
  });

  it("sans échéance, les trois colonnes de planification restent vides", () => {
    const [t] = tachesACreer([{ nom: "Backtester", echeance: "" }], 7);
    expect(t.due_date).toBeNull();
    expect(t.start_at).toBeNull();
    expect(t.end_at).toBeNull();
  });

  it("une ligne sans nom ne crée rien, même avec une date", () => {
    expect(tachesACreer([{ nom: "  ", echeance: "2026-09-24" }], 7)).toEqual([]);
  });

  it("une ligne de tâche s'ouvre sur le nom, jamais sur la date seule", () => {
    expect(tachesAffichees([{ nom: "", echeance: "2026-09-24" }])).toHaveLength(1);
    expect(tachesAffichees([{ nom: "Backtester", echeance: "" }])).toHaveLength(2);
    expect(tachesAffichees([])).toEqual([{ nom: "", echeance: "" }]);
  });

  it("le plafond vaut aussi pour les tâches", () => {
    const dix = Array.from({ length: 10 }, (_, i) => ({ nom: `tâche ${i}`, echeance: "" }));
    expect(tachesACreer(dix, 7)).toHaveLength(MAX_LIGNES);
  });
});
