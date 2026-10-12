import { describe, expect, it } from "vitest";
import { addDays, weekdayOf } from "../logic";
import { lundiProchain, plusUnJour, prochainJourDeSemaine } from "./dates";

/** Un dimanche — vérifié ci-dessous, pas supposé. */
const AUJ = "2026-10-11";

describe("prochainJourDeSemaine", () => {
  it("le jour de référence est un dimanche", () => {
    expect(weekdayOf(AUJ)).toBe(0);
  });

  it("le prochain jeudi, le prochain lundi", () => {
    expect(prochainJourDeSemaine(AUJ, 4)).toBe(addDays(AUJ, 4));
    expect(prochainJourDeSemaine(AUJ, 1)).toBe(addDays(AUJ, 1));
  });

  it("⭐ jamais aujourd'hui : le même jour de la semaine, c'est dans sept jours", () => {
    for (let i = 0; i < 7; i++) {
      const jour = addDays(AUJ, i);
      const lu = prochainJourDeSemaine(jour, weekdayOf(jour));
      expect(lu).toBe(addDays(jour, 7));
    }
  });

  it("« lundi prochain » est toujours un lundi à venir, même un lundi", () => {
    for (let i = 0; i < 7; i++) {
      const jour = addDays(AUJ, i);
      const lundi = lundiProchain(jour);
      expect(weekdayOf(lundi)).toBe(1);
      expect(lundi > jour).toBe(true);
      expect(lundi <= addDays(jour, 7)).toBe(true);
    }
  });
});

describe("plusUnJour — « + 1 jour »", () => {
  it("⭐ part de la date de la TÂCHE quand elle est à venir : le 16 devient le 17", () => {
    expect(plusUnJour({ due_date: addDays(AUJ, 5) }, AUJ)).toBe(addDays(AUJ, 6));
  });

  it("datée d'aujourd'hui : demain", () => {
    expect(plusUnJour({ due_date: AUJ }, AUJ)).toBe(addDays(AUJ, 1));
  });

  it("⭐ en retard : demain, pas le lendemain d'une date déjà passée", () => {
    expect(plusUnJour({ due_date: addDays(AUJ, -1) }, AUJ)).toBe(addDays(AUJ, 1));
    expect(plusUnJour({ due_date: addDays(AUJ, -30) }, AUJ)).toBe(addDays(AUJ, 1));
  });

  it("sans date : demain", () => {
    expect(plusUnJour({ due_date: null }, AUJ)).toBe(addDays(AUJ, 1));
  });

  it("le dernier jour du mois passe au mois suivant", () => {
    expect(plusUnJour({ due_date: "2026-10-31" }, AUJ)).toBe("2026-11-01");
  });
});
