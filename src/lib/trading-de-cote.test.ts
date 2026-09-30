import { describe, expect, it } from "vitest";

import type { Subscription } from "./auth/supabase";
import { presenceModule } from "./boutique";
import { demo } from "./demo";
import { entitlementsOf } from "./entitlements";
import { TRADING_ACTIF } from "./features";
import { computeMentalLoad, MENTAL_LOAD_DEFAULTS } from "./mentalLoad";
import { typePropose, TYPE_LIVRE_TRADING } from "./objets";
import { todayStr } from "./logic";
import type { AppData, Trade } from "./types";

/**
 * Le trading MIS DE CÔTÉ (décision d'Antonin, 2026-09-30) — `TRADING_ACTIF` dans
 * `lib/features.ts`. Chaque règle se teste dans les DEUX positions : le jour où
 * l'interrupteur repasse à `true`, l'app doit redevenir celle d'avant, à
 * l'identique.
 */

const abonnement = (s: Partial<Subscription>): Subscription => ({
  status: "active",
  current_period_end: null,
  plan: null,
  ...s,
});

describe("l'interrupteur lui-même", () => {
  it("est éteint : l'app commercialisée ne porte pas le trading", () => {
    expect(TRADING_ACTIF).toBe(false);
  });
});

describe("presenceModule — trading éteint", () => {
  it("⭐ les trois modules sont ABSENTS partout : ni cadenas, ni paywall, même avec le droit", () => {
    for (const id of ["trading", "market", "sizing"])
      for (const commerce of [true, false])
        for (const droit of [true, false])
          expect(presenceModule(id, droit, commerce, false)).toBe("absent");
  });

  it("la productivité n'est pas touchée", () => {
    for (const id of ["today", "tasks", "calendar", "performance", "notes"])
      expect(presenceModule(id, false, true, false)).toBe("ouvert");
  });

  it("rallumé, la règle d'avant revient à l'identique", () => {
    expect(presenceModule("market", true, true, true)).toBe("ouvert");
    expect(presenceModule("market", false, true, true)).toBe("verrouille");
    expect(presenceModule("market", false, false, true)).toBe("absent");
  });
});

describe("entitlementsOf — trading éteint", () => {
  it("⭐ `hasTrading` est faux même quand le serveur dit vrai (essai, ancien palier Trade)", () => {
    const essai = abonnement({ status: "trialing", tier: "shale", has_trading: true });
    const trade = abonnement({ tier: "shale_trade", has_trading: true });
    expect(entitlementsOf(essai, false).hasTrading).toBe(false);
    expect(entitlementsOf(trade, false).hasTrading).toBe(false);
    // Base d'avant la colonne `has_trading` : le repli local est coupé aussi.
    expect(entitlementsOf(abonnement({ tier: "shale_trade" }), false).hasTrading).toBe(false);
  });

  it("le reste des droits ne bouge pas : l'offre et l'essai restent ce qu'ils sont", () => {
    const e = entitlementsOf(abonnement({ status: "trialing", tier: "shale_pro", trial_days_left: 4 }), false);
    expect(e.tier).toBe("shale_pro");
    expect(e.isTrialing).toBe(true);
    expect(e.trialDaysLeft).toBe(4);
  });

  it("rallumé, le serveur refait foi", () => {
    expect(entitlementsOf(abonnement({ tier: "shale_trade", has_trading: true }), true).hasTrading).toBe(true);
    expect(entitlementsOf(abonnement({ tier: "shale", has_trading: false }), true).hasTrading).toBe(false);
  });
});

describe("typePropose — le type livré « Setup de trading » (migration 020)", () => {
  const livre = { id: 4, name: TYPE_LIVRE_TRADING, builtin: 1 };

  it("masqué tant que personne ne s'en sert", () => {
    expect(typePropose(livre, [{ type_id: null }, { type_id: 2 }], false)).toBe(false);
  });

  it("⭐ gardé s'il porte déjà un sujet : ses champs ne disparaissent pas de la fiche", () => {
    expect(typePropose(livre, [{ type_id: 4 }], false)).toBe(true);
  });

  it("un type créé à la main sous le même nom reste visible, les autres types aussi", () => {
    expect(typePropose({ ...livre, builtin: 0 }, [], false)).toBe(true);
    expect(typePropose({ id: 1, name: "Personne", builtin: 1 }, [], false)).toBe(true);
  });

  it("rallumé, il se propose à nouveau", () => {
    expect(typePropose(livre, [], true)).toBe(true);
  });
});

describe("la jauge d'énergie ne compte plus les trades", () => {
  const trade = { mode: "live", date: todayStr() } as Trade;
  const data = { trades: [trade, trade] } as unknown as AppData;

  it("sans le module Trading, deux trades du jour ne coûtent rien", () => {
    const l = computeMentalLoad(data, 0, MENTAL_LOAD_DEFAULTS, false);
    expect(l.trades).toBe(0);
    expect(l.drainTrades).toBe(0);
    expect(l.energy).toBe(100);
  });

  it("avec, ils pèsent comme avant", () => {
    expect(computeMentalLoad(data, 0, MENTAL_LOAD_DEFAULTS, true).trades).toBe(2);
  });
});

describe("filet : le jeu de démonstration ne parle plus de trading", () => {
  /**
   * Il n'alimente pas que la démo navigateur : `shale-site/vitrine/tools/
   * shoot-v2.mjs` en tire les 26 captures du site. Un mot de trading ici finit
   * sur la page d'accueil de shaleapp.com — c'est arrivé : jusqu'au 2026-09-30,
   * elle montrait « Passer trader full-time » et « Setup cassure H4 ».
   *
   * Les tables propres au trading (trades, positions, Market Brain) ne sont
   * pas regardées : elles ne s'affichent que dans les modules mis de côté.
   */
  const INTERDIT = /trad(e|ing|er)|backtest|prop firm|setup|H4|forex|market.?brain|scalp|pips?\b/i;

  it("tâches, objectifs, tags, notes, habitudes, liens rapides, métriques, journal", async () => {
    const d = await demo.fetchAll();
    const textes = [
      ...d.tasks.map((x) => x.label),
      ...d.tags.map((x) => x.name),
      ...d.goals.flatMap((x) => [x.title, x.description ?? "", x.category ?? ""]),
      ...d.notes.flatMap((x) => [x.title, x.body ?? ""]),
      ...d.habits.map((x) => x.name),
      ...d.quickLinks.flatMap((x) => [x.label, x.url]),
      ...d.metrics.flatMap((x) => [x.name, x.unit ?? ""]),
      ...d.journal.map((x) => x.body ?? ""),
    ];
    expect(textes.filter((x) => INTERDIT.test(x))).toEqual([]);
  });

  it("Savoir, types d'objets, agenda, comptes Finance", async () => {
    const k = await demo.fetchKnowledge();
    const types = await demo.fetchObjectTypes();
    const agenda = await demo.fetchCalendarEvents("2000-01-01", "2100-01-01");
    const f = await demo.fetchFinance();
    const textes = [
      ...k.topics.flatMap((x) => [x.name, x.field_values ?? ""]),
      ...k.entries.flatMap((x) => [x.title, x.text ?? ""]),
      ...types.flatMap((x) => [x.name, x.fields]),
      ...agenda.map((x) => x.title),
      ...f.comptes.flatMap((x) => [x.label, x.kind, x.institution ?? ""]),
    ];
    expect(textes.filter((x) => INTERDIT.test(x))).toEqual([]);
  });
});
