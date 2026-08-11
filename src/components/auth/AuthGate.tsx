import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type AuthState } from "../../lib/auth/useAuth";
import LoginScreen from "./LoginScreen";
import SubscriptionRequired from "./SubscriptionRequired";
import ShaleMark from "./ShaleMark";
import { openExternal } from "../../lib/auth/external";
import { ACCOUNT_URL, STRIPE_ENABLED } from "../../lib/auth/config";

import { t } from "../../lib/i18n";
// Contexte d'auth exposé à l'app déverrouillée (déconnexion, e-mail, abonnement).
const AuthContext = createContext<AuthState | null>(null);

/** Accès à la session depuis l'app (ex. bouton « Se déconnecter » dans Réglages). */
export function useSession(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error(t("useSession doit être utilisé dans <AuthGate>"));
  return ctx;
}

function Splash() {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-bg">
      <div className="animate-pulse">
        <ShaleMark size={48} />
      </div>
      <p className="text-sm text-text-dim">Chargement…</p>
    </div>
  );
}

/**
 * Bandeau d'essai : discret tant qu'il reste du temps, ambre sur la fin.
 * Il ne s'affiche que pendant l'essai gratuit — jamais pour un abonné.
 */
function TrialBanner({ days }: { days: number }) {
  const urgent = days <= 2;
  return (
    <div
      className={`flex items-center justify-center gap-3 border-b px-4 py-1.5 text-[12px] ${
        urgent
          ? "border-yellow/30 bg-yellow/10 text-yellow"
          : "border-border bg-surface text-text-dim"
      }`}
    >
      <span>
        Essai gratuit —{" "}
        <span className="font-semibold">
          {days === 0
            ? t("dernier jour")
            : `${days} jour${days > 1 ? "s" : ""} restant${days > 1 ? "s" : ""}`}
        </span>
      </span>
      <button
        onClick={() => openExternal(`${ACCOUNT_URL}/account.html`)}
        className="underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
      >
        {t("Choisir ma formule")}
      </button>
    </div>
  );
}

/** Porte d'entrée : login → vérif abonnement → app. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === "loading") return <Splash />;
  if (auth.status === "signedOut")
    return <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  if (auth.status === "noSub")
    return (
      <SubscriptionRequired
        email={auth.session?.user.email ?? ""}
        subscription={auth.subscription}
        error={auth.error}
        onRecheck={auth.recheck}
        onSignOut={auth.signOut}
      />
    );

  // Le bandeau lit `status` en direct, sans passer par `entitlementsOf` — d'où
  // le rappel du drapeau ici. Sans lui, la base ouvre bien une ligne
  // `trialing` à la création du compte (c'est son rôle, indépendamment de
  // Stripe) et l'app affichait « Essai gratuit — 7 jours restants · Choisir ma
  // formule » à un utilisateur qui a déjà tout et n'a rien à choisir : une
  // échéance inventée au-dessus d'un produit sans mur de paiement.
  //
  // `entitlementsOf` serait le bon appel, mais `entitlements.ts` importe
  // `useSession` d'ici : le cycle d'imports rendrait ce module fragile pour un
  // gain nul, la question tenant en un booléen.
  const trialDays =
    STRIPE_ENABLED && auth.subscription?.status === "trialing"
      ? (auth.subscription.trial_days_left ?? null)
      : null;

  return (
    <AuthContext.Provider value={auth}>
      {trialDays !== null && <TrialBanner days={trialDays} />}
      {children}
    </AuthContext.Provider>
  );
}
