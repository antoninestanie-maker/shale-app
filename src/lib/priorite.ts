import { pick, t } from "./i18n";
import type { Priority } from "./types";

/**
 * ⭐ LA PRIORITÉ — d'une tâche comme d'une étape d'objectif (2026-09-30).
 *
 * Antonin : « donner un ordre de priorité aux étapes et aux tâches dès la
 * création […] faible, moyenne, élevée […] pas un mode avancé avec un poids, on
 * ne sait pas forcément ce que ça veut dire ». Le poids (migration 026) est
 * donc sorti de l'écran, et la priorité le remplace.
 *
 * ⚠️ TROIS niveaux, pas quatre. La colonne `tasks.priority` porte depuis la
 * 001 un `CHECK (priority IN ('low','medium','high'))` : un quatrième niveau
 * demanderait de RECONSTRUIRE la table des tâches (SQLite ne modifie pas un
 * CHECK), synchronisation comprise — pour un choix de plus à faire à chaque
 * création, dans un écran qu'Antonin trouve déjà trop chargé.
 *
 * ⚠️ La priorité ne change PAS l'avancement : chaque étape compte pour une.
 * Elle dit PAR OÙ COMMENCER — la couleur du repère, l'ordre des tâches d'une
 * étape, et la « prochaine action » d'un objectif (`prochaineAction.ts`).
 *
 * Des fonctions, jamais des constantes traduites (PIEGES § 5.2).
 */

/** L'ordre d'un sélecteur : une échelle, de la plus faible à la plus élevée. */
export const PRIORITES: readonly Priority[] = ["low", "medium", "high"];

/**
 * La priorité d'une ligne, lue sans surprise. `goals.priority` n'a PAS de
 * CHECK (migration 030) : une valeur inconnue — un appareil plus récent qui
 * synchronise — se lit « moyenne », comme `count_source` se lit « manual ».
 */
export function prioriteDe(x: { priority?: string | null }): Priority {
  const p = x.priority;
  return p === "low" || p === "high" || p === "medium" ? p : "medium";
}

/** Pour trier : l'élevée d'abord (0), la faible en dernier (2). */
export function rangPriorite(p: string | null | undefined): number {
  const q = prioriteDe({ priority: p });
  return q === "high" ? 0 : q === "medium" ? 1 : 2;
}

/** Le mot, dans la langue de l'app. */
export function nomDePriorite(p: string | null | undefined): string {
  const q = prioriteDe({ priority: p });
  return q === "high" ? t("Élevée") : q === "low" ? t("Faible") : t("Moyenne");
}

/** « Priorité élevée » / « High priority » — la bulle d'une case, d'une icône. */
export function phrasePriorite(p: string | null | undefined): string {
  const mot = nomDePriorite(p);
  return t("Priorité {p}", { p: pick(mot.toLocaleLowerCase("fr"), mot) });
}

/**
 * La couleur du repère — le contour de la case d'une tâche, l'icône d'une
 * étape. UNE règle pour toute l'app : rouge, jaune, rien. `undefined` = la
 * couleur par défaut de l'élément.
 */
export function couleurPriorite(p: string | null | undefined): string | undefined {
  const q = prioriteDe({ priority: p });
  return q === "high" ? "var(--color-red)" : q === "medium" ? "var(--color-yellow)" : undefined;
}
