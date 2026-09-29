import { afterEach, describe, expect, it, vi } from "vitest";

import type { Subscription } from "./auth/supabase";
import { commerceAutorisePour, joursEssaiAffiches, presenceModule } from "./boutique";

/**
 * L'app iPhone « connexion seule » (décision du 2026-09-26, règle App Store
 * 3.1.3(f)) — la règle pure. Les écrans eux-mêmes sont vérifiés dans
 * `components/auth/ios-sans-achat.test.ts`.
 */

const essai = (jours: number): Subscription => ({
  status: "trialing",
  current_period_end: null,
  plan: null,
  trial_days_left: jours,
});

describe("commerceAutorisePour", () => {
  it("vend sur macOS, se tait sur iOS", () => {
    expect(commerceAutorisePour(false)).toBe(true);
    expect(commerceAutorisePour(true)).toBe(false);
  });
});

describe("presenceModule", () => {
  it("un module productivité est toujours ouvert, sur les deux plateformes", () => {
    for (const commerce of [true, false]) {
      expect(presenceModule("tasks", false, commerce)).toBe("ouvert");
      expect(presenceModule("finance", false, commerce)).toBe("ouvert");
    }
  });

  it("un module trading est ouvert pour qui y a droit, sur les deux plateformes", () => {
    for (const commerce of [true, false]) {
      expect(presenceModule("trading", true, commerce)).toBe("ouvert");
    }
  });

  it("⭐ hors palier : cadenas sur macOS, ABSENT sur iOS — jamais verrouillé", () => {
    for (const id of ["trading", "market", "sizing"]) {
      expect(presenceModule(id, false, true)).toBe("verrouille");
      expect(presenceModule(id, false, false)).toBe("absent");
    }
  });
});

describe("joursEssaiAffiches", () => {
  it("macOS, Stripe allumé, essai en cours : le bandeau annonce les jours", () => {
    expect(joursEssaiAffiches(essai(3), true, true)).toBe(3);
  });

  it("⭐ iOS : jamais de bandeau d'essai, même Stripe allumé", () => {
    expect(joursEssaiAffiches(essai(3), true, false)).toBeNull();
    expect(joursEssaiAffiches(essai(0), true, false)).toBeNull();
  });

  it("Stripe éteint ou pas d'essai : rien, partout", () => {
    expect(joursEssaiAffiches(essai(3), false, true)).toBeNull();
    expect(joursEssaiAffiches({ ...essai(3), status: "active" }, true, true)).toBeNull();
    expect(joursEssaiAffiches(null, true, true)).toBeNull();
  });
});

describe("COMMERCE_AUTORISE suit la plateforme détectée", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  async function charger(userAgent: string, maxTouchPoints = 0, platform = "") {
    vi.resetModules();
    vi.stubGlobal("navigator", {
      userAgent,
      platform,
      maxTouchPoints,
      languages: ["fr-FR"],
      language: "fr-FR",
    });
    return (await import("./boutique")).COMMERCE_AUTORISE;
  }

  it("iPhone et iPad (y compris iPad « bureau ») : fermé", async () => {
    expect(
      await charger("Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15"),
    ).toBe(false);
    expect(await charger("Mozilla/5.0 (iPad; CPU OS 26_5 like Mac OS X)")).toBe(false);
    // iPadOS 13+ se présente comme un Mac : c'est l'écran tactile qui le trahit.
    expect(await charger("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5, "MacIntel")).toBe(
      false,
    );
  });

  it("macOS et Windows : ouvert (aucune régression bureau)", async () => {
    expect(await charger("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0, "MacIntel")).toBe(
      true,
    );
    expect(await charger("Mozilla/5.0 (Windows NT 10.0; Win64; x64)", 0, "Win32")).toBe(true);
  });
});

describe("filet : toute porte vers l'espace compte passe par la boutique", () => {
  /**
   * Un lien vers `mon-compte` ou `inscription` est un chemin d'achat. Un
   * fichier qui en ouvre un DOIT consulter `lib/boutique.ts`, sinon un bouton
   * ajouté demain sur macOS apparaîtrait aussi sur iPhone. `reset` (mot de
   * passe oublié) reste libre : c'est explicitement autorisé.
   */
  const sources = import.meta.glob<string>(["/src/**/*.tsx", "/src/**/*.ts", "!/src/**/*.test.ts"], {
    query: "?raw",
    import: "default",
    eager: true,
  });

  it("chaque fichier qui vise ACCOUNT_PAGES.home / .signup importe la boutique", () => {
    const fautifs = Object.entries(sources)
      .filter(([, code]) => /ACCOUNT_PAGES\.(home|signup)|ACCOUNT_URL\b/.test(code))
      .filter(([chemin]) => !chemin.endsWith("/lib/auth/config.ts"))
      .filter(([, code]) => !/from\s+["'][./]*(lib\/)?boutique["']/.test(code))
      .map(([chemin]) => chemin);
    expect(fautifs).toEqual([]);
  });

  it("le filet voit bien les fichiers concernés (il n'est pas vide)", () => {
    const vises = Object.entries(sources).filter(([, code]) => /ACCOUNT_PAGES\.home/.test(code));
    expect(vises.length).toBeGreaterThanOrEqual(3);
  });
});
