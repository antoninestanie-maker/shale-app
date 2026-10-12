import type { GenreRef, RefNoeud } from "../carte";
import { HABIT_COLORS } from "../habitudes";
import { t } from "../i18n";
import { addHabit, createTask, majFeuilleDeRoute, uidDe } from "../repo";
import type { Goal } from "../types";
import { ajouterEtape } from "./ajouter";

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

/**
 * Une étape sous `parent`, en DERNIER rang — jamais ailleurs que la feuille de
 * route ne la mettrait, et par la MÊME écriture qu'elle (`ajouterEtape`).
 *
 * `genre` : la clé que le nœud enregistre pour dessiner son icône. Une étape
 * neuve ne contient rien : elle n'est jamais une phase (2026-10-12).
 */
export async function typerEnEtape(
  titre: string,
  parent: Goal,
  goals: readonly Goal[],
): Promise<{ ref: RefNoeud; genre: GenreRef } | null> {
  const id = await ajouterEtape(parent, titre, goals);
  if (id == null) return null;
  const uid = await uidDe("goal", id);
  signaler();
  return uid ? { ref: { kind: "goal", uid }, genre: "sous-objectif" } : null;
}

/**
 * Une habitude — celles du Journal. Seule par défaut.
 *
 * Rattachée : une étape « <nom> » naît
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
    const etapeId = await ajouterEtape(rattacher.sous, titre, goals);
    if (etapeId == null) {
      signaler();
      return { kind: "habit", uid };
    }
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
