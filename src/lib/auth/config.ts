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
 * ⚠️ ADRESSE RÉELLE DU SITE EN PRODUCTION, et elle SORT DE L'APP :
 * `ACCOUNT_URL` en dérive (« Se connecter »), et `Onboarding.tsx` ouvre
 * `/legal#cgu` et `/legal#confidentialite` dessus.
 *
 * Historique, parce qu'il explique la prudence de ce commentaire : elle a porté
 * `https://shale.app` jusqu'au 2026-08-10 — un domaine JAMAIS acheté, qui
 * répond 403. Trois liens vers une page d'erreur, inoffensifs tant que rien
 * n'était en ligne. `shale.app` n'a rien à voir avec `shaleapp.com`, acheté le
 * 2026-08-11 : ne pas confondre les deux en relisant d'anciennes consignes.
 *
 * ⚠️ AVEC LE `www.` : Vercel sert le site sur `www.shaleapp.com` et redirige
 * l'apex dessus en 308. Sans le `www`, chaque lien ouvert depuis l'app
 * traverserait une redirection — et surtout, l'app livrée ne se corrige pas :
 * cette constante est COMPILÉE DANS LE BINAIRE. Un changement ici n'atteint les
 * utilisateurs qu'après une nouvelle version publiée.
 *
 * À garder alignée avec `site` dans `shale-site/vitrine/astro.config.mjs` et
 * `config.websiteUrl` dans `shale-site/vitrine/src/content.json`.
 *
 * Cette copie-ci vit sur la branche `sync-chiffree` ; `~/Desktop/Shale-Windows`
 * est un WORKTREE du même dépôt sur `windows-build` et porte sa propre copie du
 * fichier : les deux se modifient séparément.
 */
export const WEBSITE_URL = "https://www.shaleapp.com";

/**
 * Espace compte : inscription, connexion, mot de passe, abonnement.
 *
 * Sous-dossier du site, et non un sous-domaine : « Se connecter » ne doit pas
 * faire sauter le visiteur d'un site à l'autre.
 */
export const ACCOUNT_URL = `${WEBSITE_URL}/compte`;

/**
 * Les pages de l'espace compte, nommées une fois pour toutes.
 *
 * Elles étaient concaténées à la main à SIX endroits (`${ACCOUNT_URL}/account.html`
 * et compagnie), ce qui veut dire six endroits à retrouver le jour où une
 * adresse bouge. C'est arrivé le 2026-08-11 : le site a fusionné son espace
 * compte dans Astro et ses adresses ont perdu leur `.html`.
 *
 * ⚠️ Les anciennes adresses répondent toujours — le site les redirige en 301 —
 * donc rien n'était cassé. Mais une redirection par lien ouvert depuis l'app est
 * un aller-retour réseau gratuit, et surtout : `sendPasswordReset` passe cette
 * URL à Supabase comme cible de retour, et une cible qui redirige doit ÊTRE
 * DANS LA LISTE BLANCHE au même titre que la vraie. Autant viser juste.
 */
export const ACCOUNT_PAGES = {
  home: `${ACCOUNT_URL}/mon-compte`,
  login: `${ACCOUNT_URL}/connexion`,
  signup: `${ACCOUNT_URL}/inscription`,
  reset: `${ACCOUNT_URL}/mot-de-passe`,
  confirm: `${ACCOUNT_URL}/confirmation`,
};

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
 * `shale-site/vitrine/src/lib/compte.ts` — garder les deux alignés (l'espace
 * compte a fusionné dans la vitrine le 2026-08-11).
 */
export const STRIPE_ENABLED = false;
