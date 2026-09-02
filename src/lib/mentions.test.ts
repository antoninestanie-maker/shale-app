import { describe, expect, it } from "vitest";

import {
  CLASSE_MENTION_MORTE,
  extraireMentions,
  jetonMention,
  LIBELLE_SUPPRIME,
  rafraichirMentions,
  requeteEnCours,
} from "./mentions";
import type { LinkKind } from "./types";

/** Chantier C — les mentions `@` survivent à l'aller-retour. */

const titres: Record<string, string> = {
  "note:n1": "Plan de risque",
  "knowledge:k1": "Silver Bullet",
  "object:o1": "Mark Douglas",
};
const titreDe = (kind: LinkKind, uid: string) => titres[`${kind}:${uid}`] ?? null;

// ─────────────────────────────────────────────────────────────────────────────

describe("le jeton", () => {
  it("se relit tel qu'il s'écrit", () => {
    const html = `<p>voir ${jetonMention("note", "n1", "Plan de risque")} demain</p>`;
    expect(extraireMentions(html)).toEqual([
      { kind: "note", uid: "n1", titre: "Plan de risque" },
    ]);
  });

  it("⭐ survit à un aller-retour d'enregistrement et de rechargement", () => {
    // C'est la propriété qui compte : une mention qui ne se relit pas est un
    // lien perdu, en silence.
    const enregistre = `<p>${jetonMention("knowledge", "k1", "Silver Bullet")}</p>`;
    const recharge = rafraichirMentions(enregistre, titreDe);
    expect(extraireMentions(recharge)).toEqual([
      { kind: "knowledge", uid: "k1", titre: "Silver Bullet" },
    ]);
  });

  it("est un ATOME : le curseur ne peut pas entrer dedans", () => {
    // Sans `contenteditable="false"`, on effacerait une lettre au milieu du
    // titre et le jeton afficherait un texte qui ne veut plus rien dire, alors
    // que son lien resterait valide.
    expect(jetonMention("note", "n1", "x")).toContain('contenteditable="false"');
  });

  it("échappe ce qui pourrait casser le balisage", () => {
    const html = jetonMention("note", 'n"1', '<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("ignore un jeton dont la famille est inconnue", () => {
    const html = '<span data-mention="inventé:x">@rien</span>';
    expect(extraireMentions(html)).toEqual([]);
  });

  it("ignore un jeton sans identité", () => {
    expect(extraireMentions('<span data-mention="note:">@vide</span>')).toEqual([]);
  });

  it("⚠️ deux mentions du même objet ne font qu'une", () => {
    // L'index unique de la migration 020 refuserait la seconde arête : autant
    // que l'appelant n'ait jamais à gérer une erreur pour un cas normal — on
    // cite souvent deux fois la même chose dans un paragraphe.
    const html = jetonMention("note", "n1", "A") + " et " + jetonMention("note", "n1", "A");
    expect(extraireMentions(html)).toHaveLength(1);
  });

  it("récupère le texte même si un gras a été appliqué par-dessus", () => {
    // `execCommand` enveloppe la sélection : le jeton peut contenir `<b>`.
    const html = '<span data-mention="note:n1">@<b>Plan</b> de risque</span>';
    expect(extraireMentions(html)[0].titre).toBe("Plan de risque");
  });
});

describe("le renommage et la suppression", () => {
  it("⭐ renommer la cible réécrit le texte affiché, l'identité ne bouge pas", () => {
    const ancien = `<p>${jetonMention("note", "n1", "Ancien nom")}</p>`;
    const frais = rafraichirMentions(ancien, titreDe);
    expect(frais).toContain("@Plan de risque");
    expect(frais).not.toContain("Ancien nom");
    expect(extraireMentions(frais)[0].uid).toBe("n1");
  });

  it("⚠️ une cible SUPPRIMÉE laisse le jeton en place, marqué comme mort", () => {
    // Le retirer réécrirait le texte de l'utilisateur sans le lui demander, et
    // une phrase à laquelle on enlève un mot ne veut plus rien dire.
    const html = `<p>voir ${jetonMention("note", "disparue", "Vieux plan")}</p>`;
    const frais = rafraichirMentions(html, titreDe);
    expect(frais).toContain(CLASSE_MENTION_MORTE);
    expect(frais).toContain("@Vieux plan");
    expect(extraireMentions(frais)).toHaveLength(1);
  });

  it("une cible supprimée dont on n'a même plus le titre le dit", () => {
    const html = '<span data-mention="note:disparue"></span>';
    expect(rafraichirMentions(html, titreDe)).toContain(LIBELLE_SUPPRIME);
  });

  it("ne touche pas au reste du texte", () => {
    const html = `<p>Avant ${jetonMention("note", "n1", "x")} après</p><h2>Titre</h2>`;
    const frais = rafraichirMentions(html, titreDe);
    expect(frais).toContain("<p>Avant ");
    expect(frais).toContain("<h2>Titre</h2>");
  });

  it("un texte sans mention traverse sans être modifié", () => {
    const html = "<p>Rien à signaler</p>";
    expect(rafraichirMentions(html, titreDe)).toBe(html);
    expect(extraireMentions(html)).toEqual([]);
  });
});

describe("la frappe de `@`", () => {
  it("ouvre le sélecteur en début de texte et après une espace", () => {
    expect(requeteEnCours("@")).toBe("");
    expect(requeteEnCours("voir @pla")).toBe("pla");
    expect(requeteEnCours("\n@ris")).toBe("ris");
  });

  it("⚠️ n'ouvre PAS sur une adresse e-mail", () => {
    // Sans cette règle, « contact@exemple.fr » ouvrirait le sélecteur au milieu
    // du mot, à chaque frappe, dans une note qui n'a rien demandé.
    expect(requeteEnCours("contact@exemple")).toBeNull();
  });

  it("⭐ accepte les espaces : la plupart des titres font plusieurs mots", () => {
    // La première version s'arrêtait au premier espace, et « @plan de risque »
    // refermait le sélecteur avant d'avoir trouvé « Plan de risque ». Vu à
    // l'écran : la règle rendait la moitié des objets inatteignables.
    expect(requeteEnCours("@plan de")).toBe("plan de");
    expect(requeteEnCours("Voir @plan de risque")).toBe("plan de risque");
  });

  it("se referme quand ça devient une phrase, pas une recherche", () => {
    expect(requeteEnCours("@ceci est une vraie phrase")).toBeNull();
    expect(requeteEnCours("@" + "a".repeat(41))).toBeNull();
  });

  it("ne traverse jamais un retour à la ligne", () => {
    expect(requeteEnCours("@plan\nautre chose")).toBeNull();
  });
});
