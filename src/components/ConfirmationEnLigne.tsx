/**
 * Une confirmation POSÉE DANS LA LIGNE qu'elle concerne, pour ce qui se
 * supprime pour de bon — ce qui ne passe PAS par « Supprimés récemment ».
 *
 * ⭐ POURQUOI EN LIGNE, ET PAS UNE FENÊTRE : c'est le choix de la corbeille
 * (`CorbeilleView`) — une question posée à côté de ce qu'elle concerne se lit
 * mieux qu'une fenêtre qui cache la liste. Et pourquoi pas un double-clic
 * « sûr ? » : il ne dit ni CE qui part, ni que c'est définitif.
 *
 * Le focus va sur « Garder » : Entrée par réflexe ne détruit rien. Échap renonce.
 */

import { useEffect, useRef } from "react";
import { t } from "../lib/i18n";

export default function ConfirmationEnLigne({
  question,
  libelle,
  onConfirmer,
  onRenoncer,
  className = "",
}: {
  /** La phrase, qui nomme ce qui part et dit que c'est définitif. */
  question: string;
  /** Le verbe du bouton rouge : « Retirer », « Supprimer »… */
  libelle: string;
  onConfirmer: () => void | Promise<void>;
  onRenoncer: () => void;
  className?: string;
}) {
  const garder = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    garder.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div
      role="group"
      aria-label={question}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        // Sinon la fenêtre qui nous contient se fermerait avec.
        e.preventDefault();
        e.stopPropagation();
        onRenoncer();
      }}
      className={`flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-red/30 bg-red/5 px-3 py-2 ${className}`}
    >
      <p className="min-w-0 text-xs text-text">{question}</p>
      <span className="flex shrink-0 gap-1.5">
        <button
          ref={garder}
          type="button"
          onClick={onRenoncer}
          className="cible-tactile-ligne rounded-[8px] px-2.5 py-1 text-xs text-text-dim hover:text-text"
        >
          {t("Garder")}
        </button>
        <button
          type="button"
          onClick={() => void onConfirmer()}
          className="cible-tactile-ligne rounded-[8px] bg-red px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
        >
          {libelle}
        </button>
      </span>
    </div>
  );
}
