import type { Carte } from "../carte";
import type { Goal } from "../types";
import { rangEnDernier } from "./ajout";
import { uidDeLigne } from "./progression";
import { etapesTriees, niveauDe, peutAjouterEtape, premierAccueil } from "./structure";

export { rangEnDernier, premierAccueil };

/**
 * ⭐ DONNER UN TYPE À UN NŒUD — où l'objet créé se range (chantier du 2026-09-29).
 *
 * Un nœud de carte peut DEVENIR une étape, une tâche ou une habitude : l'objet
 * est créé, et le nœud devient une référence vers lui. Ce fichier décide OÙ il
 * se range, d'après la HIÉRARCHIE DE LA CARTE, au moment du typage — et rien
 * d'autre. Pur : l'écriture vit dans `typer.ts`, l'annonce dans l'éditeur.
 *
 *   • TÂCHE    — rattachée au premier ancêtre qui est un objectif ou une
 *     étape ; sinon libre, rattachable plus tard.
 *   • ÉTAPE    — EXIGE un objectif : sous l'ancêtre-objectif, en DERNIER rang ;
 *     sinon, le panneau demande lequel.
 *   • HABITUDE — créée seule ; si un ancêtre-objectif existe, elle est
 *     rattachée par une étape qui la compte.
 *
 * ⭐ 2026-10-12 — « ÉTAPE », UN SEUL MOT. Le menu proposait « Phase » et
 * « Sous-objectif » ; il propose « Étape », et où elle va se déduit de la
 * carte. Posée sous une étape, elle en fait une phase (`ajout.ts`).
 *
 * ⚠️ LA FEUILLE DE ROUTE N'A QUE TROIS NIVEAUX (`structure.ts`). Une étape
 * demandée sous une étape de niveau 2 ne peut pas y naître : elle va sous la
 * phase au-dessus, et l'éditeur le DIT (`repli`). Ne rien dire aurait rangé
 * l'objet ailleurs que là où on l'a dessiné, en silence.
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
    if (peutAjouterEtape(r, goals)) out.push({ goal: r, niveau: 0 });
    for (const e of etapesTriees(r.id, goals)) {
      if (niveauDe(e, goals) === 1 && peutAjouterEtape(e, goals)) out.push({ goal: e, niveau: 1 });
    }
  }
  return out;
}

// ─── Le typage DIRECT (retour d'Antonin, 2026-09-29 au soir) ────────────────

/**
 * ⭐ CHOISIR LE TYPE AU CLIC DROIT CRÉE L'OBJET TOUT DE SUITE.
 *
 * Antonin, après essai : « on doit pouvoir choisir directement sans avoir de
 * confirmation par une fenêtre. » Le panneau ne reste que là où il y a une
 * vraie question — une étape sans aucun objectif au-dessus d'elle : il faut
 * bien dire lequel. Partout ailleurs, la hiérarchie de la carte répond, et une
 * ligne dans l'en-tête de la carte dit APRÈS coup où l'objet est rangé.
 */
export type TypeDirect = "etape" | "tache" | "habitude";

/**
 * La cible d'une habitude rattachée, en jours, quand personne ne l'a choisie.
 * Trente jours est la valeur des exemples, et elle se change dans la feuille
 * de route (« Atteindre un nombre »).
 */
export const CIBLE_HABITUDE_PAR_DEFAUT = 30;

export type PlanDirect =
  | { quoi: "tache"; goal: Goal | null }
  | { quoi: "etape"; parent: Goal; repli: { voulu: Goal; retenu: Goal } | null }
  | { quoi: "habitude"; rattacher: { sous: Goal; voulu: Goal; cible: number } | null }
  /** Une étape sans objectif au-dessus : la seule question qui reste à poser. */
  | { quoi: "choisir-objectif" };

export function planDirect(carte: Carte, id: string, type: TypeDirect, goals: readonly Goal[]): PlanDirect {
  const voulu = ancetreObjectif(carte, id, goals);
  if (type === "tache") return { quoi: "tache", goal: voulu };
  const parent = voulu ? premierAccueil(voulu, goals) : null;
  if (type === "habitude") {
    return { quoi: "habitude", rattacher: voulu && parent ? { sous: parent, voulu, cible: CIBLE_HABITUDE_PAR_DEFAUT } : null };
  }
  if (!voulu || !parent) return { quoi: "choisir-objectif" };
  return { quoi: "etape", parent, repli: parent.id === voulu.id ? null : { voulu, retenu: parent } };
}
