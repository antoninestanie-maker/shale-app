// Toast discret (coin bas-droit) : confirmation d'une action de fond sans
// interrompre le flux — envoi au tracker (fast-track), archivage d'une
// position, mise en corbeille… Auto-dissipé, action optionnelle
// ("Voir le tracker →", "Annuler").
//
// ⭐ Depuis le 2026-09-23 (corbeille), UN HÔTE GLOBAL vit dans `App.tsx` et
// reçoit ses messages par `lib/toast.ts` ; les deux vues qui montaient déjà le
// leur (Trading, Position) sont inchangées. Même composant, même apparence.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { IconCheckCircle } from "./icons";
import { useIsPhone } from "../lib/platform";
import { pointeurGrossier } from "../lib/menu/tactile";
import { dureeAffichage, plafondAffichage, resteApresSuspension } from "../lib/toast";

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
   * ⚠️ LE MINUTEUR S'ARRÊTE AU SURVOL ET AU FOCUS — MAIS LE TOAST PART TOUJOURS.
   *
   * Un « Annuler » qui disparaît pendant que la souris va dessus est le pire
   * moment pour disparaître : c'est celui où l'utilisateur a décidé d'agir.
   * Et au clavier, tabuler jusqu'au bouton ne doit pas faire la course avec
   * lui.
   *
   * ⭐ Depuis le 2026-10-13 (Antonin : il « doit rester allumé un certain
   * temps, pas jusqu'à ce qu'on le ferme nous-même ») : le minuteur REPREND où
   * il en était quand le pointeur s'en va — il repartait de zéro —, et un
   * plafond le ferme quoi qu'il arrive (`plafondAffichage`). Le filet du bas
   * se vide à la même vitesse : on VOIT qu'il s'en va tout seul.
   */
  const [suspendu, setSuspendu] = useState(false);
  const racine = useRef<HTMLDivElement>(null);
  // Au doigt, pas de survol pour retenir le toast : s'il porte un geste, il
  // reste plus longtemps (`dureeAffichage`, `lib/toast.ts`).
  const attente = dureeAffichage({
    duree: duration,
    aUnGeste: !!(toast?.onAction || toast?.onLien),
    auDoigt: pointeurGrossier(),
  });
  /** Ce qu'il reste à vivre à CE toast, en ms — entamé à chaque suspension. */
  const restant = useRef(attente);
  /** Change à chaque nouveau message : relance le filet du compte à rebours. */
  const naissance = useMemo(() => (toast ? performance.now() : 0), [toast]);

  // Un nouveau message : la durée entière, le survol oublié, et le plafond.
  // ⚠️ Déclaré AVANT l'effet du minuteur : il doit avoir remis `restant` à
  // neuf quand celui-ci le lit.
  useEffect(() => {
    if (!toast) return;
    restant.current = attente;
    setSuspendu(false);
    const plafond = window.setTimeout(onClose, plafondAffichage(attente));
    return () => window.clearTimeout(plafond);
  }, [toast, onClose, attente]);

  useEffect(() => {
    if (!toast || suspendu) return;
    // ⚠️ Pas `t` : ce nom est celui de la traduction (PASSATION § 14.3).
    const depart = performance.now();
    const minuteur = window.setTimeout(onClose, restant.current);
    return () => {
      window.clearTimeout(minuteur);
      restant.current = resteApresSuspension(restant.current, performance.now() - depart);
    };
  }, [toast, onClose, suspendu]);

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
    ? // `--reserve-seance` : la pastille du minuteur, quand une séance tourne
      // (`FocusOverlay`) — le toast se pose au-dessus d'elle, pas dessus.
      { left: "0.75rem", right: "0.75rem", bottom: "calc(env(safe-area-inset-bottom) + 5.5rem + var(--reserve-seance, 0px))" }
    : { right: "1.5rem", bottom: "1.5rem" };

  return (
    <div
      ref={racine}
      className="toast-pile animate-fade-up fixed z-[90]"
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
      <div className="card relative flex items-center gap-3 overflow-hidden bg-surface py-3 pl-4 pr-3">
        {/* Le compte à rebours : un filet qui se vide, arrêté au survol. */}
        <span
          key={naissance}
          aria-hidden
          className="toast-compte"
          style={{ animationDuration: `${attente}ms`, animationPlayState: suspendu ? "paused" : "running" }}
        />
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
            className="pill cible-tactile shrink-0 border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/20"
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
