/**
 * La corbeille, côté SQL — prend la base EN PARAMÈTRE.
 *
 * ⭐ POURQUOI UN PARAMÈTRE ET PAS `getDb()`. Le même code tourne dans l'app (sur
 * la base Tauri) et dans les tests (sur une base `node:sqlite` montée avec les
 * VRAIES migrations). C'est le patron de `sync/local.ts`, pour la même raison :
 * une règle de données qu'on ne peut éprouver que dans l'app installée n'est
 * pas une règle, c'est un espoir.
 *
 * Ce module fait les écritures DOUCES (mettre en corbeille, restaurer) et les
 * LECTURES de la corbeille. Il ne fait AUCUN `DELETE` : la suppression
 * définitive passe par les fonctions `delete*` existantes de `repo.ts`, qui
 * connaissent déjà les cascades de chaque objet (règle 18 du chantier — une
 * seule fonction par geste, jamais une réimplémentation).
 */

import { TABLE_DE, VIVANT, type KindCorbeille } from "./regles";

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

// ─── Mettre en corbeille ─────────────────────────────────────────────────────

/*
 * ⚠️⚠️ `UNION`, JAMAIS `UNION ALL`, dans les deux requêtes récursives du module.
 *
 * LE DÉFAUT PAYÉ (2026-09-22, en test). Avec `UNION ALL`, une boucle dans
 * `parent_goal_id` (A parent de B, B parent de A) fait tourner la récursion à
 * l'infini : la mémoire monte, le processus MEURT. Une telle boucle ne devrait
 * pas exister, mais une synchronisation interrompue peut en fabriquer une — et
 * dans l'app, ouvrir la corbeille aurait figé Shale sans un mot. `UNION` écarte
 * les lignes déjà produites : sur un cycle, il n'en reste plus de neuve, et la
 * récursion s'arrête. Voir `PIEGES.md` § 19.
 */

/**
 * Les `id` d'un objectif et de TOUS ses descendants VIVANTS.
 *
 * ⚠️ « Vivants » est le point important : un sous-objectif jeté la veille, pour
 * son compte, n'entre pas dans le lot de son parent. Il garde son propre
 * horodatage, et restaurer le parent ne le ramènera pas — ce qui est la seule
 * chose honnête : on ne ressuscite pas ce que l'utilisateur avait jeté exprès.
 */
async function descendantsVivants(db: BaseCorbeille, racine: number): Promise<number[]> {
  const rows = await db.select<{ id: number }[]>(
    `WITH RECURSIVE lot(id) AS (
       SELECT id FROM goals WHERE id = $1 AND ${VIVANT}
       UNION
       SELECT g.id FROM goals g JOIN lot ON g.parent_goal_id = lot.id WHERE g.${VIVANT}
     )
     SELECT id FROM lot`,
    [racine],
  );
  return rows.map((r) => r.id);
}

/**
 * Met un objet en corbeille, avec son lot.
 *
 * ⚠️ `stamp` est FOURNI par l'appelant, jamais calculé ici : c'est ce qui permet
 * à un test de fixer l'heure, et à l'appelant de reconnaître son lot ensuite
 * (le toast « Annuler » restaure exactement cet horodatage-là).
 *
 * Idempotent : un objet déjà en corbeille n'est pas re-daté — son lot d'origine
 * reste intact, et le décompte de ses 30 jours ne repart pas de zéro.
 */
export async function mettreEnCorbeilleDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
  stamp: string,
): Promise<Lot> {
  const { table } = TABLE_DE[kind];
  const ids =
    kind === "goal"
      ? await descendantsVivants(db, id)
      : (await db.select<{ id: number }[]>(`SELECT id FROM ${table} WHERE id = $1 AND ${VIVANT}`, [id])).map(
          (r) => r.id,
        );
  if (ids.length === 0) return { stamp, ids: [] };

  const jokers = ids.map((_, i) => `$${i + 2}`).join(", ");
  await db.execute(`UPDATE ${table} SET deleted_at = $1 WHERE id IN (${jokers}) AND ${VIVANT}`, [
    stamp,
    ...ids,
  ]);
  return { stamp, ids };
}

// ─── Restaurer ───────────────────────────────────────────────────────────────

interface LigneCorbeille {
  id: number;
  deleted_at: string | null;
  parent_goal_id?: number | null;
}

/** Les `id` du lot auquel appartient cet objectif en corbeille, racine comprise. */
async function lotObjectif(db: BaseCorbeille, racine: number, stamp: string): Promise<number[]> {
  const rows = await db.select<{ id: number }[]>(
    `WITH RECURSIVE lot(id) AS (
       SELECT id FROM goals WHERE id = $1 AND deleted_at = $2
       UNION
       SELECT g.id FROM goals g JOIN lot ON g.parent_goal_id = lot.id WHERE g.deleted_at = $2
     )
     SELECT id FROM lot`,
    [racine, stamp],
  );
  return rows.map((r) => r.id);
}

/** Une étape de restauration : un lot, désigné par sa racine et son horodatage. */
export interface EtapeRestauration {
  id: number;
  stamp: string;
  /** Combien d'objets ce lot ramène, racine comprise. */
  taille: number;
}

export interface PlanRestauration {
  kind: KindCorbeille;
  /** Dans l'ordre d'exécution : les ancêtres d'abord, l'objet demandé en dernier. */
  etapes: EtapeRestauration[];
  /**
   * VRAI si restaurer cet objet oblige à restaurer aussi un parent en
   * corbeille. L'interface doit le DIRE avant d'agir (cahier des charges,
   * § 5.4) : on ne ressuscite pas un objectif sans prévenir.
   */
  remonte: boolean;
  /** Le total d'objets qui reviendront. */
  total: number;
}

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
  const { table } = TABLE_DE[kind];
  const colonnes = kind === "goal" ? "id, deleted_at, parent_goal_id" : "id, deleted_at";
  const lire = async (x: number) =>
    (await db.select<LigneCorbeille[]>(`SELECT ${colonnes} FROM ${table} WHERE id = $1`, [x]))[0];

  const cible = await lire(id);
  if (!cible?.deleted_at) return null;

  if (kind !== "goal") {
    return { kind, etapes: [{ id, stamp: cible.deleted_at, taille: 1 }], remonte: false, total: 1 };
  }

  // Remonter la chaîne des ancêtres EN CORBEILLE. Un parent vivant arrête la
  // remontée : l'objectif revient sous lui, à sa place.
  const chaine: LigneCorbeille[] = [cible];
  const vus = new Set<number>([cible.id]);
  let courant = cible;
  while (courant.parent_goal_id != null) {
    const parent = await lire(courant.parent_goal_id);
    // ⚠️ Garde contre une boucle dans `parent_goal_id` : elle ne devrait pas
    // exister, mais une synchronisation interrompue peut en fabriquer une, et
    // une boucle ici bloquerait l'app sans un mot.
    if (!parent?.deleted_at || vus.has(parent.id)) break;
    chaine.push(parent);
    vus.add(parent.id);
    courant = parent;
  }

  // Les ancêtres d'abord (du plus haut au plus bas), puis l'objet — en
  // sautant un lot déjà couvert par une étape précédente : un sous-objectif
  // jeté AVEC son parent revient avec lui, pas une deuxième fois.
  const etapes: EtapeRestauration[] = [];
  const couverts = new Set<number>();
  for (const maillon of chaine.reverse()) {
    if (couverts.has(maillon.id)) continue;
    const ids = await lotObjectif(db, maillon.id, maillon.deleted_at!);
    ids.forEach((x) => couverts.add(x));
    etapes.push({ id: maillon.id, stamp: maillon.deleted_at!, taille: ids.length });
  }

  return {
    kind,
    etapes,
    remonte: chaine.length > 1,
    total: etapes.reduce((s, e) => s + e.taille, 0),
  };
}

/**
 * Restaure un objet — et, pour un objectif, son lot et ses ancêtres en
 * corbeille. Rend le plan exécuté, ou `null` s'il n'y avait rien à faire.
 *
 * ⚠️ Chaque étape ne relève QUE les lignes portant l'horodatage de son lot
 * (`deleted_at = stamp`) : un enfant jeté pour son compte, à un autre instant,
 * reste en corbeille. C'est le cœur de la promesse « restaurer le lot, jamais
 * ce qui avait été jeté avant ».
 */
export async function restaurerDans(
  db: BaseCorbeille,
  kind: KindCorbeille,
  id: number,
): Promise<PlanRestauration | null> {
  const plan = await planRestaurationDans(db, kind, id);
  if (!plan) return null;
  const { table } = TABLE_DE[kind];

  for (const etape of plan.etapes) {
    const ids = kind === "goal" ? await lotObjectif(db, etape.id, etape.stamp) : [etape.id];
    if (ids.length === 0) continue;
    const jokers = ids.map((_, i) => `$${i + 2}`).join(", ");
    await db.execute(
      `UPDATE ${table} SET deleted_at = NULL WHERE id IN (${jokers}) AND deleted_at = $1`,
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
  /** Brut, tel qu'en base. Peut être vide (un brouillon de facture n'a pas de numéro). */
  titre: string | null;
  deleted_at: string;
  /**
   * Combien d'objets partiraient ou reviendraient AVEC lui, lui compris.
   * Toujours 1, sauf pour un objectif qui a emporté ses phases.
   */
  taille: number;
}

/**
 * Tout ce qui est en corbeille, le plus récent d'abord.
 *
 * ⚠️ UN LOT S'AFFICHE PAR SA RACINE. Un sous-objectif jeté AVEC son objectif
 * n'apparaît pas à part : il est « dans » son parent, et le compte `taille` le
 * dit. Le montrer deux fois ferait croire qu'on peut le restaurer seul sans
 * conséquence — alors que le restaurer remonte au parent.
 */
export async function lireCorbeilleDans(db: BaseCorbeille): Promise<ElementCorbeille[]> {
  const out: ElementCorbeille[] = [];
  for (const kind of Object.keys(TABLE_DE) as KindCorbeille[]) {
    const { table, titre } = TABLE_DE[kind];
    if (kind === "goal") {
      const rows = await db.select<
        { id: number; uid: string | null; titre: string | null; deleted_at: string; parent_goal_id: number | null; parent_stamp: string | null }[]
      >(
        `SELECT g.id, g.uid, g.title AS titre, g.deleted_at, g.parent_goal_id, p.deleted_at AS parent_stamp
           FROM goals g LEFT JOIN goals p ON p.id = g.parent_goal_id
          WHERE g.deleted_at IS NOT NULL`,
      );
      for (const r of rows) {
        // Racine d'un lot = son parent n'est pas dans le MÊME lot.
        if (r.parent_stamp != null && r.parent_stamp === r.deleted_at) continue;
        const taille = (await lotObjectif(db, r.id, r.deleted_at)).length;
        out.push({ kind, id: r.id, uid: r.uid, titre: r.titre, deleted_at: r.deleted_at, taille });
      }
      continue;
    }
    const rows = await db.select<{ id: number; uid: string | null; titre: string | null; deleted_at: string }[]>(
      `SELECT id, uid, ${titre} AS titre, deleted_at FROM ${table} WHERE deleted_at IS NOT NULL`,
    );
    for (const r of rows) out.push({ kind, ...r, titre: r.titre == null ? null : String(r.titre), taille: 1 });
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
 *
 * ⚠️ L'ORDRE COMPTE POUR LES OBJECTIFS : les plus profonds d'abord. Supprimer
 * un parent avant ses enfants ferait remonter ceux-ci d'un niveau
 * (`deleteGoal` rattache les enfants au grand-parent) — ils deviendraient des
 * objectifs VIVANTS, surgis de nulle part, alors qu'ils devaient partir avec
 * lui. Les tables de feuilles (coches, relevés, lignes de facture) sont
 * vidées par les fonctions `delete*` elles-mêmes.
 */
export async function aPurgerDans(db: BaseCorbeille, seuil: string): Promise<APurger[]> {
  const out: APurger[] = [];
  for (const kind of Object.keys(TABLE_DE) as KindCorbeille[]) {
    const { table } = TABLE_DE[kind];
    if (kind === "goal") {
      const rows = await db.select<{ id: number; parent_goal_id: number | null }[]>(
        `SELECT id, parent_goal_id FROM goals WHERE deleted_at IS NOT NULL AND deleted_at <= $1`,
        [seuil],
      );
      const parents = new Map(rows.map((r) => [r.id, r.parent_goal_id]));
      const profondeur = (x: number): number => {
        let d = 0;
        const vus = new Set<number>();
        let p = parents.get(x) ?? null;
        while (p != null && parents.has(p) && !vus.has(p)) {
          vus.add(p);
          d++;
          p = parents.get(p) ?? null;
        }
        return d;
      };
      rows
        .map((r) => ({ id: r.id, d: profondeur(r.id) }))
        .sort((a, b) => b.d - a.d)
        .forEach((r) => out.push({ kind, id: r.id }));
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
 * Le lot d'un objet en corbeille, dans l'ordre de suppression définitive
 * (les plus profonds d'abord). Sert à « Supprimer définitivement » un élément
 * de la vue : on emporte tout ce qu'il contient.
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

  const ids = await lotObjectif(db, id, ligne.deleted_at);
  // L'ordre de `WITH RECURSIVE` va du parent vers les enfants : on l'inverse.
  return ids.reverse().map((x) => ({ kind, id: x }));
}
