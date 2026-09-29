import { idDepuisUid } from "../naviguer";
import { t } from "../i18n";
import { createGoal, createLink, createTask, majFeuilleDeRoute, rattacherTache, uidDe } from "../repo";
import type { Goal } from "../types";
import type { EtapePlan, PlanObjectif, RessourcePlan, TachePlan } from "./carte";

/**
 * ⭐ ÉCRIRE un plan de carte : la moitié impure de `objectifs/carte.ts`.
 *
 * Tout ce qui décide vit là-bas, en fonctions pures et testées. Ici, il n'y a
 * que des écritures dans l'ordre — et cet ordre est la seule chose qui compte :
 * un enfant a besoin de l'`id` de son parent, une arête a besoin de l'`uid` de
 * l'objectif, et aucun des deux n'existe avant que la ligne ne soit écrite.
 *
 * ⚠️ AUCUNE TRANSACTION. `repo.ts` n'en expose pas, et en inventer une ici
 * demanderait un accès direct à la base que le mode démo n'a pas. Une
 * interruption au milieu laisse donc un objectif partiellement garni — visible,
 * modifiable, supprimable d'un geste. C'est le même arbitrage que
 * `creerObjectifPlanifie` de l'accueil (`onboarding/semer.ts`).
 */

export interface ComptesEcrits {
  racineId: number;
  etapes: number;
  taches: number;
  tachesRattachees: number;
  ressources: number;
  habitudes: number;
}

/**
 * Crée l'objectif décrit par le plan, avec ses étapes, ses tâches et ses
 * rattachements. Rend l'`id` de la racine, pour pouvoir l'ouvrir ensuite.
 */
export async function creerObjectifDepuisPlan(
  plan: PlanObjectif,
  base: Pick<Goal, "scope" | "category">,
  /**
   * Les habitudes citées : si une cible est donnée, chacune est rattachée par
   * un sous-objectif de l'objectif, compté en jours tenus (le chemin de la
   * 026, décision C). Sans cible, elles restent seules — rien n'est imposé.
   */
  options: { cibleHabitudes?: number | null } = {},
): Promise<ComptesEcrits> {
  const comptes: ComptesEcrits = { racineId: 0, etapes: 0, taches: 0, tachesRattachees: 0, ressources: 0, habitudes: 0 };

  const racineId = await createGoal({
    title: plan.titre,
    description: null,
    scope: base.scope,
    category: base.category,
    parent_goal_id: null,
    deadline: null,
    progress_pct: 0,
    // Un objectif né d'une carte est MESURÉ : sa feuille de route existe déjà,
    // c'est tout l'intérêt. Une barre à la main par-dessus serait une seconde
    // vérité (décision du 2026-09-14).
    manual_progress: 0,
    is_milestone: 0,
    position: 0,
  });
  comptes.racineId = racineId;

  await garnir(racineId, plan.taches, plan.ressources, comptes);

  let position = 0;
  for (const etape of plan.etapes) {
    const etapeId = await createGoal(fiche(etape, base, racineId, position++));
    comptes.etapes++;
    await garnir(etapeId, etape.taches, etape.ressources, comptes);

    let sousPosition = 0;
    for (const sous of etape.sousEtapes) {
      const sousId = await createGoal(fiche(sous, base, etapeId, sousPosition++));
      comptes.etapes++;
      await garnir(sousId, sous.taches, sous.ressources, comptes);
    }
  }

  const cible = options.cibleHabitudes;
  if (cible != null && cible >= 1) {
    for (const h of plan.habitudes) {
      const etapeId = await createGoal({
        title: h.titre,
        description: null,
        scope: base.scope,
        category: base.category,
        parent_goal_id: racineId,
        deadline: null,
        progress_pct: 0,
        manual_progress: 0,
        is_milestone: 0,
        position: position++,
      });
      await majFeuilleDeRoute(etapeId, {
        count_source: "habit",
        count_ref_uid: h.uid,
        target_count: Math.round(cible),
        // Une DONNÉE, écrite dans la langue de l'utilisateur (voir `typer.ts`).
        target_unit: t("jours"),
      });
      comptes.etapes++;
      comptes.habitudes++;
    }
  }

  return comptes;
}

function fiche(
  etape: EtapePlan,
  base: Pick<Goal, "scope" | "category">,
  parentId: number,
  position: number,
) {
  return {
    title: etape.titre,
    description: null,
    scope: base.scope,
    category: base.category,
    parent_goal_id: parentId,
    deadline: null,
    progress_pct: 0,
    manual_progress: 0,
    is_milestone: etape.phase ? 1 : 0,
    position,
  };
}

/**
 * Les tâches et les ressources d'une étape.
 *
 * ⚠️ Une tâche CITÉE est rattachée, jamais recréée — sinon la carte fabriquerait
 * un doublon de ce qu'elle désignait. Si son uid ne correspond à aucune tâche
 * connue (supprimée entre-temps sur un autre appareil), on ne crée rien : on
 * n'a que son titre d'affichage, et recréer une tâche à partir d'une copie
 * d'affichage inventerait une donnée.
 */
async function garnir(
  goalId: number,
  taches: readonly TachePlan[],
  ressources: readonly RessourcePlan[],
  comptes: ComptesEcrits,
): Promise<void> {
  for (const t of taches) {
    if (t.ref) {
      // ⚠️ La carte ne connaît que l'`uid` : le numéro local se relit
      // (`idDepuisUid`, l'inverse de `uidDe`), il ne se devine pas.
      const id = await idDepuisUid("task", t.ref.uid);
      if (id == null) continue;
      await rattacherTache(id, goalId);
      comptes.tachesRattachees++;
      continue;
    }
    await createTask({
      label: t.titre,
      tag: null,
      priority: "medium",
      recurrence: "none",
      goal_id: goalId,
    });
    comptes.taches++;
  }

  if (ressources.length === 0) return;
  // ⚠️ L'arête porte des `uid`, jamais des `id` (migration 020) : il faut donc
  // relire celui de l'objectif qu'on vient de créer — `createGoal` rend un
  // numéro local, et c'est un trigger qui pose l'uid.
  const uidObjectif = await uidDe("goal", goalId);
  if (!uidObjectif) return;
  for (const r of ressources) {
    await createLink({
      from_kind: "goal",
      from_uid: uidObjectif,
      to_kind: r.kind,
      to_uid: r.uid,
      // ⚠️ `origin` reste `manual` : la 020 déclare un CHECK à liste fermée, et
      // une valeur inconnue arrivant d'un autre appareil arrêterait la
      // synchronisation (PIEGES § 3.4).
      origin: "manual",
    });
    comptes.ressources++;
  }
}
