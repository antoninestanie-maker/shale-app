/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "../corbeille/repo.testutil";
import { uidDeLigne } from "../objectifs/progression";
import type { GoalInput } from "../repo";
import { tableauParObjectif } from "./parObjectif";
import { CLE_PROMESSES, lirePromesses } from "./promesses";

/**
 * ⭐ LES HEURES PROMISES — sur une vraie base, puis en démo (2026-10-11).
 *
 * Par l'API publique de `repo.ts` seulement, comme `notesATrier.api.test.ts` :
 * l'onglet « Par objectif » n'a été VU qu'en démo, où l'on ne peut pas
 * recharger la page pour vérifier qu'une promesse a tenu. Ce fichier rejoue
 * donc, des deux côtés, ce que font l'onglet et l'accueil : écrire la
 * promesse, la relire, et la retrouver sur la ligne de son objectif.
 */

let courante: BaseCommeTauri;
/** Les écritures de `settings` vues par la base (côté natif). */
let ecritures: string[] = [];
vi.mock("../db", () => ({
  getDb: async (): Promise<BaseCommeTauri> => ({
    select: (sql, params) => courante.select(sql, params),
    execute: (sql, params) => {
      if (/INTO settings/i.test(sql)) ecritures.push(String(params?.[0]));
      return courante.execute(sql, params);
    },
  }),
}));

type Repo = typeof import("../repo");
type Acces = typeof import("./promessesAcces");
type Semer = typeof import("../onboarding/semer");

const objectif = (title: string): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: null,
  parent_goal_id: null,
  deadline: null,
  progress_pct: 0,
  manual_progress: 0,
});

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("les heures promises — $mode", ({ natif }) => {
  let repo: Repo;
  let acces: Acces;
  let semer: Semer;
  let sqlite: DatabaseSync | undefined;

  beforeEach(async () => {
    const w = window as unknown as Record<string, unknown>;
    if (natif) {
      ({ sqlite, db: courante } = baseDeTest());
      w.__TAURI_INTERNALS__ = {};
    } else {
      delete w.__TAURI_INTERNALS__;
    }
    ecritures = [];
    vi.resetModules();
    repo = await import("../repo");
    acces = await import("./promessesAcces");
    semer = await import("../onboarding/semer");
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  const uidObjectif = async (id: number) => (await repo.uidDe("goal", id))!;
  /** Ce que l'onglet calcule, par les mêmes lectures que lui. */
  const ligneDe = async (id: number) => {
    const data = await repo.fetchAll("2000-01-01");
    return tableauParObjectif({
      goals: data.goals,
      tasks: data.tasks,
      completions: data.completions,
      habits: data.habits,
      habitChecks: data.habitChecks,
      focusSessions: data.focusSessions,
      promesses: await acces.chargerPromesses(),
      today: "2000-01-06",
    }).lignes.find((l) => l.goal.id === id);
  };

  it("sans rien d'écrit : aucune promesse, et la lecture ne tombe pas", async () => {
    expect((await acces.chargerPromesses()).size).toBe(0);
  });

  it("⚠️ l'objectif lu par `fetchAll` porte l'identité sous laquelle sa promesse est rangée", async () => {
    // Tout l'onglet repose là-dessus : sans cet accord, aucune promesse ne
    // retrouverait sa ligne.
    const id = await repo.createGoal(objectif("Identité"));
    const lu = (await repo.fetchAll("2000-01-01")).goals.find((g) => g.id === id)!;
    expect(uidDeLigne("goal", lu)).toBe(await uidObjectif(id));
  });

  it("⭐ une promesse posée se relit, et arrive sur la ligne de son objectif", async () => {
    const a = await repo.createGoal(objectif("Mémoire"));
    const b = await repo.createGoal(objectif("Boutique"));
    const r = await acces.enregistrerPromesse(await uidObjectif(a), 5);
    expect(r.ecrit).toBe(true);
    expect(lirePromesses(await repo.getSetting(CLE_PROMESSES)).get(await uidObjectif(a))).toBe(5);
    expect((await ligneDe(a))?.promesse).toBe(5);
    expect((await ligneDe(b))?.promesse).toBeNull();
  });

  it("⭐ elle n'est écrite QUE quand elle change", async () => {
    const a = await repo.createGoal(objectif("Mémoire"));
    const uid = await uidObjectif(a);
    ecritures = [];
    expect((await acces.enregistrerPromesse(uid, 5)).ecrit).toBe(true);
    expect((await acces.enregistrerPromesse(uid, 5)).ecrit).toBe(false); // même valeur
    expect((await acces.enregistrerPromesse("un-autre", 0)).ecrit).toBe(false); // retirer ce qui n'existe pas
    expect((await acces.enregistrerPromesse(uid, 2.5)).ecrit).toBe(true);
    if (natif) expect(ecritures).toEqual([CLE_PROMESSES, CLE_PROMESSES]);
    expect((await ligneDe(a))?.promesse).toBe(2.5);
  });

  it("vide = pas de promesse : la retirer ne touche pas celle des autres objectifs", async () => {
    const a = await repo.createGoal(objectif("Mémoire"));
    const b = await repo.createGoal(objectif("Boutique"));
    await acces.enregistrerPromesse(await uidObjectif(a), 5);
    await acces.enregistrerPromesse(await uidObjectif(b), 3);
    await acces.enregistrerPromesse(await uidObjectif(a), 0);
    expect([(await ligneDe(a))?.promesse, (await ligneDe(b))?.promesse]).toEqual([null, 3]);
  });

  it("⚠️ l'écriture relit le réglage : une promesse arrivée entre-temps n'est pas écrasée", async () => {
    const a = await repo.createGoal(objectif("Mémoire"));
    const b = await repo.createGoal(objectif("Boutique"));
    await acces.enregistrerPromesse(await uidObjectif(a), 5);
    // Un autre appareil (ou une autre fenêtre) pose celle de B sans passer par l'onglet.
    await repo.setSetting(CLE_PROMESSES, JSON.stringify({ [await uidObjectif(a)]: 5, [await uidObjectif(b)]: 7 }));
    await acces.enregistrerPromesse(await uidObjectif(a), 6);
    expect([(await ligneDe(a))?.promesse, (await ligneDe(b))?.promesse]).toEqual([6, 7]);
  });

  it("un réglage abîmé ne bloque ni la lecture ni l'écriture suivante", async () => {
    const a = await repo.createGoal(objectif("Mémoire"));
    await repo.setSetting(CLE_PROMESSES, "{pas du json");
    expect((await acces.chargerPromesses()).size).toBe(0);
    await acces.enregistrerPromesse(await uidObjectif(a), 4);
    expect((await ligneDe(a))?.promesse).toBe(4);
  });

  describe("⭐ l'accueil écrit la promesse de l'objectif qu'il plante", () => {
    it("les heures choisies deviennent la promesse de l'objectif planté — et il n'a toujours aucune échéance", async () => {
      const { racineId } = await semer.creerObjectifPlanifie("Finir mon mémoire", ["Plan", "Rédaction"], 5);
      const ligne = await ligneDe(racineId);
      expect(ligne?.promesse).toBe(5);
      const plante = (await repo.fetchAll("2000-01-01")).goals.find((g) => g.id === racineId)!;
      expect(plante.deadline).toBeNull();
      expect(ligne?.echeance).toBeNull();
      // La phrase de la description reste : l'intention du premier jour.
      expect(plante.description).toMatch(/5/);
    });

    it("sans heures (écran passé, aucune heure libre) : aucune promesse, et rien d'écrit", async () => {
      ecritures = [];
      const { racineId } = await semer.creerObjectifPlanifie("Sans chiffre", [], 0);
      expect((await ligneDe(racineId))?.promesse).toBeNull();
      expect(await repo.getSetting(CLE_PROMESSES)).toBeNull();
      if (natif) expect(ecritures).not.toContain(CLE_PROMESSES);
    });

    it("l'objectif du curseur (« Récupérer N h par semaine ») n'en reçoit pas : ce ne sont pas des heures de minuteur", async () => {
      await semer.creerObjectifDuCurseur(8);
      expect((await acces.chargerPromesses()).size).toBe(0);
    });
  });
});
