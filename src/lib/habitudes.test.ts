import { describe, expect, it } from "vitest";
import { HABIT_COLORS, serieHabitude } from "./habitudes";
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
