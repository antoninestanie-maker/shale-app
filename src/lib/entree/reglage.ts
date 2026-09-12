import { getSetting, setSetting } from "../repo";

/**
 * Combien d'entrée on veut, à chaque ouverture.
 *
 * ⭐ POURQUOI CE RÉGLAGE EXISTE, ET IL FAUT LE DIRE FRANCHEMENT : une animation
 * spectaculaire vue dix fois par jour finit par être perçue comme de la
 * lenteur. « Aucune » est la porte de sortie, et elle doit être vraie —
 * zéro image de voile, pas une version discrète.
 */
export type AnimationEntree = "complete" | "courte" | "aucune";

/**
 * Miroir du réglage pour le PREMIER RENDU.
 *
 * ⚠️ Même raison que `shale.theme.resolved` : le réglage vit dans `settings`
 * en SQLite, donc il est lu APRÈS le montage — et la transition, elle, doit
 * décider AVANT. Sans miroir, « Aucune » laisserait quand même passer le voile
 * le temps d'un aller-retour à la base : exactement ce que l'utilisateur
 * venait de refuser.
 *
 * SQLite reste la source de vérité ; le miroir ne sert qu'à cet instant-là.
 */
export const CLE_MIROIR_ENTREE = "shale.entree.animation";

export const ANIMATION_ENTREE_DEFAUT: AnimationEntree = "complete";

function estValide(v: unknown): v is AnimationEntree {
  return v === "complete" || v === "courte" || v === "aucune";
}

/** Le réglage tel qu'il est connu AVANT toute lecture de SQLite. */
export function animationEntreeAuDemarrage(): AnimationEntree {
  try {
    const v = localStorage.getItem(CLE_MIROIR_ENTREE);
    if (estValide(v)) return v;
  } catch {
    // Stockage refusé : on retombe sur le défaut, jamais sur une erreur.
  }
  return ANIMATION_ENTREE_DEFAUT;
}

function memoriser(v: AnimationEntree): void {
  try {
    localStorage.setItem(CLE_MIROIR_ENTREE, v);
  } catch {
    /* dégradé, jamais cassé */
  }
}

export async function chargerAnimationEntree(): Promise<AnimationEntree> {
  const v = await getSetting("ui.entryAnimation").catch(() => null);
  const choix = estValide(v) ? v : ANIMATION_ENTREE_DEFAUT;
  memoriser(choix);
  return choix;
}

export async function enregistrerAnimationEntree(v: AnimationEntree): Promise<void> {
  memoriser(v);
  // ⚠️ Clé/valeur dans `settings` : aucune migration SQL. Et elle SE
  // SYNCHRONISE, comme `ui.theme` — `sync/scope.ts` n'exclut que `ui.config`,
  // et la posture du fichier est « tout part sauf ce qui décrit la machine ».
  // Le choix d'animation décrit l'utilisateur, pas son écran.
  await setSetting("ui.entryAnimation", v).catch(() => {});
}
