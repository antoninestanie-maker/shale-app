import { describe, expect, it } from "vitest";

import { entreesDuJour, type EntreeAgenda } from "./calendrier/agenda";
import { chargeDuJour } from "./calendrier/charge";
import { creneauxOccupes, profilDisponibilite } from "./calendrier/disponibilite";
import { objectifsEnPeril } from "./calendrier/peril";
import { etatsVivants } from "./carteEtat";
import { dayStat, todayTasks } from "./logic";
import { coche, objectif, tache } from "./objectifs/objectif.testutil";
import {
  changerEtat,
  changerRecurrence,
  estSuspendue,
  fermerPause,
  lirePauses,
  ponctuellesFaites,
  tachesARelancer,
  tachesDuBlocDuHaut,
} from "./taches";
import { badgeDEntree, badgeEtat } from "./taches/etat";
import { compteDuJour, estFaite, ranger, sectionDe } from "./tachesVue";
import type { Carte } from "./carte";
import type { Task } from "./types";

/**
 * ⭐ LOT 2 DE L'AUDIT DU 2026-10-20 — les défauts des états de tâche (031).
 * Un `describe` par défaut, nommé par son identifiant dans
 * `labo/passes/2026-10-20-audit/chasse-code.json`.
 */

const AUJ = "2026-10-20";

describe("taches-1 / donnees-1 — reprendre une routine ne réécrit pas l'historique", () => {
  const routine = tache({ id: 1, recurrence: "daily", created_at: "2026-10-01 08:00:00" });

  it("⭐ en attente le 10, reprise le 20 : les jours du 10 au 19 restent neutres", () => {
    const enPause = { ...routine, ...changerEtat(routine, "waiting", "2026-10-10") };
    expect(dayStat([enPause], [], "2026-10-15").pct).toBeNull();
    const reprise = { ...enPause, ...changerEtat(enPause, "todo", AUJ) };
    // Avant la 032 : { total: 1, done: 0, pct: 0 } — chaque jour de pause devenait manqué.
    expect(dayStat([reprise], [], "2026-10-15").pct).toBeNull();
    expect(dayStat([reprise], [], "2026-10-09").total).toBe(1);
    // Le jour de la reprise compte de nouveau.
    expect(todayTasks([reprise], [], AUJ).map((t) => t.id)).toEqual([1]);
    expect(lirePauses(reprise.pauses)).toEqual([["2026-10-10", AUJ]]);
  });

  it("en cours, puis d'attente à abandonnée : la suspension reste continue", () => {
    let t: Task = { ...routine, ...changerEtat(routine, "waiting", "2026-10-10") };
    t = { ...t, ...changerEtat(t, "dropped", "2026-10-14") };
    expect(estSuspendue(t, "2026-10-12")).toBe(true); // la pause d'attente, gardée
    expect(estSuspendue(t, "2026-10-16")).toBe(true); // l'abandon en cours
    t = { ...t, ...changerEtat(t, "doing", AUJ) };
    // Reprise « en cours » : les deux suspensions restent dans l'historique, aujourd'hui compte.
    expect(estSuspendue(t, "2026-10-12")).toBe(true);
    expect(estSuspendue(t, "2026-10-16")).toBe(true);
    expect(estSuspendue(t, AUJ)).toBe(false);
    expect(lirePauses(t.pauses)).toEqual([["2026-10-10", AUJ]]);
  });

  it("une suspension sans date (« depuis toujours ») se ferme en pause ouverte à gauche", () => {
    const t = tache({ recurrence: "daily", state: "dropped", state_since: null });
    const reprise = { ...t, ...changerEtat(t, "todo", AUJ) };
    expect(lirePauses(reprise.pauses)).toEqual([[null, AUJ]]);
    expect(estSuspendue(reprise, "2020-01-01")).toBe(true);
    expect(estSuspendue(reprise, AUJ)).toBe(false);
  });

  it("posée et levée le même jour : rien à garder ; collée à la précédente : elle la prolonge", () => {
    expect(fermerPause(null, AUJ, AUJ)).toBeNull();
    expect(fermerPause('[["2026-10-01","2026-10-05"]]', "2026-10-05", "2026-10-08")).toBe('[["2026-10-01","2026-10-08"]]');
    expect(lirePauses("{pas du json}")).toEqual([]);
  });
});

describe("taches-2 — changer la relance d'une routine en attente garde sa date", () => {
  it("⭐ d'attente à attente, `state_since` ne bouge pas", () => {
    const t = tache({ recurrence: "daily", state: "waiting", state_since: "2026-10-10", waiting_for: "Paul" });
    const neuf = changerEtat(t, "waiting", AUJ, { waiting_for: t.waiting_for, follow_up_on: "2026-10-21" });
    // Avant : `state_since` = AUJ, et les jours du 10 au 19 redevenaient dus.
    expect(neuf.state_since).toBe("2026-10-10");
    expect(neuf.follow_up_on).toBe("2026-10-21");
    expect(neuf.waiting_for).toBe("Paul");
    expect(dayStat([{ ...t, ...neuf }], [], "2026-10-15").pct).toBeNull();
  });
});

describe("taches-3 — une routine en attente remonte « À relancer » sur Aujourd'hui", () => {
  it("⭐ une coche passée ne la retire plus ; cochée ce jour-là, si", () => {
    const routine = tache({ id: 4, recurrence: "daily", state: "waiting", follow_up_on: AUJ });
    // Avant : `ponctuellesFaites` la disait faite pour toujours → liste vide.
    expect(tachesARelancer([routine], [coche(4, "2026-10-05")], AUJ).map((t) => t.id)).toEqual([4]);
    expect(tachesARelancer([routine], [coche(4, AUJ)], AUJ)).toEqual([]);
    // Et la vue Tâches dit la même chose.
    const { faite } = estFaite(routine, [coche(4, "2026-10-05")], AUJ);
    expect(sectionDe(routine, faite, AUJ)).toBe("aujourdhui");
  });
});

describe("taches-4 — le menu d'une ligne « À relancer » d'Aujourd'hui", () => {
  it("⭐ les lignes du bloc du haut et la cible du menu sortent de la MÊME liste", () => {
    const retard = tache({ id: 1, due_date: "2026-10-18" });
    const relance = tache({ id: 2, state: "waiting", follow_up_on: AUJ });
    const liste = tachesDuBlocDuHaut([retard, relance], [], AUJ);
    expect(liste.map((t) => t.id)).toEqual([1, 2]);
    // Le menu relit sa cible dans cette liste : la relance y est (avant : seulement les retards).
    expect(liste.find((t) => t.id === 2)).toBeDefined();
  });
});

describe("taches-6 — changer une routine en « Une fois », et l'inverse", () => {
  const routine = tache({ id: 6, recurrence: "daily", created_at: "2026-10-01 08:00:00" });

  it("⭐ devenue ponctuelle, ses anciennes coches ne la disent pas faite", () => {
    const conv = { ...routine, recurrence: "none", due_date: "2026-10-25", ...changerRecurrence(routine, "none", AUJ) };
    expect(conv.ponctuelle_depuis).toBe(AUJ);
    const coches = [coche(6, "2026-10-12")];
    // Avant : { faite: true, le: "2026-10-12" }, rangée dans « Faites ».
    expect(estFaite(conv, coches, AUJ)).toEqual({ faite: false, le: null });
    expect(ponctuellesFaites(coches, [conv]).has(6)).toBe(false);
    expect(ranger([conv], coches, AUJ).get("avenir")!.map((t) => t.id)).toEqual([6]);
    // Cochée après la conversion, elle est faite.
    expect(estFaite(conv, [...coches, coche(6, "2026-10-21")], "2026-10-21").faite).toBe(true);
  });

  it("devenue routine, elle perd « reportée N fois » (une routine ne se reporte pas)", () => {
    const glissee = tache({ postponed_count: 2, postponed_from: "2026-10-01", ponctuelle_depuis: "2026-10-05" });
    expect(changerRecurrence(glissee, "daily", AUJ)).toEqual({ ponctuelle_depuis: null, postponed_count: 0, postponed_from: null });
    // Sans changement de famille, rien ne bouge.
    expect(changerRecurrence(glissee, "none", AUJ)).toEqual({
      ponctuelle_depuis: "2026-10-05",
      postponed_count: 2,
      postponed_from: "2026-10-01",
    });
  });
});

describe("objectifs-3 / temps-4 — abandonner des tâches ne met pas un objectif en péril", () => {
  it("⭐ 4 faites sur 5, échéance dans 3 jours, 3 abandonnées : pas en péril", () => {
    const g = objectif({ id: 10, title: "Lancer", deadline: "2026-10-23", created_at: "2026-09-01 08:00:00" });
    const faites = [1, 2, 3, 4].map((id) => tache({ id, goal_id: 10 }));
    const reste = tache({ id: 5, goal_id: 10 });
    const lachees = [6, 7, 8].map((id) => tache({ id, goal_id: 10, state: "dropped", state_since: AUJ }));
    const coches = [1, 2, 3, 4].map((id) => coche(id, "2026-10-19"));
    expect(objectifsEnPeril([g], [...faites, reste], coches, AUJ)).toEqual([]);
    // Avant : [{ raison: "trop-peu-de-jours", tachesRestantes: 4 }].
    expect(objectifsEnPeril([g], [...faites, reste, ...lachees], coches, AUJ)).toEqual([]);
  });
});

describe("objectifs-4 — la carte mentale lit l'état", () => {
  it("une tâche en attente, datée d'hier, n'est pas « en retard » sur la carte", () => {
    const t = tache({ id: 1, uid: "u1", due_date: "2026-10-19", state: "waiting", state_since: "2026-10-18" } as Partial<Task>);
    const carte = { noeuds: [{ id: "n1", ref: { kind: "task", uid: "u1" } }] } as unknown as Carte;
    const etat = etatsVivants(carte, { tasks: [t], goals: [], completions: [], today: AUJ } as never).get("n1");
    expect(etat && "enRetard" in etat && etat.enRetard).toBe(false);
  });
});

describe("temps-7 — une tâche en attente ne pèse pas sur la charge du jour", () => {
  const profil = profilDisponibilite([]);
  const longue = tache({ id: 1, due_date: AUJ, start_at: "09:00", end_at: "17:00", state: "waiting", state_since: AUJ });
  const src = { events: [], tasks: [longue], completions: [], goals: [] };

  it("⭐ reste visible à sa date, mais ni minutes posées ni créneau occupé", () => {
    const entrees = entreesDuJour(src, AUJ, AUJ);
    expect(entrees.map((e) => e.id)).toEqual([1]);
    expect(chargeDuJour(entrees, profil, AUJ).posees).toBe(0);
    expect(creneauxOccupes(entrees)).toEqual([]);
    // À faire, elle pèse ses huit heures.
    const aFaire = entreesDuJour({ ...src, tasks: [{ ...longue, state: "todo" }] }, AUJ, AUJ);
    expect(chargeDuJour(aFaire, profil, AUJ).posees).toBe(480);
  });
});

describe("taches-8 — le sous-titre de Tâches ne compte pas les relances comme tâches du jour", () => {
  it("⭐ une datée du jour et une relance : 1 tâche aujourd'hui, 1 à relancer", () => {
    const datee = tache({ id: 1, due_date: AUJ });
    const relance = tache({ id: 2, state: "waiting", follow_up_on: AUJ });
    const sections = ranger([datee, relance], [], AUJ);
    expect(sections.get("aujourdhui")!.length).toBe(2);
    expect(compteDuJour(sections.get("aujourdhui")!)).toEqual({ prevues: 1, aRelancer: 1 });
    // Le même nombre que la carte « Tâches du jour ».
    expect(todayTasks([datee, relance], [], AUJ).length).toBe(1);
  });
});

describe("constat d'usage 21 — l'état se voit là où la tâche paraît", () => {
  it("le badge se déduit : en cours, en attente, à relancer, abandonnée — rien quand elle est faite", () => {
    expect(badgeEtat(tache({ state: "doing" }), false, AUJ)).toBe("en-cours");
    expect(badgeEtat(tache({ state: "waiting", follow_up_on: "2026-10-23" }), false, AUJ)).toBe("en-attente");
    expect(badgeEtat(tache({ state: "waiting", follow_up_on: AUJ }), false, AUJ)).toBe("a-relancer");
    expect(badgeEtat(tache({ state: "dropped" }), false, AUJ)).toBe("abandonnee");
    expect(badgeEtat(tache({ state: "doing" }), true, AUJ)).toBeNull();
    expect(badgeEtat(tache(), false, AUJ)).toBeNull();
  });

  it("une entrée du calendrier porte l'état de sa tâche, et sa relance", () => {
    const t = tache({ id: 1, due_date: AUJ, state: "waiting", state_since: AUJ, follow_up_on: "2026-10-23" });
    const [e] = entreesDuJour({ events: [], tasks: [t], completions: [], goals: [] }, AUJ, AUJ) as EntreeAgenda[];
    expect(e.etat).toBe("waiting");
    expect(e.relance).toBe("2026-10-23");
    expect(badgeDEntree(e, AUJ)).toBe("en-attente");
  });
});
