/**
 * Ce qu'un menu contextuel propose sur une TÂCHE — dans la liste des Tâches,
 * le widget d'Aujourd'hui et le Calendrier.
 *
 * ⚠️ RÈGLE 18 — CHAQUE ENTRÉE APPELLE LA FONCTION DU GESTE ÉQUIVALENT :
 *   • Terminer / Rouvrir → la MÊME fonction que la case à cocher de la vue ;
 *   • Dater ▸            → `setTaskSchedule`, ce qu'écrit le glisser-déposer du
 *                          calendrier (le créneau horaire est gardé, comme
 *                          quand on fait glisser une tâche d'un jour à l'autre) ;
 *   • Rattacher ▸        → `rattacherTache`, celle de la feuille de route ;
 *   • Modifier…          → le même éditeur que le crayon ;
 *   • Supprimer          → `jeter()`, la corbeille, comme le bouton.
 *
 * ⚠️ RÈGLE 16 — « Renommer » N'EST PAS `updateTask`. Celui-ci réécrit la ligne
 * entière et a déjà effacé la date d'une tâche (PIEGES § 6.2). Il passe par
 * `renommerTache`, qui n'écrit que le libellé.
 *
 * ⚠️ `t()` à la construction, jamais dans une constante de module.
 */

import { IconCalendar, IconCheck, IconPencil, IconTarget, IconTrash, IconX } from "../../icons";
import { IconDupliquer } from "../icones";
import { formatDate, t } from "../../../lib/i18n";
import { createTask, rattacherTache, setTaskSchedule } from "../../../lib/repo";
import { afficherToast } from "../../../lib/toast";
import { jeter, titreCourt } from "../../corbeille/geste";
import { addDays, todayStr, weekdayOf } from "../../../lib/logic";
import type { EntreeMenu, EntreePossible } from "../../../lib/menu/entrees";
import type { Goal, Task } from "../../../lib/types";

export interface GestesTache {
  /** Exactement ce que fait la case à cocher de la vue. */
  basculer: (task: Task) => void;
  /** Pose le curseur sur le libellé, EN PLACE — jamais une fenêtre. */
  renommer: (task: Task) => void;
  /** Le même éditeur que le crayon. */
  modifier: (task: Task) => void;
  dater: (task: Task, date: string | null) => Promise<void>;
  rattacher: (task: Task, goalId: number | null) => Promise<void>;
  dupliquer: (task: Task) => Promise<void>;
  supprimer: (task: Task) => Promise<void>;
}

export interface ContexteTache {
  /** La tâche est-elle cochée, là où le menu s'ouvre ? */
  faite: boolean;
  /** Les objectifs VIVANTS (ceux de `AppData`, déjà filtrés de la corbeille). */
  objectifs: readonly Goal[];
}

/** Le lundi STRICTEMENT après aujourd'hui — « lundi prochain », même un lundi. */
export function lundiProchain(aujourdhui: string = todayStr()): string {
  const jour = weekdayOf(aujourdhui); // 0 = dimanche
  const ecart = ((8 - jour) % 7) || 7;
  return addDays(aujourdhui, ecart);
}

const recurrente = (task: Task) => !!task.recurrence && task.recurrence !== "none";

/**
 * Les objectifs dans l'ordre de l'arbre, chacun avec un libellé qui dit OÙ il
 * est : « Lancer la chaîne › Préparer ». Deux phases peuvent porter le même
 * nom sous deux objectifs ; sans le chemin, on rattacherait au hasard.
 */
export function objectifsEnArbre(objectifs: readonly Goal[]): { goal: Goal; libelle: string }[] {
  const enfants = new Map<number | null, Goal[]>();
  const ids = new Set(objectifs.map((g) => g.id));
  for (const g of objectifs) {
    // Un parent absent (en corbeille, déjà détaché par `fetchAll`) = une racine.
    const parent = g.parent_goal_id != null && ids.has(g.parent_goal_id) ? g.parent_goal_id : null;
    if (!enfants.has(parent)) enfants.set(parent, []);
    enfants.get(parent)!.push(g);
  }
  for (const liste of enfants.values()) liste.sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);

  const out: { goal: Goal; libelle: string }[] = [];
  const vus = new Set<number>();
  const descendre = (parent: number | null, chemin: string[]) => {
    for (const g of enfants.get(parent) ?? []) {
      if (vus.has(g.id)) continue; // garde contre une boucle (PIEGES § 19.6)
      vus.add(g.id);
      const libelle = [...chemin, g.title].join(" › ");
      out.push({ goal: g, libelle });
      descendre(g.id, [...chemin, g.title]);
    }
  };
  descendre(null, []);
  return out;
}

export function entreesTache(task: Task, gestes: GestesTache, ctx: ContexteTache): EntreePossible[] {
  const aujourdhui = todayStr();

  const dates: EntreeMenu[] = [
    { id: "dater-auj", libelle: t("Aujourd'hui"), icone: <IconCalendar />, executer: () => gestes.dater(task, aujourdhui) },
    { id: "dater-demain", libelle: t("Demain"), icone: <IconCalendar />, executer: () => gestes.dater(task, addDays(aujourdhui, 1)) },
    {
      id: "dater-lundi",
      libelle: t("Lundi prochain"),
      icone: <IconCalendar />,
      executer: () => gestes.dater(task, lundiProchain(aujourdhui)),
    },
    {
      id: "dater-choisir",
      libelle: t("Choisir une date…"),
      icone: <IconPencil />,
      // Le champ de date de l'app vit dans l'éditeur de la tâche : le même que
      // celui du crayon. Un second sélecteur ici serait un second champ de date,
      // alors que le 2026-09-18 a justement tout ramené à UN seul (`ChampDate`).
      executer: () => gestes.modifier(task),
    },
    {
      id: "dater-retirer",
      libelle: t("Retirer la date"),
      icone: <IconX />,
      desactive: task.due_date ? undefined : { raison: t("Cette tâche n'a pas de date.") },
      executer: () => gestes.dater(task, null),
    },
  ];

  const arbre = objectifsEnArbre(ctx.objectifs);
  const rattachements: EntreeMenu[] = [
    {
      id: "rattacher-aucun",
      libelle: t("Aucun objectif"),
      icone: task.goal_id == null ? <IconCheck /> : <IconX />,
      executer: () => (task.goal_id == null ? undefined : gestes.rattacher(task, null)),
    },
    ...arbre.map(({ goal, libelle }) => ({
      id: `rattacher-${goal.id}`,
      libelle,
      // La coche dit où la tâche est rattachée AUJOURD'HUI.
      icone: goal.id === task.goal_id ? <IconCheck /> : <IconTarget />,
      executer: () => (goal.id === task.goal_id ? undefined : gestes.rattacher(task, goal.id)),
    })),
  ];

  return [
    {
      id: "basculer",
      libelle: ctx.faite ? t("Rouvrir") : t("Terminer"),
      icone: ctx.faite ? <IconX /> : <IconCheck />,
      executer: () => gestes.basculer(task),
    },
    {
      id: "renommer",
      libelle: t("Renommer"),
      icone: <IconPencil />,
      // Affiché parce qu'il EXISTE sur la ligne (voir les vues) : un raccourci
      // affiché et non branché est un mensonge que rien ne rattrape.
      raccourci: "F2",
      executer: () => gestes.renommer(task),
    },
    {
      id: "dater",
      libelle: t("Dater"),
      icone: <IconCalendar />,
      sousMenu: dates,
      // Une tâche récurrente n'a pas de date (`lib/taches.ts`) : elle revient
      // selon sa règle. La dater la casserait en tâche ponctuelle sans le dire.
      desactive: recurrente(task)
        ? { raison: t("Une tâche récurrente n'a pas de date : elle revient selon sa règle.") }
        : undefined,
    },
    {
      id: "rattacher",
      libelle: t("Rattacher à un objectif"),
      icone: <IconTarget />,
      sousMenu: rattachements,
      desactive: arbre.length === 0 && task.goal_id == null
        ? { raison: t("Aucun objectif pour l'instant.") }
        : undefined,
    },
    { id: "dupliquer", libelle: t("Dupliquer"), icone: <IconDupliquer />, executer: () => gestes.dupliquer(task) },
    { id: "modifier", libelle: t("Modifier…"), icone: <IconPencil />, executer: () => gestes.modifier(task) },
    {
      id: "supprimer",
      libelle: t("Supprimer"),
      icone: <IconTrash />,
      danger: true,
      executer: () => gestes.supprimer(task),
    },
  ];
}

// ─── Les gestes communs à toutes les vues qui montrent une tâche ─────────────


/**
 * Dater, rattacher, dupliquer, supprimer : écrits UNE fois, pour les Tâches,
 * Aujourd'hui et le Calendrier. Les trois autres gestes (cocher, renommer,
 * modifier) appartiennent à chaque vue, qui les a déjà.
 */
export function gestesCommunsTache(
  refresh: () => Promise<void>,
): Pick<GestesTache, "dater" | "rattacher" | "dupliquer" | "supprimer"> {
  return {
    async dater(task, date) {
      // Le créneau horaire est GARDÉ quand on change de jour — c'est ce que fait
      // le glisser-déposer. Sans date, un créneau ne veut plus rien dire.
      await setTaskSchedule(task.id, date, date ? task.start_at : null, date ? task.end_at : null);
      await refresh();
      // La tâche peut sortir de la vue filtrée où l'on est : le dire, sinon elle
      // aurait l'air d'avoir disparu.
      afficherToast({
        msg: date
          ? t("« {titre} » est prévue le {date}", {
              titre: titreCourt(task.label),
              date: formatDate(new Date(`${date}T12:00:00`), { weekday: "long", day: "numeric", month: "long" }),
            })
          : t("« {titre} » n'a plus de date", { titre: titreCourt(task.label) }),
      });
    },
    async rattacher(task, goalId) {
      await rattacherTache(task.id, goalId);
      await refresh();
    },
    async dupliquer(task) {
      await createTask({
        // Figé dans la langue du jour, comme pour une note (voir `NotesView`).
        label: t("{titre} (copie)", { titre: task.label }),
        tag: task.tag,
        priority: task.priority,
        recurrence: task.recurrence ?? "none",
        goal_id: task.goal_id,
        due_date: task.due_date,
        start_at: task.start_at,
        end_at: task.end_at,
      });
      await refresh();
    },
    async supprimer(task) {
      await jeter("task", task.id, task.label, refresh);
    },
  };
}
