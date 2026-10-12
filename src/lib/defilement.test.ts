import { describe, expect, it } from "vitest";
import { estEnVue, pointsDeControle } from "./defilement";

describe("les points sondés pour savoir si une ligne est entièrement à l'écran", () => {
  it("au milieu de la largeur, juste sous le haut et juste au-dessus du bas", () => {
    expect(pointsDeControle({ top: 100, bottom: 144, left: 20, right: 380 })).toEqual([
      { x: 200, y: 102 },
      { x: 200, y: 142 },
    ]);
  });

  it("une ligne très fine : les deux points restent DANS la ligne", () => {
    const [haut, bas] = pointsDeControle({ top: 10, bottom: 12, left: 0, right: 100 })!;
    expect(haut.y).toBeGreaterThan(10);
    expect(bas.y).toBeLessThan(12);
    expect(haut.y).toBeLessThanOrEqual(bas.y);
  });

  it("sans surface (élément sorti du flux), rien à sonder", () => {
    expect(pointsDeControle({ top: 0, bottom: 0, left: 0, right: 0 })).toBeNull();
    expect(pointsDeControle({ top: 10, bottom: 40, left: 5, right: 5 })).toBeNull();
  });
});

describe("estEnVue", () => {
  it("rien à regarder, ou pas de navigateur : non", () => {
    expect(estEnVue(null)).toBe(false);
    expect(estEnVue(undefined)).toBe(false);
  });
});
