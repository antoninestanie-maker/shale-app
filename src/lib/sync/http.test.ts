import { afterEach, describe, expect, it, vi } from "vitest";

import {
  delaiDepuisRetryAfter,
  delaiImpose,
  requete,
  RequeteRefusee,
  ReseauInjoignable,
  ServeurOccupe,
  SessionExpiree,
  vautLaPeineDeReessayer,
} from "./http";

/**
 * Ce que le serveur simulé du moteur ne peut PAS éprouver : les façons dont le
 * vrai réseau échoue. Ces tests ne prouvent pas que Supabase répond comme ça —
 * ils prouvent que si Supabase répond comme ça, l'app en tire la bonne
 * conclusion. C'est la moitié vérifiable ici ; l'autre est dans
 * `tools/verifier-sync-supabase.mjs`, qui interroge un vrai projet.
 */

const vraiFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = vraiFetch;
  vi.restoreAllMocks();
});

/** Remplace `fetch` par une réponse figée. */
function repond(status: number, corps = "", entetes: Record<string, string> = {}) {
  globalThis.fetch = vi.fn(async () => new Response(corps, { status, headers: entetes })) as never;
}

describe("nommage des échecs HTTP", () => {
  it("401 = session expirée, pas un refus définitif", async () => {
    repond(401, '{"message":"JWT expired"}');
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(SessionExpiree);
    // Réessayable : le transport renouvelle le jeton et repasse.
    expect(vautLaPeineDeReessayer(e)).toBe(true);
  });

  it("429 = serveur occupé, avec le délai qu'il réclame", async () => {
    repond(429, "", { "Retry-After": "12" });
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServeurOccupe);
    expect(delaiImpose(e)).toBe(12_000);
  });

  it("503 est traité comme une saturation, pas comme un refus", async () => {
    repond(503);
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServeurOccupe);
    expect(vautLaPeineDeReessayer(e)).toBe(true);
  });

  it("500 reste réessayable : un serveur qui tousse n'est pas un schéma absent", async () => {
    repond(500, "boom");
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ServeurOccupe);
  });

  it("404 = requête refusée, et NON réessayable", async () => {
    // Le cas réel : `sync.sql` jamais joué sur le projet. PostgREST répond 404
    // sur une table qui n'existe pas. Le confondre avec une coupure réseau
    // afficherait « hors ligne » pendant des jours sur un backend inexistant.
    repond(404, '{"message":"relation \\"public.sync_rows\\" does not exist"}');
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RequeteRefusee);
    expect(vautLaPeineDeReessayer(e)).toBe(false);
  });

  it("403 (politique RLS) est un refus, pas une expiration", async () => {
    repond(403, '{"code":"42501"}');
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(RequeteRefusee);
    expect(vautLaPeineDeReessayer(e)).toBe(false);
  });

  it("une coupure réseau ne remonte pas l'exception brute de fetch", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as never;
    const e = await requete("https://exemple.test/x").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ReseauInjoignable);
    expect((e as ReseauInjoignable).origine).toBeInstanceOf(TypeError);
  });

  it("une requête qui n'aboutit jamais est coupée par le timeout", async () => {
    // ⚠️ Sans cette coupure, le verrou du planificateur reste tenu et TOUTE
    // synchronisation ultérieure est absorbée par ce cycle fantôme : l'app
    // cesse de synchroniser sans jamais signaler d'erreur.
    globalThis.fetch = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    ) as never;

    const e = await requete("https://exemple.test/x", { timeoutMs: 20 }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ReseauInjoignable);
  });

  it("une réponse correcte passe telle quelle", async () => {
    repond(200, '{"ok":true}');
    const res = await requete("https://exemple.test/x");
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("Retry-After", () => {
  // Les DEUX formes de l'en-tête existent. Ne gérer que la première laisse la
  // seconde produire NaN, qui devient `setTimeout(NaN)` — un rappel IMMÉDIAT,
  // soit exactement l'inverse de ce que le serveur demandait.
  const T0 = Date.parse("2026-08-05T12:00:00Z");

  it("lit un nombre de secondes", () => {
    expect(delaiDepuisRetryAfter("30", T0)).toBe(30_000);
  });

  it("lit une date HTTP", () => {
    expect(delaiDepuisRetryAfter("Wed, 05 Aug 2026 12:00:45 GMT", T0)).toBe(45_000);
  });

  it("ignore une date déjà passée", () => {
    expect(delaiDepuisRetryAfter("Wed, 05 Aug 2026 11:59:00 GMT", T0)).toBeNull();
  });

  it("ignore un en-tête absent ou incompréhensible", () => {
    expect(delaiDepuisRetryAfter(null, T0)).toBeNull();
    expect(delaiDepuisRetryAfter("bientôt", T0)).toBeNull();
  });

  it("plafonne : un serveur ne fait pas taire l'app pour une heure", () => {
    expect(delaiDepuisRetryAfter("3600", T0)).toBe(300_000);
  });
});
