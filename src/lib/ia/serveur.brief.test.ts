// ─────────────────────────────────────────────────────────────────────────────
// Phase C, côté serveur : les flux du brief (contrôle SSRF, lecture RSS/Atom),
// le brief et la clôture de bout en bout sur la vraie migration 008.
// Aucun réseau réel : `fetch` et la résolution DNS sont simulés.
// ─────────────────────────────────────────────────────────────────────────────

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  adressePublique,
  FLUX,
  lireArticles,
  recupererFlux,
  urlSure,
  type OutilsFlux,
} from "../../../../shale-site/supabase/functions/ai/coeur/flux.ts";
import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { traiter } from "../../../../shale-site/supabase/functions/ai/coeur/traiter.ts";
import type { Dependances } from "../../../../shale-site/supabase/functions/ai/coeur/types.ts";
import { bancIa, compte, depotPGlite } from "./serveur.testutil";

const PUBLIQUE = "93.184.216.34";

function outils(routes: Record<string, () => Response>, dns: Record<string, string[]> = {}): OutilsFlux & { vus: string[] } {
  const vus: string[] = [];
  return {
    vus,
    resoudre: async (h) => dns[h] ?? [PUBLIQUE],
    fetch: (async (u: string) => {
      vus.push(String(u));
      const r = routes[String(u)];
      if (!r) throw new Error(`url inattendue ${u}`);
      return r();
    }) as unknown as typeof fetch,
  };
}

const RSS = (n: number, base = "https://journal.example/a") => `<?xml version="1.0"?><rss><channel>
${Array.from({ length: n }, (_, i) => `<item><title><![CDATA[Titre ${i} &amp; co]]></title><link>${base}${i}</link>
<pubDate>Mon, ${String(10 + (i % 18)).padStart(2, "0")} Sep 2026 08:00:00 GMT</pubDate>
<description>&lt;p&gt;Extrait &lt;b&gt;${i}&lt;/b&gt;&lt;/p&gt;</description></item>`).join("\n")}
</channel></rss>`;

describe("flux — qui est public", () => {
  it("refuse tout ce qui mène au réseau interne, sous toutes ses écritures", () => {
    for (const ip of [
      "127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0",
      "224.0.0.1", "255.255.255.255", "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1",
      "::ffff:7f00:1", "::ffff:a9fe:a9fe", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1", "[::1]", "n'importe",
    ])
      expect(adressePublique(ip), ip).toBe(false);
    for (const ip of [PUBLIQUE, "8.8.8.8", "2606:4700::1111", "::ffff:8.8.8.8"]) expect(adressePublique(ip), ip).toBe(true);
  });

  it("n'accepte qu'une URL https, sans identifiants ni port exotique, dont TOUTES les adresses sont publiques", async () => {
    const o = outils({}, { "interne.example": ["10.0.0.5"], "mixte.example": [PUBLIQUE, "127.0.0.1"] });
    for (const u of [
      "http://journal.example/rss",
      "https://127.0.0.1/rss",
      "https://[::1]/rss",
      "https://2130706433/rss", // 127.0.0.1 en décimal : l'analyseur d'URL le normalise
      "https://user:pw@journal.example/rss",
      "https://journal.example:8443/rss",
      "https://localhost/rss",
      "https://x.internal/rss",
      "https://interne.example/rss",
      "https://mixte.example/rss",
      "file:///etc/passwd",
      "pas une url",
    ])
      expect(await urlSure(u, o), u).toBeNull();
    expect(await urlSure("https://journal.example/rss", o)).not.toBeNull();
    const muet: OutilsFlux = { fetch: o.fetch, resoudre: () => Promise.reject(new Error("pas de DNS")) };
    expect(await urlSure("https://journal.example/rss", muet)).toBeNull(); // fermé par défaut
  });

  it("une redirection vers l'interne est refusée ; plus de trois sauts aussi", async () => {
    const o = outils({
      "https://a.example/rss": () => new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/meta-data" } }),
      "https://b.example/1": () => new Response(null, { status: 301, headers: { location: "/2" } }),
      "https://b.example/2": () => new Response(null, { status: 301, headers: { location: "/3" } }),
      "https://b.example/3": () => new Response(null, { status: 301, headers: { location: "/4" } }),
      "https://b.example/4": () => new Response(null, { status: 301, headers: { location: "/5" } }),
    });
    expect(await recupererFlux("https://a.example/rss", o)).toBeNull();
    expect(o.vus).not.toContain("https://169.254.169.254/latest/meta-data");
    expect(await recupererFlux("https://b.example/1", o)).toBeNull();
  });

  it("taille bornée, annoncée ou non ; une erreur HTTP rend null", async () => {
    const gros = "x".repeat(FLUX.octetsMax + 10);
    const o = outils({
      "https://c.example/annonce": () => new Response("x", { headers: { "content-length": String(FLUX.octetsMax + 1) } }),
      "https://c.example/flot": () => new Response(gros),
      "https://c.example/404": () => new Response("non", { status: 404 }),
      "https://c.example/ok": () => new Response(RSS(2)),
    });
    expect(await recupererFlux("https://c.example/annonce", o)).toBeNull();
    expect(await recupererFlux("https://c.example/flot", o)).toBeNull();
    expect(await recupererFlux("https://c.example/404", o)).toBeNull();
    expect(await recupererFlux("https://c.example/ok", o)).toContain("<rss>");
  });
});

describe("flux — lecture RSS et Atom", () => {
  it("RSS : CDATA, entités, HTML échappé retiré, plus récents d'abord, bornés à 15", () => {
    const a = lireArticles(RSS(20));
    expect(a).toHaveLength(15);
    expect(a[0].titre).toMatch(/^Titre \d+ & co$/);
    expect(a[0].extrait).toMatch(/^Extrait \d+$/);
    expect(a.map((x) => x.date)).toEqual([...a.map((x) => x.date)].sort().reverse());
  });

  it("Atom : lien en attribut ; une entrée sans lien http est ignorée", () => {
    const atom = `<feed><entry><title>Un</title><link href="https://blog.example/un"/><updated>2026-09-28T10:00:00Z</updated><summary>Résumé</summary></entry>
<entry><title>Deux</title><link href="javascript:alert(1)"/></entry></feed>`;
    expect(lireArticles(atom)).toEqual([{ titre: "Un", lien: "https://blog.example/un", date: "2026-09-28T10:00:00.000Z", extrait: "Résumé" }]);
  });
});

// ── Brief et clôture, de bout en bout ────────────────────────────────────────

const PRO = "30000000-0000-0000-0000-000000000001";
let db: PGlite;
let file: string[] = [];
let vus: string[] = [];

const fetchMixte = (async (u: string) => {
  vus.push(String(u));
  if (String(u) === "https://api.anthropic.com/v1/messages") {
    const texte = file.shift();
    if (texte === undefined) throw new Error("appel au modèle non prévu");
    return new Response(JSON.stringify({ content: [{ type: "text", text: texte }], stop_reason: "end_turn", usage: { input_tokens: 5000, output_tokens: 600 } }));
  }
  if (String(u) === "https://journal.example/rss") return new Response(RSS(3));
  if (String(u) === "https://autre.example/rss") return new Response(RSS(2, "https://autre.example/b"));
  throw new Error(`url inattendue ${u}`);
}) as unknown as typeof fetch;

function deps(): Dependances {
  return {
    depot: depotPGlite(db),
    fonctions: FONCTIONS,
    verifierJeton: async (j) => (j === "jeton-pro" ? PRO : null),
    fetch: fetchMixte,
    cleAnthropic: "cle",
    budgetGlobalMicro: 50_000_000,
    maintenant: () => new Date(),
    compterPages: async () => 1,
    journal: () => {},
    originesAutorisees: [],
    hasard: () => 0.5,
    resoudre: async () => [PUBLIQUE],
  };
}

async function appel(feature: string, payload: unknown) {
  const r = await traiter(
    new Request("https://x/ai", {
      method: "POST",
      headers: { authorization: "Bearer jeton-pro", "content-type": "application/json" },
      body: JSON.stringify({ feature, payload }),
    }),
    deps(),
  );
  return { statut: r.status, corps: (await r.json()) as Record<string, unknown> };
}

const JOURNEE = {
  evenements: [{ titre: "Point équipe", heure: "10:00" }],
  priorites: [{ titre: "Envoyer le devis" }],
  tachesPrevues: 6,
  surcharge: true,
};

const briefDe = (sur: Record<string, unknown> = {}) => ({
  lang: "fr",
  jour: "2026-10-14",
  regenerer: false,
  sujets: [
    { nom: "Presse", flux: ["https://journal.example/rss", "http://127.0.0.1/rss"] },
    { nom: "Tech", flux: ["https://autre.example/rss"] },
  ],
  journee: JOURNEE,
  ...sur,
});

const SORTIE_BRIEF = JSON.stringify({
  sujets: [
    { nom: "Presse", points: [{ texte: "Titre 0.", lien: "https://journal.example/a0" }] },
    { nom: "Tech", points: [{ texte: "Titre 1.", lien: "https://autre.example/b1" }] },
  ],
  journee: "Une journée chargée : un point d'équipe à 10 h, et le devis d'abord.",
});

beforeAll(async () => {
  db = await bancIa();
  await compte(db, PRO, { status: "active", tier: "shale_pro" });
  await db.query("update public.ai_config set enabled = true where feature in ('brief', 'cloture')");
});

afterAll(async () => {
  await db?.close();
});

beforeEach(async () => {
  file = [];
  vus = [];
  await db.query("delete from public.ai_usage");
  await db.query("delete from public.ai_events");
});

describe("brief — de bout en bout", () => {
  it("les flux sont lus par le serveur, l'URL interne n'est jamais appelée, le modèle ne reçoit que les articles et les faits", async () => {
    file = [SORTIE_BRIEF];
    const r = await appel("brief", briefDe());
    expect(r.statut).toBe(200);
    expect(vus).not.toContain("http://127.0.0.1/rss");
    const corps = vus.filter((u) => u.includes("journal") || u.includes("autre"));
    expect(corps).toEqual(expect.arrayContaining(["https://journal.example/rss", "https://autre.example/rss"]));
    // Poids 2 (ai_config).
    const { rows } = await db.query<{ actions_used: number }>("select actions_used from public.ai_usage");
    expect(rows[0].actions_used).toBe(2);
  });

  it("un lien qui n'est pas celui d'un article fourni → relance, puis bad_output", async () => {
    const invente = JSON.stringify({ sujets: [{ nom: "Presse", points: [{ texte: "Inventé.", lien: "https://ailleurs.example/x" }] }], journee: "…" });
    file = [invente, invente];
    expect((await appel("brief", briefDe())).corps.code).toBe("bad_output");
  });

  it("un seul brief par jour : le second est refusé (409) sans rien coûter, sauf « Régénérer »", async () => {
    file = [SORTIE_BRIEF];
    expect((await appel("brief", briefDe())).statut).toBe(200);
    const deux = await appel("brief", briefDe());
    expect(deux).toEqual({ statut: 409, corps: { ok: false, code: "already_done" } });
    file = [SORTIE_BRIEF];
    expect((await appel("brief", briefDe({ regenerer: true }))).statut).toBe(200);
    const { rows } = await db.query<{ actions_used: number }>("select actions_used from public.ai_usage");
    expect(rows[0].actions_used).toBe(4); // deux briefs servis, pas trois
  });

  it("plus de cinq sujets, ou une URL non https dans la forme → bad_payload avant toute lecture", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ nom: `S${i}`, flux: [] }));
    expect((await appel("brief", briefDe({ sujets: six }))).corps.code).toBe("bad_payload");
    expect((await appel("brief", briefDe({ sujets: [{ nom: "x", flux: ["ftp://x"] }] }))).corps.code).toBe("bad_payload");
    expect(vus).toHaveLength(0);
  });
});

describe("clôture — de bout en bout", () => {
  const cloture = {
    lang: "fr",
    jour: "2026-10-14",
    faites: [{ titre: "Relire le contrat" }],
    restantes: [
      { id: "t1", titre: "Envoyer le devis", priorite: "high", echeance: "2026-10-14", reports: 0 },
      { id: "t2", titre: "Ranger le bureau", priorite: "low", echeance: null, reports: 4 },
    ],
  };
  const sortie = (propositions: unknown[]) => JSON.stringify({ bilan: "Une tâche faite, deux restent.", propositions });

  it("une proposition par tâche, dates futures : acceptée", async () => {
    file = [
      sortie([
        { id: "t1", action: "demain", date: null, raison: "Prioritaire." },
        { id: "t2", action: "supprimer", date: null, raison: "Reportée quatre fois." },
      ]),
    ];
    const r = await appel("cloture", cloture);
    expect(r.statut).toBe(200);
    expect((r.corps.data as { propositions: unknown[] }).propositions).toHaveLength(2);
  });

  it("id inventé, haute priorité à supprimer, date passée → rejetés (relance puis bad_output)", async () => {
    for (const mauvaise of [
      [{ id: "t9", action: "demain", date: null, raison: "?" }],
      [{ id: "t1", action: "supprimer", date: null, raison: "?" }],
      [{ id: "t2", action: "date", date: "2026-10-01", raison: "?" }],
      [{ id: "t2", action: "date", date: null, raison: "?" }],
    ]) {
      file = [sortie(mauvaise), sortie(mauvaise)];
      expect((await appel("cloture", cloture)).corps.code, JSON.stringify(mauvaise)).toBe("bad_output");
    }
  });
});
