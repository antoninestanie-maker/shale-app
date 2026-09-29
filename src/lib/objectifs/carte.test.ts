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
  contexte: { liens: [], evenements: [], titres: {} },
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
  });

  // ⚠️ CHANGÉ EXPRÈS le 2026-09-29 (décision F de l'arrêt 1 du chantier
  // carte-objectifs). Le centre portait « Devenir rentable · 42 % » DANS son
  // texte — donc dans l'export PNG/SVG, figé. Le pourcentage vit désormais dans
  // la couche vivante de l'éditeur, jamais dans le dessin.
  it("le centre porte l'objectif, son TITRE seul, son genre et sa référence", () => {
    const c = carteDObjectif(racine, jeu);
    const centre = noeud(c, "r");
    expect(centre.parent).toBeNull();
    expect(centre.texte).toBe("Devenir rentable");
    expect(centre.genre).toBe("objectif");
    expect(centre.ref).toEqual({ kind: "goal", uid: "u-racine" });
  });

  it("chaque étape dit son genre — l'icône du dessin en dépend", () => {
    const c = carteDObjectif(racine, jeu);
    expect(noeud(c, "g2").genre).toBe("phase");
    expect(noeud(c, "g3").genre).toBe("sous-objectif");
    expect(noeud(c, "g4").genre).toBe("sous-objectif");
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

  // ⚠️ CHANGÉ EXPRÈS le 2026-09-29 (décision F) : « ✓ 50 setups » figeait la
  // coche dans l'export. La coche est une case de la couche vivante.
  it("une tâche porte son TITRE seul, jamais de coche dans le texte", () => {
    const c = carteDObjectif(racine, jeu);
    expect(noeud(c, "t10").texte).toBe("50 setups");
  });

  it("⭐ l'habitude qui COMPTE une étape pend sous elle, en nœud-habitude", () => {
    const comptee = objectif({ id: 5, title: "Méditer 30 jours", parent_goal_id: 1, position: 2, uid: "u-m", count_source: "habit", count_ref_uid: "h-1" });
    const c = carteDObjectif(
      racine,
      sources({ ...jeu, goals: [racine, phase, sous, autre, comptee], habits: [{ id: 1, uid: "h-1", name: "Méditer", color: "x", archived: 0, is_example: 0 }] }),
    );
    expect(noeud(c, "h:5")).toMatchObject({ parent: "g5", texte: "Méditer", ref: { kind: "habit", uid: "h-1" } });
  });

  it("⭐ les positions posées viennent du RÉGLAGE, par identité globale — jamais sur la racine", () => {
    const positions = { "goal:u-phase": { x: 300, y: -40 }, "task:u-t10": { x: 12, y: 8 }, "goal:u-racine": { x: 5, y: 5 } };
    const c = carteDObjectif(racine, sources({ ...jeu, positions }));
    expect(noeud(c, "g2").pos).toEqual({ x: 300, y: -40 });
    expect(noeud(c, "t10").pos).toEqual({ x: 12, y: 8 });
    expect(noeud(c, "r").pos).toBeUndefined();
    expect(noeud(c, "g4").pos).toBeUndefined();
  });

  it("⭐ glisser ne touche PAS à la feuille de route : mêmes nœuds, même ordre, avec ou sans positions", () => {
    const sans = carteDObjectif(racine, jeu);
    const avec = carteDObjectif(racine, sources({ ...jeu, positions: { "goal:u-phase": { x: -500, y: 900 } } }));
    expect(avec.noeuds.map((n) => [n.id, n.parent])).toEqual(sans.noeuds.map((n) => [n.id, n.parent]));
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

  // ⚠️ CHANGÉ EXPRÈS le 2026-09-29 — décision D de l'arrêt 1 du chantier
  // carte-objectifs. Ce test disait « un objectif cité reste du TEXTE : perdre
  // le lien vaut mieux que perdre l'idée » : le titre devenait une étape NEUVE,
  // c'est-à-dire un doublon de l'étape citée. Depuis qu'un nœud peut ÊTRE une
  // étape, ce doublon se fabriquerait à chaque conversion.
  it("⭐ un objectif cité n'est NI recopié NI déplacé : laissé où il est, et compté", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Discipline", ref: { kind: "goal", uid: "u-g9" } },
        { id: "a1", parent: "a", texte: "Une idée sous l'étape existante" },
      ]),
    );
    expect(plan.etapes).toEqual([]);
    expect(plan.laisses).toEqual([{ kind: "goal", uid: "u-g9", titre: "Discipline" }]);
    // Ce qui pend sous une étape existante reste avec elle : ni tâche, ni « écarté ».
    expect(plan.ignores).toBe(0);
    expect(comptesDuPlan(plan).laisses).toBe(1);
  });

  it("⭐ une tâche citée DÉJÀ rattachée ailleurs est laissée ; une tâche libre est rattachée", () => {
    const c = carte([
      { id: "r", parent: null, texte: "Devenir rentable" },
      { id: "a", parent: "r", texte: "Revue", ref: { kind: "task", uid: "u-t1" } },
      { id: "b", parent: "r", texte: "Journal", ref: { kind: "task", uid: "u-t2" } },
    ]);
    const plan = planDeCarte(c, {
      tasks: [
        { id: 1, uid: "u-t1", goal_id: 42 },
        { id: 2, uid: "u-t2", goal_id: null },
      ],
    });
    expect(plan.laisses).toEqual([{ kind: "task", uid: "u-t1", titre: "Revue" }]);
    expect(plan.taches).toEqual([{ titre: "Journal", ref: { kind: "task", uid: "u-t2" } }]);
  });

  it("une habitude citée est mise de côté pour le panneau, jamais changée en étape de texte", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "Devenir rentable" },
        { id: "a", parent: "r", texte: "Méditer", ref: { kind: "habit", uid: "h-1" } },
      ]),
    );
    expect(plan.etapes).toEqual([]);
    expect(plan.habitudes).toEqual([{ uid: "h-1", titre: "Méditer" }]);
  });

  it("un objectif cité PROFOND (niveau 3) n'est pas recopié en tâche non plus", () => {
    const plan = planDeCarte(
      carte([
        { id: "r", parent: null, texte: "R" },
        { id: "a", parent: "r", texte: "A" },
        { id: "b", parent: "a", texte: "B" },
        { id: "c", parent: "b", texte: "Étape d'ailleurs", ref: { kind: "goal", uid: "u-g9" } },
      ]),
    );
    expect(plan.etapes[0].sousEtapes[0].taches).toEqual([]);
    expect(plan.laisses.map((l) => l.uid)).toEqual(["u-g9"]);
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
      laisses: 0,
      habitudes: 0,
    });
  });

  it("une carte réduite à son centre ne propose aucune étape, et garde son titre", () => {
    const plan = planDeCarte(carte([{ id: "r", parent: null, texte: "Une idée" }]));
    expect(plan).toEqual({ titre: "Une idée", etapes: [], taches: [], ressources: [], ignores: 0, laisses: [], habitudes: [] });
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
    // ⚠️ Depuis la décision D (2026-09-29), un objectif CITÉ est laissé en
    // place, jamais recopié : reconvertir le dessin tel quel ne créerait plus
    // rien. L'aller-retour porte sur la STRUCTURE — on relit donc le dessin
    // avec ses étapes redevenues des idées, comme si on l'avait redessiné.
    const redessine = {
      ...dessin,
      noeuds: dessin.noeuds.map((n) => {
        if (n.ref?.kind !== "goal") return n;
        const { ref: _r, genre: _g, ...idee } = n;
        return idee;
      }),
    };
    const plan = planDeCarte(redessine);

    expect(plan.titre).toBe("Devenir rentable");
    expect(plan.etapes.map((e) => [e.titre, e.phase])).toEqual([["Préparer", true]]);
    expect(plan.etapes[0].sousEtapes[0].titre).toBe("Backtester");
    // La tâche existe déjà : elle se rattache, elle ne se duplique pas.
    expect(plan.etapes[0].sousEtapes[0].taches).toEqual([
      { titre: "50 setups", ref: { kind: "task", uid: "u-t10" } },
    ]);
  });
});

// ─── Les positions d'une carte d'objectif (2026-09-29) ───────────────────────

describe("les positions d'une carte d'objectif, dans un réglage", () => {
  it("la clé est par objectif, et elle n'est ni sous `layout.` ni un secret", async () => {
    const { clePositionsObjectif } = await import("./carte");
    const { settingSynchronisable } = await import("../sync/scope");
    const cle = clePositionsObjectif("3f2a9c1e-7b4d-4e0a-9c1f-0a1b2c3d4e5f");
    expect(cle).toBe("carte.objectif.3f2a9c1e-7b4d-4e0a-9c1f-0a1b2c3d4e5f");
    expect(settingSynchronisable(cle)).toBe(true);
  });

  it("aller-retour, clés triées ; une position illisible est ignorée, jamais une erreur", async () => {
    const { ecrirePositionsObjectif, lirePositionsObjectif } = await import("./carte");
    const c: Carte = {
      v: 1,
      noeuds: [
        { id: "r", parent: null, texte: "R", ref: { kind: "goal", uid: "g-0" } },
        { id: "b", parent: "r", texte: "B", ref: { kind: "task", uid: "t-2" }, pos: { x: 3, y: 4 } },
        { id: "a", parent: "r", texte: "A", ref: { kind: "goal", uid: "g-1" }, pos: { x: 1, y: 2 } },
        { id: "i", parent: "r", texte: "idée", pos: { x: 9, y: 9 } },
      ],
    };
    const brut = ecrirePositionsObjectif(c);
    expect(brut).toBe('{"v":1,"pos":{"goal:g-1":{"x":1,"y":2},"task:t-2":{"x":3,"y":4}}}');
    expect(lirePositionsObjectif(brut)).toEqual({ "goal:g-1": { x: 1, y: 2 }, "task:t-2": { x: 3, y: 4 } });
    expect(lirePositionsObjectif('{"pos":{"x":{"x":"loin","y":1}}}')).toEqual({});
    expect(lirePositionsObjectif("pas du json")).toEqual({});
    expect(lirePositionsObjectif(null)).toEqual({});
  });

  it("re-dériver garde les replis, les positions locales, et le nœud en saisie", async () => {
    const { fusionnerCarteObjectif } = await import("./carte");
    const derivee: Carte = {
      v: 1,
      noeuds: [
        { id: "r", parent: null, texte: "R" },
        { id: "g1", parent: "r", texte: "Renommée ailleurs" },
        { id: "g2", parent: "r", texte: "B", pos: { x: 0, y: 0 } },
      ],
    };
    const locale: Carte = {
      v: 1,
      noeuds: [
        { id: "r", parent: null, texte: "R" },
        { id: "g1", parent: "r", texte: "A", plie: true, pos: { x: 7, y: 7 } },
        { id: "g2", parent: "r", texte: "B" },
        { id: "n9", parent: "g1", texte: "en saisie" },
      ],
    };
    const f = fusionnerCarteObjectif(derivee, locale, "n9");
    expect(f.noeuds.find((n) => n.id === "g1")).toEqual({ id: "g1", parent: "r", texte: "Renommée ailleurs", plie: true, pos: { x: 7, y: 7 } });
    // « Réorganiser » localement a retiré la position : la locale gagne.
    expect(f.noeuds.find((n) => n.id === "g2")!.pos).toBeUndefined();
    expect(f.noeuds.find((n) => n.id === "n9")!.texte).toBe("en saisie");
    expect(fusionnerCarteObjectif(derivee, locale, null).noeuds.some((n) => n.id === "n9")).toBe(false);
  });
});
