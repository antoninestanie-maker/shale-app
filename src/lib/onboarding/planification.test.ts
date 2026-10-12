import { beforeAll, describe, expect, it, vi } from "vitest";

type Planif = typeof import("./planification");
let jalonsPropres: Planif["jalonsPropres"];
let planDuPremierObjectif: Planif["planDuPremierObjectif"];
let planRempli: Planif["planRempli"];
let heuresDuPlan: Planif["heuresDuPlan"];
let echeanceDuPlan: Planif["echeanceDuPlan"];
let NB_JALONS_MAX: Planif["NB_JALONS_MAX"];

/** La langue se fixe à l'import du module d'i18n (PIEGES § 14.2). */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ jalonsPropres, planDuPremierObjectif, planRempli, heuresDuPlan, echeanceDuPlan, NB_JALONS_MAX } = await import("./planification"));
});

describe("ce que l'accueil plante", () => {
  const plan = () => planDuPremierObjectif("  Lancer  ma chaîne ", ["Choisir la ligne", "Tourner 3 pilotes"], 5);

  // ⚠️ TEST RETOURNÉ le 2026-10-12. Il s'appelait « un objectif MESURÉ, sans
  // échéance — sinon "en péril" une semaine après l'installation » et tenait
  // la décision du 2026-09-16 (« aucune échéance »). Antonin, après essai de
  // l'app installée : « Pour la date, la deadline de l'objectif, c'est très
  // important donc on le fait. » L'accueil la DEMANDE donc, facultative. Ce
  // qui reste vrai, et que ce test tient : sans date donnée, aucune n'est
  // inventée. La crainte d'origine est tenue ailleurs — voir « un objectif qui
  // vient de naître » dans `calendrier/charge.test.ts`.
  it("un objectif MESURÉ ; sans date donnée, AUCUNE échéance n'est inventée", () => {
    const { racine } = plan();
    expect(racine.deadline).toBeNull();
    expect(racine.manual_progress).toBe(0);
    expect(racine.progress_pct).toBe(0);
  });

  it("⭐ l'échéance choisie à l'accueil est celle de l'objectif planté (2026-10-12)", () => {
    const { racine } = planDuPremierObjectif("Lancer ma chaîne", ["Choisir la ligne"], 5, "2027-02-12");
    expect(racine.deadline).toBe("2027-02-12");
    // Elle ne change rien d'autre : l'objectif reste mesuré, et n'est pas un exemple.
    expect(racine.manual_progress).toBe(0);
    expect(racine.is_example).toBe(0);
  });

  it("⚠️ les jalons, eux, restent sans échéance — même quand l'objectif en a une", () => {
    const { jalons } = planDuPremierObjectif("Lancer ma chaîne", ["Choisir la ligne", "Tourner 3 pilotes"], 5, "2027-02-12");
    expect(jalons.map((j) => j.deadline)).toEqual([null, null]);
  });

  it("une échéance qui n'est pas un jour n'est pas écrite", () => {
    for (const faux of ["", "   ", "demain", "2027-02-30", "12/02/2027"]) {
      expect(planDuPremierObjectif("Lancer ma chaîne", [], 5, faux).racine.deadline).toBeNull();
    }
  });

  it("des jalons, dans l'ordre, sans échéance eux non plus", () => {
    const { jalons } = plan();
    expect(jalons.map((j) => [j.title, j.is_milestone, j.position, j.deadline])).toEqual([
      ["Choisir la ligne", 1, 0, null],
      ["Tourner 3 pilotes", 1, 1, null],
    ]);
  });

  it("⭐ RIEN n'est marqué comme exemple : tout vient de l'utilisateur", () => {
    const { racine, jalons } = plan();
    for (const g of [racine, ...jalons]) expect(g.is_example).toBe(0);
  });

  it("le titre est nettoyé, jamais réécrit", () => {
    expect(plan().racine.title).toBe("Lancer ma chaîne");
  });

  it("le chiffre du curseur devient la description — il n'est pas perdu, et il n'est pas une perte", () => {
    expect(plan().racine.description).toBe("5 h par semaine libérées pour ça.");
    // ⚠️ Aucune formulation en perte, aucune projection de gain : le mot
    // « perdre » et ses cousins n'ont rien à faire là (interdit du chantier
    // « premier démarrage »).
    const texte = `${plan().racine.description}`.toLocaleLowerCase();
    for (const interdit of ["perd", "perte", "gagn", "gain", "économis", "gaspill"]) {
      expect(texte).not.toContain(interdit);
    }
  });

  it("sans curseur posé, aucune description n'est inventée", () => {
    expect(planDuPremierObjectif("Arrêter de fumer", [], 0).racine.description).toBeNull();
  });

  it("un objectif sans jalon est un état légal : le titre suffit", () => {
    const { racine, jalons } = planDuPremierObjectif("Arrêter de fumer", ["", "   "], 3);
    expect(racine.title).toBe("Arrêter de fumer");
    expect(jalons).toEqual([]);
  });
});

describe("⭐ l'échéance que l'accueil retient (2026-10-12)", () => {
  const AUJ = "2026-10-12";

  it("un jour d'aujourd'hui ou à venir est retenu tel quel", () => {
    expect(echeanceDuPlan("2027-02-12", AUJ)).toBe("2027-02-12");
    expect(echeanceDuPlan(AUJ, AUJ)).toBe(AUJ);
  });

  it("⚠️ une date PASSÉE n'est pas retenue : l'objectif naîtrait « échéance dépassée »", () => {
    expect(echeanceDuPlan("2026-10-11", AUJ)).toBeNull();
    expect(echeanceDuPlan("2025-12-31", AUJ)).toBeNull();
  });

  it("rien de choisi, ou rien de lisible : pas d'échéance", () => {
    expect(echeanceDuPlan(null, AUJ)).toBeNull();
    expect(echeanceDuPlan(undefined, AUJ)).toBeNull();
    expect(echeanceDuPlan("", AUJ)).toBeNull();
    expect(echeanceDuPlan("2027-13-01", AUJ)).toBeNull();
    expect(echeanceDuPlan("2027-02-30", AUJ)).toBeNull();
  });
});

describe("les lignes de jalons", () => {
  it("vides retirées, espaces normalisés, doublons écartés, trois au plus", () => {
    expect(jalonsPropres([" A ", "", "a", "B", "C  C", "D"])).toEqual(["A", "B", "C C"]);
    expect(NB_JALONS_MAX).toBe(3);
  });

  it("un titre vide ne plante rien — « pas de réponse, pas d'objectif »", () => {
    expect(planRempli("   ")).toBe(false);
    expect(planRempli("x")).toBe(true);
  });
});

describe("⭐ la valeur montrée est la valeur retenue (2026-10-11)", () => {
  it("la case allumée par défaut est retenue quand l'écran de la grille est validé par « Suivant »", () => {
    // Le défaut : « 5 h » allumé, « Suivant », et l'objectif planté sans ses heures.
    expect(heuresDuPlan(null, 5)).toBe(5);
    expect(planDuPremierObjectif("Mon mémoire", [], heuresDuPlan(null, 5)).racine.description).toBe("5 h par semaine libérées pour ça.");
  });

  it("la case cliquée l'emporte sur celle qui était allumée", () => {
    expect(heuresDuPlan(8, 5)).toBe(8);
    expect(heuresDuPlan(8, null)).toBe(8);
  });

  it("écran passé ou jamais vu, ou aucune heure libre : aucun chiffre n'est inventé", () => {
    expect(heuresDuPlan(null, null)).toBe(0);
    expect(heuresDuPlan(null, 0)).toBe(0);
    expect(planDuPremierObjectif("Mon mémoire", [], heuresDuPlan(null, null)).racine.description).toBeNull();
  });
});
