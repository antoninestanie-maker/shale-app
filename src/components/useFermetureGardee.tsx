import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmationEnLigne from "./ConfirmationEnLigne";
import { poserGarde, saisieModifiee } from "../lib/saisieGardee";
import { t } from "../lib/i18n";

/**
 * Une fenêtre de saisie qui demande avant de jeter ce qu'on a tapé
 * (`lib/saisieGardee.ts`, 2026-10-20).
 *
 * `valeurs` : les champs de la fenêtre, tels qu'ils sont maintenant. Ceux du
 * PREMIER rendu font référence : modifiée = différente de l'ouverture.
 *
 * Rend `fermer` — à brancher sur Échap, le voile et « Annuler » à la place de
 * `onClose` — et `confirmation`, la question à poser dans le pied de la
 * fenêtre (rien tant qu'il n'y a rien à demander).
 */
export function useFermetureGardee(valeurs: Readonly<Record<string, unknown>>, onClose: () => void) {
  const initiales = useRef(valeurs);
  const modifiee = saisieModifiee(initiales.current, valeurs);
  const [demande, setDemande] = useState(false);
  /** Ce qu'il faudra faire après avoir fermé (une navigation suspendue). */
  const suite = useRef<(() => void) | null>(null);
  /** La perte est consentie : plus rien à garder, même avant le démontage. */
  const liberee = useRef(false);

  const fermer = useCallback(() => {
    if (!modifiee) {
      onClose();
      return;
    }
    suite.current = null;
    setDemande(true);
  }, [modifiee, onClose]);

  // Modifiée, elle garde aussi la navigation (onglets du téléphone, ⌘K…).
  useEffect(() => {
    if (!modifiee) return;
    return poserGarde((poursuivre) => {
      if (liberee.current) return false;
      suite.current = poursuivre;
      setDemande(true);
      return true;
    });
  }, [modifiee]);

  const confirmation = demande ? (
    <ConfirmationEnLigne
      question={t("Fermer sans enregistrer ? Ce que tu as saisi sera perdu.")}
      libelle={t("Abandonner la saisie")}
      onConfirmer={() => {
        const ensuite = suite.current;
        suite.current = null;
        liberee.current = true;
        setDemande(false);
        onClose();
        ensuite?.();
      }}
      onRenoncer={() => {
        suite.current = null;
        setDemande(false);
      }}
      className="fenetre-pied mt-[10px]"
    />
  ) : null;

  return { fermer, confirmation, modifiee };
}
