import { describe, expect, it } from "vitest";

import { burnMensuel, BURN_VIDE, estActif, mensualiser, recurrentsPerimes } from "./burn";
import { recurrent } from "./finance.testutil";

/**
 * Le burn est le dénominateur du runway. Une erreur ici ne se voit pas : elle
 * se lit comme un runway plausible, et c'est sur ce chiffre que quelqu'un
 * décide de prendre un risque ou de n'en pas prendre.
 */

describe("mensualiser", () => {
  it("laisse un mensuel intact", () => {
    expect(mensualiser(95_000, "mensuel")).toBe(95_000);
  });

  it("compte 52 semaines par an, pas 48", () => {
    // 30 € par semaine = 130 € par mois, pas 120 €. L'écart annuel est de
    // 120 €, soit un demi-mois de runway pour qui en a trois.
    expect(mensualiser(3_000, "hebdo")).toBe(13_000);
  });

  it("divise un trimestriel par trois et un annuel par douze", () => {
    expect(mensualiser(30_000, "trimestriel")).toBe(10_000);
    expect(mensualiser(120_000, "annuel")).toBe(10_000);
  });

  it("arrondit au centime, sans jamais passer par un flottant", () => {
    // 100,00 € / 3 = 33,333… → 33,33 €
    expect(mensualiser(10_000, "trimestriel")).toBe(3_333);
    // 0,10 € / 3 = 0,0333… → 0,03 €. Le cas qui casse en flottant.
    expect(mensualiser(10, "trimestriel")).toBe(3);
    // Moitié pile : arrondi à l'écart de zéro.
    expect(mensualiser(6, "annuel")).toBe(1); // 0,5 → 1
  });

  it("supporte des montants énormes sans perdre un centime", () => {
    expect(mensualiser(999_999_999_999, "annuel")).toBe(83_333_333_333);
  });
});

describe("estActif", () => {
  const r = recurrent({ active_from: "2026-03-01", active_to: "2026-06-30" });

  it("exclut avant le début et après la fin, bornes comprises", () => {
    expect(estActif(r, "2026-02-28")).toBe(false);
    expect(estActif(r, "2026-03-01")).toBe(true);
    expect(estActif(r, "2026-06-30")).toBe(true);
    expect(estActif(r, "2026-07-01")).toBe(false);
  });

  it("`active_to` nul veut dire toujours actif", () => {
    expect(estActif(recurrent({ active_to: null }), "2099-01-01")).toBe(true);
  });
});

describe("burnMensuel", () => {
  it("sur une liste vide, ne devine rien", () => {
    expect(burnMensuel([], "2026-08-25")).toEqual(BURN_VIDE);
  });

  it("sépare les entrées des sorties et normalise les fréquences", () => {
    const burn = burnMensuel(
      [
        recurrent({ label: "Loyer", amount_cents: 95_000, frequency: "mensuel" }),
        recurrent({ label: "Assurance", amount_cents: 36_000, frequency: "annuel" }),
        recurrent({ label: "Courses", amount_cents: 8_000, frequency: "hebdo" }),
        recurrent({
          label: "Prestation",
          amount_cents: 200_000,
          direction: "entree",
          frequency: "mensuel",
        }),
      ],
      "2026-08-25",
    );

    expect(burn.sortiesCents).toBe(95_000 + 3_000 + 34_667);
    expect(burn.entreesCents).toBe(200_000);
    expect(burn.netCents).toBe(burn.sortiesCents - 200_000);
    expect(burn.actifs).toBe(4);
  });

  it("ignore les flux hors de leur période, et le dit dans `actifs`", () => {
    const burn = burnMensuel(
      [
        recurrent({ amount_cents: 50_000, active_to: "2026-01-31" }),
        recurrent({ amount_cents: 30_000, active_from: "2027-01-01" }),
        recurrent({ amount_cents: 10_000 }),
      ],
      "2026-08-25",
    );
    expect(burn.sortiesCents).toBe(10_000);
    expect(burn.actifs).toBe(1);
  });

  it("distingue « autant de revenus que de charges » de « rien de déclaré »", () => {
    // Les deux donnent un net nul, et ne veulent pas dire la même chose : c'est
    // `actifs` qui les sépare, et le runway s'en sert.
    const equilibre = burnMensuel(
      [
        recurrent({ amount_cents: 100_000, direction: "sortie" }),
        recurrent({ amount_cents: 100_000, direction: "entree" }),
      ],
      "2026-08-25",
    );
    expect(equilibre.netCents).toBe(0);
    expect(equilibre.actifs).toBe(2);
    expect(burnMensuel([], "2026-08-25").actifs).toBe(0);
  });

  it("rend un net NÉGATIF quand on épargne", () => {
    const burn = burnMensuel(
      [
        recurrent({ amount_cents: 80_000, direction: "sortie" }),
        recurrent({ amount_cents: 300_000, direction: "entree" }),
      ],
      "2026-08-25",
    );
    expect(burn.netCents).toBe(-220_000);
  });

  it("suit un changement de fréquence en cours de période", () => {
    // Un abonnement passé du mensuel à l'annuel se déclare en deux lignes qui
    // se succèdent : chacune ne compte que dans sa fenêtre.
    const lignes = [
      recurrent({
        label: "Outil",
        amount_cents: 2_000,
        frequency: "mensuel",
        active_from: "2026-01-01",
        active_to: "2026-06-30",
      }),
      recurrent({
        label: "Outil",
        amount_cents: 20_000,
        frequency: "annuel",
        active_from: "2026-07-01",
      }),
    ];
    expect(burnMensuel(lignes, "2026-05-15").sortiesCents).toBe(2_000);
    expect(burnMensuel(lignes, "2026-08-15").sortiesCents).toBe(1_667);
  });
});

describe("recurrentsPerimes", () => {
  it("ne retient que ceux terminés depuis plus longtemps que le seuil", () => {
    const vieux = recurrent({ label: "Netflix", active_to: "2026-01-15" });
    const recent = recurrent({ label: "Salle", active_to: "2026-08-01" });
    const encoreActif = recurrent({ label: "Loyer", active_to: null });

    const perimes = recurrentsPerimes([vieux, recent, encoreActif], "2026-08-25", 90);
    expect(perimes.map((r) => r.label)).toEqual(["Netflix"]);
  });

  it("ne retient jamais un flux sans date de fin", () => {
    expect(recurrentsPerimes([recurrent({ active_to: null })], "2099-01-01")).toEqual([]);
  });
});
