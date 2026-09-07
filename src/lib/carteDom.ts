import { ATTRIBUT_CARTE, blocCarte, ecrireCarte, lireCarte, rendreSvg, type Carte } from "./carte";

/**
 * Les cartes mentales — la part qui touche au DOM, et rien d'autre.
 *
 * ⚠️ SÉPARÉ DE `lib/carte.ts` À DESSEIN, exactement comme
 * `mentionsDom.ts` l'est de `mentions.ts`. Les tests de ce dépôt tournent en
 * `environment: "node"` : ce fichier-ci n'est pas testable, celui-là l'est
 * entièrement. Tout ce qui peut être décidé sans `document` vit là-bas — le
 * modèle, l'agencement, le rendu SVG, l'historique, la navigation. Il ne reste
 * ici que l'insertion dans un `contenteditable` et la rastérisation, et c'est
 * court exprès.
 */

/** Le bloc `<figure>` d'une carte, s'il y en a un sous ce point de clic. */
export function figureDeCarte(cible: EventTarget | null): HTMLElement | null {
  const el = cible as HTMLElement | null;
  return el?.closest?.(`figure[${ATTRIBUT_CARTE}]`) ?? null;
}

/** La carte que porte un bloc, ou `null` si son attribut est illisible. */
export function carteDuBloc(figure: HTMLElement | null): Carte | null {
  return lireCarte(figure?.getAttribute(ATTRIBUT_CARTE) ?? null);
}

/**
 * Réécrit un bloc EN PLACE : son graphe et son rendu, sans le déplacer.
 *
 * ⚠️ EN PLACE, ET SURTOUT PAS PAR `outerHTML`. Remplacer l'`outerHTML` DÉTACHE
 * le nœud : l'appelant qui en garde une référence — l'éditeur, entre deux
 * enregistrements automatiques — écrirait ensuite dans un élément qui n'est
 * plus dans le document. Sans erreur, sans message, et la carte cesserait
 * simplement de se mettre à jour au bout du premier enregistrement.
 *
 * `setAttribute` échappe le JSON tout seul à la sérialisation : c'est le
 * navigateur qui écrit les `&quot;`, pas nous.
 */
export function remplacerBloc(figure: HTMLElement, carte: Carte): void {
  figure.setAttribute(ATTRIBUT_CARTE, ecrireCarte(carte));
  figure.setAttribute("contenteditable", "false");
  figure.className = "carte-bloc";
  figure.innerHTML = rendreSvg(carte, { mode: "theme" });
}

/**
 * Insère une carte comme BLOC DE PREMIER NIVEAU, juste après le bloc courant.
 *
 * Repris de `NoteComposer.insertBlock` : une `<figure>` dans un `<p>` est du
 * HTML invalide, et sans le paragraphe vide déposé dessous on ne peut plus
 * écrire après le bloc — le curseur reste prisonnier derrière un élément
 * `contenteditable="false"`.
 */
export function insererBloc(racine: HTMLElement, carte: Carte): HTMLElement | null {
  const gabarit = document.createElement("div");
  gabarit.innerHTML = blocCarte(carte);
  const bloc = gabarit.firstElementChild as HTMLElement | null;
  if (!bloc) return null;

  const sel = window.getSelection();
  let point: Node | null =
    sel && sel.rangeCount > 0 && racine.contains(sel.getRangeAt(0).startContainer)
      ? sel.getRangeAt(0).startContainer
      : null;
  while (point && point.parentNode && point.parentNode !== racine) point = point.parentNode;

  if (point && point.parentNode === racine) racine.insertBefore(bloc, point.nextSibling);
  else racine.appendChild(bloc);

  const apres = document.createElement("p");
  apres.appendChild(document.createElement("br"));
  bloc.parentNode?.insertBefore(apres, bloc.nextSibling);

  const curseur = document.createRange();
  curseur.setStart(apres, 0);
  curseur.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(curseur);
  // ⚠️ On REND le bloc posé : l'éditeur doit pouvoir le retrouver pour ses
  // enregistrements suivants, sans avoir à le rechercher dans le document.
  return bloc;
}

/**
 * Réécrit TOUS les blocs de carte d'un corps de note.
 *
 * Sert au chargement : les titres des nœuds-références sont des copies
 * d'affichage, et ils doivent suivre l'état actuel des objets cités. Le rendu
 * SVG est régénéré du même coup — sans quoi la note montrerait l'ancien titre
 * jusqu'à la prochaine ouverture de l'éditeur.
 *
 * ⚠️ On travaille sur un `<template>` détaché, jamais sur le DOM affiché : cette
 * fonction est appelée sur une CHAÎNE (le corps qui sort de la base), avant même
 * que l'éditeur ne l'ait posée.
 */
export function rafraichirBlocs(html: string, transformer: (c: Carte) => Carte): string {
  if (!html || !html.includes(ATTRIBUT_CARTE)) return html;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  let change = false;
  tpl.content.querySelectorAll<HTMLElement>(`figure[${ATTRIBUT_CARTE}]`).forEach((figure) => {
    try {
      change = rafraichirUn(figure, transformer) || change;
    } catch (e) {
      // ⚠️ UN RAFRAÎCHISSEMENT RATÉ NE DOIT JAMAIS EMPÊCHER LA NOTE DE
      // S'AFFICHER. Cette fonction est appelée dans la promesse qui produit le
      // corps « frais » : une exception ici rejetait la promesse, et le corps
      // n'arrivait tout simplement jamais dans l'éditeur. On rend donc la carte
      // telle qu'elle est — un titre périmé se voit, un corps absent ne se
      // diagnostique pas. Le message part en console, volontairement en
      // anglais et non traduit : il ne s'affiche jamais à l'utilisateur.
      console.error("Shale/carte: could not refresh a mind-map block", e);
    }
  });
  return change ? tpl.innerHTML : html;
}

function rafraichirUn(figure: HTMLElement, transformer: (c: Carte) => Carte): boolean {
  const carte = carteDuBloc(figure);
  if (!carte) return false;
  const suivante = transformer(carte);
  if (suivante === carte) return false;
  // ⚠️⚠️ `replaceWith`, ET SURTOUT PAS `outerHTML` — vu à l'écran le
  // 2026-09-07, et c'était une panne SILENCIEUSE.
  //
  // Une carte est toujours un bloc de PREMIER NIVEAU du corps : dans ce
  // `<template>`, son parent est donc le DocumentFragment lui-même, pas un
  // élément. Or écrire `outerHTML` dans ce cas lève
  // `NoModificationAllowedError` (« this element's parent is of type
  // #document-fragment »). L'exception remontait, la promesse de
  // rafraîchissement était rejetée, le corps frais n'arrivait jamais — et
  // AUCUN message nulle part. Symptôme : un nœud-référence continuait
  // d'afficher l'ancien titre de sa cible après un renommage, alors que le
  // lien, lui, était intact.
  //
  // `replaceWith` travaille sur le parent NŒUD, pas sur le parent ÉLÉMENT :
  // il fonctionne dans un fragment comme dans un document.
  const neuf = document.createElement("template");
  neuf.innerHTML = blocCarte(suivante);
  figure.replaceWith(...Array.from(neuf.content.childNodes));
  return true;
}

// ─── L'export ────────────────────────────────────────────────────────────────

/**
 * Le SVG d'export : couleurs aplaties, fond opaque, aucune sélection.
 *
 * L'en-tête XML est ajouté ici et pas dans `rendreSvg` : il n'a de sens que dans
 * un FICHIER autonome, et le mettre dans le bloc enregistré en ferait du
 * balisage parasite au milieu d'une note.
 */
export function svgExportable(carte: Carte): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${rendreSvg(carte, { mode: "export" })}`;
}

/** Au-delà, on dépasse la taille de canevas que les moteurs acceptent. */
const PIXELS_MAX = 16_000_000;

/**
 * La carte en PNG.
 *
 * ⚠️ **PNG PUR, ET PAS `encodeImage`** — et c'est un écart assumé au cahier des
 * charges, pour une raison mécanique : `encodeImage` (`lib/knowledge.ts`)
 * n'encode QUE du WebP, avec un repli JPEG. Il ne sait pas produire un PNG.
 * Lui confier cet export livrerait un fichier WebP portant l'extension `.png`.
 *
 * Or `encodeImage` existe pour ALLÉGER ce qui entre en base, et une carte
 * n'entre plus en base sous forme d'image depuis qu'elle s'enregistre en SVG :
 * ce chemin n'a donc plus de raison de croiser celui-ci. Ce qu'on veut ici,
 * c'est le format qu'Antonin a demandé, celui qui se colle partout.
 *
 * ⭐ Et c'est aussi le plus SÛR en WKWebView : le PNG est le seul format qu'un
 * `<canvas>` est tenu de savoir encoder. C'est précisément parce que le WebP ne
 * l'est pas que `encodeImage` porte un repli JPEG (`knowledge.ts` § WebP).
 *
 * `echelle` à 2 rend une image nette sur un écran Retina comme dans un document
 * imprimé, sans peser dix fois plus — le SVG source est vectoriel, il n'y a
 * aucune information à perdre.
 */
export async function pngDeCarte(carte: Carte, echelle = 2): Promise<string> {
  const svg = rendreSvg(carte, { mode: "export" });
  const largeur = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 0);
  const hauteur = Number(/height="(\d+)"/.exec(svg)?.[1] ?? 0);
  if (!largeur || !hauteur) throw new Error("carte illisible");

  // Ramener l'échelle si la carte est immense, plutôt que de rendre un canevas
  // vide : un moteur qui refuse la taille ne lève pas, il rend du transparent.
  const facteur = Math.min(echelle, Math.sqrt(PIXELS_MAX / (largeur * hauteur)));
  const w = Math.max(1, Math.round(largeur * facteur));
  const h = Math.max(1, Math.round(hauteur * facteur));

  const image = new Image();
  // `encodeURIComponent` et non `btoa` : `btoa` échoue sur tout caractère non
  // latin-1, donc sur le moindre accent d'un titre français.
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canevas indisponible");
  // Le fond est déjà dans le SVG d'export, mais un canevas naît transparent :
  // on le peint quand même, sinon un PNG collé sur fond sombre serait illisible.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/** Les octets d'une data URL, prêts à être écrits dans un fichier. */
export function octetsDeDataUrl(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const binaire = atob(base64);
  const out = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) out[i] = binaire.charCodeAt(i);
  return out;
}
