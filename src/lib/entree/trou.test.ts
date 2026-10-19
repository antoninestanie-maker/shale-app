import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTRACTION, PIECES, RAYON_PLAQUE, coteCoin, transformation, trou } from "./trou";

const nombres = (s: string) => [...s.replace("translate3d", "").matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

/** Le trou contient-il ce point ? (carré arrondi de demi-côté h, rayon r) */
function dansLeTrou(px: number, py: number, cx: number, cy: number, h: number, r: number) {
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  if (dx > h || dy > h) return false;
  const ix = dx - (h - r);
  const iy = dy - (h - r);
  return ix <= 0 || iy <= 0 || Math.hypot(ix, iy) <= r;
}

describe("le trou de l'entrée dans le logo", () => {
  const t = trou(735, 461.5, 96, 1470, 923);

  it("à la fin, il contient toute la fenêtre (rien de nuit ne reste à l'écran)", () => {
    for (const geo of [t, trou(120, 80, 52, 1470, 923), trou(195, 422, 96, 390, 844)]) {
      const h = (geo.cote / 2) * geo.echelleFinale;
      const r = RAYON_PLAQUE * geo.cote * geo.echelleFinale;
      for (const [x, y] of [
        [0, 0],
        [geo.largeur, 0],
        [0, geo.hauteur],
        [geo.largeur, geo.hauteur],
      ])
        expect(dansLeTrou(x, y, geo.cx, geo.cy, h, r)).toBe(true);
    }
  });

  it("à l'échelle 1, ses bords sont ceux de l'icône", () => {
    expect(nombres(transformation(t, "haut", 1))[1]).toBeCloseTo(461.5 - 48 - 923);
    expect(nombres(transformation(t, "bas", 1))[1]).toBeCloseTo(461.5 + 48);
    expect(nombres(transformation(t, "gauche", 1))[0]).toBeCloseTo(735 - 48 - 1470);
    expect(nombres(transformation(t, "droite", 1))[0]).toBeCloseTo(735 + 48);
  });

  it("un coin, réduit, a le rayon de la plaque à cette échelle", () => {
    for (const s of [CONTRACTION, 3, t.echelleFinale]) {
      const k = nombres(transformation(t, "hg", s))[3];
      const visible = coteCoin(t) * k; // rayon + recouvrement
      expect(visible).toBeCloseTo(RAYON_PLAQUE * 96 * s + 2 * s, 2);
    }
  });

  it("⭐ chaque pièce est AFFINE en l'échelle : deux images clés suffisent à les garder jointives", () => {
    // Le navigateur interpole chaque nombre linéairement entre deux images
    // clés. Si la position d'une pièce n'était pas affine en `s`, le trou et
    // la plaque se décolleraient au milieu de l'animation.
    const a = CONTRACTION;
    const b = t.echelleFinale;
    for (const p of PIECES) {
      const debut = nombres(transformation(t, p, a));
      const fin = nombres(transformation(t, p, b));
      const milieu = nombres(transformation(t, p, (a + b) / 2));
      milieu.forEach((v, i) => expect(v).toBeCloseTo((debut[i] + fin[i]) / 2, 2));
    }
  });
});

describe("la concordance avec le composant et le CSS", () => {
  const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const css = readFileSync(resolve(racine, "src/index.css"), "utf-8");
  const comp = readFileSync(resolve(racine, "src/components/auth/EntryTransition.tsx"), "utf-8");

  it("le trou annule la densité, sinon il se décale de la plaque à 110 %", () => {
    const bloc = css.slice(css.indexOf(".entree-masque {"), css.indexOf("}", css.indexOf(".entree-masque {")));
    expect(bloc).toContain("zoom: var(--zoom-inv, 1)");
  });

  it("les mouvements partent tous à la même heure", () => {
    expect(comp).toContain("a.startTime = debut");
  });

  it("le trou n'existe pas sous prefers-reduced-motion", () => {
    const i = css.indexOf("@media (prefers-reduced-motion: reduce) {\n  /* ⚠️ `animation-duration`");
    expect(css.slice(i, i + 2000)).toContain(".entree-masque {\n    display: none;");
  });
});
