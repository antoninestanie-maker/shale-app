import { describe, expect, it } from "vitest";
import { etatFil, filDObjectif } from "./fil";

const m = (pct: number | null, videsProfonds = 0) => ({ pct, fraction: pct == null ? null : pct / 100, videsProfonds });
const SANS = { presents: false, total: 0, faits: 0 };
const cles = (f: ReturnType<typeof filDObjectif>) => f.troncons.map((t) => t.cle);

describe("etatFil — l'état d'un nœud", () => {
  it("vide sans mesure, à « — » et à 0 %", () => {
    expect(etatFil(undefined)).toBe("vide");
    expect(etatFil(m(null))).toBe("vide");
    expect(etatFil(m(0))).toBe("vide");
  });
  it("en cours dès qu'il y a de l'avancement", () => {
    expect(etatFil(m(1))).toBe("cours");
    expect(etatFil(m(99))).toBe("cours");
  });
  it("atteint à 100 % — sauf s'il reste une sous-étape vide", () => {
    expect(etatFil(m(100))).toBe("atteint");
    expect(etatFil(m(100, 1))).toBe("cours");
  });
});

describe("filDObjectif — les tronçons, dans l'ordre de la page", () => {
  const etapes = [{ id: 1 }, { id: 2 }, { id: 3 }];

  it("un tronçon par étape, puis « ajouter » et l'arrivée", () => {
    const f = filDObjectif({ etapes, mesures: new Map(), directs: SANS, atteint: false });
    expect(cles(f)).toEqual(["g1", "g2", "g3", "ajout", "fin"]);
  });

  it("les éléments rattachés à l'objectif ont leur tronçon, après les étapes", () => {
    const f = filDObjectif({ etapes, mesures: new Map(), directs: { presents: true, total: 4, faits: 1 }, atteint: false });
    expect(cles(f)).toEqual(["g1", "g2", "g3", "directs", "ajout", "fin"]);
    expect(f.troncons[3]).toEqual({ cle: "directs", etat: "cours", part: 0.25 });
  });

  it("chaque tronçon porte la part de SON étape, pas l'avancement global", () => {
    const mesures = new Map([[1, m(100)], [2, m(40)], [3, m(null)]]);
    const f = filDObjectif({ etapes, mesures, directs: SANS, atteint: false });
    expect(f.troncons.slice(0, 3)).toEqual([
      { cle: "g1", etat: "atteint", part: 1 },
      { cle: "g2", etat: "cours", part: 0.4 },
      { cle: "g3", etat: "vide", part: 0 },
    ]);
  });

  it("l'orbe est sur la première étape non atteinte, dans l'ordre", () => {
    const f = filDObjectif({ etapes, mesures: new Map([[1, m(100)], [2, m(40)], [3, m(80)]]), directs: SANS, atteint: false });
    expect(f.courant).toBe("g2");
  });

  it("une étape finie APRÈS une étape en cours ne déplace pas l'orbe", () => {
    const f = filDObjectif({ etapes, mesures: new Map([[1, m(20)], [2, m(100)], [3, m(100)]]), directs: SANS, atteint: false });
    expect(f.courant).toBe("g1");
    expect(f.troncons[1].etat).toBe("atteint");
  });

  it("toutes les étapes atteintes : l'orbe passe aux éléments directs qui comptent", () => {
    const mesures = new Map([[1, m(100)], [2, m(100)], [3, m(100)]]);
    expect(filDObjectif({ etapes, mesures, directs: { presents: true, total: 2, faits: 1 }, atteint: false }).courant).toBe("directs");
    // Des éléments directs qui ne comptent pas (récurrentes, notes) ne portent jamais l'orbe.
    expect(filDObjectif({ etapes, mesures, directs: { presents: true, total: 0, faits: 0 }, atteint: false }).courant).toBeNull();
  });

  it("objectif atteint : plus d'orbe, l'arrivée s'allume, le fil est plein jusqu'au bout", () => {
    const mesures = new Map([[1, m(100)], [2, m(100)], [3, m(100)]]);
    const f = filDObjectif({ etapes, mesures, directs: { presents: true, total: 0, faits: 0 }, atteint: true });
    expect(f.courant).toBeNull();
    expect(f.troncons[f.troncons.length - 1]).toEqual({ cle: "fin", etat: "atteint", part: 0 });
    expect(f.troncons.find((t) => t.cle === "ajout")?.part).toBe(1);
    expect(f.troncons.find((t) => t.cle === "directs")).toEqual({ cle: "directs", etat: "atteint", part: 1 });
  });

  it("une part hors bornes ou illisible ne déborde jamais du tronçon", () => {
    const mesures = new Map([[1, { pct: 140, fraction: 1.4, videsProfonds: 0 }], [2, { pct: 10, fraction: Number.NaN, videsProfonds: 0 }]]);
    const f = filDObjectif({ etapes: [{ id: 1 }, { id: 2 }], mesures, directs: SANS, atteint: false });
    expect(f.troncons[0].part).toBe(1);
    expect(f.troncons[1].part).toBe(0);
  });
});
