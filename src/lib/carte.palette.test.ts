import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE_EXPORT } from "./carte";

/**
 * L'export PNG/SVG d'une carte mentale ne peut pas lire `var(--…)` : ses
 * couleurs sont une COPIE aplatie des jetons du thème clair. Le commentaire de
 * `PALETTE_EXPORT` promettait un test de concordance ; il n'existait pas, et
 * la copie était restée en V6 quand les jetons sont passés en V7
 * (2026-09-22). Le voici.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8");

function jetonClair(nom: string): string {
  const debut = css.indexOf(':root[data-theme="light"] {');
  expect(debut).toBeGreaterThan(-1);
  const m = new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(css.slice(debut));
  expect(m, `--${nom} introuvable dans le bloc clair`).not.toBeNull();
  return m![1].toLowerCase();
}

describe("palette d'export des cartes mentales", () => {
  it("recopie exactement les jetons du thème clair", () => {
    const attendu: [keyof typeof PALETTE_EXPORT, string][] = [
      ["surface", "color-surface"],
      ["texte", "color-text"],
      ["dim", "color-text-dim"],
      ["blue", "color-blue"],
      ["violet", "color-violet"],
      ["yellow", "color-yellow"],
      ["green", "color-green"],
    ];
    for (const [cle, jeton] of attendu)
      expect(PALETTE_EXPORT[cle].toLowerCase(), `PALETTE_EXPORT.${cle}`).toBe(jetonClair(jeton));
  });
});
