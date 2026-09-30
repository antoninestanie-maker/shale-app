import { beforeAll, describe, expect, it, vi } from "vitest";

import { objectif } from "./objectif.testutil";
import type { Mesure } from "./progression";

type Libelles = typeof import("./libelles");
let aideDeGenre: Libelles["aideDeGenre"];
let nomDeGenre: Libelles["nomDeGenre"];
let deplacer: Libelles["deplacer"];
let deplieParDefaut: Libelles["deplieParDefaut"];
let indexDInsertion: Libelles["indexDInsertion"];
let lireReplis: Libelles["lireReplis"];
let origineEnClair: Libelles["origineEnClair"];
let pourquoiVide: Libelles["pourquoiVide"];

/**
 * La langue se fixe À L'IMPORT du module d'i18n, depuis `navigator.language` :
 * on pose donc le navigateur AVANT d'importer — même montage que
 * `notifications.test.ts`. Sans lui, la suite passe ou casse selon la langue
 * de la machine qui la lance.
 */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ aideDeGenre, deplacer, deplieParDefaut, indexDInsertion, lireReplis, nomDeGenre, origineEnClair, pourquoiVide } =
    await import("./libelles"));
});

const mesure = (p: Partial<Mesure>): Mesure => ({
  pct: null,
  fraction: null,
  origine: { type: "vide", raison: "rien-a-mesurer" },
  vides: 0,
  videsProfonds: 0,
  ressources: [],
  nonComptes: [],
  ...p,
});

describe("chaque ligne dit d'où vient son pourcentage", () => {
  it("une cible chiffrée : « 12/50 backtests »", () => {
    const m = mesure({ pct: 24, origine: { type: "cible", compte: 12, cible: 50, unite: "backtests", source: "manual" } });
    expect(origineEnClair(m)).toBe("12/50 backtests");
  });

  it("une cible sans unité reste lisible", () => {
    expect(origineEnClair(mesure({ pct: 50, origine: { type: "cible", compte: 2, cible: 4, unite: "  ", source: "manual" } }))).toBe("2/4");
  });

  it("des éléments : « 3/7 éléments », au singulier quand il le faut", () => {
    const f = (faits: number, total: number) =>
      origineEnClair(mesure({ pct: 0, origine: { type: "feuille", elementsFaits: faits, elementsTotal: total, etapesComptees: 0 } }));
    expect(f(3, 7)).toBe("3/7 éléments");
    expect(f(0, 1)).toBe("0/1 élément");
  });

  it("⭐ des étapes et des éléments se lisent ensemble — les vides se TAISENT (2026-09-30)", () => {
    // Antonin : « vide, non compté, ça ne sert à rien ». Disait « … · 2 vides, non comptées ».
    const m = mesure({ pct: 60, vides: 2, origine: { type: "feuille", elementsFaits: 1, elementsTotal: 2, etapesComptees: 3 } });
    expect(origineEnClair(m)).toBe("3 étapes · 1/2 éléments");
  });

  it("le manuel se dit manuel", () => {
    expect(origineEnClair(mesure({ pct: 45, origine: { type: "manuel" } }))).toBe("saisi à la main");
  });

  it("⭐ une étape vide ne dit RIEN sur sa ligne ; le pourquoi attend dans la bulle", () => {
    const m = mesure({});
    expect(origineEnClair(m)).toBe("");
    expect(pourquoiVide(m, true)).toMatch(/Ajoute-lui un sous-objectif/);
    expect(pourquoiVide(m, false)).toMatch(/Rattache une tâche/);
  });

  it("un chiffre mesuré n'a pas de « pourquoi vide »", () => {
    expect(pourquoiVide(mesure({ pct: 10, origine: { type: "manuel" } }), false)).toBeNull();
  });

  it("chaque raison de vide a sa phrase — dans la bulle", () => {
    for (const raison of ["cible-nulle", "source-introuvable", "etapes-vides", "rien-a-mesurer"] as const) {
      expect(pourquoiVide(mesure({ origine: { type: "vide", raison } }), false)).not.toBeNull();
    }
  });

  it("⚠️ une PANNE reste dite sur la ligne : une source supprimée n'est pas une étape vide", () => {
    expect(origineEnClair(mesure({ origine: { type: "vide", raison: "source-introuvable" } }))).toBe("source introuvable");
    expect(origineEnClair(mesure({ origine: { type: "vide", raison: "cible-nulle" } }))).toBe("cible à zéro");
    expect(origineEnClair(mesure({ origine: { type: "vide", raison: "etapes-vides" } }))).toBe("");
  });
});

/**
 * ⭐ LE MOT « JALON » A ÉTÉ REMPLACÉ PAR « PHASE » LE 2026-09-20 (demande
 * d'Antonin : « le nom de jalon n'est peut-être pas assez parlant »). Le
 * pourquoi est au-dessus de `GenreEtape`, dans `structure.ts`.
 *
 * Ce test verrouille les deux choses qui comptent : que l'identifiant de code
 * n'ait PAS bougé (il est une clé, pas du texte — et la colonne `is_milestone`
 * encore moins), et que le mot affiché soit accompagné de son explication.
 * Une étiquette sans explication ne fait que déplacer la question.
 */
describe("le vocabulaire d'une étape", () => {
  it("« jalon » s'affiche « Phase », et le sous-objectif garde son nom", () => {
    expect(nomDeGenre("jalon")).toBe("Phase");
    expect(nomDeGenre("sous-objectif")).toBe("Sous-objectif");
  });

  it("chaque genre dit à quoi il sert", () => {
    expect(aideDeGenre("jalon")).toMatch(/regroupe/);
    expect(aideDeGenre("sous-objectif")).toMatch(/atteindre/);
    expect(aideDeGenre("jalon")).not.toBe(aideDeGenre("sous-objectif"));
  });
});

describe("repliement par défaut : la phase en cours seule est ouverte", () => {
  const jalons = [1, 2, 3, 4, 5, 6].map((id) => objectif({ id, is_milestone: 1 }));
  const acheve = (id: number) => id <= 4;

  it("six phases dont quatre finies : seule la cinquième est dépliée", () => {
    expect(jalons.map((j) => deplieParDefaut(j, jalons, acheve))).toEqual([false, false, false, false, true, false]);
  });

  it("un jalon vide après des jalons finis est « en cours » : c'est lui qu'il faut remplir", () => {
    // Un jalon vide n'est pas achevé : c'est le premier à remplir.
    expect(jalons.map((j) => deplieParDefaut(j, jalons, (id) => id <= 4))).toEqual([false, false, false, false, true, false]);
  });

  it("un sous-objectif ne déplie jamais son détail seul", () => {
    const s = objectif({ id: 9, is_milestone: 0 });
    expect(deplieParDefaut(s, [s], () => false)).toBe(false);
  });

  it("le réglage mémorisé se relit sans planter sur une valeur abîmée", () => {
    expect(lireReplis('{"g1":true,"g2":false,"g3":"oui"}')).toEqual({ g1: true, g2: false });
    expect(lireReplis("pas du json")).toEqual({});
    expect(lireReplis("[1,2]")).toEqual({});
    expect(lireReplis(null)).toEqual({});
  });
});

describe("réordonner", () => {
  it("déplacer vers le haut et vers le bas", () => {
    expect(deplacer(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(deplacer(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(deplacer(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("l'index d'insertion se lit sur les milieux des AUTRES lignes", () => {
    // Trois autres lignes, milieux à 20, 60, 100 px.
    expect(indexDInsertion([20, 60, 100], 10)).toBe(0);
    expect(indexDInsertion([20, 60, 100], 70)).toBe(2);
    expect(indexDInsertion([20, 60, 100], 500)).toBe(3);
  });
});
