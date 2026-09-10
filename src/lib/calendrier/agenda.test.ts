import { describe, expect, it } from "vitest";

import {
  DUREE_DEFAUT_MIN,
  bandesDu,
  bornesDe,
  dansLeBandeau,
  dureeMinutes,
  entreesDeLaPlage,
  entreesDuJour,
  estMultiJours,
  finApres,
  grilleDuMois,
  heureDe,
  joursEntre,
  lundiDe,
  minutesDe,
  semaineDe,
  type SourcesAgenda,
} from "./agenda";
import type { CalendarEvent, Completion, Goal, Task } from "../types";

/** Chantier B — ce qui occupe une journée. */

const tache = (p: Partial<Task> = {}): Task => ({
  id: 1, label: "écrire", tag: null, priority: "medium", recurrence: "none",
  goal_id: null, created_at: "2026-08-01 09:00:00", due_date: null, start_at: null,
  end_at: null, postponed_count: 0, postponed_from: null, is_example: 0, ...p,
});

const evenement = (p: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 1, title: "rendez-vous", body: null, date: "2026-09-02", end_date: null, start_at: null,
  end_at: null, all_day: 0, color: null, recurrence: "none",
  created_at: "2026-08-01 09:00:00", updated_at: "2026-08-01 09:00:00", ...p,
});

const objectif = (p: Partial<Goal> = {}): Goal => ({
  id: 1, title: "objectif", description: null, scope: "short", category: null,
  parent_goal_id: null, deadline: null, progress_pct: 0, manual_progress: 1,
  created_at: "2026-08-01 09:00:00", ...p,
});

const sources = (p: Partial<SourcesAgenda> = {}): SourcesAgenda => ({
  events: [], tasks: [], completions: [], goals: [], ...p,
});

// ─────────────────────────────────────────────────────────────────────────────

describe("heures et durées", () => {
  it("lit et réécrit une heure", () => {
    expect(minutesDe("09:30")).toBe(570);
    expect(heureDe(570)).toBe("09:30");
    expect(heureDe(0)).toBe("00:00");
  });

  it("refuse ce qui n'est pas une heure", () => {
    expect(minutesDe("bientôt")).toBeNull();
    expect(minutesDe("25:00")).toBeNull();
    expect(minutesDe("09:75")).toBeNull();
    expect(minutesDe(null)).toBeNull();
  });

  it("⚠️ une fin avant le début ne rend PAS une durée négative", () => {
    // Une durée négative se propagerait dans le calcul de charge en le faisant
    // DIMINUER : une journée surchargée passerait pour légère.
    expect(dureeMinutes("14:00", "13:00")).toBeNull();
    expect(dureeMinutes("14:00", "14:00")).toBeNull();
    expect(dureeMinutes("14:00", "15:30")).toBe(90);
  });
});

describe("la fin d'un créneau", () => {
  it("ajoute la durée demandée, à la minute près", () => {
    expect(finApres("14:37", 60)).toBe("15:37");
    expect(finApres("09:00", 45)).toBe("09:45");
    expect(finApres("23:00", 15)).toBe("23:15");
  });

  it("⭐ PLAFONNE à 23:59 au lieu de déborder sur le lendemain", () => {
    // Un créneau qui repasse minuit rendrait une fin PLUS PETITE que son début,
    // et `dureeMinutes` rendrait alors `null` : la durée disparaîtrait de la
    // charge sans que rien ne le signale. Le créneau qui traverse la nuit
    // relève du multi-jours, pas d'une soustraction qui se retourne.
    expect(finApres("23:30", 60)).toBe("23:59");
    expect(finApres("23:59", 60)).toBe("23:59");
    expect(dureeMinutes("23:30", finApres("23:30", 60))).toBe(29);
  });

  it("laisse passer une heure illisible plutôt que d'inventer", () => {
    expect(finApres("", 60)).toBe("");
    expect(finApres("midi", 60)).toBe("midi");
  });

  it("la durée par défaut rend la carte assez haute pour afficher son heure", () => {
    // `GrilleHoraire` masque l'étiquette sous 45 minutes. Si cette constante
    // repassait en dessous, la saisie redeviendrait invérifiable à l'écran.
    expect(DUREE_DEFAUT_MIN).toBeGreaterThanOrEqual(45);
  });
});

describe("les quatre familles d'une journée", () => {
  it("rassemble événements, tâches datées, récurrences et échéances", () => {
    const src = sources({
      events: [evenement({ id: 7, title: "point hebdo", start_at: "09:30", end_at: "10:00" })],
      tasks: [
        tache({ id: 1, label: "datée", due_date: "2026-09-02", start_at: "14:00", end_at: "15:00" }),
        tache({ id: 2, label: "quotidienne", recurrence: "daily" }),
        tache({ id: 3, label: "autre jour", due_date: "2026-09-05" }),
      ],
      goals: [objectif({ id: 4, title: "échéance", deadline: "2026-09-02" })],
    });

    const jour = entreesDuJour(src, "2026-09-02", "2026-09-02");
    expect(jour.map((e) => [e.kind, e.titre])).toEqual([
      ["event", "point hebdo"],
      ["task", "datée"],
      ["recurrence", "quotidienne"],
      ["deadline", "échéance"],
    ]);
  });

  it("⚠️ trie d'abord par HEURE, pas par famille", () => {
    // Trier par famille aurait dispersé les heures : on aurait lu « 9 h, 14 h,
    // puis 10 h », ce qui ne se lit pas.
    const src = sources({
      events: [evenement({ id: 1, title: "à 15 h", start_at: "15:00", end_at: "16:00" })],
      tasks: [tache({ id: 2, label: "à 10 h", due_date: "2026-09-02", start_at: "10:00", end_at: "11:00" })],
    });
    expect(entreesDuJour(src, "2026-09-02", "2026-09-02").map((e) => e.titre)).toEqual([
      "à 10 h",
      "à 15 h",
    ]);
  });

  it("ce qui a une heure passe avant ce qui n'occupe que le jour", () => {
    const src = sources({
      events: [
        evenement({ id: 1, title: "anniversaire", all_day: 1 }),
        evenement({ id: 2, title: "réunion", start_at: "16:00", end_at: "17:00" }),
      ],
    });
    expect(entreesDuJour(src, "2026-09-02", "2026-09-02").map((e) => e.titre)).toEqual([
      "réunion",
      "anniversaire",
    ]);
  });

  it("projette un événement récurrent sur ses occurrences", () => {
    // 2026-09-02 est un mercredi, 2026-09-05 un samedi.
    const src = sources({
      events: [evenement({ id: 1, title: "revue", date: "2026-09-02", recurrence: "weekdays" })],
    });
    expect(entreesDuJour(src, "2026-09-03", "2026-09-03")).toHaveLength(1);
    expect(entreesDuJour(src, "2026-09-05", "2026-09-05")).toHaveLength(0);
  });

  it("rien n'a lieu avant la naissance de la série", () => {
    const src = sources({
      events: [evenement({ id: 1, date: "2026-09-10", recurrence: "daily" })],
    });
    expect(entreesDuJour(src, "2026-09-02", "2026-09-02")).toHaveLength(0);
    expect(entreesDuJour(src, "2026-09-11", "2026-09-11")).toHaveLength(1);
  });

  it("un événement « toute la journée » perd son heure", () => {
    const src = sources({
      events: [evenement({ all_day: 1, start_at: "09:00", end_at: "10:00" })],
    });
    const [e] = entreesDuJour(src, "2026-09-02", "2026-09-02");
    expect(e.allDay).toBe(true);
    expect(e.start_at).toBeNull();
    expect(e.dureeMin).toBeNull();
  });
});

describe("les événements sur plusieurs jours", () => {
  const sejour = evenement({
    id: 9, title: "séminaire", date: "2026-09-02", end_date: "2026-09-04", all_day: 1,
  });

  it("occupe CHACUNE de ses journées, bornes comprises", () => {
    const src = sources({ events: [sejour] });
    for (const jour of ["2026-09-02", "2026-09-03", "2026-09-04"]) {
      expect(entreesDuJour(src, jour, "2026-09-02").map((e) => e.titre)).toEqual(["séminaire"]);
    }
    expect(entreesDuJour(src, "2026-09-01", "2026-09-02")).toHaveLength(0);
    expect(entreesDuJour(src, "2026-09-05", "2026-09-02")).toHaveLength(0);
  });

  it("porte ses deux bornes sur chaque journée traversée", () => {
    const e = entreesDuJour(sources({ events: [sejour] }), "2026-09-03", "2026-09-02")[0];
    expect(e.date).toBe("2026-09-03");
    expect(e.debutJour).toBe("2026-09-02");
    expect(e.finJour).toBe("2026-09-04");
    expect(dansLeBandeau(e)).toBe(true);
  });

  it("⭐ n'a AUCUNE durée, pour ne pas fausser la charge", () => {
    // Un séjour de trois jours compté à sa durée horaire ferait passer chaque
    // journée pour surchargée. Il rejoint `evenementsSansHeure`, compté à part.
    const horaire = evenement({
      id: 10, date: "2026-09-02", end_date: "2026-09-03", start_at: "14:00", end_at: "16:00",
    });
    const e = entreesDuJour(sources({ events: [horaire] }), "2026-09-02", "2026-09-02")[0];
    expect(e.dureeMin).toBeNull();
    expect(dansLeBandeau(e)).toBe(true);
  });

  it("⚠️ une borne INVERSÉE ou illisible rend UNE journée, pas une plage vide", () => {
    // Aucune contrainte SQL ne garde `end_date >= date` — elle arrêterait la
    // synchronisation. C'est donc ici que l'incohérence est absorbée, et
    // l'événement doit rester VISIBLE.
    const casse = evenement({ id: 11, date: "2026-09-04", end_date: "2026-09-01" });
    expect(bornesDe(casse)).toEqual({ debut: "2026-09-04", fin: "2026-09-04" });
    expect(estMultiJours(casse)).toBe(false);
    expect(entreesDuJour(sources({ events: [casse] }), "2026-09-04", "2026-09-04")).toHaveLength(1);
  });

  it("⚠️ un événement RÉCURRENT est ramené à une seule journée", () => {
    // Une série dont chaque terme durerait trois jours se recouvrirait
    // elle-même dès le quotidien. Le formulaire l'interdit ; ce garde protège
    // des lignes écrites par une autre version de l'app.
    const serie = evenement({ id: 12, date: "2026-09-02", end_date: "2026-09-06", recurrence: "daily" });
    expect(estMultiJours(serie)).toBe(false);
  });
});

describe("⭐ ce qui ne se glisse pas : les occurrences projetées", () => {
  // La règle du chantier B — « un récurrent ne se déplace pas, sa série serait
  // silencieusement rompue » — était écrite en énumérant des `kind`, et
  // l'énumération avait un trou : les ÉVÉNEMENTS récurrents sont des `event`.
  it("marque `serie` sur un ÉVÉNEMENT récurrent, pas seulement sur une tâche", () => {
    const src = sources({
      events: [
        evenement({ id: 1, title: "ponctuel", date: "2026-09-02" }),
        evenement({ id: 2, title: "hebdo", date: "2026-08-31", recurrence: "weekdays" }),
      ],
    });
    const parTitre = new Map(
      entreesDuJour(src, "2026-09-02", "2026-09-02").map((e) => [e.titre, e]),
    );
    expect(parTitre.get("ponctuel")!.serie).toBe(false);
    expect(parTitre.get("hebdo")!.serie).toBe(true);
    // Les deux sont pourtant de la MÊME famille : c'est ce qui rendait le
    // garde par `kind` incapable de les distinguer.
    expect(parTitre.get("hebdo")!.kind).toBe("event");
    expect(parTitre.get("ponctuel")!.kind).toBe("event");
  });

  it("marque `serie` sur une tâche récurrente et pas sur une tâche datée", () => {
    const src = sources({
      tasks: [
        tache({ id: 1, label: "habitude", recurrence: "daily", created_at: "2026-08-01 09:00:00" }),
        tache({ id: 2, label: "datée", due_date: "2026-09-02" }),
      ],
    });
    const parTitre = new Map(
      entreesDuJour(src, "2026-09-02", "2026-09-02").map((e) => [e.titre, e]),
    );
    expect(parTitre.get("habitude")!.serie).toBe(true);
    expect(parTitre.get("datée")!.serie).toBe(false);
  });
});

describe("les bandes continues du bandeau", () => {
  const semaine = [
    "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03",
    "2026-09-04", "2026-09-05", "2026-09-06",
  ];

  it("recolle les journées consécutives en UNE barre", () => {
    const src = sources({
      events: [evenement({ id: 9, date: "2026-09-02", end_date: "2026-09-04", all_day: 1 })],
    });
    const b = bandesDu(semaine, entreesDeLaPlage(src, semaine[0], semaine[6], semaine[0]));
    expect(b).toHaveLength(1);
    expect(b[0].colonne).toBe(2);
    expect(b[0].span).toBe(3);
    expect(b[0].debuteAvant).toBe(false);
    expect(b[0].finitApres).toBe(false);
  });

  it("⭐ NE recolle PAS deux occurrences séparées d'un même récurrent", () => {
    // Une journée entière qui revient le lundi et le vendredi dessinerait sinon
    // une barre de cinq jours sur une semaine où elle n'a lieu que deux fois.
    const src = sources({
      events: [evenement({ id: 13, date: "2026-08-31", all_day: 1, recurrence: JSON.stringify([1, 5]) })],
    });
    const b = bandesDu(semaine, entreesDeLaPlage(src, semaine[0], semaine[6], semaine[0]));
    expect(b).toHaveLength(2);
    expect(b.map((x) => x.span)).toEqual([1, 1]);
  });

  it("dit qu'une barre est COUPÉE quand le séjour déborde de la fenêtre", () => {
    const src = sources({
      events: [evenement({ id: 9, date: "2026-08-28", end_date: "2026-09-10", all_day: 1 })],
    });
    const b = bandesDu(semaine, entreesDeLaPlage(src, semaine[0], semaine[6], semaine[0]));
    expect(b).toHaveLength(1);
    expect(b[0].span).toBe(7);
    expect(b[0].debuteAvant).toBe(true);
    expect(b[0].finitApres).toBe(true);
  });

  it("⚠️ empile deux séjours qui se chevauchent au lieu de les superposer", () => {
    const src = sources({
      events: [
        evenement({ id: 9, date: "2026-09-01", end_date: "2026-09-03", all_day: 1 }),
        evenement({ id: 14, date: "2026-09-02", end_date: "2026-09-05", all_day: 1 }),
      ],
    });
    const b = bandesDu(semaine, entreesDeLaPlage(src, semaine[0], semaine[6], semaine[0]));
    expect(b.map((x) => x.rang).sort()).toEqual([0, 1]);
  });

  it("remet une barre au rez-de-chaussée dès que la place est libre", () => {
    const src = sources({
      events: [
        evenement({ id: 9, date: "2026-08-31", end_date: "2026-09-01", all_day: 1 }),
        evenement({ id: 14, date: "2026-09-04", end_date: "2026-09-05", all_day: 1 }),
      ],
    });
    const b = bandesDu(semaine, entreesDeLaPlage(src, semaine[0], semaine[6], semaine[0]));
    expect(b.map((x) => x.rang)).toEqual([0, 0]);
  });
});

describe("le retard", () => {
  it("une tâche du 1er est en retard quand on consulte le 5, pas le 1er", () => {
    const src = sources({ tasks: [tache({ due_date: "2026-09-01" })] });
    expect(entreesDuJour(src, "2026-09-01", "2026-09-01")[0].enRetard).toBe(false);
    expect(entreesDuJour(src, "2026-09-01", "2026-09-05")[0].enRetard).toBe(true);
  });

  it("cochée, elle ne l'est plus", () => {
    const completions: Completion[] = [{ id: 1, task_id: 1, date: "2026-09-01", done: 1 }];
    const src = sources({ tasks: [tache({ due_date: "2026-09-01" })], completions });
    expect(entreesDuJour(src, "2026-09-01", "2026-09-05")[0].enRetard).toBe(false);
  });

  it("⚠️ une occurrence d'habitude n'est JAMAIS en retard", () => {
    const src = sources({ tasks: [tache({ recurrence: "daily" })] });
    expect(entreesDuJour(src, "2026-09-01", "2026-09-05")[0].enRetard).toBe(false);
  });
});

describe("les grilles de dates", () => {
  it("énumère une plage, bornes comprises", () => {
    expect(joursEntre("2026-09-01", "2026-09-04")).toEqual([
      "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04",
    ]);
    expect(joursEntre("2026-09-01", "2026-09-01")).toEqual(["2026-09-01"]);
  });

  it("⭐ traverse le changement d'heure sans perdre ni doubler un jour", () => {
    // Le piège : un pas de 24 h à partir de MINUIT tombe à 23 h la veille le
    // jour du passage à l'heure d'été. Le 2026-03-29 est ce jour-là en Europe.
    const mars = joursEntre("2026-03-27", "2026-03-31");
    expect(mars).toEqual(["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
    const octobre = joursEntre("2026-10-23", "2026-10-27");
    expect(octobre).toEqual(["2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
  });

  it("⚠️ la semaine commence le LUNDI, pas le dimanche", () => {
    // `getDay()` compte à partir du dimanche : confondre les deux décale toute
    // la grille d'un jour.
    expect(lundiDe("2026-09-02")).toBe("2026-08-31"); // mercredi → lundi d'avant
    expect(lundiDe("2026-08-31")).toBe("2026-08-31"); // un lundi reste lui-même
    expect(lundiDe("2026-09-06")).toBe("2026-08-31"); // dimanche → lundi de SA semaine
  });

  it("une semaine fait sept jours, du lundi au dimanche", () => {
    const s = semaineDe("2026-09-02");
    expect(s).toHaveLength(7);
    expect(s[0]).toBe("2026-08-31");
    expect(s[6]).toBe("2026-09-06");
  });

  it("⭐ la grille du mois fait TOUJOURS six semaines", () => {
    // Une grille dont la hauteur change d'un mois à l'autre fait sauter toute
    // la page en naviguant.
    for (const jour of ["2026-02-15", "2026-09-02", "2026-11-30", "2027-02-01"]) {
      const g = grilleDuMois(jour);
      expect(g).toHaveLength(42);
      expect(lundiDe(g[0])).toBe(g[0]);
    }
  });

  it("la grille du mois contient bien le premier et le dernier jour du mois", () => {
    const g = grilleDuMois("2026-09-02");
    expect(g).toContain("2026-09-01");
    expect(g).toContain("2026-09-30");
  });
});
