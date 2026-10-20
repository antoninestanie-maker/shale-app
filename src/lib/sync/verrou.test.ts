import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { appareil, type Appareil } from "./engine.testutil";
import { enApplication, oublierSchema, remettreEnOrdre } from "./local";
import { TABLES_SYNC } from "./scope";
import { ecritureUtilisateur } from "./verrou";

/**
 * Audit du 2026-10-20, donnees-2 : une écriture faite PENDANT qu'une page
 * reçue s'applique ne doit pas échapper à la file d'envoi.
 */

let a: Appareil;
beforeEach(() => {
  oublierSchema();
  a = appareil("appareil-A");
});
afterEach(() => a.fermer());

const enFile = (table: string) =>
  a.lire<{ n: number }>("SELECT COUNT(*) AS n FROM sync_outbox WHERE table_name = ?", table)[0].n;
const taches = () => a.lire<{ label: string }>("SELECT label FROM tasks").map((t) => t.label);
const drapeau = () => a.lire<{ v: string }>("SELECT v FROM sync_meta WHERE k = 'applying'")[0].v;

/** Une promesse qu'on résout à la main. */
function verrou() {
  let ouvrir!: () => void;
  const p = new Promise<void>((r) => (ouvrir = r));
  return { p, ouvrir };
}
const laisserCourir = () => new Promise((r) => setTimeout(r, 5));

describe("la porte des écritures", () => {
  it("⭐ une tâche cochée PENDANT une application attend, puis part dans la file d'envoi", async () => {
    const page = verrou();
    const application = enApplication(a.db, () => page.p);
    await laisserCourir();
    expect(drapeau()).toBe("1");

    const ecriture = ecritureUtilisateur(() =>
      a.db.execute("INSERT INTO tasks (label, priority, recurrence) VALUES ('cochée pendant', 'low', 'none')"),
    );
    await laisserCourir();
    // Porte fermée : rien n'est écrit tant que le drapeau est levé.
    expect(taches()).toEqual([]);

    page.ouvrir();
    await application;
    await ecriture;
    expect(drapeau()).toBe("0");
    expect(taches()).toEqual(["cochée pendant"]);
    expect(enFile("tasks")).toBeGreaterThan(0);
  });

  it("une écriture DÉJÀ lancée finit avant que le drapeau ne se lève", async () => {
    const lente = verrou();
    const ecriture = ecritureUtilisateur(async () => {
      await lente.p;
      return a.db.execute("INSERT INTO tasks (label, priority, recurrence) VALUES ('lancée avant', 'low', 'none')");
    });
    await laisserCourir();
    const application = enApplication(a.db, async () => undefined);
    await laisserCourir();
    expect(drapeau()).toBe("0"); // l'application attend l'écriture en vol

    lente.ouvrir();
    await ecriture;
    await application;
    expect(enFile("tasks")).toBeGreaterThan(0);
  });

  it("une écriture ne bloque pas une autre écriture", async () => {
    await Promise.all([
      ecritureUtilisateur(() => a.db.execute("INSERT INTO tasks (label, priority, recurrence) VALUES ('un', 'low', 'none')")),
      ecritureUtilisateur(() => a.db.execute("INSERT INTO tasks (label, priority, recurrence) VALUES ('deux', 'low', 'none')")),
    ]);
    expect(taches().sort()).toEqual(["deux", "un"]);
  });
});

describe("remettreEnOrdre — au démarrage", () => {
  it("⭐ un drapeau resté levé (app tuée pendant une application) est baissé", async () => {
    a.ecrire("UPDATE sync_meta SET v = '1' WHERE k = 'applying'");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('perdue', 'low', 'none')");
    expect(enFile("tasks")).toBe(0); // c'était le défaut : plus rien n'entrait dans la file

    const r = await remettreEnOrdre(a.db, TABLES_SYNC);
    expect(r.restauree).toBe(false);
    expect(drapeau()).toBe("0");
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('suivante', 'low', 'none')");
    expect(enFile("tasks")).toBeGreaterThan(0);
  });

  it("une base qui n'a pas été restaurée n'est pas republiée", async () => {
    a.ecrire("INSERT INTO tasks (label, priority, recurrence) VALUES ('t', 'low', 'none')");
    a.ecrire("DELETE FROM sync_outbox");
    await remettreEnOrdre(a.db, TABLES_SYNC);
    expect(enFile("tasks")).toBe(0);
  });
});
