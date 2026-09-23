/**
 * Ce qu'un menu contextuel propose dans le SAVOIR : sur un SUJET (une case de
 * l'accueil) et sur une FICHE (une carte de note).
 *
 * ⚠️ RÈGLE 18 — CHAQUE ENTRÉE APPELLE LA FONCTION DU BOUTON QUI LUI CORRESPOND :
 *   • sujet : « Renommer… » ouvre le MÊME formulaire que le crayon de la case
 *     (il change aussi la teinte) ; « Avant / Après » sont les deux chevrons ;
 *     « Supprimer » ouvre la MÊME fenêtre de confirmation que la corbeille de
 *     la case, qui dit combien de notes passent « sans sujet » ;
 *   • fiche : « Épingler » est l'épingle de la carte ; « Supprimer » appelle
 *     `jeter()`, comme la corbeille de la carte et celle du lecteur.
 *
 * ⚠️ `t()` à la construction, jamais dans une constante de module.
 */

import { IconChevronUp, IconNote, IconPencil, IconPin, IconTrash } from "../../icons";
import { IconCopier } from "../icones";
import { t } from "../../../lib/i18n";
import type { EntreePossible } from "../../../lib/menu/entrees";
import { copierTexte } from "../../../lib/menu/pressePapier";
import type { KnowledgeEntryLite, Sujet } from "../../../lib/types";

// ─── Le sujet ────────────────────────────────────────────────────────────────

export interface GestesSujet {
  ouvrir: (s: Sujet) => void;
  /** Le formulaire en place de la case — le même que le crayon. */
  renommer: (s: Sujet) => void;
  deplacer: (s: Sujet, delta: -1 | 1) => void;
  /** La fenêtre de confirmation — la même que la corbeille de la case. */
  supprimer: (s: Sujet) => void;
}

export function entreesSujet(
  s: Sujet,
  gestes: GestesSujet,
  ctx: { premier: boolean; dernier: boolean },
): EntreePossible[] {
  return [
    { id: "ouvrir", libelle: t("Ouvrir"), icone: <IconNote />, executer: () => gestes.ouvrir(s) },
    { id: "renommer", libelle: t("Renommer…"), icone: <IconPencil />, executer: () => gestes.renommer(s) },
    {
      id: "avant",
      libelle: t("Déplacer avant"),
      icone: <IconChevronUp className="-rotate-90" />,
      desactive: ctx.premier ? { raison: t("Ce sujet est déjà le premier.") } : undefined,
      executer: () => gestes.deplacer(s, -1),
    },
    {
      id: "apres",
      libelle: t("Déplacer après"),
      icone: <IconChevronUp className="rotate-90" />,
      desactive: ctx.dernier ? { raison: t("Ce sujet est déjà le dernier.") } : undefined,
      executer: () => gestes.deplacer(s, 1),
    },
    {
      id: "supprimer",
      libelle: t("Supprimer…"),
      icone: <IconTrash />,
      danger: true,
      executer: () => gestes.supprimer(s),
    },
  ];
}

// ─── La fiche ────────────────────────────────────────────────────────────────

export interface GestesFiche {
  /** Exactement ce que fait le clic sur la carte. */
  ouvrir: (f: KnowledgeEntryLite) => void;
  /** L'épingle de la carte. */
  epingler: (f: KnowledgeEntryLite) => Promise<void>;
  /** La corbeille de la carte : `jeter()`. */
  supprimer: (f: KnowledgeEntryLite) => Promise<void>;
}

export function entreesFiche(f: KnowledgeEntryLite, gestes: GestesFiche): EntreePossible[] {
  return [
    { id: "ouvrir", libelle: t("Ouvrir"), icone: <IconNote />, executer: () => gestes.ouvrir(f) },
    {
      id: "epingler",
      libelle: f.pinned === 1 ? t("Désépingler") : t("Épingler"),
      icone: <IconPin />,
      executer: () => gestes.epingler(f),
    },
    {
      id: "copier-titre",
      libelle: t("Copier le titre"),
      icone: <IconCopier />,
      executer: async () => {
        await copierTexte(f.title);
      },
    },
    {
      id: "copier-texte",
      libelle: t("Copier le texte"),
      icone: <IconCopier />,
      // `text` est le texte brut que la liste garde pour la recherche : la liste
      // ne charge jamais le corps (images en data URL).
      desactive: f.text?.trim() ? undefined : { raison: t("Cette note est vide.") },
      executer: async () => {
        await copierTexte(f.text ?? "");
      },
    },
    { id: "supprimer", libelle: t("Supprimer"), icone: <IconTrash />, danger: true, executer: () => gestes.supprimer(f) },
  ];
}
