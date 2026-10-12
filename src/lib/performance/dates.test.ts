import { beforeAll, describe, expect, it, vi } from "vitest";

type Dates = typeof import("./dates");
let plageDeDates: Dates["plageDeDates"];
let jourEnClair: Dates["jourEnClair"];

/** La langue se fixe à l'import du module d'i18n (PIEGES § 14.2). */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ plageDeDates, jourEnClair } = await import("./dates"));
});

// Les dates sont des PARAMÈTRES : une date fixe ne vieillit pas.
const AUJ = "2026-10-12";

/** Les moteurs séparent par une espace fine, insécable ou non : on compare aux espaces près. */
const lisse = (s: string) => s.replace(/[   ]/g, " ");

describe("chaque total écrit ses dates", () => {
  it("dans un même mois, le mois n'est écrit qu'une fois", () => {
    expect(lisse(plageDeDates("2026-10-05", "2026-10-11", AUJ))).toBe("5–11 oct.");
  });
  it("à cheval sur deux mois, les deux sont écrits", () => {
    expect(lisse(plageDeDates("2026-09-28", "2026-10-04", AUJ))).toBe("28 sept. – 4 oct.");
  });
  it("un seul jour s'écrit seul", () => {
    expect(lisse(plageDeDates(AUJ, AUJ, AUJ))).toBe("12 oct.");
  });
  it("l'année n'apparaît que si une borne n'est pas dans l'année en cours", () => {
    expect(plageDeDates("2026-10-05", "2026-10-11", AUJ)).not.toMatch(/2026/);
    expect(lisse(plageDeDates("2025-12-29", "2026-01-04", AUJ))).toBe("29 déc. 2025 – 4 janv. 2026");
  });
  it("le jour en cours, en clair", () => {
    expect(lisse(jourEnClair(AUJ))).toBe("lundi 12 oct.");
  });
  it("ce qui n'est pas une date ressort tel quel, sans faire tomber l'écran", () => {
    expect(plageDeDates("hier", "demain", AUJ)).toBe("hier – demain");
    expect(jourEnClair("bientôt")).toBe("bientôt");
  });
});
