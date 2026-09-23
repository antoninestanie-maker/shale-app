import {
  CLASSE_ABSENTE,
  CLASSE_MORTE,
  CLASSE_PIECE_JOINTE,
  extrairePiecesJointes,
  familleDe,
  jetonPieceJointe,
  nomLisible,
  tailleLisible,
  type PieceJointe,
} from "./piecesJointes";

/**
 * Les pièces jointes, côté DOM — insertion au curseur et rafraîchissement.
 *
 * ⚠️ Le partage avec `piecesJointes.ts` (pur, 22 tests) suit celui de
 * `mentions.ts` / `mentionsDom.ts` et de `carte.ts` / `carteDom.ts` : tout ce
 * qui peut être décidé sans le DOM vit là-bas, ici il ne reste que le geste.
 *
 * ⚠️ MAIS CE FICHIER EST TESTÉ, contrairement à ses deux aînés. La première
 * version de ce commentaire disait « aucun test, et c'est structurel, les tests
 * de ce dépôt tournent en `environment: "node"` » — c'était FAUX, et c'est le
 * genre d'affirmation qui se recopie ensuite de module en module. La config
 * globale est bien en `node`, mais un fichier peut demander autre chose par un
 * simple docblock, et deux tests du dépôt le faisaient déjà (`sync/sas.test.ts`,
 * `sync/planificateur.test.ts`). `piecesJointesDom.test.ts` tourne donc sous
 * `happy-dom` et couvre les trois choses qu'aucun test pur ne voit : l'insertion,
 * les trois états d'affichage, et la remontée d'un clic depuis l'enfant cliqué.
 */

/**
 * L'espace posée derrière un jeton.
 *
 * ⚠️ ÉCRITE EN ÉCHAPPEMENT, jamais en caractère littéral. Un U+00A0 tapé tel
 * quel dans la source est INVISIBLE à la relecture : il ressemble trait pour
 * trait à une espace ordinaire, et le premier nettoyage venu le remplacerait
 * sans que rien ne le signale — rendant de nouveau impossible de taper après
 * un jeton en fin de bloc. Sous cette forme, le remplacer demande de le vouloir.
 */
const ESPACE_INSECABLE = "\u00a0";

/** Le pictogramme d'une famille de fichier, en texte — aucune dépendance. */
const PICTO: Record<string, string> = {
  pdf: "PDF",
  image: "IMG",
  tableur: "XLS",
  texte: "TXT",
  archive: "ZIP",
  autre: "FIC",
};

/**
 * Le contenu visible d'un jeton : pictogramme, nom lisible, taille.
 *
 * ⚠️ Ce HTML est REGÉNÉRÉ à chaque chargement par `rafraichirPiecesJointes` —
 * il n'est donc jamais la source de vérité, exactement comme le titre d'un
 * jeton de mention. Ce qui fait foi est `data-fichier`.
 */
function contenuJeton(p: PieceJointe, mime: string, etat: "ok" | "absente" | "morte", langue: string): string {
  const picto = PICTO[familleDe(p.nom, mime)] ?? PICTO.autre;
  const nom = nomLisible(p.nom);
  const detail =
    etat === "morte"
      ? "" // le libellé « fichier supprimé » est posé par la classe, pas ici
      : etat === "absente"
        ? ""
        : p.taille > 0
          ? tailleLisible(p.taille, langue)
          : "";
  return (
    `<span class="pj-picto" aria-hidden="true">${picto}</span>` +
    `<span class="pj-nom">${echapper(nom)}</span>` +
    (detail ? `<span class="pj-detail">${echapper(detail)}</span>` : "")
  );
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Insère une pièce jointe AU CURSEUR, dans le fil du texte.
 *
 * ⭐ EN LIGNE, PAS EN BLOC — contrairement à la carte mentale et au croquis, qui
 * sont des figures de premier niveau. Une pièce jointe se cite au fil d'une
 * phrase (« le détail est dans [Contrat.pdf], page 3 ») : en faire un bloc
 * couperait la phrase en deux et obligerait à la reprendre autour.
 *
 * ⚠️ Une espace insécable est posée APRÈS le jeton, et ce n'est pas cosmétique :
 * sans elle, le curseur se retrouve coincé derrière un élément
 * `contenteditable="false"` en fin de bloc, et il devient impossible de
 * continuer à taper. C'est le même remède que pour les jetons de mention.
 */
export function insererPieceJointe(
  racine: HTMLElement,
  p: PieceJointe,
  mime: string,
  langue: string,
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !racine.contains(sel.getRangeAt(0).startContainer)) {
    // Pas de curseur dans l'éditeur : on pose en fin de note plutôt que de ne
    // rien faire. Un dépôt qui n'aboutit nulle part laisserait un fichier copié
    // sur le disque et cité par personne.
    racine.appendChild(fabriquer(p, mime, langue));
    racine.appendChild(document.createTextNode(ESPACE_INSECABLE));
    return true;
  }

  const range = sel.getRangeAt(0);
  range.deleteContents();
  const jeton = fabriquer(p, mime, langue);
  range.insertNode(jeton);

  const espace = document.createTextNode(ESPACE_INSECABLE);
  jeton.parentNode?.insertBefore(espace, jeton.nextSibling);

  const apres = document.createRange();
  apres.setStartAfter(espace);
  apres.collapse(true);
  sel.removeAllRanges();
  sel.addRange(apres);
  return true;
}

function fabriquer(p: PieceJointe, mime: string, langue: string): HTMLElement {
  const gabarit = document.createElement("div");
  gabarit.innerHTML = jetonPieceJointe(p);
  const jeton = gabarit.firstElementChild as HTMLElement;
  jeton.innerHTML = contenuJeton(p, mime, "ok", langue);
  return jeton;
}

/**
 * Réécrit l'affichage de chaque jeton d'après l'état ACTUEL des fichiers.
 *
 * Trois états, et les confondre serait mentir à l'utilisateur :
 *   • **ok** — la ligne existe et ses octets sont ici ;
 *   • **absente** — la ligne existe, les octets sont sur l'autre appareil. La
 *     pièce jointe est grisée et dit pourquoi. C'est le cas NORMAL du second
 *     appareil, pas une erreur (migration 028) ;
 *   • **morte** — plus aucune ligne : le fichier a été supprimé, ici ou
 *     ailleurs. Le jeton RESTE, barré et non cliquable.
 *
 * ⚠️ LE JETON MORT N'EST PAS RETIRÉ, exactement comme une mention morte :
 * l'effacer réécrirait la phrase de l'utilisateur sans le lui demander, et une
 * phrase à laquelle on enlève un mot ne veut plus rien dire.
 *
 * ⚠️ À appeler au CHARGEMENT, jamais pendant la frappe : réécrire le HTML sous
 * le curseur le déplacerait.
 */
export function rafraichirPiecesJointes(
  html: string,
  etatDe: (uid: string) => { nom: string; mime: string; taille: number; presente: boolean } | null,
  langue: string,
): string {
  const presentes = extrairePiecesJointes(html);
  if (presentes.length === 0) return html;

  const doc = document.createElement("div");
  doc.innerHTML = html;

  for (const el of Array.from(doc.querySelectorAll<HTMLElement>("[data-fichier]"))) {
    const uid = el.dataset.fichier ?? "";
    const etat = etatDe(uid);

    if (!etat) {
      el.className = `${CLASSE_PIECE_JOINTE} ${CLASSE_MORTE}`;
      // Le nom connu du jeton est conservé : c'est la seule trace de ce qui a
      // été joint, et elle aide à comprendre ce qu'on a perdu.
      const connu = presentes.find((p) => p.uid === uid);
      el.innerHTML = contenuJeton(
        connu ?? { uid, nom: "", taille: 0 },
        "",
        "morte",
        langue,
      );
      continue;
    }

    const p: PieceJointe = { uid, nom: etat.nom, taille: etat.taille };
    el.className = etat.presente
      ? CLASSE_PIECE_JOINTE
      : `${CLASSE_PIECE_JOINTE} ${CLASSE_ABSENTE}`;
    // ⚠️ Les copies d'affichage sont réécrites AUSSI dans les attributs : elles
    // servent quand la ligne n'est pas encore arrivée par la synchronisation.
    // Les laisser vieillir ferait afficher l'ancien nom d'un fichier renommé.
    el.dataset.nom = etat.nom;
    el.dataset.taille = String(etat.taille);
    el.innerHTML = contenuJeton(p, etat.mime, etat.presente ? "ok" : "absente", langue);
  }

  return doc.innerHTML;
}

/**
 * L'uid de la pièce jointe cliquée, le cas échéant.
 *
 * ⚠️ Remonte depuis la cible du clic (`closest`) : le clic atterrit sur le
 * pictogramme ou sur le nom, qui sont des enfants du jeton — jamais sur le
 * jeton lui-même. Sans ce `closest`, un clic sur deux ne ferait rien, et le
 * défaut passerait pour de l'imprécision.
 */
export function pieceJointeCliquee(cible: EventTarget | null): string | null {
  if (!(cible instanceof Element)) return null;
  const jeton = cible.closest<HTMLElement>("[data-fichier]");
  if (!jeton) return null;
  // Un jeton mort ne s'ouvre pas : il n'y a rien derrière.
  if (jeton.classList.contains(CLASSE_MORTE)) return null;
  return jeton.dataset.fichier || null;
}
