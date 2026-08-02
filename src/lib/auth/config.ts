// Configuration d'authentification Shale.
// ─────────────────────────────────────────────────────────────────────────────
// Ces 3 valeurs relient l'app desktop au backend commercial (Supabase + Stripe).
// Renseigne-les depuis ton projet Supabase (Settings → API) et l'URL de ton site.
//
// ⚠️ La clé "anon" est PUBLIQUE (elle est faite pour vivre côté client) : elle ne
// donne accès qu'à ce que tes Row-Level-Security policies autorisent. Ne mets
// JAMAIS la clé "service_role" ici.
//
// Tant que SUPABASE_URL est vide, l'app tourne en MODE DÉMO : l'écran de login
// s'affiche mais n'importe quel identifiant déverrouille l'app (utile pour
// développer l'UI sans backend). Dès que tu renseignes l'URL, l'auth réelle
// prend le relais.

export const SUPABASE_URL = ""; // ex: "https://xxxxxxxxxxxx.supabase.co"
export const SUPABASE_ANON_KEY = ""; // clé "anon public"

/** Site commercial : création de compte, gestion de l'abonnement, facturation. */
export const WEBSITE_URL = "https://shale.app";

/**
 * Comptes ayant accès au mode Admin (console de gestion dans l'app).
 * En mode démo (auth non configurée), l'admin est toujours visible.
 */
export const ADMIN_EMAILS: string[] = ["antonin.estanie@icloud.com"];

/** L'auth réelle est-elle configurée ? Sinon → mode démo (bypass). */
export const AUTH_CONFIGURED = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
