/**
 * ⭐ LA CARTE S'OUVRE EN SA PAGE (2026-10-20) — demande d'Antonin : « quand je
 * clique sur un objectif, ce rectangle gris s'agrandit pour afficher la page ;
 * on rentre dans le rectangle ». Variante A des propositions, « travaillée un
 * peu plus ».
 *
 * Le mouvement, à l'ouverture :
 * 1. un VOILE (la page, posée par-dessus la liste) est découpé exactement à la
 *    forme de la carte (`clip-path: inset(… round r)`), puis s'agrandit jusqu'à
 *    la colonne entière, sur un ressort ;
 * 2. son FOND reprend le matériau de la carte (`--card-bg`) : c'est bien le
 *    rectangle gris qui grandit, gris de bout en bout ; il ne s'efface qu'une
 *    fois la page entièrement dépliée ;
 * 3. le TITRE et le POURCENTAGE voyagent : ceux de la page partent de la place
 *    exacte qu'ils occupaient dans la carte (FLIP), à leur taille d'alors ;
 * 4. le reste de la page arrive en cascade, du haut vers le bas ;
 * 5. les autres cartes s'écartent de celle qu'on ouvre (au-dessus vers le haut,
 *    en dessous vers le bas), d'autant plus tard qu'elles en sont loin.
 *
 * Le retour joue le même film à l'envers, la page rentrant dans SA carte — qui
 * est remesurée dans la liste revenue, au défilement d'avant.
 *
 * ⚠️ Web Animations, pas des `@keyframes` : la règle globale
 * `prefers-reduced-motion` d'`index.css` n'atteint pas `element.animate()`.
 * L'appelant teste `mouvementReduit()` et saute le film (PIEGES § 50).
 *
 * ⚠️ DENSITÉ : `getBoundingClientRect` rend des pixels ÉCRAN, la découpe et
 * les déplacements s'écrivent en pixels LOCAUX sous le `zoom` de `<html>`
 * (110 % chez Antonin). Toute distance mesurée est divisée par `zoomFactor()`.
 */
import { zoomFactor } from "../uiConfig";

export type Sens = "ouvre" | "ferme";

export interface Scene {
  sens: Sens;
  /** La colonne de la vue : le voile la recouvre (`absolute inset-0`). */
  racine: HTMLElement;
  /** La page, posée par-dessus la liste le temps du film. */
  voile: HTMLElement;
  /** Le fond du voile, au matériau de la carte. */
  fond: HTMLElement;
  /** La carte de l'objectif, dans la liste. */
  carte: HTMLElement;
  /** Ce qui s'écarte : les autres cartes, les intertitres, l'en-tête. */
  voisins: HTMLElement[];
}

/** `--ease-spring` d'`index.css` : un départ franc, une arrivée qui se pose. */
const RESSORT = "cubic-bezier(0.32, 0.72, 0, 1)";
/** `--ease-out-quint`. */
const DOUX = "cubic-bezier(0.22, 1, 0.36, 1)";

export const DUREE_OUVRIR = 620;
export const DUREE_FERMER = 480;

/** Le marqueur des éléments qui voyagent entre la carte et la page. */
export const PARTAGE = "data-partage";

type Rect = { top: number; left: number; right: number; bottom: number; width: number; height: number };

/**
 * La découpe qui laisse voir, dans `cadre`, le rectangle `r` arrondi de `rayon`.
 * `zoom` : le facteur de densité (mesures en pixels écran → pixels locaux).
 */
export function decoupe(cadre: Rect, r: Rect, rayon: string, zoom = 1): string {
  const px = (n: number) => `${Math.round((n / zoom) * 10) / 10}px`;
  return `inset(${px(r.top - cadre.top)} ${px(cadre.right - r.right)} ${px(cadre.bottom - r.bottom)} ${px(r.left - cadre.left)} round ${rayon})`;
}

/**
 * La transformation qui pose `vers` (sa boîte d'arrivée) sur `depuis` : un
 * déplacement, et une échelle prise sur la HAUTEUR — un titre court dans la
 * carte et long dans la page n'ont pas la même largeur, mais leur ligne a la
 * même proportion que leur corps de texte.
 */
export function flip(
  depuis: Rect,
  vers: Rect,
  corpsDepuis: number,
  corpsVers: number,
  zoom = 1,
  aDroite = false,
): string {
  const k = corpsVers > 0 ? corpsDepuis / corpsVers : 1;
  // Un texte calé à droite dans une case plus large que lui (le pourcentage de
  // la carte, `w-11 text-right`) se pose par son bord DROIT : par la gauche, il
  // atterrissait à côté du vrai, et le fondu final montrait les deux.
  const dx = (aDroite ? depuis.right - vers.right : depuis.left - vers.left) / zoom;
  const dy = (depuis.top - vers.top) / zoom;
  return `translate(${Math.round(dx * 10) / 10}px, ${Math.round(dy * 10) / 10}px) scale(${Math.round(k * 1000) / 1000})`;
}

/**
 * Les blocs de la page qui arrivent en cascade : tout, sauf ce qui voyage.
 * Un bloc qui CONTIENT un élément voyageur est ouvert, et ses autres enfants
 * entrent à sa place (le fil à côté du pourcentage, par exemple).
 */
export function blocsDeCascade(racine: Element): HTMLElement[] {
  const blocs: HTMLElement[] = [];
  for (const enfant of Array.from(racine.children)) {
    if (!(enfant instanceof HTMLElement) || enfant.hasAttribute(PARTAGE)) continue;
    if (enfant.querySelector(`[${PARTAGE}]`)) blocs.push(...blocsDeCascade(enfant));
    else blocs.push(enfant);
  }
  return blocs;
}

/** Les paires (dans la carte, dans la page) des éléments voyageurs. */
function paires(carte: HTMLElement, voile: HTMLElement): Array<[HTMLElement, HTMLElement]> {
  const out: Array<[HTMLElement, HTMLElement]> = [];
  for (const cible of Array.from(voile.querySelectorAll<HTMLElement>(`[${PARTAGE}]`))) {
    const nom = cible.getAttribute(PARTAGE);
    const source = carte.querySelector<HTMLElement>(`[${PARTAGE}="${nom}"]`);
    if (source) out.push([source, cible]);
  }
  return out;
}

const corps = (el: HTMLElement) => parseFloat(getComputedStyle(el).fontSize) || 16;

/** Joue le film ; rend les animations (l'appelant attend `finished`). */
export function jouerTransition(s: Scene): Animation[] {
  const ouvre = s.sens === "ouvre";
  const duree = ouvre ? DUREE_OUVRIR : DUREE_FERMER;
  const cadre = s.racine.getBoundingClientRect();
  const c = s.carte.getBoundingClientRect();
  const rayon = getComputedStyle(s.carte).borderTopLeftRadius || "12px";
  const z = zoomFactor();
  const petit = decoupe(cadre, c, rayon, z);
  const grand = decoupe(cadre, cadre, rayon, z);
  const anims: Animation[] = [];
  const jouer = (el: Element, images: Keyframe[], o: KeyframeAnimationOptions) =>
    anims.push(el.animate(images, { fill: "both", ...o }));

  // Au retour, tout se lit sur UNE horloge de `fin` ms : le rectangle est
  // rentré à ~`pose`, puis le voile se fond dans la vraie carte.
  // ⚠️ Les fondus sont minutés image par image (`easing` par image clé), jamais
  // par l'`easing` global d'un ressort : il déforme le TEMPS de toutes les
  // images clés, et un fondu placé « à 85 % » tombait au premier tiers — une
  // carte fantôme, vue au ralenti le 2026-10-20.
  const fin = duree + 100;
  const pose = duree - 60;
  const t = (ms: number) => Math.min(Math.max(ms / fin, 0), 1);

  // 1 — le rectangle s'agrandit (ou rentre dans sa carte).
  jouer(s.voile, ouvre ? [{ clipPath: petit }, { clipPath: grand }] : [{ clipPath: grand }, { clipPath: petit }], {
    duration: ouvre ? duree : pose - 60,
    easing: RESSORT,
    delay: ouvre ? 0 : 60,
  });

  // 2 — le fond de carte. ⭐ 2026-10-20, Antonin : « la carte doit rester du
  // même gris, l'animation avec seulement le fond noir ». Le rectangle est
  // GRIS du premier au dernier pixel du mouvement : opaque dès la première
  // image (avant, il apparaissait en fondu pendant que la vraie carte
  // s'effaçait — un creux noir), et il ne s'efface qu'une fois la page
  // dépliée (avant : dès 55 % du film, la carte noircissait en grandissant).
  // Au retour, il revient vite et s'efface À LA FIN au profit de la vraie carte.
  const ouvreFin = duree + 160;
  jouer(
    s.fond,
    ouvre
      ? [{ opacity: 1 }, { opacity: 1, offset: duree / ouvreFin }, { opacity: 0 }]
      : [{ opacity: 0 }, { opacity: 1, offset: t(80) }, { opacity: 1, offset: t(pose) }, { opacity: 0 }],
    { duration: ouvre ? ouvreFin : fin, easing: "linear" },
  );

  // La vraie carte cède la place au voile (son ombre dépasse de la découpe),
  // et la reprend au retour, pendant que le voile s'efface.
  jouer(s.carte, ouvre ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 0, offset: t(pose - 40) }, { opacity: 1 }], {
    duration: ouvre ? 140 : fin,
    easing: "linear",
  });

  // 3 — ce qui voyage. Toutes les mesures AVANT toute animation : une
  // transformation posée fausserait la boîte de la suivante.
  const voyages = paires(s.carte, s.voile).map(([source, cible]) => {
    const aDroite = /right|end/.test(getComputedStyle(source).textAlign);
    return {
      cible,
      aDroite,
      depuis: flip(source.getBoundingClientRect(), cible.getBoundingClientRect(), corps(source), corps(cible), z, aDroite),
    };
  });
  for (const { cible, depuis, aDroite } of voyages) {
    cible.style.transformOrigin = aDroite ? "100% 0" : "0 0";
    jouer(
      cible,
      ouvre
        ? [
            { transform: depuis, opacity: 0, easing: "linear" },
            { transform: depuis, opacity: 1, offset: 0.08, easing: RESSORT },
            { transform: "none", opacity: 1 },
          ]
        : [
            { transform: "none", opacity: 1, offset: 0, easing: "linear" },
            { transform: "none", opacity: 1, offset: t(60), easing: RESSORT },
            { transform: depuis, opacity: 1, offset: t(pose), easing: "linear" },
            { transform: depuis, opacity: 0 },
          ],
      { duration: ouvre ? duree : fin, easing: "linear" },
    );
  }

  // 4 — la page en cascade : elle monte de 12 px en apparaissant, bloc après
  // bloc ; au retour, tout s'efface d'un coup, avant que le rectangle ne rentre.
  blocsDeCascade(s.voile).forEach((bloc, i) => {
    if (bloc === s.fond) return;
    jouer(
      bloc,
      ouvre
        ? [{ opacity: 0, transform: "translateY(12px)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "translateY(6px)" }],
      ouvre
        ? { duration: 440, easing: DOUX, delay: 130 + Math.min(i, 8) * 34 }
        : { duration: 150, easing: "linear" },
    );
  });

  // 5 — les voisines s'écartent de la carte ouverte : plus elles en sont
  // loin, plus elles partent tard (et reviennent tard).
  const centre = c.top + c.height / 2;
  for (const v of s.voisins) {
    const r = v.getBoundingClientRect();
    const dessus = r.top + r.height / 2 < centre;
    const loin = Math.min(Math.abs(r.top + r.height / 2 - centre) / Math.max(c.height, 1), 6);
    const ecart = `translateY(${dessus ? -18 : 18}px) scale(0.97)`; // pixels locaux : pas de zoom
    jouer(
      v,
      ouvre ? [{ opacity: 1, transform: "none" }, { opacity: 0, transform: ecart }] : [{ opacity: 0, transform: ecart }, { opacity: 1, transform: "none" }],
      ouvre
        ? { duration: 300, easing: DOUX, delay: loin * 14 }
        : { duration: 380, easing: DOUX, delay: 170 + loin * 22 },
    );
  }

  return anims;
}
