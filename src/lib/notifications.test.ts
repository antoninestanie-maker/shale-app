import { beforeAll, describe, expect, it, vi } from "vitest";

type Formateurs = typeof import("./notifications");
let formatWhen: Formateurs["formatWhen"];
let formatWhenAhead: Formateurs["formatWhenAhead"];

/**
 * Ces formateurs passent par `t()`, qui lit la langue COURANTE — figée à
 * l'import du module d'i18n depuis `navigator.language`. On pose donc le
 * user-agent AVANT d'importer, comme le fait déjà `platform.test.ts` :
 * `setLangPref()` ne conviendrait pas ici, elle touche au `document`, absent
 * de cet environnement de test.
 */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", {
    userAgent: "test",
    language: "fr-FR",
    languages: ["fr-FR"],
  });
  ({ formatWhen, formatWhenAhead } = await import("./notifications"));
});

/**
 * Deux formateurs, deux directions du temps — et ils ne sont PAS
 * interchangeables. Ces tests existent parce que l'écran « Rappels
 * programmés » a annoncé un rappel de 20 h comme parti « à l'instant » :
 * il utilisait le formateur du passé sur une date future.
 */
describe("formatWhen — le passé", () => {
  const maintenant = new Date("2026-08-27T14:00:00");

  it("dit « à l'instant » pour ce qui vient de se produire", () => {
    expect(formatWhen("2026-08-27T13:59:30", maintenant)).toBe("à l'instant");
  });

  it("compte les minutes écoulées", () => {
    expect(formatWhen("2026-08-27T13:30:00", maintenant)).toBe("il y a 30 min");
  });

  /**
   * ⚠️ Le comportement fautif, épinglé À DESSEIN plutôt que corrigé.
   *
   * Sur une date future, `now - date` est négatif, donc `< 1` : le formateur
   * du passé répond « à l'instant ». Le rendre « intelligent » serait pire —
   * il traiterait alors silencieusement deux sens du temps dans une même
   * fonction, et le journal des notifications, qui n'affiche QUE du passé,
   * hériterait d'un code qu'il n'utilise jamais. On documente la limite et on
   * garde deux fonctions nommées pour ce qu'elles font.
   */
  it("est INAPTE au futur, et c'est pourquoi formatWhenAhead existe", () => {
    expect(formatWhen("2026-08-27T20:00:00", maintenant)).toBe("à l'instant");
  });
});

describe("formatWhenAhead — l'avenir", () => {
  const maintenant = new Date("2026-08-27T14:00:00");

  it("nomme l'heure du jour même", () => {
    expect(formatWhenAhead("2026-08-27T20:00:00", maintenant)).toBe("aujourd'hui à 20:00");
  });

  it("nomme demain", () => {
    expect(formatWhenAhead("2026-08-28T20:00:00", maintenant)).toBe("demain à 20:00");
  });

  it("passe à la date au-delà", () => {
    expect(formatWhenAhead("2026-09-02T08:30:00", maintenant)).toBe("02/09 à 08:30");
  });

  /** Une échéance illisible ne doit pas casser l'écran de diagnostic. */
  it("rend une chaîne vide sur une date invalide", () => {
    expect(formatWhenAhead("pas une date", maintenant)).toBe("");
  });
});
