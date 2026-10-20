import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Les fenêtres de saisie — deux règles que rien d'autre ne tient (2026-10-12).
 *
 * 1. LE PIED RESTE, LE CORPS DÉFILE. Crible du labo, constat 20 (témoin
 *    A17-15) : « Créer » passait sous le bas de « Nouvel objectif », au bureau
 *    à 900 px de haut comme au téléphone. La carte entière défilait, boutons
 *    compris. La charpente est dans `index.css` (`.fenetre`, `.fenetre-corps`,
 *    `.fenetre-pied`, `.fenetre-voile`).
 *
 * 2. ÉCHAP NE FERME QU'UN ÉTAGE. Témoin A17-01 : Échap sur le calendrier de
 *    date fermait toute la fenêtre, saisie comprise. Les deux écoutaient
 *    `window` en phase de remontée, où l'on passe dans l'ordre de POSE : la
 *    fenêtre lisait la touche avant que le calendrier ne l'ait marquée. Le
 *    calendrier écoute donc en CAPTURE, et chaque fenêtre lit `defaultPrevented`.
 *
 * ⚠️ Un test de SOURCE, parce qu'aucun test de ce dépôt ne rend une interface
 * (`vitest.config.ts` : environnement `node`, sans JSX). Il ne prouve pas
 * l'écran — les captures du chantier le font — il empêche de défaire la règle
 * sans s'en apercevoir.
 */
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const lire = (chemin: string) => readFileSync(resolve(SRC, chemin), "utf-8");
const sansCommentaires = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const css = sansCommentaires(lire("index.css"));

/** Le corps d'une règle CSS, par son sélecteur exact. */
function regle(selecteur: string): string {
  const debut = css.indexOf(`${selecteur} {`);
  if (debut < 0) return "";
  return css.slice(debut, css.indexOf("}", debut));
}

function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersTsx(chemin);
    return nom.endsWith(".tsx") ? [chemin] : [];
  });
}

/** Les fenêtres de saisie dont le pied porte les boutons de validation. */
const A_TROIS_ETAGES = [
  "components/GoalModal.tsx",
  "components/TaskModal.tsx",
  "components/calendrier/EventModal.tsx",
  "components/TradeModal.tsx",
  "components/liens/EditeurType.tsx",
  "components/objectifs/ImporterChecklist.tsx",
];

describe("Fenêtres de saisie : le pied reste, le corps défile", () => {
  it("la carte est une colonne bornée par son voile, et elle ne défile pas elle-même", () => {
    const fenetre = regle(".fenetre");
    expect(fenetre).toContain("flex-direction: column");
    expect(fenetre).toContain("max-height: 100%");
    expect(fenetre).toContain("overflow: hidden");
  });

  it("seul le corps défile ; le pied ne rétrécit jamais", () => {
    expect(regle(".fenetre-corps")).toContain("overflow-y: auto");
    expect(regle(".fenetre-corps")).toContain("min-height: 0");
    expect(regle(".fenetre-pied")).toContain("flex: none");
  });

  it("⚠️ le corps défile sans COMPRIMER ses champs (un corps en colonne flex les écrasait)", () => {
    expect(regle(".fenetre-corps > *")).toContain("flex-shrink: 0");
  });

  it("au téléphone, le voile réserve la barre d'onglets et l'encoche", () => {
    const voile = regle("html[data-telephone] .fenetre-voile");
    expect(voile).toContain("env(safe-area-inset-bottom)");
    expect(voile).toContain("env(safe-area-inset-top)");
    // La barre d'onglets fait 4,25 rem (`App.tsx`) : la réserve doit la dépasser.
    const reserve = /padding-bottom:\s*calc\(env\(safe-area-inset-bottom\) \+ ([\d.]+)rem/.exec(voile);
    expect(reserve).not.toBeNull();
    expect(Number(reserve![1])).toBeGreaterThanOrEqual(4.25);
  });

  it.each(A_TROIS_ETAGES)("%s : voile, carte, corps PUIS pied", (chemin) => {
    const code = sansCommentaires(lire(chemin));
    expect(code).toContain("fenetre-voile");
    expect(code).toMatch(/className="[^"]*\bfenetre\b[^"]*"/);
    const corps = code.indexOf("fenetre-corps");
    const pied = code.indexOf("fenetre-pied");
    expect(corps).toBeGreaterThan(-1);
    expect(pied).toBeGreaterThan(corps);
  });

  it.each(A_TROIS_ETAGES)("%s : la carte n'a plus ni défilement ni hauteur en vh à elle", (chemin) => {
    const code = sansCommentaires(lire(chemin));
    const carte = /className="([^"]*\bfenetre\b[^"]*)"/.exec(code)![1];
    expect(carte).not.toContain("overflow-y-auto");
    expect(carte).not.toMatch(/max-h-\[calc\(\d+vh/);
  });

  it("⭐ aucune fenêtre centrée sur un voile n'est laissée sans borne de hauteur", () => {
    // Un voile plein écran qui centre une carte (`items-center justify-center`) :
    // sa carte doit être bornée — par `.fenetre`, ou par un `max-h-*` à elle.
    const fautives: string[] = [];
    for (const fichier of fichiersTsx(SRC)) {
      // Deux autres chantiers tiennent ces dossiers ; l'accueil a sa propre charpente.
      if (/\/onboarding\//.test(fichier)) continue;
      const code = sansCommentaires(readFileSync(fichier, "utf-8"));
      const re = /className="([^"]*\bfixed inset-0\b[^"]*\bitems-center justify-center\b[^"]*)"/g;
      for (let m = re.exec(code); m; m = re.exec(code)) {
        if (/pointer-events-none/.test(m[1])) continue; // un simple voile d'attente
        const suite = code.slice(m.index, m.index + 900);
        const bornee = /\bfenetre\b(?!-)/.test(suite.replace("fenetre-voile", "")) || /\bmax-h-/.test(suite);
        if (!bornee) fautives.push(relative(SRC, fichier));
      }
    }
    expect(fautives).toEqual([]);
  });
});

describe("Échap ne ferme qu'un étage", () => {
  it("⭐ le calendrier de date écoute Échap en phase de CAPTURE", () => {
    const code = sansCommentaires(lire("components/ChampDate.tsx"));
    expect(code).toContain('window.addEventListener("keydown", touche, true)');
    // Posé en capture, retiré en capture : sinon l'écouteur survit au panneau.
    expect(code).toContain('window.removeEventListener("keydown", touche, true)');
    expect(code).not.toContain('window.addEventListener("keydown", touche)');
  });

  it("il marque la touche, et laisse le clavier à un menu contextuel ouvert", () => {
    const code = sansCommentaires(lire("components/ChampDate.tsx"));
    const ecouteur = code.slice(code.indexOf("const touche = (e: KeyboardEvent)"));
    const corps = ecouteur.slice(0, ecouteur.indexOf("};"));
    expect(corps).toContain("e.defaultPrevented");
    expect(corps).toContain("menuContextuelOuvert()");
    expect(corps).toContain("e.preventDefault()");
  });

  it.each([
    "components/GoalModal.tsx",
    "components/TaskModal.tsx",
    "components/calendrier/EventModal.tsx",
    "components/TradeModal.tsx",
  ])("%s lit `defaultPrevented` avant de se fermer, puis marque à son tour", (chemin) => {
    const code = sansCommentaires(lire(chemin));
    const debut = code.indexOf("const onKey = (e: KeyboardEvent)");
    expect(debut).toBeGreaterThan(-1);
    const corps = code.slice(debut, code.indexOf("window.addEventListener", debut));
    expect(corps).toContain("Escape");
    expect(corps).toContain("e.defaultPrevented");
    expect(corps).toContain("e.preventDefault()");
    // Le garde vient AVANT la fermeture. Depuis le 2026-10-20 (audit, constat
    // 39), « Nouvelle tâche » ne ferme pas d'office : elle passe par
    // `demanderFermeture()`, qui demande si la saisie a changé.
    const fermeture = corps.includes("onClose()") ? "onClose()" : "demanderFermeture()";
    expect(corps).toContain(fermeture);
    expect(corps.indexOf("e.defaultPrevented")).toBeLessThan(corps.indexOf(fermeture));
  });
});

describe("Au doigt : 44 pt sans y penser", () => {
  it("un bouton en pastille et un champ de saisie ont un plancher de 44 px sous pointeur grossier", () => {
    const debut = css.indexOf("button.pill:not([role=\"switch\"])");
    expect(debut).toBeGreaterThan(-1);
    // La règle vit DANS un bloc `pointer: coarse` : le bureau ne gonfle pas.
    const avant = css.slice(0, debut);
    const dernierMedia = avant.lastIndexOf("@media (pointer: coarse)");
    expect(dernierMedia).toBeGreaterThan(-1);
    expect(avant.slice(dernierMedia)).not.toMatch(/\n  \}\n/); // le bloc n'est pas refermé entre-temps
    const bloc = css.slice(debut, css.indexOf("}", css.indexOf("select:not(.cible-libre)", debut)));
    expect(bloc.match(/min-height: 44px/g)?.length).toBe(2);
  });

  it("⚠️ la règle vise `button.pill`, jamais `.pill` seul (jauges et badges portent la classe)", () => {
    expect(css).not.toMatch(/\n\s*\.pill\s*\{[^}]*min-height: 44px/);
  });
});
