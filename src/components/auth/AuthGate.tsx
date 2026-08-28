import { createContext, useContext, type ReactNode } from "react";
import { useAuth, type AuthState } from "../../lib/auth/useAuth";
import LoginScreen from "./LoginScreen";
import ChassisFactice from "./ChassisFactice";
import SubscriptionRequired from "./SubscriptionRequired";
import ShaleMark from "./ShaleMark";
import { openExternal } from "../../lib/auth/external";
import { ACCOUNT_PAGES, STRIPE_ENABLED } from "../../lib/auth/config";

import { t, tp } from "../../lib/i18n";
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
      <p className="text-sm text-text-dim">{t("Chargement…")}</p>
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
        {t("Essai gratuit —")}{" "}
        <span className="font-semibold">
          {days === 0
            ? t("dernier jour")
            : tp(days, "{n} jour restant", "{n} jours restants")}
        </span>
      </span>
      <button
        onClick={() => openExternal(ACCOUNT_PAGES.home)}
        className="underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
      >
        {t("Choisir ma formule")}
      </button>
    </div>
  );
}

/**
 * Bandeau « hors ligne » du mode dégradé.
 *
 * Discret mais permanent : l'utilisateur doit pouvoir comprendre, sans le
 * chercher, pourquoi sa synchronisation ne part pas. « Réessayer » repasse par
 * le serveur — c'est le seul chemin de retour vers `ready`.
 */
function BandeauHorsLigne({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex items-center justify-center gap-3 border-b border-border bg-surface px-4 py-1.5 text-[12px] text-text-dim">
      <span className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-yellow" />
        {t("Hors ligne — tes données restent sur ce Mac, la synchronisation reprendra plus tard.")}
      </span>
      <button
        onClick={onRetry}
        className="underline decoration-dotted underline-offset-2 transition-opacity hover:opacity-80"
      >
        {t("Réessayer")}
      </button>
    </div>
  );
}

/**
 * Le mur de connexion, plein cadre.
 *
 * Le décor est une MAQUETTE (`ChassisFactice`), pas l'app : la monter pour la
 * flouter reviendrait à lire SQLite et à rendre de vraies données avant toute
 * authentification. Voir le fichier, qui porte le raisonnement.
 */
function Mur({ auth }: { auth: AuthState }) {
  return (
    <div className="relative h-screen overflow-hidden bg-bg">
      <ChassisFactice />
      <div className="relative h-full">
        <LoginScreen
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
          erreurInitiale={auth.error}
        />
      </div>
    </div>
  );
}

/**
 * Porte d'entrée.
 *
 * ⚠️ `children` — c'est-à-dire toute l'app — n'est rendu QUE dans les états
 * `ready` et `offlineGrace`. Ce n'est pas un détail de présentation : tant qu'on
 * n'y est pas, `App` n'est pas monté, donc `fetchAll()` n'est jamais appelé et
 * SQLite n'est pas lue. Un mur qui monterait l'app derrière lui ne serait pas
 * un mur.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const auth = useAuth();

  if (auth.status === "loading") return <Splash />;
  if (auth.status === "signedOut") return <Mur auth={auth} />;
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
      {auth.status === "offlineGrace" && <BandeauHorsLigne onRetry={auth.recheck} />}
      {trialDays !== null && <TrialBanner days={trialDays} />}
      {children}
    </AuthContext.Provider>
  );
}
