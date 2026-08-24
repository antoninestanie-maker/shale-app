import { DatabaseSync, type SQLInputValue } from "node:sqlite";

import { deriverSousCles, genererDek, type SousCles } from "./crypto";
import { oublierSchema, type BaseLocale } from "./local";
import { baseNeuve } from "./schema.testutil";
import type { LigneAEnvoyer, LigneDistante, Transport } from "./transport";

/**
 * Banc d'essai à DEUX APPAREILS partageant un serveur simulé.
 *
 * C'est le seul montage capable de prouver ce qui compte vraiment : qu'une
 * saisie faite ici réapparaisse là-bas, qu'un conflit se résolve du même côté
 * des deux côtés, et qu'une suppression ne ressuscite pas.
 */

/**
 * Adaptateur `node:sqlite` → interface du moteur.
 *
 * ⚠️ Traduit les jokers `$1` (dialecte de `tauri-plugin-sql`, employé partout
 * dans le projet) en `?` positionnels. La traduction RÉORDONNE les paramètres
 * au lieu de les recopier : une même valeur peut être référencée deux fois dans
 * une requête — c'est le cas des `ON CONFLICT … DO UPDATE`, où `$3` sert à la
 * fois à l'insertion et à la mise à jour. Une conversion naïve décalerait
 * silencieusement toutes les valeurs.
 */
export class BaseSqlite implements BaseLocale {
  constructor(readonly brute: DatabaseSync) {}

  private preparer(sql: string, params: unknown[]): [string, SQLInputValue[]] {
    const ordre: number[] = [];
    const converti = sql.replace(/\$(\d+)/g, (_, n: string) => {
      ordre.push(Number(n) - 1);
      return "?";
    });
    const valeurs = ordre.map((i) => {
      const v = params[i];
      // SQLite ne connaît ni booléen ni `undefined` ; l'app écrit pourtant les
      // deux (drapeaux 0/1, colonnes absentes). La conversion est faite ici,
      // comme la fait `tauri-plugin-sql` côté natif.
      if (typeof v === "boolean") return v ? 1 : 0;
      if (v === undefined) return null;
      return v as SQLInputValue;
    });
    return [converti, valeurs];
  }

  async select<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [converti, valeurs] = this.preparer(sql, params);
    return this.brute.prepare(converti).all(...valeurs) as T[];
  }

  async execute(sql: string, params: unknown[] = []): Promise<unknown> {
    const [converti, valeurs] = this.preparer(sql, params);
    return this.brute.prepare(converti).run(...valeurs);
  }
}

/**
 * Serveur en mémoire qui applique EXACTEMENT la règle du trigger Postgres
 * (`sync.sql`, fonction `sync_rows_lww`). Si les deux venaient à diverger, les
 * tests du moteur cesseraient de dire quoi que ce soit d'utile sur la
 * production — d'où la comparaison écrite ici mot pour mot.
 */
export class ServeurSimule implements Transport {
  private readonly lignes = new Map<string, LigneDistante>();
  private seq = 0;
  /** Compteurs d'observation : combien d'échanges, pour vérifier l'économie. */
  public envois = 0;
  public lectures = 0;
  /** Quand vrai, tout envoi échoue — pour simuler une coupure réseau. */
  public horsLigne = false;

  async pousser(lignes: LigneAEnvoyer[]): Promise<void> {
    if (this.horsLigne) throw new Error("réseau indisponible");

    // ⚠️ FIDÉLITÉ À POSTGREST, ajoutée le 2026-08-13 après un incident réel.
    //
    // Un `insert … on conflict do update` refuse d'affecter DEUX FOIS la même
    // ligne dans une seule commande : Postgres lève `21000`, « ON CONFLICT DO
    // UPDATE command cannot affect row a second time », et **tout le lot est
    // rejeté**. `Prefer: resolution=merge-duplicates` n'y change rien — il
    // arbitre entre le lot et la table, pas à l'intérieur du lot.
    //
    // Ce simulateur, lui, écrivait les doublons l'un après l'autre dans sa
    // `Map` : le dernier gagnait, tout se passait bien, et 30 tests d'engine
    // déclaraient conforme un envoi que le vrai serveur renvoyait en 400. La
    // synchronisation d'un vrai compte est restée bloquée sur ce défaut, sans
    // que rien ne le signale.
    const vus = new Set<string>();
    for (const l of lignes) {
      const cle = `${l.table_tag}|${l.row_tag}`;
      if (vus.has(cle)) {
        throw new Error(
          "ON CONFLICT DO UPDATE command cannot affect row a second time " +
            `(${cle} présent deux fois dans le même lot)`,
        );
      }
      vus.add(cle);
    }

    this.envois++;
    for (const l of lignes) {
      const cle = `${l.table_tag}|${l.row_tag}`;
      const ancienne = this.lignes.get(cle);
      const plusRecente =
        !ancienne ||
        l.client_ts > ancienne.client_ts ||
        (l.client_ts === ancienne.client_ts && l.device_id > ancienne.device_id);
      if (!plusRecente) continue;
      this.lignes.set(cle, { ...l, server_seq: ++this.seq });
    }
  }

  async effacerTout(): Promise<void> {
    if (this.horsLigne) throw new Error("réseau indisponible");
    this.lignes.clear();
  }

  async tirer(curseur: number, limite: number): Promise<LigneDistante[]> {
    if (this.horsLigne) throw new Error("réseau indisponible");
    this.lectures++;
    return [...this.lignes.values()]
      .filter((l) => l.server_seq > curseur)
      .sort((a, b) => a.server_seq - b.server_seq)
      .slice(0, limite);
  }

  /** Vue de contrôle : ce que le serveur détient réellement. */
  get contenu(): LigneDistante[] {
    return [...this.lignes.values()];
  }
}

export interface Appareil {
  nom: string;
  db: BaseSqlite;
  sqlite: DatabaseSync;
  /** Exécute du SQL brut, comme le ferait l'app (donc journalisé). */
  ecrire(sql: string, ...params: unknown[]): { lastInsertRowid: number };
  lire<T>(sql: string, ...params: unknown[]): T[];
  fermer(): void;
}

export function appareil(nom: string): Appareil {
  const sqlite = baseNeuve();
  const db = new BaseSqlite(sqlite);
  sqlite.prepare("UPDATE sync_meta SET v = ? WHERE k = 'device_id'").run(nom);
  return {
    nom,
    db,
    sqlite,
    ecrire(sql, ...params) {
      const r = sqlite.prepare(sql).run(...(params as never[]));
      return { lastInsertRowid: Number(r.lastInsertRowid) };
    },
    lire<T>(sql: string, ...params: unknown[]) {
      return sqlite.prepare(sql).all(...(params as never[])) as T[];
    },
    fermer() {
      sqlite.close();
    },
  };
}

/** Deux appareils, un serveur, une seule clé de données — le cas réel. */
export async function deuxAppareils(): Promise<{
  a: Appareil;
  b: Appareil;
  serveur: ServeurSimule;
  cles: SousCles;
  fermer(): void;
}> {
  oublierSchema();
  const cles = await deriverSousCles(genererDek());
  const a = appareil("appareil-A");
  const b = appareil("appareil-B");
  return {
    a,
    b,
    cles,
    serveur: new ServeurSimule(),
    fermer() {
      a.fermer();
      b.fermer();
    },
  };
}

export const UTILISATEUR = "11111111-1111-4111-8111-111111111111";
