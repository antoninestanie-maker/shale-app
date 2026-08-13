import { PGlite } from "@electric-sql/pglite";

import schemaSync from "../../../../shale-site/supabase/sync.sql?raw";

/**
 * Postgres réel (compilé en WebAssembly) pour valider le schéma Supabase.
 *
 * Motif : cette machine n'a ni Postgres, ni Docker, ni la CLI Supabase. Le SQL
 * de `sync.sql` serait donc parti en production sans avoir jamais été exécuté —
 * alors que c'est lui qui porte la règle du last-write-wins côté serveur, et
 * les politiques qui empêchent un client de lire les données d'un autre. Ce
 * sont exactement les deux choses qu'on ne peut pas se permettre de supposer.
 *
 * Le fichier est lu DEPUIS L'AUTRE DÉPÔT, pas recopié : une copie finirait par
 * diverger, et on validerait alors une version qui n'est pas celle exécutée.
 *
 * ─── CE QUE CE BANC NE COUVRE PAS ──────────────────────────────────────────
 * Les briques propres à Supabase sont simulées ci-dessous (`auth.uid()`,
 * `storage.*`, les rôles). Leur COMPORTEMENT est reproduit fidèlement, mais ce
 * ne sont pas les vraies. Restent donc à vérifier sur le projet réel : les
 * politiques du bucket, et le fait que PostgREST expose bien ce qu'on attend.
 */

/**
 * Reconstitue le strict nécessaire de l'environnement Supabase.
 *
 * `auth.uid()` est écrit comme le vrai : il lit le `sub` du JWT déposé dans le
 * réglage de session `request.jwt.claims`. C'est ce qui permet de tester les
 * politiques pour de bon, en se faisant passer pour un utilisateur donné,
 * plutôt que de se contenter de vérifier qu'elles existent.
 */
const AMORCE = `
create role anon;
create role authenticated;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text,
  name      text
);
alter table storage.objects enable row level security;

-- Fidèle au vrai : renvoie les segments du chemin SANS le nom de fichier final.
create function storage.foldername(name text) returns text[] language plpgsql immutable as $$
declare parties text[];
begin
  parties := string_to_array(name, '/');
  return parties[1:array_length(parties, 1) - 1];
end;
$$;

grant usage on schema auth, storage to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
`;

export interface BancSupabase {
  db: PGlite;
  /** Exécute en se faisant passer pour cet utilisateur (politiques appliquées). */
  commeUtilisateur<T>(userId: string, requete: () => Promise<T>): Promise<T>;
  /** Crée un compte et renvoie son identifiant. */
  creerCompte(userId: string): Promise<void>;
  fermer(): Promise<void>;
}

export async function bancSupabase(): Promise<BancSupabase> {
  const db = new PGlite();
  await db.exec(AMORCE);
  await db.exec(schemaSync);

  return {
    db,

    async creerCompte(userId: string) {
      await db.query("insert into auth.users (id) values ($1)", [userId]);
    },

    async commeUtilisateur<T>(userId: string, requete: () => Promise<T>): Promise<T> {
      // `set role` fait retomber les politiques : le propriétaire des tables
      // (superutilisateur) les contournerait, ce qui rendrait le test creux.
      await db.exec(`set request.jwt.claims = '{"sub":"${userId}"}';`);
      await db.exec("set role authenticated;");
      try {
        return await requete();
      } finally {
        await db.exec("reset role;");
        await db.exec("reset request.jwt.claims;");
      }
    },

    async fermer() {
      await db.close();
    },
  };
}

/**
 * Charge utile factice.
 *
 * ⚠️ On passe des OCTETS BRUTS, pas la forme hexadécimale `\x…`. Cette dernière
 * est le format de PostgREST, c'est-à-dire du transport HTTP ; PGlite parle le
 * protocole binaire de Postgres et refuse la chaîne. Les deux formes coexistent
 * donc légitimement dans le projet — c'est l'étape 5 (le client HTTP) qui aura
 * à produire l'hexadécimal, pas ce banc d'essai.
 */
export function faussesDonnees(taille = 3): Uint8Array {
  return Uint8Array.from({ length: taille }, (_, i) => (i * 37 + 11) % 256);
}
