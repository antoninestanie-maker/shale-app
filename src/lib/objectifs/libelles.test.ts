import { beforeAll, describe, expect, it, vi } from "vitest";

import { objectif } from "./objectif.testutil";
import type { Mesure } from "./progression";

type Libelles = typeof import("./libelles");
let aideDeNature: Libelles["aideDeNature"];
let nomDeNature: Libelles["nomDeNature"];
let deplacer: Libelles["deplacer"];
let deplieParDefaut: Libelles["deplieParDefaut"];
let indexDInsertion: Libelles["indexDInsertion"];
let lireReplis: Libelles["lireReplis"];
let origineEnClair: Libelles["origineEnClair"];
let pourquoiSansMesure: Libelles["pourquoiSansMesure"];

/**
 * La langue se fixe À L'IMPORT du module d'i18n, depuis `navigator.language` :
 * on pose donc le navigateur AVANT d'importer — même montage que
 * `notifications.test.ts`. Sans lui, la suite passe ou casse selon la langue
 * de la machine qui la lance.
 */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ aideDeNature, deplacer, deplieParDefaut, indexDInsertion, lireReplis, nomDeNature, origineEnClair, pourquoiSansMesure } =
    await import("./libelles"));
});

/** Par défaut : une étape vide, pas cochée — ce qu'est une étape à sa naissance. */
const mesure = (p: Partial<Mesure>): Mesure => ({
  pct: 0,
  fraction: 0,
  origine: { type: "unite", faite: false },
  ressources: [],
  nonComptes: [],
  ...p,
});

const feuille = (p: { etapes?: [number, number]; elements?: [number, number]; taches?: boolean }): Mesure =>
  mesure({
    origine: {
      type: "feuille",
      etapesFaites: p.etapes?.[0] ?? 0,
      etapesTotal: p.etapes?.[1] ?? 0,
      elementsFaits: p.elements?.[0] ?? 0,
      elementsTotal: p.elements?.[1] ?? 0,
      elementsSontDesTaches: p.taches ?? true,
    },
  });

describe("chaque ligne dit d'où vient son pourcentage", () => {
  it("une cible chiffrée : « 12/50 backtests »", () => {
    const m = mesure({ pct: 24, origine: { type: "cible", compte: 12, cible: 50, unite: "backtests", source: "manual" } });
    expect(origineEnClair(m)).toBe("12/50 backtests");
  });

  it("une cible sans unité reste lisible", () => {
    expect(origineEnClair(mesure({ pct: 50, origine: { type: "cible", compte: 2, cible: 4, unite: "  ", source: "manual" } }))).toBe("2/4");
  });

  // ⚠️ MIS À JOUR EXPRÈS le 2026-10-11 (labo, constat 3 : « 0/1 élément » sous
  // un objectif à deux étapes, « 1 étape » au-dessus de trois). Ce test
  // attendait « 3/7 éléments » et « 0/1 élément ».
  it("des tâches : « 3 tâches sur 7 » — le nom s'accorde avec ce qui est FAIT", () => {
    expect(origineEnClair(feuille({ elements: [3, 7] }))).toBe("3 tâches sur 7");
    expect(origineEnClair(feuille({ elements: [1, 7] }))).toBe("1 tâche sur 7");
    // En français, zéro s'accorde au singulier.
    expect(origineEnClair(feuille({ elements: [0, 1] }))).toBe("0 tâche sur 1");
  });

  it("dès qu'un événement s'y mêle, ce sont des « éléments »", () => {
    expect(origineEnClair(feuille({ elements: [2, 5], taches: false }))).toBe("2 éléments sur 5");
    expect(origineEnClair(feuille({ elements: [1, 5], taches: false }))).toBe("1 élément sur 5");
  });

  // ⚠️ MIS À JOUR EXPRÈS le 2026-10-11. Ce test attendait « 3 étapes · 1/2
  // éléments » pour CINQ étapes à l'écran, dont deux vides qui se taisaient
  // (règle du 2026-09-30, elle-même posée sur celle du 2026-09-16).
  it("⭐ les compteurs disent ce qu'on voit : « 1 étape sur 3 », toutes les étapes, et combien de faites", () => {
    expect(origineEnClair(feuille({ etapes: [1, 3] }))).toBe("1 étape sur 3");
    expect(origineEnClair(feuille({ etapes: [2, 3] }))).toBe("2 étapes sur 3");
    expect(origineEnClair(feuille({ etapes: [0, 3] }))).toBe("0 étape sur 3");
    expect(origineEnClair(feuille({ etapes: [3, 5], elements: [1, 2] }))).toBe("3 étapes sur 5 · 1 tâche sur 2");
  });

  it("le manuel se dit manuel", () => {
    expect(origineEnClair(mesure({ pct: 45, origine: { type: "manuel" } }))).toBe("saisi à la main");
  });

  // ⚠️ MIS À JOUR EXPRÈS le 2026-10-11. Une étape vide se tait toujours sur sa
  // ligne — mais plus parce qu'elle « ne compte pas » : elle porte une case à
  // cocher. Les bulles « Ajoute-lui un sous-objectif… » et « Rattache une
  // tâche… », qui expliquaient pourquoi elle ne comptait pas, sont parties.
  it("⭐ une étape vide ne dit RIEN sur sa ligne, cochée ou non : sa case le dit", () => {
    expect(origineEnClair(mesure({}))).toBe("");
    expect(origineEnClair(mesure({ pct: 100, fraction: 1, origine: { type: "unite", faite: true } }))).toBe("");
    expect(pourquoiSansMesure(mesure({}))).toBeNull();
  });

  it("un chiffre mesuré n'a pas de « pourquoi »", () => {
    expect(pourquoiSansMesure(mesure({ pct: 10, origine: { type: "manuel" } }))).toBeNull();
    expect(pourquoiSansMesure(feuille({ etapes: [0, 2] }))).toBeNull();
  });

  it("chaque panne a sa phrase — dans la bulle du « — »", () => {
    for (const raison of ["cible-nulle", "source-introuvable", "cycle"] as const) {
      expect(pourquoiSansMesure(mesure({ pct: null, fraction: null, origine: { type: "panne", raison } }))).not.toBeNull();
    }
  });

  it("⚠️ une PANNE reste dite sur la ligne : une source supprimée n'est pas une étape vide", () => {
    const panne = (raison: "cible-nulle" | "source-introuvable" | "cycle") =>
      origineEnClair(mesure({ pct: null, fraction: null, origine: { type: "panne", raison } }));
    expect(panne("source-introuvable")).toBe("source introuvable");
    expect(panne("cible-nulle")).toBe("cible à zéro");
    expect(panne("cycle")).toBe("");
  });
});

describe("les compteurs, en anglais", () => {
  it("“1 step out of 3”, et zéro au pluriel : “0 steps out of 3”", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { userAgent: "test", language: "en-US", languages: ["en-US"] });
    const en = await import("./libelles");
    expect(en.origineEnClair(feuille({ etapes: [1, 3] }))).toBe("1 step out of 3");
    expect(en.origineEnClair(feuille({ etapes: [0, 3] }))).toBe("0 steps out of 3");
    expect(en.origineEnClair(feuille({ etapes: [2, 3], elements: [0, 1] }))).toBe("2 steps out of 3 · 0 tasks out of 1");
    expect(en.origineEnClair(feuille({ elements: [1, 4], taches: false }))).toBe("1 item out of 4");
    vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
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
describe("le vocabulaire d'une ligne (2026-10-12 : « étape », et « phase » quand elle en contient d'autres)", () => {
  // ⚠️ MIS À JOUR EXPRÈS le 2026-10-12. Ce bloc disait : « jalon » s'affiche
  // « Phase », et le sous-objectif garde son nom (`nomDeGenre("sous-objectif")`
  // rendait « Sous-objectif »). Antonin, sur la proposition de retirer le mot :
  // « je valide ». Le mot ne vient plus d'un genre stocké, mais de la nature
  // de la ligne (`natureDe`, testée dans `structure.test.ts`).
  it("une étape s'appelle « Étape », une étape qui en contient d'autres « Phase »", () => {
    expect(nomDeNature("etape")).toBe("Étape");
    expect(nomDeNature("phase")).toBe("Phase");
    expect(nomDeNature("objectif")).toBe("Objectif");
  });

  it("« sous-objectif » n'est plus écrit nulle part, ni dans les noms ni dans les bulles", () => {
    const tout = (["objectif", "phase", "etape"] as const).flatMap((n) => [nomDeNature(n), aideDeNature(n)]).join(" ");
    expect(tout).not.toMatch(/sous-objectif|jalon/i);
  });

  it("chaque nature dit ce qu'elle regroupe : une phase des étapes, une étape des tâches", () => {
    expect(aideDeNature("phase")).toMatch(/étapes/);
    expect(aideDeNature("etape")).toMatch(/tâches/);
    expect(aideDeNature("phase")).not.toBe(aideDeNature("etape"));
  });
});

describe("repliement par défaut : la phase en cours seule est ouverte", () => {
  const phases = [1, 2, 3, 4, 5, 6].map((id) => objectif({ id }));
  const acheve = (id: number) => id <= 4;
  const toutesPhases = () => true;

  it("six phases dont quatre finies : seule la cinquième est dépliée", () => {
    expect(phases.map((j) => deplieParDefaut(j, phases, acheve, toutesPhases))).toEqual([false, false, false, false, true, false]);
  });

  it("une étape qui n'en contient pas d'autres ne déplie jamais son détail seule", () => {
    const s = objectif({ id: 9 });
    expect(deplieParDefaut(s, [s], () => false, () => false)).toBe(false);
  });

  it("⚠️ une « phase » STOCKÉE mais vide (`is_milestone = 1`, aucune étape dessous) reste repliée : c'est une étape", () => {
    // Avant le 2026-10-12, `is_milestone` suffisait à la déplier d'office.
    const vide = objectif({ id: 1, is_milestone: 1 });
    const pleine = objectif({ id: 2, is_milestone: 0 });
    const estPhase = (id: number) => id === 2; // la seconde porte des étapes
    expect([vide, pleine].map((x) => deplieParDefaut(x, [vide, pleine], () => false, estPhase))).toEqual([false, true]);
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
