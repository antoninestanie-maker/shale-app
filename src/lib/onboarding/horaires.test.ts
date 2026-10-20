import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { ReglagesHoraires } from "./reglages";

type Horaires = typeof import("./horaires");
type Dispo = typeof import("../calendrier/disponibilite");
let h: Horaires;
let dispo: Dispo;

/** La langue se fixe à l'import (PIEGES § 14.2) : le navigateur d'abord. */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  h = await import("./horaires");
  dispo = await import("../calendrier/disponibilite");
});

/** Monique, au labo du 2026-10-20 : bureau 08:30 – 17:00, visio mar./jeu. soir. */
const MONIQUE: ReglagesHoraires = {
  lever: "07:00",
  coucher: "23:00",
  travail: { jours: [1, 2, 3, 4, 5], debut: "08:30", fin: "17:00" },
  contraints: [{ label: "Visio licence", jours: [2, 4], debut: "19:00", fin: "21:00" }],
};
const MARDI = "2026-10-20";
const MERCREDI = "2026-10-21";

describe("les heures de l'accueil nourrissent le calendrier (constat 7)", () => {
  it("le repli suit les heures déclarées, pas le 9 h – 18 h codé en dur", () => {
    const profil = dispo.profilDisponibilite([], h.optionsDuProfil(MONIQUE));
    expect(profil.repli).toEqual({ debut: 8, fin: 17, jours: [1, 2, 3, 4, 5] });
    // Sans réglages lus : le repli d'origine.
    expect(dispo.profilDisponibilite([], h.optionsDuProfil(null)).repli.debut).toBe(9);
  });

  it("un bloc fixe réserve ses heures, ses jours seulement", () => {
    expect(h.blocsDuJour(MONIQUE, MARDI)).toEqual([{ debut: "19:00", fin: "21:00" }]);
    expect(h.blocsDuJour(MONIQUE, MERCREDI)).toEqual([]);
    expect(h.blocsDuJour(null, MARDI)).toEqual([]);
  });

  it("un bloc qui passe minuit occupe la fin de son jour et le début du lendemain", () => {
    const nuit: ReglagesHoraires = {
      ...MONIQUE,
      contraints: [{ label: "Garde", jours: [2], debut: "22:00", fin: "06:00" }],
    };
    expect(h.blocsDuJour(nuit, MARDI)).toEqual([{ debut: "22:00", fin: "24:00" }]);
    expect(h.blocsDuJour(nuit, MERCREDI)).toEqual([{ debut: "00:00", fin: "06:00" }]);
  });

  it("aucun créneau n'est proposé sur un bloc fixe", () => {
    const tard: ReglagesHoraires = {
      ...MONIQUE,
      travail: { jours: [2], debut: "18:00", fin: "22:00" },
    };
    const profil = dispo.profilDisponibilite([], h.optionsDuProfil(tard));
    const libres = dispo.creneauxLibres(profil, [], MARDI, {
      dureeMin: 60,
      limite: 10,
      bloques: h.blocsDuJour(tard, MARDI),
    });
    expect(libres.map((c) => c.debut)).toEqual(["18:00", "21:00"]);
  });

  /**
   * ⚠️ Le test qui aurait vu le défaut : `repliDuTravail` existait et était
   * testé depuis le 2026-09-10, mais aucune vue ne l'appelait.
   */
  it("les deux vues du calendrier passent bien les heures déclarées", () => {
    for (const fichier of ["../../views/CalendarView.tsx", "../../components/CalendarCard.tsx"]) {
      const source = readFileSync(resolve(__dirname, fichier), "utf8");
      expect(source, fichier).toMatch(/profilDisponibilite\(data\.focusSessions, optionsDuProfil\(horaires\)\)/);
    }
    const vue = readFileSync(resolve(__dirname, "../../views/CalendarView.tsx"), "utf8");
    expect(vue).toMatch(/bloques: blocsDuJour\(horaires, jour\)/);
  });
});

describe("ce que l'accueil écrit d'une plage (constats 6 et 7)", () => {
  it("un bloc ajouté montre ses jours et ses heures", () => {
    expect(h.resumePlage(MONIQUE.contraints[0])).toBe("mar., jeu. · 19:00 – 21:00");
    expect(h.resumePlage({ jours: [0, 1], debut: "08:00", fin: "09:00" })).toBe("lun., dim. · 08:00 – 09:00");
  });

  it("une fin avant le début le DIT, avec la durée comprise", () => {
    expect(h.remarquePlage({ debut: "09:00", fin: "07:00" })).toBe(
      "La fin est avant le début : la plage passe minuit et dure 22 h. C'est voulu ?",
    );
    expect(h.remarquePlage({ debut: "22:00", fin: "06:30" })).toContain("8,5 h");
    expect(h.remarquePlage({ debut: "09:00", fin: "09:00" })).toBe(
      "Début et fin identiques : aucune heure n'est comptée.",
    );
    expect(h.remarquePlage({ debut: "09:00", fin: "18:00" })).toBeNull();
  });
});
