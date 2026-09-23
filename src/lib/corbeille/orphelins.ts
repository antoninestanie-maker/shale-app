/**
 * Ce qui reste VIVANT mais pointe vers un objet EN CORBEILLE.
 *
 * ⚠️⚠️ LES TÂCHES NE SONT PLUS DÉTACHÉES EN MÉMOIRE — changement du 2026-09-23.
 *
 * La première version lisait « sans objectif » une tâche dont l'objectif était
 * en corbeille (`goal_id` à `null` en mémoire, intact en base). Défaut trouvé
 * en relisant les écritures : `updateTask`, qu'appelle la fenêtre d'une tâche,
 * réécrit la ligne ENTIÈRE. Modifier la tâche aurait donc écrit ce `null` en
 * base — le lien perdu pour de bon, et la restauration de l'objectif ne lui
 * aurait plus rendu sa tâche, alors que c'est la promesse. Or aucun lecteur
 * n'avait besoin du masquage : tous cherchent l'objectif par un `find(...)?.`
 * tolérant, et un objectif absent de la liste n'affiche simplement rien. Le
 * lien « dort », et toute écriture le préserve. Voir `PIEGES.md` § 19.
 *
 * ⚠️ LES SOUS-OBJECTIFS, EUX, RESTENT DÉTACHÉS : un enfant vivant sous un
 * parent jeté (cas rare, une synchronisation interrompue) disparaîtrait
 * autrement de tous les arbres — ni racine, ni sous un parent affiché. Les
 * réécritures d'une étape par la feuille de route passent donc par des
 * écritures d'UNE colonne (`renommerObjectif`, `daterObjectif`).
 *
 * ⚠️ Rend de NOUVEAUX objets, ne modifie rien en place : en démo, les lignes
 * rendues sont les objets MÊMES du magasin en mémoire.
 */
export function detacherDesJetes<
  T extends { goal_id: number | null },
  G extends { id: number; parent_goal_id: number | null },
>(taches: readonly T[], objectifs: readonly G[]): { taches: T[]; objectifs: G[] } {
  const vivants = new Set(objectifs.map((g) => g.id));
  return {
    taches: [...taches],
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
