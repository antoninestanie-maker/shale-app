/**
 * Ce qui reste VIVANT mais pointe vers un objet EN CORBEILLE.
 *
 * Une tâche rattachée à un objectif jeté n'a pas été jetée avec lui : ce n'est
 * pas son enfant (cahier des charges, § 7 — seules les phases et les
 * sous-objectifs partent en lot). Elle reste, et la base garde son `goal_id`
 * INTACT : c'est ce qui permet à la restauration de l'objectif de la lui rendre.
 *
 * Mais tant que l'objectif est en corbeille, l'écran ne doit pas chercher un
 * objectif absent de sa liste — au mieux un nom vide, au pire une exception.
 * Ces fonctions font donc LIRE la tâche « sans objectif », exactement comme la
 * lisait l'ancienne suppression, qui mettait `goal_id` à NULL pour de bon.
 *
 * ⚠️⚠️ ELLES RENDENT DE NOUVEAUX OBJETS ET NE MODIFIENT RIEN EN PLACE. En mode
 * démo, les lignes rendues sont les objets MÊMES du magasin en mémoire : les
 * muter effacerait le rattachement pour de bon, et la restauration de
 * l'objectif ne retrouverait plus sa tâche. Un test y veille.
 *
 * ⚠️ Posées AU FOND (dans `fetchAll` et `fetchKnowledge`, côté natif ET démo),
 * jamais chez les appelants — la leçon du filtre `is_example` de la 024.
 */

/** Tâches et sous-objectifs dont la cible est absente se lisent détachés. */
export function detacherDesJetes<
  T extends { goal_id: number | null },
  G extends { id: number; parent_goal_id: number | null },
>(taches: readonly T[], objectifs: readonly G[]): { taches: T[]; objectifs: G[] } {
  const vivants = new Set(objectifs.map((g) => g.id));
  return {
    taches: taches.map((t) => (t.goal_id != null && !vivants.has(t.goal_id) ? { ...t, goal_id: null } : t)),
    objectifs: objectifs.map((g) =>
      g.parent_goal_id != null && !vivants.has(g.parent_goal_id) ? { ...g, parent_goal_id: null } : g,
    ),
  };
}

/**
 * Une fiche dont le sujet est en corbeille se lit « Sans thème » (§ 5.5 : les
 * fiches ne partent JAMAIS avec leur sujet). Son `topic_id` reste en base.
 */
export function sansSujetJete<E extends { topic_id: number | null }>(
  fiches: readonly E[],
  sujets: readonly { id: number }[],
): E[] {
  const vivants = new Set(sujets.map((s) => s.id));
  return fiches.map((f) => (f.topic_id != null && !vivants.has(f.topic_id) ? { ...f, topic_id: null } : f));
}
