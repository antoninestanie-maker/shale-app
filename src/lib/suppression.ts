/**
 * Ce qu'il faut DÉFAIRE avant d'effacer une ligne pour de bon — prend la base
 * EN PARAMÈTRE (patron de `corbeille/base.ts` : le même code tourne dans l'app
 * et sur une vraie base SQLite en test).
 *
 * ⚠️⚠️ LA BASE APPLIQUE LES CLÉS ÉTRANGÈRES. `tauri-plugin-sql` ouvre SQLite par
 * `sqlx`, et `sqlx` pose `PRAGMA foreign_keys = ON` d'office
 * (`sqlx-sqlite/src/options/mod.rs` : « We choose to enable foreign key
 * enforcement by default »). Un commentaire de `repo.ts` a dit le contraire
 * pendant des mois. Conséquence : un `DELETE` sur une ligne encore citée par
 * une autre échoue (« FOREIGN KEY constraint failed »), et aucun `ON DELETE`
 * n'est déclaré dans le schéma — chaque suppression doit donc défaire elle-même
 * ce qui pend sous la ligne.
 *
 * Trouvé le 2026-10-12 (Antonin : « certains items ne se suppriment pas dans
 * Supprimés récemment, et Tout supprimer ne marche pas tout le temps »). Deux
 * tables n'étaient défaites par personne :
 *   • `goal_progress_log` — une ligne par objectif et par jour de lancement
 *     (`snapshotGoals`) : tout objectif qui a vécu un jour était ineffaçable ;
 *   • `focus_sessions` — une tâche chronométrée une fois était ineffaçable.
 *
 * ⭐ UNE SEULE TABLE DE VÉRITÉ, lue par deux appelants :
 *   • les fonctions `delete*` de `repo.ts` (suppression définitive, purge) ;
 *   • `supprimerLigne` de `sync/local.ts` — une pierre tombale REÇUE fait le
 *     même `DELETE`, sur un appareil qui a ses propres lignes rangées dessous
 *     (son historique local, ses coches pas encore reçues en pierres tombales).
 *     Sans cela, vider la corbeille ici arrêtait la synchronisation là-bas.
 *
 * `suppression.test.ts` compare cette table au schéma réel
 * (`PRAGMA foreign_key_list`) : une clé étrangère ajoutée par une migration et
 * oubliée ici fait échouer la suite.
 */

/** Le strict nécessaire : ce module n'écrit que des requêtes sans retour. */
export interface BaseSuppression {
  execute(sql: string, params?: unknown[]): Promise<unknown>;
}

export interface Dependant {
  /** La table qui cite la ligne à effacer. */
  table: string;
  /** Sa colonne de clé étrangère. */
  colonne: string;
  /**
   * • `effacer`  — la ligne citante n'a pas de sens sans son parent (une coche,
   *                un relevé, une ligne de facture) ;
   * • `detacher` — elle survit, sa référence passe à NULL ;
   * • `remonter` — (objectifs) l'enfant prend le parent de la ligne effacée.
   */
  geste: "effacer" | "detacher" | "remonter";
  /** Pour `detacher` : une affectation de plus, écrite avec `$1` = l'id effacé. */
  enPlus?: string;
}

/**
 * Par table PARENTE : ce qui la cite, dans l'ordre où il faut le défaire.
 *
 * ⚠️ Constante de module, sans texte affiché.
 */
export const DEPENDANTS: Readonly<Record<string, readonly Dependant[]>> = {
  goals: [
    // Les enfants remontent vers le grand-parent, les tâches sont déliées :
    // c'est ce que `deleteGoal` a toujours fait.
    { table: "goals", colonne: "parent_goal_id", geste: "remonter" },
    { table: "tasks", colonne: "goal_id", geste: "detacher" },
    // L'historique de SA progression n'a pas de sens sans lui. Table locale,
    // hors synchronisation : chaque appareil efface le sien.
    { table: "goal_progress_log", colonne: "goal_id", geste: "effacer" },
  ],
  tasks: [
    { table: "task_completions", colonne: "task_id", geste: "effacer" },
    // ⭐ Le temps passé RESTE : il nourrit le Timer et Performance. La séance
    // garde le nom de la tâche, qu'elle n'a plus d'autre moyen de retrouver.
    {
      table: "focus_sessions",
      colonne: "task_id",
      geste: "detacher",
      enPlus: "label = COALESCE(label, (SELECT label FROM tasks WHERE id = $1))",
    },
  ],
  habits: [{ table: "habit_checks", colonne: "habit_id", geste: "effacer" }],
  custom_metrics: [{ table: "metric_entries", colonne: "metric_id", geste: "effacer" }],
  // Les fiches ne partent JAMAIS avec leur sujet : elles passent « non classées ».
  knowledge_topics: [{ table: "knowledge_entries", colonne: "topic_id", geste: "detacher" }],
  // Supprimer un type DÉTYPE ses sujets (migration 022, § 5).
  object_types: [{ table: "knowledge_topics", colonne: "type_id", geste: "detacher" }],
  finance_accounts: [
    { table: "finance_balances", colonne: "account_id", geste: "effacer" },
    { table: "finance_holdings", colonne: "account_id", geste: "effacer" },
    { table: "finance_recurring", colonne: "account_id", geste: "detacher" },
    // Le paiement a eu lieu : seul le compte crédité devient inconnu (023).
    { table: "invoice_payments", colonne: "account_id", geste: "detacher" },
  ],
  finance_categories: [{ table: "finance_recurring", colonne: "category_id", geste: "detacher" }],
  invoices: [
    { table: "invoice_lines", colonne: "invoice_id", geste: "effacer" },
    { table: "invoice_payments", colonne: "invoice_id", geste: "effacer" },
    { table: "invoices", colonne: "avoir_de_id", geste: "detacher" },
    { table: "invoices", colonne: "devis_origine_id", geste: "detacher" },
  ],
};

/**
 * Les clés étrangères qu'on ne défait PAS, exprès : la ligne parente ne
 * s'efface que si plus rien ne la cite (`deleteInvoiceParty`,
 * `deleteInvoiceSeries` le vérifient avant). Une facture ne perd ni son client
 * ni sa série parce que quelqu'un a cliqué « supprimer ».
 */
export const GARDES_PAR_REFUS: readonly { table: string; colonne: string; vers: string }[] = [
  { table: "invoices", colonne: "party_id", vers: "invoice_parties" },
  { table: "invoices", colonne: "serie_id", vers: "invoice_series" },
];

function requeteDe(parent: string, d: Dependant): string {
  switch (d.geste) {
    case "effacer":
      return `DELETE FROM ${d.table} WHERE ${d.colonne} = $1`;
    case "detacher":
      return `UPDATE ${d.table} SET ${d.enPlus ? `${d.enPlus}, ` : ""}${d.colonne} = NULL WHERE ${d.colonne} = $1`;
    case "remonter":
      // Le parent est lu EN BASE, pas dans l'objet que tient l'appelant : en
      // mémoire, une étape dont le parent est en corbeille se lit « sans
      // parent » (`corbeille/orphelins.ts`).
      return `UPDATE ${d.table} SET ${d.colonne} = (SELECT ${d.colonne} FROM ${parent} WHERE id = $1) WHERE ${d.colonne} = $1`;
  }
}

/** Défait tout ce qui cite la ligne `id` de `table`. Sans effet pour une table sans dépendants. */
export async function libererDependants(db: BaseSuppression, table: string, id: number): Promise<void> {
  for (const d of DEPENDANTS[table] ?? []) await db.execute(requeteDe(table, d), [id]);
}

/** Efface la ligne `id` de `table`, après avoir défait ce qui la cite. */
export async function effacerLigne(db: BaseSuppression, table: string, id: number): Promise<void> {
  await libererDependants(db, table, id);
  await db.execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
}
