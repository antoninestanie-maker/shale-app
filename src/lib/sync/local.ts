import { clesDe, colonneUid, colonnesLocales } from "./fk";
import type { EntreeOutbox, ChangementEnAttente } from "./outbox";

/**
 * Accès à la base SQLite locale pour le moteur de synchronisation.
 *
 * Tout passe par l'interface `BaseLocale` plutôt que par `getDb()` directement :
 * c'est ce qui permet de faire tourner le moteur entier sur une base en mémoire
 * dans les tests, sans Tauri. La forme de l'interface est celle de
 * `@tauri-apps/plugin-sql`, donc l'implémentation réelle est le `Database` lui-même.
 */
export interface BaseLocale {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export type Ligne = Record<string, unknown>;

/** Levée quand une ligne arrive avant le parent auquel elle se rattache. */
export class ParentManquant extends Error {
  constructor(
    readonly table: string,
    readonly vers: string,
    readonly uidParent: string,
  ) {
    super(`${table} : parent ${vers}/${uidParent} pas encore arrivé`);
    this.name = "ParentManquant";
  }
}

// ─── Schéma ──────────────────────────────────────────────────────────────────

const cacheColonnes = new Map<string, string[]>();

/**
 * Colonnes réelles d'une table, lues dans le schéma plutôt que codées en dur.
 *
 * Une liste figée ici se serait désynchronisée à la première migration, et
 * l'erreur aurait été silencieuse : la colonne ajoutée aurait simplement cessé
 * de se synchroniser, sans que rien ne le signale.
 */
export async function colonnesDe(db: BaseLocale, table: string): Promise<string[]> {
  const enCache = cacheColonnes.get(table);
  if (enCache) return enCache;
  const infos = await db.select<{ name: string }>(`PRAGMA table_info(${table})`);
  const noms = infos.map((c) => c.name);
  cacheColonnes.set(table, noms);
  return noms;
}

/** À appeler si le schéma change en cours d'exécution (migrations, tests). */
export function oublierSchema(): void {
  cacheColonnes.clear();
}

/**
 * `settings` n'a ni `id` ni `uid` : sa clé primaire est déjà du texte
 * globalement valable. Elle est donc traitée à part partout où l'identité
 * compte.
 */
const CLE_NATURELLE: Readonly<Record<string, string>> = { settings: "key" };

function cleDe(table: string): string {
  return CLE_NATURELLE[table] ?? "uid";
}

// ─── Lecture et sérialisation ────────────────────────────────────────────────

/** La ligne telle qu'elle est en base, retrouvée par son numéro local. */
export async function lireLigne(db: BaseLocale, table: string, rowId: number): Promise<Ligne | null> {
  const lignes = await db.select<Ligne>(`SELECT * FROM ${table} WHERE rowid = $1`, [rowId]);
  return lignes[0] ?? null;
}

async function uidDuParent(
  db: BaseLocale,
  table: string,
  id: number,
): Promise<string | null> {
  const lignes = await db.select<{ uid: string }>(`SELECT uid FROM ${table} WHERE id = $1`, [id]);
  return lignes[0]?.uid ?? null;
}

/**
 * Prépare une ligne pour le voyage : les numéros locaux sortent, les `uid`
 * entrent. Voir `fk.ts` pour ce qui se joue exactement ici.
 */
export async function serialiser(db: BaseLocale, table: string, ligne: Ligne): Promise<Ligne> {
  const aRetirer = colonnesLocales(table);
  const charge: Ligne = {};
  for (const [colonne, valeur] of Object.entries(ligne)) {
    if (!aRetirer.has(colonne)) charge[colonne] = valeur;
  }

  for (const fk of clesDe(table)) {
    const idLocal = ligne[fk.colonne];
    charge[colonneUid(fk.colonne)] =
      idLocal == null ? null : await uidDuParent(db, fk.vers, Number(idLocal));
  }
  return charge;
}

// ─── Application d'une ligne reçue ───────────────────────────────────────────

async function idDepuisUid(db: BaseLocale, table: string, uid: string): Promise<number | null> {
  const lignes = await db.select<{ id: number }>(`SELECT id FROM ${table} WHERE uid = $1`, [uid]);
  return lignes[0]?.id ?? null;
}

/**
 * Écrit une ligne venue d'un autre appareil.
 *
 * ⚠️ À N'APPELER QUE sous `enApplication()`, faute de quoi les triggers
 * renverraient cette écriture au cloud d'où elle vient — et chaque
 * synchronisation en déclencherait une autre, indéfiniment.
 *
 * Les colonnes inconnues de la charge utile sont IGNORÉES plutôt que de faire
 * échouer l'écriture : un appareil resté sur une version antérieure de l'app
 * doit pouvoir recevoir les lignes d'une version plus récente, quitte à en
 * perdre les nouveautés, plutôt que de cesser de se synchroniser.
 */
export async function appliquerLigne(
  db: BaseLocale,
  table: string,
  uid: string,
  charge: Ligne,
): Promise<void> {
  const connues = new Set(await colonnesDe(db, table));
  const valeurs: Ligne = {};

  // Les colonnes de TRADUCTION (`goal_uid`, `account_uid`…) sont écartées ici et
  // retraduites juste après, en `_id` locaux.
  //
  // ⚠️ Le tri se fait sur la LISTE DES CLÉS DÉCLARÉES, et surtout pas sur le
  // suffixe `_uid`. La version d'avant écartait toute colonne finissant par
  // `_uid`, ce qui revenait à parier qu'aucune table ne stockerait jamais un uid
  // comme DONNÉE. `object_links` fait exactement cela depuis la migration 020 :
  // ses deux extrémités sont polymorphes, donc elles portent des `uid` en clair
  // (§ 5 de la migration). Avec l'ancien tri, une arête arrivait de l'autre
  // appareil avec ses deux extrémités VIDÉES — sans erreur, sans alerte, juste
  // un lien qui ne pointe plus nulle part.
  //
  // Le comportement des tables existantes est inchangé : les seules colonnes en
  // `_uid` qu'émet `serialiser()` sont précisément celles des clés déclarées.
  const traduites = new Set(clesDe(table).map((c) => colonneUid(c.colonne)));

  for (const [colonne, valeur] of Object.entries(charge)) {
    if (traduites.has(colonne)) continue; // traité juste après
    if (connues.has(colonne)) valeurs[colonne] = valeur;
  }

  for (const fk of clesDe(table)) {
    const uidParent = charge[colonneUid(fk.colonne)];
    if (uidParent == null) {
      valeurs[fk.colonne] = null;
      continue;
    }
    const id = await idDepuisUid(db, fk.vers, String(uidParent));
    // Mise en quarantaine plutôt qu'un `null` silencieux : rattacher la tâche à
    // « aucun objectif » perdrait l'information sans que rien ne le signale.
    if (id == null) throw new ParentManquant(table, fk.vers, String(uidParent));
    valeurs[fk.colonne] = id;
  }

  const cle = cleDe(table);
  if (cle === "uid") valeurs.uid = uid;

  const colonnes = Object.keys(valeurs);
  const params = Object.values(valeurs);
  const jokers = colonnes.map((_, i) => `$${i + 1}`).join(", ");
  const maj = colonnes
    .filter((c) => c !== cle)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");

  await db.execute(
    `INSERT INTO ${table} (${colonnes.join(", ")}) VALUES (${jokers})
     ON CONFLICT(${cle}) DO UPDATE SET ${maj}`,
    params,
  );
}

/** Applique une pierre tombale. Sans effet si la ligne n'existe pas ici. */
export async function supprimerLigne(db: BaseLocale, table: string, uid: string): Promise<void> {
  const cle = cleDe(table);
  const valeur = cle === "uid" ? uid : uid.replace(/^st:/, "");
  await db.execute(`DELETE FROM ${table} WHERE ${cle} = $1`, [valeur]);
}

// ─── Drapeau anti-boucle ─────────────────────────────────────────────────────

/**
 * Sérialise les applications distantes entre elles ET vis-à-vis des écritures
 * de l'utilisateur.
 *
 * Le drapeau `applying` vit dans la BASE, il est donc global : deux tâches qui
 * se chevaucheraient verraient l'une remettre le drapeau à zéro pendant que
 * l'autre travaille encore, et les écritures suivantes repartiraient dans le
 * cloud. JavaScript étant mono-thread, une simple file d'attente suffit à
 * l'empêcher — à condition que TOUT passe par ici.
 */
let file: Promise<unknown> = Promise.resolve();

export function enApplication<T>(db: BaseLocale, travail: () => Promise<T>): Promise<T> {
  const suivant = file.then(async () => {
    await db.execute("UPDATE sync_meta SET v = '1' WHERE k = 'applying'");
    try {
      return await travail();
    } finally {
      await db.execute("UPDATE sync_meta SET v = '0' WHERE k = 'applying'");
    }
  });
  // La file ne doit pas s'interrompre sur un échec : une erreur d'application
  // ne doit pas bloquer toutes les synchronisations suivantes.
  file = suivant.catch(() => undefined);
  return suivant;
}

// ─── Journal et état ─────────────────────────────────────────────────────────

export async function lireOutbox(db: BaseLocale, limite = 5000): Promise<EntreeOutbox[]> {
  return db.select<EntreeOutbox>(
    "SELECT id, table_name, row_id, uid, op, ts FROM sync_outbox ORDER BY id LIMIT $1",
    [limite],
  );
}

/**
 * Retire de la file les écritures effectivement traitées.
 *
 * Borné par `jusquA` : une modification survenue PENDANT l'envoi porte un `id`
 * plus grand et survit donc à la purge. Sans cette borne, une saisie faite au
 * mauvais moment disparaîtrait sans jamais partir.
 */
export async function purgerOutbox(db: BaseLocale, changements: ChangementEnAttente[]): Promise<void> {
  for (const c of changements) {
    if (c.op === "delete") {
      await db.execute(
        "DELETE FROM sync_outbox WHERE table_name = $1 AND uid = $2 AND op = 'delete' AND id <= $3",
        [c.table, c.uid, c.jusquA],
      );
    } else {
      await db.execute(
        "DELETE FROM sync_outbox WHERE table_name = $1 AND row_id = $2 AND id <= $3",
        [c.table, c.rowId, c.jusquA],
      );
    }
  }
}

/**
 * Remet TOUTES les lignes synchronisables dans la file d'envoi.
 *
 * Sert à republier intégralement après une réinitialisation de mot de passe :
 * la copie cloud, scellée par une clé perdue, est effacée et reconstruite à
 * partir de celle-ci.
 *
 * ⚠️ La mise en file ne se fait PAS en insérant des entrées à la main dans
 * `sync_outbox` : on écrit `uid = uid`, une mise à jour sans effet qui déclenche
 * les triggers existants. Ils savent déjà quoi enregistrer, et resteront justes
 * si le schéma de la file change un jour — un remplissage manuel, lui, aurait
 * divergé en silence.
 *
 * Aucune colonne métier n'est touchée : pas d'`updated_at` faussé, et le
 * trigger FTS des notes ne se déclenche pas (il n'écoute que `title` et `body`).
 */
export async function toutRemettreEnFile(db: BaseLocale, tables: readonly string[]): Promise<void> {
  for (const table of tables) {
    const colonne = CLE_NATURELLE[table] ?? "uid";
    await db.execute(`UPDATE ${table} SET ${colonne} = ${colonne}`);
  }
}

export async function lireMeta(db: BaseLocale, cle: string): Promise<string | null> {
  const lignes = await db.select<{ v: string }>("SELECT v FROM sync_meta WHERE k = $1", [cle]);
  return lignes[0]?.v ?? null;
}

export async function ecrireMeta(db: BaseLocale, cle: string, valeur: string): Promise<void> {
  await db.execute(
    "INSERT INTO sync_meta (k, v) VALUES ($1, $2) ON CONFLICT(k) DO UPDATE SET v = $2",
    [cle, valeur],
  );
}

/**
 * Ce que le serveur détient, à notre connaissance.
 *
 * ⚠️ `device_id` FAIT PARTIE DE L'IDENTITÉ D'UNE VERSION, au même titre que
 * l'horodatage — c'est le couple complet sur lequel porte l'arbitrage. La
 * première version ne retenait que `remote_ts`, et deux appareils qui
 * écrivaient dans la même milliseconde divergeaient DÉFINITIVEMENT : le perdant
 * recevait la version du gagnant, reconnaissait « son » horodatage et gardait
 * sa propre version. Voir la migration 017.
 */
export interface EtatDistant {
  remote_ts: string;
  device_id: string | null;
  deleted: number;
}

export async function lireEtat(db: BaseLocale, table: string, uid: string): Promise<EtatDistant | null> {
  const lignes = await db.select<EtatDistant>(
    "SELECT remote_ts, device_id, deleted FROM sync_state WHERE table_name = $1 AND uid = $2",
    [table, uid],
  );
  return lignes[0] ?? null;
}

export async function noterEtat(
  db: BaseLocale,
  table: string,
  uid: string,
  remoteTs: string,
  deviceId: string,
  serverSeq: number | null,
  supprimee: boolean,
): Promise<void> {
  await db.execute(
    `INSERT INTO sync_state (table_name, uid, remote_ts, device_id, server_seq, deleted)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT(table_name, uid)
       DO UPDATE SET remote_ts = $3, device_id = $4, server_seq = $5, deleted = $6`,
    [table, uid, remoteTs, deviceId, serverSeq, supprimee ? 1 : 0],
  );
}

/** Deux versions sont-elles la même ? Horodatage ET auteur, jamais l'un seul. */
export function memeVersion(etat: EtatDistant | null, ts: string, device: string): boolean {
  return etat != null && etat.remote_ts === ts && etat.device_id === device;
}
