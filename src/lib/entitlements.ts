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
// navigation — ils ne protègent aucune donnée : la base est locale (SQLite), et
// ce qui part vers le serveur (synchronisation) y arrive déjà chiffré de bout en
// bout, illisible pour lui. Il n'y a donc rien à garder derrière ce verrou.
// ─────────────────────────────────────────────────────────────────────────────
import { useMemo } from "react";
import { useSession } from "../components/auth/AuthGate";
import { STRIPE_ENABLED } from "./auth/config";
import type { BillingPeriod, Subscription, Tier } from "./auth/supabase";
import { normaliserTier } from "./auth/supabase";
import type { ModuleProfil } from "./licence/catalogue";
import { moduleVisible, resoudreProfil, type ProfilEffectif } from "./licence/resoudre";
import { isTradingView } from "./features";
import type { LigneProfil } from "./licence/signature";
import { useEtatProfil } from "./licence/useProfil";

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
  const tier: Tier = normaliserTier(sub?.tier);

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

// ── Palier PUIS profil — le point d'entrée unique ──────────────────────────
//
// Ajouté le 2026-09-13 (chantier « profils de licence sur devis »). Tout ce qui
// décide de l'affichage lit `useEntitlements()`, donc passe ici.
//
//   1. le palier fait foi sur ce qui est ACCESSIBLE — `entitlementsOf` le
//      calcule seul, sans voir le profil ;
//   2. le profil ne peut que restreindre l'affichage, réordonner et renommer.
//      Il est résolu APRÈS, avec le palier en entrée, et ne rend aucun droit :
//      `profil` n'a ni `tier` ni `hasTrading`, donc rien à écraser ;
//   3. absent, expiré, mal signé, illisible → `profil.actif` faux, et l'app se
//      comporte exactement comme avant ce chantier.

export interface EntitlementsResolus extends Entitlements {
  profil: ProfilEffectif;
  /**
   * Le CONTENU de ce module s'affiche-t-il ailleurs que dans sa vue — tuile du
   * tableau de bord, panneau d'une autre vue, section de Réglages, rappel ?
   *
   * Vrai seulement si le palier l'autorise ET que le profil ne masque pas le
   * module. Sans cette seconde moitié, un cabinet qui a retiré le trading de sa
   * barre voyait encore « TRADING 7 J » sur son accueil (vu à l'écran le
   * 2026-09-13). ⚠️ Ce n'est pas un droit : `hasTrading` reste celui du palier.
   */
  afficheModule: (module: ModuleProfil) => boolean;
}

export interface EntreeProfil {
  ligne: LigneProfil | null;
  signatureOk: boolean;
  userId: string | null;
  maintenant: number;
}

export function resolveEntitlements(
  sub: Subscription | null | undefined,
  entree: EntreeProfil,
): EntitlementsResolus {
  const palier = entitlementsOf(sub);
  const profil = resoudreProfil({ ...entree, tier: palier.tier });
  const afficheModule = (m: ModuleProfil) =>
    moduleVisible(profil, m) && (palier.hasTrading || !isTradingView(m));
  return { ...palier, profil, afficheModule };
}

/** Droits de l'utilisateur connecté. À n'appeler que sous `<AuthGate>`. */
export function useEntitlements(): EntitlementsResolus {
  const { subscription, session } = useSession();
  const { ligne, signatureOk, maintenant } = useEtatProfil();
  const userId = session?.user.id ?? null;
  return useMemo(
    () => resolveEntitlements(subscription, { ligne, signatureOk, userId, maintenant }),
    [subscription, ligne, signatureOk, userId, maintenant],
  );
}

/** Libellé commercial d'une offre (traduit à l'affichage, jamais ici). */
export function tierLabel(tier: Tier): string {
  switch (tier) {
    case "shale_trade": return "Shale Trade";
    case "shale_pro": return "Shale Pro";
    case "shale_business": return "Shale Business";
    default: return "Shale";
  }
}
