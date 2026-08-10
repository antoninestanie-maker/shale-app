import { useState } from "react";
import { IconExternal } from "../icons";
import { ACCOUNT_URL } from "../../lib/auth/config";
import type { Subscription } from "../../lib/auth/supabase";
import { openExternal } from "../../lib/auth/external";
import { useAppTexts } from "../../lib/appTexts";
import ShaleMark from "./ShaleMark";

import { t } from "../../lib/i18n";
interface Props {
  email: string;
  subscription: Subscription | null;
  error: string | null;
  onRecheck: () => Promise<void>;
  onSignOut: () => Promise<void>;
}

const labels = (): Record<string, string> => ({
  none: t("Aucun abonnement"),
  expired: t("Essai terminé"),
  past_due: "Paiement en retard",
  canceled: t("Abonnement résilié"),
  incomplete: "Abonnement incomplet",
});

export default function SubscriptionRequired({
  email,
  subscription,
  error,
  onRecheck,
  onSignOut,
}: Props) {
  const texts = useAppTexts();
  const [busy, setBusy] = useState(false);

  const recheck = async () => {
    setBusy(true);
    try {
      await onRecheck();
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = subscription ? labels()[subscription.status] ?? subscription.status : null;
  // L'essai qui vient de se terminer mérite un autre discours qu'un compte
  // sans abonnement : l'utilisateur a déjà tout vu, il sait ce qu'il achète.
  const expired = subscription?.status === "expired";

  return (
    <div className="flex h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex flex-col items-center">
          <ShaleMark size={48} />
          <h1 className="mt-4 text-xl font-bold tracking-tight text-text">
            {expired ? t("Ton essai est terminé") : "Abonnement requis"}
          </h1>
        </div>

        <div className="card p-6 text-left">
          <p className="text-sm text-text-dim">
            {t("Connecté en tant que")} <span className="text-text">{email}</span>.
          </p>
          <p className="mt-3 text-sm text-text">
            {error
              ? error
              : expired
                ? "Les sept jours sont passés. L'app est en lecture seule : ton historique reste " +
                  "lisible et exportable, rien n'a été supprimé. Un abonnement rouvre tout, " +
                  t("exactement là où tu t'es arrêté.")
                : texts.subRequiredBody}
          </p>
          {statusLabel && !error && (
            <p className="mt-2 text-xs text-text-dim">
              Statut actuel : <span className="text-text">{statusLabel}</span>
            </p>
          )}

          <button
            onClick={() => openExternal(`${ACCOUNT_URL}/account.html`)}
            className="pill mt-5 flex w-full items-center justify-center gap-2 bg-blue py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {expired ? t("Choisir ma formule") : t("Gérer mon abonnement")}
            <IconExternal className="h-4 w-4" />
          </button>
          <button
            onClick={recheck}
            disabled={busy}
            className="pill mt-3 w-full border border-border bg-surface-2 py-2.5 text-sm text-text transition-colors hover:border-blue/50 disabled:opacity-60"
          >
            {busy ? t("Vérification…") : t("J'ai souscrit — revérifier")}
          </button>
        </div>

        <button
          onClick={onSignOut}
          className="mt-5 text-sm text-text-dim transition-opacity hover:opacity-80"
        >
          {t("Se déconnecter")}
        </button>
      </div>
    </div>
  );
}
