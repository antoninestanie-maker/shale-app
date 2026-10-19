import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ⭐ UN SEUL LOGO DU CLIC SUR L'ICÔNE JUSQU'À L'APP (marque du 2026-10-19).
 *
 * La première image — fond nuit, halo rouge, l'icône au centre sans lueur —
 * existe en SIX copies, parce que chacune est peinte par quelqu'un d'autre et
 * à un autre moment : le catalogue iOS et le storyboard (SpringBoard, avant
 * Shale), la fenêtre Tauri (macOS, avant la webview), `index.html` (avant le
 * CSS), l'outil qui rend les PNG de lancement, et la copie animée (`index.css`).
 * Une copie qui dérive ne casse rien : elle fait juste SAUTER l'image au
 * moment où la suivante prend le relais. Ce fichier tient la concordance.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const lire = (p: string) => readFileSync(resolve(RACINE, p), "utf-8");
const html = lire("index.html");
const css = lire("src/index.css");
const outil = lire("tools/icones-marque.mjs");
const storyboard = lire("src-tauri/gen/apple/LaunchScreen.storyboard");
const NUIT = "#070506";

describe("la première image de Shale", () => {
  it("le fond nuit est le même pour iOS, la fenêtre Mac et index.html", () => {
    expect(lire("src-tauri/tauri.conf.json")).toContain(`"backgroundColor": "${NUIT}"`);
    expect(html).toMatch(new RegExp(`\\.lancement \\{[^}]*background: ${NUIT};`));
    const couleurs = JSON.parse(
      lire("src-tauri/gen/apple/Assets.xcassets/LaunchBackground.colorset/Contents.json"),
    ).colors as { color: { components: Record<string, string> }; appearances?: unknown }[];
    // Une seule entrée : la nuit, dans les DEUX apparences du système.
    expect(couleurs).toHaveLength(1);
    const c = couleurs[0].color.components;
    const hex = ["red", "green", "blue"].map((k) => parseInt(c[k], 16).toString(16).padStart(2, "0"));
    expect(`#${hex.join("")}`).toBe(NUIT);
    expect(storyboard).toContain('name="LaunchBackground"');
  });

  it("le halo d'index.html est le dégradé qui a rendu LaunchHalo", () => {
    const halo = /export const HALO = "([^"]+)"/.exec(outil)![1];
    expect(html).toContain(`background: ${halo};`);
    const cote = /export const COTE_HALO = (\d+)/.exec(outil)![1];
    expect(html).toContain(`width: calc(${cote}px * var(--zoom-inv, 1));`);
    // Centré par le calcul, pas par `margin: auto` (plus large qu'un téléphone).
    expect(html).toContain(`left: calc(50% - ${Number(cote) / 2}px * var(--zoom-inv, 1));`);
    expect(storyboard).toContain(`<image name="LaunchHalo" width="${cote}" height="${cote}"/>`);
  });

  it("l'icône a la même taille au lancement iOS, dans index.html et dans la copie animée", () => {
    const cote = /export const COTE_LANCEMENT = (\d+)/.exec(outil)![1];
    expect(storyboard).toContain(`<image name="LaunchIcon" width="${cote}" height="${cote}"/>`);
    expect(storyboard).toContain(`firstAttribute="width" constant="${cote}"`);
    expect(html).toMatch(new RegExp(`\\.lancement-icone \\{\\s*width: calc\\(${cote}px`));
    const froid = /\.entree-copie\[data-origine="froid"\] \{([^}]*)\}/.exec(css)![1];
    expect(froid).toContain(`width: calc(${cote}px * var(--zoom-inv, 1));`);
  });

  it("l'icône de lancement n'a PAS de lueur — c'est l'animation qui l'allume", () => {
    // Le SVG en ligne d'index.html : les traits nets, aucun filtre.
    const svg = html.slice(html.indexOf('<svg class="lancement-icone"'), html.indexOf("</svg>"));
    expect(svg).not.toContain("filter");
    expect(svg).toContain('d="M86 38 H54 Q42 38 42 53"');
  });

  it("le storyboard ne contient aucun double tiret hors des délimiteurs de commentaire", () => {
    // `ibtool` casse le build iOS dessus, sans autre signal (2026-09-11).
    const sans = storyboard.replace(/<!--/g, "").replace(/-->/g, "");
    expect(sans).not.toContain("--");
  });
});
