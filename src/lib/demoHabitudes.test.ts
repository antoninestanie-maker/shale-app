import { describe, expect, it } from "vitest";
import { JOURS_HABITUDES_DEMO, historiqueHabitudesDemo } from "./demoHabitudes";
import { addDays, weekdayOf } from "./logic";
import { pointsDAttention, tenueParHabitude } from "./performance/analyse";
import type { Habit, HabitCheck } from "./types";

/**
 * L'historique des habitudes de la démo doit avoir l'air VÉCU.
 *
 * Trois règles fixes le fabriquaient jusqu'au 2026-10-13, et le Journal
 * affichait un damier. Ce test ne juge pas l'esthétique : il tient ce qui a été
 * validé à l'image, et refuse le retour d'une règle périodique.
 */

// `today` est un paramètre : une date fixe ne vieillit pas.
const MARDI = "2026-10-13"; // le jour du tournage qui a validé les séries
const SEMAINE = [0, 1, 2, 3, 4, 5, 6].map((n) => addDays(MARDI, n));

const habits: Habit[] = [
  { id: 1, name: "Méditation", color: "#33d17a", archived: 0, is_example: 0 },
  { id: 2, name: "Sport", color: "#2e7ff2", archived: 0, is_example: 0 },
  { id: 3, name: "Lecture", color: "#f2b13d", archived: 0, is_example: 0 },
];

/** La série d'une habitude, du plus ancien jour à hier : « 1 » = tenue. */
function serie(today: string, id: number): string {
  const tenus = new Set(historiqueHabitudesDemo(today).filter((c) => c.habit_id === id).map((c) => c.date));
  let s = "";
  for (let i = JOURS_HABITUDES_DEMO; i >= 1; i--) s += tenus.has(addDays(today, -i)) ? "1" : "0";
  return s;
}

const coches = (today: string): HabitCheck[] => historiqueHabitudesDemo(today).map((c, i) => ({ id: i + 1, ...c }));

describe("l'historique des habitudes du jeu de démonstration", () => {
  it("⭐ un mardi, rend au caractère près les trois séries validées à l'image", () => {
    expect(weekdayOf(MARDI)).toBe(2);
    expect(serie(MARDI, 1)).toBe("010111101111111111111110111011111111111111011011111111011011");
    expect(serie(MARDI, 2)).toBe("000000100001110000001000110110001000111110000111110001100000");
    expect(serie(MARDI, 3)).toBe("001110110100001001010001001101111001001110101110110100110110");
  });

  it("ne coche ni aujourd'hui ni demain, et jamais deux fois le même jour", () => {
    for (const today of SEMAINE) {
      const h = historiqueHabitudesDemo(today);
      expect(h.every((c) => c.date < today && c.date >= addDays(today, -JOURS_HABITUDES_DEMO))).toBe(true);
      expect(new Set(h.map((c) => `${c.habit_id}|${c.date}`)).size).toBe(h.length);
    }
  });

  it("aucune série ne suit une règle : ni un jour sur deux, ni la même semaine répétée", () => {
    // Les trois anciennes règles se recopiaient à l'identique deux ou sept jours plus loin.
    const recopie = (s: string, pas: number) => [...s.slice(pas)].filter((c, k) => c === s[k]).length / (s.length - pas);
    for (const today of SEMAINE) {
      for (const h of habits) {
        const s = serie(today, h.id);
        // (0,9 et pas moins : la méditation, tenue presque tous les jours, se ressemble forcément à 0,77)
        expect(recopie(s, 2), `${h.name}, pas de 2, ${today}`).toBeLessThan(0.9);
        expect(recopie(s, 7), `${h.name}, pas de 7, ${today}`).toBeLessThan(0.9);
        expect(s).toMatch(/1/);
        expect(s).toMatch(/0/);
      }
    }
  });

  it("le week-end est plus faible que la semaine, quel que soit le jour où l'on ouvre la démo", () => {
    for (const today of SEMAINE) {
      const h = historiqueHabitudesDemo(today);
      const part = (weekEnd: boolean) => {
        let jours = 0;
        for (let i = 1; i <= JOURS_HABITUDES_DEMO; i++) {
          const wd = weekdayOf(addDays(today, -i));
          if ((wd === 0 || wd === 6) === weekEnd) jours++;
        }
        return h.filter((c) => (weekdayOf(c.date) === 0 || weekdayOf(c.date) === 6) === weekEnd).length / (jours * habits.length);
      };
      expect(part(true), today).toBeLessThan(part(false) - 0.1);
    }
  });

  it("Performance garde de quoi dire : le sport sous un jour sur deux, et le samedi qui décroche", () => {
    for (const today of SEMAINE) {
      const habitChecks = coches(today);
      const sport = tenueParHabitude(habits, habitChecks, today, 30).find((x) => x.habit.id === 2)!;
      expect(sport.pct, today).toBeGreaterThanOrEqual(40);
      expect(sport.pct, today).toBeLessThan(50);

      const points = pointsDAttention({ tasks: [], completions: [], habits, habitChecks, focusSessions: [], today, plage: 30 });
      expect(points, today).toContainEqual(expect.objectContaining({ genre: "habitude", habitId: 2 }));
      expect(points, today).toContainEqual(expect.objectContaining({ genre: "jour-faible", quoi: "habitudes", jour: 6 }));
    }
  });

  it("⭐ un mardi, Performance écrit les chiffres vus au tournage : 43 %, et le samedi à 42 % contre 63 %", () => {
    const points = pointsDAttention({ tasks: [], completions: [], habits, habitChecks: coches(MARDI), focusSessions: [], today: MARDI, plage: 30 });
    expect(points).toContainEqual(expect.objectContaining({ genre: "habitude", nom: "Sport", pct: 43 }));
    expect(points).toContainEqual({ genre: "jour-faible", quoi: "habitudes", jour: 6, pct: 42, moyenne: 63 });
  });
});
