import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Le soulèvement de 2 px au survol (V7) ne doit JAMAIS toucher une carte qui
 * vit dans un conteneur qui rogne (`overflow: clip` du panneau de grille,
 * `overflow-hidden` d'un repli animé) : son bord haut serait coupé à plat, et
 * le filet dégradé avec.
 *
 * Le piège payé le 2026-09-23 (PIEGES § 21.10) : la grille « annulait » le
 * soulèvement par une règle `.rgrid-content .card:hover { translate: none }`,
 * de spécificité (0,3,0), contre (0,4,0) pour la règle qui soulève. Elle ne
 * gagnait jamais, et aucun test ne le voyait. On exige donc l'EXCLUSION dans
 * le sélecteur même, et on interdit le retour de l'annulation.
 */
const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
// Sans les commentaires : celui qui raconte le piège cite l'ancienne règle.
const css = readFileSync(resolve(RACINE, "src/index.css"), "utf-8").replace(/\/\*[\s\S]*?\*\//g, "");

/** Les sélecteurs des règles qui posent `translate: 0 -2px` sur une `.card`. */
function selecteursSoulevant(): string[] {
  const res: string[] = [];
  const re = /([^{}]+)\{\s*translate:\s*0 -2px;\s*\}/g;
  for (let m = re.exec(css); m; m = re.exec(css)) {
    const sel = m[1].trim();
    if (/(^|[\s,])\.card[:.]/.test(sel)) res.push(sel);
  }
  return res;
}

describe("Survol : une carte ne se soulève jamais là où elle serait rognée", () => {
  it("la règle qui soulève une carte existe (sinon ce test ne garde plus rien)", () => {
    expect(selecteursSoulevant().length).toBeGreaterThan(0);
  });

  it("elle exclut la carte d'une grille et la carte posée dans un overflow-hidden", () => {
    for (const sel of selecteursSoulevant()) {
      expect(sel).toContain(":not(.rgrid-content .card)");
      expect(sel).toContain(":not(.overflow-hidden > .card)");
    }
  });

  it("pas de retour de l'« annulation » trop faible", () => {
    expect(css).not.toMatch(/\.rgrid-content \.card:hover\s*\{\s*translate:\s*none/);
  });
});
