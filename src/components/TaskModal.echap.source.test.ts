import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit du 2026-10-20, constat 39 (Rémi) : dans « Nouvelle tâche », Échap
 * jetait la saisie sans rien demander, et le clic sur le voile aussi.
 *
 * Test de source : la fenêtre n'a pas de rendu testable sans DOM ici. Il tient
 * les trois points qui font le correctif.
 */
const source = readFileSync(resolve(__dirname, "TaskModal.tsx"), "utf8");

describe("Échap ne jette plus une saisie modifiée sans demander", () => {
  it("le voile et Échap passent par la demande, pas par `onClose`", () => {
    expect(source).toMatch(/fenetre-voile[^>]*\n\s*onClick=\{demanderFermeture\}/);
    expect(source).toMatch(/else fermeture\.current\.demanderFermeture\(\)/);
    expect(source).not.toMatch(/if \(e\.key === "Escape"\) \{\s*e\.preventDefault\(\);\s*onClose\(\);/);
  });

  it("rien de modifié : on ferme comme avant", () => {
    expect(source).toMatch(/if \(!modifie\) return onClose\(\);/);
  });

  it("la question est posée dans le pied, avec un geste pour chaque issue", () => {
    expect(source).toMatch(/t\("Abandonner la saisie \?"\)/);
    expect(source).toMatch(/t\("Ne pas garder"\)/);
    expect(source).toMatch(/t\("Continuer"\)/);
  });
});

describe("l'ajout rapide : Échap écarte ce qui a été lu, jamais la ligne", () => {
  const ligne = readFileSync(resolve(__dirname, "taches/SaisieRapide.tsx"), "utf8");
  it("Échap n'efface pas le texte tapé", () => {
    const bloc = ligne.slice(ligne.indexOf('if (e.key !== "Escape"'), ligne.indexOf("placeholder={props.placeholder}"));
    expect(bloc).toContain("ecarter()");
    expect(bloc).not.toMatch(/texte: ""/);
    expect(bloc).not.toMatch(/setSaisie\(vierge\)/);
  });
});
