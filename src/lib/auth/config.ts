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

export const SUPABASE_URL = "https://pdlprlddouzacinfpkes.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkbHBybGRkb3V6YWNpbmZwa2VzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzMDgxMTAsImV4cCI6MjEwMTg4NDExMH0.9BUTvLid8ZsslWl9mykdgcBzo9nsQGGWTHr-yZT2ZRs";

/**
 * Site commercial : pages de vente, blog, documents légaux.
 *
 * ⚠️ ADRESSE RÉELLE DU SITE EN PRODUCTION. `https://shale.app` n'est pas détenu
 * et répond 403 ; inoffensif tant que rien n'était en ligne, cassant depuis la
 * mise en production du 2026-08-10 — `ACCOUNT_URL` en dérive (« Se connecter »)
 * et `Onboarding.tsx` y ouvre les liens légaux.
 *
 * Copie de la branche `windows-build`. La branche `sync-chiffree`
 * (`~/Desktop/Shale`) porte la sienne : les deux se modifient séparément, même
 * dépôt mais deux worktrees.
 */
export const WEBSITE_URL = "https://shale-six.vercel.app";

/**
 * Espace compte : inscription, connexion, mot de passe, abonnement.
 *
 * Sous-dossier du site vitrine, et non un sous-domaine : « Se connecter » ne
 * doit pas faire sauter le visiteur d'un site à l'autre. La copie est faite au
 * build par une intégration Astro (`shale-site/vitrine/astro.config.mjs`).
 *
 * Les `.html` sont explicites, exprès : ils ne dépendent d'aucun réglage
 * d'hébergeur. Un lien vers `/compte/reset` supposerait les « URLs propres »
 * activées — et le jour où elles ne le sont pas, c'est le lien de
 * réinitialisation envoyé par e-mail qui tombe en 404.
 */
export const ACCOUNT_URL = `${WEBSITE_URL}/compte`;

/**
 * Comptes ayant accès au mode Admin (console de gestion dans l'app).
 * En mode démo (auth non configurée), l'admin est toujours visible.
 */
export const ADMIN_EMAILS: string[] = ["antonin.estanie@icloud.com"];

/** L'auth réelle est-elle configurée ? Sinon → mode démo (bypass). */
export const AUTH_CONFIGURED = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Le mur de paiement est-il en service ?
 *
 * `false` = Stripe pas encore branché. Tout compte authentifié entre dans
 * l'app, avec TOUS les modules ouverts : ni écran « abonnement requis », ni
 * bandeau d'essai, ni bouton d'achat. C'est volontairement un seul drapeau et
 * non une suppression du code : la lecture de `my_subscription`, l'écran
 * `SubscriptionRequired` et le calcul des droits restent en place, simplement
 * court-circuités. Repasser à `true` les réactive tels quels.
 *
 * ⚠️ Une seule source de vérité. Le site a son jumeau dans
 * `shale-site/compte/site/assets/config.js` — garder les deux alignés.
 */
export const STRIPE_ENABLED = false;
