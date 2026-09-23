// Toast discret (coin bas-droit) : confirmation d'une action de fond sans
// interrompre le flux — envoi au tracker (fast-track), archivage d'une
// position, mise en corbeille… Auto-dissipé, action optionnelle
// ("Voir le tracker →", "Annuler").
//
// ⭐ Depuis le 2026-09-23 (corbeille), UN HÔTE GLOBAL vit dans `App.tsx` et
// reçoit ses messages par `lib/toast.ts` ; les deux vues qui montaient déjà le
// leur (Trading, Position) sont inchangées. Même composant, même apparence.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCheckCircle } from "./icons";
import { useIsPhone } from "../lib/platform";

import { t } from "../lib/i18n";
export interface ToastState {
  msg: string;
  /** Teinte du message : succès (défaut) ou signal gain/perte. */
  tone?: "default" | "win" | "loss";
  actionLabel?: string;
  onAction?: () => void;
  /**
   * Un second geste, plus discret, en lien texte — « Voir la corbeille ».
   * L'action principale (« Annuler ») garde la pastille.
   */
  lienLabel?: string;
  onLien?: () => void;
  /** Remplace la coche verte — une corbeille ne dit pas « réussi ». */
  icone?: ReactNode;
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
  const isPhone = useIsPhone();
  /**
   * ⚠️ LE MINUTEUR S'ARRÊTE AU SURVOL ET AU FOCUS.
   *
   * Un « Annuler » qui disparaît pendant que la souris va dessus est le pire
   * moment pour disparaître : c'est celui où l'utilisateur a décidé d'agir.
   * Et au clavier, tabuler jusqu'au bouton ne doit pas faire la course avec
   * lui. Le minuteur REPART de zéro quand le pointeur ou le focus s'en va.
   */
  const [suspendu, setSuspendu] = useState(false);
  const racine = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast || suspendu) return;
    // ⚠️ Pas `t` : ce nom est celui de la traduction (PASSATION § 14.3). La
    // version d'avant le 2026-09-23 l'employait ici, masquant `t()` le temps
    // de l'effet.
    const minuteur = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(minuteur);
  }, [toast, onClose, duration, suspendu]);

  // Un nouveau message remet le minuteur en marche, même si le précédent
  // avait été suspendu par le survol.
  useEffect(() => setSuspendu(false), [toast]);

  if (!toast) return null;
  const tone =
    toast.tone === "win"
      ? "text-success"
      : toast.tone === "loss"
        ? "text-red"
        : "text-success";

  // ⚠️ SUR TÉLÉPHONE, AU-DESSUS DE LA BARRE D'ONGLETS. Elle est fixée en bas
  // (`MobileNav`, ~80 px) : posé à 24 px du bord, le toast la recouvrait. On
  // reprend la marge que `MobileNav` réserve déjà à sa propre feuille, et on
  // prend toute la largeur — un message de corbeille porte un titre, il ne
  // tiendrait pas dans un coin de 390 pt.
  const place = isPhone
    ? { left: "0.75rem", right: "0.75rem", bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }
    : { right: "1.5rem", bottom: "1.5rem" };

  return (
    <div
      ref={racine}
      className="animate-fade-up fixed z-[90]"
      style={place}
      // Lu par un lecteur d'écran sans voler le focus : « poli », pas « assertif ».
      role="status"
      aria-live="polite"
      onPointerEnter={() => setSuspendu(true)}
      onPointerLeave={() => setSuspendu(false)}
      onFocus={() => setSuspendu(true)}
      onBlur={(e) => {
        if (!racine.current?.contains(e.relatedTarget as Node)) setSuspendu(false);
      }}
    >
      <div className="card flex items-center gap-3 bg-surface py-3 pl-4 pr-3">
        {toast.icone ?? <IconCheckCircle className={`h-5 w-5 shrink-0 ${tone}`} />}
        <p className="min-w-0 flex-1 text-sm font-medium text-text">{toast.msg}</p>
        {toast.lienLabel && toast.onLien && (
          <button
            type="button"
            onClick={() => {
              toast.onLien?.();
              onClose();
            }}
            className="cible-tactile shrink-0 text-xs font-medium text-text-dim underline-offset-2 hover:text-text hover:underline"
          >
            {toast.lienLabel}
          </button>
        )}
        {toast.actionLabel && toast.onAction && (
          <button
            type="button"
            onClick={() => {
              toast.onAction?.();
              onClose();
            }}
            className="pill cible-tactile shrink-0 border border-blue/40 bg-blue/10 px-3 py-1 text-xs font-semibold text-blue transition-colors hover:bg-blue/20"
          >
            {toast.actionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="cible-tactile rounded-md p-1 text-text-dim hover:text-text"
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
