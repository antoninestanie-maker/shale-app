import { describe, expect, it } from "vitest";
import { ajouterEnfant, carteVide, poserReference, type Carte } from "../carte";
import { objectif } from "./objectif.testutil";
import { ancetreObjectif, CIBLE_HABITUDE_PAR_DEFAUT, objectifsAccueillants, planDirect, rangEnDernier } from "./typage";

/**
 *   racine « Lancer la chaîne » ─ cite l'OBJECTIF g-1
 *     ├── n1 cite la PHASE g-2 (une étape qui en contient d'autres)
 *     │    └── n2 cite l'ÉTAPE g-3
 *     │         └── n3 (idée)
 *     └── n4 (idée)
 *          └── n5 (idée)
 */
const goals = [
  objectif({ id: 1, uid: "g-1" }),
  objectif({ id: 2, uid: "g-2", parent_goal_id: 1, is_milestone: 1, position: 0 }),
  objectif({ id: 3, uid: "g-3", parent_goal_id: 2, position: 0 }),
  objectif({ id: 4, uid: "g-4", parent_goal_id: 2, position: 5 }),
  objectif({ id: 9, uid: "g-9" }), // un autre objectif
];

function carte(): Carte {
  let c = carteVide("Lancer la chaîne");
  c = poserReference(c, "r", { kind: "goal", uid: "g-1" }, "Lancer la chaîne", "objectif");
  c = ajouterEnfant(c, "r").carte; // n1
  c = ajouterEnfant(c, "n1").carte; // n2
  c = ajouterEnfant(c, "n2").carte; // n3
  c = ajouterEnfant(c, "r").carte; // n4
  c = ajouterEnfant(c, "n4").carte; // n5
  c = poserReference(c, "n1", { kind: "goal", uid: "g-2" }, "Tournage", "phase");
  c = poserReference(c, "n2", { kind: "goal", uid: "g-3" }, "Matériel", "sous-objectif");
  return c;
}

describe("le rattachement par la hiérarchie de la carte", () => {
  it("l'ancêtre-objectif est le PREMIER en remontant, le nœud lui-même exclu", () => {
    expect(ancetreObjectif(carte(), "n3", goals)!.id).toBe(3);
    expect(ancetreObjectif(carte(), "n2", goals)!.id).toBe(2);
    expect(ancetreObjectif(carte(), "n5", goals)!.id).toBe(1);
  });

  it("aucun ancêtre typé : rien", () => {
    const c = ajouterEnfant(carteVide("Idées"), "r").carte;
    expect(ancetreObjectif(c, "n1", goals)).toBeNull();
  });

  it("un ancêtre dont l'objectif a disparu ne compte pas", () => {
    expect(ancetreObjectif(carte(), "n3", goals.filter((g) => g.id !== 3))!.id).toBe(2);
  });

  it("une étape neuve naît en DERNIER rang, après la plus haute position", () => {
    expect(rangEnDernier(2, goals)).toBe(6);
    expect(rangEnDernier(9, goals)).toBe(0);
  });

  it("les objectifs proposés quand la carte ne dit rien : les objectifs et leurs étapes de premier niveau, pas le fond", () => {
    expect(objectifsAccueillants(goals).map((x) => [x.goal.id, x.niveau])).toEqual([[1, 0], [2, 1], [9, 0]]);
  });

  // ⚠️ RETIRÉS le 2026-10-12 : `planEtape`, `planHabitude`, `planTache` et
  // `genresPour` (cinq tests). Ils décrivaient le panneau d'annonce d'avant le
  // typage direct, que plus aucun écran n'appelait, et rendaient des GENRES
  // (« phase OU sous-objectif, au choix ») qui ne se choisissent plus. Ce
  // qu'ils gardaient est tenu par `planDirect`, juste dessous.
});

describe("le typage DIRECT au clic droit (retour d'Antonin, 2026-09-29)", () => {
  const libre = () => ajouterEnfant(carteVide("Idées"), "r").carte; // n1, aucun objectif au-dessus

  // ⚠️ MIS À JOUR EXPRÈS le 2026-10-12 : le menu proposait « Phase » ET
  // « Sous-objectif » (`planDirect(…, "phase")` remontait jusqu'à la racine,
  // `planDirect(…, "sous-objectif")` s'arrêtait à la phase). Il ne propose plus
  // qu'« Étape », et où elle va se déduit de la carte.
  it("une étape naît sous l'objectif au-dessus d'elle", () => {
    const p = planDirect(carte(), "n4", "etape", goals);
    expect(p).toMatchObject({ quoi: "etape", repli: null });
    expect(p.quoi === "etape" && p.parent.id).toBe(1);
  });

  it("sous une étape de premier niveau, elle naît sur place, sans repli (l'étape devient une phase)", () => {
    const p = planDirect(carte(), "n2", "etape", goals);
    expect(p).toMatchObject({ quoi: "etape", repli: null });
    expect(p.quoi === "etape" && p.parent.id).toBe(2);
  });

  it("⭐ sous une étape du FOND (niveau 2), elle va sous la phase au-dessus, et le plan le DIT", () => {
    const p = planDirect(carte(), "n3", "etape", goals);
    expect(p.quoi === "etape" && [p.parent.id, p.repli?.voulu.id, p.repli?.retenu.id]).toEqual([2, 3, 2]);
  });

  it("⭐ le genre STOCKÉ ne décide plus de rien : une étape de premier niveau non « phase » accueille aussi", () => {
    const sansGenre = goals.map((g) => ({ ...g, is_milestone: 0 }));
    const p = planDirect(carte(), "n2", "etape", sansGenre);
    expect(p.quoi === "etape" && p.parent.id).toBe(2);
  });

  it("une étape sans aucun objectif au-dessus est la seule question qui reste", () => {
    expect(planDirect(libre(), "n1", "etape", goals)).toEqual({ quoi: "choisir-objectif" });
  });

  it("une tâche se rattache au premier objectif au-dessus, sinon naît libre", () => {
    const p = planDirect(carte(), "n3", "tache", goals);
    expect(p.quoi === "tache" && p.goal?.id).toBe(3);
    expect(planDirect(libre(), "n1", "tache", goals)).toEqual({ quoi: "tache", goal: null });
  });

  it("une habitude se rattache avec une cible par défaut, sinon naît seule", () => {
    const p = planDirect(carte(), "n3", "habitude", goals);
    expect(p.quoi === "habitude" && [p.rattacher?.sous.id, p.rattacher?.voulu.id, p.rattacher?.cible]).toEqual([
      2,
      3,
      CIBLE_HABITUDE_PAR_DEFAUT,
    ]);
    expect(planDirect(libre(), "n1", "habitude", goals)).toEqual({ quoi: "habitude", rattacher: null });
  });
});
