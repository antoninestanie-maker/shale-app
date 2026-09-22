import { describe, expect, it } from "vitest";
import { baseNeuve } from "../sync/schema.testutil";
import { TABLES_SYNC } from "../sync/scope";
import {
  aPurger,
  horodatageCorbeille,
  joursRestants,
  RETENTION_JOURS,
  seuilDePurge,
  TABLES_CORBEILLE,
  vivant,
} from "./regles";

const JOUR = 24 * 60 * 60 * 1000;
const T0 = new Date("2026-09-22T10:00:00.000Z");

describe("l'horodatage", () => {
  it("est en UTC, ISO, à la milliseconde — le format de sync_outbox", () => {
    expect(horodatageCorbeille(T0)).toBe("2026-09-22T10:00:00.000Z");
    expect(horodatageCorbeille()).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });
});

describe("les jours restants", () => {
  it("annonce 30 jours le jour même", () => {
    expect(joursRestants(horodatageCorbeille(T0), new Date(T0.getTime() + 60 * 60 * 1000))).toBe(30);
  });

  it("⭐ arrondit AU-DESSUS : ne promet jamais moins de temps qu'il n'en reste", () => {
    // 29 jours et une heure : il reste 23 h — c'est encore « 1 jour », pas « 0 ».
    const presque = new Date(T0.getTime() + 29 * JOUR + 60 * 60 * 1000);
    expect(joursRestants(horodatageCorbeille(T0), presque)).toBe(1);
  });

  it("ne descend jamais sous zéro", () => {
    expect(joursRestants(horodatageCorbeille(T0), new Date(T0.getTime() + 90 * JOUR))).toBe(0);
  });

  it("rend 0 pour un horodatage illisible, sans lever", () => {
    expect(joursRestants("pas une date", T0)).toBe(0);
  });
});

describe("la purge", () => {
  it("ne purge pas avant 30 jours", () => {
    expect(aPurger(horodatageCorbeille(T0), new Date(T0.getTime() + (RETENTION_JOURS * JOUR - 1)))).toBe(false);
  });

  it("purge à 30 jours pile", () => {
    expect(aPurger(horodatageCorbeille(T0), new Date(T0.getTime() + RETENTION_JOURS * JOUR))).toBe(true);
  });

  it("⭐ ne purge JAMAIS un horodatage illisible — c'est la seule erreur irréparable", () => {
    expect(aPurger("n'importe quoi", new Date(T0.getTime() + 999 * JOUR))).toBe(false);
  });

  it("⭐ compare en NOMBRES : une forme sans millisecondes reste bien jugée", () => {
    // Une chaîne sans « .000 » se trie AVANT la même heure avec : une
    // comparaison lexicographique aurait purgé trop tôt ou trop tard.
    const sansMs = "2026-09-22T10:00:00Z";
    expect(aPurger(sansMs, new Date(T0.getTime() + RETENTION_JOURS * JOUR - 1))).toBe(false);
    expect(aPurger(sansMs, new Date(T0.getTime() + RETENTION_JOURS * JOUR))).toBe(true);
  });

  it("le seuil SQL est l'instant exact, 30 jours avant", () => {
    expect(seuilDePurge(new Date(T0.getTime() + RETENTION_JOURS * JOUR))).toBe("2026-09-22T10:00:00.000Z");
  });
});

describe("le fragment de filtre", () => {
  it("se préfixe d'un alias de jointure", () => {
    expect(vivant("n")).toBe("n.deleted_at IS NULL");
  });
});

describe("⭐ la liste des tables tient debout contre le VRAI schéma", () => {
  const db = baseNeuve();
  const tables = (
    db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]
  ).map((r) => r.name);
  const aLaColonne = tables.filter((t) =>
    (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).some((c) => c.name === "deleted_at"),
  );

  it("chaque table à corbeille porte bien la colonne deleted_at", () => {
    for (const t of TABLES_CORBEILLE) expect(aLaColonne, t).toContain(t);
  });

  it("⭐ et AUCUNE autre table ne la porte — sinon la purge l'oublierait pour toujours", () => {
    // Une colonne ajoutée par une migration future, sans que la table entre
    // dans TABLE_DE, garderait ses lignes en corbeille indéfiniment : ni la
    // vue ni la purge ne la connaîtraient.
    expect([...aLaColonne].sort()).toEqual([...TABLES_CORBEILLE].sort());
  });

  it("⭐ chaque table à corbeille est SYNCHRONISÉE — sinon une restauration ne partirait pas", () => {
    for (const t of TABLES_CORBEILLE) expect(TABLES_SYNC as readonly string[], t).toContain(t);
  });
});
