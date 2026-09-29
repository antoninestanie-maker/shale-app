import { sousArbre, type Carte } from "../carte";
import type { Goal } from "../types";
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

  // Une étape dont un ANCÊTRE part aussi est déjà dans son lot : la corbeille
  // l'emporte avec lui (`descendantsVivants`). La jeter à part ferait deux lots,
  // et « Annuler » restaurerait deux fois.
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
