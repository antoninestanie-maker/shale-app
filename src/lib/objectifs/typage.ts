import type { Carte } from "../carte";
import type { Goal } from "../types";
import { uidDeLigne } from "./progression";
import { etapesTriees, niveauDe, peutAjouterEtape, type GenreEtape } from "./structure";

/**
 * ⭐ DONNER UN TYPE À UN NŒUD — où l'objet créé se range (chantier du 2026-09-29).
 *
 * Un nœud de carte peut DEVENIR une étape, une tâche ou une habitude : l'objet
 * est créé, et le nœud devient une référence vers lui. Ce fichier décide OÙ il
 * se range, d'après la HIÉRARCHIE DE LA CARTE, au moment du typage — et rien
 * d'autre. Pur : l'écriture vit dans `typer.ts`, l'annonce dans le panneau.
 *
 * La règle, telle que le cadrage l'a posée :
 *   • TÂCHE    — rattachée au premier ancêtre qui est un objectif ou une
 *     étape ; sinon libre, rattachable plus tard.
 *   • ÉTAPE    — EXIGE un objectif : sous l'ancêtre-objectif, en DERNIER rang ;
 *     sinon, le panneau demande lequel.
 *   • HABITUDE — créée seule par défaut ; si un ancêtre-objectif existe, le
 *     panneau PROPOSE de la rattacher (case cochée, décochable), jamais imposé.
 *
 * ⚠️ LA FEUILLE DE ROUTE N'A QUE TROIS NIVEAUX (`structure.ts`). Une étape
 * demandée sous un sous-objectif ne peut pas y naître : elle va sous la phase
 * au-dessus, et le panneau le DIT (`repli`). Ne rien dire aurait rangé l'objet
 * ailleurs que là où on l'a dessiné, en silence.
 */

/** Le premier ANCÊTRE du nœud (lui exclu) qui cite un objectif vivant. */
export function ancetreObjectif(carte: Carte, id: string, goals: readonly Goal[]): Goal | null {
  const parUid = new Map(goals.map((g) => [uidDeLigne("goal", g), g]));
  const vus = new Set<string>([id]);
  let courant = carte.noeuds.find((n) => n.id === id)?.parent ?? null;
  while (courant && !vus.has(courant)) {
    vus.add(courant);
    const n = carte.noeuds.find((x) => x.id === courant);
    if (!n) break;
    if (n.ref?.kind === "goal" && !n.mort) {
      const g = parUid.get(n.ref.uid);
      if (g) return g;
    }
    courant = n.parent;
  }
  return null;
}

/** Les genres qu'une étape peut prendre sous `parent` — phase d'abord, comme la feuille de route. */
export function genresPour(parent: Goal, goals: readonly Goal[]): GenreEtape[] {
  return (["jalon", "sous-objectif"] as const).filter((g) => peutAjouterEtape(parent, g, goals));
}

/** Le parent d'un objectif, s'il existe encore. */
function parentDe(g: Goal, goals: readonly Goal[]): Goal | null {
  return g.parent_goal_id == null ? null : (goals.find((x) => x.id === g.parent_goal_id) ?? null);
}

export interface PlanEtape {
  /** Sous quel objectif l'étape naît. `null` : le panneau doit le demander. */
  parent: Goal | null;
  genres: GenreEtape[];
  /** L'ancêtre dessiné ne peut pas l'accueillir : on dit où elle ira à la place. */
  repli: { voulu: Goal; retenu: Goal } | null;
}

export function planEtape(carte: Carte, id: string, goals: readonly Goal[]): PlanEtape {
  const voulu = ancetreObjectif(carte, id, goals);
  if (!voulu) return { parent: null, genres: [], repli: null };
  const ici = genresPour(voulu, goals);
  if (ici.length) return { parent: voulu, genres: ici, repli: null };
  const au = parentDe(voulu, goals);
  if (au) {
    const la = genresPour(au, goals);
    if (la.length) return { parent: au, genres: la, repli: { voulu, retenu: au } };
  }
  return { parent: null, genres: [], repli: null };
}

export interface PlanHabitude {
  /**
   * Le rattachement PROPOSÉ : un sous-objectif « compté par l'habitude » naîtra
   * sous `sous`. `null` : aucun ancêtre-objectif, l'habitude naît seule.
   */
  propose: { sous: Goal; voulu: Goal } | null;
}

/**
 * ⭐ RATTACHER UNE HABITUDE, C'EST CRÉER L'ÉTAPE QUI LA COMPTE.
 *
 * Décision d'Antonin à l'arrêt 1 : aucune migration. Une habitude se relie à
 * un objectif par le chemin qui existe depuis la 026 — un sous-objectif mesuré
 * « par une habitude » (`count_source = 'habit'`), avec une cible en jours.
 * C'est aussi le seul chemin où elle FAIT AVANCER l'objectif : une habitude
 * ne compte jamais en binaire (« écrire n'est pas avancer »).
 */
export function planHabitude(carte: Carte, id: string, goals: readonly Goal[]): PlanHabitude {
  const voulu = ancetreObjectif(carte, id, goals);
  if (!voulu) return { propose: null };
  if (peutAjouterEtape(voulu, "sous-objectif", goals)) return { propose: { sous: voulu, voulu } };
  const au = parentDe(voulu, goals);
  if (au && peutAjouterEtape(au, "sous-objectif", goals)) return { propose: { sous: au, voulu } };
  return { propose: null };
}

/** La tâche se rattache au premier ancêtre-objectif, quel que soit son niveau. */
export function planTache(carte: Carte, id: string, goals: readonly Goal[]): { goal: Goal | null } {
  return { goal: ancetreObjectif(carte, id, goals) };
}

/**
 * Les objectifs qui peuvent accueillir une étape, dans l'ordre de la vue
 * Objectifs — pour le panneau, quand la carte ne dit pas lequel.
 */
export function objectifsAccueillants(goals: readonly Goal[]): { goal: Goal; niveau: number }[] {
  const out: { goal: Goal; niveau: number }[] = [];
  const racines = goals
    .filter((g) => g.parent_goal_id == null)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.id - b.id);
  for (const r of racines) {
    if (genresPour(r, goals).length) out.push({ goal: r, niveau: 0 });
    for (const e of etapesTriees(r.id, goals)) {
      if (niveauDe(e, goals) === 1 && genresPour(e, goals).length) out.push({ goal: e, niveau: 1 });
    }
  }
  return out;
}

/** Le rang d'une étape neuve : APRÈS toutes ses sœurs (même calcul que la feuille de route). */
export function rangEnDernier(parentId: number, goals: readonly Goal[]): number {
  const soeurs = goals.filter((g) => g.parent_goal_id === parentId);
  return soeurs.reduce((mx, s) => Math.max(mx, (s.position ?? 0) + 1), soeurs.length);
}
