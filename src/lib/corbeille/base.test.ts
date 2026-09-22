import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { baseDeTest, type BaseCommeTauri } from "./repo.testutil";
import {
  aPurgerDans,
  lireCorbeilleDans,
  lotAPurgerDans,
  mettreEnCorbeilleDans,
  planRestaurationDans,
  restaurerDans,
} from "./base";

/**
 * Sur une VRAIE base SQLite, montée avec les vraies migrations (027 comprise).
 * Aucun de ces tests ne s'appuie sur une copie du schéma.
 */

let sqlite: DatabaseSync;
let db: BaseCommeTauri;
beforeEach(() => ({ sqlite, db } = baseDeTest()));
afterEach(() => sqlite.close());

const T1 = "2026-09-22T10:00:00.000Z";
const T2 = "2026-09-22T11:00:00.000Z";

const ins = (sql: string, ...p: unknown[]) => Number(sqlite.prepare(sql).run(...(p as never[])).lastInsertRowid);
const lireStamp = (table: string, id: number) =>
  (sqlite.prepare(`SELECT deleted_at FROM ${table} WHERE id = ?`).get(id) as { deleted_at: string | null })
    .deleted_at;

/** Un objectif, deux phases, et un sous-objectif sous la première. */
function arbre() {
  const racine = ins("INSERT INTO goals (title, scope, created_at) VALUES ('Lancer la chaîne', 'long', 'x')");
  const p1 = ins("INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('Préparer', 'long', 'x', ?)", racine);
  const p2 = ins("INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('Tester', 'long', 'x', ?)", racine);
  const s1 = ins("INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('Script', 'long', 'x', ?)", p1);
  return { racine, p1, p2, s1 };
}

describe("mettre en corbeille", () => {
  it("date la ligne, sans rien supprimer", async () => {
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    const lot = await mettreEnCorbeilleDans(db, "note", id, T1);
    expect(lot).toEqual({ stamp: T1, ids: [id] });
    expect(lireStamp("notes", id)).toBe(T1);
  });

  it("⭐ ne re-date PAS un objet déjà en corbeille — ses 30 jours ne repartent pas de zéro", async () => {
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    await mettreEnCorbeilleDans(db, "note", id, T1);
    const second = await mettreEnCorbeilleDans(db, "note", id, T2);
    expect(second.ids).toEqual([]);
    expect(lireStamp("notes", id)).toBe(T1);
  });

  it("⭐ emporte un objectif AVEC ses phases et sous-objectifs, sous le même horodatage", async () => {
    const a = arbre();
    const lot = await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    expect([...lot.ids].sort()).toEqual([a.racine, a.p1, a.p2, a.s1].sort());
    for (const id of [a.racine, a.p1, a.p2, a.s1]) expect(lireStamp("goals", id)).toBe(T1);
  });

  it("⭐ laisse HORS du lot un sous-objectif jeté la veille pour son compte", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.p2, T1); // jeté seul, d'abord
    const lot = await mettreEnCorbeilleDans(db, "goal", a.racine, T2);
    expect(lot.ids).not.toContain(a.p2);
    expect(lireStamp("goals", a.p2)).toBe(T1); // il garde SON horodatage
  });

  it("⭐ refuse une facture ÉMISE — elle s'annule par un avoir, jamais par la corbeille", async () => {
    const emise = ins("INSERT INTO invoices (statut, numero) VALUES ('emise', 'F-2026-001')");
    const brouillon = ins("INSERT INTO invoices (statut) VALUES ('brouillon')");
    expect((await mettreEnCorbeilleDans(db, "invoice", emise, T1)).ids).toEqual([]);
    expect(lireStamp("invoices", emise)).toBeNull();
    expect((await mettreEnCorbeilleDans(db, "invoice", brouillon, T1)).ids).toEqual([brouillon]);
  });

  it("n'emporte pas les tâches rattachées — elles ne sont pas des enfants", async () => {
    const a = arbre();
    const t = ins("INSERT INTO tasks (label, priority, recurrence, goal_id, created_at) VALUES ('t', 'low', 'none', ?, 'x')", a.p1);
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    expect(lireStamp("tasks", t)).toBeNull();
    // Et son rattachement est INTACT en base : c'est ce qui permet de le rendre.
    expect((sqlite.prepare("SELECT goal_id FROM tasks WHERE id = ?").get(t) as { goal_id: number }).goal_id).toBe(a.p1);
  });
});

describe("⭐ la corbeille ne touche PAS aux arêtes (le cœur du choix de la migration 027)", () => {
  it("une note mise en corbeille garde ses liens, là où un DELETE les aurait détruits", async () => {
    const n = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    const g = ins("INSERT INTO goals (title, scope, created_at) VALUES ('g', 'long', 'x')");
    const uidN = (sqlite.prepare("SELECT uid FROM notes WHERE id = ?").get(n) as { uid: string }).uid;
    const uidG = (sqlite.prepare("SELECT uid FROM goals WHERE id = ?").get(g) as { uid: string }).uid;
    sqlite
      .prepare("INSERT INTO object_links (from_kind, from_uid, to_kind, to_uid, origin, created_at) VALUES ('goal', ?, 'note', ?, 'manual', 'x')")
      .run(uidG, uidN);
    const compter = () => (sqlite.prepare("SELECT COUNT(*) AS n FROM object_links").get() as { n: number }).n;

    await mettreEnCorbeilleDans(db, "note", n, T1);
    expect(compter()).toBe(1); // l'UPDATE n'a pas déclenché `notes_links_del`

    // Contre-épreuve : le vrai DELETE, lui, l'emporte bien.
    sqlite.prepare("DELETE FROM notes WHERE id = ?").run(n);
    expect(compter()).toBe(0);
  });
});

describe("restaurer", () => {
  it("rend un objet simple", async () => {
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    await mettreEnCorbeilleDans(db, "note", id, T1);
    const plan = await restaurerDans(db, "note", id);
    expect(plan?.total).toBe(1);
    expect(lireStamp("notes", id)).toBeNull();
  });

  it("⭐ rend le lot entier en restaurant sa racine", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    const plan = await restaurerDans(db, "goal", a.racine);
    expect(plan?.total).toBe(4);
    for (const id of [a.racine, a.p1, a.p2, a.s1]) expect(lireStamp("goals", id)).toBeNull();
  });

  it("⭐⭐ ne ressuscite JAMAIS ce qui avait été jeté avant le lot", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.p2, T1); // jeté exprès, la veille
    await mettreEnCorbeilleDans(db, "goal", a.racine, T2);
    await restaurerDans(db, "goal", a.racine);
    expect(lireStamp("goals", a.racine)).toBeNull();
    expect(lireStamp("goals", a.p2)).toBe(T1); // toujours en corbeille
  });

  it("⭐ restaurer un ENFANT dont le parent est en corbeille remonte au parent — et le dit", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    const plan = await planRestaurationDans(db, "goal", a.s1);
    expect(plan?.remonte).toBe(true);
    expect(plan?.total).toBe(4); // tout le lot revient
    // Le plan n'a rien écrit : il ANNONCE.
    expect(lireStamp("goals", a.s1)).toBe(T1);

    await restaurerDans(db, "goal", a.s1);
    for (const id of [a.racine, a.p1, a.p2, a.s1]) expect(lireStamp("goals", id)).toBeNull();
  });

  it("restaurer un enfant jeté SEUL sous un parent jeté plus tard ramène les deux lots", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.s1, T1); // l'enfant d'abord
    await mettreEnCorbeilleDans(db, "goal", a.racine, T2); // puis tout le reste
    const plan = await restaurerDans(db, "goal", a.s1);
    expect(plan?.remonte).toBe(true);
    expect(plan?.etapes.map((e) => e.stamp)).toEqual([T2, T1]); // l'ancêtre d'abord
    for (const id of [a.racine, a.p1, a.p2, a.s1]) expect(lireStamp("goals", id)).toBeNull();
  });

  it("un enfant sous un parent VIVANT revient seul, sans remonter", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.p2, T1);
    const plan = await restaurerDans(db, "goal", a.p2);
    expect(plan?.remonte).toBe(false);
    expect(plan?.total).toBe(1);
  });

  it("rend null, sans erreur, pour un objet qui n'est pas en corbeille", async () => {
    // Le cas d'une restauration faite ailleurs, arrivée par la synchronisation.
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    expect(await restaurerDans(db, "note", id)).toBeNull();
    expect(await restaurerDans(db, "note", 99999)).toBeNull();
  });

  it("⭐ ne restaure pas un objet RE-JETÉ entre le calcul du lot et l'écriture", async () => {
    // La course que la garde `deleted_at = $1` de la restauration empêche : la
    // synchronisation applique, entre le plan et l'UPDATE, une nouvelle mise en
    // corbeille venue d'un autre appareil (autre horodatage). Restaurer quand
    // même effacerait CE geste-là, plus récent, sans que personne le voie.
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    await mettreEnCorbeilleDans(db, "note", id, T1);

    let course = true;
    const avecCourse = {
      select: db.select.bind(db),
      async execute(sql: string, params?: unknown[]) {
        if (course && sql.startsWith("UPDATE notes SET deleted_at = NULL")) {
          course = false;
          sqlite.prepare("UPDATE notes SET deleted_at = ? WHERE id = ?").run(T2, id);
        }
        return db.execute(sql, params);
      },
    };
    await restaurerDans(avecCourse, "note", id);
    expect(lireStamp("notes", id)).toBe(T2); // le geste le plus récent tient
  });

  it("survit à une boucle dans parent_goal_id au lieu de bloquer l'app", async () => {
    const x = ins("INSERT INTO goals (title, scope, created_at) VALUES ('x', 'long', 'x')");
    const y = ins("INSERT INTO goals (title, scope, created_at, parent_goal_id) VALUES ('y', 'long', 'x', ?)", x);
    sqlite.prepare("UPDATE goals SET parent_goal_id = ?, deleted_at = ? WHERE id = ?").run(y, T1, x);
    sqlite.prepare("UPDATE goals SET deleted_at = ? WHERE id = ?").run(T1, y);
    const plan = await planRestaurationDans(db, "goal", y);
    expect(plan).not.toBeNull();
  });
});

describe("lire la corbeille", () => {
  it("⭐ montre un lot PAR SA RACINE, avec sa taille — pas ses enfants à part", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    const c = await lireCorbeilleDans(db);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "goal", id: a.racine, titre: "Lancer la chaîne", taille: 4 });
  });

  it("montre à part un enfant jeté pour son compte", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.p2, T1);
    await mettreEnCorbeilleDans(db, "goal", a.racine, T2);
    const c = await lireCorbeilleDans(db);
    expect(c.map((x) => x.id).sort()).toEqual([a.racine, a.p2].sort());
  });

  it("range le plus récent en premier, toutes familles confondues", async () => {
    const n = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('note', '', 'x', 'x')");
    const t = ins("INSERT INTO tasks (label, priority, recurrence, created_at) VALUES ('tâche', 'low', 'none', 'x')");
    await mettreEnCorbeilleDans(db, "note", n, T1);
    await mettreEnCorbeilleDans(db, "task", t, T2);
    const c = await lireCorbeilleDans(db);
    expect(c.map((x) => x.titre)).toEqual(["tâche", "note"]);
  });

  it("ne montre rien de vivant", async () => {
    ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    expect(await lireCorbeilleDans(db)).toEqual([]);
  });
});

describe("ce qu'il faut purger", () => {
  it("ne retient que ce qui a passé le seuil", async () => {
    const a = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('ancienne', '', 'x', 'x')");
    const b = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('récente', '', 'x', 'x')");
    await mettreEnCorbeilleDans(db, "note", a, "2026-08-01T00:00:00.000Z");
    await mettreEnCorbeilleDans(db, "note", b, T1);
    const p = await aPurgerDans(db, "2026-08-23T00:00:00.000Z");
    expect(p).toEqual([{ kind: "note", id: a }]);
  });

  it("⭐ ordonne les objectifs DU PLUS PROFOND AU PLUS HAUT", async () => {
    // Supprimer le parent d'abord ferait remonter les enfants d'un niveau :
    // ils redeviendraient VIVANTS au lieu de partir avec lui.
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    const ordre = (await aPurgerDans(db, T2)).map((x) => x.id);
    expect(ordre.indexOf(a.s1)).toBeLessThan(ordre.indexOf(a.p1));
    expect(ordre.indexOf(a.p1)).toBeLessThan(ordre.indexOf(a.racine));
    expect(ordre.indexOf(a.p2)).toBeLessThan(ordre.indexOf(a.racine));
  });

  it("⭐ la suppression définitive d'un élément ne vise JAMAIS un objet vivant", async () => {
    const id = ins("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('n', '', 'x', 'x')");
    expect(await lotAPurgerDans(db, "note", id)).toEqual([]);
  });

  it("la suppression définitive d'un objectif emporte son lot, enfants d'abord", async () => {
    const a = arbre();
    await mettreEnCorbeilleDans(db, "goal", a.racine, T1);
    const lot = (await lotAPurgerDans(db, "goal", a.racine)).map((x) => x.id);
    expect(lot).toHaveLength(4);
    expect(lot[lot.length - 1]).toBe(a.racine);
    expect(lot.indexOf(a.s1)).toBeLessThan(lot.indexOf(a.p1));
  });
});
