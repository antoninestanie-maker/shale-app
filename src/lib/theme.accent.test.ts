// V8 « Encre & Braise » (2026-10-19) : l'accent de l'interface n'est plus le
// bleu. Ce test tient les trois choses qui se perdent sans bruit :
//   1. l'accent et son aplat tiennent le contraste AA, dans les deux thèmes ;
//   2. `--color-blue` garde sa valeur — c'est une couleur CHOISIE (données) ;
//   3. aucune classe d'interface ne repasse au bleu (`text-blue`, `bg-blue/10`…).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../index.css"), "utf-8");

const sources = import.meta.glob(["../**/*.tsx", "../**/*.ts", "!../**/*.test.*"], {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(h.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contraste = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

/** Valeur d'un token dans le premier bloc qui suit `debut`. */
function token(debut: string, nom: string): string {
  const i = css.indexOf(debut);
  expect(i, debut).toBeGreaterThan(-1);
  const m = css.slice(i).match(new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})`));
  expect(m, `${nom} après ${debut}`).not.toBeNull();
  return m![1];
}

const BLOCS = {
  sombre: { debut: "@theme {", surfaces: ["#07080b", "#111318", "#1a1d24"] },
  clair: { debut: ':root[data-theme="light"] {', surfaces: ["#f5f6f8", "#ffffff", "#ebedf1"] },
  systeme: { debut: "@media (prefers-color-scheme: light)", surfaces: ["#f5f6f8", "#ffffff", "#ebedf1"] },
};

describe("accent V8", () => {
  for (const [nom, { debut, surfaces }] of Object.entries(BLOCS)) {
    it(`${nom} : l'accent se lit sur les trois plans, son aplat porte le blanc`, () => {
      const accent = token(debut, "color-accent");
      for (const s of surfaces) expect(contraste(accent, s)).toBeGreaterThanOrEqual(4.5);
      expect(contraste(token(debut, "color-accent-solid"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    });
  }

  it("le bleu reste une couleur choisie, à sa valeur V7", () => {
    expect(token("@theme {", "color-blue")).toBe("#0088ff");
    expect(token(':root[data-theme="light"] {', "color-blue")).toBe("#0060dc");
  });

  it("le bouton primaire est à l'encre", () => {
    const regle = css.slice(css.indexOf(".fill-primary {"), css.indexOf("}", css.indexOf(".fill-primary {")));
    expect(regle).toContain("color: var(--color-bg)");
    expect(css).toMatch(/--gradient-primary: linear-gradient\(180deg, var\(--color-text\), var\(--color-text\)\)/);
  });

  it("aucune classe d'interface au bleu", () => {
    const fautifs: string[] = [];
    const motif = /(?<![\w-])(?:[a-z]+:)*(?:text|bg|border|ring|outline|fill|stroke|from|to|via|caret|accent)-blue(?:-solid)?(?![\w-])/;
    for (const [chemin, code] of Object.entries(sources)) if (motif.test(code)) fautifs.push(chemin);
    expect(fautifs).toEqual([]);
  });
});
