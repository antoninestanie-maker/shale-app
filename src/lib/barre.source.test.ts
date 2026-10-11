import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Gardes de SOURCE du chantier « barre latérale » (2026-10-11).
 *
 * Aucun test de ce dépôt ne prouve un rendu : ce qui suit ne dit pas que la
 * barre est belle, il dit que cinq défauts trouvés à l'écran ne peuvent pas
 * revenir sans qu'un test tombe. Chaque cas cite la mesure qui l'a fait naître
 * (PIEGES § 35).
 */

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function fichiers(dossier: string, suite: RegExp): string[] {
  const trouves: string[] = [];
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const chemin = `${dossier}/${nom}`;
    if (statSync(join(RACINE, chemin)).isDirectory()) trouves.push(...fichiers(chemin, suite));
    else if (suite.test(nom) && !/\.test\.tsx?$/.test(nom)) trouves.push(chemin);
  }
  return trouves;
}

const SOURCES = fichiers("src", /\.tsx?$/);

describe("hauteur d'écran et densité", () => {
  /**
   * `h-screen` = `100vh`, que le `zoom` de la densité multiplie. À 110 %, la
   * racine de l'app mesurait 920 px dans une fenêtre de 836 : le pied de la
   * barre latérale passait sous le bord et toute l'app défilait.
   * Deux fenêtres n'appliquent pas la densité et gardent `h-screen`.
   */
  const SANS_DENSITE = ["src/TimerPane.tsx", "src/CapturePane.tsx"];

  it("aucun `h-screen` nu hors des fenêtres sans densité", () => {
    const fautifs = SOURCES.filter(
      (f) => !SANS_DENSITE.includes(f) && /\bh-screen\b/.test(sansCommentaires(lire(f))),
    );
    expect(fautifs).toEqual([]);
  });

  it("aucun `Nvh` de classe sans `--zoom-inv`", () => {
    const fautifs: string[] = [];
    for (const f of SOURCES) {
      if (SANS_DENSITE.includes(f)) continue;
      for (const m of sansCommentaires(lire(f)).matchAll(/(?:max-|min-)?h-\[[^\]]*\d+d?vh[^\]]*\]/g))
        if (!m[0].includes("--zoom-inv")) fautifs.push(`${f} : ${m[0]}`);
    }
    expect(fautifs).toEqual([]);
  });

  it("la racine de l'app porte la hauteur compensée", () => {
    expect(lire("src/App.tsx")).toContain('className="relative flex h-[calc(100vh*var(--zoom-inv))] bg-bg"');
  });
});

describe("barre latérale — plus de repli par largeur de FENÊTRE", () => {
  /**
   * `lg:` se déclenche à 1024 px de fenêtre, densité ignorée, et ne laisse
   * aucun choix à l'utilisateur. L'état vient de `lib/barre.ts`.
   */
  it.each(["src/components/Sidebar.tsx", "src/components/SyncIndicator.tsx"])("%s n'a plus de variante `lg:`", (f) => {
    expect(sansCommentaires(lire(f))).not.toMatch(/\blg:/);
  });

  it("le choix ne passe pas par la table `settings` (elle se synchronise)", () => {
    const barre = sansCommentaires(lire("src/components/Sidebar.tsx"));
    expect(barre).toContain("ecrireLocal(CLE_BARRE");
    expect(barre).not.toMatch(/setSetting\(\s*CLE_BARRE/);
  });

  it("la largeur ne s'anime jamais — seulement `translate` et l'opacité", () => {
    const css = sansCommentaires(lire("src/index.css"));
    const blocs = [...css.matchAll(/\.barre[^{]*\{[^}]*\}/g)].map((m) => m[0]);
    expect(blocs.length).toBeGreaterThan(5);
    for (const b of blocs) expect(b).not.toMatch(/transition:[^;]*\bwidth\b/);
    for (const nom of ["barre-ouvrir", "barre-ouvrir-corps", "barre-fermer", "barre-texte-entree"]) {
      const cles = css.match(new RegExp(`@keyframes ${nom} \\{[\\s\\S]*?\\n\\}`))?.[0] ?? "";
      expect(cles, nom).not.toBe("");
      const proprietes = [...cles.matchAll(/^\s+([a-z-]+):/gm)].map((m) => m[1]);
      expect(new Set(proprietes).size).toBeGreaterThan(0);
      for (const p of proprietes) expect(["translate", "opacity"], `${nom} anime ${p}`).toContain(p);
    }
  });
});

describe("barre latérale — le fond opaque existe dans les trois palettes", () => {
  it("`--barre-bg` : une fois en sombre, deux fois en clair, à l'identique", () => {
    const definitions = [...lire("src/index.css").matchAll(/--barre-bg:\s*([^;]+);/g)].map((m) => m[1].trim());
    expect(definitions).toHaveLength(3);
    expect(definitions[1]).toBe(definitions[2]);
    expect(definitions[0]).not.toBe(definitions[1]);
  });

  it("la barre ne porte plus le verre", () => {
    expect(sansCommentaires(lire("src/components/Sidebar.tsx"))).not.toMatch(/className=\{?[`"][^`"]*\bglass\b/);
  });
});

describe("défilement lissé", () => {
  /**
   * La règle globale `prefers-reduced-motion` n'atteint pas `scrollIntoView` :
   * tout défilement lissé passe par `lib/defilement.ts`, qui la respecte.
   */
  it("aucun `behavior: \"smooth\"` hors de `lib/defilement.ts`", () => {
    const fautifs = SOURCES.filter(
      (f) => f !== "src/lib/defilement.ts" && /behavior:\s*["']smooth["']/.test(sansCommentaires(lire(f))),
    );
    expect(fautifs).toEqual([]);
  });
});

describe("grille — widgets", () => {
  /**
   * « Liens rapides » déclarait `.panel-scroll` : une hauteur épinglée à 144 px
   * restait à 144 quand « + lien » passait à la ligne — bouton coupé, barre de
   * défilement dans la carte (la photo d'Antonin du 2026-10-11).
   */
  it("Liens rapides n'est pas une région défilante", () => {
    expect(sansCommentaires(lire("src/components/QuickLinks.tsx"))).not.toContain("panel-scroll");
  });

  /**
   * À 110 % de densité, le panneau glissé devançait le curseur de 10 % de la
   * distance : les `translate` étaient écrits en pixels écran.
   */
  it("la grille convertit ses pixels écran en pixels locaux", () => {
    const grille = sansCommentaires(lire("src/components/grid/ResizableGrid.tsx"));
    expect(grille).toContain("zoomFactor()");
    for (const m of grille.matchAll(/translate\(\$\{(\w+)[^}]*\}px, \$\{(\w+)[^}]*\}px\)/g))
      expect(m[0], "un translate écrit sans division par le zoom").toMatch(/\/ z\}px, \$\{\w+ \/ z\}px/);
  });

  it("les en-têtes à contrôles d'Aujourd'hui s'écartent des poignées", () => {
    expect(lire("src/components/TimerCard.tsx")).toMatch(/className="rgrid-head /);
    expect(lire("src/components/CalendarCard.tsx")).toMatch(/className="rgrid-head /);
    expect(lire("src/views/TodayView.tsx")).toMatch(/className="rgrid-head mb-3[^"]*"[^]*Habitudes à tenir/);
  });

  it("plus d'emoji sablier dans l'interface", () => {
    const fautifs = SOURCES.filter((f) => /["'`>]\s*⌛/.test(sansCommentaires(lire(f))));
    expect(fautifs).toEqual([]);
  });
});
