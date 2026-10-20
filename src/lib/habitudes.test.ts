import { describe, expect, it } from "vitest";
import { addDays, todayStr } from "./logic";
import { COULEUR_HABITUDE_PAR_DEFAUT, HABIT_COLORS, JOURS_HISTORIQUE, derniersJours, serieHabitude } from "./habitudes";
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
  it("⚠️ les couleurs enregistrées en base restent proposées (PIEGES § 21.9)", () => {
    // Les six d'avant le 2026-10-20 : la palette peut grandir, jamais les perdre.
    for (const c of ["var(--color-green)", "var(--color-blue)", "var(--color-yellow)", "#a78bfa", "#fb923c", "#f472b6"]) {
      expect(HABIT_COLORS).toContain(c);
    }
    expect(HABIT_COLORS).toContain(COULEUR_HABITUDE_PAR_DEFAUT);
    expect(new Set(HABIT_COLORS).size).toBe(HABIT_COLORS.length);
  });
  it("le rouge du logo est dans la palette", () => {
    expect(HABIT_COLORS).toContain("#dc2626");
  });
});

// ── Les jours d'une ligne d'habitude ──
// Jusqu'au 2026-10-13 : quatorze au bureau, sept au téléphone, et ils se
// cochaient (constat 8 du labo). Depuis : quatorze partout, à lire seulement —
// la coche est celle du jour choisi dans la barre du Journal.
describe("derniersJours — ce qu'une ligne d'habitude montre", () => {
  const today = todayStr();

  it("quatorze jours, du plus ancien à aujourd'hui", () => {
    const jours = derniersJours(today);
    expect(jours).toHaveLength(JOURS_HISTORIQUE);
    expect(JOURS_HISTORIQUE).toBe(14);
    expect(jours[0]).toBe(addDays(today, -13));
    expect(jours[jours.length - 1]).toBe(today);
  });

  it("le nombre se demande : sept pour une carte étroite", () => {
    const jours = derniersJours(today, 7);
    expect(jours).toHaveLength(7);
    expect(jours[0]).toBe(addDays(today, -6));
    expect(jours[jours.length - 1]).toBe(today);
  });

  it("les jours se suivent, sans trou ni doublon — même à cheval sur deux mois", () => {
    // Le premier du mois courant : la ligne remonte alors dans le mois d'avant.
    const premier = `${today.slice(0, 8)}01`;
    const jours = derniersJours(premier);
    for (let i = 1; i < jours.length; i++) expect(jours[i]).toBe(addDays(jours[i - 1], 1));
    expect(new Set(jours).size).toBe(jours.length);
  });

  it("quatorze carrés de 14 px et leurs 3 px d'écart tiennent sous le nom, dans un téléphone de 390 pt", () => {
    // 390 pt, moins 16 pt de marge de page et 16 pt de marge de carte de chaque
    // côté, moins le retrait de 32 pt qui les aligne sur le nom.
    const largeurUtile = 390 - 2 * 16 - 2 * 16 - 32;
    expect(JOURS_HISTORIQUE * 14 + (JOURS_HISTORIQUE - 1) * 3).toBeLessThanOrEqual(largeurUtile);
  });
});
