import { beforeAll, describe, expect, it, vi } from "vitest";
import { addDays } from "../logic";
import type { ObjectifEnPeril } from "../calendrier/peril";
import { objectif } from "./objectif.testutil";

type Echeance = typeof import("./echeance");
type Peril = typeof import("../calendrier/peril");
let fr: Echeance;
let objectifsEnPeril: Peril["objectifsEnPeril"];

/** La langue se fixe à l'import du module d'i18n (PIEGES § 14.2). */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  fr = await import("./echeance");
  ({ objectifsEnPeril } = await import("../calendrier/peril"));
});

const AUJ = "2026-10-12";
/** Un objectif né bien avant : la grâce de « vient de naître » ne joue pas. */
const vieux = (p: Parameters<typeof objectif>[0] = {}) => objectif({ created_at: `${addDays(AUJ, -60)} 09:00:00`, ...p });

describe("⭐ la date d'une échéance s'écrit d'une seule façon", () => {
  it("cette année : le jour et le mois", () => {
    expect(fr.dateDEcheance("2026-12-31", AUJ)).toBe("31 décembre");
  });

  it("⭐ une autre année : l'année est écrite — « 12 février » pour 2027 ne disait pas laquelle", () => {
    expect(fr.dateDEcheance("2027-02-12", AUJ)).toBe("12 février 2027");
    expect(fr.dateDEcheance("2025-05-12", AUJ)).toBe("12 mai 2025");
  });

  it("une échéance avec une heure se lit par son jour", () => {
    expect(fr.dateDEcheance("2027-02-12 18:00", AUJ)).toBe("12 février 2027");
  });

  it("en anglais aussi, année comprise", async () => {
    vi.resetModules();
    vi.stubGlobal("navigator", { userAgent: "test", language: "en-US", languages: ["en-US"] });
    const en = await import("./echeance");
    expect(en.dateDEcheance("2026-12-31", AUJ)).toBe("December 31");
    expect(en.dateDEcheance("2027-02-12", AUJ)).toBe("February 12, 2027");
  });
});

describe("ce qu'une ligne peut écrire d'une échéance", () => {
  it("pas d'échéance : rien", () => {
    expect(fr.mentionEcheance(null, AUJ)).toBeNull();
    expect(fr.mentionEcheance("", AUJ)).toBeNull();
  });

  it("à venir : la date et les jours qui restent", () => {
    expect(fr.mentionEcheance(addDays(AUJ, 3), AUJ)).toMatchObject({ retard: 0, joursRestants: 3 });
    expect(fr.mentionEcheance("2027-02-12", AUJ)).toMatchObject({ date: "12 février 2027", retard: 0 });
  });

  it("aujourd'hui n'est pas un retard", () => {
    expect(fr.mentionEcheance(AUJ, AUJ)).toMatchObject({ retard: 0, joursRestants: 0 });
  });

  it("dépassée : le retard, et plus aucun jour restant", () => {
    expect(fr.mentionEcheance(addDays(AUJ, -41), AUJ)).toMatchObject({ retard: 41, joursRestants: 0 });
  });
});

describe("⭐ le temps qui reste : des faits, jamais un pronostic", () => {
  const perilsDe = (g: ReturnType<typeof objectif>): ObjectifEnPeril[] => objectifsEnPeril([g], [], [], AUJ);
  const fait = (g: ReturnType<typeof objectif>, acheve = false) => fr.faitDEcheance(g, perilsDe(g), acheve, AUJ);

  it("pas d'échéance : rien à dire", () => {
    expect(fait(vieux())).toBeNull();
  });

  it("objectif atteint : rien à dire, même si la date est passée", () => {
    expect(fait(vieux({ deadline: addDays(AUJ, -10), progress_pct: 100 }), true)).toBeNull();
  });

  it("à venir, loin : les semaines PLEINES — sept jours chacune, à partir d'aujourd'hui", () => {
    expect(fait(vieux({ deadline: addDays(AUJ, 123) }))).toEqual({ genre: "a-venir", joursRestants: 123, semaines: 17 });
    expect(fait(vieux({ deadline: addDays(AUJ, 14) }))).toEqual({ genre: "a-venir", joursRestants: 14, semaines: 2 });
    // Treize jours : UNE semaine pleine, pas deux.
    expect(fait(vieux({ deadline: addDays(AUJ, 13) }))).toEqual({ genre: "a-venir", joursRestants: 13, semaines: 1 });
  });

  it("⭐ dépassée : le verdict du Calendrier, tel quel — rien n'est recalculé ici", () => {
    const g = vieux({ deadline: addDays(AUJ, -41) });
    const perils = perilsDe(g);
    const f = fr.faitDEcheance(g, perils, false, AUJ);
    expect(f).toMatchObject({ genre: "peril" });
    // Le MÊME objet que celui que le Calendrier affiche.
    expect(f?.genre === "peril" && f.peril).toBe(perils[0]);
    expect(f?.genre === "peril" && f.peril.raison).toBe("depassee");
    expect(f?.genre === "peril" && f.peril.joursRestants).toBe(-41);
  });

  it("⭐ à cinq jours et rien de fait : en péril, avec les nombres du Calendrier", () => {
    const f = fait(vieux({ deadline: addDays(AUJ, 5) }));
    expect(f?.genre === "peril" && f.peril).toMatchObject({ joursRestants: 5, progression: 0, raison: "rythme-insuffisant" });
  });

  it("à cinq jours et presque fini : pas en péril — les jours qui restent, sans semaine pleine", () => {
    const g = vieux({ deadline: addDays(AUJ, 5), manual_progress: 1, progress_pct: 90 });
    expect(fait(g)).toEqual({ genre: "a-venir", joursRestants: 5, semaines: 0 });
  });

  it("aujourd'hui, et le Calendrier n'a rien signalé", () => {
    const g = vieux({ deadline: AUJ, manual_progress: 1, progress_pct: 90 });
    expect(fait(g)).toEqual({ genre: "aujourdhui" });
  });

  it("⭐ un objectif NÉ AUJOURD'HUI avec une échéance à cinq jours : un fait, pas un verdict", () => {
    // La règle « vient de naître » de `calendrier/peril.ts` : il n'a pas encore
    // eu un jour entier pour avancer.
    const g = objectif({ deadline: addDays(AUJ, 5), created_at: `${AUJ} 09:00:00` });
    expect(fait(g)).toEqual({ genre: "a-venir", joursRestants: 5, semaines: 0 });
  });

  it("⚠️ une échéance dépassée et NON signalée (liste des périls vide) : on ne dit rien de plus que la règle", () => {
    expect(fr.faitDEcheance(vieux({ deadline: addDays(AUJ, -3) }), [], false, AUJ)).toBeNull();
  });
});
