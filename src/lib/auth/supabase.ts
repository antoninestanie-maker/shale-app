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

/**
 * Erreur HTTP portant SON CODE DE STATUT.
 *
 * ⚠️ Ce n'est pas du confort de journalisation, c'est une exigence de sécurité,
 * et l'oubli s'est payé le 2026-08-12. `useAuth` doit distinguer « le serveur a
 * REFUSÉ ce jeton » (→ déconnecter) de « le serveur n'a pas RÉPONDU » (→ mode
 * hors ligne toléré). Sans statut sur l'erreur, il ne peut trancher que par
 * défaut — et le défaut confortable côté ergonomie, « c'est sûrement le
 * réseau », est le défaut PERMISSIF côté sécurité.
 *
 * Constaté en test : un `refresh_token` inventé produisait une `Error` nue,
 * donc lue comme une panne réseau, donc ouvrant l'app en mode hors ligne avec
 * des métadonnées forgées. Toute fonction de ce fichier qui lève sur une
 * réponse HTTP passe désormais par ici.
 */
async function erreurHttp(res: Response): Promise<Error & { status: number }> {
  const e = new Error(await readError(res)) as Error & { status: number };
  e.status = res.status;
  return e;
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
  if (!res.ok) throw await erreurHttp(res);
  return toSession(await res.json());
}

/**
 * Création de compte, e-mail + mot de passe.
 *
 * GoTrue répond deux choses différentes selon le réglage « Confirm email » du
 * projet Supabase, et l'appelant doit savoir laquelle :
 *
 *  • confirmation DÉSACTIVÉE → une session complète : le compte est créé ET
 *    connecté, on peut entrer dans l'app immédiatement ;
 *  • confirmation ACTIVÉE → un utilisateur sans jeton : il doit d'abord cliquer
 *    le lien reçu par e-mail.
 *
 * D'où le `null` dans le second cas, plutôt qu'une session fabriquée qui
 * n'ouvrirait aucune porte et ferait échouer la première requête venue.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
): Promise<Session | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw await erreurHttp(res);
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    user?: { id: string; email?: string };
    id?: string;
  };
  if (!body.access_token) return null; // confirmation par e-mail requise
  return toSession(
    body as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      user: { id: string; email?: string };
    },
  );
}

/**
 * Change le mot de passe du compte connecté.
 *
 * Prend un jeton en paramètre plutôt que de lire la session : l'appelant passe
 * par `jetonFrais()`, sans quoi une app ouverte depuis plus d'une heure
 * récolterait un 401 au moment précis où l'utilisateur croit sécuriser son
 * compte.
 */
export async function updatePassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw await erreurHttp(res);
}

/**
 * Demande au SERVEUR qui est le porteur de ce jeton.
 *
 * ⚠️ C'est la pièce qui manquait, et son absence était la faille : jusqu'au
 * 2026-08-12, l'app restaurait une session depuis `localStorage` et la croyait
 * sur parole tant que son `expires_at` était dans le futur. Un objet JSON écrit
 * à la main depuis la console ouvrait donc l'app en entier.
 *
 * `getUser()` et non « je regarde ce que j'ai en mémoire » : seul le serveur
 * peut dire si un jeton est authentique, toujours valide, et attaché à un compte
 * qui existe encore. Un compte supprimé ou un jeton révoqué se voit ICI, nulle
 * part ailleurs.
 *
 * Lève sur 401 (jeton refusé) comme sur panne réseau — l'appelant DOIT
 * distinguer les deux : le premier veut dire « déconnecte », le second
 * « on verra plus tard ». Voir `useAuth`.
 */
export async function getUser(token: string): Promise<{ id: string; email: string }> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: authHeaders(token) });
  if (!res.ok) throw await erreurHttp(res);
  const u = (await res.json()) as { id: string; email?: string };
  return { id: u.id, email: u.email ?? "" };
}

/** Rafraîchit une session à partir du refresh_token. */
export async function refreshSession(refreshToken: string): Promise<Session> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) throw await erreurHttp(res);
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
  if (!res.ok) throw await erreurHttp(res);
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
 * donc rien. Voir `shale-site/supabase/schema.sql`.
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
  if (!res.ok) throw await erreurHttp(res);
  const rows = (await res.json()) as Subscription[];
  if (!rows.length)
    return { status: "none", current_period_end: null, plan: null, trial_days_left: null };
  return rows[0];
}
