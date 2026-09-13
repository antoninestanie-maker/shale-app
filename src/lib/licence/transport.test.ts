// Téléchargement, cache, et les deux scénarios réseau de la phase E.
import { describe, expect, it } from "vitest";

import { COMPTE, JOUR, MAINTENANT, banc } from "./licence.testutil";
import { resoudreProfil } from "./resoudre";
import { signatureValide, type LigneProfil } from "./signature";
import {
  decisionApresTelechargement,
  telechargerProfil,
  type ReponseProfil,
} from "./transport";

const reponse = (statut: number, corps: unknown): typeof fetch =>
  (async () => new Response(JSON.stringify(corps), { status: statut })) as typeof fetch;

const versServeur = (l: LigneProfil) => ({
  user_id: l.uid,
  tier: l.tier,
  profile_version: l.profile_version,
  issued_at: l.issued_at,
  expires_at: l.expires_at,
  payload: l.payload,
  signature: l.signature,
});

describe("telechargerProfil — trois réponses, une seule efface", () => {
  it("une ligne → profil, champs exacts", async () => {
    const b = await banc();
    const l = await b.signer();
    const r = await telechargerProfil("jeton", COMPTE, reponse(200, [versServeur(l)]));
    expect(r).toEqual({ type: "profil", ligne: l });
  });

  it("aucune ligne → aucun", async () => {
    expect(await telechargerProfil("jeton", COMPTE, reponse(200, []))).toEqual({ type: "aucun" });
  });

  it("table absente, session expirée, serveur en panne → inconnu", async () => {
    for (const s of [404, 401, 500, 503])
      expect(await telechargerProfil("jeton", COMPTE, reponse(s, { message: "x" }))).toEqual({
        type: "inconnu",
      });
  });

  it("réseau coupé → inconnu, jamais une exception", async () => {
    const coupe = (async () => {
      throw new TypeError("Failed to fetch");
    }) as typeof fetch;
    expect(await telechargerProfil("jeton", COMPTE, coupe)).toEqual({ type: "inconnu" });
  });

  it("réponse mal formée → inconnu", async () => {
    expect(await telechargerProfil("jeton", COMPTE, reponse(200, { pas: "un tableau" }))).toEqual({
      type: "inconnu",
    });
    expect(
      await telechargerProfil("jeton", COMPTE, reponse(200, [{ user_id: COMPTE, profile_version: "1" }])),
    ).toEqual({ type: "inconnu" });
  });

  it("sans jeton (hors ligne toléré), on ne tente même pas", async () => {
    let appele = false;
    const espion = (async () => {
      appele = true;
      return new Response("[]");
    }) as typeof fetch;
    expect(await telechargerProfil("", COMPTE, espion)).toEqual({ type: "inconnu" });
    expect(appele).toBe(false);
  });
});

describe("decisionApresTelechargement", () => {
  it("inconnu → garder ; aucun → effacer ; profil bien signé → remplacer", async () => {
    const b = await banc();
    const l = await b.signer();
    expect(decisionApresTelechargement({ type: "inconnu" }, false, COMPTE)).toEqual({ action: "garder" });
    expect(decisionApresTelechargement({ type: "aucun" }, false, COMPTE)).toEqual({ action: "effacer" });
    expect(decisionApresTelechargement({ type: "profil", ligne: l }, true, COMPTE)).toEqual({
      action: "remplacer",
      ligne: l,
    });
  });

  it("un profil MAL SIGNÉ ne remplace pas le cache ; celui d'un autre compte non plus", async () => {
    const b = await banc();
    const l = await b.signer();
    expect(decisionApresTelechargement({ type: "profil", ligne: l }, false, COMPTE)).toEqual({
      action: "garder",
    });
    expect(
      decisionApresTelechargement({ type: "profil", ligne: { ...l, uid: "autre" } }, true, COMPTE),
    ).toEqual({ action: "garder" });
  });
});

/** Rejoue le cycle de `ProfilProvider` sans React : cache → réseau → résolution. */
async function cycle(
  cache: LigneProfil | null,
  r: ReponseProfil,
  cles: Parameters<typeof signatureValide>[1],
  maintenant: number,
) {
  const ok = r.type === "profil" ? await signatureValide(r.ligne, cles) : false;
  const d = decisionApresTelechargement(r, ok, COMPTE);
  const ligne = d.action === "remplacer" ? d.ligne : d.action === "effacer" ? null : cache;
  return resoudreProfil({
    ligne,
    signatureOk: ligne ? await signatureValide(ligne, cles) : false,
    userId: COMPTE,
    tier: "shale_trade",
    maintenant,
  });
}

describe("scénarios réseau", () => {
  it("passage hors ligne pendant la validité : le cache continue de s'appliquer", async () => {
    const b = await banc();
    const cache = await b.signer();
    const p = await cycle(cache, { type: "inconnu" }, [b.cle], MAINTENANT + 30 * JOUR);
    expect(p.actif).toBe(true);
    expect(p.masques.has("trading")).toBe(true);
  });

  it("hors ligne AU-DELÀ de l'expiration : palier nu, sans erreur", async () => {
    const b = await banc();
    const cache = await b.signer({ expires_at: new Date(MAINTENANT + 5 * JOUR).toISOString() });
    const p = await cycle(cache, { type: "inconnu" }, [b.cle], MAINTENANT + 6 * JOUR);
    expect(p).toMatchObject({ actif: false, motif: "expire" });
  });

  it("retour en ligne après expiration, profil renouvelé : il reprend", async () => {
    const b = await banc();
    const perime = await b.signer({ expires_at: new Date(MAINTENANT - JOUR).toISOString() });
    const renouvele = await b.signer({
      profile_version: 2,
      issued_at: new Date(MAINTENANT).toISOString(),
      expires_at: new Date(MAINTENANT + 365 * JOUR).toISOString(),
    });
    expect((await cycle(perime, { type: "inconnu" }, [b.cle], MAINTENANT)).actif).toBe(false);
    const p = await cycle(perime, { type: "profil", ligne: renouvele }, [b.cle], MAINTENANT);
    expect(p).toMatchObject({ actif: true, version: 2 });
  });

  it("retour en ligne après expiration, contrat terminé : cache effacé, palier nu", async () => {
    const b = await banc();
    const perime = await b.signer({ expires_at: new Date(MAINTENANT - JOUR).toISOString() });
    const p = await cycle(perime, { type: "aucun" }, [b.cle], MAINTENANT);
    expect(p).toMatchObject({ actif: false, motif: "absent" });
  });

  it("retrait du profil pendant la validité : il cesse au premier téléchargement", async () => {
    const b = await banc();
    const cache = await b.signer();
    expect((await cycle(cache, { type: "aucun" }, [b.cle], MAINTENANT)).actif).toBe(false);
  });
});
