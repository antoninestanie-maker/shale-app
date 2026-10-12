import { describe, expect, it } from "vitest";
import { objectifsEnPeril } from "../calendrier/peril";
import { addDays } from "../logic";
import { objectif } from "../objectifs/objectif.testutil";
import type { FocusSession, Goal, Task } from "../types";
import { minutesDeFocus } from "./analyse";
import { enHeures, enHeuresInsecable } from "./durees";
import {
  dernieresSemaines,
  faitDEcheance,
  heuresPourChamp,
  lireHeures,
  racinesParObjectif,
  repartir,
  resteDu,
  semaineDe,
  semaineEntamee,
  SEMAINES_PASSEES,
  tableauParObjectif,
} from "./parObjectif";

// `today` est un PARAMÈTRE de tout le module : une date fixe ne vieillit pas.
// Le 8 octobre 2026 est un JEUDI.
const AUJ = "2026-10-08";
const LUNDI = "2026-10-05";
const DIMANCHE = "2026-10-11";

let n = 1;
const tache = (id: number, plus: Partial<Task> = {}): Task =>
  ({
    id, label: `T${id}`, tag: null, priority: "medium", recurrence: "none", goal_id: null,
    created_at: "2026-01-01 08:00:00", due_date: null, start_at: null, end_at: null,
    postponed_count: 0, postponed_from: null, is_example: 0, ...plus,
  }) as Task;
/** Une séance de `secondes` secondes, commencée à 9 h ce jour-là. */
const seance = (date: string, secondes: number, task_id: number | null, plus: Partial<FocusSession> = {}): FocusSession => {
  const fin = new Date(new Date(`${date}T09:00:00`).getTime() + secondes * 1000);
  const p = (x: number) => String(x).padStart(2, "0");
  return {
    id: n++, task_id, label: null, kind: "focus", planned_min: 25,
    started_at: `${date} 09:00:00`,
    ended_at: `${date} ${p(fin.getHours())}:${p(fin.getMinutes())}:${p(fin.getSeconds())}`,
    ...plus,
  };
};

// Un objectif (1), une phase (2) et un sous-objectif sous la phase (3) ; un autre objectif (9).
const goals = [
  objectif({ id: 1, title: "Mémoire", created_at: "2026-01-01 09:00:00" }),
  objectif({ id: 2, title: "Phase 1", parent_goal_id: 1, is_milestone: 1, created_at: "2026-01-01 09:00:00" }),
  objectif({ id: 3, title: "Chapitre 2", parent_goal_id: 2, created_at: "2026-01-01 09:00:00" }),
  objectif({ id: 9, title: "Boutique", created_at: "2026-01-01 09:00:00" }),
];
const tasks = [
  tache(10, { goal_id: 1 }),
  tache(11, { goal_id: 3 }), // posée sur un sous-objectif : compte pour l'objectif 1
  tache(12, { goal_id: 9 }),
  tache(13), // sans objectif
];
const uid = (id: number) => `demo:goal:${id}`;
const tableau = (p: {
  sessions: FocusSession[];
  promesses?: Record<string, number>;
  goals?: Goal[];
  tasks?: Task[];
  today?: string;
}) =>
  tableauParObjectif({
    goals: p.goals ?? goals,
    tasks: p.tasks ?? tasks,
    completions: [],
    focusSessions: p.sessions,
    promesses: new Map(Object.entries(p.promesses ?? {})),
    today: p.today ?? AUJ,
  });

describe("la semaine va du lundi au dimanche", () => {
  it("un jeudi, un lundi et un dimanche tombent dans la même semaine", () => {
    for (const jour of [AUJ, LUNDI, DIMANCHE]) expect(semaineDe(jour)).toEqual({ debut: LUNDI, fin: DIMANCHE });
  });
  it("le lundi suivant ouvre la semaine suivante", () => {
    expect(semaineDe(addDays(DIMANCHE, 1))).toEqual({ debut: addDays(LUNDI, 7), fin: addDays(DIMANCHE, 7) });
  });
  it("les dernières semaines se suivent sans trou, la courante en dernier", () => {
    const s = dernieresSemaines(AUJ, 4);
    expect(s.map((x) => x.debut)).toEqual([addDays(LUNDI, -21), addDays(LUNDI, -14), addDays(LUNDI, -7), LUNDI]);
    expect(s.every((x) => x.fin === addDays(x.debut, 6))).toBe(true);
  });
});

describe("le rattachement remonte à l'objectif racine", () => {
  it("une étape rend sa racine, une racine se rend elle-même", () => {
    const r = racinesParObjectif(goals);
    expect([r.get(1), r.get(2), r.get(3), r.get(9)]).toEqual([1, 1, 1, 9]);
  });
  it("une boucle ou un parent disparu n'arrête rien", () => {
    const boucle = [objectif({ id: 1, parent_goal_id: 2 }), objectif({ id: 2, parent_goal_id: 1 }), objectif({ id: 3, parent_goal_id: 77 })];
    const r = racinesParObjectif(boucle);
    expect(r.size).toBe(3);
    expect(r.get(3)).toBe(3);
  });
});

describe("repartir — le temps du minuteur, par objectif", () => {
  const sessions = [
    seance(LUNDI, 50 * 60, 10),
    seance(addDays(LUNDI, 1), 30 * 60, 11), // via le sous-objectif
    seance(addDays(LUNDI, 2), 25 * 60, 12), // autre objectif
    seance(AUJ, 20 * 60, 13), // tâche sans objectif
    seance(AUJ, 15 * 60, null, { label: "Focus" }), // sans tâche
    seance(AUJ, 10 * 60, 999), // tâche disparue (corbeille)
  ];

  it("range par racine, et met de côté ce qui n'a pas d'objectif — sans le répartir", () => {
    const r = repartir(sessions, tasks, goals, LUNDI, DIMANCHE);
    expect(r.parObjectif.get(1)).toBe(80);
    expect(r.parObjectif.get(9)).toBe(25);
    expect(r.horsObjectif).toBe(45);
    expect(r.total).toBe(150);
  });

  it("⭐ le total est la somme des objectifs et du hors objectif — et c'est celui de la vue d'ensemble", () => {
    const r = repartir(sessions, tasks, goals, LUNDI, DIMANCHE);
    const somme = [...r.parObjectif.values()].reduce((a, b) => a + b, 0) + r.horsObjectif;
    expect(somme).toBe(r.total);
    expect(r.total).toBe(minutesDeFocus(sessions, LUNDI, DIMANCHE));
  });

  it("aujourd'hui compte : une séance terminée à l'instant est dans la semaine", () => {
    const r = repartir([seance(AUJ, 25 * 60, 10)], tasks, goals, LUNDI, DIMANCHE);
    expect(r.parObjectif.get(1)).toBe(25);
  });

  it("ni une pause, ni une séance en cours, ni une séance d'une autre semaine", () => {
    const r = repartir(
      [
        seance(AUJ, 5 * 60, 10, { kind: "break" }),
        { ...seance(AUJ, 60, 10), ended_at: null },
        seance(addDays(LUNDI, -1), 40 * 60, 10), // le dimanche d'avant
        seance(addDays(DIMANCHE, 1), 40 * 60, 10), // le lundi d'après
      ],
      tasks, goals, LUNDI, DIMANCHE,
    );
    expect(r.total).toBe(0);
    expect(r.parObjectif.size).toBe(0);
  });

  it("arrondit séance par séance, comme la vue Timer : 20 s valent 0 min, 40 s valent 1 min", () => {
    const r = repartir([seance(AUJ, 20, 10), seance(AUJ, 40, 10), seance(AUJ, 89, 10)], tasks, goals, LUNDI, DIMANCHE);
    expect(r.parObjectif.get(1)).toBe(0 + 1 + 1);
  });
});

describe("⭐ le tableau de l'onglet « Par objectif »", () => {
  const sessions = [
    seance(LUNDI, 50 * 60, 10),
    seance(addDays(LUNDI, 1), 30 * 60, 11),
    seance(addDays(LUNDI, 2), 25 * 60, 12),
    seance(AUJ, 20 * 60, 13),
    seance(AUJ, 15 * 60, null),
    seance(addDays(LUNDI, -5), 120 * 60, 10), // la semaine d'avant
    seance(addDays(LUNDI, -9), 60 * 60, null), // deux semaines avant, hors objectif
  ];

  it("la semaine en cours, du lundi au dimanche, aujourd'hui compris", () => {
    const t = tableau({ sessions });
    expect(t.semaine).toEqual({ debut: LUNDI, fin: DIMANCHE });
    expect(t.lignes.map((l) => [l.goal.id, l.minutes])).toEqual([[1, 80], [9, 25]]);
  });

  it("⭐ lignes + hors objectif = total, et c'est le total du minuteur sur la semaine", () => {
    const t = tableau({ sessions });
    expect(t.lignes.reduce((a, l) => a + l.minutes, 0) + t.horsObjectif.minutes).toBe(t.total);
    expect(t.total).toBe(minutesDeFocus(sessions, LUNDI, DIMANCHE));
    expect(t.horsObjectif.minutes).toBe(35);
  });

  it("une ligne par objectif RACINE : ni une étape, ni un sous-objectif", () => {
    expect(tableau({ sessions }).lignes.map((l) => l.goal.id)).toEqual([1, 9]);
  });

  it("sans promesse, la ligne ne montre que le temps passé : ni reste, ni « tenue »", () => {
    const l = tableau({ sessions }).lignes[0];
    expect([l.promesse, l.reste, l.tenue]).toEqual([null, null, false]);
  });

  it("avec une promesse : ce qu'il reste d'ici dimanche, puis « tenue »", () => {
    const t = tableau({ sessions, promesses: { [uid(1)]: 5, [uid(9)]: 0.25 } });
    const [memoire, boutique] = t.lignes;
    expect([memoire.promesse, memoire.reste, memoire.tenue]).toEqual([5, 220, false]);
    expect([boutique.promesse, boutique.reste, boutique.tenue]).toEqual([0.25, 0, true]);
  });

  it("la promesse est lue par l'uid de l'objectif, celui de la base quand il existe", () => {
    const avecUid = goals.map((g) => (g.id === 1 ? { ...g, uid: "g-abc" } : g));
    const t = tableau({ sessions, goals: avecUid, promesses: { "g-abc": 3, [uid(1)]: 9 } });
    expect(t.lignes[0].promesse).toBe(3);
    expect(t.lignes[0].uid).toBe("g-abc");
  });

  it("les semaines précédentes : huit au plus, la plus ancienne d'abord, sans la semaine en cours", () => {
    const l = tableau({ sessions }).lignes[0];
    expect(l.passees).toHaveLength(SEMAINES_PASSEES);
    expect(l.passees[l.passees.length - 1]).toEqual({ debut: addDays(LUNDI, -7), fin: addDays(LUNDI, -1), minutes: 120 });
    expect(l.passees[0].debut).toBe(addDays(LUNDI, -7 * SEMAINES_PASSEES));
    expect(l.moyennePassee).toBe(Math.round(120 / SEMAINES_PASSEES));
  });

  it("⭐ pas de zéro inventé avant la création de l'objectif", () => {
    // Créé le mercredi d'il y a deux semaines : cette semaine-là compte (il
    // existait), les six d'avant n'ont pas de barre.
    const jeune = goals.map((g) => (g.id === 9 ? { ...g, created_at: `${addDays(LUNDI, -12)} 10:00:00` } : g));
    const l = tableau({ sessions, goals: jeune }).lignes.find((x) => x.goal.id === 9)!;
    expect(l.passees.map((s) => s.debut)).toEqual([addDays(LUNDI, -14), addDays(LUNDI, -7)]);
    expect(l.passees.map((s) => s.minutes)).toEqual([0, 0]);
  });

  it("un objectif né cette semaine : aucune semaine précédente, et pas de « reste d'ici dimanche »", () => {
    const neuf = goals.map((g) => (g.id === 9 ? { ...g, created_at: `${AUJ} 10:00:00` } : g));
    const l = tableau({ sessions, goals: neuf, promesses: { [uid(9)]: 5 } }).lignes.find((x) => x.goal.id === 9)!;
    expect(l.passees).toEqual([]);
    expect(l.moyennePassee).toBeNull();
    expect([l.premiereSemaine, l.reste, l.promesse, l.minutes]).toEqual([true, null, 5, 25]);
  });

  it("« hors objectif » ne commence qu'à la première séance du compte", () => {
    const t = tableau({ sessions });
    expect(t.horsObjectif.passees.map((s) => [s.debut, s.minutes])).toEqual([
      [addDays(LUNDI, -14), 60],
      [addDays(LUNDI, -7), 0],
    ]);
  });

  it("l'échelle des barres est commune à toutes les lignes", () => {
    expect(tableau({ sessions }).maxSemaine).toBe(120);
  });

  it("sans minuteur, tout est à zéro — et le tableau le sait", () => {
    const t = tableau({ sessions: [], promesses: { [uid(1)]: 5 } });
    expect(t.semaineSansMinuteur).toBe(true);
    expect(t.total).toBe(0);
    expect(t.lignes.map((l) => [l.minutes, l.reste])).toEqual([[0, 300], [0, null]]);
    expect(t.horsObjectif).toEqual({ minutes: 0, passees: [] });
  });

  it("le dimanche, la semaine est la même et aujourd'hui en fait partie", () => {
    const t = tableau({ sessions: [seance(DIMANCHE, 30 * 60, 10)], today: DIMANCHE });
    expect(t.semaine).toEqual({ debut: LUNDI, fin: DIMANCHE });
    expect(t.lignes[0].minutes).toBe(30);
  });

  it("un objectif d'exemple n'a sa ligne que si du temps y a été passé", () => {
    const avecExemple = [...goals, objectif({ id: 20, title: "Exemple", is_example: 1, created_at: "2026-01-01 09:00:00" })];
    const taches = [...tasks, tache(21, { goal_id: 20, is_example: 1 })];
    expect(tableau({ sessions, goals: avecExemple, tasks: taches }).lignes.map((l) => l.goal.id)).not.toContain(20);
    const t = tableau({ sessions: [...sessions, seance(AUJ, 600, 21)], goals: avecExemple, tasks: taches });
    expect(t.lignes.find((l) => l.goal.id === 20)?.minutes).toBe(10);
    expect(t.lignes.reduce((a, l) => a + l.minutes, 0) + t.horsObjectif.minutes).toBe(t.total);
  });

  it("l'ordre est celui de la liste des Objectifs : le long terme d'abord, puis l'échéance", () => {
    const melange = [
      objectif({ id: 1, scope: "short" }),
      objectif({ id: 2, scope: "long", deadline: addDays(AUJ, 200) }),
      objectif({ id: 3, scope: "long", deadline: addDays(AUJ, 90) }),
      objectif({ id: 4, scope: "medium" }),
    ];
    expect(tableau({ sessions: [], goals: melange, tasks: [] }).lignes.map((l) => l.goal.id)).toEqual([3, 2, 4, 1]);
  });
});

describe("⭐ « serai-je prêt à la date ? » — des faits, jamais un pronostic", () => {
  const lire = (deadline: string | null, plus: { progress_pct?: number; acheve?: boolean; promesse?: number | null } = {}) => {
    const g = objectif({ id: 1, deadline, manual_progress: 1, progress_pct: plus.progress_pct ?? 40 });
    const perils = objectifsEnPeril([g], [], [], AUJ);
    return faitDEcheance(g, perils, !!plus.acheve, plus.promesse ?? null, AUJ);
  };

  it("sans échéance, ou achevé : rien", () => {
    expect(lire(null, { promesse: 5 })).toBeNull();
    expect(lire(addDays(AUJ, -30), { acheve: true })).toBeNull();
    expect(lire(addDays(AUJ, 90), { acheve: true, promesse: 5 })).toBeNull();
  });

  it("échéance à venir et une promesse : les semaines pleines, et les heures que la promesse y met", () => {
    // 84 jours = 12 semaines pleines ; à 5 h par semaine, 60 h. Un produit, pas un rythme extrapolé.
    expect(lire(addDays(AUJ, 84), { promesse: 5 })).toEqual({
      genre: "a-venir", echeance: addDays(AUJ, 84), joursRestants: 84, semaines: 12, heures: 60,
    });
    // 90 jours : toujours 12 semaines PLEINES — les six jours de plus ne sont pas arrondis vers le haut.
    expect(lire(addDays(AUJ, 90), { promesse: 2.5 })).toMatchObject({ semaines: 12, heures: 30 });
  });

  it("échéance à venir, sans promesse : les semaines seulement, aucune heure inventée", () => {
    expect(lire(addDays(AUJ, 84))).toMatchObject({ genre: "a-venir", semaines: 12, heures: null });
  });

  it("⚠️ le fait ne dépend pas du temps déjà passé : il ne devine pas un rythme", () => {
    const g = objectif({ id: 1, deadline: addDays(AUJ, 84), created_at: "2026-01-01 09:00:00" });
    const lecture = (sessions: FocusSession[]) =>
      tableauParObjectif({ goals: [g], tasks: [tache(10, { goal_id: 1 })], completions: [], focusSessions: sessions, promesses: new Map([[uid(1), 5]]), today: AUJ })
        .lignes[0].echeance;
    expect(lecture([seance(AUJ, 9 * 3600, 10), seance(addDays(AUJ, -8), 9 * 3600, 10)])).toEqual(lecture([]));
  });

  it("échéance dépassée : ce que dit la règle du Calendrier, reprise telle quelle", () => {
    const fait = lire(addDays(AUJ, -10), { promesse: 5 });
    expect(fait?.genre).toBe("peril");
    if (fait?.genre !== "peril") return;
    const g = objectif({ id: 1, deadline: addDays(AUJ, -10), manual_progress: 1, progress_pct: 40 });
    expect(fait.peril).toEqual(objectifsEnPeril([g], [], [], AUJ)[0]);
    expect([fait.peril.raison, fait.peril.joursRestants]).toEqual(["depassee", -10]);
  });

  it("échéance dans l'horizon et trop peu d'avancement : en péril, même verdict que le Calendrier", () => {
    const fait = lire(addDays(AUJ, 3));
    expect(fait?.genre === "peril" && [fait.peril.raison, fait.peril.joursRestants, fait.peril.progression]).toEqual(["rythme-insuffisant", 3, 40]);
  });

  it("échéance dans l'horizon et la règle ne signale rien : les jours qui restent, sans heures", () => {
    expect(lire(addDays(AUJ, 3), { progress_pct: 90, promesse: 5 })).toMatchObject({ genre: "a-venir", joursRestants: 3, semaines: 0, heures: 0 });
    expect(lire(AUJ, { progress_pct: 90 })).toMatchObject({ genre: "a-venir", joursRestants: 0, semaines: 0 });
  });

  it("le tableau appelle le péril comme le Calendrier, et l'accroche à la bonne ligne", () => {
    const g = [
      objectif({ id: 1, deadline: addDays(AUJ, -2), manual_progress: 1, progress_pct: 10, created_at: "2026-01-01 09:00:00" }),
      objectif({ id: 2, deadline: addDays(AUJ, 70), created_at: "2026-01-01 09:00:00" }),
      objectif({ id: 3, created_at: "2026-01-01 09:00:00" }),
    ];
    const t = tableau({ sessions: [], goals: g, tasks: [], promesses: { [uid(2)]: 4 } });
    const par = new Map(t.lignes.map((l) => [l.goal.id, l.echeance]));
    expect(par.get(1)?.genre).toBe("peril");
    expect(par.get(2)).toMatchObject({ genre: "a-venir", semaines: 10, heures: 40 });
    expect(par.get(3)).toBeNull();
  });
});

describe("écrire et lire des heures", () => {
  it("le format de la vue Timer", () => {
    expect([0, 45, 60, 130, 550].map(enHeures)).toEqual(["0 min", "45 min", "1 h", "2 h 10", "9 h 10"]);
  });
  it("dans une phrase, la durée ne se coupe pas : mêmes caractères, espaces insécables", () => {
    expect(enHeuresInsecable(75)).toBe("1 h 15");
    expect(enHeuresInsecable(75).replace(/ /g, " ")).toBe(enHeures(75));
  });
  it("un objectif né en cours de semaine n'a pas une semaine entière ; né le lundi ou avant, si", () => {
    const s = semaineDe(AUJ);
    expect(semaineEntamee(`${DIMANCHE} 14:21:00`, s)).toBe(true);
    expect(semaineEntamee(addDays(LUNDI, 1), s)).toBe(true);
    expect(semaineEntamee(`${LUNDI} 08:00:00`, s)).toBe(false);
    expect(semaineEntamee(addDays(LUNDI, -20), s)).toBe(false);
    expect(semaineEntamee(null, s)).toBe(false);
  });
  it("une saisie : entier, virgule, point, heures et minutes", () => {
    expect(["5", "2,5", "2.5", "2h30", " 2 h 30 ", "3h"].map(lireHeures)).toEqual([5, 2.5, 2.5, 2.5, 2.5, 3]);
  });
  it("vide ou zéro retire la promesse ; l'illisible ne touche à rien ; le plafond tient", () => {
    expect(lireHeures("")).toBe(0);
    expect(lireHeures("0")).toBe(0);
    expect(lireHeures("beaucoup")).toBeNull();
    expect(lireHeures("2h75")).toBeNull();
    expect(lireHeures("-3")).toBeNull();
    expect(lireHeures("400")).toBe(80);
  });
  it("le champ : vide sans promesse, la virgule en français, le point en anglais", () => {
    expect([heuresPourChamp(null), heuresPourChamp(0), heuresPourChamp(5), heuresPourChamp(2.5), heuresPourChamp(2.5, ".")]).toEqual(["", "", "5", "2,5", "2.5"]);
    // Ce que le champ montre se relit à l'identique.
    for (const h of [1, 2.5, 7.25, 40]) expect(lireHeures(heuresPourChamp(h))).toBe(h);
  });
  it("ce qu'il reste à passer ne descend pas sous zéro", () => {
    expect(resteDu(130, 5)).toBe(170);
    expect(resteDu(400, 5)).toBe(0);
    expect(resteDu(0, 2.5)).toBe(150);
  });
});
