import { beforeAll, describe, expect, it, vi } from "vitest";

type Module = typeof import("./saisieRapide");

/**
 * ⭐ La phrase ENTIÈRE : répétitions, périodes, « hier », priorité
 * (audit du 2026-10-20, constat 18 — Lucie, Rémi, Priya, Bruno, Karim).
 *
 * Même dispositif que `saisieRapide.test.ts` : la langue se pose avant
 * l'import (PIEGES § 14.2).
 */
async function sous(langue: "fr-FR" | "en-US"): Promise<Module> {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: langue, languages: [langue] });
  return import("./saisieRapide");
}

/** Le mardi du labo. */
const AUJ = "2026-10-20";
const vide = { texte: "", choisie: null, ecartee: null };

describe("en français", () => {
  let m: Module;
  beforeAll(async () => {
    m = await sous("fr-FR");
  });
  const lu = (phrase: string, parDefaut: string | null = null) => m.lirePhrase(phrase, AUJ, parDefaut);

  describe("les répétitions", () => {
    it("⭐ « tous les lundis faire le point » : une routine du lundi, le titre nettoyé", () => {
      const r = lu("tous les lundis faire le point");
      expect(r.recurrence).toEqual({ valeur: "[1]", mots: "tous les lundis" });
      expect(r.titre).toBe("Faire le point");
      expect(r.date).toBeNull();
    });

    it("⭐ « faire ma compta chaque vendredi » : plus « faire ma compta chaque », daté d'un seul vendredi", () => {
      const r = lu("faire ma compta chaque vendredi");
      expect(r.recurrence?.valeur).toBe("[5]");
      expect(r.titre).toBe("faire ma compta");
      expect(r.date).toBeNull();
    });

    it("plusieurs jours, tous les jours, en semaine", () => {
      expect(lu("Sport tous les lundis et jeudis").recurrence?.valeur).toBe("[1,4]");
      expect(lu("Sport tous les lundis, mercredis et vendredis").recurrence?.valeur).toBe("[1,3,5]");
      expect(lu("Méditer tous les jours").recurrence?.valeur).toBe("daily");
      expect(lu("Méditer chaque jour").titre).toBe("Méditer");
      expect(lu("Relever le courrier en semaine").recurrence?.valeur).toBe("weekdays");
      expect(lu("Stand-up tous les jours de la semaine").recurrence).toEqual({
        valeur: "weekdays",
        mots: "tous les jours de la semaine",
      });
      expect(lu("Stand-up du lundi au vendredi").recurrence?.valeur).toBe("weekdays");
    });

    it("⚠️ « le lundi » seul n'est pas une répétition", () => {
      expect(lu("Réunion le lundi 26").recurrence).toBeNull();
      expect(lu("Réunion lundi").recurrence).toBeNull();
    });

    it("une répétition l'emporte sur une date : la date reste dans le titre", () => {
      const r = lu("Point tous les lundis à partir de demain");
      expect(r.recurrence?.valeur).toBe("[1]");
      expect(r.date).toBeNull();
      expect(r.titre).toBe("Point à partir de demain");
    });

    it("écartée, la répétition laisse ses mots ENTIERS — et « vendredi » ne devient pas une date", () => {
      const r = m.lirePhrase("faire ma compta chaque vendredi", AUJ, null, { recurrence: "chaque vendredi" });
      expect(r.recurrence).toBeNull();
      expect(r.date).toBeNull();
      expect(r.titre).toBe("faire ma compta chaque vendredi");
    });
  });

  describe("les périodes et « hier »", () => {
    it("fin du mois, ce week-end, la semaine prochaine, le mois prochain", () => {
      expect(lu("Déclarer mon CA fin du mois").date?.jour).toBe("2026-10-31");
      expect(lu("Déclarer mon CA à la fin du mois").titre).toBe("Déclarer mon CA");
      expect(lu("Ranger le garage ce week-end").date?.jour).toBe("2026-10-24");
      expect(lu("Ranger le garage ce weekend").date?.jour).toBe("2026-10-24");
      expect(lu("Appeler la banque la semaine prochaine").date?.jour).toBe("2026-10-26");
      expect(lu("Renouveler la carte le mois prochain").date?.jour).toBe("2026-11-01");
      expect(lu("Renouveler la carte avant la fin du mois").titre).toBe("Renouveler la carte");
    });

    it("ce week-end, le samedi ou le dimanche, c'est le jour même", () => {
      expect(m.lirePhrase("Ranger ce week-end", "2026-10-24").date?.jour).toBe("2026-10-24");
      expect(m.lirePhrase("Ranger ce week-end", "2026-10-25").date?.jour).toBe("2026-10-25");
    });

    it("hier et avant-hier : on note ce qu'on a fait", () => {
      expect(lu("Facture Dupont envoyée hier").date?.jour).toBe("2026-10-19");
      expect(lu("Facture Dupont envoyée avant-hier").date?.jour).toBe("2026-10-18");
      expect(lu("Facture Dupont envoyée avant-hier").titre).toBe("Facture Dupont envoyée");
    });
  });

  describe("la priorité", () => {
    it("⭐ « formation compta urgent » : élevée, le mot retiré", () => {
      const r = lu("formation compta urgent");
      expect(r.priorite).toEqual({ valeur: "high", mots: "urgent" });
      expect(r.titre).toBe("formation compta");
    });

    it("pas urgent, prioritaire, !haute, !!", () => {
      expect(lu("Trier les photos pas urgent").priorite?.valeur).toBe("low");
      expect(lu("Trier les photos pas urgent").titre).toBe("Trier les photos");
      expect(lu("Devis Martin prioritaire").priorite?.valeur).toBe("high");
      expect(lu("Devis Martin !haute").priorite?.valeur).toBe("high");
      expect(lu("Devis Martin !!").priorite?.valeur).toBe("high");
      expect(lu("Devis Martin !faible").priorite?.valeur).toBe("low");
    });

    it("⚠️ « important » n'est pas lu, ni un mot qui contient « urgent »", () => {
      expect(lu("Relire le document important").priorite).toBeNull();
      expect(lu("Appeler les urgentistes").priorite).toBeNull();
    });

    it("priorité ET date ET heure dans la même phrase", () => {
      const r = lu("Rappeler Paul demain 14h urgent");
      expect(r.priorite?.valeur).toBe("high");
      expect(r.date).toEqual({ jour: "2026-10-21", heure: "14:00", mots: "demain 14h" });
      expect(r.titre).toBe("Rappeler Paul");
    });

    it("une phrase qui n'est que des mots lus n'est pas lue", () => {
      expect(lu("urgent demain")).toEqual({ titre: "urgent demain", date: null, recurrence: null, priorite: null });
    });
  });

  describe("resoudreSaisie : ce que la ligne crée", () => {
    it("une routine n'a pas de date, même sur la carte d'Aujourd'hui", () => {
      const r = m.resoudreSaisie({ ...vide, texte: "tous les lundis faire le point" }, AUJ, AUJ);
      expect(r).toMatchObject({ titre: "Faire le point", jour: null, recurrence: "[1]", origine: null });
    });

    it("une date CHOISIE au calendrier l'emporte sur la répétition, qui reste dans le titre", () => {
      const r = m.resoudreSaisie({ texte: "Compta chaque vendredi urgent", choisie: "2026-10-30", ecartee: null }, AUJ);
      expect(r).toMatchObject({ titre: "Compta chaque vendredi", jour: "2026-10-30", recurrence: null, priorite: "high" });
    });

    it("la priorité écartée reste dans le titre", () => {
      const r = m.resoudreSaisie({ ...vide, texte: "formation compta urgent", ecarteePriorite: "urgent" }, AUJ);
      expect(r).toMatchObject({ titre: "formation compta urgent", priorite: null });
    });

    it("les quatre colonnes : une répétition efface date et heure", () => {
      expect(m.ecrituresRapides({ jour: null, heure: null, recurrence: "[1]" })).toEqual({
        recurrence: "[1]",
        due_date: null,
        start_at: null,
        end_at: null,
      });
      expect(m.ecrituresRapides({ jour: "2026-10-21", heure: "14:00", recurrence: null })).toEqual({
        recurrence: "none",
        due_date: "2026-10-21",
        start_at: "14:00",
        end_at: "15:00",
      });
    });
  });
});

describe("in English", () => {
  let m: Module;
  beforeAll(async () => {
    m = await sous("en-US");
  });
  const lu = (phrase: string) => m.lirePhrase(phrase, AUJ);

  it("every Monday, on Mondays and Thursdays, daily, weekdays", () => {
    expect(lu("Weekly review every Monday").recurrence?.valeur).toBe("[1]");
    expect(lu("Weekly review every Monday").titre).toBe("Weekly review");
    expect(lu("Gym on Mondays and Thursdays").recurrence?.valeur).toBe("[1,4]");
    expect(lu("Meditate daily").recurrence?.valeur).toBe("daily");
    expect(lu("Check mail every weekday").recurrence?.valeur).toBe("weekdays");
    // “on Monday” (singular) is a date, not a routine.
    expect(lu("Call Ann on Monday").recurrence).toBeNull();
    expect(lu("Call Ann on Monday").date?.jour).toBe("2026-10-26");
  });

  it("end of the month, this weekend, next week, yesterday", () => {
    expect(lu("File taxes by the end of the month").date?.jour).toBe("2026-10-31");
    expect(lu("File taxes by the end of the month").titre).toBe("File taxes");
    expect(lu("Clean garage this weekend").date?.jour).toBe("2026-10-24");
    expect(lu("Call the bank next week").date?.jour).toBe("2026-10-26");
    expect(lu("Sent invoice yesterday").date?.jour).toBe("2026-10-19");
  });

  it("urgent, asap, !high, low priority", () => {
    expect(lu("Fix the bug asap").priorite?.valeur).toBe("high");
    expect(lu("Fix the bug asap").titre).toBe("Fix the bug");
    expect(lu("#Acme !high").priorite?.valeur).toBe("high");
    expect(lu("Sort photos low priority").priorite?.valeur).toBe("low");
    expect(lu("Sort photos not urgent").priorite?.valeur).toBe("low");
  });

  it("⚠️ the English app doesn't read French words, nor the reverse", () => {
    expect(lu("Compta tous les lundis").recurrence).toBeNull();
  });
});
