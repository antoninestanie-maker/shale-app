import { describe, expect, it } from "vitest";
import { actionDe, rangParLettre, rangSuivant } from "./clavier";
import type { EntreeMenu } from "./entrees";

const e = (id: string, libelle: string, grise = false): EntreeMenu => ({
  id,
  libelle,
  icone: null,
  executer: () => {},
  ...(grise ? { desactive: { raison: "parce que" } } : {}),
});

const MENU = [e("a", "Renommer"), e("b", "Dupliquer"), e("c", "Dater"), e("d", "Supprimer")];

describe("la circulation", () => {
  it("part sur la première entrée quand rien n'a le focus", () => {
    expect(rangSuivant(MENU, -1, "bas")).toBe(0);
  });

  it("part sur la dernière avec ↑", () => {
    expect(rangSuivant(MENU, -1, "haut")).toBe(3);
  });

  it("⭐ BOUCLE en bas de liste", () => {
    // Un menu où ↓ s'arrête au bout oblige à compter ses appuis.
    expect(rangSuivant(MENU, 3, "bas")).toBe(0);
  });

  it("boucle en haut de liste", () => {
    expect(rangSuivant(MENU, 0, "haut")).toBe(3);
  });

  it("Début et Fin vont aux bouts", () => {
    expect(rangSuivant(MENU, 2, "debut")).toBe(0);
    expect(rangSuivant(MENU, 2, "fin")).toBe(3);
  });
});

describe("les entrées grisées", () => {
  const avecTrou = [e("a", "Renommer"), e("b", "Dupliquer", true), e("c", "Dater")];

  it("⭐ SAUTE une entrée grisée au lieu de s'y arrêter", () => {
    // Une entrée grisée qui prend le focus donne un menu où Entrée ne fait
    // rien : au clavier, on croit le menu cassé.
    expect(rangSuivant(avecTrou, 0, "bas")).toBe(2);
  });

  it("la saute aussi en remontant", () => {
    expect(rangSuivant(avecTrou, 2, "haut")).toBe(0);
  });

  it("Début tombe sur la première ACTIVABLE", () => {
    const debutGrise = [e("a", "Renommer", true), e("b", "Dupliquer")];
    expect(rangSuivant(debutGrise, -1, "debut")).toBe(1);
  });

  it("ne boucle pas à l'infini quand TOUT est grisé", () => {
    const tout = [e("a", "Renommer", true), e("b", "Dupliquer", true)];
    expect(rangSuivant(tout, -1, "bas")).toBe(-1);
  });

  it("rend -1 sur un menu vide", () => {
    expect(rangSuivant([], -1, "bas")).toBe(-1);
  });
});

describe("la recherche par première lettre", () => {
  it("mène à l'entrée qui commence par la lettre", () => {
    expect(rangParLettre(MENU, -1, "s")).toBe(3);
  });

  it("⭐ enchaîne les homonymes : deux « d » passent de Dater à Dupliquer", () => {
    expect(rangParLettre(MENU, -1, "d")).toBe(1); // Dupliquer
    expect(rangParLettre(MENU, 1, "d")).toBe(2); // Dater
    expect(rangParLettre(MENU, 2, "d")).toBe(1); // et on reboucle
  });

  it("ignore la casse", () => {
    expect(rangParLettre(MENU, -1, "R")).toBe(0);
  });

  it("rend -1 quand rien ne commence par la lettre", () => {
    expect(rangParLettre(MENU, -1, "z")).toBe(-1);
  });
});

describe("la table des touches", () => {
  it("associe les flèches, Début, Fin, Entrée et Échap", () => {
    expect(actionDe("ArrowDown", false)).toEqual({ quoi: "deplacer", touche: "bas" });
    expect(actionDe("ArrowUp", false)).toEqual({ quoi: "deplacer", touche: "haut" });
    expect(actionDe("Home", false)).toEqual({ quoi: "deplacer", touche: "debut" });
    expect(actionDe("End", false)).toEqual({ quoi: "deplacer", touche: "fin" });
    expect(actionDe("Enter", false)).toEqual({ quoi: "executer" });
    expect(actionDe("Escape", false)).toEqual({ quoi: "fermer" });
  });

  it("→ ouvre un sous-menu", () => {
    expect(actionDe("ArrowRight", false)).toEqual({ quoi: "ouvrirSousMenu" });
  });

  it("⭐ ← ne fait RIEN dans le menu principal, et ferme le sous-menu", () => {
    // Fermer sur ← surprendrait quelqu'un qui corrige sa frappe : un menu
    // contextuel n'a pas de barre de menus à gauche où aller.
    expect(actionDe("ArrowLeft", false)).toBeNull();
    expect(actionDe("ArrowLeft", true)).toEqual({ quoi: "fermerSousMenu" });
  });

  it("une lettre est une lettre, Tab n'en est pas une", () => {
    expect(actionDe("d", false)).toEqual({ quoi: "lettre", lettre: "d" });
    expect(actionDe("é", false)).toEqual({ quoi: "lettre", lettre: "é" });
    expect(actionDe("Tab", false)).toBeNull();
    expect(actionDe("F5", false)).toBeNull();
  });
});
