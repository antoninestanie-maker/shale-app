import { describe, expect, it } from "vitest";
import { disciplineHabitudes } from "./disciplineHabitudes";
import { addDays } from "./logic";
import { habitude } from "./objectifs/objectif.testutil";
import { serieHabitudes, tenueParHabitude } from "./performance/analyse";
import type { HabitCheck } from "./types";

/**
 * ⭐ UNE HABITUDE COMPTE DEPUIS SA CRÉATION (migration 033 ; lot 3 de l'audit du
 * 2026-10-20, rythme-1 et rythme-2).
 */

let n = 0;
const coche = (habit_id: number, date: string): HabitCheck => ({ id: ++n, habit_id, date });
const joursDe = (debut: string, fin: string) => {
  const out: string[] = [];
  for (let d = debut; d <= fin; d = addDays(d, 1)) out.push(d);
  return out;
};
const tenue = (checks: HabitCheck[], jour: string) => (id: number) => checks.some((c) => c.habit_id === id && c.date === jour);

describe("rythme-1 — cocher un jour passé ne fait plus chuter l'historique", () => {
  const A = habitude({ id: 1, name: "A", created_at: "2026-10-01 08:00:00" });
  const B = habitude({ id: 2, name: "B", created_at: "2026-10-18 21:00:00" });
  const AUJ = "2026-10-20";
  const base = [
    ...joursDe("2026-10-01", "2026-10-20").map((d) => coche(1, d)),
    ...joursDe("2026-10-18", "2026-10-20").map((d) => coche(2, d)),
  ];

  it("le scénario de l'audit : B cochée après coup le 5 octobre — la série reste à 20 j", () => {
    const avant = disciplineHabitudes([A, B], base, AUJ, tenue(base, AUJ));
    const apres = [...base, coche(2, "2026-10-05")];
    const ensuite = disciplineHabitudes([A, B], apres, AUJ, tenue(apres, AUJ));
    expect(avant.serie).toBe(20);
    expect(ensuite.serie).toBe(20);
  });

  it("du 6 au 17 octobre, Performance reste à 100 % (avant : 50 %)", () => {
    const apres = [...base, coche(2, "2026-10-05")];
    const pts = serieHabitudes([A, B], apres, "2026-10-05", "2026-10-17", AUJ);
    expect(pts.every((p) => p.pct === 100)).toBe(true);
  });

  it("une coche d'avant la création compte en plus, ce jour-là seulement : elle ne peut que monter", () => {
    // Le 5 : A seule ne serait pas cochée → B cochée seule donne 1/2… sauf que A l'est. Prenons un jour où A manque.
    const sansA = base.filter((c) => !(c.habit_id === 1 && c.date === "2026-10-07"));
    const avant = serieHabitudes([A, B], sansA, "2026-10-07", "2026-10-07", AUJ)[0].pct;
    const apres = serieHabitudes([A, B], [...sansA, coche(2, "2026-10-07")], "2026-10-07", "2026-10-07", AUJ)[0].pct;
    expect(avant).toBe(0);
    expect(apres).toBe(50);
  });

  it("le détail par habitude suit la même règle", () => {
    const apres = [...base, coche(2, "2026-10-05")];
    const b = tenueParHabitude([A, B], apres, AUJ, 30).find((x) => x.habit.id === 2)!;
    // Les 18 et 19 (créée le 18), plus le 5 : trois jours comptés, trois tenus.
    expect([b.tenus, b.comptes, b.pct]).toEqual([3, 3, 100]);
  });
});

describe("rythme-2 — une habitude jamais cochée compte depuis sa création", () => {
  const nees = "2026-10-19 07:00:00";
  const habits = [
    habitude({ id: 1, name: "Sport", created_at: nees }),
    habitude({ id: 2, name: "Lecture", created_at: nees }),
    habitude({ id: 3, name: "Méditation", created_at: nees }),
    habitude({ id: 4, name: "Écriture", created_at: nees }),
  ];
  const sport = (jusqua: string) => joursDe("2026-10-19", jusqua).map((d) => coche(1, d));

  it("le soir à 25 %, la série ne monte pas à minuit (avant : 1, 2, puis 3 j)", () => {
    const soir19 = disciplineHabitudes(habits, sport("2026-10-19"), "2026-10-19", tenue(sport("2026-10-19"), "2026-10-19"));
    const soir20 = disciplineHabitudes(habits, sport("2026-10-20"), "2026-10-20", tenue(sport("2026-10-20"), "2026-10-20"));
    const matin21 = disciplineHabitudes(habits, sport("2026-10-20"), "2026-10-21", () => false);
    expect([soir19.pct, soir19.serie]).toEqual([25, 0]);
    expect([soir20.pct, soir20.serie]).toEqual([25, 0]);
    expect(matin21.serie).toBe(0);
  });

  it("le jour relu le lendemain dit ce que l'anneau disait le soir : 1/4", () => {
    const pts = serieHabitudes(habits, sport("2026-10-20"), "2026-10-19", "2026-10-20", "2026-10-21");
    expect(pts.map((p) => p.pct)).toEqual([25, 25]);
  });

  it("une habitude créée aujourd'hui ne réécrit pas le passé", () => {
    const vieille = habitude({ id: 9, name: "Vieille", created_at: "2026-09-01 08:00:00" });
    const neuve = habitude({ id: 10, name: "Neuve", created_at: "2026-10-21 18:00:00" });
    const checks = joursDe("2026-10-01", "2026-10-20").map((d) => coche(9, d));
    const pts = serieHabitudes([vieille, neuve], checks, "2026-10-01", "2026-10-20", "2026-10-21");
    expect(pts.every((p) => p.pct === 100)).toBe(true);
  });
});

describe("repli sans date de création (ligne d'avant la 033)", () => {
  it("la première coche, comme avant", () => {
    const h = habitude({ id: 1, created_at: null });
    const pts = serieHabitudes([h], [coche(1, "2026-10-10")], "2026-10-09", "2026-10-11", "2026-10-12");
    expect(pts.map((p) => p.pct)).toEqual([null, 100, 0]);
  });

  it("une date de création dans le futur vaut aujourd'hui", () => {
    const h = habitude({ id: 1, created_at: "2027-01-01 00:00:00" });
    const d = disciplineHabitudes([h], [], "2026-10-20", () => false);
    expect([d.actives, d.pct]).toEqual([1, 0]);
  });
});
