import { describe, expect, it } from "vitest";
import { piedSerre } from "./barre";

/**
 * Constat 4 de l'audit du 2026-10-20 : à 1280×800, la liste des modules
 * débordait de 116 px sous un pied de cinq lignes et une horloge (mesuré dans
 * Chrome sur le build démo de `6b737fe`), sans rien qui le montre.
 */
describe("piedSerre", () => {
  it("⭐ la liste déborde : le pied se serre", () => {
    expect(piedSerre(false, { contenu: 425, visible: 309, gain: 0 })).toBe(true);
  });
  it("tout tient : le pied reste plein", () => {
    expect(piedSerre(false, { contenu: 409, visible: 409, gain: 0 })).toBe(false);
  });
  it("serré, il ne se rouvre que si la liste tiendrait AVEC le pied plein", () => {
    // 190 px rendus par le pied serré : 478 de contenu dans 520 → plein, il ne tiendrait plus.
    expect(piedSerre(true, { contenu: 478, visible: 520, gain: 190 })).toBe(true);
    // Fenêtre agrandie : 478 dans 700, même avec 190 px de pied en plus.
    expect(piedSerre(true, { contenu: 478, visible: 700, gain: 190 })).toBe(false);
  });
  it("pas de va-et-vient au pixel près", () => {
    expect(piedSerre(true, { contenu: 478, visible: 478 + 190 + 2, gain: 190 })).toBe(true);
  });
});
