// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import HorlogeVolets from "./HorlogeVolets";

// ⚠️ Ce test prouve la MÉCANIQUE de la bascule (quelle moitié porte quel
// chiffre, et que le volet animé est remonté à chaque changement) — pas son
// rendu. La géométrie et le mouvement se regardent à l'écran (PIEGES § 7.1).

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let conteneur: HTMLElement;
let racine: Root;

beforeEach(() => {
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
});

afterEach(() => {
  act(() => racine.unmount());
  conteneur.remove();
});

function rendre(restantSec: number, options: { avecHeures?: boolean; enPause?: boolean } = {}) {
  act(() =>
    racine.render(
      createElement(HorlogeVolets, {
        restantSec,
        avecHeures: options.avecHeures ?? false,
        enPause: options.enPause,
      }),
    ),
  );
}

const volets = () => [...conteneur.querySelectorAll<HTMLElement>(".volet")];
const texte = (volet: HTMLElement, sel: string) =>
  volet.querySelector(`${sel} > span`)?.textContent ?? null;
/** Les moitiés FIXES (hors volets animés). */
const fixe = (volet: HTMLElement, cote: "haut" | "bas") =>
  texte(volet, `.volet-${cote}:not(.volet-tombe):not(.volet-arrive)`);

describe("HorlogeVolets", () => {
  it("au premier affichage : deux cartes, rien ne bascule", () => {
    rendre(36 * 60 + 50);
    const [min, sec] = volets();
    expect(volets()).toHaveLength(2);
    expect(fixe(min, "haut")).toBe("36");
    expect(fixe(sec, "bas")).toBe("50");
    expect(conteneur.querySelector(".volet-tombe, .volet-arrive")).toBeNull();
  });

  it("à la seconde suivante : seul le volet des secondes bascule, de l'ancien vers le nouveau", () => {
    rendre(36 * 60 + 50);
    rendre(36 * 60 + 49);
    const [min, sec] = volets();

    // Les minutes n'ont pas changé : aucun volet animé.
    expect(min.querySelector(".volet-tombe, .volet-arrive")).toBeNull();

    // En haut, la nouvelle valeur attend sous le volet qui tombe (l'ancienne).
    expect(fixe(sec, "haut")).toBe("49");
    expect(texte(sec, ".volet-tombe")).toBe("50");
    // En bas, l'ancienne reste jusqu'à ce que le nouveau volet la recouvre.
    expect(fixe(sec, "bas")).toBe("50");
    expect(texte(sec, ".volet-arrive")).toBe("49");
  });

  it("chaque changement REMONTE les volets animés — la bascule se rejoue sans animationend", () => {
    rendre(100);
    rendre(99);
    const avant = conteneur.querySelector(".volet-arrive");
    expect(avant).not.toBeNull();
    rendre(98);
    const apres = conteneur.querySelector(".volet-arrive");
    expect(avant?.isConnected).toBe(false);
    expect(apres).not.toBe(avant);
    expect(texte(volets()[1], ".volet-tombe")).toBe("39");
    expect(texte(volets()[1], ".volet-arrive")).toBe("38");
  });

  it("le passage d'une minute bascule les DEUX cartes", () => {
    rendre(5 * 60);
    rendre(5 * 60 - 1);
    const [min, sec] = volets();
    expect(texte(min, ".volet-tombe")).toBe("05");
    expect(texte(min, ".volet-arrive")).toBe("04");
    expect(texte(sec, ".volet-tombe")).toBe("00");
    expect(texte(sec, ".volet-arrive")).toBe("59");
  });

  it("avec les heures : trois cartes", () => {
    rendre(90 * 60, { avecHeures: true });
    expect(volets().map((v) => fixe(v, "haut"))).toEqual(["01", "30", "00"]);
  });

  it("la pause se lit sur le conteneur (les chiffres s'effacent par la feuille de style)", () => {
    rendre(60, { enPause: true });
    expect(conteneur.querySelector(".volets")?.hasAttribute("data-pause")).toBe(true);
    rendre(60, { enPause: false });
    expect(conteneur.querySelector(".volets")?.hasAttribute("data-pause")).toBe(false);
  });
});
