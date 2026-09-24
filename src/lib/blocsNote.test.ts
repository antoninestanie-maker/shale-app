// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { blocSous, retirerBloc } from "./blocsNote";

function note(html: string): HTMLElement {
  const racine = document.createElement("div");
  racine.setAttribute("contenteditable", "true");
  racine.innerHTML = html;
  document.body.appendChild(racine);
  return racine;
}

describe("blocSous — lequel est sous le pointeur", () => {
  it("une carte : c'est la FIGURE qu'on retire, même quand le clic tombe dans son SVG", () => {
    const r = note('<p>a</p><figure data-mindmap="{}"><svg><text>nœud</text></svg></figure><p>b</p>');
    const texte = r.querySelector("text")!;
    const b = blocSous(texte, r)!;
    expect(b.type).toBe("carte");
    expect(b.element.tagName).toBe("FIGURE");
  });

  it("un croquis se distingue d'une image par data-sketch, et part avec sa figure", () => {
    const r = note('<figure><img data-sketch="{}" src="x"></figure><figure><img src="y"></figure>');
    const [croquis, image] = r.querySelectorAll("img");
    expect(blocSous(croquis, r)).toMatchObject({ type: "croquis" });
    expect(blocSous(croquis, r)!.element.tagName).toBe("FIGURE");
    expect(blocSous(image, r)).toMatchObject({ type: "image" });
  });

  it("une pièce jointe : le jeton, depuis son enfant", () => {
    const r = note('<p>voir <span class="piece-jointe" data-fichier="u1" data-nom="devis.pdf"><b>PDF</b> devis.pdf</span></p>');
    const b = blocSous(r.querySelector("b"), r)!;
    expect(b.type).toBe("piece");
    expect(b.element.dataset.fichier).toBe("u1");
  });

  it("du texte ordinaire n'est pas un bloc — le menu du système reste", () => {
    const r = note("<p>du <b>texte</b></p>");
    expect(blocSous(r.querySelector("b"), r)).toBeNull();
  });

  it("un bloc HORS de la racine n'est pas le sien", () => {
    const r = note("<p>a</p>");
    const autre = note('<figure data-mindmap="{}"><svg></svg></figure>');
    expect(blocSous(autre.querySelector("svg"), r)).toBeNull();
  });
});

describe("retirerBloc — et le remettre à sa place exacte", () => {
  it("remet le bloc entre ses deux voisins d'origine", () => {
    const r = note('<p>avant</p><figure data-mindmap="{}"></figure><p>après</p>');
    const remettre = retirerBloc(blocSous(r.querySelector("figure"), r)!);
    expect(r.querySelector("figure")).toBeNull();
    expect(remettre()).toBe(true);
    expect([...r.children].map((e) => e.tagName)).toEqual(["P", "FIGURE", "P"]);
  });

  it("en dernière position, il revient en dernier même si le voisin a disparu", () => {
    const r = note('<p>a</p><figure><img src="x"></figure><p id="v">b</p>');
    const remettre = retirerBloc(blocSous(r.querySelector("img"), r)!);
    r.querySelector("#v")!.remove();
    expect(remettre()).toBe(true);
    expect(r.lastElementChild!.tagName).toBe("FIGURE");
  });

  it("la note a été remplacée entre-temps : rien n'est remis, et on le DIT (false)", () => {
    const r = note('<figure data-mindmap="{}"></figure>');
    const remettre = retirerBloc(blocSous(r.querySelector("figure"), r)!);
    r.remove();
    expect(remettre()).toBe(false);
  });
});
