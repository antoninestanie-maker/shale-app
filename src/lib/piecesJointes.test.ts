import { describe, expect, it } from "vitest";
import { extraireMentions } from "./mentions";
import {
  extrairePiecesJointes,
  familleDe,
  jetonPieceJointe,
  nomLisible,
  refusDeDepot,
  TAILLE_MAX,
  tailleLisible,
} from "./piecesJointes";

/**
 * Ce que ces tests gardent, et pourquoi.
 *
 * Une pièce jointe qui ne survit pas à un aller-retour d'enregistrement est un
 * FICHIER PERDU — la ligne `files` resterait, ses octets aussi, mais plus rien
 * dans la note n'y mènerait. C'est la même classe de défaut que la mention vidée
 * en route (`PIEGES.md` § 2.1), et elle est silencieuse de la même façon.
 */

describe("le jeton survit à l'aller-retour", () => {
  it("relit ce qu'il vient d'écrire", () => {
    const p = { uid: "a3f2-7b1c", nom: "Contrat.pdf", taille: 284193 };
    expect(extrairePiecesJointes(jetonPieceJointe(p))).toEqual([p]);
  });

  it("retrouve le jeton au milieu d'un vrai corps de note", () => {
    const html =
      "<p>Le point clé est dans " +
      jetonPieceJointe({ uid: "u-1", nom: "Bilan.xlsx", taille: 4096 }) +
      ", page 3.</p><p>À relire.</p>";
    expect(extrairePiecesJointes(html).map((p) => p.uid)).toEqual(["u-1"]);
  });

  it("⭐ survit à un nom qui contient des guillemets et des chevrons", () => {
    // Le cas qui casse une regex écrite trop vite — et un nom de fichier venu
    // de l'extérieur n'a aucune raison d'être sage.
    const p = { uid: "u-2", nom: 'Note "urgente" <v2>.pdf', taille: 12 };
    const [relu] = extrairePiecesJointes(jetonPieceJointe(p));
    expect(relu).toEqual(p);
  });

  it("⭐ n'est pas confondu avec un jeton de MENTION", () => {
    // Les deux sont des `<span contenteditable="false">` : si l'un lisait
    // l'autre, une mention deviendrait une pièce jointe fantôme.
    const mention =
      '<span class="mention" contenteditable="false" data-mention="note:x">@Plan</span>';
    expect(extrairePiecesJointes(mention)).toEqual([]);
  });

  it("dédoublonne le même fichier cité deux fois", () => {
    const j = jetonPieceJointe({ uid: "u-3", nom: "a.pdf", taille: 9 });
    expect(extrairePiecesJointes(`${j} et encore ${j}`)).toHaveLength(1);
  });

  it("rend une liste vide sur un corps sans pièce jointe", () => {
    expect(extrairePiecesJointes("")).toEqual([]);
    expect(extrairePiecesJointes("<p>Rien ici.</p>")).toEqual([]);
  });

  it("tolère un jeton dont la taille est absente ou absurde", () => {
    // Peut arriver d'un autre appareil qui tourne une version différente.
    const html =
      '<span class="piece-jointe" data-fichier="u-4" data-nom="x.pdf" data-taille="oui">x.pdf</span>';
    expect(extrairePiecesJointes(html)[0]).toEqual({ uid: "u-4", nom: "x.pdf", taille: 0 });
  });
});

describe("ce qu'on accepte de déposer", () => {
  it("refuse un fichier vide — un dossier glissé arrive ainsi", () => {
    expect(refusDeDepot(0)).toBe("vide");
  });

  it("refuse au-delà du plafond, accepte juste en dessous", () => {
    expect(refusDeDepot(TAILLE_MAX + 1)).toBe("trop-gros");
    expect(refusDeDepot(TAILLE_MAX)).toBeNull();
  });

  it("accepte un fichier ordinaire", () => {
    expect(refusDeDepot(284193)).toBeNull();
  });
});

describe("taille lisible", () => {
  it("⭐ suit le séparateur décimal de la LANGUE", () => {
    // Le défaut qui trahit un logiciel traduit à moitié.
    expect(tailleLisible(1_400_000, "fr")).toBe("1,4 Mo");
    expect(tailleLisible(1_400_000, "en")).toBe("1.4 Mo");
  });

  it("ne met pas de décimale au-delà de dix", () => {
    expect(tailleLisible(284_193, "fr")).toBe("284 ko");
  });

  it("compte les octets tels quels sous mille", () => {
    expect(tailleLisible(512, "fr")).toBe("512 o");
  });
});

describe("famille d'un fichier", () => {
  it("croit le type MIME avant l'extension", () => {
    // L'extension est une chaîne que n'importe qui réécrit ; le MIME vient du
    // système au moment du dépôt.
    expect(familleDe("truc.zip", "application/pdf")).toBe("pdf");
  });

  it("retombe sur l'extension quand le MIME manque", () => {
    expect(familleDe("Bilan.xlsx", "")).toBe("tableur");
    expect(familleDe("photo.HEIC", "")).toBe("image");
  });

  it("répond « autre » plutôt que de deviner", () => {
    expect(familleDe("donnees.qqch", "")).toBe("autre");
  });
});

describe("nom lisible", () => {
  it("⭐ tronque au MILIEU pour garder l'extension", () => {
    // Coupé à la fin, on perd la seule partie qui dit de quoi il s'agit.
    const court = nomLisible("rapport-trimestriel-2026-version-finale.pdf", 24);
    expect(court.endsWith(".pdf")).toBe(true);
    expect(court.length).toBeLessThanOrEqual(24);
  });

  it("laisse un nom court intact", () => {
    expect(nomLisible("a.pdf")).toBe("a.pdf");
  });

  it("ne rend jamais une chaîne vide", () => {
    expect(nomLisible("   ")).toBe("sans nom");
  });
});

describe("⭐ les trois familles de citations cohabitent dans un même corps", () => {
  /**
   * LE DÉFAUT QUE CE BLOC EXISTE POUR EMPÊCHER, et il est silencieux.
   *
   * `useLiens.enregistrerLiens` réconcilie les arêtes sur l'UNION de ce que le
   * corps contient : mentions `@`, nœuds de carte mentale, pièces jointes.
   * `diffMentions` supprime ensuite tout ce qui n'est pas dans cette union.
   *
   * Si l'un des trois extracteurs manquait l'autre — ou pire, si l'un attrapait
   * les jetons de l'autre et les rendait sous une mauvaise famille — les arêtes
   * correspondantes seraient effacées AU PROCHAIN ENREGISTREMENT. Pas d'erreur,
   * pas d'alerte : juste un backlink qui disparaît pendant qu'on tape ailleurs.
   * C'est la garantie « porte 3 » du chantier cartes mentales, étendue.
   */
  const CORPS =
    "<p>Voir " +
    '<span class="mention" contenteditable="false" data-mention="note:n-1">@Plan de risque</span>' +
    " et la pièce " +
    jetonPieceJointe({ uid: "f-1", nom: "Contrat.pdf", taille: 284193 }) +
    ".</p>" +
    '<figure data-mindmap=\'{"noeuds":[{"id":"r","texte":"Racine"}]}\'><svg></svg></figure>';

  it("la pièce jointe est trouvée au milieu des deux autres", () => {
    expect(extrairePiecesJointes(CORPS).map((p) => p.uid)).toEqual(["f-1"]);
  });

  it("⚠️ elle n'avale PAS la mention voisine", () => {
    // Les deux sont des `<span contenteditable="false">` : c'est le voisinage
    // exact où une regex trop large se trompe de famille.
    expect(extrairePiecesJointes(CORPS)).toHaveLength(1);
  });

  it("⚠️ et la mention n'avale pas la pièce jointe", () => {
    const mentions = extraireMentions(CORPS);
    expect(mentions.map((m) => `${m.kind}:${m.uid}`)).toEqual(["note:n-1"]);
  });
});
