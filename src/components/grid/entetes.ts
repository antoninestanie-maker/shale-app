import { enteteSerre, reserveDEntete, type BordsEcran } from "../../lib/grille";

/**
 * ⭐ JAUGER LES EN-TÊTES D'UN PANNEAU (2026-10-12) — la mesure derrière la
 * règle « survoler un panneau ne change jamais sa hauteur ». La règle et son
 * pourquoi sont dans `lib/grille.ts` (`reserveDEntete`, `enteteSerre`).
 *
 * Pour chaque `.rgrid-head` du panneau, on pose :
 *   • `--rgrid-reserve` : la largeur que la barre de poignées recouvre
 *     vraiment (0 px quand elle ne passe pas dessus) ;
 *   • `data-rgrid-serre` : quand cette réserve ferait grandir l'en-tête. Le
 *     CSS (`index.css`, « Anti-superposition des poignées ») la rend alors
 *     permanente, au lieu de la poser au survol.
 *
 * ⚠️ TROIS LECTURES FORCÉES, PAS UNE DE PLUS, et seulement quand quelque chose
 * a changé (`signature`). `ResizablePanel` appelle cette fonction à chaque
 * mesure — donc à chaque image d'un redimensionnement de fenêtre.
 *
 * ⚠️ `transition: none` EST TENU JUSQU'AU BOUT, et retiré en dernier, après
 * une lecture. Sinon le navigateur voit le `padding` passer de la valeur
 * d'essai à la valeur de repos et l'ANIME : l'en-tête se repliait puis se
 * dépliait à chaque mesure, ce qui relançait la mesure.
 *
 * ⚠️ On écrit dans `style` et dans un attribut `data-` : l'observateur de
 * mutations de `ResizablePanel` ne regarde que `class`. Une classe posée ici
 * relancerait la mesure, qui relancerait la jauge.
 */

const signatures = new WeakMap<HTMLElement, string>();

function bords(el: Element): BordsEcran {
  const r = el.getBoundingClientRect();
  return { haut: r.top, bas: r.bottom, gauche: r.left, droite: r.right };
}

/** Ce dont dépend la décision. Tant qu'elle ne change pas, on ne re-mesure pas. */
function signature(tete: HTMLElement, panneau: HTMLElement, barre: HTMLElement): string {
  const p = panneau.getBoundingClientRect();
  const t = tete.getBoundingClientRect();
  const b = barre.getBoundingClientRect();
  const morceaux: number[] = [p.width, t.top - p.top, t.right - p.left, b.left - p.left, b.width, b.bottom - p.top];
  // La largeur du contenu, pas sa position : le survol décale, il n'élargit pas.
  for (const enfant of Array.from(tete.children)) morceaux.push((enfant as HTMLElement).offsetWidth);
  return morceaux.map((n) => Math.round(n * 2) / 2).join("|") + "|" + (tete.textContent?.length ?? 0);
}

export function jaugerEntetes(panneau: HTMLElement, force = false): void {
  const barre = panneau.querySelector<HTMLElement>(":scope > .rgrid-poignees");
  if (!barre) return;
  // Les en-têtes de CE panneau : pas ceux d'une grille posée dedans.
  const tetes = Array.from(panneau.querySelectorAll<HTMLElement>(".rgrid-head")).filter(
    (t) => t.closest("[data-pid]") === panneau,
  );
  if (tetes.length === 0) return;

  const aJauger = tetes.filter((t) => {
    const s = signature(t, panneau, barre);
    if (!force && signatures.get(t) === s) return false;
    signatures.set(t, s);
    return true;
  });
  if (aJauger.length === 0) return;

  const echelle = panneau.offsetWidth > 0 ? panneau.getBoundingClientRect().width / panneau.offsetWidth : 1;

  // 1. Sans réserve.
  for (const t of aJauger) {
    t.style.setProperty("transition", "none", "important");
    t.style.setProperty("padding-right", "0px", "important");
  }
  const rb = bords(barre);
  const sans = aJauger.map((t) => ({ hauteur: t.offsetHeight, reserve: reserveDEntete(bords(t), rb, echelle) }));

  // 2. Avec.
  aJauger.forEach((t, i) => {
    if (sans[i].reserve > 0) t.style.setProperty("padding-right", `${sans[i].reserve}px`, "important");
  });
  const serres = aJauger.map((t, i) => sans[i].reserve > 0 && enteteSerre(sans[i].hauteur, t.offsetHeight));

  // 3. Le résultat, puis le retour au style de la feuille — transition toujours coupée.
  aJauger.forEach((t, i) => {
    t.style.setProperty("--rgrid-reserve", `${sans[i].reserve}px`);
    if (serres[i]) t.setAttribute("data-rgrid-serre", "");
    else t.removeAttribute("data-rgrid-serre");
    t.style.removeProperty("padding-right");
  });
  void panneau.offsetHeight;
  for (const t of aJauger) {
    t.style.removeProperty("transition");
    // La signature d'APRÈS : un en-tête devenu serré a changé de forme, et la
    // mesure suivante ne doit pas le prendre pour un changement de contenu.
    signatures.set(t, signature(t, panneau, barre));
  }
}
