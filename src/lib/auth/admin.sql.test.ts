// ─────────────────────────────────────────────────────────────────────────────
// `002_admin.sql` sur un vrai Postgres.
//
// Motif, le même que pour `sync.sql` (voir `lib/sync/supabase.testutil.ts`) :
// cette machine n'a ni Postgres, ni Docker, ni la CLI Supabase. Cette migration
// partirait donc en production sans avoir jamais été exécutée — alors qu'elle
// porte la seule chose qui empêche un inscrit quelconque de réécrire le site
// public. C'est précisément ce qu'on ne peut pas se permettre de supposer.
//
// Le fichier est lu DEPUIS `shale-site`, pas recopié : une copie finirait par
// diverger, et on validerait une version qui n'est pas celle exécutée.
//
// CE QUE CE BANC NE COUVRE PAS : les vraies politiques du bucket Supabase
// Storage (ici simulé) et le fait que PostgREST expose bien `public.admins`.
// Restent à vérifier sur le projet réel.
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import siteContentSql from "../../../../shale-site/supabase/site-content.sql?raw";
import adminSql from "../../../../shale-site/supabase/migrations/002_admin.sql?raw";

const ADMIN_ID = "11111111-1111-1111-1111-111111111111";
const LAMBDA_ID = "22222222-2222-2222-2222-222222222222";
// Doit rester identique à l'adresse inscrite dans 002_admin.sql : c'est par
// elle que la migration retrouve le compte.
const ADMIN_EMAIL = "antonin.estanie@icloud.com";

// Le strict nécessaire de l'environnement Supabase. `auth.uid()` est écrit
// comme le vrai — il lit le `sub` du JWT — pour que les politiques soient
// testées pour de bon, et pas seulement constatées présentes.
const AMORCE = `
create role anon;
create role authenticated;

create schema auth;
create table auth.users (id uuid primary key, email text);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

create function auth.role() returns text language sql stable as $$
  select current_setting('request.jwt.claims', true)::json ->> 'role'
$$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text,
  name      text
);
alter table storage.objects enable row level security;

grant usage on schema auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
`;

let db: PGlite;

/** Exécute en se faisant passer pour cet utilisateur, politiques appliquées. */
async function commeUtilisateur<T>(userId: string, requete: () => Promise<T>): Promise<T> {
  // `set role` est indispensable : le propriétaire des tables contourne la RLS,
  // et le test serait creux.
  await db.exec(
    `set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';`,
  );
  await db.exec("set role authenticated;");
  try {
    return await requete();
  } finally {
    await db.exec("reset role;");
    await db.exec("reset request.jwt.claims;");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AMORCE);
  await db.exec(siteContentSql);

  // Les comptes existent AVANT la migration : c'est le cas réel décrit dans le
  // guide d'installation — le compte est créé par le formulaire du site, puis
  // on rejoue la migration pour lui attribuer le rôle.
  await db.query("insert into auth.users (id, email) values ($1, $2)", [ADMIN_ID, ADMIN_EMAIL]);
  await db.query("insert into auth.users (id, email) values ($1, $2)", [
    LAMBDA_ID,
    "quelquun@exemple.com",
  ]);

  await db.exec(adminSql);
  // `site_content` appartient au superutilisateur qui vient de la créer ; en
  // vrai, Supabase accorde ces droits au rôle `authenticated`.
  await db.exec("grant select, update on public.site_content to authenticated;");
  await db.exec("grant select on public.admins to authenticated;");
});

afterAll(async () => {
  await db?.close();
});

describe("002_admin.sql", () => {
  it("est rejouable sans rien casser", async () => {
    await expect(db.exec(adminSql)).resolves.toBeDefined();
  });

  it("attribue le rôle au compte propriétaire, et à lui seul", async () => {
    const { rows } = await db.query<{ email: string }>(
      "select u.email from public.admins a join auth.users u on u.id = a.user_id",
    );
    expect(rows.map((r) => r.email)).toEqual([ADMIN_EMAIL]);
  });

  it("is_admin() distingue les deux comptes", async () => {
    const lire = async (id: string) =>
      commeUtilisateur(id, async () => {
        const { rows } = await db.query<{ v: boolean }>("select public.is_admin() as v");
        return rows[0].v;
      });

    expect(await lire(ADMIN_ID)).toBe(true);
    expect(await lire(LAMBDA_ID)).toBe(false);
  });

  describe("le contenu du site", () => {
    it("s'écrit pour l'administrateur", async () => {
      await commeUtilisateur(ADMIN_ID, async () => {
        const res = await db.query(
          `update public.site_content set overrides = '{"titre":"par l_admin"}'::jsonb where id = 1`,
        );
        expect(res.affectedRows).toBe(1);
      });
    });

    // Le cœur de la migration. Avant elle, la politique disait « tout compte
    // connecté » : cette écriture-ci passait.
    it("ne s'écrit PAS pour un inscrit quelconque", async () => {
      await commeUtilisateur(LAMBDA_ID, async () => {
        const res = await db.query(
          `update public.site_content set overrides = '{"titre":"par un inconnu"}'::jsonb where id = 1`,
        );
        expect(res.affectedRows).toBe(0);
      });

      const { rows } = await db.query<{ overrides: { titre?: string } }>(
        "select overrides from public.site_content where id = 1",
      );
      expect(rows[0].overrides.titre).toBe("par l_admin");
    });

    it("reste lisible par tout le monde — le site l'affiche", async () => {
      await commeUtilisateur(LAMBDA_ID, async () => {
        const { rows } = await db.query("select overrides from public.site_content where id = 1");
        expect(rows).toHaveLength(1);
      });
    });
  });

  describe("la table des administrateurs", () => {
    it("ne laisse personne se promouvoir", async () => {
      await commeUtilisateur(LAMBDA_ID, async () => {
        await expect(
          db.query("insert into public.admins (user_id) values ($1)", [LAMBDA_ID]),
        ).rejects.toThrow();
      });
    });

    it("ne dévoile pas qui est administrateur", async () => {
      await commeUtilisateur(LAMBDA_ID, async () => {
        const { rows } = await db.query("select user_id from public.admins");
        expect(rows).toHaveLength(0);
      });
    });
  });
});
