/**
 * L'écran de séance en grand (`components/timer/EcranTimer.tsx`) : ce qu'il
 * décide, sorti du JSX pour être testé (2026-10-12).
 *
 * Logique pure : ni DOM, ni horloge.
 */

/** Ce qu'on lit d'une touche. */
export interface ToucheLue {
  key: string;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat?: boolean;
}

export type GesteClavier = "pause" | "sortir" | null;

/**
 * ⭐ CE QU'UNE TOUCHE FAIT SUR L'HORLOGE : Espace met en pause ou reprend,
 * Échap sort (réduit le plein écran : la séance continue).
 *
 *   • `surCommande` : la touche est partie d'un bouton. Espace y fait déjà son
 *     effet natif (il ACTIVE le bouton) : le compter ici aussi basculerait la
 *     pause deux fois — ou mettrait en pause en même temps que « Terminer » ;
 *   • une touche tenue (`repeat`) ne bascule pas la pause en rafale ;
 *   • une touche déjà prise par quelqu'un (`defaultPrevented`) ou accompagnée
 *     d'un modificateur (⌘, Ctrl, Alt) n'est pas pour l'horloge.
 */
export function gesteAuClavier(e: ToucheLue, surCommande: boolean, peutSortir: boolean): GesteClavier {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return null;
  if (e.key === " " || e.key === "Spacebar") return surCommande || e.repeat ? null : "pause";
  if (e.key === "Escape") return peutSortir ? "sortir" : null;
  return null;
}

/**
 * Le libellé d'une séance lancée sans tâche ni intitulé : c'est ce qu'écrivent
 * le widget d'Aujourd'hui, le panneau du Timer et la palette. Il voyage tel
 * quel jusqu'à la fenêtre séparée — c'est une valeur, pas un texte affiché.
 */
export const LIBELLE_SANS_TACHE = "Focus";

/**
 * ⭐ SUR QUOI ON TRAVAILLE — ce que l'écran écrit sous le genre de séance.
 *
 * Le nom de la tâche liée (ou l'intitulé tapé dans la palette) ; `libre` pour
 * une séance sans tâche — l'appelant y passe « Session libre », traduit : écrire
 * « Focus » sous « focus session » ne disait rien ; et rien pour une pause, que
 * le genre de séance annonce déjà.
 */
export function nomDeLaSeance(seance: { label: string; kind: "focus" | "break" }, libre: string): string | null {
  if (seance.kind === "break") return null;
  const nom = seance.label.trim();
  return nom && nom !== LIBELLE_SANS_TACHE ? nom : libre;
}

/**
 * ⭐ L'HORLOGE ÉPURÉE AU DOIGT (audit du 20/10, constat 10).
 *
 * L'horloge seule est la décision d'Antonin du 2026-09-30 : au repos, rien
 * d'autre à l'écran. Mais au doigt, il n'y a ni Échap ni double-clic qu'on
 * devine : sur tablette et téléphone, le plein écran n'avait AUCUNE commande,
 * et la seule sortie (un toucher sur iOS, un double toucher ailleurs) n'était
 * annoncée nulle part. Deux utilisateurs simulés sur deux s'y sont crus enfermés.
 *
 * La règle : au doigt, un toucher FAIT PARAÎTRE les commandes (Pause / Reprendre,
 * Réduire) pendant quelques secondes, puis elles s'effacent ; un second toucher
 * sur le vide les efface tout de suite. À l'ouverture, elles se montrent une
 * première fois, le temps d'apprendre qu'elles existent. À la souris rien ne
 * change : Échap ou un double-clic sortent, un simple clic ne fait rien (il
 * redonne seulement la main à la fenêtre).
 */
export type GesteHorloge = "montrer" | "cacher" | "sortir" | null;

/** Combien de temps les commandes restent à l'écran après un toucher. */
export const DUREE_COMMANDES_MS = 4000;

export function gesteSurHorloge(o: { auDoigt: boolean; double: boolean; commandesVisibles: boolean }): GesteHorloge {
  if (o.double) return o.auDoigt ? null : "sortir";
  if (!o.auDoigt) return null;
  return o.commandesVisibles ? "cacher" : "montrer";
}
