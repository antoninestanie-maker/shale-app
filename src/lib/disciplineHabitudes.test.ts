import { describe, expect, it } from "vitest";
import { addDays } from "./logic";
import { disciplineHabitudes } from "./disciplineHabitudes";
import type { Habit, HabitCheck } from "./types";

const AUJ = "2026-10-20";
const h = (id: number, extra: Partial<Habit> = {}): Habit => ({ id, name: `h${id}`, color: "", archived: 0, is_example: 0, ...extra });
let n = 0;
const c = (habit_id: number, date: string): HabitCheck => ({ id: ++n, habit_id, date });
const cocheesAuj = (checks: HabitCheck[]) => (id: number) => checks.some((x) => x.habit_id === id && x.date === AUJ);

describe("disciplineHabitudes — l'anneau de l'accueil", () => {
  it("aucune habitude : pas de pourcentage, série nulle", () => {
    expect(disciplineHabitudes([], [], AUJ, () => false)).toEqual({ tenues: 0, actives: 0, pct: null, serie: 0 });
  });

  it("compte les habitudes tenues aujourd'hui", () => {
    const checks = [c(1, AUJ)];
    const r = disciplineHabitudes([h(1), h(2), h(3)], checks, AUJ, cocheesAuj(checks));
    expect(r).toMatchObject({ tenues: 1, actives: 3, pct: 33 });
  });

  it("la coche affichée (optimiste) fait foi pour aujourd'hui", () => {
    const r = disciplineHabitudes([h(1)], [], AUJ, () => true);
    expect(r).toMatchObject({ tenues: 1, actives: 1, pct: 100, serie: 1 });
  });

  it("les exemples ne comptent pas", () => {
    const r = disciplineHabitudes([h(1, { is_example: 1 } as Partial<Habit>)], [], AUJ, () => true);
    expect(r.actives).toBe(0);
    expect(r.pct).toBeNull();
  });

  it("série : jours tenus à 75 % d'affilée, aujourd'hui compris s'il est tenu", () => {
    const checks = [1, 2, 3].map((k) => c(1, addDays(AUJ, -k)));
    expect(disciplineHabitudes([h(1)], checks, AUJ, () => false).serie).toBe(3);
    expect(disciplineHabitudes([h(1)], checks, AUJ, () => true).serie).toBe(4);
  });

  it("⭐ 3 habitudes sur 4 suffisent à tenir un jour (seuil 75 %)", () => {
    const hier = addDays(AUJ, -1);
    const checks = [c(1, hier), c(2, hier), c(3, hier)];
    const habits = [h(1), h(2), h(3), h(4)];
    // h4 compte depuis hier : cochée la veille d'avant ? non — on la fait débuter.
    checks.push(c(4, addDays(AUJ, -5)));
    expect(disciplineHabitudes(habits, checks, AUJ, () => false).serie).toBe(1);
  });

  it("2 habitudes sur 3 ne suffisent pas", () => {
    const hier = addDays(AUJ, -1);
    const checks = [c(1, hier), c(2, hier), c(3, addDays(AUJ, -5))];
    expect(disciplineHabitudes([h(1), h(2), h(3)], checks, AUJ, () => false).serie).toBe(0);
  });

  it("un jour manqué casse la série", () => {
    const checks = [c(1, addDays(AUJ, -1)), c(1, addDays(AUJ, -3))];
    expect(disciplineHabitudes([h(1)], checks, AUJ, () => false).serie).toBe(1);
  });
});
