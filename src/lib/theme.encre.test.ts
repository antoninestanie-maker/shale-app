import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Encre (2026-09-23) : le « réussi » n'a pas de couleur, il prend CELLE DU
 * TEXTE. `--color-success` est donc une copie de `--color-text`, écrite en dur
 * dans les trois blocs de thème comme tous les tokens.
 *
 * Ce qui peut dériver en silence : on retouche `--color-text` d'un thème, et le
 * réussi garde l'ancienne valeur — une case cochée légèrement plus blanche que
 * le texte qu'elle coche. Aucun test d'affichage ne le verrait.
 *
 * Et le second garde : `--color-green` DOIT rester. Il n'est plus un signal,
 * mais les données enregistrent `var(--color-green)` (étiquettes, habitudes,
 * texte coloré des notes) et `green` (événements, types, branches de carte).
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8");

const BLOCS = ["@theme {", ':root[data-theme="light"] {', "@media (prefers-color-scheme: light)"];

function bloc(ouverture: string): string {
  const debut = css.indexOf(ouverture);
  expect(debut, `bloc « ${ouverture} » introuvable dans index.css`).toBeGreaterThan(-1);
  const corps = css.slice(debut + ouverture.length);
  // Le bloc s'arrête à la première accolade fermante en début de ligne.
  return corps.slice(0, corps.search(/\n\}/));
}

function token(b: string, nom: string): string | null {
  const m = new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(b);
  return m ? m[1].toLowerCase() : null;
}

describe("Encre : le réussi prend la couleur du texte", () => {
  for (const ouverture of BLOCS) {
    it(`${ouverture} — --color-success = --color-text`, () => {
      const b = bloc(ouverture);
      expect(token(b, "color-text")).not.toBeNull();
      expect(token(b, "color-success")).toBe(token(b, "color-text"));
    });

    it(`${ouverture} — --color-green existe toujours (couleurs enregistrées en base)`, () => {
      expect(token(bloc(ouverture), "color-green")).not.toBeNull();
    });

    it(`${ouverture} — --color-success-fill et --color-on-success sont définis`, () => {
      const b = bloc(ouverture);
      expect(token(b, "color-success-fill")).not.toBeNull();
      expect(token(b, "color-on-success")).not.toBeNull();
    });
  }

  it("plus aucun --color-on-green : il n'a plus d'aplat à porter", () => {
    expect(css).not.toMatch(/--color-on-green/);
  });
});
