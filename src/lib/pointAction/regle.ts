import { objectifsEnPeril, type ObjectifEnPeril } from "../calendrier/peril";
import type { ContexteProgression } from "../objectifs/progression";
import { racineDe } from "../objectifs/structure";
import { demandeUneDecision, estGlisseeJusquA, tachesADecider, tachesEnRetard } from "../taches";
import type { Completion, Goal, Task } from "../types";

/**
 * ⭐ « ACTION REQUISE » — la règle UNIQUE du point d'action (2026-10-20).
 *
 * Antonin, sur le canevas « Grammaire des couleurs » : un petit point rouge vif
 * qui ne paraît que quand une action est requise — tâche en retard, objectif en
 * péril, décision à prendre — jamais pour une simple information. Il remonte au
 * module (un nombre dans la barre latérale, un point sur l'onglet de l'iPhone,
 * sur « Plus ») et figure dans le centre de notifications. Agir sur l'élément
 * l'éteint partout (`Shale-projet/marque/COULEURS.md` § 4).
 *
 * ⚠️ AUCUN écran ne recalcule. L'élément, le module, la barre d'onglets et le
 * centre de notifications lisent tous ce que cette fonction rend, par le
 * contexte `useActions()` (`lib/pointAction/contexte.tsx`). C'est ce qui garantit
 * qu'un point éteint ici l'est aussi là.
 *
 * Ce qui compte — trois faits DÉJÀ calculés ailleurs, rien d'inventé :
 *   • une tâche ponctuelle EN RETARD (`tachesEnRetard`, `lib/taches.ts`) ;
 *   • une tâche reportée au seuil, qui attend une DÉCISION (`tachesADecider`,
 *     le bandeau du Calendrier) ;
 *   • un objectif ou une étape EN PÉRIL ou à l'échéance DÉPASSÉE
 *     (`objectifsEnPeril`, `lib/calendrier/peril.ts`).
 *
 * Ce qui ne compte PAS, exprès : une routine manquée (elle n'est jamais en
 * retard), une habitude non cochée, une journée surchargée (une information,
 * pas une action), un exemple de l'app.
 */

/** Le module où l'on agit — ce qui reçoit le nombre dans la barre latérale. */
export type ModuleAction = "tasks" | "goals";

export type GenreAction = "tache-en-retard" | "tache-a-decider" | "objectif-en-peril" | "objectif-depasse";

export interface ActionRequise {
  /** Identité stable : `tache:<id>` ou `objectif:<id>`. Un élément = une action. */
  cle: string;
  genre: GenreAction;
  module: ModuleAction;
  kind: "task" | "goal";
  id: number;
  titre: string;
  /** Tâche : son échéance. Objectif : l'échéance de l'objectif. */
  echeance: string | null;
  /** Objectif : jours restants (négatif = dépassée). */
  joursRestants?: number;
  /** Tâche : nombre de reports. */
  reports?: number;
  /**
   * Une ÉTAPE : l'objectif racine qui la porte — c'est sa ligne que montre la
   * liste Objectifs, et c'est elle qui reçoit le point (constat 27, 2026-10-20).
   */
  racine?: { id: number; titre: string };
}

export const cleTache = (id: number) => `tache:${id}`;
export const cleObjectif = (id: number) => `objectif:${id}`;

export interface EntreeActions extends Partial<ContexteProgression> {
  tasks: readonly Task[];
  completions: readonly Completion[];
  goals: readonly Goal[];
}

export function actionsRequises(entree: EntreeActions, jour: string): ActionRequise[] {
  const { tasks, completions, goals, ...contexte } = entree;
  const vraies = tasks.filter((t) => !t.is_example);
  const actions: ActionRequise[] = [];
  const vues = new Set<string>();

  // Une tâche à la fois en retard ET à décider ne compte qu'une fois : la
  // décision l'emporte (c'est elle qu'il faut prendre).
  const aDecider = tachesADecider(vraies, completions, jour);
  const enRetard = tachesEnRetard(vraies, completions, jour);
  for (const t of [...aDecider, ...enRetard]) {
    const cle = cleTache(t.id);
    if (vues.has(cle)) continue;
    vues.add(cle);
    actions.push({
      cle,
      genre: demandeUneDecision(t) && (t.due_date ?? "") <= jour ? "tache-a-decider" : "tache-en-retard",
      module: "tasks",
      kind: "task",
      id: t.id,
      titre: t.label,
      // Reportée jusqu'à aujourd'hui par le Calendrier : son retard court depuis
      // sa date d'ORIGINE (« en retard de 0 j » sinon — `estGlisseeJusquA`).
      echeance: (estGlisseeJusquA(t, jour) ? t.postponed_from : null) ?? t.due_date ?? null,
      reports: t.postponed_count ?? 0,
    });
  }

  const vraisObjectifs = goals.filter((g) => !g.is_example);
  const peril: ObjectifEnPeril[] = objectifsEnPeril(
    vraisObjectifs as Goal[],
    vraies as Task[],
    completions as Completion[],
    jour,
    contexte,
  );
  for (const p of peril) {
    const cle = cleObjectif(p.goal.id);
    if (vues.has(cle)) continue;
    vues.add(cle);
    const racine = racineDe(p.goal, goals as Goal[]);
    actions.push({
      cle,
      genre: p.joursRestants < 0 ? "objectif-depasse" : "objectif-en-peril",
      module: "goals",
      kind: "goal",
      id: p.goal.id,
      titre: p.goal.title,
      echeance: p.goal.deadline ?? null,
      joursRestants: p.joursRestants,
      ...(racine.id !== p.goal.id ? { racine: { id: racine.id, titre: racine.title } } : {}),
    });
  }
  return actions;
}

/**
 * Le nombre d'actions par module — le chiffre de la barre latérale.
 *
 * ⭐ Pour les Objectifs, un objectif RACINE compte une fois, avec ses étapes
 * (constat 27 de l'audit du 2026-10-20) : le badge disait « 3 » pour un objectif
 * dépassé et deux de ses étapes, quand la liste — qui ne montre que les racines —
 * n'avait qu'une ligne marquée. Le nombre dit désormais combien de lignes de la
 * liste attendent ; le centre de notifications détaille chaque étape.
 */
export function compterParModule(actions: readonly ActionRequise[]): Partial<Record<ModuleAction, number>> {
  const n: Partial<Record<ModuleAction, number>> = {};
  const racines = new Set<number>();
  for (const a of actions) {
    if (a.module === "goals") {
      const id = a.racine?.id ?? a.id;
      if (racines.has(id)) continue;
      racines.add(id);
    }
    n[a.module] = (n[a.module] ?? 0) + 1;
  }
  return n;
}

/** Le nombre affiché : au-delà de 9, « 9+ » (la place d'un chiffre). */
export function nombreAffiche(n: number): string {
  return n > 9 ? "9+" : String(n);
}
