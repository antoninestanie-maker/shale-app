/**
 * Ce qu'un menu contextuel propose sur une TÂCHE — dans la liste des Tâches,
 * le widget d'Aujourd'hui et le Calendrier.
 *
 * ⚠️ RÈGLE 18 — CHAQUE ENTRÉE APPELLE LA FONCTION DU GESTE ÉQUIVALENT :
 *   • Terminer / Rouvrir → la MÊME fonction que la case à cocher de la vue ;
 *   • Dater ▸            → `setTaskSchedule`, ce qu'écrit le glisser-déposer du
 *                          calendrier (le créneau horaire est gardé, comme
 *                          quand on fait glisser une tâche d'un jour à l'autre),
 *                          puis `replanifier()` si la tâche avait glissé : la
 *                          dater à la main remet son compteur de reports à zéro,
 *                          comme la déplacer dans le calendrier ;
 *   • Priorité ▸         → `prioriserTache`, qui n'écrit que la priorité (règle 16) ;
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

import { IconCalendar, IconCheck, IconPencil, IconPlay, IconTarget, IconTrash, IconX } from "../../icons";
import { IconDupliquer } from "../icones";
import { formatDate, t } from "../../../lib/i18n";
import { appliquerReport, createTask, prioriserTache, rattacherTache, setTaskSchedule } from "../../../lib/repo";
import { nomDePriorite, PRIORITES, prioriteDe } from "../../../lib/priorite";
import { IconePriorite } from "../../Priorite";
import { afficherToast } from "../../../lib/toast";
import { jeter, titreCourt } from "../../corbeille/geste";
import { addDays, todayStr } from "../../../lib/logic";
import type { EntreeMenu, EntreePossible, OrigineMenu } from "../../../lib/menu/entrees";
import { ancreSurElement, ancreSurPoint, ouvrirSelecteurDate, type AncreFenetre } from "../../../lib/selecteurDate";
import { estRecurrente, replanifier } from "../../../lib/taches";
import { lundiProchain, plusUnJour } from "../../../lib/taches/dates";
import { demanderIa } from "../../../lib/ia/demande";
import { IconeIa } from "../../ia/IconeIa";
import type { Goal, Priority, Task } from "../../../lib/types";

export interface GestesTache {
  /** Exactement ce que fait la case à cocher de la vue. */
  basculer: (task: Task) => void;
  /** Pose le curseur sur le libellé, EN PLACE — jamais une fenêtre. */
  renommer: (task: Task) => void;
  /** Le même éditeur que le crayon. */
  modifier: (task: Task) => void;
  dater: (task: Task, date: string | null) => Promise<void>;
  /** Faible, moyenne, élevée — la même écriture que la fenêtre de la tâche. */
  prioriser: (task: Task, priorite: Priority) => Promise<void>;
  rattacher: (task: Task, goalId: number | null) => Promise<void>;
  dupliquer: (task: Task) => Promise<void>;
  supprimer: (task: Task) => Promise<void>;
  /**
   * « Focus 25 min » — le ▶ d'Aujourd'hui, et la même séance depuis Tâches
   * (2026-10-11 : le menu de Tâches ne l'avait pas, crible du labo, constat 23).
   * Absent seulement là où aucun minuteur n'est à portée, ou pendant une séance.
   * ⚠️ Au doigt, le ▶ cède sa place au libellé (`TodayTasks`) : cette entrée
   * est alors SA seule porte (règle 17).
   */
  focus?: (task: Task) => void;
}

export interface ContexteTache {
  /** La tâche est-elle cochée, là où le menu s'ouvre ? */
  faite: boolean;
  /** Les objectifs VIVANTS (ceux de `AppData`, déjà filtrés de la corbeille). */
  objectifs: readonly Goal[];
  /**
   * `false` là où l'on ne peut PAS renommer en place — un bloc du Calendrier,
   * trop petit pour un champ. L'entrée est alors OMISE, pas grisée : le cahier
   * des charges interdit de renommer dans une fenêtre, et une entrée morte
   * affichée à chaque clic droit serait du bruit.
   */
  renommable?: boolean;
  /**
   * Les actions d'IA (Découper, Estimer) — vrai seulement quand l'écran PEUT
   * les montrer : Shale Pro, hors iOS (`useIa`). Omises, pas grisées : une
   * entrée « réservée à Pro » à chaque clic droit serait une publicité.
   */
  ia?: boolean;
}

const recurrente = (task: Task) => estRecurrente(task);

/** Où accrocher ce qu'une entrée ouvre sur place : le « ⋯ », ou le point du clic droit. */
function ancreDuMenu(ou: OrigineMenu | undefined): () => AncreFenetre | null {
  if (ou?.element) return ancreSurElement(ou.element);
  if (ou?.ancre) return ancreSurPoint(ou.ancre.left, ou.ancre.bottom);
  // Ni l'un ni l'autre (un appel hors menu) : le coin haut gauche, bordé par le panneau.
  return ancreSurPoint(0, 0);
}

/**
 * ⭐ Le calendrier d'une tâche, ouvert SUR PLACE (2026-10-11) — sous le « ⋯ »,
 * sous la date d'une ligne. Le jour choisi passe par `gestes.dater`, le geste
 * des autres entrées de « Dater » (règle 18).
 *
 * Avant, « Choisir une date… » rouvrait toute la fenêtre de modification, et
 * depuis Aujourd'hui faisait quitter l'écran (crible du labo, constats 7 et 10).
 */
export function choisirDateDeTache(
  task: Task,
  dater: GestesTache["dater"],
  ancre: () => AncreFenetre | null,
  bouton?: HTMLElement | null,
): void {
  ouvrirSelecteurDate({
    ancre,
    valeur: task.due_date ?? "",
    ami: bouton ? () => bouton : undefined,
    focusApres: bouton ? () => bouton : undefined,
    onChoisir: (jour) => {
      // Rechoisir la date en place n'écrit rien.
      if ((jour || null) !== (task.due_date ?? null)) void dater(task, jour || null);
    },
  });
}

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

  /**
   * ⭐ « Dater ▸ » (2026-10-11) : reporter sans rouvrir une fenêtre.
   *   • « + 1 jour » part de la date de la TÂCHE (`plusUnJour`) — d'aujourd'hui
   *     si elle est en retard ou sans date ;
   *   • « Aujourd'hui » s'efface quand elle l'est déjà, « Retirer la date »
   *     quand elle n'en a pas : une entrée qui n'écrirait rien est du bruit ;
   *   • « Choisir une date… » ouvre le calendrier de l'app SUR PLACE.
   */
  const dates: EntreeMenu[] = [
    {
      id: "dater-plus-un",
      libelle: t("+ 1 jour"),
      icone: <IconCalendar />,
      executer: () => gestes.dater(task, plusUnJour(task, aujourdhui)),
    },
    ...(task.due_date === aujourdhui
      ? []
      : [
          {
            id: "dater-auj",
            libelle: t("Aujourd'hui"),
            icone: <IconCalendar />,
            executer: () => gestes.dater(task, aujourdhui),
          },
        ]),
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
      // ⚠️ Toujours UN seul calendrier dans l'app (décision du 2026-09-18) : c'est
      // le panneau de `ChampDate`, ouvert ici par `lib/selecteurDate.ts` au lieu
      // de l'être par la fenêtre de la tâche.
      executer: (ou) => choisirDateDeTache(task, gestes.dater, ancreDuMenu(ou), ou?.element),
    },
    ...(task.due_date
      ? [{ id: "dater-retirer", libelle: t("Retirer la date"), icone: <IconX />, executer: () => gestes.dater(task, null) }]
      : []),
  ];

  // La coche dit la priorité ACTUELLE ; la choisir de nouveau n'écrit rien.
  const actuelle = prioriteDe(task);
  const priorites: EntreeMenu[] = PRIORITES.map((p) => ({
    id: `priorite-${p}`,
    libelle: nomDePriorite(p),
    icone: p === actuelle ? <IconCheck /> : <IconePriorite priorite={p} className="h-[1em] w-[1em]" />,
    executer: () => (p === actuelle ? undefined : gestes.prioriser(task, p)),
  }));

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
    !ctx.faite && gestes.focus && {
      id: "focus",
      libelle: t("Focus 25 min"),
      icone: <IconPlay />,
      executer: () => gestes.focus?.(task),
    },
    ctx.renommable !== false && {
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
      id: "priorite",
      libelle: t("Priorité"),
      icone: <IconePriorite priorite={actuelle} className="h-[1em] w-[1em]" />,
      sousMenu: priorites,
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
    // Découper : une tâche ponctuelle, pas encore faite. Une routine revient
    // chaque jour — la découper créerait des étapes qui ne reviennent pas.
    ctx.ia && !ctx.faite && !recurrente(task) && {
      id: "ia-decouper",
      libelle: t("Découper avec l'IA…"),
      icone: <IconeIa className="h-[1em] w-[1em]" />,
      executer: () => demanderIa({ action: "decouper", taskId: task.id }),
    },
    ctx.ia && {
      id: "ia-estimer",
      libelle: t("Estimer la durée…"),
      icone: <IconeIa className="h-[1em] w-[1em]" />,
      executer: () => demanderIa({ action: "estimer", taskId: task.id }),
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
 * Dater, prioriser, rattacher, dupliquer, supprimer : écrits UNE fois, pour les Tâches,
 * Aujourd'hui et le Calendrier. Les trois autres gestes (cocher, renommer,
 * modifier) appartiennent à chaque vue, qui les a déjà.
 */
export function gestesCommunsTache(
  refresh: () => Promise<void>,
): Pick<GestesTache, "dater" | "prioriser" | "rattacher" | "dupliquer" | "supprimer"> {
  return {
    async dater(task, date) {
      // Le créneau horaire est GARDÉ quand on change de jour — c'est ce que fait
      // le glisser-déposer. Sans date, un créneau ne veut plus rien dire.
      await setTaskSchedule(task.id, date, date ? task.start_at : null, date ? task.end_at : null);
      // ⭐ Dater à la main n'est pas subir un glissement : le compteur de reports
      // repart de zéro (`replanifier`, `lib/taches.ts`) — comme quand on déplace
      // la tâche dans le calendrier. Sans cela, une tâche qu'on vient de poser à
      // jeudi gardait « reportée 2 fois » et son bandeau de décision.
      if (date && task.postponed_count > 0) await appliquerReport(task.id, replanifier(date));
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
    async prioriser(task, priorite) {
      await prioriserTache(task.id, priorite);
      await refresh();
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
