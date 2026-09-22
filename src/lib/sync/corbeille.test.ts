import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { BaseSqlite, deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";
import { oublierSchema } from "./local";
import { baseNeuve } from "./schema.testutil";
import {
  lireCorbeilleDans,
  mettreEnCorbeilleDans,
  planRestaurationDans,
  restaurerDans,
  type BaseCorbeille,
} from "../corbeille/base";

/**
 * ⭐ LA CORBEILLE À DEUX APPAREILS — migration 027.
 *
 * La mise en corbeille est un UPDATE de `deleted_at` : elle voyage comme une
 * modification ordinaire, arbitrée par le last-write-wins existant. Ces tests
 * le prouvent sur le vrai moteur, avec le serveur simulé qui reproduit mot pour
 * mot le trigger Postgres `sync_rows_lww`.
 *
 * ⚠️ TOUT SE COMPARE PAR `uid`, jamais par `id` (règle 14 du chantier) : un
 * même objet n'a pas le même numéro local sur deux appareils.
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

const ctx = (app: Appareil): Contexte => ({
  db: app.db,
  transport: serveur,
  cles,
  userId: UTILISATEUR,
  deviceId: app.nom,
});
const sync = (app: Appareil) => synchroniser(ctx(app));
async function converger() {
  await sync(a);
  await sync(b);
  await sync(a);
  await sync(b);
}

/** La base d'un appareil, vue par le module de la corbeille. */
const base = (app: Appareil): BaseCorbeille => ({
  select: (sql, params) => app.db.select(sql, params) as never,
  execute: (sql, params) => app.db.execute(sql, params),
});

/** Un instant distinct du précédent : les horodatages de la file sont à la ms. */
const pause = () => new Promise((r) => setTimeout(r, 8));

const uidDe = (app: Appareil, table: string, id: number) =>
  app.lire<{ uid: string }>(`SELECT uid FROM ${table} WHERE id = ?`, id)[0].uid;
const idDe = (app: Appareil, table: string, uid: string) =>
  app.lire<{ id: number }>(`SELECT id FROM ${table} WHERE uid = ?`, uid)[0]?.id;
const stampDe = (app: Appareil, table: string, uid: string) =>
  app.lire<{ deleted_at: string | null }>(`SELECT deleted_at FROM ${table} WHERE uid = ?`, uid)[0]?.deleted_at;
const existe = (app: Appareil, table: string, uid: string) =>
  app.lire<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE uid = ?`, uid)[0].n === 1;

function noteSur(app: Appareil, titre: string): string {
  const { lastInsertRowid } = app.ecrire("INSERT INTO notes (title, body) VALUES (?, '')", titre);
  return uidDe(app, "notes", lastInsertRowid);
}

describe("une mise en corbeille voyage", () => {
  it("⭐ jetée sur A → B la voit en corbeille, et plus dans ses listes", async () => {
    const uid = noteSur(a, "à jeter");
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await converger();

    expect(stampDe(b, "notes", uid)).toBe("2026-09-22T10:00:00.000Z");
    const corbeilleB = await lireCorbeilleDans(base(b));
    expect(corbeilleB.map((x) => x.uid)).toEqual([uid]);
    // Ses listes : le filtre de `repo.ts` est `deleted_at IS NULL`.
    expect(b.lire("SELECT uid FROM notes WHERE deleted_at IS NULL AND uid = ?", uid)).toEqual([]);
  });

  it("⭐ restaurée sur B → A la retrouve", async () => {
    const uid = noteSur(a, "aller-retour");
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await converger();
    await pause();

    await restaurerDans(base(b), "note", idDe(b, "notes", uid));
    await converger();
    expect(stampDe(a, "notes", uid)).toBeNull();
    expect(stampDe(b, "notes", uid)).toBeNull();
  });

  it("⭐ purgée sur A → elle disparaît chez B, et ne ressuscite pas", async () => {
    const uid = noteSur(a, "à purger");
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await converger();

    // La suppression définitive est un vrai DELETE — celui de `deleteNote` :
    // son trigger pose la pierre tombale.
    a.ecrire("DELETE FROM notes WHERE uid = ?", uid);
    await converger();
    await converger();
    expect(existe(a, "notes", uid)).toBe(false);
    expect(existe(b, "notes", uid)).toBe(false);
  });

  it("⭐ un objet mis en corbeille garde ses ARÊTES sur l'autre appareil", async () => {
    // Le cœur du choix de la 027 : une corbeille par UPDATE ne déclenche pas
    // les triggers qui détruisent les liens — ni ici, ni en face.
    const uidNote = noteSur(a, "liée");
    const { lastInsertRowid: g } = a.ecrire("INSERT INTO goals (title, scope) VALUES ('objectif', 'long')");
    const uidObj = uidDe(a, "goals", g);
    a.ecrire(
      "INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin) VALUES ('goal', ?, 'note', ?, 'manual')",
      uidObj,
      uidNote,
    );
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uidNote), "2026-09-22T10:00:00.000Z");
    await converger();
    const aretes = (app: Appareil) => app.lire<{ n: number }>("SELECT COUNT(*) AS n FROM object_links")[0].n;
    expect(aretes(a)).toBe(1);
    expect(aretes(b)).toBe(1);
  });
});

describe("⭐ restauration et purge concurrentes : un vainqueur DÉTERMINISTE", () => {
  async function scenario(premier: "restaurer" | "purger") {
    const uid = noteSur(a, "disputée");
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await converger();

    // Hors ligne, chacun de son côté : B restaure, A purge — dans un ordre fixé.
    const restaurer = async () => void (await restaurerDans(base(b), "note", idDe(b, "notes", uid)));
    const purger = async () => void a.ecrire("DELETE FROM notes WHERE uid = ?", uid);
    if (premier === "restaurer") {
      await restaurer();
      await pause();
      await purger();
    } else {
      await purger();
      await pause();
      await restaurer();
    }
    await converger();
    await converger();
    return { chezA: existe(a, "notes", uid), chezB: existe(b, "notes", uid), uid };
  }

  it("B restaure (jour 29), PUIS A purge (jour 30) → la purge, plus récente, gagne partout", async () => {
    const r = await scenario("restaurer");
    expect(r.chezA).toBe(false);
    expect(r.chezB).toBe(false);
  });

  it("A purge, PUIS B restaure → la restauration, plus récente, gagne partout", async () => {
    // La restauration est un upsert de la ligne entière, daté après la pierre
    // tombale : le trigger serveur l'accepte (strictement plus récent), et A
    // réinsère la note. Le geste le plus récent tient — c'est la règle.
    const r = await scenario("purger");
    expect(r.chezA).toBe(true);
    expect(r.chezB).toBe(true);
    expect(stampDe(a, "notes", r.uid)).toBeNull();
  });

  it("deux appareils qui purgent la même ligne : aucune erreur, tout le monde converge", async () => {
    const uid = noteSur(a, "purgée deux fois");
    await converger();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await converger();
    a.ecrire("DELETE FROM notes WHERE uid = ?", uid);
    b.ecrire("DELETE FROM notes WHERE uid = ?", uid);
    await expect(converger()).resolves.toBeUndefined();
    expect(existe(a, "notes", uid)).toBe(false);
    expect(existe(b, "notes", uid)).toBe(false);
  });
});

describe("les clés naturelles et les lots, d'un appareil à l'autre", () => {
  it("⭐ le journal du jour J jeté sur A, réécrit sur B → réanimé partout, sans conflit d'unicité", async () => {
    a.ecrire("INSERT INTO journal_entries (date, body) VALUES ('2026-09-22', 'version A')");
    await converger();
    const uid = "je:2026-09-22";
    await mettreEnCorbeilleDans(base(a), "journal", idDe(a, "journal_entries", uid), "2026-09-22T10:00:00.000Z");
    await converger();
    await pause();

    // Exactement l'écriture de `upsertJournal` : la réanimation par la clé.
    b.ecrire(
      "INSERT INTO journal_entries (date, body) VALUES ('2026-09-22', 'version B') ON CONFLICT(date) DO UPDATE SET body = 'version B', deleted_at = NULL",
    );
    await converger();
    for (const app of [a, b]) {
      const lignes = app.lire<{ body: string; deleted_at: string | null }>(
        "SELECT body, deleted_at FROM journal_entries WHERE date = '2026-09-22'",
      );
      expect(lignes).toEqual([{ body: "version B", deleted_at: null }]);
    }
  });

  it("⭐ un lot jeté sur A se restaure sur B par un ENFANT — qui remonte au parent", async () => {
    const { lastInsertRowid: r } = a.ecrire("INSERT INTO goals (title, scope) VALUES ('racine', 'long')");
    const { lastInsertRowid: p } = a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('phase', 'long', ?)", r);
    const { lastInsertRowid: s } = a.ecrire("INSERT INTO goals (title, scope, parent_goal_id) VALUES ('sous', 'long', ?)", p);
    const uids = [r, p, s].map((id) => uidDe(a, "goals", id));
    await converger();

    await mettreEnCorbeilleDans(base(a), "goal", r, "2026-09-22T10:00:00.000Z");
    await converger();
    // B voit UN élément dans sa corbeille : le lot, par sa racine.
    const c = await lireCorbeilleDans(base(b));
    expect(c).toEqual([expect.objectContaining({ uid: uids[0], taille: 3 })]);

    await pause();
    const idSousB = idDe(b, "goals", uids[2]);
    expect(await planRestaurationDans(base(b), "goal", idSousB)).toMatchObject({ remonte: true, total: 3 });
    await restaurerDans(base(b), "goal", idSousB);
    await converger();
    for (const app of [a, b]) for (const u of uids) expect(stampDe(app, "goals", u)).toBeNull();
    // Et l'arbre est intact : les liens parent-enfant ont traversé par uid.
    const phaseA = a.lire<{ parent_goal_id: number }>("SELECT parent_goal_id FROM goals WHERE uid = ?", uids[1])[0];
    expect(phaseA.parent_goal_id).toBe(idDe(a, "goals", uids[0]));
  });
});

describe("⚠️⚠️ LE RISQUE N° 1, MESURÉ — un appareil resté en version 026", () => {
  /**
   * ⚠️ CE QUE LE RAPPORT DE PHASE 0 AFFIRMAIT, ET QUI S'EST RÉVÉLÉ FAUX.
   *
   * Il disait : un appareil en 026 ignore `deleted_at`, et s'il écrit sur
   * l'objet, il le renvoie sans la colonne — « l'objet ressort de la corbeille
   * PARTOUT ». Mesuré le 2026-09-22 : c'est faux pour les appareils qui ont
   * DÉJÀ l'objet. `appliquerLigne()` écrit `ON CONFLICT … DO UPDATE SET` sur
   * les SEULES colonnes présentes dans ce qui arrive : `deleted_at` n'y étant
   * pas, il n'est pas touché. La corbeille TIENT.
   *
   * Ce qui reste VRAI, et plus étroit : un appareil qui reçoit l'objet pour la
   * PREMIÈRE fois (nouvelle installation, réinstallation) l'INSÈRE à partir de
   * la dernière version du serveur — celle du vieil appareil, sans la colonne.
   * Il l'insère donc VIVANT. Et le vieil appareil, lui, l'affiche toujours.
   *
   * Si un jour une parade est ajoutée, ces tests devront être changés EXPRÈS :
   * c'est voulu, pour qu'on ne puisse pas oublier ce risque en silence.
   * Voir `PIEGES.md` § 19.
   */
  function appareilAncien(nom: string): Appareil {
    const vieux = baseNeuve(26); // les 26 premières migrations, sans la 027
    vieux.prepare("UPDATE sync_meta SET v = ? WHERE k = 'device_id'").run(nom);
    return {
      nom,
      db: new BaseSqlite(vieux),
      sqlite: vieux,
      ecrire: (sql, ...p) => ({ lastInsertRowid: Number(vieux.prepare(sql).run(...(p as never[])).lastInsertRowid) }),
      lire: <T,>(sql: string, ...p: unknown[]) => vieux.prepare(sql).all(...(p as never[])) as T[],
      fermer: () => vieux.close(),
    };
  }

  // ⚠️ Le cache des colonnes du moteur est PAR NOM DE TABLE, pas par base :
  // deux schémas dans un même processus exigent de l'oublier avant chaque
  // synchronisation. Dans l'app, il n'y a qu'une base : la question ne se pose pas.
  const syncFraiche = async (app: Appareil) => {
    oublierSchema();
    await synchroniser(ctx(app));
  };

  /** A jette une note ; le vieil appareil O l'a, et la modifie ensuite. */
  async function vieilAppareilEcrit(o: Appareil): Promise<string> {
    const tout = async () => {
      for (let i = 0; i < 2; i++) {
        await syncFraiche(a);
        await syncFraiche(o);
      }
    };
    const uid = noteSur(a, "jetée sur A");
    await tout();
    await mettreEnCorbeilleDans(base(a), "note", idDe(a, "notes", uid), "2026-09-22T10:00:00.000Z");
    await tout();
    // Le vieil appareil n'a pas la colonne : il AFFICHE toujours la note.
    expect(existe(o, "notes", uid)).toBe(true);
    await pause();
    o.ecrire("UPDATE notes SET title = 'modifiée sur le vieil appareil' WHERE uid = ?", uid);
    await tout();
    return uid;
  }

  it("✅ la corbeille TIENT sur un appareil qui avait déjà la note — seul le titre change", async () => {
    const o = appareilAncien("appareil-026");
    const uid = await vieilAppareilEcrit(o);
    expect(stampDe(a, "notes", uid)).toBe("2026-09-22T10:00:00.000Z");
    expect(a.lire<{ title: string }>("SELECT title FROM notes WHERE uid = ?", uid)[0].title).toBe(
      "modifiée sur le vieil appareil",
    );
    o.fermer();
  });

  it("⚠️ mais un appareil NEUF, qui la reçoit pour la première fois, l'insère VIVANTE", async () => {
    const o = appareilAncien("appareil-026");
    const uid = await vieilAppareilEcrit(o);
    // B n'a encore jamais synchronisé : c'est une installation neuve, en 027.
    expect(existe(b, "notes", uid)).toBe(false);
    await syncFraiche(b);
    expect(existe(b, "notes", uid)).toBe(true);
    expect(stampDe(b, "notes", uid)).toBeNull(); // ⚠️ ressortie de la corbeille, ici
    o.fermer();
  });
});
