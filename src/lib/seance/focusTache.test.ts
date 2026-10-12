import { describe, expect, it } from "vitest";
import {
  focusPossible,
  libelleFocus,
  MINUTEUR_AU_REPOS,
  pleinEcranApresDemarrage,
  regleFocus,
  type EtatMinuteur,
  type SeanceVue,
} from "./focusTache";

const tache = { id: 7 };
const travail = (taskId: number | null, label = "Écrire le plan"): SeanceVue => ({ kind: "focus", taskId, label });
const pause: SeanceVue = { kind: "break", taskId: null, label: "Pause" };
const etat = (seance: SeanceVue | null, enPause = false): EtatMinuteur => ({ seance, enPause });

describe("⭐ « Focus 25 min » sur une tâche : ce que le geste fait selon le minuteur", () => {
  it("rien ne tourne : on lance", () => {
    expect(regleFocus(tache, false, MINUTEUR_AU_REPOS)).toEqual({ quoi: "lancer" });
  });

  it("une PAUSE tourne (celle que le minuteur enchaîne tout seul) : on lance quand même", () => {
    expect(regleFocus(tache, false, etat(pause))).toEqual({ quoi: "lancer-sur-pause" });
  });

  it("une pause… mise en pause : on lance quand même aussi", () => {
    expect(regleFocus(tache, false, etat(pause, true))).toEqual({ quoi: "lancer-sur-pause" });
  });

  it("la séance de CETTE tâche tourne : grisé, et dit que c'est déjà en cours", () => {
    const regle = regleFocus(tache, false, etat(travail(7)));
    expect(regle).toMatchObject({ quoi: "rien", pourquoi: "deja-ici" });
    expect(focusPossible(regle)).toBe(false);
  });

  it("la séance de CETTE tâche est en pause : le geste la reprend", () => {
    expect(regleFocus(tache, false, etat(travail(7), true))).toEqual({ quoi: "reprendre" });
  });

  it("une séance de travail sur une AUTRE tâche : grisé, et nomme laquelle", () => {
    const regle = regleFocus(tache, false, etat(travail(3, "Relire le contrat")));
    expect(regle).toEqual({ quoi: "rien", pourquoi: "ailleurs", ou: "Relire le contrat" });
    expect(libelleFocus(regle).raison).toContain("Relire le contrat");
  });

  it("…même mise en pause : on ne remplace pas un travail compté en silence", () => {
    expect(regleFocus(tache, false, etat(travail(3), true))).toMatchObject({ quoi: "rien", pourquoi: "ailleurs" });
  });

  it("une séance libre (sans tâche) tourne : grisé aussi", () => {
    expect(regleFocus(tache, false, etat(travail(null, "Focus")))).toMatchObject({ quoi: "rien", pourquoi: "ailleurs" });
  });

  it("une tâche cochée : grisé avec sa raison, quel que soit le minuteur", () => {
    for (const e of [MINUTEUR_AU_REPOS, etat(pause), etat(travail(7)), etat(travail(3))]) {
      const regle = regleFocus(tache, true, e);
      expect(regle).toMatchObject({ quoi: "rien", pourquoi: "faite" });
      expect(libelleFocus(regle).raison).toBeTruthy();
    }
  });

  it("une entrée grisée porte TOUJOURS une raison ; une entrée qui agit, jamais", () => {
    const cas: [boolean, EtatMinuteur][] = [
      [false, MINUTEUR_AU_REPOS],
      [false, etat(pause)],
      [false, etat(travail(7))],
      [false, etat(travail(7), true)],
      [false, etat(travail(3))],
      [true, MINUTEUR_AU_REPOS],
    ];
    for (const [faite, e] of cas) {
      const regle = regleFocus(tache, faite, e);
      const { libelle, raison } = libelleFocus(regle);
      expect(libelle).toBeTruthy();
      expect(!!raison).toBe(!focusPossible(regle));
    }
  });
});

describe("la séance libre de la palette (sans tâche)", () => {
  it("se lance au repos et par-dessus une pause", () => {
    expect(regleFocus(null, false, MINUTEUR_AU_REPOS)).toEqual({ quoi: "lancer" });
    expect(regleFocus(null, false, etat(pause))).toEqual({ quoi: "lancer-sur-pause" });
  });

  it("ne remplace pas une séance de travail", () => {
    expect(regleFocus(null, false, etat(travail(7)))).toMatchObject({ quoi: "rien", pourquoi: "ailleurs" });
    expect(regleFocus(null, false, etat(travail(null, "Focus"), true))).toMatchObject({ quoi: "rien", pourquoi: "ailleurs" });
  });
});

describe("⭐ lancer une séance n'ouvre pas le plein écran", () => {
  it("sans demande, le plein écran reste fermé", () => {
    expect(pleinEcranApresDemarrage(false, undefined)).toBe(false);
    expect(pleinEcranApresDemarrage(false, false)).toBe(false);
  });

  it("il ne s'ouvre que si on le demande", () => {
    expect(pleinEcranApresDemarrage(false, true)).toBe(true);
  });

  it("la pause qui s'enchaîne ne demande rien : elle garde l'état de la séance qui finit", () => {
    expect(pleinEcranApresDemarrage(true, undefined)).toBe(true);
    expect(pleinEcranApresDemarrage(false, undefined)).toBe(false);
  });
});
