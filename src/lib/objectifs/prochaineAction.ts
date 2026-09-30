import { rangPriorite } from "../priorite";
import type { Goal, Task } from "../types";
import { elementsDe, enfantsDe, uidDeLigne, type SourcesProgression } from "./progression";

/**
 * ⭐ LA PROCHAINE ACTION D'UN OBJECTIF — une règle d'AFFICHAGE, jamais écrite.
 *
 * Phase D du chantier carte-objectifs (direction B, 2026-09-29). L'audit
 * l'avait relevé : la tâche en retard n'apparaissait qu'en dépliant la bonne
 * étape, et rien ne disait quoi faire maintenant. La liste des objectifs la
 * montre désormais sous chaque titre.
 *
 * L'ordre, tel qu'annoncé à l'arrêt 3 :
 *   1. la tâche non faite la plus EN RETARD ;
 *   2. sinon celle dont l'échéance est la plus PROCHE ;
 *   3. sinon, parmi les tâches sans échéance, la première de la feuille de
 *      route — celles de l'objectif lui-même, puis étape par étape dans l'ordre
 *      affiché (`enfantsDe`), en sautant les étapes ACHEVÉES : ce qui reste dans
 *      une phase finie n'est pas « la suite ».
 *
 * Une tâche datée se propose même dans une étape achevée : une échéance passée
 * reste en retard, quoi que dise le pourcentage.
 *
 * ⭐ LA PRIORITÉ DÉPARTAGE (2026-09-30, « un ordre de priorité ») : à date égale
 * — et entre toutes les tâches sans date —, la tâche la plus prioritaire passe
 * d'abord ; à égalité, celle de l'étape la plus prioritaire ; puis l'ordre de la
 * feuille de route. La date reste reine : une tâche en retard, même faible,
 * passe avant une élevée sans échéance.
 *
 * ⚠️ Les tâches viennent d'`elementsDe`, la règle même du calcul d'avancement :
 * ponctuelles seulement (une récurrente n'est jamais « à faire ensuite », elle
 * revient), rattachées par `goal_id` OU par une arête, dédoublonnées.
 */
export interface ProchaineAction {
  tache: Task;
  /** L'étape qui la porte ; `null` si elle est rattachée à l'objectif lui-même. */
  etape: Goal | null;
  /** Échéance passée — jamais « aujourd'hui », qui est encore à l'heure. */
  enRetard: boolean;
}

export function prochaineAction(
  racine: Goal,
  s: SourcesProgression,
  acheve: (goalId: number) => boolean,
): ProchaineAction | null {
  if (acheve(racine.id)) return null;
  const jour = s.maintenant.slice(0, 10);
  const parUid = new Map(s.tasks.map((t) => [uidDeLigne("task", t), t]));

  const candidates: { tache: Task; etape: Goal | null; rang: number; ouverte: boolean }[] = [];
  const vues = new Set<string>();
  const parcourir = (g: Goal, etape: Goal | null, ouverte: boolean) => {
    for (const e of elementsDe(g, s).comptables) {
      if (e.kind !== "task" || e.fait || vues.has(e.uid)) continue;
      const tache = parUid.get(e.uid);
      if (!tache) continue;
      vues.add(e.uid);
      candidates.push({ tache, etape, rang: candidates.length, ouverte });
    }
    for (const enfant of enfantsDe(g, s.goals)) parcourir(enfant, enfant, ouverte && !acheve(enfant.id));
  };
  parcourir(racine, null, true);

  const parPriorite = (a: (typeof candidates)[number], b: (typeof candidates)[number]) =>
    rangPriorite(a.tache.priority) - rangPriorite(b.tache.priority) ||
    rangPriorite((a.etape ?? racine).priority) - rangPriorite((b.etape ?? racine).priority) ||
    a.rang - b.rang;
  const datees = candidates
    .filter((c) => !!c.tache.due_date)
    .sort((a, b) => a.tache.due_date!.localeCompare(b.tache.due_date!) || parPriorite(a, b));
  const choisie = datees[0] ?? candidates.filter((c) => c.ouverte).sort(parPriorite)[0];
  if (!choisie) return null;
  return {
    tache: choisie.tache,
    etape: choisie.etape,
    enRetard: !!choisie.tache.due_date && choisie.tache.due_date < jour,
  };
}
