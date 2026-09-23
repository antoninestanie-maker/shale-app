// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from "vitest";

import {
  insererPieceJointe,
  pieceJointeCliquee,
  rafraichirPiecesJointes,
} from "./piecesJointesDom";
import { extrairePiecesJointes, jetonPieceJointe } from "./piecesJointes";

/**
 * La moitié DOM des pièces jointes.
 *
 * ⚠️ CORRECTION D'UNE AFFIRMATION QUE J'AI ÉCRITE MOI-MÊME. L'en-tête de
 * `piecesJointesDom.ts` a d'abord dit « ce fichier n'a aucun test, et c'est
 * structurel ». C'était faux : deux fichiers du dépôt tournent déjà sous
 * `happy-dom` (`sync/sas.test.ts`, `sync/planificateur.test.ts`), et le même
 * docblock suffit ici. Ce qui est vrai, c'est que la config GLOBALE est en
 * `environment: "node"` — pas qu'un test DOM soit impossible.
 *
 * Ce que ces tests gardent est exactement ce qu'aucun test pur ne peut voir :
 * l'insertion au bon endroit, les TROIS états d'affichage (présente, pas sur
 * cet appareil, supprimée), et la remontée d'un clic depuis l'enfant réellement
 * cliqué.
 */

const FICHIER = { uid: "f-1", nom: "Contrat.pdf", taille: 284193 };

let racine: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = "";
  racine = document.createElement("div");
  racine.contentEditable = "true";
  document.body.appendChild(racine);
});

describe("insertion dans le corps de la note", () => {
  it("pose le jeton et le rend relisible par l'extracteur", () => {
    racine.innerHTML = "<p>Voir </p>";
    insererPieceJointe(racine, FICHIER, "application/pdf", "fr");

    // La boucle complète : ce que le DOM contient doit repasser par la regex.
    expect(extrairePiecesJointes(racine.innerHTML).map((p) => p.uid)).toEqual(["f-1"]);
  });

  it("⭐ le jeton est un ATOME — `contenteditable=false`", () => {
    // Sans cela, on efface une lettre au milieu du nom et le jeton affiche
    // « Contrt.pdf » pour un fichier qui s'appelle toujours « Contrat.pdf ».
    insererPieceJointe(racine, FICHIER, "application/pdf", "fr");
    const jeton = racine.querySelector<HTMLElement>("[data-fichier]")!;
    expect(jeton.getAttribute("contenteditable")).toBe("false");
  });

  it("⭐ laisse une espace insécable DERRIÈRE, sinon on ne peut plus taper", () => {
    // Le curseur se retrouverait coincé derrière un élément non éditable en fin
    // de bloc — défaut bien réel, et très déroutant pour qui l'essuie.
    insererPieceJointe(racine, FICHIER, "application/pdf", "fr");
    expect(racine.textContent).toContain(" ");
  });

  it("pose en fin de note quand aucun curseur n'est dans l'éditeur", () => {
    // Un dépôt qui n'aboutit nulle part laisserait un fichier copié sur le
    // disque et cité par personne.
    racine.innerHTML = "<p>Déjà écrit</p>";
    expect(insererPieceJointe(racine, FICHIER, "application/pdf", "fr")).toBe(true);
    expect(racine.querySelectorAll("[data-fichier]")).toHaveLength(1);
  });

  it("affiche le nom et la taille", () => {
    insererPieceJointe(racine, FICHIER, "application/pdf", "fr");
    const texte = racine.textContent ?? "";
    expect(texte).toContain("Contrat.pdf");
    expect(texte).toContain("284 ko");
  });
});

describe("⭐ les trois états, et ne jamais les confondre", () => {
  const corps = () => `<p>Voir ${jetonPieceJointe(FICHIER)}.</p>`;

  it("présente : cliquable, ni estompée ni barrée", () => {
    const html = rafraichirPiecesJointes(
      corps(),
      () => ({ nom: "Contrat.pdf", mime: "application/pdf", taille: 284193, presente: true }),
      "fr",
    );
    racine.innerHTML = html;
    const jeton = racine.querySelector<HTMLElement>("[data-fichier]")!;
    expect(jeton.className).toBe("piece-jointe");
  });

  it("⭐ pas sur cet appareil : état NORMAL du second appareil, pas une erreur", () => {
    // Les octets ne se synchronisent pas (migration 028). Confondre ce cas avec
    // « supprimé » afficherait « fichier supprimé » sur l'iPhone pour un PDF
    // parfaitement vivant sur le Mac.
    const html = rafraichirPiecesJointes(
      corps(),
      () => ({ nom: "Contrat.pdf", mime: "application/pdf", taille: 284193, presente: false }),
      "fr",
    );
    racine.innerHTML = html;
    const jeton = racine.querySelector<HTMLElement>("[data-fichier]")!;
    expect(jeton.className).toContain("piece-jointe-absente");
    expect(jeton.className).not.toContain("piece-jointe-morte");
  });

  it("supprimée : le jeton RESTE, marqué mort", () => {
    // Le retirer réécrirait la phrase de l'utilisateur sans le lui demander.
    const html = rafraichirPiecesJointes(corps(), () => null, "fr");
    racine.innerHTML = html;
    const jeton = racine.querySelector<HTMLElement>("[data-fichier]")!;
    expect(jeton).not.toBeNull();
    expect(jeton.className).toContain("piece-jointe-morte");
    // Le nom connu survit : c'est la seule trace de ce qui a été joint.
    expect(jeton.textContent).toContain("Contrat.pdf");
  });

  it("⭐ réécrit le nom quand le fichier a été renommé ailleurs", () => {
    // Le nom du jeton est une COPIE d'affichage — l'identité tient dans
    // `data-fichier`. Le laisser vieillir afficherait l'ancien nom pour
    // toujours, exactement comme une mention non rafraîchie.
    const html = rafraichirPiecesJointes(
      corps(),
      () => ({ nom: "Contrat-signe.pdf", mime: "application/pdf", taille: 9000, presente: true }),
      "fr",
    );
    expect(html).toContain("Contrat-signe.pdf");
    expect(html).not.toContain(">Contrat.pdf<");
  });

  it("ne touche pas à un corps sans pièce jointe", () => {
    const intact = "<p>Rien à joindre ici.</p>";
    expect(rafraichirPiecesJointes(intact, () => null, "fr")).toBe(intact);
  });
});

describe("le clic remonte jusqu'au jeton", () => {
  it("⭐ depuis l'ENFANT réellement cliqué, pas seulement depuis le jeton", () => {
    // Le clic atterrit sur le pictogramme ou sur le nom, qui sont des enfants.
    // Sans `closest`, un clic sur deux ne ferait rien — et le défaut passerait
    // pour de l'imprécision de la souris.
    insererPieceJointe(racine, FICHIER, "application/pdf", "fr");
    const nom = racine.querySelector(".pj-nom")!;
    expect(pieceJointeCliquee(nom)).toBe("f-1");
  });

  it("⚠️ un jeton MORT ne s'ouvre pas — il n'y a rien derrière", () => {
    racine.innerHTML = rafraichirPiecesJointes(
      `<p>${jetonPieceJointe(FICHIER)}</p>`,
      () => null,
      "fr",
    );
    const jeton = racine.querySelector("[data-fichier]")!;
    expect(pieceJointeCliquee(jeton)).toBeNull();
  });

  it("rend null hors d'un jeton", () => {
    racine.innerHTML = "<p>Du texte ordinaire</p>";
    expect(pieceJointeCliquee(racine.querySelector("p"))).toBeNull();
    expect(pieceJointeCliquee(null)).toBeNull();
  });
});
