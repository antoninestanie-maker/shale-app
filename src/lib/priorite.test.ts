/**
 * @vitest-environment happy-dom
 */
import { afterAll, describe, expect, it } from "vitest";
import { couleurPriorite, nomDePriorite, PRIORITES, prioriteDe, rangPriorite } from "./priorite";
import { setLangPref } from "./i18n";

/**
 * ⭐ LA PRIORITÉ — trois niveaux, un seul vocabulaire (2026-09-30).
 *
 * Antonin : « donner un ordre de priorité aux étapes et aux tâches dès la
 * création […] faible, moyenne, élevée […] pas un mode avancé avec un poids ».
 */
describe("prioriteDe — ce qu'une ligne dit, lu sans surprise", () => {
  it("les trois valeurs connues passent telles quelles", () => {
    for (const p of PRIORITES) expect(prioriteDe({ priority: p })).toBe(p);
  });

  it("⚠️ une valeur inconnue (appareil plus récent, synchronisation) se lit « moyenne »", () => {
    expect(prioriteDe({ priority: "urgent" })).toBe("medium");
    expect(prioriteDe({ priority: null })).toBe("medium");
    expect(prioriteDe({})).toBe("medium");
  });
});

describe("rangPriorite — l'élevée passe d'abord", () => {
  it("élevée < moyenne < faible, et l'inconnue se range avec la moyenne", () => {
    expect(rangPriorite("high")).toBeLessThan(rangPriorite("medium"));
    expect(rangPriorite("medium")).toBeLessThan(rangPriorite("low"));
    expect(rangPriorite("urgent")).toBe(rangPriorite("medium"));
  });
});

describe("PRIORITES — l'ordre d'un sélecteur : une échelle, de gauche à droite", () => {
  it("faible, moyenne, élevée", () => {
    expect([...PRIORITES]).toEqual(["low", "medium", "high"]);
  });
});

describe("couleurPriorite — la couleur du repère, la même partout", () => {
  it("rouge pour l'élevée, jaune pour la moyenne, rien pour la faible", () => {
    expect(couleurPriorite("high")).toBe("var(--color-red)");
    expect(couleurPriorite("medium")).toBe("var(--color-yellow)");
    expect(couleurPriorite("low")).toBeUndefined();
  });
});

describe("nomDePriorite — dans la langue de l'app", () => {
  afterAll(() => setLangPref("fr"));

  it("en français : les mots d'Antonin", () => {
    setLangPref("fr");
    expect(PRIORITES.map(nomDePriorite)).toEqual(["Faible", "Moyenne", "Élevée"]);
  });

  it("en anglais", () => {
    setLangPref("en");
    expect(PRIORITES.map(nomDePriorite)).toEqual(["Low", "Medium", "High"]);
  });
});
