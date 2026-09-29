import { describe, expect, it } from "vitest";
import { ajouterEnfant, blocCarte, carteVide, poserReference, rendreSvg, type Carte } from "./carte";
import { etatsVivants, type SourcesEtat } from "./carteEtat";
import { coche, habitude, objectif, tache } from "./objectifs/objectif.testutil";

/** Une carte à trois nœuds typés : une étape, une tâche, une habitude. */
function typee(): Carte {
  let c = carteVide("Lancer la chaîne");
  c = ajouterEnfant(c, "r").carte; // n1
  c = ajouterEnfant(c, "n1").carte; // n2
  c = ajouterEnfant(c, "r").carte; // n3
  c = poserReference(c, "n1", { kind: "goal", uid: "g-2" }, "Tournage", "sous-objectif");
  c = poserReference(c, "n2", { kind: "task", uid: "t-1" }, "Acheter un micro");
  c = poserReference(c, "n3", { kind: "habit", uid: "h-1" }, "Filmer 10 min");
  return c;
}

const base = (p: Partial<SourcesEtat> = {}): SourcesEtat => ({
  goals: [objectif({ id: 1, uid: "g-1" }), objectif({ id: 2, uid: "g-2", parent_goal_id: 1 })],
  tasks: [tache({ id: 1, uid: "t-1", goal_id: 2, due_date: "2026-09-20" })],
  completions: [],
  habits: [habitude({ id: 1, uid: "h-1" })],
  habitChecks: [],
  maintenant: "2026-09-29 10:00",
  today: "2026-09-29",
  ...p,
});

describe("⭐ l'état vivant d'un nœud typé", () => {
  it("une tâche : cochée ou non, et son échéance en retard", () => {
    const pas = etatsVivants(typee(), base()).get("n2")!;
    expect(pas).toMatchObject({ type: "tache", fait: false, echeance: "2026-09-20", enRetard: true });
    const faite = etatsVivants(typee(), base({ completions: [coche(1, "2026-09-25")] })).get("n2")!;
    expect(faite).toMatchObject({ fait: true, enRetard: false });
  });

  it("une habitude : sa série, le même calcul que le Journal", () => {
    const s = base({ habitChecks: [{ id: 1, habit_id: 1, date: "2026-09-28" }, { id: 2, habit_id: 1, date: "2026-09-29" }] });
    expect(etatsVivants(typee(), s).get("n3")).toEqual({ type: "habitude", serie: 2 });
  });

  it("une étape : son pourcentage vient de `progression.ts`, et son genre des DONNÉES", () => {
    const e = etatsVivants(typee(), base({ completions: [coche(1)] })).get("n1")!;
    expect(e).toMatchObject({ type: "sous-objectif", pct: 100, acheve: true });
    // Devenue phase ailleurs : l'état le dit, quel que soit le genre copié dans le nœud.
    const phase = base({ goals: [objectif({ id: 1, uid: "g-1" }), objectif({ id: 2, uid: "g-2", parent_goal_id: 1, is_milestone: 1 })] });
    expect(etatsVivants(typee(), phase).get("n1")!.type).toBe("phase");
  });

  it("une tâche récurrente ne se coche pas depuis la carte", () => {
    const s = base({ tasks: [tache({ id: 1, uid: "t-1", recurrence: "daily" })], completions: [coche(1, "2026-09-29")] });
    expect(etatsVivants(typee(), s).get("n2")).toMatchObject({ recurrente: true, fait: false });
  });

  it("un objet disparu n'a pas d'état", () => {
    expect(etatsVivants(typee(), base({ tasks: [], habits: [] })).has("n2")).toBe(false);
    expect(etatsVivants(typee(), base({ tasks: [], habits: [] })).has("n3")).toBe(false);
  });
});

describe("⭐⭐ le rendu enregistré et l'export ne portent JAMAIS l'état", () => {
  // Même garde-fou que `peril` (2026-09-22) : deux jeux de données opposés
  // — tout coché, tout en retard, une longue série — et le bloc écrit dans la
  // note doit rester IDENTIQUE au caractère près. Une coche dessinée dans une
  // image figée mentirait dès la première tâche décochée ailleurs.
  it("deux états opposés, un seul et même bloc", () => {
    const c = typee();
    const vide = base();
    const plein = base({
      completions: [coche(1, "2026-09-25")],
      habitChecks: Array.from({ length: 12 }, (_, i) => ({ id: i, habit_id: 1, date: `2026-09-${String(18 + i).padStart(2, "0")}` })),
    });
    // Les deux états diffèrent bien — sinon le test ne prouverait rien.
    expect(etatsVivants(c, vide).get("n2")!.fait).toBe(false);
    expect(etatsVivants(c, plein).get("n2")!.fait).toBe(true);
    expect(etatsVivants(c, plein).get("n3")!.serie).toBe(12);
    // Et le rendu ne dépend QUE de la carte.
    expect(blocCarte(c)).toBe(blocCarte(typee()));
    expect(rendreSvg(c, { mode: "export" })).not.toMatch(/✓|12 j|%/);
  });

  it("l'icône de type, elle, y est — dans le bloc ET dans l'export", () => {
    const c = typee();
    for (const svg of [blocCarte(c), rendreSvg(c, { mode: "export" })]) {
      expect(svg).toContain('data-type="sous-objectif"');
      expect(svg).toContain('data-type="tache"');
      expect(svg).toContain('data-type="habitude"');
    }
  });
});
