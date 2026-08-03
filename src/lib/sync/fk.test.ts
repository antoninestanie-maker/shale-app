import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";

import { CLES_ETRANGERES, clesDe, colonneUid, colonnesLocales } from "./fk";
import { baseNeuve } from "./schema.testutil";
import { estTableSync, TABLES_SYNC } from "./scope";

/**
 * Étape 5 — la table des clés étrangères, confrontée au SCHÉMA RÉEL.
 *
 * Une clé oubliée ne fait pas échouer la synchronisation : elle fait voyager un
 * numéro local, qui désignera n'importe quoi à l'arrivée. Pas d'erreur, pas
 * d'alerte — juste une tâche rattachée au mauvais objectif. C'est très
 * exactement le genre de faute qu'un test doit rendre impossible.
 */

let db: DatabaseSync;
beforeEach(() => {
  db = baseNeuve();
});
afterEach(() => db.close());

interface FkSqlite {
  table: string;
  from: string;
}

/** Clés étrangères réellement déclarées dans le schéma, table par table. */
function reellesDe(table: string): { colonne: string; vers: string }[] {
  return (db.prepare(`PRAGMA foreign_key_list(${table})`).all() as unknown as FkSqlite[]).map((f) => ({
    colonne: f.from,
    vers: f.table,
  }));
}

describe("la table des clés étrangères colle au schéma", () => {
  it("AUCUNE clé étrangère du schéma n'est oubliée", () => {
    const oublis: string[] = [];
    for (const table of TABLES_SYNC) {
      const declarees = new Set(clesDe(table).map((c) => c.colonne));
      for (const reelle of reellesDe(table)) {
        // On ne s'intéresse qu'aux références vers une table SYNCHRONISÉE : une
        // référence vers une table qui ne voyage pas n'a rien à traduire.
        if (!estTableSync(reelle.vers)) continue;
        if (!declarees.has(reelle.colonne)) oublis.push(`${table}.${reelle.colonne} → ${reelle.vers}`);
      }
    }
    expect(oublis).toEqual([]);
  });

  it("aucune clé déclarée ne pointe dans le vide", () => {
    // Le miroir du précédent : une colonne renommée ou supprimée par une
    // migration laisserait une entrée fantôme, qui produirait un `null`
    // silencieux à l'application.
    const fantomes: string[] = [];
    for (const [table, cles] of Object.entries(CLES_ETRANGERES)) {
      const colonnes = new Set(
        (db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]).map((c) => c.name),
      );
      for (const cle of cles) {
        if (!colonnes.has(cle.colonne)) fantomes.push(`${table}.${cle.colonne}`);
        if (!estTableSync(cle.vers)) fantomes.push(`${table}.${cle.colonne} → ${cle.vers} (hors sync)`);
      }
    }
    expect(fantomes).toEqual([]);
  });

  it("TOUTE colonne en `_id` est traduite, déclarée en SQL ou non", () => {
    // Le contrôle par `PRAGMA foreign_key_list` ne suffit pas : plusieurs
    // références du schéma sont LOGIQUES sans être déclarées en SQL
    // (`live_positions.sizing_calc_id` et `.trade_id` n'ont pas de clause
    // FOREIGN KEY). Elles seraient donc invisibles au contrôle précédent, tout
    // en produisant exactement le même dégât : un numéro local qui voyage.
    //
    // On balaie donc les colonnes par leur NOM. Une future colonne `machin_id`
    // fera échouer ce test tant que personne n'aura tranché sur son sort.
    const nonTraduites: string[] = [];
    for (const table of TABLES_SYNC) {
      const declarees = new Set(clesDe(table).map((c) => c.colonne));
      const colonnes = (
        db.prepare(`PRAGMA table_info(${table})`).all() as unknown as { name: string }[]
      ).map((c) => c.name);
      for (const colonne of colonnes) {
        if (colonne === "id" || !colonne.endsWith("_id")) continue;
        if (!declarees.has(colonne)) nonTraduites.push(`${table}.${colonne}`);
      }
    }
    expect(nonTraduites).toEqual([]);
  });

  it("ne déclare que des tables synchronisées", () => {
    for (const table of Object.keys(CLES_ETRANGERES)) {
      expect(estTableSync(table)).toBe(true);
    }
  });
});

describe("mécanique de renommage", () => {
  it("transforme `_id` en `_uid`", () => {
    expect(colonneUid("goal_id")).toBe("goal_uid");
    expect(colonneUid("parent_goal_id")).toBe("parent_goal_uid");
    expect(colonneUid("sizing_calc_id")).toBe("sizing_calc_uid");
  });

  it("ne touche pas à un `_id` qui n'est pas en fin de nom", () => {
    expect(colonneUid("id_externe")).toBe("id_externe");
  });

  it("retire le numéro local ET les colonnes de clé étrangère", () => {
    const retirees = colonnesLocales("tasks");
    expect(retirees.has("id")).toBe(true);
    expect(retirees.has("goal_id")).toBe(true);
    // Le reste voyage, `uid` compris — c'est lui qui porte l'identité.
    expect(retirees.has("uid")).toBe(false);
    expect(retirees.has("label")).toBe(false);
  });
});

describe("le nom d'un tag voyage tel quel", () => {
  it("`tasks.tag` n'est pas une clé étrangère à traduire", () => {
    // `tasks.tag` stocke le NOM du tag, pas son numéro : il a déjà le même sens
    // partout. C'est aussi pourquoi l'uid d'un tag est dérivé de son nom.
    expect(clesDe("tasks").some((c) => c.colonne === "tag")).toBe(false);
    const colonnes = (
      db.prepare("PRAGMA table_info(tasks)").all() as unknown as { name: string; type: string }[]
    ).find((c) => c.name === "tag");
    expect(colonnes?.type).toBe("TEXT");
  });
});
