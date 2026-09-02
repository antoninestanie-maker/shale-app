import { describe, expect, it } from "vitest";

import {
  capaciteDuJour,
  creneauxLibres,
  creneauxOccupes,
  heureOuvrable,
  mediane,
  profilDisponibilite,
  REPLI_DEBUT,
  REPLI_FIN,
  SESSIONS_MINIMUM,
} from "./disponibilite";
import type { EntreeAgenda } from "./agenda";
import type { FocusSession } from "../types";

/** Chantier B — les heures où Antonin travaille vraiment. */

let idSession = 1;
const session = (date: string, debut: string, fin: string | null, kind = "focus"): FocusSession => ({
  id: idSession++,
  task_id: null,
  label: null,
  started_at: `${date} ${debut}:00`,
  ended_at: fin ? `${date} ${fin}:00` : null,
  planned_min: 25,
  kind,
});

const entree = (start: string | null, duree: number | null): EntreeAgenda => ({
  kind: "task", id: 1, titre: "x", date: "2026-09-02", start_at: start,
  end_at: null, allDay: false, color: null, dureeMin: duree, enRetard: false,
  reports: 0, faite: false,
});

/** 2026-09-01 est un mardi ; 2026-09-05 un samedi. */
const MARDI = "2026-09-01";
const SAMEDI = "2026-09-05";

/**
 * Assez de sessions pour que le profil se déclare appris — et de VRAIS mardis.
 *
 * ⚠️ Une première version de cette aide égrenait des dates « au hasard » tous
 * les deux jours : elle apprenait donc aussi le samedi, et deux tests passaient
 * pour de mauvaises raisons. Un jeu d'essai qui ne dit pas ce qu'il croit dire
 * est pire qu'un test absent.
 */
function dixMardisDe(debut: string, fin: string): FocusSession[] {
  return Array.from({ length: SESSIONS_MINIMUM }, (_, i) => {
    const d = new Date("2026-09-01T12:00:00"); // un mardi
    d.setDate(d.getDate() - 7 * (i + 1));
    return session(d.toISOString().slice(0, 10), debut, fin);
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe("ce qu'on refuse d'apprendre", () => {
  it("⭐ moins de dix sessions : le profil se déclare NON appris", () => {
    // Moins que cela décrit une semaine, pas une habitude. L'app présenterait
    // un accident comme une règle.
    const profil = profilDisponibilite([session(MARDI, "14:00", "15:00")]);
    expect(profil.appris).toBe(false);
    expect(profil.repli).toEqual({ debut: REPLI_DEBUT, fin: REPLI_FIN });
  });

  it("ignore les pauses et les sessions en cours", () => {
    // Une pause n'est pas du travail ; une session sans fin n'a pas de durée.
    // Les compter fausserait la mesure dans deux sens opposés.
    const sessions = [
      ...Array.from({ length: 20 }, () => session(MARDI, "14:00", "15:00", "break")),
      ...Array.from({ length: 20 }, () => session(MARDI, "14:00", null)),
    ];
    expect(profilDisponibilite(sessions).sessions).toBe(0);
  });

  it("ignore une session dont la fin précède le début", () => {
    expect(profilDisponibilite([session(MARDI, "15:00", "14:00")]).sessions).toBe(0);
  });
});

describe("le repli, quand il n'y a rien à apprendre", () => {
  const vide = profilDisponibilite([]);

  it("propose 9 h – 18 h en jours ouvrés", () => {
    expect(heureOuvrable(vide, MARDI, 8)).toBe(false);
    expect(heureOuvrable(vide, MARDI, 9)).toBe(true);
    expect(heureOuvrable(vide, MARDI, 17)).toBe(true);
    expect(heureOuvrable(vide, MARDI, 18)).toBe(false);
  });

  it("ne propose rien le week-end", () => {
    expect(heureOuvrable(vide, SAMEDI, 14)).toBe(false);
  });

  it("les bornes sont réglables", () => {
    const tot = profilDisponibilite([], { debut: 6, fin: 12 });
    expect(heureOuvrable(tot, MARDI, 7)).toBe(true);
    expect(heureOuvrable(tot, MARDI, 14)).toBe(false);
  });
});

describe("ce qui s'apprend des sessions", () => {
  it("⭐ répartit une session à cheval sur toutes les heures qu'elle traverse", () => {
    // La compter entièrement sur son heure de début aurait fait croire que
    // personne ne travaille jamais à midi.
    const profil = profilDisponibilite([session(MARDI, "10:40", "12:10")]);
    const mardi = profil.minutes[2];
    expect(mardi[10]).toBe(20);
    expect(mardi[11]).toBe(60);
    expect(mardi[12]).toBe(10);
  });

  it("une heure jamais tenue n'est pas proposée, même en pleine journée", () => {
    const profil = profilDisponibilite(dixMardisDe("14:00", "16:00"));
    expect(profil.appris).toBe(true);
    expect(heureOuvrable(profil, MARDI, 14)).toBe(true);
    // 9 h est une heure ouvrée « en théorie », mais elle n'a jamais été tenue.
    expect(heureOuvrable(profil, MARDI, 9)).toBe(false);
  });

  it("⭐ apprend aussi le week-end, si c'est là qu'on travaille", () => {
    // Le repli refuse le samedi par principe ; les données, elles, ne se
    // trompent pas. Un calendrier qui refuse de voir qu'on travaille le samedi
    // n'apprend pas, il fait la morale.
    const samedis = Array.from({ length: 4 }, (_, i) => {
      const d = new Date("2026-09-05T12:00:00"); // un samedi
      d.setDate(d.getDate() - 7 * (i + 1));
      return session(d.toISOString().slice(0, 10), "10:00", "12:00");
    });
    const profil = profilDisponibilite([...samedis, ...dixMardisDe("14:00", "16:00")]);
    expect(profil.appris).toBe(true);
    expect(heureOuvrable(profil, SAMEDI, 10)).toBe(true);
    expect(heureOuvrable(profil, SAMEDI, 15)).toBe(false);
  });
});

describe("la capacité d'une journée", () => {
  it("⭐ est la MÉDIANE des journées observées, pas leur moyenne", () => {
    // Une seule journée exceptionnelle relèverait la moyenne de tous les mardis,
    // et l'app cesserait d'avertir quelqu'un dont les mardis font 90 minutes.
    expect(mediane([90, 90, 90, 90, 360])).toBe(90);
    expect(mediane([60, 120])).toBe(90);
  });

  it("vaut ce qui a réellement été tenu ce jour de semaine", () => {
    const profil = profilDisponibilite(dixMardisDe("14:00", "16:00"));
    expect(capaciteDuJour(profil, MARDI)).toBe(120);
  });

  it("vaut zéro un jour où rien n'a jamais été tenu", () => {
    const profil = profilDisponibilite(dixMardisDe("14:00", "16:00"));
    expect(capaciteDuJour(profil, SAMEDI)).toBe(0);
  });

  it("sans profil appris, retombe sur les bornes du repli", () => {
    const vide = profilDisponibilite([]);
    expect(capaciteDuJour(vide, MARDI)).toBe((REPLI_FIN - REPLI_DEBUT) * 60);
    expect(capaciteDuJour(vide, SAMEDI)).toBe(0);
  });
});

describe("ce qui est déjà pris", () => {
  it("⚠️ fusionne deux créneaux qui se chevauchent", () => {
    // Sans fusion, la charge dépasserait 24 h sur un agenda pourtant tenable.
    const occupes = creneauxOccupes([entree("09:00", 120), entree("10:00", 60)]);
    expect(occupes).toEqual([{ debut: "09:00", fin: "11:00", dureeMin: 120 }]);
  });

  it("ignore ce qui n'a pas d'heure", () => {
    expect(creneauxOccupes([entree(null, null), entree("09:00", 60)])).toHaveLength(1);
  });
});

describe("les créneaux proposés", () => {
  const profil = profilDisponibilite(dixMardisDe("14:00", "18:00"));

  it("ne propose que des heures réellement tenues", () => {
    const libres = creneauxLibres(profil, [], MARDI, { dureeMin: 60 });
    expect(libres.length).toBeGreaterThan(0);
    for (const c of libres) expect(Number(c.debut.slice(0, 2))).toBeGreaterThanOrEqual(14);
  });

  it("évite ce qui est déjà posé", () => {
    const libres = creneauxLibres(profil, [entree("14:00", 120)], MARDI, { dureeMin: 60 });
    for (const c of libres) expect(c.debut >= "16:00").toBe(true);
  });

  it("⚠️ ne propose pas deux créneaux qui se chevauchent", () => {
    // « 14:00 » et « 14:15 » n'offrent pas de choix réel.
    const libres = creneauxLibres(profil, [], MARDI, { dureeMin: 60, limite: 4 });
    for (let i = 1; i < libres.length; i++) {
      expect(libres[i].debut >= libres[i - 1].fin || libres[i].fin <= libres[i - 1].debut).toBe(true);
    }
  });

  it("respecte l'heure plancher pour le jour même", () => {
    const libres = creneauxLibres(profil, [], MARDI, { dureeMin: 60, pasAvant: "16:00" });
    for (const c of libres) expect(c.debut >= "16:00").toBe(true);
  });

  it("ne propose rien un jour sans heure ouvrable", () => {
    expect(creneauxLibres(profil, [], SAMEDI, { dureeMin: 60 })).toEqual([]);
  });

  it("classe la proposition la plus souvent tenue en premier", () => {
    // 15 h a été tenue dix fois, 17 h une seule.
    const sessions = [...dixMardisDe("15:00", "16:00"), session("2026-08-25", "17:00", "18:00")];
    const p = profilDisponibilite(sessions);
    const libres = creneauxLibres(p, [], MARDI, { dureeMin: 60, limite: 2 });
    expect(libres[0].debut).toBe("15:00");
  });
});
