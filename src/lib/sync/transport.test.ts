import { afterEach, describe, expect, it, vi } from "vitest";

import { SessionExpiree } from "./http";
import { depuisHex, TransportSupabase, versHex, type ConfigSupabase } from "./transport";

/**
 * `transport.ts` ne peut pas être testé contre un vrai Supabase ici. Mais ce
 * qu'on lui reproche de ne pas savoir n'est PAS « est-ce que Supabase
 * répond ? » — c'est « est-ce que ce qu'on lui envoie a la bonne forme ? ».
 * Cette question-là est vérifiable : on remplace `fetch` et on regarde
 * l'octet près ce qui part sur le fil.
 *
 * ⚠️ Le piège que ces tests verrouillent est celui documenté dans CLAUDE.md :
 * un `bytea` envoyé en BASE64 au lieu d'hexadécimal ne provoque AUCUNE erreur.
 * Postgres le prend pour du texte, le stocke tel quel, et la corruption se
 * découvre des semaines plus tard — sur l'autre appareil, quand plus rien ne
 * permet de savoir ce qui a été écrit.
 *
 * Ce que ces tests ne prouvent PAS, et qui reste à vérifier sur le vrai
 * projet : que Supabase RÉPOND bien dans cette forme-là. C'est l'objet de
 * `tools/verifier-sync-supabase.mjs`.
 */

const vraiFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = vraiFetch;
  vi.restoreAllMocks();
});

interface Appel {
  url: string;
  methode: string;
  entetes: Record<string, string>;
  corps: string | undefined;
}

/** Enregistre les appels et rejoue des réponses fournies d'avance. */
function espion(reponses: Response[]): { appels: Appel[] } {
  const appels: Appel[] = [];
  let i = 0;
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    appels.push({
      url: String(url),
      methode: init.method ?? "GET",
      entetes: (init.headers ?? {}) as Record<string, string>,
      corps: init.body as string | undefined,
    });
    const r = reponses[i++];
    if (!r) throw new Error("appel réseau non prévu par le test");
    return r;
  }) as never;
  return { appels };
}

const json = (corps: unknown, status = 200) =>
  new Response(JSON.stringify(corps), { status, headers: { "Content-Type": "application/json" } });

function config(jeton: ConfigSupabase["jeton"]): ConfigSupabase {
  return {
    url: "https://projet.supabase.co",
    anonKey: "anon-de-test",
    jeton,
    userId: "11111111-1111-1111-1111-111111111111",
  };
}

const LIGNE = {
  table_tag: "tag-tasks",
  row_tag: "tag-ligne",
  client_ts: "2026-08-05T10:00:00.000Z",
  device_id: "appareil-a",
  deleted: false,
  payload: new Uint8Array([0x00, 0x0f, 0x48, 0xff]),
};

describe("encodage des octets", () => {
  it("est de l'hexadécimal préfixé, JAMAIS du base64", () => {
    expect(versHex(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]))).toBe("\\x48656c6c6f");
  });

  it("garde les zéros de tête : 0x0f n'est pas 0xf0 ni 0xf", () => {
    expect(versHex(new Uint8Array([0x00, 0x0f]))).toBe("\\x000f");
  });

  it("fait l'aller-retour sur des octets quelconques", () => {
    const octets = new Uint8Array(256).map((_, i) => i);
    expect(depuisHex(versHex(octets))).toEqual(octets);
  });

  it("accepte une forme sans préfixe", () => {
    expect(depuisHex("48656c6c6f")).toEqual(new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]));
  });
});

describe("envoi", () => {
  it("poste en hexadécimal, avec la fusion des doublons", async () => {
    const { appels } = espion([new Response("", { status: 201 })]);
    await new TransportSupabase(config(async () => "jeton-frais")).pousser([LIGNE]);

    expect(appels).toHaveLength(1);
    expect(appels[0].url).toBe("https://projet.supabase.co/rest/v1/sync_rows");
    expect(appels[0].methode).toBe("POST");
    // Sans `merge-duplicates`, un renvoi échouerait sur la clé primaire au lieu
    // de mettre à jour — et le renvoi est le mode NORMAL après une coupure.
    expect(appels[0].entetes.Prefer).toContain("resolution=merge-duplicates");
    expect(appels[0].entetes.Authorization).toBe("Bearer jeton-frais");
    expect(appels[0].entetes.apikey).toBe("anon-de-test");

    const corps = JSON.parse(appels[0].corps ?? "[]") as { payload: string; user_id: string }[];
    expect(corps[0].payload).toBe("\\x000f48ff");
    expect(corps[0].user_id).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("n'appelle pas le réseau pour un lot vide", async () => {
    const { appels } = espion([]);
    await new TransportSupabase(config(async () => "j")).pousser([]);
    expect(appels).toHaveLength(0);
  });

  it("envoie `payload: null` pour une pierre tombale sans charge", async () => {
    const { appels } = espion([new Response("", { status: 201 })]);
    await new TransportSupabase(config(async () => "j")).pousser([
      { ...LIGNE, deleted: true, payload: null },
    ]);
    const corps = JSON.parse(appels[0].corps ?? "[]") as { payload: null; deleted: boolean }[];
    expect(corps[0].payload).toBeNull();
    expect(corps[0].deleted).toBe(true);
  });
});

describe("réception", () => {
  it("demande les lignes APRÈS le curseur, dans l'ordre du serveur", async () => {
    const { appels } = espion([json([])]);
    await new TransportSupabase(config(async () => "j")).tirer(42, 200);

    const url = new URL(appels[0].url);
    // ⚠️ `gt` et non `gte` : `gte` renverrait éternellement la dernière ligne
    // déjà appliquée, et l'ordre est celui de l'horloge SERVEUR, jamais du
    // client — les mélanger fait rater des lignes.
    expect(url.searchParams.get("server_seq")).toBe("gt.42");
    expect(url.searchParams.get("order")).toBe("server_seq.asc");
    expect(url.searchParams.get("limit")).toBe("200");
  });

  it("décode l'hexadécimal renvoyé par PostgREST", async () => {
    const { appels } = espion([
      json([{ ...LIGNE, server_seq: 7, payload: "\\x000f48ff", payload_ref: null }]),
    ]);
    const lignes = await new TransportSupabase(config(async () => "j")).tirer(0, 200);

    expect(appels).toHaveLength(1);
    expect(lignes[0].payload).toEqual(new Uint8Array([0x00, 0x0f, 0x48, 0xff]));
    expect(lignes[0].server_seq).toBe(7);
  });

  it("laisse une pierre tombale sans charge passer sans payload", async () => {
    espion([json([{ ...LIGNE, server_seq: 8, deleted: true, payload: null, payload_ref: null }])]);
    const lignes = await new TransportSupabase(config(async () => "j")).tirer(0, 200);
    expect(lignes[0].payload).toBeNull();
    expect(lignes[0].deleted).toBe(true);
  });

  it("va chercher dans le bucket quand la charge n'est pas dans la colonne", async () => {
    const { appels } = espion([
      json([
        {
          ...LIGNE,
          server_seq: 9,
          payload: null,
          payload_ref: "11111111-1111-1111-1111-111111111111/tag-tasks/tag-ligne",
        },
      ]),
      new Response(new Uint8Array([1, 2, 3])),
    ]);
    const lignes = await new TransportSupabase(config(async () => "j")).tirer(0, 200);

    expect(appels[1].url).toBe(
      "https://projet.supabase.co/storage/v1/object/sync-blobs/" +
        "11111111-1111-1111-1111-111111111111/tag-tasks/tag-ligne",
    );
    // Le moteur ne doit connaître qu'UNE forme de ligne : le bucket est résolu
    // ici, donc le serveur simulé des tests reste une représentation fidèle.
    expect(lignes[0].payload).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("jeton expiré", () => {
  it("renouvelle et rejoue UNE fois quand le serveur répond 401", async () => {
    // Le scénario réel : app ouverte depuis plus d'une heure. Sans cette
    // reprise, chaque cycle de 90 s récoltait un 401 jusqu'au redémarrage.
    espion([json({ message: "JWT expired" }, 401), json([])]);

    const forcages: (boolean | undefined)[] = [];
    const t = new TransportSupabase(
      config(async (forcer) => {
        forcages.push(forcer);
        return forcer ? "jeton-renouvele" : "jeton-perime";
      }),
    );

    await expect(t.tirer(0, 200)).resolves.toEqual([]);
    expect(forcages).toEqual([undefined, true]);
  });

  it("ne boucle pas : un second 401 remonte", async () => {
    // Si le jeton renouvelé est refusé lui aussi, l'expiration n'était pas la
    // cause. Insister ne ferait que marteler GoTrue.
    espion([json({}, 401), json({}, 401)]);
    const t = new TransportSupabase(config(async () => "jeton"));
    await expect(t.tirer(0, 200)).rejects.toBeInstanceOf(SessionExpiree);
  });

  it("ne renouvelle pas pour une erreur qui n'est pas une expiration", async () => {
    espion([json({ message: "does not exist" }, 404)]);
    let appelsJeton = 0;
    const t = new TransportSupabase(
      config(async () => {
        appelsJeton++;
        return "jeton";
      }),
    );
    await expect(t.tirer(0, 200)).rejects.toThrow();
    expect(appelsJeton).toBe(1);
  });
});
