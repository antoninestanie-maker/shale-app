import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * ⭐ L'app iPhone ne vend RIEN — verrou des écrans (décision du 2026-09-26).
 *
 * App Review Guidelines 3.1.3(f) : une app gratuite, compagnon d'un service
 * payé sur le web, échappe à l'achat intégré « à condition qu'il n'y ait ni
 * achat dans l'app, ni appel à acheter hors de l'app ». Un seul bouton
 * « Choisir ma formule » oublié suffit à faire refuser l'app.
 *
 * Ces tests RENDENT les vrais écrans, sur un user-agent d'iPhone puis de Mac,
 * et lisent le HTML produit. `IS_IOS` étant figé à l'import, chaque rendu
 * repart d'un graphe de modules neuf (`vi.resetModules`) — même procédé que
 * `lib/platform.test.ts`.
 */

const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 26_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const UA_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

/**
 * Ce qu'aucun écran iOS ne doit contenir. Volontairement large : un faux
 * positif se corrige en une ligne, un faux négatif se découvre au refus.
 * « abonnement » n'y est PAS : le constat neutre « Aucun abonnement actif
 * n'est associé à ce compte » est explicitement autorisé.
 */
const INTERDITS = [
  /€|\$\s?\d/,
  /tarif/i,
  /formule/i,
  /s'abonner|abonne-toi|souscri/i,
  /subscribe|pricing|upgrade|checkout/i,
  /essai|trial/i,
  /shale\s*(pro|trade|business)/i,
  /shaleapp|https?:\/\//i,
  /<a\s/i,
  /créer (un|mon) compte|inscri/i,
];

function sansIncitation(html: string) {
  for (const motif of INTERDITS) expect(html, `motif interdit ${motif}`).not.toMatch(motif);
}

/** Textes des boutons rendus, dans l'ordre. */
function boutons(html: string): string[] {
  return [...html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim(),
  );
}

async function charger(userAgent: string) {
  vi.resetModules();
  vi.stubGlobal("navigator", {
    userAgent,
    platform: userAgent.includes("Macintosh") ? "MacIntel" : "iPhone",
    maxTouchPoints: userAgent.includes("iPhone") ? 5 : 0,
    languages: ["fr-FR"],
    language: "fr-FR",
  });
  const [{ default: SubscriptionRequired }, { default: LoginScreen }, { default: UpgradeModal }] =
    await Promise.all([
      import("./SubscriptionRequired"),
      import("./LoginScreen"),
      import("../UpgradeModal"),
    ]);
  return { SubscriptionRequired, LoginScreen, UpgradeModal };
}

const rien = async () => {};

function rendreMur(
  C: Awaited<ReturnType<typeof charger>>["SubscriptionRequired"],
  status: "none" | "expired" | "canceled",
) {
  return renderToStaticMarkup(
    createElement(C, {
      email: "demo@exemple.com",
      subscription: { status, current_period_end: null, plan: null, tier: "shale_trade" },
      error: null,
      onRecheck: rien,
      onSignOut: rien,
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("iOS — compte sans abonnement actif", () => {
  it.each(["none", "expired", "canceled"] as const)(
    "statut « %s » : un constat neutre, et la déconnexion pour seul bouton",
    async (status) => {
      const { SubscriptionRequired } = await charger(UA_IPHONE);
      const html = rendreMur(SubscriptionRequired, status);
      expect(html).toContain("Aucun abonnement actif n&#x27;est associé à ce compte.");
      sansIncitation(html);
      // Ni « Gérer mon abonnement », ni « J'ai souscrit — revérifier » : ce
      // dernier sous-entend qu'il faut aller souscrire ailleurs.
      expect(boutons(html)).toEqual(["Se déconnecter"]);
    },
  );

  it("un échec de lecture garde son motif (il n'a rien de commercial)", async () => {
    const { SubscriptionRequired } = await charger(UA_IPHONE);
    const html = renderToStaticMarkup(
      createElement(SubscriptionRequired, {
        email: "demo@exemple.com",
        subscription: null,
        error: "Vérification du compte impossible.",
        onRecheck: rien,
        onSignOut: rien,
      }),
    );
    expect(html).toContain("Vérification du compte impossible.");
    expect(boutons(html)).toEqual(["Se déconnecter"]);
  });
});

describe("iOS — écran de connexion", () => {
  it("connexion et « mot de passe oublié », sans inscription ni lien vers le site", async () => {
    const { LoginScreen } = await charger(UA_IPHONE);
    const html = renderToStaticMarkup(
      createElement(LoginScreen, {
        onSignIn: rien,
        onSignUp: async () => ({ needsConfirmation: false }),
      }),
    );
    expect(html).toContain("Se connecter");
    expect(html).toContain("Mot de passe oublié");
    expect(html).toContain("Rester connecté");
    sansIncitation(html);
    expect(boutons(html).join(" | ")).not.toMatch(/Créer un compte/);
  });
});

describe("iOS — paywall", () => {
  it("ne rend RIEN, même si une porte oubliée essayait de l'ouvrir", async () => {
    const { UpgradeModal } = await charger(UA_IPHONE);
    // Sur iOS le composant sort AVANT `createPortal` : aucun `document` n'est
    // donc nécessaire. S'il cherchait à se monter, ce rendu échouerait.
    const html = renderToStaticMarkup(
      createElement(UpgradeModal, { moduleLabel: "Trading", onClose: () => {} }),
    );
    expect(html).toBe("");
  });
});

describe("macOS — rien ne change (non-régression)", () => {
  it("le mur d'abonnement garde son bouton d'achat et sa revérification", async () => {
    const { SubscriptionRequired } = await charger(UA_MAC);
    const expire = boutons(rendreMur(SubscriptionRequired, "expired"));
    expect(expire.some((b) => b.includes("Choisir ma formule"))).toBe(true);
    expect(expire).toContain("J'ai souscrit — revérifier");
    const sansOffre = boutons(rendreMur(SubscriptionRequired, "none"));
    expect(sansOffre.some((b) => b.includes("Gérer mon abonnement"))).toBe(true);
  });

  it("l'écran de connexion garde l'inscription", async () => {
    const { LoginScreen } = await charger(UA_MAC);
    const html = renderToStaticMarkup(
      createElement(LoginScreen, {
        onSignIn: rien,
        onSignUp: async () => ({ needsConfirmation: false }),
      }),
    );
    expect(boutons(html)).toContain("Créer un compte");
  });
});
