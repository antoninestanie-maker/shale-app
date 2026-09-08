import { describe, expect, it } from "vitest";
import {
  agencer,
  ajouterEnfant,
  ajouterFrere,
  annuler,
  appliquer,
  basculerPli,
  carteVide,
  comptePlie,
  COULEURS_BRANCHE,
  cartesDuHtml,
  deplacer,
  ecrireCarte,
  echapperAttribut,
  enfantsDe,
  historiqueDe,
  lignesDe,
  lireCarte,
  noeudDe,
  poserCote,
  poserReference,
  rafraichirReferences,
  refsDeCarte,
  refsDesCartes,
  rendreSvg,
  renommer,
  retablir,
  supprimerNoeud,
  visible,
  voisin,
  type Carte,
} from "./carte";
import { diffMentions, uidArete, type AreteVoulue } from "./liens";
import { extraireMentions, jetonMention } from "./mentions";
import type { ObjectLink } from "./types";

/** Une petite carte de travail : une racine et trois branches, dont une peuplée. */
function carteEssai(): Carte {
  let c = carteVide("Plan de trading");
  c = ajouterEnfant(c, "r").carte; // n1
  c = ajouterFrere(c, "n1").carte; // n2
  c = ajouterFrere(c, "n2").carte; // n3
  c = renommer(c, "n1", "Risque");
  c = renommer(c, "n2", "Psychologie");
  c = renommer(c, "n3", "Setups");
  c = ajouterEnfant(c, "n1").carte; // n4
  c = ajouterFrere(c, "n4").carte; // n5
  c = renommer(c, "n4", "1 % par trade");
  c = renommer(c, "n5", "Stop toujours posé");
  return c;
}

describe("le modèle", () => {
  it("part d'une racine unique, et la racine ne se supprime pas", () => {
    const c = carteVide("Racine");
    expect(c.noeuds).toHaveLength(1);
    expect(supprimerNoeud(c, "r")).toBe(c);
  });

  it("Entrée ajoute un FRÈRE, Tab ajoute un ENFANT", () => {
    let c = carteVide();
    const enfant = ajouterEnfant(c, "r");
    c = enfant.carte;
    expect(noeudDe(c, enfant.neuf)?.parent).toBe("r");
    const frere = ajouterFrere(c, enfant.neuf);
    expect(noeudDe(frere.carte, frere.neuf)?.parent).toBe("r");
  });

  it("Entrée sur la RACINE ajoute un enfant — une racine n'a pas de frère", () => {
    const c = carteVide();
    const { carte, neuf } = ajouterFrere(c, "r");
    expect(noeudDe(carte, neuf)?.parent).toBe("r");
  });

  it("supprimer un nœud emporte tout son sous-arbre", () => {
    const c = supprimerNoeud(carteEssai(), "n1");
    expect(noeudDe(c, "n1")).toBeUndefined();
    expect(noeudDe(c, "n4")).toBeUndefined();
    expect(noeudDe(c, "n5")).toBeUndefined();
    expect(noeudDe(c, "n2")).toBeDefined();
  });

  it("un repli cache ses descendants et annonce combien", () => {
    const c = basculerPli(carteEssai(), "n1");
    expect(noeudDe(c, "n1")?.plie).toBe(true);
    expect(comptePlie(c, "n1")).toBe(2);
    expect(visible(c, "n4")).toBe(false);
    expect(visible(c, "n2")).toBe(true);
  });

  it("un nœud sans enfant ne se replie pas — ça ne cacherait rien", () => {
    const c = carteEssai();
    expect(basculerPli(c, "n2")).toBe(c);
  });

  it("ajouter un enfant à un nœud replié le DÉPLIE", () => {
    let c = basculerPli(carteEssai(), "n1");
    c = ajouterEnfant(c, "n1").carte;
    expect(noeudDe(c, "n1")?.plie).toBeUndefined();
  });
});

describe("le déplacement", () => {
  it("reparente et réordonne", () => {
    const c = deplacer(carteEssai(), "n4", "n2", null);
    expect(noeudDe(c, "n4")?.parent).toBe("n2");
    expect(enfantsDe(c, "n1").map((n) => n.id)).toEqual(["n5"]);
  });

  it("⭐ REFUSE de déposer un nœud dans son PROPRE sous-arbre", () => {
    const c = carteEssai();
    // n4 est un enfant de n1 : y déposer n1 détacherait la branche de la carte.
    expect(deplacer(c, "n1", "n4", null)).toBe(c);
  });

  it("la racine ne se déplace pas", () => {
    const c = carteEssai();
    expect(deplacer(c, "r", "n1", null)).toBe(c);
  });
});

describe("la relecture d'un JSON abîmé", () => {
  it("rend null plutôt que de laisser passer une exception", () => {
    expect(lireCarte("")).toBeNull();
    expect(lireCarte("{pas du json")).toBeNull();
    expect(lireCarte("[]")).toBeNull();
    expect(lireCarte('{"noeuds":[]}')).toBeNull();
  });

  it("raccroche à la racine un nœud dont le parent n'existe plus", () => {
    const c = lireCarte('{"v":1,"noeuds":[{"id":"r","parent":null,"texte":"R"},{"id":"a","parent":"fantome","texte":"A"}]}');
    expect(c?.noeuds.find((n) => n.id === "a")?.parent).toBe("r");
  });

  it("⭐ casse un CYCLE au lieu de boucler à l'infini", () => {
    const c = lireCarte(
      '{"v":1,"noeuds":[{"id":"r","parent":null,"texte":"R"},{"id":"a","parent":"b","texte":"A"},{"id":"b","parent":"a","texte":"B"}]}',
    );
    expect(c).not.toBeNull();
    // Sans le garde, `agencer` ne rendrait jamais la main.
    expect(() => agencer(c!)).not.toThrow();
  });

  it("écarte une référence dont la famille est inconnue", () => {
    const c = lireCarte('{"v":1,"noeuds":[{"id":"r","parent":null,"texte":"R","ref":{"kind":"licorne","uid":"x"}}]}');
    expect(c?.noeuds[0].ref).toBeUndefined();
  });

  it("fait l'aller-retour sans rien perdre", () => {
    const avant = poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "Plan de risque");
    const apres = lireCarte(ecrireCarte(avant));
    expect(apres).toEqual(avant);
  });
});

describe("⭐ le déterminisme de l'agencement", () => {
  it("la même carte rend EXACTEMENT le même SVG, deux fois de suite", () => {
    const c = carteEssai();
    expect(rendreSvg(c, { mode: "theme" })).toBe(rendreSvg(c, { mode: "theme" }));
  });

  it("une carte enregistrée puis relue se redessine à l'identique", () => {
    const c = carteEssai();
    const relue = lireCarte(ecrireCarte(c))!;
    expect(rendreSvg(relue, { mode: "theme" })).toBe(rendreSvg(c, { mode: "theme" }));
  });

  it("l'ordre des nœuds dans le tableau EST l'ordre des frères", () => {
    const c = carteEssai();
    expect(enfantsDe(c, "r").map((n) => n.texte)).toEqual(["Risque", "Psychologie", "Setups"]);
  });

  it("les branches se répartissent de part et d'autre, en alternance", () => {
    const a = agencer(carteEssai());
    expect(a.boites.get("n1")!.cote).toBe(1);
    expect(a.boites.get("n2")!.cote).toBe(-1);
    expect(a.boites.get("n3")!.cote).toBe(1);
    // un enfant reste du côté de sa branche
    expect(a.boites.get("n4")!.cote).toBe(1);
  });

  it("⭐ insérer une branche au milieu ne déplace ni ne repeint les autres", () => {
    // Le défaut d'avant : le côté et la couleur se déduisaient du RANG. Insérer
    // une branche en deuxième position décalait tous les rangs suivants, donc
    // faisait traverser la carte à toutes les branches d'après. Ajouter une
    // idée réorganisait le travail déjà fait.
    const c = carteEssai();
    const avant = agencer(c);
    const temoin = ["n2", "n3"].map((id) => ({
      id,
      cote: avant.boites.get(id)!.cote,
      couleur: avant.boites.get(id)!.couleur,
    }));

    const apres = agencer(ajouterFrere(c, "n1").carte);
    for (const t of temoin) {
      expect(apres.boites.get(t.id)!.cote).toBe(t.cote);
      expect(apres.boites.get(t.id)!.couleur).toBe(t.couleur);
    }
  });

  it("la branche neuve naît du côté le moins chargé, dans la couleur la moins servie", () => {
    // Trois branches : droite, gauche, droite. La quatrième rééquilibre.
    const { carte, neuf } = ajouterFrere(carteEssai(), "n3");
    const a = agencer(carte);
    expect(a.boites.get(neuf)!.cote).toBe(-1);
    expect(a.boites.get(neuf)!.couleur).toBe("green");
    expect(new Set(["n1", "n2", "n3", neuf].map((id) => a.boites.get(id)!.couleur)).size).toBe(4);
  });

  it("une carte écrite AVANT ce champ se rouvre exactement telle qu'elle était", () => {
    // Le JSON d'une version antérieure : aucune branche ne porte de côté.
    const ancienne = JSON.stringify({
      v: 1,
      noeuds: [
        { id: "r", parent: null, texte: "Racine" },
        { id: "a", parent: "r", texte: "Une" },
        { id: "b", parent: "r", texte: "Deux" },
        { id: "c", parent: "r", texte: "Trois" },
      ],
    });
    const a = agencer(lireCarte(ancienne)!);
    expect([a.boites.get("a")!.cote, a.boites.get("b")!.cote, a.boites.get("c")!.cote]).toEqual([1, -1, 1]);
    expect([a.boites.get("a")!.couleur, a.boites.get("b")!.couleur, a.boites.get("c")!.couleur]).toEqual([
      COULEURS_BRANCHE[0],
      COULEURS_BRANCHE[1],
      COULEURS_BRANCHE[2],
    ]);
  });

  it("promu branche, un nœud reçoit un côté ; redescendu, il le rend", () => {
    const promu = deplacer(carteEssai(), "n4", "r", null);
    expect(noeudDe(promu, "n4")!.cote).toBeDefined();
    expect(agencer(promu).boites.get("n4")!.profondeur).toBe(1);

    const redescendu = deplacer(promu, "n4", "n2", null);
    expect(noeudDe(redescendu, "n4")!.cote).toBeUndefined();
    // et il suit désormais la branche qui le porte, sans hésiter
    expect(agencer(redescendu).boites.get("n4")!.cote).toBe(agencer(redescendu).boites.get("n2")!.cote);
  });

  it("une branche envoyée de l'autre côté emmène tout son sous-arbre", () => {
    const c = poserCote(carteEssai(), "n1", -1);
    const a = agencer(c);
    expect(a.boites.get("n1")!.cote).toBe(-1);
    expect(a.boites.get("n4")!.cote).toBe(-1); // l'enfant suit sa branche
    expect(a.boites.get("n5")!.cote).toBe(-1);
    // et la couleur, elle, ne bouge pas : changer de côté n'est pas renaître
    expect(a.boites.get("n1")!.couleur).toBe(agencer(carteEssai()).boites.get("n1")!.couleur);
  });

  it("seule une branche a un côté à changer", () => {
    const c = carteEssai();
    expect(poserCote(c, "n4", -1)).toBe(c); // un nœud profond
    expect(poserCote(c, "r", -1)).toBe(c); // la racine
    expect(poserCote(c, "n1", 1)).toBe(c); // déjà de ce côté-là
  });

  it("un nœud replié ne pose PAS ses descendants", () => {
    const a = agencer(basculerPli(carteEssai(), "n1"));
    expect(a.boites.has("n1")).toBe(true);
    expect(a.boites.has("n4")).toBe(false);
  });

  it("tout tient dans le cadre annoncé", () => {
    const a = agencer(carteEssai());
    for (const b of a.boites.values()) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(a.largeur);
      expect(b.y + b.h).toBeLessThanOrEqual(a.hauteur);
    }
  });

  it("une carte de soixante nœuds s'agence sans exploser", () => {
    let c = carteVide("Racine");
    let dernier = "r";
    for (let i = 0; i < 59; i++) {
      const r = i % 4 === 0 ? ajouterEnfant(c, dernier) : ajouterFrere(c, dernier);
      c = renommer(r.carte, r.neuf, `Nœud ${i}`);
      dernier = r.neuf;
    }
    expect(c.noeuds).toHaveLength(60);
    const a = agencer(c);
    expect(a.boites.size).toBe(60);
    // Le poids est le sujet du chantier : on le garde sous surveillance.
    expect(ecrireCarte(c).length).toBeLessThan(8000);
  });
});

describe("le découpage du texte", () => {
  it("ne coupe jamais un mot qui tient sur une ligne", () => {
    const { lignes } = lignesDe("un plan de risque écrit noir sur blanc");
    for (const l of lignes) expect(l).not.toMatch(/^\S*-$/);
    expect(lignes.join(" ")).toBe("un plan de risque écrit noir sur blanc");
  });

  it("s'arrête à trois lignes et pose une ellipse", () => {
    const { lignes, tronque } = lignesDe("mot ".repeat(80));
    expect(lignes).toHaveLength(3);
    expect(tronque).toBe(true);
    expect(lignes[2].endsWith("…")).toBe(true);
  });

  it("⭐ le texte COMPLET d'un nœud tronqué reste dans le SVG, via <title>", () => {
    const long = "une phrase interminable qui ne tiendra jamais dans une boîte de carte mentale " +
      "mais qui doit rester retrouvable par la recherche de l'application";
    const c = renommer(carteVide(), "r", long);
    const svg = rendreSvg(c, { mode: "theme" });
    expect(svg).toContain("<title>");
    expect(svg).toContain(long);
  });

  it("le texte d'un nœud court est dans le SVG — donc dans plainText, donc dans FTS5", () => {
    const svg = rendreSvg(carteEssai(), { mode: "theme" });
    expect(svg).toContain("Psychologie");
    expect(svg).toContain("1 % par trade");
  });
});

describe("le rendu SVG", () => {
  it("à l'écran, les couleurs sont des VARIABLES de thème", () => {
    const svg = rendreSvg(carteEssai(), { mode: "theme" });
    expect(svg).toContain("var(--color-blue)");
    expect(svg).toContain("var(--color-text)");
    expect(svg).not.toContain("#ffffff");
  });

  it("⭐ à l'export, elles sont APLATIES sur un fond opaque", () => {
    const svg = rendreSvg(carteEssai(), { mode: "export" });
    expect(svg).not.toContain("var(--color-");
    expect(svg).toContain('fill="#ffffff"');
    expect(svg).toMatch(/^<svg[^>]*><rect x="0" y="0"/);
  });

  it("le rouge n'est JAMAIS attribué d'office à une branche", () => {
    expect(COULEURS_BRANCHE).not.toContain("red");
    let c = carteVide("R");
    for (let i = 0; i < 8; i++) c = ajouterEnfant(c, "r").carte;
    const svg = rendreSvg(c, { mode: "theme" });
    expect(svg).not.toContain("var(--color-red)");
  });

  it("échappe ce qui ressemble à du balisage", () => {
    const c = renommer(carteVide(), "r", '<script>alert("x")</script>');
    const svg = rendreSvg(c, { mode: "theme" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("n'écrit AUCUNE sélection dans le rendu enregistré", () => {
    expect(rendreSvg(carteEssai(), { mode: "theme" })).toBe(
      rendreSvg(carteEssai(), { mode: "theme", selection: null }),
    );
  });

  it("une seule `stroke-width` par rectangle — deux seraient du balisage invalide", () => {
    const svg = rendreSvg(carteEssai(), { mode: "theme", selection: "n1" });
    for (const balise of svg.match(/<rect[^>]*>/g) ?? []) {
      expect((balise.match(/stroke-width=/g) ?? []).length).toBeLessThanOrEqual(1);
    }
  });
});

describe("⭐ les nœuds-références", () => {
  const titres = new Map([
    ["note:u-1", "Plan de risque"],
    ["knowledge:u-2", "Gestion du capital"],
  ]);
  const titreDe = (k: string, u: string) => titres.get(`${k}:${u}`) ?? null;

  it("le nœud stocke l'identité, jamais le titre", () => {
    const c = poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "Plan de risque");
    expect(noeudDe(c, "n2")?.ref).toEqual({ kind: "note", uid: "u-1" });
  });

  it("SURVIT au renommage de sa cible : le titre affiché suit, l'identité ne bouge pas", () => {
    let c = poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "Plan de risque");
    const renomme = new Map(titres);
    renomme.set("note:u-1", "Plan de risque V2");
    c = rafraichirReferences(c, (k, u) => renomme.get(`${k}:${u}`) ?? null);
    expect(noeudDe(c, "n2")?.texte).toBe("Plan de risque V2");
    expect(noeudDe(c, "n2")?.ref).toEqual({ kind: "note", uid: "u-1" });
    expect(noeudDe(c, "n2")?.mort).toBeUndefined();
  });

  it("SURVIT à la suppression de sa cible : le nœud reste, marqué mort", () => {
    let c = poserReference(carteEssai(), "n2", { kind: "note", uid: "disparue" }, "Ancienne note");
    c = rafraichirReferences(c, titreDe);
    expect(noeudDe(c, "n2")).toBeDefined();
    expect(noeudDe(c, "n2")?.mort).toBe(true);
    // Il garde son texte : une branche amputée perdrait aussi ses enfants.
    expect(noeudDe(c, "n2")?.texte).toBe("Ancienne note");
  });

  it("un nœud mort qui réapparaît redevient vivant", () => {
    let c = poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "X");
    c = rafraichirReferences(c, () => null);
    expect(noeudDe(c, "n2")?.mort).toBe(true);
    c = rafraichirReferences(c, titreDe);
    expect(noeudDe(c, "n2")?.mort).toBeUndefined();
    expect(noeudDe(c, "n2")?.texte).toBe("Plan de risque");
  });

  it("ne rend une carte NEUVE que s'il y a quelque chose à changer", () => {
    const c = carteEssai();
    expect(rafraichirReferences(c, titreDe)).toBe(c);
  });

  it("dédoublonne : deux nœuds vers la même cible ne font qu'une référence", () => {
    let c = poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "A");
    c = poserReference(c, "n3", { kind: "note", uid: "u-1" }, "A");
    expect(refsDeCarte(c)).toHaveLength(1);
  });
});

describe("⭐ les cartes dans un corps de note", () => {
  const figureDe = (c: Carte) =>
    `<figure data-mindmap="${echapperAttribut(ecrireCarte(c))}"><svg></svg></figure>`;

  it("se relit depuis le HTML, à travers l'échappement de l'attribut", () => {
    const c = poserReference(carteEssai(), "n2", { kind: "knowledge", uid: "u-2" }, "Capital");
    const html = `<p>avant</p>${figureDe(c)}<p>après</p>`;
    expect(cartesDuHtml(html)).toHaveLength(1);
    expect(refsDesCartes(html)).toEqual([{ kind: "knowledge", uid: "u-2" }]);
  });

  it("ne rend rien sur un corps sans carte, sans même analyser", () => {
    expect(cartesDuHtml("<p>une note ordinaire</p>")).toEqual([]);
    expect(refsDesCartes("")).toEqual([]);
  });

  it("survit à une carte illisible sans emporter les autres", () => {
    const bonne = figureDe(poserReference(carteEssai(), "n2", { kind: "note", uid: "u-1" }, "A"));
    const html = `<figure data-mindmap="{cass&quot;e"></figure>${bonne}`;
    expect(refsDesCartes(html)).toEqual([{ kind: "note", uid: "u-1" }]);
  });

  it("dédoublonne entre PLUSIEURS cartes du même corps", () => {
    const c = poserReference(carteVide("A"), "r", { kind: "note", uid: "u-1" }, "A");
    expect(refsDesCartes(figureDe(c) + figureDe(c))).toHaveLength(1);
  });
});

describe("⭐ LA GARANTIE DE LA PORTE 3 — une carte ne détruit aucune arête de mention", () => {
  const SOURCE = { kind: "note" as const, uid: "note-source" };
  const arete = (kind: "note" | "knowledge", uid: string): AreteVoulue => ({
    from_kind: SOURCE.kind,
    from_uid: SOURCE.uid,
    to_kind: kind,
    to_uid: uid,
    origin: "mention",
  });
  const existante = (a: AreteVoulue, id: number): ObjectLink => ({
    id,
    uid: uidArete({ kind: a.from_kind, uid: a.from_uid }, { kind: a.to_kind, uid: a.to_uid }),
    from_kind: a.from_kind,
    from_uid: a.from_uid,
    to_kind: a.to_kind,
    to_uid: a.to_uid,
    origin: a.origin,
    created_at: "2026-09-07 10:00:00",
  });

  /**
   * ⭐ CE QUE L'APPELANT DOIT FAIRE, ET QUI EST TOUT LE CORRECTIF : l'ensemble
   * VOULU est l'UNION des jetons `@` du texte et des références des cartes,
   * calculée en une fois sur tout le corps. C'est ce que fait `useLiens`.
   */
  const voulues = (html: string): AreteVoulue[] => [
    ...extraireMentions(html).map((m) => arete(m.kind as "note" | "knowledge", m.uid)),
    ...refsDesCartes(html).map((r) => arete(r.kind as "note" | "knowledge", r.uid)),
  ];

  const carteVers = (uid: string) => {
    const c = poserReference(carteVide("Carte"), "r", { kind: "note", uid }, "Cible");
    return `<figure data-mindmap="${echapperAttribut(ecrireCarte(c))}"><svg></svg></figure>`;
  };

  it("une mention @ ET un nœud de carte produisent DEUX arêtes", () => {
    const html = `<p>voir ${jetonMention("note", "cite-par-mention", "A")}</p>${carteVers("cite-par-carte")}`;
    const { aCreer, aSupprimer } = diffMentions([], voulues(html));
    expect(aCreer.map((a) => a.to_uid).sort()).toEqual(["cite-par-carte", "cite-par-mention"]);
    expect(aSupprimer).toEqual([]);
  });

  it("⭐ enregistrer la carte NE DÉTRUIT PAS l'arête créée par un @ du même corps", () => {
    const mention = arete("note", "cite-par-mention");
    const parCarte = arete("note", "cite-par-carte");
    const deja = [existante(mention, 1), existante(parCarte, 2)];
    // La carte change (le nœud pointe ailleurs), la mention du texte ne bouge pas.
    const html = `<p>voir ${jetonMention("note", "cite-par-mention", "A")}</p>${carteVers("nouvelle-cible")}`;
    const { aCreer, aSupprimer } = diffMentions(deja, voulues(html));
    expect(aCreer.map((a) => a.to_uid)).toEqual(["nouvelle-cible"]);
    // SEULE l'ancienne arête de la carte disparaît. Celle du @ survit.
    expect(aSupprimer.map((l) => l.to_uid)).toEqual(["cite-par-carte"]);
  });

  it("⭐ et l'inverse : retirer une mention @ ne détruit pas l'arête d'un nœud de carte", () => {
    const mention = arete("note", "cite-par-mention");
    const parCarte = arete("note", "cite-par-carte");
    const deja = [existante(mention, 1), existante(parCarte, 2)];
    const html = `<p>le @ a été effacé</p>${carteVers("cite-par-carte")}`;
    const { aCreer, aSupprimer } = diffMentions(deja, voulues(html));
    expect(aCreer).toEqual([]);
    expect(aSupprimer.map((l) => l.to_uid)).toEqual(["cite-par-mention"]);
  });

  it("un rattachement MANUEL survit à l'enregistrement d'une carte", () => {
    const manuel: ObjectLink = { ...existante(arete("knowledge", "à-la-main"), 3), origin: "manual" };
    const { aSupprimer } = diffMentions([manuel], voulues(carteVers("autre")));
    expect(aSupprimer).toEqual([]);
  });

  it("l'origine reste `mention` — le CHECK du schéma n'accepte rien d'autre", () => {
    for (const a of voulues(carteVers("x"))) expect(a.origin).toBe("mention");
  });
});

describe("l'historique d'annulation", () => {
  it("annule et rétablit", () => {
    let h = historiqueDe(carteVide("A"));
    h = appliquer(h, renommer(h.present, "r", "B"));
    h = appliquer(h, renommer(h.present, "r", "C"));
    expect(h.present.noeuds[0].texte).toBe("C");
    h = annuler(h);
    expect(h.present.noeuds[0].texte).toBe("B");
    h = annuler(h);
    expect(h.present.noeuds[0].texte).toBe("A");
    h = retablir(h);
    expect(h.present.noeuds[0].texte).toBe("B");
  });

  it("ne fait rien quand il n'y a plus rien à annuler", () => {
    const h = historiqueDe(carteVide("A"));
    expect(annuler(h)).toBe(h);
    expect(retablir(h)).toBe(h);
  });

  it("⭐ un état IDENTIQUE n'entre pas dans la pile", () => {
    let h = historiqueDe(carteVide("A"));
    h = appliquer(h, renommer(h.present, "r", "A"));
    expect(h.passe).toHaveLength(0);
  });

  it("une modification neuve efface le futur", () => {
    let h = historiqueDe(carteVide("A"));
    h = appliquer(h, renommer(h.present, "r", "B"));
    h = annuler(h);
    h = appliquer(h, renommer(h.present, "r", "C"));
    expect(h.futur).toEqual([]);
    expect(retablir(h)).toBe(h);
  });

  it("ne garde pas indéfiniment le passé", () => {
    let h = historiqueDe(carteVide("0"));
    for (let i = 1; i <= 200; i++) h = appliquer(h, renommer(h.present, "r", String(i)));
    expect(h.passe.length).toBeLessThanOrEqual(60);
    expect(h.present.noeuds[0].texte).toBe("200");
  });
});

describe("la navigation au clavier", () => {
  it("haut et bas restent dans la fratrie", () => {
    const c = carteEssai();
    expect(voisin(c, "n4", "bas")).toBe("n5");
    expect(voisin(c, "n5", "haut")).toBe("n4");
    expect(voisin(c, "n4", "haut")).toBeNull();
  });

  it("⭐ ne saute pas d'un côté de la carte à l'autre", () => {
    const c = carteEssai();
    // n1 et n3 sont à droite, n2 à gauche : descendre depuis n1 mène à n3.
    expect(voisin(c, "n1", "bas")).toBe("n3");
    expect(voisin(c, "n2", "bas")).toBeNull();
  });

  it("⭐ les flèches suivent ce qu'on VOIT, pas la structure de l'arbre", () => {
    const c = carteEssai();
    // n1 est à DROITE : ses enfants sont à droite, son parent à gauche.
    expect(voisin(c, "n1", "droite")).toBe("n4");
    expect(voisin(c, "n1", "gauche")).toBe("r");
    // n2 est à GAUCHE : c'est l'inverse, sinon la navigation s'inverse au milieu.
    const avecEnfant = ajouterEnfant(c, "n2");
    expect(voisin(avecEnfant.carte, "n2", "gauche")).toBe(avecEnfant.neuf);
    expect(voisin(avecEnfant.carte, "n2", "droite")).toBe("r");
  });

  it("un nœud replié ne laisse pas entrer dans ce qu'il cache", () => {
    const c = basculerPli(carteEssai(), "n1");
    expect(voisin(c, "n1", "droite")).toBeNull();
  });

  it("depuis la racine, on part vers la première branche du côté demandé", () => {
    const c = carteEssai();
    expect(voisin(c, "r", "droite")).toBe("n1");
    expect(voisin(c, "r", "gauche")).toBe("n2");
  });
});
