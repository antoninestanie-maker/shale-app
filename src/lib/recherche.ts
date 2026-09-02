import { norm } from "./actions";
import { LINK_KINDS } from "./liens";
import type { LinkKind } from "./types";

/**
 * ⭐ UN SEUL moteur de recherche, deux points d'entrée : la palette ⌘K et le
 * sélecteur de mention `@`.
 *
 * LE PROBLÈME QU'IL RÉSOUT. Trois régimes coexistaient et ne se parlaient pas :
 * les notes ont un index FTS5, le Savoir cherche en mémoire sur sa colonne
 * `text` matérialisée, et **les autres modules n'ont rien du tout**. Chercher
 * un objectif ou un événement était donc impossible, et la palette ⌘K ne
 * trouvait que des ACTIONS, jamais des choses.
 *
 * ⚠️ CE QU'ON NE FAIT PAS : remplacer FTS5. La recherche de notes est
 * aujourd'hui instantanée et hors ligne ; la refondre en mémoire la
 * DÉGRADERAIT sur une base de plusieurs milliers de notes. FTS5 reste donc le
 * chemin des notes, et ce module classe et fusionne ce que chaque source rend.
 * L'unification est dans le CLASSEMENT et la FORME, pas dans le stockage.
 */

export interface Document {
  kind: LinkKind;
  id: number;
  uid: string;
  titre: string;
  /** Corps déjà réduit en texte brut. Facultatif : beaucoup d'objets n'en ont pas. */
  corps?: string;
  /** Contexte affiché sous le titre (thème, tag, date…). */
  contexte?: string;
}

export interface Trouvaille extends Document {
  score: number;
  /** Le fragment du corps où la requête apparaît. */
  extrait?: string;
}

/**
 * Poids par famille, à score de texte égal.
 *
 * Ce n'est pas de la préférence esthétique : quand on tape trois lettres, on
 * cherche presque toujours quelque chose qu'on a ÉCRIT (une note, une fiche),
 * pas une tâche récurrente qui contient les mêmes lettres. L'ordre suit
 * `LINK_KINDS` pour tout le reste, afin que deux recherches identiques rendent
 * toujours le même ordre.
 */
const POIDS: Record<LinkKind, number> = {
  note: 6,
  knowledge: 6,
  object: 5,
  goal: 4,
  event: 3,
  task: 3,
  trade: 1,
};

const RANG = new Map(LINK_KINDS.map((k, i) => [k, i]));

/**
 * Score d'un document pour une requête déjà normalisée.
 * `0` = ne correspond pas, et le document est écarté.
 *
 * Trois paliers, du plus fort au plus faible, parce qu'ils correspondent à trois
 * intentions différentes :
 *   100 — le titre COMMENCE par la requête : c'est presque sûrement ce qu'on veut ;
 *    60 — un MOT du titre commence par la requête : « risque » trouve « plan de risque » ;
 *    30 — la requête est quelque part dans le titre ;
 *    10 — elle n'est que dans le corps.
 */
export function scoreDe(doc: Document, requete: string): number {
  const titre = norm(doc.titre);
  if (titre === requete) return 120 + POIDS[doc.kind];
  if (titre.startsWith(requete)) return 100 + POIDS[doc.kind];
  if (titre.split(/\s+/).some((mot) => mot.startsWith(requete))) return 60 + POIDS[doc.kind];
  if (titre.includes(requete)) return 30 + POIDS[doc.kind];
  if (doc.corps && norm(doc.corps).includes(requete)) return 10 + POIDS[doc.kind];
  return 0;
}

/** Le fragment du corps autour de la requête — pour montrer POURQUOI ça sort. */
export function extraitAutour(corps: string, requete: string, largeur = 70): string | undefined {
  const i = norm(corps).indexOf(requete);
  if (i < 0) return undefined;
  const debut = Math.max(0, i - Math.floor(largeur / 3));
  const fin = Math.min(corps.length, i + requete.length + largeur);
  return (debut > 0 ? "…" : "") + corps.slice(debut, fin).trim() + (fin < corps.length ? "…" : "");
}

export interface OptionsRecherche {
  limite?: number;
  /** Ne garder que ces familles — le sélecteur `@` s'en sert pour filtrer. */
  familles?: readonly LinkKind[];
  /** Exclure un document : on ne se cite pas soi-même. */
  exclure?: { kind: LinkKind; uid: string };
}

/**
 * Classe un corpus pour une requête.
 *
 * ⚠️ Une requête VIDE ne rend pas tout : elle rend les premiers documents dans
 * l'ordre reçu. C'est ce qui permet au sélecteur `@` de proposer quelque chose
 * dès l'ouverture (l'appelant passe alors les plus récents), au lieu d'un écran
 * blanc qui n'apprend rien à personne.
 */
export function rechercher(
  corpus: readonly Document[],
  requete: string,
  options: OptionsRecherche = {},
): Trouvaille[] {
  const limite = options.limite ?? 12;
  const familles = options.familles ? new Set<string>(options.familles) : null;
  const q = norm(requete.trim());

  const retenus = corpus.filter(
    (d) =>
      (!familles || familles.has(d.kind)) &&
      !(options.exclure && d.kind === options.exclure.kind && d.uid === options.exclure.uid),
  );

  if (!q) {
    return retenus.slice(0, limite).map((d) => ({ ...d, score: 0 }));
  }

  const trouvailles: Trouvaille[] = [];
  for (const doc of retenus) {
    const score = scoreDe(doc, q);
    if (score === 0) continue;
    trouvailles.push({
      ...doc,
      score,
      extrait: doc.corps ? extraitAutour(doc.corps, q) : undefined,
    });
  }

  // À score égal, on classe par famille puis par titre : deux recherches
  // identiques doivent rendre exactement le même ordre, sinon la sélection au
  // clavier saute d'une frappe à l'autre.
  trouvailles.sort(
    (a, b) =>
      b.score - a.score ||
      (RANG.get(a.kind) ?? 99) - (RANG.get(b.kind) ?? 99) ||
      a.titre.localeCompare(b.titre),
  );
  return trouvailles.slice(0, limite);
}
