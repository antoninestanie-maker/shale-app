/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { confierLeRetour, ouvrirCalque, rendreLeResteInerte } from "./calque";
import { rendreLeFocus } from "../components/menu/useMenuContextuel";

/**
 * ⭐ Un calque plein écran prend la main, et la rend (2026-10-12).
 *
 * Seconde passe du labo, constats 1 et 3 : « ⋯ › Focus 25 min » ouvrait
 * l'horloge en plein écran, le focus restait sur le « ⋯ » de la tâche, DESSOUS.
 * Espace rouvrait le menu de la tâche par-dessus l'horloge ; un second Espace
 * la marquait faite.
 */
const monter = () => {
  document.body.innerHTML = `
    <div id="root">
      <button id="points">⋯</button>
      <button id="autre">autre</button>
    </div>
    <div id="calque" tabindex="-1"><button id="pause">Pause</button></div>`;
  return (id: string) => document.getElementById(id) as HTMLElement;
};

describe("ouvrirCalque — l'horloge plein écran", () => {
  afterEach(() => {
    document.getElementById("root")?.removeAttribute("inert");
    document.body.innerHTML = "";
  });

  it("⭐ à l'ouverture : l'app est inerte, et le focus est DANS le calque", () => {
    const el = monter();
    el("points").focus();
    const fermer = ouvrirCalque(el("calque"));
    expect(el("root").hasAttribute("inert")).toBe(true);
    expect(document.activeElement).toBe(el("calque"));
    fermer();
  });

  it("⭐ à la fermeture : l'app se rallume, et le focus revient d'où l'on venait", () => {
    const el = monter();
    el("points").focus();
    const fermer = ouvrirCalque(el("calque"));
    fermer();
    expect(el("root").hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(el("points"));
  });

  it("l'élément d'origine a quitté le document : la fermeture ne casse rien", () => {
    const el = monter();
    el("points").focus();
    const fermer = ouvrirCalque(el("calque"));
    el("points").remove();
    expect(() => fermer()).not.toThrow();
    expect(el("root").hasAttribute("inert")).toBe(false);
  });

  it("⭐ le menu rend le focus APRÈS l'ouverture du calque : le « ⋯ » ne le reçoit pas, le calque le garde pour la fin", () => {
    const el = monter();
    // L'entrée « Focus 25 min » vient d'être cliquée : le focus n'est nulle part.
    const fermer = ouvrirCalque(el("calque"));
    // Une image plus tard, le menu veut rendre le focus à son bouton « ⋯ ».
    expect(rendreLeFocus(el("points"), document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(el("calque"));
    // À la fermeture de l'horloge, le « ⋯ » retrouve le focus.
    fermer();
    expect(document.activeElement).toBe(el("points"));
  });

  it("le menu a rendu le focus AVANT l'ouverture du calque : même résultat", () => {
    const el = monter();
    expect(rendreLeFocus(el("points"), document.activeElement)).toBe(true);
    const fermer = ouvrirCalque(el("calque"));
    expect(document.activeElement).toBe(el("calque"));
    fermer();
    expect(document.activeElement).toBe(el("points"));
  });

  it("le premier arrivé est l'origine : un retour confié ensuite ne la remplace pas", () => {
    const el = monter();
    el("points").focus();
    const fermer = ouvrirCalque(el("calque"));
    expect(confierLeRetour(el("autre"))).toBe(true);
    fermer();
    expect(document.activeElement).toBe(el("points"));
  });

  it("aucun calque ouvert : rien à qui confier le retour", () => {
    const el = monter();
    expect(confierLeRetour(el("points"))).toBe(false);
  });

  it("une entrée de menu encore dans le document n'est pas une origine : elle va disparaître", () => {
    document.body.innerHTML = `
      <div id="root"><button id="points">⋯</button></div>
      <div data-menu-contextuel=""><button id="entree">Focus 25 min</button></div>
      <div id="calque" tabindex="-1"></div>`;
    const el = (id: string) => document.getElementById(id) as HTMLElement;
    el("entree").focus();
    const fermer = ouvrirCalque(el("calque"));
    rendreLeFocus(el("points"), document.activeElement);
    fermer();
    expect(document.activeElement).toBe(el("points"));
  });
});

describe("rendreLeResteInerte — `inert` se compte", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("deux calques l'un sur l'autre : le premier fermé ne rallume pas l'app", () => {
    const el = monter();
    const carte = rendreLeResteInerte();
    const horloge = rendreLeResteInerte();
    horloge();
    expect(el("root").hasAttribute("inert")).toBe(true);
    // Rappelée deux fois, la même fermeture ne compte qu'une fois.
    horloge();
    expect(el("root").hasAttribute("inert")).toBe(true);
    carte();
    expect(el("root").hasAttribute("inert")).toBe(false);
  });
});

/**
 * ⚠️ Tests de SOURCE : aucun test de ce dépôt ne rend une interface. Ils ne
 * prouvent pas l'écran — les captures du chantier le font — ils empêchent de
 * défaire la règle sans s'en apercevoir.
 */
describe("la règle tient partout", () => {
  const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const lire = (chemin: string) => readFileSync(resolve(SRC, chemin), "utf-8");
  const sansCommentaires = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const sources = (dossier: string): string[] =>
    readdirSync(dossier).flatMap((nom) => {
      const chemin = join(dossier, nom);
      if (statSync(chemin).isDirectory()) return sources(chemin);
      return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
    });

  it("⭐ personne ne pose `inert` sur l'app à la main : tout passe par le compteur", () => {
    const fautifs = sources(SRC)
      .filter((f) => relative(SRC, f) !== join("lib", "calque.ts"))
      .filter((f) => /setAttribute\(\s*["']inert["']/.test(sansCommentaires(readFileSync(f, "utf-8"))))
      .map((f) => relative(SRC, f));
    expect(fautifs).toEqual([]);
  });

  it("⭐ les calques plein écran rendent le reste inerte : l'horloge, la carte mentale, le croquis", () => {
    expect(sansCommentaires(lire("components/FocusOverlay.tsx"))).toContain("ouvrirCalque(");
    for (const f of ["components/carte/EditeurCarte.tsx", "components/SketchPad.tsx"]) {
      expect(sansCommentaires(lire(f)), f).toContain("rendreLeResteInerte()");
    }
  });

  it("⭐ l'horloge plein écran de l'app montre ses commandes et tient le clavier", () => {
    const calque = sansCommentaires(lire("components/FocusOverlay.tsx"));
    // Ni horloge seule, ni clavier partagé avec la page de derrière.
    expect(calque).not.toMatch(/<EcranTimer[^>]*\bepure\b/);
    expect(calque).toContain("clavierExclusif");
    expect(calque).toContain('t("Réduire|séance")');
    // Porté hors de `#root`, sinon il s'éteindrait lui-même (PIEGES § 18.1).
    expect(calque).toContain("document.body");
    const ecran = sansCommentaires(lire("components/timer/EcranTimer.tsx"));
    for (const mot of ['t("Pause")', 't("Reprendre")', 't("Terminer")']) expect(ecran).toContain(mot);
  });
});
