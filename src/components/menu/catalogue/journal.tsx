/**
 * Ce qu'un menu contextuel propose dans le JOURNAL : sur l'ENTRÉE DU JOUR et
 * sur une HABITUDE.
 *
 * ⚠️ RÈGLE 18 — « Cocher pour aujourd'hui » est la case de la ligne ;
 * « Supprimer » appelle `jeter()`, comme la croix de la ligne. L'entrée du jour
 * n'avait AUCUN moyen d'être effacée avant ce chantier (Phase 0) : son bouton
 * « ⋯ » et ce menu sont les deux faces du même geste.
 *
 * ⚠️ `t()` à la construction, jamais dans une constante de module.
 */

import { IconCheck, IconTrash, IconX } from "../../icons";
import { IconCopier } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { copierTexte } from "../../../lib/menu/pressePapier";
import type { Habit } from "../../../lib/types";

export interface GestesJour {
  /** Écrit ce qui est en vol, puis met l'entrée en corbeille. */
  effacer: () => Promise<void>;
}

export function entreesJour(texte: string, existe: boolean, gestes: GestesJour): EntreePossible[] {
  return [
    {
      id: "copier",
      libelle: t("Copier le texte"),
      icone: <IconCopier />,
      desactive: texte.trim() ? undefined : { raison: t("L'entrée du jour est vide.") },
      executer: async () => {
        await copierTexte(texte);
      },
    },
    {
      id: "effacer",
      libelle: t("Effacer l'entrée du jour"),
      icone: <IconTrash />,
      danger: true,
      desactive: existe ? undefined : { raison: t("Rien n'est encore écrit aujourd'hui.") },
      executer: () => gestes.effacer(),
    },
  ];
}

export interface GestesHabitude {
  /** La case de la ligne, pour aujourd'hui. */
  basculer: (h: Habit) => void;
  supprimer: (h: Habit) => Promise<void>;
}

export function entreesHabitude(h: Habit, cocheeAujourdhui: boolean, gestes: GestesHabitude): EntreePossible[] {
  return [
    {
      id: "basculer",
      libelle: cocheeAujourdhui ? t("Décocher pour aujourd'hui") : t("Cocher pour aujourd'hui"),
      icone: cocheeAujourdhui ? <IconX /> : <IconCheck />,
      executer: () => gestes.basculer(h),
    },
    { id: "supprimer", libelle: t("Supprimer"), icone: <IconTrash />, danger: true, executer: () => gestes.supprimer(h) },
  ];
}
