import { describe, expect, it } from "vitest";
import { reperesEntree, variablesEntree } from "./geometrie";

const marque = { x: 374, y: 260, taille: 52 };

describe("repères de la traversée", () => {
  it("pose la copie exactement sur l'originale", () => {
    const r = reperesEntree(marque, 800, 600, 4.5);
    expect([r.x, r.y, r.taille]).toEqual([374, 260, 52]);
    expect(r.cx).toBe(400);
    expect(r.cy).toBe(286);
  });

  it("⚠️ le cercle final couvre le coin le PLUS ÉLOIGNÉ, pas le centre de l'écran", () => {
    // La marque est au-dessus du milieu : les coins du bas sont les plus loin.
    // Une demi-diagonale d'écran laisserait un liseré du mur en bas.
    const r = reperesEntree(marque, 800, 600, 4.5);
    const coins: [number, number][] = [
      [0, 0],
      [800, 0],
      [0, 600],
      [800, 600],
    ];
    for (const [x, y] of coins) {
      expect(Math.hypot(x - r.cx, y - r.cy)).toBeLessThanOrEqual(r.r1);
    }
    const demiDiagonaleEcran = Math.hypot(800, 600) / 2;
    expect(r.r1).toBeGreaterThan(demiDiagonaleEcran);
  });

  it("couvre encore les coins quand la marque est dans un angle", () => {
    // Cas dégénéré, mais c'est celui qui casse : marque collée en haut à gauche.
    const r = reperesEntree({ x: 0, y: 0, taille: 52 }, 1400, 900, 4.5);
    expect(Math.hypot(1400 - r.cx, 900 - r.cy)).toBeLessThanOrEqual(r.r1);
  });

  it("l'ouverture démarre à l'intérieur de la plaque grossie, pas à zéro", () => {
    const r = reperesEntree(marque, 800, 600, 4.5);
    const demiPlaqueGrossie = (52 * 4.5) / 2;
    expect(r.r0).toBeGreaterThan(0);
    expect(r.r0).toBeLessThan(demiPlaqueGrossie);
  });

  it("rend des longueurs CSS, et une échelle sans unité", () => {
    const v = variablesEntree(reperesEntree(marque, 800, 600, 4.5));
    expect(v["--entree-cx"]).toBe("400px");
    expect(v["--entree-taille"]).toBe("52px");
    expect(v["--entree-echelle"]).toBe("4.5");
    // ⚠️ Une échelle avec « px » casserait `scale()` en silence : la marque ne
    // grossirait pas, et la traversée n'aurait plus rien à traverser.
    expect(v["--entree-echelle"]).not.toContain("px");
  });
});
