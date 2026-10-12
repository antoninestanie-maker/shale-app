/**
 * ⭐ UN CALQUE PLEIN ÉCRAN PREND LA MAIN — et la rend en partant (2026-10-12).
 *
 * LE DÉFAUT PAYÉ ICI (seconde passe du labo, 12 octobre, constats 1 et 3).
 * « ⋯ › Focus 25 min » ouvrait l'horloge en plein écran… et le clavier restait
 * à la page de derrière : le focus était encore sur le « ⋯ » de la ligne.
 * Espace rouvrait le menu de la tâche PAR-DESSUS l'horloge, « Terminer »
 * surligné ; un second Espace marquait la tâche faite, sans que rien le montre.
 * Trois utilisateurs sur trois qui ont cherché la pause au clavier y sont tombés.
 *
 * Un calque qui recouvre tout l'écran doit donc trois choses, et elles vont
 * ensemble :
 *   1. ce qui est dessous devient INERTE (`inert` sur `#root`) : ni clic, ni
 *      tabulation, ni focus ;
 *   2. le focus ENTRE dans le calque à l'ouverture ;
 *   3. à la fermeture, le focus REVIENT là d'où l'on venait.
 *
 * ⚠️ Le calque doit vivre HORS de `#root` (`createPortal(…, document.body)`),
 * sinon il s'éteint lui-même (PIEGES § 18.1). Les toasts y vivent déjà
 * (§ 24.13) : ils restent cliquables par-dessus.
 *
 * ⚠️ `inert` se COMPTE : deux calques peuvent se recouvrir (la pause qui
 * s'enchaîne en plein écran pendant qu'une carte mentale est ouverte). Le
 * premier qui se ferme ne doit pas rallumer l'app sous le second.
 */

let inertes = 0;

/** Rend l'app (`#root`) inerte. Rend la fonction qui la rallume. */
export function rendreLeResteInerte(): () => void {
  const app = document.getElementById("root");
  inertes += 1;
  app?.setAttribute("inert", "");
  let rendu = false;
  return () => {
    if (rendu) return;
    rendu = true;
    inertes = Math.max(0, inertes - 1);
    if (inertes === 0) app?.removeAttribute("inert");
  };
}

/** Le calque ouvert qui attend de savoir à qui rendre le focus. */
let enAttente: { retour: HTMLElement | null } | null = null;

/** Un élément à qui l'on peut rendre le focus : dans le document, et pas un menu qui se ferme. */
function origineValable(el: Element | null): el is HTMLElement {
  if (!el || !("focus" in el) || !el.isConnected) return false;
  if (el === el.ownerDocument?.body) return false;
  return !el.closest("[data-menu-contextuel]");
}

/**
 * Ouvre un calque plein écran : le reste devient inerte, le focus entre dans
 * `conteneur` (qui doit porter `tabIndex={-1}`), et la fonction rendue referme
 * — elle rallume l'app et rend le focus à l'élément d'où l'on venait.
 */
export function ouvrirCalque(conteneur: HTMLElement): () => void {
  const actif = document.activeElement;
  const calque = { retour: origineValable(actif) ? actif : null };
  enAttente = calque;
  const rallumer = rendreLeResteInerte();
  conteneur.focus({ preventScroll: true });
  return () => {
    rallumer();
    if (enAttente === calque) enAttente = null;
    // S'il reste un calque dessous, l'élément est encore inerte : le focus n'y
    // prendrait pas, et ce n'est pas à nous de le poser.
    const { retour } = calque;
    if (retour?.isConnected && !retour.closest("[inert]")) retour.focus({ preventScroll: true });
  };
}

/**
 * ⭐ « Le focus te revient, mais plus tard. »
 *
 * Un menu contextuel rend le focus à son bouton « ⋯ » une image APRÈS s'être
 * fermé. Si l'entrée choisie a ouvert un calque entre-temps, le bouton est sous
 * le calque : on ne lui donne pas le focus (c'était le défaut), on le CONFIE au
 * calque, qui le lui rendra en se fermant.
 *
 * Rend VRAI si un calque l'a retenu. Un calque qui connaît déjà son origine la
 * garde : le premier arrivé est celui d'où l'on venait.
 */
export function confierLeRetour(el: HTMLElement): boolean {
  if (!enAttente) return false;
  if (!enAttente.retour) enAttente.retour = el;
  return true;
}
