/**
 * Ce que le menu de la PASTILLE DE SÉANCE propose (2026-10-12, Antonin : « on
 * ne peut pas la fermer directement d'un clic droit »).
 *
 * Le même tableau nourrit le clic droit sur la pastille et son bouton « ⋯ »
 * (règle 17 : rien n'existe seulement au clic droit).
 *
 * ⚠️ RÈGLE 18 — chaque entrée appelle la fonction du geste qui existait déjà :
 *   • Pause / Reprendre → `pause` / `resume` du minuteur, comme le bouton de la
 *     pastille, la carte Timer d'Aujourd'hui et la page Timer ;
 *   • Terminer la session → `stop`, comme leur bouton ;
 *   • Ouvrir le Timer → `allerVers("timer")`, comme un clic sur la pastille ;
 *   • Plein écran → `setOverlayOpen(true)`, comme le bouton de la page Timer.
 *
 * ⚠️ « Terminer » n'est PAS rouge : le temps déjà fait est gardé, rien n'est
 * perdu. Le rouge est réservé à ce qui détruit.
 *
 * ⚠️ `t()` à la construction, jamais dans une constante de module.
 */

import { IconExpand, IconMinuteur, IconPause, IconPlay, IconStop } from "../../icons";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";

export interface GestesSeance {
  /** Met en pause, ou reprend. */
  basculerPause: () => void;
  terminer: () => void | Promise<unknown>;
  ouvrirTimer: () => void;
  pleinEcran: () => void;
}

export function entreesSeance(enPause: boolean, gestes: GestesSeance): EntreePossible[] {
  return [
    {
      id: "pause",
      libelle: enPause ? t("Reprendre") : t("Pause"),
      icone: enPause ? <IconPlay /> : <IconPause />,
      executer: gestes.basculerPause,
    },
    { id: "terminer", libelle: t("Terminer la session"), icone: <IconStop />, executer: gestes.terminer },
    { id: "ouvrir-timer", libelle: t("Ouvrir le Timer"), icone: <IconMinuteur />, executer: gestes.ouvrirTimer },
    { id: "plein-ecran", libelle: t("Plein écran"), icone: <IconExpand />, executer: gestes.pleinEcran },
  ];
}
