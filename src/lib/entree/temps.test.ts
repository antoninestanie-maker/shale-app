import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * ⭐ CHAQUE TEMPS DOIT AVOIR UNE HORLOGE, ET ELLE DOIT VIVRE SUR UN ÉLÉMENT
 * QUI EXISTE TOUJOURS.
 *
 * Ce fichier existe à cause d'un vrai défaut, mesuré dans l'app iOS le
 * 2026-09-12 : le temps 1 n'était animé que sur `.entree-part`, c'est-à-dire
 * sur le formulaire de connexion. À l'ouverture À FROID il n'y a pas de
 * formulaire — aucun élément ne portait l'animation, `animationend` n'arrivait
 * jamais, et la machine restait dans `poser` 2 515 ms, jusqu'au minuteur de
 * sécurité. Relevé dans l'app : `2936 poser` → `5451 done`.
 *
 * Les tests de la machine ne pouvaient pas l'attraper : la machine était juste.
 * C'est le CÂBLAGE entre le CSS et elle qui était faux. D'où ces vérifications
 * de concordance, qui sont les seules à pouvoir le voir.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8");
const composant = readFileSync(
  resolve(RACINE, "src/components/auth/EntryTransition.tsx"),
  "utf-8",
);

/** Le nom d'animation déclaré par la première règle qui correspond au sélecteur. */
function animationDe(selecteur: string): string | null {
  const i = css.indexOf(selecteur + " {");
  if (i === -1) return null;
  const bloc = css.slice(i, css.indexOf("}", i));
  const m = /animation:\s*([\w-]+)/.exec(bloc);
  return m ? m[1] : null;
}

/** La table `ANIMATION_DE` du composant, telle qu'elle est écrite. */
function tableDuComposant(): Record<string, string> {
  const i = composant.indexOf("const ANIMATION_DE");
  const bloc = composant.slice(i, composant.indexOf("};", i));
  const table: Record<string, string> = {};
  for (const m of bloc.matchAll(/"([\w-]+)":\s*"(\w+)"/g)) table[m[1]] = m[2];
  return table;
}

const TABLE = tableDuComposant();

describe("les trois temps de la transition d'entrée", () => {
  it.each([
    ["poser", '.entree-copie[data-phase="poser"]'],
    ["approche", '.entree-copie[data-phase="approche"]'],
    ["traversee", '.entree-copie[data-phase="traversee"]'],
  ])("« %s » a une horloge sur la COPIE, qui existe toujours", (temps, selecteur) => {
    // ⚠️ Sur la copie, et pas sur le formulaire : à froid, le formulaire
    // n'existe pas. C'est exactement le défaut du 2026-09-12.
    const nom = animationDe(selecteur);
    expect(nom, `aucune animation sur ${selecteur}`).not.toBeNull();
    expect(TABLE[nom!], `« ${nom} » n'est pas dans ANIMATION_DE`).toBe(temps);
  });

  it("l'ouverture à froid a sa propre horloge pour le temps 1", () => {
    const nom = animationDe('.entree-copie[data-origine="froid"][data-phase="poser"]');
    expect(nom).not.toBeNull();
    expect(TABLE[nom!]).toBe("poser");
  });

  it("chaque animation citée existe vraiment en keyframes", () => {
    for (const nom of Object.keys(TABLE)) {
      expect(css, `@keyframes ${nom} manquant`).toContain(`@keyframes ${nom} {`);
    }
  });

  it("⚠️ sous prefers-reduced-motion, le dernier temps garde une horloge", () => {
    // La règle globale d'`index.css` coupe les animations de la copie ici ;
    // c'est l'enveloppe de l'app qui prend le relais. Sans elle, la machine
    // n'atteindrait jamais `done` — le défaut le plus probable du chantier.
    const i = css.indexOf("@media (prefers-reduced-motion: reduce) {\n  /* ⚠️ `animation-duration`");
    expect(i, "bloc reduced-motion de la transition introuvable").toBeGreaterThan(-1);
    const bloc = css.slice(i, i + 1400);
    const m = /\.entree-app\[data-phase="traversee"\]\s*\{[^}]*animation:\s*([\w-]+)/.exec(bloc);
    expect(m, "l'app ne porte plus de fondu sous reduced-motion").not.toBeNull();
    expect(TABLE[m![1]]).toBe("traversee");
  });

  it("la transition n'anime que transform, opacity et clip-path", () => {
    // ⚠️ Animer un `filter` ou un `backdrop-filter` par-dessus le verre de la
    // sidebar est ce qui coûte le plus cher dans WKWebView.
    const debut = css.indexOf("/* ─── L'entrée dans Shale");
    expect(debut).toBeGreaterThan(-1);
    const bloc = css.slice(debut);
    for (const interdit of ["filter:", "backdrop-filter:", "width:", "height:", "box-shadow:"]) {
      for (const m of bloc.matchAll(/@keyframes entree-[\w-]+ \{([\s\S]*?)\n\}/g)) {
        expect(m[1], `« ${interdit} » animé dans des keyframes d'entrée`).not.toContain(
          interdit,
        );
      }
    }
  });
});
