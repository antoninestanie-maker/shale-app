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

  it("⭐ un objectif part AVEC ses phases, et sa tâche reste — son lien dort", async () => {
    const a = await arbre();
    const lot = await repo.mettreEnCorbeille("goal", a.racine);
    expect([...lot.ids].sort()).toEqual([a.racine, a.p1, a.p2, a.s1].sort());

    const d = await repo.fetchAll("2000-01-01");
    expect(d.goals.some((g) => g.title.startsWith("Arbre"))).toBe(false);
    const tache = d.tasks.find((x) => x.id === a.t);
    expect(tache).toBeDefined();
    // Le rattachement DORT : l'objectif n'est plus dans `goals`, rien ne
    // l'affiche, mais le lien est là — la restauration n'a rien à reconstruire.
    expect(tache!.goal_id).toBe(a.p1);

    const c = await repo.lireCorbeille();
    expect(c.filter((x) => x.kind === "goal")).toEqual([
      expect.objectContaining({ id: a.racine, titre: "Arbre-racine", taille: 4 }),
    ]);
  });

  it("⭐ restaurer la racine rend le lot, ET rend à la tâche son rattachement", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const plan = await repo.restaurer("goal", a.racine);
    expect(plan?.total).toBe(4);
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
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const lue = (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === a.t)!;
    // Exactement ce qu'envoie `TaskModal` : tout, à partir de ce qu'elle a lu.
    await repo.updateTask(a.t, {
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
    const apres = (await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === a.t)!;
    expect(apres.label).toBe("Arbre-tâche renommée");
    expect(apres.goal_id).toBe(a.p1);
  });

  it("⭐ restaurer un sous-objectif remonte au parent — et le plan l'annonce sans rien écrire", async () => {
    const a = await arbre();
    await repo.mettreEnCorbeille("goal", a.racine);
    const plan = await repo.planRestauration("goal", a.s1);
    expect(plan).toMatchObject({ remonte: true, total: 4 });
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
    expect(await repo.supprimerDefinitivement("goal", a.racine)).toBe(4);
    expect(await repo.lireCorbeille()).toEqual([]);
    // ⭐ Les enfants ne sont PAS remontés vivants : ils sont partis avec lui.
    expect(await titresObjectifs()).toEqual([]);
    expect(await repo.restaurer("goal", a.racine)).toBeNull();
    // Et la tâche rattachée a perdu son objectif pour de bon, comme avant la 027.
    expect((await repo.fetchAll("2000-01-01")).tasks.find((x) => x.id === a.t)?.goal_id).toBeNull();
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
    expect(await repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).toBe(4);
    expect(await titresObjectifs()).toEqual([]);
  });

  it("purger ou supprimer deux fois de suite ne lève aucune erreur", async () => {
    const id = await repo.createNote("Deux-fois", "");
    await repo.mettreEnCorbeille("note", id);
    await repo.supprimerDefinitivement("note", id);
    await expect(repo.supprimerDefinitivement("note", id)).resolves.toBe(0);
    await expect(repo.purgerCorbeille(new Date(Date.now() + 31 * JOUR))).resolves.toBe(0);
  });
});
