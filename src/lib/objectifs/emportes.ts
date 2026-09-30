import { sousArbre, type Carte } from "../carte";
import type { Goal, Habit, Task } from "../types";
import { uidDeLigne } from "./progression";

/**
 * ⭐ SUPPRIMER UN NŒUD TYPÉ, C'EST SUPPRIMER SON OBJET.
 *
 * Antonin, après essai (2026-09-29) : « quand on supprime quelque chose cela
 * doit se supprimer aussi dans l'objectif et non rester après ». Un nœud typé
 * EST son objet (principe du chantier) : le retirer de la carte laissait
 * l'étape, la tâche ou l'habitude vivre ailleurs, orpheline de son dessin.
 *
 * Ce qui part avec le nœud et tout ce qui pend dessous :
 *   • une TÂCHE, une HABITUDE ;
 *   • une ÉTAPE (phase, sous-objectif) — un objectif qui a un parent ;
 *   • les étapes COMPTÉES par une habitude qui part : sans elle, elles ne
 *     mesureraient plus rien (« source introuvable ») et resteraient là.
 * Ce qui ne part JAMAIS : un objectif RACINE cité sur la carte (ce n'est pas
 * un morceau d'objectif, c'est l'objectif), une note, une fiche, un événement
 * — on ne détruit pas une ressource parce qu'on l'a citée (décision E).
 *
 * Tout va dans « Supprimés récemment » : 30 jours, et « Annuler » / ⌘Z.
 * Pur : les numéros locaux et l'écriture sont l'affaire de l'appelant.
 */
export interface ObjetEmporte {
  kind: "goal" | "task" | "habit";
  uid: string;
}

export function objetsEmportes(carte: Carte, id: string, goals: readonly Goal[]): ObjetEmporte[] {
  const parUid = new Map(goals.map((g) => [uidDeLigne("goal", g), g]));
  const out: ObjetEmporte[] = [];
  const vus = new Set<string>();
  const ajouter = (o: ObjetEmporte) => {
    const cle = `${o.kind}:${o.uid}`;
    if (vus.has(cle)) return;
    vus.add(cle);
    out.push(o);
  };

  for (const nid of sousArbre(carte, id)) {
    const n = carte.noeuds.find((x) => x.id === nid);
    const ref = n?.ref;
    if (!ref || n.mort) continue;
    if (ref.kind === "task") ajouter({ kind: "task", uid: ref.uid });
    else if (ref.kind === "habit") {
      ajouter({ kind: "habit", uid: ref.uid });
      for (const g of goals) {
        if (g.count_source === "habit" && g.count_ref_uid === ref.uid && g.parent_goal_id != null) {
          ajouter({ kind: "goal", uid: uidDeLigne("goal", g) });
        }
      }
    } else if (ref.kind === "goal") {
      const g = parUid.get(ref.uid);
      if (g && g.parent_goal_id != null) ajouter({ kind: "goal", uid: ref.uid });
    }
  }

  return sansDoublonDeLot(out, goals);
}

/**
 * Une étape dont un ANCÊTRE part aussi est déjà dans son lot : la corbeille
 * l'emporte avec lui (`descendantsVivants`). La jeter à part ferait deux lots,
 * et « Annuler » restaurerait deux fois.
 */
function sansDoublonDeLot(out: readonly ObjetEmporte[], goals: readonly Goal[]): ObjetEmporte[] {
  const parUid = new Map(goals.map((g) => [uidDeLigne("goal", g), g]));
  const partants = new Set(out.filter((o) => o.kind === "goal").map((o) => parUid.get(o.uid)?.id));
  const aUnAncetrePartant = (g: Goal) => {
    const vusG = new Set<number>([g.id]);
    for (let p = g.parent_goal_id; p != null; ) {
      if (vusG.has(p)) break;
      vusG.add(p);
      if (partants.has(p)) return true;
      p = goals.find((x) => x.id === p)?.parent_goal_id ?? null;
    }
    return false;
  };
  return out.filter((o) => {
    if (o.kind !== "goal") return true;
    const g = parUid.get(o.uid);
    return !g || !aUnAncetrePartant(g);
  });
}

/**
 * ⭐ UNE CARTE QUI DISPARAÎT EN ENTIER — sa note supprimée, sa fiche du Savoir
 * supprimée, ou « Supprimer la carte » sur son bloc (2026-09-30).
 *
 * Antonin : « si une carte mentale liée à un objectif est supprimée, les tâches
 * liées le soient aussi ». C'est la règle du nœud, appliquée à la racine :
 * retirer toute la carte emporte exactement ce que supprimer sa racine
 * emporterait. Rien de plus — jamais l'objectif racine cité, jamais une note
 * ou une fiche citée (décision E).
 *
 * Plusieurs cartes (une note peut en porter plusieurs) : chaque objet une fois.
 */
export function objetsDesCartes(cartes: readonly Carte[], goals: readonly Goal[]): ObjetEmporte[] {
  const out: ObjetEmporte[] = [];
  const vus = new Set<string>();
  for (const carte of cartes) {
    const racine = carte.noeuds.find((n) => n.parent === null);
    if (!racine) continue;
    for (const o of objetsEmportes(carte, racine.id, goals)) {
      const cle = `${o.kind}:${o.uid}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      out.push(o);
    }
  }
  return sansDoublonDeLot(out, goals);
}

/**
 * Combien d'objets une carte emporterait — lu dans la carte SEULE, sans la
 * base. Sert à la confirmation du menu, qui doit se construire sans attendre :
 * elle dit QU'il y a des objets, jamais combien (le toast d'après donne le
 * compte exact, lu en base). Un objectif cité avec le genre « objectif » est
 * une racine : il reste.
 */
export function compteEmportable(carte: Carte): number {
  return carte.noeuds.filter((n) => {
    if (!n.ref || n.mort) return false;
    if (n.ref.kind === "task" || n.ref.kind === "habit") return true;
    return n.ref.kind === "goal" && (n.genre === "phase" || n.genre === "sous-objectif");
  }).length;
}

/** Des objets emportés (par uid) aux lignes locales que la corbeille attend, avec leur titre. */
export function resoudreEmportes(
  objets: readonly ObjetEmporte[],
  data: { goals: readonly Goal[]; tasks: readonly Task[]; habits: readonly Habit[] },
): { kind: ObjetEmporte["kind"]; id: number; titre: string }[] {
  const out: { kind: ObjetEmporte["kind"]; id: number; titre: string }[] = [];
  for (const o of objets) {
    if (o.kind === "goal") {
      const g = data.goals.find((x) => uidDeLigne("goal", x) === o.uid);
      if (g) out.push({ kind: "goal", id: g.id, titre: g.title });
    } else if (o.kind === "task") {
      const x = data.tasks.find((y) => uidDeLigne("task", y) === o.uid);
      if (x) out.push({ kind: "task", id: x.id, titre: x.label });
    } else {
      const h = data.habits.find((y) => uidDeLigne("habit", y) === o.uid);
      if (h) out.push({ kind: "habit", id: h.id, titre: h.name });
    }
  }
  return out;
}
