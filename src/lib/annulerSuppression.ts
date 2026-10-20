/**
 * ⌘Z rend la dernière suppression (2026-10-20, audit complet, constat 23).
 *
 * ⭐ CE QUI MANQUAIT. Supprimer une tâche, une étape, un nœud d'une carte
 * d'objectif ou une note les met dans « Supprimés récemment » avec un bandeau
 * « Annuler » de six secondes. Passé ce délai — ou pour qui ne regarde pas le
 * bas de l'écran — ⌘Z, le geste que tout Mac connaît, ne faisait RIEN. Sept
 * personnes du labo l'ont essayé, et seules la carte mentale d'une note et le
 * croquis répondaient.
 *
 * ⭐ UNE PILE, TENUE PAR LES GESTES DE LA CORBEILLE. `jeter` et
 * `jeterPlusieurs` (`components/corbeille/geste.tsx`) — le chemin unique de
 * toutes les suppressions de l'app (règle 18) — y déposent ce qu'ils viennent
 * d'emporter, avec la façon de le rendre. ⌘Z dépile la plus récente. Le bouton
 * « Annuler » du bandeau la retire aussi de la pile : rien n'est rendu deux fois.
 *
 * ⚠️ CE QUE ⌘Z NE VOLE PAS. Dans un champ de texte, un éditeur ou un croquis,
 * ⌘Z défait la FRAPPE : c'est au champ, pas à la corbeille. L'écouteur global
 * (`App.tsx`) ne prend la touche que hors de tout champ, et seulement si
 * personne ne l'a déjà prise (`defaultPrevented` — la carte mentale d'une note
 * et le croquis l'écoutent en capture).
 *
 * ⚠️ La pile est en MÉMOIRE : elle ne survit pas à un redémarrage. Ce qui a été
 * supprimé avant attend dans « Supprimés récemment », trente jours.
 *
 * Ce fichier ne connaît ni la base ni le DOM au-delà d'un élément cible : il se
 * teste seul.
 */

export interface SuppressionAnnulable {
  /** Le nom à dire quand elle revient (« « Appeler Léa » est de retour »). */
  titre: string;
  /**
   * Rend ce qui était parti. Rend `true` si quelque chose est vraiment revenu —
   * `false` si c'était déjà fait ailleurs (restauré depuis la corbeille, par
   * exemple) : ⌘Z passe alors à la suppression d'avant.
   */
  rendre: () => Promise<boolean>;
}

/** Au-delà, les plus anciennes sortent de la pile (elles restent dans la corbeille). */
export const PROFONDEUR_PILE = 20;

const pile: SuppressionAnnulable[] = [];

/** Dépose une suppression qu'on pourra rendre. Rend la fonction qui l'oublie. */
export function retenirSuppression(s: SuppressionAnnulable): () => void {
  pile.push(s);
  if (pile.length > PROFONDEUR_PILE) pile.splice(0, pile.length - PROFONDEUR_PILE);
  return () => oublierSuppression(s);
}

/** Retire une suppression de la pile — son « Annuler » vient d'être pressé, par exemple. */
export function oublierSuppression(s: SuppressionAnnulable): void {
  const i = pile.lastIndexOf(s);
  if (i >= 0) pile.splice(i, 1);
}

/** Y a-t-il une suppression à rendre ? */
export function aUneSuppressionARendre(): boolean {
  return pile.length > 0;
}

/**
 * Rend la suppression la plus récente qui ait encore quelque chose à rendre.
 * Rend celle qui est revenue, ou `null` s'il n'y en avait aucune.
 */
export async function annulerDerniereSuppression(): Promise<SuppressionAnnulable | null> {
  for (let s = pile.pop(); s; s = pile.pop()) {
    let revenue = false;
    try {
      revenue = await s.rendre();
    } catch (e) {
      console.error("⌘Z : la restauration a échoué", e);
    }
    if (revenue) return s;
  }
  return null;
}

/** Réservé aux tests. */
export function viderPileSuppressions(): void {
  pile.length = 0;
}

/**
 * La cible de la touche est-elle un endroit où l'on TAPE ? ⌘Z y appartient au
 * champ (défaire la frappe), jamais à la corbeille.
 */
export function cibleDeSaisie(cible: EventTarget | null): boolean {
  if (!cible || typeof (cible as Element).closest !== "function") return false;
  const el = cible as HTMLElement;
  if (el.isContentEditable) return true;
  return !!el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"]');
}

/** ⌘Z (Ctrl+Z ailleurs), sans Maj ni Option : le « défaire » simple. */
export function estToucheDefaire(e: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey">): boolean {
  return (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "z";
}
