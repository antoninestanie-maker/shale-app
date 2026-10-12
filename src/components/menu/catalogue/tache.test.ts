import { afterEach, describe, expect, it, vi } from "vitest";
import { entreesTache, gestesCommunsTache, type GestesTache } from "./tache";
import { ordonner } from "../../../lib/menu/entrees";
import { addDays, todayStr } from "../../../lib/logic";
import { demandeDeDate, fermerSelecteurDate } from "../../../lib/selecteurDate";
import { lundiProchain } from "../../../lib/taches/dates";
import type { Task } from "../../../lib/types";
import { MINUTEUR_AU_REPOS, type EtatMinuteur } from "../../../lib/seance/focusTache";
import type { GesteFocus } from "../../../lib/seance/gesteFocus";

// Les gestes communs écrivent par le dépôt : on regarde ce qu'ils lui demandent.
const depot = vi.hoisted(() => ({
  setTaskSchedule: vi.fn(async () => {}),
  appliquerReport: vi.fn(async () => {}),
}));
vi.mock("../../../lib/repo", () => ({
  ...depot,
  createTask: vi.fn(),
  prioriserTache: vi.fn(),
  rattacherTache: vi.fn(),
}));

const tache = { id: 7, label: "Session trading", done: false, goal_id: null } as unknown as Task;

function gestes(focus?: GestesTache["focus"]): GestesTache {
  const rien = vi.fn(async () => {});
  return {
    basculer: vi.fn(),
    renommer: vi.fn(),
    modifier: vi.fn(),
    dater: rien,
    rattacher: rien,
    dupliquer: rien,
    supprimer: rien,
    prioriser: rien,
    focus,
  };
}

const ids = (g: GestesTache, faite = false) =>
  ordonner(entreesTache(tache, g, { faite, objectifs: [] })).map((e) => e.id);

describe("« Focus 25 min » dans le menu d'une tâche", () => {
  const entreeFocus = (g: GestesTache, faite = false) =>
    ordonner(entreesTache(tache, g, { faite, objectifs: [] })).find((e) => e.id === "focus");
  const geste = (etat: EtatMinuteur = MINUTEUR_AU_REPOS): GesteFocus => ({ etat, agir: vi.fn(async () => null) });

  it("vient juste après Terminer, et appelle EXACTEMENT le geste du ▶ du widget (règle 18)", () => {
    const focus = geste();
    const g = gestes(focus);
    expect(ids(g).slice(0, 2)).toEqual(["basculer", "focus"]);
    const entree = entreeFocus(g)!;
    expect(entree.desactive).toBeUndefined();
    void entree.executer!();
    expect(focus.agir).toHaveBeenCalledWith(tache, false);
  });

  it("⭐ reste là pendant une séance : grisée, avec sa raison (2026-10-12)", () => {
    const ailleurs = geste({ seance: { kind: "focus", taskId: 3, label: "Relire le contrat" }, enPause: false });
    const entree = entreeFocus(gestes(ailleurs))!;
    expect(entree.desactive?.raison).toContain("Relire le contrat");
  });

  it("⭐ pendant une pause enchaînée, elle agit : on peut se remettre au travail", () => {
    const pause = geste({ seance: { kind: "break", taskId: null, label: "Pause" }, enPause: false });
    expect(entreeFocus(gestes(pause))!.desactive).toBeUndefined();
  });

  it("⭐ sur une tâche faite : là, grisée, et dit de la rouvrir — plus absente", () => {
    const entree = entreeFocus(gestes(geste()), true)!;
    expect(entree.desactive?.raison).toBeTruthy();
  });

  it("absente seulement hors de l'app, là où aucun minuteur n'existe (un test, la capture)", () => {
    expect(ids(gestes())).not.toContain("focus");
    expect(ids(gestes(null))).not.toContain("focus");
  });
});

describe("⭐ « Dater ▸ » : reporter sans rouvrir une fenêtre (2026-10-11)", () => {
  const AUJ = todayStr();
  const dater = (task: Task, g: GestesTache) =>
    ordonner(entreesTache(task, g, { faite: false, objectifs: [] })).find((e) => e.id === "dater")?.sousMenu ?? [];
  const avec = (due_date: string | null, extra: Partial<Task> = {}) =>
    ({ ...tache, recurrence: "none", due_date, postponed_count: 0, ...extra }) as Task;

  afterEach(() => fermerSelecteurDate());

  it("sans date : + 1 jour, Aujourd'hui, Demain, Lundi prochain, Choisir — pas de « Retirer »", () => {
    expect(dater(avec(null), gestes()).map((e) => e.id)).toEqual([
      "dater-plus-un",
      "dater-auj",
      "dater-demain",
      "dater-lundi",
      "dater-choisir",
    ]);
  });

  it("datée d'aujourd'hui : « Aujourd'hui » n'écrirait rien, il s'efface ; « Retirer la date » apparaît", () => {
    expect(dater(avec(AUJ), gestes()).map((e) => e.id)).toEqual([
      "dater-plus-un",
      "dater-demain",
      "dater-lundi",
      "dater-choisir",
      "dater-retirer",
    ]);
  });

  it("⭐ « + 1 jour » part de la date de la TÂCHE ; d'aujourd'hui si elle est en retard ou sans date", () => {
    const g = gestes();
    const dans5 = avec(addDays(AUJ, 5));
    dater(dans5, g).find((e) => e.id === "dater-plus-un")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(dans5, addDays(AUJ, 6));

    const enRetard = avec(addDays(AUJ, -3));
    dater(enRetard, g).find((e) => e.id === "dater-plus-un")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(enRetard, addDays(AUJ, 1));

    const sansDate = avec(null);
    dater(sansDate, g).find((e) => e.id === "dater-plus-un")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(sansDate, addDays(AUJ, 1));
  });

  it("Demain, Lundi prochain et Retirer appellent le MÊME geste `dater`", () => {
    const g = gestes();
    const task = avec(addDays(AUJ, 5));
    const entrees = dater(task, g);
    entrees.find((e) => e.id === "dater-demain")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(task, addDays(AUJ, 1));
    entrees.find((e) => e.id === "dater-lundi")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(task, lundiProchain(AUJ));
    entrees.find((e) => e.id === "dater-retirer")!.executer!();
    expect(g.dater).toHaveBeenLastCalledWith(task, null);
  });

  it("⭐ « Choisir une date… » ouvre le calendrier SUR PLACE — plus la fenêtre de la tâche", () => {
    const g = gestes();
    const task = avec(addDays(AUJ, 2));
    dater(task, g).find((e) => e.id === "dater-choisir")!.executer!({
      element: null,
      ancre: { top: 100, bottom: 120, left: 300, right: 330 },
    });
    expect(g.modifier).not.toHaveBeenCalled();
    const demande = demandeDeDate()!;
    expect(demande.valeur).toBe(addDays(AUJ, 2));
    // Accroché sous le point où le menu s'était ouvert.
    expect(demande.ancre()).toEqual({ top: 120, bottom: 120, left: 300 });

    // Le jour choisi passe par le geste commun ; la date déjà en place n'écrit rien.
    demande.onChoisir(addDays(AUJ, 2));
    expect(g.dater).not.toHaveBeenCalled();
    demande.onChoisir(addDays(AUJ, 9));
    expect(g.dater).toHaveBeenLastCalledWith(task, addDays(AUJ, 9));
    // « Effacer » dans le calendrier retire la date.
    demande.onChoisir("");
    expect(g.dater).toHaveBeenLastCalledWith(task, null);
  });

  it("une routine ne se date pas : l'entrée est grisée, avec sa raison", () => {
    const entree = ordonner(entreesTache(avec(null, { recurrence: "daily" }), gestes(), { faite: false, objectifs: [] })).find(
      (e) => e.id === "dater",
    )!;
    expect(entree.desactive?.raison).toBeTruthy();
  });
});

describe("⭐ dater à la main remet le compteur de reports à zéro (`replanifier`)", () => {
  const AUJ = todayStr();
  const refresh = vi.fn(async () => {});
  const tacheDatee = (extra: Partial<Task>) =>
    ({ ...tache, recurrence: "none", start_at: "09:00", end_at: "10:00", postponed_from: null, ...extra }) as Task;

  afterEach(() => {
    depot.setTaskSchedule.mockClear();
    depot.appliquerReport.mockClear();
  });

  it("une tâche qui avait glissé deux fois : la date est écrite, puis le compteur repart de zéro", async () => {
    const task = tacheDatee({ due_date: addDays(AUJ, -1), postponed_count: 2, postponed_from: addDays(AUJ, -3) });
    await gestesCommunsTache(refresh).dater(task, addDays(AUJ, 4));
    // Le créneau horaire est gardé quand on change de jour.
    expect(depot.setTaskSchedule).toHaveBeenCalledWith(7, addDays(AUJ, 4), "09:00", "10:00");
    expect(depot.appliquerReport).toHaveBeenCalledWith(7, {
      due_date: addDays(AUJ, 4),
      postponed_count: 0,
      postponed_from: addDays(AUJ, 4),
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("une tâche jamais reportée : une seule écriture", async () => {
    await gestesCommunsTache(refresh).dater(tacheDatee({ due_date: AUJ, postponed_count: 0 }), addDays(AUJ, 1));
    expect(depot.setTaskSchedule).toHaveBeenCalledTimes(1);
    expect(depot.appliquerReport).not.toHaveBeenCalled();
  });

  it("retirer la date ne touche pas au compteur, et le créneau tombe avec le jour", async () => {
    await gestesCommunsTache(refresh).dater(tacheDatee({ due_date: AUJ, postponed_count: 2 }), null);
    expect(depot.setTaskSchedule).toHaveBeenCalledWith(7, null, null, null);
    expect(depot.appliquerReport).not.toHaveBeenCalled();
  });
});

describe("⭐ « Priorité ▸ » dans le menu d'une tâche (2026-09-30)", () => {
  const sousMenu = (task: Task, g: GestesTache) =>
    ordonner(entreesTache(task, g, { faite: false, objectifs: [] })).find((e) => e.id === "priorite")?.sousMenu ?? [];

  it("trois choix, de la plus faible à la plus élevée, juste après « Dater »", () => {
    const g = gestes();
    const liste = ids(g);
    expect(liste.indexOf("priorite")).toBe(liste.indexOf("dater") + 1);
    expect(sousMenu({ ...tache, priority: "medium" }, g).map((e) => e.id)).toEqual([
      "priorite-low",
      "priorite-medium",
      "priorite-high",
    ]);
  });

  it("choisir appelle `prioriser` avec la valeur ; la priorité actuelle ne réécrit rien", () => {
    const g = gestes();
    const task = { ...tache, priority: "medium" } as Task;
    const entrees = sousMenu(task, g);
    entrees.find((e) => e.id === "priorite-high")!.executer!();
    expect(g.prioriser).toHaveBeenCalledWith(task, "high");
    entrees.find((e) => e.id === "priorite-medium")!.executer!();
    expect(g.prioriser).toHaveBeenCalledTimes(1);
  });
});

describe("les actions d'IA dans le menu d'une tâche (phase E)", () => {
  const avec = (task: Task, ctx: { faite?: boolean; ia?: boolean }) =>
    ordonner(entreesTache(task, gestes(), { faite: ctx.faite ?? false, objectifs: [], ia: ctx.ia })).map((e) => e.id);

  it("absentes sans Shale Pro (ou sur iOS) : jamais grisées, jamais une publicité", () => {
    expect(avec(tache, {}).filter((id) => id.startsWith("ia-"))).toEqual([]);
    expect(avec(tache, { ia: false }).filter((id) => id.startsWith("ia-"))).toEqual([]);
  });

  it("Découper et Estimer sur une tâche ponctuelle à faire ; une routine ou une tâche faite ne se découpe pas", () => {
    expect(avec(tache, { ia: true }).filter((id) => id.startsWith("ia-"))).toEqual(["ia-decouper", "ia-estimer"]);
    expect(avec({ ...tache, recurrence: "daily" }, { ia: true }).filter((id) => id.startsWith("ia-"))).toEqual(["ia-estimer"]);
    expect(avec(tache, { ia: true, faite: true }).filter((id) => id.startsWith("ia-"))).toEqual(["ia-estimer"]);
  });

  it("l'entrée demande la fenêtre commune, avec l'identifiant de la tâche", () => {
    const recu: unknown[] = [];
    const ecoute = (e: Event) => recu.push((e as CustomEvent).detail);
    const cible = new EventTarget();
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => cible.dispatchEvent(e) });
    cible.addEventListener("sb:ia-action", ecoute);
    ordonner(entreesTache(tache, gestes(), { faite: false, objectifs: [], ia: true })).find((e) => e.id === "ia-decouper")!.executer!();
    vi.unstubAllGlobals();
    expect(recu).toEqual([{ action: "decouper", taskId: 7 }]);
  });
});
