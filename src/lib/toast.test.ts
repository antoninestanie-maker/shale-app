// La durée d'un toast — voir `dureeAffichage` dans `toast.ts`.
import { describe, expect, it } from "vitest";

import { DUREE_ANNULER } from "../components/corbeille/geste";
import { DUREE_GESTE_AU_DOIGT, dureeAffichage } from "./toast";

describe("dureeAffichage — au doigt, un toast à geste reste plus longtemps", () => {
  it("à la souris, la durée demandée est tenue telle quelle (le survol la suspend)", () => {
    expect(dureeAffichage({ duree: DUREE_ANNULER, aUnGeste: true, auDoigt: false })).toBe(DUREE_ANNULER);
    expect(dureeAffichage({ duree: 4500, aUnGeste: false, auDoigt: false })).toBe(4500);
  });

  it("⭐ au doigt, « Annuler » d'une suppression dure au moins quatorze secondes", () => {
    const attente = dureeAffichage({ duree: DUREE_ANNULER, aUnGeste: true, auDoigt: true });
    expect(attente).toBe(DUREE_GESTE_AU_DOIGT);
    expect(attente).toBeGreaterThan(DUREE_ANNULER);
  });

  it("au doigt, un toast SANS geste ne s'allonge pas : rien à toucher, rien à attendre", () => {
    expect(dureeAffichage({ duree: 4500, aUnGeste: false, auDoigt: true })).toBe(4500);
  });

  it("une durée déjà plus longue que le plancher n'est jamais raccourcie", () => {
    const longue = DUREE_GESTE_AU_DOIGT + 6000;
    expect(dureeAffichage({ duree: longue, aUnGeste: true, auDoigt: true })).toBe(longue);
  });

  it("le plancher laisse le temps de lire, décider et viser : plus de dix secondes", () => {
    expect(DUREE_GESTE_AU_DOIGT).toBeGreaterThanOrEqual(10_000);
  });
});
