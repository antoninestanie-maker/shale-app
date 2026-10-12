import { describe, expect, it } from "vitest";
import { gesteAuClavier, LIBELLE_SANS_TACHE, nomDeLaSeance, type ToucheLue } from "./timerEcran";

const touche = (key: string, plus: Partial<ToucheLue> = {}): ToucheLue => ({
  key,
  defaultPrevented: false,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...plus,
});

/**
 * ⭐ Qui reçoit Espace quand l'horloge est ouverte (2026-10-12, constat 3).
 * L'horloge — et personne derrière elle : voir aussi `calque.test.ts`.
 */
describe("gesteAuClavier — l'horloge en grand", () => {
  it("⭐ Espace met en pause ou reprend", () => {
    expect(gesteAuClavier(touche(" "), false, true)).toBe("pause");
  });

  it("⭐ Échap sort — seulement s'il y a une sortie", () => {
    expect(gesteAuClavier(touche("Escape"), false, true)).toBe("sortir");
    expect(gesteAuClavier(touche("Escape"), false, false)).toBeNull();
    // Échap sort même depuis un bouton : il n'a pas d'effet natif sur lui.
    expect(gesteAuClavier(touche("Escape"), true, true)).toBe("sortir");
  });

  it("⚠️ Espace sur un bouton : son effet natif suffit — pas de double bascule, pas de pause avec « Terminer »", () => {
    expect(gesteAuClavier(touche(" "), true, true)).toBeNull();
  });

  it("une touche tenue ne bascule pas la pause en rafale", () => {
    expect(gesteAuClavier(touche(" ", { repeat: true }), false, true)).toBeNull();
  });

  it("une touche déjà prise, ou avec ⌘ / Ctrl / Alt, n'est pas pour l'horloge", () => {
    expect(gesteAuClavier(touche(" ", { defaultPrevented: true }), false, true)).toBeNull();
    expect(gesteAuClavier(touche("Escape", { defaultPrevented: true }), false, true)).toBeNull();
    expect(gesteAuClavier(touche(" ", { metaKey: true }), false, true)).toBeNull();
    expect(gesteAuClavier(touche(" ", { ctrlKey: true }), false, true)).toBeNull();
    expect(gesteAuClavier(touche("Escape", { altKey: true }), false, true)).toBeNull();
  });

  it("les autres touches ne font rien", () => {
    for (const k of ["Enter", "f", "k", "Tab", "ArrowDown"]) {
      expect(gesteAuClavier(touche(k), false, true)).toBeNull();
    }
  });
});

describe("nomDeLaSeance — sur quoi on travaille", () => {
  it("⭐ le nom de la tâche liée", () => {
    expect(nomDeLaSeance({ label: "Relancer le devis Lebrun", kind: "focus" }, "Session libre")).toBe(
      "Relancer le devis Lebrun",
    );
  });

  it("⭐ une séance sans tâche : « Session libre », pas « Focus »", () => {
    expect(nomDeLaSeance({ label: LIBELLE_SANS_TACHE, kind: "focus" }, "Session libre")).toBe("Session libre");
    expect(nomDeLaSeance({ label: "  ", kind: "focus" }, "Session libre")).toBe("Session libre");
  });

  it("un intitulé tapé dans la palette se lit tel quel", () => {
    expect(nomDeLaSeance({ label: "Préparer l'oral", kind: "focus" }, "Session libre")).toBe("Préparer l'oral");
  });

  it("une pause n'a pas de nom : le genre de séance le dit déjà", () => {
    expect(nomDeLaSeance({ label: "Pause", kind: "break" }, "Session libre")).toBeNull();
  });
});
