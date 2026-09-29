import type { GenreRef, RefNoeud } from "../carte";
import { HABIT_COLORS } from "../habitudes";
import { t } from "../i18n";
import { addHabit, createGoal, createTask, majFeuilleDeRoute, uidDe } from "../repo";
import type { Goal } from "../types";
import type { GenreEtape } from "./structure";
import { rangEnDernier } from "./typage";

/**
 * ⭐ ÉCRIRE le typage d'un nœud — la moitié impure de `typage.ts`.
 *
 * Chaque fonction CRÉE l'objet, puis rend la référence que le nœud portera :
 * le nœud n'a plus de texte à lui, son titre et son état viennent de l'objet
 * (pas de double vérité). Et chaque fonction émet `sb:data-changed` : l'objet
 * est écrit depuis une carte, loin de la vue qui l'affiche — sans ce signal,
 * la vue Tâches ou Objectifs resterait figée sur l'état d'avant (PIEGES § 18.2).
 *
 * ⚠️ AUCUNE TRANSACTION (`repo.ts` n'en expose pas, et le mode démo n'a pas de
 * base). Une interruption au milieu laisse un objet créé et un nœud resté
 * idée : l'objet est visible là où il vit, et se re-cite par `@`. Même
 * arbitrage que `creerDepuisCarte.ts`.
 */

const signaler = () => window.dispatchEvent(new Event("sb:data-changed"));

export async function typerEnTache(titre: string, goal: Goal | null): Promise<RefNoeud | null> {
  const id = await createTask({
    label: titre,
    tag: null,
    priority: "medium",
    recurrence: "none",
    goal_id: goal?.id ?? null,
  });
  const uid = await uidDe("task", id);
  signaler();
  return uid ? { kind: "task", uid } : null;
}

/** Une étape sous `parent`, en DERNIER rang — jamais ailleurs que la feuille de route ne la mettrait. */
export async function typerEnEtape(
  titre: string,
  parent: Goal,
  genre: GenreEtape,
  goals: readonly Goal[],
): Promise<{ ref: RefNoeud; genre: GenreRef } | null> {
  const id = await createGoal({
    title: titre,
    description: null,
    scope: parent.scope,
    category: parent.category,
    parent_goal_id: parent.id,
    deadline: null,
    progress_pct: 0,
    // Mesurée, comme toute étape neuve depuis la 026 : une barre à la main
    // par-dessus une feuille de route serait une seconde vérité.
    manual_progress: 0,
    is_milestone: genre === "jalon" ? 1 : 0,
    position: rangEnDernier(parent.id, goals),
  });
  const uid = await uidDe("goal", id);
  signaler();
  return uid ? { ref: { kind: "goal", uid }, genre: genre === "jalon" ? "phase" : "sous-objectif" } : null;
}

/**
 * Une habitude — celles du Journal. Seule par défaut.
 *
 * Rattachée (case cochée dans le panneau) : un sous-objectif « <nom> » naît
 * sous `rattacher.sous`, compté par cette habitude, avec la cible choisie en
 * jours — le chemin de la migration 026. `count_since` est posé à aujourd'hui
 * par `majFeuilleDeRoute` : une habitude tenue depuis des mois ne remplit pas
 * l'étape le jour même.
 */
export async function typerEnHabitude(
  titre: string,
  rattacher: { sous: Goal; cible: number } | null,
  goals: readonly Goal[],
): Promise<RefNoeud | null> {
  const id = await addHabit(titre, HABIT_COLORS[0]);
  const uid = await uidDe("habit", id);
  if (uid && rattacher) {
    const etapeId = await createGoal({
      title: titre,
      description: null,
      scope: rattacher.sous.scope,
      category: rattacher.sous.category,
      parent_goal_id: rattacher.sous.id,
      deadline: null,
      progress_pct: 0,
      manual_progress: 0,
      is_milestone: 0,
      position: rangEnDernier(rattacher.sous.id, goals),
    });
    await majFeuilleDeRoute(etapeId, {
      count_source: "habit",
      count_ref_uid: uid,
      target_count: Math.max(1, Math.round(rattacher.cible)),
      // L'unité est une DONNÉE (l'utilisateur la tape d'habitude dans la
      // feuille de route) : on l'écrit dans sa langue, au moment où il crée
      // l'étape, comme il l'aurait tapée. Sans elle, l'étape afficherait
      // « 12/30 » sans dire de quoi.
      target_unit: t("jours"),
    });
  }
  signaler();
  return uid ? { kind: "habit", uid } : null;
}
