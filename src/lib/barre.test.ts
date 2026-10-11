import { describe, expect, it } from "vitest";
import {
  LARGEUR_DEFAUT,
  LARGEUR_MAX,
  LARGEUR_MIN,
  PREF_DEFAUT,
  SEUIL_ETROIT,
  SEUIL_RAIL,
  auGlisser,
  basculer,
  bornerLargeur,
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
    expect(p).toEqual({ large: true, etroit: true, largeur: LARGEUR_DEFAUT });
    // Réduire en grand ne change rien à ce qu'on a choisi en étroit…
    const q = basculer(basculer(PREF_DEFAUT, "etroit"), "large");
    expect(q).toEqual({ large: true, etroit: false, largeur: LARGEUR_DEFAUT });
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
    expect(lirePref('{"large":true}')).toEqual({ large: true, etroit: true, largeur: LARGEUR_DEFAUT });
    expect(lirePref('{"large":"oui","etroit":false}')).toEqual({ large: false, etroit: false, largeur: LARGEUR_DEFAUT });
  });

  it("un choix d'avant la largeur réglable garde 232 ; une largeur folle est bornée", () => {
    expect(lirePref('{"large":false,"etroit":true}').largeur).toBe(LARGEUR_DEFAUT);
    expect(lirePref('{"largeur":300}').largeur).toBe(300);
    expect(lirePref('{"largeur":9999}').largeur).toBe(LARGEUR_MAX);
    expect(lirePref('{"largeur":3}').largeur).toBe(LARGEUR_MIN);
    for (const brut of ['{"largeur":"300"}', '{"largeur":null}', '{"largeur":1e999}'])
      expect(lirePref(brut).largeur).toBe(LARGEUR_DEFAUT);
  });

  it("le défaut rendu n'est jamais l'objet partagé", () => {
    const p = lirePref(null);
    p.large = true;
    expect(PREF_DEFAUT.large).toBe(false);
  });
});

describe("barre latérale — la largeur réglable", () => {
  it("reste entre ses bornes, en pixels entiers", () => {
    expect(bornerLargeur(10)).toBe(LARGEUR_MIN);
    expect(bornerLargeur(250.6)).toBe(251);
    expect(bornerLargeur(5000)).toBe(LARGEUR_MAX);
  });

  it("ne dépasse pas 45 % de la fenêtre, sans jamais passer sous le plancher", () => {
    expect(bornerLargeur(400, 800)).toBe(360);
    expect(bornerLargeur(400, 2000)).toBe(LARGEUR_MAX);
    // Fenêtre minuscule : le plancher tient (c'est le régime étroit qui réduira).
    expect(bornerLargeur(400, 300)).toBe(LARGEUR_MIN);
  });

  it("glisser sous le seuil réduit, et GARDE la largeur étendue", () => {
    const large = { ...PREF_DEFAUT, largeur: 300 };
    const p = auGlisser(large, "large", SEUIL_RAIL - 1);
    expect(p).toEqual({ large: true, etroit: true, largeur: 300 });
    // On rouvre par le bouton : la largeur choisie est toujours là.
    expect(basculer(p, "large").largeur).toBe(300);
  });

  it("glisser au-dessus du seuil étend, à la largeur du curseur bornée", () => {
    const reduite = { ...PREF_DEFAUT, large: true };
    expect(auGlisser(reduite, "large", SEUIL_RAIL)).toEqual({ large: false, etroit: true, largeur: LARGEUR_MIN });
    expect(auGlisser(reduite, "large", 287.4)).toEqual({ large: false, etroit: true, largeur: 287 });
    expect(auGlisser(reduite, "large", 900, 1000).largeur).toBe(LARGEUR_MAX);
    expect(auGlisser(reduite, "large", 900, 700).largeur).toBe(315);
  });

  it("ne touche que le régime courant, et rend le MÊME objet quand rien ne change", () => {
    expect(auGlisser(PREF_DEFAUT, "etroit", 260)).toEqual({ large: false, etroit: false, largeur: 260 });
    const p = { ...PREF_DEFAUT, largeur: 260 };
    expect(auGlisser(p, "large", 260.2)).toBe(p);
    const r = { ...PREF_DEFAUT, large: true };
    expect(auGlisser(r, "large", 20)).toBe(r);
  });

  it("le seuil est entre le rail et la largeur minimale", () => {
    expect(SEUIL_RAIL).toBeGreaterThan(64);
    expect(SEUIL_RAIL).toBeLessThan(LARGEUR_MIN);
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
