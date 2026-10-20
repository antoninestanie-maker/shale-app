/**
 * Ne pas jeter une saisie sans le demander (2026-10-20, audit complet ; rang 13
 * du contrôle du 12/10, « toujours présent »).
 *
 * ⚠️ LE DÉFAUT. « Nouvelle tâche », « Nouvel objectif », « Modifier
 * l'objectif », la fiche d'un événement : Échap, un clic sur le voile,
 * « Annuler » — ou, au téléphone, toucher un onglet de la barre du bas, qui
 * reste active par-dessus la fiche (`DESIGN.md` : une couche plein écran
 * réserve la barre) — fermaient la fenêtre et effaçaient ce qui était tapé,
 * sans un mot. Une note, elle, survit au même geste.
 *
 * ⭐ LA RÈGLE. Une fenêtre de saisie qui a été MODIFIÉE demande avant de se
 * fermer ; intacte, elle se ferme comme avant (aucune question pour rien).
 *
 * ⭐ LES GARDES. Une fenêtre modifiée pose une garde ici ; `App.tsx` les
 * consulte avant de changer de module. Une garde qui intercepte pose sa
 * question et reprendra la navigation elle-même si l'on confirme.
 *
 * Ce fichier ne connaît ni React ni le DOM : il se teste seul.
 */

/** Rend `true` si elle a intercepté : elle appellera `poursuivre` une fois la perte confirmée. */
export type Garde = (poursuivre: () => void) => boolean;

const gardes: Garde[] = [];

export function poserGarde(g: Garde): () => void {
  gardes.push(g);
  return () => {
    const i = gardes.lastIndexOf(g);
    if (i >= 0) gardes.splice(i, 1);
  };
}

/**
 * Avant un geste qui démonterait une saisie (changer de module) : la garde la
 * plus récente peut l'arrêter. Rend `true` si le geste est suspendu.
 */
export function gesteSuspendu(poursuivre: () => void): boolean {
  for (let i = gardes.length - 1; i >= 0; i--) if (gardes[i](poursuivre)) return true;
  return false;
}

/**
 * La saisie a-t-elle changé depuis l'ouverture ? Comparée champ par champ,
 * espaces de bord ignorés pour le texte : taper puis effacer une lettre ne
 * compte pas.
 */
export function saisieModifiee(initiale: Readonly<Record<string, unknown>>, actuelle: Readonly<Record<string, unknown>>): boolean {
  const net = (v: unknown) => (typeof v === "string" ? v.trim() : JSON.stringify(v ?? null));
  for (const cle of new Set([...Object.keys(initiale), ...Object.keys(actuelle)])) {
    if (net(initiale[cle]) !== net(actuelle[cle])) return true;
  }
  return false;
}
