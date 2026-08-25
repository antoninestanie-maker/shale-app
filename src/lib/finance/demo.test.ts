import { describe, expect, it } from "vitest";

import { demo } from "../demo";
import { todayStr } from "../logic";
import { burnMensuel, recurrentsPerimes } from "./burn";
import { patrimoineAu } from "./patrimoine";
import { moisAffiches, runway } from "./runway";
import { valoriser } from "./valorisation";

/**
 * Le jeu de démonstration doit être COHÉRENT, pas décoratif : les soldes, les
 * flux et le runway se déduisent les uns des autres. Sans ce test, la démo
 * pourrit en silence — on ne la regarde qu'en preview navigateur, et un runway
 * absurde y passerait inaperçu pendant des mois.
 *
 * Les assertions portent sur des FOURCHETTES : le jeu est construit à partir de
 * la date du jour, et un test calé sur des valeurs exactes casserait au premier
 * changement de mois.
 */

describe("le jeu de démonstration Finance", () => {
  it("montre un cas crédible d'indépendant qui brûle sa trésorerie", async () => {
    const f = await demo.fetchFinance();
    const aujourdhui = todayStr();

    const p = patrimoineAu(f.comptes, f.balances, aujourdhui);
    const burn = burnMensuel(f.recurrents, aujourdhui);
    const r = runway(p.liquideCents, burn, aujourdhui);

    expect(p.sansReleve).toBe(0);
    expect(burn.actifs).toBeGreaterThan(5);
    expect(burn.netCents).toBeGreaterThan(0); // on brûle : c'est l'intérêt de la démo
    expect(r.etat).toBe("ok");
    expect(moisAffiches(r.mois!)).toBeGreaterThan(5);
    expect(moisAffiches(r.mois!)).toBeLessThan(11);
  });

  it("distingue le liquide du total — un PEA ne paye pas le loyer", () => {
    return demo.fetchFinance().then((f) => {
      const p = patrimoineAu(f.comptes, f.balances, todayStr());
      expect(p.liquideCents).toBeLessThan(p.totalCents);
      expect(p.totalCents - p.liquideCents).toBeGreaterThan(1_000_000);
    });
  });

  it("comprend un compte au solde négatif, qui se soustrait", async () => {
    const f = await demo.fetchFinance();
    const p = patrimoineAu(f.comptes, f.balances, todayStr());
    const carte = p.lignes.find((l) => l.compte.kind === "credit");
    expect(carte?.montantCents).toBeLessThan(0);
  });

  it("range la mission terminée parmi les flux périmés", async () => {
    const f = await demo.fetchFinance();
    const perimes = recurrentsPerimes(f.recurrents, todayStr());
    expect(perimes.map((r) => r.label)).toContain("Mission longue (terminée)");
    // Et elle ne pèse plus sur le burn.
    expect(burnMensuel(f.recurrents, todayStr()).entreesCents).toBe(80_000);
  });

  it("valorise ses deux positions, euro et dollar", async () => {
    const f = await demo.fetchFinance();
    const v = valoriser(f.holdings, f.quotes, f.fx, "EUR", new Date().toISOString());
    expect(v.incomplets).toBe(0);
    expect(v.lignes).toHaveLength(2);
    expect(v.totalCents).toBeGreaterThan(1_500_000);
  });
});
