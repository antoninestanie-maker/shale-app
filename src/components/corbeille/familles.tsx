/**
 * À quel MODULE appartient chaque famille d'objets de la corbeille — pour la
 * vue « Supprimés récemment » (regroupement, icône, nom) et pour « Voir »
 * après une restauration.
 *
 * ⭐ L'ICÔNE EST CELLE DU MODULE DANS LA BARRE LATÉRALE (`BY_ID`), pas une
 * icône de plus : un objet dans la corbeille doit se reconnaître d'un coup
 * d'œil au même signe que l'onglet d'où il vient.
 *
 * ⚠️ Les noms de module sont des phrases FRANÇAISES, traduites À L'AFFICHAGE
 * par l'appelant (`t(famille.module)`) — jamais `t()` dans cette constante,
 * qui serait figée dans la langue de démarrage (PASSATION § 14.2).
 */

import type { ReactNode } from "react";
import { BY_ID, type View } from "../Sidebar";
import type { KindCorbeille } from "../../lib/corbeille/regles";

export interface Famille {
  /** Le module d'origine, en français — à passer à `t()` à l'affichage. */
  module: string;
  /** La vue où l'objet vit. */
  vue: View;
}

export const FAMILLES: Readonly<Record<KindCorbeille, Famille>> = {
  note: { module: "Notes", vue: "notes" },
  task: { module: "Tâches", vue: "tasks" },
  goal: { module: "Objectifs", vue: "goals" },
  event: { module: "Calendrier", vue: "calendar" },
  object: { module: "Savoir", vue: "knowledge" },
  knowledge: { module: "Savoir", vue: "knowledge" },
  invoice: { module: "Finance", vue: "finance" },
  journal: { module: "Journal", vue: "journal" },
  // Les habitudes vivent dans le Journal, les métriques dans Performance.
  habit: { module: "Journal", vue: "journal" },
  metric: { module: "Performance", vue: "performance" },
};

/** L'icône du module d'origine, telle que la barre latérale la montre. */
export function iconeDeFamille(kind: KindCorbeille): ReactNode {
  return BY_ID.get(FAMILLES[kind].vue)?.icon ?? null;
}
