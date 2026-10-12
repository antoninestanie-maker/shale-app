import { describe, expect, it } from "vitest";
import { etapeAAjouter, rangEnDernier } from "./ajout";
import { carteDObjectif } from "./carte";
import { CONTEXTE_VIDE } from "./contexte";
import { filDObjectif } from "./fil";
import { objectif, tache } from "./objectif.testutil";
import { mesurer, type SourcesProgression } from "./progression";
import {
  cleDeNature,
  etapesTriees,
  hauteurSous,
  natureDe,
  niveauDe,
  peutAjouterEtape,
  peutRangerSous,
  premierAccueil,
} from "./structure";

/**
 * ⭐ « ÉTAPE », ET « PHASE » QUAND ELLE EN CONTIENT D'AUTRES (2026-10-12).
 *
 * Antonin a validé la proposition du chantier « étapes cochables » : « garder
 * "étape" comme seul mot affiché, "phase" seulement quand une étape en
 * contient d'autres, et retirer "sous-objectif" de l'écran » — « je valide ».
 * C'est donc le CONTENU qui nomme une ligne, plus le genre choisi à la
 * création (`goals.is_milestone`, qui reste en base et n'est plus lu).
 */

const racine = objectif({ id: 1, uid: "g-1", title: "Lancer la boutique" });
const etape = (id: number, parent: number, p: Parameters<typeof objectif>[0] = {}) =>
  objectif({ id, uid: `g-${id}`, parent_goal_id: parent, title: `étape ${id}`, ...p });

describe("le nom d'une ligne vient de ce qu'elle contient", () => {
  it("la racine est l'objectif ; une ligne sans étape dessous est une étape ; avec, une phase", () => {
    const goals = [racine, etape(2, 1), etape(3, 1), etape(4, 3)];
    expect(goals.map((g) => natureDe(g, goals))).toEqual(["objectif", "etape", "phase", "etape"]);
  });

  it("⭐ le genre stocké ne nomme plus : une « phase » vide est une étape, un « sous-objectif » qui porte une étape est une phase", () => {
    const phaseVide = etape(2, 1, { is_milestone: 1 });
    const porteuse = etape(3, 1, { is_milestone: 0 });
    const goals = [racine, phaseVide, porteuse, etape(4, 3)];
    expect(natureDe(phaseVide, goals)).toBe("etape");
    expect(natureDe(porteuse, goals)).toBe("phase");
  });

  it("des tâches ne font pas une phase : une étape garnie de tâches reste une étape", () => {
    // `natureDe` ne regarde que les étapes — une phase REGROUPE des étapes.
    const goals = [racine, etape(2, 1)];
    expect(natureDe(goals[1], goals)).toBe("etape");
  });

  it("une phase dont la dernière étape s'en va redevient une étape, à la lecture", () => {
    const avec = [racine, etape(2, 1, { is_milestone: 1 }), etape(3, 2)];
    expect(natureDe(avec[1], avec)).toBe("phase");
    const sans = avec.filter((g) => g.id !== 3); // jetée, ou convertie en tâche
    expect(natureDe(sans[1], sans)).toBe("etape");
  });

  it("la clé enregistrée dans une carte ne change pas : « sous-objectif » y désigne une étape", () => {
    expect((["objectif", "phase", "etape"] as const).map(cleDeNature)).toEqual(["objectif", "phase", "sous-objectif"]);
  });
});

describe("ajouter une étape : trois niveaux, sans genre à choisir", () => {
  const goals = [racine, etape(2, 1), etape(3, 2)];

  it("sous l'objectif et sous une étape de premier niveau, jamais au fond", () => {
    expect(goals.map((g) => peutAjouterEtape(g, goals))).toEqual([true, true, false]);
  });

  it("⭐ ajouter une étape SOUS une étape en fait une phase — par son contenu, et la colonne suit", () => {
    const seule = [racine, etape(2, 1)];
    const plan = etapeAAjouter(seule[1], "  Tourner  ", seule, { priorite: "high" })!;
    expect(plan.input).toMatchObject({
      title: "Tourner",
      parent_goal_id: 2,
      is_milestone: 0, // une étape neuve ne contient rien
      manual_progress: 0,
      deadline: null,
      priority: "high",
      scope: seule[1].scope,
      position: 0,
    });
    // La colonne `is_milestone` du parent est tenue d'accord, pour un appareil d'avant.
    expect(plan.promouvoir).toBe(true);
    // Une fois l'étape écrite, le parent EST une phase — sans lire la colonne.
    const apres = [...seule, etape(3, 2)];
    expect(natureDe(apres[1], apres)).toBe("phase");
  });

  it("sous l'objectif, rien à promouvoir ; sous une phase déjà marquée, rien à réécrire", () => {
    expect(etapeAAjouter(racine, "A", [racine])!.promouvoir).toBe(false);
    const dejaPhase = [racine, etape(2, 1, { is_milestone: 1 })];
    expect(etapeAAjouter(dejaPhase[1], "A", dejaPhase)!.promouvoir).toBe(false);
  });

  it("au fond, ou sans titre : rien ne s'écrit", () => {
    expect(etapeAAjouter(goals[2], "Trop profond", goals)).toBeNull();
    expect(etapeAAjouter(racine, "   ", goals)).toBeNull();
  });

  it("elle naît en DERNIER rang, après la plus haute position de ses sœurs", () => {
    const soeurs = [racine, etape(2, 1, { position: 0 }), etape(3, 1, { position: 7 })];
    expect(rangEnDernier(1, soeurs)).toBe(8);
    expect(etapeAAjouter(racine, "Suite", soeurs)!.input.position).toBe(8);
  });

  it("une étape dessinée au fond d'une carte remonte au premier accueil possible", () => {
    expect(premierAccueil(goals[2], goals)?.id).toBe(2);
    expect(premierAccueil(goals[1], goals)?.id).toBe(2);
    expect(premierAccueil(racine, goals)?.id).toBe(1);
  });
});

describe("ranger une ligne sous une autre (fenêtre « Modifier… ») ne dépasse pas trois niveaux", () => {
  const goals = [racine, etape(2, 1), etape(3, 2), etape(4, 1), objectif({ id: 9, uid: "g-9" })];

  it("la hauteur de ce qui pend sous une ligne", () => {
    expect([1, 2, 3, 4].map((id) => hauteurSous({ id }, goals))).toEqual([2, 1, 0, 0]);
  });

  it("une étape nue se range sous un objectif ou sous une étape de premier niveau", () => {
    expect(peutRangerSous(goals[4], goals[3], goals)).toBe(true); // sous un autre objectif
    expect(peutRangerSous(goals[1], goals[3], goals)).toBe(true); // sous une étape de niveau 1
    expect(peutRangerSous(goals[2], goals[3], goals)).toBe(false); // sous le fond
  });

  it("⚠️ une PHASE ne se range pas sous une étape : ses étapes tomberaient au niveau 3", () => {
    expect(peutRangerSous(goals[3], goals[1], goals)).toBe(false);
    expect(peutRangerSous(goals[4], goals[1], goals)).toBe(true);
  });

  it("une ligne neuve (rien dessous) : sous un objectif ou une étape de premier niveau", () => {
    expect(goals.map((g) => peutRangerSous(g, null, goals))).toEqual([true, true, false, true, true]);
  });
});

/**
 * « Les lignes existantes s'affichent selon ce qu'elles contiennent (une
 * "phase" vide stockée s'affiche comme une étape : vérifie que rien ne casse —
 * l'ordre, le fil, l'avancement, la carte mentale). »
 */
describe("une « phase » stockée mais vide : rien ne casse", () => {
  const phaseVide = etape(2, 1, { is_milestone: 1, position: 0 });
  const garnie = etape(3, 1, { is_milestone: 0, position: 1 });
  const goals = [racine, phaseVide, garnie];
  const s: SourcesProgression = {
    goals,
    tasks: [tache({ id: 1, goal_id: 3 })],
    completions: [],
    maintenant: "2099-01-01 00:00",
  };
  const pareil = (milestone: number): SourcesProgression => ({
    ...s,
    goals: goals.map((g) => (g.id === 2 ? { ...g, is_milestone: milestone } : g)),
  });

  it("l'ordre ne lit pas le genre", () => {
    expect(etapesTriees(1, goals).map((g) => g.id)).toEqual([2, 3]);
    expect(niveauDe(phaseVide, goals)).toBe(1);
  });

  it("l'avancement non plus : même chiffre, que la colonne dise 0 ou 1", () => {
    const m1 = mesurer(racine, pareil(1));
    const m0 = mesurer(racine, pareil(0));
    expect(m1).toEqual(m0);
    expect(m1.pct).toBe(0);
    expect(mesurer(phaseVide, s).origine).toEqual({ type: "unite", faite: false });
  });

  it("le fil : le même nœud, le même tronçon", () => {
    const fil = (src: SourcesProgression) =>
      filDObjectif({
        etapes: etapesTriees(1, src.goals),
        mesures: new Map(src.goals.map((g) => [g.id, mesurer(g, src)])),
        directs: { presents: false, total: 0, faits: 0 },
        atteint: false,
      });
    expect(fil(pareil(1))).toEqual(fil(pareil(0)));
  });

  it("la carte mentale la dessine comme une étape (la clé « sous-objectif »), pas comme une phase", () => {
    const carte = carteDObjectif(racine, { goals, tasks: s.tasks, habits: [], contexte: CONTEXTE_VIDE, positions: {} });
    expect(carte.noeuds.find((n) => n.id === "g2")?.genre).toBe("sous-objectif");
    // … et une étape qui en porte une autre s'y dessine en phase, quel que soit le genre stocké.
    const avec = [...goals, etape(4, 3)];
    const carte2 = carteDObjectif(racine, { goals: avec, tasks: [], habits: [], contexte: CONTEXTE_VIDE, positions: {} });
    expect(carte2.noeuds.find((n) => n.id === "g3")?.genre).toBe("phase");
  });
});
