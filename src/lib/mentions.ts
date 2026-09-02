import { estKindConnu, type Extremite } from "./liens";
import type { LinkKind } from "./types";

/**
 * Les mentions `@` dans un texte riche — sérialisation et relecture.
 *
 * ⚠️ TOUT SE FAIT PAR EXPRESSION RÉGULIÈRE, PAS PAR LE DOM, et c'est un choix.
 * Les tests de ce dépôt tournent en `environment: "node"` : un module qui
 * touche à `document` n'est tout simplement pas testable ici (c'est le cas de
 * `richtext.ts`, qui n'a aucun test). Or une mention qui ne survit pas à un
 * aller-retour d'enregistrement est un lien perdu, en silence. Le format du
 * jeton est donc assez strict pour qu'une regex le lise sans risque — c'est
 * NOUS qui l'écrivons, il n'a pas la variété du HTML d'un tiers.
 *
 * L'INSERTION, elle, reste du DOM : c'est l'éditeur qui la fait.
 */

/**
 * Le jeton, tel qu'il est enregistré.
 *
 * ```html
 * <span class="mention" contenteditable="false" data-mention="note:6a26-…">@Plan de risque</span>
 * ```
 *
 * ⚠️ `contenteditable="false"` fait du jeton un ATOME : le curseur le franchit
 * d'un coup, et la suppression l'emporte entier. Sans cela, on pourrait effacer
 * une lettre au milieu du titre et laisser un jeton dont le texte ne veut plus
 * rien dire, alors que son lien, lui, resterait valide.
 *
 * ⚠️ Le titre affiché est une COPIE d'affichage, jamais la référence.
 * L'identité tient dans `data-mention`, et `rafraichirMentions()` réécrit le
 * texte à chaque chargement : renommer une note n'invalide donc aucun lien.
 */
const MENTION_RE = /<span\b[^>]*\bdata-mention="([^":]+):([^"]*)"[^>]*>([\s\S]*?)<\/span>/gi;

export const CLASSE_MENTION = "mention";
export const CLASSE_MENTION_MORTE = "mention-morte";

/** Ce que l'app affiche quand la cible d'une mention n'existe plus. */
export const LIBELLE_SUPPRIME = "élément supprimé";

export interface Mention extends Extremite {
  /** Le texte affiché dans le jeton, tel qu'il est enregistré. */
  titre: string;
}

/** Échappe ce qui ne doit jamais être interprété comme du balisage. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Le HTML d'un jeton de mention. */
export function jetonMention(kind: LinkKind, uid: string, titre: string): string {
  return (
    `<span class="${CLASSE_MENTION}" contenteditable="false" ` +
    `data-mention="${echapper(kind)}:${echapper(uid)}">@${echapper(titre)}</span>`
  );
}

/**
 * Toutes les mentions d'un texte, dans l'ordre, SANS doublon.
 *
 * Deux mentions de la même note ne font qu'une arête (index unique de la
 * migration 020) : les dédoublonner ici évite à l'appelant de gérer un conflit
 * d'écriture pour un cas parfaitement normal — on cite souvent deux fois la
 * même chose dans un même paragraphe.
 */
export function extraireMentions(html: string): Mention[] {
  if (!html) return [];
  const vues = new Set<string>();
  const mentions: Mention[] = [];
  for (const m of html.matchAll(MENTION_RE)) {
    const kind = m[1];
    const uid = decoder(m[2]);
    if (!estKindConnu(kind) || !uid) continue;
    const cle = `${kind}:${uid}`;
    if (vues.has(cle)) continue;
    vues.add(cle);
    mentions.push({ kind, uid, titre: texteBrut(m[3]).replace(/^@/, "") });
  }
  return mentions;
}

/**
 * Réécrit le texte affiché de chaque jeton à partir de l'état ACTUEL des
 * objets.
 *
 * ⭐ C'est ce qui rend une mention insensible au renommage : le titre affiché
 * est régénéré, l'identité ne bouge pas. Stocker le texte comme référence
 * aurait donné des liens qui se cassent dès qu'on renomme quoi que ce soit.
 *
 * ⚠️ Une cible SUPPRIMÉE ne fait pas disparaître le jeton : il reste, marqué
 * comme mort, et dit ce qu'il était. Le retirer réécrirait le texte de
 * l'utilisateur sans le lui demander — et une phrase à laquelle on enlève un
 * mot ne veut plus rien dire.
 */
export function rafraichirMentions(
  html: string,
  titreDe: (kind: LinkKind, uid: string) => string | null,
): string {
  if (!html) return html;
  return html.replace(MENTION_RE, (entier, kind: string, uidBrut: string, texte: string) => {
    if (!estKindConnu(kind)) return entier;
    const uid = decoder(uidBrut);
    const titre = titreDe(kind, uid);
    if (titre === null) {
      return (
        `<span class="${CLASSE_MENTION} ${CLASSE_MENTION_MORTE}" contenteditable="false" ` +
        `data-mention="${echapper(kind)}:${echapper(uid)}">@${echapper(
          texteBrut(texte).replace(/^@/, "") || LIBELLE_SUPPRIME,
        )}</span>`
      );
    }
    return jetonMention(kind, uid, titre);
  });
}

/**
 * Le texte d'un jeton, débarrassé de tout balisage résiduel.
 *
 * `execCommand` a la mauvaise habitude d'envelopper la sélection : un gras
 * appliqué par-dessus une mention produit `<b>@Titre</b>` À L'INTÉRIEUR du
 * jeton. On ne garde que le texte.
 */
function texteBrut(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .trim();
}

function decoder(brut: string): string {
  return brut.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

/** Au-delà, ce n'est plus une recherche : c'est une phrase qui commence par `@`. */
const MOTS_MAX = 3;
const LONGUEUR_MAX = 40;

/**
 * La requête en cours de frappe, si le curseur suit un `@`.
 *
 * ⚠️ Le `@` doit suivre un DÉBUT DE TEXTE ou une ESPACE. Sans cette règle,
 * « contact@exemple.fr » ouvrirait le sélecteur au milieu du mot, à chaque
 * frappe, dans une note qui n'a rien demandé.
 *
 * ⚠️ LES ESPACES SONT ACCEPTÉES, jusqu'à trois mots. La première version
 * s'arrêtait au premier espace — et « @plan de risque » refermait le sélecteur
 * avant d'avoir trouvé « Plan de risque ». Vu à l'écran : la plupart des titres
 * font plusieurs mots, la règle rendait donc la moitié des objets
 * inatteignables. Trois mots suffisent à tous les titres de l'app et referment
 * d'eux-mêmes le sélecteur quand on écrit une vraie phrase après un `@`.
 */
export function requeteEnCours(texteAvantCurseur: string): string | null {
  const m = /(?:^|\s)@([^@\n]{0,40})$/.exec(texteAvantCurseur);
  if (!m) return null;
  const requete = m[1];
  if (requete.length > LONGUEUR_MAX) return null;
  // `split` sur les espaces : « plan de risque » fait trois mots, « plan de »
  // en fait deux (le mot vide de fin ne compte pas, on est en train de le taper).
  if (requete.trim().split(/\s+/).filter(Boolean).length > MOTS_MAX) return null;
  return requete;
}
