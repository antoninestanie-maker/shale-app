/**
 * Le sas : par où le mot de passe passe du login à la clé de chiffrement, une
 * seule fois, sans jamais se poser nulle part.
 *
 * ─── POURQUOI CE DÉTOUR ────────────────────────────────────────────────────
 * Le chiffrement de bout en bout exige un secret que le serveur n'a pas. Le
 * seul dont l'utilisateur dispose est son mot de passe — et il n'existe que
 * pendant l'instant où il le tape. Passé cet instant, il n'y a plus qu'une
 * session (un jeton), qui ne permet RIEN de cryptographique.
 *
 * Deux façons de s'en sortir :
 *   • redemander le mot de passe dans un écran dédié — ce qu'on faisait, et qui
 *     ajoutait une cérémonie que personne ne comprend ;
 *   • le saisir au vol au moment du login, où l'utilisateur vient de le taper.
 *
 * C'est la seconde. D'où ce module : `useAuth` DÉPOSE, `useSync` RETIRE. Entre
 * les deux, quelques millisecondes.
 *
 * ─── POURQUOI PAS UN ÉTAT REACT NI UNE PROP ────────────────────────────────
 * Un mot de passe dans un état React se retrouve dans les outils de
 * développement, survit aux rendus, et se recopie dans chaque closure qui le
 * capture. Ici il vit dans UNE variable de module, il est retiré par le premier
 * qui le lit, et effacé à la déconnexion.
 *
 * ⚠️ Il n'est JAMAIS écrit : ni localStorage, ni SQLite, ni trousseau, ni
 * journal. Ce qui est rangé durablement, c'est la clé de données qu'il aura
 * servi à ouvrir — pas lui.
 */

let motDePasse: string | null = null;

/**
 * Événement émis à chaque dépôt.
 *
 * Il est nécessaire en plus de la variable : un dépôt peut survenir alors que
 * `useSync` est DÉJÀ monté et sa clé déjà ouverte — typiquement un changement
 * de mot de passe. Sans signal, personne ne viendrait re-sceller l'enveloppe et
 * la copie cloud deviendrait illisible depuis tout nouvel appareil.
 *
 * L'événement ne TRANSPORTE PAS le secret : il dit seulement qu'il y en a un à
 * retirer. Un mot de passe dans un `CustomEvent.detail` serait lisible par
 * n'importe quel autre écouteur de la page.
 */
export const EVENEMENT_SECRET = "sb:sync-secret";

/** Appelé après une connexion, une inscription ou un changement de mot de passe. */
export function deposerMotDePasse(secret: string): void {
  motDePasse = secret;
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENEMENT_SECRET));
}

/**
 * Récupère le mot de passe ET l'efface dans le même geste.
 *
 * Le retrait est destructif à dessein : un second appel renvoie `null`. Si un
 * jour deux endroits en avaient besoin, ce serait le signe qu'il faut le
 * dériver une fois pour toutes, pas le faire circuler davantage.
 */
export function retirerMotDePasse(): string | null {
  const secret = motDePasse;
  motDePasse = null;
  return secret;
}

/** Déconnexion, ou changement de compte. */
export function viderSas(): void {
  motDePasse = null;
}
