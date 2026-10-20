import { describe, expect, it } from "vitest";
import { gesteSuspendu, poserGarde, saisieModifiee } from "./saisieGardee";

/** Rang 13 du contrôle du 12/10 (audit du 2026-10-20) : une saisie jetée sans question. */
describe("saisieModifiee", () => {
  it("intacte : rien à demander", () => {
    expect(saisieModifiee({ titre: "", jours: [1] }, { titre: "", jours: [1] })).toBe(false);
  });
  it("taper puis effacer ne compte pas", () => {
    expect(saisieModifiee({ titre: "" }, { titre: "  " })).toBe(false);
  });
  it("un titre tapé, un jour coché : modifiée", () => {
    expect(saisieModifiee({ titre: "" }, { titre: "Appeler" })).toBe(true);
    expect(saisieModifiee({ jours: [1] }, { jours: [1, 3] })).toBe(true);
  });
});

describe("les gardes de navigation", () => {
  it("sans garde, le geste passe", () => {
    expect(gesteSuspendu(() => undefined)).toBe(false);
  });
  it("une garde qui intercepte suspend le geste, et le reprend elle-même", () => {
    let suite: (() => void) | null = null;
    const retirer = poserGarde((p) => {
      suite = p;
      return true;
    });
    let parti = false;
    expect(gesteSuspendu(() => (parti = true))).toBe(true);
    expect(parti).toBe(false);
    suite!();
    expect(parti).toBe(true);
    retirer();
    expect(gesteSuspendu(() => undefined)).toBe(false);
  });
});
