import ShaleMark from "./auth/ShaleMark";
import type { AnimationEntree } from "../lib/entree/reglage";

/**
 * Le passage d'un module à l'autre : l'attente (`Chargement.tsx`) jouée UNE
 * fois, puis la sortie de l'entrée (2026-10-21, demande d'Antonin : « que ce
 * chargement s'applique à chaque changement de page aussi »).
 *
 * Un voile de la couleur du fond couvre la zone du module (pas la barre
 * latérale ni la barre d'onglets : on reste dans l'app). L'icône y paraît, sa
 * lueur s'allume, elle inspire, puis elle s'efface en rétrécissant (0,88, la
 * sortie de l'entrée) pendant que le voile se lève sur le module.
 *
 * ⭐ Le module se monte DESSOUS dès le clic : le passage n'ajoute aucune
 * attente au chargement, il le couvre. S'il dure plus que le passage, le
 * repli de `Suspense` (la même icône, en boucle) prend le relais.
 *
 * Durées : 560 ms en « complète », 320 ms en « courte » (le réglage de
 * l'entrée, lu à chaque changement au miroir) ; « aucune » et
 * `prefers-reduced-motion` : pas de passage du tout — c'est `App.tsx` qui ne
 * le rend pas. Le voile ne prend aucun clic (`pointer-events: none`).
 */
export default function PassageModule({
  mode,
  onFin,
}: {
  mode: Exclude<AnimationEntree, "aucune">;
  onFin: () => void;
}) {
  return (
    <div
      aria-hidden
      className="passage-module"
      data-mode={mode}
      onAnimationEnd={(e) => {
        // Seule la fin du VOILE clôt le passage ; celles de l'icône et de la
        // lueur remontent aussi jusqu'ici par bouillonnement.
        if (e.target === e.currentTarget) onFin();
      }}
    >
      <div className="passage-module-icone">
        <ShaleMark size="100%" lueur={false} />
        <ShaleMark size="100%" variante="lueur-seule" className="passage-module-lueur" />
      </div>
    </div>
  );
}
