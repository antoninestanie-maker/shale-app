import { describe, expect, it } from "vitest";
import { finEnregistree, horodatageLocal, lirePause, retenirPause } from "./duree";

/**
 * ⭐ La durée enregistrée d'une séance = le temps TRAVAILLÉ (lot 3 de l'audit du
 * 2026-10-20, temps-2). Toutes les lectures font `ended_at − started_at` :
 * c'est `ended_at` qui doit porter la vérité.
 */

const MIN = 60_000;
const DEBUT = new Date("2026-10-20T09:00:00").getTime();

describe("finEnregistree", () => {
  it("25 min de travail et 30 min de pause valent 25 min, pas 55", () => {
    // Pause de 30 min : le départ du compte à rebours est décalé d'autant.
    const fin = finEnregistree({
      debutReelMs: DEBUT,
      departMs: DEBUT + 30 * MIN,
      plannedMin: 25,
      pauseeA: null,
      maintenantMs: Infinity, // arrivée au bout
    });
    expect((fin - DEBUT) / MIN).toBe(25);
  });

  it("capot fermé pendant la séance, rouvert 2 h plus tard : la séance vaut sa durée prévue", () => {
    const fin = finEnregistree({
      debutReelMs: DEBUT,
      departMs: DEBUT,
      plannedMin: 25,
      pauseeA: null,
      maintenantMs: DEBUT + 120 * MIN,
    });
    expect((fin - DEBUT) / MIN).toBe(25);
  });

  it("« Terminer » à 10 min, après 5 min de pause : 10 min", () => {
    const fin = finEnregistree({
      debutReelMs: DEBUT,
      departMs: DEBUT + 5 * MIN,
      plannedMin: 25,
      pauseeA: null,
      maintenantMs: DEBUT + 15 * MIN,
    });
    expect((fin - DEBUT) / MIN).toBe(10);
  });

  it("« Terminer » pendant une pause : le temps de la pause en cours ne compte pas", () => {
    const fin = finEnregistree({
      debutReelMs: DEBUT,
      departMs: DEBUT,
      plannedMin: 25,
      pauseeA: DEBUT + 8 * MIN,
      maintenantMs: DEBUT + 40 * MIN,
    });
    expect((fin - DEBUT) / MIN).toBe(8);
  });

  it("jamais avant le début", () => {
    expect(finEnregistree({ debutReelMs: DEBUT, departMs: DEBUT, plannedMin: 25, pauseeA: null, maintenantMs: DEBUT - MIN })).toBe(DEBUT);
  });

  it("au format des colonnes de l'app", () => {
    expect(horodatageLocal(DEBUT + 25 * MIN)).toBe("2026-10-20 09:25:00");
  });
});

describe("la pause survit à un redémarrage", () => {
  const memoire = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
    };
  };

  it("relue pour la même séance, ignorée pour une autre", () => {
    const s = memoire();
    retenirPause({ id: 7, decalageMs: 30 * MIN, pauseeA: DEBUT + 50 * MIN }, s);
    expect(lirePause(7, s)).toEqual({ id: 7, decalageMs: 30 * MIN, pauseeA: DEBUT + 50 * MIN });
    expect(lirePause(8, s)).toBeNull();
  });

  it("effacée à la fin de la séance", () => {
    const s = memoire();
    retenirPause({ id: 7, decalageMs: 0, pauseeA: null }, s);
    retenirPause(null, s);
    expect(lirePause(7, s)).toBeNull();
  });

  it("un stockage illisible ou absent ne casse rien", () => {
    expect(lirePause(7, { getItem: () => "{pas du json" })).toBeNull();
    expect(lirePause(7, null)).toBeNull();
    expect(() =>
      retenirPause({ id: 1, decalageMs: 0, pauseeA: null }, {
        setItem: () => {
          throw new Error("quota");
        },
        removeItem: () => undefined,
      }),
    ).not.toThrow();
  });
});
