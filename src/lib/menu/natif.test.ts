/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from "vitest";
import { zoneDeTexte } from "./natif";

function el(html: string): Element {
  const hote = document.createElement("div");
  hote.innerHTML = html;
  return hote.firstElementChild!;
}

describe("là où le menu natif doit RESTER", () => {
  it("dans un champ de saisie", () => {
    expect(zoneDeTexte(el("<input />"), "")).toBe(true);
  });

  it("dans une zone de texte", () => {
    expect(zoneDeTexte(el("<textarea></textarea>"), "")).toBe(true);
  });

  it("dans un contenteditable", () => {
    expect(zoneDeTexte(el('<div contenteditable="true"></div>'), "")).toBe(true);
  });

  it("⭐ sur un ENFANT d'un contenteditable", () => {
    // Le clic tombe sur le <b>, le <p> ou le <svg> d'une carte mentale —
    // jamais sur l'élément qui porte l'attribut.
    const editeur = el('<div contenteditable="true"><p><b id="gras">mot</b></p></div>');
    document.body.append(editeur);
    expect(zoneDeTexte(editeur.querySelector("#gras"), "")).toBe(true);
    editeur.remove();
  });

  it("⭐ dès qu'il y a une SÉLECTION, même hors d'un champ", () => {
    // Copier et Rechercher ont un sens sur du texte non modifiable.
    expect(zoneDeTexte(el("<p>du texte</p>"), "du texte")).toBe(true);
  });
});

describe("là où le menu natif doit PARTIR", () => {
  it("sur un paragraphe ordinaire, sans sélection", () => {
    expect(zoneDeTexte(el("<p>du texte</p>"), "")).toBe(false);
  });

  it("sur un bouton", () => {
    expect(zoneDeTexte(el("<button>ok</button>"), "")).toBe(false);
  });

  it("sur rien du tout", () => {
    expect(zoneDeTexte(null, "")).toBe(false);
  });

  it("une sélection faite uniquement d'espaces ne compte pas", () => {
    expect(zoneDeTexte(el("<p>x</p>"), "   \n ")).toBe(false);
  });

  it("un contenteditable=false n'est pas une zone de texte", () => {
    expect(zoneDeTexte(el('<div contenteditable="false"></div>'), "")).toBe(false);
  });
});
