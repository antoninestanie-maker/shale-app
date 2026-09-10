import { describe, expect, it } from "vitest";

import {
  bornesDuCurseur,
  CASES,
  grilleSemaine,
  heuresLibres,
  heuresLibresDuJour,
  valeurProposee,
  type Categorie,
} from "./grille";
import { REGLAGES_PAR_DEFAUT, type ReglagesHoraires } from "./reglages";

/** Chantier L — la grille de la semaine du premier démarrage. */

const reglages = (p: Partial<ReglagesHoraires> = {}): ReglagesHoraires => ({
  ...REGLAGES_PAR_DEFAUT,
  ...p,
});

/** Compte les cases d'une catégorie sur toute la grille. */
const compter = (g: Categorie[][], c: Categorie): number =>
  g.reduce((n, jour) => n + jour.filter((x) => x === c).length, 0);

const LUNDI = 1;
const DIMANCHE = 0;
const SAMEDI = 6;

describe("la grille fait toujours 168 cases", () => {
  it("sept jours de vingt-quatre heures, quelles que soient les réponses", () => {
    const g = grilleSemaine(reglages());
    expect(g).toHaveLength(7);
    for (const jour of g) expect(jour).toHaveLength(24);
    expect(g.flat()).toHaveLength(CASES);
    expect(CASES).toBe(168);
  });

  it("aucune case n'est vide : le résidu est `libre`, jamais un trou", () => {
    const g = grilleSemaine(reglages({ travail: { jours: [], debut: "09:00", fin: "18:00" } }));
    expect(g.flat().every((c) => c != null)).toBe(true);
    // Sans travail ni trajets, il ne reste que du sommeil et du libre.
    expect(compter(g, "travail")).toBe(0);
    expect(compter(g, "trajet")).toBe(0);
    expect(compter(g, "sommeil") + compter(g, "libre")).toBe(168);
  });
});

describe("⭐ le sommeil franchit minuit", () => {
  it("23 h → 7 h pose huit heures par nuit, pas une seule", () => {
    const g = grilleSemaine(reglages({ coucher: "23:00", lever: "07:00" }));
    // 8 h × 7 nuits. La nuit du dimanche au lundi appartient aux deux jours,
    // mais chaque MINUTE n'est comptée qu'une fois : le total reste 56.
    expect(compter(g, "sommeil")).toBe(8 * 7);
  });

  it("les heures d'après-minuit tombent sur le JOUR SUIVANT", () => {
    const g = grilleSemaine(reglages({ coucher: "23:00", lever: "07:00" }));
    expect(g[LUNDI][23]).toBe("sommeil"); // le lundi soir
    expect(g[LUNDI][2]).toBe("sommeil"); // 2 h du matin le lundi = nuit dimanche→lundi
    expect(g[LUNDI][7]).not.toBe("sommeil"); // levé à 7 h : l'heure de 7 h est libre
  });

  it("un coucher APRÈS minuit se comporte comme n'importe quelle plage", () => {
    const g = grilleSemaine(reglages({ coucher: "01:00", lever: "09:00" }));
    expect(compter(g, "sommeil")).toBe(8 * 7);
    expect(g[LUNDI][1]).toBe("sommeil");
    expect(g[LUNDI][23]).not.toBe("sommeil");
  });
});

describe("⭐ le sommeil est incompressible : il gagne toutes les collisions", () => {
  it("une plage de travail posée sur la nuit ne mord pas dessus", () => {
    const g = grilleSemaine(
      reglages({
        coucher: "23:00",
        lever: "07:00",
        travail: { jours: [LUNDI], debut: "20:00", fin: "23:59" },
      }),
    );
    expect(g[LUNDI][23]).toBe("sommeil");
    expect(g[LUNDI][21]).toBe("travail");
  });

  it("un bloc contraint posé sur la nuit non plus", () => {
    const g = grilleSemaine(
      reglages({
        coucher: "22:00",
        lever: "06:00",
        contraints: [{ label: "Garde", jours: [SAMEDI], debut: "22:00", fin: "23:00" }],
      }),
    );
    expect(g[SAMEDI][22]).toBe("sommeil");
  });
});

describe("un bloc contraint l'emporte sur la plage de travail", () => {
  it("le trajet du matin se voit à l'intérieur des heures de bureau", () => {
    const g = grilleSemaine(
      reglages({
        travail: { jours: [LUNDI], debut: "09:00", fin: "18:00" },
        contraints: [{ label: "Trajet", jours: [LUNDI], debut: "09:00", fin: "10:00" }],
      }),
    );
    expect(g[LUNDI][9]).toBe("trajet");
    expect(g[LUNDI][10]).toBe("travail");
  });
});

describe("⭐ une case va à la catégorie qui occupe le PLUS de minutes", () => {
  it("un trajet de 08:50 à 09:10 ne mange pas deux heures entières", () => {
    const g = grilleSemaine(
      reglages({
        lever: "06:00",
        coucher: "23:00",
        travail: { jours: [], debut: "09:00", fin: "18:00" },
        contraints: [{ label: "Trajet", jours: [LUNDI], debut: "08:50", fin: "09:10" }],
      }),
    );
    // 10 minutes sur l'heure de 8 h, 10 sur celle de 9 h : ni l'une ni l'autre
    // ne bascule. Le compte d'heures libres est le seul chiffre de l'écran ;
    // « toute heure effleurée est prise » l'aurait faussé de deux heures.
    expect(g[LUNDI][8]).toBe("libre");
    expect(g[LUNDI][9]).toBe("libre");
    expect(compter(g, "trajet")).toBe(0);
  });

  it("un trajet de 08:00 à 08:45 prend son heure : il en tient la majorité", () => {
    const g = grilleSemaine(
      reglages({
        lever: "06:00",
        travail: { jours: [], debut: "09:00", fin: "18:00" },
        contraints: [{ label: "Trajet", jours: [LUNDI], debut: "08:00", fin: "08:45" }],
      }),
    );
    expect(g[LUNDI][8]).toBe("trajet");
  });

  it("⭐ à ÉGALITÉ de minutes, la case va à l'occupé — l'erreur sûre", () => {
    const g = grilleSemaine(
      reglages({
        lever: "06:00",
        coucher: "23:00",
        travail: { jours: [LUNDI], debut: "09:30", fin: "17:30" },
      }),
    );
    // 168 cases horaires ne savent pas représenter une demi-heure : une journée
    // de 8 h posée sur des demies s'affiche forcément en 7 ou en 9. On choisit 9.
    // Le compte d'heures libres BORNE LE CURSEUR : le surestimer laisserait
    // poser un objectif sur des heures qui n'existent pas. Sous-estimer ne
    // promet rien de faux.
    expect(g[LUNDI][9]).toBe("travail");
    expect(g[LUNDI][17]).toBe("travail");
    expect(g[LUNDI][18]).toBe("libre");
    expect(heuresLibresDuJour(g, LUNDI)).toBe(24 - 7 /* sommeil 23h→6h */ - 9 /* travail */);
  });
});

describe("le compte d'heures libres", () => {
  it("les valeurs par défaut laissent un solde vérifiable à la main", () => {
    const g = grilleSemaine(REGLAGES_PAR_DEFAUT);
    // 7 nuits × 8 h = 56 de sommeil ; 5 jours × 9 h = 45 de travail.
    expect(compter(g, "sommeil")).toBe(56);
    expect(compter(g, "travail")).toBe(45);
    expect(heuresLibres(g)).toBe(168 - 56 - 45);
    expect(heuresLibres(g)).toBe(67);
  });

  it("le samedi et le dimanche ne sont pas travaillés par défaut", () => {
    const g = grilleSemaine(REGLAGES_PAR_DEFAUT);
    expect(heuresLibresDuJour(g, SAMEDI)).toBe(16);
    expect(heuresLibresDuJour(g, DIMANCHE)).toBe(16);
  });

  it("les quatre catégories couvrent exactement les 168 cases", () => {
    const g = grilleSemaine(
      reglages({
        contraints: [{ label: "Trajet", jours: [1, 2, 3, 4, 5], debut: "08:00", fin: "09:00" }],
      }),
    );
    const total =
      compter(g, "sommeil") + compter(g, "travail") + compter(g, "trajet") + compter(g, "libre");
    expect(total).toBe(168);
  });
});

describe("⭐ le curseur est borné par ce que la grille laisse VRAIMENT", () => {
  it("le maximum est le nombre d'heures libres, pas un chiffre rond", () => {
    const g = grilleSemaine(REGLAGES_PAR_DEFAUT);
    expect(bornesDuCurseur(g)).toEqual({ minimum: 1, maximum: 67 });
  });

  it("une semaine sans une seule heure libre ne propose pas de curseur", () => {
    const g = grilleSemaine(
      reglages({
        coucher: "22:00",
        lever: "08:00",
        travail: { jours: [0, 1, 2, 3, 4, 5, 6], debut: "08:00", fin: "22:00" },
      }),
    );
    expect(heuresLibres(g)).toBe(0);
    expect(bornesDuCurseur(g).maximum).toBe(0);
    expect(valeurProposee(g)).toBe(0);
  });

  it("la valeur proposée reste à l'intérieur des bornes", () => {
    for (const coucher of ["21:00", "23:00", "01:00"]) {
      const g = grilleSemaine(reglages({ coucher }));
      const { minimum, maximum } = bornesDuCurseur(g);
      const v = valeurProposee(g);
      expect(v).toBeGreaterThanOrEqual(minimum);
      expect(v).toBeLessThanOrEqual(maximum);
    }
  });

  it("elle est modeste : jamais plus de dix heures, quoi qu'il reste", () => {
    const g = grilleSemaine(
      reglages({ travail: { jours: [], debut: "09:00", fin: "18:00" }, coucher: "23:00" }),
    );
    expect(heuresLibres(g)).toBe(112);
    expect(valeurProposee(g)).toBe(10);
  });
});

describe("⚠️ ce que ce module ne sait pas faire, et c'est voulu", () => {
  it("il n'expose aucun compte d'heures OCCUPÉES ni aucun ratio", async () => {
    const module = await import("./grille");
    const noms = Object.keys(module);
    // Interdire la formulation en perte à la racine : pas de fonction dont le
    // nom promette un temps perdu, occupé, ou un pourcentage de remplissage.
    expect(noms.filter((n) => /perdu|occupe|occupees|ratio|remplissage/i.test(n))).toEqual([]);
  });
});
