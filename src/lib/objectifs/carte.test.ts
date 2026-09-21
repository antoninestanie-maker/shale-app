import { beforeAll, describe, expect, it, vi } from "vitest";

import { objectif } from "./objectif.testutil";
import type { Carte, Noeud } from "../carte";
import type { ObjectLink, Task } from "../types";

type Mod = typeof import("./carte");
let carteDObjectif: Mod["carteDObjectif"];
let planDeCarte: Mod["planDeCarte"];
let comptesDuPlan: Mod["comptesDuPlan"];
type Agencer = typeof import("../carte");
let agencer: Agencer["agencer"];
let assemblerContexte: typeof import("./contexte")["assemblerContexte"];

/**
 * La langue se fixe À L'IMPORT du module d'i18n : on pose le navigateur AVANT
 * d'importer (PIEGES § 14.2). Sans ça, « 42 % » devient « 42% » selon la
 * machine qui lance la suite.
 */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ carteDObjectif, planDeCarte, comptesDuPlan } = await import("./carte"));
  ({ agencer } = await import("../carte"));
  ({ assemblerContexte } = await import("./contexte"));
});

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1,
  label: "écrire",
  tag: null,
  priority: "medium",
  recurrence: "none",
  goal_id: null,
  created_at: "2026-09-01 09:00:00",
  due_date: null,
  start_at: null,
  end_at: null,
  postponed_count: 0,
  postponed_from: null,
  is_example: 0,
  ...p,
});

const sources = (p: Partial<Parameters<Mod["carteDObjectif"]>[1]> = {}) => ({
  goals: [],
  tasks: [],
  faites: new Set<number>(),
  contexte: { liens: [], evenements: [], titres: {} },
  pct: new Map<number, number | null>(),
  ...p,
});

const noeud = (c: Carte, id: string): Noeud => {
  const n = c.noeuds.find((x) => x.id === id);
  if (!n) throw new Error(`nœud ${id} absent`);
  return n;
};

// ─── Sens 1 : la feuille de route dessinée ───────────────────────────────────

describe("la feuille de route, dessinée en carte", () => {
  const racine = objectif({ id: 1, title: "Devenir rentable", uid: "u-racine" });
  const phase = objectif({ id: 2, title: "Préparer", parent_goal_id: 1, is_milestone: 1, position: 0, uid: "u-phase" });
  const sous = objectif({ id: 3, title: "Backtester", parent_goal_id: 2, position: 0, uid: "u-sous" });
  const autre = objectif({ id: 4, title: "Tenir le journal", parent_goal_id: 1, position: 1, uid: "u-autre" });

  const jeu = sources({
    goals: [racine, phase, sous, autre],
    tasks: [tache({ id: 10, label: "50 setups", goal_id: 3, uid: "u-t10" })],
    pct: new Map([
      [1, 42],
      [2, 60],
      [3, 60],
      [4, null],
    ]),
  });

  /**
   * ⚠️ En français, `Intl` sépare le nombre du signe par une espace INSÉCABLE
   * (U+00A0), pas par une espace ordinaire — et c'est exactement pour cela que
   * le pourcentage passe par `Intl` : une chaîne écrite à la main ici aurait
   * l'air juste et serait typographiquement fausse (PIEGES § 5.2 bis).
   */
  it("le centre porte l'objectif, son pourcentage, et sa référence", () => {
    const c = carteDObjectif(racine, jeu);
    const centre = noeud(c, "r");
    expect(centre.parent).toBeNull();
    expect(centre.texte).toBe("Devenir rentable · 42\u00a0%");
    expect(centre.ref).toEqual({ kind: "goal", uid: "u-racine" });
  });

  it("une étape sans pourcentage n'affiche pas un faux zéro", () => {
    const c = carteDObjectif(racine, jeu);
    expect(noeud(c, "g4").texte).toBe("Tenir le journal");
  });

  it("les branches naissent en alternance, une couleur chacune", () => {
    const c = carteDObjectif(racine, jeu);
    expect(noeud(c, "g2").cote).toBe(1);
    expect(noeud(c, "g2").teinte).toBe(0);
    expect(noeud(c, "g4").cote).toBe(-1);
    expect(noeud(c, "g4").teinte).toBe(1);
  });

  it("l'ordre des branches est celui de la feuille de route, position d'abord", () => {
    const inverse = sources({ ...jeu, goals: [racine, { ...autre, position: 0 }, { ...phase, position: 1 }, sous] });
    const c = carteDObjectif(racine, inverse);
    const branches = c.noeuds.filter((n) => n.parent === "r").map((n) => n.id);
    expect(branches).toEqual(["g4", "g2"]);
  });

  it("une tâche pend sous l'étape qui la porte, avec son identité", () => {
    const c = carteDObjectif(racine, jeu);
    const t = noeud(c, "t10");
    expect(t.parent).toBe("g3");
    expect(t.texte).toBe("50 setups");
    expect(t.ref).toEqual({ kind: "task", uid: "u-t10" });
  });

  it("une tâche faite porte une coche ; une récurrente cochée, jamais", () => {
    const faite = sources({
      ...jeu,
      tasks: [
        tache({ id: 10, label: "50 setups", goal_id: 3, uid: "u-t10" }),
        tache({ id: 11, label: "revue du soir", goal_id: 3, recurrence: "daily", uid: "u-t11" }),
      ],
      faites: new Set([10, 11]),
    });
    const c = carteDObjectif(racine, faite);
    expect(noeud(c, "t10").texte).toBe("✓ 50 setups");
    expect(noeud(c, "t11").texte).toBe("revue du soir");
  });

  it("une note rattachée devient un nœud-référence, pas un sous-objectif", () => {
    const lien: ObjectLink = {
      id: 1,
      uid: "ol:goal:u-racine:note:n-1",
      from_kind: "goal",
      from_uid: "u-racine",
      to_kind: "note",
      to_uid: "n-1",
      origin: "manual",
      created_at: "2026-09-01 09:00:00",
    };
    const contexte = assemblerContexte([lien], [{ uid: "n-1", title: "Plan de risque" }], [], []);
    const c = carteDObjectif(racine, sources({ ...jeu, contexte }));
    const n = noeud(c, "note:n-1");
    expect(n.parent).toBe("r");
    expect(n.texte).toBe("Plan de risque");
    expect(n.ref).toEqual({ kind: "note", uid: "n-1" });
  });

  it("les identifiants sont uniques et stables : la carte se dessine", () => {
    const c = carteDObjectif(racine, jeu);
    expect(new Set(c.noeuds.map((n) => n.id)).size).toBe(c.noeuds.length);
    // Tout nœud est placé : un parent manquant le ferait disparaître du dessin.
    expect(agencer(c).boites.size).toBe(c.noeuds.length);
  });
});

// ─── Sens 2 : la carte devenue objectif ──────────────────────────────────────

const carte = (noeuds: Noeud[]): Carte => ({ v: 1, noeuds });

describe("une carte mentale, devenue objectif", () => {
  it("le centre donne le titre ; un niveau 1 qui porte des enfants est une phase", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Préparer" },
        { id: "a1", parent: "a", texte: "Backtester" },
        { id: "b", parent: "r", texte: "Tenir le journal" },
      ]),
    );
    expect(plan.titre).toBe("Devenir rentable");
    expect(plan.etapes.map((e) => [e.titre, e.phase])).toEqual([
      ["Préparer", true],
      ["Tenir le journal", false],
    ]);
    expect(plan.etapes[0].sousEtapes.map((s) => s.titre)).toEqual(["Backtester"]);
  });

  it("au-delà du niveau 2, tout devient des tâches du sous-objectif qui les porte", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Préparer" },
        { id: "a1", parent: "a", texte: "Backtester" },
        { id: "x", parent: "a1", texte: "50 setups" },
        { id: "y", parent: "x", texte: "en noter les résultats" },
      ]),
    );
    const sous = plan.etapes[0].sousEtapes[0];
    expect(sous.titre).toBe("Backtester");
    expect(sous.sousEtapes).toEqual([]);
    expect(sous.taches.map((t) => t.titre)).toEqual(["50 setups", "en noter les résultats"]);
  });

  it("une tâche déjà citée se rattache, elle ne se recopie pas", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Revue du soir", ref: { kind: "task", uid: "u-t7" } },
      ]),
    );
    expect(plan.etapes).toEqual([]);
    expect(plan.taches).toEqual([{ titre: "Revue du soir", ref: { kind: "task", uid: "u-t7" } }]);
  });

  it("une note, une fiche ou un événement cité devient une ressource rattachée", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Préparer" },
        { id: "n", parent: "a", texte: "Plan de risque", ref: { kind: "note", uid: "n-1" } },
        { id: "f", parent: "r", texte: "Méthode", ref: { kind: "knowledge", uid: "k-1" } },
      ]),
    );
    expect(plan.etapes[0].ressources).toEqual([{ kind: "note", uid: "n-1" }]);
    expect(plan.ressources).toEqual([{ kind: "knowledge", uid: "k-1" }]);
    // La note n'a pas fait de « Préparer » une phase : ce n'est pas un sous-objectif.
    expect(plan.etapes[0].phase).toBe(false);
  });

  it("un objectif cité reste du TEXTE : perdre le lien vaut mieux que perdre l'idée", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Discipline", ref: { kind: "goal", uid: "u-g9" } },
      ]),
    );
    expect(plan.etapes.map((e) => e.titre)).toEqual(["Discipline"]);
    expect(plan.taches).toEqual([]);
    expect(plan.ressources).toEqual([]);
  });

  it("un nœud vide ou mort est écarté AVEC ce qui pend dessous, et le compte est rendu", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "vide", parent: "r", texte: "   " },
        { id: "v1", parent: "vide", texte: "perdu" },
        { id: "mort", parent: "r", texte: "Note supprimée", ref: { kind: "note", uid: "n-9" }, mort: true },
        { id: "ok", parent: "r", texte: "Préparer" },
      ]),
    );
    expect(plan.etapes.map((e) => e.titre)).toEqual(["Préparer"]);
    expect(plan.ignores).toBe(3);
  });

  it("un pli ne cache rien à la conversion : une branche repliée se convertit quand même", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Préparer", plie: true },
        { id: "a1", parent: "a", texte: "Backtester" },
      ]),
    );
    expect(plan.etapes[0].sousEtapes.map((s) => s.titre)).toEqual(["Backtester"]);
  });

  it("le plan s'annonce avant d'être écrit", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Préparer" },
        { id: "a1", parent: "a", texte: "Backtester" },
        { id: "x", parent: "a1", texte: "50 setups" },
        { id: "t", parent: "a1", texte: "Revue", ref: { kind: "task", uid: "u-t7" } },
        { id: "n", parent: "r", texte: "Plan de risque", ref: { kind: "note", uid: "n-1" } },
        { id: "b", parent: "r", texte: "Tenir le journal" },
      ]),
    );
    expect(comptesDuPlan(plan)).toEqual({
      etapes: 3, // Préparer, Backtester, Tenir le journal
      phases: 1, // Préparer
      taches: 1, // « 50 setups »
      tachesRattachees: 1, // la tâche citée
      ressources: 1, // la note citée
    });
  });

  it("une carte réduite à son centre ne propose aucune étape, et garde son titre", () => {
    const plan = planDeCarte(carte([{ id: "r", parent: null, texte: "Une idée" }]));
    expect(plan).toEqual({ titre: "Une idée", etapes: [], taches: [], ressources: [], ignores: 0 });
  });
});

// ─── L'aller-retour ──────────────────────────────────────────────────────────

describe("l'aller et le retour se répondent", () => {
  it("dessiner une feuille de route puis la relire rend la même structure", () => {
    const racine = objectif({ id: 1, title: "Devenir rentable", uid: "u-1" });
    const phase = objectif({ id: 2, title: "Préparer", parent_goal_id: 1, is_milestone: 1, uid: "u-2" });
    const sous = objectif({ id: 3, title: "Backtester", parent_goal_id: 2, uid: "u-3" });
    const dessin = carteDObjectif(
      racine,
      sources({
        goals: [racine, phase, sous],
        tasks: [tache({ id: 10, label: "50 setups", goal_id: 3, uid: "u-t10" })],
      }),
    );
    const plan = planDeCarte(dessin);

    expect(plan.titre).toBe("Devenir rentable");
    expect(plan.etapes.map((e) => [e.titre, e.phase])).toEqual([["Préparer", true]]);
    expect(plan.etapes[0].sousEtapes[0].titre).toBe("Backtester");
    // La tâche existe déjà : elle se rattache, elle ne se duplique pas.
    expect(plan.etapes[0].sousEtapes[0].taches).toEqual([
      { titre: "50 setups", ref: { kind: "task", uid: "u-t10" } },
    ]);
  });
});
