/**
 * La corbeille, côté SQL — prend la base EN PARAMÈTRE.
 *
 * ⭐ POURQUOI UN PARAMÈTRE ET PAS `getDb()`. Le même code tourne dans l'app (sur
 * la base Tauri) et dans les tests (sur une base `node:sqlite` montée avec les
 * VRAIES migrations). C'est le patron de `sync/local.ts`, pour la même raison :
 * une règle de données qu'on ne peut éprouver que dans l'app installée n'est
 * pas une règle, c'est un espoir.
 *
 * ⭐ LA RÈGLE DES LOTS N'EST PAS ICI, elle est dans `lots.ts`, pure, partagée
 * avec le mode démo. Ce module ne fait que LIRE les lignes, appeler cette
 * règle, et ÉCRIRE par identifiants. Voir l'en-tête de `lots.ts`.
 *
 * Il ne fait AUCUN `DELETE` : la suppression définitive passe par les fonctions
 * `delete*` existantes de `repo.ts`, qui connaissent déjà les cascades de
 * chaque objet (règle 18 — une seule fonction par geste).
 */

import { TABLE_DE, VIVANT, type KindCorbeille } from "./regles";
import {
  descendantsVivants,
  lotObjectif,
  ordreDePurge,
  planObjectif,
  planSimple,
  racinesDeLot,
  type LigneObjectif,
  type PlanRestauration,
} from "./lots";

export type { EtapeRestauration, PlanRestauration } from "./lots";

/** La forme de `Database` (`@tauri-apps/plugin-sql`) dont ce module a besoin. */
export interface BaseCorbeille {
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

/** Ce qu'une mise en corbeille a emporté. */
export interface Lot {
  /** L'horodatage commun du lot — son identité. */
  stamp: string;
  /** Les `id` mis en corbeille, la racine en premier. Vide si rien n'a bougé. */
  ids: number[];
}

/** Tous les objectifs, réduits à ce qu'il faut pour raisonner sur les lots. */
async function lignesObjectifs(db: BaseCorbeille): Promise<LigneObjectif[]> {
  return db.select<LigneObjectif[]>("SELECT id, parent_goal_id, deleted_at FROM goals");
}

const jokersDes = (ids: readonly number[], depuis: number) =>
  ids.map((_, i) => `$${i + depuis}`).join(", ");

// ─── Mettre en corbeille ─────────────────────────────────────────────────────

/**
 * Met un objet en corbeille, avec son lot.
 *
 * ⚠️ `stamp` est FOURNI par l'appelant, jamais calculé ici : c'est ce qui permet
 * à un test de fixer l'heure, et à l'appelant de reconnaître son lot ensuite
 * (le toast « Annuler » restaure exactement cet horodatage-là).
 *
 * Idempotent : un objet déjà en corbeille n'est pas re-daté — son lot d'origine
 * reste intact, et le décompte de ses 30 jours ne repart pas de zéro.
 *
 * ⚠️ UNE FACTURE ÉMISE N'ENTRE JAMAIS EN CORBEILLE (§ 5.6) : elle s'annule par un
 * AVOIR, son numéro est parti chez un client. Le refus est ici, dans la règle
 * de données, et pas seulement dans l'interface — un bouton peut être appelé
 * par erreur, une règle de dépôt non. C'est la posture de `deleteInvoice`.
 */
export async function mettreEnCorbeilleDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
  stamp: string,
): Promise<Lot> {
  const { table } = TABLE_DE[kind];
  let ids: number[];
  if (kind === "goal") {
    ids = descendantsVivants(await lignesObjectifs(db), id);
  } else {
    const garde = kind === "invoice" ? " AND statut = 'brouillon'" : "";
    ids = (
      await db.select<{ id: number }[]>(`SELECT id FROM ${table} WHERE id = $1 AND ${VIVANT}${garde}`, [id])
    ).map((r) => r.id);
  }
  if (ids.length === 0) return { stamp, ids: [] };

  await db.execute(`UPDATE ${table} SET deleted_at = $1 WHERE id IN (${jokersDes(ids, 2)}) AND ${VIVANT}`, [
    stamp,
    ...ids,
  ]);
  return { stamp, ids };
}

// ─── Restaurer ───────────────────────────────────────────────────────────────

/**
 * Ce que restaurer cet objet ramènera — SANS rien écrire.
 *
 * ⭐ Séparé de `restaurerDans` pour que l'interface puisse l'annoncer d'abord
 * (« Restaurer ce sous-objectif restaure aussi « Lancer la chaîne » et ses
 * 4 éléments »), puis exécuter exactement ce qu'elle a annoncé.
 *
 * Rend `null` si l'objet n'est pas en corbeille (déjà restauré ailleurs, par la
 * synchronisation) : il n'y a rien à faire, et ce n'est pas une erreur.
 */
export async function planRestaurationDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
): Promise<PlanRestauration | null> {
  if (kind === "goal") return planObjectif(await lignesObjectifs(db), id);
  const { table } = TABLE_DE[kind];
  const ligne = (
    await db.select<{ deleted_at: string | null }[]>(`SELECT deleted_at FROM ${table} WHERE id = $1`, [id])
  )[0];
  return planSimple(kind, id, ligne?.deleted_at ?? null);
}

/**
 * Restaure un objet — et, pour un objectif, son lot et ses ancêtres en
 * corbeille. Rend le plan exécuté, ou `null` s'il n'y avait rien à faire.
 *
 * ⚠️⚠️ CHAQUE ÉCRITURE EXIGE ENCORE `deleted_at = stamp` : entre le plan et
 * l'écriture, la synchronisation peut avoir RE-JETÉ l'objet depuis un autre
 * appareil, avec un autre horodatage. Restaurer quand même effacerait ce geste
 * plus récent sans que personne le voie. Un test provoque cette course.
 */
export async function restaurerDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
): Promise<PlanRestauration | null> {
  const plan = await planRestaurationDans(db, kind, id);
  if (!plan) return null;
  const { table } = TABLE_DE[kind];
  const lignes = kind === "goal" ? await lignesObjectifs(db) : [];

  for (const etape of plan.etapes) {
    const ids = kind === "goal" ? lotObjectif(lignes, etape.id, etape.stamp) : [etape.id];
    if (ids.length === 0) continue;
    await db.execute(
      `UPDATE ${table} SET deleted_at = NULL WHERE id IN (${jokersDes(ids, 2)}) AND deleted_at = $1`,
      [etape.stamp, ...ids],
    );
  }
  return plan;
}

// ─── Lire la corbeille ───────────────────────────────────────────────────────

/** Un élément tel que la vue « Supprimés récemment » le montre. */
export interface ElementCorbeille {
  kind: KindCorbeille;
  id: number;
  uid: string | null;
  /** Brut, tel qu'en base. Peut être vide (un brouillon sans objet). */
  titre: string | null;
  deleted_at: string;
  /**
   * Combien d'objets partiraient ou reviendraient AVEC lui, lui compris.
   * Toujours 1, sauf pour un objectif qui a emporté ses phases.
   */
  taille: number;
}

/** Tout ce qui est en corbeille, le plus récent d'abord ; un lot par sa racine. */
export async function lireCorbeilleDans(db: BaseCorbeille): Promise<ElementCorbeille[]> {
  const out: ElementCorbeille[] = [];
  for (const kind of Object.keys(TABLE_DE) as KindCorbeille[]) {
    const { table, titre } = TABLE_DE[kind];
    const rows = await db.select<{ id: number; uid: string | null; titre: unknown; deleted_at: string }[]>(
      `SELECT id, uid, ${titre} AS titre, deleted_at FROM ${table} WHERE deleted_at IS NOT NULL`,
    );
    const tailles =
      kind === "goal" ? new Map(racinesDeLot(await lignesObjectifs(db)).map((r) => [r.id, r.taille])) : null;
    for (const r of rows) {
      const taille = tailles ? tailles.get(r.id) : 1;
      if (taille == null) continue; // dans le lot de son parent
      out.push({
        kind,
        id: r.id,
        uid: r.uid,
        titre: r.titre == null ? null : String(r.titre),
        deleted_at: r.deleted_at,
        taille,
      });
    }
  }
  return out.sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : a.deleted_at > b.deleted_at ? -1 : 0));
}

// ─── Ce qu'il faut purger ────────────────────────────────────────────────────

/** Un objet à supprimer pour de bon, dans l'ordre où il faut le faire. */
export interface APurger {
  kind: KindCorbeille;
  id: number;
}

/**
 * Tous les objets mis en corbeille AVANT `seuil`, dans l'ordre de suppression.
 * Les objectifs, du plus profond au plus haut (voir `lots.ts`).
 */
export async function aPurgerDans(db: BaseCorbeille, seuil: string): Promise<APurger[]> {
  const out: APurger[] = [];
  for (const kind of Object.keys(TABLE_DE) as KindCorbeille[]) {
    const { table } = TABLE_DE[kind];
    if (kind === "goal") {
      const perimes = await db.select<LigneObjectif[]>(
        "SELECT id, parent_goal_id, deleted_at FROM goals WHERE deleted_at IS NOT NULL AND deleted_at <= $1",
        [seuil],
      );
      ordreDePurge(perimes).forEach((id) => out.push({ kind, id }));
      continue;
    }
    const rows = await db.select<{ id: number }[]>(
      `SELECT id FROM ${table} WHERE deleted_at IS NOT NULL AND deleted_at <= $1`,
      [seuil],
    );
    rows.forEach((r) => out.push({ kind, id: r.id }));
  }
  return out;
}

/**
 * Le lot d'un objet en corbeille, dans l'ordre de suppression définitive.
 * Sert à « Supprimer définitivement » un élément de la vue.
 */
export async function lotAPurgerDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
): Promise<APurger[]> {
  const { table } = TABLE_DE[kind];
  const ligne = (
    await db.select<{ deleted_at: string | null }[]>(`SELECT deleted_at FROM ${table} WHERE id = $1`, [id])
  )[0];
  // ⚠️ Jamais un objet VIVANT : la suppression définitive ne s'applique qu'à ce
  // qui est déjà en corbeille. Sans cette garde, un appel mal aiguillé
  // effacerait pour de bon un objet que personne n'avait jeté.
  if (!ligne?.deleted_at) return [];
  if (kind !== "goal") return [{ kind, id }];

  const lignes = await lignesObjectifs(db);
  const lot = new Set(lotObjectif(lignes, id, ligne.deleted_at));
  return ordreDePurge(lignes.filter((l) => lot.has(l.id))).map((x) => ({ kind, id: x }));
}
