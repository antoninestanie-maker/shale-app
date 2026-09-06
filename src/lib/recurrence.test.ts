import { describe, expect, it } from "vitest";
import {
  ORDRE_SEMAINE,
  nomCourtDuJour,
  occurrenceLe,
  parseRecurrence,
  serialiserRecurrence,
} from "./logic";

/**
 * Le VOCABULAIRE de récurrence, lu et écrit au même endroit.
 *
 * ⚠️ Ce fichier garde une promesse d'INTERFACE, pas de moteur : que les tâches
 * et les événements parlent la même langue. Elle s'est déjà rompue une fois —
 * le formulaire d'événement n'offrait que trois des quatre entrées, et avec
 * d'autres mots — sans qu'aucun test ne s'en aperçoive.
 */
describe("la grammaire de récurrence", () => {
  it("fait l'aller-retour sur les quatre modes", () => {
    for (const rec of ["none", "daily", "weekdays"]) {
      const { mode, jours } = parseRecurrence(rec);
      expect(serialiserRecurrence(mode, jours)).toBe(rec);
    }
    const { mode, jours } = parseRecurrence("[1,3,5]");
    expect(mode).toBe("custom");
    expect(jours).toEqual([1, 3, 5]);
    expect(serialiserRecurrence(mode, jours)).toBe("[1,3,5]");
  });

  it("⚠️ TRIE les jours choisis, pour que deux appareils écrivent la même chaîne", () => {
    // Sans le tri, cocher « ven, lun » ici et « lun, ven » là produirait deux
    // chaînes différentes pour la même règle, et la synchronisation les verrait
    // comme deux modifications qui se chassent l'une l'autre.
    expect(serialiserRecurrence("custom", [5, 1, 3])).toBe("[1,3,5]");
    expect(serialiserRecurrence("custom", [0, 6])).toBe("[0,6]");
  });

  it("traite une récurrence illisible comme ponctuelle, jamais comme une erreur", () => {
    // Une ligne écrite par une autre version de l'app ne doit pas bloquer un
    // formulaire.
    expect(parseRecurrence("{tous les mardis}")).toEqual({ mode: "none", jours: [] });
    expect(parseRecurrence(null)).toEqual({ mode: "none", jours: [] });
  });

  it("⭐ ce que le formulaire écrit, le MOTEUR sait le projeter", () => {
    // C'est le seul test qui relie les deux : une grammaire que `occurrenceLe`
    // ne saurait pas lire ferait disparaître l'événement du calendrier.
    const rec = serialiserRecurrence("custom", [3, 1]); // lundi et mercredi
    expect(occurrenceLe(rec, "2026-08-31", "2026-08-31")).toBe(true); // un lundi
    expect(occurrenceLe(rec, "2026-08-31", "2026-09-02")).toBe(true); // un mercredi
    expect(occurrenceLe(rec, "2026-08-31", "2026-09-01")).toBe(false); // un mardi
    // Rien n'a lieu avant la naissance de la série.
    expect(occurrenceLe(rec, "2026-08-31", "2026-08-24")).toBe(false);
  });
});

describe("les noms de jours", () => {
  it("⭐ viennent d'`Intl`, pas d'une table française", () => {
    // `DAY_SHORT` passe les DEUX outils i18n et s'affiche en français dans
    // l'app anglaise (PIEGES § 5.2 bis). Ce test tient la promesse à sa place.
    expect(nomCourtDuJour(0).toLowerCase()).toMatch(/^(dim|sun)/);
    expect(nomCourtDuJour(1).toLowerCase()).toMatch(/^(lun|mon)/);
    expect(nomCourtDuJour(6).toLowerCase()).toMatch(/^(sam|sat)/);
  });

  it("⚠️ l'ordre d'affichage commence le LUNDI, `getDay()` le dimanche", () => {
    expect([...ORDRE_SEMAINE]).toEqual([1, 2, 3, 4, 5, 6, 0]);
    // L'index passé à `nomCourtDuJour` EST celui de `getDay()` : c'est ce qui
    // permet de le comparer à `weekdayOf()` sans conversion.
    expect(new Date(1970, 0, 4, 12).getDay()).toBe(0);
  });
});
