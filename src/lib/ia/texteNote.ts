// ─────────────────────────────────────────────────────────────────────────────
// Phase F — les notes : ce que l'app fait du texte AVANT et APRÈS le modèle.
//
// Le corps d'une note est du HTML (`Note.body`). Le modèle, lui, ne reçoit et
// ne rend que du TEXTE STRUCTURÉ, quatre formes de ligne :
//
//     # Titre          ## Sous-titre          - puce          paragraphe
//
// `texteDeHtml` fait l'aller, `htmlDeTexte` le retour. Le retour ÉCHAPPE TOUT :
// rien de ce que rend le modèle n'entre dans le DOM comme balise (`csp: null`,
// règle XSS du chantier). Conséquence assumée, et dite à l'écran : la mise en
// forme en ligne (gras, couleurs) ne survit pas à une réécriture.
//
// ⚠️ PUR, sans DOM : tout se teste sous node (`texteNote.test.ts`).
// ─────────────────────────────────────────────────────────────────────────────

import type { Carte, Noeud } from "../carte";
import { normaliser } from "../tachesVue";
import type { LinkKind } from "../types";
import type { ContratsIa } from "./contrats";

function echapper(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function desechapper(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** Les blocs qui ne sont pas du texte : cartes, croquis, pièces jointes, images. */
const BLOCS = /<figure\b[\s\S]*?<\/figure>|<svg\b[\s\S]*?<\/svg>|<img\b[^>]*>/gi;

/**
 * La note porte-t-elle autre chose que du texte — un bloc (carte, image, pièce
 * jointe) ou une mention `@` ? Réécrire la note ENTIÈRE les détruirait : on ne
 * le propose alors que sur une sélection.
 */
export function aDesBlocs(html: string): boolean {
  return /<figure\b|<svg\b|<img\b|class="[^"]*\bmention\b/i.test(html);
}

/** HTML d'une note (ou d'une sélection) → texte structuré. Les blocs non textuels disparaissent. */
export function texteDeHtml(html: string): string {
  if (!html) return "";
  const brut = html
    .replace(BLOCS, "")
    .replace(/<h1\b[^>]*>/gi, "\n# ")
    .replace(/<h[2-6]\b[^>]*>/gi, "\n## ")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|li|ul|ol|h[1-6]|blockquote|tr|section)>|<br\s*\/?>/gi, "\n")
    .replace(/<(p|div|blockquote|ul|ol)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  return desechapper(brut)
    .split("\n")
    .map((l) => l.replace(/[​ ]/g, " ").replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0 && l !== "#" && l !== "##" && l !== "-")
    .join("\n");
}

/**
 * Texte structuré → HTML de note. ⚠️ TOUT est échappé : une ligne du modèle
 * qui contiendrait `<img onerror=…>` s'affiche telle quelle, en lettres.
 */
export function htmlDeTexte(texte: string): string {
  const out: string[] = [];
  let liste: string[] = [];
  const fermerListe = () => {
    if (liste.length) out.push(`<ul>${liste.map((l) => `<li>${l}</li>`).join("")}</ul>`);
    liste = [];
  };
  for (const brute of texte.split("\n")) {
    const l = brute.trim();
    if (!l) continue;
    const puce = /^[-•*]\s+(.*)$/.exec(l);
    if (puce) {
      liste.push(echapper(puce[1]));
      continue;
    }
    fermerListe();
    const h2 = /^##\s+(.*)$/.exec(l);
    const h1 = h2 ? null : /^#\s+(.*)$/.exec(l);
    if (h2) out.push(`<h2>${echapper(h2[1])}</h2>`);
    else if (h1) out.push(`<h1>${echapper(h1[1])}</h1>`);
    else out.push(`<p>${echapper(l)}</p>`);
  }
  fermerListe();
  return out.join("");
}

// ── #20 Résumer ─────────────────────────────────────────────────────────────

/** Le bloc résumé à poser en tête de note : une citation, titre en gras. Tout est échappé. */
export function blocResume(etiquette: string, sortie: ContratsIa["resumer"]["sortie"]): string {
  const points = sortie.points.length ? `<ul>${sortie.points.map((p) => `<li>${echapper(p)}</li>`).join("")}</ul>` : "";
  return `<blockquote><p><b>${echapper(etiquette)}</b></p><p>${echapper(sortie.resume)}</p>${points}</blockquote><p><br></p>`;
}

// ── #24 Liens `@` ───────────────────────────────────────────────────────────

export const MAX_CANDIDATS = 40;
/** Combien de mots de la note servent à interroger la recherche. */
export const MOTS_RECHERCHES = 12;

const MOTS_VIDES = new Set(
  "avec dans pour sans sous vers chez entre avant apres depuis leur leurs notre votre cette celui celle mais plus moins tres faire etre avoir comme aussi alors donc tout tous toute toutes quand quel quelle from with that this your into have will about what when which there their".split(
    " ",
  ),
);

/** Les mots les plus présents d'un texte (sans accent, quatre lettres au moins), du plus fréquent au moins fréquent. */
export function motsFrequents(texte: string, n: number = MOTS_RECHERCHES): string[] {
  const compte = new Map<string, number>();
  for (const m of normaliser(texte).split(/[^a-z0-9]+/)) {
    if (m.length < 4 || MOTS_VIDES.has(m)) continue;
    compte.set(m, (compte.get(m) ?? 0) + 1);
  }
  return [...compte.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([m]) => m);
}

export interface Candidat {
  /** Identifiant COURT envoyé au modèle (`c1`…) — jamais l'uid de l'objet. */
  id: string;
  kind: LinkKind;
  uid: string;
  titre: string;
}

/**
 * Les candidats d'une note : ce que la recherche de l'app (FTS5 + titres) rend
 * pour ses mots les plus présents. La note elle-même et les objets qu'elle
 * cite DÉJÀ sont écartés. Au plus quarante ; le modèle ne voit que cette liste.
 */
export async function candidatsLiens(
  texte: string,
  chercher: (requete: string) => Promise<ReadonlyArray<{ kind: LinkKind; uid: string; titre: string }>>,
  exclus: ReadonlyArray<{ kind: LinkKind; uid: string }>,
): Promise<Candidat[]> {
  const vus = new Set(exclus.map((e) => `${e.kind}:${e.uid}`));
  const out: Candidat[] = [];
  for (const mot of motsFrequents(texte)) {
    if (out.length >= MAX_CANDIDATS) break;
    for (const r of await chercher(mot)) {
      const cle = `${r.kind}:${r.uid}`;
      if (vus.has(cle) || !r.titre.trim()) continue;
      vus.add(cle);
      out.push({ id: `c${out.length + 1}`, kind: r.kind, uid: r.uid, titre: r.titre.slice(0, 200) });
      if (out.length >= MAX_CANDIDATS) break;
    }
  }
  return out;
}

export interface LienPropose {
  passage: string;
  candidat: Candidat;
}

/**
 * Les suggestions utilisables : l'identifiant doit être un candidat ENVOYÉ, le
 * passage doit se trouver tel quel dans le texte de la note, et une même paire
 * ne revient pas deux fois. (Le serveur le vérifie déjà ; la note a pu changer
 * pendant l'appel.)
 */
export function liensUtilisables(
  texte: string,
  candidats: readonly Candidat[],
  liens: ContratsIa["liens"]["sortie"]["liens"],
): LienPropose[] {
  const parId = new Map(candidats.map((c) => [c.id, c]));
  const vus = new Set<string>();
  const out: LienPropose[] = [];
  for (const l of liens) {
    const candidat = parId.get(l.id);
    const passage = l.passage.trim();
    if (!candidat || !passage || !texte.includes(passage)) continue;
    const cle = `${passage}\u0000${candidat.id}`;
    if (vus.has(cle)) continue;
    vus.add(cle);
    out.push({ passage, candidat });
  }
  return out;
}

// ── #27 Carte mentale ───────────────────────────────────────────────────────

/** Bornes de la carte produite par l'IA (le format `data-mindmap` n'en a aucune). */
export const CARTE_MAX_NOEUDS = 40;

type BrancheIa = { texte: string; enfants?: BrancheIa[] };

/**
 * La structure rendue par le modèle → une `Carte` au format existant
 * (`{v: 1, noeuds}`, ids neufs, une racine). Trois niveaux sous la racine, et
 * quarante nœuds au plus : au-delà, les branches les plus profondes sont
 * coupées. L'appelant la passe ensuite par `lireCarte`, qui normalise tout.
 */
export function carteDepuisIa(sortie: ContratsIa["carte"]["sortie"]): Carte {
  const noeuds: Noeud[] = [{ id: "n0", parent: null, texte: sortie.racine.trim().slice(0, 80) }];
  let n = 1;
  // Largeur d'abord : si le plafond tombe, ce sont les détails qui sautent.
  let niveau: Array<{ parent: string; b: BrancheIa }> = sortie.branches.map((b) => ({ parent: "n0", b }));
  for (let profondeur = 1; profondeur <= 3 && niveau.length; profondeur++) {
    const suivant: typeof niveau = [];
    for (const { parent, b } of niveau) {
      const texte = b.texte.trim().slice(0, 80);
      if (!texte || noeuds.length >= CARTE_MAX_NOEUDS) continue;
      const id = `n${n++}`;
      noeuds.push({ id, parent, texte });
      for (const e of b.enfants ?? []) suivant.push({ parent: id, b: e });
    }
    niveau = suivant;
  }
  return { v: 1, noeuds };
}
