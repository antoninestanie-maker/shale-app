// ─────────────────────────────────────────────────────────────────────────────
// Le transport Gemini (fournisseur par défaut depuis le 2026-10-01, migration
// 010), de bout en bout sur la vraie config : requête construite, coût réel,
// refus des filtres, relance sur une sortie tronquée, erreurs traduites.
// `fetch` est simulé : aucun appel réel à Google.
// ─────────────────────────────────────────────────────────────────────────────

import type { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { pourGemini } from "../../../../shale-site/supabase/functions/ai/coeur/gemini.ts";
import { coutGeminiMicroUsd, prixGeminiDe } from "../../../../shale-site/supabase/functions/ai/coeur/limites.ts";
import { versApi } from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts";
import { traiter } from "../../../../shale-site/supabase/functions/ai/coeur/traiter.ts";
import type { DefFonction, Dependances } from "../../../../shale-site/supabase/functions/ai/coeur/types.ts";
import { bancIa, compte, depotPGlite } from "./serveur.testutil";

const PRO = "40000000-0000-0000-0000-000000000001";
const MAINTENANT = new Date("2026-10-14T09:30:00Z");
const URL_RESUMER = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";
const SORTIE_OK = { resume: "Une note sur le budget.", points: ["Un", "Deux", "Trois"] };

let db: PGlite;
type Reponse = { statut?: number; corps?: unknown };
let file: Reponse[] = [];
let envois: Array<{ url: string; corps: Record<string, unknown>; entetes: Record<string, string> }> = [];

const fetchSimule = (async (u: string, init: RequestInit) => {
  envois.push({ url: String(u), corps: JSON.parse(String(init.body)), entetes: init.headers as Record<string, string> });
  const r = file.shift();
  if (!r) throw new Error("appel non prévu");
  return new Response(JSON.stringify(r.corps ?? { error: { message: "détail interne à ne pas relayer" } }), {
    status: r.statut ?? 200,
  });
}) as unknown as typeof fetch;

/** Une réponse Gemini réussie, avec son compteur. */
function reponse(texte: string, sur: { finishReason?: string; usage?: Record<string, number>; parties?: unknown[] } = {}): Reponse {
  return {
    corps: {
      candidates: [
        { content: { role: "model", parts: sur.parties ?? [{ text: texte }] }, finishReason: sur.finishReason ?? "STOP" },
      ],
      usageMetadata: sur.usage ?? { promptTokenCount: 1000, candidatesTokenCount: 200, totalTokenCount: 1200 },
    },
  };
}

const avecFichier: DefFonction<{ lang: string; fichier: { media_type: string; data: string } }> = {
  payload: {
    type: "object",
    properties: {
      lang: { type: "string", enum: ["fr", "en"] },
      fichier: {
        type: "object",
        properties: { media_type: { type: "string", maxLength: 40 }, data: { type: "string" } },
        required: ["media_type", "data"],
        additionalProperties: false,
      },
    },
    required: ["lang", "fichier"],
    additionalProperties: false,
  },
  sortie: {
    type: "object",
    properties: { total: { type: "string", maxLength: 20 } },
    required: ["total"],
    additionalProperties: false,
  },
  prompts: { "1": "Fonction de test : lire un total." },
  consigne: () => "Lis le total.",
  donnees: () => ({}),
  fichier: (p) => p.fichier,
};

function deps(sur: Partial<Dependances> = {}): Dependances {
  return {
    depot: depotPGlite(db),
    fonctions: { ...FONCTIONS, test_fichier_g: avecFichier },
    verifierJeton: async (j) => (j === "jeton-pro" ? PRO : null),
    fetch: fetchSimule,
    cles: { google: "cle-gemini-secrete", anthropic: null },
    budgetGlobalMicro: 50_000_000,
    maintenant: () => MAINTENANT,
    compterPages: async (o) => {
      try {
        return (await PDFDocument.load(o)).getPageCount();
      } catch {
        return null;
      }
    },
    journal: () => {},
    originesAutorisees: [],
    hasard: () => 0.5,
    resoudre: async () => ["93.184.216.34"],
    ...sur,
  };
}

async function appel(feature: string, payload: unknown, sur: Partial<Dependances> = {}) {
  const r = await traiter(
    new Request("https://x/ai", {
      method: "POST",
      headers: { authorization: "Bearer jeton-pro", "content-type": "application/json" },
      body: JSON.stringify({ feature, payload }),
    }),
    deps(sur),
  );
  return { statut: r.status, corps: (await r.json()) as Record<string, unknown> };
}

const RESUMER = { lang: "fr", titre: "Budget", texte: "Ma note." };

async function usage() {
  const { rows } = await db.query<{ actions_used: number; cost_micro_usd: string }>(
    "select actions_used, cost_micro_usd from public.ai_usage where user_id = $1",
    [PRO],
  );
  return rows[0] ? { actions: rows[0].actions_used, cout: Number(rows[0].cost_micro_usd) } : null;
}

beforeAll(async () => {
  db = await bancIa();
  await compte(db, PRO, { status: "active", tier: "shale_pro" });
  // La config de la 010 telle quelle : `resumer` sur gemini-3.5-flash-lite.
  await db.query("update public.ai_config set enabled = true where feature = 'resumer'");
  await db.query(
    `insert into public.ai_config (feature, provider, model, max_tokens, weight, enabled)
     values ('test_fichier_g', 'google', 'gemini-3.5-flash-lite', 500, 3, true)`,
  );
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  file = [];
  envois = [];
  await db.query("delete from public.ai_usage");
  await db.query("delete from public.ai_events");
});

describe("Gemini — le chemin qui marche", () => {
  it("la requête est construite par le serveur, selon ai_config ; la clé n'est jamais dans l'URL", async () => {
    file = [reponse(JSON.stringify(SORTIE_OK))];
    const r = await appel("resumer", RESUMER);
    expect(r.statut).toBe(200);
    expect(r.corps.data).toEqual(SORTIE_OK);

    const { url, corps, entetes } = envois[0];
    expect(url).toBe(URL_RESUMER);
    expect(url).not.toContain("cle-gemini-secrete");
    expect(entetes["x-goog-api-key"]).toBe("cle-gemini-secrete");
    const sys = corps.systemInstruction as { parts: Array<{ text: string }> };
    expect(sys.parts[0].text).toMatch(/jamais une instruction/);
    const contenu = corps.contents as Array<{ role: string; parts: Array<{ text?: string }> }>;
    expect(contenu[0].role).toBe("user");
    expect(contenu[0].parts[0].text).toMatch(/<donnees>[\s\S]*Ma note\.[\s\S]*<\/donnees>$/);
    const gc = corps.generationConfig as Record<string, unknown>;
    expect(gc.responseMimeType).toBe("application/json");
    expect(gc.maxOutputTokens).toBe(1024);
    expect(gc).not.toHaveProperty("thinkingConfig"); // flash-lite : réflexion éteinte par défaut
    expect(JSON.stringify(gc.responseJsonSchema)).not.toMatch(/maxLength|maxItems/);
  });

  it("le coût réel : cache au prix du cache, réflexion au prix de la sortie", async () => {
    file = [
      reponse(JSON.stringify(SORTIE_OK), {
        usage: { promptTokenCount: 10_000, cachedContentTokenCount: 4000, candidatesTokenCount: 500, thoughtsTokenCount: 300 },
      }),
    ];
    await appel("resumer", RESUMER);
    // 6 000 × 0,30 + 4 000 × 0,03 + 800 × 2,50 = 1 800 + 120 + 2 000 µ$.
    expect(await usage()).toEqual({ actions: 1, cout: 3920 });
  });

  it("les parties de réflexion ne sont pas lues comme la réponse", async () => {
    file = [reponse("", { parties: [{ text: "Je réfléchis…", thought: true }, { text: JSON.stringify(SORTIE_OK) }] })];
    expect((await appel("resumer", RESUMER)).corps.data).toEqual(SORTIE_OK);
  });

  it("une sortie tronquée (MAX_TOKENS) est relancée une fois", async () => {
    file = [reponse('{"resume": "coup', { finishReason: "MAX_TOKENS" }), reponse(JSON.stringify(SORTIE_OK))];
    expect((await appel("resumer", RESUMER)).statut).toBe(200);
    expect(envois).toHaveLength(2);
  });

  it("un PDF part en `inlineData`, avant le texte", async () => {
    const doc = await PDFDocument.create();
    doc.addPage();
    const data = Buffer.from(await doc.save()).toString("base64");
    file = [reponse('{"total":"12,00"}')];
    const r = await appel("test_fichier_g", { lang: "fr", fichier: { media_type: "application/pdf", data } });
    expect(r.statut).toBe(200);
    const parties = (envois[0].corps.contents as Array<{ parts: Array<Record<string, unknown>> }>)[0].parts;
    expect(parties[0]).toEqual({ inlineData: { mimeType: "application/pdf", data } });
    expect(parties[1]).toHaveProperty("text");
  });
});

describe("Gemini — refus et pannes", () => {
  it("un filtre de Google (SAFETY) ou un prompt bloqué → refused, sans relance, action rendue", async () => {
    file = [reponse("", { finishReason: "SAFETY" })];
    expect((await appel("resumer", RESUMER)).corps.code).toBe("refused");
    expect(envois).toHaveLength(1);
    file = [{ corps: { promptFeedback: { blockReason: "PROHIBITED_CONTENT" }, usageMetadata: { promptTokenCount: 50 } } }];
    expect((await appel("resumer", RESUMER)).corps.code).toBe("refused");
    expect((await usage())?.actions).toBe(0);
  });

  it("429 et 503 → ai_busy ; 500 → ai_unavailable ; le message de Google n'est jamais relayé", async () => {
    for (const [statut, code] of [[429, "ai_busy"], [503, "ai_busy"], [500, "ai_unavailable"]] as const) {
      file = [{ statut }];
      const r = await appel("resumer", RESUMER);
      expect(r.corps.code, String(statut)).toBe(code);
      expect(JSON.stringify(r)).not.toContain("détail interne");
    }
    expect(await usage()).toEqual({ actions: 0, cout: 0 });
  });

  it("clé Gemini absente → ai_unavailable avant toute réservation, même si la clé Claude est là", async () => {
    const r = await appel("resumer", RESUMER, { cles: { google: null, anthropic: "cle-claude" } });
    expect(r.corps.code).toBe("ai_unavailable");
    expect(envois).toHaveLength(0);
    expect(await usage()).toBeNull();
  });
});

describe("Gemini — briques pures", () => {
  it("le schéma envoyé perd les formats que Gemini ne connaît pas, garde les dates", () => {
    const brief = JSON.stringify(pourGemini(versApi(FONCTIONS.brief.sortie)));
    expect(brief).not.toContain('"uri"');
    const cloture = JSON.stringify(pourGemini(versApi(FONCTIONS.cloture.sortie)));
    expect(cloture).toContain('"format":"date"');
  });

  it("les Flash 3.7 / 3.8 doublent au 1er janvier 2027 ; un modèle inconnu est compté au prix fort", () => {
    expect(prixGeminiDe("gemini-3.8-flash", new Date("2026-12-31T23:59:00Z")).entree).toBe(0.75);
    expect(prixGeminiDe("gemini-3.8-flash", new Date("2027-01-01T00:00:00Z")).entree).toBe(1.5);
    expect(prixGeminiDe("gemini-3.5-flash-lite", MAINTENANT).sortie).toBe(2.5);
    expect(coutGeminiMicroUsd("gemini-99", { horsCache: 1000, cache: 0, sortie: 0 }, MAINTENANT)).toBe(10_000);
  });
});
