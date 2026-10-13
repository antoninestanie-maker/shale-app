// La durée d'un toast — voir `dureeAffichage` dans `toast.ts`.
import { describe, expect, it } from "vitest";

import { DUREE_ANNULER } from "../components/corbeille/geste";
import {
  DUREE_GESTE_AU_DOIGT,
  SURSIS_APRES_SURVOL,
  dureeAffichage,
  plafondAffichage,
  resteApresSuspension,
} from "./toast";

describe("dureeAffichage — au doigt, un toast à geste reste plus longtemps", () => {
  it("à la souris, la durée demandée est tenue telle quelle (le survol la suspend)", () => {
    expect(dureeAffichage({ duree: DUREE_ANNULER, aUnGeste: true, auDoigt: false })).toBe(DUREE_ANNULER);
    expect(dureeAffichage({ duree: 4500, aUnGeste: false, auDoigt: false })).toBe(4500);
  });

  it("⭐ au doigt, « Annuler » d'une suppression dure plus longtemps qu'à la souris (dix secondes)", () => {
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

// ── Un toast part TOUJOURS de lui-même (2026-10-13, retour d'Antonin) ──
describe("le départ d'un toast — retenu par le survol, jamais indéfiniment", () => {
  it("⭐ le plafond : au plus le double de sa durée, survol ou pas", () => {
    expect(plafondAffichage(DUREE_ANNULER)).toBe(DUREE_ANNULER * 2);
    expect(plafondAffichage(DUREE_GESTE_AU_DOIGT)).toBeLessThanOrEqual(20_000);
  });

  it("⭐ quitter le toast REPREND le compte où il en était — il ne repart pas de zéro", () => {
    // Six secondes prévues, trois écoulées avant le survol : il en reste trois.
    expect(resteApresSuspension(6000, 3000)).toBe(3000);
    // Deux survols de suite ne rallongent rien.
    expect(resteApresSuspension(resteApresSuspension(6000, 3000), 1000)).toBe(2000);
  });

  it("mais il laisse toujours le temps de se raviser : jamais moins que le sursis", () => {
    expect(resteApresSuspension(6000, 5900)).toBe(SURSIS_APRES_SURVOL);
    expect(resteApresSuspension(6000, 9000)).toBe(SURSIS_APRES_SURVOL);
    expect(SURSIS_APRES_SURVOL).toBeLessThan(DUREE_ANNULER);
  });

  it("« Annuler » ne dure plus huit secondes à la souris : six", () => {
    expect(DUREE_ANNULER).toBe(6000);
  });
});
