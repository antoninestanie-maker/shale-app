// ─────────────────────────────────────────────────────────────────────────────
// `003_activation.sql` sur un vrai Postgres.
//
// Même motif que `admin.sql.test.ts` : cette machine n'a ni Postgres, ni Docker,
// ni la CLI Supabase, donc la migration partirait en production sans avoir
// jamais été exécutée. Or celle-ci porte le mur d'entrée de l'app tout entier —
// et un mur qui se trompe se trompe dans les deux sens : soit il laisse entrer
// tout le monde, soit il n'ouvre à personne. Les deux se testent ici.
//
// Le fichier est lu DEPUIS `shale-site`, pas recopié : une copie finirait par
// diverger, et on validerait une version qui n'est pas celle exécutée.
//
// CE QUE CE BANC NE COUVRE PAS : que PostgREST expose bien la colonne
// `activated` de la vue (à vérifier sur le projet réel, en `curl`), et le
// comportement de l'app elle-même — voir `access.test.ts` pour la règle côté
// client.
// ─────────────────────────────────────────────────────────────────────────────
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

import schemaSql from "../../../../shale-site/supabase/schema.sql?raw";
import activationSql from "../../../../shale-site/supabase/migrations/003_activation.sql?raw";

const PROPRIETAIRE_ID = "11111111-1111-1111-1111-111111111111";
const INVITE_ID = "22222222-2222-2222-2222-222222222222";
const INCONNU_ID = "33333333-3333-3333-3333-333333333333";

// Doit rester identique à l'adresse inscrite dans 003_activation.sql : c'est par
// elle que la migration retrouve le compte.
const PROPRIETAIRE_EMAIL = "antonin.estanie@icloud.com";

const AMORCE = `
create role anon;
create role authenticated;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

grant usage on schema auth to anon, authenticated;
`;

let db: PGlite;

/** Exécute en se faisant passer pour cet utilisateur, politiques appliquées. */
async function commeUtilisateur<T>(userId: string, requete: () => Promise<T>): Promise<T> {
  // `set role` est indispensable : le propriétaire des tables contourne la RLS,
  // et le test serait creux.
  await db.exec(`set request.jwt.claims = '{"sub":"${userId}","role":"authenticated"}';`);
  await db.exec("set role authenticated;");
  try {
    return await requete();
  } finally {
    await db.exec("reset role;");
    await db.exec("reset request.jwt.claims;");
  }
}

/** Ce que l'app lit au démarrage, pour ce compte-là. */
async function lireMonAbonnement(userId: string) {
  return commeUtilisateur(userId, async () => {
    const { rows } = await db.query<{ status: string; is_active: boolean; activated: boolean }>(
      "select status, is_active, activated from public.my_subscription where user_id = $1",
      [userId],
    );
    return rows[0] ?? null;
  });
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(AMORCE);
  await db.exec(schemaSql);

  // Les comptes existent AVANT la migration — c'est le cas réel : l'inscription
  // était ouverte depuis le 2026-08-11. Le trigger de `schema.sql` leur ouvre à
  // chacun une ligne `subscriptions`.
  //
  // ⚠️ CETTE LIGNE N'EST PLUS UN ESSAI. Jusqu'au 2026-08-31, le trigger ouvrait
  // sept jours d'essai à l'inscription, sans carte. Depuis l'ouverture de la
  // boutique, il écrit `status = 'none'` et `trial_ends_at = null` :
  // **l'essai vient de Stripe**, et c'est le webhook qui écrit `trialing` une
  // fois la carte enregistrée (migration 004 du site).
  //
  // Décision d'Antonin, 2026-09-02 : l'essai reste POSSIBLE, il n'est pas
  // OBLIGATOIRE — le Checkout accepte `sansEssai` pour s'abonner directement,
  // et `trial_period_days` n'est posé qu'à la première souscription.
  // Les tests ci-dessous mettent donc l'essai en place EXPLICITEMENT, comme le
  // ferait le webhook, au lieu de l'attendre de l'inscription.
  for (const [id, email] of [
    [PROPRIETAIRE_ID, PROPRIETAIRE_EMAIL],
    [INVITE_ID, "invite@exemple.com"],
    [INCONNU_ID, "inconnu@exemple.com"],
  ] as const) {
    await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
  }

  await db.exec(activationSql);

  // ⚠️ ON ACCORDE VOLONTAIREMENT PLUS QUE `select`.
  //
  // Supabase applique des privilèges par défaut généreux sur le schéma `public`
  // (`grant all … to anon, authenticated`) : côté droits SQL, un compte connecté
  // PEUT tenter un insert ou un delete. Ce qui l'arrête est la RLS, et elle
  // seule. Ne donner ici que `select` ferait échouer les tentatives sur un
  // « permission denied » — un banc plus sévère que la production, donc un banc
  // qui déclare sûres des politiques jamais éprouvées.
  await db.exec("grant select, insert, update, delete on public.activations to authenticated;");
  await db.exec("grant select on public.subscriptions to authenticated;");
});

afterAll(async () => {
  await db?.close();
});

describe("003_activation.sql", () => {
  it("est rejouable sans rien casser", async () => {
    await expect(db.exec(activationSql)).resolves.toBeDefined();
  });

  it("n'active que le compte propriétaire — pas les inscrits de la veille", async () => {
    const { rows } = await db.query<{ email: string }>(
      "select u.email from public.activations a join auth.users u on u.id = a.user_id",
    );
    expect(rows.map((r) => r.email)).toEqual([PROPRIETAIRE_EMAIL]);
  });

  it("is_activated() distingue les comptes", async () => {
    const lire = async (id: string) =>
      commeUtilisateur(id, async () => {
        const { rows } = await db.query<{ v: boolean }>("select public.is_activated() as v");
        return rows[0].v;
      });

    expect(await lire(PROPRIETAIRE_ID)).toBe(true);
    expect(await lire(INCONNU_ID)).toBe(false);
  });

  describe("la vue lue par l'app", () => {
    it("dit « activé » au propriétaire", async () => {
      expect(await lireMonAbonnement(PROPRIETAIRE_ID)).toMatchObject({ activated: true });
    });

    it("dit « non activé » à un inscrit quelconque", async () => {
      expect(await lireMonAbonnement(INCONNU_ID)).toMatchObject({ activated: false });
    });

    // ⭐ Depuis le 2026-08-31, une inscription seule ne donne RIEN : ni essai,
    // ni accès. C'est le tunnel de paiement qui ouvre les deux.
    it("une inscription seule ne donne ni essai ni accès", async () => {
      expect(await lireMonAbonnement(INCONNU_ID)).toMatchObject({
        status: "none",
        is_active: false,
        activated: false,
      });
    });

    // ⭐ LE point de la migration 003, et il vaut toujours : `is_active` (payer)
    // et `activated` (être admis) sont deux questions distinctes. Si l'activation
    // se contentait de refléter l'abonnement, il suffirait d'un essai pour
    // entrer — la situation qu'on voulait quitter.
    //
    // ⚠️ L'essai est posé ICI À LA MAIN, comme le ferait le webhook Stripe.
    // L'attendre de l'inscription était vrai jusqu'au 2026-08-31 et ne l'est
    // plus : ce test a échoué pendant deux jours pour cette seule raison.
    it("n'active PAS un compte au seul motif que son essai gratuit court", async () => {
      await db.query(
        "update public.subscriptions set status = 'trialing', trial_ends_at = now() + interval '7 days' where user_id = $1",
        [INCONNU_ID],
      );
      expect(await lireMonAbonnement(INCONNU_ID)).toMatchObject({
        status: "trialing",
        is_active: true,
        activated: false,
      });
      // On remet le compte dans son état d'inscription : les tests suivants ne
      // doivent pas hériter d'un essai que personne ne leur a donné.
      await db.query(
        "update public.subscriptions set status = 'none', trial_ends_at = null where user_id = $1",
        [INCONNU_ID],
      );
    });

    it("garde l'essai et l'activation indépendants — un essai expiré n'éteint pas l'activation", async () => {
      // ⚠️ `status = 'trialing'` fait partie de la mise en place, et ce n'est pas
      // du décor : la vue ne calcule `expired` que pour un essai EN COURS
      // (`s.status = 'trialing' and s.trial_ends_at <= now()`). Sans lui, on
      // périme une date que personne ne regarde, et le test dort.
      await db.query(
        "update public.subscriptions set status = 'trialing', trial_ends_at = now() - interval '1 day' where user_id = $1",
        [PROPRIETAIRE_ID],
      );
      expect(await lireMonAbonnement(PROPRIETAIRE_ID)).toMatchObject({
        status: "expired",
        is_active: false,
        activated: true,
      });
      // On remet le compte dans son état de départ : les tests suivants ne
      // doivent pas hériter de cet état.
      await db.query(
        "update public.subscriptions set status = 'none', trial_ends_at = null where user_id = $1",
        [PROPRIETAIRE_ID],
      );
    });
  });

  describe("la table des activations", () => {
    it("ne laisse personne s'activer soi-même", async () => {
      await commeUtilisateur(INCONNU_ID, async () => {
        await expect(
          db.query("insert into public.activations (user_id) values ($1)", [INCONNU_ID]),
        ).rejects.toThrow();
      });
      expect(await lireMonAbonnement(INCONNU_ID)).toMatchObject({ activated: false });
    });

    it("ne laisse personne se désactiver les uns les autres", async () => {
      await commeUtilisateur(INCONNU_ID, async () => {
        const res = await db.query("delete from public.activations where user_id = $1", [
          PROPRIETAIRE_ID,
        ]);
        expect(res.affectedRows).toBe(0);
      });
      expect(await lireMonAbonnement(PROPRIETAIRE_ID)).toMatchObject({ activated: true });
    });

    it("ne dévoile pas la liste des invités", async () => {
      await commeUtilisateur(INCONNU_ID, async () => {
        const { rows } = await db.query("select user_id from public.activations");
        expect(rows).toHaveLength(0);
      });
    });
  });

  describe("activer un compte, comme on le fera vraiment", () => {
    it("ouvre l'app au compte visé, et à lui seul", async () => {
      // Le geste documenté en §5 de la migration, joué tel quel (service_role
      // contourne la RLS — ici, le propriétaire des tables).
      await db.query(
        `insert into public.activations (user_id, note)
         select id, 'invité — bêta' from auth.users where lower(email) = lower($1)
         on conflict (user_id) do nothing`,
        ["invite@exemple.com"],
      );

      expect(await lireMonAbonnement(INVITE_ID)).toMatchObject({ activated: true });
      expect(await lireMonAbonnement(INCONNU_ID)).toMatchObject({ activated: false });
    });

    it("se révoque, et la révocation se voit", async () => {
      await db.query("delete from public.activations where user_id = $1", [INVITE_ID]);
      expect(await lireMonAbonnement(INVITE_ID)).toMatchObject({ activated: false });
    });
  });
});
