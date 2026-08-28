// La courbe d'amortissement de Dynamic Type. Fonction pure, donc testable —
// la MESURE, elle, dépend du moteur et ne s'éprouve qu'à l'écran (le § 1 bis
// d'AMELIORATIONS-UI.md dit comment, et ce qu'elle a rendu).
import { describe, expect, it } from "vitest";

import { facteurDynamicType } from "./uiConfig";

describe("facteurDynamicType", () => {
  it("ne touche à rien quand la taille système est inconnue", () => {
    // Bureau, ou moteur qui ne connaît pas `-apple-system-body` : la densité
    // choisie par l'utilisateur doit rester seule maître.
    expect(facteurDynamicType(null)).toBe(1);
  });

  it("rend exactement 1 au réglage iOS par défaut", () => {
    // 17 px = « large ». Personne ne doit voir son interface bouger parce que
    // cette mécanique est arrivée.
    expect(facteurDynamicType(17)).toBe(1);
  });

  it("suit la direction du réglage, amorti de moitié", () => {
    // xxLarge = 21 px, soit ×1,235 demandé → ×1,118 appliqué.
    expect(facteurDynamicType(21)).toBeCloseTo(1.1176, 4);
    // xSmall = 14 px, soit ×0,824 demandé → ×0,912 appliqué.
    expect(facteurDynamicType(14)).toBeCloseTo(0.9118, 4);
  });

  it("plafonne les tailles d'accessibilité", () => {
    // ⚠️ Mesuré sur le simulateur : accessibility-XXXL rend 53 px, soit ×3,1.
    // Même amorti de moitié (×2,06), c'est plus qu'une interface dense ne peut
    // encaisser — et le `zoom` fait déborder les unités de viewport au-delà.
    expect(facteurDynamicType(53)).toBe(1.25);
    expect(facteurDynamicType(28)).toBe(1.25); // accessibility-medium, déjà ×1,32 amorti
  });

  it("plancher : on ne rétrécit pas indéfiniment", () => {
    expect(facteurDynamicType(1)).toBe(0.9);
  });

  it("une mesure absurde ne fabrique pas un facteur absurde", () => {
    // Le garde tient aux deux bouts, quoi que rende le moteur.
    expect(facteurDynamicType(1000)).toBe(1.25);
    expect(facteurDynamicType(0)).toBe(0.9);
  });
});
