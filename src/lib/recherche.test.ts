import { describe, expect, it } from "vitest";

import { extraitAutour, rechercher, scoreDe, type Document } from "./recherche";

/** Chantier C — un seul moteur de recherche pour toute l'app. */

const doc = (p: Partial<Document> & { titre: string }): Document => ({
  kind: "note",
  id: 1,
  uid: `u${p.titre}`,
  ...p,
});

// ─────────────────────────────────────────────────────────────────────────────

describe("le classement", () => {
  it("⭐ le titre qui COMMENCE par la requête passe devant celui qui la contient", () => {
    const r = rechercher(
      [doc({ titre: "Mon plan de risque" }), doc({ titre: "Plan de risque" })],
      "plan",
    );
    expect(r[0].titre).toBe("Plan de risque");
  });

  it("un mot du titre qui commence par la requête compte", () => {
    // « risque » doit trouver « Plan de risque » — sinon la recherche n'aide
    // qu'à retrouver ce dont on se rappelle déjà le début.
    expect(scoreDe(doc({ titre: "Plan de risque" }), "risque")).toBeGreaterThan(0);
  });

  it("le corps compte moins que le titre", () => {
    const parTitre = scoreDe(doc({ titre: "Risque" }), "risque");
    const parCorps = scoreDe(doc({ titre: "Autre", corps: "un mot sur le risque" }), "risque");
    expect(parTitre).toBeGreaterThan(parCorps);
    expect(parCorps).toBeGreaterThan(0);
  });

  it("le titre exact passe devant tout le reste", () => {
    const r = rechercher([doc({ titre: "Risque majeur" }), doc({ titre: "Risque" })], "risque");
    expect(r[0].titre).toBe("Risque");
  });

  it("ignore les accents et la casse", () => {
    expect(scoreDe(doc({ titre: "Échéance" }), "echeance")).toBeGreaterThan(0);
    expect(scoreDe(doc({ titre: "PLAN" }), "plan")).toBeGreaterThan(0);
  });

  it("écarte ce qui ne correspond pas", () => {
    expect(rechercher([doc({ titre: "Plan" })], "zzz")).toEqual([]);
  });

  it("⚠️ deux recherches identiques rendent exactement le même ordre", () => {
    // Sans départage stable, la sélection au clavier sauterait d'une frappe à
    // l'autre sur des résultats de même score.
    const corpus = [
      doc({ titre: "Alpha", kind: "task", id: 1 }),
      doc({ titre: "Alpha", kind: "note", id: 2 }),
      doc({ titre: "Alpha", kind: "goal", id: 3 }),
    ];
    const a = rechercher(corpus, "alpha").map((r) => r.kind);
    const b = rechercher([...corpus].reverse(), "alpha").map((r) => r.kind);
    expect(a).toEqual(b);
  });

  it("à score égal, ce qu'on a écrit passe devant une tâche", () => {
    // Trois lettres tapées cherchent presque toujours quelque chose qu'on a
    // rédigé, pas une tâche récurrente qui contient les mêmes lettres.
    const r = rechercher(
      [doc({ titre: "Backtest", kind: "task", id: 1 }), doc({ titre: "Backtest", kind: "note", id: 2 })],
      "backtest",
    );
    expect(r[0].kind).toBe("note");
  });
});

describe("les options", () => {
  it("filtre par famille", () => {
    const corpus = [doc({ titre: "A", kind: "note" }), doc({ titre: "A", kind: "task", id: 2 })];
    const r = rechercher(corpus, "a", { familles: ["task"] });
    expect(r.map((x) => x.kind)).toEqual(["task"]);
  });

  it("⚠️ on ne se cite pas soi-même", () => {
    // C'est le cas le plus fréquent, pas un cas limite : on tape le début du
    // titre de la note qu'on est en train d'écrire.
    const moi = doc({ titre: "Plan", uid: "moi" });
    expect(rechercher([moi], "plan", { exclure: { kind: "note", uid: "moi" } })).toEqual([]);
  });

  it("respecte la limite", () => {
    const corpus = Array.from({ length: 40 }, (_, i) => doc({ titre: `Plan ${i}`, id: i }));
    expect(rechercher(corpus, "plan", { limite: 5 })).toHaveLength(5);
  });

  it("⭐ une requête VIDE propose quand même quelque chose", () => {
    // Le sélecteur `@` s'ouvre avant qu'on ait tapé quoi que ce soit : un écran
    // blanc n'apprendrait rien à personne.
    const corpus = [doc({ titre: "Récent" }), doc({ titre: "Ancien", id: 2 })];
    const r = rechercher(corpus, "", { limite: 1 });
    expect(r.map((x) => x.titre)).toEqual(["Récent"]);
  });
});

describe("l'extrait", () => {
  it("montre POURQUOI le résultat sort", () => {
    const extrait = extraitAutour("Le début du texte, puis le mot risque, puis la suite", "risque");
    expect(extrait).toContain("risque");
    expect(extrait?.startsWith("…")).toBe(true);
  });

  it("ne rend rien quand la requête n'est pas dans le corps", () => {
    expect(extraitAutour("rien ici", "risque")).toBeUndefined();
  });

  it("ne met pas de points de suspension au début quand le mot est au début", () => {
    expect(extraitAutour("risque et suite", "risque")?.startsWith("…")).toBe(false);
  });
});
