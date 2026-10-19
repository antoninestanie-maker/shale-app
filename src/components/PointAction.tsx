import { nombreAffiche } from "../lib/pointAction/regle";

/**
 * ⭐ LE POINT D'ACTION (2026-10-20, `Shale-projet/marque/COULEURS.md` § 4).
 *
 * Un point rouge vif de 8 px, un anneau de la couleur du fond, un léger halo.
 * La SEULE couleur forte de l'interface : il ne dit qu'une chose, « une action
 * est requise ». Ce qui l'allume est décidé par `lib/pointAction/regle.ts`,
 * jamais ici.
 *
 * `nombre` : la forme de la barre latérale (le compte du module). Toujours la
 * même taille, toujours à droite ou en haut à droite de ce qu'il marque.
 * `libelle` : ce que lit un lecteur d'écran — la couleur ne dit jamais seule.
 */
export default function PointAction({
  nombre,
  libelle,
  className = "",
}: {
  nombre?: number;
  libelle?: string;
  className?: string;
}) {
  if (nombre !== undefined) {
    if (nombre <= 0) return null;
    return (
      <span className={`point-action-compte ${className}`} aria-label={libelle} role={libelle ? "status" : undefined}>
        {nombreAffiche(nombre)}
      </span>
    );
  }
  return (
    <span
      className={`point-action ${className}`}
      aria-label={libelle}
      aria-hidden={libelle ? undefined : true}
      role={libelle ? "img" : undefined}
    />
  );
}
