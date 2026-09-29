import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  agencer,
  ajouterEnfant,
  ajouterFrere,
  basculerPli,
  blocCarte,
  carteVide,
  cartesDuHtml,
  centreLogique,
  deplacer,
  ecrireCarte,
  enfantsDe,
  glisserNoeud,
  lireCarte,
  noeudDe,
  poserCote,
  poserReference,
  positionsManuelles,
  rafraichirReferences,
  rendreSvg,
  renommer,
  reorganiser,
  supprimerNoeud,
  type Carte,
} from "./carte";

/**
 * ⭐ Les positions posées à la main (chantier du 2026-09-29).
 *
 * Deux familles de garanties, et la première passe avant la seconde :
 *   1. une carte SANS position se dessine EXACTEMENT comme avant le chantier —
 *      les empreintes ci-dessous ont été relevées sur le code d'AVANT
 *      (`340bdf4`), puis gardées telles quelles. Un seul caractère de
 *      différence dans le SVG d'une carte ancienne les fait tomber ;
 *   2. un nœud posé à la main ne bouge plus JAMAIS tout seul (PIEGES § 9.13).
 */

const empreinte = (s: string) => createHash("sha256").update(s).digest("hex").slice(0, 16);

function essai(): Carte {
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

/** Repli, texte tronqué, référence vivante, référence morte, branche envoyée à gauche. */
function riche(): Carte {
  let c = essai();
  c = ajouterEnfant(c, "n2").carte; // n6
  c = renommer(c, "n6", "Un texte assez long pour passer sur plusieurs lignes et même être tronqué à la fin du troisième rang");
  c = ajouterEnfant(c, "n6").carte;
  c = basculerPli(c, "n6");
  c = poserReference(c, "n3", { kind: "note", uid: "u-1" }, "Note citée");
  c = ajouterEnfant(c, "n5").carte; // n8
  c = poserReference(c, "n8", { kind: "task", uid: "u-2" }, "Tâche morte");
  c = rafraichirReferences(c, (_k, u) => (u === "u-2" ? null : "Note citée"));
  c = poserCote(c, "n1", -1);
  return c;
}

/** Douze branches de quatre feuilles : l'empilement dans tous ses états. */
function grande(): Carte {
  let c = carteVide("Racine");
  for (let i = 0; i < 12; i++) c = ajouterEnfant(c, "r").carte;
  const branches = enfantsDe(c, "r").map((n) => n.id);
  for (const b of branches) for (let j = 0; j < 4; j++) c = ajouterEnfant(c, b).carte;
  return { ...c, noeuds: c.noeuds.map((n, i) => ({ ...n, texte: n.texte || `Nœud ${i}` })) };
}

describe("⭐ une carte SANS position se dessine exactement comme avant le chantier", () => {
  // Relevées sur `340bdf4`, AVANT la moindre ligne de ce chantier :
  // [thème, export, thème avec sélection et suppression armée, JSON].
  const AVANT: Record<string, [string, string, string, string]> = {
    essai: ["6cc63c398568a9f8", "62cc0d223dbd1052", "9136115e37edbb8d", "1ed23a15768fc53c"],
    // ⚠️ CHANGÉE EXPRÈS le 2026-09-29 (types de nœud) : « riche » cite une TÂCHE,
    // et un nœud qui cite une tâche EST une tâche — il prend son icône au lieu
    // de la pastille. Le test juste en dessous prouve que c'est la SEULE
    // différence : la même carte citant une note rend les empreintes d'avant.
    riche: ["87d9afb3ffa89a34", "ab86ec120a40854e", "68306a476e960e18", "2b26ad48464e4e1b"],
    grande: ["b6c509e5a0a59630", "a0d92dd779ff25ed", "ea5bccfe0bd2868d", "7ec7d6ef318e6e54"],
  };
  const cartes: Record<string, () => Carte> = { essai, riche, grande };

  it("« riche » dont la tâche citée devient une note citée : les empreintes d'AVANT le chantier", () => {
    const c = riche();
    const sansTache = { ...c, noeuds: c.noeuds.map((n) => (n.ref?.kind === "task" ? { ...n, ref: { ...n.ref, kind: "note" as const } } : n)) };
    expect([
      empreinte(rendreSvg(sansTache, { mode: "theme" })),
      empreinte(rendreSvg(sansTache, { mode: "export" })),
      empreinte(rendreSvg(sansTache, { mode: "theme", selection: "n2", peril: "n1" })),
    ]).toEqual(["e9fa2106586ab593", "9ea8d1d4c0a31252", "38f9af999c841bcf"]);
  });

  for (const [nom, fabriquer] of Object.entries(cartes)) {
    it(`« ${nom} » : SVG d'écran, SVG d'export, rendu armé et JSON identiques`, () => {
      const c = fabriquer();
      expect([
        empreinte(rendreSvg(c, { mode: "theme" })),
        empreinte(rendreSvg(c, { mode: "export" })),
        empreinte(rendreSvg(c, { mode: "theme", selection: "n2", peril: "n1" })),
        empreinte(ecrireCarte(c)),
      ]).toEqual(AVANT[nom]);
    });

    it(`« ${nom} » : relue depuis son JSON, elle se redessine au caractère près`, () => {
      const c = fabriquer();
      const relue = lireCarte(ecrireCarte(c))!;
      expect(rendreSvg(relue, { mode: "theme" })).toBe(rendreSvg(c, { mode: "theme" }));
      // ⚠️ `toEqual` et pas la chaîne : l'ordre des CLÉS d'un nœud construit en
      // mémoire (`{ ...n, cote }`) n'est pas celui que `lireCarte` reconstruit.
      // C'était déjà vrai avant le chantier, et sans effet — le rendu est identique.
      expect(relue).toEqual(c);
    });
  }
});

describe("⭐ un nœud posé à la main ne bouge plus jamais tout seul (PIEGES § 9.13)", () => {
  /** Trois nœuds posés à la main, à trois profondeurs différentes. */
  function posee(): Carte {
    let c = grande();
    c = glisserNoeud(c, "n3", 40, -25); // une branche
    c = glisserNoeud(c, "n20", -30, 60); // une feuille
    c = glisserNoeud(c, "n8", 0, 120); // une autre branche, de l'autre côté
    return c;
  }
  const releve = (c: Carte) => {
    const a = agencer(c);
    return c.noeuds.filter((n) => n.pos).map((n) => ({ id: n.id, centre: centreLogique(a, n.id) }));
  };

  it("les positions sont bien POSÉES — la carte en porte trois", () => {
    expect(positionsManuelles(posee())).toBe(3);
  });

  const gestes: [string, (c: Carte) => Carte][] = [
    ["insérer une branche au milieu", (c) => ajouterFrere(c, "n2").carte],
    ["insérer une feuille au milieu d'une fratrie", (c) => ajouterFrere(c, "n14").carte],
    ["ajouter une branche à la fin", (c) => ajouterEnfant(c, "r").carte],
    ["supprimer une branche voisine", (c) => supprimerNoeud(c, "n5")],
    ["renommer un autre nœud en très long", (c) => renommer(c, "n4", "Un intitulé beaucoup plus long qu'avant, sur trois lignes")],
    ["renommer la RACINE", (c) => renommer(c, "r", "Une racine au nom interminable pour élargir")],
    ["replier une autre branche", (c) => basculerPli(c, "n6")],
    ["glisser un AUTRE nœud très loin à gauche", (c) => glisserNoeud(c, "n10", -900, -400)],
  ];

  for (const [nom, geste] of gestes) {
    it(`${nom} : aucune position manuelle n'a changé`, () => {
      const avant = releve(posee());
      const apres = releve(geste(posee()));
      for (const p of avant) {
        expect(apres.find((q) => q.id === p.id)?.centre).toEqual(p.centre);
      }
    });
  }

  it("glisser un nœud ne change NI son parent NI l'ordre de ses frères", () => {
    const c = grande();
    const g = glisserNoeud(c, "n3", 200, 50);
    expect(g.noeuds.map((n) => [n.id, n.parent])).toEqual(c.noeuds.map((n) => [n.id, n.parent]));
  });

  it("glisser un nœud ne fait bouger AUCUN nœud qui n'est pas dans sa branche", () => {
    const c = grande();
    const a = agencer(c);
    const b = agencer(glisserNoeud(c, "n3", 200, 50));
    const branche = new Set(["n3", ...enfantsDe(c, "n3").map((e) => e.id)]);
    for (const n of c.noeuds) {
      if (branche.has(n.id)) continue;
      expect(centreLogique(b, n.id)).toEqual(centreLogique(a, n.id));
    }
  });
});

describe("le glisser d'un nœud", () => {
  it("le pose exactement de l'écart demandé, en coordonnées logiques", () => {
    const c = essai();
    const avant = centreLogique(agencer(c), "n2")!;
    const apres = centreLogique(agencer(glisserNoeud(c, "n2", 37, -12)), "n2")!;
    expect(apres.x - avant.x).toBeCloseTo(37, 1);
    expect(apres.y - avant.y).toBeCloseTo(-12, 1);
  });

  it("⭐ emporte sa descendance, qui garde sa disposition", () => {
    const c = essai(); // n4 et n5 pendent sous n1
    const a = agencer(c);
    const b = agencer(glisserNoeud(c, "n1", -60, 90));
    for (const id of ["n1", "n4", "n5"]) {
      const p = centreLogique(a, id)!;
      const q = centreLogique(b, id)!;
      expect(q.x - p.x).toBeCloseTo(-60, 1);
      expect(q.y - p.y).toBeCloseTo(90, 1);
    }
  });

  it("emporte AUSSI un descendant qu'on avait lui-même posé à la main", () => {
    let c = glisserNoeud(essai(), "n4", 0, 80);
    const avant = centreLogique(agencer(c), "n4")!;
    c = glisserNoeud(c, "n1", 100, 0);
    const apres = centreLogique(agencer(c), "n4")!;
    expect(apres.x - avant.x).toBeCloseTo(100, 1);
    expect(apres.y).toBeCloseTo(avant.y, 1);
  });

  it("la racine ne se glisse pas : elle est l'origine du repère", () => {
    const c = essai();
    expect(glisserNoeud(c, "r", 50, 50)).toBe(c);
  });

  it("un écart nul ne produit pas de carte neuve (l'historique n'y voit rien)", () => {
    const c = essai();
    expect(glisserNoeud(c, "n2", 0, 0)).toBe(c);
  });

  it("traîné de l'autre côté de son parent, l'arête part du BON bord", () => {
    // n2 est une branche de droite : on la traîne loin à gauche de la racine.
    const c = glisserNoeud(essai(), "n2", -700, 0);
    const b = agencer(c).boites.get("n2")!;
    expect(b.cote).toBe(-1);
  });

  it("le repère ne dépend pas du zoom : la position est la même, quel que soit l'agencement recadré", () => {
    const c = glisserNoeud(essai(), "n3", 10, 10);
    const pos = noeudDe(c, "n3")!.pos!;
    // Élargir la carte vers la gauche déplace l'ORIGINE du recadrage…
    const large = glisserNoeud(c, "n2", -900, 0);
    expect(agencer(large).origine.x).toBeGreaterThan(agencer(c).origine.x);
    // … et pas la position logique du nœud posé.
    expect(centreLogique(agencer(large), "n3")).toEqual(pos);
  });
});

describe("les gestes qui touchent aux positions", () => {
  it("« Réorganiser » rend TOUTE la carte à l'automatique", () => {
    const c = glisserNoeud(glisserNoeud(essai(), "n2", 50, 50), "n4", -20, 0);
    const r = reorganiser(c);
    expect(positionsManuelles(r)).toBe(0);
    expect(rendreSvg(r, { mode: "theme" })).toBe(rendreSvg(essai(), { mode: "theme" }));
  });

  it("« Réorganiser » sur une carte sans position rend la MÊME carte", () => {
    const c = essai();
    expect(reorganiser(c)).toBe(c);
  });

  it("rattacher un nœud ailleurs le rend à l'automatique, lui et sa branche", () => {
    let c = glisserNoeud(essai(), "n1", 30, 30);
    c = glisserNoeud(c, "n4", 0, 50);
    const d = deplacer(c, "n1", "n3", null);
    expect(noeudDe(d, "n1")!.pos).toBeUndefined();
    expect(noeudDe(d, "n4")!.pos).toBeUndefined();
  });

  it("⭐ « Changer de côté » passe une branche posée à la main EN MIROIR", () => {
    const c = glisserNoeud(essai(), "n2", 40, 20); // n2 est à GAUCHE (droite, gauche, droite…)
    const avant = centreLogique(agencer(c), "n2")!;
    const d = poserCote(c, "n2", 1);
    const apres = centreLogique(agencer(d), "n2")!;
    expect(apres.x).toBeCloseTo(-avant.x, 1);
    expect(apres.y).toBeCloseTo(avant.y, 1);
  });
});

describe("la position dans le JSON, et ce qui la lit", () => {
  it("fait l'aller-retour sans rien perdre", () => {
    const c = glisserNoeud(essai(), "n5", 12.34, -56.78);
    const relue = lireCarte(ecrireCarte(c))!;
    expect(noeudDe(relue, "n5")!.pos).toEqual(noeudDe(c, "n5")!.pos);
    expect(ecrireCarte(relue)).toBe(ecrireCarte(c));
  });

  it("écarte une position illisible plutôt que de la croire", () => {
    const brut = JSON.stringify({
      v: 1,
      noeuds: [
        { id: "r", parent: null, texte: "R", pos: { x: 5, y: 5 } },
        { id: "a", parent: "r", texte: "A", pos: { x: "loin", y: 3 } },
        { id: "b", parent: "r", texte: "B", pos: { x: null, y: 3 } },
        { id: "c", parent: "r", texte: "C", pos: { x: 1, y: 2 } },
      ],
    });
    const c = lireCarte(brut)!;
    expect(noeudDe(c, "r")!.pos).toBeUndefined(); // la racine est l'origine
    expect(noeudDe(c, "a")!.pos).toBeUndefined();
    expect(noeudDe(c, "b")!.pos).toBeUndefined();
    expect(noeudDe(c, "c")!.pos).toEqual({ x: 1, y: 2 });
  });

  it("⭐ le bloc enregistré dans la note ET l'export respectent la position", () => {
    const c = glisserNoeud(essai(), "n3", 0, 300);
    const html = blocCarte(c);
    const relue = cartesDuHtml(html)[0];
    expect(noeudDe(relue, "n3")!.pos).toEqual(noeudDe(c, "n3")!.pos);
    // Le rendu embarqué dans le bloc est celui de la carte posée, pas l'automatique.
    expect(html).toContain(rendreSvg(c, { mode: "theme" }));
    expect(rendreSvg(c, { mode: "theme" })).not.toBe(rendreSvg(essai(), { mode: "theme" }));
    // Et l'export place la boîte au même endroit que l'écran.
    const y = (svg: string) => /data-noeud="n3"[^>]*>(?:<title>[^<]*<\/title>)?<rect x="[\d.]+" y="([\d.]+)"/.exec(svg)?.[1];
    expect(y(rendreSvg(c, { mode: "export" }))).toBe(y(rendreSvg(c, { mode: "theme" })));
  });
});
