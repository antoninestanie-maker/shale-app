// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { jetonMention } from "./mentions";
import { marquerJeton, poserCurseurApresJeton } from "./mentionsDom";

/**
 * Constat 9 de l'audit du 2026-10-20 : après une mention « @ », le texte tapé
 * s'écrivait DEVANT la pastille (« Before is done@Prospecting »). Chrome
 * laisse le curseur devant un fragment qui commence par un élément non
 * éditable ; on le repose après.
 */
describe("le curseur après une mention", () => {
  it("le jeton reçoit un repère, et un seul", () => {
    const html = marquerJeton(jetonMention("task", "t1", "Prospection"));
    expect(html.startsWith('<span data-mention-neuve=""')).toBe(true);
    expect(html.match(/data-mention-neuve/g)).toHaveLength(1);
  });

  it("⭐ le curseur va APRÈS l'espace qui suit le jeton, et le repère disparaît", () => {
    const racine = document.createElement("div");
    racine.contentEditable = "true";
    racine.innerHTML = `<p>Before ${marquerJeton(jetonMention("task", "t1", "Prospection"))} </p>`;
    document.body.appendChild(racine);
    // Le curseur là où Chrome le laisse : devant le jeton.
    const p = racine.querySelector("p")!;
    const sel = window.getSelection()!;
    const r = document.createRange();
    r.setStart(p.firstChild!, 7);
    sel.removeAllRanges();
    sel.addRange(r);

    poserCurseurApresJeton(racine);

    const jeton = racine.querySelector("[data-mention]")!;
    expect(jeton.hasAttribute("data-mention-neuve")).toBe(false);
    const ici = sel.getRangeAt(0);
    expect(ici.startContainer).toBe(jeton.nextSibling);
    expect(ici.startOffset).toBe(1);
    racine.remove();
  });

  it("sans espace derrière le jeton, il en pose un (le curseur ne reste pas prisonnier)", () => {
    const racine = document.createElement("div");
    racine.innerHTML = `<p>${marquerJeton(jetonMention("note", "n1", "Idées"))}</p>`;
    document.body.appendChild(racine);
    poserCurseurApresJeton(racine);
    const jeton = racine.querySelector("[data-mention]")!;
    expect(jeton.nextSibling?.textContent).toBe(" ");
    racine.remove();
  });
});
