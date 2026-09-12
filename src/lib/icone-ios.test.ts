import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * L'icône iOS est DESSINÉE, pas exportée : `tools/icone-ios.mjs` redéclare la
 * géométrie de la marque et les couleurs du thème pour les rasteriser.
 *
 * Une redéclaration qui dérive de son original est une bombe à retardement —
 * elle ne casse rien, elle livre juste une icône qui n'est plus la marque. Et
 * personne ne regarde une icône d'assez près pour voir qu'une strate a bougé de
 * deux dixièmes.
 *
 * Ce fichier vérifie donc la CONCORDANCE, pas le code.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const outil = readFileSync(resolve(RACINE, "tools/icone-ios.mjs"), "utf-8");
const marque = readFileSync(resolve(RACINE, "src/components/auth/ShaleMark.tsx"), "utf-8");
const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8");

/** Les quadruplets `{ y, w, accent }` déclarés dans un fichier source. */
function barres(source: string): { y: number; w: number; accent: boolean }[] {
  const bloc = /(?:BARS|BARRES) = \[([\s\S]*?)\];/.exec(source);
  expect(bloc, "tableau des barres introuvable").not.toBeNull();
  return [...bloc![1].matchAll(/y:\s*([\d.]+),\s*w:\s*([\d.]+),\s*accent:\s*(true|false)/g)].map(
    (m) => ({ y: Number(m[1]), w: Number(m[2]), accent: m[3] === "true" }),
  );
}

/** Valeur d'un token `--nom` dans le bloc CSS ouvert par `ouverture`. */
function token(ouverture: string, nom: string): string {
  const debut = css.indexOf(ouverture);
  expect(debut, `bloc « ${ouverture} » introuvable`).toBeGreaterThan(-1);
  const m = new RegExp(`--${nom}:\\s*(#[0-9a-f]{6})\\s*;`, "i").exec(css.slice(debut));
  expect(m, `--${nom} introuvable après « ${ouverture} »`).not.toBeNull();
  return m![1].toLowerCase();
}

/** Contraste WCAG entre deux couleurs #rrggbb. */
function contraste(a: string, b: string): number {
  const luminance = (h: string) => {
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(bl);
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe("icône iOS", () => {
  it("reprend exactement les quatre strates de ShaleMark", () => {
    expect(barres(outil)).toEqual(barres(marque));
  });

  it("garde les strates courtes alignées à gauche, sur la même marge", () => {
    // ⚠️ Recentrer les couches courtes casserait la marque. Les deux fichiers
    // doivent poser leurs barres au même x.
    expect(/MARGE = (\d+)/.exec(outil)?.[1]).toBe('4');
    expect(marque).toContain('x="4"');
  });

  it("prend ses fonds et ses barres dans les tokens du thème", () => {
    const clair = /"AppIcon-1024-any":\s*\{[^}]*\}/.exec(outil)![0];
    const sombre = /"AppIcon-1024-dark":\s*\{[^}]*\}/.exec(outil)![0];
    const hex = (bloc: string, cle: string) =>
      new RegExp(`${cle}:\\s*"(#[0-9a-f]{6})"`, "i").exec(bloc)![1].toLowerCase();

    expect(hex(clair, "fond")).toBe(token(':root[data-theme="light"] {', "color-bg"));
    expect(hex(clair, "barre")).toBe(token(':root[data-theme="light"] {', "color-text"));
    expect(hex(sombre, "fond")).toBe(token("@theme {", "color-bg"));
    expect(hex(sombre, "barre")).toBe(token("@theme {", "color-text"));
  });

  it("garde l'accent lisible sur SA surface, dans les deux apparences", () => {
    // Le défaut qu'on veut rendre impossible : réutiliser le cyan sombre
    // (#22b5e1) sur le fond clair, où il ne donne que 2,20:1 — la troisième
    // strate s'efface et la marque perd son accent.
    const bloc = (n: string) => new RegExp(`"${n}":\\s*\\{[^}]*\\}`).exec(outil)![0];
    const hex = (b: string, cle: string) =>
      new RegExp(`${cle}:\\s*"(#[0-9a-f]{6})"`, "i").exec(b)![1].toLowerCase();

    for (const nom of ["AppIcon-1024-any", "AppIcon-1024-dark"]) {
      const b = bloc(nom);
      expect(contraste(hex(b, "accent"), hex(b, "fond")), `accent de ${nom}`).toBeGreaterThan(3);
      expect(contraste(hex(b, "barre"), hex(b, "fond")), `barres de ${nom}`).toBeGreaterThan(7);
    }
  });

  it("la variante teintée n'a pas de fond : iOS pose la teinte de l'utilisateur", () => {
    expect(/"AppIcon-1024-tinted":\s*\{[^}]*fond:\s*null/.test(outil)).toBe(true);
    expect(/"AppIcon-1024-tinted":\s*\{[^}]*opaque:\s*false/.test(outil)).toBe(true);
  });

  it("le catalogue déclare les trois apparences et rien d'autre", () => {
    const contents = JSON.parse(
      readFileSync(
        resolve(RACINE, "src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/Contents.json"),
        "utf-8",
      ),
    ) as { images: { filename: string; appearances?: { value: string }[] }[] };

    expect(contents.images).toHaveLength(3);
    expect(contents.images.map((i) => i.appearances?.[0]?.value ?? "any")).toEqual([
      "any",
      "dark",
      "tinted",
    ]);
    // Chaque entrée pointe un fichier que `tools/icone-ios.mjs` sait produire.
    for (const image of contents.images)
      expect(outil).toContain(`"${image.filename.replace(/\.png$/, "")}"`);
  });
});
