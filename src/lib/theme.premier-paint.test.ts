import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le fond du premier paint est écrit à TROIS endroits, et ils doivent dire la
 * même chose.
 *
 *   1. `src/index.css`      — `--color-bg`, la source de vérité du design system.
 *   2. `index.html`         — le script en ligne, qui tourne AVANT la feuille de
 *                             style et ne peut donc pas lire la variable.
 *   3. `src/lib/theme.ts`   — `FONDS`, passé à `setBackgroundColor` de Tauri, qui
 *                             attend une couleur et non une variable CSS.
 *
 * Les deux duplications sont inévitables. Ce qui ne l'est pas, c'est qu'elles
 * dérivent en silence : un token retouché dans `index.css` laisserait le premier
 * paint peindre l'ancien fond, et le clignotement reviendrait par la fenêtre
 * qu'on vient de fermer — sans qu'aucun test n'échoue.
 *
 * D'où ce fichier, qui ne teste pas du code mais une CONCORDANCE.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8");
const html = readFileSync(resolve(RACINE, "index.html"), "utf-8");
const ts = readFileSync(resolve(RACINE, "src/lib/theme.ts"), "utf-8");

/** `--color-bg` du bloc dont l'ouverture est `ouverture`. */
function fondDuBloc(ouverture: string): string {
  const debut = css.indexOf(ouverture);
  expect(debut, `bloc « ${ouverture} » introuvable dans index.css`).toBeGreaterThan(-1);
  const m = /--color-bg:\s*(#[0-9a-f]{3,8})\s*;/i.exec(css.slice(debut));
  expect(m, `--color-bg introuvable après « ${ouverture} »`).not.toBeNull();
  return m![1].toLowerCase();
}

/** La valeur de `cle` dans l'objet `FONDS` du fichier lu. */
function fondDeclare(source: string, cle: "dark" | "light"): string {
  const m = new RegExp(`${cle}\\s*:\\s*"(#[0-9a-f]{3,8})"`, "i").exec(source);
  expect(m, `clé « ${cle} » introuvable dans la table des fonds`).not.toBeNull();
  return m![1].toLowerCase();
}

describe("thème du premier paint", () => {
  it("le fond sombre est le même dans index.css, index.html et theme.ts", () => {
    const reference = fondDuBloc("@theme {");
    expect(fondDeclare(html, "dark")).toBe(reference);
    expect(fondDeclare(ts, "dark")).toBe(reference);
  });

  it("le fond clair est le même dans index.css, index.html et theme.ts", () => {
    const reference = fondDuBloc(':root[data-theme="light"] {');
    expect(fondDeclare(html, "light")).toBe(reference);
    expect(fondDeclare(ts, "light")).toBe(reference);
  });

  it("le script en ligne et theme.ts lisent la MÊME clé de miroir", () => {
    const m = /CLE_MIROIR = "([^"]+)"/.exec(ts);
    expect(m, "CLE_MIROIR introuvable dans theme.ts").not.toBeNull();
    const cle = m![1];
    expect(cle).toBe("shale.theme.resolved");
    expect(html).toContain(`localStorage.getItem("${cle}")`);
  });

  it("le script en ligne s'exécute avant le bundle de l'app", () => {
    // Un script du premier paint placé après `main.tsx` ne servirait à rien.
    expect(html.indexOf("<script>")).toBeLessThan(html.indexOf("/src/main.tsx"));
  });

  it("le miroir n'est jamais posé pour « système »", () => {
    // C'est la règle qui empêche de rejouer une apparence système périmée.
    expect(ts).toMatch(/pref === "system"\)\s*localStorage\.removeItem\(CLE_MIROIR\)/);
  });
});
