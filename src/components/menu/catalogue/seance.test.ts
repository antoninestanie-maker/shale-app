import { describe, expect, it, vi } from "vitest";
import { entreesSeance, type GestesSeance } from "./seance";
import { ordonner } from "../../../lib/menu/entrees";

function gestes(): GestesSeance {
  return { basculerPause: vi.fn(), terminer: vi.fn(), ouvrirTimer: vi.fn(), pleinEcran: vi.fn() };
}

describe("le menu de la pastille de séance (clic droit et « ⋯ »)", () => {
  it("quatre gestes, dans cet ordre", () => {
    const ids = ordonner(entreesSeance(false, gestes())).map((e) => e.id);
    expect(ids).toEqual(["pause", "terminer", "ouvrir-timer", "plein-ecran"]);
  });

  it("chaque entrée appelle LA fonction du geste (règle 18)", () => {
    const g = gestes();
    const entrees = ordonner(entreesSeance(false, g));
    for (const e of entrees) void e.executer!();
    expect(g.basculerPause).toHaveBeenCalledTimes(1);
    expect(g.terminer).toHaveBeenCalledTimes(1);
    expect(g.ouvrirTimer).toHaveBeenCalledTimes(1);
    expect(g.pleinEcran).toHaveBeenCalledTimes(1);
  });

  it("« Pause » devient « Reprendre » quand la séance est en pause", () => {
    const libelle = (enPause: boolean) => ordonner(entreesSeance(enPause, gestes()))[0].libelle;
    expect(libelle(false)).not.toEqual(libelle(true));
  });

  it("« Terminer » n'est pas rouge : le temps fait est gardé, rien n'est détruit", () => {
    expect(ordonner(entreesSeance(false, gestes())).some((e) => e.danger)).toBe(false);
  });
});
