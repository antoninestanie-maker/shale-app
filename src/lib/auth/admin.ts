import { ADMIN_EMAILS, AUTH_CONFIGURED } from "./config";

/**
 * La page « Admin » (la Console) n'existe que pour le compte d'Antonin —
 * demande du 2026-10-07 : « seulement sur mon compte ».
 *
 * ⚠️ Masquer l'entrée de la barre latérale ne suffit pas : `App.tsx` appelle
 * ces deux fonctions dans `navigate`, dans son filet de repli ET au rendu.
 * Toute vue réservée s'ajoute à `VUES_ADMIN`, nulle part ailleurs.
 */
const VUES_ADMIN: readonly string[] = ["console"];

export function vueReserveeAdmin(vue: string): boolean {
  return VUES_ADMIN.includes(vue);
}

/**
 * Sans auth configurée (preview navigateur), tout le monde est admin : c'est
 * le seul moyen de relire la Console sans piloter le vrai compte. Le binaire
 * distribué a toujours l'auth configurée.
 */
export function estAdmin(
  email: string | null | undefined,
  authConfiguree: boolean = AUTH_CONFIGURED,
  admins: readonly string[] = ADMIN_EMAILS,
): boolean {
  if (!authConfiguree) return true;
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return admins.some((a) => a.trim().toLowerCase() === e);
}
