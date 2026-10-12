/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./repo.testutil";
import type { GoalInput } from "../repo";

/**
 * ⭐⭐ LE MÊME SCÉNARIO, DEUX FOIS : SUR UNE VRAIE BASE, PUIS EN MODE DÉMO.
 *
 * Uniquement par l'API publique de `repo.ts` — celle qu'appelleront les menus
 * et la vue « Supprimés récemment ». Toute divergence entre l'app et la démo
 * fait échouer l'un des deux passages.
 *
 * ⚠️ POURQUOI C'EST NÉCESSAIRE ICI PLUS QU'AILLEURS. Les captures d'écran des
 * phases 3 et 4 se font en mode démo (`PASSATION.md` § 13.2). Une démo qui
 * divergerait de l'app ferait « prouver » à l'écran un comportement que l'app
 * n'a pas — `PIEGES.md` § 6.2 quater, « un accès démo trop indulgent masque ce
 * que le natif détruit ».
 */

let courante: BaseCommeTauri;
vi.mock("../db", () => ({ getDb: async () => courante }));

type Repo = typeof import("../repo");

const objectif = (title: string, parent: number | null = null): GoalInput => ({
  title,
  description: null,
  scope: "long",
  category: null,
  parent_goal_id: parent,
  deadline: null,
  progress_pct: 0,
  manual_progress: 1,
});

const JOUR = 24 * 60 * 60 * 1000;

describe.each([
  { mode: "natif (vraie base SQLite)", natif: true },
  { mode: "démo (en mémoire)", natif: false },
])("la corbeille — $mode", ({ natif }) => {
  let repo: Repo;
  let sqlite: DatabaseSync | undefined;

  beforeEach(async () => {
    const w = window as unknown as Record<string, unknown>;
    if (natif) {
      ({ sqlite, db: courante } = baseDeTest());
      w.__TAURI_INTERNALS__ = {};
    } else {
      delete w.__TAURI_INTERNALS__;
    }
    // Un module neuf à chaque test : en démo, c'est un magasin en mémoire neuf.
    vi.resetModules();
    repo = await import("../repo");
    expect(repo.isTauri).toBe(natif);
  });
  afterEach(() => sqlite?.close());

  /** Un objectif, deux phases, un sous-objectif, et une tâche rattachée à une phase. */
  async function arbre() {
    const racine = await repo.createGoal(objectif("Arbre-racine"));
    const p1 = await repo.createGoal(objectif("Arbre-phase-1", racine));
    const p2 = await repo.createGoal(objectif("Arbre-phase-2", racine));
    const s1 = await repo.createGoal(objectif("Arbre-sous", p1));
    const t = await repo.createTask({
      label: "Arbre-tâche", tag: null, priority: "low", recurrence: "none", goal_id: p1,
    });
    return { racine, p1, p2, s1, t };
  }

  const titresObjectifs = async () =>
    (await repo.fetchAll("2000-01-01")).goals.map((g) => g.title).filter((x) => x.startsWith("Arbre"));

  it("⭐ un objectif part AVEC ses phases ET ses tâches — une seule ligne dans la corbeille", async () => {
    // Retourné le 2026-09-30, à la demande d'Antonin : la tâche restait, rattachée
    // à un objectif que plus rien n'affichait.
    const a = await arbre();
    const lot = await repo.mettreEnCorbeille("goal", a.racine);
    expect([...lot.ids].sort()).toEqual([a.racine, a.p1, a.p2, a.s1].sort());
    expect(lot.taches).toEqual([a.t]);

    const d = await repo.fetchAll("2000-01-01");
    expect(d.goals.some((g) => g.title.startsWith("Arbre"))).toBe(false);
    expect(d.tasks.some((x) => x.id === a.t)).toBe(false);

    const c = await repo.lireCorbeille();
    expect(c).toEqual([expect.objectContaining({ kind: "goal", id: a.racine, titre: "Arbre-racine", taille: 5 })]);
  });

  it("⭐ restaurer la racine rend le lot, ET la tâche avec son rattachement", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const plan = await repo.restaurer("goal", a.racine);
    expect(plan?.total).toBe(5);
    expect((await titresObjectifs()).sort()).toEqual(
      ["Arbre-phase-1", "Arbre-phase-2", "Arbre-racine", "Arbre-sous"],
    );
    const tache = (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === a.t);
    expect(tache!.goal_id).toBe(a.p1);
    expect(await repo.lireCorbeille()).toEqual([]);
  });

  it("⭐⭐ MODIFIER une tâche par sa fenêtre pendant que son objectif est jeté ne coupe pas le lien", async () => {
    // Le défaut trouvé le 2026-09-23 : `updateTask` réécrit la ligne ENTIÈRE, à
    // partir de ce que la fenêtre a LU. Si la lecture masquait l'objectif
    // (`goal_id` à null), la modification écrivait ce null en base — et
    // restaurer l'objectif ne lui rendait plus sa tâche.
    //
    // Depuis le 2026-09-30, la tâche part AVEC son objectif. Le cas reste réel
    // par la synchronisation : une tâche créée sur un autre appareil sous cet
    // objectif, avant qu'il ne reçoive la mise en corbeille. On le reproduit en
    // la créant APRÈS le jet.
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const t = await repo.createTask({
      label: "Arbre-tâche venue d'ailleurs", tag: null, priority: "low", recurrence: "none", goal_id: a.p1,
    });
    const lue = (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === t)!;
    // Exactement ce qu'envoie `TaskModal` : tout, à partir de ce qu'elle a lu.
    await repo.updateTask(t, {
      label: "Arbre-tâche renommée",
      tag: lue.tag,
      priority: lue.priority,
      recurrence: lue.recurrence ?? "none",
      goal_id: lue.goal_id,
      due_date: lue.due_date,
      start_at: lue.start_at,
      end_at: lue.end_at,
    });
    await repo.restaurer("goal", a.racine);
    const apres = (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === t)!;
    expect(apres.label).toBe("Arbre-tâche renommée");
    expect(apres.goal_id).toBe(a.p1);
  });

  it("⭐ restaurer un sous-objectif remonte au parent — et le plan l'annonce sans rien écrire", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const plan = await repo.planRestauration("goal", a.s1);
    expect(plan).toMatchObject({ remonte: true, total: 5 });
    expect(await titresObjectifs()).toEqual([]); // rien n'a bougé
    await repo.restaurer("goal", a.s1);
    expect((await titresObjectifs()).length).toBe(4);
  });

  it("⭐ ne ressuscite pas une phase jetée pour son compte avant le lot", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.p2);
    await new Promise((r) => setTimeout(r, 5)); // un horodatage distinct
    await repo.mettreEnCorbeille("goal", a.racine);
    await repo.restaurer("goal", a.racine);
    expect((await titresObjectifs()).sort()).toEqual(["Arbre-phase-1", "Arbre-racine", "Arbre-sous"]);
    expect((await repo.lireCorbeille()).map((x) => x.id)).toEqual([a.p2]);
  });

  it("une note jetée disparaît de la recherche, et y revient restaurée", async () => {
    const id = await repo.createNote("Note-unique-xyz", "<p>corps</p>");
    await repo.mettreEnCorbeille("note", id);
    expect((await repo.searchNotes("")).some((n) => n.id === id)).toBe(false);
    expect((await repo.rechercherPartout("Note-unique", { limite: 50 })).length).toBe(0);
    await repo.restaurer("note", id);
    expect((await repo.searchNotes("")).some((n) => n.id === id)).toBe(true);
  });

  it("⭐ réécrire le journal du jour J RÉANIME l'entrée en corbeille — jamais d'échec d'unicité", async () => {
    await repo.upsertJournal("2026-09-22", { mood: 3, energy: 3, body: "Journal-avant" });
    const avant = (await repo.fetchAll("2000-01-01")).journal.find((j) => j.date === "2026-09-22")!;
    await repo.mettreEnCorbeille("journal", avant.id);
    expect((await repo.fetchAll("2000-01-01")).journal.some((j) => j.date === "2026-09-22")).toBe(false);

    await repo.upsertJournal("2026-09-22", { mood: 4, energy: 4, body: "Journal-après" });
    const apres = (await repo.fetchAll("2000-01-01")).journal.filter((j) => j.date === "2026-09-22");
    expect(apres).toHaveLength(1);
    expect(apres[0].body).toBe("Journal-après");
    expect(await repo.lireCorbeille()).toEqual([]);
  });

  it("⭐ une facture ÉMISE ne va pas en corbeille ; un brouillon, si", async () => {
    const d = await repo.fetchFacturation();
    const emise = d.factures.find((f) => f.statut !== "brouillon");
    const brouillon = d.factures.find((f) => f.statut === "brouillon");
    if (natif) {
      // La base neuve n'a pas de factures : on s'en tient au refus, prouvé en
      // SQL par `base.test.ts`. Ici, on vérifie seulement l'aiguillage.
      expect((await repo.mettreEnCorbeille("invoice", 999)).ids).toEqual([]);
      return;
    }
    expect(emise && brouillon).toBeTruthy();
    expect((await repo.mettreEnCorbeille("invoice", emise!.id)).ids).toEqual([]);
    expect((await repo.mettreEnCorbeille("invoice", brouillon!.id)).ids).toEqual([brouillon!.id]);
    expect((await repo.fetchFacturation()).factures.some((f) => f.id === brouillon!.id)).toBe(false);
  });

  it("⭐ la suppression définitive efface le lot et ne touche JAMAIS un objet vivant", async () => {
    const vivante = await repo.createNote("Vivante-garde", "");
    expect(await repo.supprimerDefinitivement("note", vivante)).toBe(0);
    expect((await repo.searchNotes("")).some((n) => n.id === vivante)).toBe(true);

    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    expect(await repo.supprimerDefinitivement("goal", a.racine)).toBe(5);
    expect(await repo.lireCorbeille()).toEqual([]);
    // ⭐ Les enfants ne sont PAS remontés vivants : ils sont partis avec lui.
    expect(await titresObjectifs()).toEqual([]);
    expect(await repo.restaurer("goal", a.racine)).toBeNull();
    // Et la tâche est partie avec lui, pour de bon — elle ne remonte pas vivante.
    expect((await repo.fetchAll("2000-01-01")).tasks.some((x) => x.id === a.t)).toBe(false);
    expect(await repo.restaurer("task", a.t)).toBeNull();
  });

  it("⭐ la purge attend 30 jours pleins, puis efface", async () => {
    const id = await repo.createNote("Purge-me", "");
    await repo.mettreEnCorbeille("note", id);
    const maintenant = Date.now();
    expect(await repo.purgerCorbeille(new Date(maintenant + 29 * JOUR))).toBe(0);
    expect((await repo.lireCorbeille()).map((x) => x.id)).toEqual([id]);
    expect(await repo.purgerCorbeille(new Date(maintenant + 31 * JOUR))).toBe(1);
    expect(await repo.lireCorbeille()).toEqual([]);
  });

  it("⭐ la purge d'un arbre ne fait remonter AUCUN enfant", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    expect(await repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).toBe(5);
    expect(await titresObjectifs()).toEqual([]);
  });

  it("purger ou supprimer deux fois de suite ne lève aucune erreur", async () => {
    const id = await repo.createNote("Deux-fois", "");
    await repo.mettreEnCorbeille("note", id);
    await repo.supprimerDefinitivement("note", id);
    await expect(repo.supprimerDefinitivement("note", id)).resolves.toBe(0);
    await expect(repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).resolves.toBe(0);
  });

  // ─── 2026-10-12 — ce que la base refuse d'effacer ─────────────────────────
  //
  // Antonin : « certains items ne se suppriment pas dans Supprimés récemment, et
  // Tout supprimer ne marche pas tout le temps ». Rejoué sur une copie de sa
  // base : la base applique les clés étrangères (sqlx les active d'office), et
  // deux tables rangées SOUS une ligne n'étaient défaites par aucune fonction
  // `delete*`. Voir `lib/suppression.ts`.

  it("⭐⭐ un objectif qui a un HISTORIQUE de progression se supprime pour de bon", async () => {
    // `snapshotGoals` tourne à chaque lancement : tout objectif qui a vécu un
    // jour en porte une ligne. C'était 23 des 76 objectifs de sa corbeille.
    const id = await repo.createGoal(objectif("Arbre-suivi"));
    await repo.snapshotGoals("2026-10-01", [{ goal_id: id, pct: 40 }]);
    await repo.mettreEnCorbeille("goal", id);
    expect(await repo.supprimerDefinitivement("goal", id)).toBe(1);
    expect(await repo.lireCorbeille()).toEqual([]);
    if (natif) {
      expect(sqlite!.prepare("SELECT COUNT(*) AS n FROM goals WHERE id = ?").get(id)).toEqual({ n: 0 });
      expect(sqlite!.prepare("SELECT COUNT(*) AS n FROM goal_progress_log").get()).toEqual({ n: 0 });
    }
  });

  it("⭐⭐ une tâche qui a une séance de focus se supprime pour de bon — la séance reste, à son nom", async () => {
    const t = await repo.createTask({
      label: "Tâche-chronométrée", tag: null, priority: "low", recurrence: "none", goal_id: null,
    });
    const s = await repo.startFocus({ task_id: t, label: null, planned_min: 25, kind: "focus" });
    await repo.endFocus(s, "2026-10-01 10:25:00");
    await repo.mettreEnCorbeille("task", t);
    expect(await repo.supprimerDefinitivement("task", t)).toBe(1);
    expect(await repo.lireCorbeille()).toEqual([]);
    // Le temps passé reste dans Performance et dans le Timer : seule la tâche part.
    const seance = (await repo.fetchAll("2000-01-01")).focusSessions.find((x) => x.id === s)!;
    expect(seance).toMatchObject({ task_id: null, label: "Tâche-chronométrée" });
  });

  it("⭐ la purge des 30 jours passe aussi sur un objectif suivi et une tâche chronométrée", async () => {
    const g = await repo.createGoal(objectif("Arbre-purge"));
    await repo.snapshotGoals("2026-10-01", [{ goal_id: g, pct: 10 }]);
    const t = await repo.createTask({
      label: "Tâche-purge", tag: null, priority: "low", recurrence: "none", goal_id: null,
    });
    await repo.startFocus({ task_id: t, label: null, planned_min: 25, kind: "focus" });
    await repo.mettreEnCorbeille("goal", g);
    await repo.mettreEnCorbeille("task", t);
    expect(await repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).toBe(2);
    expect(await repo.lireCorbeille()).toEqual([]);
  });

  it("⭐ vider efface tout ce qu'on lui montre, lots compris", async () => {
    const a = await arbre();
    await repo.snapshotGoals("2026-10-01", [
      { goal_id: a.racine, pct: 10 },
      { goal_id: a.p1, pct: 20 },
    ]);
    const n = await repo.createNote("Vider-note", "");
    await repo.mettreEnCorbeille("goal", a.racine);
    await repo.mettreEnCorbeille("note", n);
    const bilan = await repo.viderCorbeille(await repo.lireCorbeille());
    expect(bilan).toEqual({ effaces: 6, echecs: [] });
    expect(await repo.lireCorbeille()).toEqual([]);
  });

  // Un refus de la base ne se fabrique pas en démo : ces deux-là sont natifs.
  it.runIf(natif)("⭐⭐ vider CONTINUE après un refus, et rend ce qui reste", async () => {
    const bloquee = await repo.createNote("Vider-bloquée", "");
    const libre1 = await repo.createNote("Vider-libre-1", "");
    const libre2 = await repo.createNote("Vider-libre-2", "");
    for (const id of [libre1, bloquee, libre2]) await repo.mettreEnCorbeille("note", id);
    sqlite!.exec(
      "CREATE TRIGGER refus_de_test BEFORE DELETE ON notes WHEN OLD.title = 'Vider-bloquée' BEGIN SELECT RAISE(ABORT, 'refus de test'); END;",
    );
    const bilan = await repo.viderCorbeille(await repo.lireCorbeille());
    expect(bilan.effaces).toBe(2);
    expect(bilan.echecs).toEqual([expect.objectContaining({ kind: "note", id: bloquee })]);
    expect((await repo.lireCorbeille()).map((x) => x.id)).toEqual([bloquee]);
  });

  it.runIf(natif)("⭐⭐ la purge CONTINUE après un refus : un objet bloqué ne retient pas les autres", async () => {
    const bloquee = await repo.createNote("Purge-bloquée", "");
    const libre = await repo.createNote("Purge-libre", "");
    await repo.mettreEnCorbeille("note", bloquee);
    await repo.mettreEnCorbeille("note", libre);
    sqlite!.exec(
      "CREATE TRIGGER refus_de_test BEFORE DELETE ON notes WHEN OLD.title = 'Purge-bloquée' BEGIN SELECT RAISE(ABORT, 'refus de test'); END;",
    );
    const erreurs = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).toBe(1);
    expect(erreurs).toHaveBeenCalled();
    erreurs.mockRestore();
    expect((await repo.lireCorbeille()).map((x) => x.id)).toEqual([bloquee]);
  });

  it.runIf(natif)("⭐ « supprimer les exemples » passe sur un exemple chronométré et un objectif d'exemple suivi", async () => {
    const t = await repo.createTask({
      label: "Exemple-tâche", tag: null, priority: "low", recurrence: "none", goal_id: null,
    });
    const g = await repo.createGoal(objectif("Exemple-objectif"));
    sqlite!.prepare("UPDATE tasks SET is_example = 1 WHERE id = ?").run(t);
    sqlite!.prepare("UPDATE goals SET is_example = 1 WHERE id = ?").run(g);
    const s = await repo.startFocus({ task_id: t, label: null, planned_min: 25, kind: "focus" });
    await repo.snapshotGoals("2026-10-01", [{ goal_id: g, pct: 0 }]);
    await repo.supprimerExemples();
    expect(sqlite!.prepare("SELECT COUNT(*) AS n FROM tasks WHERE id = ?").get(t)).toEqual({ n: 0 });
    expect(sqlite!.prepare("SELECT COUNT(*) AS n FROM goals WHERE id = ?").get(g)).toEqual({ n: 0 });
    expect(sqlite!.prepare("SELECT task_id, label FROM focus_sessions WHERE id = ?").get(s)).toEqual({
      task_id: null,
      label: "Exemple-tâche",
    });
  });
});
