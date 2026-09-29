// ─────────────────────────────────────────────────────────────────────────────
// La boutique : là où l'app a le droit de VENDRE, et là où elle se tait.
//
// Décision d'Antonin, 2026-09-26 : sur iPhone, Shale est une app « connexion
// seule ». Tout se paie sur le site (Stripe), Apple ne prélève rien, et l'app
// iOS se contente d'ouvrir un compte DÉJÀ abonné.
//
// Base réglementaire : App Review Guidelines, 3.1.3(f) « Free Stand-alone
// Apps » — une app gratuite qui accompagne un service payé ailleurs échappe à
// l'achat intégré « à condition qu'il n'y ait ni achat dans l'app, ni appel à
// acheter hors de l'app ». Relu à la source le 2026-09-29. Le texte complet,
// et ce qu'il interdit concrètement, est dans `MOBILE.md` § 25.
//
// ⚠️ C'est donc une question d'INCITATION, pas seulement de paiement : un
// bouton « Voir les tarifs », un cadenas « Inclus dans Shale Trade », un nom
// d'offre, un bandeau d'essai, une phrase « abonne-toi sur le site » — chacun
// suffit à faire refuser l'app. Et l'inscription dans l'app déclencherait en
// plus l'obligation de suppression de compte dans l'app (5.1.1(v)).
//
// ⚠️ macOS NE CHANGE PAS. L'app Mac n'est pas sur le Mac App Store : offres,
// essai, cadenas et paywall y restent tels quels. D'où un drapeau de
// plateforme et non une suppression.
//
// ⚠️ UN SEUL endroit décide. Ne jamais tester `IS_IOS` directement pour une
// question commerciale : si la règle change un jour (vitrine US, où Apple
// tolère désormais les liens externes), c'est ici qu'elle se rouvre, et nulle
// part ailleurs.
// ─────────────────────────────────────────────────────────────────────────────
import type { Subscription } from "./auth/supabase";
import { isTradingView } from "./features";
import { IS_IOS } from "./platform";

/**
 * La règle, en fonction pure : se teste sans simuler de plateforme.
 * Vrai = l'app peut montrer offres, prix, essai, cadenas et liens d'achat.
 */
export function commerceAutorisePour(ios: boolean): boolean {
  return !ios;
}

/**
 * Vrai sur macOS (et Windows), FAUX sur iPhone / iPad.
 *
 * Gouverne : écrans d'offre et d'essai, bandeau d'essai, paywall, cadenas des
 * modules, lien « Passer à Shale Trade », nom d'offre dans Réglages, liens
 * vers l'espace compte du site, inscription dans l'app, Console (chiffres
 * d'abonnement), texte « abonnement requis » éditable.
 */
export const COMMERCE_AUTORISE = commerceAutorisePour(IS_IOS);

/**
 * Comment un module se présente à ce compte, sur cette plateforme.
 *
 *   - `ouvert`     : on y va ;
 *   - `verrouille` : visible avec un cadenas, un clic ouvre le paywall — c'est
 *                    de la vente, donc macOS seulement ;
 *   - `absent`     : il n'existe pas pour ce compte. Sur iOS, un module hors
 *                    palier est traité comme un module masqué par le profil :
 *                    pas de cadenas, pas de message, pas de trace commerciale.
 */
export type PresenceModule = "ouvert" | "verrouille" | "absent";

export function presenceModule(
  id: string,
  hasTrading: boolean,
  commerce: boolean = COMMERCE_AUTORISE,
): PresenceModule {
  if (hasTrading || !isTradingView(id)) return "ouvert";
  return commerce ? "verrouille" : "absent";
}

/**
 * Jours d'essai à annoncer dans le bandeau, ou `null` pour ne rien afficher.
 *
 * Sur iOS, JAMAIS : « Essai gratuit — 3 jours restants » est un compte à
 * rebours vers un achat, donc une incitation au sens de 3.1.3(f), même sans
 * bouton à côté.
 */
export function joursEssaiAffiches(
  sub: Subscription | null | undefined,
  stripeActif: boolean,
  commerce: boolean = COMMERCE_AUTORISE,
): number | null {
  if (!commerce || !stripeActif || sub?.status !== "trialing") return null;
  return sub.trial_days_left ?? null;
}
