// Toast discret (coin bas-droit) : confirmation d'une action de fond sans
// interrompre le flux — envoi au tracker (fast-track), archivage d'une
// position… Auto-dissipé, action optionnelle ("Voir le tracker →").
import { useEffect } from "react";
import { IconCheckCircle } from "./icons";

import { t } from "../lib/i18n";
export interface ToastState {
  msg: string;
  /** Teinte du message : succès (défaut) ou signal gain/perte. */
  tone?: "default" | "win" | "loss";
  actionLabel?: string;
  onAction?: () => void;
}

export default function Toast({
  toast,
  onClose,
  duration = 4500,
}: {
  toast: ToastState | null;
  onClose: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(t);
  }, [toast, onClose, duration]);

  if (!toast) return null;
  const tone =
    toast.tone === "win"
      ? "text-green"
      : toast.tone === "loss"
        ? "text-red"
        : "text-green";
  return (
    <div className="animate-fade-up fixed bottom-6 right-6 z-[90]">
      <div className="card flex items-center gap-3 bg-surface py-3 pl-4 pr-3">
        <IconCheckCircle className={`h-5 w-5 shrink-0 ${tone}`} />
        <p className="text-sm font-medium text-text">{toast.msg}</p>
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="pill shrink-0 border border-blue/40 bg-blue/10 px-3 py-1 text-xs font-semibold text-blue transition-colors hover:bg-blue/20"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-text-dim hover:text-text"
          aria-label={t("Fermer")}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
