// Les briques pures du socle client : réglages et consentement, brouillons,
// aperçu, messages, et le droit « IA » dans les droits du compte.
import { describe, expect, it } from "vitest";

import type { Subscription } from "../auth/supabase";
import { entitlementsOf } from "../entitlements";
import { apercuDe } from "./apercu";
import { messageIa } from "./messages";
import { basculer, choisies, initialiser, modifier, toutes } from "./propositions";
import { iaAutorisee, prefsDepuis, VERSION_CONSENTEMENT } from "./reglages";
import type { CodeIa } from "./runAi";

describe("réglages de l'IA", () => {
  it("éteinte par défaut, et tout ce qui est illisible retombe sur éteint", () => {
    const p = prefsDepuis(null, null, null);
    expect(p.active).toBe(false);
    expect(p.consentiLe).toBeNull();
    expect(iaAutorisee(p, "notes")).toBe(false);
    expect(prefsDepuis("oui", "n'importe quoi", "{pas du json").active).toBe(false);
  });

  it("allumée ne suffit pas : il faut le consentement À LA VERSION EN COURS", () => {
    const consentie = prefsDepuis("1", `${VERSION_CONSENTEMENT}|2026-09-29T20:00:00.000Z`, null);
    expect(iaAutorisee(consentie, "notes")).toBe(true);
    const ancienne = prefsDepuis("1", "v0|2026-01-01T00:00:00.000Z", null);
    expect(iaAutorisee(ancienne, "notes")).toBe(false);
  });

  it("une famille éteinte ferme ses fonctions, pas les autres", () => {
    const p = prefsDepuis("1", `${VERSION_CONSENTEMENT}|2026-09-29T20:00:00.000Z`, JSON.stringify({ notes: false, inconnue: true }));
    expect(iaAutorisee(p, "notes")).toBe(false);
    expect(iaAutorisee(p, "brief")).toBe(true);
  });
});

describe("brouillons à valider", () => {
  const e0 = initialiser(["a", "b", "c"], (x) => x);

  it("tout est proposé coché ; seul le coché, corrigé, part", () => {
    let e = basculer(e0, "b");
    e = modifier(e, "c", "c corrigée");
    expect(choisies(e)).toEqual(["a", "c corrigée"]);
    expect(choisies(toutes(e, false))).toEqual([]);
    expect(choisies(toutes(e, true))).toEqual(["a", "b", "c corrigée"]);
  });

  it("deux propositions de même clé ne s'écrasent pas", () => {
    expect(choisies(initialiser(["x", "x"], (v) => v))).toEqual(["x", "x"]);
  });
});

describe("aperçu de ce qui part", () => {
  it("montre le payload exact, fichier remplacé par sa description", () => {
    const a = apercuDe({ lang: "fr", texte: "Ma note", fichier: { media_type: "application/pdf", data: "A".repeat(4096) } });
    expect(a).toContain('"texte": "Ma note"');
    expect(a).toContain("application/pdf");
    expect(a).not.toContain("AAAA");
  });
});

describe("messages", () => {
  it("chaque code a un texte", () => {
    const codes: CodeIa[] = [
      "unauthorized", "not_pro", "bad_request", "unknown_feature", "bad_payload", "too_large", "quota_exhausted",
      "rate_limited", "ai_paused", "ai_busy", "ai_unavailable", "bad_output", "refused", "network", "disabled",
      "already_done",
    ];
    for (const c of codes) expect(messageIa(c).texte.length, c).toBeGreaterThan(10);
    expect(messageIa("not_pro").geste).toBe("pro");
    expect(messageIa("disabled").geste).toBe("reglages");
  });
});

describe("le droit « IA » dans les droits du compte", () => {
  const sub = (status: string, tier: string): Subscription =>
    ({ status, tier, plan: null, current_period_end: null, trial_days_left: null }) as unknown as Subscription;

  it("Pro payé et essai Pro : oui ; Business, base, Trade, impayé, essai échu : non", () => {
    expect(entitlementsOf(sub("active", "shale_pro")).aIa).toBe(true);
    expect(entitlementsOf(sub("trialing", "shale_pro")).aIa).toBe(true);
    for (const [st, ti] of [
      ["active", "shale_business"],
      ["active", "shale"],
      ["active", "shale_trade"],
      ["past_due", "shale_pro"],
      ["expired", "shale_pro"],
      ["trialing", "shale"],
    ])
      expect(entitlementsOf(sub(st, ti)).aIa, `${st}/${ti}`).toBe(false);
  });
});
