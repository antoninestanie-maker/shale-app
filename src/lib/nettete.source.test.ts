import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Garde de SOURCE — « l'écriture est floue dans l'app » (Antonin, 2026-10-12,
 * capture de la pastille du minuteur).
 *
 * LA CAUSE, mesurée dans WebKit à 110 % de densité : la pastille était centrée
 * par `left-1/2 -translate-x-1/2`. La moitié de sa largeur tombe presque
 * toujours sur une fraction de pixel (x = 657,75, soit 1315,5 pixels d'écran),
 * et un calque décalé par un `translate` n'est PAS calé sur la grille de
 * pixels : il est rééchantillonné, son texte et son contour sont flous.
 * Centrée par des marges, la même pastille est nette (PIEGES § 41).
 *
 * ⚠️ Ce test ne prouve aucun rendu. Il dit seulement que le motif ne peut pas
 * revenir sans qu'un test tombe.
 *
 * QUOI ÉCRIRE À LA PLACE
 *   centré en largeur  : `inset-x-0 mx-auto w-fit`   (au lieu de `left-1/2 -translate-x-1/2`)
 *   centré en hauteur  : `inset-y-0 my-auto h-fit`   (au lieu de `top-1/2 -translate-y-1/2`)
 *   posé au-dessus d'un point : une ancre `flex h-0 w-0 items-end justify-center`
 *                               et l'élément dedans (`NoteComposer`, la bulle)
 *   position calculée en JS    : la caler sur les pixels physiques (`Tooltip.tsx`, `snap`)
 */

const RACINE = process.cwd();
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, "")
    .replace(/^\s*\/\/.*$/gm, "");

function fichiers(dossier: string, suite: RegExp): string[] {
  const trouves: string[] = [];
  for (const nom of readdirSync(join(RACINE, dossier))) {
    const chemin = `${dossier}/${nom}`;
    if (statSync(join(RACINE, chemin)).isDirectory()) trouves.push(...fichiers(chemin, suite));
    else if (suite.test(nom) && !/\.test\.tsx?$/.test(nom)) trouves.push(chemin);
  }
  return trouves;
}

/** Un décalage en POURCENTAGE de sa propre taille : la fraction de pixel assurée. */
const CLASSE = /-translate-[xy]-(?:1\/2|full)\b/;
const EN_LIGNE = /translate(?:[XY]|3d)?\(\s*-\d+(?:\.\d+)?%/;
const PROPRIETE = /\btranslate:\s*-\d+(?:\.\d+)?%/;

describe("netteté — aucun élément centré par un `translate` en pourcentage", () => {
  /**
   * Les pastilles d'état de la carte mentale vivent DANS la scène, que
   * l'utilisateur zoome librement (`scale`) : leur position n'est entière à
   * aucun zoom, et le calage n'y a pas de sens.
   */
  const DANS_UNE_SCENE_ZOOMEE = ["src/components/carte/EtatsVivants.tsx"];

  it("aucune classe `-translate-x-1/2`, `-translate-y-1/2` ni `-translate-*-full`, aucun `translate(-N%)` en ligne", () => {
    const fautifs: string[] = [];
    for (const f of fichiers("src", /\.tsx?$/)) {
      if (DANS_UNE_SCENE_ZOOMEE.includes(f)) continue;
      const code = sansCommentaires(lire(f));
      for (const motif of [CLASSE, EN_LIGNE, PROPRIETE]) {
        const m = code.match(motif);
        if (m) fautifs.push(`${f} : ${m[0]}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * Les deux pivots de l'horloge à volets : un trait décoratif sans texte, dans
   * une scène en 3D déjà faite de `transform`.
   */
  const SANS_TEXTE = ["src/components/timer/volets.css"];

  it("aucun `translate(-N%)` dans les feuilles de style", () => {
    const fautifs: string[] = [];
    for (const f of fichiers("src", /\.css$/)) {
      if (SANS_TEXTE.includes(f)) continue;
      const css = sansCommentaires(lire(f));
      for (const motif of [EN_LIGNE, PROPRIETE]) {
        const m = css.match(motif);
        if (m) fautifs.push(`${f} : ${m[0]}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("les exceptions existent encore (sinon la liste ment)", () => {
    for (const f of [...DANS_UNE_SCENE_ZOOMEE, ...SANS_TEXTE])
      expect(EN_LIGNE.test(lire(f)), f).toBe(true);
  });

  it("la pastille du minuteur écarte le soulèvement des cartes au survol", () => {
    // `.card:hover { translate: 0 -2px }` : 2,2 px à 110 %, donc de nouveau à
    // cheval sur les pixels.
    const classes = sansCommentaires(lire("src/components/timer/PastilleSeance.tsx")).match(
      /className=\{`[^`]*\bcard\b[^`]*\bfixed\b[^`]*`/,
    )?.[0];
    expect(classes, "pastille introuvable").toBeTruthy();
    for (const c of ["translate-none", "inset-x-0", "mx-auto", "w-fit"]) expect(classes).toContain(c);
  });
});
