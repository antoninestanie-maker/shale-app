// ─────────────────────────────────────────────────────────────────────────────
// Banc de la fonction `ai` (dépôt du site) : un vrai Postgres (PGlite), le
// schéma des abonnements et la migration 008, lus DEPUIS `shale-site` — jamais
// recopiés, pour ne jamais valider une version qui n'est pas celle exécutée.
//
// Même motif que `auth/activation.sql.test.ts`, avec deux ajouts :
//   · le rôle `service_role`, celui de la fonction ;
//   · les PRIVILÈGES PAR DÉFAUT de Supabase — tout objet neuf de `public` est
//     accordé à `anon` et `authenticated`. Sans eux, un `revoke` oublié dans la
//     migration passerait inaperçu ici et fuirait en production (PIEGES).
//
// Le dépôt PGlite appelle les MÊMES fonctions SQL que `coeur/depot.ts` en
// production (par PostgREST) : seul le transport diffère.
// ─────────────────────────────────────────────────────────────────────────────

import { PGlite } from "@electric-sql/pglite";

import schemaSql from "../../../../shale-site/supabase/schema.sql?raw";
import iaSql from "../../../../shale-site/supabase/migrations/008_ia.sql?raw";
import { configDeLigne, reservationDe } from "../../../../shale-site/supabase/functions/ai/coeur/depot.ts";
import type { Depot } from "../../../../shale-site/supabase/functions/ai/coeur/types.ts";

export { iaSql };

const AMORCE = `
create role anon;
create role authenticated;
create role service_role;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

-- Les privilèges par défaut d'un projet Supabase.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`;

export async function bancIa(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(AMORCE);
  await db.exec(schemaSql);
  await db.exec(iaSql);
  return db;
}

/** Crée (ou remplace) un compte et son abonnement. */
export async function compte(
  db: PGlite,
  id: string,
  abonnement: { status: string; tier: string; trialEndsAt?: string | null },
): Promise<void> {
  await db.query("insert into auth.users (id, email) values ($1, $2) on conflict (id) do nothing", [
    id,
    `${id.slice(0, 4)}@exemple.test`,
  ]);
  await db.query(
    `insert into public.subscriptions (user_id, status, tier, trial_ends_at)
     values ($1, $2, $3, $4)
     on conflict (user_id) do update
       set status = excluded.status, tier = excluded.tier, trial_ends_at = excluded.trial_ends_at`,
    [id, abonnement.status, abonnement.tier, abonnement.trialEndsAt ?? null],
  );
}

/** Exécute en se faisant passer pour ce rôle (et ce compte), RLS appliquée. */
export async function commeRole<T>(
  db: PGlite,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  requete: () => Promise<T>,
): Promise<T> {
  if (userId) await db.exec(`set request.jwt.claims = '{"sub":"${userId}","role":"${role}"}';`);
  await db.exec(`set role ${role};`);
  try {
    return await requete();
  } finally {
    await db.exec("reset role;");
    await db.exec("reset request.jwt.claims;");
  }
}

/** Le dépôt de la fonction, sur PGlite. */
export function depotPGlite(db: PGlite): Depot {
  async function un<T>(sql: string, params: unknown[]): Promise<T> {
    const { rows } = await db.query<{ r: T }>(sql, params);
    return rows[0].r;
  }
  return {
    async offre(userId) {
      const r = await un<{ offre: "pro" | "essai"; fin_essai?: string | null } | null>(
        "select public.ai_offre($1::uuid) as r",
        [userId],
      );
      return r ? { offre: r.offre, finEssai: r.fin_essai ?? null } : null;
    },
    async config(feature) {
      const { rows } = await db.query<Record<string, unknown>>("select * from public.ai_config where feature = $1", [
        feature,
      ]);
      return rows[0] ? configDeLigne(rows[0]) : null;
    },
    async reserver(d) {
      const r = await un<{ ok: boolean; code?: string; evenement?: number; actions_restantes?: number }>(
        "select public.ai_reserver($1::uuid, $2, $3, $4, $5::int, $6::int, $7::bigint, $8::int, $9::bigint) as r",
        [d.userId, d.feature, d.model, d.periode, d.poids, d.quota, d.plafondMicro, d.debitMax, d.budgetMicro],
      );
      return reservationDe(r);
    },
    async regler(g) {
      const r = await un<{ actions_utilisees?: number }>(
        "select public.ai_regler($1::bigint, $2::uuid, $3, $4::int, $5, $6::int, $7::int, $8::bigint, $9::boolean) as r",
        [g.evenement, g.userId, g.periode, g.poids, g.statut, g.entree, g.sortie, g.coutMicro, g.rembourser],
      );
      return { actionsUtilisees: Number(r.actions_utilisees ?? 0) };
    },
    async purger() {
      return Number(await un<number>("select public.ai_purger_evenements() as r", []));
    },
    async dejaServi(userId, feature, depuis) {
      const { rows } = await db.query(
        "select 1 from public.ai_events where user_id = $1 and feature = $2 and status = 'ok' and created_at >= $3 limit 1",
        [userId, feature, depuis.toISOString()],
      );
      return rows.length > 0;
    },
  };
}
