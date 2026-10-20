/**
 * Ouvrir la palette ⌘K depuis un bouton — avec, au besoin, une requête déjà
 * tapée (2026-10-20, audit complet : la recherche n'était annoncée nulle part,
 * et les recherches de Notes et du Savoir ne voyaient chacune que leur réserve).
 *
 * Un événement de fenêtre, que `CommandPalette` (toujours montée par `App.tsx`)
 * écoute : la palette n'est jamais dans un module chargé en `lazy`, donc
 * l'événement ne tombe pas dans le vide (PIEGES § 6.2 ter).
 */
export const EVT_PALETTE = "sb:open-palette";

export function ouvrirPalette(requete?: string): void {
  window.dispatchEvent(new CustomEvent<{ requete?: string }>(EVT_PALETTE, { detail: { requete } }));
}
