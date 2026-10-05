// ─────────────────────────────────────────────────────────────────────────────
// `008_ia.sql` sur un vrai Postgres : qui peut lire quoi, qui décide « Pro »,
// et la réservation qui ne laisse jamais passer une action de trop.
//
// CE QUE CE BANC NE COUVRE PAS : la concurrence réelle (PGlite n'a qu'une
// connexion — le `for update` d'`ai_reserver` n'est donc pas mis à l'épreuve
// ici), et l'exposition des fonctions par PostgREST (à vérifier en `curl` sur
// le projet, après déploiement).
// ─────────────────────────────────────────────────────────────────────────────

import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { bancIa, commeRole, compte, depotPGlite, geminiSql, iaSql } from "./serveur.testutil";

const PRO = "10000000-0000-0000-0000-000000000001";
const ESSAI = "10000000-0000-0000-0000-000000000002";
const ESSAI_ECHU = "10000000-0000-0000-0000-000000000003";
const BUSINESS = "10000000-0000-0000-0000-000000000004";
const SHALE = "10000000-0000-0000-0000-000000000005";
const IMPAYE = "10000000-0000-0000-0000-000000000006";
const AUTRE = "10000000-0000-0000-0000-000000000007";

let db: PGlite;

beforeAll(async () => {
  db = await bancIa();
  const demain = new Date(Date.now() + 86_400_000).toISOString();
  const hier = new Date(Date.now() - 86_400_000).toISOString();
  await compte(db, PRO, { status: "active", tier: "shale_pro" });
  await compte(db, ESSAI, { status: "trialing", tier: "shale_pro", trialEndsAt: demain });
  await compte(db, ESSAI_ECHU, { status: "trialing", tier: "shale_pro", trialEndsAt: hier });
  await compte(db, BUSINESS, { status: "active", tier: "shale_business" });
  await compte(db, SHALE, { status: "active", tier: "shale" });
  await compte(db, IMPAYE, { status: "past_due", tier: "shale_pro" });
  await compte(db, AUTRE, { status: "active", tier: "shale_pro" });
});

afterAll(async () => {
  await db?.close();
});

describe("008 — l'offre, lue côté serveur", () => {
  it("Pro payé et essai Pro en cours passent ; rien d'autre", async () => {
    const d = depotPGlite(db);
    expect(await d.offre(PRO)).toEqual({ offre: "pro", finEssai: null });
    const essai = await d.offre(ESSAI);
    expect(essai?.offre).toBe("essai");
    expect(essai?.finEssai).toBeTruthy();
    // Business n'a PAS l'IA (décision du 2026-09-29), ni un essai échu, ni un
    // impayé, ni la formule de base, ni un compte sans abonnement.
    for (const id of [ESSAI_ECHU, BUSINESS, SHALE, IMPAYE, "10000000-0000-0000-0000-00000000dead"])
      expect(await d.offre(id)).toBeNull();
  });
});

describe("008 — personne ne lit ni n'écrit depuis un client", () => {
  it("la config est illisible par anon et authenticated", async () => {
    for (const role of ["anon", "authenticated"] as const)
      await expect(
        commeRole(db, role, role === "authenticated" ? PRO : null, () => db.query("select * from public.ai_config")),
      ).rejects.toThrow(/permission denied/);
  });

  it("le journal est illisible depuis un client", async () => {
    await expect(commeRole(db, "authenticated", PRO, () => db.query("select * from public.ai_events"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("les quatre fonctions sont refusées à anon et authenticated, accordées au service_role", async () => {
    const appels = [
      `select public.ai_offre('${PRO}'::uuid)`,
      `select public.ai_reserver('${PRO}'::uuid, 'resumer', 'm', '2099-01', 1, 400, 3000000, 10, 1000000)`,
      `select public.ai_regler(1, '${PRO}'::uuid, '2099-01', 1, 'ok', 0, 0, 0, false)`,
      "select public.ai_purger_evenements()",
    ];
    for (const role of ["anon", "authenticated"] as const)
      for (const sql of appels)
        await expect(commeRole(db, role, role === "authenticated" ? PRO : null, () => db.query(sql))).rejects.toThrow(
          /permission denied/,
        );
    await expect(commeRole(db, "service_role", null, () => db.query(appels[0]))).resolves.toBeTruthy();
  });

  it("un compte lit SA ligne d'usage, pas celle d'un autre, et ne peut pas l'écrire", async () => {
    await db.query(
      "insert into public.ai_usage (user_id, period, actions_used) values ($1, '2099-02', 7), ($2, '2099-02', 9)",
      [PRO, AUTRE],
    );
    const lues = await commeRole(db, "authenticated", PRO, () =>
      db.query<{ user_id: string; actions_used: number }>("select user_id, actions_used from public.ai_usage"),
    );
    expect(lues.rows.map((r) => r.user_id)).toEqual([PRO]);
    await expect(
      commeRole(db, "authenticated", PRO, () =>
        db.query("update public.ai_usage set actions_used = 0 where user_id = $1", [PRO]),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      commeRole(db, "authenticated", PRO, () =>
        db.query("insert into public.ai_usage (user_id, period) values ($1, '2099-03')", [PRO]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("008 — réserver et régler", () => {
  const base = {
    feature: "resumer",
    model: "claude-haiku-4-5-20251001",
    poids: 1,
    quota: 3,
    plafondMicro: 3_000_000,
    debitMax: 100,
    budgetMicro: 1_000_000_000,
  };

  it("jamais une action de trop, et le refus dit ce qu'il reste", async () => {
    const d = depotPGlite(db);
    const periode = "2099-04";
    const r = [];
    for (let i = 0; i < 4; i++) r.push(await d.reserver({ ...base, userId: PRO, periode }));
    expect(r.slice(0, 3).every((x) => x.ok)).toBe(true);
    expect(r[3]).toEqual({ ok: false, code: "quota_exhausted", actionsRestantes: 0 });
    // Un poids de 2 ne passe pas sur la dernière action restante.
    const periode2 = "2099-05";
    await d.reserver({ ...base, userId: PRO, periode: periode2, poids: 2 });
    expect((await d.reserver({ ...base, userId: PRO, periode: periode2, poids: 2 })).ok).toBe(false);
  });

  it("un règlement rembourse une seule fois, et inscrit toujours le coût", async () => {
    const d = depotPGlite(db);
    const periode = "2099-06";
    const r = await d.reserver({ ...base, userId: PRO, periode });
    if (!r.ok) throw new Error("réservation refusée");
    const g = {
      evenement: r.evenement,
      userId: PRO,
      periode,
      poids: 1,
      statut: "bad_output" as const,
      entree: 100,
      sortie: 20,
      coutMicro: 250,
      rembourser: true,
    };
    expect((await d.regler(g)).actionsUtilisees).toBe(0);
    expect((await d.regler(g)).actionsUtilisees).toBe(0); // second règlement : sans effet
    const { rows } = await db.query<{ actions_used: number; cost_micro_usd: string }>(
      "select actions_used, cost_micro_usd from public.ai_usage where user_id = $1 and period = $2",
      [PRO, periode],
    );
    expect(rows[0].actions_used).toBe(0);
    expect(Number(rows[0].cost_micro_usd)).toBe(250);
  });

  it("un compte ne peut pas régler l'événement d'un autre", async () => {
    const d = depotPGlite(db);
    const r = await d.reserver({ ...base, userId: AUTRE, periode: "2099-07" });
    if (!r.ok) throw new Error("réservation refusée");
    await d.regler({
      evenement: r.evenement,
      userId: PRO,
      periode: "2099-07",
      poids: 1,
      statut: "ok",
      entree: 0,
      sortie: 0,
      coutMicro: 999,
      rembourser: true,
    });
    const { rows } = await db.query<{ status: string }>("select status from public.ai_events where id = $1", [
      r.evenement,
    ]);
    expect(rows[0].status).toBe("pending");
  });

  it("la purge retire ce qui a plus de 90 jours, et rien d'autre", async () => {
    await db.query(
      `insert into public.ai_events (user_id, feature, status, created_at)
       values ($1, 'resumer', 'ok', now() - interval '91 days'),
              ($1, 'resumer', 'ok', now() - interval '89 days')`,
      [SHALE],
    );
    expect(await depotPGlite(db).purger()).toBe(1);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.ai_events where user_id = $1",
      [SHALE],
    );
    expect(rows[0].n).toBe(1);
  });
});

describe("008 — la migration elle-même", () => {
  it("inscrit les dix-neuf fonctions de la V1, toutes éteintes, toutes sur Gemini (010)", async () => {
    const { rows } = await db.query<{ n: number; allumees: number }>(
      "select count(*)::int as n, count(*) filter (where enabled)::int as allumees from public.ai_config",
    );
    expect(rows[0]).toEqual({ n: 19, allumees: 0 });
    const { rows: fournisseurs } = await db.query<{ provider: string; n: number }>(
      "select provider, count(*)::int as n from public.ai_config group by provider",
    );
    expect(fournisseurs).toEqual([{ provider: "google", n: 19 }]);
    const revue = await depotPGlite(db).config("revue");
    expect(revue).toMatchObject({ provider: "google", model: "gemini-3.8-flash", thinking: { thinkingLevel: "low" } });
    expect((await depotPGlite(db).config("brief"))?.model).toBe("gemini-3.5-flash-lite");
  });

  it("se rejoue sans erreur et sans écraser un réglage changé", async () => {
    await db.query("update public.ai_config set enabled = true, model = 'gemini-3.1-flash-lite' where feature = 'resumer'");
    await db.exec(iaSql);
    await db.exec(geminiSql);
    const c = await depotPGlite(db).config("resumer");
    expect(c?.enabled).toBe(true);
    expect(c?.model).toBe("gemini-3.1-flash-lite");
    // Le fournisseur n'accepte que deux valeurs.
    await expect(db.query("update public.ai_config set provider = 'openai' where feature = 'resumer'")).rejects.toThrow(
      /ai_config_provider_check/,
    );
    // …et les privilèges sont toujours retirés après le rejeu.
    await expect(
      commeRole(db, "authenticated", PRO, () => db.query("select * from public.ai_config")),
    ).rejects.toThrow(/permission denied/);
  });
});
