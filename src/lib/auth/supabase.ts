// Client Supabase minimal (auth GoTrue + lecture PostgREST) via `fetch` global.
// Pas de SDK : moins de poids, comportement identique en natif (WKWebView) et en
// preview navigateur. Supabase renvoie les en-têtes CORS voulus sur ces endpoints.

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch (secondes)
  user: { id: string; email: string };
}

export type SubStatus =
  | "active"
  | "trialing"
  | "expired" // essai gratuit terminé (calculé par la base, pas par l'app)
  | "past_due"
  | "canceled"
  | "incomplete"
  | "none";

/** Offre souscrite. Voir `lib/features.ts` pour la frontière fonctionnelle. */
export type Tier = "shale" | "shale_trade";

/** Périodicité de facturation. */
export type BillingPeriod = "monthly" | "annual";

export interface Subscription {
  status: SubStatus;
  current_period_end: string | null; // ISO
  plan: string | null; // LEGACY ('mensuel' | 'annuel') — préférer billing_period
  /** Offre souscrite. `null` sur une base antérieure à la migration 001. */
  tier?: Tier | null;
  billing_period?: BillingPeriod | null;
  /** Fin de l'essai gratuit, ISO. `null` si l'utilisateur a déjà payé. */
  trial_ends_at?: string | null;
  /** Jours entiers restants avant la fin de l'essai (0 une fois expiré). */
  trial_days_left?: number | null;
  /** Droit d'entrée calculé par la base : essai en cours OU abonnement payé. */
  is_active?: boolean | null;
  /** Droit d'accès aux modules trading, calculé par la base. Fait foi. */
  has_trading?: boolean | null;
}

const ACTIVE: SubStatus[] = ["active", "trialing"];
export const isActive = (s: SubStatus | undefined | null): boolean =>
  !!s && ACTIVE.includes(s);

function authHeaders(token?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token ?? SUPABASE_ANON_KEY}`,
  };
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as {
      error_description?: string;
      msg?: string;
      message?: string;
      error?: string;
    };
    return (
      body.error_description || body.msg || body.message || body.error || `Erreur ${res.status}`
    );
  } catch {
    return `Erreur ${res.status}`;
  }
}

function toSession(raw: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: { id: string; email?: string };
}): Session {
  return {
    access_token: raw.access_token,
    refresh_token: raw.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + raw.expires_in,
    user: { id: raw.user.id, email: raw.user.email ?? "" },
  };
}

/** Connexion email + mot de passe. */
export async function signInWithPassword(email: string, password: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return toSession(await res.json());
}

/** Rafraîchit une session à partir du refresh_token. */
export async function refreshSession(refreshToken: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return toSession(await res.json());
}

/** Envoie un e-mail de réinitialisation de mot de passe (redirige vers le site). */
export async function sendPasswordReset(email: string, redirectTo?: string): Promise<void> {
  const url = new URL(`${SUPABASE_URL}/auth/v1/recover`);
  if (redirectTo) url.searchParams.set("redirect_to", redirectTo);
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

/** Déconnexion côté serveur (révoque le refresh token). Best-effort. */
export async function signOutServer(token: string): Promise<void> {
  try {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: authHeaders(token),
    });
  } catch {
    /* réseau coupé : la session locale est de toute façon effacée */
  }
}

/**
 * Statut d'abonnement de l'utilisateur connecté.
 *
 * On lit la VUE `my_subscription` et non la table : c'est elle qui fait expirer
 * l'essai gratuit, côté serveur. Reculer l'horloge de sa machine ne prolonge
 * donc rien. Voir `shale-site/compte/supabase/schema.sql`.
 */
export async function fetchSubscription(session: Session): Promise<Subscription> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/my_subscription`);
  url.searchParams.set("user_id", `eq.${session.user.id}`);
  url.searchParams.set(
    "select",
    "status,tier,billing_period,plan,current_period_end,trial_ends_at,trial_days_left,is_active,has_trading",
  );
  url.searchParams.set("limit", "1");
  const res = await fetch(url.toString(), { headers: authHeaders(session.access_token) });
  if (!res.ok) throw new Error(await readError(res));
  const rows = (await res.json()) as Subscription[];
  if (!rows.length)
    return { status: "none", current_period_end: null, plan: null, trial_days_left: null };
  return rows[0];
}
