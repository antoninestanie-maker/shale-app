import type { ReactNode } from "react";
import {
  IconCalendar,
  IconCheck,
  IconFolder,
  IconNote,
  IconTarget,
  IconTrendUp,
} from "../icons";
import type { LinkKind } from "../../lib/types";

/**
 * Comment chaque famille d'objets se nomme et se dessine.
 *
 * ⚠️ Les libellés gardent la phrase FRANÇAISE et sont traduits à l'affichage
 * (`{t(LIBELLE_DE_KIND[k])}`) : un `t()` dans une constante de module serait
 * évalué à l'import, donc figé dans la langue de démarrage.
 */
export const LIBELLE_DE_KIND: Record<LinkKind, string> = {
  note: "Note",
  knowledge: "Savoir",
  task: "Tâche",
  goal: "Objectif",
  event: "Événement",
  trade: "Trade",
  object: "Objet",
};

/** Au pluriel — les en-têtes de section du panneau « Mentionné dans ». */
export const LIBELLE_PLURIEL: Record<LinkKind, string> = {
  note: "Notes",
  knowledge: "Fiches du Savoir",
  task: "Tâches",
  goal: "Objectifs",
  event: "Événements",
  trade: "Trades",
  object: "Objets",
};

export const ICONE_DE_KIND: Record<LinkKind, ReactNode> = {
  note: <IconNote className="h-4 w-4" />,
  knowledge: <IconFolder className="h-4 w-4" />,
  task: <IconCheck className="h-4 w-4" />,
  goal: <IconTarget className="h-4 w-4" />,
  event: <IconCalendar className="h-4 w-4" />,
  trade: <IconTrendUp className="h-4 w-4" />,
  object: <IconFolder className="h-4 w-4" />,
};
