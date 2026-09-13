// Le catalogue RECOPIE deux listes : ce test les relit à la source.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CLES_LIBELLES_PROFIL, MODULES_PROFIL, REGLAGES_PROFIL } from "./catalogue";

const RACINE = resolve(__dirname, "../../..");
const lire = (f: string) => readFileSync(resolve(RACINE, f), "utf-8");

describe("catalogue des profils — concordance avec l'app", () => {
  it("les modules sont ceux de MODULE_IDS, dans le même ordre", () => {
    const src = lire("src/lib/uiConfig.ts");
    const bloc = /export const MODULE_IDS: View\[\] = \[([\s\S]*?)\];/.exec(src)?.[1] ?? "";
    const ids = [...bloc.matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual([...MODULES_PROFIL]);
  });

  it("chaque libellé de module et de catégorie de la barre latérale est surchargeable", () => {
    const src = lire("src/components/Sidebar.tsx");
    const libelleDe = (id: string) =>
      new RegExp(`id: "${id}",\\s*label: "([^"]+)"`).exec(src)?.[1];
    const modules = MODULES_PROFIL.map(libelleDe);
    const categories = ["prod", "trading"].map(libelleDe);
    expect(modules.every(Boolean)).toBe(true);
    expect(new Set([...modules, ...categories])).toEqual(new Set(CLES_LIBELLES_PROFIL));
  });

  it("aucun réglage n'est surchargeable tant qu'aucun écran n'en consomme", () => {
    expect(Object.keys(REGLAGES_PROFIL)).toEqual([]);
  });
});
