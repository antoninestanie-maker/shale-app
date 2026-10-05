import { describe, expect, it } from "vitest";

import { consigneIa, lireChecklist, lireTache } from "./importChecklist";

describe("lireTache", () => {
  it("lit la date et la priorité, où qu'elles soient", () => {
    expect(lireTache("Appeler le notaire @2026-10-20 !haute")).toEqual({
      titre: "Appeler le notaire",
      echeance: "2026-10-20",
      priorite: "high",
    });
    expect(lireTache("(2026-11-02) Envoyer le dossier !faible")).toEqual({
      titre: "Envoyer le dossier",
      echeance: "2026-11-02",
      priorite: "low",
    });
  });
  it("une date impossible n'est pas écrite, la tâche reste", () => {
    expect(lireTache("Payer @2026-02-31")).toEqual({ titre: "Payer @2026-02-31" });
  });
  it("une priorité inconnue reste dans le texte", () => {
    expect(lireTache("Faire !bientôt")?.priorite).toBeUndefined();
  });
  it("une ligne vide ne crée rien", () => {
    expect(lireTache("  @2026-10-20 ")).toBeNull();
  });
});

describe("lireChecklist", () => {
  const texte = `Voici ta checklist :
\`\`\`markdown
# Préparer mon déménagement
## Trouver le logement
- [ ] Lister les quartiers @2026-10-20 !haute
- [x] Fixer un budget
### Visites
- [ ] Prendre trois rendez-vous
## Le jour J
1. Réserver le camion
\`\`\``;

  it("lit le titre, les étapes, les sous-étapes et les tâches", () => {
    const p = lireChecklist(texte)!;
    expect(p.titre).toBe("Préparer mon déménagement");
    expect(p.etapes.map((e) => e.titre)).toEqual(["Trouver le logement", "Le jour J"]);
    const e = p.etapes[0];
    expect(e.phase).toBe(true);
    expect(e.taches.map((t) => t.titre)).toEqual(["Lister les quartiers", "Fixer un budget"]);
    expect(e.taches[0]).toMatchObject({ echeance: "2026-10-20", priorite: "high" });
    expect(e.sousEtapes[0].taches[0].titre).toBe("Prendre trois rendez-vous");
    expect(p.etapes[1].phase).toBe(false);
    expect(p.etapes[1].taches[0].titre).toBe("Réserver le camion");
  });

  it("le bavardage avant le bloc est écarté, pas écrit", () => {
    const p = lireChecklist("Voici ta liste !\n# A\nCeci est une remarque\n- x")!;
    expect(p.titre).toBe("A");
    expect(p.ignores).toBe(2);
    expect(p.taches).toHaveLength(1);
  });

  it("des puces sans titre vont directement sous l'objectif", () => {
    const p = lireChecklist("# Ranger\n- [ ] Trier\n- [ ] Jeter")!;
    expect(p.etapes).toHaveLength(0);
    expect(p.taches.map((t) => t.titre)).toEqual(["Trier", "Jeter"]);
  });

  it("sans #, la première ligne nue est le titre", () => {
    const p = lireChecklist("Plan de lancement\n- Écrire\n- Publier")!;
    expect(p.titre).toBe("Plan de lancement");
    expect(p.taches).toHaveLength(2);
  });

  it("un texte sans rien d'exploitable rend null", () => {
    expect(lireChecklist("")).toBeNull();
    expect(lireChecklist("```\n```\n---")).toBeNull();
  });

  it("un second # devient une étape, rien n'est perdu", () => {
    const p = lireChecklist("# A\n# B\n- [ ] x")!;
    expect(p.titre).toBe("A");
    expect(p.etapes[0].titre).toBe("B");
    expect(p.etapes[0].taches).toHaveLength(1);
  });
});

describe("consigneIa", () => {
  it("embarque le sujet et le format, dans les deux langues", () => {
    expect(consigneIa("apprendre le piano", "fr")).toContain("L'objectif : apprendre le piano");
    expect(consigneIa("learn piano", "en")).toContain("The goal: learn piano");
    expect(consigneIa("", "fr")).toContain("décris ici");
  });
  it("la consigne produit un texte que lireChecklist relit", () => {
    const c = consigneIa("x", "fr");
    expect(lireChecklist(c)).not.toBeNull();
  });
});
