// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { blocsDeCascade, decoupe, flip } from "./transition";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

describe("decoupe — le rectangle de la carte, dans la colonne", () => {
  const colonne = rect(100, 0, 900, 800);
  it("laisse voir exactement la carte, arrondie comme elle", () => {
    expect(decoupe(colonne, rect(132, 120, 836, 62), "12px")).toBe("inset(120px 32px 618px 32px round 12px)");
  });
  it("densité 110 % : les pixels écran mesurés redeviennent locaux", () => {
    expect(decoupe(colonne, rect(133, 121, 834, 63), "12px", 1.1)).toBe("inset(110px 30px 560px 30px round 12px)");
    expect(flip(rect(150, 140, 200, 20), rect(128, 107, 400, 40), 15, 30, 1.1)).toBe("translate(20px, 30px) scale(0.5)");
  });
  it("la colonne entière : aucune découpe", () => {
    expect(decoupe(colonne, colonne, "12px")).toBe("inset(0px 0px 0px 0px round 12px)");
  });
});

describe("flip — poser le titre de la page sur celui de la carte", () => {
  it("déplace jusqu'à la carte, à l'échelle des corps de texte", () => {
    // Titre de carte en 15 px à (150, 140) ; titre de page en 30 px à (132, 110).
    expect(flip(rect(150, 140, 200, 20), rect(132, 110, 400, 40), 15, 30)).toBe("translate(18px, 30px) scale(0.5)");
  });
  it("un corps illisible ne casse rien : échelle 1", () => {
    expect(flip(rect(0, 0, 1, 1), rect(0, 0, 1, 1), 15, 0)).toBe("translate(0px, 0px) scale(1)");
  });
});

describe("blocsDeCascade — ce qui arrive en cascade", () => {
  it("tout, sauf ce qui voyage ; un bloc qui contient un voyageur s'ouvre", () => {
    document.body.innerHTML = `
      <div id="page">
        <div id="barre"></div>
        <section>
          <p id="etiquette"></p>
          <h1 data-partage="titre"></h1>
          <div><span id="fil"></span><span data-partage="pct"></span></div>
          <div id="etapes"></div>
        </section>
      </div>`;
    const ids = blocsDeCascade(document.getElementById("page")!).map((e) => e.id);
    expect(ids).toEqual(["barre", "etiquette", "fil", "etapes"]);
  });
});
