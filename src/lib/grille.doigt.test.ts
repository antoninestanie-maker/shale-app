// La grille au doigt — lot 4 de l'audit du 20/10 (constats 1 et 26). Voir la
// fin de `grille.ts`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { garderDefilement, grilleEtroite, largeurEtroite, plancherEnColonnes } from "./grille";

const GOUTTIERE = 16;
const PLANCHER_PX = 248;

describe("plancherEnColonnes — le plancher de 248 px traduit en colonnes", () => {
  it("bureau (grille de 960 px) : 4 colonnes, comme avant", () => {
    expect(plancherEnColonnes(960, 12, GOUTTIERE, PLANCHER_PX)).toBe(4);
  });
  it("tablette debout (grille de 680 px, mesurée dans WebKit) : 5 colonnes", () => {
    expect(plancherEnColonnes(680, 12, GOUTTIERE, PLANCHER_PX)).toBe(5);
  });
  it("largeur inconnue (première image) : 1", () => {
    expect(plancherEnColonnes(0, 12, GOUTTIERE, PLANCHER_PX)).toBe(1);
  });
});

describe("largeurEtroite — plus de tiers vide sur tablette (constat 26)", () => {
  it("au bureau, rien ne change", () => {
    expect(grilleEtroite(4, 12)).toBe(false);
    for (const d of [4, 6, 8, 12]) expect(largeurEtroite({ largeurParDefaut: d, plancher: 4, colonnes: 12 })).toBe(d);
  });

  it("sur tablette, « Tâches du jour » (8) prend la rangée, le Timer (4) la demi-rangée", () => {
    // Avant : tâches 8/12 et Timer 5/12, chacun seul sur sa rangée — le tiers
    // droit de l'écran vide (mesuré dans WebKit à 820 px).
    expect(grilleEtroite(5, 12)).toBe(true);
    expect(largeurEtroite({ largeurParDefaut: 8, plancher: 5, colonnes: 12 })).toBe(12);
    expect(largeurEtroite({ largeurParDefaut: 4, plancher: 5, colonnes: 12 })).toBe(6);
    expect(largeurEtroite({ largeurParDefaut: 6, plancher: 5, colonnes: 12 })).toBe(6);
    expect(largeurEtroite({ largeurParDefaut: 12, plancher: 5, colonnes: 12 })).toBe(12);
  });

  it("deux cartes étroites tiennent toujours côte à côte, sans trou", () => {
    for (const p of [5, 6]) {
      const w = largeurEtroite({ largeurParDefaut: 4, plancher: p, colonnes: 12 });
      expect(w * 2).toBe(12);
    }
  });

  it("au téléphone (plancher au-delà de la moitié), la grille s'en charge déjà : inchangé", () => {
    expect(largeurEtroite({ largeurParDefaut: 4, plancher: 9, colonnes: 12 })).toBe(4);
  });
});

describe("garderDefilement — cocher en bas ne ramène plus la liste en haut (constat 1)", () => {
  it("rend sa position à une région que la mesure a remise à zéro", () => {
    const liste = { scrollTop: 298 };
    const vide = { scrollTop: 0 };
    const h = garderDefilement([liste, vide], () => {
      // Ce que fait le navigateur quand l'étirement est retiré : plus rien à défiler.
      liste.scrollTop = 0;
      return 628;
    });
    expect(h).toBe(628);
    expect(liste.scrollTop).toBe(298);
    expect(vide.scrollTop).toBe(0);
  });
});

describe("ResizableGrid — la mesure et le téléphone (lecture de la source)", () => {
  const src = readFileSync(new URL("../components/grid/ResizableGrid.tsx", import.meta.url), "utf8");
  it("la mesure de la hauteur naturelle passe par garderDefilement", () => {
    expect(src).toMatch(/natural = garderDefilement\(defilants/);
  });
  it("au téléphone, ni plafond ni hauteur épinglée : la carte suit son contenu", () => {
    expect(src).toMatch(/const pinnedH = telephone \? undefined : override\?\.h;/);
    expect(src).toMatch(/const ceilFootprint = telephone\s*\?\s*floorFootprint/);
    expect(src).toMatch(/scrollable && !telephone \? hardMin/);
  });
});
