import { describe, expect, it } from "vitest";

import { arbitrer, decider, horodatageMonotone } from "./resolution";

/** Étape 5 — la règle de résolution des conflits, isolée. */

const v = (ts: string, device = "A") => ({ ts, device });

describe("arbitrage last-write-wins", () => {
  it("la version la plus récente gagne", () => {
    expect(arbitrer(v("2026-08-02T11:00:00.000Z"), v("2026-08-02T10:00:00.000Z"))).toBe("distant");
    expect(arbitrer(v("2026-08-02T10:00:00.000Z"), v("2026-08-02T11:00:00.000Z"))).toBe("local");
  });

  it("compare à la MILLISECONDE", () => {
    expect(arbitrer(v("2026-08-02T10:00:00.002Z"), v("2026-08-02T10:00:00.001Z"))).toBe("distant");
  });

  it("l'ordre de comparaison des textes est bien l'ordre chronologique", () => {
    // Le format ISO à largeur fixe est choisi pour ça : sans zéros de tête, la
    // comparaison de chaînes placerait « 9h » après « 10h ».
    const instants = [
      "2026-08-02T09:00:00.000Z",
      "2026-08-02T10:00:00.000Z",
      "2026-12-31T23:59:59.999Z",
      "2027-01-01T00:00:00.000Z",
    ];
    for (let i = 1; i < instants.length; i++) {
      expect(arbitrer(v(instants[i]), v(instants[i - 1]))).toBe("distant");
    }
  });

  it("départage une égalité parfaite de façon DÉTERMINISTE", () => {
    // La propriété qui compte : les deux appareils élisent le même vainqueur.
    // Sans elle, chacun garderait sa version en croyant avoir raison, et ils
    // divergeraient définitivement.
    const meme = "2026-08-02T10:00:00.000Z";
    expect(arbitrer(v(meme, "B"), v(meme, "A"))).toBe("distant");
    expect(arbitrer(v(meme, "A"), v(meme, "B"))).toBe("local");
  });

  it("reconnaît deux versions rigoureusement identiques", () => {
    const meme = "2026-08-02T10:00:00.000Z";
    expect(arbitrer(v(meme, "A"), v(meme, "A"))).toBe("identique");
  });

  it("est cohérent quel que soit le sens de l'appel", () => {
    const cas: [string, string, string, string][] = [
      ["2026-08-02T10:00:00.000Z", "A", "2026-08-02T11:00:00.000Z", "B"],
      ["2026-08-02T10:00:00.000Z", "B", "2026-08-02T10:00:00.000Z", "A"],
      ["2026-08-02T12:00:00.000Z", "A", "2026-08-02T10:00:00.000Z", "Z"],
    ];
    for (const [ts1, d1, ts2, d2] of cas) {
      const sens1 = arbitrer(v(ts1, d1), v(ts2, d2));
      const sens2 = arbitrer(v(ts2, d2), v(ts1, d1));
      if (sens1 === "identique") expect(sens2).toBe("identique");
      else expect(sens2).toBe(sens1 === "distant" ? "local" : "distant");
    }
  });
});

describe("faut-il appliquer une ligne reçue ?", () => {
  it("oui, si rien n'attend localement", () => {
    expect(decider(v("2026-08-02T10:00:00.000Z"), null)).toBe("appliquer");
  });

  it("non, si une saisie locale plus récente n'est pas encore partie", () => {
    // Le cas qui perdrait une saisie que l'utilisateur vient de faire.
    expect(decider(v("2026-08-02T10:00:00.000Z", "B"), v("2026-08-02T11:00:00.000Z", "A"))).toBe(
      "ignorer",
    );
  });

  it("oui, si la saisie locale en attente est plus ancienne", () => {
    // Notre envoi partira quand même et sera rejeté par le serveur : sans
    // conséquence, et bien plus simple que de tenter de l'annuler.
    expect(decider(v("2026-08-02T11:00:00.000Z", "B"), v("2026-08-02T10:00:00.000Z", "A"))).toBe(
      "appliquer",
    );
  });
});

describe("horloge protégée contre une machine mal réglée", () => {
  it("laisse passer une horloge qui avance normalement", () => {
    expect(horodatageMonotone("2026-08-02T10:00:01.000Z", "2026-08-02T10:00:00.000Z")).toBe(
      "2026-08-02T10:00:01.000Z",
    );
  });

  it("ne recule JAMAIS", () => {
    // Changement d'heure mal géré, resynchronisation NTP, pile morte : sans
    // cette garde, les écritures suivantes seraient refusées par le serveur
    // (moins récentes que la précédente) et l'utilisateur verrait sa
    // synchronisation s'arrêter sans explication.
    const apres = horodatageMonotone("2026-08-02T09:00:00.000Z", "2026-08-02T10:00:00.000Z");
    expect(apres > "2026-08-02T10:00:00.000Z").toBe(true);
  });

  it("avance d'une milliseconde à horodatage identique", () => {
    // Deux écritures dans la même milliseconde doivent rester ordonnées entre
    // elles, sinon la seconde serait vue comme un doublon et ignorée.
    expect(horodatageMonotone("2026-08-02T10:00:00.000Z", "2026-08-02T10:00:00.000Z")).toBe(
      "2026-08-02T10:00:00.001Z",
    );
  });

  it("gère les retenues de seconde, de minute, de jour et d'année", () => {
    // Le premier argument est un instant DÉPASSÉ (horloge qui a reculé), ce qui
    // force le chemin d'incrémentation.
    const recule = "2020-01-01T00:00:00.000Z";
    expect(horodatageMonotone(recule, "2026-08-02T10:00:00.999Z")).toBe("2026-08-02T10:00:01.000Z");
    expect(horodatageMonotone(recule, "2026-08-02T10:59:59.999Z")).toBe("2026-08-02T11:00:00.000Z");
    expect(horodatageMonotone(recule, "2026-08-02T23:59:59.999Z")).toBe("2026-08-03T00:00:00.000Z");
    expect(horodatageMonotone(recule, "2026-12-31T23:59:59.999Z")).toBe("2027-01-01T00:00:00.000Z");
  });

  it("reste monotone sur une rafale d'écritures", () => {
    let dernier: string | null = null;
    const emis: string[] = [];
    for (let i = 0; i < 100; i++) {
      dernier = horodatageMonotone("2026-08-02T10:00:00.000Z", dernier);
      emis.push(dernier);
    }
    expect(new Set(emis).size).toBe(100);
    expect([...emis].sort()).toEqual(emis);
  });
});
