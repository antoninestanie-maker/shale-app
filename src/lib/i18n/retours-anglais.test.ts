import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Retours du tournage en anglais du 2026-10-09 (reel 018, mode démo).
 *
 * Deux défauts qu'AUCUN des deux outils i18n ne voit :
 *   • « Annuler » rendu “Cancel” sur un bouton qui DÉFAIT (le toast de
 *     suppression) — la clé existait, elle disait autre chose ;
 *   • « 7 j » écrit en dur dans le JSX, à côté d'une clé « {n} j » qui existe.
 *
 * La langue se fixe À L'IMPORT du module d'i18n (PIEGES § 14.2) : on pose le
 * navigateur avant d'importer, et on réimporte pour l'autre langue.
 */

type I18n = typeof import("./index");

const sous = async (langue: string): Promise<I18n> => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: langue, languages: [langue] });
  return import("./index");
};

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** Tous les `.tsx` de `src/`, hors tests. */
function composants(dossier = "src"): string[] {
  const out: string[] = [];
  for (const e of readdirSync(join(process.cwd(), dossier), { withFileTypes: true })) {
    const chemin = `${dossier}/${e.name}`;
    if (e.isDirectory()) out.push(...composants(chemin));
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(chemin);
  }
  return out;
}

describe("« Annuler » a deux sens, donc deux clés", () => {
  let en: I18n;
  let fr: I18n;
  beforeAll(async () => {
    fr = await sous("fr-FR");
    en = await sous("en-US");
  });

  it("défaire ce qui vient d'être fait : “Undo”", () => {
    expect(en.t("Annuler|défaire")).toBe("Undo");
  });

  it("fermer sans rien faire : toujours “Cancel”", () => {
    expect(en.t("Annuler")).toBe("Cancel");
  });

  it("en français, le discriminant ne s'affiche pas : « Annuler » dans les deux cas", () => {
    expect(fr.t("Annuler|défaire")).toBe("Annuler");
    expect(fr.t("Annuler")).toBe("Annuler");
  });

  it("⭐ le bouton d'un toast qui REND ce qui est parti dit « défaire », jamais « Annuler » nu", () => {
    for (const fichier of ["src/components/corbeille/geste.tsx", "src/components/menu/useMenuBlocs.tsx"]) {
      const source = lire(fichier);
      expect(source, fichier).toContain('actionLabel: t("Annuler|défaire")');
      expect(source, fichier).not.toContain('actionLabel: t("Annuler")');
    }
  });

  it("⌘Z d'une carte et d'un croquis : « défaire » aussi", () => {
    // Le bouton est celui qui porte le raccourci ⌘Z juste après son libellé.
    expect(lire("src/components/carte/EditeurCarte.tsx")).toMatch(
      /data-tip=\{t\("Annuler\|défaire"\)\}\s+data-tip-kbd=\{kbd\("⌘Z"\)\}/,
    );
    expect(lire("src/components/SketchPad.tsx")).toContain('{t("Annuler|défaire")}');
  });
});

describe("les jours d'une série passent par la clé « {n} j »", () => {
  it("“7 d” en anglais, « 7 j » en français", async () => {
    expect((await sous("fr-FR")).t("{n} j", { n: 7 })).toBe("7 j");
    expect((await sous("en-US")).t("{n} j", { n: 7 })).toBe("7 d");
  });

  it("⭐ aucun composant n'écrit « {valeur} j » en dur dans son JSX", () => {
    // `{streak} j` suivi d'une fin de ligne ou d'une balise : du texte affiché,
    // que `t()` ne voit pas. Vu dans le bandeau d'Aujourd'hui et sous l'anneau.
    const enDur = /\}[ \t]+j[ \t]*(?:\r?\n|<)/;
    const fautifs = composants().filter((f) => enDur.test(lire(f)));
    expect(fautifs).toEqual([]);
  });
});
