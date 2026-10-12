import type { GoalInput } from "../repo";
import type { Goal, Priority } from "../types";
import { peutAjouterEtape } from "./structure";

/**
 * ⭐ AJOUTER UNE ÉTAPE — ce qui s'écrit, décidé à UN endroit (2026-10-12).
 *
 * On n'ajoute plus « une phase » ou « un sous-objectif » : on ajoute UNE ÉTAPE.
 * Ajoutée sous une étape, elle fait de celle-ci une phase — par son contenu,
 * rien d'autre (`natureDe`, `structure.ts`).
 *
 * La feuille de route, la carte mentale d'un objectif, le menu « Type » d'un
 * nœud et l'IA créent tous leurs étapes par ici (`ajouter.ts` pour l'écriture) :
 * quatre chemins qui posaient chacun `is_milestone` à leur idée.
 *
 * ⚠️ PUR : aucune écriture. L'appelant envoie `input`, puis promeut le parent
 * si `promouvoir` est vrai.
 */

/** Le rang d'une étape neuve : APRÈS toutes ses sœurs. */
export function rangEnDernier(parentId: number, goals: readonly Pick<Goal, "parent_goal_id" | "position">[]): number {
  const soeurs = goals.filter((g) => g.parent_goal_id === parentId);
  return soeurs.reduce((mx, s) => Math.max(mx, (s.position ?? 0) + 1), soeurs.length);
}

export interface EtapeAAjouter {
  input: GoalInput;
  /**
   * Le parent est une étape qui n'en portait pas : il devient une phase.
   *
   * ⚠️ L'ÉCRAN NE LIT PAS CETTE COLONNE (`is_milestone`) : il nomme d'après le
   * contenu. On l'écrit pour un appareil resté sur une version d'avant le
   * 2026-10-12, où une étape de niveau 2 sous un « sous-objectif » n'avait pas
   * de place prévue (ni bouton pour en ajouter d'autres, ni cadre de phase).
   * On ne la RETIRE jamais : une phase vidée garde `is_milestone = 1`, et
   * s'affiche « étape » ici, « phase » sur l'ancienne version — sans dégât.
   */
  promouvoir: boolean;
}

/**
 * L'étape à créer sous `parent`, en dernier rang, mesurée, sans échéance.
 * `null` si `parent` ne peut pas en recevoir (trois niveaux) ou si le titre est vide.
 */
export function etapeAAjouter(
  parent: Goal,
  titre: string,
  goals: readonly Goal[],
  extra: { priorite?: Priority; position?: number; echeance?: string | null; description?: string | null } = {},
): EtapeAAjouter | null {
  const net = titre.trim();
  if (!net || !peutAjouterEtape(parent, goals)) return null;
  return {
    input: {
      title: net,
      description: extra.description ?? null,
      // L'horizon et la catégorie s'héritent, jamais réinventés.
      scope: parent.scope,
      category: parent.category,
      parent_goal_id: parent.id,
      deadline: extra.echeance ?? null,
      progress_pct: 0,
      // Mesurée, comme tout ce qui est neuf depuis le 2026-09-14.
      manual_progress: 0,
      // Une étape neuve ne contient rien : elle n'est jamais une phase.
      is_milestone: 0,
      position: extra.position ?? rangEnDernier(parent.id, goals),
      priority: extra.priorite ?? "medium",
    },
    promouvoir: parent.parent_goal_id != null && !parent.is_milestone,
  };
}
