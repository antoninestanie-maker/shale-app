import { describe, expect, it } from "vitest";
import {
  afficheLesHeures,
  decouperTemps,
  estCommande,
  etatDepuisFocus,
  restantDepuisEtat,
} from "./timerFenetre";
import type { ActiveFocus } from "./useFocus";

const seance: ActiveFocus = {
  id: 7,
  label: "Backtest",
  taskId: null,
  plannedMin: 25,
  startedAtMs: 1_000_000,
  kind: "focus",
  breakMin: 5,
};

describe("etatDepuisFocus", () => {
  it("sans séance : rien à montrer", () => {
    expect(etatDepuisFocus(null, false, 0)).toEqual({
      session: null,
      finMs: null,
      restantFigeSec: null,
    });
  });

  it("en cours : l'instant de fin voyage, pas le reste", () => {
    const e = etatDepuisFocus(seance, false, 1234);
    expect(e.finMs).toBe(1_000_000 + 25 * 60_000);
    expect(e.restantFigeSec).toBeNull();
    // Ni l'id en base ni la tâche liée ne sortent de la fenêtre principale.
    expect(e.session).toEqual({ label: "Backtest", kind: "focus", plannedMin: 25 });
  });

  it("en pause : le reste est figé, il n'y a plus d'instant de fin", () => {
    const e = etatDepuisFocus(seance, true, 600);
    expect(e.finMs).toBeNull();
    expect(e.restantFigeSec).toBe(600);
  });

  it("l'état ne dépend pas de la seconde qui passe tant que ça tourne", () => {
    // C'est ce qui permet au pont de ne diffuser qu'aux changements de sens.
    expect(JSON.stringify(etatDepuisFocus(seance, false, 900))).toBe(
      JSON.stringify(etatDepuisFocus(seance, false, 899)),
    );
  });
});

describe("restantDepuisEtat", () => {
  const enCours = etatDepuisFocus(seance, false, 0);
  const fin = 1_000_000 + 25 * 60_000;

  it("même arrondi que useFocus", () => {
    expect(restantDepuisEtat(enCours, fin - 90_000)).toBe(90);
    expect(restantDepuisEtat(enCours, fin - 89_600)).toBe(90);
    expect(restantDepuisEtat(enCours, fin - 89_400)).toBe(89);
  });

  it("jamais négatif", () => {
    expect(restantDepuisEtat(enCours, fin + 5_000)).toBe(0);
  });

  it("en pause, l'horloge murale n'y change rien", () => {
    const enPause = etatDepuisFocus(seance, true, 321);
    expect(restantDepuisEtat(enPause, 0)).toBe(321);
    expect(restantDepuisEtat(enPause, 9_999_999_999)).toBe(321);
  });

  it("sans séance : zéro", () => {
    expect(restantDepuisEtat(etatDepuisFocus(null, false, 0), 0)).toBe(0);
  });
});

describe("decouperTemps", () => {
  it("minutes et secondes sur deux chiffres", () => {
    expect(decouperTemps(36 * 60 + 50, false)).toEqual(["36", "50"]);
    expect(decouperTemps(65, false)).toEqual(["01", "05"]);
    expect(decouperTemps(0, false)).toEqual(["00", "00"]);
  });

  it("avec les heures : trois volets, même sous l'heure", () => {
    expect(decouperTemps(90 * 60, true)).toEqual(["01", "30", "00"]);
    expect(decouperTemps(59 * 60 + 59, true)).toEqual(["00", "59", "59"]);
  });

  it("ne rend jamais de négatif ni de décimale", () => {
    expect(decouperTemps(-3, false)).toEqual(["00", "00"]);
    expect(decouperTemps(61.9, false)).toEqual(["01", "01"]);
  });
});

describe("afficheLesHeures", () => {
  it("décidé sur la durée prévue, pas sur le reste", () => {
    expect(afficheLesHeures(25)).toBe(false);
    expect(afficheLesHeures(59)).toBe(false);
    expect(afficheLesHeures(60)).toBe(true);
    expect(afficheLesHeures(240)).toBe(true);
  });
});

describe("estCommande", () => {
  it("n'accepte que les gestes connus", () => {
    expect(estCommande("pause")).toBe(true);
    expect(estCommande("montrer-app")).toBe(true);
    expect(estCommande("supprimer-tout")).toBe(false);
    expect(estCommande(42)).toBe(false);
    expect(estCommande(null)).toBe(false);
  });
});
