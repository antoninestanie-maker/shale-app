/**
 * Les pièces jointes — le jeton dans le corps d'une note, et ce qu'on en lit.
 *
 * ⚠️ CE FICHIER EST STRICTEMENT PUR — aucun accès au disque, à Tauri ni au DOM.
 * C'est le partage `mentions.ts` / `mentionsDom.ts`, et il a une raison de plus
 * ici : `repo.ts` importe `refusDeDepot` pour refuser un dépôt trop gros. Si ce
 * module importait `isTauri` en retour, les deux se citeraient mutuellement —
 * un cycle que les modules ES résolvent, mais au prix d'un ordre d'évaluation
 * dont personne ne se souvient le jour où une constante sort `undefined`.
 * Ce qui touche au disque vit donc dans `repo.ts` (`deposerPieceJointe`,
 * `ouvrirPieceJointe`, `supprimerPieceJointe`).
 *
 * ⚠️ LA LECTURE SE FAIT PAR EXPRESSION RÉGULIÈRE, comme celle des mentions, et
 * pour la même raison : une pièce jointe qui ne survit pas à un aller-retour
 * d'enregistrement est un fichier perdu, en silence. Le format du jeton est donc
 * assez strict pour qu'une regex le lise sans risque — c'est NOUS qui l'écrivons.
 */

// ─── Le jeton ────────────────────────────────────────────────────────────────

/**
 * Le jeton, tel qu'il est enregistré dans le corps d'une note.
 *
 * ```html
 * <span class="piece-jointe" contenteditable="false"
 *       data-fichier="a3f2-…" data-nom="Contrat.pdf" data-taille="284193">Contrat.pdf</span>
 * ```
 *
 * ⭐⭐ POURQUOI CE N'EST PAS UN JETON DE MENTION (`data-mention="file:…"`), alors
 * que les deux se ressemblent et que le fichier EST une famille du graphe.
 *
 * Parce qu'une version antérieure de l'app doit pouvoir relire cette note. Un
 * `data-mention="file:…"` y serait lu par `extraireMentions()`, dont le
 * `estKindConnu("file")` rendrait faux — le jeton serait donc ignoré, ce qui est
 * correct, mais il s'afficherait quand même comme une mention morte au milieu du
 * texte. Avec un attribut à lui, il n'est vu par personne : un `<span>` inerte
 * qui affiche le nom du fichier. La dégradation est lisible au lieu d'être
 * fausse.
 *
 * ⚠️ `contenteditable="false"` en fait un ATOME, exactement comme le jeton de
 * mention : le curseur le franchit d'un coup et la suppression l'emporte entier.
 * Sans cela, on effacerait une lettre au milieu du nom et le jeton afficherait
 * « Contrt.pdf » pour un fichier qui, lui, s'appelle toujours « Contrat.pdf ».
 *
 * ⚠️ LE NOM EST UNE COPIE D'AFFICHAGE, jamais la référence. L'identité tient
 * dans `data-fichier`, et `rafraichirPiecesJointes()` réécrit le texte à chaque
 * chargement — même contrat que les mentions.
 *
 * ⚠️ `data-nom` et `data-taille` sont DUPLIQUÉS depuis la table `files`, et c'est
 * volontaire : ils permettent d'afficher quelque chose de sensé quand la ligne
 * n'est pas encore arrivée par la synchronisation, ou quand elle n'arrivera
 * jamais. Ils ne font jamais autorité.
 */
const JETON_RE =
  /<span\b[^>]*\bdata-fichier="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi;

/** Lit un attribut précis dans le texte d'ouverture d'une balise. */
const ATTR_RE = (nom: string) => new RegExp(`\\b${nom}="([^"]*)"`, "i");

export const CLASSE_PIECE_JOINTE = "piece-jointe";
/** Le fichier existe, mais ses octets ne sont pas sur CET appareil. */
export const CLASSE_ABSENTE = "piece-jointe-absente";
/** La ligne `files` n'existe plus du tout : le fichier a été supprimé. */
export const CLASSE_MORTE = "piece-jointe-morte";

/** Ce que l'app affiche quand la pièce jointe n'existe plus. */
export const LIBELLE_SUPPRIMEE = "fichier supprimé";
/** Ce qu'elle affiche quand seuls les octets manquent. */
export const LIBELLE_ABSENTE = "pas sur cet appareil";

export interface PieceJointe {
  /** L'`uid` de la ligne `files`. C'est la seule identité. */
  uid: string;
  /** Copie d'affichage du nom d'origine. */
  nom: string;
  /** Copie d'affichage de la taille, en octets. `0` quand elle est inconnue. */
  taille: number;
}

/** Échappe ce qui ne doit jamais être interprété comme du balisage. */
function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Le HTML d'un jeton de pièce jointe. */
export function jetonPieceJointe(p: PieceJointe): string {
  return (
    `<span class="${CLASSE_PIECE_JOINTE}" contenteditable="false" ` +
    `data-fichier="${echapper(p.uid)}" data-nom="${echapper(p.nom)}" ` +
    `data-taille="${String(Math.max(0, Math.trunc(p.taille) || 0))}">` +
    `${echapper(p.nom)}</span>`
  );
}

/**
 * Toutes les pièces jointes d'un texte, dans l'ordre, SANS doublon.
 *
 * Le même fichier cité deux fois ne fait qu'une arête (index unique de la
 * migration 020) : les dédoublonner ici évite à l'appelant de gérer un conflit
 * d'écriture pour un cas normal — on renvoie souvent deux fois au même document
 * dans une longue note.
 */
export function extrairePiecesJointes(html: string): PieceJointe[] {
  if (!html) return [];
  const vues = new Set<string>();
  const out: PieceJointe[] = [];
  for (const m of html.matchAll(JETON_RE)) {
    const uid = decoder(m[1]);
    if (!uid || vues.has(uid)) continue;
    vues.add(uid);
    const balise = m[0].slice(0, m[0].indexOf(">") + 1);
    const nom = decoder(ATTR_RE("data-nom").exec(balise)?.[1] ?? "");
    const taille = Number(ATTR_RE("data-taille").exec(balise)?.[1] ?? "0");
    out.push({
      uid,
      nom: nom || texteBrut(m[2]),
      taille: Number.isFinite(taille) && taille > 0 ? taille : 0,
    });
  }
  return out;
}

function decoder(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&");
}

function texteBrut(html: string): string {
  return decoder(html.replace(/<[^>]*>/g, "")).trim();
}

// ─── Taille et nature ────────────────────────────────────────────────────────

/**
 * Le plafond d'une pièce jointe, en octets.
 *
 * ⚠️ CE N'EST PAS UNE LIMITE TECHNIQUE, c'est une limite de bon sens, et elle
 * ne protège pas ce qu'on croit. Les octets vivant sur le disque, un gros
 * fichier ne pèse ni sur l'index FTS, ni sur la synchronisation — le vrai coût
 * est ailleurs : la base et les fichiers partent ensemble dans les sauvegardes
 * (`lib/sauvegardes.ts`), et un dossier de pièces jointes de plusieurs gigaoctets
 * les rendrait impraticables sans que personne ne fasse le lien.
 *
 * 100 Mo laisse passer tout ce qu'on joint à une note de travail et arrête une
 * vidéo déposée par mégarde. Au-delà, l'app le DIT au lieu d'échouer en silence.
 */
export const TAILLE_MAX = 100 * 1024 * 1024;

export type RefusDepot = "trop-gros" | "vide";

/**
 * Un fichier peut-il être déposé ? `null` = oui.
 *
 * ⚠️ Un fichier VIDE est refusé, et ce n'est pas du zèle : un dossier glissé
 * dans la fenêtre arrive comme une entrée de 0 octet sur plusieurs plateformes.
 * L'accepter créerait une pièce jointe qui ne s'ouvrira jamais, et l'utilisateur
 * croirait avoir joint son dossier.
 */
export function refusDeDepot(taille: number): RefusDepot | null {
  if (!(taille > 0)) return "vide";
  if (taille > TAILLE_MAX) return "trop-gros";
  return null;
}

/**
 * Taille lisible : « 284 ko », « 1,4 Mo ».
 *
 * ⚠️ Passe par `Intl`, jamais par un `toFixed` : le séparateur décimal est une
 * virgule en français et un point en anglais. Une taille écrite « 1.4 Mo » dans
 * l'app française est le genre de détail qui trahit un logiciel traduit à moitié.
 * Les unités, elles, sont les symboles SI — ils ne se traduisent pas.
 */
export function tailleLisible(octets: number, langue: string): string {
  const n = Math.max(0, Math.trunc(octets) || 0);
  if (n < 1000) return `${n} o`;
  const unites = ["ko", "Mo", "Go", "To"];
  let valeur = n / 1000;
  let i = 0;
  while (valeur >= 1000 && i < unites.length - 1) {
    valeur /= 1000;
    i++;
  }
  // Une décimale sous 10, aucune au-delà : « 1,4 Mo » renseigne, « 284,3 ko »
  // encombre.
  const decimales = valeur < 10 ? 1 : 0;
  const nombre = new Intl.NumberFormat(langue, {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(valeur);
  return `${nombre} ${unites[i]}`;
}

/**
 * Les familles de fichiers que l'app sait nommer, pour choisir une icône et un
 * mot. Volontairement COURTE : au-delà, « Fichier » est une réponse honnête.
 */
export type Famille = "pdf" | "image" | "tableur" | "texte" | "archive" | "autre";

const PAR_EXTENSION: Record<string, Famille> = {
  pdf: "pdf",
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image",
  heic: "image", svg: "image",
  xlsx: "tableur", xls: "tableur", csv: "tableur", numbers: "tableur",
  docx: "texte", doc: "texte", pages: "texte", txt: "texte", md: "texte",
  rtf: "texte",
  zip: "archive", rar: "archive", "7z": "archive", gz: "archive",
};

/**
 * La famille d'un fichier, d'après son type MIME puis son extension.
 *
 * ⚠️ LE MIME D'ABORD, l'extension en repli, et jamais l'inverse : le type est
 * donné par le système au moment du dépôt, alors que l'extension est une chaîne
 * que n'importe qui peut réécrire. Mais le MIME peut manquer (fichier sans
 * extension connue) — d'où les deux.
 */
export function familleDe(nom: string, mime: string): Famille {
  const m = (mime || "").toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("text/")) return "texte";
  const ext = nom.toLowerCase().split(".").pop() ?? "";
  return (ext && PAR_EXTENSION[ext]) || "autre";
}

/**
 * Un nom de fichier sûr pour l'affichage, borné en longueur.
 *
 * ⚠️ Tronque au MILIEU, pas à la fin : « rapport-trimestriel-2026-final.pdf »
 * coupé à la fin donne « rapport-trimestr… » et perd l'extension, c'est-à-dire
 * la seule partie qui dit de quoi il s'agit.
 */
export function nomLisible(nom: string, max = 32): string {
  const propre = nom.trim() || "sans nom";
  if (propre.length <= max) return propre;
  const point = propre.lastIndexOf(".");
  const ext = point > 0 && propre.length - point <= 8 ? propre.slice(point) : "";
  const tete = Math.max(4, max - ext.length - 1);
  return `${propre.slice(0, tete)}…${ext}`;
}

