// Paywall — s'ouvre quand un compte `shale` touche un module trading.
//
// Le ton est celui d'une démonstration, pas d'un mur : l'utilisateur a déjà eu
// accès à tout pendant son essai. On lui rappelle ce qu'il a laissé, on ne lui
// annonce pas une mauvaise nouvelle.
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ACCOUNT_PAGES } from "../lib/auth/config";
import { openExternal } from "../lib/auth/external";
import { TRADING_PITCH } from "../lib/features";
import { t } from "../lib/i18n";
import { IconExternal, IconLock, IconX } from "./icons";

interface Props {
  /** Module qui a déclenché le paywall (titre de l'accroche). */
  moduleLabel?: string;
  onClose: () => void;
}

export default function UpgradeModal({ moduleLabel, onClose }: Props) {
  // Échap ferme, comme toutes les surfaces modales de l'app.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⚠️ Une couche AU-DESSUS a déjà traité la touche : elle l'a marquée.
      // Sans ce garde, un seul Échap ferme DEUX étages d'un coup — et si
      // l'étage du dessous est un formulaire, la saisie part avec.
      // Convention posée par KnowledgeView le 2026-08-26, généralisée ici
      // le 2026-08-28 après l'avoir reproduite : ⌘K par-dessus une tâche.
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // En portal : monté depuis la sidebar, qui est un contexte d'empilement, la
  // modale passerait sous le contenu (même piège que NotificationBell).
  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 px-6 py-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("Passer à Shale Trade")}
    >
      <div
        className="card-solid animate-fade-up relative max-h-full w-full max-w-lg overflow-y-auto p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Fermer")}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-text-dim transition-colors hover:bg-overlay hover:text-text"
        >
          <IconX className="h-4 w-4" />
        </button>

        <span className="inline-flex items-center gap-2 rounded-full border border-blue/30 bg-blue/10 px-3 py-1 text-[11px] font-semibold text-blue">
          <IconLock className="h-3.5 w-3.5" />
          {t("Inclus dans Shale Trade")}
        </span>

        <h2 className="mt-4 text-[22px] font-bold leading-tight tracking-tight text-text">
          {/* Phrase paramétrée, jamais concaténée : l'ordre des mots change
              d'une langue à l'autre. */}
          {moduleLabel
            ? t("{module} fait partie de Shale Trade.", { module: t(moduleLabel) })
            : t("Le cœur trading fait partie de Shale Trade.")}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          {t(
            "Ton offre Shale couvre toute la productivité. Shale Trade y ajoute les cinq modules que tu as utilisés pendant l'essai.",
          )}
        </p>

        <ul className="mt-6 flex flex-col gap-4">
          {TRADING_PITCH.map((item) => (
            <li key={item.title} className="grid grid-cols-[auto_1fr] gap-3">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" />
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-text">{t(item.title)}</p>
                <p className="mt-0.5 text-[13px] leading-relaxed text-text-dim">{t(item.body)}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-7 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => openExternal(ACCOUNT_PAGES.home)}
            className="pill flex flex-1 basis-[13rem] items-center justify-center gap-2 bg-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {t("Passer à Shale Trade")}
            <IconExternal className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="pill border border-border bg-surface-2 px-5 py-2.5 text-sm text-text transition-colors hover:border-blue/50"
          >
            {t("Plus tard")}
          </button>
        </div>

        <p className="mt-4 text-[12px] text-text-dim">
          {t("Le changement d'offre est immédiat, et tes données restent intactes.")}
        </p>
      </div>
    </div>,
    document.body,
  );
}
