import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { synchroniser, type Contexte } from "./engine";
import { BaseSqlite, deuxAppareils, UTILISATEUR, type Appareil, type ServeurSimule } from "./engine.testutil";
import type { SousCles } from "./crypto";
import { remettreEnOrdre, type BaseLocale } from "./local";
import { TABLES_SYNC } from "./scope";

/**
 * ⭐ Audit du 2026-10-20, donnees-3 : restaurer une sauvegarde n'est plus défait
 * par la synchronisation suivante.
 *
 * Le scénario de l'audit, sur le banc à deux appareils : une note précieuse
 * supprimée par erreur sur A, la suppression partie partout, puis A restaure la
 * copie d'hier — qui porte le curseur d'hier. Sans remise en ordre, le premier
 * cycle tirait la pierre tombale et effaçait la note de nouveau.
 */

let banc: Awaited<ReturnType<typeof deuxAppareils>>;
let a: Appareil;
let b: Appareil;
let serveur: ServeurSimule;
let cles: SousCles;
let dossier: string;

beforeEach(async () => {
  banc = await deuxAppareils();
  ({ a, b, serveur, cles } = banc);
  dossier = mkdtempSync(join(tmpdir(), "shale-restauration-"));
});
afterEach(() => {
  banc.fermer();
  rmSync(dossier, { recursive: true, force: true });
});

const ctx = (db: BaseLocale, deviceId: string): Contexte => ({ db, transport: serveur, cles, userId: UTILISATEUR, deviceId });
const titres = (sqlite: DatabaseSync) =>
  (sqlite.prepare("SELECT title FROM notes ORDER BY title").all() as { title: string }[]).map((n) => n.title);

/** La sauvegarde d'aujourd'hui, et le redémarrage de A dessus — ce que fait le Rust. */
function restaurerA(chemin: string, marquee: boolean): { sqlite: DatabaseSync; db: BaseSqlite } {
  const sqlite = new DatabaseSync(chemin);
  if (marquee) {
    sqlite.exec("INSERT INTO sync_meta (k, v) VALUES ('restauree', '1') ON CONFLICT(k) DO UPDATE SET v = '1'");
  }
  return { sqlite, db: new BaseSqlite(sqlite) };
}

describe("restaurer une sauvegarde, avec la synchronisation active", () => {
  async function scenario(marquee: boolean) {
    a.ecrire("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Précieuse', '<p>x</p>', 'x', 'x')");
    a.ecrire("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Autre', '<p>y</p>', 'x', 'x')");
    for (let i = 0; i < 2; i++) {
      await synchroniser(ctx(a.db, a.nom));
      await synchroniser(ctx(b.db, b.nom));
    }
    expect(titres(b.sqlite)).toEqual(["Autre", "Précieuse"]);

    // La sauvegarde, prise par `VACUUM INTO` comme le fait le Rust.
    const chemin = join(dossier, "sauvegarde.db");
    a.sqlite.exec(`VACUUM INTO '${chemin}'`);

    // L'erreur : la note est supprimée, et la suppression part partout.
    a.ecrire("DELETE FROM notes WHERE title = 'Précieuse'");
    await synchroniser(ctx(a.db, a.nom));
    await synchroniser(ctx(b.db, b.nom));
    expect(titres(b.sqlite)).toEqual(["Autre"]);

    // A redémarre sur la copie.
    const restauree = restaurerA(chemin, marquee);
    await new Promise((r) => setTimeout(r, 5)); // les horloges de la copie et du serveur se distinguent
    await remettreEnOrdre(restauree.db, TABLES_SYNC);
    for (let i = 0; i < 2; i++) {
      await synchroniser(ctx(restauree.db, a.nom));
      await synchroniser(ctx(b.db, b.nom));
    }
    const resultat = { surA: titres(restauree.sqlite), surB: titres(b.sqlite) };
    restauree.sqlite.close();
    return resultat;
  }

  it("⭐ la note restaurée reste — sur l'appareil restauré ET sur l'autre", async () => {
    const { surA, surB } = await scenario(true);
    expect(surA).toEqual(["Autre", "Précieuse"]);
    expect(surB).toEqual(["Autre", "Précieuse"]);
  });

  it("témoin : une copie NON marquée est défaite par le premier cycle (le défaut d'avant)", async () => {
    const { surA } = await scenario(false);
    expect(surA).toEqual(["Autre"]);
  });

  it("ce qui a été créé ailleurs APRÈS la copie n'est pas détruit", async () => {
    a.ecrire("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Avant', '', 'x', 'x')");
    await synchroniser(ctx(a.db, a.nom));
    await synchroniser(ctx(b.db, b.nom));
    const chemin = join(dossier, "sauvegarde.db");
    a.sqlite.exec(`VACUUM INTO '${chemin}'`);
    b.ecrire("INSERT INTO notes (title, body, created_at, updated_at) VALUES ('Créée sur B après', '', 'x', 'x')");
    await synchroniser(ctx(b.db, b.nom));

    const restauree = restaurerA(chemin, true);
    await remettreEnOrdre(restauree.db, TABLES_SYNC);
    await synchroniser(ctx(restauree.db, a.nom));
    await synchroniser(ctx(restauree.db, a.nom));
    expect(titres(restauree.sqlite)).toEqual(["Avant", "Créée sur B après"]);
    expect(restauree.sqlite.prepare("SELECT v FROM sync_meta WHERE k = 'restauree'").get()).toEqual({ v: "0" });
    restauree.sqlite.close();
  });
});
