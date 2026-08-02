import { useCallback, useEffect, useRef, useState } from "react";
import { ADMIN_EMAILS, AUTH_CONFIGURED } from "./config";
import { t } from "../i18n";
import {
  fetchSubscription,
  isActive,
  refreshSession,
  signInWithPassword,
  signOutServer,
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
      setStatus(isActive(sub.status) ? "ready" : "noSub");
    } catch (e) {
      // L'abonnement n'a pas pu être vérifié (réseau) : on refuse l'accès plutôt
      // que d'ouvrir l'app sans droit. La session reste pour un nouvel essai.
      setSession(s);
      setSubscription(null);
      setError(e instanceof Error ? e.message : t("Vérification de l'abonnement impossible."));
      setStatus("noSub");
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

  return { status, session, subscription, isAdmin, error, signIn, signOut, recheck };
}
