import { createGoal, majFeuilleDeRoute } from "../repo";
import type { Goal, Priority } from "../types";
import { etapeAAjouter } from "./ajout";

/**
 * ⭐ Écrit une étape sous `parent` — la moitié impure de `ajout.ts`.
 *
 * Un geste = une fonction (règle 18) : le champ de la feuille de route, la
 * carte d'un objectif, le menu « Type » d'un nœud et l'IA passent par ici.
 * Rend l'`id` de l'étape, ou `null` si rien n'a été écrit (titre vide, ou
 * `parent` déjà au dernier niveau).
 *
 * ⚠️ AUCUNE TRANSACTION (`repo.ts` n'en expose pas). Une interruption entre
 * les deux écritures laisse une étape créée sous un parent non promu : l'écran
 * l'affiche quand même comme une phase, puisqu'il nomme d'après le contenu.
 */
export async function ajouterEtape(
  parent: Goal,
  titre: string,
  goals: readonly Goal[],
  extra: { priorite?: Priority; position?: number; echeance?: string | null; description?: string | null } = {},
): Promise<number | null> {
  const plan = etapeAAjouter(parent, titre, goals, extra);
  if (!plan) return null;
  const id = await createGoal(plan.input);
  if (plan.promouvoir) await majFeuilleDeRoute(parent.id, { is_milestone: 1 });
  return id;
}
