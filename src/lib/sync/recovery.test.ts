import { describe, expect, it } from "vitest";

import {
  formaterCode,
  genererCode,
  groupe,
  groupesAVerifier,
  LONGUEUR_CODE,
  normaliserCode,
  secretDepuisCode,
} from "./recovery";

/** Étape 3 — code de récupération. */

describe("génération", () => {
  it("produit un code lisible et valide", () => {
    const code = genererCode();
    expect(code).toMatch(/^SHALE-([0-9A-HJKMNP-TV-Z]{4}-){6}[0-9A-HJKMNP-TV-Z]{4}$/);
    expect(normaliserCode(code)).not.toBeNull();
  });

  it("ne contient aucun caractère confondable", () => {
    // Ni I ni L (confondus avec 1), ni O (avec 0), ni U (avec V). Un code se
    // recopie à la main : c'est là que se perdent les données.
    // Le préfixe « SHALE » est exclu de l'examen — il contient un L, mais c'est
    // un mot connu, pas une donnée à déchiffrer du regard, et il est retiré
    // avant toute conversion à la saisie.
    for (let i = 0; i < 200; i++) {
      expect(genererCode().replace("SHALE-", "")).not.toMatch(/[ILOU]/);
    }
  });

  it("ne se répète jamais", () => {
    const vus = new Set(Array.from({ length: 500 }, genererCode));
    expect(vus.size).toBe(500);
  });
});

describe("saisie tolérante", () => {
  const code = genererCode();
  const canonique = normaliserCode(code)!;

  it("accepte la forme exacte", () => {
    expect(normaliserCode(code)).toBe(canonique);
  });

  it("accepte les minuscules, les espaces et l'absence de tirets", () => {
    expect(normaliserCode(code.toLowerCase())).toBe(canonique);
    expect(normaliserCode(code.replace(/-/g, ""))).toBe(canonique);
    expect(normaliserCode(code.replace(/-/g, " "))).toBe(canonique);
    expect(normaliserCode(`  ${code}  `)).toBe(canonique);
  });

  it("accepte le code sans son préfixe", () => {
    expect(normaliserCode(code.replace("SHALE-", ""))).toBe(canonique);
  });

  it("rattrape les confusions classiques de l'alphabet", () => {
    // Quelqu'un qui recopie « 1 » en « I » ou « 0 » en « O » ne doit pas perdre
    // ses données pour autant.
    const avecConfusions = canonique.replace(/1/g, "I").replace(/0/g, "O");
    expect(normaliserCode(avecConfusions)).toBe(canonique);
    expect(normaliserCode(canonique.replace(/1/g, "l"))).toBe(canonique);
  });
});

describe("détection des fautes de recopie", () => {
  it("rejette un caractère faux", () => {
    const canonique = normaliserCode(genererCode())!;
    let fautes = 0;
    for (let i = 0; i < 26; i++) {
      const original = canonique[i];
      const remplacant = original === "7" ? "9" : "7";
      const abime = canonique.slice(0, i) + remplacant + canonique.slice(i + 1);
      if (normaliserCode(abime) === null) fautes++;
    }
    // La somme fait 10 bits : une poignée de collisions est attendue et sans
    // gravité — c'est AES-GCM qui tranche pour de bon. Elle doit simplement
    // attraper l'écrasante majorité des fautes avant la dérivation.
    expect(fautes).toBeGreaterThanOrEqual(24);
  });

  it("rejette une interversion de deux caractères voisins", () => {
    // C'est LA faute typique de recopie, et une somme non pondérée par la
    // position ne la verrait pas.
    let detectees = 0;
    let testees = 0;
    for (let essai = 0; essai < 40; essai++) {
      const c = normaliserCode(genererCode())!;
      for (let i = 0; i < 25; i++) {
        if (c[i] === c[i + 1]) continue;
        testees++;
        const permute = c.slice(0, i) + c[i + 1] + c[i] + c.slice(i + 2);
        if (normaliserCode(permute) === null) detectees++;
      }
    }
    expect(detectees / testees).toBeGreaterThan(0.95);
  });

  it("rejette un code trop court, trop long ou hors alphabet", () => {
    const canonique = normaliserCode(genererCode())!;
    expect(normaliserCode(canonique.slice(0, -1))).toBeNull();
    expect(normaliserCode(canonique + "7")).toBeNull();
    expect(normaliserCode(canonique.slice(0, -1) + "@")).toBeNull();
    expect(normaliserCode("")).toBeNull();
    expect(normaliserCode("n'importe quoi")).toBeNull();
  });
});

describe("dérivation", () => {
  it("le secret ne retient que les caractères de données", () => {
    // La somme de contrôle se déduit des données : l'inclure n'ajouterait pas
    // un bit d'entropie, seulement un risque d'incohérence.
    const canonique = normaliserCode(genererCode())!;
    const secret = secretDepuisCode(canonique);
    expect(secret).toHaveLength(LONGUEUR_CODE - 2);
    expect(canonique.startsWith(secret)).toBe(true);
  });

  it("une saisie tolérée donne le MÊME secret que la forme exacte", () => {
    // Le point qui compte vraiment : taper le code en minuscules, sans tirets,
    // avec un « O » à la place d'un zéro, doit déverrouiller les données.
    const code = genererCode();
    const exact = secretDepuisCode(normaliserCode(code)!);
    const relache = secretDepuisCode(normaliserCode(code.toLowerCase().replace(/-/g, " "))!);
    expect(relache).toBe(exact);
  });
});

describe("vérification à l'onboarding", () => {
  it("demande trois groupes distincts, dans l'ordre", () => {
    for (let i = 0; i < 50; i++) {
      const indices = groupesAVerifier();
      expect(indices).toHaveLength(3);
      expect(new Set(indices).size).toBe(3);
      expect([...indices].sort((a, b) => a - b)).toEqual(indices);
      expect(Math.max(...indices)).toBeLessThan(7);
    }
  });

  it("ne redemande pas toujours les mêmes", () => {
    const vus = new Set(Array.from({ length: 100 }, () => groupesAVerifier().join()));
    expect(vus.size).toBeGreaterThan(5);
  });

  it("extrait le bon groupe", () => {
    const canonique = normaliserCode(genererCode())!;
    const affiche = formaterCode(canonique).replace("SHALE-", "").split("-");
    for (let i = 0; i < affiche.length; i++) expect(groupe(canonique, i)).toBe(affiche[i]);
  });
});
