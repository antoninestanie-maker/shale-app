import { beforeAll, describe, expect, it, vi } from "vitest";

type Planif = typeof import("./planification");
let jalonsPropres: Planif["jalonsPropres"];
let planDuPremierObjectif: Planif["planDuPremierObjectif"];
let planRempli: Planif["planRempli"];
let NB_JALONS_MAX: Planif["NB_JALONS_MAX"];

/** La langue se fixe à l'import du module d'i18n (PIEGES § 14.2). */
beforeAll(async () => {
  vi.resetModules();
  vi.stubGlobal("navigator", { userAgent: "test", language: "fr-FR", languages: ["fr-FR"] });
  ({ jalonsPropres, planDuPremierObjectif, planRempli, NB_JALONS_MAX } = await import("./planification"));
});

describe("ce que l'accueil plante", () => {
  const plan = () => planDuPremierObjectif("  Lancer  ma chaîne ", ["Choisir la ligne", "Tourner 3 pilotes"], 5);

  it("un objectif MESURÉ, sans échéance — sinon « en péril » une semaine après l'installation", () => {
    const { racine } = plan();
    expect(racine.deadline).toBeNull();
    expect(racine.manual_progress).toBe(0);
    expect(racine.progress_pct).toBe(0);
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
