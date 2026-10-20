import { t } from "../../lib/i18n";
import { natureDe } from "../../lib/objectifs/structure";
import type { Goal } from "../../lib/types";
import { IconEtape, IconFolder, IconTarget } from "../icons";

/**
 * ⭐ L'ICÔNE D'UNE LIGNE DE `goals`, D'APRÈS CE QU'ELLE EST — la cible pour un
 * objectif, le dossier pour une phase, le losange pour une étape : le
 * vocabulaire de la feuille de route et de la carte (DESIGN.md, « Les types de
 * nœud »).
 *
 * Contrôle du 12/10, rang 22 (toujours présent à l'audit du 2026-10-20) : une
 * tâche rattachée à une ÉTAPE montrait, dans Tâches, l'icône d'un objectif —
 * on croyait l'étape un objectif à part entière.
 */
export function IconeNature({ goal, goals, className }: { goal: Pick<Goal, "id" | "parent_goal_id">; goals: readonly Pick<Goal, "parent_goal_id">[]; className?: string }) {
  const nature = natureDe(goal, goals);
  if (nature === "phase") return <IconFolder className={className} />;
  if (nature === "etape") return <IconEtape className={className} />;
  return <IconTarget className={className} />;
}

/** La bulle du lien qui ouvre la ligne : « Ouvrir l'objectif », ou « Ouvrir l'étape ». */
export function ouvrirNature(goal: Pick<Goal, "parent_goal_id">): string {
  return goal.parent_goal_id == null ? t("Ouvrir l'objectif") : t("Ouvrir l'étape");
}
