import { estTableSync, settingSynchronisable, TABLES_SYNC } from "./scope";

/**
 * Lecture et regroupement du journal de changements.
 *
 * Tout ce qui est ici est PUR : des entrées en entrée, des changements à
 * envoyer en sortie. Aucun accès base, aucun réseau — donc entièrement
 * testable, ce qui est le minimum pour la pièce dont dépend l'intégrité des
 * données.
 */

/** Une ligne de `sync_outbox`, telle qu'écrite par les triggers. */
export interface EntreeOutbox {
  id: number;
  table_name: string;
  /** rowid local. `null` sur une suppression : la ligne n'existe plus. */
  row_id: number | null;
  /** Identifiant global. Peut être `null` sur une création — voir plus bas. */
  uid: string | null;
  op: "upsert" | "delete";
  /** UTC, `2026-08-02T20:44:33.123Z`. */
  ts: string;
}

/** Une entité à envoyer, après regroupement de toutes ses écritures. */
export interface ChangementEnAttente {
  table: string;
  op: "upsert" | "delete";
  /** `null` pour une suppression. */
  rowId: number | null;
  /**
   * `null` possible pour un 'upsert' : le trigger de création peut passer avant
   * celui qui pose l'uid. Il sera résolu en relisant la ligne au moment de
   * l'envoi. TOUJOURS renseigné pour un 'delete'.
   */
  uid: string | null;
  /** Horodatage de l'écriture la plus RÉCENTE — c'est lui qui arbitre le LWW. */
  ts: string;
  /** Plus grand `id` d'entrée regroupé : borne de purge après un envoi réussi. */
  jusquA: number;
}

/**
 * Identité d'une entité dans la file.
 *
 * Les 'upsert' sont regroupés par ROWID et non par uid, parce que l'uid peut
 * manquer sur l'entrée de création (cf. `EntreeOutbox.uid`) : regrouper par uid
 * ferait de la création et de la modification suivante deux entités distinctes,
 * et la même ligne partirait deux fois.
 *
 * Les 'delete' n'ont plus de rowid — leur identité est leur uid, seule chose
 * qui survive à la ligne.
 */
function cle(e: EntreeOutbox): string {
  return e.op === "delete" ? `${e.table_name}!${e.uid}` : `${e.table_name}#${e.row_id}`;
}

const RANG_TABLE = new Map<string, number>(TABLES_SYNC.map((t, i) => [t, i]));

/**
 * Regroupe la file en une entité par ligne modifiée, la dernière écriture
 * l'emportant. Modifier vingt fois la même note donne donc un seul envoi.
 *
 * Le résultat est trié dans l'ordre d'APPLICATION : les tables parentes avant
 * les filles (l'ordre de `TABLES_SYNC`), puis par ancienneté. Envoyer « la
 * coche de l'habitude X » avant l'habitude X elle-même laisserait une ligne
 * orpheline chez le destinataire.
 */
export function regrouper(entrees: readonly EntreeOutbox[]): ChangementEnAttente[] {
  const parEntite = new Map<string, ChangementEnAttente>();

  // Les entrées sont supposées ordonnées par `id` croissant (= chronologique).
  // On ne se repose pas dessus pour `ts`/`op` — c'est l'horodatage qui tranche,
  // pas l'ordre de lecture — mais `jusquA` doit bien être le maximum vu.
  for (const e of entrees) {
    const k = cle(e);
    const dejaLa = parEntite.get(k);

    if (!dejaLa) {
      parEntite.set(k, {
        table: e.table_name,
        op: e.op,
        rowId: e.row_id,
        uid: e.uid,
        ts: e.ts,
        jusquA: e.id,
      });
      continue;
    }

    dejaLa.jusquA = Math.max(dejaLa.jusquA, e.id);
    // Un uid connu ne doit jamais être reperdu au profit du `null` d'une
    // entrée de création plus ancienne.
    if (e.uid) dejaLa.uid = e.uid;
    if (e.ts >= dejaLa.ts) {
      dejaLa.ts = e.ts;
      dejaLa.op = e.op;
      if (e.op === "upsert") dejaLa.rowId = e.row_id;
    }
  }

  return [...parEntite.values()].sort((a, b) => {
    const rangA = RANG_TABLE.get(a.table) ?? Number.MAX_SAFE_INTEGER;
    const rangB = RANG_TABLE.get(b.table) ?? Number.MAX_SAFE_INTEGER;
    return rangA !== rangB ? rangA - rangB : a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0;
  });
}

/**
 * Ce changement doit-il partir dans le cloud ?
 *
 * Deux motifs de refus, et un seul est un choix : une table hors périmètre
 * (index dérivé, plomberie) ne PEUT pas être synchronisée ; une clé de réglage
 * propre à l'appareil ne DOIT pas l'être.
 */
export function aEnvoyer(c: ChangementEnAttente): boolean {
  if (!estTableSync(c.table)) return false;
  if (c.table !== "settings") return true;

  // L'uid d'un réglage vaut `st:<clé>` — la décision se prend donc sans lire
  // la base. Un uid absent (cas théorique) est refusé : on ne devine pas.
  if (!c.uid?.startsWith("st:")) return false;
  return settingSynchronisable(c.uid.slice(3));
}

/**
 * Changements réellement en partance, écartés compris purgés.
 * `aPurger` liste les entrées à supprimer sans les envoyer — sinon la file
 * enflerait indéfiniment d'entrées qui ne partiront jamais.
 */
export function aTraiter(entrees: readonly EntreeOutbox[]): {
  aPousser: ChangementEnAttente[];
  aPurger: ChangementEnAttente[];
} {
  const aPousser: ChangementEnAttente[] = [];
  const aPurger: ChangementEnAttente[] = [];
  for (const c of regrouper(entrees)) (aEnvoyer(c) ? aPousser : aPurger).push(c);
  return { aPousser, aPurger };
}

/**
 * Nombre d'éléments en attente, tel que l'affichera l'indicateur d'état.
 *
 * Compte des ENTITÉS, pas des écritures : trois notes modifiées vingt fois
 * chacune affichent « 3 en attente », et non « 60 ». Les entrées qui ne
 * partiront jamais ne sont pas comptées — annoncer un retard qui ne se
 * résorbera pas serait mentir à l'utilisateur.
 */
export function nombreEnAttente(entrees: readonly EntreeOutbox[]): number {
  return aTraiter(entrees).aPousser.length;
}
