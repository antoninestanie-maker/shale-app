import { describe, expect, it } from "vitest";

/**
 * Préflight de l'étape 0 — vérifie que les primitives sur lesquelles repose
 * TOUTE la couche de chiffrement (étape 3) se comportent comme attendu dans cet
 * environnement, AVANT d'écrire quoi que ce soit qui en dépende.
 *
 * Ce n'est pas un test de fumée décoratif : les trois propriétés contrôlées ici
 * sont exactement celles qui font tenir le modèle E2E.
 *   1. AES-256-GCM est disponible via WebCrypto (donc pas de dépendance à
 *      ajouter, et le même code tournera dans WKWebView, contexte sécurisé).
 *   2. Les données additionnelles authentifiées (AAD) sont réellement vérifiées :
 *      c'est ce qui interdit à un serveur hostile de recoller le blob d'une
 *      ligne sur une autre (l'AAD portera `user_id|table|uid|ts`).
 *   3. Le déchiffrement ÉCHOUE bruyamment sur altération — il ne renvoie jamais
 *      un clair silencieusement faux.
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

async function freshKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

describe("préflight crypto (socle de la sync chiffrée)", () => {
  it("chiffre et déchiffre un aller-retour avec AAD", async () => {
    const key = await freshKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = enc.encode("user-1|notes|01930f0a-uid|1754160000000");
    const clair = "Corps de note accentué — ligne 1\nligne 2";

    const chiffre = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      enc.encode(clair),
    );
    const rendu = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      chiffre,
    );

    expect(dec.decode(rendu)).toBe(clair);
    // Le chiffré porte les 16 octets du tag d'authentification GCM.
    expect(chiffre.byteLength).toBe(enc.encode(clair).byteLength + 16);
  });

  it("refuse de déchiffrer si l'AAD a été falsifiée", async () => {
    const key = await freshKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const chiffre = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: enc.encode("user-1|notes|uid-A|100") },
      key,
      enc.encode("secret"),
    );

    // Même clé, même nonce, mais le serveur prétend que ce blob appartient à
    // une AUTRE ligne : le déchiffrement doit échouer, pas produire du clair.
    await expect(
      crypto.subtle.decrypt(
        { name: "AES-GCM", iv, additionalData: enc.encode("user-1|notes|uid-B|100") },
        key,
        chiffre,
      ),
    ).rejects.toThrow();
  });

  it("refuse de déchiffrer un blob altéré d'un seul bit", async () => {
    const key = await freshKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = enc.encode("user-1|trades|uid-A|100");
    const chiffre = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, enc.encode("+2.5R")),
    );

    chiffre[0] ^= 0x01;

    await expect(
      crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, chiffre),
    ).rejects.toThrow();
  });

  it("dispose d'un générateur aléatoire cryptographique pour les nonces", () => {
    // Deux tirages de 12 octets ne doivent jamais coïncider : un nonce GCM
    // réutilisé sous la même clé casse la confidentialité ET l'authenticité.
    const a = crypto.getRandomValues(new Uint8Array(12));
    const b = crypto.getRandomValues(new Uint8Array(12));
    expect(a.join()).not.toBe(b.join());
    expect(a.some((o) => o !== 0)).toBe(true);
  });
});
