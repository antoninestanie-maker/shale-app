import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ecritureDifferee } from "./ecritureDifferee";

describe("écriture différée (savoir-7)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("une frappe par lettre, une SEULE écriture : la dernière valeur", async () => {
    const ecrits: string[] = [];
    const e = ecritureDifferee<string>(async (v) => void ecrits.push(v), 700);
    for (const v of ["B", "Bo", "Bon", "Bonj", "Bonjour"]) {
      e.planifier(v);
      await vi.advanceTimersByTimeAsync(100);
    }
    expect(ecrits).toEqual([]);
    await vi.advanceTimersByTimeAsync(700);
    expect(ecrits).toEqual(["Bonjour"]);
  });

  it("deux écritures ne se chevauchent jamais : la seconde attend la fin de la première", async () => {
    const journal: string[] = [];
    const e = ecritureDifferee<string>(async (v) => {
      journal.push(`début ${v}`);
      await new Promise((r) => setTimeout(r, 500));
      journal.push(`fin ${v}`);
    }, 100);
    e.planifier("a");
    await vi.advanceTimersByTimeAsync(150);
    e.planifier("ab");
    await vi.advanceTimersByTimeAsync(2000);
    expect(journal).toEqual(["début a", "fin a", "début ab", "fin ab"]);
  });

  it("vider fait partir ce qui attend, tout de suite — rien n'est perdu au démontage", async () => {
    const ecrits: string[] = [];
    const e = ecritureDifferee<string>(async (v) => void ecrits.push(v), 700);
    e.planifier("dernière frappe");
    await e.vider();
    expect(ecrits).toEqual(["dernière frappe"]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ecrits).toEqual(["dernière frappe"]);
  });
});
