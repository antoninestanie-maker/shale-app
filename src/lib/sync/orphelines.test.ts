import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";

/**
 * Une orpheline ne fige plus l'appareil — incident réel du 2026-10-13.
 *
 * Ce qui s'est passé : sur le Mac, une habitude créée AVANT les triggers
 * d'outbox (migration 016) n'avait jamais été modifiée, donc jamais envoyée.
 * Ses coches, elles, étaient parties. Sur l'iPhone, ces coches arrivaient sans
 * leur habitude : quarantaine, curseur retenu juste avant elles — pour toujours,
 * puisque le parent ne viendrait jamais. Le téléphone relisait à chaque cycle
 * les 200 mêmes lignes et ne voyait rien de ce qui suivait : six semaines de
 * tâches et d'objectifs manquants, sous un « synchronisé » affiché.
 *
 * Ces tests rejouent ce cas, et son cousin (un parent qui existe, mais à plus
 * d'une page de son enfant).
 */

let banc: Awaited<ReturnType<typeof deuxAppareils>>;
let a: Appareil;
let b: Appareil;
let serveur: ServeurSimule;
let cles: SousCles;

beforeEach(async () => {
  banc = await deuxAppareils();
  ({ a, b, serveur, cles } = banc);
});
afterEach(() => banc.fermer());

function ctx(app: Appareil): Contexte {
  return { db: app.db, transport: serveur, cles, userId: UTILISATEUR, deviceId: app.nom };
}
const sync = (app: Appareil) => synchroniser(ctx(app));

/**
 * Écrit comme l'app d'AVANT la migration 016 : la ligne existe, rien ne l'a
 * journalisée. (Le trigger d'uid, lui, n'est pas gardé : la ligne a son uid.)
 */
function ecrireSansJournal(app: Appareil, sql: string, ...params: unknown[]): number {
  app.ecrire("UPDATE sync_meta SET v = '1' WHERE k = 'applying'");
  const id = app.ecrire(sql, ...params).lastInsertRowid;
  app.ecrire("UPDATE sync_meta SET v = '0' WHERE k = 'applying'");
  return id;
}

/**
 * Le cas réel : une habitude jamais journalisée, et sa coche qui part SEULE —
 * donc en séquence 1 sur le serveur, devant tout le reste. (Envoyée dans le
 * même lot que des tâches, elle passerait après elles : l'envoi range les
 * tables parents d'abord.)
 */
async function cocheSansHabitude(app: Appareil): Promise<{ habitude: number; coche: number }> {
  const habitude = ecrireSansJournal(app, "INSERT INTO habits (name) VALUES ('Lever avant 9 h')");
  const coche = app.ecrire("INSERT INTO habit_checks (habit_id, date) VALUES (?, '2026-08-07')", habitude)
    .lastInsertRowid;
  await sync(app);
  return { habitude, coche };
}

/** Les tests qui écrivent des centaines de lignes : la machine est souvent chargée. */
const LONG = 120_000;

function taches(app: Appareil, n: number, prefixe = "t") {
  for (let i = 0; i < n; i++) {
    app.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES (?, 'low', 'none')", `${prefixe}${i}`);
  }
}

const compter = (app: Appareil, table: string) =>
  app.lire<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;

const orphelines = (app: Appareil): number[] =>
  JSON.parse(app.lire<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'orphelines'")[0]?.v ?? "[]");

describe("un parent qui n'a jamais été envoyé", () => {
  it("ne retient plus le reste : tout ce qui suit l'orpheline arrive", async () => {
    await cocheSansHabitude(a);
    taches(a, 250);
    await sync(a);

    // L'habitude n'est pas sur le serveur, sa coche si : le cas réel.
    expect(serveur.contenu).toHaveLength(251);

    const r = await sync(b);
    expect(compter(b, "tasks")).toBe(250);
    expect(compter(b, "habit_checks")).toBe(0);
    expect(r.enQuarantaine).toBe(1);
    expect(r.resteATirer).toBe(false);
  }, LONG);

  it("le curseur passe l'orpheline, et son numéro est retenu", async () => {
    await cocheSansHabitude(a);
    taches(a, 3);
    await sync(a);
    await sync(b);

    const curseur = Number(b.lire<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'cursor'")[0].v);
    expect(curseur).toBe(4);
    expect(orphelines(b)).toEqual([1]);
  });

  it("le jour où le parent part enfin, la coche est appliquée", async () => {
    const { habitude } = await cocheSansHabitude(a);
    taches(a, 250);
    await sync(a);
    await sync(b);
    expect(compter(b, "habit_checks")).toBe(0);

    // Le geste fait sur la vraie base : une écriture sans effet, journalisée.
    a.ecrire("UPDATE habits SET uid = uid WHERE id = ?", habitude);
    await sync(a);
    const r = await sync(b);

    expect(
      b.lire("SELECT h.name AS nom, c.date AS date FROM habit_checks c JOIN habits h ON h.id = c.habit_id"),
    ).toEqual([{ nom: "Lever avant 9 h", date: "2026-08-07" }]);
    expect(r.enQuarantaine).toBe(0);
    expect(orphelines(b)).toEqual([]);
  }, LONG);

  it("une orpheline en attente ne coûte aucune lecture tant que rien n'arrive", async () => {
    await cocheSansHabitude(a);
    await sync(b);

    const avant = serveur.lectures;
    const r = await sync(b);
    // Une seule lecture : la page (vide). L'orpheline n'est pas redemandée —
    // son parent ne peut arriver que par une ligne reçue.
    expect(serveur.lectures - avant).toBe(1);
    expect(r.enQuarantaine).toBe(1);
    expect(orphelines(b)).toEqual([1]);
  });
});

describe("un parent qui existe, mais loin de son enfant", () => {
  it("à plus d'une page : l'enfant est appliqué dans le même cycle", async () => {
    // Racine puis Branche, puis 250 lignes, puis la racine est modifiée : le
    // serveur la renumérote APRÈS tout le reste. Pour un appareil neuf, la
    // branche est en tête de la première page et son parent dans la seconde.
    const racine = a.ecrire("INSERT INTO goals (title, scope) VALUES ('Racine', 'long')").lastInsertRowid;
    a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('Branche', 'short', ?)", racine);
    await sync(a);
    taches(a, 250);
    await sync(a);
    a.ecrire("UPDATE goals SET title = 'Racine renommée' WHERE id = ?", racine);
    await sync(a);

    const r = await sync(b);

    expect(compter(b, "tasks")).toBe(250);
    expect(
      b.lire("SELECT e.title AS enfant, p.title AS parent FROM goals e JOIN goals p ON p.id = e.parent_goal_id"),
    ).toEqual([{ enfant: "Branche", parent: "Racine renommée" }]);
    expect(r.enQuarantaine).toBe(0);
    expect(orphelines(b)).toEqual([]);
  }, LONG);

  it("à plus d'un cycle : l'enfant retenu est relu quand son parent arrive", async () => {
    const racine = ecrireSansJournal(a, "INSERT INTO goals (title, scope) VALUES ('Racine', 'long')");
    a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('Branche', 'short', ?)", racine);
    await sync(a);
    await sync(b);
    expect(compter(b, "goals")).toBe(0);
    expect(orphelines(b)).toEqual([1]);

    a.ecrire("UPDATE goals SET title = 'Racine' WHERE id = ?", racine);
    await sync(a);
    await sync(b);

    expect(compter(b, "goals")).toBe(2);
    expect(orphelines(b)).toEqual([]);
  });
});

describe("une orpheline retenue qui change entre-temps", () => {
  it("modifiée : sa nouvelle version arrive par le curseur, l'ancienne est oubliée", async () => {
    const { habitude, coche } = await cocheSansHabitude(a);
    await sync(b);
    expect(orphelines(b)).toEqual([1]);

    // Parent et enfant repartent ensemble : la coche change de numéro.
    a.ecrire("UPDATE habits SET uid = uid WHERE id = ?", habitude);
    a.ecrire("UPDATE habit_checks SET uid = uid WHERE id = ?", coche);
    await sync(a);
    await sync(b);

    expect(compter(b, "habit_checks")).toBe(1);
    expect(orphelines(b)).toEqual([]);
  });

  it("supprimée : la pierre tombale passe, et plus rien n'est retenu", async () => {
    const { coche } = await cocheSansHabitude(a);
    await sync(b);
    expect(orphelines(b)).toEqual([1]);

    a.ecrire("DELETE FROM habit_checks WHERE id = ?", coche);
    taches(a, 1);
    await sync(a);
    await sync(b);

    expect(compter(b, "habit_checks")).toBe(0);
    expect(orphelines(b)).toEqual([]);
  });
});

describe("une relecture qui échoue", () => {
  it("est refaite au cycle suivant, même s'il ne reçoit rien", async () => {
    const { habitude } = await cocheSansHabitude(a);
    await sync(b);
    a.ecrire("UPDATE habits SET uid = uid WHERE id = ?", habitude);
    await sync(a);

    // Le parent arrive, puis le réseau tombe au moment de relire l'orpheline.
    const relire = serveur.tirerParSeq.bind(serveur);
    serveur.tirerParSeq = async () => {
      throw new Error("réseau indisponible");
    };
    await expect(sync(b)).rejects.toThrow("réseau indisponible");
    serveur.tirerParSeq = relire;
    expect(compter(b, "habits")).toBe(1);
    expect(compter(b, "habit_checks")).toBe(0);

    // Rien de neuf sur le serveur : sans la note « à relire », la coche
    // attendrait la prochaine ligne reçue, quelle qu'elle soit.
    await sync(b);
    expect(compter(b, "habit_checks")).toBe(1);
    expect(orphelines(b)).toEqual([]);

    // Et la note est levée : le cycle d'après ne redemande plus rien.
    const avant = serveur.lectures;
    await sync(b);
    expect(serveur.lectures - avant).toBe(1);
  });
});

describe("un cycle coupé au milieu", () => {
  it("l'orpheline est notée AVANT que le curseur ne la dépasse", async () => {
    // Si l'app est tuée entre deux pages, le curseur a déjà avancé : une
    // orpheline gardée seulement en mémoire ne reviendrait jamais.
    await cocheSansHabitude(a);
    taches(a, 250);
    await sync(a);

    // Le réseau tombe à la deuxième page.
    const tirer = serveur.tirer.bind(serveur);
    let pages = 0;
    serveur.tirer = async (curseur, limite) => {
      if (++pages === 2) throw new Error("réseau indisponible");
      return tirer(curseur, limite);
    };
    await expect(sync(b)).rejects.toThrow("réseau indisponible");
    serveur.tirer = tirer;

    expect(Number(b.lire<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'cursor'")[0].v)).toBe(200);
    expect(orphelines(b)).toEqual([1]);

    await sync(b);
    expect(compter(b, "tasks")).toBe(250);
  }, LONG);
});
