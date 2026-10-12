// La courbe d'amortissement de Dynamic Type. Fonction pure, donc testable —
// la MESURE, elle, dépend du moteur et ne s'éprouve qu'à l'écran (le § 1 bis
// d'AMELIORATIONS-UI.md dit comment, et ce qu'elle a rendu).
import { describe, expect, it } from "vitest";

import { defaultUiConfig, facteurDynamicType, mergeConfig } from "./uiConfig";

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

// 2026-10-07 — le graphique « 7 derniers jours » a laissé sa place aux
// habitudes à tenir. Une disposition enregistrée avant porte encore `week`.
describe("mergeConfig — le widget `week` devient `habitudes`", () => {
  const ids = (l: { id: string }[]) => l.map((w) => w.id);

  it("ne connaît plus `week` par défaut", () => {
    const d = defaultUiConfig();
    expect(ids([...d.dashTop, ...d.dashLeft, ...d.dashRight])).not.toContain("week");
    expect(ids(d.dashLeft)).toContain("habitudes");
  });

  it("le renomme À SA PLACE, et le rallume même s'il était masqué", () => {
    const c = mergeConfig({
      dashLeft: [
        { id: "timer", visible: true },
        { id: "week", visible: false },
        { id: "discipline", visible: true },
      ],
    });
    expect(ids(c.dashLeft).slice(0, 3)).toEqual(["timer", "habitudes", "discipline"]);
    expect(c.dashLeft[1].visible).toBe(true);
    expect(ids(c.dashLeft).filter((id) => id === "habitudes")).toHaveLength(1);
  });

  it("respecte un choix fait depuis : `habitudes` masqué le reste", () => {
    const c = mergeConfig({ dashLeft: [{ id: "habitudes", visible: false }] });
    expect(c.dashLeft.find((w) => w.id === "habitudes")?.visible).toBe(false);
  });
});

// 2026-10-11 — la jauge « Énergie restante » (`energy`) est retirée pour tout
// le monde. Une disposition enregistrée avant la porte encore dans `ui.config`.
describe("mergeConfig — le widget `energy` n'existe plus", () => {
  const ids = (l: { id: string }[]) => l.map((w) => w.id);

  it("n'est plus dans la disposition par défaut", () => {
    const d = defaultUiConfig();
    expect(ids([...d.dashTop, ...d.dashLeft, ...d.dashRight])).not.toContain("energy");
  });

  it("⭐ une disposition enregistrée qui le porte se charge sans lui, où qu'il soit", () => {
    const c = mergeConfig({
      dashTop: [
        { id: "energy", visible: true },
        { id: "perf", visible: true },
      ],
      dashLeft: [
        { id: "discipline", visible: true },
        { id: "energy", visible: true },
        { id: "timer", visible: true },
      ],
      dashRight: [
        { id: "tasks", visible: true },
        { id: "energy", visible: false },
      ],
    });
    expect(ids([...c.dashTop, ...c.dashLeft, ...c.dashRight])).not.toContain("energy");
  });

  it("ses voisins gardent leur ordre et leur visibilité : pas de trou, rien de rallumé", () => {
    const c = mergeConfig({
      dashLeft: [
        { id: "quicklinks", visible: true },
        { id: "energy", visible: true },
        { id: "timer", visible: false },
        { id: "discipline", visible: true },
      ],
    });
    expect(ids(c.dashLeft).slice(0, 3)).toEqual(["quicklinks", "timer", "discipline"]);
    expect(c.dashLeft.find((w) => w.id === "timer")?.visible).toBe(false);
  });

  it("aucun widget n'est rendu deux fois ni perdu en route", () => {
    const d = defaultUiConfig();
    const c = mergeConfig({ dashLeft: [{ id: "energy", visible: true }] });
    expect(ids(c.dashLeft).sort()).toEqual(ids(d.dashLeft).sort());
  });
});
