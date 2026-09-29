import { describe, expect, it, vi } from "vitest";

import { runAi, type DepsRunAi } from "./runAi";

const PAYLOAD = { lang: "fr" as const, titre: "Budget", texte: "Une note." };
const SORTIE = { resume: "Une note sur le budget.", points: ["Un", "Deux", "Trois"] };

function reponse(corps: unknown, statut = 200): Response {
  return new Response(JSON.stringify(corps), { status: statut });
}

function deps(f: typeof fetch, sur: Partial<DepsRunAi> = {}): DepsRunAi {
  return {
    demo: false,
    endpoint: "https://projet.supabase.co/functions/v1/ai",
    cleAnon: "anon",
    jeton: async (forcer) => (forcer ? "neuf" : "ancien"),
    fetch: f,
    ...sur,
  };
}

describe("runAi", () => {
  it("n'envoie que {feature, payload}, avec le jeton de la session", async () => {
    const f = vi.fn(async () => reponse({ ok: true, data: SORTIE, usage: { actionsLeft: 12, resetsAt: "2026-11-01T00:00:00.000Z" } }));
    const r = await runAi("resumer", PAYLOAD, deps(f as unknown as typeof fetch));
    expect(r).toEqual({ ok: true, data: SORTIE, usage: { actionsLeft: 12, resetsAt: "2026-11-01T00:00:00.000Z" } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://projet.supabase.co/functions/v1/ai");
    expect(JSON.parse(String(init.body))).toEqual({ feature: "resumer", payload: PAYLOAD });
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer ancien");
  });

  it("un 401 est retenté UNE fois avec un jeton neuf", async () => {
    const vus: string[] = [];
    const f = (async (_u: string, init: RequestInit) => {
      vus.push((init.headers as Record<string, string>).authorization);
      return vus.length === 1 ? reponse({ ok: false, code: "unauthorized" }, 401) : reponse({ ok: true, data: SORTIE, usage: null });
    }) as unknown as typeof fetch;
    expect((await runAi("resumer", PAYLOAD, deps(f))).ok).toBe(true);
    expect(vus).toEqual(["Bearer ancien", "Bearer neuf"]);
  });

  it("une session qui ne se renouvelle plus → unauthorized, sans appel", async () => {
    const f = vi.fn();
    const r = await runAi("resumer", PAYLOAD, deps(f as unknown as typeof fetch, { jeton: () => Promise.reject(new Error("x")) }));
    expect(r).toEqual({ ok: false, code: "unauthorized" });
    expect(f).not.toHaveBeenCalled();
  });

  it("pas de réseau → network", async () => {
    const f = (async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;
    expect(await runAi("resumer", PAYLOAD, deps(f))).toEqual({ ok: false, code: "network" });
  });

  it("les refus du serveur sont relayés avec leur date ; un code inconnu devient ai_unavailable", async () => {
    const quota = (async () =>
      reponse({ ok: false, code: "quota_exhausted", resetsAt: "2026-11-01T00:00:00.000Z", actionsLeft: 0 }, 429)) as unknown as typeof fetch;
    expect(await runAi("resumer", PAYLOAD, deps(quota))).toEqual({
      ok: false,
      code: "quota_exhausted",
      resetsAt: "2026-11-01T00:00:00.000Z",
      actionsLeft: 0,
    });
    const bizarre = (async () => reponse({ ok: false, code: "rm -rf" }, 500)) as unknown as typeof fetch;
    expect((await runAi("resumer", PAYLOAD, deps(bizarre))) as { code: string }).toMatchObject({ code: "ai_unavailable" });
    const html = (async () => new Response("<html>502 Bad Gateway</html>", { status: 502 })) as unknown as typeof fetch;
    expect((await runAi("resumer", PAYLOAD, deps(html))) as { code: string }).toMatchObject({ code: "ai_unavailable" });
  });

  it("une réponse « ok » hors schéma est REJETÉE ici aussi → bad_output", async () => {
    const f = (async () => reponse({ ok: true, data: { resume: "x", points: Array(8).fill("p") } })) as unknown as typeof fetch;
    expect(await runAi("resumer", PAYLOAD, deps(f))).toEqual({ ok: false, code: "bad_output" });
    const html = (async () => reponse({ ok: true, data: { resume: "<img src=x onerror=alert(1)>", points: [], extra: 1 } })) as unknown as typeof fetch;
    expect((await runAi("resumer", PAYLOAD, deps(html))).ok).toBe(false);
  });

  it("en démo : aucune requête, une réponse factice conforme après un délai", async () => {
    const f = vi.fn();
    const attendre = vi.fn(async () => {});
    const r = await runAi("resumer", PAYLOAD, deps(f as unknown as typeof fetch, { demo: true, attendre }));
    expect(f).not.toHaveBeenCalled();
    expect(attendre).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.points.length).toBeGreaterThan(0);
      expect(r.usage?.actionsLeft).toBeLessThan(400);
    }
  });
});
