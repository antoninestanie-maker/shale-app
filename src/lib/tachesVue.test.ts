/**
 * @vitest-environment happy-dom
 */
import { afterAll, describe, expect, it } from "vitest";
import {
  cleObjectif,
  correspond,
  estFaite,
  ranger,
  rangementDe,
  rangerParObjectif,
  sectionDe,
  type CleSection,
} from "./tachesVue";
import { recurrenceLabel } from "./logic";
import { setLangPref } from "./i18n";
import { coche, objectif, tache } from "./objectifs/objectif.testutil";

/**
 * La vue Tâches rangée par moment (2026-09-30). Mercredi 30 septembre 2026.
 */
const AUJ = "2026-09-30";
const NEE = "2026-09-01 09:00:00";

const ids = (m: Map<CleSection, { id: number }[]>, s: CleSection) => m.get(s)!.map((x) => x.id);

describe("sectionDe — une tâche, un seul moment", () => {
  it("datée : avant, aujourd'hui, après", () => {
    expect(sectionDe(tache({ due_date: "2026-09-29" }), false, AUJ)).toBe("retard");
    expect(sectionDe(tache({ due_date: AUJ }), false, AUJ)).toBe("aujourdhui");
    expect(sectionDe(tache({ due_date: "2026-10-02" }), false, AUJ)).toBe("avenir");
  });

  it("sans date : à part, jamais « aujourd'hui » par défaut", () => {
    expect(sectionDe(tache({ due_date: null }), false, AUJ)).toBe("sansDate");
  });

  it("⭐ une récurrente due aujourd'hui est d'aujourd'hui ; sinon, elle attend dans les routines", () => {
    // Le 30/09/2026 est un mercredi : lun-mer-ven tombe, mar-jeu non.
    expect(sectionDe(tache({ recurrence: "[1,3,5]", created_at: NEE }), false, AUJ)).toBe("aujourdhui");
    expect(sectionDe(tache({ recurrence: "[2,4]", created_at: NEE }), false, AUJ)).toBe("routines");
  });

  it("⚠️ une récurrente n'est JAMAIS en retard, même avec une date égarée dans la ligne", () => {
    expect(sectionDe(tache({ recurrence: "[2,4]", due_date: "2026-09-01", created_at: NEE }), false, AUJ)).toBe("routines");
  });

  it("cochée, elle est faite — où qu'elle ait été", () => {
    expect(sectionDe(tache({ due_date: "2026-09-29" }), true, AUJ)).toBe("faites");
  });
});

describe("estFaite", () => {
  it("une ponctuelle cochée un jour quelconque est faite — le jour le plus récent compte", () => {
    const t = tache({ id: 4 });
    expect(estFaite(t, [coche(4, "2026-09-10"), coche(4, "2026-09-20")], AUJ)).toEqual({ faite: true, le: "2026-09-20" });
  });

  it("⭐ une récurrente n'est faite que si elle est cochée AUJOURD'HUI — hier ne compte plus", () => {
    const t = tache({ id: 5, recurrence: "daily", created_at: NEE });
    expect(estFaite(t, [coche(5, "2026-09-29")], AUJ).faite).toBe(false);
    expect(estFaite(t, [coche(5, AUJ)], AUJ)).toEqual({ faite: true, le: AUJ });
  });

  it("une coche décochée (done = 0) ne compte pas", () => {
    expect(estFaite(tache({ id: 6 }), [coche(6, AUJ, 0)], AUJ).faite).toBe(false);
  });
});

describe("ranger — l'ordre dans chaque section", () => {
  it("aujourd'hui : ce qui a une heure d'abord, dans l'ordre de la journée, puis par priorité", () => {
    const m = ranger(
      [
        tache({ id: 1, due_date: AUJ, priority: "low" }),
        tache({ id: 2, due_date: AUJ, start_at: "14:00" }),
        tache({ id: 3, due_date: AUJ, start_at: "09:30" }),
        tache({ id: 4, due_date: AUJ, priority: "high" }),
      ],
      [],
      AUJ,
    );
    expect(ids(m, "aujourdhui")).toEqual([3, 2, 4, 1]);
  });

  it("en retard et à venir : la plus proche d'abord", () => {
    const m = ranger(
      [
        tache({ id: 1, due_date: "2026-09-20" }),
        tache({ id: 2, due_date: "2026-09-28" }),
        tache({ id: 3, due_date: "2026-10-10" }),
        tache({ id: 4, due_date: "2026-10-01" }),
      ],
      [],
      AUJ,
    );
    expect(ids(m, "retard")).toEqual([1, 2]);
    expect(ids(m, "avenir")).toEqual([4, 3]);
  });

  it("sans date : par priorité, la plus récente en haut à priorité égale", () => {
    const m = ranger([tache({ id: 1 }), tache({ id: 2 }), tache({ id: 3, priority: "high" })], [], AUJ);
    expect(ids(m, "sansDate")).toEqual([3, 2, 1]);
  });

  it("faites : la dernière cochée d'abord", () => {
    const m = ranger([tache({ id: 1 }), tache({ id: 2 })], [coche(1, "2026-09-29"), coche(2, "2026-09-12")], AUJ);
    expect(ids(m, "faites")).toEqual([1, 2]);
  });

  it("⭐ la coche AFFICHÉE décide : cochée à l'instant, elle passe dans les faites avant la base", () => {
    const m = ranger([tache({ id: 1, due_date: AUJ })], [], AUJ, { coche: () => true });
    expect(ids(m, "faites")).toEqual([1]);
    expect(m.get("faites")![0].done).toBe(true);
  });

  it("⭐ `garder` retient une tâche qu'on vient de cocher dans la section du clic", () => {
    const m = ranger([tache({ id: 1, due_date: AUJ })], [coche(1, AUJ)], AUJ, { garder: new Map([[1, "aujourdhui"]]) });
    expect(ids(m, "aujourdhui")).toEqual([1]);
    expect(m.get("aujourdhui")![0].done).toBe(true); // barrée, mais encore là
  });
});

describe("⭐ rangerParObjectif — la même vue, rangée par objectif (2026-10-11)", () => {
  // Deux objectifs racines ; le premier a deux étapes, dont une sous l'autre.
  const goals = [
    objectif({ id: 10, title: "Signer deux clients", position: 0 }),
    objectif({ id: 11, title: "Prospecter", parent_goal_id: 10 }),
    objectif({ id: 12, title: "Relancer", parent_goal_id: 11 }),
    objectif({ id: 20, title: "Certification UX", position: 0 }),
  ];
  const cles = (g: { cle: string }[]) => g.map((x) => x.cle);
  const lignes = (g: { cle: string; lignes: { id: number }[] }[], cle: string) =>
    g.find((x) => x.cle === cle)?.lignes.map((l) => l.id) ?? [];

  it("une section par objectif RACINE — les tâches de ses étapes comprises, l'étape nommée", () => {
    const g = rangerParObjectif(
      [
        tache({ id: 1, goal_id: 10 }), // à l'objectif lui-même
        tache({ id: 2, goal_id: 11 }), // dans une étape
        tache({ id: 3, goal_id: 12 }), // dans une étape d'étape
        tache({ id: 4, goal_id: 20 }),
      ],
      [],
      goals,
      AUJ,
    );
    expect(cles(g)).toEqual([cleObjectif(10), cleObjectif(20)]);
    expect(lignes(g, cleObjectif(10)).sort()).toEqual([1, 2, 3]);
    const section = g[0];
    expect(section.racine?.title).toBe("Signer deux clients");
    const etapeDe = (id: number) => section.lignes.find((l) => l.id === id)!.etape?.title ?? null;
    expect(etapeDe(1)).toBeNull(); // rattachée à la racine : rien à nommer
    expect(etapeDe(2)).toBe("Prospecter");
    expect(etapeDe(3)).toBe("Relancer"); // l'étape qui la porte, pas la racine
  });

  it("⭐ dans une section : les retards en tête, puis l'échéance, puis sans date ; à date égale la priorité", () => {
    const g = rangerParObjectif(
      [
        tache({ id: 1, goal_id: 10 }), // sans date
        tache({ id: 2, goal_id: 10, due_date: "2026-10-05" }),
        tache({ id: 3, goal_id: 11, due_date: AUJ, priority: "low" }),
        tache({ id: 4, goal_id: 10, due_date: "2026-09-28" }), // en retard
        tache({ id: 5, goal_id: 12, due_date: AUJ, priority: "high" }),
        tache({ id: 6, goal_id: 10, due_date: "2026-09-20" }), // en retard, plus ancien
        tache({ id: 7, goal_id: 10, priority: "high" }), // sans date, mais élevée
      ],
      [],
      goals,
      AUJ,
    );
    expect(lignes(g, cleObjectif(10))).toEqual([6, 4, 5, 3, 2, 7, 1]);
    expect(g[0].lignes.map((l) => l.moment)).toEqual([
      "retard",
      "retard",
      "aujourdhui",
      "aujourdhui",
      "avenir",
      "sansDate",
      "sansDate",
    ]);
  });

  it("« Sans objectif » en dernier, les routines et les faites à part, après", () => {
    const g = rangerParObjectif(
      [
        tache({ id: 1 }), // sans objectif
        tache({ id: 2, goal_id: 20 }),
        tache({ id: 3, goal_id: 10, recurrence: "[2,4]", created_at: NEE }), // routine, pas un mercredi
        tache({ id: 4, goal_id: 10, recurrence: "daily", created_at: NEE }), // routine du jour
        tache({ id: 5, goal_id: 10 }), // faite
        tache({ id: 6, goal_id: 999 }), // objectif disparu (corbeille)
      ],
      [coche(5, "2026-09-29")],
      goals,
      AUJ,
    );
    expect(cles(g)).toEqual([cleObjectif(20), "sansObjectif", "routines", "faites"]);
    expect(lignes(g, "sansObjectif").sort()).toEqual([1, 6]);
    // Les routines du jour d'abord.
    expect(lignes(g, "routines")).toEqual([4, 3]);
    expect(lignes(g, "faites")).toEqual([5]);
    // ⚠️ L'objectif 10 n'a plus de ponctuelle à faire : pas de section vide.
    expect(cles(g)).not.toContain(cleObjectif(10));
  });

  it("les objectifs dans l'ordre de leur création, pas dans celui des tâches", () => {
    const g = rangerParObjectif([tache({ id: 1, goal_id: 20 }), tache({ id: 2, goal_id: 10 })], [], goals, AUJ);
    expect(cles(g)).toEqual([cleObjectif(10), cleObjectif(20)]);
  });

  it("la coche affichée décide, et `garder` retient la ligne dans SA section le temps du clic", () => {
    const tasks = [tache({ id: 1, goal_id: 11, due_date: AUJ })];
    const cochee = rangerParObjectif(tasks, [], goals, AUJ, { coche: () => true });
    expect(cles(cochee)).toEqual(["faites"]);
    const gardee = rangerParObjectif(tasks, [coche(1, AUJ)], goals, AUJ, { garder: new Map([[1, cleObjectif(10)]]) });
    expect(cles(gardee)).toEqual([cleObjectif(10)]);
    expect(gardee[0].lignes[0].done).toBe(true); // barrée, mais encore là
    expect(gardee[0].racine?.id).toBe(10);
  });

  it("aucune tâche : aucune section", () => {
    expect(rangerParObjectif([], [], goals, AUJ)).toEqual([]);
  });

  it("le réglage : tout ce qui n'est pas « objectif » vaut le rangement par moment", () => {
    expect(rangementDe("objectif")).toBe("objectif");
    expect(rangementDe("moment")).toBe("moment");
    expect(rangementDe(null)).toBe("moment");
    expect(rangementDe("")).toBe("moment");
    expect(rangementDe("autre")).toBe("moment");
  });
});

describe("correspond — la recherche", () => {
  it("sans accent ni majuscule, sur le libellé, le tag et l'objectif", () => {
    const t = { label: "Réviser module BTS", tag: "Études" };
    expect(correspond(t, "Valider le semestre", "revis")).toBe(true);
    expect(correspond(t, "Valider le semestre", "etudes")).toBe(true);
    expect(correspond(t, "Valider le semestre", "semestre")).toBe(true);
    expect(correspond(t, null, "trading")).toBe(false);
  });

  it("tous les mots, dans n'importe quel ordre", () => {
    const t = { label: "Publier un reel ChartCore", tag: null };
    expect(correspond(t, null, "chartcore reel")).toBe(true);
    expect(correspond(t, null, "chartcore youtube")).toBe(false);
  });

  it("une recherche vide laisse tout passer", () => {
    expect(correspond({ label: "x", tag: null }, null, "   ")).toBe(true);
  });
});

describe("⭐ recurrenceLabel — le rythme, dans la langue de l'app", () => {
  afterAll(() => setLangPref("fr"));

  it("en français", () => {
    setLangPref("fr");
    expect(recurrenceLabel("none")).toBeNull();
    expect(recurrenceLabel("daily")).toBe("Quotidien");
    expect(recurrenceLabel("[5,1,3]")!.toLowerCase()).toMatch(/^lun.*mer.*ven/);
  });

  it("⚠️ en anglais — il restait « quotidien », « lun–ven » avant le 2026-09-30", () => {
    setLangPref("en");
    expect(recurrenceLabel("daily")).toBe("Daily");
    expect(recurrenceLabel("weekdays")).toBe("Mon–Fri");
    expect(recurrenceLabel("[1,3,5]")!.toLowerCase()).toMatch(/^mon.*wed.*fri/);
    expect(recurrenceLabel("[0,6]")!.toLowerCase()).toMatch(/^sat.*sun/); // le dimanche en DERNIER
  });
});
