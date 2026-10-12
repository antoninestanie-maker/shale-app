import { describe, expect, it } from "vitest";
import { addDays } from "../logic";
import { objectif } from "./objectif.testutil";
import { estRacine, joursDeRetard, objectifsEnRetard } from "./retard";

const AUJ = "2026-10-11";

describe("joursDeRetard — l'échéance d'un objectif", () => {
  it("dépassée : le nombre de jours écoulés", () => {
    expect(joursDeRetard(addDays(AUJ, -1), AUJ)).toBe(1);
    expect(joursDeRetard(addDays(AUJ, -73), AUJ)).toBe(73);
  });

  it("⚠️ aujourd'hui n'est pas un retard : il reste la journée", () => {
    expect(joursDeRetard(AUJ, AUJ)).toBe(0);
  });

  it("à venir, absente ou illisible : 0", () => {
    expect(joursDeRetard(addDays(AUJ, 5), AUJ)).toBe(0);
    expect(joursDeRetard(null, AUJ)).toBe(0);
    expect(joursDeRetard("", AUJ)).toBe(0);
    expect(joursDeRetard("pas-une-date", AUJ)).toBe(0);
  });

  it("⚠️ un changement d'heure ne retire pas un jour (compté à midi)", () => {
    // Le dernier dimanche d'octobre, l'heure recule : la journée dure 25 heures.
    expect(joursDeRetard("2026-10-24", "2026-10-26")).toBe(2);
    // Le dernier dimanche de mars, elle avance : 23 heures.
    expect(joursDeRetard("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("une échéance avec une heure se lit par son jour", () => {
    expect(joursDeRetard(`${addDays(AUJ, -3)} 18:00`, AUJ)).toBe(3);
  });
});

describe("objectifsEnRetard — la ligne « En retard » d'Aujourd'hui", () => {
  const goals = [
    objectif({ id: 1, title: "Certification", deadline: addDays(AUJ, -57) }),
    objectif({ id: 2, title: "Clients", deadline: addDays(AUJ, -73) }),
    objectif({ id: 3, title: "Étape en retard", parent_goal_id: 2, deadline: addDays(AUJ, -10) }),
    objectif({ id: 4, title: "À venir", deadline: addDays(AUJ, 20) }),
    objectif({ id: 5, title: "Sans échéance" }),
    objectif({ id: 6, title: "Fini en retard", deadline: addDays(AUJ, -5) }),
  ];
  const acheve = (g: { id: number }) => g.id === 6;

  it("les racines dépassées et pas achevées, la plus en retard d'abord", () => {
    expect(objectifsEnRetard(goals, acheve, AUJ).map((x) => [x.goal.id, x.jours])).toEqual([
      [2, 73],
      [1, 57],
    ]);
  });

  it("⭐ une ÉTAPE en retard ne remonte pas comme un objectif à part", () => {
    expect(objectifsEnRetard(goals, acheve, AUJ).some((x) => x.goal.id === 3)).toBe(false);
    expect(estRacine(goals[2], goals)).toBe(false);
  });

  it("une étape dont le parent a disparu (corbeille) redevient une racine", () => {
    const orpheline = objectif({ id: 9, parent_goal_id: 999, deadline: addDays(AUJ, -2) });
    expect(estRacine(orpheline, [orpheline])).toBe(true);
    expect(objectifsEnRetard([orpheline], () => false, AUJ)).toHaveLength(1);
  });

  it("rien en retard : une liste vide — la ligne ne s'affiche pas", () => {
    expect(objectifsEnRetard([goals[3], goals[4]], () => false, AUJ)).toEqual([]);
  });
});
