// ─────────────────────────────────────────────────────────────────────────────
// Droits de l'utilisateur courant — helper UNIQUE consommé par toute l'UI.
//
//   const { tier, isTrialing, hasTrading } = useEntitlements();
//
// Ce qui EST inclus dans quoi se lit dans `lib/features.ts`. Ce fichier ne
// répond qu'à une question : « de quoi ce compte dispose-t-il ? »
//
// ⚠️ Source de vérité = le SERVEUR. La vue `my_subscription` calcule déjà
// `has_trading` (et fait expirer l'essai côté base). On lit sa réponse quand
// elle existe ; le calcul local n'est qu'un repli pour les bases antérieures à
// la migration 001 et pour le mode démo. Ces droits pilotent l'AFFICHAGE et la
// navigation — ils ne protègent aucune donnée : tout est local (SQLite), il n'y
// a rien à exfiltrer côté serveur.
// ─────────────────────────────────────────────────────────────────────────────
import { useSession } from "../components/auth/AuthGate";
import { STRIPE_ENABLED } from "./auth/config";
import type { BillingPeriod, Subscription, Tier } from "./auth/supabase";

export interface Entitlements {
  /** Offre souscrite. Repli sur `shale` si la base ne connaît pas encore le tier. */
  tier: Tier;
  /** Essai gratuit en cours. */
  isTrialing: boolean;
  /**
   * Accès aux modules trading.
   * Pendant l'essai, TOUT est ouvert — c'est le levier de conversion vers
   * Shale Trade : on ne vend pas une fonctionnalité que l'utilisateur n'a
   * jamais pu voir.
   */
  hasTrading: boolean;
  /** Périodicité de facturation, `null` pendant l'essai sans choix exprimé. */
  billingPeriod: BillingPeriod | null;
  /** Jours entiers restants avant la fin de l'essai (`null` hors essai). */
  trialDaysLeft: number | null;
}

/** Version pure, sans React : sert au hook et se teste seule. */
export function entitlementsOf(sub: Subscription | null | undefined): Entitlements {
  // Sans mur de paiement, il n'y a rien à doser : tout compte dispose de tout.
  // `isTrialing` reste faux exprès — un bandeau « 5 jours restants » au-dessus
  // d'un produit qu'on ne peut pas encore acheter n'annonce qu'une échéance
  // imaginaire. Voir `STRIPE_ENABLED` dans `auth/config.ts`.
  if (!STRIPE_ENABLED)
    return {
      tier: "shale_trade",
      isTrialing: false,
      hasTrading: true,
      billingPeriod: null,
      trialDaysLeft: null,
    };

  const isTrialing = sub?.status === "trialing";
  const tier: Tier = sub?.tier === "shale_trade" ? "shale_trade" : "shale";

  return {
    tier,
    isTrialing,
    // `has_trading` absent = base d'avant la migration 001 (la colonne n'existe
    // pas) : on recalcule la même règle côté client plutôt que de tout verrouiller.
    hasTrading:
      typeof sub?.has_trading === "boolean"
        ? sub.has_trading
        : tier === "shale_trade" || isTrialing,
    billingPeriod: sub?.billing_period ?? null,
    trialDaysLeft: isTrialing ? (sub?.trial_days_left ?? null) : null,
  };
}

/** Droits de l'utilisateur connecté. À n'appeler que sous `<AuthGate>`. */
export function useEntitlements(): Entitlements {
  return entitlementsOf(useSession().subscription);
}

/** Libellé commercial d'une offre (traduit à l'affichage, jamais ici). */
export function tierLabel(tier: Tier): string {
  return tier === "shale_trade" ? "Shale Trade" : "Shale";
}
