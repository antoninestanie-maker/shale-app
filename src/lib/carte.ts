import { estKindConnu, type Extremite } from "./liens";
import type { LinkKind } from "./types";

/**
 * Les cartes mentales — modèle, agencement, rendu SVG et historique.
 *
 * ⚠️ TOUT CE FICHIER EST PUR. Aucun `document`, aucun accès à la base, aucune
 * mesure de texte par le navigateur. C'est le même partage que
 * `mentions.ts` / `mentionsDom.ts` : la logique ici, le contact avec le DOM
 * dans `carteDom.ts`, court exprès.
 *
 * ⭐ CE QUE CETTE PURETÉ ACHÈTE, ET POURQUOI ELLE N'EST PAS DE LA COQUETTERIE.
 * Le précédent de ce dépôt pour une surface de dessin est `SketchPad`, qui
 * peint dans un `<canvas>` : sa géométrie ne peut être vérifiée que par l'œil,
 * et le § 7.1 de `PIEGES.md` rappelle qu'aucun test de ce dépôt ne prouve une
 * interface. Ici, le rendu est une CHAÎNE produite par une fonction : le
 * déterminisme exigé (« la même carte se dessine identiquement à chaque
 * ouverture ») devient une assertion de test, pas une promesse.
 *
 * ⚠️ Corollaire : la largeur du texte est ESTIMÉE par une formule, jamais
 * mesurée. Une mesure par le navigateur donnerait des positions dépendant de la
 * police réellement chargée — donc une carte qui se redessine différemment
 * selon la machine, et un rendu enregistré qui ne correspond plus à l'écran.
 */

// ─── Le modèle ───────────────────────────────────────────────────────────────

/** La cible d'un nœud-référence : la même identité qu'une arête (`liens.ts`). */
export type RefNoeud = Extremite;

export interface Noeud {
  id: string;
  /** `null` pour la racine. Il n'y a qu'une racine par carte. */
  parent: string | null;
  /**
   * Le texte du nœud.
   *
   * ⚠️ Pour un nœud-référence, c'est une COPIE d'affichage, jamais l'identité —
   * exactement comme le titre d'un jeton de mention (`mentions.ts`). L'identité
   * tient dans `ref`, et le texte est réécrit à l'ouverture par
   * `rafraichirReferences()`. Renommer la cible ne casse donc rien.
   */
  texte: string;
  /** Présent = ce nœud désigne un objet de l'app. Absent = texte libre. */
  ref?: RefNoeud;
  /** Ses enfants sont repliés (le compte reste affiché). */
  plie?: boolean;
  /** La cible n'existe plus : le nœud reste, marqué mort, non cliquable. */
  mort?: boolean;
  /**
   * ⭐ DE QUEL CÔTÉ DE LA RACINE PEND CETTE BRANCHE, ET DE QUELLE COULEUR.
   *
   * N'a de sens que sur un enfant DIRECT de la racine ; ailleurs, ces deux
   * champs sont ignorés (un nœud suit toujours la branche qui le porte).
   *
   * Ils existent pour une seule raison, et elle vaut d'être dite. Avant eux, le
   * côté et la couleur d'une branche se DÉDUISAIENT de son rang : pair à
   * droite, impair à gauche, couleur = rang modulo quatre. Le dessin obtenu
   * était le bon — mais insérer une branche au milieu décalait tous les rangs
   * suivants, donc **faisait traverser la carte à toutes les branches d'après,
   * et les repeignait**. Ajouter une idée réorganisait le travail déjà fait.
   *
   * Écrits une fois, ils ne bougent plus : une branche posée reste où elle est.
   * L'alternance n'est pas perdue pour autant — elle est reproduite à la
   * CRÉATION par `nouvelleBranche()`, qui choisit le côté le moins chargé.
   *
   * ⚠️ Absents d'une carte écrite avant ce champ : `lireCarte` les y inscrit à
   * l'ouverture, d'après l'ancienne règle, pour que la carte se rouvre
   * exactement telle qu'on l'a laissée.
   */
  cote?: -1 | 1;
  /** Index dans `COULEURS_BRANCHE`. Voir `cote` — même histoire, même remède. */
  teinte?: number;
}

export interface Carte {
  /** Version du format. Un jour où il faudra le faire évoluer, on saura d'où on part. */
  v: 1;
  /** L'ordre du tableau EST l'ordre des frères. C'est ce qui rend l'agencement déterministe. */
  noeuds: Noeud[];
}

export const RACINE = "r";

/** Une carte neuve : une racine, et rien d'autre. */
export function carteVide(titre = ""): Carte {
  return { v: 1, noeuds: [{ id: RACINE, parent: null, texte: titre }] };
}

/**
 * Relit le JSON d'une carte en tolérant n'importe quel contenu.
 *
 * Même contrat que `parseSketch` : un corps de note peut avoir été édité à la
 * main, tronqué par une synchronisation, ou écrit par une version future. On
 * rend `null` plutôt que de laisser une exception traverser un rendu.
 */
export function lireCarte(brut: string | null | undefined): Carte | null {
  if (!brut) return null;
  let parse: unknown;
  try {
    parse = JSON.parse(brut);
  } catch {
    return null;
  }
  const objet = parse as { noeuds?: unknown };
  if (!objet || !Array.isArray(objet.noeuds)) return null;

  const noeuds: Noeud[] = [];
  const vus = new Set<string>();
  for (const n of objet.noeuds as Partial<Noeud>[]) {
    if (!n || typeof n.id !== "string" || !n.id || vus.has(n.id)) continue;
    vus.add(n.id);
    const ref =
      n.ref && typeof n.ref === "object" && estKindConnu(String(n.ref.kind)) && n.ref.uid
        ? { kind: n.ref.kind as LinkKind, uid: String(n.ref.uid) }
        : undefined;
    noeuds.push({
      id: n.id,
      parent: typeof n.parent === "string" ? n.parent : null,
      texte: typeof n.texte === "string" ? n.texte : "",
      ...(ref ? { ref } : {}),
      ...(n.plie ? { plie: true as const } : {}),
      ...(n.mort ? { mort: true as const } : {}),
      ...(n.cote === 1 || n.cote === -1 ? { cote: n.cote } : {}),
      ...(typeof n.teinte === "number" &&
      Number.isInteger(n.teinte) &&
      n.teinte >= 0 &&
      n.teinte < COULEURS_BRANCHE.length
        ? { teinte: n.teinte }
        : {}),
    });
  }
  if (noeuds.length === 0) return null;

  // Un parent qui n'existe pas rattacherait un nœud à rien : on le raccroche à
  // la racine plutôt que de le faire disparaître de l'écran sans le dire.
  const racine = noeuds.find((n) => n.parent === null) ?? noeuds[0];
  racine.parent = null;
  for (const n of noeuds) {
    if (n === racine) continue;
    if (n.parent === null || !vus.has(n.parent) || n.parent === n.id) n.parent = racine.id;
  }
  // Un cycle (A parent de B, B parent de A) ferait boucler l'agencement à
  // l'infini. Il ne peut venir que d'une donnée abîmée ; on le casse ici.
  for (const n of noeuds) {
    if (n === racine) continue;
    const vu = new Set<string>([n.id]);
    let p = n.parent;
    while (p) {
      if (vu.has(p)) {
        n.parent = racine.id;
        break;
      }
      vu.add(p);
      p = noeuds.find((x) => x.id === p)?.parent ?? null;
    }
  }
  // ⭐ Les branches d'une carte écrite avant `cote`/`teinte` les reçoivent ICI,
  // d'après l'ancienne alternance par rang : la carte se rouvre exactement
  // comme on l'a laissée, et plus rien ne la fera bouger ensuite. C'est le seul
  // endroit où l'ancienne règle sert encore, et elle n'y sert qu'une fois.
  noeuds
    .filter((n) => n.parent === racine.id)
    .forEach((b, i) => {
      if (b.cote !== 1 && b.cote !== -1) b.cote = i % 2 === 0 ? 1 : -1;
      if (typeof b.teinte !== "number") b.teinte = i % COULEURS_BRANCHE.length;
    });
  return { v: 1, noeuds };
}

export function ecrireCarte(carte: Carte): string {
  return JSON.stringify(carte);
}

// ─── Lecture de l'arbre ──────────────────────────────────────────────────────

export const racineDe = (c: Carte): Noeud => c.noeuds.find((n) => n.parent === null) ?? c.noeuds[0];
export const noeudDe = (c: Carte, id: string): Noeud | undefined => c.noeuds.find((n) => n.id === id);
export const enfantsDe = (c: Carte, id: string): Noeud[] => c.noeuds.filter((n) => n.parent === id);

/** Tout le sous-arbre, racine comprise — sert à la suppression et au reparentage. */
export function sousArbre(c: Carte, id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const e of enfantsDe(c, out[i])) out.push(e.id);
  }
  return out;
}

/**
 * De quel côté de la racine tombe un nœud, et à quelle profondeur.
 *
 * La racine porte ses enfants des DEUX côtés : c'est ce qui donne la silhouette
 * d'une carte mentale plutôt que celle d'un organigramme, et ce qui garde la
 * largeur raisonnable quand la racine a dix branches. Le côté est PORTÉ par la
 * branche (voir `Noeud.cote`), il n'est plus déduit de son rang.
 */
export function coteEtProfondeur(c: Carte, id: string): { cote: -1 | 1; profondeur: number } {
  const racine = racineDe(c);
  let n = noeudDe(c, id);
  let profondeur = 0;
  const chemin: Noeud[] = [];
  while (n && n.id !== racine.id) {
    chemin.push(n);
    profondeur++;
    n = n.parent ? noeudDe(c, n.parent) : undefined;
  }
  if (profondeur === 0) return { cote: 1, profondeur: 0 };
  const branche = chemin[chemin.length - 1]; // l'ancêtre de profondeur 1
  return { cote: coteDeBranche(c, branche), profondeur };
}

/**
 * Le côté d'une branche : celui qu'elle porte, ou — à défaut — l'ancienne
 * alternance par rang.
 *
 * ⚠️ Ce secours n'est pas décoratif. `lireCarte` inscrit le champ sur tout ce
 * qui vient de la base, mais une carte construite en mémoire — les tests, une
 * version future du format — peut en manquer, et une branche sans côté ne doit
 * jamais disparaître de l'agencement.
 */
function coteDeBranche(c: Carte, branche: Noeud): -1 | 1 {
  if (branche.cote === 1 || branche.cote === -1) return branche.cote;
  const rang = enfantsDe(c, racineDe(c).id).findIndex((e) => e.id === branche.id);
  return rang % 2 === 0 ? 1 : -1;
}

/** La teinte d'une branche. Même contrat, même secours que `coteDeBranche`. */
function teinteDeBranche(c: Carte, branche: Noeud): number {
  if (typeof branche.teinte === "number") return branche.teinte;
  const rang = enfantsDe(c, racineDe(c).id).findIndex((e) => e.id === branche.id);
  return Math.max(0, rang) % COULEURS_BRANCHE.length;
}

/**
 * ⭐ Où naît une branche NEUVE : du côté le moins chargé, dans la couleur la
 * moins servie. L'égalité se tranche à droite.
 *
 * C'est ce qui remplace l'ancienne alternance par rang — et qui la reproduit
 * EXACTEMENT quand on construit une carte de haut en bas : droite, gauche,
 * droite, gauche… avec les quatre couleurs dans l'ordre. La différence ne se
 * voit que là où l'ancienne règle se trompait : au milieu d'une liste, où elle
 * déplaçait et repeignait tout ce qui suivait.
 */
function nouvelleBranche(c: Carte): { cote: -1 | 1; teinte: number } {
  const branches = enfantsDe(c, racineDe(c).id);
  const usage = COULEURS_BRANCHE.map(() => 0);
  let droite = 0;
  for (const b of branches) {
    if (coteDeBranche(c, b) === 1) droite++;
    usage[teinteDeBranche(c, b)]++;
  }
  let teinte = 0;
  for (let i = 1; i < usage.length; i++) if (usage[i] < usage[teinte]) teinte = i;
  return { cote: droite <= branches.length - droite ? 1 : -1, teinte };
}

/** Un nœud est-il visible ? Non si un de ses ancêtres est replié. */
export function visible(c: Carte, id: string): boolean {
  let n = noeudDe(c, id);
  while (n?.parent) {
    const p = noeudDe(c, n.parent);
    if (!p) return true;
    if (p.plie) return false;
    n = p;
  }
  return true;
}

/** Combien de nœuds un repli cache — le compte reste affiché sur la pastille. */
export function comptePlie(c: Carte, id: string): number {
  return sousArbre(c, id).length - 1;
}

// ─── Modifications — toutes RENDENT une carte neuve ──────────────────────────
//
// ⚠️ Aucune ne mute son entrée. C'est ce qui permet à l'historique d'annulation
// de n'être qu'une pile d'états, sans clonage profond ni copie défensive.

/** Un identifiant qui ne peut pas entrer en collision avec un existant. */
function nouvelId(c: Carte): string {
  let i = c.noeuds.length;
  let id = `n${i}`;
  while (c.noeuds.some((n) => n.id === id)) id = `n${++i}`;
  return id;
}

/** Insère un nœud juste APRÈS `apresId` dans la fratrie (ou en fin si absent). */
function inserer(c: Carte, neuf: Noeud, apresId: string | null): Carte {
  const noeuds = [...c.noeuds];
  const i = apresId ? noeuds.findIndex((n) => n.id === apresId) : -1;
  if (i >= 0) noeuds.splice(i + 1, 0, neuf);
  else noeuds.push(neuf);
  return { ...c, noeuds };
}

/**
 * Un frère juste après `id` — la touche ⌘Entrée. La racine n'en a pas.
 *
 * ⚠️ Le frère d'une BRANCHE est lui-même une branche : il reçoit son propre
 * côté, du côté le moins chargé. Il peut donc apparaître en face de celui dont
 * il est le voisin — c'est la silhouette d'une carte mentale, et c'est ce que
 * font MindNode et XMind. Ce qui n'arrive plus, en revanche, c'est que les
 * branches DÉJÀ POSÉES changent de côté parce qu'on en a inséré une.
 */
export function ajouterFrere(c: Carte, id: string): { carte: Carte; neuf: string } {
  const n = noeudDe(c, id);
  if (!n || n.parent === null) return ajouterEnfant(c, id);
  const neuf: Noeud = {
    id: nouvelId(c),
    parent: n.parent,
    texte: "",
    ...(n.parent === racineDe(c).id ? nouvelleBranche(c) : {}),
  };
  return { carte: inserer(c, neuf, id), neuf: neuf.id };
}

/**
 * Un enfant de `id` — la touche Tab.
 *
 * ⚠️ Ajouter un enfant à un nœud REPLIÉ le déplie : sinon on écrit dans le vide
 * et rien n'apparaît à l'écran, ce qui se lit comme un bug.
 */
export function ajouterEnfant(c: Carte, id: string): { carte: Carte; neuf: string } {
  const neuf: Noeud = {
    id: nouvelId(c),
    parent: id,
    texte: "",
    ...(id === racineDe(c).id ? nouvelleBranche(c) : {}),
  };
  const derniers = enfantsDe(c, id);
  const carte = deplier(inserer(c, neuf, derniers.length ? derniers[derniers.length - 1].id : id), id);
  return { carte, neuf: neuf.id };
}

function deplier(c: Carte, id: string): Carte {
  return { ...c, noeuds: c.noeuds.map((n) => (n.id === id && n.plie ? { ...n, plie: undefined } : n)) };
}

/**
 * Retire un nœud ET son sous-arbre.
 *
 * ⚠️ La racine ne se supprime jamais : une carte sans racine n'a plus de forme,
 * et l'utilisateur se retrouverait devant un écran vide sans savoir quoi faire.
 */
export function supprimerNoeud(c: Carte, id: string): Carte {
  const n = noeudDe(c, id);
  if (!n || n.parent === null) return c;
  const aRetirer = new Set(sousArbre(c, id));
  return { ...c, noeuds: c.noeuds.filter((x) => !aRetirer.has(x.id)) };
}

export function renommer(c: Carte, id: string, texte: string): Carte {
  return { ...c, noeuds: c.noeuds.map((n) => (n.id === id ? { ...n, texte } : n)) };
}

/** Pose (ou retire) la référence d'un nœud. Le texte suit le titre de la cible. */
export function poserReference(c: Carte, id: string, ref: RefNoeud | null, titre: string): Carte {
  return {
    ...c,
    noeuds: c.noeuds.map((n) =>
      n.id === id
        ? ref
          ? { ...n, ref, texte: titre, mort: undefined }
          : { ...n, ref: undefined, mort: undefined, texte: n.texte }
        : n,
    ),
  };
}

/** Replie ou déplie. Un nœud sans enfant ne se replie pas — ça ne cacherait rien. */
export function basculerPli(c: Carte, id: string): Carte {
  if (enfantsDe(c, id).length === 0) return c;
  return { ...c, noeuds: c.noeuds.map((n) => (n.id === id ? { ...n, plie: n.plie ? undefined : true } : n)) };
}

/**
 * ⭐ Envoie une BRANCHE à droite ou à gauche de la racine.
 *
 * Ce geste n'existait pas, et il n'existait pas parce qu'il ne servait à rien :
 * le côté se déduisait du rang, donc il suffisait de réordonner pour faire
 * traverser la carte à une branche. C'était commode par accident, et
 * catastrophique par défaut — insérer une branche déplaçait toutes les autres.
 * Maintenant que le côté est POSÉ (voir `Noeud.cote`), il faut une façon
 * délibérée de le changer : la voici.
 *
 * Ne fait rien sur ce qui n'est pas une branche : un nœud plus profond suit
 * toujours celle qui le porte, et le prétendre déplaçable serait mentir.
 */
export function poserCote(c: Carte, id: string, cote: -1 | 1): Carte {
  const n = noeudDe(c, id);
  if (!n || n.parent !== racineDe(c).id) return c;
  if (coteDeBranche(c, n) === cote) return c;
  return { ...c, noeuds: c.noeuds.map((x) => (x.id === id ? { ...x, cote } : x)) };
}

/**
 * Reparente et réordonne en un seul geste — c'est ce que fait un glissement.
 *
 * ⚠️ Déposer un nœud DANS SON PROPRE SOUS-ARBRE détacherait la branche de la
 * carte : elle deviendrait un cycle, invisible et irrécupérable. Le geste est
 * refusé, la carte rendue inchangée.
 */
export function deplacer(c: Carte, id: string, nouveauParent: string, avantId: string | null): Carte {
  const n = noeudDe(c, id);
  if (!n || n.parent === null) return c; // la racine ne se déplace pas
  if (!noeudDe(c, nouveauParent)) return c;
  if (sousArbre(c, id).includes(nouveauParent)) return c;

  const sansLui = c.noeuds.filter((x) => x.id !== id);
  const deplace: Noeud = { ...n, parent: nouveauParent };
  // Devenir une branche, c'est recevoir un côté ; cesser d'en être une, c'est
  // le rendre. Une branche seulement réordonnée garde le sien : elle est déjà
  // quelque part, et la déplacer d'un bord à l'autre de la carte pour un
  // changement de rang serait précisément le défaut qu'on vient de retirer.
  if (nouveauParent === racineDe(c).id) {
    if (deplace.cote !== 1 && deplace.cote !== -1) Object.assign(deplace, nouvelleBranche(c));
  } else {
    delete deplace.cote;
    delete deplace.teinte;
  }
  const i = avantId ? sansLui.findIndex((x) => x.id === avantId) : -1;
  const noeuds = [...sansLui];
  if (i >= 0) noeuds.splice(i, 0, deplace);
  else {
    // en fin de fratrie : juste après le dernier enfant actuel du nouveau parent
    const freres = sansLui.filter((x) => x.parent === nouveauParent);
    const dernier = freres[freres.length - 1];
    const j = dernier ? noeuds.findIndex((x) => x.id === dernier.id) : noeuds.findIndex((x) => x.id === nouveauParent);
    noeuds.splice(j + 1, 0, deplace);
  }
  return { ...c, noeuds };
}

// ─── Les nœuds-références ────────────────────────────────────────────────────

/** Les cibles citées par une carte, sans doublon — ce qui deviendra des arêtes. */
export function refsDeCarte(carte: Carte): RefNoeud[] {
  const vues = new Set<string>();
  const out: RefNoeud[] = [];
  for (const n of carte.noeuds) {
    if (!n.ref) continue;
    const cle = `${n.ref.kind}:${n.ref.uid}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    out.push(n.ref);
  }
  return out;
}

/**
 * Réécrit le texte affiché de chaque nœud-référence d'après l'état ACTUEL.
 *
 * ⭐ Exactement `rafraichirMentions()`, transposé : l'identité ne bouge pas, la
 * copie d'affichage est régénérée. Renommer la cible ne casse aucun lien.
 *
 * ⚠️ Une cible SUPPRIMÉE ne fait pas disparaître le nœud : il reste, marqué
 * mort. Retirer un nœud réécrirait la carte de l'utilisateur sans le lui
 * demander — et une branche à laquelle on enlève un maillon perd ses enfants.
 */
export function rafraichirReferences(
  carte: Carte,
  titreDe: (kind: LinkKind, uid: string) => string | null,
): Carte {
  let change = false;
  const noeuds = carte.noeuds.map((n) => {
    if (!n.ref) return n;
    const titre = titreDe(n.ref.kind, n.ref.uid);
    if (titre === null) {
      if (n.mort) return n;
      change = true;
      return { ...n, mort: true as const };
    }
    if (n.texte === titre && !n.mort) return n;
    change = true;
    return { ...n, texte: titre, mort: undefined };
  });
  return change ? { ...carte, noeuds } : carte;
}

// ─── Les cartes DANS un corps de note ────────────────────────────────────────

/**
 * L'attribut qui porte le graphe, sur la `<figure>`.
 *
 * ⚠️ LU PAR EXPRESSION RÉGULIÈRE, PAS PAR LE DOM, et pour la raison exacte de
 * `mentions.ts` : les tests tournent en `environment: "node"`. Or ce que cette
 * fonction rend décide quelles ARÊTES survivent à un enregistrement — c'est la
 * dernière chose du dépôt qu'on peut se permettre de ne pas tester.
 */
const CARTE_RE = /<figure\b[^>]*\bdata-mindmap="([^"]*)"[^>]*>/gi;

export const ATTRIBUT_CARTE = "data-mindmap";

/** Échappe pour un attribut HTML à guillemets doubles. */
export function echapperAttribut(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function desechapperAttribut(texte: string): string {
  return texte
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Toutes les cartes d'un corps de note, dans l'ordre. */
export function cartesDuHtml(html: string): Carte[] {
  if (!html || !html.includes(ATTRIBUT_CARTE)) return [];
  const out: Carte[] = [];
  for (const m of html.matchAll(CARTE_RE)) {
    const carte = lireCarte(desechapperAttribut(m[1]));
    if (carte) out.push(carte);
  }
  return out;
}

/**
 * Le bloc tel qu'il est enregistré DANS le corps d'une note.
 *
 * ⭐ LE GRAPHE ET SON RENDU VOYAGENT ENSEMBLE, dans un seul élément — c'est le
 * schéma du croquis (`data-sketch` + son image), et c'est ce qui permet à la
 * note de rester lisible sans ouvrir l'éditeur.
 *
 * ⚠️ MAIS LE RENDU EST UN `<svg>` EN CLAIR, PAS UNE IMAGE, et c'est la décision
 * du 2026-09-06, prise sur mesure et non par goût :
 *   • 22 ko contre 114 ko en WebP et 347 ko en PNG brut (ce que fait le croquis) ;
 *   • `notes_fts` indexe le corps BRUT — un raster de 114 ko coûtait 143 ko
 *     d'index EN PLUS, quand le SVG n'en coûte presque rien ;
 *   • le texte des nœuds entre dans `plainText()`, donc dans la recherche,
 *     GRATUITEMENT — une image ne cherche pas ;
 *   • il suit le thème clair/sombre, quand une image est cuite une fois ;
 *   • il reste net à n'importe quel zoom, quand `encodeImage` plafonne à
 *     1 600 px et écrase une carte haute jusqu'à l'illisible.
 * Le raster n'est produit QU'À L'EXPORT, à la demande, et n'est jamais stocké.
 *
 * ⚠️ `contenteditable="false"` fait du bloc un ATOME, exactement comme un jeton
 * de mention : le curseur le franchit d'un coup, la suppression l'emporte
 * entier, et un gras appliqué sur toute la note ne va pas réécrire le SVG.
 * Vérifié en `contenteditable` réel avant d'être écrit.
 */
export function blocCarte(carte: Carte): string {
  return (
    `<figure class="carte-bloc" contenteditable="false" ` +
    `${ATTRIBUT_CARTE}="${echapperAttribut(ecrireCarte(carte))}">` +
    rendreSvg(carte, { mode: "theme" }) +
    `</figure>`
  );
}

/**
 * ⭐ Les objets cités par les CARTES d'un texte, sans doublon.
 *
 * C'est la moitié que `extraireMentions()` ne voit pas : une référence de carte
 * vit dans un attribut JSON, pas dans un jeton `<span data-mention>`. L'union
 * des deux est ce qu'on passe à `synchroniserMentions()` — et c'est cette union,
 * calculée en UNE fois sur tout le corps, qui garantit qu'enregistrer une carte
 * ne peut pas détruire une arête créée par un `@` du même texte.
 */
export function refsDesCartes(html: string): RefNoeud[] {
  const vues = new Set<string>();
  const out: RefNoeud[] = [];
  for (const carte of cartesDuHtml(html)) {
    for (const ref of refsDeCarte(carte)) {
      const cle = `${ref.kind}:${ref.uid}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      out.push(ref);
    }
  }
  return out;
}

// ─── L'agencement ────────────────────────────────────────────────────────────

/**
 * La géométrie, en pixels de la feuille logique.
 *
 * ⚠️ `CAR_LARGEUR` est une ESTIMATION de la largeur moyenne d'un caractère à
 * 14 px dans la police système. Elle n'a pas besoin d'être exacte — la boîte
 * porte du remplissage de chaque côté — mais elle doit être CONSTANTE : c'est
 * elle qui rend l'agencement reproductible d'une machine à l'autre.
 */
const CAR_LARGEUR = 7.15;
const CAR_PAR_LIGNE = 26;
const LIGNES_MAX = 3;
const LIGNE_H = 18;
const PAD_X = 13;
const PAD_Y = 9;
const ECART_V = 12;
const ECART_H = 54;
const MARGE = 28;
/** Place réservée à la pastille « n masqués » à droite d'un nœud replié. */
const PASTILLE_W = 26;

/**
 * Découpe un texte en lignes, sans jamais couper un mot s'il tient sur une ligne.
 *
 * ⚠️ Le texte COMPLET reste dans le modèle, même quand l'affichage est tronqué :
 * c'est lui qui part dans la recherche via le `<title>` du SVG (cf. `rendreSvg`).
 * Tronquer la donnée pour tenir dans une boîte serait une perte silencieuse.
 */
export function lignesDe(texte: string): { lignes: string[]; tronque: boolean } {
  const mots = texte.split(/\s+/).filter(Boolean);
  if (mots.length === 0) return { lignes: [""], tronque: false };
  const lignes: string[] = [];
  let courante = "";
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (essai.length <= CAR_PAR_LIGNE || !courante) {
      // un mot plus long qu'une ligne reste seul sur la sienne : le couper
      // rendrait un titre illisible, et les titres de l'app sont courts
      courante = essai;
    } else {
      lignes.push(courante);
      courante = mot;
    }
  }
  lignes.push(courante);
  if (lignes.length <= LIGNES_MAX) return { lignes, tronque: false };
  const gardees = lignes.slice(0, LIGNES_MAX);
  gardees[LIGNES_MAX - 1] = `${gardees[LIGNES_MAX - 1].slice(0, CAR_PAR_LIGNE - 1)}…`;
  return { lignes: gardees, tronque: true };
}

export interface Boite {
  x: number;
  y: number;
  w: number;
  h: number;
  cote: -1 | 1;
  profondeur: number;
  lignes: string[];
  tronque: boolean;
  /** Le jeton de couleur de la branche (`blue`, `violet`, `yellow`, `green`). */
  couleur: Couleur;
}

export interface Agencement {
  boites: Map<string, Boite>;
  largeur: number;
  hauteur: number;
}

/**
 * ⭐ Les couleurs de branche, et pourquoi le ROUGE n'y est pas.
 *
 * Il n'existe que cinq jetons de couleur dans `src/index.css` : `blue`, `green`,
 * `red`, `yellow`, `violet`. Mais `lib/knowledge.ts` a déjà tranché, pour les
 * thèmes du Savoir, que **rouge et vert sont sémantiques dans ce design
 * system** — d'où le rouge placé en dernier de sa palette. Une branche peinte
 * en rouge sans que personne l'ait demandé se lirait comme une alerte.
 *
 * Décision d'Antonin, 2026-09-06 : rotation sur quatre, rouge jamais attribué
 * d'office. Il reste disponible pour un usage explicite le jour où il en aura un.
 */
export const COULEURS_BRANCHE = ["blue", "violet", "yellow", "green"] as const;
export type Couleur = (typeof COULEURS_BRANCHE)[number] | "dim";

function boiteBrute(n: Noeud, plie: boolean): { w: number; h: number; lignes: string[]; tronque: boolean } {
  const { lignes, tronque } = lignesDe(n.texte || " ");
  const large = Math.max(...lignes.map((l) => l.length));
  return {
    w: Math.round(large * CAR_LARGEUR) + PAD_X * 2 + (plie ? PASTILLE_W : 0) + (n.ref ? 16 : 0),
    h: lignes.length * LIGNE_H + PAD_Y * 2,
    lignes,
    tronque,
  };
}

/**
 * Place chaque nœud visible. Fonction PURE et TOTALEMENT déterministe : deux
 * appels sur la même carte rendent exactement les mêmes coordonnées.
 *
 * L'algorithme est celui d'un arbre classique — on mesure la hauteur de chaque
 * sous-arbre, puis on empile les frères autour de l'axe de leur parent. Pas de
 * simulation de forces : elle coûterait cher et donnerait une carte différente
 * à chaque ouverture, donc un rendu enregistré qui ne correspond plus à l'écran.
 */
export function agencer(carte: Carte): Agencement {
  const racine = racineDe(carte);
  const brutes = new Map<string, ReturnType<typeof boiteBrute>>();
  for (const n of carte.noeuds) brutes.set(n.id, boiteBrute(n, !!n.plie && enfantsDe(carte, n.id).length > 0));

  const hauteurs = new Map<string, number>();
  const mesurer = (id: string): number => {
    const deja = hauteurs.get(id);
    if (deja !== undefined) return deja;
    const n = noeudDe(carte, id)!;
    const propre = brutes.get(id)!.h;
    const enfants = n.plie ? [] : enfantsDe(carte, id);
    let h = propre;
    if (enfants.length) {
      const total = enfants.reduce((s, e) => s + mesurer(e.id), 0) + ECART_V * (enfants.length - 1);
      h = Math.max(propre, total);
    }
    hauteurs.set(id, h);
    return h;
  };

  const boites = new Map<string, Boite>();
  const poser = (id: string, xAncre: number, centreY: number, cote: -1 | 1, profondeur: number, couleur: Couleur) => {
    const n = noeudDe(carte, id)!;
    const b = brutes.get(id)!;
    // `xAncre` est le bord par lequel la boîte se rattache à son parent :
    // le bord GAUCHE quand on va vers la droite, le bord DROIT sinon.
    const x = cote === 1 ? xAncre : xAncre - b.w;
    boites.set(id, {
      x,
      y: centreY - b.h / 2,
      w: b.w,
      h: b.h,
      cote,
      profondeur,
      lignes: b.lignes,
      tronque: b.tronque,
      couleur,
    });
    if (n.plie) return;
    const enfants = enfantsDe(carte, id);
    if (!enfants.length) return;
    const total = enfants.reduce((s, e) => s + mesurer(e.id), 0) + ECART_V * (enfants.length - 1);
    let curseur = centreY - total / 2;
    const xEnfants = cote === 1 ? x + b.w + ECART_H : x - ECART_H;
    for (const e of enfants) {
      const he = mesurer(e.id);
      poser(e.id, xEnfants, curseur + he / 2, cote, profondeur + 1, couleur);
      curseur += he + ECART_V;
    }
  };

  // La racine, puis ses branches, chacune du côté qu'elle porte.
  const bRacine = brutes.get(racine.id)!;
  boites.set(racine.id, {
    x: -bRacine.w / 2,
    y: -bRacine.h / 2,
    w: bRacine.w,
    h: bRacine.h,
    cote: 1,
    profondeur: 0,
    lignes: bRacine.lignes,
    tronque: bRacine.tronque,
    couleur: "dim",
  });

  if (!racine.plie) {
    const branches = enfantsDe(carte, racine.id);
    const droite = branches.filter((b) => coteDeBranche(carte, b) === 1);
    const gauche = branches.filter((b) => coteDeBranche(carte, b) === -1);
    for (const [liste, cote] of [
      [droite, 1],
      [gauche, -1],
    ] as const) {
      if (!liste.length) continue;
      const total = liste.reduce((s, e) => s + mesurer(e.id), 0) + ECART_V * (liste.length - 1);
      let curseur = -total / 2;
      const xAncre = cote === 1 ? bRacine.w / 2 + ECART_H : -bRacine.w / 2 - ECART_H;
      for (const e of liste) {
        const he = mesurer(e.id);
        poser(e.id, xAncre, curseur + he / 2, cote, 1, COULEURS_BRANCHE[teinteDeBranche(carte, e)]);
        curseur += he + ECART_V;
      }
    }
  }

  // Recadrage : tout est ramené dans le premier quadrant, marge comprise.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of boites.values()) {
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
  }
  for (const b of boites.values()) {
    b.x = Math.round((b.x - minX + MARGE) * 100) / 100;
    b.y = Math.round((b.y - minY + MARGE) * 100) / 100;
  }
  return {
    boites,
    largeur: Math.round(maxX - minX + MARGE * 2),
    hauteur: Math.round(maxY - minY + MARGE * 2),
  };
}

// ─── Le rendu SVG ────────────────────────────────────────────────────────────

/**
 * ⭐ DEUX PALETTES, ET C'EST LA MÊME DÉCISION QUE LE CROQUIS.
 *
 * À l'écran, la carte doit suivre le thème : elle vit dans une note qu'on lit en
 * clair comme en sombre, et une carte figée en couleurs sombres deviendrait
 * illisible sur fond blanc. Elle utilise donc les VARIABLES de `src/index.css`.
 *
 * À l'export, c'est l'inverse : un PNG collé dans un mail n'a plus de thème, et
 * `var(--color-text)` n'y résout rien du tout — l'image sortirait vide. Les
 * valeurs sont donc APLATIES, sur un fond opaque. `SketchPad` a tranché
 * exactement ainsi le 2026-07-21 (fond « papier » et encres concrètes), et pour
 * la même raison.
 *
 * ⚠️ Les valeurs ci-dessous sont la COPIE des jetons du thème CLAIR
 * (`src/index.css`, bloc `[data-theme="light"]`). Une copie diverge toujours :
 * un test la compare au fichier de style plutôt que de faire confiance à la
 * ressemblance.
 */
export const PALETTE_EXPORT = {
  fond: "#ffffff",
  surface: "#ffffff",
  texte: "#0b0d12",
  dim: "#5c6474",
  bord: "#cfd3da",
  blue: "#1b62e5",
  violet: "#4b45d6",
  yellow: "#96650b",
  green: "#06825f",
} as const;

export interface OptionsRendu {
  /** `theme` = variables CSS (écran, corps de note) · `export` = valeurs aplaties. */
  mode: "theme" | "export";
  /** Le nœud entouré, en édition seulement. Jamais dans le rendu enregistré. */
  selection?: string | null;
}

const echapperTexte = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function couleurs(mode: "theme" | "export") {
  if (mode === "export") {
    return {
      fond: PALETTE_EXPORT.fond,
      surface: PALETTE_EXPORT.surface,
      texte: PALETTE_EXPORT.texte,
      dim: PALETTE_EXPORT.dim,
      bord: PALETTE_EXPORT.bord,
      de: (c: Couleur) => (c === "dim" ? PALETTE_EXPORT.dim : PALETTE_EXPORT[c]),
    };
  }
  return {
    fond: "none",
    surface: "var(--color-surface)",
    texte: "var(--color-text)",
    dim: "var(--color-text-dim)",
    bord: "var(--color-border-strong)",
    de: (c: Couleur) => (c === "dim" ? "var(--color-text-dim)" : `var(--color-${c})`),
  };
}

/**
 * La carte, en SVG.
 *
 * ⭐ POURQUOI UNE CHAÎNE ET PAS DU JSX. Ce même rendu sert à trois choses : le
 * bloc enregistré DANS le corps de la note (donc du HTML, pas du React), l'export
 * SVG, et la source rastérisée pour l'export PNG. Une seule fonction pour les
 * trois, c'est la garantie que ce qu'on exporte est ce qu'on a vu.
 *
 * ⚠️ Le texte complet d'un nœud tronqué à l'affichage est écrit dans un
 * `<title>` : c'est un vrai élément, donc son contenu entre dans le
 * `textContent` que lit `plainText()`, donc dans FTS5 et dans la colonne `text`
 * du Savoir. Chercher le mot d'un nœud retrouve la note qui porte la carte —
 * c'est l'effet voulu, exactement comme pour le texte des jetons de mention.
 */
export function rendreSvg(carte: Carte, options: OptionsRendu): string {
  const a = agencer(carte);
  const c = couleurs(options.mode);
  const morceaux: string[] = [];

  morceaux.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${a.largeur} ${a.hauteur}" ` +
      `width="${a.largeur}" height="${a.hauteur}" class="carte-svg" role="img">`,
  );
  if (options.mode === "export") {
    morceaux.push(`<rect x="0" y="0" width="${a.largeur}" height="${a.hauteur}" fill="${c.fond}"/>`);
  }

  // Les arêtes d'abord : elles passent SOUS les boîtes.
  for (const n of carte.noeuds) {
    if (!n.parent) continue;
    const b = a.boites.get(n.id);
    const p = a.boites.get(n.parent);
    if (!b || !p) continue; // parent replié : ni l'un ni l'autre n'est posé
    const yP = p.y + p.h / 2;
    const yB = b.y + b.h / 2;
    const xP = b.cote === 1 ? p.x + p.w : p.x;
    const xB = b.cote === 1 ? b.x : b.x + b.w;
    const dx = (xB - xP) / 2;
    morceaux.push(
      `<path d="M${xP} ${yP} C${xP + dx} ${yP} ${xB - dx} ${yB} ${xB} ${yB}" fill="none" ` +
        `stroke="${c.de(b.couleur)}" stroke-width="${b.profondeur === 1 ? 2.4 : 1.6}" stroke-linecap="round" opacity="0.75"/>`,
    );
  }

  for (const n of carte.noeuds) {
    const b = a.boites.get(n.id);
    if (!b) continue;
    const trait = c.de(b.couleur);
    const racine = b.profondeur === 0;
    const enfantsCaches = n.plie ? comptePlie(carte, n.id) : 0;
    const selectionne = options.selection === n.id;

    morceaux.push(`<g data-noeud="${echapperTexte(n.id)}"${n.ref ? ' data-ref="1"' : ""}>`);
    if (b.tronque) morceaux.push(`<title>${echapperTexte(n.texte)}</title>`);
    // ⚠️ Une SEULE `stroke-width` : deux fois le même attribut sur une balise
    // est du balisage invalide, et c'est le PREMIER qui gagne à l'analyse — donc
    // la sélection n'aurait rien épaissi du tout.
    const epaisseur = selectionne ? 2.6 : racine ? 2 : 1.4;
    morceaux.push(
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="9" ` +
        `fill="${racine ? trait : c.surface}" fill-opacity="${racine ? 0.14 : 1}" ` +
        `stroke="${n.mort ? c.dim : trait}" stroke-width="${epaisseur}" ` +
        `${n.mort ? 'stroke-dasharray="4 3" ' : ""}/>`,
    );
    if (selectionne) {
      morceaux.push(
        `<rect x="${b.x - 3}" y="${b.y - 3}" width="${b.w + 6}" height="${b.h + 6}" rx="12" ` +
          `fill="none" stroke="${trait}" stroke-width="1.2" opacity="0.5"/>`,
      );
    }

    // Le texte, ligne à ligne. `dominant-baseline` n'est pas fiable partout :
    // on calcule la ligne de base à la main, ce qui rend le même résultat
    // dans la webview, dans le navigateur et dans l'image exportée.
    const premiere = b.y + PAD_Y + LIGNE_H - 5;
    b.lignes.forEach((ligne, i) => {
      morceaux.push(
        `<text x="${b.x + PAD_X + (n.ref ? 15 : 0)}" y="${premiere + i * LIGNE_H}" ` +
          `font-family="ui-sans-serif, -apple-system, system-ui, sans-serif" font-size="14" ` +
          `font-weight="${racine ? 600 : 400}" fill="${n.mort ? c.dim : c.texte}"` +
          `${n.mort ? ' text-decoration="line-through"' : ""}>${echapperTexte(ligne)}</text>`,
      );
    });

    // La pastille d'un nœud-référence : un point de la couleur de la branche,
    // pour distinguer d'un coup d'œil un nœud qui MÈNE quelque part.
    if (n.ref) {
      morceaux.push(
        `<circle cx="${b.x + PAD_X + 3}" cy="${b.y + b.h / 2}" r="3.5" fill="${n.mort ? c.dim : trait}"/>`,
      );
    }

    // Le compte de ce qu'un repli cache — sinon on ne sait pas qu'il y a
    // quelque chose dessous, et la branche semble simplement finie.
    if (enfantsCaches > 0) {
      const cx = b.cote === 1 ? b.x + b.w - PASTILLE_W / 2 - 4 : b.x + PASTILLE_W / 2 + 4;
      morceaux.push(
        `<circle cx="${cx}" cy="${b.y + b.h / 2}" r="9.5" fill="${trait}" fill-opacity="0.16" stroke="${trait}" stroke-width="1"/>`,
        `<text x="${cx}" y="${b.y + b.h / 2 + 4}" text-anchor="middle" ` +
          `font-family="ui-sans-serif, -apple-system, system-ui, sans-serif" font-size="11" font-weight="600" ` +
          `fill="${trait}">${enfantsCaches}</text>`,
      );
    }
    morceaux.push(`</g>`);
  }

  morceaux.push(`</svg>`);
  return morceaux.join("");
}

// ─── L'historique d'annulation ───────────────────────────────────────────────

/**
 * ⭐ ÉCRIT ICI, ET PAS REPRIS DE `SketchPad`.
 *
 * Le ⌘Z du croquis retire le dernier trait d'un tableau (`strokes.slice(0, -1)`),
 * sans pile et **sans rétablir**. Il n'y avait rien à réutiliser : une carte se
 * modifie de dix façons différentes, pas d'une seule.
 *
 * Une pile d'ÉTATS plutôt qu'une pile d'OPÉRATIONS : les modifications de ce
 * fichier rendent toutes une carte neuve sans muter l'ancienne, donc un état
 * passé ne coûte que quelques kilo-octets et ne peut pas être corrompu par la
 * suite. Une pile d'opérations inversibles serait dix fonctions de plus, dix
 * occasions de se tromper, pour un gain de mémoire qui n'intéresse personne à
 * cette échelle.
 */
export interface Historique {
  passe: Carte[];
  present: Carte;
  futur: Carte[];
}

/** Au-delà, on oublie les plus anciens : soixante gestes couvrent une session. */
const PROFONDEUR_MAX = 60;

export const historiqueDe = (carte: Carte): Historique => ({ passe: [], present: carte, futur: [] });

/**
 * Enregistre un nouvel état.
 *
 * ⚠️ Un état IDENTIQUE au présent n'entre pas dans la pile : sans ce garde, une
 * frappe qui ne change rien (la même lettre réécrite, un clic sur un nœud déjà
 * sélectionné) remplirait l'historique de doublons, et ⌘Z aurait l'air cassé —
 * il faudrait l'actionner dix fois pour défaire un geste.
 */
export function appliquer(h: Historique, carte: Carte): Historique {
  if (ecrireCarte(carte) === ecrireCarte(h.present)) return h;
  return {
    passe: [...h.passe, h.present].slice(-PROFONDEUR_MAX),
    present: carte,
    futur: [],
  };
}

export function annuler(h: Historique): Historique {
  if (h.passe.length === 0) return h;
  return {
    passe: h.passe.slice(0, -1),
    present: h.passe[h.passe.length - 1],
    futur: [h.present, ...h.futur].slice(0, PROFONDEUR_MAX),
  };
}

export function retablir(h: Historique): Historique {
  if (h.futur.length === 0) return h;
  return {
    passe: [...h.passe, h.present].slice(-PROFONDEUR_MAX),
    present: h.futur[0],
    futur: h.futur.slice(1),
  };
}

// ─── La navigation au clavier ────────────────────────────────────────────────

export type Direction = "haut" | "bas" | "gauche" | "droite";

/**
 * Où mènent les flèches, depuis un nœud.
 *
 * ⚠️ « Gauche » et « droite » ne veulent PAS dire « parent » et « enfant » : sur
 * la moitié gauche de la carte, les enfants sont à gauche. La flèche suit ce
 * qu'on VOIT à l'écran, pas la structure de l'arbre — sinon la navigation
 * s'inverse au milieu de la carte, et on ne comprend pas pourquoi.
 *
 * Haut et bas restent dans la FRATRIE, et rien d'autre. Sauter dans une autre
 * branche parce qu'elle est visuellement plus proche donnerait une sélection
 * imprévisible, qui dépendrait de la longueur des textes voisins.
 */
export function voisin(carte: Carte, id: string, direction: Direction): string | null {
  const n = noeudDe(carte, id);
  if (!n) return null;
  const racine = racineDe(carte);
  const { cote } = coteEtProfondeur(carte, id);

  if (direction === "haut" || direction === "bas") {
    if (n.parent === null) return null;
    let freres = enfantsDe(carte, n.parent);
    // Les enfants de la RACINE sont répartis des deux côtés : on ne monte et on
    // ne descend que parmi ceux du même côté, sinon la sélection traverse la carte.
    if (n.parent === racine.id) {
      freres = freres.filter((f) => coteDeBranche(carte, f) === cote);
    }
    const i = freres.findIndex((f) => f.id === id);
    const j = direction === "haut" ? i - 1 : i + 1;
    return freres[j]?.id ?? null;
  }

  // « vers l'extérieur » = vers les enfants ; « vers l'intérieur » = vers le parent.
  const versExterieur = direction === (cote === 1 ? "droite" : "gauche");
  if (versExterieur) {
    if (n.plie) return null;
    const enfants = enfantsDe(carte, id);
    if (!enfants.length) return null;
    // le PREMIER enfant, pas celui du milieu : c'est le seul choix stable quand
    // on ajoute des enfants ensuite.
    return enfants[0].id;
  }
  if (n.parent === null) {
    // Depuis la racine, « vers l'intérieur » n'a pas de sens : on part vers la
    // première branche du côté demandé, ce qui est ce que l'œil attend.
    const voulu = direction === "droite" ? 1 : -1;
    return enfantsDe(carte, racine.id).find((b) => coteDeBranche(carte, b) === voulu)?.id ?? null;
  }
  return n.parent;
}
