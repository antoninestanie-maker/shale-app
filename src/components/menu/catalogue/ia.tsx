/**
 * Ce que l'IA propose sur une NOTE — le catalogue commun aux deux éditeurs
 * (barre d'outils des Notes, bulle de sélection du Savoir), décision Q6 de
 * l'audit : pas de nouvelle barre, UN bouton, et derrière lui ce menu.
 *
 * Des DONNÉES (`EntreeMenu`), comme tout menu de l'app : le même tableau se
 * teste sans DOM. `t()` à la construction, jamais dans une constante de module.
 */

import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { IconeIa } from "../../ia/IconeIa";

export type TonReecriture = "clair" | "court" | "pro";
export const TONS: readonly TonReecriture[] = ["clair", "court", "pro"];

export type LangueCible = "fr" | "en" | "es" | "de" | "it" | "pt";
export const LANGUES_CIBLES: readonly LangueCible[] = ["en", "fr", "es", "de", "it", "pt"];

export type ActionNoteIa =
  | { genre: "resumer" }
  | { genre: "reecrire"; ton: TonReecriture }
  | { genre: "developper" }
  | { genre: "liens" }
  | { genre: "traduire"; cible: LangueCible }
  | { genre: "carte" };

export function nomDeTon(ton: TonReecriture): string {
  return ton === "clair" ? t("Plus clair") : ton === "court" ? t("Plus court") : t("Ton professionnel");
}

export function nomDeLangue(l: LangueCible): string {
  switch (l) {
    case "fr":
      return t("Français");
    case "en":
      return t("Anglais");
    case "es":
      return t("Espagnol");
    case "de":
      return t("Allemand");
    case "it":
      return t("Italien");
    case "pt":
      return t("Portugais");
  }
}

export interface ContexteNoteIa {
  /** Du texte est-il sélectionné dans la note ? */
  selection: boolean;
}

export function entreesIaNote(choisir: (a: ActionNoteIa) => void, ctx: ContexteNoteIa): EntreePossible[] {
  const icone = <IconeIa className="h-[1em] w-[1em]" />;
  return [
    { id: "ia-resumer", libelle: t("Résumer la note"), icone, executer: () => choisir({ genre: "resumer" }) },
    {
      id: "ia-reecrire",
      libelle: ctx.selection ? t("Réécrire la sélection") : t("Réécrire la note"),
      icone,
      sousMenu: TONS.map((ton) => ({
        id: `ia-reecrire-${ton}`,
        libelle: nomDeTon(ton),
        icone,
        executer: () => choisir({ genre: "reecrire", ton }),
      })),
    },
    {
      id: "ia-developper",
      libelle: t("Développer la sélection"),
      icone,
      // Développer part de QUELQUES puces : sans sélection, l'IA ne saurait pas lesquelles.
      desactive: ctx.selection ? undefined : { raison: t("Sélectionne d'abord les puces à développer.") },
      executer: () => choisir({ genre: "developper" }),
    },
    { id: "ia-liens", libelle: t("Suggérer des liens @"), icone, executer: () => choisir({ genre: "liens" }) },
    {
      id: "ia-traduire",
      libelle: t("Traduire la note"),
      icone,
      sousMenu: LANGUES_CIBLES.map((cible) => ({
        id: `ia-traduire-${cible}`,
        libelle: nomDeLangue(cible),
        icone,
        executer: () => choisir({ genre: "traduire", cible }),
      })),
    },
    { id: "ia-carte", libelle: t("Faire une carte mentale"), icone, executer: () => choisir({ genre: "carte" }) },
  ];
}
