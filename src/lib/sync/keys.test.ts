import { beforeEach, describe, expect, it } from "vitest";

import { chiffrerLigne, dechiffrerLigne, PARAMS_KDF, type MetadonneesLigne } from "./crypto";
import {
  activer,
  changerMotDePasse,
  CleAbsente,
  ouvrirAvecCode,
  ouvrirAvecMotDePasse,
  poserCodeRecuperation,
  RecuperationAbsente,
  retirerCodeRecuperation,
  SecretInvalide,
  VersionInconnue,
  type Derivation,
  type DepotEnveloppes,
  type Enveloppes,
} from "./keys";
import { genererCode } from "./recovery";

/**
 * Étape 6 — cycle de vie de la clé de données.
 *
 * La dérivation Argon2id est REMPLACÉE par une version rapide : elle est testée
 * pour elle-même côté Rust (`cargo test --lib crypto`), et la faire tourner ici
 * coûterait 150 ms par appel, soit des dizaines de secondes sur ces tests. Ce
 * qui est éprouvé ici, c'est la MÉCANIQUE des enveloppes — laquelle est
 * indifférente à la fonction employée, pourvu qu'elle soit déterministe.
 */

const USER = "11111111-1111-4111-8111-111111111111";

/** Dérivation déterministe et rapide, du même « genre » qu'Argon2id. */
const deriverVite: Derivation = async (secret, sel) => {
  const enc = new TextEncoder();
  const mere = await crypto.subtle.importKey("raw", enc.encode(secret), "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: sel as BufferSource, info: enc.encode("essai") },
    mere,
    256,
  );
  return new Uint8Array(bits);
};

/** Dépôt en mémoire, à la place de Supabase. */
class DepotMemoire implements DepotEnveloppes {
  contenu: Enveloppes | null = null;
  ecritures = 0;
  async lire() {
    return this.contenu;
  }
  async ecrire(e: Enveloppes) {
    this.ecritures++;
    this.contenu = { ...e };
  }
}

let depot: DepotMemoire;
beforeEach(() => {
  depot = new DepotMemoire();
});

const META: MetadonneesLigne = {
  userId: USER,
  table: "tag-table",
  uid: "tag-ligne",
  ts: "2026-08-03T10:00:00.000Z",
};

// ─────────────────────────────────────────────────────────────────────────────

describe("activation", () => {
  it("scelle une clé neuve et rend un code de récupération", async () => {
    const { dek, codeRecuperation } = await activer(depot, deriverVite, USER, "mot de passe", genererCode());
    expect(dek).toHaveLength(32);
    expect(codeRecuperation).toMatch(/^SHALE-/);
    expect(depot.contenu?.wrapped_password.length).toBeGreaterThan(32);
    expect(depot.contenu?.wrapped_recovery).not.toBeNull();
  });

  it("n'écrit JAMAIS la clé de données en clair chez le dépôt", async () => {
    // La vérification la plus élémentaire, et celle dont l'échec serait le plus
    // grave : le serveur ne doit jamais voir la clé.
    const { dek } = await activer(depot, deriverVite, USER, "mot de passe", genererCode());
    const stocke = [
      ...depot.contenu!.wrapped_password,
      ...depot.contenu!.salt_password,
      ...(depot.contenu!.wrapped_recovery ?? []),
    ].join(",");
    expect(stocke).not.toContain([...dek].join(","));
  });

  it("mémorise les paramètres de dérivation employés", async () => {
    // Sans eux, durcir les réglages un jour rendrait illisible tout l'existant.
    await activer(depot, deriverVite, USER, "x", genererCode());
    expect(depot.contenu).toMatchObject({
      kdf: "argon2id",
      kdf_memory_kib: PARAMS_KDF.memoireKio,
      kdf_passes: PARAMS_KDF.passes,
    });
  });

  it("peut se passer de chemin de récupération", async () => {
    const { codeRecuperation } = await activer(depot, deriverVite, USER, "x", null);
    expect(codeRecuperation).toBeNull();
    expect(depot.contenu?.wrapped_recovery).toBeNull();
    expect(depot.contenu?.salt_recovery).toBeNull();
  });

  it("deux comptes n'obtiennent jamais la même clé", async () => {
    const a = await activer(new DepotMemoire(), deriverVite, USER, "identique", genererCode());
    const b = await activer(new DepotMemoire(), deriverVite, USER, "identique", genererCode());
    expect([...a.dek].join()).not.toBe([...b.dek].join());
  });
});

describe("ouverture", () => {
  it("le mot de passe rouvre exactement la même clé", async () => {
    const { dek } = await activer(depot, deriverVite, USER, "correct horse", genererCode());
    const rouvert = await ouvrirAvecMotDePasse(depot, deriverVite, USER, "correct horse");
    expect(rouvert.dek).toEqual(dek);
  });

  it("le code de récupération rouvre LA MÊME clé, pas une copie", async () => {
    // Le point central du modèle : les deux chemins mènent à la même clé, donc
    // aux mêmes données. Un second jeu de clés ne servirait à rien.
    const { dek, codeRecuperation } = await activer(depot, deriverVite, USER, "mdp", genererCode());
    const parCode = await ouvrirAvecCode(depot, deriverVite, USER, codeRecuperation!);
    expect(parCode.dek).toEqual(dek);
  });

  it("le code s'accepte tel qu'on le recopie, à la main", async () => {
    const { codeRecuperation } = await activer(depot, deriverVite, USER, "mdp", genererCode());
    const maladroit = codeRecuperation!.toLowerCase().replace(/-/g, " ");
    await expect(ouvrirAvecCode(depot, deriverVite, USER, maladroit)).resolves.toBeDefined();
  });

  it("un mauvais mot de passe échoue clairement", async () => {
    await activer(depot, deriverVite, USER, "le bon", genererCode());
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, USER, "le mauvais")).rejects.toThrow(
      SecretInvalide,
    );
  });

  it("un code mal recopié échoue AVANT la dérivation", async () => {
    // La somme de contrôle évite de faire patienter 150 ms pour annoncer un
    // échec indistinct d'un vrai mauvais code.
    await activer(depot, deriverVite, USER, "mdp", genererCode());
    let appels = 0;
    const compte: Derivation = async (...args) => {
      appels++;
      return deriverVite(...args);
    };
    await expect(ouvrirAvecCode(depot, compte, USER, "SHALE-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA")).rejects.toThrow(
      SecretInvalide,
    );
    expect(appels).toBe(0);
  });

  it("la clé d'un compte n'ouvre pas celle d'un autre", async () => {
    await activer(depot, deriverVite, USER, "mdp", genererCode());
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, "autre-compte", "mdp")).rejects.toThrow(
      SecretInvalide,
    );
  });

  it("signale l'absence de clé plutôt que d'échouer obscurément", async () => {
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, USER, "mdp")).rejects.toThrow(CleAbsente);
  });

  it("signale l'absence de chemin de récupération", async () => {
    await activer(depot, deriverVite, USER, "mdp", null);
    await expect(ouvrirAvecCode(depot, deriverVite, USER, "SHALE-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA-AAAA")).rejects.toThrow(
      RecuperationAbsente,
    );
  });

  it("refuse une enveloppe écrite par une version plus récente", async () => {
    await activer(depot, deriverVite, USER, "mdp", genererCode());
    depot.contenu!.key_version = 99;
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, USER, "mdp")).rejects.toThrow(VersionInconnue);
  });
});

describe("changement de mot de passe", () => {
  it("les données restent lisibles APRÈS le changement", async () => {
    // Le scénario qui justifie toute l'architecture à double enveloppe.
    const { dek, cles } = await activer(depot, deriverVite, USER, "ancien", genererCode());
    const blob = await chiffrerLigne(cles.cleLignes, { note: "écrite il y a deux ans" }, META);

    await changerMotDePasse(depot, deriverVite, USER, dek, "nouveau");

    const rouvert = await ouvrirAvecMotDePasse(depot, deriverVite, USER, "nouveau");
    expect(await dechiffrerLigne(rouvert.cles.cleLignes, blob, META)).toEqual({
      note: "écrite il y a deux ans",
    });
  });

  it("l'ancien mot de passe cesse de fonctionner", async () => {
    const { dek } = await activer(depot, deriverVite, USER, "ancien", genererCode());
    await changerMotDePasse(depot, deriverVite, USER, dek, "nouveau");
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, USER, "ancien")).rejects.toThrow(SecretInvalide);
  });

  it("le code de récupération, lui, continue de fonctionner", async () => {
    // Volontaire : un changement de mot de passe ne doit pas invalider en
    // silence le papier rangé dans un tiroir.
    const { dek, codeRecuperation } = await activer(depot, deriverVite, USER, "ancien", genererCode());
    await changerMotDePasse(depot, deriverVite, USER, dek, "nouveau");
    const parCode = await ouvrirAvecCode(depot, deriverVite, USER, codeRecuperation!);
    expect(parCode.dek).toEqual(dek);
  });

  it("emploie un sel NEUF", async () => {
    const { dek } = await activer(depot, deriverVite, USER, "ancien", genererCode());
    const selAvant = [...depot.contenu!.salt_password].join();
    await changerMotDePasse(depot, deriverVite, USER, dek, "nouveau");
    expect([...depot.contenu!.salt_password].join()).not.toBe(selAvant);
  });

  it("ne re-chiffre RIEN d'autre que l'enveloppe", async () => {
    // Re-chiffrer les données exigerait de toutes les rapatrier : impensable, et
    // catastrophique si le réseau lâche au milieu.
    const { dek } = await activer(depot, deriverVite, USER, "ancien", genererCode());
    const ecrituresAvant = depot.ecritures;
    await changerMotDePasse(depot, deriverVite, USER, dek, "nouveau");
    expect(depot.ecritures).toBe(ecrituresAvant + 1);
  });
});

describe("gestion du code de récupération", () => {
  it("peut être posé après coup", async () => {
    const { dek } = await activer(depot, deriverVite, USER, "mdp", null);
    const code = await poserCodeRecuperation(depot, deriverVite, USER, dek);
    const parCode = await ouvrirAvecCode(depot, deriverVite, USER, code);
    expect(parCode.dek).toEqual(dek);
  });

  it("peut être remplacé — l'ancien cesse alors de fonctionner", async () => {
    const { dek, codeRecuperation } = await activer(depot, deriverVite, USER, "mdp", genererCode());
    const nouveau = await poserCodeRecuperation(depot, deriverVite, USER, dek);

    expect(nouveau).not.toBe(codeRecuperation);
    await expect(ouvrirAvecCode(depot, deriverVite, USER, nouveau)).resolves.toBeDefined();
    await expect(ouvrirAvecCode(depot, deriverVite, USER, codeRecuperation!)).rejects.toThrow(
      SecretInvalide,
    );
  });

  it("peut être retiré, sans toucher au mot de passe", async () => {
    const { dek, codeRecuperation } = await activer(depot, deriverVite, USER, "mdp", genererCode());
    await retirerCodeRecuperation(depot);

    await expect(ouvrirAvecCode(depot, deriverVite, USER, codeRecuperation!)).rejects.toThrow(
      RecuperationAbsente,
    );
    await expect(ouvrirAvecMotDePasse(depot, deriverVite, USER, "mdp")).resolves.toMatchObject({ dek });
  });
});
