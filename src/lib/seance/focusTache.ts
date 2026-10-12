/**
 * ⭐ « FOCUS 25 MIN » SUR UNE TÂCHE — ce que le geste fait, selon l'état du
 * minuteur (2026-10-12, retour d'Antonin : « je n'arrive pas à tout le temps
 * lancer le focus depuis la tâche »).
 *
 * LE DÉFAUT. Chaque vue décidait seule : `focus && !focus.session ? … :
 * undefined`. Dès qu'une séance existait — y compris la PAUSE que le minuteur
 * enchaîne tout seul après 25 minutes, ou une séance mise en pause — l'entrée
 * disparaissait du menu sans un mot. Le Calendrier, la feuille de route d'un
 * objectif ne la recevaient jamais. Une tâche cochée non plus.
 *
 * LA RÈGLE, écrite une fois ici : l'entrée est TOUJOURS là. Elle agit quand
 * elle le peut, et quand elle ne le peut pas elle est grisée et dit pourquoi.
 *
 * Logique pure : ni React, ni horloge, ni base. Les libellés (traduits) sont
 * construits à côté, dans `libelleFocus` — jamais dans une constante.
 */

import { t } from "../i18n";

/** La durée d'un focus lancé depuis une tâche. */
export const MINUTES_FOCUS_TACHE = 25;

/** Ce que la règle a besoin de savoir de la séance en cours. */
export interface SeanceVue {
  kind: "focus" | "break";
  taskId: number | null;
  label: string;
}

export interface EtatMinuteur {
  seance: SeanceVue | null;
  enPause: boolean;
}

export const MINUTEUR_AU_REPOS: EtatMinuteur = { seance: null, enPause: false };

export type RegleFocus =
  /** Rien ne tourne : on lance. */
  | { quoi: "lancer" }
  /**
   * Une PAUSE tourne (enchaînée après une séance, ou lancée à la main) : on
   * lance quand même. La pause est close proprement, le focus prend sa place.
   */
  | { quoi: "lancer-sur-pause" }
  /** La séance de CETTE tâche est en pause : le geste la reprend. */
  | { quoi: "reprendre" }
  /** Le geste ne peut rien : l'entrée est grisée, avec sa raison. */
  | { quoi: "rien"; pourquoi: "faite" | "deja-ici" | "ailleurs"; ou: string };

/**
 * @param tache `null` pour une séance libre (la palette, sans nom de tâche).
 * @param faite la tâche est cochée, là où l'on est.
 */
export function regleFocus(tache: { id: number } | null, faite: boolean, etat: EtatMinuteur): RegleFocus {
  // Une tâche cochée : on ne travaille pas sur ce qui est fait. La rouvrir d'abord.
  if (tache && faite) return { quoi: "rien", pourquoi: "faite", ou: "" };
  const { seance, enPause } = etat;
  if (!seance) return { quoi: "lancer" };
  // ⚠️ Une pause n'est pas du travail en cours : personne ne perd rien à la
  // couper. C'est le cas qui faisait dire « ça ne marche pas tout le temps » —
  // cinq minutes après chaque séance, l'entrée n'existait plus.
  if (seance.kind === "break") return { quoi: "lancer-sur-pause" };
  if (tache && seance.taskId === tache.id) {
    return enPause ? { quoi: "reprendre" } : { quoi: "rien", pourquoi: "deja-ici", ou: seance.label };
  }
  // ⚠️ Une séance de travail sur AUTRE CHOSE ne se remplace pas en silence :
  // ce serait couper court à un travail compté. On le dit.
  return { quoi: "rien", pourquoi: "ailleurs", ou: seance.label };
}

/** Le geste agit-il ? Le ▶ d'Aujourd'hui ne se montre que dans ce cas. */
export function focusPossible(regle: RegleFocus): boolean {
  return regle.quoi !== "rien";
}

/**
 * Ce que l'entrée écrit. Le libellé d'une entrée grisée DIT l'état : au doigt
 * il n'y a pas d'info-bulle pour lire la raison.
 */
export function libelleFocus(regle: RegleFocus): { libelle: string; raison?: string } {
  switch (regle.quoi) {
    case "lancer":
    case "lancer-sur-pause":
      return { libelle: t("Focus {n} min", { n: MINUTES_FOCUS_TACHE }) };
    case "reprendre":
      return { libelle: t("Reprendre le focus") };
    case "rien":
      if (regle.pourquoi === "faite") {
        return {
          libelle: t("Focus {n} min", { n: MINUTES_FOCUS_TACHE }),
          raison: t("Cette tâche est faite. Rouvre-la pour lancer un focus."),
        };
      }
      if (regle.pourquoi === "deja-ici") {
        return { libelle: t("Focus en cours"), raison: t("Une session tourne déjà sur cette tâche.") };
      }
      return {
        libelle: t("Autre session en cours"),
        raison: t("Une session tourne sur « {label} ». Termine-la pour lancer un focus ici.", { label: regle.ou }),
      };
  }
}

/**
 * ⭐ LANCER UNE SÉANCE N'OUVRE PAS LE PLEIN ÉCRAN (2026-10-12, Antonin : « le
 * focus qu'on lance depuis une tâche ne doit pas être le mode plein écran
 * complet. Ça, c'est seulement si l'utilisateur le décide. »).
 *
 * Le plein écran ne s'ouvre que si on le DEMANDE (`demande === true`) ; sinon
 * il reste comme il était. C'est aussi la règle de la pause qui s'enchaîne :
 * elle ne demande rien, donc elle garde l'état de la séance qui finit.
 */
export function pleinEcranApresDemarrage(ouvert: boolean, demande: boolean | undefined): boolean {
  return demande === true ? true : ouvert;
}
