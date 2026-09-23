// ─────────────────────────────────────────────────────────────────────────────
// La palette ⌘K et le profil de licence : chaque action déclare son module.
//
// Né d'un défaut VU À L'ÉCRAN le 2026-09-13 : le filtre d'origine reposait sur
// le préfixe `nav.`, et un profil sans module Position proposait encore
// « Calculateur de taille de position » (`sizing.open`). Ce test lit
// `actions.ts` : toute action qui navigue doit déclarer le module où elle va.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { estModuleProfil, estVueSysteme } from "./catalogue";

const src = readFileSync(resolve(__dirname, "../actions.ts"), "utf-8");
const blocs = src
  .split(/\n  \{\n/)
  .slice(1)
  .map((b) => ({
    id: /id: "([^"]+)"/.exec(b)?.[1],
    module: /module: "([^"]+)"/.exec(b)?.[1],
    cibles: [...b.matchAll(/ctx\.navigate\("([a-z]+)"\)/g)].map((m) => m[1]),
  }))
  .filter((b) => b.id);

describe("actions de la palette — module déclaré", () => {
  it("les actions sont bien lues (garde contre un test vacant)", () => {
    expect(blocs.length).toBeGreaterThanOrEqual(20);
  });

  it("chaque action déclare un module connu", () => {
    // Ou une VUE SYSTÈME déclarée comme telle (`VUES_SYSTEME`) : la corbeille,
    // que nul profil ne masque. Admise par la liste, pas par une exception ici.
    const fautives = blocs.filter((b) => !estModuleProfil(b.module) && !estVueSysteme(b.module));
    expect(fautives).toEqual([]);
  });

  it("une vue système n'est JAMAIS un module masquable", () => {
    // Si « corbeille » devenait un module de profil, elle deviendrait masquable
    // — et ce qu'on a jeté, irrécupérable pour ce profil.
    expect(estModuleProfil("corbeille")).toBe(false);
    expect(estVueSysteme("corbeille")).toBe(true);
    expect(estVueSysteme("tasks")).toBe(false);
  });

  it("une action qui navigue déclare le module où elle mène", () => {
    const fautives = blocs.filter((b) => b.cibles.some((c) => c !== b.module));
    expect(fautives).toEqual([]);
  });

  it("le filtre de la palette lit `module`, pas un motif de nommage", () => {
    expect(src).toContain("!masques?.has(a.module)");
    expect(src).not.toContain('startsWith("nav.")');
  });
});
