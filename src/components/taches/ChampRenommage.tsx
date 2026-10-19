import { t } from "../../lib/i18n";

/**
 * ⭐ RENOMMER UNE TÂCHE EN PLACE, jamais dans une fenêtre (cahier des charges,
 * § 7) : Entrée valide, Échap annule, quitter le champ valide — comme un nom de
 * fichier dans le Finder.
 *
 * Écrit une fois pour les trois endroits qui renomment une tâche sur sa ligne
 * (Tâches, la carte d'Aujourd'hui, la ligne « En retard ») : chacun avait sa
 * copie.
 *
 * ⚠️ Pas dans un <button> : un champ dans un bouton n'est pas du HTML valide,
 * et chaque frappe cocherait.
 */
export default function ChampRenommage(props: {
  valeur: string;
  onValider: (libelle: string) => void;
  onAnnuler: () => void;
  className?: string;
}) {
  return (
    <input
      autoFocus
      defaultValue={props.valeur}
      aria-label={t("Nouveau nom de la tâche")}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          props.onValider(e.currentTarget.value);
        } else if (e.key === "Escape") {
          // On MARQUE la touche : Échap ne doit rien fermer d'autre.
          e.preventDefault();
          e.stopPropagation();
          props.onAnnuler();
        }
      }}
      onBlur={(e) => props.onValider(e.currentTarget.value)}
      className={
        props.className ??
        "w-full rounded-md border border-accent bg-surface px-2 py-0.5 text-sm text-text focus:outline-none"
      }
    />
  );
}
