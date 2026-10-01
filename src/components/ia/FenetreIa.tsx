// La fenêtre modale commune des écrans d'IA (lecture du brief, clôture, et les
// suivantes) : même vocabulaire que les autres surfaces modales de l'app
// (`card-solid`, voile, Échap qui respecte une couche au-dessus).
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "../../lib/i18n";
import { IconX } from "../icons";

export function FenetreIa({
  titre,
  onFermer,
  children,
  large = false,
}: {
  titre: string;
  onFermer: () => void;
  children: ReactNode;
  large?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onFermer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFermer]);

  // ⭐ La fenêtre PREND le focus à l'ouverture. Sans cela, le menu qui vient de
  // se fermer le rend à son bouton, dont l'info-bulle s'affiche alors PAR-DESSUS
  // la fenêtre (vu à l'écran le 2026-10-01). Une image suivante, pour passer
  // après cette restitution ; et jamais si un champ de la fenêtre l'a déjà pris.
  const panneau = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const p = panneau.current;
      if (p && !p.contains(document.activeElement)) p.focus();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6 py-10"
      onClick={onFermer}
      role="dialog"
      aria-modal="true"
      aria-label={titre}
    >
      <div
        ref={panneau}
        tabIndex={-1}
        className={`card-solid animate-fade-up relative max-h-full w-full overflow-y-auto p-7 focus:outline-none ${large ? "max-w-2xl" : "max-w-lg"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onFermer}
          aria-label={t("Fermer")}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
        >
          <IconX className="h-4 w-4" />
        </button>
        <h2 className="pr-8 text-[20px] font-bold leading-tight tracking-tight text-text">{titre}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
