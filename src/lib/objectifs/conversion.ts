import { prioriteDe } from "../priorite";
import type { TaskInput } from "../repo";
import { planificationDeSaisie } from "../taches";
import type { Goal, LinkKind, Task } from "../types";
import { mesurer, uidDeLigne, type SourcesProgression } from "./progression";

/**
 * ⭐ UNE ÉTAPE VIDE DEVIENT UNE TÂCHE — ce qui se passe, décidé ici (2026-10-12).
 *
 * Antonin, le 12 octobre, après une nuit avec les étapes cochables : « cocher
 * une étape sans tâche n'a pas tellement de sens. Dans ce cas, l'étape est une
 * tâche. […] Ce sont directement des tâches, et dans ce cas, on donne un titre
 * à cette tâche. »
 *
 * Une étape vide (ni sous-étape, ni tâche qui compte, ni cible, pas suivie à
 * la main — exactement l'« unité » de `progression.ts`) se convertit donc, par
 * un geste explicite, en une VRAIE tâche : elle paraît dans Tâches, le
 * Calendrier, Aujourd'hui et le minuteur, ce qu'une étape cochée ne fait pas.
 *
 * CE QUI SUIT L'ÉTAPE
 *   • son titre devient le nom de la tâche ;
 *   • son échéance devient la date de la tâche ;
 *   • sa priorité (une valeur inconnue se lit « moyenne », comme partout) ;
 *   • sa place : la tâche se rattache au PARENT de l'étape — l'objectif, ou
 *     l'étape au-dessus ;
 *   • sa coche : cochée, la tâche naît faite, à la date du jour ;
 *   • son statut d'exemple (un exemple converti reste un exemple) ;
 *   • ce qui lui était rattaché sans compter — tâches récurrentes, notes,
 *     fiches, événements qui reviennent — passe au parent. Sans cela, les
 *     tâches partiraient à la corbeille AVEC l'étape (`corbeille/lots.ts`).
 *
 * CE QUI NE SUIT PAS — et que l'écran dit AVANT de convertir
 *   • sa DESCRIPTION : une tâche n'en a pas (aucune colonne, et pas de
 *     migration pour ça). Elle reste avec l'étape, dans Supprimés récemment
 *     (`description` ci-dessous) ;
 *   • les CITATIONS de l'étape dans le texte d'une note ou d'une fiche (un
 *     `@étape`, un nœud de carte) : elles désignent l'étape par son identité,
 *     et réécrire le texte de quelqu'un pour le faire désigner autre chose
 *     n'est pas un geste de conversion. La note, elle, passe au parent comme
 *     tout ce qui était rattaché (`citations` ci-dessous).
 *
 * L'étape elle-même part à la corbeille par le chemin normal : rien n'est
 * détruit, et « Annuler » rend tout (`repo.annulerConversionEnTache`).
 *
 * ⚠️ PUR : aucune écriture. L'accès (`repo.convertirEtapeEnTache`) applique ce
 * plan ; la feuille de route le lit pour savoir quoi annoncer.
 */

export type RefusConversion =
  /** L'étape n'existe pas (ou plus : supprimée ailleurs entre l'écran et le clic). */
  | "introuvable"
  /** Un objectif racine n'a pas de parent où ranger la tâche. */
  | "objectif"
  /** Elle contient quelque chose qui la mesure : ce n'est pas une chose à faire, c'est un regroupement. */
  | "pas-vide";

export interface PlanConversion {
  etape: Goal;
  parent: Goal;
  /** La tâche à créer, rattachée au parent. */
  tache: TaskInput;
  /** L'étape était cochée : la tâche naît faite. */
  faite: boolean;
  /** L'étape était un exemple : la tâche en est un aussi. */
  exemple: boolean;
  /** Les tâches rattachées à l'étape sans la mesurer (récurrentes) : elles passent au parent. */
  tachesQuiSuivent: Task[];
  /** Notes, fiches et événements récurrents rattachés à l'étape : ils passent au parent. */
  rattachesQuiSuivent: { kind: LinkKind; uid: string }[];
  /** ⚠️ Ne suit PAS : à annoncer avant de convertir. `null` s'il n'y en a pas. */
  description: string | null;
  /** ⚠️ Ne suivent PAS : combien de textes (notes, fiches) CITENT l'étape. */
  citations: number;
}

/** Y a-t-il quelque chose à dire avant de convertir ? */
export function aAnnoncer(p: Pick<PlanConversion, "description" | "citations">): boolean {
  return !!p.description || p.citations > 0;
}

export function planConversion(etapeId: number, s: SourcesProgression): PlanConversion | { refus: RefusConversion } {
  const etape = s.goals.find((g) => g.id === etapeId);
  if (!etape) return { refus: "introuvable" };
  const parent = etape.parent_goal_id == null ? null : s.goals.find((g) => g.id === etape.parent_goal_id);
  if (!parent) return { refus: "objectif" };

  // ⭐ La MÊME question que la case à cocher : « est-ce une unité ? ». Posée à
  // `mesurer`, jamais redécidée ici — une seconde règle finirait par proposer
  // de convertir une étape qui porte une cible ou un événement.
  const m = mesurer(etape, s);
  if (m.origine.type !== "unite") return { refus: "pas-vide" };

  const description = etape.description?.trim() || null;
  const uid = uidDeLigne("goal", etape);
  const citations = (s.liens ?? []).filter((l) => l.to_kind === "goal" && l.to_uid === uid && l.origin === "mention").length;
  return {
    etape,
    parent,
    tache: {
      label: etape.title,
      tag: null,
      priority: prioriteDe(etape),
      recurrence: "none",
      goal_id: parent.id,
      // La frontière datée / récurrente est tenue à un seul endroit (`taches.ts`).
      ...planificationDeSaisie("none", (etape.deadline ?? "").slice(0, 10), "", ""),
    },
    faite: m.origine.faite,
    exemple: !!etape.is_example,
    // Toutes celles qui pointent l'étape — récurrentes, ou exemples que la
    // mesure d'un objectif réel ignore : aucune ne doit partir avec elle.
    tachesQuiSuivent: s.tasks.filter((t) => t.goal_id === etape.id),
    rattachesQuiSuivent: [...m.ressources, ...m.nonComptes].filter((r) => r.kind !== "task"),
    description,
    citations,
  };
}

/** Ce qu'un « Annuler » doit savoir pour tout rendre — la cible fermée du toast (règle 15). */
export interface RecuConversion {
  etapeId: number;
  tacheId: number;
  /** Les tâches passées au parent, à rendre à l'étape ; `exemple` : à re-marquer. */
  tachesDeplacees: { id: number; exemple: boolean }[];
  /** Les arêtes créées vers le parent, à retirer. */
  liensCrees: number[];
}
