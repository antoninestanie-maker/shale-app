import { beforeAll, describe, expect, it, vi } from "vitest";

type Champ = typeof import("./champDate");
let fr: Champ;

/**
 * La langue se fixe À L'IMPORT du module d'i18n, depuis `navigator.language` :
 * on pose donc le navigateur AVANT d'importer (PIEGES § 14.2). Sans lui, la
 * suite passe ou casse selon la langue de la machine qui la lance — et ici
 * l'enjeu est double, puisque c'est l'ORDRE DES CHAMPS qu'on vérifie.
 */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  fr = await import("./champDate");
});

describe("l'ordre des champs vient de la langue, pas d'une table", () => {
  it("le français écrit le jour d'abord", () => {
    expect(fr.ordreDesChamps()).toEqual(["jour", "mois", "annee"]);
  });

  it("le gabarit du champ suit cet ordre", () => {
    expect(fr.gabaritDeSaisie()).toBe("jj/mm/aaaa");
  });
});

describe("ce qui est tapé au clavier devient une date", () => {
  const AUJ = "2026-03-01";

  it("la forme complète, avec n'importe quel séparateur", () => {
    expect(fr.parserSaisie("24/09/2026", AUJ)).toBe("2026-09-24");
    expect(fr.parserSaisie("24-09-2026", AUJ)).toBe("2026-09-24");
    expect(fr.parserSaisie("24 09 2026", AUJ)).toBe("2026-09-24");
    expect(fr.parserSaisie("24.09.2026", AUJ)).toBe("2026-09-24");
  });

  it("deux chiffres d'année valent le siècle courant", () => {
    expect(fr.parserSaisie("24/09/26", AUJ)).toBe("2026-09-24");
  });

  it("sans année : l'année courante", () => {
    expect(fr.parserSaisie("24/09", AUJ)).toBe("2026-09-24");
  });

  it("un seul nombre : ce jour du mois affiché", () => {
    expect(fr.parserSaisie("24", AUJ)).toBe("2026-03-24");
    expect(fr.parserSaisie("7", AUJ)).toBe("2026-03-07");
  });

  it("huit chiffres sans séparateur, dans l'ordre de la langue", () => {
    expect(fr.parserSaisie("24092026", AUJ)).toBe("2026-09-24");
  });

  it("et la forme ISO, où l'année ouvre", () => {
    expect(fr.parserSaisie("2026-09-24", AUJ)).toBe("2026-09-24");
    expect(fr.parserSaisie("20260924", AUJ)).toBe("2026-09-24");
  });

  it("une année en tête l'emporte sur l'ordre de la langue", () => {
    expect(fr.parserSaisie("2026/9/24", AUJ)).toBe("2026-09-24");
  });

  /**
   * ⚠️ LE TEST QUI COMPTE. `new Date(2026, 1, 31)` rend le 3 mars sans rien
   * dire : accepter cette saisie déplacerait l'échéance en silence, et une date
   * qu'on croit avoir posée est pire qu'un champ vide.
   */
  it("un jour qui n'existe pas est REFUSÉ, il ne roule pas", () => {
    expect(fr.parserSaisie("31/02/2026", AUJ)).toBeNull();
    expect(fr.parserSaisie("30/02/2026", AUJ)).toBeNull();
    expect(fr.parserSaisie("31/04/2026", AUJ)).toBeNull();
    expect(fr.parserSaisie("00/09/2026", AUJ)).toBeNull();
    expect(fr.parserSaisie("24/13/2026", AUJ)).toBeNull();
  });

  it("le 29 février existe une année sur quatre", () => {
    expect(fr.parserSaisie("29/02/2028", AUJ)).toBe("2028-02-29");
    expect(fr.parserSaisie("29/02/2027", AUJ)).toBeNull();
  });

  /**
   * ⚠️ Le pendant du jour impossible : une saisie qui contient une LETTRE n'est
   * pas devinée. Sans ce refus, « 12 mars » rendait le 12 du mois affiché — un
   * mois faux, sur une saisie que l'utilisateur croyait explicite.
   */
  it("une lettre suffit à refuser : rien ne se devine", () => {
    expect(fr.parserSaisie("12 mars", AUJ)).toBeNull();
    expect(fr.parserSaisie("24/12x", AUJ)).toBeNull();
    expect(fr.parserSaisie("24 décembre 2026", AUJ)).toBeNull();
    expect(fr.parserSaisie("le 24", AUJ)).toBeNull();
  });

  it("mais les séparateurs, eux, restent tolérés", () => {
    expect(fr.parserSaisie("  24 / 09 / 2026  ", AUJ)).toBe("2026-09-24");
  });

  it("rien, ou n'importe quoi, ne rend rien", () => {
    expect(fr.parserSaisie("", AUJ)).toBeNull();
    expect(fr.parserSaisie("   ", AUJ)).toBeNull();
    expect(fr.parserSaisie("demain", AUJ)).toBeNull();
    expect(fr.parserSaisie("//", AUJ)).toBeNull();
    expect(fr.parserSaisie("1/2/3/4", AUJ)).toBeNull();
  });
});

describe("ce que le champ affiche", () => {
  const AUJ = "2026-09-18";

  it("les trois jours qui se lisent sans compter", () => {
    expect(fr.libelleRelatif("2026-09-18", AUJ)).toBe("Aujourd'hui");
    expect(fr.libelleRelatif("2026-09-19", AUJ)).toBe("Demain");
    expect(fr.libelleRelatif("2026-09-17", AUJ)).toBe("Hier");
    expect(fr.libelleRelatif("2026-09-24", AUJ)).toBeNull();
  });

  it("le champ reprend ces mots quand ils s'appliquent", () => {
    expect(fr.formaterChamp("2026-09-19", AUJ)).toBe("Demain");
  });

  it("sinon le jour et le mois, sans l'année si c'est la même", () => {
    expect(fr.formaterChamp("2026-09-24", AUJ)).not.toMatch(/2026/);
    expect(fr.formaterChamp("2026-09-24", AUJ)).toMatch(/24/);
  });

  it("mais AVEC l'année quand elle change", () => {
    expect(fr.formaterChamp("2027-01-04", AUJ)).toMatch(/2027/);
  });

  it("le titre du calendrier nomme le mois", () => {
    expect(fr.formaterMois("2026-09-24")).toBe("septembre 2026");
  });

  it("et le lecteur d'écran reçoit la date entière", () => {
    expect(fr.formaterComplet("2026-09-24")).toBe("jeudi 24 septembre 2026");
  });
});

describe("naviguer d'un mois à l'autre", () => {
  /**
   * ⚠️ `setMonth` seul fait SAUTER un mois : le 31 janvier + 1 rend le 3 mars,
   * parce que février n'a pas de 31. En navigation, chaque clic afficherait
   * alors un mois qui n'est pas celui demandé.
   */
  it("le jour se rabat sur la fin du mois plutôt que de déborder", () => {
    expect(fr.moisDecale("2026-01-31", 1)).toBe("2026-02-28");
    expect(fr.moisDecale("2026-03-31", -1)).toBe("2026-02-28");
    expect(fr.moisDecale("2028-01-31", 1)).toBe("2028-02-29");
  });

  it("et l'année suit aux deux bouts", () => {
    expect(fr.moisDecale("2026-01-15", -1)).toBe("2025-12-15");
    expect(fr.moisDecale("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("les flèches déplacent d'un jour ou d'une semaine", () => {
    expect(fr.pasDeTouche("ArrowLeft")).toBe(-1);
    expect(fr.pasDeTouche("ArrowRight")).toBe(1);
    expect(fr.pasDeTouche("ArrowUp")).toBe(-7);
    expect(fr.pasDeTouche("ArrowDown")).toBe(7);
    expect(fr.pasDeTouche("Enter")).toBeNull();
  });
});

describe("les raccourcis", () => {
  it("aujourd'hui et demain, toujours", () => {
    const r = fr.raccourcis("2026-09-18");
    expect(r[0].jour).toBe("2026-09-18");
    expect(r[1].jour).toBe("2026-09-19");
  });

  /**
   * ⚠️ « Lundi prochain » est toujours un lundi À VENIR. Un raccourci qui, un
   * lundi, rendrait la date du jour ne raccourcirait rien — et laisserait croire
   * qu'il n'a pas marché.
   */
  it("« lundi prochain » ne vaut jamais aujourd'hui", () => {
    // 2026-09-21 est un lundi.
    expect(fr.raccourcis("2026-09-21")[2].jour).toBe("2026-09-28");
    // 2026-09-20, un dimanche : le lendemain.
    expect(fr.raccourcis("2026-09-20")[2].jour).toBe("2026-09-21");
    // 2026-09-18, un vendredi.
    expect(fr.raccourcis("2026-09-18")[2].jour).toBe("2026-09-21");
  });

  it("et c'est bien un lundi, tous les jours de la semaine", () => {
    for (let i = 0; i < 7; i++) {
      const jour = fr.raccourcis(`2026-09-${String(14 + i).padStart(2, "0")}`)[2].jour;
      expect(new Date(`${jour}T12:00:00`).getDay()).toBe(1);
    }
  });
});

/**
 * ⚠️ LE MÊME MODULE, EN ANGLAIS. C'est le seul endroit où une table figée
 * passerait inaperçue : `en-US` écrit le MOIS d'abord, et une app anglaise qui
 * lit « 09/24 » comme le 9 du mois 24 ne rendrait aucune date du tout.
 *
 * Module réimporté sous une autre langue — d'où les variables séparées : celles
 * du haut restent françaises pour tout ce qui précède.
 */
describe("en anglais américain, le mois ouvre", () => {
  let en: Champ;

  beforeAll(async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { userAgent: "test", language: "en-US", languages: ["en-US"] });
    en = await import("./champDate");
  });

  it("l'ordre des champs est inversé", () => {
    expect(en.ordreDesChamps()).toEqual(["mois", "jour", "annee"]);
  });

  it("le gabarit le dit", () => {
    expect(en.gabaritDeSaisie()).toBe("mm/dd/yyyy");
  });

  it("et la saisie suit : « 09/24/2026 » est le 24 septembre", () => {
    expect(en.parserSaisie("09/24/2026", "2026-03-01")).toBe("2026-09-24");
    expect(en.parserSaisie("9/24", "2026-03-01")).toBe("2026-09-24");
    expect(en.parserSaisie("09242026", "2026-03-01")).toBe("2026-09-24");
  });

  it("la forme ISO reste lisible dans les deux langues", () => {
    expect(en.parserSaisie("2026-09-24", "2026-03-01")).toBe("2026-09-24");
  });

  it("et un jour impossible reste refusé", () => {
    expect(en.parserSaisie("02/31/2026", "2026-03-01")).toBeNull();
  });
});
