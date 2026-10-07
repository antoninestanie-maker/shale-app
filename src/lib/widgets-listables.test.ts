import { describe, expect, it } from "vitest";
import { widgetListable } from "./features";
import { WIDGET_LABELS } from "./uiConfig";

/**
 * Personnaliser liste les widgets du tableau de bord PAR LEUR LIBELLÉ. Un
 * libellé qui cite une offre (« Brief du jour (IA, Shale Pro) ») ne doit donc
 * jamais être listé à un compte qui n'a pas ce que l'offre ouvre — et sur
 * iPhone, où l'IA n'existe pas, il ne l'est jamais : l'app n'y nomme aucune
 * offre (`lib/boutique.ts`, règle 3.1.3(f) d'Apple).
 *
 * Trouvé à la relecture du 2026-10-06 : le libellé s'affichait à tout le monde.
 */
const NOM_D_OFFRE = /shale\s*(pro|trade|business)/i;
const SANS_DROIT = { hasTrading: false, iaPossible: false };

describe("widgets listés dans Personnaliser", () => {
  it("le brief d'IA n'est listé qu'à qui a l'IA", () => {
    expect(widgetListable("brief-ia", SANS_DROIT)).toBe(false);
    expect(widgetListable("brief-ia", { hasTrading: false, iaPossible: true })).toBe(true);
  });

  it("un widget ordinaire est toujours listé", () => {
    expect(widgetListable("tasks", SANS_DROIT)).toBe(true);
  });

  it("aucun libellé qui nomme une offre n'est listé à un compte sans droit", () => {
    const fautifs = Object.entries(WIDGET_LABELS)
      .filter(([id, libelle]) => NOM_D_OFFRE.test(libelle) && widgetListable(id, SANS_DROIT))
      .map(([id]) => id);
    expect(fautifs).toEqual([]);
  });

  it("le filet n'est pas vide : au moins un libellé nomme une offre", () => {
    expect(Object.values(WIDGET_LABELS).some((l) => NOM_D_OFFRE.test(l))).toBe(true);
  });
});
