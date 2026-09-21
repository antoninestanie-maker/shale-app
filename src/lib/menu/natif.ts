/**
 * Le menu natif du WebView : conservé là où il sert, retiré ailleurs.
 *
 * ⭐ CE QUI EST EN JEU. Un clic droit sur le fond de l'app ouvrait le menu de
 * Chromium — « Recharger », « Inspecter l'élément », « Retour ». Ces trois mots
 * disent à l'utilisateur que Shale est une page web dans une fenêtre, ce
 * qu'elle est, mais ce qu'elle n'a pas à annoncer.
 *
 * ⚠️ MAIS SEULEMENT EN PRODUCTION. « Inspecter l'élément » est l'outil de
 * travail du dépôt : le retirer en développement reviendrait à se couper la
 * main qui écrit. `import.meta.env.PROD` est vrai dans le bundle de
 * `vite build`, donc dans l'app installée, et faux sous `vite` et sous `vitest`.
 *
 * ⚠️ ET JAMAIS SUR DU TEXTE. Dans un champ, une zone de saisie ou une sélection,
 * le menu natif porte Copier, Coller, Rechercher, et surtout le CORRECTEUR
 * ORTHOGRAPHIQUE de macOS, que rien dans l'app ne remplace. Le retirer là ferait
 * perdre une fonction réelle pour gagner une cosmétique.
 */

/**
 * La cible d'un clic droit appartient-elle à une zone où le menu natif sert ?
 *
 * Exporté pour être testé : c'est la seule règle du fichier, et elle décide de
 * la présence ou non du correcteur orthographique.
 */
export function zoneDeTexte(cible: EventTarget | null, selection: string): boolean {
  // Une sélection en cours, où qu'elle soit : Copier et Rechercher ont un sens
  // même sur du texte non modifiable.
  if (selection.trim().length > 0) return true;

  if (!(cible instanceof Element)) return false;
  const balise = cible.tagName.toLowerCase();
  if (balise === "input" || balise === "textarea" || balise === "select") return true;

  // `closest` et pas la cible seule : dans un `contenteditable`, le clic tombe
  // sur le `<p>`, le `<b>` ou le `<svg>` d'une carte mentale — jamais sur
  // l'élément qui porte l'attribut.
  return !!cible.closest('[contenteditable="true"], [contenteditable=""], input, textarea');
}

/**
 * Pose l'écouteur. Rend la fonction qui le retire.
 *
 * ⚠️ En phase de CAPTURE, et c'est ce qui le rend inoffensif : il passe AVANT
 * les `onContextMenu` des composants, mais il ne fait que `preventDefault()`,
 * jamais `stopPropagation()`. Le menu de l'app s'ouvre donc normalement derrière
 * lui — et se serait ouvert de la même façon si cet écouteur n'existait pas.
 */
export function installerMenuNatif(cible: Document = document): () => void {
  if (!import.meta.env.PROD) return () => {};

  const surContextMenu = (e: MouseEvent) => {
    const selection = cible.defaultView?.getSelection()?.toString() ?? "";
    if (zoneDeTexte(e.target, selection)) return;
    e.preventDefault();
  };

  cible.addEventListener("contextmenu", surContextMenu, true);
  return () => cible.removeEventListener("contextmenu", surContextMenu, true);
}
