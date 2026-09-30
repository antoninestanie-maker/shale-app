import { describe, expect, it } from "vitest";

import { ajouterEnfant, carteVide, poserReference, type Carte } from "../carte";
import { compteEmportable, objetsDesCartes, objetsEmportes, resoudreEmportes } from "./emportes";
import { habitude, objectif, tache } from "./objectif.testutil";

/**
 * Supprimer un nœud typé emporte son objet (retour d'Antonin, 2026-09-29).
 *
 *   r « Plan » (idée)
 *     ├── n1 TÂCHE t-1
 *     │    └── n2 SOUS-OBJECTIF g-3
 *     ├── n3 cite la NOTE note-1
 *     ├── n4 cite l'OBJECTIF RACINE g-1
 *     ├── n5 HABITUDE h-1        (g-5 est l'étape qui la compte)
 *     └── n6 PHASE g-2
 *          └── n7 SOUS-OBJECTIF g-4 (enfant de g-2 dans la feuille de route)
 */
const goals = [
  objectif({ id: 1, uid: "g-1" }),
  objectif({ id: 2, uid: "g-2", parent_goal_id: 1, is_milestone: 1 }),
  objectif({ id: 3, uid: "g-3", parent_goal_id: 1 }),
  objectif({ id: 4, uid: "g-4", parent_goal_id: 2 }),
  objectif({ id: 5, uid: "g-5", parent_goal_id: 1, count_source: "habit", count_ref_uid: "h-1", target_count: 30 }),
];

function carte(): Carte {
  let c = carteVide("Plan");
  c = ajouterEnfant(c, "r").carte; // n1
  c = ajouterEnfant(c, "n1").carte; // n2
  for (let i = 0; i < 4; i++) c = ajouterEnfant(c, "r").carte; // n3 … n6
  c = ajouterEnfant(c, "n6").carte; // n7
  c = poserReference(c, "n1", { kind: "task", uid: "t-1" }, "Tâche");
  c = poserReference(c, "n2", { kind: "goal", uid: "g-3" }, "Sous-objectif", "sous-objectif");
  c = poserReference(c, "n3", { kind: "note", uid: "note-1" }, "Une note");
  c = poserReference(c, "n4", { kind: "goal", uid: "g-1" }, "L'objectif", "objectif");
  c = poserReference(c, "n5", { kind: "habit", uid: "h-1" }, "Méditer");
  c = poserReference(c, "n6", { kind: "goal", uid: "g-2" }, "Phase", "phase");
  c = poserReference(c, "n7", { kind: "goal", uid: "g-4" }, "Sous la phase", "sous-objectif");
  return c;
}

describe("objetsEmportes", () => {
  it("une tâche part avec son nœud, et l'étape qui pend dessous aussi", () => {
    expect(objetsEmportes(carte(), "n1", goals)).toEqual([
      { kind: "task", uid: "t-1" },
      { kind: "goal", uid: "g-3" },
    ]);
  });

  it("une note citée ne part jamais — on ne détruit pas une ressource parce qu'on l'a citée", () => {
    expect(objetsEmportes(carte(), "n3", goals)).toEqual([]);
  });

  it("un objectif RACINE cité ne part jamais : ce n'est pas un morceau d'objectif", () => {
    expect(objetsEmportes(carte(), "n4", goals)).toEqual([]);
  });

  it("une habitude part avec l'étape qui la comptait — sinon elle resterait, « source introuvable »", () => {
    expect(objetsEmportes(carte(), "n5", goals)).toEqual([
      { kind: "habit", uid: "h-1" },
      { kind: "goal", uid: "g-5" },
    ]);
  });

  it("une phase et son sous-objectif : un seul lot — la corbeille emporte l'enfant avec le parent", () => {
    expect(objetsEmportes(carte(), "n6", goals)).toEqual([{ kind: "goal", uid: "g-2" }]);
  });

  it("toute la carte sous la racine : chaque objet une fois, jamais l'objectif racine ni la note", () => {
    const tout = objetsEmportes(carte(), "r", goals);
    expect(tout.map((o) => o.uid).sort()).toEqual(["g-2", "g-3", "g-5", "h-1", "t-1"]);
  });

  it("un nœud dont l'objet a déjà disparu (mort) n'emporte rien", () => {
    const c = carte();
    const mort = { ...c, noeuds: c.noeuds.map((n) => (n.id === "n1" ? { ...n, mort: true } : n)) };
    expect(objetsEmportes(mort, "n1", goals)).toEqual([{ kind: "goal", uid: "g-3" }]);
  });
});

/**
 * Une carte qui disparaît EN ENTIER — sa note supprimée, ou « Supprimer la
 * carte » sur son bloc (demande d'Antonin, 2026-09-30 : « si une carte mentale
 * liée à un objectif est supprimée, les tâches liées le soient aussi »).
 */
describe("objetsDesCartes", () => {
  it("emporte ce que sa racine emporterait — jamais l'objectif racine cité, jamais la note", () => {
    const tout = objetsDesCartes([carte()], goals);
    expect(tout).toEqual(objetsEmportes(carte(), "r", goals));
    expect(tout.map((o) => o.uid)).not.toContain("g-1");
    expect(tout.map((o) => o.uid)).not.toContain("note-1");
  });

  it("deux cartes qui citent la même tâche ne l'emportent qu'une fois", () => {
    const tout = objetsDesCartes([carte(), carte()], goals);
    expect(tout.filter((o) => o.uid === "t-1")).toHaveLength(1);
  });

  it("une étape dont l'ANCÊTRE part avec une autre carte n'est pas jetée deux fois", () => {
    let seule = carteVide("Sous la phase");
    seule = poserReference(seule, "r", { kind: "goal", uid: "g-4" }, "Sous la phase", "sous-objectif");
    let phase = carteVide("Phase");
    phase = poserReference(phase, "r", { kind: "goal", uid: "g-2" }, "Phase", "phase");
    expect(objetsDesCartes([seule, phase], goals)).toEqual([{ kind: "goal", uid: "g-2" }]);
  });

  it("une carte d'idées seules n'emporte rien", () => {
    let c = carteVide("Idées");
    c = ajouterEnfant(c, "r").carte;
    expect(objetsDesCartes([c], goals)).toEqual([]);
  });
});

describe("compteEmportable — ce que la confirmation annonce, lu dans la carte seule", () => {
  it("compte les tâches, habitudes et étapes ; pas l'objectif racine cité, pas la note", () => {
    // t-1, g-3, h-1, g-2, g-4 — g-1 (objectif) et note-1 n'en sont pas.
    expect(compteEmportable(carte())).toBe(5);
  });

  it("ignore un nœud mort : son objet n'existe plus", () => {
    const c = carte();
    const mort = { ...c, noeuds: c.noeuds.map((n) => (n.id === "n1" ? { ...n, mort: true } : n)) };
    expect(compteEmportable(mort)).toBe(4);
  });

  it("une carte d'idées ne compte rien", () => {
    expect(compteEmportable(carteVide("Idées"))).toBe(0);
  });
});

describe("resoudreEmportes — des uid aux lignes que la corbeille attend", () => {
  it("rend le numéro local et le titre, et oublie un objet qui n'existe plus", () => {
    const data = {
      goals: [objectif({ id: 2, uid: "g-2", title: "Phase" })],
      tasks: [tache({ id: 7, uid: "t-1", label: "Appeler" })],
      habits: [habitude({ id: 3, uid: "h-1", name: "Méditer" })],
    };
    expect(
      resoudreEmportes(
        [
          { kind: "task", uid: "t-1" },
          { kind: "goal", uid: "g-2" },
          { kind: "habit", uid: "h-1" },
          { kind: "task", uid: "t-disparue" },
        ],
        data,
      ),
    ).toEqual([
      { kind: "task", id: 7, titre: "Appeler" },
      { kind: "goal", id: 2, titre: "Phase" },
      { kind: "habit", id: 3, titre: "Méditer" },
    ]);
  });
});
