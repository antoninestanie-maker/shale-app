import { describe, expect, it } from "vitest";
import {
  PREF_DEFAUT,
  SEUIL_ETROIT,
  basculer,
  estReduite,
  lireCategories,
  lirePref,
  memesCategories,
  regimeDe,
} from "./barre";

describe("barre latérale — le régime", () => {
  it("est étroit sous le seuil, large à partir du seuil", () => {
    expect(regimeDe(SEUIL_ETROIT - 1)).toBe("etroit");
    expect(regimeDe(SEUIL_ETROIT)).toBe("large");
    expect(regimeDe(1470)).toBe("large");
  });

  it("se lit en pixels LOCAUX : la même fenêtre change de régime avec la densité", () => {
    const fenetre = 1100;
    expect(regimeDe(fenetre / 1)).toBe("large");
    expect(regimeDe(fenetre / 1.2)).toBe("etroit");
  });
});

describe("barre latérale — le choix par régime", () => {
  it("par défaut : étendue en large, réduite en étroit (le comportement d'avant)", () => {
    expect(estReduite(PREF_DEFAUT, "large")).toBe(false);
    expect(estReduite(PREF_DEFAUT, "etroit")).toBe(true);
  });

  it("basculer ne retourne que le régime courant", () => {
    const p = basculer(PREF_DEFAUT, "large");
    expect(p).toEqual({ large: true, etroit: true });
    // Réduire en grand ne change rien à ce qu'on a choisi en étroit…
    const q = basculer(basculer(PREF_DEFAUT, "etroit"), "large");
    expect(q).toEqual({ large: true, etroit: false });
    // …et deux bascules rendent l'état de départ.
    expect(basculer(basculer(PREF_DEFAUT, "large"), "large")).toEqual(PREF_DEFAUT);
  });

  it("ne modifie pas l'objet reçu", () => {
    const avant = { ...PREF_DEFAUT };
    basculer(PREF_DEFAUT, "large");
    expect(PREF_DEFAUT).toEqual(avant);
  });
});

describe("barre latérale — lecture du stockage", () => {
  it("rend le défaut sur une valeur absente, illisible ou d'une autre forme", () => {
    for (const brut of [null, undefined, "", "{", "null", "42", '"oui"', "[]"])
      expect(lirePref(brut)).toEqual(PREF_DEFAUT);
  });

  it("garde ce qui est lisible et complète le reste", () => {
    expect(lirePref('{"large":true}')).toEqual({ large: true, etroit: true });
    expect(lirePref('{"large":"oui","etroit":false}')).toEqual({ large: false, etroit: false });
  });

  it("le défaut rendu n'est jamais l'objet partagé", () => {
    const p = lirePref(null);
    p.large = true;
    expect(PREF_DEFAUT.large).toBe(false);
  });
});

describe("barre latérale — miroir des catégories", () => {
  it("rend null sans miroir lisible : on attend alors la base", () => {
    for (const brut of [null, "", "{", "[]", "3"]) expect(lireCategories(brut)).toBeNull();
  });

  it("ne garde que les booléens", () => {
    expect(lireCategories('{"decider":false,"penser":true,"x":"oui"}')).toEqual({ decider: false, penser: true });
  });

  it("compare deux états sans tenir compte des clés absentes (absent = déplié)", () => {
    expect(memesCategories({ a: false }, {})).toBe(true);
    expect(memesCategories({ a: true }, {})).toBe(false);
    expect(memesCategories(null, null)).toBe(true);
    expect(memesCategories(null, {})).toBe(false);
  });
});
