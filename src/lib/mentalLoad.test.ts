import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppData } from "./types";

/**
 * La jauge « Énergie restante » — un réglage ABSENT doit rendre la valeur par
 * défaut, pas zéro.
 *
 * `getSetting()` rend `null` pour une clé qui n'existe pas (natif comme démo), et
 * `Number(null)` vaut 0. Jusqu'au 2026-10-09, une base sans réglage d'énergie
 * lisait donc des coûts nuls : la jauge affichait 100 % et « −0 % » quel que
 * soit le temps d'écran (constaté en mode démo, 4 h 26 d'écran).
 */

const reglages = new Map<string, string>();

vi.mock("./repo", () => ({
  getSetting: async (cle: string) => reglages.get(cle) ?? null,
  setSetting: async (cle: string, valeur: string) => {
    reglages.set(cle, valeur);
  },
}));

import {
  computeMentalLoad,
  getScreenMinutes,
  loadMentalLoadConfig,
  MENTAL_LOAD_DEFAULTS,
  saveMentalLoadConfig,
} from "./mentalLoad";

const SANS_TRADE = { trades: [] } as unknown as AppData;

beforeEach(() => {
  reglages.clear();
});

describe("loadMentalLoadConfig", () => {
  it("rend les valeurs par défaut quand aucun réglage n'est enregistré", async () => {
    expect(await loadMentalLoadConfig()).toEqual(MENTAL_LOAD_DEFAULTS);
  });

  it("rend les valeurs par défaut pour une chaîne vide ou blanche", async () => {
    reglages.set("energy_start", "");
    reglages.set("energy_cost_trade", "   ");
    reglages.set("energy_cost_hour", "");
    expect(await loadMentalLoadConfig()).toEqual(MENTAL_LOAD_DEFAULTS);
  });

  it("rend les valeurs par défaut pour une valeur illisible ou négative", async () => {
    reglages.set("energy_cost_trade", "abc");
    reglages.set("energy_cost_hour", "-5");
    expect(await loadMentalLoadConfig()).toEqual(MENTAL_LOAD_DEFAULTS);
  });

  it("garde un zéro CHOISI : « 0 » enregistré n'est pas un réglage absent", async () => {
    reglages.set("energy_cost_trade", "0");
    reglages.set("energy_cost_hour", "0");
    const cfg = await loadMentalLoadConfig();
    expect(cfg.costPerTrade).toBe(0);
    expect(cfg.costPerHour).toBe(0);
  });

  it("relit ce qui a été enregistré", async () => {
    const choisi = { startEnergy: 80, costPerTrade: 5, costPerHour: 12.5 };
    await saveMentalLoadConfig(choisi);
    expect(await loadMentalLoadConfig()).toEqual(choisi);
  });
});

describe("la jauge, sans réglage enregistré", () => {
  it("baisse avec le temps d'écran — 4 h 26 ne laissent pas 100 %", async () => {
    const cfg = await loadMentalLoadConfig();
    const charge = computeMentalLoad(SANS_TRADE, 266, cfg);
    // 266 min à 10 points par heure, sur 100 de départ.
    expect(charge.drainTime).toBeCloseTo(44.33, 2);
    expect(charge.energy).toBeCloseTo(55.67, 2);
  });
});

describe("getScreenMinutes", () => {
  it("vaut 0 un jour sans compteur", async () => {
    expect(await getScreenMinutes("2026-10-09")).toBe(0);
  });
});
