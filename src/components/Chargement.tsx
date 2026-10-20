import type { CSSProperties } from "react";
import ShaleMark from "./auth/ShaleMark";

/**
 * L'attente de Shale : une variante de l'entrée (2026-10-20, demande
 * d'Antonin : « l'onglet de chargement de l'app et du site doit être une
 * variante de l'entrée dans l'app »).
 *
 * L'entrée allume la lueur une fois, inspire (l'icône se contracte), puis on
 * entre. L'attente rejoue les deux premiers temps EN BOUCLE, sans jamais
 * entrer : la lueur s'allume, l'icône inspire, la lueur s'éteint. Même icône,
 * mêmes couches que la copie de l'entrée (plaque sans lueur + `lueur-seule`
 * par-dessus, que seule l'opacité anime).
 *
 * - Rien ne s'affiche pendant les 150 premières ms : un module en cache ne
 *   fait pas clignoter l'icône.
 * - Le texte ne vient que si l'attente dure (comme `.lancement-attente`).
 * - `prefers-reduced-motion` : la règle globale d'`index.css` fige tout ;
 *   l'icône reste, lueur allumée, et le texte est là d'emblée.
 *
 * Le site a la même attente, en CSS seul (`vitrine/src/styles/compte.css`,
 * `.chargement`) : changer l'une, c'est changer l'autre.
 */
export default function Chargement({
  texte,
  taille = 44,
  className = "",
}: {
  /** Dit ce qu'on attend (module, données…) ; n'apparaît que si ça dure. */
  texte: string;
  taille?: number;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`chargement ${className}`}
      style={{ "--chargement-taille": `${taille}px` } as CSSProperties}
    >
      <div className="chargement-icone">
        <ShaleMark size="100%" lueur={false} />
        <ShaleMark size="100%" variante="lueur-seule" className="chargement-lueur" />
      </div>
      <p className="chargement-texte">{texte}</p>
    </div>
  );
}
