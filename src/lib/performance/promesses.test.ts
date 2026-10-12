import { describe, expect, it } from "vitest";
import { ressembleAUnSecret, settingExclu, settingSynchronisable } from "../sync/scope";
import { HEURES_MAX } from "./parObjectif";
import { CLE_PROMESSES, ecrirePromesses, lirePromesses, poserPromesse } from "./promesses";

describe("les heures promises — une clé de réglage, une carte uid → heures", () => {
  it("⚠️ la clé part en synchronisation : ni exclue, ni prise pour un secret", () => {
    // Exécuté, pas supposé : `settingSynchronisable` est la décision finale de la file d'envoi.
    expect(settingSynchronisable(CLE_PROMESSES)).toBe(true);
    expect(settingExclu(CLE_PROMESSES)).toBe(false);
    expect(ressembleAUnSecret(CLE_PROMESSES)).toBe(false);
  });

  it("la carte se relit telle qu'elle a été écrite", () => {
    const carte = new Map([["g-b", 2.5], ["g-a", 5]]);
    expect(lirePromesses(ecrirePromesses(carte))).toEqual(new Map([["g-a", 5], ["g-b", 2.5]]));
  });

  it("une même carte donne toujours la même chaîne, quel que soit l'ordre de saisie", () => {
    const a = ecrirePromesses(new Map([["g-b", 2.5], ["g-a", 5]]));
    const b = ecrirePromesses(new Map([["g-a", 5], ["g-b", 2.5]]));
    expect(a).toBe(b);
    expect(a).toBe('{"g-a":5,"g-b":2.5}');
  });

  it("⚠️ absente, vide ou illisible, elle se lit « aucune promesse » — jamais une erreur", () => {
    for (const brut of [null, undefined, "", "pas du json", "[]", '["g-a"]', '"g-a"', "42", "null"]) {
      expect(lirePromesses(brut).size).toBe(0);
    }
  });

  it("entrée par entrée : ce qui n'est pas un nombre d'heures positif est écarté, le reste est gardé", () => {
    const brut = JSON.stringify({ "g-a": 5, "g-b": 0, "g-c": -2, "g-d": "3", "g-e": null, "g-f": 400, "": 4, "g-g": 1.5 });
    expect(lirePromesses(brut)).toEqual(new Map([["g-a", 5], ["g-f", HEURES_MAX], ["g-g", 1.5]]));
  });

  it("poser une promesse, la changer, la retirer — sans toucher à la carte d'origine", () => {
    const vide = new Map<string, number>();
    const une = poserPromesse(vide, "g-a", 5);
    const changee = poserPromesse(une, "g-a", 8);
    const deux = poserPromesse(changee, "g-b", 2);
    const retiree = poserPromesse(deux, "g-a", 0);
    expect(vide.size).toBe(0);
    expect(une).toEqual(new Map([["g-a", 5]]));
    expect(changee).toEqual(new Map([["g-a", 8]]));
    expect(retiree).toEqual(new Map([["g-b", 2]]));
  });

  it("zéro, négatif ou pas un nombre : pas de promesse ; au-delà du plafond : le plafond", () => {
    const base = new Map([["g-a", 5]]);
    for (const h of [0, -1, Number.NaN]) expect(poserPromesse(base, "g-a", h).has("g-a")).toBe(false);
    expect(poserPromesse(base, "g-a", 500).get("g-a")).toBe(HEURES_MAX);
  });
});
