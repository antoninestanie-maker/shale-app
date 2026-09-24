/**
 * Le menu contextuel des BLOCS d'une note — carte mentale, croquis, image,
 * pièce jointe — pour les DEUX éditeurs de l'app (`RichNoteEditor` des Notes,
 * `NoteComposer` du Savoir). Écrit une fois : deux copies divergeraient au
 * premier correctif.
 *
 * ⚠️ RÈGLE 18 — « Modifier la carte… » et « Modifier le croquis… » appellent
 * EXACTEMENT ce que fait le double-clic de l'éditeur ; « Ouvrir » une pièce
 * jointe, ce que fait son clic. « Supprimer » retire le bloc par
 * `lib/blocsNote.ts`, et le toast « Annuler » le remet à sa place exacte.
 *
 * ⚠️ CONFIRMER CE QUI COÛTE À REFAIRE (demande d'Antonin, 2026-09-24) : une
 * carte qui a des branches, un croquis. La question est posée DANS le menu
 * (`confirmation`), comme pour un objectif qui a des étapes. Une image ou une
 * pièce jointe se retirent sans question : l'image se recolle, et le FICHIER
 * d'une pièce jointe n'est pas supprimé — seul son jeton quitte la note.
 *
 * ⚠️ Hors d'un bloc, rien n'est intercepté : le menu du système (Copier,
 * Coller, orthographe) reste celui du texte.
 */

import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { IconExpand, IconPencil, IconTrash } from "../icons";
import MenuContextuel from "./MenuContextuel";
import { useMenuContextuel } from "./useMenuContextuel";
import { blocSous, nomDePiece, retirerBloc, type BlocNote } from "../../lib/blocsNote";
import { carteDuBloc } from "../../lib/carteDom";
import type { Carte } from "../../lib/carte";
import { pointeurGrossier } from "../../lib/menu/tactile";
import type { EntreePossible } from "../../lib/menu/entrees";
import { afficherToast } from "../../lib/toast";
import { t, tp } from "../../lib/i18n";
import { DUREE_ANNULER, titreCourt } from "../corbeille/geste";

export interface GestesBlocs {
  /** La racine `contenteditable` de l'éditeur. */
  racine: () => HTMLElement | null;
  /** Enregistre la note après un changement fait par le DOM (qui ne déclenche pas `onInput`). */
  enregistrer: () => void;
  /** En lecture seule, rien ne se retire : on ouvre, c'est tout. */
  lectureSeule: boolean;
  /** Le double-clic sur une carte. */
  modifierCarte: (figure: HTMLElement, carte: Carte) => void;
  /** Le double-clic sur un croquis — absent là où l'éditeur n'en dessine pas. */
  modifierCroquis?: (img: HTMLImageElement) => void;
  /** Le clic sur un jeton de pièce jointe. */
  ouvrirPiece: (uid: string) => void;
}

const LIBELLE_RETRAIT: Record<BlocNote["type"], string> = {
  // Valeurs FRANÇAISES, traduites à l'affichage — jamais `t()` dans une
  // constante de module (PASSATION § 14.2).
  carte: "Carte mentale retirée de la note",
  croquis: "Croquis retiré de la note",
  image: "Image retirée de la note",
  piece: "« {nom} » retiré de la note",
};

function titreDeCarte(c: Carte | null): string {
  return c?.noeuds.find((n) => n.parent === null)?.texte.trim() ?? "";
}

export function useMenuBlocs(g: GestesBlocs): {
  /** À poser en `onContextMenu` sur la racine de l'éditeur. */
  surClicDroit: (e: ReactMouseEvent) => void;
  /**
   * À appeler en tête du `onClick` de l'éditeur. Au doigt, toucher un bloc
   * ouvre son menu (il n'y a ni clic droit ni survol) ; rend VRAI si c'est fait.
   */
  surToucher: (e: ReactMouseEvent) => boolean;
  menu: ReactNode;
} {
  const etat = useMenuContextuel<BlocNote>();

  const surClicDroit = (e: ReactMouseEvent) => {
    const bloc = blocSous(e.target, g.racine());
    if (!bloc) return; // du texte : le menu du système
    etat.ouvrirAuPoint(e, bloc);
  };

  const surToucher = (e: ReactMouseEvent) => {
    if (!pointeurGrossier()) return false;
    const bloc = blocSous(e.target, g.racine());
    // Une pièce jointe s'ouvre toujours d'un toucher : c'est son geste.
    if (!bloc || bloc.type === "piece") return false;
    e.preventDefault();
    etat.ouvrirSurElement(bloc.element, bloc);
    return true;
  };

  const retirer = (bloc: BlocNote) => {
    const remettre = retirerBloc(bloc);
    g.enregistrer();
    afficherToast({
      msg: t(LIBELLE_RETRAIT[bloc.type], { nom: titreCourt(nomDePiece(bloc.element), 30) }),
      icone: <IconTrash className="h-5 w-5 shrink-0 text-text-dim" />,
      actionLabel: t("Annuler"),
      duree: DUREE_ANNULER,
      onAction: () => {
        if (remettre()) {
          g.enregistrer();
          return;
        }
        afficherToast({ msg: t("La note a changé entre-temps : le bloc n'a pas pu être remis.") });
      },
    });
  };

  const entrees = (bloc: BlocNote): EntreePossible[] => {
    const figee = g.lectureSeule ? { raison: t("Passe en écriture pour modifier la note.") } : undefined;
    const supprimer = (libelle: string, confirmation?: { libelle: string; detail: string }) => ({
      id: "supprimer",
      libelle,
      icone: <IconTrash />,
      danger: true,
      desactive: figee,
      confirmation,
      executer: () => retirer(bloc),
    });

    switch (bloc.type) {
      case "carte": {
        const c = carteDuBloc(bloc.element);
        const branches = Math.max(0, (c?.noeuds.length ?? 1) - 1);
        const titre = titreDeCarte(c);
        return [
          c && {
            id: "modifier",
            libelle: t("Modifier la carte…"),
            icone: <IconPencil />,
            desactive: figee,
            executer: () => g.modifierCarte(bloc.element, c),
          },
          supprimer(
            t("Supprimer la carte"),
            // Une carte vide se retire sans question : il n'y a rien à perdre.
            branches > 0
              ? {
                  libelle: t("Supprimer la carte"),
                  detail: titre
                    ? tp(branches, "« {titre} » et sa branche quittent la note.", "« {titre} » et ses {n} branches quittent la note.", { titre: titreCourt(titre, 30) })
                    : tp(branches, "La carte et sa branche quittent la note.", "La carte et ses {n} branches quittent la note.")
                }
              : undefined,
          ),
        ];
      }
      case "croquis": {
        const img = bloc.element.querySelector<HTMLImageElement>("img[data-sketch]") ??
          (bloc.element instanceof HTMLImageElement ? bloc.element : null);
        const modifier = g.modifierCroquis;
        return [
          img && modifier && {
            id: "modifier",
            libelle: t("Modifier le croquis…"),
            icone: <IconPencil />,
            desactive: figee,
            executer: () => modifier(img),
          },
          supprimer(t("Supprimer le croquis"), {
            libelle: t("Supprimer le croquis"),
            detail: t("Le dessin quitte la note. « Annuler » le remet juste après."),
          }),
        ];
      }
      case "image":
        return [supprimer(t("Supprimer l'image"))];
      case "piece": {
        const uid = bloc.element.dataset.fichier;
        const morte = bloc.element.classList.contains("piece-jointe-morte");
        return [
          !!uid && {
            id: "ouvrir",
            libelle: t("Ouvrir"),
            icone: <IconExpand />,
            desactive: morte ? { raison: t("Ce fichier a été supprimé.") } : undefined,
            executer: () => g.ouvrirPiece(uid),
          },
          // Le FICHIER reste : seul le jeton quitte la note. D'où « Retirer ».
          supprimer(t("Retirer de la note")),
        ];
      }
    }
  };

  const menu = (
    <MenuContextuel
      etat={etat}
      libelle={t("Actions sur le bloc")}
      // Recalculé à chaque rendu : un bloc retiré entre-temps (⌘Z, autre note)
      // ferme le menu au lieu d'agir sur un nœud détaché.
      entrees={etat.cible && etat.cible.element.isConnected ? entrees(etat.cible) : []}
    />
  );

  return { surClicDroit, surToucher, menu };
}
