import { useCallback, useEffect, useRef, useState } from "react";
import { poserGarde, saisieModifiee } from "../lib/saisieGardee";
import { t } from "../lib/i18n";

/**
 * Une fenêtre de saisie qui demande avant de jeter ce qu'on a tapé
 * (`lib/saisieGardee.ts`, 2026-10-21, lot 6 de l'audit ; rang 13 du 12/10).
 *
 * ⭐ LA MÊME QUESTION QUE « NOUVELLE TÂCHE » (lot 5, constat 39, décision
 * `CLAUDE.md` du 2026-10-20) : le pied de la fenêtre devient « Abandonner la
 * saisie ? », avec « Ne pas garder » (qui prend le focus : Entrée confirme) et
 * « Continuer » (un second Échap, ou un second clic sur le voile, revient à la
 * saisie). « Annuler » reste un geste explicite : l'appelant le branche sur
 * `onClose`, sans question. Les fenêtres ne doivent pas poser deux questions
 * différentes pour le même geste.
 *
 * `valeurs` : les champs de la fenêtre, tels qu'ils sont maintenant. Ceux du
 * PREMIER rendu font référence : modifiée = différente de l'ouverture.
 *
 * Rend `fermer` — à brancher sur Échap et sur le voile — et `confirmation`,
 * le pied à afficher À LA PLACE du pied habituel quand il n'est pas `null`.
 */
export function useFermetureGardee(valeurs: Readonly<Record<string, unknown>>, onClose: () => void) {
  const initiales = useRef(valeurs);
  const modifiee = saisieModifiee(initiales.current, valeurs);
  const [demande, setDemande] = useState(false);
  /** Ce qu'il faudra faire après avoir fermé (une navigation suspendue). */
  const suite = useRef<(() => void) | null>(null);
  /** La perte est consentie : plus rien à garder, même avant le démontage. */
  const liberee = useRef(false);
  const boutonAbandon = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (demande) boutonAbandon.current?.focus();
  }, [demande]);

  const fermer = useCallback(() => {
    if (demande) {
      // Déjà posée : le même geste une seconde fois revient à la saisie.
      suite.current = null;
      setDemande(false);
      return;
    }
    if (!modifiee) {
      onClose();
      return;
    }
    suite.current = null;
    setDemande(true);
  }, [demande, modifiee, onClose]);

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
    <div
      className="fenetre-pied mt-[10px] flex flex-wrap items-center justify-end gap-2"
      role="alertdialog"
      aria-label={t("Abandonner la saisie ?")}
    >
      <p className="mr-auto text-sm text-text">{t("Abandonner la saisie ?")}</p>
      <button
        type="button"
        onClick={() => {
          suite.current = null;
          setDemande(false);
        }}
        className="pill px-4 py-2 text-sm font-medium text-text-dim hover:text-text"
      >
        {t("Continuer")}
      </button>
      <button
        ref={boutonAbandon}
        type="button"
        onClick={() => {
          const ensuite = suite.current;
          suite.current = null;
          liberee.current = true;
          setDemande(false);
          onClose();
          ensuite?.();
        }}
        className="pill border border-border px-4 py-2 text-sm font-semibold text-text hover:border-border-strong"
      >
        {t("Ne pas garder")}
      </button>
    </div>
  ) : null;

  return { fermer, confirmation, modifiee };
}
