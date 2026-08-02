import { describe, expect, it } from "vitest";

import {
  aveugler,
  chiffrerLigne,
  dechiffrerLigne,
  deballerDek,
  deriverSousCles,
  emballerDek,
  genererDek,
  genererSel,
  octetsAleatoires,
  versBase64,
  depuisBase64,
  type MetadonneesLigne,
} from "./crypto";

/**
 * Étape 3 — couche de chiffrement.
 *
 * C'est l'étape où une erreur coûte le plus cher : un bogue ici ne se voit pas,
 * il rend simplement les données illisibles — parfois des mois plus tard.
 * D'où le poids de ces tests, en particulier ceux qui vérifient que les choses
 * ÉCHOUENT quand elles le doivent.
 */

const USER = "3f0c9a2e-user";
const META: MetadonneesLigne = {
  userId: USER,
  table: "dGFibGUtYXZldWdsZWU",
  uid: "dWlkLWF2ZXVnbGU",
  ts: "2026-08-02T20:44:33.123Z",
};

async function clesNeuves() {
  return deriverSousCles(genererDek());
}

// ─────────────────────────────────────────────────────────────────────────────

describe("enveloppes de la clé de données", () => {
  it("le mot de passe rouvre la clé qu'il a scellée", async () => {
    const dek = genererDek();
    const kek = octetsAleatoires(32);
    const enveloppe = await emballerDek(dek, kek, USER, "password");
    expect(await deballerDek(enveloppe, kek, USER, "password")).toEqual(dek);
  });

  it("DEUX chemins ouvrent LA MÊME clé", async () => {
    // C'est tout l'intérêt du modèle : la phrase de récupération n'ouvre pas
    // une copie des données, elle ouvre la clé elle-même.
    const dek = genererDek();
    const kekMdp = octetsAleatoires(32);
    const kekRec = octetsAleatoires(32);

    const parMdp = await emballerDek(dek, kekMdp, USER, "password");
    const parRec = await emballerDek(dek, kekRec, USER, "recovery");

    expect(await deballerDek(parMdp, kekMdp, USER, "password")).toEqual(dek);
    expect(await deballerDek(parRec, kekRec, USER, "recovery")).toEqual(dek);
  });

  it("changer de mot de passe ne touche pas aux données", async () => {
    // Le scénario qui justifie la double enveloppe : on re-scelle quelques
    // dizaines d'octets, et TOUT l'historique reste lisible.
    const dek = genererDek();
    const { cleLignes } = await deriverSousCles(dek);
    const blob = await chiffrerLigne(cleLignes, { titre: "note d'il y a deux ans" }, META);

    const ancienneKek = octetsAleatoires(32);
    await emballerDek(dek, ancienneKek, USER, "password");

    const nouvelleKek = octetsAleatoires(32);
    const reScellee = await emballerDek(dek, nouvelleKek, USER, "password");

    const dekRetrouvee = await deballerDek(reScellee, nouvelleKek, USER, "password");
    const { cleLignes: cleApres } = await deriverSousCles(dekRetrouvee);
    expect(await dechiffrerLigne(cleApres, blob, META)).toEqual({ titre: "note d'il y a deux ans" });
  });

  it("un mauvais mot de passe ÉCHOUE au lieu de rendre une clé approximative", async () => {
    // Sans authentification, une KEK fausse donnerait 32 octets quelconques,
    // qui déchiffreraient ensuite tout en bouillie — sans erreur nulle part.
    const enveloppe = await emballerDek(genererDek(), octetsAleatoires(32), USER, "password");
    await expect(deballerDek(enveloppe, octetsAleatoires(32), USER, "password")).rejects.toThrow();
  });

  it("l'enveloppe de récupération ne peut pas être présentée comme celle du mot de passe", async () => {
    const dek = genererDek();
    const kek = octetsAleatoires(32);
    const enveloppe = await emballerDek(dek, kek, USER, "recovery");
    await expect(deballerDek(enveloppe, kek, USER, "password")).rejects.toThrow();
  });

  it("l'enveloppe d'un compte ne s'ouvre pas sur un autre compte", async () => {
    const kek = octetsAleatoires(32);
    const enveloppe = await emballerDek(genererDek(), kek, USER, "password");
    await expect(deballerDek(enveloppe, kek, "autre-utilisateur", "password")).rejects.toThrow();
  });

  it("une enveloppe altérée est rejetée", async () => {
    const kek = octetsAleatoires(32);
    const enveloppe = await emballerDek(genererDek(), kek, USER, "password");
    for (const position of [0, 5, 20, enveloppe.length - 1]) {
      const abimee = Uint8Array.from(enveloppe);
      abimee[position] ^= 0x01;
      await expect(deballerDek(abimee, kek, USER, "password")).rejects.toThrow();
    }
  });
});

describe("chiffrement des lignes", () => {
  it("aller-retour sur des données réalistes", async () => {
    const { cleLignes } = await clesNeuves();
    const trade = {
      date: "2026-08-02",
      instrument: "XAU/USD",
      direction: "long",
      setup: "Silver Bullet — retour sur FVG H1",
      result_r: 2.5,
      notes: "Entrée à la réouverture ; accentué : préférée, ça, où. Émoji : 📈",
    };
    const blob = await chiffrerLigne(cleLignes, trade, META);
    expect(await dechiffrerLigne(cleLignes, blob, META)).toEqual(trade);
  });

  it("le clair n'apparaît nulle part dans le blob", async () => {
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { secret: "SILVERBULLET" }, META);
    expect(new TextDecoder().decode(blob)).not.toContain("SILVERBULLET");
  });

  it("deux chiffrements du MÊME contenu donnent deux blobs différents", async () => {
    // Sinon le serveur verrait que deux lignes ont le même contenu, ou qu'une
    // ligne est revenue à un état antérieur.
    const { cleLignes } = await clesNeuves();
    const a = await chiffrerLigne(cleLignes, { x: 1 }, META);
    const b = await chiffrerLigne(cleLignes, { x: 1 }, META);
    expect(versBase64(a)).not.toBe(versBase64(b));
  });

  it("REFUSE un blob recollé sur une autre ligne", async () => {
    // L'attaque que l'AAD existe pour empêcher : un serveur hostile déplace le
    // contenu d'une ligne vers une autre. Sans AAD, le déchiffrement réussirait
    // et l'app afficherait des données fausses en toute confiance.
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { montant: 1000 }, META);
    await expect(dechiffrerLigne(cleLignes, blob, { ...META, uid: "une-autre-ligne" })).rejects.toThrow();
  });

  it("REFUSE un blob dont l'horodatage a été rejoué", async () => {
    // Variante : réécrire `ts` pour faire gagner une vieille version au LWW.
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { v: "ancienne" }, META);
    await expect(
      dechiffrerLigne(cleLignes, blob, { ...META, ts: "2099-01-01T00:00:00.000Z" }),
    ).rejects.toThrow();
  });

  it("REFUSE un blob venu d'un autre compte ou d'une autre table", async () => {
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { x: 1 }, META);
    await expect(dechiffrerLigne(cleLignes, blob, { ...META, userId: "voisin" })).rejects.toThrow();
    await expect(dechiffrerLigne(cleLignes, blob, { ...META, table: "autre" })).rejects.toThrow();
  });

  it("REFUSE un blob altéré d'un seul bit", async () => {
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { x: "intact" }, META);
    const abime = Uint8Array.from(blob);
    abime[abime.length - 3] ^= 0x02;
    await expect(dechiffrerLigne(cleLignes, abime, META)).rejects.toThrow();
  });

  it("une autre clé ne lit rien", async () => {
    const { cleLignes } = await clesNeuves();
    const { cleLignes: etrangere } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { x: 1 }, META);
    await expect(dechiffrerLigne(etrangere, blob, META)).rejects.toThrow();
  });

  it("comprime ce qui se comprime, sans jamais grossir", async () => {
    const { cleLignes } = await clesNeuves();

    // Une note verbeuse : gzip doit faire gagner beaucoup.
    const verbeuse = { body: "<p>plan de trading</p>".repeat(500) };
    const brut = new TextEncoder().encode(JSON.stringify(verbeuse)).length;
    const blob = await chiffrerLigne(cleLignes, verbeuse, META);
    expect(blob.length).toBeLessThan(brut / 4);
    expect(await dechiffrerLigne(cleLignes, blob, META)).toEqual(verbeuse);

    // De l'aléatoire en base64 (cas d'une image déjà compressée dans une fiche
    // du Savoir) : gzip ne peut rien, et ne doit pas ajouter de poids.
    const image = { media: versBase64(octetsAleatoires(4096)) };
    const brutImage = new TextEncoder().encode(JSON.stringify(image)).length;
    const blobImage = await chiffrerLigne(cleLignes, image, META);
    expect(blobImage.length).toBeLessThan(brutImage + 64);
    expect(await dechiffrerLigne(cleLignes, blobImage, META)).toEqual(image);
  });

  it("supporte une fiche du Savoir de plusieurs centaines de ko", async () => {
    const { cleLignes } = await clesNeuves();
    // 300 ko de remplissage incompressible, assemblés par blocs : les octets
    // cryptographiques sont plafonnés à 65 536 par appel, et de toute façon
    // il ne s'agit ici que de simuler une image, pas de produire un secret.
    const gros = new Uint8Array(300 * 1024);
    for (let i = 0; i < gros.length; i += 65536) gros.set(octetsAleatoires(Math.min(65536, gros.length - i)), i);
    const fiche = {
      title: "Fiche illustrée",
      body: `<figure><img src="data:image/webp;base64,${versBase64(gros)}"></figure>`,
    };
    const blob = await chiffrerLigne(cleLignes, fiche, META);
    expect(await dechiffrerLigne(cleLignes, blob, META)).toEqual(fiche);
  });

  it("rejette un blob tronqué au lieu de partir dans le décor", async () => {
    const { cleLignes } = await clesNeuves();
    const blob = await chiffrerLigne(cleLignes, { x: 1 }, META);
    await expect(dechiffrerLigne(cleLignes, blob.subarray(0, 8), META)).rejects.toThrow();
  });
});

describe("aveuglement des identifiants", () => {
  it("est déterministe — deux appareils reconnaissent la même ligne", async () => {
    // Propriété indispensable : sans elle, chaque appareil créerait sa propre
    // version de chaque ligne côté serveur, et rien ne convergerait.
    const dek = genererDek();
    const a = await deriverSousCles(dek);
    const b = await deriverSousCles(dek);
    expect(await aveugler(a.cleUid, "uid", "tg:silver-bullet")).toBe(
      await aveugler(b.cleUid, "uid", "tg:silver-bullet"),
    );
  });

  it("ne laisse rien deviner du contenu", async () => {
    // `tg:silver-bullet` livrerait le nom d'un tag ; `je:2026-08-02` livrerait
    // les jours où l'utilisateur écrit son journal.
    const { cleUid } = await clesNeuves();
    const aveugle = await aveugler(cleUid, "uid", "tg:silver-bullet");
    expect(aveugle).not.toContain("silver");
    expect(aveugle).not.toContain("tg:");
    expect(aveugle).toMatch(/^[A-Za-z0-9_-]+$/); // sûr en URL et en identifiant
  });

  it("sépare les domaines : un nom de table ne peut pas devenir un uid", async () => {
    const { cleUid } = await clesNeuves();
    expect(await aveugler(cleUid, "table", "notes")).not.toBe(await aveugler(cleUid, "uid", "notes"));
  });

  it("deux comptes n'obtiennent pas le même identifiant aveuglé", async () => {
    const a = await clesNeuves();
    const b = await clesNeuves();
    expect(await aveugler(a.cleUid, "uid", "meme-uid")).not.toBe(await aveugler(b.cleUid, "uid", "meme-uid"));
  });
});

describe("garde-fous", () => {
  it("refuse une clé de données de mauvaise taille", async () => {
    await expect(deriverSousCles(octetsAleatoires(16))).rejects.toThrow();
  });

  it("les sels tirés sont distincts et de bonne longueur", () => {
    expect(genererSel()).toHaveLength(16);
    expect(versBase64(genererSel())).not.toBe(versBase64(genererSel()));
  });

  it("l'encodage base64 fait l'aller-retour sur des octets arbitraires", () => {
    const octets = octetsAleatoires(1024);
    expect(depuisBase64(versBase64(octets))).toEqual(octets);
    // Y compris les cas limites que l'encodage par blocs de 3 peut abîmer.
    for (const n of [0, 1, 2, 3, 4]) {
      const petit = octetsAleatoires(n);
      expect(depuisBase64(versBase64(petit))).toEqual(petit);
    }
  });
});
