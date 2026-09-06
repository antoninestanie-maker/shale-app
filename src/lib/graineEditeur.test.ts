import { describe, expect, it } from "vitest";

import {
  doitResemer,
  ecritureAcceptable,
  graineDeNote,
  messageEcritureRefusee,
  type CorpsRafraichi,
} from "./graineEditeur";

/**
 * Chantier H — « le contenu d'une note se retrouve dans une autre »
 * (bogue rapporté par Antonin le 2026-09-05).
 *
 * ⚠️ CE QUE CES TESTS GARDENT, ET COMMENT ILS ONT ÉTÉ VÉRIFIÉS.
 * Le test qui compte est `« le corps de A n'est JAMAIS servi pour B »`. Il a
 * été rejoué sur le code d'AVANT le correctif, en remplaçant la fonction par
 * son ancien comportement (`frais ?? corpsBrut`, sans comparer les identités) :
 * il TOMBE. Les autres suivent le même sort. Sans cette vérification, on ne
 * saurait pas si ces tests ont des dents (`PIEGES.md` § 7.2).
 */

const CORPS_A = "<p>3 erreurs de débutant en trading</p>";
const CORPS_B = "<p>Règles du setup : attendre la cassure du range H4</p>";
const CORPS_A_FRAIS = '<p>3 erreurs <span class="mention">@Plan de risque</span></p>';

// ─────────────────────────────────────────────────────────────────────────────

describe("la graine de l'éditeur", () => {
  it("⭐ ne sert JAMAIS le corps d'une note pour une autre", () => {
    // Exactement l'instant du bogue : on vient d'ouvrir la note 2, et le corps
    // rafraîchi de la note 1 n'a pas encore été remplacé.
    const fraisDeA: CorpsRafraichi = { id: 1, html: CORPS_A_FRAIS };

    const graine = graineDeNote(2, CORPS_B, fraisDeA);

    expect(graine.html).toBe(CORPS_B);
    expect(graine.html).not.toContain("erreurs de débutant");
  });

  it("pose le corps brut tant que le rafraîchi n'est pas arrivé", () => {
    expect(graineDeNote(2, CORPS_B, null)).toEqual({
      cle: "2:brut",
      html: CORPS_B,
    });
  });

  it("pose le corps rafraîchi dès qu'il arrive, s'il est bien le sien", () => {
    const frais: CorpsRafraichi = { id: 1, html: CORPS_A_FRAIS };
    expect(graineDeNote(1, CORPS_A, frais)).toEqual({
      cle: "1:frais",
      html: CORPS_A_FRAIS,
    });
  });

  it("change de clé entre le brut et le rafraîchi — sinon le DOM garderait le brut", () => {
    const frais: CorpsRafraichi = { id: 1, html: CORPS_A_FRAIS };
    const avant = graineDeNote(1, CORPS_A, null);
    const apres = graineDeNote(1, CORPS_A, frais);
    expect(avant.cle).not.toBe(apres.cle);
  });

  it("⭐ la clé ne revient JAMAIS en arrière — c'est le défaut de mon premier essai", () => {
    // Le corps brut change à chaque enregistrement (la liste est rafraîchie).
    // Une fois passée au rafraîchi, la clé doit y rester : si elle repassait à
    // `brut`, le DOM serait resemé avec le corps d'avant la frappe, et la
    // lettre que l'utilisateur vient de taper disparaîtrait de l'écran tout en
    // étant bien enregistrée. Vu à l'écran le 2026-09-06.
    const frais: CorpsRafraichi = { id: 1, html: CORPS_A_FRAIS };
    const apresFrappe = graineDeNote(1, "<p>abc tapé</p>", frais);
    expect(apresFrappe.cle).toBe("1:frais");
  });

  it("⭐ le HTML rendu appartient toujours à l'identifiant rendu, dans TOUS les cas", () => {
    // L'invariant, éprouvé sur toutes les combinaisons. Chaque note a un
    // marqueur qui n'existe que chez elle : on vérifie qu'aucune graine ne
    // porte jamais le marqueur d'une AUTRE note. C'est l'assertion qui compte —
    // la version faible de ce test (« le html correspond à ce que dit la clé »)
    // passait aussi sur le code bogué, puisque la clé mentait avec lui.
    const corps: Record<number, string> = {
      1: "<p>MARQUEUR-UN</p>",
      2: "<p>MARQUEUR-DEUX</p>",
    };
    const marqueurEtranger: Record<number, string> = {
      1: "MARQUEUR-DEUX",
      2: "MARQUEUR-UN",
    };
    const fraisPossibles: (CorpsRafraichi | null)[] = [
      null,
      { id: 1, html: "<p>MARQUEUR-UN rafraîchi</p>" },
      { id: 2, html: "<p>MARQUEUR-DEUX rafraîchi</p>" },
    ];
    for (const id of [1, 2]) {
      for (const frais of fraisPossibles) {
        const g = graineDeNote(id, corps[id], frais);
        expect(g.html).not.toContain(marqueurEtranger[id]);
        expect(g.cle.startsWith(`${id}:`)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("faut-il reposer la graine dans le DOM ?", () => {
  const base = {
    idAffiche: 1,
    idDuDom: 1 as number | null,
    cle: "1:frais",
    clePosee: "1:brut",
    aTape: false,
  };

  it("oui au tout premier passage — rien n'a encore été posé", () => {
    expect(doitResemer({ ...base, idDuDom: null, clePosee: null })).toBe(true);
  });

  it("⭐ oui quand on change de note, MÊME si l'utilisateur était en train de taper", () => {
    // Ce qu'il a tapé appartient à l'AUTRE note et il est déjà en file
    // d'enregistrement. Ne pas reposer laisserait le texte de l'ancienne note
    // à l'écran de la nouvelle — c'est exactement le bogue d'origine.
    expect(doitResemer({ ...base, idAffiche: 2, idDuDom: 1, aTape: true })).toBe(true);
  });

  it("non quand la graine posée est déjà la bonne", () => {
    expect(doitResemer({ ...base, cle: "1:frais", clePosee: "1:frais" })).toBe(false);
  });

  it("oui pour une graine plus fraîche, tant que l'utilisateur n'a pas tapé", () => {
    expect(doitResemer({ ...base, aTape: false })).toBe(true);
  });

  it("⭐ NON pour une graine plus fraîche dès que l'utilisateur a tapé — sinon on lui reprend ses mots", () => {
    // Le défaut que j'ai introduit au premier essai, et qui ne s'est vu qu'à
    // l'écran : la lettre partait en base et disparaissait de l'affichage.
    expect(doitResemer({ ...base, aTape: true })).toBe(false);
  });

  it("la frappe ne bloque JAMAIS un changement de note", () => {
    // L'invariant qui compte : quel que soit l'état de la frappe, changer de
    // note repose toujours. Sans lui, on retomberait dans la perte de données.
    for (const aTape of [false, true]) {
      for (const clePosee of [null, "1:brut", "1:frais"]) {
        expect(
          doitResemer({ idAffiche: 9, idDuDom: 1, cle: "9:brut", clePosee, aTape }),
        ).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("le filet : une écriture venue d'une autre note est refusée", () => {
  it("accepte quand le texte vient de la note affichée", () => {
    expect(ecritureAcceptable(7, 7)).toBe(true);
  });

  it("⭐ REFUSE quand le texte vient d'une autre note", () => {
    expect(ecritureAcceptable(7, 3)).toBe(false);
  });

  it("refuse quand plus aucune note n'est affichée", () => {
    expect(ecritureAcceptable(null, 3)).toBe(false);
  });

  it("le message d'incident nomme les DEUX notes, sinon il n'aide personne", () => {
    const m = messageEcritureRefusee(7, 3);
    expect(m).toContain("3");
    expect(m).toContain("7");
    expect(m.toLowerCase()).toContain("refused");
  });

  it("le message reste lisible quand aucune note n'est affichée", () => {
    expect(messageEcritureRefusee(null, 3)).toContain("none");
  });
});
