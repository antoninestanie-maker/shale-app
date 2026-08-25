import { describe, expect, it } from "vitest";

import { burnMensuel, BURN_VIDE, type Burn } from "./burn";
import { recurrent } from "./finance.testutil";
import { dateEpuisement, moisAffiches, runway } from "./runway";

/**
 * Le chiffre roi du module. Les cas limites sont l'essentiel du fichier : un
 * runway est un nombre auquel on se fie pour décider de prendre un risque, et
 * les quatre manières de ne pas pouvoir le calculer ne se ressemblent pas.
 */

const burnDe = (netCents: number, actifs = 1): Burn => ({
  entreesCents: 0,
  sortiesCents: netCents,
  netCents,
  actifs,
});

describe("runway — le cas nominal", () => {
  it("divise les liquidités par le burn net", () => {
    const r = runway(1_000_000, burnDe(200_000), "2026-08-25");
    expect(r.etat).toBe("ok");
    expect(r.mois).toBe(5);
    expect(moisAffiches(r.mois!)).toBe(5);
  });

  it("garde la fraction de mois", () => {
    // 7 400 € pour 1 000 €/mois = 7,4 mois
    const r = runway(740_000, burnDe(100_000), "2026-08-25");
    expect(moisAffiches(r.mois!)).toBe(7.4);
  });

  it("date l'épuisement sur le vrai calendrier", () => {
    const r = runway(300_000, burnDe(100_000), "2026-08-25");
    expect(r.dateEpuisement).toBe("2026-11-25");
  });

  it("n'affiche qu'une décimale — le burn est une prévision, pas une mesure", () => {
    expect(moisAffiches(7.4321)).toBe(7.4);
    expect(moisAffiches(7.46)).toBe(7.5);
  });
});

describe("runway — les quatre façons de ne pas pouvoir répondre", () => {
  it("aucun compte relevé : « sans-donnees », et surtout pas zéro mois", () => {
    const r = runway(null, burnDe(200_000), "2026-08-25");
    expect(r.etat).toBe("sans-donnees");
    expect(r.mois).toBeNull();
    expect(r.dateEpuisement).toBeNull();
  });

  it("aucun flux déclaré : « sans-burn », et surtout pas l'infini", () => {
    // Ne rien avoir saisi ne veut pas dire ne rien dépenser. Répondre « ∞ » à
    // quelqu'un qui n'a pas fini de remplir le module serait un mensonge
    // confortable.
    const r = runway(1_000_000, BURN_VIDE, "2026-08-25");
    expect(r.etat).toBe("sans-burn");
    expect(r.mois).toBeNull();
  });

  it("burn net nul mais des flux déclarés : rien ne s'épuise", () => {
    const r = runway(1_000_000, burnDe(0, 2), "2026-08-25");
    expect(r.etat).toBe("infini");
    expect(r.mois).toBeNull();
  });

  it("burn net négatif (on épargne) : rien ne s'épuise non plus", () => {
    const r = runway(1_000_000, burnDe(-150_000, 3), "2026-08-25");
    expect(r.etat).toBe("infini");
  });

  it("liquidités déjà à zéro ou négatives : « epuise », dès aujourd'hui", () => {
    expect(runway(0, burnDe(100_000), "2026-08-25")).toMatchObject({
      etat: "epuise",
      mois: 0,
      dateEpuisement: "2026-08-25",
    });
    expect(runway(-45_000, burnDe(100_000), "2026-08-25").etat).toBe("epuise");
  });

  it("l'absence de liquidités prime sur tout le reste", () => {
    // Même avec un burn parfaitement renseigné, sans numérateur il n'y a rien à
    // diviser. Et même sans burn : c'est le premier test, exprès.
    expect(runway(null, BURN_VIDE, "2026-08-25").etat).toBe("sans-donnees");
    expect(runway(null, burnDe(0, 4), "2026-08-25").etat).toBe("sans-donnees");
  });
});

describe("dateEpuisement", () => {
  it("passe par le vrai calendrier pour les mois entiers", () => {
    expect(dateEpuisement("2026-01-31", 1)).toBe("2026-02-28");
    expect(dateEpuisement("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("convertit la fraction au prorata du mois où elle tombe", () => {
    // 0,5 mois à partir du 1er février 2026 (28 jours) = 14 jours.
    expect(dateEpuisement("2026-02-01", 0.5)).toBe("2026-02-15");
    // 0,5 mois à partir du 1er juillet (31 jours) = 16 jours (arrondi).
    expect(dateEpuisement("2026-07-01", 0.5)).toBe("2026-07-17");
  });

  it("zéro mois rend la date de départ", () => {
    expect(dateEpuisement("2026-08-25", 0)).toBe("2026-08-25");
  });

  it("franchit une année bissextile sans déborder", () => {
    expect(dateEpuisement("2028-01-31", 1)).toBe("2028-02-29");
  });
});

describe("runway, branché sur de vrais flux", () => {
  it("un indépendant dont les revenus s'arrêtent", () => {
    const flux = [
      recurrent({ label: "Loyer", amount_cents: 95_000 }),
      recurrent({ label: "Charges", amount_cents: 18_000 }),
      recurrent({ label: "Assurance", amount_cents: 36_000, frequency: "annuel" }),
      recurrent({ label: "Courses", amount_cents: 12_000, frequency: "hebdo" }),
      // Le contrat s'est terminé en juin : il ne compte plus.
      recurrent({
        label: "Mission",
        amount_cents: 350_000,
        direction: "entree",
        active_to: "2026-06-30",
      }),
    ];
    const burn = burnMensuel(flux, "2026-08-25");
    expect(burn.entreesCents).toBe(0);
    expect(burn.sortiesCents).toBe(95_000 + 18_000 + 3_000 + 52_000);

    const r = runway(2_500_000, burn, "2026-08-25");
    expect(r.etat).toBe("ok");
    expect(moisAffiches(r.mois!)).toBe(14.9);
  });
});
