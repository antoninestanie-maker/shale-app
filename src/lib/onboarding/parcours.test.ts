import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { blocEnAttente, brouillonVide, etapePrecedente, ETAPES, ETAPES_FACULTATIVES } from "./parcours";

/** L'accueil du premier démarrage — audit du 2026-10-20, constats 6 et 7. */

describe("un bloc tapé sans « + » (constat 7)", () => {
  const yanis = { label: "Cours à l'école", jours: [4, 5], debut: "09:00", fin: "17:00" };

  it("est AJOUTÉ par « Suivant », pas jeté", () => {
    expect(blocEnAttente(yanis, true)).toEqual({ etat: "pret", bloc: yanis });
  });

  it("le nom est nettoyé, la liste des jours copiée", () => {
    const r = blocEnAttente({ ...yanis, label: "  Garde  " }, true);
    expect(r.etat === "pret" && r.bloc.label).toBe("Garde");
    expect(r.etat === "pret" && r.bloc.jours).not.toBe(yanis.jours);
  });

  it("sans nom, il n'y a rien à garder : les valeurs proposées ne sont pas une réponse", () => {
    expect(blocEnAttente(brouillonVide([1, 2, 3, 4, 5]), true)).toEqual({ etat: "vide" });
    expect(blocEnAttente({ ...yanis, label: "   " }, true)).toEqual({ etat: "vide" });
  });

  it("un nom sans jour, ou sans durée, est signalé — ni jeté ni deviné", () => {
    expect(blocEnAttente({ ...yanis, jours: [] }, true)).toEqual({ etat: "incomplet" });
    expect(blocEnAttente({ ...yanis, fin: "09:00" }, true)).toEqual({ etat: "incomplet" });
  });

  it("une plage qui passe minuit est un bloc valide", () => {
    expect(blocEnAttente({ ...yanis, debut: "22:00", fin: "06:00" }, true).etat).toBe("pret");
  });

  it("sans place (trois blocs), le champ n'est pas affiché : rien en attente", () => {
    expect(blocEnAttente(yanis, false)).toEqual({ etat: "vide" });
  });
});

describe("passer une question n'est pas passer l'accueil (constat 6)", () => {
  it("six écrans, et les quatre derniers se passent un par un", () => {
    expect(ETAPES).toHaveLength(6);
    expect(ETAPES_FACULTATIVES).toEqual(["contraints", "grille", "objectif", "action"]);
  });

  it("on peut revenir en arrière, jamais avant le premier écran", () => {
    expect(etapePrecedente("objectif")).toBe("grille");
    expect(etapePrecedente("heures")).toBe("heures");
  });

  /**
   * Test de source : la sortie complète ne doit plus être câblée sur
   * « Passer ». Avant le 2026-10-20, `Passer` appelait `terminer` à tous les
   * écrans.
   */
  it("« Passer » saute la question ; « Tout passer » sort", () => {
    const src = readFileSync(resolve(__dirname, "../../components/onboarding/Accueil.tsx"), "utf8");
    expect(src).toMatch(/onClick=\{passerEtape\}/);
    expect(src).toMatch(/t\("Passer cette question"\)/);
    expect(src).toMatch(/t\("Tout passer"\)/);
    expect(src).not.toMatch(/\{t\("Passer"\)\}/);
    expect(src).toMatch(/t\("Étape \{n\} sur \{total\}"/);
    expect(src).toMatch(/t\("Retour"\)/);
  });

  it("le premier écran ne promet plus « trois questions »", () => {
    const src = readFileSync(resolve(__dirname, "../appTexts.ts"), "utf8");
    expect(src).not.toMatch(/t\("Trois questions/);
  });
});
