import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Les icônes sont RENDUES depuis les SVG de la marque (`src-tauri/icons/marque/`,
 * copies de `~/Desktop/Shale-projet/marque/`, qui fait foi), et `ShaleMark.tsx`
 * redessine la même marque dans l'app. Une redéclaration qui dérive de son
 * original ne casse rien — elle livre juste un logo qui n'est plus la marque.
 *
 * Ce fichier vérifie donc la CONCORDANCE, pas le code. (Il s'appelait déjà
 * ainsi du temps de la marque « Strates » ; remplacé le 2026-10-19.)
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");
const marque = lire("src/components/auth/ShaleMark.tsx");
const SVG = [
  "icone-shale.svg",
  "icone-shale-plein-cadre.svg",
  "icone-shale-pro.svg",
  "icone-teintee-plein-cadre.svg",
  "marque-gabarit.svg",
].map((n) => [n, lire(`src-tauri/icons/marque/${n}`)] as const);

/** Les chemins d'un SVG, décimales « .0 » retirées. */
const chemins = (src: string) =>
  [...new Set([...src.matchAll(/ d="([^"]+)"/g)].map((m) => m[1].replace(/\.0\b/g, "")))];

/** Les traits déclarés dans `ShaleMark.tsx`. */
function traitsDuComposant(): string[] {
  const m = /export const TRAITS = \[([^\]]+)\]/.exec(marque);
  expect(m, "TRAITS introuvable dans ShaleMark.tsx").not.toBeNull();
  return [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

const sha = (p: string) => createHash("sha256").update(readFileSync(resolve(RACINE, p))).digest("hex");

describe("la marque Shale (2026-10-19)", () => {
  it.each(SVG)("%s porte exactement les deux traits de ShaleMark", (_n, src) => {
    expect(chemins(src)).toEqual(traitsDuComposant());
  });

  it("même inclinaison, même dégradé, même flou partout", () => {
    const incl = /INCLINAISON = "([^"]+)"/.exec(marque)![1];
    for (const [nom, src] of SVG) expect(src, nom).toContain(`transform="${incl}"`);
    const ref = SVG[0][1];
    expect(ref).toContain(`stop-color="${/PLAQUE_HAUT = "([^"]+)"/.exec(marque)![1]}"`);
    expect(ref).toContain(`stop-color="${/PLAQUE_BAS = "([^"]+)"/.exec(marque)![1]}"`);
    expect(ref).toContain('stdDeviation="8"');
    expect(marque).toContain('stdDeviation="8"');
    expect(ref).toContain('rx="22.5"');
    expect(marque).toContain('rx="22.5"');
  });
});

describe("icône iOS", () => {
  const CAT = "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset";

  it("le catalogue déclare les trois apparences et rien d'autre", () => {
    const contents = JSON.parse(lire(`${CAT}/Contents.json`)) as {
      images: { filename: string; appearances?: { value: string }[] }[];
    };
    expect(contents.images).toHaveLength(3);
    expect(contents.images.map((i) => i.appearances?.[0]?.value ?? "any")).toEqual([
      "any",
      "dark",
      "tinted",
    ]);
    // Chaque entrée pointe un fichier que `tools/icones-marque.mjs` produit.
    const outil = lire("tools/icones-marque.mjs");
    for (const image of contents.images) expect(outil).toContain(image.filename);
  });

  it("⭐ l'icône sombre est la claire, à l'octet près (décision d'Antonin)", () => {
    expect(sha(`${CAT}/AppIcon-1024-dark.png`)).toBe(sha(`${CAT}/AppIcon-1024-any.png`));
  });

  it("les trois icônes sont opaques, sans canal alpha (sinon iOS remet un halo blanc)", () => {
    for (const n of ["any", "dark", "tinted"]) {
      const png = readFileSync(resolve(RACINE, `${CAT}/AppIcon-1024-${n}.png`));
      expect(png.readUInt32BE(16), n).toBe(1024);
      expect(png[25], `${n} : type de couleur PNG`).toBe(2); // truecolor, sans alpha
    }
  });
});
