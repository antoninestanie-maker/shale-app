import { describe, expect, it } from "vitest";
import { etatFil, filDObjectif } from "./fil";
import { objectif } from "./objectif.testutil";
import { estAcheve, mesurer } from "./progression";

const m = (pct: number | null) => ({ pct, fraction: pct == null ? null : pct / 100 });
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
  // ⚠️ RÈGLE RETOURNÉE le 2026-10-11. Ce test disait « atteint à 100 % — sauf
  // s'il reste une sous-étape vide » : une étape à 100 % qui portait une
  // sous-étape vide restait « en cours ». Une sous-étape vide compte maintenant
  // pour 0 : l'étape n'est PAS à 100 %, et le cas n'existe plus.
  it("atteint à 100 %, sans réserve", () => {
    expect(etatFil(m(100))).toBe("atteint");
  });
  it("⭐ une étape VIDE : « vide » tant qu'elle n'est pas cochée (0 %), « atteint » une fois cochée", () => {
    const g = objectif({ id: 1 });
    const vide = objectif({ id: 2, parent_goal_id: 1 });
    const cochee = objectif({ id: 3, parent_goal_id: 1, progress_pct: 100 });
    const s = { goals: [g, vide, cochee], tasks: [], completions: [], maintenant: "2026-09-15 10:00" };
    expect(etatFil(mesurer(vide, s))).toBe("vide");
    expect(etatFil(mesurer(cochee, s))).toBe("atteint");
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
    const mesures = new Map([[1, { pct: 140, fraction: 1.4 }], [2, { pct: 10, fraction: Number.NaN }]]);
    const f = filDObjectif({ etapes: [{ id: 1 }, { id: 2 }], mesures, directs: SANS, atteint: false });
    expect(f.troncons[0].part).toBe(1);
    expect(f.troncons[1].part).toBe(0);
  });

  it("⭐ trois étapes vides dont la première cochée : son tronçon est plein, l'orbe passe à la deuxième (2026-10-11)", () => {
    const g = objectif({ id: 10 });
    const lignes = [
      objectif({ id: 1, parent_goal_id: 10, position: 0, progress_pct: 100 }),
      objectif({ id: 2, parent_goal_id: 10, position: 1 }),
      objectif({ id: 3, parent_goal_id: 10, position: 2 }),
    ];
    const s = { goals: [g, ...lignes], tasks: [], completions: [], maintenant: "2026-09-15 10:00" };
    const mesures = new Map(lignes.map((l) => [l.id, mesurer(l, s)]));
    const racine = mesurer(g, s);
    expect(racine.pct).toBe(33);
    const f = filDObjectif({ etapes: lignes, mesures, directs: SANS, atteint: estAcheve(racine) });
    expect(f.troncons.slice(0, 3)).toEqual([
      { cle: "g1", etat: "atteint", part: 1 },
      { cle: "g2", etat: "vide", part: 0 },
      { cle: "g3", etat: "vide", part: 0 },
    ]);
    expect(f.courant).toBe("g2");
    // Avant le 2026-10-11, ces trois étapes n'avaient pas de mesure : trois
    // nœuds vides, et l'orbe restait sur la première pour toujours.
  });

  it("toutes cochées : l'objectif est atteint, plus d'orbe, l'arrivée s'allume", () => {
    const g = objectif({ id: 10 });
    const lignes = [1, 2].map((id) => objectif({ id, parent_goal_id: 10, progress_pct: 100 }));
    const s = { goals: [g, ...lignes], tasks: [], completions: [], maintenant: "2026-09-15 10:00" };
    const mesures = new Map(lignes.map((l) => [l.id, mesurer(l, s)]));
    const f = filDObjectif({ etapes: lignes, mesures, directs: SANS, atteint: estAcheve(mesurer(g, s)) });
    expect(f.courant).toBeNull();
    expect(f.troncons[f.troncons.length - 1].etat).toBe("atteint");
  });
});
