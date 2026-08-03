/**
 * Traduction des clés étrangères — le maillon qu'on oublie toujours.
 *
 * LE PROBLÈME. `tasks.goal_id` vaut `7` sur cet appareil. Sur l'autre, l'objectif
 * correspondant porte peut-être le numéro `3`, et le numéro `7` désigne autre
 * chose. Envoyer `goal_id: 7` tel quel ne rattacherait donc pas la tâche au bon
 * objectif : il la rattacherait à un objectif AU HASARD. Et ça ne planterait
 * pas — ça produirait des données silencieusement fausses, ce qui est pire.
 *
 * LA RÈGLE. Ce qui voyage, ce sont les `uid` ; les `id` locaux ne quittent
 * jamais la machine. À l'envoi, `goal_id: 7` devient `goal_uid: "6a26…"` ; à la
 * réception, on refait le chemin inverse avec les numéros de l'appareil
 * d'arrivée.
 *
 * ⚠️ `tasks.tag` N'EST PAS ICI, et c'est volontaire : cette colonne stocke le
 * NOM du tag, pas son identifiant (c'est ainsi dans l'app depuis toujours —
 * `addTag` fait un upsert sur `name`, `deleteTag` remet `tag = NULL`). Le nom a
 * déjà le même sens partout : il voyage tel quel. C'est aussi pour cela que
 * l'uid d'un tag est dérivé de son nom (migration 015).
 */

export interface CleEtrangere {
  /** Colonne locale, ex. `goal_id`. */
  colonne: string;
  /** Table pointée, ex. `goals`. */
  vers: string;
}

/** Nom de la colonne telle qu'elle voyage : `goal_id` → `goal_uid`. */
export function colonneUid(colonne: string): string {
  return colonne.replace(/_id$/, "_uid");
}

/**
 * Toutes les clés étrangères des tables synchronisées.
 *
 * ⚠️ Une clé oubliée ici ne fait pas échouer la synchronisation : elle fait
 * voyager un numéro local, qui désignera n'importe quoi à l'arrivée. Un test
 * compare donc cette table au schéma réel (`PRAGMA foreign_key_list`) et
 * échoue si une colonne manque.
 */
export const CLES_ETRANGERES: Readonly<Record<string, readonly CleEtrangere[]>> = {
  tasks: [{ colonne: "goal_id", vers: "goals" }],
  // Un objectif peut être l'enfant d'un autre : la référence pointe sur sa
  // propre table. À l'application, le parent peut ne pas être encore arrivé —
  // c'est le cas que la mise en quarantaine du moteur couvre.
  goals: [{ colonne: "parent_goal_id", vers: "goals" }],
  task_completions: [{ colonne: "task_id", vers: "tasks" }],
  habit_checks: [{ colonne: "habit_id", vers: "habits" }],
  metric_entries: [{ colonne: "metric_id", vers: "custom_metrics" }],
  focus_sessions: [{ colonne: "task_id", vers: "tasks" }],
  knowledge_entries: [{ colonne: "topic_id", vers: "knowledge_topics" }],
  live_positions: [
    { colonne: "sizing_calc_id", vers: "position_size_calculations" },
    { colonne: "trade_id", vers: "trades" },
  ],
};

export function clesDe(table: string): readonly CleEtrangere[] {
  return CLES_ETRANGERES[table] ?? [];
}

/**
 * Colonnes qui ne voyagent JAMAIS.
 * `id` est le numéro local, remplacé par `uid`. Les colonnes de clé étrangère
 * sont retirées puis réémises en `_uid` par la sérialisation.
 */
export function colonnesLocales(table: string): Set<string> {
  return new Set(["id", ...clesDe(table).map((c) => c.colonne)]);
}
