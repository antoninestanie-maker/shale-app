import { describe, expect, it } from "vitest";
import { addDays, todayStr } from "./logic";
import { HABIT_COLORS, JOURS_LIGNE_BUREAU, JOURS_LIGNE_TELEPHONE, joursDeLigne, serieHabitude } from "./habitudes";
import type { HabitCheck } from "./types";

const coche = (habit_id: number, date: string): HabitCheck => ({ id: 0, habit_id, date }) as HabitCheck;

describe("la série d'une habitude — le calcul du Journal, sorti tel quel", () => {
  it("compte les jours d'affilée jusqu'à aujourd'hui", () => {
    const c = ["2026-09-27", "2026-09-28", "2026-09-29"].map((d) => coche(1, d));
    expect(serieHabitude(1, c, "2026-09-29")).toBe(3);
  });
  it("aujourd'hui pas encore coché ne casse pas la série", () => {
    const c = ["2026-09-27", "2026-09-28"].map((d) => coche(1, d));
    expect(serieHabitude(1, c, "2026-09-29")).toBe(2);
  });
  it("un trou l'arrête", () => {
    const c = ["2026-09-25", "2026-09-27", "2026-09-28"].map((d) => coche(1, d));
    expect(serieHabitude(1, c, "2026-09-28")).toBe(2);
  });
  it("ne compte que SES coches", () => {
    const c = [coche(1, "2026-09-29"), coche(2, "2026-09-28")];
    expect(serieHabitude(1, c, "2026-09-29")).toBe(1);
  });
  it("⚠️ les couleurs enregistrées en base ne bougent pas (PIEGES § 21.9)", () => {
    expect(HABIT_COLORS).toEqual(["var(--color-green)", "var(--color-blue)", "var(--color-yellow)", "#a78bfa", "#fb923c", "#f472b6"]);
  });
});

// ── Les jours d'une ligne d'habitude (2026-10-12, crible du labo, constat 8) ──
describe("joursDeLigne — ce qu'une ligne du Journal laisse cocher", () => {
  const today = todayStr();

  it("au bureau : quatorze jours, du plus ancien à aujourd'hui", () => {
    const jours = joursDeLigne(today, false);
    expect(jours).toHaveLength(JOURS_LIGNE_BUREAU);
    expect(jours[0]).toBe(addDays(today, -13));
    expect(jours[jours.length - 1]).toBe(today);
  });

  it("⭐ au téléphone : sept jours — quatorze carrés écrasaient le nom de l'habitude", () => {
    const jours = joursDeLigne(today, true);
    expect(jours).toHaveLength(JOURS_LIGNE_TELEPHONE);
    expect(jours[0]).toBe(addDays(today, -6));
    expect(jours[jours.length - 1]).toBe(today);
  });

  it("les jours se suivent, sans trou ni doublon — même à cheval sur deux mois", () => {
    // Le premier du mois courant : la ligne remonte alors dans le mois d'avant.
    const premier = `${today.slice(0, 8)}01`;
    for (const telephone of [true, false]) {
      const jours = joursDeLigne(premier, telephone);
      for (let i = 1; i < jours.length; i++) expect(jours[i]).toBe(addDays(jours[i - 1], 1));
      expect(new Set(jours).size).toBe(jours.length);
    }
  });

  it("sept cases de 44 pt tiennent dans un téléphone de 390 pt ; quatorze non", () => {
    // 390 pt, moins 16 pt de marge de page et 16 pt de marge de carte de chaque côté.
    const largeurUtile = 390 - 2 * 16 - 2 * 16;
    expect(JOURS_LIGNE_TELEPHONE * 44).toBeLessThanOrEqual(largeurUtile);
    expect(JOURS_LIGNE_BUREAU * 44).toBeGreaterThan(largeurUtile);
  });
});
