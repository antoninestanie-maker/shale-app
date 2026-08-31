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
import { isActive, type Subscription } from "./supabase";

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
 * DEUX CONDITIONS QUI SE CUMULENT, et qui ne répondent pas à la même question :
 *
 *  • l'activation — « cette personne est-elle invitée ? » — vaut toujours, y
 *    compris Stripe éteint. C'est le seul mur en service aujourd'hui ;
 *  • l'abonnement — « cette personne a-t-elle payé ? » — ne vaut que si
 *    `STRIPE_ENABLED`. Tant qu'il est faux il n'y a pas d'offre à vendre, donc
 *    pas de raison de refuser l'entrée à un invité, et surtout pas d'état
 *    « en attente » devant un bouton d'achat qui ne mène nulle part.
 *
 * Le jour où Stripe s'allume, un invité non abonné se verra refuser l'entrée
 * par la seconde condition — et un abonné non invité par la première. Aucune
 * des deux ne dispense de l'autre.
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
