import { describe, expect, it } from "vitest";
import { ajouterEnfant, carteVide, poserReference, type Carte } from "../carte";
import { objectif } from "./objectif.testutil";
import {
  ancetreObjectif,
  CIBLE_HABITUDE_PAR_DEFAUT,
  genresPour,
  objectifsAccueillants,
  planDirect,
  planEtape,
  planHabitude,
  planTache,
  rangEnDernier,
} from "./typage";

/**
 *   racine « Lancer la chaîne » ─ cite l'OBJECTIF g-1
 *     ├── n1 cite la PHASE g-2
 *     │    └── n2 cite le SOUS-OBJECTIF g-3
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
    expect(planTache(c, "n1", goals).goal).toBeNull();
    expect(planHabitude(c, "n1", goals).propose).toBeNull();
    expect(planEtape(c, "n1", goals).parent).toBeNull();
  });

  it("un ancêtre dont l'objectif a disparu ne compte pas", () => {
    expect(ancetreObjectif(carte(), "n3", goals.filter((g) => g.id !== 3))!.id).toBe(2);
  });

  it("TÂCHE : sous le premier ancêtre-objectif, à n'importe quel niveau", () => {
    expect(planTache(carte(), "n3", goals).goal!.id).toBe(3);
  });

  it("ÉTAPE sous l'objectif : phase OU sous-objectif, au choix", () => {
    expect(planEtape(carte(), "n5", goals)).toEqual({ parent: goals[0], genres: ["jalon", "sous-objectif"], repli: null });
  });

  it("ÉTAPE sous une phase : sous-objectif seulement", () => {
    const p = planEtape(carte(), "n2", goals);
    expect(p.parent!.id).toBe(2);
    expect(p.genres).toEqual(["sous-objectif"]);
  });

  it("⭐ ÉTAPE sous un SOUS-OBJECTIF : elle va sous la phase au-dessus, et le plan le DIT", () => {
    const p = planEtape(carte(), "n3", goals);
    expect(p.parent!.id).toBe(2);
    expect(p.repli).toEqual({ voulu: goals[2], retenu: goals[1] });
  });

  it("HABITUDE : le rattachement est PROPOSÉ là où un sous-objectif peut naître", () => {
    expect(planHabitude(carte(), "n5", goals).propose!.sous.id).toBe(1);
    // sous un sous-objectif : sa phase
    expect(planHabitude(carte(), "n3", goals).propose).toEqual({ sous: goals[1], voulu: goals[2] });
  });

  it("une étape neuve naît en DERNIER rang, après la plus haute position", () => {
    expect(rangEnDernier(2, goals)).toBe(6);
    expect(rangEnDernier(9, goals)).toBe(0);
  });

  it("les objectifs proposés quand la carte ne dit rien : racines et phases, pas les sous-objectifs", () => {
    expect(objectifsAccueillants(goals).map((x) => [x.goal.id, x.niveau])).toEqual([[1, 0], [2, 1], [9, 0]]);
    expect(genresPour(goals[2], goals)).toEqual([]);
  });
});

describe("le typage DIRECT au clic droit (retour d'Antonin, 2026-09-29)", () => {
  const libre = () => ajouterEnfant(carteVide("Idées"), "r").carte; // n1, aucun objectif au-dessus

  it("une phase naît sous l'objectif racine au-dessus", () => {
    const p = planDirect(carte(), "n4", "phase", goals);
    expect(p).toMatchObject({ quoi: "etape", genre: "jalon", repli: null });
    expect(p.quoi === "etape" && p.parent.id).toBe(1);
  });

  it("sous un sous-objectif, une phase REMONTE jusqu'à la racine, et le dit", () => {
    const p = planDirect(carte(), "n3", "phase", goals);
    expect(p.quoi === "etape" && [p.parent.id, p.repli?.voulu.id, p.repli?.retenu.id]).toEqual([1, 3, 1]);
  });

  it("sous un sous-objectif, un sous-objectif va sous la phase au-dessus, et le dit", () => {
    const p = planDirect(carte(), "n3", "sous-objectif", goals);
    expect(p.quoi === "etape" && [p.genre, p.parent.id, p.repli?.retenu.id]).toEqual(["sous-objectif", 2, 2]);
  });

  it("sous une phase, un sous-objectif naît sur place, sans repli", () => {
    const p = planDirect(carte(), "n2", "sous-objectif", goals);
    expect(p).toMatchObject({ quoi: "etape", repli: null });
    expect(p.quoi === "etape" && p.parent.id).toBe(2);
  });

  it("une étape sans aucun objectif au-dessus est la seule question qui reste", () => {
    expect(planDirect(libre(), "n1", "phase", goals)).toEqual({ quoi: "choisir-objectif", genre: "jalon" });
    expect(planDirect(libre(), "n1", "sous-objectif", goals)).toEqual({ quoi: "choisir-objectif", genre: "sous-objectif" });
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
