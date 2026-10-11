// La grille et un panneau qui n'existe plus — voir l'en-tête de `grille.ts`.
import { describe, expect, it } from "vitest";

import { masquesConnus, ordreEffectif } from "./grille";

// Les panneaux d'Aujourd'hui tels que le code les rend après le 2026-10-11 :
// la jauge `energy` n'en fait plus partie.
const PRESENTS = ["perf", "discipline", "tasks", "timer", "calendar", "habitudes", "goals", "quicklinks"];

describe("ordreEffectif — un ordre enregistré qui porte encore `energy`", () => {
  // `order.today` tel qu'une version d'avant l'a écrit, jauge déplacée en tête.
  const ENREGISTRE = ["energy", "perf", "tasks", "discipline", "timer", "calendar", "habitudes", "goals", "quicklinks"];

  it("ne rend aucune place à la jauge", () => {
    expect(ordreEffectif(ENREGISTRE, PRESENTS)).not.toContain("energy");
  });

  it("⭐ garde l'ordre choisi pour tout le reste, sans trou ni doublon", () => {
    expect(ordreEffectif(ENREGISTRE, PRESENTS)).toEqual(ENREGISTRE.filter((id) => id !== "energy"));
  });

  it("vaut aussi quand la jauge était la seule chose enregistrée", () => {
    expect(ordreEffectif(["energy"], PRESENTS)).toEqual(PRESENTS);
  });

  it("vaut pour les Réglages, dont la section portait `settings-energy`", () => {
    const presents = ["settings-apparence", "settings-shortcuts"];
    expect(ordreEffectif(["settings-shortcuts", "settings-energy", "settings-apparence"], presents)).toEqual([
      "settings-shortcuts",
      "settings-apparence",
    ]);
  });

  it("sans ordre enregistré, c'est l'ordre du code", () => {
    expect(ordreEffectif([], PRESENTS)).toEqual(PRESENTS);
  });

  it("un panneau arrivé depuis l'enregistrement se range à la fin", () => {
    expect(ordreEffectif(["tasks", "perf"], ["perf", "tasks", "goals"])).toEqual(["tasks", "perf", "goals"]);
  });
});

describe("masquesConnus — `hidden.today` qui porte encore `energy`", () => {
  it("⭐ aucune pastille « + Énergie » : une carte disparue ne se rallume pas", () => {
    expect(masquesConnus(["energy"], PRESENTS)).toEqual([]);
  });

  it("les autres panneaux masqués restent proposés, dans leur ordre", () => {
    expect(masquesConnus(["goals", "energy", "timer"], PRESENTS)).toEqual(["goals", "timer"]);
  });

  it("un panneau masqué puis sorti de la grille (module coupé) n'est pas proposé non plus", () => {
    expect(masquesConnus(["position"], PRESENTS)).toEqual([]);
  });
});
