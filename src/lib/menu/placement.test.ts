import { describe, expect, it } from "vitest";
import { ancrePerdue, MARGE, placer, placerSousMenu } from "./placement";

const FENETRE = { width: 1000, height: 800 };
const MENU = { width: 240, height: 200 };

/** Une ancre rectangulaire, façon bouton. */
const bouton = (top: number, left: number, w = 28, h = 28) => ({
  top,
  left,
  bottom: top + h,
  right: left + w,
});

/** Une ancre ponctuelle, façon curseur. */
const point = (x: number, y: number) => ({ top: y, bottom: y, left: x, right: x });

describe("le sens de déploiement", () => {
  it("s'ouvre vers le bas quand il y a la place", () => {
    const p = placer(bouton(100, 50), MENU, FENETRE, 1);
    expect(p).toEqual({ top: 132, left: 50 });
  });

  it("se retourne vers le haut quand le bas est trop court", () => {
    // Le bouton est à 40 px du bas : 200 px de menu n'y tiennent pas.
    const p = placer(bouton(760, 50), MENU, FENETRE, 1);
    expect(p).not.toBe("fermer");
    if (p === "fermer") return;
    // Au-dessus du bouton : 760 - 4 - 200 = 556.
    expect(p.top).toBe(556);
  });

  it("choisit le côté le PLUS grand quand aucun des deux ne suffit", () => {
    const grand = { width: 240, height: 700 };
    // Ancre à mi-hauteur : 380 px en dessous, 396 au-dessus → le haut gagne,
    // puis le bornage ramène le menu contre la marge haute.
    const p = placer(bouton(400, 50), grand, FENETRE, 1);
    expect(p).toEqual({ top: MARGE, left: 50 });
  });
});

describe("le bornage horizontal", () => {
  it("retourne vers la gauche quand le menu déborde à droite", () => {
    // Un clic à 900 px : 900 + 240 = 1140 > 1000 - 8.
    const p = placer(point(900, 300), MENU, FENETRE, 1, "debut");
    expect(p).toEqual({ top: 304, left: 660 });
  });

  it("aligne le « ⋯ » par sa DROITE", () => {
    const p = placer(bouton(100, 700), MENU, FENETRE, 1, "fin");
    // right = 728 ; 728 - 240 = 488.
    expect(p).toEqual({ top: 132, left: 488 });
  });

  it("retourne le « ⋯ » vers la droite quand la gauche manque", () => {
    const p = placer(bouton(100, 10), MENU, FENETRE, 1, "fin");
    // right = 38 ; 38 - 240 = -202 < 8 → on repart de left = 10.
    expect(p).toEqual({ top: 132, left: 10 });
  });

  it("borne dans une fenêtre plus étroite que le menu", () => {
    const p = placer(point(50, 50), MENU, { width: 200, height: 800 }, 1);
    expect(p).toEqual({ top: 54, left: MARGE });
  });
});

describe("PIEGES § 16.2 — l'ancre qui sort de l'écran", () => {
  it("reconnaît une ancre passée sous le bord bas", () => {
    expect(ancrePerdue(bouton(900, 50), FENETRE)).toBe(true);
  });

  it("reconnaît une ancre passée au-dessus du bord haut", () => {
    expect(ancrePerdue({ top: -60, bottom: -32, left: 50, right: 78 }, FENETRE)).toBe(true);
  });

  it("ne confond pas « à moitié visible » avec « perdue »", () => {
    expect(ancrePerdue({ top: -10, bottom: 18, left: 50, right: 78 }, FENETRE)).toBe(false);
  });

  it("⭐ REFERME plutôt que de recaler un menu détaché de son ancre", () => {
    // C'est le défaut payé le 2026-09-18 : « visible, ouvert, et invisible ».
    expect(placer(bouton(900, 50), MENU, FENETRE, 1)).toBe("fermer");
  });
});

describe("le zoom de densité", () => {
  it("divise les deux coordonnées par le facteur de zoom", () => {
    const normal = placer(bouton(100, 200), MENU, FENETRE, 1);
    const zoome = placer(bouton(100, 200), MENU, FENETRE, 1.25);
    expect(normal).toEqual({ top: 132, left: 200 });
    expect(zoome).toEqual({ top: 132 / 1.25, left: 200 / 1.25 });
  });
});

describe("le sous-menu", () => {
  it("se pose à droite du panneau parent, avec un chevauchement", () => {
    const parent = { top: 100, left: 50, bottom: 300, right: 290 };
    const entree = bouton(150, 60, 230, 28);
    const p = placerSousMenu(entree, parent, { width: 180, height: 120 }, FENETRE, 1);
    expect(p).toEqual({ top: 146, left: 286 });
  });

  it("bascule à gauche quand la droite manque", () => {
    const parent = { top: 100, left: 760, bottom: 300, right: 990 };
    const entree = bouton(150, 770, 210, 28);
    const p = placerSousMenu(entree, parent, { width: 180, height: 120 }, FENETRE, 1);
    expect(p).toEqual({ top: 146, left: 584 });
  });
});
