import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_EMAILS, AUTH_CONFIGURED, STRIPE_ENABLED } from "./config";
import { hasAccess } from "./access";
import { t } from "../i18n";
import {
  fetchSubscription,
  refreshSession,
  signInWithPassword,
  signOutServer,
  signUpWithPassword,
  updatePassword,
  type Session,
  type Subscription,
} from "./supabase";

const STORAGE_KEY = "shale.session";

// État de la porte d'entrée :
//  loading   — on vérifie la session/abonnement au démarrage
//  signedOut — pas de session valide → écran de connexion
//  noSub     — connecté mais aucun abonnement actif → écran "abonnement requis"
//  ready     — connecté + abonnement actif → l'app est déverrouillée
export type AuthStatus = "loading" | "signedOut" | "noSub" | "ready";

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  subscription: Subscription | null;
  isAdmin: boolean;
  error: string | null;
  signIn: (email: string, password: string, remember: boolean) => Promise<void>;
  /**
   * Crée un compte et, si le projet Supabase n'exige pas de confirmation par
   * e-mail, ouvre la session dans la foulée. `needsConfirmation` dit lequel des
   * deux s'est produit : l'écran doit afficher « va cliquer le lien » au lieu
   * d'attendre une entrée dans l'app qui ne viendra pas.
   */
  signUp: (
    email: string,
    password: string,
    remember: boolean,
  ) => Promise<{ needsConfirmation: boolean }>;
  /** Change le mot de passe du compte connecté (l'utilisateur reste connecté). */
  changePassword: (newPassword: string) => Promise<void>;
  signOut: () => Promise<void>;
  recheck: () => Promise<void>;
}

function loadStored(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}
function persist(s: Session | null, remember: boolean) {
  try {
    if (s && remember) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* stockage indisponible : session mémoire uniquement */
  }
}

// ── Mode démo (auth non configurée) ────────────────────────────────────────
// Permet de développer l'UI sans backend : n'importe quel identifiant entre,
// et l'abonnement est considéré actif. Voir src/lib/auth/config.ts.
//
// L'offre simulée est réglable (Réglages → compte, en démo uniquement) : sans
// ça, le gating des modules trading ne serait pas testable sans Supabase.
const DEMO_TIER_KEY = "shale.demo.tier";

export function demoTier(): "shale" | "shale_trade" | "trialing" {
  try {
    const v = localStorage.getItem(DEMO_TIER_KEY);
    if (v === "shale" || v === "shale_trade" || v === "trialing") return v;
  } catch {
    /* stockage indisponible */
  }
  return "shale_trade";
}

export function setDemoTier(v: "shale" | "shale_trade" | "trialing"): void {
  try {
    localStorage.setItem(DEMO_TIER_KEY, v);
  } catch {
    /* stockage indisponible */
  }
}

function demoSub(): Subscription {
  const v = demoTier();
  if (v === "trialing")
    return {
      status: "trialing",
      plan: "demo",
      tier: "shale",
      billing_period: null,
      current_period_end: null,
      trial_days_left: 5,
      is_active: true,
      has_trading: true, // l'essai ouvre tout
    };
  return {
    status: "active",
    plan: "demo",
    tier: v,
    billing_period: "monthly",
    current_period_end: null,
    is_active: true,
    has_trading: v === "shale_trade",
  };
}
function demoSession(email: string): Session {
  return {
    access_token: "demo",
    refresh_token: "demo",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: "demo-user", email: email || "demo@shale.app" },
  };
}

export function useAuth(): AuthState {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rememberRef = useRef(true);

  // Résout l'état à partir d'une session : vérifie l'abonnement actif.
  const resolve = useCallback(async (s: Session, remember: boolean) => {
    if (!AUTH_CONFIGURED) {
      setSession(s);
      setSubscription(demoSub());
      setStatus("ready");
      persist(s, remember);
      return;
    }
    try {
      const sub = await fetchSubscription(s);
      setSession(s);
      setSubscription(sub);
      setStatus(hasAccess(sub) ? "ready" : "noSub");
    } catch (e) {
      // L'abonnement n'a pas pu être vérifié (réseau, ou vue absente).
      //
      // Quand le mur de paiement est en service, on refuse l'accès plutôt que
      // d'ouvrir l'app sans droit ; la session reste pour un nouvel essai.
      // Quand il ne l'est pas, cet échec ne doit enfermer personne : il n'y a
      // aucun droit à vérifier, et bloquer l'app sur une lecture facultative
      // serait un mur de paiement accidentel.
      setSession(s);
      setSubscription(null);
      if (STRIPE_ENABLED) {
        setError(e instanceof Error ? e.message : t("Vérification de l'abonnement impossible."));
        setStatus("noSub");
      } else {
        setStatus("ready");
      }
    }
    persist(s, remember);
  }, []);

  // Au démarrage : restaure une session stockée, la rafraîchit si nécessaire.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = loadStored();
      if (!stored) {
        if (!cancelled) setStatus("signedOut");
        return;
      }
      if (!AUTH_CONFIGURED) {
        if (!cancelled) await resolve(stored, true);
        return;
      }
      try {
        const fresh =
          stored.expires_at - 60 < Math.floor(Date.now() / 1000)
            ? await refreshSession(stored.refresh_token)
            : stored;
        if (!cancelled) await resolve(fresh, true);
      } catch {
        // refresh token invalide/expiré → reconnexion
        persist(null, true);
        if (!cancelled) setStatus("signedOut");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolve]);

  const signIn = useCallback(
    async (email: string, password: string, remember: boolean) => {
      setError(null);
      rememberRef.current = remember;
      const s = AUTH_CONFIGURED
        ? await signInWithPassword(email.trim(), password)
        : demoSession(email.trim());
      await resolve(s, remember);
    },
    [resolve],
  );

  const signUp = useCallback(
    async (email: string, password: string, remember: boolean) => {
      setError(null);
      rememberRef.current = remember;
      if (!AUTH_CONFIGURED) {
        await resolve(demoSession(email.trim()), remember);
        return { needsConfirmation: false };
      }
      const s = await signUpWithPassword(email.trim(), password);
      if (!s) return { needsConfirmation: true };
      await resolve(s, remember);
      return { needsConfirmation: false };
    },
    [resolve],
  );

  const changePassword = useCallback(
    async (newPassword: string) => {
      // En mode démo il n'y a pas de compte : accepter silencieusement plutôt
      // que d'afficher une erreur sur un écran qui n'a rien fait de mal.
      if (!AUTH_CONFIGURED) return;
      const s = session;
      if (!s) throw new Error(t("Aucune session ouverte."));
      // Un jeton Supabase vit une heure. L'envoyer tel quel depuis une app
      // laissée ouverte, c'est un 401 au moment précis où l'utilisateur croit
      // sécuriser son compte : on le renouvelle d'abord s'il est sur la fin.
      let token = s.access_token;
      if (s.expires_at - 60 < Math.floor(Date.now() / 1000)) {
        const frais = await refreshSession(s.refresh_token);
        setSession(frais);
        persist(frais, rememberRef.current);
        token = frais.access_token;
      }
      await updatePassword(token, newPassword);
    },
    [session],
  );

  const signOut = useCallback(async () => {
    if (session && AUTH_CONFIGURED) await signOutServer(session.access_token);
    persist(null, rememberRef.current);
    setSession(null);
    setSubscription(null);
    setError(null);
    setStatus("signedOut");
  }, [session]);

  const recheck = useCallback(async () => {
    if (session) await resolve(session, rememberRef.current);
  }, [session, resolve]);

  // Rôle admin : allowlist d'e-mails en prod ; toujours vrai en démo.
  const isAdmin = !AUTH_CONFIGURED
    ? true
    : !!session && ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(session.user.email.toLowerCase());

  return {
    status,
    session,
    subscription,
    isAdmin,
    error,
    signIn,
    signUp,
    changePassword,
    signOut,
    recheck,
  };
}
