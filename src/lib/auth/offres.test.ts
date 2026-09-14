// Offres Shale Pro et Shale Business (migration 006 du site, 2026-09-14).
// L'app doit les reconnaître sans leur ouvrir le trading, et ne jamais prendre
// une valeur inconnue pour une offre plus large.
import { describe, expect, it } from "vitest";
import { normaliserTier } from "./supabase";
import { palierDe } from "./access";
import { tierLabel } from "../entitlements";

describe("offres Pro et Business", () => {
  it("reconnaît les quatre offres", () => {
    for (const t of ["shale", "shale_trade", "shale_pro", "shale_business"]) expect(normaliserTier(t)).toBe(t);
  });

  it("retombe sur `shale` pour une valeur inconnue ou absente", () => {
    for (const t of ["shale_gold", "", null, undefined, 42]) expect(normaliserTier(t)).toBe("shale");
  });

  it("mémorise le palier Business sans lui ouvrir le trading", () => {
    const p = palierDe({ status: "active", tier: "shale_business", has_trading: false } as never);
    expect(p).toEqual({ status: "active", tier: "shale_business", hasTrading: false });
  });

  it("donne un libellé à chaque offre", () => {
    expect(tierLabel("shale_pro")).toBe("Shale Pro");
    expect(tierLabel("shale_business")).toBe("Shale Business");
    expect(tierLabel("shale_trade")).toBe("Shale Trade");
    expect(tierLabel("shale")).toBe("Shale");
  });
});
