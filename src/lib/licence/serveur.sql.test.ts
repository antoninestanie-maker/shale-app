// ─────────────────────────────────────────────────────────────────────────────
// `005_licence_profils.sql` sur un vrai Postgres (PGlite).
//
// Même motif que `auth/admin.sql.test.ts` : cette machine n'a ni Postgres ni la
// CLI Supabase, et cette migration porte une promesse de sécurité — un compte
// ne lit que SON profil, et personne n'en écrit depuis un client. Le fichier
// est lu DEPUIS `shale-site`, jamais recopié.
//
// ⭐ Et un test que seul un vrai Postgres pouvait faire : le texte signé
// ressort À L'OCTET PRÈS. Avec `jsonb` ou `timestamptz`, il ressortirait
// réécrit, et la signature ne vaudrait plus rien.
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import licenceSql from "../../../../shale-site/supabase/migrations/005_licence_profils.sql?raw";

const A = "11111111-1111-1111-1111-111111111111";
const B = "22222222-2222-2222-2222-222222222222";

const AMORCE = `
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
`;

let db: PGlite;

async function comme<T>(userId: string, requete: () => Promise<T>): Promise<T> {
  await db.exec(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';`);
  await db.exec("set role authenticated;");
  try {
    return await requete();
  } finally {
    await db.exec("reset role;");
    await db.exec("reset request.jwt.claims;");
  }
}

// Des octets choisis pour piéger une réécriture : clés dans le désordre,
// espaces, apostrophe, accents, date à la milliseconde avec « Z ».
const PAYLOAD = '{ "labels": {"Tâches": "Missions d\'audit"},  "modules": {"hidden":["trading"]} }';
const EMIS = "2026-09-13T08:00:00.123Z";

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AMORCE);
  await db.query("insert into auth.users (id) values ($1), ($2)", [A, B]);
  await db.exec(licenceSql);
  // Rejouée : la migration se dit idempotente.
  await db.exec(licenceSql);
  // Insertion en propriétaire — le rôle du SQL Editor.
  await db.query(
    `insert into public.license_profiles
       (user_id, tier, profile_version, issued_at, expires_at, payload, signature)
     values ($1, 'shale_trade', 1, $2, '2027-09-13T23:59:59.000Z', $3, 'c2ln')`,
    [A, EMIS, PAYLOAD],
  );
});

afterAll(async () => {
  await db.close();
});

describe("005_licence_profils.sql", () => {
  it("rend le texte signé à l'octet près", async () => {
    const r = await db.query<{ payload: string; issued_at: string }>(
      "select payload, issued_at from public.license_profiles where user_id = $1",
      [A],
    );
    expect(r.rows[0].payload).toBe(PAYLOAD);
    expect(r.rows[0].issued_at).toBe(EMIS);
  });

  it("un compte lit son profil", async () => {
    const r = await comme(A, () => db.query("select user_id from public.license_profiles"));
    expect(r.rows).toHaveLength(1);
  });

  it("un autre compte ne voit RIEN — pas même qu'un profil existe", async () => {
    const r = await comme(B, () => db.query("select user_id from public.license_profiles"));
    expect(r.rows).toHaveLength(0);
  });

  it("aucun client ne s'écrit un profil, ni ne modifie ou supprime le sien", async () => {
    await expect(
      comme(B, () =>
        db.query(
          `insert into public.license_profiles
             (user_id, tier, profile_version, issued_at, expires_at, payload, signature)
           values ($1, 'shale', 1, 'x', 'y', '{}', 'z')`,
          [B],
        ),
      ),
    ).rejects.toThrow();
    // `update` et `delete` sans privilège ni politique : refus net.
    await expect(
      comme(A, () => db.query("update public.license_profiles set expires_at = '2099-01-01'")),
    ).rejects.toThrow();
    await expect(comme(A, () => db.query("delete from public.license_profiles"))).rejects.toThrow();
    const r = await db.query("select expires_at from public.license_profiles where user_id = $1", [A]);
    expect(r.rows).toEqual([{ expires_at: "2027-09-13T23:59:59.000Z" }]);
  });
});
