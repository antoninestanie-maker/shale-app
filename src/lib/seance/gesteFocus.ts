/**
 * ⭐ LE GESTE « FOCUS » D'UNE TÂCHE — une seule fonction pour toute l'app
 * (règle 18) : le ▶ d'Aujourd'hui, l'entrée « Focus 25 min » de chaque menu de
 * tâche (Tâches, Aujourd'hui, En retard, Calendrier, feuille de route d'un
 * objectif) et la palette l'appellent tous.
 *
 * POURQUOI UN CONTEXTE ET PAS UNE PROP (2026-10-12). Le minuteur descendait de
 * vue en vue à la main ; le Calendrier et la feuille de route ne l'avaient
 * jamais reçu, et leur menu n'avait donc pas l'entrée. Le contexte le met à
 * portée de tout menu de tâche, sans traverser cinq composants.
 *
 * ⚠️ La valeur ne change QU'AUX CHANGEMENTS DE SENS (séance lancée, finie, mise
 * en pause) — pas à chaque seconde : `FocusController` porte le temps restant,
 * et le passer tel quel aurait fait redessiner chaque liste de tâches une fois
 * par seconde pendant toute une séance.
 */

import { createContext, useContext, useMemo } from "react";
import { t } from "../i18n";
import { afficherToast } from "../toast";
import type { FocusController } from "../useFocus";
import {
  libelleFocus,
  MINUTES_FOCUS_TACHE,
  MINUTEUR_AU_REPOS,
  regleFocus,
  type EtatMinuteur,
  type RegleFocus,
} from "./focusTache";

export interface GesteFocus {
  /** Ce que le minuteur fait en ce moment — de quoi appliquer `regleFocus`. */
  etat: EtatMinuteur;
  /**
   * Le geste. Il relit la règle au moment d'agir : lancer, lancer par-dessus
   * une pause, reprendre — ou ne rien faire quand l'entrée est grisée.
   * `tache` à `null` : une séance libre, nommée par `intitule` (la palette).
   * Rend la règle appliquée, pour qui veut dire ce qui s'est passé — `null`
   * si le démarrage a échoué (c'est déjà dit à l'écran).
   */
  agir: (tache: { id: number; label: string } | null, faite: boolean, intitule?: string) => Promise<RegleFocus | null>;
}

/** Ce que `agir` a besoin du minuteur. */
type Minuteur = Pick<FocusController, "session" | "paused" | "start" | "resume">;

export function etatDuMinuteur(focus: Pick<FocusController, "session" | "paused">): EtatMinuteur {
  if (!focus.session) return MINUTEUR_AU_REPOS;
  const { kind, taskId, label } = focus.session;
  return { seance: { kind, taskId, label }, enPause: focus.paused };
}

export function creerGesteFocus(focus: Minuteur): GesteFocus {
  const etat = etatDuMinuteur(focus);
  return {
    etat,
    async agir(tache, faite, intitule) {
      const regle = regleFocus(tache, faite, etat);
      try {
        if (regle.quoi === "reprendre") focus.resume();
        else if (regle.quoi === "lancer" || regle.quoi === "lancer-sur-pause") {
          // ⚠️ Pas de `openOverlay` : on reste où l'on est, la pastille apparaît.
          // Par-dessus une pause, c'est `start` qui la clôt (`useFocus`).
          await focus.start({
            minutes: MINUTES_FOCUS_TACHE,
            taskId: tache?.id ?? null,
            label: tache?.label ?? (intitule?.trim() || "Focus"),
          });
        }
      } catch (e) {
        // Un geste qui échoue le DIT : avant, la promesse rejetée était avalée
        // par un `void`, et l'entrée avait l'air de ne rien faire.
        console.error("Le focus n'a pas pu démarrer", e);
        afficherToast({ msg: t("Le focus n'a pas pu démarrer."), tone: "loss" });
        return null;
      }
      return regle;
    },
  };
}

export const ContexteFocus = createContext<GesteFocus | null>(null);

/** À poser dans `App.tsx`, une fois : la valeur du contexte. */
export function useGesteFocusDe(focus: FocusController): GesteFocus {
  const { session, paused, start, resume } = focus;
  return useMemo(() => creerGesteFocus({ session, paused, start, resume }), [session, paused, start, resume]);
}

/**
 * Le geste, là où un menu de tâche en a besoin. `null` hors de l'app (un test,
 * la fenêtre de capture) : l'entrée est alors omise.
 */
export function useGesteFocus(): GesteFocus | null {
  return useContext(ContexteFocus);
}

/** Ce qu'une vue montre pour une tâche : la règle, et son libellé. */
export function focusDeTache(geste: GesteFocus, tache: { id: number }, faite: boolean) {
  const regle = regleFocus(tache, faite, geste.etat);
  return { regle, ...libelleFocus(regle) };
}
