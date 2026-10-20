import { t } from "../i18n";
import { aRelancer, etatDe } from "../taches";
import type { EtatTache, Task } from "../types";

/**
 * Les MOTS de l'état d'une tâche (migration 031) — un seul endroit, pour le
 * menu « État », la fenêtre « Modifier la tâche » et les badges
 * (`components/taches/BadgeEtat.tsx`). `lib/taches.ts` reste sans i18n.
 */
export function nomDEtat(etat: EtatTache): string {
  switch (etat) {
    case "todo":
      return t("À faire");
    case "doing":
      return t("En cours");
    case "waiting":
      return t("En attente");
    case "dropped":
      return t("Abandonnée");
  }
}

/**
 * ⭐ Le badge d'état à montrer là où la tâche paraît (audit 2026-10-20, constat
 * d'usage 21 : « les états ne se voient que dans Tâches »). `null` pour une
 * tâche à faire, ou FAITE : cochée, elle est faite quel que soit son état
 * (« Terminée » n'est pas un état, c'est la case).
 *
 * « À relancer » remplace « En attente » le jour de la relance : c'est ce jour-là
 * que la tâche remonte, et c'est ce qu'il faut lire.
 */
export type BadgeEtat = "en-cours" | "en-attente" | "a-relancer" | "abandonnee";

export function badgeEtat(
  task: Pick<Task, "state" | "follow_up_on">,
  faite: boolean,
  jour: string,
): BadgeEtat | null {
  if (faite) return null;
  const etat = etatDe(task);
  if (etat === "doing") return "en-cours";
  if (etat === "dropped") return "abandonnee";
  if (etat === "waiting") return aRelancer(task, jour) ? "a-relancer" : "en-attente";
  return null;
}

/** Le badge d'une entrée du calendrier (`EntreeAgenda`), qui porte l'état et la relance. */
export function badgeDEntree(
  e: { etat?: EtatTache; faite: boolean | null; relance?: string | null },
  jour: string,
): BadgeEtat | null {
  if (!e.etat) return null;
  return badgeEtat({ state: e.etat, follow_up_on: e.relance ?? null }, !!e.faite, jour);
}
