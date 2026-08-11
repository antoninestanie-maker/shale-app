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
 * Le compte a-t-il le droit d'ouvrir l'app ?
 *
 * Tant que Stripe n'est pas branché, la réponse est oui pour tout compte
 * authentifié : il n'y a pas d'offre à vendre, donc pas de raison de refuser
 * l'entrée — et surtout pas d'état « en attente » où l'utilisateur se
 * retrouverait bloqué devant un bouton d'achat qui ne mène nulle part.
 */
export function hasAccess(sub: Subscription | null | undefined): boolean {
  if (!STRIPE_ENABLED) return true;
  return isActive(sub?.status);
}
