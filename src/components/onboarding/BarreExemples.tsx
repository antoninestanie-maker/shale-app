import { useCallback, useEffect, useState } from "react";

import { t, tp } from "../../lib/i18n";
import { compterExemples, supprimerExemples } from "../../lib/repo";
import { IconTrash } from "../icons";

/**
 * ⭐ LE bouton — un seul dans toute l'app, et visible sans le chercher.
 *
 * ─── POURQUOI ICI, ET NULLE PART AILLEURS ───────────────────────────────────
 *
 * Le cahier des charges demande « un bouton unique, visible sans le chercher ».
 * Un bouton par module en aurait fait quatre, chacun ne sachant retirer qu'un
 * quart du parcours — et l'utilisateur aurait dû faire le tour de l'app pour
 * finir le ménage. Il vit donc sur **Aujourd'hui**, l'écran d'accueil : celui
 * où l'on atterrit, celui où l'on revient.
 *
 * ⚠️ Il s'efface tout seul quand il n'y a plus rien à supprimer. Un bandeau
 * permanent qui annonce « 0 exemple » serait exactement le genre de décor
 * qu'on finit par ne plus lire.
 *
 * ⚠️ Le COMPTE est affiché, et il diminue tout seul : chaque exemple que
 * l'utilisateur modifie cesse d'en être un (`repo.ts`, `adopter`). Annoncer
 * « supprimer les exemples » sans chiffre laisserait croire que le bouton
 * emporte aussi ce qu'on s'est approprié — il ne le fait jamais.
 */
export default function BarreExemples({
  signal,
  onChange,
}: {
  /**
   * ⚠️ CE PROP RÉPARE UN DÉFAUT MESURÉ (2026-09-10, mode démo). Le compte se lit
   * en base, pas dans `AppData` : la fiche du Savoir n'y est pas. Sans signal,
   * la lecture n'avait lieu qu'au MONTAGE — c'est-à-dire avant que l'accueil
   * n'ait semé quoi que ce soit. Le bandeau n'apparaissait donc qu'au
   * démarrage SUIVANT, et le premier lancement, celui qui compte, se passait
   * sans lui.
   *
   * On y passe l'objet `data` : `refresh()` en fabrique un neuf à chaque
   * écriture, donc la lecture se rejoue quand quelque chose a pu changer.
   */
  signal: unknown;
  onChange: () => void;
}) {
  const [compte, setCompte] = useState<number | null>(null);
  const [enCours, setEnCours] = useState(false);

  const relire = useCallback(() => {
    compterExemples()
      .then(setCompte)
      // Base illisible : on n'affiche pas le bandeau plutôt que d'afficher un
      // compte faux.
      .catch(() => setCompte(0));
  }, []);

  useEffect(() => relire(), [relire, signal]);

  if (compte == null || compte === 0) return null;

  const supprimer = async () => {
    if (enCours) return;
    setEnCours(true);
    try {
      await supprimerExemples();
      setCompte(0);
      onChange();
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[12px] border border-violet/30 bg-violet/10 px-3.5 py-2.5">
      <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-text">
        {t("Quelques exemples sont là pour te montrer le produit, dans Tâches, Notes, Journal et Savoir. Modifie-en un, il devient tien.")}
      </p>
      <button
        type="button"
        onClick={() => void supprimer()}
        disabled={enCours}
        className="cible-tactile pill inline-flex shrink-0 items-center gap-1.5 border border-border-strong bg-surface px-3 py-1.5 text-[12px] font-medium text-text transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        <IconTrash className="h-3.5 w-3.5" />
        {tp(compte, "Supprimer l'exemple", "Supprimer les {n} exemples")}
      </button>
    </div>
  );
}
