// Phase F : ce que l'app fait du texte d'une note avant et après le modèle.
import { describe, expect, it } from "vitest";

import { FONCTIONS } from "../../../../shale-site/supabase/functions/ai/coeur/fonctions.ts";
import { valider as validerServeur } from "../../../../shale-site/supabase/functions/ai/coeur/schema.ts";
import { entreesIaNote, type ActionNoteIa } from "../../components/menu/catalogue/ia";
import { ecrireCarte, lireCarte } from "../carte";
import { ordonner } from "../menu/entrees";
import type { PayloadDe } from "./contrats";
import { reponseDemo } from "./demo";
import {
  aDesBlocs,
  blocResume,
  candidatsLiens,
  CARTE_MAX_NOEUDS,
  carteDepuisIa,
  htmlDeTexte,
  liensUtilisables,
  MAX_CANDIDATS,
  motsFrequents,
  texteDeHtml,
} from "./texteNote";

describe("HTML d'une note ↔ texte structuré", () => {
  it("titres, puces et paragraphes gardent leur forme ; la mise en forme en ligne tombe", () => {
    const html =
      '<h1>Plan <b>2027</b></h1><p>Un <i>premier</i> paragraphe.<br>Deuxième ligne&nbsp;!</p><ul><li>Puce A</li><li>Puce &amp; B</li></ul><h2>Suite</h2><div>Fin</div>';
    expect(texteDeHtml(html)).toBe("# Plan 2027\nUn premier paragraphe.\nDeuxième ligne !\n- Puce A\n- Puce & B\n## Suite\nFin");
  });

  it("les blocs non textuels (carte, image, pièce jointe) ne partent pas ; une mention reste en toutes lettres", () => {
    const html =
      '<p>Avant</p><figure class="carte-bloc" data-mindmap="{&quot;v&quot;:1}"><svg><text>SECRET</text></svg></figure>' +
      '<p>Voir <span class="mention" contenteditable="false" data-mention="note:abc">@Tarifs 2026</span></p><img src="data:image/png;base64,AAAA">';
    expect(texteDeHtml(html)).toBe("Avant\nVoir @Tarifs 2026");
    expect(aDesBlocs(html)).toBe(true);
    expect(aDesBlocs("<p>Du texte <b>simple</b></p><ul><li>a</li></ul>")).toBe(false);
    expect(aDesBlocs('<p><span class="mention" data-mention="note:x">@x</span></p>')).toBe(true);
  });

  it("le retour ÉCHAPPE tout : rien du modèle n'entre dans le DOM comme balise", () => {
    expect(htmlDeTexte('# Titre <script>\nTexte <img src=x onerror="alert(1)">\n- a & b\n- c\n\n## Fin')).toBe(
      "<h1>Titre &lt;script&gt;</h1><p>Texte &lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p><ul><li>a &amp; b</li><li>c</li></ul><h2>Fin</h2>",
    );
    expect(htmlDeTexte("")).toBe("");
  });

  it("un aller-retour ne change pas un texte déjà structuré", () => {
    const texte = "# Titre\nParagraphe\n- un\n- deux\n## Partie\nFin";
    expect(texteDeHtml(htmlDeTexte(texte))).toBe(texte);
  });

  it("le bloc résumé est une citation, titre en gras, contenu échappé", () => {
    expect(blocResume("Résumé", { resume: "Court <b>", points: ["a", "b & c"] })).toBe(
      "<blockquote><p><b>Résumé</b></p><p>Court &lt;b&gt;</p><ul><li>a</li><li>b &amp; c</li></ul></blockquote><p><br></p>",
    );
  });
});

describe("#24 liens @ — la présélection est locale", () => {
  it("les mots qui comptent : les plus fréquents d'abord, sans accent, hors mots vides", () => {
    expect(motsFrequents("Le devis du client. Devis envoyé, client relancé, relance du devis avec soin.", 3)).toEqual(["devis", "client", "relance"]);
  });

  it("écarte la note elle-même et ce qu'elle cite déjà, sans doublon, identifiants courts, quarante au plus", async () => {
    const base = [
      { kind: "note" as const, uid: "moi", titre: "Cette note" },
      { kind: "note" as const, uid: "n2", titre: "Tarifs 2026" },
      { kind: "goal" as const, uid: "g1", titre: "Signer deux clients" },
      { kind: "task" as const, uid: "t1", titre: "  " },
    ];
    const c = await candidatsLiens("devis devis client", async () => base, [{ kind: "note", uid: "moi" }, { kind: "goal", uid: "g1" }]);
    expect(c).toEqual([{ id: "c1", kind: "note", uid: "n2", titre: "Tarifs 2026" }]);

    let n = 0;
    const beaucoup = await candidatsLiens(
      "alpha bravo charlie delta echo foxtrot",
      async () => Array.from({ length: 12 }, () => ({ kind: "note" as const, uid: `u${n++}`, titre: "x" })),
      [],
    );
    expect(beaucoup).toHaveLength(MAX_CANDIDATS);
    expect(beaucoup[39].id).toBe("c40");
  });

  it("ne garde qu'un identifiant ENVOYÉ et un passage présent tel quel dans la note", () => {
    const candidats = [{ id: "c1", kind: "note" as const, uid: "n2", titre: "Tarifs 2026" }];
    const liens = [
      { passage: "les tarifs", id: "c1" },
      { passage: "les tarifs", id: "c1" }, // doublon
      { passage: "absent du texte", id: "c1" },
      { passage: "les tarifs", id: "c9" }, // inventé
    ];
    expect(liensUtilisables("Revoir les tarifs avant mardi.", candidats, liens)).toEqual([{ passage: "les tarifs", candidat: candidats[0] }]);
  });
});

describe("#27 carte mentale — le format existant, borné", () => {
  it("devient une carte lisible par `lireCarte` : une racine, trois niveaux, textes coupés à 80", () => {
    const carte = carteDepuisIa({
      racine: "Lancer la boutique",
      branches: [
        { texte: "Catalogue", enfants: [{ texte: "Photos", enfants: [{ texte: "Fond blanc" }] }, { texte: "  ", enfants: [] }] },
        { texte: "x".repeat(200), enfants: [] },
      ],
    });
    expect(carte.noeuds.map((n) => [n.id, n.parent])).toEqual([["n0", null], ["n1", "n0"], ["n2", "n0"], ["n3", "n1"], ["n4", "n3"]]);
    expect(carte.noeuds[2].texte).toHaveLength(80);
    const relue = lireCarte(ecrireCarte(carte));
    expect(relue?.noeuds.map((n) => n.texte)).toEqual(carte.noeuds.map((n) => n.texte));
  });

  it("quarante nœuds au plus : ce sont les détails qui sautent, pas les branches", () => {
    const branches = Array.from({ length: 8 }, (_, i) => ({
      texte: `B${i}`,
      enfants: Array.from({ length: 6 }, (_, j) => ({ texte: `B${i}.${j}`, enfants: [{ texte: "détail" }] })),
    }));
    const carte = carteDepuisIa({ racine: "R", branches });
    expect(carte.noeuds).toHaveLength(CARTE_MAX_NOEUDS);
    expect(carte.noeuds.filter((n) => n.parent === "n0")).toHaveLength(8);
    expect(carte.noeuds.some((n) => n.texte === "détail")).toBe(false);
  });
});

describe("contrôles de sortie du serveur (phase F)", () => {
  const verifier = <F extends "reecrire" | "developper" | "traduire" | "liens" | "carte">(f: F) =>
    FONCTIONS[f].verifier as (s: unknown, p: PayloadDe<F>, prep: undefined) => string | null;

  it("#21 : « plus court » qui rallonge est rejeté ; une réécriture vide aussi", () => {
    const p = { lang: "fr" as const, ton: "court" as const, texte: "Un texte de départ." };
    expect(verifier("reecrire")({ texte: "Un texte de départ, mais nettement plus long qu'avant." }, p, undefined)).toBeTruthy();
    expect(verifier("reecrire")({ texte: "  " }, p, undefined)).toBeTruthy();
    expect(verifier("reecrire")({ texte: "Texte court." }, p, undefined)).toBeNull();
    expect(verifier("reecrire")({ texte: "Un texte de départ, plus long, mais plus clair." }, { ...p, ton: "clair" }, undefined)).toBeNull();
  });

  it("#24 : un candidat inventé, proposé deux fois, ou un passage absent du texte sont rejetés", () => {
    const p = {
      lang: "fr" as const,
      texte: "Revoir les tarifs avant mardi.",
      candidats: [{ id: "c1", genre: "note" as const, titre: "Tarifs 2026" }, { id: "c2", genre: "goal" as const, titre: "Signer" }],
    };
    const v = verifier("liens");
    expect(v({ liens: [{ passage: "les tarifs", id: "c9" }] }, p, undefined)).toBeTruthy();
    expect(v({ liens: [{ passage: "les tarifs", id: "c1" }, { passage: "mardi", id: "c1" }] }, p, undefined)).toBeTruthy();
    expect(v({ liens: [{ passage: "les prix", id: "c1" }] }, p, undefined)).toBeTruthy();
    expect(v({ liens: [{ passage: "les tarifs", id: "c1" }] }, p, undefined)).toBeNull();
    expect(v({ liens: [] }, p, undefined)).toBeNull();
    expect(validerServeur(FONCTIONS.liens.payload, { ...p, candidats: [{ id: "c1", genre: "trade", titre: "x" }] })).not.toEqual([]);
  });

  it("#27 : la carte est bornée par le schéma — trois niveaux, pas un de plus", () => {
    const profonde = { racine: "R", branches: [{ texte: "a", enfants: [{ texte: "b", enfants: [{ texte: "c", enfants: [] }] }] }] };
    expect(validerServeur(FONCTIONS.carte.sortie, profonde)).not.toEqual([]);
    const large = { racine: "R", branches: Array.from({ length: 9 }, () => ({ texte: "a", enfants: [] })) };
    expect(validerServeur(FONCTIONS.carte.sortie, large)).not.toEqual([]);
    expect(verifier("carte")({ racine: " ", branches: [] }, { lang: "fr", titre: "", texte: "x" }, undefined)).toBeTruthy();
  });

  it("les réponses de la démo passent les MÊMES contrôles que celles du modèle", () => {
    const texte = "# Tarifs\nRevoir les tarifs avant mardi.\n- Jour : 450\n- Demi-journée : 250";
    const pR = { lang: "fr" as const, ton: "court" as const, texte };
    expect(verifier("reecrire")(reponseDemo("reecrire", pR), pR, undefined)).toBeNull();
    const pD = { lang: "fr" as const, titre: "Plan", puces: "- Jour : 450\n- Demi-journée : 250" };
    expect(verifier("developper")(reponseDemo("developper", pD), pD, undefined)).toBeNull();
    const pT = { lang: "fr" as const, cible: "en" as const, titre: "Tarifs", texte };
    expect(verifier("traduire")(reponseDemo("traduire", pT), pT, undefined)).toBeNull();
    const pL = { lang: "fr" as const, texte, candidats: [{ id: "c1", genre: "note" as const, titre: "Tarifs 2026" }] };
    const liens = reponseDemo("liens", pL);
    expect(liens.liens).toEqual([{ passage: "Tarifs", id: "c1" }]);
    expect(verifier("liens")(liens, pL, undefined)).toBeNull();
    const pC = { lang: "fr" as const, titre: "Tarifs", texte };
    const carte = reponseDemo("carte", pC);
    expect(verifier("carte")(carte, pC, undefined)).toBeNull();
    expect(carteDepuisIa(carte).noeuds.length).toBeGreaterThan(3);
  });
});

describe("le menu d'IA d'une note", () => {
  const choisies: ActionNoteIa[] = [];
  const entrees = (selection: boolean) => ordonner(entreesIaNote((a) => choisies.push(a), { selection }));

  it("six actions ; « Développer » exige une sélection et dit pourquoi", () => {
    expect(entrees(false).map((e) => e.id)).toEqual(["ia-resumer", "ia-reecrire", "ia-developper", "ia-liens", "ia-traduire", "ia-carte"]);
    expect(entrees(false).find((e) => e.id === "ia-developper")?.desactive?.raison).toBeTruthy();
    expect(entrees(true).find((e) => e.id === "ia-developper")?.desactive).toBeUndefined();
  });

  it("trois tons, six langues, et chaque entrée rend l'action choisie", () => {
    const reecrire = entrees(true).find((e) => e.id === "ia-reecrire")!;
    expect(reecrire.sousMenu?.map((e) => e.id)).toEqual(["ia-reecrire-clair", "ia-reecrire-court", "ia-reecrire-pro"]);
    reecrire.sousMenu![1].executer!();
    const traduire = entrees(true).find((e) => e.id === "ia-traduire")!;
    expect(traduire.sousMenu).toHaveLength(6);
    traduire.sousMenu![0].executer!();
    expect(choisies).toEqual([{ genre: "reecrire", ton: "court" }, { genre: "traduire", cible: "en" }]);
  });
});
