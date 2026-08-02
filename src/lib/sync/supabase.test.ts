import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { bancSupabase, faussesDonnees, type BancSupabase } from "./supabase.testutil";

/**
 * Étape 4 — schéma Supabase et politiques d'accès.
 *
 * Deux propriétés valent qu'on les prouve plutôt qu'on les suppose :
 *   • un utilisateur ne peut RIEN voir ni écrire chez un autre ;
 *   • le serveur applique lui-même le last-write-wins, donc deux appareils qui
 *     poussent en même temps ne peuvent pas faire gagner la version périmée.
 */

const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

let banc: BancSupabase;

beforeEach(async () => {
  banc = await bancSupabase();
  await banc.creerCompte(ALICE);
  await banc.creerCompte(BOB);
});
afterEach(async () => {
  await banc.fermer();
});

/** Pousse une ligne comme le fera l'app : upsert sur la clé primaire. */
async function pousser(
  user: string,
  opts: {
    table?: string;
    row?: string;
    ts: string;
    device?: string;
    payload?: Uint8Array;
    deleted?: boolean;
  },
) {
  const { table = "tag-table", row = "tag-ligne", ts, device = "appareil-A", deleted = false } = opts;
  const payload = deleted ? null : (opts.payload ?? faussesDonnees());
  return banc.commeUtilisateur(user, () =>
    banc.db.query(
      `insert into public.sync_rows (user_id, table_tag, row_tag, client_ts, device_id, deleted, payload)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, table_tag, row_tag) do update
         set client_ts = excluded.client_ts,
             device_id = excluded.device_id,
             deleted   = excluded.deleted,
             payload   = excluded.payload`,
      [user, table, row, ts, device, deleted, payload],
    ),
  );
}

async function lire(user: string) {
  return banc.commeUtilisateur(user, () =>
    banc.db.query<{ client_ts: string; device_id: string; server_seq: number; deleted: boolean }>(
      "select client_ts, device_id, server_seq, deleted from public.sync_rows where user_id = $1",
      [user],
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────

describe("le schéma s'installe", () => {
  it("est rejouable sans rien casser", async () => {
    // Le fichier sera collé plusieurs fois dans l'éditeur SQL de Supabase au fil
    // du temps ; il doit être idempotent, comme les autres du projet.
    const { rows } = await banc.db.query<{ n: number }>(
      "select count(*)::int as n from information_schema.tables where table_name in ('sync_rows','sync_keys')",
    );
    expect(rows[0].n).toBe(2);
  });
});

describe("cloisonnement entre comptes", () => {
  it("Bob ne voit pas les lignes d'Alice", async () => {
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });
    expect((await lire(ALICE)).rows).toHaveLength(1);
    expect((await lire(BOB)).rows).toHaveLength(0);
  });

  it("Bob ne peut pas écrire une ligne AU NOM d'Alice", async () => {
    // C'est la clause `with check` qui l'interdit — `using` seule ne filtre que
    // la LECTURE. Sans elle, Bob pourrait injecter chez Alice des lignes
    // indiscernables des vraies, que l'app d'Alice appliquerait sans méfiance.
    // (Elles seraient illisibles, faute de la clé — mais elles écraseraient
    // quand même les vraies par last-write-wins.)
    await expect(
      banc.commeUtilisateur(BOB, () =>
        banc.db.query(
          `insert into public.sync_rows (user_id, table_tag, row_tag, client_ts, device_id, payload)
           values ($1, 't', 'r', '2099-01-01T00:00:00.000Z', 'appareil-de-bob', $2)`,
          [ALICE, faussesDonnees()],
        ),
      ),
    ).rejects.toThrow(/row-level security|violates/i);

    expect((await lire(ALICE)).rows).toHaveLength(0);
  });

  it("Bob ne peut ni modifier ni supprimer les lignes d'Alice", async () => {
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });

    const modifiees = await banc.commeUtilisateur(BOB, () =>
      banc.db.query("update public.sync_rows set deleted = true where user_id = $1", [ALICE]),
    );
    const supprimees = await banc.commeUtilisateur(BOB, () =>
      banc.db.query("delete from public.sync_rows where user_id = $1", [ALICE]),
    );

    expect(modifiees.affectedRows).toBe(0);
    expect(supprimees.affectedRows).toBe(0);
    expect((await lire(ALICE)).rows).toHaveLength(1);
  });

  it("Bob ne voit pas l'enveloppe de clé d'Alice", async () => {
    // C'est la ligne la plus sensible de la base : même chiffrée, elle ne doit
    // pas sortir. La laisser lisible offrirait une cible d'attaque hors ligne.
    await banc.commeUtilisateur(ALICE, () =>
      banc.db.query(
        `insert into public.sync_keys
           (user_id, kdf_memory_kib, kdf_passes, kdf_parallelism, salt_password, wrapped_password)
         values ($1, 65536, 3, 1, $2, $3)`,
        [ALICE, faussesDonnees(16), faussesDonnees(60)],
      ),
    );

    const vuParBob = await banc.commeUtilisateur(BOB, () =>
      banc.db.query("select * from public.sync_keys"),
    );
    expect(vuParBob.rows).toHaveLength(0);
  });
});

describe("last-write-wins appliqué PAR LE SERVEUR", () => {
  it("la version la plus récente gagne", async () => {
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z", device: "portable" });
    await pousser(ALICE, { ts: "2026-08-02T11:00:00.000Z", device: "bureau" });

    const { rows } = await lire(ALICE);
    expect(rows[0].client_ts).toBe("2026-08-02T11:00:00.000Z");
    expect(rows[0].device_id).toBe("bureau");
  });

  it("une version PÉRIMÉE arrivée en dernier est ignorée", async () => {
    // Le cas que le trigger existe pour couvrir : deux appareils poussent
    // presque en même temps, et c'est le dernier ARRIVÉ qui l'emporterait —
    // pas le plus récent. Les données les plus fraîches seraient perdues.
    await pousser(ALICE, { ts: "2026-08-02T11:00:00.000Z", device: "bureau" });
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z", device: "portable" });

    const { rows } = await lire(ALICE);
    expect(rows[0].client_ts).toBe("2026-08-02T11:00:00.000Z");
    expect(rows[0].device_id).toBe("bureau");
  });

  it("à horodatage identique, le départage est déterministe", async () => {
    // Deux appareils, la même milliseconde. Sans règle stable, chacun croirait
    // avoir gagné et ils divergeraient définitivement.
    const meme = "2026-08-02T10:00:00.000Z";
    await pousser(ALICE, { ts: meme, device: "appareil-B" });
    await pousser(ALICE, { ts: meme, device: "appareil-A" });
    expect((await lire(ALICE)).rows[0].device_id).toBe("appareil-B");

    // Et dans l'autre ordre d'arrivée : le vainqueur ne change pas.
    await pousser(ALICE, { row: "autre", ts: meme, device: "appareil-A" });
    await pousser(ALICE, { row: "autre", ts: meme, device: "appareil-B" });
    const { rows } = await banc.commeUtilisateur(ALICE, () =>
      banc.db.query<{ device_id: string }>(
        "select device_id from public.sync_rows where row_tag = 'autre'",
      ),
    );
    expect(rows[0].device_id).toBe("appareil-B");
  });

  it("renvoyer deux fois le même lot ne change rien", async () => {
    // L'accusé de réception peut se perdre en route ; l'app renverra. Sans
    // idempotence, chaque renvoi ferait avancer le curseur des autres appareils
    // pour rien.
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });
    const premier = (await lire(ALICE)).rows[0].server_seq;
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });
    expect((await lire(ALICE)).rows[0].server_seq).toBe(premier);
  });

  it("une pierre tombale efface le contenu mais garde la trace", async () => {
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });
    await pousser(ALICE, { ts: "2026-08-02T11:00:00.000Z", deleted: true });

    const { rows } = await banc.commeUtilisateur(ALICE, () =>
      banc.db.query<{ deleted: boolean; payload: unknown }>(
        "select deleted, payload from public.sync_rows",
      ),
    );
    expect(rows[0].deleted).toBe(true);
    expect(rows[0].payload).toBeNull();
  });

  it("une ligne vivante ne peut pas être vide", async () => {
    // Garde-fou : un blob perdu en route ne doit pas produire une ligne
    // fantôme, ni en clair ni chiffrée.
    await expect(
      banc.commeUtilisateur(ALICE, () =>
        banc.db.query(
          `insert into public.sync_rows (user_id, table_tag, row_tag, client_ts, device_id, deleted)
           values ($1, 't', 'r', '2026-08-02T10:00:00.000Z', 'a', false)`,
          [ALICE],
        ),
      ),
    ).rejects.toBeDefined();
  });
});

describe("curseur de pagination", () => {
  it("avance strictement à chaque écriture acceptée", async () => {
    // C'est ce qui permet à un appareil de demander « tout ce qui a changé
    // depuis mon dernier passage » sans jamais sauter une ligne.
    const seqs: number[] = [];
    for (let i = 0; i < 5; i++) {
      await pousser(ALICE, { row: `ligne-${i}`, ts: `2026-08-02T10:0${i}:00.000Z` });
      const { rows } = await banc.commeUtilisateur(ALICE, () =>
        banc.db.query<{ server_seq: number }>(
          "select server_seq from public.sync_rows where row_tag = $1",
          [`ligne-${i}`],
        ),
      );
      seqs.push(Number(rows[0].server_seq));
    }
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(5);
  });

  it("le client ne peut pas choisir sa place dans la file", async () => {
    // Un client qui poserait lui-même son `server_seq` pourrait soit se rendre
    // invisible aux autres appareils (valeur minuscule, qu'ils ont déjà
    // dépassée), soit les faire sauter par-dessus tout le reste (valeur énorme).
    //
    // ⚠️ Ne PAS tester avec `1` : la séquence démarre à 1, donc la valeur du
    // client et celle du serveur coïncideraient sur la toute première ligne et
    // le test ne prouverait rien. Première rédaction, corrigée.
    for (const tentative of [999999, 0]) {
      await banc.commeUtilisateur(ALICE, () =>
        banc.db.query(
          `insert into public.sync_rows (user_id, table_tag, row_tag, server_seq, client_ts, device_id, payload)
           values ($1, 't', $2, $3, '2026-08-02T10:00:00.000Z', 'a', $4)`,
          [ALICE, `ligne-${tentative}`, tentative, faussesDonnees(1)],
        ),
      );
      const { rows } = await banc.commeUtilisateur(ALICE, () =>
        banc.db.query<{ server_seq: number }>(
          "select server_seq from public.sync_rows where row_tag = $1",
          [`ligne-${tentative}`],
        ),
      );
      expect(Number(rows[0].server_seq)).not.toBe(tentative);
      expect(Number(rows[0].server_seq)).toBeLessThan(100);
    }
  });

  it("une modification remet la ligne en fin de file", async () => {
    await pousser(ALICE, { row: "a", ts: "2026-08-02T10:00:00.000Z" });
    await pousser(ALICE, { row: "b", ts: "2026-08-02T10:01:00.000Z" });
    const avant = (await lire(ALICE)).rows;

    await pousser(ALICE, { row: "a", ts: "2026-08-02T12:00:00.000Z" });
    const { rows } = await banc.commeUtilisateur(ALICE, () =>
      banc.db.query<{ row_tag: string; server_seq: number }>(
        "select row_tag, server_seq from public.sync_rows order by server_seq",
      ),
    );
    expect(rows[rows.length - 1].row_tag).toBe("a");
    expect(Number(rows[1].server_seq)).toBeGreaterThan(Math.max(...avant.map((r) => Number(r.server_seq))));
  });
});

describe("entretien", () => {
  it("purge les vieilles pierres tombales, épargne les récentes et les vivantes", async () => {
    await pousser(ALICE, { row: "vieille", ts: "2020-01-01T10:00:00.000Z", deleted: true });
    await pousser(ALICE, { row: "recente", ts: "2026-08-02T10:00:00.000Z", deleted: true });
    await pousser(ALICE, { row: "vivante", ts: "2026-08-02T10:00:00.000Z" });

    const { rows } = await banc.db.query<{ sync_purge_tombstones: number }>(
      "select public.sync_purge_tombstones()",
    );
    expect(Number(rows[0].sync_purge_tombstones)).toBe(1);

    const restantes = await banc.commeUtilisateur(ALICE, () =>
      banc.db.query<{ row_tag: string }>("select row_tag from public.sync_rows order by row_tag"),
    );
    expect(restantes.rows.map((r) => r.row_tag)).toEqual(["recente", "vivante"]);
  });

  it("supprimer un compte emporte ses données", async () => {
    // Obligation légale autant qu'hygiène : la suppression du compte Supabase
    // ne doit pas laisser des blobs orphelins et éternels.
    await pousser(ALICE, { ts: "2026-08-02T10:00:00.000Z" });
    await banc.db.query("delete from auth.users where id = $1", [ALICE]);
    const { rows } = await banc.db.query<{ n: number }>(
      "select count(*)::int as n from public.sync_rows",
    );
    expect(rows[0].n).toBe(0);
  });
});
