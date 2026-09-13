// ─────────────────────────────────────────────────────────────────────────────
// Le droit d'entrée, côté client.
//
// `access.ts` tient en dix lignes, et c'est précisément pour ça qu'il se teste :
// tout le mur d'entrée y passe, et chacune de ses conditions a déjà été, à un
// moment, celle qu'on avait oubliée. Le pendant côté base est dans
// `activation.sql.test.ts`.
// ─────────────────────────────────────────────────────────────────────────────
import { describe, expect, it } from "vitest";

import { abonnementHorsLigne, estActive, hasAccess, palierDe } from "./access";
import { STRIPE_ENABLED } from "./config";
import type { Subscription } from "./supabase";

const sub = (p: Partial<Subscription>): Subscription => ({
  status: "trialing",
  current_period_end: null,
  plan: null,
  ...p,
});

describe("estActive", () => {
  it("dit oui au seul `activated: true`", () => {
    expect(estActive(sub({ activated: true }))).toBe(true);
  });

  // Les trois formes de « la question n'a pas de réponse ». Aucune ne vaut oui :
  // c'est la règle qui avait manqué le 2026-08-12, quand l'échec d'une
  // vérification ouvrait l'app.
  it("dit non quand la réponse est absente, nulle ou fausse", () => {
    expect(estActive(sub({ activated: false }))).toBe(false);
    expect(estActive(sub({ activated: null }))).toBe(false);
    expect(estActive(sub({}))).toBe(false); // migration 003 non jouée
    expect(estActive(null)).toBe(false);
    expect(estActive(undefined)).toBe(false);
  });

  it("ne confond pas l'abonnement avec l'invitation", () => {
    // Un essai en cours, un abonnement payé : deux comptes parfaitement en
    // règle commercialement, et non invités.
    expect(estActive(sub({ status: "trialing", is_active: true }))).toBe(false);
    expect(estActive(sub({ status: "active", is_active: true, tier: "shale_trade" }))).toBe(false);
  });
});

describe("hasAccess", () => {
  it("le mur CHANGE DE NATURE selon le drapeau, il ne s'additionne plus", () => {
    // Écrit en fonction du drapeau, comme le test voisin : il dit ce qui change
    // au lieu d'échouer sans expliquer le jour où l'autre configuration arrive.
    //
    // ⚠️ Ce test portait la règle INVERSE jusqu'au 2026-08-30 (« refuse un
    // compte non activé, quel que soit son abonnement »). L'activation manuelle
    // a cessé d'être un mur sur décision d'Antonin : deux barrières, toutes
    // deux automatiques — l'e-mail confirmé (chez Supabase, avant d'arriver
    // ici) puis le paiement.

    // A payé, jamais invité : entre si et seulement si Stripe est allumé.
    const payeurNonInvite = sub({ status: "active", is_active: true });
    expect(hasAccess(payeurNonInvite)).toBe(STRIPE_ENABLED);

    // Invité, n'a pas payé : le symétrique exact.
    const invitéNonPayeur = sub({ status: "expired", is_active: false, activated: true });
    expect(hasAccess(invitéNonPayeur)).toBe(!STRIPE_ENABLED);

    // Ni l'un ni l'autre : refusé dans les deux configurations.
    expect(hasAccess(sub({ status: "expired", is_active: false }))).toBe(false);
    expect(hasAccess(null)).toBe(false);
  });

  it("ouvre à un compte activé tant que le mur de paiement est éteint", () => {
    // Volontairement écrit en fonction du drapeau : le jour où il passe à
    // `true`, ce test dit ce qui change, au lieu d'échouer sans expliquer.
    const expire = sub({ status: "expired", is_active: false, activated: true });
    expect(hasAccess(expire)).toBe(!STRIPE_ENABLED);
    // Un compte activé ET en règle entre dans les deux configurations.
    expect(hasAccess(sub({ status: "active", is_active: true, activated: true }))).toBe(true);
  });
});

describe("le palier, hors ligne (2026-09-13)", () => {
  it("retient le palier confirmé par le serveur", () => {
    expect(palierDe(sub({ status: "active", tier: "shale_trade", has_trading: true }))).toEqual({
      status: "active",
      tier: "shale_trade",
      hasTrading: true,
    });
    // Base antérieure à `has_trading` : même règle que `entitlementsOf`.
    expect(palierDe(sub({ status: "trialing", tier: "shale" })).hasTrading).toBe(true);
    expect(palierDe(sub({ status: "active", tier: null })).tier).toBe("shale");
  });

  it("sans palier retenu, rien n'est inventé", () => {
    expect(abonnementHorsLigne(undefined)).toBeNull();
  });

  it("refait l'abonnement retenu, sans compte à rebours inventé", () => {
    const s = abonnementHorsLigne({ status: "trialing", tier: "shale", hasTrading: true })!;
    expect(s).toMatchObject({ status: "trialing", tier: "shale", has_trading: true });
    expect(s.trial_days_left).toBeNull();
    expect(s.current_period_end).toBeNull();
  });
});
