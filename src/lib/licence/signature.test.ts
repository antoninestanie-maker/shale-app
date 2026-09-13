import { describe, expect, it } from "vitest";

import { AUTRE_COMPTE, banc } from "./licence.testutil";
import { genererPaire, signatureValide } from "./signature";

describe("signature d'un profil — ECDSA P-256 par WebCrypto", () => {
  it("un profil signé par la clé acceptée est valide", async () => {
    const b = await banc();
    expect(await signatureValide(await b.signer(), [b.cle])).toBe(true);
  });

  it("modifier N'IMPORTE QUEL champ signé l'invalide", async () => {
    const b = await banc();
    const l = await b.signer();
    const alterations = [
      { payload: l.payload.replace("Missions", "Missionz") },
      { expires_at: "2099-01-01T00:00:00.000Z" },
      { issued_at: "2020-01-01T00:00:00.000Z" },
      { uid: AUTRE_COMPTE },
      { tier: "shale" },
      { profile_version: 2 },
    ];
    for (const a of alterations) {
      expect(await signatureValide({ ...l, ...a }, [b.cle]), JSON.stringify(a)).toBe(false);
    }
  });

  it("une AUTRE clé ne valide pas", async () => {
    const b = await banc();
    const autre = await genererPaire();
    expect(await signatureValide(await b.signer(), [autre.publique])).toBe(false);
  });

  it("rotation : valide si UNE des clés acceptées correspond", async () => {
    const b = await banc();
    const ancienne = await genererPaire();
    expect(await signatureValide(await b.signer(), [ancienne.publique, b.cle])).toBe(true);
  });

  it("signature ou clé mal formées : faux, jamais une exception", async () => {
    const b = await banc();
    const l = await b.signer();
    expect(await signatureValide({ ...l, signature: "pas du base64 !" }, [b.cle])).toBe(false);
    expect(await signatureValide({ ...l, signature: "" }, [b.cle])).toBe(false);
    expect(await signatureValide({ ...l, signature: btoa("court") }, [b.cle])).toBe(false);
    expect(await signatureValide(l, [])).toBe(false);
    expect(
      await signatureValide(l, [{ kty: "EC", crv: "P-256", x: "abc", y: "def" }]),
    ).toBe(false);
  });
});
