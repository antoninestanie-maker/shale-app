/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it } from "vitest";
import { rendreLeFocus } from "./useMenuContextuel";

/**
 * ⭐ « ⋯ › Renommer » ne faisait rien (crible du labo du 2026-10-11, constat 11 ;
 * audit A11-08). Le champ de renommage s'ouvrait, puis le retour de focus du
 * menu le reprenait pour le rendre au bouton « ⋯ » : le champ perdait le focus,
 * ce qui VALIDE le renommage — il se refermait aussitôt. Au téléphone, « ⋯ »
 * est le seul accès au menu.
 */
describe("rendreLeFocus — à la fermeture d'un menu", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  const monter = (html: string) => {
    document.body.innerHTML = html;
    return (id: string) => document.getElementById(id) as HTMLElement;
  };

  it("⭐ l'action a posé le focus dans un champ : il y RESTE", () => {
    const el = monter(`<button id="points">⋯</button><input id="champ" />`);
    el("champ").focus();
    expect(rendreLeFocus(el("points"), document.activeElement)).toBe(false);
    expect(document.activeElement).toBe(el("champ"));
  });

  it("le focus n'est nulle part (sur <body>) : il revient au bouton d'origine", () => {
    const el = monter(`<button id="points">⋯</button>`);
    expect(document.activeElement).toBe(document.body);
    expect(rendreLeFocus(el("points"), document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(el("points"));
  });

  it("le focus est encore dans le menu qu'on ferme : il revient au bouton d'origine", () => {
    const el = monter(
      `<button id="points">⋯</button><div data-menu-contextuel=""><button id="entree">Renommer</button></div>`,
    );
    el("entree").focus();
    expect(rendreLeFocus(el("points"), document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(el("points"));
  });

  it("le bouton d'origine a quitté le document (la ligne a été retirée) : rien", () => {
    const el = monter(`<button id="points">⋯</button>`);
    const points = el("points");
    points.remove();
    expect(rendreLeFocus(points, document.activeElement)).toBe(false);
  });
});
