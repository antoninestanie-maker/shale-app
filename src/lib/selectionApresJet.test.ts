import { describe, expect, it } from "vitest";
import { selectionApresJet } from "./selectionApresJet";

/** savoir-9 (audit du 2026-10-20) : « Annuler » refermait la note ouverte depuis. */
describe("selectionApresJet", () => {
  it("au jet, la note ouverte se ferme", () => {
    expect(selectionApresJet("jet", 1, true, 1)).toBe(null);
  });
  it("⭐ jeter A, ouvrir B, Annuler : B reste ouverte", () => {
    expect(selectionApresJet("retour", 1, true, 2)).toBe(2);
  });
  it("jeter A, ne rien ouvrir, Annuler : A est rouverte", () => {
    expect(selectionApresJet("retour", 1, true, null)).toBe(1);
  });
  it("jeter une note qui n'était pas ouverte ne touche à rien", () => {
    expect(selectionApresJet("jet", 1, false, 2)).toBe(2);
    expect(selectionApresJet("retour", 1, false, null)).toBe(null);
  });
});
