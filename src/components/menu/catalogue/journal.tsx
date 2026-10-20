/**
 * Ce qu'un menu contextuel propose dans le JOURNAL : sur l'ENTRÉE DU JOUR et
 * sur une HABITUDE.
 *
 * ⚠️ RÈGLE 18 — « Cocher pour aujourd'hui » (ou pour le jour choisi dans la
 * barre, 2026-10-13) est la case de la ligne ;
 * « Supprimer » appelle `jeter()`, comme la croix de la ligne. L'entrée du jour
 * n'avait AUCUN moyen d'être effacée avant ce chantier (Phase 0) : son bouton
 * « ⋯ » et ce menu sont les deux faces du même geste.
 *
 * ⚠️ `t()` à la construction, jamais dans une constante de module.
 */

import { IconCheck, IconPencil, IconTrash, IconX } from "../../icons";
import { IconCopier } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreeMenu, EntreePossible } from "../../../lib/menu/entrees";
import { PALETTE_HABITUDES } from "../../../lib/habitudes";
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
      desactive: existe ? undefined : { raison: t("Rien n'est encore écrit ce jour-là.") },
      executer: () => gestes.effacer(),
    },
  ];
}

export interface GestesHabitude {
  /** La case de la ligne, pour le jour choisi. */
  basculer: (h: Habit) => void;
  /** Ouvre le champ de la ligne — le même que le double-clic sur le nom (règle 18). */
  renommer: (h: Habit) => void;
  recolorer: (h: Habit, couleur: string) => void;
  supprimer: (h: Habit) => Promise<void>;
}

/** La pastille d'une couleur, à la place de l'icône d'une entrée. */
function Pastille({ couleur }: { couleur: string }) {
  return (
    <span
      aria-hidden
      className="block h-[0.85em] w-[0.85em] rounded-full ring-1 ring-inset ring-border"
      style={{ backgroundColor: couleur }}
    />
  );
}

/**
 * `jourEnLettres` : le jour choisi dans la barre du Journal quand ce n'est PAS
 * aujourd'hui (« lundi 12 octobre »), `null` sinon. L'entrée dit le jour
 * qu'elle coche — le même que la case de la ligne (règle 18).
 */
export function entreesHabitude(
  h: Habit,
  cochee: boolean,
  gestes: GestesHabitude,
  jourEnLettres: string | null = null,
): EntreePossible[] {
  const libelle = jourEnLettres
    ? cochee
      ? t("Décocher pour le {date}", { date: jourEnLettres })
      : t("Cocher pour le {date}", { date: jourEnLettres })
    : cochee
      ? t("Décocher pour aujourd'hui")
      : t("Cocher pour aujourd'hui");
  // La coche dit la couleur ACTUELLE ; la choisir de nouveau n'écrit rien.
  const couleurs: EntreeMenu[] = PALETTE_HABITUDES.map((c) => ({
    id: `couleur-${c.valeur}`,
    libelle: t(c.nom),
    icone: c.valeur === h.color ? <IconCheck /> : <Pastille couleur={c.valeur} />,
    executer: () => (c.valeur === h.color ? undefined : gestes.recolorer(h, c.valeur)),
  }));
  return [
    {
      id: "basculer",
      libelle,
      icone: cochee ? <IconX /> : <IconCheck />,
      executer: () => gestes.basculer(h),
    },
    { id: "renommer", libelle: t("Renommer"), icone: <IconPencil />, executer: () => gestes.renommer(h) },
    { id: "couleur", libelle: t("Couleur"), icone: <Pastille couleur={h.color} />, sousMenu: couleurs },
    { id: "supprimer", libelle: t("Supprimer"), icone: <IconTrash />, danger: true, executer: () => gestes.supprimer(h) },
  ];
}
