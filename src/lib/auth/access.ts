// ─────────────────────────────────────────────────────────────────────────────
// Droit d'entrée dans l'app — un seul endroit décide.
//
// Cette question (« ce compte peut-il ouvrir l'app ? ») était posée en ligne
// dans `useAuth`, mêlée à la restauration de session. Elle vit ici seule, pour
// que l'interrupteur `STRIPE_ENABLED` ait exactement un point d'application et
// qu'on puisse la tester sans monter React.
//
// Voir `entitlements.ts` pour la question voisine mais distincte : « de quoi ce
// compte dispose-t-il une fois entré ? »
// ─────────────────────────────────────────────────────────────────────────────
import { STRIPE_ENABLED } from "./config";
import type { PalierMemorise } from "./stockage";
import { isActive, normaliserTier, type Subscription } from "./supabase";

/**
 * Le compte est-il ACTIVÉ ?
 *
 * L'activation est accordée à la main, compte par compte, dans la table
 * `public.activations` (migration 003). Ce n'est pas un abonnement : rien ne
 * s'achète, rien n'expire. C'est une liste d'invités, et elle existe parce que
 * l'inscription est ouverte à tout le monde depuis le 2026-08-11 — sans elle,
 * le mur d'entrée vérifie soigneusement une identité que le visiteur vient de
 * se délivrer à lui-même.
 *
 * ⚠️ `=== true`, et non un test de véracité. `activated` vaut `undefined` quand
 * la base ne connaît pas encore la colonne (migration non jouée) ou quand le
 * compte n'a aucune ligne d'abonnement. Dans les deux cas la question est SANS
 * RÉPONSE, et une question sans réponse ne peut pas valoir « oui » : c'est
 * exactement la confusion — l'échec d'une vérification valant autorisation —
 * qui avait ouvert l'app en grand jusqu'au 2026-08-12.
 */
export function estActive(sub: Subscription | null | undefined): boolean {
  return sub?.activated === true;
}

/**
 * Le compte a-t-il le droit d'ouvrir l'app ?
 *
 * UN SEUL MUR À LA FOIS, et lequel dépend de `STRIPE_ENABLED` :
 *
 *  • Stripe ÉTEINT — l'activation, « cette personne est-elle invitée ? ».
 *    Il n'y a rien à vendre, donc rien à vérifier côté paiement, et la liste
 *    d'invités reste le seul mur ;
 *  • Stripe ALLUMÉ — le paiement, « cette personne a-t-elle payé ? ».
 *    L'activation n'est PLUS consultée : un abonné jamais invité entre.
 *
 * ⚠️ Les deux conditions ne se cumulent PAS — ce commentaire a dit l'inverse
 * jusqu'au 2026-08-30, et il décrivait alors une règle que le corps de la
 * fonction n'applique plus. Décision d'Antonin : deux barrières, toutes deux
 * AUTOMATIQUES — l'e-mail confirmé, puis le paiement — et plus aucune
 * intervention manuelle. La première ne se trouve pas ici : elle est chez
 * Supabase, qui n'ouvre aucune session tant que le lien n'est pas cliqué.
 *
 * ▶️ Elles se relaient, donc, au lieu de s'ajouter. Le retour en arrière reste
 * sûr : `STRIPE_ENABLED` à faux redonne le mur à `public.activations`, qui
 * n'est ni supprimée ni vidée.
 */
export function hasAccess(sub: Subscription | null | undefined): boolean {
  // ── Stripe ÉTEINT ────────────────────────────────────────────────────────
  // Il n'y a rien à vendre, donc rien à vérifier côté paiement. La liste
  // d'invités reste alors le SEUL mur — sans elle, l'app s'ouvrirait à
  // quiconque possède une adresse e-mail.
  if (!STRIPE_ENABLED) return estActive(sub);

  // ── Stripe ALLUMÉ ────────────────────────────────────────────────────────
  // Deux barrières, toutes deux AUTOMATIQUES, et plus aucune intervention
  // manuelle (décision d'Antonin, 2026-08-30) :
  //   1. la confirmation de l'e-mail — elle n'est pas ici, elle est chez
  //      Supabase, qui n'ouvre aucune session tant que le lien n'est pas
  //      cliqué (`mailer_autoconfirm: false`, vérifié sur le projet) ;
  //   2. le paiement, ci-dessous.
  //
  // ⚠️ `public.activations` existe toujours et n'est pas supprimée — elle
  // n'est simplement plus consultée comme mur. Elle redevient le mur si
  // `STRIPE_ENABLED` repasse à faux, ce qui rend ce retour en arrière sûr.
  //
  // ⚠️ ORDRE DE DÉPLOIEMENT — cette fonction est COMPILÉE dans le binaire.
  // Publier un `.dmg` qui la contient AVANT que le paiement encaisse
  // réellement ne laisserait qu'une barrière : un lien cliqué dans une boîte
  // mail. Séquence obligatoire : clés Stripe LIVE → `STRIPE_ENABLED = true`
  // des deux côtés → build → publication du `.dmg`. Jamais l'inverse.
  return isActive(sub?.status);
}

// ── Le palier, hors ligne ───────────────────────────────────────────────────
//
// Ajouté le 2026-09-13 (chantier « profils de licence »). Deux fonctions pures,
// et elles vont ensemble : ce qu'on retient du serveur, et ce qu'on en refait
// quand il ne répond pas.

/** Ce qui mérite d'être retenu d'un abonnement confirmé par le serveur. */
export function palierDe(sub: Subscription): PalierMemorise {
  return {
    status: sub.status,
    tier: normaliserTier(sub.tier),
    hasTrading:
      typeof sub.has_trading === "boolean"
        ? sub.has_trading
        : sub.tier === "shale_trade" || sub.status === "trialing",
  };
}

/**
 * L'abonnement que l'app suppose pendant le délai de grâce hors ligne.
 *
 * `null` sans palier retenu (méta d'avant le 2026-09-13) : c'est le
 * comportement d'avant, l'offre de base. ⚠️ `trial_days_left` reste nul : on
 * ne sait pas combien de jours d'essai il reste, et un bandeau qui inventerait
 * un compte à rebours serait pire qu'aucun.
 *
 * ⚠️ Cet objet ne passe JAMAIS par `hasAccess` : l'entrée hors ligne a déjà
 * été décidée par `activated` et le délai de grâce. Il ne sert qu'à dire DE
 * QUOI le compte dispose une fois entré.
 */
export function abonnementHorsLigne(palier: PalierMemorise | undefined): Subscription | null {
  if (!palier) return null;
  return {
    status: palier.status,
    tier: palier.tier,
    has_trading: palier.hasTrading,
    current_period_end: null,
    plan: null,
    trial_days_left: null,
    activated: true,
  };
}
