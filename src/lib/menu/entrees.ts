/**
 * Les entrées d'un menu contextuel — décrites comme des DONNÉES.
 *
 * ⭐ POURQUOI DES DONNÉES ET PAS DU JSX. Le même tableau d'entrées nourrit
 * DEUX rendus : le menu au clic droit et le menu « ⋯ ». Décrites en JSX, elles
 * auraient été écrites deux fois, et la deuxième aurait fini par diverger de la
 * première sans que rien ne le dise — c'est la règle 18 du cahier des charges,
 * prise à sa racine plutôt qu'à son symptôme.
 *
 * Corollaire : ce fichier ne contient AUCUN rendu. Il se teste sans DOM.
 */

import type { ReactNode } from "react";

/** Une entrée exécutable. */
export interface EntreeMenu {
  /**
   * Identifiant stable, propre au menu. Sert au suivi du focus clavier et aux
   * tests. ⚠️ PAS le libellé : le libellé est traduit, donc il change de langue,
   * et un test qui s'y accrocherait ne passerait qu'en français.
   */
  id: string;
  /** Déjà passé par `t()` au moment de la construction. */
  libelle: string;
  /** Icône PLUS un mot sur chaque entrée — demande littérale d'Antonin. */
  icone: ReactNode;
  /** Affiché à droite, gris. Déjà passé par `kbd()`. */
  raccourci?: string;
  /**
   * Action destructrice : rouge, et poussée EN DERNIER par `ordonner()`.
   * Le filet qui l'en sépare est posé par le rendu, pas par l'appelant.
   */
  danger?: boolean;
  /**
   * Entrée grisée. `raison` dit POURQUOI, en une phrase, et devient une
   * info-bulle. `undefined` quand la raison est évidente à l'écran : une bulle
   * qui répète ce qu'on voit est du bruit.
   */
  desactive?: { raison?: string };
  /** Sous-menu. Une entrée qui en porte un n'a pas d'`executer`. */
  sousMenu?: EntreeMenu[];
  /**
   * Ce que l'entrée fait.
   *
   * ⚠️ DOIT APPELER EXACTEMENT LA MÊME FONCTION que le bouton ou le raccourci
   * correspondant (règle 18). Une entrée qui réimplémente l'action diverge de
   * son jumeau au premier correctif.
   */
  executer?: () => void | Promise<void>;
}

/**
 * Le tableau que reçoit le composant : des entrées, et des `null` pour les
 * entrées qu'on ne veut pas ce coup-ci.
 *
 * ⚠️ `null` plutôt qu'un `filter` chez l'appelant : cela permet d'écrire
 * `condition && {…}` en ligne, sans casser la lecture du catalogue.
 */
export type EntreePossible = EntreeMenu | null | false | undefined;

/** Vrai si l'entrée peut être activée (ni grisée, ni vide). */
export function activable(e: EntreeMenu): boolean {
  return !e.desactive && (!!e.executer || !!e.sousMenu?.length);
}

/**
 * Met le catalogue en forme : on écarte les trous, et les actions
 * destructrices descendent EN DERNIER.
 *
 * ⭐ L'ORDRE EST IMPOSÉ ICI, PAS DEMANDÉ AUX APPELANTS. « Supprimer en
 * dernier » est une règle d'interface qui vaut pour les dix-sept surfaces du
 * catalogue : la faire respecter par la discipline, c'est accepter qu'elle soit
 * fausse une fois sur dix-sept, dans l'écran qu'on regarde le moins.
 *
 * Le tri est STABLE : deux entrées de même famille gardent leur ordre d'écriture,
 * qui est celui du catalogue — de la plus fréquente à la moins fréquente.
 */
export function ordonner(entrees: readonly EntreePossible[]): EntreeMenu[] {
  const vraies = entrees.filter((e): e is EntreeMenu => !!e);
  return [...vraies.filter((e) => !e.danger), ...vraies.filter((e) => e.danger)];
}

/**
 * Rang de la première entrée destructrice, ou -1.
 *
 * C'est là que le rendu pose son filet. Calculé plutôt que porté par une entrée
 * « séparateur » : un séparateur dans les données peut se retrouver en tête ou
 * en double après un filtrage, et il faudrait alors le nettoyer.
 */
export function rangDuFilet(entrees: readonly EntreeMenu[]): number {
  const i = entrees.findIndex((e) => e.danger);
  return i > 0 ? i : -1;
}
