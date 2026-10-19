/**
 * La première image de Shale : fond nuit, halo rouge, l'icône au centre sans
 * lueur. Peinte en HTML nu par `index.html` (`#lancement`) avant que React ne
 * démarre, puis reprise à l'identique par `Lancement` (`AuthGate.tsx`) et par
 * le voile de l'entrée. Voir `.lancement` dans `index.html`.
 */

/** La couche d'`index.html`, retirée dès que React a rendu la sienne. */
export function retirerLancement(): void {
  if (typeof document === "undefined") return;
  document.getElementById("lancement")?.remove();
}
